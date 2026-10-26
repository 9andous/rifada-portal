import { StatusText } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { INITIATIVE_STATE_LABEL, PROGRAM_STATE_LABEL, STATE_TONE, type EntityState } from "@/lib/taxonomy-labels";

export type TaxonomySection = "programs" | "objectives" | "attachment-types" | "templates" | "lifecycle" | "review";

/** Sections of «البرامج والمبادرات» (no extra top-navigation items; D-055, D-066). */
export function TaxonomyNav({ active, base }: { active: TaxonomySection; base: "/admin/taxonomy" | "/manager/taxonomy" }) {
  const admin = base === "/admin/taxonomy";
  const items = [
    { key: "programs", label: "البرامج والمبادرات", href: base },
    { key: "objectives", label: "الأهداف الإستراتيجية", href: `${base}/objectives` },
    ...(admin ? [{ key: "attachment-types", label: "أنواع المرفقات", href: `${base}/attachment-types` }] : []),
    { key: "templates", label: "النماذج", href: `${base}/templates` },
    ...(admin
      ? [{ key: "review", label: "مراجعة الاستخراج", href: `${base}/review` }]
      : [{ key: "lifecycle", label: "دورة حياة الطلب", href: `${base}/lifecycle` }]),
  ];
  return <TabNav items={items} active={active} label="أقسام البرامج والمبادرات" className="mb-6 overflow-hidden rounded-xl border bg-surface shadow-1" />;
}

/** Dot plus text for «نشط/موقوف/مؤرشف»; programs masculine, initiatives feminine. */
export function StateMark({ state, kind }: { state: EntityState; kind: "program" | "initiative" }) {
  const label = kind === "program" ? PROGRAM_STATE_LABEL[state] : INITIATIVE_STATE_LABEL[state];
  return <StatusText tone={STATE_TONE[state]}>{label}</StatusText>;
}
