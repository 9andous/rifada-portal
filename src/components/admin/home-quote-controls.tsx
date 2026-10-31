"use client";

import { ArrowDown, ArrowUp, PenLine, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { HOME_QUOTE_LIMITS } from "@/lib/validation/home-quotes";
import {
  createHomeQuoteAction,
  deleteHomeQuoteAction,
  moveHomeQuoteAction,
  setHeroQuoteStyleAction,
  updateHomeQuoteAction,
} from "@/server/actions/admin/home-quotes";
import type { AdminFormState } from "@/server/actions/admin/state";
import type { HomeQuoteRow } from "@/server/services/admin/home-quotes";
import type { HeroQuoteStyle } from "@/server/settings/defaults";
import { ImageField } from "./image-field";

type Errors = Record<string, string | undefined>;

function QuoteFields({ e, q, idPrefix }: { e: Errors; q?: HomeQuoteRow; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <>
      <ImageField label="الصورة" currentUrl={q?.image} nameFieldId={id("name")} defaultName={q?.name} error={e.image} />
      <Field id={id("quote")} label="نص الكلمة" hint={`حتى ${HOME_QUOTE_LIMITS.quote} حرف. يُعرض كما هو تحت الصورة.`} error={e.quote} required>
        <Textarea id={id("quote")} name="quote" rows={4} defaultValue={q?.quote} maxLength={HOME_QUOTE_LIMITS.quote} aria-invalid={Boolean(e.quote)} />
      </Field>
      <Field id={id("honorific")} label="اللقب" hint="مثل: خادم الحرمين الشريفين، صاحب السمو الملكي. اختياري." error={e.honorific}>
        <Input id={id("honorific")} name="honorific" defaultValue={q?.honorific} maxLength={HOME_QUOTE_LIMITS.honorific} aria-invalid={Boolean(e.honorific)} />
      </Field>
      <Field id={id("name")} label="الاسم" error={e.name} required>
        <Input id={id("name")} name="name" defaultValue={q?.name} maxLength={HOME_QUOTE_LIMITS.name} aria-invalid={Boolean(e.name)} />
      </Field>
      <Field id={id("title")} label="الصفة" hint="سطر صغير تحت الاسم، مثل: حفظه الله. اختياري." error={e.title}>
        <Input id={id("title")} name="title" defaultValue={q?.title} maxLength={HOME_QUOTE_LIMITS.title} aria-invalid={Boolean(e.title)} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={q ? q.isActive : true} className="size-4 accent-[var(--primary)]" />
        تُعرض في الصفحة الرئيسية
      </label>
    </>
  );
}

export function NewHomeQuoteButton() {
  return (
    <FormDialog
      trigger={
        <>
          <Plus aria-hidden="true" strokeWidth={1.75} />
          كلمة جديدة
        </>
      }
      triggerVariant="onBand"
      title="كلمة جديدة"
      description="تُضاف في آخر العرض المتتابع، ويمكن تغيير ترتيبها بعد الحفظ."
      submitLabel="إضافة"
      action={createHomeQuoteAction}
      wide
    >
      {(e) => <QuoteFields e={e} idPrefix="new-quote" />}
    </FormDialog>
  );
}

export function HomeQuoteRowActions({ q, first, last }: { q: HomeQuoteRow; first: boolean; last: boolean }) {
  const [result, setResult] = useState<AdminFormState | null>(null);
  const [pending, start] = useTransition();
  const move = (direction: "up" | "down") => start(async () => setResult(await moveHomeQuoteAction(q.id, direction)));
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" aria-label={`تقديم «${q.name}» في الترتيب`} disabled={first || pending} onClick={() => move("up")}>
          <ArrowUp aria-hidden="true" strokeWidth={1.75} />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`تأخير «${q.name}» في الترتيب`} disabled={last || pending} onClick={() => move("down")}>
          <ArrowDown aria-hidden="true" strokeWidth={1.75} />
        </Button>
        <FormDialog
          trigger={<PenLine aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`تعديل كلمة «${q.name}»`}
          title={`تعديل كلمة «${q.name}»`}
          submitLabel="حفظ"
          action={updateHomeQuoteAction.bind(null, q.id)}
          wide
        >
          {(e) => <QuoteFields e={e} q={q} idPrefix={`quote-${q.id}`} />}
        </FormDialog>
        <ConfirmDialog
          trigger={<Trash2 aria-hidden="true" strokeWidth={1.75} />}
          triggerVariant="ghost"
          triggerSize="sm"
          triggerLabel={`حذف كلمة «${q.name}»`}
          title="حذف الكلمة"
          description={`تُحذف كلمة «${q.name}» وصورتها من الصفحة الرئيسية نهائيًا. لإخفائها مؤقتًا عدّلها وألغِ «تُعرض في الصفحة الرئيسية».`}
          confirmLabel="حذف"
          confirmVariant="danger"
          onConfirm={async () => setResult(await deleteHomeQuoteAction(q.id))}
        />
      </div>
      {result && !result.ok ? <Alert tone="danger">{result.message}</Alert> : null}
    </div>
  );
}

const STYLE_OPTIONS: { value: HeroQuoteStyle; label: string; text: string }[] = [
  { value: "cream", label: "بطاقة كريمية", text: "بطاقة فاتحة واضحة على الخلفية الخضراء، والصورة تتجاوز حافتها العليا." },
  { value: "card", label: "بطاقة شفافة", text: "بطاقة شفافة بإطار ذهبي رفيع، والنص أبيض على الخلفية الخضراء." },
];

/** Miniature of each look, drawn with the same tokens as the hero. */
function StylePreview({ style }: { style: HeroQuoteStyle }) {
  const cream = style === "cream";
  return (
    <span aria-hidden="true" className="band-scope flex h-28 items-end justify-center overflow-hidden rounded-md bg-band px-6 pb-3">
      <span className={cn("relative flex h-[76px] w-full max-w-36 flex-col items-center rounded-lg", cream ? "bg-accent-soft" : "border border-band-gold/40 bg-white/[0.06]")}>
        <span className={cn("absolute -top-4 size-8 rounded-full border-2", cream ? "border-accent/70 bg-band" : "border-band-gold/70 bg-band-2")} />
        <span className={cn("mt-7 h-1.5 w-20 rounded-full", cream ? "bg-brand-ink/70" : "bg-white/70")} />
        <span className={cn("mt-1.5 h-1.5 w-14 rounded-full", cream ? "bg-brand-ink/40" : "bg-white/40")} />
        <span className={cn("mt-3 h-1.5 w-12 rounded-full", cream ? "bg-accent" : "bg-band-gold")} />
      </span>
    </span>
  );
}

export function HeroQuoteStyleForm({ current }: { current: HeroQuoteStyle }) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(setHeroQuoteStyleAction, {});
  const [choice, setChoice] = useState(current);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 px-5 pb-5 sm:px-6">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <fieldset>
        <legend className="sr-only">شكل الكلمات</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {STYLE_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "card-link flex cursor-pointer flex-col gap-3 rounded-xl border bg-surface p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
                choice === o.value ? "border-primary ring-2 ring-primary/25 ring-inset" : "border-line",
              )}
            >
              <StylePreview style={o.value} />
              <span className="flex items-start gap-2.5 px-1">
                <input type="radio" name="style" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="mt-1 size-4 accent-[var(--primary)]" />
                <span>
                  <span className="block text-sm font-bold text-ink">{o.label}</span>
                  <span className="t-caption block">{o.text}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
          حفظ الشكل
        </SubmitButton>
      </div>
    </form>
  );
}
