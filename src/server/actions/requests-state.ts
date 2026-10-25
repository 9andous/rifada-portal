// State returned by the request server actions (kept apart from the "use server" file).

import type { MissingItem } from "@/lib/completeness";
import type { AdminFormState } from "./admin/state";

export type BulkOutcomeView = {
  done: { id: string; referenceNo: string | null; title: string }[];
  skipped: { id: string; referenceNo: string | null; title: string | null; reason: string }[];
};

export type RequestFormState = AdminFormState & {
  /** The completeness check's list when a submission was blocked. */
  missing?: MissingItem[];
  referenceNo?: string;
  outcome?: BulkOutcomeView;
};
