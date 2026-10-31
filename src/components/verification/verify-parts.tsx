import { ExternalLink, SearchX, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArchOutline, Diamond } from "@/components/brand/arch";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { buttonClasses } from "@/components/ui/button";
import { DateDisplay } from "@/components/ui/date-display";
import { RefNumber } from "@/components/ui/ref-number";
import { cn } from "@/lib/cn";
import type { VerifyResult } from "@/server/services/verification";

// The verification pages (D-122): the band, the result card and the help beside the form.

export function VerifyBand() {
  return (
    <section className="band-scope relative overflow-hidden bg-band text-band-ink">
      <GeometricPattern size={84} />
      <ArchOutline strokeWidth={4} className="absolute -bottom-20 end-10 hidden w-56 text-band-gold/15 md:block" />
      <div className="relative mx-auto max-w-[1360px] px-4 py-10 sm:px-8">
        <p className="flex items-center gap-2 text-sm font-medium text-band-gold">
          <Diamond className="bg-band-gold" />
          الوثائق الموقّعة إلكترونيًا
        </p>
        <h1 className="mt-2 text-[2rem] font-bold">التحقق من وثيقة</h1>
        <p className="mt-2 max-w-2xl text-band-ink-muted">
          تحمل كل وثيقة طلب معتمد ختمين إلكترونيين، للمشرف المختص ومدير الوحدة الإشرافية، ورمز تحقق فريدًا. امسحوا رمز QR أو أدخلوا الرمز المطبوع
          تحته للتأكد من أن الوثيقة صادرة من المنصة ولم تتغيّر.
        </p>
      </div>
    </section>
  );
}

export function VerifyLayout({ form, children }: { form: ReactNode; children: ReactNode }) {
  return (
    <>
      <VerifyBand />
      <div className="mx-auto grid w-full max-w-[1100px] items-start gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-2 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-accent" />
            <h2 className="text-lg font-bold text-brand-ink">رمز التحقق</h2>
          </div>
          {form}
        </div>
        <section aria-live="polite" aria-label="نتيجة التحقق" className="rounded-2xl border border-line bg-surface p-6 shadow-1 sm:p-8">
          {children}
        </section>
      </div>
    </>
  );
}

/** Before any code: how to verify. */
export function VerifyHelp() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
        <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-bold text-ink">تظهر هنا نتيجة التحقق</p>
      <ol className="mt-3 max-w-sm list-inside list-decimal text-start text-sm leading-[1.9] text-ink-muted">
        <li>افتحوا كاميرا الجوال ووجّهوها إلى رمز QR في أسفل الوثيقة، فتُفتح هذه الصفحة بالنتيجة.</li>
        <li>أو أدخلوا الرمز المطبوع تحت رمز QR في الخانة.</li>
        <li>تأكدوا أن البيانات الظاهرة هنا تطابق الوثيقة التي بين أيديكم.</li>
      </ol>
    </div>
  );
}

const INVALID: Record<"tampered" | "changed" | "superseded", { title: string; text: string }> = {
  changed: {
    title: "الوثيقة لم تعد مطابقة",
    text: "تغيّرت بيانات الطلب أو مرفقاته بعد اعتماده، فلا يُعتمد على هذه النسخة. اطلبوا من الجمعية نسخة محدّثة.",
  },
  superseded: {
    title: "الوثيقة لم تعد سارية",
    text: "لم يعد الطلب معتمدًا بهذا الاعتماد: أُعيد للتعديل أو صدر بشأنه قرار أحدث. لا يُعتمد على هذه النسخة.",
  },
  tampered: {
    title: "تعذّر التحقق من الختم الإلكتروني",
    text: "لا يطابق ختم الوثيقة سجلات المنصة. لا يُعتمد على هذه الوثيقة، وتواصلوا مع الوحدة الإشرافية.",
  },
};

