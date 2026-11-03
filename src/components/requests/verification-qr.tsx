import QRCode from "qrcode";
import { cn } from "@/lib/cn";
import { verifyUrl } from "@/server/services/verification";

/**
 * The document's QR code (D-122): the link to its public verification page, black on white so it
 * scans from paper and screens alike. Server-rendered SVG from our own URL.
 */
export async function VerificationQr({ code, className }: { code: string; className?: string }) {
  const svg = await QRCode.toString(verifyUrl(code), { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } });
  return <span role="img" aria-label={`رمز التحقق من الوثيقة ${code}`} className={cn("block bg-white [&>svg]:block [&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
