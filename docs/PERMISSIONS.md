# Permission matrix

> Generated from `src/server/authz/permissions.ts` by `npm run docs:permissions`. Do not edit by hand.

Every rule is enforced on the server. Three layers apply to each request:

1. **Proxy** (`src/proxy.ts`): signed-out visitors are sent to the login page; a role opening another
   role's area (`/admin`, `/manager`, `/supervisor`, `/association`) gets HTTP 403; accounts with a
   pending first-login password change are sent to `/account/change-password`.
2. **Area layouts** re-check the role and render the permission-denied state.
3. **Data access**: every query of scoped data uses the scopers in `src/server/authz/scope.ts`, and every
   server action and route handler checks `can()` before acting.

Scopes: **all** = every record; **own programs** = records in programs assigned to the supervisor;
**own association** = records of the officer's association; **—** = denied.

| Action | Description | SUPER_ADMIN (مدير النظام) | UNIT_MANAGER (مدير الوحدة) | SUPERVISOR (مشرف) | ASSOCIATION_OFFICER (مسؤول الجمعية) |
|---|---|---|---|---|---|
| `admin.access` | فتح منطقة إدارة النظام | all | — | — | — |
| `users.manage` | إنشاء المستخدمين وتعديلهم وتعطيلهم | all | — | — | — |
| `associations.manage` | إنشاء الجمعيات وحساباتها وتعديلها واستيرادها | all | — | — | — |
| `associations.read` | عرض بيانات الجمعيات | all | all | own programs | own association |
| `taxonomy.manage` | تعديل البرامج والمبادرات والأهداف ومتطلبات المبادرات وأنواع المرفقات | all | — | — | — |
| `taxonomy.read` | عرض البرامج والمبادرات والأهداف | all | all | all | all |
| `settings.manage` | تعديل إعدادات النظام وحالات الطلبات ووضع العرض التجريبي | all | — | — | — |
| `statuses.read` | عرض حالات الطلبات وانتقالاتها ودورة حياة الطلب | all | all | — | — |
| `templates.read` | عرض النماذج المنشورة وتنزيلها | all | all | all | all |
| `audit.read` | عرض سجل التدقيق | all | — | — | — |
| `content.manage` | إدارة الإعلانات والأدلة والنماذج | all | — | — | — |
| `requests.read` | عرض الطلبات وتفاصيلها | all | all | own programs | own association |
| `requests.create` | إنشاء طلب جديد وحفظه كمسودة | — | — | — | own association |
| `requests.editDraft` | تعديل المسودة أو الطلب المعاد للتعديل وتقديمه | — | — | — | own association |
| `requests.review` | إعادة الطلب للتعديل أو اعتماده أو رفضه | — | all | own programs | — |
| `requests.auditTrail` | عرض سجل الاطلاع والتدقيق في صفحة الطلب | all | all | — | — |
| `requests.assign` | إسناد الطلب إلى مشرف أو إعادة إسناده | — | all | — | — |
| `comments.write` | إضافة تعليق على الطلب | — | all | own programs | own association |
| `comments.readInternal` | قراءة الملاحظات الداخلية للفريق الإشرافي | all | all | own programs | — |
| `comments.writeInternal` | إضافة ملاحظة داخلية لا تظهر للجمعية | — | all | own programs | — |
| `attachments.read` | تنزيل مرفقات الطلب | all | all | own programs | own association |
| `attachments.upload` | رفع مرفق أو إصدار جديد منه | — | all | own programs | own association |
| `reports.read` | عرض التقارير وتصديرها | all | all | own programs | own association |
| `dashboard.management` | لوحات المؤشرات الإدارية الشاملة | all | all | — | — |

## Rules worth calling out

- Association officers never see internal notes (`comments.isInternal`). They are filtered in
  `scopeComments()`, which every comment reader uses, including lists, exports, print views and PDFs.
- A supervisor with no assigned programs sees no requests at all.
- An officer account is bound to exactly one association; it sees only that association's records.
- The super admin administers the system but does not take part in request review.
- Deactivated accounts cannot sign in by any method, and their open sessions stop working.
