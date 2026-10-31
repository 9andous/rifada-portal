"use client";

import { Camera, CameraOff, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";
import { normalizeVerifyCode } from "@/lib/verify-code";

// The browser's own QR reader (Chrome on Android, Edge); jsQR reads the frames elsewhere (iPhone).
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

const NOT_OURS = "هذا الرمز ليس رمز تحقق صادرًا من المنصة.";
const SCAN_EVERY_MS = 250;

/**
 * «التحقق من وثيقة» (D-122): type the code printed under the QR code, or scan the QR code with the
 * phone's camera. Either way the result opens on /verify/<code>.
 */
export function VerifyCodeEntry({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  function open(raw: string): boolean {
    const normalized = normalizeVerifyCode(raw);
    if (!normalized) return false;
    router.push(`/verify/${normalized}`);
    return true;
  }

  function stop() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stop, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("لا يتيح هذا المتصفح استخدام الكاميرا. امسحوا الرمز بكاميرا الجوال مباشرة، أو أدخلوا الرمز المطبوع تحته.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch {
      setError("تعذّر فتح الكاميرا. اسمحوا للمتصفح باستخدامها ثم أعيدوا المحاولة، أو أدخلوا الرمز يدويًا.");
      return;
    }
    streamRef.current = stream;
    setScanning(true);
    const video = videoRef.current;
    if (!video) return stop();
    video.srcObject = stream;
    await video.play().catch(() => undefined);

    const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
    const jsQR = detector ? null : (await import("jsqr")).default;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (!streamRef.current) return;
      let text: string | null = null;
      if (video.readyState >= video.HAVE_ENOUGH_DATA) {
        if (detector) {
          text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
        } else if (jsQR && context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          text = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
      }
      if (text) {
        stop();
        if (!open(text)) setError(NOT_OURS);
        return;
      }
      timerRef.current = window.setTimeout(() => void tick(), SCAN_EVERY_MS);
    };
    void tick();
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!open(code)) setError("أدخلوا الرمز كما طُبع تحت رمز QR، مثل 7KQ2-M9XD-4TPA.");
        }}
        className="flex flex-col gap-4"
      >
        <Field id="verify-code" label="رمز التحقق" hint="اثنا عشر حرفًا ورقمًا مطبوعة تحت رمز QR في الوثيقة.">
          <Input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            className="h-12 text-center font-mono text-lg tracking-widest uppercase"
          />
        </Field>
        <Button type="submit" variant="primary" size="lg">
          <Search aria-hidden="true" strokeWidth={1.75} />
          تحقّق من الوثيقة
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-ink-subtle">
        <span className="h-px flex-1 bg-line" />
        أو
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* One video element, always mounted, so the stream attaches as soon as scanning starts. */}
      <div className={scanning ? "flex flex-col gap-3" : "hidden"}>
        <div className="relative overflow-hidden rounded-xl border border-line bg-black">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />
        </div>
        <p className="t-caption text-center">وجّهوا الكاميرا إلى رمز QR في الوثيقة.</p>
        <Button variant="ghost" onClick={stop}>
          <CameraOff aria-hidden="true" strokeWidth={1.75} />
          إيقاف الكاميرا
        </Button>
      </div>
      {scanning ? null : (
        <Button variant="outline" size="lg" onClick={() => void start()}>
          <Camera aria-hidden="true" strokeWidth={1.75} />
          مسح رمز QR بالكاميرا
        </Button>
      )}

      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : null}
    </div>
  );
}
