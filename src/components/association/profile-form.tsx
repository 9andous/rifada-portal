"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { ImageField } from "@/components/admin/image-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { useActionForm } from "@/components/ui/use-action-form";
import { cn } from "@/lib/cn";
import { updateAssociationProfileAction } from "@/server/actions/association-profile";
import type { AdminFormState } from "@/server/actions/admin/state";
import { FIELD_INPUT, FormField } from "./fields";

/** The part of «ملف الجمعية» the officer edits: logo and contact details (D-101). */
export function AssociationProfileForm({
  name,
  logo,
  contactName,
  contactEmail,
  contactPhone,
}: {
  name: string;
  logo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}) {
  const { state, onSubmit, pending } = useActionForm<AdminFormState>(updateAssociationProfileAction, {});
  const e = state.errors ?? {};
  // A fresh logo field after each save, so a used upload is never posted twice.
  const [saved, setSaved] = useState(0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setSaved(saved + 1);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.message ? (
        <Alert tone={state.ok ? "success" : "danger"} className="text-base">
          {state.message}
        </Alert>
      ) : null}
      <input type="hidden" id="profile-name" value={name} readOnly />
      <ImageField
        key={saved}
        label="شعار الجمعية"
        shape="square"
        layout="tile"
        nameFieldId="profile-name"
        defaultName={name}
        currentUrl={logo}
        note="يظهر في رأس الصفحة وفي سجلات الوحدة الإشرافية."
        error={e.image}
      />
      <FormField id="p-contact-name" label="مسؤول التواصل" hint="الاسم الكامل لمن تتواصل معه الوحدة الإشرافية." error={e.contactName}>
        <input id="p-contact-name" name="contactName" defaultValue={contactName ?? ""} maxLength={100} aria-invalid={Boolean(e.contactName)} className={cn(FIELD_INPUT, "h-11")} />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="p-contact-email" label="البريد الإلكتروني الرسمي" hint="مثال: info@jamiya.org.sa" error={e.contactEmail}>
          <input id="p-contact-email" name="contactEmail" type="email" dir="ltr" defaultValue={contactEmail ?? ""} aria-invalid={Boolean(e.contactEmail)} className={cn(FIELD_INPUT, "h-11")} />
        </FormField>
        <FormField id="p-contact-phone" label="هاتف الجمعية" hint="جوال سعودي، مثل ٠٥٠١٢٣٤٥٦٧." error={e.contactPhone}>
          <input id="p-contact-phone" name="contactPhone" inputMode="tel" dir="ltr" defaultValue={contactPhone ?? ""} aria-invalid={Boolean(e.contactPhone)} className={cn(FIELD_INPUT, "h-11")} />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="text-sm text-ink-muted">جميع الحقول مطلوبة، ويُحفظ التعديل فور الضغط على الزر.</p>
        <Button variant="gold" type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </Button>
      </div>
    </form>
  );
}
