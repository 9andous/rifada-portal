import { ClipboardCheck, Lock, Send, ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { STRATEGY_MOTTO } from "@/config/initiative";
import { GovBar } from "./gov-bar";
import { AppFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";

const FEATURES = [
  { icon: Send, title: "تقديم إلكتروني", text: "طلبات البرامج والمشروعات من مكان واحد" },
  { icon: ClipboardCheck, title: "متابعة فورية", text: "حالة كل طلب ومراحل مراجعته" },
  { icon: Lock, title: "دخول آمن", text: "حسابات موثّقة وصلاحيات محددة" },
];

/**
 * Login and password pages (docs/DESIGN.md: Login): the green hero panel over the Haram photograph
 * on the reading side, the form card beside it. `after` adds a block under the card (the login
 * page's registration entry). Below lg only the card shows.
 */
export function AuthSplit({
  title,
  description,
  topActions,
  after,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Extra controls next to the theme toggle, e.g. sign out on the password-change page. */
  topActions?: ReactNode;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GovBar />
      <SiteHeader>
        {topActions}
        <ThemeToggle />
      </SiteHeader>

      <div className="mx-auto grid w-full max-w-[1360px] flex-1 items-stretch gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_470px]">
        <aside
          aria-label={brand.unitName}
          className="band-scope relative hidden min-h-[600px] flex-col overflow-hidden rounded-2xl bg-band p-11 text-band-ink shadow-2 lg:flex"
        >
          <Image src="/images/haramain/masjid-al-haram.jpg" alt="" fill priority sizes="(min-width: 1024px) 60vw, 0px" className="object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-band/95 via-band/85 to-band-deep/95" />
          <GeometricPattern size={72} />
          <ArchOutline strokeWidth={5} className="absolute -bottom-16 end-[-40px] w-[340px] text-band-gold/25" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-[6px] border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-band-ink-muted backdrop-blur-sm">
              <ShieldCheck aria-hidden="true" className="size-4 text-band-gold" />
              منصة حكومية موثّقة
            </span>
            <div className="mt-8 flex items-center gap-5">
              <Logo tone="onDark" height={110} priority />
              <span aria-hidden="true" className="h-20 w-px bg-white/20" />
              <p className="text-lg font-semibold leading-relaxed text-band-gold">{STRATEGY_MOTTO}</p>
            </div>
            <p className="mt-7 max-w-xl text-[2rem] font-bold leading-[1.45]">{brand.unitName}</p>
            <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-band-ink-muted">
              {brand.systemName}: تقديم برامج الجمعيات ومشروعاتها ضمن برامج {brand.presidencyName}، ومراجعتها ومتابعتها بإجراءات واضحة وموثّقة.
            </p>
          </div>
          <ul className="relative mt-auto grid grid-cols-3 gap-3 pt-10">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="rounded-xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                <span className="mb-3 flex size-10 items-center justify-center rounded-md bg-band-gold/15 text-band-gold">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="block text-sm font-bold">{t}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-band-ink-muted">{text}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col justify-center gap-4">
          <main id="main" className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2">
            <span aria-hidden="true" className="block h-1.5 bg-linear-to-l from-band via-primary to-accent" />
            <div className="p-8">
              <p className="flex items-center gap-2 text-sm font-medium text-accent-ink">
                <Diamond />
                {brand.systemName}
              </p>
              <h1 className="mt-2 text-[1.625rem] font-bold text-brand-ink">{title}</h1>
              {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
          </main>
          {after}
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
