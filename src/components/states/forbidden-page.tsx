import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenState } from "./states";

/** Whole-page permission-denied state, for pages whose own `can()` check fails. */
export function ForbiddenPage() {
  return (
    <>
      <PageBand title="غير مصرح" compact />
      <PageBody>
        <ForbiddenState />
      </PageBody>
    </>
  );
}