function Verdict({ tone, icon, title, children }: { tone: "ok" | "bad" | "neutral"; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-4 rounded-xl border border-s-4 p-5",
        tone === "ok" && "border-st-ok/30 border-s-st-ok bg-st-ok-soft",
        tone === "bad" && "border-st-bad/30 border-s-st-bad bg-st-bad-soft",
        tone === "neutral" && "border-line border-s-line-strong bg-surface-muted",
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-7", tone === "ok" ? "text-st-ok" : tone === "bad" ? "text-st-bad" : "text-ink-muted")}>{icon}</span>
      <div>
        <p className={cn("text-lg font-bold", tone === "ok" ? "text-st-ok" : tone === "bad" ? "text-st-bad" : "text-ink")}>{title}</p>
        <div className="mt-1 text-sm leading-[1.9] text-ink">{children}</div>
      </div>
    </div>
  );
}

export function VerifyOutcome({ result }: { result: VerifyResult | "limited" }) {
  if (result === "limited") {
    return (
      <Verdict tone="neutral" icon={<ShieldAlert strokeWidth={1.75} />} title="محاولات كثيرة">
        تجاوزتم عدد محاولات التحقق المسموح بها مؤقتًا. أعيدوا المحاولة بعد دقائق.
      </Verdict>
    );
  }
  if (result.state === "not_found") {
    return (
      <Verdict tone="bad" icon={<SearchX strokeWidth={1.75} />} title="لم يُعثر على وثيقة بهذا الرمز">
        تأكدوا من إدخال الرمز كما طُبع تحت رمز QR. إن كان الرمز صحيحًا فالوثيقة ليست صادرة من المنصة.
      </Verdict>
    );
  }
  if (result.state === "invalid") {
    const m = INVALID[result.reason];
    return (
      <div className="flex flex-col gap-4">
        <Verdict tone="bad" icon={<ShieldAlert strokeWidth={1.75} />} title={m.title}>
          {m.text}
        </Verdict>
        {result.referenceNo ? (
          <p className="text-sm text-ink-muted">
            رقم الطلب <RefNumber value={result.referenceNo} />
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Verdict tone="ok" icon={<ShieldCheck strokeWidth={1.75} />} title="وثيقة صحيحة وسارية">
        صدرت هذه الوثيقة من المنصة واعتُمدت إلكترونيًا، ولم يتغيّر الطلب منذ اعتماده.
      </Verdict>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Item label="رقم الطلب">{result.referenceNo ? <RefNumber value={result.referenceNo} /> : "—"}</Item>
        <Item label="تاريخ الاعتماد">
          <DateDisplay date={result.approvedAt} />
        </Item>
        <Item label="الجمعية" wide>
          {result.association}
        </Item>
        <Item label="المشروع" wide>
          {result.title}
        </Item>
        {result.track ? (
          <Item label="المسار" wide>
            {result.track}
          </Item>
        ) : null}
        {result.program ? (
          <Item label="البرنامج" wide>
            {result.program}
          </Item>
        ) : null}
      </dl>

      <div>
        <p className="mb-2 text-sm font-bold text-brand-ink">التوقيعات الإلكترونية</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.signers.map((s) => (
            <li key={s.serial} className="rounded-lg border border-line p-3.5">
              <p className="t-caption">{s.role}</p>
              <p className="mt-0.5 font-semibold text-ink">{s.name}</p>
              <DateDisplay date={s.signedAt} withTime className="t-caption block" />
              <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-ink-muted">
                رقم الختم <bdi dir="ltr" className="font-mono text-ink">{s.serial}</bdi>
              </p>
            </li>
          ))}
        </ul>
      </div>

      {result.staff ? (
        <div className="rounded-lg border border-line bg-surface-muted p-4 text-sm">
          <p className="font-bold text-ink">للموظفين</p>
          <dl className="mt-2 grid gap-1.5 text-xs text-ink-muted">
            <div>
              <dt className="inline">مفتاح الختم: </dt>
              <dd className="inline">
                <bdi dir="ltr" className="font-mono">{result.staff.keyId}</bdi>
              </dd>
            </div>
            <div>
              <dt className="inline">بصمة الختم: </dt>
              <dd className="inline break-all">
                <bdi dir="ltr" className="font-mono">{result.staff.digest}</bdi>
              </dd>
            </div>
          </dl>
          <Link href={result.staff.href} className={buttonClasses("outline", "sm", "mt-3")}>
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
            فتح الطلب
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
