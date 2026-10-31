import { describe, expect, it } from "vitest";
import { STATUS_HELP, statusHelp, TURN_LABEL } from "@/lib/association-status";
import { SYSTEM_STATUS_KEYS } from "@/lib/workflow";

// The plain-language help for each status on the association pages (D-102).

describe("association status help", () => {
  it("explains every system status and names its next step", () => {
    for (const key of SYSTEM_STATUS_KEYS) {
      const h = STATUS_HELP[key];
      expect(h, key).toBeDefined();
      expect(h.meaning.trim().length, key).toBeGreaterThan(5);
      expect(h.next.trim().length, key).toBeGreaterThan(5);
    }
  });

  it("asks the association to act exactly on drafts and returned requests, and says what to do", () => {
    const theirs = SYSTEM_STATUS_KEYS.filter((k) => STATUS_HELP[k].turn === "association");
    expect(theirs).toEqual(["DRAFT", "RETURNED"]);
    for (const k of theirs) expect(STATUS_HELP[k].action, k).toBeTruthy();
  });

  it("leaves decided requests with nobody to act", () => {
    expect(STATUS_HELP.APPROVED.turn).toBe("none");
    expect(STATUS_HELP.REJECTED.turn).toBe("none");
    expect(TURN_LABEL.none).toBe("");
  });

  it("falls back to an empty, neutral entry for an unknown key", () => {
    expect(statusHelp("SOMETHING_ELSE")).toMatchObject({ meaning: "", turn: "none" });
  });
});
