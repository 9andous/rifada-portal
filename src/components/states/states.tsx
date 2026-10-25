import type { ReactNode } from "react";
import { FileSearch, ShieldOff, TriangleAlert } from "lucide-react";
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

function StateFrame({ title, description, action, icon, className, tone, variant = "card" }: StateProps & { tone: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "card" ? "rounded-sm border border-line bg-surface py-14 shadow-1" : "py-10",
        className,
      )}
    >
      <div className={cn("mb-4 flex size-11 items-center justify-center rounded-sm [&_svg]:size-5", tone)}>{icon}</div>
      <h2 className="t-section">{title}</h2>
      {description ? <p className="t-body mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateFrame icon={<FileSearch strokeWidth={1.75} />} tone="bg-surface-sunken text-ink-muted" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateFrame icon={<TriangleAlert strokeWidth={1.75} />} tone="bg-st-bad-soft text-st-bad" {...props} />;
}

export function ForbiddenState({
  title = "لا تملك صلاحية الوصول إلى هذه الصفحة",
  description = "هذه الصفحة غير متاحة لحسابك. إن كنت ترى أن ذلك خطأ فتواصل مع مدير النظام.",
  ...rest
}: Partial<StateProps>) {
  return (
    <StateFrame
      icon={<ShieldOff strokeWidth={1.75} />}
      tone="bg-accent-soft text-accent-ink"
      title={title}
      description={description}
      {...rest}
    />
  );
}
