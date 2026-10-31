// Arabic labels for audit actions, entity types and snapshot fields shown in the admin area.
// Unknown codes fall back to the code itself.

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.password_changed": "تغيير كلمة المرور",
  "auth.password_reset": "إعادة تعيين كلمة المرور",
  "auth.password_reset_requested": "طلب إعادة تعيين كلمة المرور",
  "auth.password_reset_by_script": "إعادة تعيين كلمة المرور من الخادم",
  "user.created": "إنشاء مستخدم",
  "user.updated": "تعديل مستخدم",
  "user.deactivated": "تعطيل مستخدم",
  "user.reactivated": "تفعيل مستخدم",
  "user.password_reset": "إصدار كلمة مرور مؤقتة",
  "user.image_changed": "تغيير صورة المستخدم",
  "user.image_removed": "إزالة صورة المستخدم",
  "track.created": "إضافة مسار",
  "track.updated": "تعديل مسار",
  "track.programs_changed": "تعديل برامج المسار",
  "track.archived": "أرشفة مسار",
  "track.restored": "استعادة مسار",
  "request_type.created": "إضافة نوع طلب",
  "request_type.updated": "تعديل نوع طلب",
  "request_type.paused": "إيقاف نوع طلب",
  "request_type.activated": "تفعيل نوع طلب",
  "request_type.archived": "أرشفة نوع طلب",
  "request_type.restored": "استعادة نوع طلب",
  "association.created": "إنشاء جمعية",
  "association.updated": "تعديل جمعية",
  "association.deactivated": "تعطيل جمعية",
  "association.reactivated": "تفعيل جمعية",
  "association.logo_changed": "تغيير شعار الجمعية",
  "association.logo_removed": "إزالة شعار الجمعية",
  "association.profile_updated": "تعديل الجمعية لبيانات التواصل من ملفها",
  "home_quote.created": "إضافة كلمة إلى الصفحة الرئيسية",
  "home_quote.updated": "تعديل كلمة في الصفحة الرئيسية",
  "home_quote.deleted": "حذف كلمة من الصفحة الرئيسية",
  "home_quote.reordered": "تغيير ترتيب كلمات الصفحة الرئيسية",
  "home_quote.image_changed": "تغيير صورة كلمة في الصفحة الرئيسية",
  "home_quote.image_removed": "إزالة صورة كلمة من الصفحة الرئيسية",
  "registration.submitted": "تقديم طلب تسجيل جمعية",
  "registration.approved": "اعتماد طلب تسجيل جمعية",
  "registration.rejected": "رفض طلب تسجيل جمعية",
  "setting.updated": "تعديل إعداد",
  "request.created": "إنشاء مسودة طلب",
  "request.saved": "حفظ بيانات الطلب",
  "request.draft_discarded": "حذف مسودة طلب",
  "request.submission_blocked": "تقديم موقوف لنقص البيانات",
  "request.submitted": "تقديم الطلب",
  "request.resubmitted": "إعادة تقديم الطلب",
  "request.evaluated": "تقييم المشرف وتوقيعه وإرسال الطلب إلى مدير الوحدة",
  "request.evaluation_password_failed": "محاولة توقيع بكلمة مرور غير صحيحة",
  "request.approval_password_failed": "محاولة اعتماد نهائي بكلمة مرور غير صحيحة",
  "request.scope_changed": "تعديل البرنامج والمبادرات",
  "request.evaluation_edited": "تعديل مدير الوحدة لتقييم المشرف",
  "request.auto_assigned": "إسناد تلقائي",
  "request.left_unassigned": "لا يوجد مشرف متاح للإسناد",
  "request.reassigned": "إعادة إسناد",
  "request.approved": "اعتماد الطلب",
  "document.verified": "التحقق من وثيقة طلب برمز التحقق",
  "request.returned": "إعادة الطلب للتعديل",
  "request.rejected": "رفض الطلب",
  "request.file_added": "إرفاق ملف",
  "request.file_version_added": "إصدار جديد لملف",
  "request.file_removed": "حذف ملف من مسودة",
  "request.comment_added": "إضافة تعليق",
  "request.internal_note_added": "إضافة ملاحظة داخلية",
  "request.viewed_by_admin": "اطلاع مدير النظام على الطلب",
  "request.file_downloaded_by_admin": "تنزيل مدير النظام لملف",
};

const ENTITY_LABELS: Record<string, string> = {
  User: "مستخدم",
  Session: "جلسة",
  Association: "جمعية",
  AssociationRegistration: "طلب تسجيل جمعية",
  Setting: "إعداد",
  Request: "طلب",
  Program: "برنامج",
  Track: "مسار",
  Initiative: "مبادرة",
  HomeQuote: "كلمة في الصفحة الرئيسية",
};

const FIELD_LABELS: Record<string, string> = {
  username: "اسم المستخدم",
  name: "الاسم",
  email: "البريد الإلكتروني",
  phone: "الهاتف",
  role: "الدور",
  isActive: "نشط",
  associationId: "الجمعية",
  programIds: "البرامج",
  trackIds: "المسارات",
  mustChangePassword: "يلزم تغيير كلمة المرور",
  revokedSessions: "الجلسات المنهاة",
  reason: "السبب",
  licenseNumber: "رقم الترخيص",
  city: "المدينة",
  region: "المنطقة",
  classification: "التصنيف",
  contactName: "مسؤول التواصل",
  contactEmail: "بريد التواصل",
  contactPhone: "هاتف التواصل",
  key: "الإعداد",
  value: "القيمة",
  quote: "نص الكلمة",
  honorific: "اللقب",
  title: "الصفة",
  sortOrder: "الترتيب",
};

export const SETTING_LABELS: Record<string, string> = {
  "sla.workingDays": "مهلة المراجعة بأيام العمل",
  "uploads.maxFileMb": "الحد الأقصى لحجم الملف (ميغابايت)",
  "uploads.allowedGroups": "أنواع المرفقات المسموح بها",
  "uploads.associationQuotaMb": "حد التخزين لكل جمعية (ميغابايت)",
  "bulk.maxItems": "الحد الأقصى للطلبات في الإجراء الجماعي",
  "public.showInitiatives": "عرض المبادرات للزوار",
  "public.heroQuoteStyle": "شكل كلمات القيادة في الصفحة الرئيسية",
  "demo.enabled": "وضع العرض التجريبي",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function auditFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
