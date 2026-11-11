// Resets a test deployment to clean showcase data for a demo: removes every request and what hangs off it,
// the notifications and the association registrations, then writes realistic requests in every state of
// the review workflow, with real electronic seals. Accounts, associations, taxonomy, templates and settings stay,
// and audit rows are kept (append-only), with one row recording the reset. All of it runs in one transaction.
//
// Destructive: it refuses to run without CONFIRM_SHOWCASE_RESET=yes. Back up first. Files of deleted attachments
// stay on disk until `storage/attachments` and `storage/staging` are emptied.
// Run with `CONFIRM_SHOWCASE_RESET=yes npm run db:seed:showcase`.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { REVIEW_CRITERIA } from "../../src/config/review-criteria";
import { formatReference, requestHref, RECOMMENDATION_LABELS, RECOMMENDATION_VALUES, type Decision } from "../../src/lib/requests";
import { hijriYear } from "../../src/lib/format";
import { addWorkingDays } from "../../src/lib/working-days";
import { contentDigest, createSeal, evaluationDigest, openSeal } from "../../src/server/seal/seal";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SLA_WORKING_DAYS = 3;
const DAY = 86_400_000;
const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * DAY);
const daysAhead = (n: number) => new Date(NOW + n * DAY);
const after = (d: Date, hours: number) => new Date(d.getTime() + hours * 3_600_000);

const MANAGER = "idara";
const SUPERVISOR = "resp";

const list = (...items: string[]) => items.map((i) => `• ${i}`).join("\n");

type Content = { intro: string; means: string[]; projects?: string[]; goals: string[]; audience: string[]; kpis: string[]; partners: string[]; budget: number };

const body = (c: Content) =>
  [c.intro, `الوسائل وآليات التنفيذ\n${list(...c.means)}`, ...(c.projects ? [`المشاريع والنماذج المنبثقة\n${list(...c.projects)}`] : [])].join("\n\n");

/** Where a request stands in the workflow, and how it got there. */
type Plan =
  | { state: "DRAFT" }
  | { state: "NEW"; ageDays: number }
  | { state: "OPENED"; ageDays: number; overdue?: boolean }
  | { state: "RESUBMITTED"; ageDays: number; returnedReason: string }
  | { state: "RETURNED_DIRECT"; ageDays: number; reason: string }
  | { state: "REJECTED_DIRECT"; ageDays: number; reason: string }
  | { state: "WITH_MANAGER"; ageDays: number; recommendation: Decision; reason?: string; note?: string; unmet?: string[] }
  | { state: "DECIDED"; ageDays: number; recommendation: Decision; recommendationReason?: string; note?: string; unmet?: string[]; decision: Decision; reason?: string };

type Spec = {
  officer: string;
  track: number;
  type: string;
  /** The programme and initiative the supervisor classifies it under, by number. */
  scope?: [number, number];
  title: string;
  content: Content;
  plan: Plan;
  comments?: { from: "officer" | "supervisor" | "manager"; body: string; internal?: boolean }[];
};

const APPROVE = "اعتماد مشروع/برنامج";
const PERMIT = "تصريح إقامة نشاط";
const ENABLERS = "طلب محفزات وممكنات";

