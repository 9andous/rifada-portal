import { describe, expect, it } from "vitest";
import { selectedFigureIndex } from "@/lib/list-params";

const items = [
  { href: "/admin/users" },
  { href: undefined },
  { href: "/admin/users?status=active" },
  { href: "/admin/users?role=SUPERVISOR&status=active" },
];

describe("selectedFigureIndex", () => {
  it("is the first figure when no filter is set or none matches", () => {
    expect(selectedFigureIndex(items, {})).toBe(0);
    expect(selectedFigureIndex(items, { status: "inactive", q: "x" })).toBe(0);
  });

  it("is the figure of the current filter, ignoring other params", () => {
    expect(selectedFigureIndex(items, { status: "active", page: "2" })).toBe(2);
  });

  it("prefers the most specific match", () => {
    expect(selectedFigureIndex(items, { role: "SUPERVISOR", status: "active" })).toBe(3);
  });
});
