import "server-only";
import { connection } from "next/server";
import { db } from "@/server/db";
import { quoteImage } from "@/server/services/admin/home-quotes";
import { HERO_QUOTE_STYLES, SETTING_DEFAULTS, type HeroQuoteStyle } from "@/server/settings/defaults";
import { getSetting } from "@/server/settings/read";
import { availableInitiativeWhere, availableProgramWhere } from "@/server/services/taxonomy";

// Public home page content (no session). Everything comes from the database so the unit's edits
// to the strategy texts and programmes show without a release; nothing here is invented.

export type PublicHome = {
  vision: string | null;
  mission: string | null;
  values: { number: number; title: string; description: string }[];
  objectives: { number: number; title: string }[];
  programs: { number: number; name: string; initiativeCount: number }[];
};

export async function getPublicHome(): Promise<PublicHome> {
  await connection();
  const [content, values, objectives, programs] = await Promise.all([
    db.siteContent.findMany({ where: { key: { in: ["vision", "mission"] } } }),
    db.coreValue.findMany({ orderBy: { number: "asc" } }),
    db.strategicObjective.findMany({ where: { archivedAt: null }, orderBy: { number: "asc" }, select: { number: true, title: true } }),
    db.program.findMany({
      where: availableProgramWhere,
      orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
      select: { number: true, name: true, _count: { select: { initiatives: { where: availableInitiativeWhere } } } },
    }),
  ]);
  const text = (key: string) => content.find((c) => c.key === key)?.value ?? null;
  return {
    vision: text("vision"),
    mission: text("mission"),
    values: values.map(({ number, title, description }) => ({ number, title, description })),
    objectives,
    programs: programs.map((p) => ({ number: p.number, name: p.name, initiativeCount: p._count.initiatives })),
  };
}

export type HeroQuote = { id: string; quote: string; honorific: string; name: string; title: string; image: string | null };

/** The active leadership statements in slide order, and the look the super admin chose (D-096). */
export async function getHeroQuotes(): Promise<{ style: HeroQuoteStyle; slides: HeroQuote[] }> {
  await connection();
  const [rows, style] = await Promise.all([
    db.homeQuote.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, quote: true, honorific: true, name: true, title: true, imageKey: true, imagePath: true },
    }),
    getSetting("public.heroQuoteStyle"),
  ]);
  return {
    style: (HERO_QUOTE_STYLES as readonly string[]).includes(style) ? style : SETTING_DEFAULTS["public.heroQuoteStyle"],
    slides: rows.map(({ imageKey, imagePath, ...q }) => ({ ...q, image: quoteImage({ id: q.id, imageKey, imagePath }) })),
  };
}
