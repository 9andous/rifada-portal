"use client";

import { Building2, ClipboardCheck, KeyRound, LayoutDashboard, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Button, buttonClasses } from "@/components/ui/button";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { SearchSelect } from "@/components/ui/search-select";
import { useActionForm } from "@/components/ui/use-action-form";
import { Alert, SectionTitle } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { toArabicDigits } from "@/lib/format";
import { ROLE_LABELS, ROLES, type Role } from "@/server/authz/roles";
import type { AdminFormState } from "@/server/actions/admin/state";
import { ImageField } from "./image-field";

type Option = { id: string; name: string };

export type UserFormDefaults = {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: Role | "";
  programIds: string[];
  associationId: string;
  /** The current picture's URL, if any. */
  imageUrl?: string | null;
};

/** What each role does, shown on its card (docs/PERMISSIONS.md). */
const ROLE_CARDS: Record<Role, { icon: LucideIcon; text: string }> = {
  SUPER_ADMIN: { icon: ShieldCheck, text: "يدير المستخدمين والجمعيات والبرامج وإعدادات المنصة." },
  UNIT_MANAGER: { icon: LayoutDashboard, text: "يتابع جميع الطلبات ويسندها إلى المشرفين ويقرر فيها." },
  SUPERVISOR: { icon: ClipboardCheck, text: "يراجع طلبات البرامج المسندة إليه ويقرر فيها." },
  ASSOCIATION_OFFICER: { icon: Building2, text: "يقدّم طلبات جمعيته ويتابعها؛ حساب واحد لكل جمعية." },
};

const EMPTY: UserFormDefaults = { username: "", name: "", email: "", phone: "", role: "", programIds: [], associationId: "" };

