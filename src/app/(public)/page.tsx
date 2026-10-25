import Link from "next/link";
import { LogIn } from "lucide-react";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { buttonClasses } from "@/components/ui/button";
import { brand } from "@/config/brand";

// Foundation version of the public home page. The full page (vision, mission, values,
// objectives, programs, announcements, guides) is built in Phase 5.
export default function HomePage() {
  return (
    <section className="band-fade relative overflow-hidden bg-band text-on-band">
      <GeometricPattern size={120} />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-24 md:py-32">
        <p className="text-sm text-gold-on-band">{brand.presidencyName}</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">{brand.unitName}</h1>
        <span aria-hidden="true" className="block h-[2px] w-16 bg-gold-on-band" />
        <p className="max-w-2xl text-lg text-on-band-muted">
          منصة موحّدة لتقديم برامج الجمعيات ومشروعاتها ضمن برامج الرئاسة، ومراجعتها ومتابعتها بإجراءات واضحة وموثّقة.
        </p>
        <div>
          <Link href="/login" className={buttonClasses("onBand", "lg")}>
            <LogIn aria-hidden="true" />
            الدخول إلى المنصة
          </Link>
        </div>
      </div>
    </section>
  );
}
