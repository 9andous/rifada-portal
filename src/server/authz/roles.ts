// Pure role metadata shared by server code, navigation and tests (no server-only imports).

export const ROLES = ["SUPER_ADMIN", "UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "مدير النظام",
  UNIT_MANAGER: "مدير الوحدة",
  SUPERVISOR: "مشرف",
  ASSOCIATION_OFFICER: "مسؤول الجمعية",
};

/** Each role has its own area; the dashboard of that area is the landing page after login. */
export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  UNIT_MANAGER: "/manager",
  SUPERVISOR: "/supervisor",
  ASSOCIATION_OFFICER: "/association",
};

/** Which roles may open each area. Checked on the server in every area layout. */
export const AREA_ROLES: Record<string, readonly Role[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/manager": ["UNIT_MANAGER"],
  "/supervisor": ["SUPERVISOR"],
  "/association": ["ASSOCIATION_OFFICER"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function areaForPath(pathname: string): string | null {
  return Object.keys(AREA_ROLES).find((area) => pathname === area || pathname.startsWith(`${area}/`)) ?? null;
}
