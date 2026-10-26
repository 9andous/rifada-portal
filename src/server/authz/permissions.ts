// The permission matrix as data. It drives `can()`, generates docs/PERMISSIONS.md
// (scripts/generate-permissions-doc.ts) and the table-driven permission tests.
// "own" scopes are enforced by the query scopers in ./scope.ts, never by the UI.

import type { Role } from "./roles";

/** all = every record; programs = records in the supervisor's programs; own = the officer's association. */
export type Scope = "all" | "programs" | "own";

export type Permission = {
  description: string;
  grants: Partial<Record<Role, Scope>>;
};

export const PERMISSIONS = {
  "admin.access": {
    description: "فتح منطقة إدارة النظام",
    grants: { SUPER_ADMIN: "all" },
  },
  "users.manage": {
    description: "إنشاء المستخدمين وتعديلهم وتعطيلهم",
    grants: { SUPER_ADMIN: "all" },
  },
  "associations.manage": {
    description: "إنشاء الجمعيات وحساباتها وتعديلها واستيرادها",
    grants: { SUPER_ADMIN: "all" },
  },
  "registrations.review": {
    description: "مراجعة طلبات تسجيل الجمعيات واعتمادها أو رفضها",
    grants: { SUPER_ADMIN: "all" },
  },
  "associations.read": {
    description: "عرض بيانات الجمعيات",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "programs", ASSOCIATION_OFFICER: "own" },
  },
  "taxonomy.manage": {
    description: "تعديل البرامج والمبادرات والأهداف ومتطلبات المبادرات وأنواع المرفقات",
    grants: { SUPER_ADMIN: "all" },
  },
  "taxonomy.read": {
    description: "عرض البرامج والمبادرات والأهداف",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "all", ASSOCIATION_OFFICER: "all" },
  },
  "settings.manage": {
    description: "تعديل إعدادات النظام وحالات الطلبات ووضع العرض التجريبي",
    grants: { SUPER_ADMIN: "all" },
  },
  "statuses.read": {
    description: "عرض حالات الطلبات وانتقالاتها ودورة حياة الطلب",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all" },
  },
  "templates.read": {
    description: "عرض النماذج المنشورة وتنزيلها",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "all", ASSOCIATION_OFFICER: "all" },
  },
  "audit.read": {
    description: "عرض سجل التدقيق",
    grants: { SUPER_ADMIN: "all" },
  },
  "content.manage": {
    description: "إدارة الإعلانات والأدلة والنماذج",
    grants: { SUPER_ADMIN: "all" },
  },
  "requests.read": {
    description: "عرض الطلبات وتفاصيلها",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "programs", ASSOCIATION_OFFICER: "own" },
  },
  "requests.create": {
    description: "إنشاء طلب جديد وحفظه كمسودة",
    grants: { ASSOCIATION_OFFICER: "own" },
  },
  "requests.editDraft": {
    description: "تعديل المسودة أو الطلب المعاد للتعديل وتقديمه",
    grants: { ASSOCIATION_OFFICER: "own" },
  },
  "requests.review": {
    description: "إعادة الطلب للتعديل أو اعتماده أو رفضه",
    grants: { UNIT_MANAGER: "all", SUPERVISOR: "programs" },
  },
  "requests.auditTrail": {
    description: "عرض سجل الاطلاع والتدقيق في صفحة الطلب",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all" },
  },
  "requests.assign": {
    description: "إسناد الطلب إلى مشرف أو إعادة إسناده",
    grants: { UNIT_MANAGER: "all" },
  },
  "comments.write": {
    description: "إضافة تعليق على الطلب",
    grants: { UNIT_MANAGER: "all", SUPERVISOR: "programs", ASSOCIATION_OFFICER: "own" },
  },
  "comments.readInternal": {
    description: "قراءة الملاحظات الداخلية للفريق الإشرافي",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "programs" },
  },
  "comments.writeInternal": {
    description: "إضافة ملاحظة داخلية لا تظهر للجمعية",
    grants: { UNIT_MANAGER: "all", SUPERVISOR: "programs" },
  },
  "attachments.read": {
    description: "تنزيل مرفقات الطلب",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "programs", ASSOCIATION_OFFICER: "own" },
  },
  "attachments.upload": {
    description: "رفع مرفق أو إصدار جديد منه",
    grants: { ASSOCIATION_OFFICER: "own", SUPERVISOR: "programs", UNIT_MANAGER: "all" },
  },
  "reports.read": {
    description: "عرض التقارير وتصديرها",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all", SUPERVISOR: "programs", ASSOCIATION_OFFICER: "own" },
  },
  "dashboard.management": {
    description: "لوحات المؤشرات الإدارية الشاملة",
    grants: { SUPER_ADMIN: "all", UNIT_MANAGER: "all" },
  },
} satisfies Record<string, Permission>;

export type Action = keyof typeof PERMISSIONS;

/** The scope a role holds for an action, or null when the action is denied. */
export function scopeFor(role: Role, action: Action): Scope | null {
  const grants: Partial<Record<Role, Scope>> = PERMISSIONS[action].grants;
  return grants[role] ?? null;
}

export function can(role: Role, action: Action): boolean {
  return scopeFor(role, action) !== null;
}
