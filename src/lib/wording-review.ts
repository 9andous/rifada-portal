// The wording slips listed for the owner in docs/COPY-REVIEW.md («Taxonomy source wording»).
// They were kept exactly as in the source; the editor offers a direct way to fix each one, and an
// entry counts as resolved once the stored name no longer equals `text`. Nothing changes them
// automatically.

export type WordingSlip = {
  program: number;
  /** One slip can cover several initiatives with the same issue. */
  initiatives: { number: number; text: string }[];
  note: string;
};

export const WORDING_SLIPS: WordingSlip[] = [
  { program: 2, initiatives: [{ number: 5, text: "الدورات العلمية:" }], note: "نقطتان رأسيتان في آخر الاسم كما في المصدر." },
  {
    program: 2,
    initiatives: [{ number: 10, text: "تعليم اللغة العربية للناطقين بغيرها داخل المسجد الحرام والمسجد النبوي." }],
    note: "نقطة في آخر الاسم.",
  },
  { program: 2, initiatives: [{ number: 16, text: "غرس القيمية للأطفال" }], note: "ربما المقصود «غرس القيم للأطفال»." },
  {
    program: 4,
    initiatives: [
      { number: 2, text: "تأسيس مركز اتصال إجابة السائلين." },
      { number: 9, text: "لقاء شهري بين المشاركين وسماحة المفتي وهيئة كبار العلماء." },
    ],
    note: "نقطة في آخر الاسم.",
  },
  {
    program: 4,
    initiatives: [{ number: 7, text: "محادثة (شات) بالذكاء الاصطناعي Ai Generate:" }],
    note: "نقطتان رأسيتان في آخر الاسم، وعبارة لاتينية «Ai Generate».",
  },
  { program: 4, initiatives: [{ number: 11, text: "دليل المراكز استشارية يحال إليها السائلون" }], note: "ربما المقصود «المراكز الاستشارية»." },
  {
    program: 4,
    initiatives: [{ number: 15, text: "مستشارين متخصصين في الجوانب الإيمانية والتربوية والسلوكية" }],
    note: "ربما المقصود «مستشارون متخصصون».",
  },
  {
    program: 5,
    initiatives: [{ number: 3, text: "حلقات تحفيظ القرآن الكريم للقاصدين والزائرين، وتصحيح تلاوتهم، وتأهيل المتسابقين للمسابقات القرآنية." }],
    note: "نقطة في آخر الاسم.",
  },
  { program: 5, initiatives: [{ number: 12, text: "حلقات الفاتحة في المسجد الحرام ساحاته" }], note: "ربما المقصود «وساحاته»." },
  { program: 6, initiatives: [{ number: 5, text: "\"تواصل\" الموسم الثاني" }], note: "علامات تنصيص لاتينية؛ قد تكون «تواصل» بعلامات التنصيص العربية أنسب." },
];