export function UserForm({
  mode,
  action,
  defaults = EMPTY,
  programs,
  associations,
  isSelf = false,
}: {
  mode: "create" | "edit";
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  defaults?: UserFormDefaults;
  programs: (Option & { number: number })[];
  associations: Option[];
  isSelf?: boolean;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(action, {});
  const [role, setRole] = useState<Role | "">(defaults.role);
  const e = state.errors ?? {};

  if (mode === "create" && state.ok && state.credentials) {
    return (
      <div className="flex flex-col gap-5">
        <OneTimeSecret title="أُنشئ الحساب" username={state.credentials.username} password={state.credentials.password} />
        <div className="flex flex-wrap gap-3">
          {state.createdId ? (
            <Link href={`/admin/users/${state.createdId}`} className={buttonClasses("primary")}>
              فتح صفحة الحساب
            </Link>
          ) : null}
          {/* A full reload clears the one-time password from memory before the next entry. */}
          <Button variant="outline" onClick={() => window.location.reload()}>
            إنشاء حساب آخر
          </Button>
          <Link href="/admin/users" className={buttonClasses("ghost")}>
            العودة إلى قائمة المستخدمين
          </Link>
        </div>
      </div>
    );
  }

  // Officer accounts stay officers, and staff accounts stay staff (D-037).
  const roleChoices =
    mode === "create"
      ? ROLES
      : defaults.role === "ASSOCIATION_OFFICER"
        ? (["ASSOCIATION_OFFICER"] as const)
        : ROLES.filter((r) => r !== "ASSOCIATION_OFFICER");

  return (
    <form onSubmit={onSubmit} className="flex flex-col" noValidate>
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"} className="mb-6">
          {state.message}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Profile column: the picture (or initials) and the chosen role at a glance. */}
        <aside className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface-muted px-5 py-6 lg:self-start">
          <ImageField label="الصورة الشخصية" layout="stacked" currentUrl={defaults.imageUrl} nameFieldId="name" defaultName={defaults.name} error={e.image} />
          <span className="h-px w-full bg-line" aria-hidden="true" />
          <div className="text-center">
            <p className="text-xs text-ink-subtle">الدور</p>
            <p className={cn("mt-1 text-sm font-bold", role ? "text-primary" : "text-ink-subtle")}>{role ? ROLE_LABELS[role] : "لم يُختر بعد"}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-4">
            <SectionTitle as="h3" className="text-[0.9375rem]">
              الهوية والدخول
            </SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field id="name" label="الاسم الكامل" error={e.name} required>
                <Input id="name" name="name" defaultValue={defaults.name} required aria-invalid={Boolean(e.name)} autoComplete="off" />
              </Field>
              <Field id="username" label="اسم المستخدم" hint="أحرف لاتينية صغيرة وأرقام والرمزان . و _" error={e.username} required>
                <Input id="username" name="username" dir="ltr" defaultValue={defaults.username} required aria-invalid={Boolean(e.username)} autoComplete="off" />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle as="h3" className="text-[0.9375rem]">
              التواصل
            </SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field id="email" label="البريد الإلكتروني" hint="اختياري؛ يلزم لاستعادة كلمة المرور ذاتيًا." error={e.email}>
                <Input id="email" name="email" type="email" dir="ltr" defaultValue={defaults.email} aria-invalid={Boolean(e.email)} autoComplete="off" />
              </Field>
              <Field id="phone" label="رقم الهاتف" hint="اختياري." error={e.phone}>
                <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={defaults.phone} aria-invalid={Boolean(e.phone)} autoComplete="off" />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle as="h3" className="text-[0.9375rem]">
              الدور والصلاحيات
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </SectionTitle>
            <fieldset aria-describedby={e.role ? "role-error" : "role-hint"} disabled={isSelf}>
              <legend className="sr-only">الدور</legend>
              {isSelf ? <input type="hidden" name="role" value={role} /> : null}
              <div role="radiogroup" aria-label="الدور" aria-invalid={Boolean(e.role)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roleChoices.map((r) => {
                  const { icon: Icon, text } = ROLE_CARDS[r];
                  const on = role === r;
                  return (
                    <label
                      key={r}
                      className={cn(
                        "relative flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3.5 pe-9 transition-[border-color,background-color,box-shadow]",
                        "has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-focus",
                        on ? "border-primary bg-primary-soft/50 shadow-[inset_0_0_0_1px_var(--primary)]" : "card-link border-line",
                        isSelf && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <input
                        type="radio"
                        name={isSelf ? undefined : "role"}
                        value={r}
                        checked={on}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={cn("flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5", on ? "bg-primary text-primary-ink" : "bg-primary-soft text-primary")}
                      >
                        <Icon strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink">{ROLE_LABELS[r]}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{text}</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn("absolute end-3 top-3 flex size-4 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-line-strong")}
                      >
                        {on ? <span className="size-2 rounded-full bg-primary" /> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              {e.role ? (
                <p id="role-error" role="alert" className="mt-2 text-xs text-danger">
                  {e.role}
                </p>
              ) : isSelf || mode === "edit" ? (
                <p id="role-hint" className="t-caption mt-2">
                  {isSelf ? "لا يمكنك تغيير دور حسابك." : "لا يمكن تحويل حساب مسؤول جمعية إلى دور آخر أو العكس."}
                </p>
              ) : null}
            </fieldset>

            {role === "ASSOCIATION_OFFICER" ? (
              <Field
                id="associationId"
                label="الجمعية"
                hint="لكل جمعية حساب مسؤول واحد فقط؛ تظهر هنا الجمعيات النشطة التي ليس لها حساب."
                error={e.associationId}
                required
              >
                <SearchSelect
                  id="associationId"
                  name="associationId"
                  defaultValue={defaults.associationId}
                  placeholder="اختر الجمعية"
                  searchPlaceholder="ابحث باسم الجمعية…"
                  options={associations.map((a) => ({ value: a.id, label: a.name }))}
                  aria-invalid={Boolean(e.associationId)}
                />
              </Field>
            ) : null}

            {role === "SUPERVISOR" ? (
              <fieldset aria-describedby={e.programIds ? "programIds-error" : undefined} className="rounded-lg border border-line bg-surface-muted p-4">
                <legend className="px-1 text-sm font-semibold text-ink">
                  البرامج المسندة إلى المشرف
                  <span className="ms-1 text-danger" aria-hidden="true">
                    *
                  </span>
                </legend>
                <p className="t-caption">يرى المشرف طلبات هذه البرامج فقط ويراجعها.</p>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {programs.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-sm transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
                    >
                      <input type="checkbox" name="programIds" value={p.id} defaultChecked={defaults.programIds.includes(p.id)} className="mt-1 size-4 accent-[var(--primary)]" />
                      <span>
                        <span className="t-figure me-1.5 text-accent-ink">{toArabicDigits(p.number)}</span>
                        {p.name}
                      </span>
                    </label>
                  ))}
                </div>
                {e.programIds ? (
                  <p id="programIds-error" role="alert" className="mt-2 text-xs text-danger">
                    {e.programIds}
                  </p>
                ) : null}
              </fieldset>
            ) : null}
          </section>
        </div>
      </div>

      <footer className="-mx-6 -mb-6 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-b-xl border-t border-line bg-surface-muted px-6 py-4">
        <p className="t-caption flex max-w-md items-start gap-2">
          {mode === "create" ? (
            <>
              <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" strokeWidth={1.75} />
              تُنشأ كلمة مرور مؤقتة تظهر لك مرة واحدة بعد الحفظ، ويُطلب من صاحب الحساب تغييرها عند أول دخول.
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/users" className={buttonClasses("outline")}>
            إلغاء
          </Link>
          <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">
            {mode === "create" ? "إنشاء الحساب" : "حفظ التغييرات"}
          </SubmitButton>
        </div>
      </footer>
    </form>
  );
}
