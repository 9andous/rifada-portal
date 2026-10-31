// Primary navigation per role (docs/DESIGN.md: App shell). Items whose screens are built in a later
// phase have no href yet: they render as unavailable (not clickable) and become links when their
// phase ships. Keep each role's list short. Icons are Lucide names, resolved in the client nav.

import type { Role } from "@/server/authz/roles";

export type NavIcon =
  | "home"
  | "users"
  | "addUser"
  | "registrations"
  | "building"
  | "layers"
  | "settings"
  | "audit"
  | "inbox"
  | "assign"
  | "chart"
  | "queue"
  | "templates"
  | "requests"
  | "newRequest"
  | "folder"
  | "help";

export type NavItem = { label: string; href?: string; icon: NavIcon };

export const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "الرئيسية", href: "/admin", icon: "home" },
    { label: "المستخدمون", href: "/admin/users", icon: "users" },
    { label: "الجمعيات", href: "/admin/associations", icon: "building" },
    { label: "طلبات التسجيل", href: "/admin/registrations", icon: "registrations" },
    { label: "البرامج والمبادرات", href: "/admin/taxonomy", icon: "layers" },
    { label: "الإعدادات", href: "/admin/settings", icon: "settings" },
    { label: "سجل التدقيق", href: "/admin/audit", icon: "audit" },
  ],
  UNIT_MANAGER: [
    { label: "الرئيسية", href: "/manager", icon: "home" },
    { label: "الطلبات", href: "/manager/requests", icon: "inbox" },
    { label: "الإسناد", href: "/manager/assignment", icon: "assign" },
    { label: "الجمعيات", href: "/manager/associations", icon: "building" },
    { label: "البرامج والمبادرات", href: "/manager/taxonomy", icon: "layers" },
    { label: "التقارير", icon: "chart" },
  ],
  SUPERVISOR: [
    { label: "الرئيسية", href: "/supervisor", icon: "home" },
    { label: "قائمة أعمالي", href: "/supervisor/queue", icon: "queue" },
    { label: "الطلبات", href: "/supervisor/requests", icon: "inbox" },
    { label: "الجمعيات", icon: "building" },
    { label: "الأدلة والنماذج", href: "/supervisor/templates", icon: "templates" },
    { label: "التقارير", icon: "chart" },
  ],
  // Short and plain for the associations' officers (D-102); «تقديم طلب جديد» is the gold button.
  ASSOCIATION_OFFICER: [
    { label: "الرئيسية", href: "/association", icon: "home" },
    { label: "طلباتي", href: "/association/requests", icon: "requests" },
    { label: "الأدلة والنماذج", href: "/association/documents", icon: "folder" },
    { label: "ملف الجمعية", href: "/association/profile", icon: "building" },
  ],
};

/** The role's help page, reached from the user menu in the header (owner's request, 2026-10-28). */
export const HELP_HREF: Partial<Record<Role, string>> = {
  ASSOCIATION_OFFICER: "/association/help",
};

/** «التحقق من وثيقة» (D-122), in the user menu of the staff: the public page, outside the role areas. */
export const VERIFY_HREF: Partial<Record<Role, string>> = {
  SUPER_ADMIN: "/verify",
  UNIT_MANAGER: "/verify",
  SUPERVISOR: "/verify",
};

/** The gold call-to-action at the end of the navigation bar, per role. */
export const NAV_CTA: Partial<Record<Role, NavItem>> = {
  SUPER_ADMIN: { label: "إضافة مستخدم", href: "/admin/users/new", icon: "addUser" },
  UNIT_MANAGER: { label: "إسناد الطلبات", href: "/manager/assignment", icon: "assign" },
  SUPERVISOR: { label: "قائمة أعمالي", href: "/supervisor/queue", icon: "queue" },
  ASSOCIATION_OFFICER: { label: "تقديم طلب جديد", href: "/association/requests/new", icon: "newRequest" },
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