const SPECS: Spec[] = [
  {
    officer: "test_assoc",
    track: 1,
    type: APPROVE,
    scope: [7, 17],
    title: "ميثاق أخلاقيات الخدمة المكية",
    content: {
      intro:
        "تطوير مرجعية قيمية وسلوكية معتمدة تضبط العلاقة التفاعلية بين مقدم الخدمة والمستفيد والمكان المقدس، وإعادة تعريف خدمة ضيوف الرحمن بوصفها شرفًا ومسؤولية أخلاقية وثقافية تتجاوز الواجب الوظيفي المجرد؛ وصياغة «ميثاق أخلاقيات الخدمة المكية» يتضمن مبادئ التعظيم، وأدب الجوار، وحسن التعامل، والاحتفاء بوفد الرحمن، وتحويلها إلى أدلة تطبيقية مناسبة لمختلف القطاعات.",
      goals: [
        "تأصيل ميثاق مؤسسي لأخلاقيات الخدمة المكية وأدب الجوار ومراجعته مع الهيئات العلمية المختصة.",
        "تطوير أدلة تطبيقية وحزم إدماج تساعد المؤسسات على تضمين مبادئ الميثاق في لوائحها وتدريب منسوبيها.",
        "بناء نماذج سلوكية قابلة للتكييف حسب طبيعة كل جهة خدمية أو أمنية أو تجارية بمكة المكرمة.",
        "تعزيز الصورة الذهنية المشرفة لإنسان مكة المكرمة كقدوة عالمية في حسن الوفادة والتعايش السامي.",
        "قياس مستوى التبني المؤسسي والتحول من المبادئ العامة إلى ممارسات ميدانية ملموسة.",
      ],
      audience: ["العاملون والعاملات في قطاع الحج والعمرة.", "منسوبو الأجهزة الخدمية والأمنية والتطوعية.", "مقدمو خدمات الضيافة والنقل والتجارة بمكة."],
      means: ["حقائب التدريب السلوكي وأدلة المعايير الأخلاقية.", "ورش عمل للقيادات التنفيذية ومسؤولي الجودة.", "أدوات التقييم الذاتي واستطلاعات رضا الحجاج."],
      projects: ["وثيقة «ميثاق أخلاقيات الخدمة المكية» المعتمدة.", "دليل السلوك المهني في الحرم والمشاعر.", "برنامج «سفراء أدب الجوار» في المنشآت.", "بطاقات معايير التعامل مع ضيوف الرحمن."],
      kpis: ["عدد الجهات المتبنية للميثاق: ٤٠ جهة في السنة الأولى.", "نسبة العاملين المدرَّبين على الأدلة التطبيقية: ٧٠٪.", "ارتفاع رضا ضيوف الرحمن عن حسن التعامل بنسبة ١٥٪."],
      partners: ["الهيئة الملكية لمدينة مكة المكرمة والمشاعر المقدسة", "وزارة الحج والعمرة", "جامعة أم القرى"],
      budget: 480000,
    },
    plan: { state: "DECIDED", ageDays: 40, recommendation: "approve", note: "الطلب متكامل ويرتبط مباشرة ببرنامج قيم للعاملين والمتطوعين.", decision: "approve" },
    comments: [
      { from: "supervisor", body: "هل تمت مراجعة نص الميثاق مع جهة علمية مختصة؟" },
      { from: "officer", body: "نعم، راجعته لجنة علمية من جامعة أم القرى، والمحضر متاح عند الطلب." },
      { from: "supervisor", body: "الجمعية سبق أن نفذت برامج مماثلة بجودة عالية؛ يُقترح اعتماده أنموذجًا للجمعيات الأخرى.", internal: true },
    ],
  },
  {
    officer: "demo.hadiya",
    track: 2,
    type: APPROVE,
    scope: [5, 3],
    title: "حلقات «نور الحرم» لتحفيظ القرآن الكريم للقاصدين",
    content: {
      intro:
        "إقامة حلقات قرآنية ميسرة لقاصدي المسجد الحرام خلال مدة إقامتهم، تعتني بتصحيح التلاوة وحفظ قصار السور، وتراعي اختلاف اللغات والأعمار، وتمنح المشارك أثرًا قرآنيًا يستمر بعد عودته إلى بلده من خلال متابعة إلكترونية ميسرة.",
      goals: ["تمكين القاصدين من تصحيح تلاوة سورة الفاتحة وقصار السور.", "ربط القاصد بالقرآن الكريم بعد عودته عبر المتابعة عن بعد.", "استثمار أوقات القاصدين فيما يعود عليهم بالنفع والأثر."],
      audience: ["قاصدو المسجد الحرام من الرجال والنساء.", "الناطقون بغير العربية من المعتمرين.", "الأطفال المرافقون لذويهم."],
      means: ["حلقات يومية بإشراف معلمين مجازين.", "مقرأة إلكترونية للمتابعة بعد العودة.", "شهادات مشاركة بلغات متعددة."],
      kpis: ["عدد المستفيدين: ٦٬٠٠٠ قاصد في الموسم.", "نسبة إتقان سورة الفاتحة عند الختام: ٨٥٪.", "نسبة الاستمرار في المتابعة بعد العودة: ٣٠٪."],
      partners: ["الجمعية الخيرية لتحفيظ القرآن الكريم بمكة المكرمة", "متطوعون من طلاب جامعة أم القرى"],
      budget: 320000,
    },
    plan: { state: "DECIDED", ageDays: 75, recommendation: "approve", decision: "approve" },
  },
  {
    officer: "demo.ikram",
    track: 4,
    type: APPROVE,
    scope: [3, 21],
    title: "طباعة دليل «الحج خطوة بخطوة» بثماني لغات",
    content: {
      intro:
        "إعداد وطباعة دليل مصور موجز يشرح مناسك الحج خطوة بخطوة بثماني لغات عالمية، بلغة سهلة ورسوم توضيحية، مراجع علميًا ومهيأ للتوزيع في منافذ الوصول ومقار الإقامة، مع نسخة رقمية متاحة عبر رمز الاستجابة السريعة.",
      goals: ["تيسير فهم المناسك لغير الناطقين بالعربية.", "الحد من الأخطاء الشائعة في أداء النسك.", "توفير مرجع موثوق يصل إلى الحاج قبل بدء رحلته."],
      audience: ["الحجاج القادمون من خارج المملكة.", "مرشدو الحملات ومؤسسات الطوافة."],
      means: ["مراجعة علمية من مختصين في فقه المناسك.", "طباعة ١٠٠٬٠٠٠ نسخة وتوزيعها في المنافذ.", "نسخة رقمية مرتبطة برمز استجابة سريعة."],
      kpis: ["عدد النسخ الموزعة: ١٠٠٬٠٠٠ نسخة.", "عدد مرات تحميل النسخة الرقمية: ٥٠٬٠٠٠.", "رضا المستفيدين عن وضوح الدليل: ٩٠٪."],
      partners: ["مؤسسات الطوافة", "مراكز الترجمة المعتمدة"],
      budget: 650000,
    },
    plan: { state: "DECIDED", ageDays: 110, recommendation: "approve", decision: "approve" },
  },
  {
    officer: "demo.duyuf",
    track: 5,
    type: APPROVE,
    scope: [6, 18],
    title: "مبادرة «ترحاب» لاستقبال المعتمرين في منافذ الوصول",
    content: {
      intro:
        "تكوين فرق تطوعية مدربة لاستقبال المعتمرين في منافذ الوصول بمكة المكرمة، وتزويدهم بالإرشاد المكاني والمعلومات الأساسية وهدية ترحيبية رمزية، بما يعكس حسن الوفادة ويخفف عن القادم عناء الوصول الأول.",
      goals: ["تقديم تجربة استقبال كريمة لضيوف الرحمن منذ لحظة الوصول.", "توجيه القادمين إلى مقار إقامتهم والمسجد الحرام بيسر.", "ترسيخ ثقافة التطوع المنظم لدى شباب مكة المكرمة."],
      audience: ["المعتمرون القادمون عبر المنافذ البرية والجوية.", "المتطوعون من شباب وفتيات مكة المكرمة."],
      means: ["فرق استقبال بورديات منتظمة.", "نقاط ترحيب مجهزة بالمطويات والهدايا الرمزية.", "تدريب المتطوعين على مهارات التواصل واللغات الأساسية."],
      kpis: ["عدد المعتمرين المستقبَلين: ٧٥٬٠٠٠.", "عدد ساعات التطوع: ٢٠٬٠٠٠ ساعة.", "رضا المستفيدين عن الاستقبال: ٩٢٪."],
      partners: ["المركز الوطني لتنمية القطاع غير الربحي", "الجمعية السعودية للعمل التطوعي"],
      budget: 275000,
    },
    plan: { state: "DECIDED", ageDays: 25, recommendation: "approve", note: "مستوفٍ للمعايير، ويوصى بالتنسيق مع إدارة المنافذ قبل البدء.", decision: "approve" },
  },
  {
    officer: "demo.irshad",
    track: 3,
    type: PERMIT,
    scope: [6, 28],
    title: "تأهيل متطوعي إرشاد التائهين في ساحات المسجد الحرام",
    content: {
      intro:
        "برنامج تدريبي ميداني يؤهل متطوعين لإرشاد التائهين وكبار السن في ساحات المسجد الحرام، ويشمل مهارات التعامل مع الضيوف بلغات متعددة، واستخدام خرائط المواقع، وآلية تسليم الحالات إلى الجهات المختصة.",
      goals: ["خفض مدة وصول التائه إلى وجهته أو مرافقيه.", "رفع جاهزية المتطوعين للتعامل مع الحالات الإنسانية.", "توحيد إجراءات الإرشاد والتسليم بين الفرق الميدانية."],
      audience: ["التائهون وكبار السن من ضيوف الرحمن.", "المتطوعون في الساحات."],
      means: ["ورش تدريب نظرية وميدانية.", "بطاقات عبارات إرشادية بعشر لغات.", "غرفة تنسيق ميدانية خلال أوقات الذروة."],
      kpis: ["عدد المتطوعين المؤهلين: ٣٠٠ متطوع.", "عدد حالات الإرشاد: ٢٥٬٠٠٠ حالة.", "متوسط زمن الوصول إلى الوجهة: أقل من ١٥ دقيقة."],
      partners: ["الهلال الأحمر السعودي", "إدارة الساحات بالرئاسة"],
      budget: 190000,
    },
    plan: {
      state: "DECIDED",
      ageDays: 14,
      recommendation: "return",
      recommendationReason: "يوصى باستكمال آلية التسليم مع الجهات الأمنية قبل الاعتماد.",
      unmet: ["responsibilities"],
      decision: "approve",
    },
    comments: [{ from: "manager", body: "آلية التسليم معتمدة لدى إدارة الساحات، ولا حاجة إلى إعادة الطلب؛ يُعتمد مع التنسيق عند التنفيذ.", internal: true }],
  },
  {
    officer: "demo.kibar",
    track: 5,
    type: APPROVE,
    scope: [6, 7],
    title: "برنامج «لمسة إنسانية» لخدمة كبار السن من الزوار",
    content: {
      intro:
        "تقديم خدمات مساندة لكبار السن وذوي الإعاقة من الزوار والمعتمرين، تشمل المرافقة في التنقل، والعربات المتحركة، والتوعية الصحية البسيطة، ونقاط راحة في المواقع الأشد ازدحامًا، بمشاركة متطوعين مدربين على الرعاية.",
      goals: ["تيسير أداء العبادة لكبار السن وذوي الإعاقة.", "تقليل حالات الإجهاد والإعياء في أوقات الذروة.", "رفع وعي المرافقين بحقوق كبار السن واحتياجاتهم."],
      audience: ["كبار السن من الزوار والمعتمرين.", "ذوو الإعاقة ومرافقوهم."],
      means: ["فرق مرافقة بالتنسيق مع إدارة الساحات.", "توفير ٢٠٠ عربة متحركة.", "نقاط راحة وتوعية صحية."],
      kpis: ["عدد المستفيدين: ١٥٬٠٠٠ مستفيد.", "رضا المستفيدين: ٩٠٪.", "عدد ساعات المرافقة: ١٢٬٠٠٠ ساعة."],
      partners: ["وزارة الصحة", "الهلال الأحمر السعودي"],
      budget: 410000,
    },
    plan: { state: "WITH_MANAGER", ageDays: 2, recommendation: "approve", note: "البرنامج مستوفٍ لجميع المعايير، وأثره مباشر على فئة ذات أولوية." },
  },
  {
    officer: "demo.suqya",
    track: 2,
    type: ENABLERS,
    scope: [5, 6],
    title: "دعم مقرأة الحرمين الإلكترونية للناطقين بغير العربية",
    content: {
      intro:
        "طلب دعم فني وتشغيلي لتوسيع مقرأة إلكترونية تتيح للناطقين بغير العربية قراءة القرآن الكريم على معلمين مجازين عن بعد، مع جدولة مرنة تناسب اختلاف المناطق الزمنية وتقارير متابعة دورية لكل دارس.",
      goals: ["توسيع الوصول إلى الإقراء المجاز عالميًا.", "توفير مسار متدرج لتصحيح التلاوة.", "قياس تقدم الدارسين بصورة منتظمة."],
      audience: ["الناطقون بغير العربية حول العالم.", "المعلمون المجازون المتطوعون."],
      means: ["منصة حجز وجلسات صوتية.", "استقطاب ٥٠ معلمًا مجازًا.", "تقارير شهرية لكل دارس."],
      kpis: ["عدد الدارسين النشطين: ٣٬٠٠٠ دارس.", "عدد الجلسات الشهرية: ٨٬٠٠٠ جلسة."],
      partners: ["مقرأة الحرمين الشريفين"],
      budget: 540000,
    },
    plan: {
      state: "WITH_MANAGER",
      ageDays: 1,
      recommendation: "return",
      reason: "خطة القياس غير مكتملة، ولا توضح مصادر التمويل بعد السنة الأولى؛ يوصى بإعادته لاستكمالها.",
      unmet: ["impact"],
    },
    comments: [{ from: "supervisor", body: "الفكرة جيدة، لكن الاستدامة المالية بعد السنة الأولى غير واضحة.", internal: true }],
  },
  {
    officer: "test_assoc",
    track: 1,
    type: PERMIT,
    scope: [6, 14],
    title: "معرض «تعظيم البيت الحرام» التوعوي المتنقل",
    content: {
      intro:
        "معرض توعوي متنقل يعرّف الزوار بفضائل البيت الحرام وآداب الجوار وأحكام الحرم، باستخدام شاشات تفاعلية ومجسمات تعليمية، ويتنقل بين مواقع الضيافة ومقار الحملات خلال الموسم.",
      goals: ["ترسيخ قيمة تعظيم البيت الحرام لدى الزوار.", "تصحيح المفاهيم الشائعة المتعلقة بأحكام الحرم.", "تقديم التوعية بأساليب تفاعلية جاذبة."],
      audience: ["الزوار والمعتمرون.", "الأسر والأطفال."],
      means: ["شاشات تفاعلية ومجسمات تعليمية.", "مرشدون بلغات متعددة.", "جولات بين مقار الحملات."],
      kpis: ["عدد الزوار: ٤٠٬٠٠٠ زائر.", "عدد المواقع: ١٢ موقعًا."],
      partners: ["إدارة التوعية الميدانية بالرئاسة"],
      budget: 720000,
    },
    plan: {
      state: "WITH_MANAGER",
      ageDays: 1,
      recommendation: "reject",
      reason: "المحتوى يتداخل مع معرض قائم بالرئاسة، والميزانية مرتفعة مقارنة بالأثر المتوقع.",
      note: "يمكن للجمعية المشاركة في المعرض القائم بدلًا من إنشاء معرض جديد.",
      unmet: ["competence", "objectives"],
    },
  },
  {
    officer: "saqya.alharam",
    track: 5,
    type: APPROVE,
    title: "سقيا زمزم في مسارات المشاة حول المنطقة المركزية",
    content: {
      intro:
        "توفير مياه زمزم المبردة في نقاط متنقلة على مسارات المشاة المؤدية إلى المسجد الحرام، بعبوات صديقة للبيئة وبإشراف فرق تطوعية، مع التركيز على أوقات الذروة وارتفاع درجات الحرارة.",
      goals: ["الحد من حالات الإجهاد الحراري بين المشاة.", "تيسير الحصول على ماء زمزم خارج الساحات.", "تقليل النفايات البلاستيكية في المسارات."],
      audience: ["المشاة من الزوار والمعتمرين.", "كبار السن والأطفال."],
      means: ["٤٠ نقطة سقيا متنقلة.", "عبوات قابلة لإعادة التدوير.", "فرق تطوعية بورديات."],
      kpis: ["عدد العبوات الموزعة: ٢٬٠٠٠٬٠٠٠ عبوة.", "عدد نقاط السقيا: ٤٠ نقطة."],
      partners: ["الهيئة العامة للعناية بشؤون المسجد الحرام والمسجد النبوي", "شركة مياه زمزم"],
      budget: 860000,
    },
    plan: { state: "NEW", ageDays: 0 },
  },
  {
    officer: "test_assoc",
    track: 1,
    type: APPROVE,
    title: "دورات اللغة العربية للعاملين الناطقين بغيرها في قطاع الضيافة",
    content: {
      intro:
        "دورات قصيرة تعلّم العاملين في قطاع الضيافة بمكة المكرمة أساسيات اللغة العربية والعبارات الترحيبية والدينية التي يحتاجونها في خدمة ضيوف الرحمن، بما يحسن جودة التواصل ويعمق صلتهم بالمكان.",
      goals: ["تحسين تواصل العاملين مع ضيوف الرحمن.", "تعريف العاملين بآداب الجوار والمصطلحات الدينية.", "رفع كفاءة قطاع الضيافة في خدمة الزوار."],
      audience: ["العاملون في الفنادق والمطاعم والنقل.", "مشرفو الخدمات في مقار الإقامة."],
      means: ["دورات مسائية من ٢٠ ساعة.", "حقيبة تعليمية مصورة.", "اختبار قصير وشهادة إتمام."],
      kpis: ["عدد الخريجين: ٨٠٠ عامل.", "نسبة اجتياز الاختبار: ٨٠٪."],
      partners: ["غرفة مكة المكرمة", "معهد تعليم اللغة العربية بجامعة أم القرى"],
      budget: 230000,
    },
    plan: { state: "NEW", ageDays: 1 },
  },
  {
    officer: "demo.duyuf",
    track: 5,
    type: PERMIT,
    title: "ركن الترجمة الفورية لإرشاد الزوار في المواقع التاريخية",
    content: {
      intro:
        "تشغيل أركان ترجمة فورية عبر مترجمين وأجهزة ذكية في المواقع التاريخية بمكة المكرمة، لمساعدة الزوار على فهم الإرشادات والإجابة عن استفساراتهم بلغاتهم، وتقليل سوء الفهم في المواقع المزدحمة.",
      goals: ["تيسير التواصل مع الزوار بلغاتهم.", "إيصال المعلومة التاريخية الموثقة.", "دعم فرق الإرشاد الميداني."],
      audience: ["زوار المواقع التاريخية.", "فرق الإرشاد الميداني."],
      means: ["أركان ثابتة في ستة مواقع.", "مترجمون لاثنتي عشرة لغة.", "أجهزة ترجمة فورية محمولة."],
      kpis: ["عدد المستفيدين: ٣٠٬٠٠٠ زائر.", "عدد اللغات المغطاة: ١٢ لغة."],
      partners: ["هيئة تطوير منطقة مكة المكرمة"],
      budget: 345000,
    },
    plan: { state: "OPENED", ageDays: 6, overdue: true },
    comments: [
      { from: "supervisor", body: "نرجو تزويدنا بقائمة المواقع المقترحة ومواقيت التشغيل." },
      { from: "officer", body: "القائمة قيد الإعداد وسنرفعها خلال يومين بإذن الله." },
    ],
  },
  {
    officer: "demo.ikram",
    track: 4,
    type: APPROVE,
    title: "تفريغ دروس المسجد النبوي وإتاحتها في مكتبة رقمية",
    content: {
      intro:
        "تفريغ الدروس العلمية المسجلة وتدقيقها علميًا ولغويًا، وفهرستها موضوعيًا، وإتاحتها في مكتبة رقمية مفتوحة قابلة للبحث، بما يحفظ هذا التراث العلمي ويسهل وصول طلاب العلم إليه.",
      goals: ["حفظ التراث العلمي للدروس.", "إتاحة المحتوى للبحث الموضوعي.", "خدمة طلاب العلم والباحثين."],
      audience: ["طلاب العلم والباحثون.", "المهتمون بالدروس العلمية."],
      means: ["فريق تفريغ وتدقيق علمي.", "فهرسة موضوعية.", "مكتبة رقمية مفتوحة."],
      kpis: ["عدد الدروس المفرغة: ١٬٢٠٠ درس.", "عدد الزيارات الشهرية: ٢٠٬٠٠٠ زيارة."],
      partners: ["الجامعة الإسلامية بالمدينة المنورة"],
      budget: 380000,
    },
    plan: { state: "RESUBMITTED", ageDays: 1, returnedReason: "يرجى توضيح آلية التدقيق العلمي والجهة المشرفة عليها." },
  },
  {
    officer: "test_assoc",
    track: 5,
    type: PERMIT,
    title: "فرق «دليل» التطوعية لإرشاد المعتمرين الجدد",
    content: {
      intro:
        "فرق تطوعية ميدانية ترافق المعتمرين الجدد في رحلتهم الأولى، وتشرح لهم خطوات النسك عمليًا، وتوجههم إلى الخدمات القريبة، مع عناية خاصة بكبار السن والقادمين دون حملات منظمة.",
      goals: ["تيسير أداء العمرة لمن يؤديها أول مرة.", "تقليل الأخطاء الشائعة في المناسك.", "توجيه المعتمرين إلى الخدمات المتاحة."],
      audience: ["المعتمرون لأول مرة.", "القادمون دون حملات منظمة."],
      means: ["فرق مرافقة ميدانية.", "مطويات مصورة."],
      kpis: ["عدد المستفيدين: ١٠٬٠٠٠ معتمر."],
      partners: ["متطوعون من الجامعات المحلية"],
      budget: 95000,
    },
    plan: { state: "RETURNED_DIRECT", ageDays: 3, reason: "تواريخ التنفيذ غير واضحة، ولم تُحدَّد أعداد المتطوعين ومواقع العمل؛ يرجى استكمالها وإعادة الإرسال." },
  },
  {
    officer: "demo.kibar",
    track: 5,
    type: ENABLERS,
    scope: [7, 11],
    title: "تدريب المتطوعين على الإسعافات الأولية لكبار السن",
    content: {
      intro:
        "برنامج تدريبي معتمد يؤهل المتطوعين لتقديم الإسعافات الأولية لكبار السن في مواقع الازدحام، ويشمل التعرف على علامات الإجهاد الحراري، والتعامل مع حالات السقوط، وآلية الاستدعاء السريع للفرق الطبية.",
      goals: ["رفع جاهزية المتطوعين للحالات الطارئة.", "تقليل زمن الاستجابة الأولية."],
      audience: ["المتطوعون في الساحات.", "كبار السن من الزوار."],
      means: ["دورات معتمدة من جهة صحية.", "محاكاة ميدانية."],
      kpis: ["عدد المتدربين: ٥٠٠ متطوع."],
      partners: ["الهلال الأحمر السعودي"],
      budget: 150000,
    },
    plan: { state: "DECIDED", ageDays: 8, recommendation: "return", recommendationReason: "يلزم إرفاق خطاب اعتماد الجهة الصحية المنفذة للتدريب.", unmet: ["responsibilities"], decision: "return", reason: "يلزم إرفاق خطاب اعتماد الجهة الصحية المنفذة للتدريب، ثم إعادة تقديم الطلب." },
  },
  {
    officer: "demo.suqya",
    track: 1,
    type: PERMIT,
    title: "حملة تسويق منتجات تذكارية داخل الساحات",
    content: {
      intro: "حملة لبيع منتجات تذكارية تحمل رسائل توعوية في ساحات المسجد الحرام خلال الموسم، بهدف توفير موارد مالية لبرامج الجمعية.",
      goals: ["توفير موارد مالية لبرامج الجمعية."],
      audience: ["الزوار والمعتمرون."],
      means: ["أكشاك بيع مؤقتة."],
      kpis: ["قيمة المبيعات المتوقعة: ٣٠٠٬٠٠٠ ريال."],
      partners: ["موردون محليون"],
      budget: 120000,
    },
    plan: { state: "REJECTED_DIRECT", ageDays: 12, reason: "النشاط تجاري ولا يدخل في اختصاص الوحدة، ولا يجوز إقامته في الساحات؛ لا يمكن قبوله." },
  },
  {
    officer: "demo.duyuf",
    track: 3,
    type: APPROVE,
    scope: [6, 4],
    title: "التطويف المركزي عبر تطبيق جوال جديد",
    content: {
      intro: "تطوير تطبيق جوال يقدم التطويف الصوتي الموجَّه للمعتمرين بلغات متعددة، مستقلًا عن المنصات القائمة، مع إرشاد خطوة بخطوة داخل صحن المطاف.",
      goals: ["تقديم التطويف الصوتي عبر الجوال.", "دعم اللغات المتعددة."],
      audience: ["المعتمرون."],
      means: ["تطبيق جوال.", "محتوى صوتي مسجل."],
      kpis: ["عدد التحميلات: ١٠٠٬٠٠٠ تحميل."],
      partners: ["شركة تقنية"],
      budget: 1250000,
    },
    plan: {
      state: "DECIDED",
      ageDays: 18,
      recommendation: "reject",
      recommendationReason: "يتكرر مع تطبيق الحرمين الشريفين القائم، ولا يضيف قيمة تبرر ميزانيته.",
      unmet: ["competence", "objectives", "impact"],
      decision: "reject",
      reason: "يتكرر الطلب مع تطبيق الحرمين الشريفين القائم، ولا تبرر قيمته المضافة الميزانية المطلوبة.",
    },
  },
  {
    officer: "test_assoc",
    track: 2,
    type: APPROVE,
    title: "مسابقة «تعظيم» القرآنية للناشئة",
    content: {
      intro: "مسابقة قرآنية سنوية للناشئة من أبناء مكة المكرمة في الحفظ والتلاوة، تقام على مراحل، وتُختتم بحفل تكريم للفائزين وأسرهم.",
      goals: ["تشجيع الناشئة على حفظ القرآن الكريم.", "إبراز المواهب القرآنية في مكة المكرمة."],
      audience: ["الناشئة من ٨ إلى ١٨ سنة."],
      means: ["تصفيات على مستوى الأحياء."],
      kpis: ["عدد المشاركين: ٢٬٠٠٠ مشارك."],
      partners: [],
      budget: 200000,
    },
    plan: { state: "DRAFT" },
  },
  {
    officer: "demo.irshad",
    track: 3,
    type: PERMIT,
    title: "لوحات إرشادية مكانية متعددة اللغات حول المنطقة المركزية",
    content: {
      intro: "تصميم لوحات إرشادية مكانية موحدة متعددة اللغات للمسارات المحيطة بالمنطقة المركزية، بالتنسيق مع الجهات المالكة للمواقع.",
      goals: ["تيسير الوصول إلى البوابات والخدمات."],
      audience: ["الزوار والمعتمرون."],
      means: ["مسح ميداني للمسارات."],
      kpis: ["عدد اللوحات: ١٥٠ لوحة."],
      partners: [],
      budget: 310000,
    },
    plan: { state: "DRAFT" },
  },
];


