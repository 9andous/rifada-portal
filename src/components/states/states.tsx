import type { ReactNode } from "react";
import { FileSearch, ShieldOff, TriangleAlert } from "lucide-react";
import { ARCH_INNER_PATH, ARCH_PATH } from "@/components/brand/arch";
import { cn } from "@/lib/cn";

type StateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** "card" stands alone on the page; "inline" sits inside an existing card. */
  variant?: "card" | "inline";
};

/** The arch illustration of the design handoff: green outer arch, gold inner arch, icon inside. */
function ArchIllustration({ icon, tone }: { icon: ReactNode; tone: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mb-3 grid h-[86px] w-[72px] place-items-center", tone)}>
      <svg viewBox="0 0 200 250" fill="none" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d={ARCH_PATH} stroke="currentColor" strokeWidth="6" opacity="0.85" />
        <path d={ARCH_INNER_PATH} stroke="var(--accent)" strokeWidth="4" />
      </svg>
      <span className="relative mt-6 [&_svg]:size-6">{icon}</span>
    </div>
  );
}

function StateFrame({ title, description, action, icon, className, tone, variant = "card" }: StateProps & { tone: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "card" ? "rounded-xl border border-line bg-surface py-14 shadow-1" : "py-10",
        className,
      )}
    >
      <ArchIllustration icon={icon} tone={tone} />
      <h2 className="text-[1.0625rem] font-bold text-ink">{title}</h2>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-[1.85] text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateFrame icon={<FileSearch strokeWidth={1.75} />} tone="text-primary" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateFrame icon={<TriangleAlert strokeWidth={1.75} />} tone="text-st-bad" {...props} />;
}

export function ForbiddenState({
  title = "لا تملك صلاحية الوصول إلى هذه الصفحة",
  description = "هذه الصفحة غير متاحة لحسابك. إن كنت ترى أن ذلك خطأ فتواصل مع مدير النظام.",
  ...rest
}: Partial<StateProps>) {
  return <StateFrame icon={<ShieldOff strokeWidth={1.75} />} tone="text-accent-ink" title={title} description={description} {...rest} />;
}
