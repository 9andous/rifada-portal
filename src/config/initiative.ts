// Fixed public texts. The initiative wording follows the initiative document «مبادرة تأسيس وأتمتة
// الإشراف الفني على الجمعيات» (private PDF, see docs/ONBOARDING.md); the leadership statements
// follow the opening pages of the strategy outline. The strategy itself (vision, mission, values,
// objectives, programmes) is database content, see src/server/services/public-site.ts.

// Portraits come from the same pages of the strategy outline (public/images/leadership/).
export const LEADERSHIP_QUOTES = [
  {
    quote: "لقد شرَّف الله المملكة العربية السعودية بخدمة الحرمين الشريفين وضيوف الرحمن، ونفخر بخدمة ضيوف الرحمن.",
    honorific: "خادم الحرمين الشريفين",
    name: "الملك سلمان بن عبدالعزيز آل سعود",
    title: "حفظه الله",
    image: "/images/leadership/king-salman.jpg",
  },
  {
    quote: "لدينا مسؤولية إلى الأبد تجاه الحرمين الشريفين.",
    honorific: "صاحب السمو الملكي",
    name: "الأمير محمد بن سلمان بن عبدالعزيز آل سعود",
    title: "ولي العهد رئيس مجلس الوزراء، حفظه الله",
    image: "/images/leadership/crown-prince.jpg",
  },
] as const;

/** Opening statement of the President of Religious Affairs in the strategy outline (excerpt). */
export const PRESIDENT_WORD = {
  quote:
    "إن الأمر السامي الكريم بإنشاء جهاز مستقل باسم رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي وتكليفنا برئاستها يُحتِّم علينا جميعًا بذل المزيد من الجهود في تطوير الشؤون الدينية، ونقل رسالة الحرمين الشريفين للعالم أجمع.",
  honorific: "معالي الشيخ الأستاذ الدكتور",
  name: "عبدالرحمن بن عبدالعزيز السديس",
  title: "رئيس الشؤون الدينية بالمسجد الحرام والمسجد النبوي",
  image: "/images/leadership/sheikh-alsudais.jpg",
} as const;

export const STRATEGY_MOTTO = "";

export const INITIATIVE = {
  name: "مبادرة تأسيس وأتمتة الإشراف الفني على الجمعيات",
  intro:
    "انطلاقًا من الدور المحوري الذي تقوم به رئاسة الشؤون الدينية، وانسجامًا مع التوجهات نحو مأسسة العمل الخيري، تأتي هذه المبادرة ضمن مشروع تأسيس إدارة الإشراف الفني على الجمعيات، لتمكين الرئاسة من ممارسة اختصاصها جهةَ إشراف فني على الجمعيات الخيرية والتطوعية التي تخدم قاصدي الحرمين الشريفين.",
  summary: "بناء نموذج إشرافي احترافي ومؤتمت بالكامل وفق أفضل الممارسات العالمية، يُحتذى به، وتأسيس حوكمة واضحة ودليل إجرائي واضح.",
  tracks: [
    {
      title: "المسار الإجرائي",
      text: "بناء الأدلة والأمثلة الإجرائية والنماذج ومعايير القبول، بما يضمن وضوح المتطلبات وانضباط دورة العمل.",
    },
    {
      title: "المسار التقني",
      text: "منصة إلكترونية بلوحات تحكم مدمجة في موقع الرئاسة، مع توظيف الذكاء الاصطناعي لدعم القرار والتنبؤ بحالة الجمعيات.",
    },
  ],
  /** Strategic objectives the initiative's outputs serve, with how (initiative document, page 6). */
  objectiveLinks: {
    1: "عبر توجيه الجمعيات لتقديم برامج ومشروعات تخدم هذا الهدف.",
    5: "إذ تمثّل الجمعيات الخيرية والتطوعية الركيزة الأساسية لهذا الهدف.",
    6: "من خلال بناء الأدلة الإجرائية والمقارنات المعيارية والحوكمة.",
    7: "عبر إنشاء المنصة الرقمية ولوحات القياس والذكاء الاصطناعي.",
  } as Record<number, string>,
} as const;

/** How a request moves through supervision, as the platform implements it. */
export const SUPERVISION_STEPS = [
  { icon: "send", title: "تقديم الطلب", text: "تقدّم الجمعية برنامجها أو مشروعها ضمن أحد برامج الرئاسة ومبادراتها، مع المرفقات المطلوبة." },
  { icon: "check", title: "فحص الاكتمال", text: "تتحقق المنصة من استيفاء المتطلبات والمرفقات قبل إحالة الطلب إلى المراجعة." },
  { icon: "review", title: "المراجعة الفنية", text: "يراجع المشرف المختص الطلب وفق معايير القبول، ويتواصل مع الجمعية عند الحاجة." },
  { icon: "decision", title: "القرار والمتابعة", text: "يصدر القرار موثّقًا ومسببًا، وتتابع الجمعية حالة طلبها ومراحله من حسابها." },
] as const;
