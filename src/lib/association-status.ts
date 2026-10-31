// What each request status means for an association officer (D-102). The status itself is always
// shown by its official name (the one the unit uses, editable by the super admin), so both sides
// speak the same words; these sentences only explain it and say who acts next. Keyed by the stable
// system key.

import type { SystemStatusKey } from "./workflow";

/** Whose move it is: the association's, the unit's, or nobody's (decided). */
export type Turn = "association" | "unit" | "none";

export type StatusHelp = {
  /** What the status means, in one sentence. */
  meaning: string;
  turn: Turn;
  /** The next step in a few words, for the «الخطوة التالية» column. */
  next: string;
  /** What the association should do, when it is their turn. */
  action?: string;
};

export const STATUS_HELP: Record<SystemStatusKey, StatusHelp> = {
  DRAFT: {
    meaning: "الطلب محفوظ لديكم، ولم يُرسل إلى الوحدة الإشرافية بعد.",
    turn: "association",
    next: "إكمال الطلب وإرساله",
    action: "أكملوا بيانات الطلب ومرفقاته، ثم أرسلوه من الخطوة الأخيرة.",
  },
  SUBMITTED: {
    meaning: "وصل الطلب إلى الوحدة الإشرافية.",
    turn: "unit",
    next: "التحقق من اكتمال الطلب",
  },
  COMPLETENESS_CHECK: {
    meaning: "يُتحقق من اكتمال بيانات الطلب ومرفقاته.",
    turn: "unit",
    next: "التحقق من اكتمال الطلب",
  },
  UNDER_REVIEW: {
    meaning: "يراجع المشرف المختص الطلب، ثم يصدر القرار.",
    turn: "unit",
    next: "مراجعة المشرف وإصدار القرار",
  },
  RETURNED: {
    meaning: "أعاد المشرف الطلب إليكم مع ملاحظات للتعديل.",
    turn: "association",
    next: "تعديل الطلب وإعادة إرساله",
    action: "اقرؤوا ملاحظات المشرف، وعدّلوا الطلب، ثم أعيدوا إرساله.",
  },
  APPROVED: {
    meaning: "اعتمدت الوحدة الإشرافية الطلب.",
    turn: "none",
    next: "اكتملت مراحل الطلب",
  },
  REJECTED: {
    meaning: "قررت الوحدة الإشرافية عدم اعتماد الطلب.",
    turn: "none",
    next: "اكتملت مراحل الطلب",
  },
};

export const TURN_LABEL: Record<Turn, string> = {
  association: "مطلوب منكم",
  unit: "لدى الوحدة الإشرافية",
  none: "",
};

/** The help for a status key, with a neutral fallback for an unknown key. */
export function statusHelp(key: string): StatusHelp {
  return (STATUS_HELP as Record<string, StatusHelp>)[key] ?? { meaning: "", turn: "none", next: "" };
}
