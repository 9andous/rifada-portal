import type { Metadata } from "next";
import { SettingsForm, type SettingCaptions } from "@/components/admin/settings-form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { PageBody } from "@/components/layout/app-shell";
import { BandFigures, PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { DateDisplay } from "@/components/ui/date-display";
import { Panel } from "@/components/ui/surface";
import { countUnit, formatNumber } from "@/lib/format";
import { EDITABLE_SETTING_KEYS } from "@/lib/validation/settings";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { updateSettingsAction } from "@/server/actions/admin/settings";
import { getSettingsView } from "@/server/services/admin/settings";

export const metadata: Metadata = { title: "الإعدادات" };

const DAY_UNIT = { one: "يوم عمل", two: "يوما عمل", few: "أيام عمل", many: "يوم عمل" };
const REQUEST_UNIT = { one: "طلب", two: "طلبان", few: "طلبات", many: "طلبًا" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user.role, "settings.manage")) return <ForbiddenPage />;
  const { values, meta } = await getSettingsView(user);

  const captions = Object.fromEntries(
    EDITABLE_SETTING_KEYS.map((key) => {
      const m = meta[key];
      return [
        key,
        m.updatedBy && m.updatedAt ? (
          <span key={key} className="inline-flex flex-wrap gap-x-1.5">
            آخر تعديل: {m.updatedBy}، <DateDisplay date={m.updatedAt} withTime />
          </span>
        ) : (
          "القيمة الافتراضية للنظام، لم تُعدَّل بعد."
        ),
      ];
    }),
  ) as SettingCaptions;

  return (
    <>
      <PageBand
        compact
        title="الإعدادات"
        lead="قيم تشغيل المنصة. يُسجَّل كل تغيير في سجل التدقيق بالقيمة السابقة والجديدة."
        figures={
          <BandFigures
            items={[
              { label: "مهلة المراجعة", value: formatNumber(values["sla.workingDays"]), unit: countUnit(values["sla.workingDays"], DAY_UNIT), emphasis: true },
              { label: "حجم الملف الأقصى", value: formatNumber(values["uploads.maxFileMb"]), unit: "ميغابايت" },
              { label: "حد الإجراء الجماعي", value: formatNumber(values["bulk.maxItems"]), unit: countUnit(values["bulk.maxItems"], REQUEST_UNIT) },
              { label: "المبادرات للزوار", value: values["public.showInitiatives"] ? "معروضة" : "مخفية" },
            ]}
          />
        }
      />
      <PageBody>
        <SettingsTabs active="general" />
        <Panel className="p-6">
          <SettingsForm action={updateSettingsAction} values={values} captions={captions} />
        </Panel>
      </PageBody>
    </>
  );
}
