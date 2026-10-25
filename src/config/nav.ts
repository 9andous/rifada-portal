// Top navigation per role (docs/DESIGN.md: Navigation). Items whose screens are built in a later
// phase have no href yet: they render as unavailable (not clickable) and become links when their
// phase ships. Keep each role's list short.

import type { Role } from "@/server/authz/roles";

export type NavItem = { label: string; href?: string };

export const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "الرئيسية", href: "/admin" },
    { label: "المستخدمون", href: "/admin/users" },
    { label: "الجمعيات", href: "/admin/associations" },
    { label: "البرامج والمبادرات", href: "/admin/taxonomy" },
    { label: "الإعدادات", href: "/admin/settings" },
    { label: "سجل التدقيق", href: "/admin/audit" },
  ],
  UNIT_MANAGER: [
    { label: "الرئيسية", href: "/manager" },
    { label: "الطلبات", href: "/manager/requests" },
    { label: "الإسناد", href: "/manager/assignment" },
    { label: "الجمعيات", href: "/manager/associations" },
    { label: "البرامج والمبادرات", href: "/manager/taxonomy" },
    { label: "التقارير" },
  ],
  SUPERVISOR: [
    { label: "الرئيسية", href: "/supervisor" },
    { label: "قائمة أعمالي", href: "/supervisor/queue" },
    { label: "الطلبات", href: "/supervisor/requests" },
    { label: "الجمعيات" },
    { label: "النماذج", href: "/supervisor/templates" },
    { label: "التقارير" },
  ],
  ASSOCIATION_OFFICER: [
    { label: "الرئيسية", href: "/association" },
    { label: "طلباتي", href: "/association/requests" },
    { label: "طلب جديد", href: "/association/requests/new" },
    { label: "المستندات", href: "/association/documents" },
    { label: "ملف الجمعية" },
  ],
};

export const UNAVAILABLE_HINT = "تتوفر هذه الصفحة في مرحلة لاحقة";

/**
 * The href of the active item: the role root only on an exact match, otherwise the longest href
 * that equals or prefixes the path (so «طلب جديد» wins over «طلباتي» on /association/requests/new).
 */
export function activeNavHref(items: NavItem[], root: string, pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const { href } of items) {
    if (!href) continue;
    const match = href === root ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (match && (!best || href.length > best.length)) best = href;
  }
  return best;
}
