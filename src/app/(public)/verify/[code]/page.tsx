import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { VerifyCodeEntry } from "@/components/verification/code-entry";
import { VerifyOutcome, VerifyLayout } from "@/components/verification/verify-parts";
import { Skeleton } from "@/components/ui/surface";
import { getCurrentUser } from "@/server/auth/session";
import { rateLimit } from "@/server/services/rate-limit";
import { verifyDocument } from "@/server/services/verification";

export const metadata: Metadata = { title: "نتيجة التحقق من وثيقة", robots: { index: false } };

// The page a document's QR code opens (D-122). Public; signed-in staff see more. Every check is
// audited and limited per address, so codes cannot be guessed by trying many.
export default function VerifyCodePage({ params }: PageProps<"/verify/[code]">) {
  return (
    <Suspense fallback={<VerifyLayout form={<VerifyCodeEntry />}><Skeleton className="h-64 rounded-xl" /></VerifyLayout>}>
      <Result params={params} />
    </Suspense>
  );
}

async function Result({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let raw = code.slice(0, 80);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Not a valid escape sequence: checked as typed, and found to be no code.
  }
  const h = await headers();
  const client = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const result = rateLimit(`verify:${client}`, 30, 10 * 60_000) ? await verifyDocument(raw, await getCurrentUser()) : "limited";
  return (
    <VerifyLayout form={<VerifyCodeEntry initialCode={result !== "limited" && result.state === "valid" ? result.code : raw} />}>
      <VerifyOutcome result={result} />
    </VerifyLayout>
  );
}
