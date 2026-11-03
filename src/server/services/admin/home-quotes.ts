import "server-only";
import type { HomeQuoteInput } from "@/lib/validation/home-quotes";
import { imageUrl } from "@/lib/images";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { applyImageChange, checkImageChange, type ImageChange } from "@/server/services/images";
import { getStorage } from "@/server/storage/storage";
import type { HeroQuoteStyle } from "@/server/settings/defaults";
import { assertCan, lockAdminWrites, refuse, type Result } from "./common";

// Leadership statements of the home page hero (D-096): the super admin adds, edits, hides,
// reorders and deletes them, each with an optional portrait. Every change is audited.

export type HomeQuoteRow = {
  id: string;
  quote: string;
  honorific: string;
  name: string;
  title: string;
  /** The portrait's address (uploaded or bundled), or null to show the initials. */
  image: string | null;
  isActive: boolean;
  sortOrder: number;
};

const SELECT = { id: true, quote: true, honorific: true, name: true, title: true, imageKey: true, imagePath: true, isActive: true, sortOrder: true } as const;

type Stored = { id: string; imageKey: string | null; imagePath: string | null };

/** The portrait's address: an uploaded image wins over the bundled one of a seeded statement. */
export function quoteImage(q: Stored): string | null {
  return imageUrl("quote", q.id, q.imageKey) ?? q.imagePath;
}

const snapshot = (q: { quote: string; honorific: string; name: string; title: string; isActive: boolean }) => ({
  quote: q.quote,
  honorific: q.honorific,
  name: q.name,
  title: q.title,
  isActive: q.isActive,
});

export async function listHomeQuotes(actor: Actor): Promise<HomeQuoteRow[]> {
  assertCan(actor, "content.manage");
  const rows = await db.homeQuote.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: SELECT });
  return rows.map(({ imageKey, imagePath, ...q }) => ({ ...q, image: quoteImage({ id: q.id, imageKey, imagePath }) }));
}

export async function createHomeQuote(actor: Actor, input: HomeQuoteInput, image: ImageChange): Promise<Result<{ id: string }>> {
  assertCan(actor, "content.manage");
  const checked = await checkImageChange(actor, image);
  if (!checked.ok) return checked;
  const created = await db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const last = await tx.homeQuote.aggregate({ _max: { sortOrder: true } });
    const quote = await tx.homeQuote.create({ data: { ...input, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit({ actorId: actor.id, action: "home_quote.created", entityType: "HomeQuote", entityId: quote.id, after: snapshot(quote) }, tx);
    return quote;
  });
  const stored = await applyImageChange(actor, "quote", created.id, image);
  if (!stored.ok) return stored;
  return { ok: true, id: created.id };
}

export async function updateHomeQuote(actor: Actor, id: string, input: HomeQuoteInput, image: ImageChange): Promise<Result> {
  assertCan(actor, "content.manage");
  const checked = await checkImageChange(actor, image);
  if (!checked.ok) return checked;
  const current = await db.homeQuote.findUnique({ where: { id } });
  if (!current) return refuse("لم يُعثر على الكلمة؛ ربما حُذفت.");

  // Removing the portrait of a seeded statement also drops its bundled image.
  const dropBundled = image && "remove" in image && !current.imageKey && current.imagePath;
  const updated = await db.homeQuote.update({ where: { id }, data: { ...input, ...(dropBundled ? { imagePath: null } : {}) } });
  if (JSON.stringify(snapshot(current)) !== JSON.stringify(snapshot(updated))) {
    await audit({ actorId: actor.id, action: "home_quote.updated", entityType: "HomeQuote", entityId: id, before: snapshot(current), after: snapshot(updated) });
  }
  if (dropBundled) {
    await audit({ actorId: actor.id, action: "home_quote.image_removed", entityType: "HomeQuote", entityId: id });
    return { ok: true };
  }
  // A new upload replaces the bundled portrait too, so the seeded file is no longer referenced.
  if (image && "uploadId" in image && current.imagePath) await db.homeQuote.update({ where: { id }, data: { imagePath: null } });
  return applyImageChange(actor, "quote", id, image);
}

export async function deleteHomeQuote(actor: Actor, id: string): Promise<Result> {
  assertCan(actor, "content.manage");
  const current = await db.homeQuote.findUnique({ where: { id } });
  if (!current) return refuse("لم يُعثر على الكلمة؛ ربما حُذفت.");
  await db.$transaction(async (tx) => {
    await tx.homeQuote.delete({ where: { id } });
    await audit({ actorId: actor.id, action: "home_quote.deleted", entityType: "HomeQuote", entityId: id, before: snapshot(current) }, tx);
  });
  if (current.imageKey) await getStorage().remove(current.imageKey).catch(() => undefined);
  return { ok: true };
}

/** Swaps a statement with its neighbour before (`up`) or after (`down`) it in the slide order. */
export async function moveHomeQuote(actor: Actor, id: string, direction: "up" | "down"): Promise<Result> {
  assertCan(actor, "content.manage");
  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const all = await tx.homeQuote.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const from = all.findIndex((q) => q.id === id);
    if (from === -1) return refuse("لم يُعثر على الكلمة؛ ربما حُذفت.");
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= all.length) return { ok: true };
    [all[from], all[to]] = [all[to], all[from]];
    for (const [i, q] of all.entries()) await tx.homeQuote.update({ where: { id: q.id }, data: { sortOrder: i + 1 } });
    await audit({ actorId: actor.id, action: "home_quote.reordered", entityType: "HomeQuote", entityId: id, after: { sortOrder: to + 1 } }, tx);
    return { ok: true };
  });
}

export async function setHeroQuoteStyle(actor: Actor, style: HeroQuoteStyle): Promise<Result> {
  assertCan(actor, "content.manage");
  const key = "public.heroQuoteStyle";
  return db.$transaction(async (tx) => {
    const row = await tx.setting.findUnique({ where: { key } });
    if (row?.value === style) return { ok: true };
    await tx.setting.upsert({ where: { key }, create: { key, value: style, updatedById: actor.id }, update: { value: style, updatedById: actor.id } });
    await audit({ actorId: actor.id, action: "setting.updated", entityType: "Setting", entityId: key, before: { key, value: row?.value ?? null }, after: { key, value: style } }, tx);
    return { ok: true };
  });
}
