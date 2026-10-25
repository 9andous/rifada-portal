# Arabic copy for review

Wording I would like a native government-style review on. Grouped by screen. Change freely; tell me
which strings to replace.

## Login

| Where | Current text | Note |
|---|---|---|
| Login subtitle | ادخل بحسابك لمتابعة طلباتك ومهامك. | Shortened to fit one line (was «ادخل بحسابك في المنصة لمتابعة الطلبات والمهام الخاصة بك.»). |
| Mock Nafath notice | هذا الدخول محاكاة لخدمة النفاذ الوطني الموحد لأغراض التطوير والعرض، ولا يتصل بالخدمة الفعلية. | Must remain visible until real Nafath is integrated. |
| Mock approve button | محاكاة الموافقة في التطبيق | |
| Rate-limit error | تجاوزت عدد المحاولات المسموح بها. انتظر دقيقة ثم حاول مرة أخرى. | |
| Disabled account | لا يمكن الدخول بهذا الحساب حاليًا. تواصل مع مدير النظام. | |

## Passwords

| Where | Current text | Note |
|---|---|---|
| Forgot-password result | إن كان اسم المستخدم مسجلًا ولديه بريد إلكتروني معتمد فستصله رسالة تتضمن رابط إعادة التعيين خلال دقائق. | Deliberately the same whether or not the account exists. |
| First-login notice | لحماية حسابك، يلزم تعيين كلمة مرور جديدة خاصة بك عند الدخول الأول. | |
| Password hint | عشرة أحرف على الأقل، تتضمن حرفًا لاتينيًا ورقمًا. | |

## Dashboards and states

| Where | Current text | Note |
|---|---|---|
| Association empty state | لم تقدّموا أي طلب بعد | Plural of respect for associations. |
| Supervisor without programs | لم تُسند إليك برامج بعد | |
| Permission denied | لا تملك صلاحية الوصول إلى هذه الصفحة | |
| Home hero line | منصة موحّدة لتقديم برامج الجمعيات ومشروعاتها ضمن برامج الرئاسة، ومراجعتها ومتابعتها بإجراءات واضحة وموثّقة. | Foundation version; Phase 5 revisits. |

## Status names (seeded, editable by admin)

مسودة · مقدَّم · فحص الاكتمال · قيد المراجعة · معاد للتعديل · معتمد · مرفوض

## Taxonomy source wording (Phase 1b)

Kept exactly as in the strategy outline (private PDF) because they are not spacing typos. Tell me which to
change; Phase 2 will also let the super admin edit them.

| Where | Current text | Note |
|---|---|---|
| Program 2, initiative 5 | الدورات العلمية: | Trailing colon in the source. |
| Program 2, initiative 10 | تعليم اللغة العربية للناطقين بغيرها داخل المسجد الحرام والمسجد النبوي. | Trailing full stop. |
| Program 2, initiative 16 | غرس القيمية للأطفال | Possibly «غرس القيم للأطفال». |
| Program 4, initiatives 2 and 9 | …إجابة السائلين. / …وهيئة كبار العلماء. | Trailing full stops. |
| Program 4, initiative 7 | محادثة (شات) بالذكاء الاصطناعي Ai Generate: | Trailing colon; Latin «Ai Generate». |
| Program 4, initiative 11 | دليل المراكز استشارية يحال إليها السائلون | Possibly «المراكز الاستشارية». |
| Program 4, initiative 15 | مستشارين متخصصين في الجوانب… | Possibly «مستشارون متخصصون». |
| Program 5, initiative 3 | …وتأهيل المتسابقين للمسابقات القرآنية. | Trailing full stop. |
| Program 5, initiative 12 | حلقات الفاتحة في المسجد الحرام ساحاته | Possibly «وساحاته». |
| Program 6, initiative 5 | "تواصل" الموسم الثاني | Straight quotes; «تواصل» guillemets may read better. |

## Administration (Phase 2a, stop 1)

