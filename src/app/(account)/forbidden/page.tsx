import type { Metadata } from "next";
import Link from "next/link";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "غير مصرح" };

export default function ForbiddenPage() {
  return (
    <>
      <PageBand title="غير مصرح" compact />
      <PageBody>
        <ForbiddenState
          action={
            <Link href="/dashboard" className={buttonClasses("outline")}>
              العودة إلى لوحتي
            </Link>
          }
        />
      </PageBody>
    </>
  );
}
