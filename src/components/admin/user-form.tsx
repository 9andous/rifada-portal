"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form-bits";
import { Button, buttonClasses } from "@/components/ui/button";
import { OneTimeSecret } from "@/components/ui/one-time-secret";
import { Select } from "@/components/ui/select";
import { useActionForm } from "@/components/ui/use-action-form";
import { Alert } from "@/components/ui/surface";
import { toArabicDigits } from "@/lib/format";
import { ROLE_LABELS, ROLES, type Role } from "@/server/authz/roles";
import type { AdminFormState } from "@/server/actions/admin/state";

type Option = { id: string; name: string };

export type UserFormDefaults = {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: Role | "";
  programIds: string[];
  associationId: string;
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field id="name" label="الاسم الكامل" error={e.name} required>
          <Input id="name" name="name" defaultValue={defaults.name} required aria-invalid={Boolean(e.name)} autoComplete="off" />
        </Field>
        <Field id="username" label="اسم المستخدم" hint="أحرف لاتينية صغيرة وأرقام والرمزان . و _" error={e.username} required>
          <Input id="username" name="username" dir="ltr" defaultValue={defaults.username} required aria-invalid={Boolean(e.username)} autoComplete="off" />
        </Field>
        <Field id="email" label="البريد الإلكتروني" hint="اختياري؛ يلزم لاستعادة كلمة المرور ذاتيًا." error={e.email}>
          <Input id="email" name="email" type="email" dir="ltr" defaultValue={defaults.email} aria-invalid={Boolean(e.email)} autoComplete="off" />
        </Field>
        <Field id="phone" label="رقم الهاتف" hint="اختياري." error={e.phone}>
          <Input id="phone" name="phone" type="tel" dir="ltr" defaultValue={defaults.phone} aria-invalid={Boolean(e.phone)} autoComplete="off" />
        </Field>
        <Field
          id="role"
          label="الدور"
          hint={isSelf ? "لا يمكنك تغيير دور حسابك." : mode === "edit" ? "لا يمكن تحويل حساب مسؤول جمعية إلى دور آخر أو العكس." : undefined}
          error={e.role}
          required
        >
          {isSelf ? <input type="hidden" name="role" value={role} /> : null}
          <Select
            id="role"
            name={isSelf ? undefined : "role"}
            value={role}
            disabled={isSelf}
            onChange={(ev) => setRole(ev.target.value as Role | "")}
            placeholder={mode === "create" ? "اختر الدور" : undefined}
            options={roleChoices.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            aria-invalid={Boolean(e.role)}
          />
        </Field>
        {role === "ASSOCIATION_OFFICER" ? (
          <Field id="associationId" label="الجمعية" hint="لكل جمعية حساب مسؤول واحد فقط؛ تظهر هنا الجمعيات النشطة التي ليس لها حساب." error={e.associationId} required>
            <Select
              id="associationId"
              name="associationId"
              defaultValue={defaults.associationId}
              placeholder="اختر الجمعية"
              options={associations.map((a) => ({ value: a.id, label: a.name }))}
              aria-invalid={Boolean(e.associationId)}
            />
          </Field>
        ) : null}
      </div>

      {role === "SUPERVISOR" ? (
        <fieldset aria-describedby={e.programIds ? "programIds-error" : undefined}>
          <legend className="text-sm font-medium text-ink">
            البرامج المسندة إلى المشرف
            <span className="ms-1 text-danger" aria-hidden="true">
              *
            </span>
          </legend>
          <p className="t-caption mt-1">يرى المشرف طلبات هذه البرامج فقط ويراجعها.</p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {programs.map((p) => (
              <label key={p.id} className="flex items-start gap-3 rounded-sm border border-line px-3 py-2.5 text-sm hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-surface-sunken">
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

      {mode === "create" ? (
        <p className="t-caption">تُنشأ كلمة مرور مؤقتة تظهر لك مرة واحدة بعد الحفظ، ويُطلب من صاحب الحساب تغييرها عند أول دخول.</p>
      ) : null}
      <div>
        <SubmitButton pending={pending} pendingLabel="جارٍ الحفظ…">{mode === "create" ? "إنشاء الحساب" : "حفظ التغييرات"}</SubmitButton>
      </div>
    </form>
  );
}