| Where | Current text | Note |
|---|---|---|
| One-time password notice | انسخ كلمة المرور المؤقتة الآن وسلّمها لصاحب الحساب بطريقة آمنة. لن تظهر مرة أخرى، ولا تُحفظ في النظام إلا بصيغة مشفرة. | «مشفرة» is used loosely for a one-way hash; «مُعمّاة» is more exact but less familiar. |
| Reset confirmation | ستُستبدل كلمة مرور «الاسم» بكلمة مؤقتة تظهر لك مرة واحدة، وتُنهى جميع جلساته، ويُطلب منه تعيين كلمة جديدة عند الدخول. | Masculine for the account holder; a neutral wording may be preferred. |
| Last super admin | هذا آخر حساب نشط بدور مدير النظام؛ أنشئ حساب مدير نظام آخر أو فعّله قبل هذا التغيير. | |
| Officer role change | لا يمكن تحويل حساب مسؤول جمعية إلى دور آخر أو العكس؛ عطّل الحساب وأنشئ حسابًا جديدًا بالدور المطلوب. | |
| Association deactivation | ستُعطَّل «الاسم». ويُعطَّل معها حساب مسؤولها وتُنهى جلساته فورًا، فلا يتمكن من تسجيل الدخول. | |
| Settings hints | بأيام العمل: رقم صحيح من ١ إلى ٦٠. | Units after figures use `countUnit` (يوم عمل / يوما عمل / أيام عمل). |
| Audit filter | النظام (دون منفّذ) | For entries without an actor (for example password reset requests). |

## Placeholder names to confirm with the Presidency

Seeded attachment types (`prisma/seed/attachment-types.json`); the super admin can rename them in
«أنواع المرفقات» (keys stay).

| Key | Name |
|---|---|
| `program_plan` | خطة البرنامج |
| `request_letter` | خطاب الطلب الرسمي |
| `trainer_cvs` | السير الذاتية للمدربين والمعلمين |
| `execution_timeline` | الجدول الزمني للتنفيذ |
| `supporting_documents` | مستندات داعمة |

## Taxonomy editors (Phase 2b, stop 1)

| Where | Current text | Note |
|---|---|---|
| States | نشط / موقوف / مؤرشف (برنامج)، نشطة / موقوفة / مؤرشفة (مبادرة) | «موقوف» means no new requests; «مؤرشف» means retired and hidden. |
| Pause dialog (program) | ستُخفى معه مبادراته (٣) من نموذج الطلب والصفحات العامة دون تغيير حالتها، وتعود بعودته. | |
| Wording panel | صياغات بانتظار مراجعتكم | Plural of respect for the owner. |
| Matrix hint | علامة الصح في الخانة تعني ارتباط المبادرة بالهدف. | |
| Copy dialog | ستصبح متطلبات كل مبادرة مختارة مطابقة لها تمامًا، وتُحذف متطلباتها الحالية التي لا توجد هنا. | |
| Requirement key hint | معرّف ثابت بأحرف لاتينية صغيرة وأرقام و _، مثل trainees_count. لا يمكن تغييره بعد الحفظ. | |
| Field types | نص قصير، نص طويل، رقم، تاريخ، قائمة اختيار | |

## Statuses and templates (Phase 2b, stop 2)

