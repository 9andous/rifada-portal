import { TabNav } from "@/components/ui/tab-nav";

/** Sections of «الإعدادات» (D-066): general values and the request lifecycle. */
export function SettingsTabs({ active }: { active: "general" | "statuses" }) {
  return (
    <TabNav
      label="أقسام الإعدادات"
      active={active}
      className="mb-6 overflow-hidden rounded-xl border bg-surface shadow-1"
      items={[
        { key: "general", label: "الإعدادات العامة", href: "/admin/settings" },
        { key: "statuses", label: "حالات الطلبات", href: "/admin/settings/statuses" },
      ]}
    />
  );
}
