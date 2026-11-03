// «معايير القبول والامتثال» checked by the supervisor in «تقييم واعتماد» (D-116), in the owner's
// words. The keys are stored with each evaluation; change a title freely, never reuse a key.

export const REVIEW_CRITERIA = [
  { key: "competence", title: "مطابقة النشاط لاختصاص الرئاسة الفني", hint: "يقع ضمن المجموعة التاسعة وتصنيفاتها الفرعية" },
  { key: "sanctity", title: "ملاءمة العمل لقدسية المكان ومكانة الحرمين", hint: "مراجعة المحتوى والسلوك الميداني" },
  { key: "responsibilities", title: "اكتمال مصفوفة الصلاحيات والمسؤوليات", hint: "مسؤول ميداني معتمد لكل موقع" },
  { key: "objectives", title: "ارتباط البرنامج بأحد الأهداف الاستراتيجية السبعة", hint: "تحديد الهدف ومؤشر القياس" },
  { key: "impact", title: "خطة القياس وتقارير الأثر", hint: "دورية التقارير ومنهجية جمع البيانات" },
] as const;

export type ReviewCriterionKey = (typeof REVIEW_CRITERIA)[number]["key"];
export type CriterionResult = { key: ReviewCriterionKey; met: boolean; note: string | null };
