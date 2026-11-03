import { ClipboardCheck, Lock, Send } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { STRATEGY_MOTTO } from "@/config/initiative";
import { AccessibilityMenu } from "./accessibility-menu";
import { GovBar } from "./gov-bar";
import { AppFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { ThemeToggle } from "./theme-toggle";

const ABOUT = `تقديم برامج الجمعيات ومشروعاتها ضمن برامج ${brand.presidencyName}، ومراجعتها ومتابعتها بإجراءات واضحة وموثّقة.`;

const UNIT_LINES = brand.unitName.split(/ (?=بالحرمين)/);

const FEATURES = [
  { icon: Send, title: "تقديم إلكتروني", text: "طلبات البرامج والمشروعات من مكان واحد" },
  { icon: ClipboardCheck, title: "متابعة فورية", text: "حالة كل طلب ومراحل مراجعته" },
  { icon: Lock, title: "دخول آمن", text: "حسابات موثّقة وصلاحيات محددة" },
];

/**
 * Login and password pages (docs/DESIGN.md: Login): the green hero panel over the Haram photograph
 * on the reading side, the form card beside it at the same height, sized to fit a laptop screen
 * without scrolling.
 * `panel` replaces the feature tiles at the foot of the green panel (the login page's registration
 * entry); `after` adds a block under the card. Below lg only the card (and `after`) shows.
 */
export function AuthSplit({
  title,
  description,
  topActions,
  panel,
  after,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Extra controls next to the theme toggle, e.g. sign out on the password-change page. */
  topActions?: ReactNode;
  /** Content at the foot of the green panel, in place of the feature tiles (lg+). */
  panel?: ReactNode;
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GovBar />
      <SiteHeader>
        {topActions}
        <AccessibilityMenu />
        <ThemeToggle />
      </SiteHeader>

      <div className="mx-auto grid w-full max-w-[1360px] flex-1 items-stretch gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1fr_440px] lg:gap-8 short:py-3">
        <aside
          aria-label={brand.unitName}
          className="band-scope relative hidden flex-col overflow-hidden rounded-2xl bg-band p-9 text-band-ink shadow-2 lg:flex short:py-7"
        >
          <Image src="/images/gallery_makkah_1.jpg" alt="" fill priority sizes="(min-width: 1024px) 60vw, 0px" className="object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-band/95 via-band/85 to-band-deep/95" />
          <GeometricPattern size={72} />
          <ArchOutline strokeWidth={5} className="absolute -bottom-16 end-[-40px] w-[340px] text-band-gold/25" />
          <div className="relative flex flex-col items-center text-center">
            <Logo tone="onDark" height={84} priority />
            {/* Two lines, broken before «بالحرمين الشريفين» (owner's request). */}
            <p className="mt-4 text-[1.75rem] font-bold leading-[1.45] short:mt-3">
              {UNIT_LINES.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
            {STRATEGY_MOTTO ? <p className="mt-4 text-lg font-semibold leading-relaxed text-band-gold">{STRATEGY_MOTTO}</p> : null}
          </div>
          {panel ? (
            <div className="relative mt-auto pt-8 short:pt-5">
              <p className="mx-auto mb-8 max-w-2xl text-center text-xl font-medium leading-[1.8] text-band-ink short:mb-6">{ABOUT}</p>
              {panel}
            </div>
          ) : (
            <div className="relative mt-auto pt-8">
              <p className="mx-auto mb-8 max-w-2xl text-center text-xl font-medium leading-[1.8] text-band-ink short:hidden">{ABOUT}</p>
              <ul className="grid grid-cols-3 gap-3">
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
            </div>
          )}
        </aside>

        <div className="flex flex-col gap-4">
          <main id="main" className="relative flex w-full flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2">
            <span aria-hidden="true" className="block h-1.5 shrink-0 bg-linear-to-l from-band via-primary to-accent" />
            <div className="flex flex-1 flex-col justify-center px-8 py-6 short:py-4">
              <p className="flex items-center gap-2 text-sm font-medium text-accent-ink short:hidden">
                <Diamond />
                {brand.systemName}
              </p>
              <h1 className="mt-1.5 text-[1.625rem] font-bold text-gold-action short:mt-0">{title}</h1>
              {description ? <p className="mt-1 text-sm text-ink-muted short:hidden">{description}</p> : null}
              <div className="mt-5">{children}</div>
            </div>
          </main>
          {after}
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
