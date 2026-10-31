import type { Metadata } from "next";
import { VerifyCodeEntry } from "@/components/verification/code-entry";
import { VerifyHelp, VerifyLayout } from "@/components/verification/verify-parts";

export const metadata: Metadata = { title: "التحقق من وثيقة" };

// «التحقق من وثيقة» (D-122): public, so anyone holding a printed or shared document can check it.
export default function VerifyPage() {
  return (
    <VerifyLayout form={<VerifyCodeEntry />}>
      <VerifyHelp />
    </VerifyLayout>
  );
}