async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run the showcase reset with NODE_ENV=production.");
  if (process.env.CONFIRM_SHOWCASE_RESET !== "yes") throw new Error("This deletes every request. Back up, then set CONFIRM_SHOWCASE_RESET=yes.");
  const before = { users: await db.user.count(), associations: await db.association.count(), requests: await db.request.count() };

  const summary = await db.$transaction(
    async (tx) => {
      const users = new Map((await tx.user.findMany({ select: { id: true, username: true, name: true, role: true, associationId: true } })).map((u) => [u.username, u]));
      const user = (username: string) => {
        const u = users.get(username);
        if (!u) throw new Error(`Account ${username} is missing.`);
        return u;
      };
      const manager = user(MANAGER);
      const supervisor = user(SUPERVISOR);
      const statuses = Object.fromEntries((await tx.requestStatus.findMany({ select: { id: true, key: true } })).map((s) => [s.key, s.id]));
      const types = new Map((await tx.requestType.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
      const tracks = new Map((await tx.track.findMany({ where: { archivedAt: null }, select: { id: true, number: true, programs: { select: { programId: true } } } })).map((t) => [t.number, t]));

      // The reset. Requests take their history, evaluations, seals, comments and attachments with them.
      const removed = {
        notifications: (await tx.notification.deleteMany()).count,
        requests: (await tx.request.deleteMany()).count,
        registrations: (await tx.associationRegistration.deleteMany()).count,
      };
      await tx.referenceCounter.deleteMany();
      await tx.sealCounter.deleteMany();
      await tx.$executeRaw`UPDATE "associations" SET "licenseNumber" = REPLACE("licenseNumber", 'DEMO-', '40') WHERE "licenseNumber" LIKE 'DEMO-%'`;
      await tx.auditLog.create({ data: { actorId: null, action: "demo.showcase_reset", entityType: "System", after: { ...removed, created: SPECS.length } } });

      let seq = 0;
      const created: string[] = [];
      for (const spec of [...SPECS].sort((a, b) => ("ageDays" in b.plan ? b.plan.ageDays : -1) - ("ageDays" in a.plan ? a.plan.ageDays : -1))) {
        const officer = user(spec.officer);
        if (!officer.associationId) throw new Error(`${spec.officer} has no association.`);
        const track = tracks.get(spec.track);
        const requestTypeId = types.get(spec.type);
        if (!track || !requestTypeId) throw new Error(`Track or type missing for «${spec.title}».`);
        const plan = spec.plan;
        const ageDays = "ageDays" in plan ? plan.ageDays : 2;
        const submitted = plan.state === "DRAFT" ? null : new Date(daysAgo(ageDays).getTime() - (plan.state === "NEW" ? 2 : 6) * 3_600_000);

        let referenceNo: string | null = null;
        if (submitted) {
          seq += 1;
          referenceNo = formatReference(hijriYear(submitted), seq);
          const year = hijriYear(submitted);
          await tx.referenceCounter.upsert({ where: { hijriYear: year }, create: { hijriYear: year, lastSeq: seq }, update: { lastSeq: seq } });
        }

        const opened = plan.state !== "DRAFT" && plan.state !== "NEW" && submitted ? after(submitted, 2) : null;
        const request = await tx.request.create({
          data: {
            referenceNo,
            associationId: officer.associationId,
            trackId: track.id,
            requestTypeId,
            statusId: statuses.UNDER_REVIEW,
            title: spec.title,
            description: body(spec.content),
            goals: list(...spec.content.goals),
            expectedBeneficiaries: spec.content.audience.join("\n"),
            kpis: spec.content.kpis.join("\n"),
            partners: spec.content.partners.join("، ") || null,
            estimatedBudget: spec.content.budget,
            startDate: daysAhead(25 + (seq % 5) * 7),
            endDate: daysAhead(120 + (seq % 5) * 30),
            requirementsSnapshot: [],
            createdById: officer.id,
            assignedSupervisorId: submitted ? supervisor.id : null,
            reviewerOpenedAt: opened,
            submittedAt: submitted,
            slaDueAt: submitted ? addWorkingDays(submitted, SLA_WORKING_DAYS) : null,
            lastActivityAt: submitted ?? daysAgo(2),
            createdAt: submitted ? new Date(submitted.getTime() - 3 * DAY) : daysAgo(2),
            isDemo: true,
          },
        });
        const ref = { referenceNo, title: spec.title };
        const label = `${referenceNo ?? ""} — ${spec.title}`;
        let last = submitted ?? daysAgo(2);
        const notifyUser = (u: { id: string; role: string }, type: string, title: string, at: Date) =>
          tx.notification.create({ data: { userId: u.id, type, title, body: label, link: requestHref(u.role as "SUPERVISOR", request.id), requestId: request.id, createdAt: at, isDemo: true } });
        const log = (actorId: string | null, action: string, at: Date, extra: Prisma.InputJsonObject = {}) =>
          tx.auditLog.create({ data: { actorId, action, entityType: "Request", entityId: request.id, after: { ...ref, ...extra }, createdAt: at } });
        const status = (from: string, to: string, actorId: string | null, at: Date, note: string | null = null) =>
          tx.requestStatusHistory.create({ data: { requestId: request.id, fromStatusId: statuses[from], toStatusId: statuses[to], actorId, note, createdAt: at, isDemo: true } });

        if (plan.state === "DRAFT") {
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses.DRAFT } });
          await log(officer.id, "request.created", last);
          created.push(`مسودة — ${spec.title}`);
          continue;
        }

        const at0 = submitted!;
        await status("DRAFT", "SUBMITTED", officer.id, at0);
        await status("SUBMITTED", "COMPLETENESS_CHECK", null, at0);
        await tx.completenessCheck.create({ data: { requestId: request.id, passed: true, missing: [], ranBy: "RULES", createdAt: at0, isDemo: true } });
        await status("COMPLETENESS_CHECK", "UNDER_REVIEW", null, at0, "اجتاز فحص الاكتمال");
        await tx.assignmentHistory.create({ data: { requestId: request.id, toUserId: supervisor.id, createdAt: at0, isDemo: true } });
        await log(officer.id, "request.submitted", at0);

        // The supervisor classifies the request, then evaluates and sends it to the unit manager.
        const evaluate = async (recommendation: Decision, reason: string | null, note: string | null, unmet: string[], at: Date) => {
          if (spec.scope) {
            const [programNumber, initiativeNumber] = spec.scope;
            const program = await tx.program.findFirst({ where: { number: programNumber, id: { in: track.programs.map((p) => p.programId) } }, select: { id: true, number: true, name: true } });
            const initiative = program && (await tx.initiative.findFirst({ where: { programId: program.id, number: initiativeNumber, archivedAt: null }, select: { id: true, number: true, name: true } }));
            if (!program || !initiative) throw new Error(`Programme ${programNumber}/${initiativeNumber} is not on track ${spec.track} for «${spec.title}».`);
            const classified = after(at, -1);
            await tx.request.update({ where: { id: request.id }, data: { programId: program.id, initiativeId: initiative.id } });
            await tx.requestInitiative.create({ data: { requestId: request.id, initiativeId: initiative.id, sortOrder: 0 } });
            const scopeAfter = { program: { number: program.number, name: program.name }, initiatives: [{ number: initiative.number, name: initiative.name }] };
            await tx.requestScopeChange.create({ data: { requestId: request.id, actorId: supervisor.id, before: { program: null, initiatives: [] }, after: scopeAfter, createdAt: classified } });
            await log(supervisor.id, "request.scope_changed", classified, scopeAfter);
          }
          const criteria = REVIEW_CRITERIA.map((c) => ({ key: c.key, met: !unmet.includes(c.key), note: "" }));
          const evaluation = await tx.requestEvaluation.create({
            data: { requestId: request.id, reviewerId: supervisor.id, criteria, note, recommendation: RECOMMENDATION_VALUES[recommendation], reason, createdAt: at },
          });
          const seal = await createSeal(tx, { kind: "EVALUATION", requestId: request.id, signerId: supervisor.id, evaluationId: evaluation.id, at });
          await tx.request.update({ where: { id: request.id }, data: { reviewStage: "MANAGER" } });
          await log(supervisor.id, "request.evaluated", at, { seal: seal.serial, recommendation, reason, criteriaMet: criteria.filter((c) => c.met).length, criteriaTotal: criteria.length });
        };

        if (plan.state === "NEW") {
          await notifyUser(supervisor, "request.assigned", "أُسند إليك طلب للمراجعة", at0);
        } else if (plan.state === "OPENED") {
          if (plan.overdue) await tx.request.update({ where: { id: request.id }, data: { slaDueAt: daysAgo(1) } });
        } else if (plan.state === "RESUBMITTED") {
          const returned = after(at0, -30);
          const back = after(at0, 3);
          await tx.request.update({ where: { id: request.id }, data: { submittedAt: after(at0, -48), resubmittedAt: back, slaDueAt: addWorkingDays(back, SLA_WORKING_DAYS), reviewerOpenedAt: null } });
          await tx.requestStatusHistory.updateMany({ where: { requestId: request.id }, data: { createdAt: after(at0, -48) } });
          await status("UNDER_REVIEW", "RETURNED", supervisor.id, returned, plan.returnedReason);
          await status("RETURNED", "SUBMITTED", officer.id, back);
          await status("SUBMITTED", "COMPLETENESS_CHECK", null, back);
          await status("COMPLETENESS_CHECK", "UNDER_REVIEW", null, back, "اجتاز فحص الاكتمال");
          await log(officer.id, "request.resubmitted", back);
          await notifyUser(supervisor, "request.resubmitted", "أُعيد تقديم طلب بعد التعديل", back);
          last = back;
        } else if (plan.state === "RETURNED_DIRECT" || plan.state === "REJECTED_DIRECT") {
          const to = plan.state === "RETURNED_DIRECT" ? "RETURNED" : "REJECTED";
          const at = after(at0, 20);
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses[to], decidedAt: to === "REJECTED" ? at : null } });
          await status("UNDER_REVIEW", to, supervisor.id, at, plan.reason);
          await log(supervisor.id, to === "RETURNED" ? "request.returned" : "request.rejected", at, { status: to, reason: plan.reason });
          await notifyUser(officer, to === "RETURNED" ? "request.returned" : "request.rejected", to === "RETURNED" ? "أُعيد طلبكم للتعديل" : "رُفض طلبكم", at);
          last = at;
        } else if (plan.state === "WITH_MANAGER") {
          const at = after(at0, 20);
          await evaluate(plan.recommendation, plan.reason ?? null, plan.note ?? null, plan.unmet ?? [], at);
          await notifyUser(manager, "request.evaluated", `طلب بانتظار قراركم — توصية المشرف: ${RECOMMENDATION_LABELS[plan.recommendation]}`, at);
          last = at;
        } else if (plan.state === "DECIDED") {
          const evaluated = after(at0, 24);
          const decided = after(at0, 48);
          await evaluate(plan.recommendation, plan.recommendationReason ?? null, plan.note ?? null, plan.unmet ?? [], evaluated);
          const to = plan.decision === "approve" ? "APPROVED" : plan.decision === "return" ? "RETURNED" : "REJECTED";
          await tx.request.update({ where: { id: request.id }, data: { statusId: statuses[to], reviewStage: "SUPERVISOR", decidedAt: to === "RETURNED" ? null : decided } });
          await status("UNDER_REVIEW", to, manager.id, decided, plan.reason ?? null);
          if (plan.decision === "approve") {
            const approval = await tx.requestApproval.create({ data: { requestId: request.id, managerId: manager.id, createdAt: decided } });
            await createSeal(tx, { kind: "APPROVAL", requestId: request.id, signerId: manager.id, approvalId: approval.id, at: decided });
          }
          await log(manager.id, `request.${plan.decision === "approve" ? "approved" : plan.decision === "return" ? "returned" : "rejected"}`, decided, { status: to, reason: plan.reason ?? null, recommendation: RECOMMENDATION_VALUES[plan.recommendation] });
          if (ageDays <= 20) await notifyUser(officer, `request.${plan.decision === "approve" ? "approved" : plan.decision === "return" ? "returned" : "rejected"}`, plan.decision === "approve" ? "اعتُمد طلبكم" : plan.decision === "return" ? "أُعيد طلبكم للتعديل" : "رُفض طلبكم", decided);
          last = decided;
        }

        for (const [i, c] of (spec.comments ?? []).entries()) {
          const author = c.from === "officer" ? officer : c.from === "manager" ? manager : supervisor;
          const at = after(at0, 3 + i);
          await tx.comment.create({ data: { requestId: request.id, authorId: author.id, body: c.body, isInternal: Boolean(c.internal), createdAt: at, isDemo: true } });
          await log(author.id, c.internal ? "request.internal_note_added" : "request.comment_added", at);
        }

        await tx.request.update({ where: { id: request.id }, data: { lastActivityAt: last } });

        // What each person has already seen: only what is genuinely new carries «جديد».
        const seen: { userId: string; at: Date }[] = [];
        const isSettled = plan.state === "DECIDED" || plan.state === "RETURNED_DIRECT" || plan.state === "REJECTED_DIRECT";
        if (plan.state === "OPENED" || isSettled) seen.push({ userId: supervisor.id, at: after(last, 1) });
        if (plan.state === "WITH_MANAGER") seen.push({ userId: supervisor.id, at: after(last, 1) });
        if (isSettled || plan.state === "OPENED" || plan.state === "RESUBMITTED" || plan.state === "NEW") seen.push({ userId: manager.id, at: after(last, 1) });
        if ((isSettled && ageDays > 20) || plan.state === "NEW" || plan.state === "OPENED" || plan.state === "RESUBMITTED" || plan.state === "WITH_MANAGER") seen.push({ userId: officer.id, at: after(last, 1) });
        for (const s of seen) await tx.requestSeen.create({ data: { userId: s.userId, requestId: request.id, seenAt: s.at } });

        created.push(`${referenceNo} — ${plan.state} — ${spec.title}`);
      }

      // Self-check: every seal opens, and every approved document verifies as it would on the public page.
      const approvals = await tx.requestSeal.findMany({ where: { kind: "APPROVAL" } });
      for (const row of approvals) {
        const statement = openSeal(row);
        if (!statement) throw new Error(`Seal ${row.serial} does not open.`);
        const content = await contentDigest(tx, row.requestId, statement.v);
        const latest = await tx.requestEvaluation.findFirstOrThrow({ where: { requestId: row.requestId }, orderBy: { createdAt: "desc" }, select: { criteria: true, note: true } });
        if (content !== statement.content || evaluationDigest(latest) !== statement.evaluation) throw new Error(`Seal ${row.serial} does not match its request.`);
      }
      return { removed, created, sealsChecked: approvals.length, verifyCodes: approvals.map((a) => a.verifyCode) };
    },
    { timeout: 180_000, maxWait: 20_000 },
  );

  const afterCounts = { users: await db.user.count(), associations: await db.association.count(), requests: await db.request.count() };
  console.log(JSON.stringify({ before, after: afterCounts, removed: summary.removed, sealsChecked: summary.sealsChecked, verifyCodes: summary.verifyCodes }));
  for (const line of summary.created) console.log(line);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