| Where | Current text | Note |
|---|---|---|
| Transition roles note | الأدوار المذكورة لا تعمل إلا على الطلبات الواقعة في نطاقها: المشرف على طلبات البرامج المسندة إليه فقط، ومسؤول الجمعية على طلبات جمعيته فقط، ومدير الوحدة على جميع الطلبات. | Owner's requested note. |
| Automatic transition | تلقائي — ينفذه النظام | |
| Status kinds | نهائية / مرحلية | «مرحلية» for non-terminal statuses; «وسيطة» is an alternative. |
| Colour names | رمادي، أزرق، بنفسجي، كهرماني، أخضر، أحمر | |
| Template states | منشور / غير منشور / مؤرشف | |
| Upload errors | محتوى الملف لا يطابق امتداده؛ تأكد من أن الملف سليم وغير معاد التسمية. | |
| Expired or foreign upload | الملف المرفوع غير متاح؛ ارفعه مرة أخرى. | Deliberately the same for every case. |
| Officer documents lead | النماذج التي تنشرها الوحدة الإشرافية لتنزيلها وتعبئتها وإرفاقها بطلباتكم. | Plural of respect. |
| File picker | اختيار ملف / لم يُختر ملف | Replaces the browser's own button text, which follows the browser language. |
| Allowed file types | PDF، Word (docx)، Excel (xlsx)، الصور (PNG، JPEG، WebP)؛ حتى ٢٥ ميغابايت. | Lists use the Arabic comma only: a «و» glued to a Latin name renders on the wrong side. |
| Identical replacement | الملف الجديد مطابق تمامًا للإصدار الحالي، فلم يُنشأ إصدار جديد. اختر ملفًا مختلفًا. | |
| Empty templates list (admin) | لا توجد نماذج بعد — أضف أول نموذج ثم انشره ليظهر للجمعيات والفريق. | Button «نموذج جديد». |

## Requests (Phase 3)

| Where | Current text | Note |
|---|---|---|
| Blocked submission | لم يُقدَّم الطلب لأن بعض البيانات أو المرفقات ناقصة: | Followed by the precise list. |
| Missing items | الحقل «…» مطلوب. / المرفق «…» مطلوب: أرفق ملفًا واحدًا على الأقل. / قيمة الحقل «…» ليست من الخيارات المتاحة. | |
| Dates | تاريخ البداية يجب أن يكون اليوم أو بعده. / تاريخ النهاية يجب ألا يسبق تاريخ البداية. / مدة التنفيذ تزيد على خمس سنوات؛ تحقق من التاريخين. | |
| Unavailable | المبادرة «…» موقوفة أو مؤرشفة حاليًا، فلا تُقبل عليها طلبات جديدة. | |
| Already submitted | قُدِّم هذا الطلب مسبقًا، فلا يمكن تقديمه مرة أخرى الآن. | Second click. |
| Draft notice (officer) | هذه مسودة لم تُقدَّم بعد — لا تطّلع الوحدة الإشرافية على المسودة حتى تقدّموها. | Plural of respect. |
| Returned notice (staff) | قيد التعديل لدى الجمعية — قد يتغير محتوى الطلب قبل إعادة التقديم | Owner's wording (D-078). |
| Internal note label | ملاحظة داخلية — للفريق فقط | From DESIGN.md. |
| Decision effects | يُعتمد الطلب وتُبلَّغ الجمعية، ولا يمكن التراجع عن الاعتماد. / يعود الطلب إلى الجمعية لتعديله، ويُرسل إليها السبب، وتُستأنف المهلة عند إعادة التقديم. | |
| Skipped reasons | الطلب ليس قيد المراجعة. / الطلب غير مسند إليك؛ يقرر فيه المشرف المسند إليه أو مدير الوحدة. / الطلب غير متاح لك. / تغيّرت حالة الطلب قبل تنفيذ الإجراء. | |
| Selection count | «طلبان محددة»، «٣ طلبات محددة» | Agreement with «طلبان» may need «محددان»; review. |
| SLA phrases | يتبقى ٧ أيام عمل / متأخر يومي عمل / متوقفة بانتظار تعديل الجمعية / انتهت بالقرار | |
| Notifications | أُسند إليك طلب للمراجعة، طلب بلا مشرف متاح، أُعيد إسناد طلب كان لديك، اعتُمد طلبكم، أُعيد طلبكم للتعديل، رُفض طلبكم، أُعيد تقديم طلب بعد التعديل، تعليق جديد من الجمعية، تعليق جديد على الطلب، ملاحظة داخلية جديدة | Titles of Notification rows (shown in Phase 4). |
| Storage quota | تجاوز هذا الملف حد التخزين المخصص للجمعية (المستخدم … من …). تواصلوا مع إدارة المنصة. | |
| Audit trail heading | سجل الاطلاع والتدقيق | Super admin and unit manager only. |
