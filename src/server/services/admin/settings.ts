import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fieldErrors } from "@/lib/validation/auth";
import { EDITABLE_SETTING_KEYS, settingsSchema, type EditableSettingKey, type SettingsInput } from "@/lib/validation/settings";
import type { Actor } from "@/server/authz/scope";
import { db } from "@/server/db";
import { audit } from "@/server/services/audit";
import { SETTING_DEFAULTS } from "@/server/settings/defaults";
import { assertCan, lockAdminWrites, type Result } from "./common";

export type SettingsView = {
  values: SettingsInput;
  meta: Record<EditableSettingKey, { updatedAt: Date | null; updatedBy: string | null; isDefault: boolean }>;
};

function valueOrDefault(key: EditableSettingKey, stored: Prisma.JsonValue | undefined): SettingsInput[EditableSettingKey] {
  const parsed = settingsSchema.shape[key].safeParse(stored);
  return (parsed.success ? parsed.data : SETTING_DEFAULTS[key]) as SettingsInput[EditableSettingKey];
}

export async function getSettingsView(actor: Actor): Promise<SettingsView> {
  assertCan(actor, "settings.manage");
  const rows = await db.setting.findMany({
    where: { key: { in: EDITABLE_SETTING_KEYS } },
    select: { key: true, value: true, updatedAt: true, updatedBy: { select: { name: true } } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const values = {} as Record<EditableSettingKey, unknown>;
  const meta = {} as SettingsView["meta"];
  for (const key of EDITABLE_SETTING_KEYS) {
    const row = byKey.get(key);
    values[key] = valueOrDefault(key, row?.value);
    meta[key] = { updatedAt: row?.updatedBy ? row.updatedAt : null, updatedBy: row?.updatedBy?.name ?? null, isDefault: !row };
  }
  return { values: values as SettingsInput, meta };
}

/** Validates every value, writes only the changed keys and audits each change with before and after. */
export async function updateSettings(actor: Actor, raw: unknown): Promise<Result<{ changed: EditableSettingKey[] }>> {
  assertCan(actor, "settings.manage");
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "لم تُحفظ الإعدادات؛ صحّح القيم المشار إليها.", errors: fieldErrors(parsed.error) };
  }

  return db.$transaction(async (tx) => {
    await lockAdminWrites(tx);
    const rows = await tx.setting.findMany({ where: { key: { in: EDITABLE_SETTING_KEYS } } });
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const changed: EditableSettingKey[] = [];

    for (const key of EDITABLE_SETTING_KEYS) {
      const before = valueOrDefault(key, stored.get(key));
      const after = parsed.data[key];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const value = after as Prisma.InputJsonValue;
      await tx.setting.upsert({
        where: { key },
        create: { key, value, updatedById: actor.id },
        update: { value, updatedById: actor.id },
      });
      await audit(
        {
          actorId: actor.id,
          action: "setting.updated",
          entityType: "Setting",
          entityId: key,
          before: { key, value: before as Prisma.InputJsonValue },
          after: { key, value },
        },
        tx,
      );
      changed.push(key);
    }
    return { ok: true, changed };
  });
}
