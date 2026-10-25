// URL state for list pages: search, filters, sort and page all live in `searchParams`, so lists are
// server-rendered, shareable and work without JavaScript. Unknown or malformed values fall back to
// safe defaults instead of failing.

export type SearchParams = Record<string, string | string[] | undefined>;

export type SortDir = "asc" | "desc";

export type ListParams<S extends string> = {
  q: string;
  sort: S;
  dir: SortDir;
  page: number;
};

export function firstParam(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** One of `allowed`, or undefined. */
export function enumParam<T extends string>(params: SearchParams, key: string, allowed: readonly T[]): T | undefined {
  const v = firstParam(params, key);
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function parseListParams<S extends string>(
  params: SearchParams,
  sorts: readonly S[],
  defaults: { sort: S; dir: SortDir },
): ListParams<S> {
  const page = Number.parseInt(firstParam(params, "page") ?? "1", 10);
  return {
    q: (firstParam(params, "q") ?? "").trim().slice(0, 100),
    sort: enumParam(params, "sort", sorts) ?? defaults.sort,
    dir: enumParam(params, "dir", ["asc", "desc"] as const) ?? defaults.dir,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };

/** Clamps the requested page to the available range. */
export function pageWindow(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  return { pageCount, page: current, skip: (current - 1) * pageSize, take: pageSize };
}

/** Builds a list URL from the current params with some keys replaced (undefined or "" removes a key). */
export function listHref(path: string, params: SearchParams, changes: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") sp.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") sp.delete(key);
    else sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
