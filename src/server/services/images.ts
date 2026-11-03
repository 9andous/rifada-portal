import "server-only";
import type { Readable } from "node:stream";
import { fileTypeFromFile } from "file-type";
import { IMAGE_CONTEXT, REGISTRATION_LOGO_CONTEXT, REGISTRATION_UPLOADER, type ImageOwner } from "@/lib/images";
import { can } from "@/server/authz/permissions";
import { assertCan, fieldRefusal, type Result } from "@/server/services/admin/common";
import { audit } from "@/server/services/audit";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { getStorage, isStorageKey, StorageError } from "@/server/storage/storage";
import { consumeUpload, NOT_USABLE, peekUpload } from "@/server/uploads/stage";

// Profile pictures, association logos and home page portraits. All are optional: without one the initials show. The
// file goes through the usual upload pipeline (staged, checked, then committed to `images/`); the
// owner row keeps only the storage key.

/** What the form asks for: a new staged image, removing the current one, or nothing. */
export type ImageChange = { uploadId: string } | { remove: true } | null;

const IMAGE_MIMES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** Reads the image fields the forms post: `image.uploadId` and `image.remove`. */
export function imageChangeFrom(formData: FormData): ImageChange {
  const uploadId = String(formData.get("image.uploadId") ?? "");
  if (uploadId) return { uploadId };
  return formData.get("image.remove") === "on" ? { remove: true } : null;
}

/** Checks a new image before the owner is saved, so a stale upload is reported with the form. */
export async function checkImageChange(actor: Actor, change: ImageChange): Promise<Result> {
  if (!change || "remove" in change) return { ok: true };
  const meta = await peekUpload(actor.id, change.uploadId, IMAGE_CONTEXT);
  return meta ? { ok: true } : fieldRefusal("image", NOT_USABLE);
}

/** Stores or removes the image of a user or association, replacing (and deleting) any earlier one. */
export async function applyImageChange(actor: Actor, owner: Exclude<ImageOwner, "registration">, id: string, change: ImageChange): Promise<Result> {
  if (!change) return { ok: true };
  // An association officer may change their own association's logo from «ملف الجمعية» (D-101).
  const ownLogo = owner === "association" && actor.associationId === id && can(actor.role, "associations.profile");
  if (!ownLogo) assertCan(actor, OWNER_PERMISSION[owner]);
  const current = await currentKey(owner, id);
  if (current === undefined) return fieldRefusal("image", "لم يُعثر على السجل.");

  let next: string | null = null;
  if ("uploadId" in change) {
    const consumed = await consumeUpload(actor.id, change.uploadId, "images", Date.now(), IMAGE_CONTEXT);
    if (!consumed.ok) return fieldRefusal("image", consumed.message);
    next = consumed.file.storageKey;
  } else if (!current) {
    return { ok: true };
  }

  if (owner === "user") await db.user.update({ where: { id }, data: { avatarKey: next } });
  else if (owner === "association") await db.association.update({ where: { id }, data: { logoKey: next } });
  else await db.homeQuote.update({ where: { id }, data: { imageKey: next } });
  const { entityType, changed, removed } = OWNER_AUDIT[owner];
  await audit({ actorId: actor.id, action: next ? changed : removed, entityType, entityId: id });
  if (current) await getStorage().remove(current).catch(() => undefined);
  return { ok: true };
}

const OWNER_PERMISSION = { user: "users.manage", association: "associations.manage", quote: "content.manage" } as const;

const OWNER_AUDIT = {
  user: { entityType: "User", changed: "user.image_changed", removed: "user.image_removed" },
  association: { entityType: "Association", changed: "association.logo_changed", removed: "association.logo_removed" },
  quote: { entityType: "HomeQuote", changed: "home_quote.image_changed", removed: "home_quote.image_removed" },
} as const;

async function currentKey(owner: ImageOwner, id: string): Promise<string | null | undefined> {
  if (owner === "user") return (await db.user.findUnique({ where: { id }, select: { avatarKey: true } }))?.avatarKey;
  if (owner === "association") return (await db.association.findUnique({ where: { id }, select: { logoKey: true } }))?.logoKey;
  if (owner === "registration") return (await db.associationRegistration.findUnique({ where: { id }, select: { logoKey: true } }))?.logoKey;
  return (await db.homeQuote.findUnique({ where: { id }, select: { imageKey: true } }))?.imageKey;
}

/** Whether a logo staged from the public registration form can still be used (D-100). */
export async function registrationLogoUsable(uploadId: string): Promise<boolean> {
  return Boolean(await peekUpload(REGISTRATION_UPLOADER, uploadId, REGISTRATION_LOGO_CONTEXT));
}

/** Moves a logo staged from the registration form into `images/`; its storage key, or null. */
export async function commitRegistrationLogo(uploadId: string): Promise<string | null> {
  const consumed = await consumeUpload(REGISTRATION_UPLOADER, uploadId, "images", Date.now(), REGISTRATION_LOGO_CONTEXT);
  return consumed.ok ? consumed.file.storageKey : null;
}

/** The stored image of a user or association, re-checked as a picture before it is served. */
export async function openImage(owner: ImageOwner, id: string): Promise<{ stream: Readable; mime: string; size: number } | null> {
  const key = await currentKey(owner, id);
  if (!key || !isStorageKey(key) || !key.startsWith("images/")) return null;
  const storage = getStorage();
  try {
    const type = await fileTypeFromFile(storage.localPath(key));
    const mime = type ? IMAGE_MIMES[type.ext] : undefined;
    if (!mime) return null;
    return { stream: storage.openRead(key), mime, size: await storage.size(key) };
  } catch (error) {
    if (error instanceof StorageError || (error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
