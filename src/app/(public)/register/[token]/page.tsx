import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Clock, LinkIcon, SearchCheck } from "lucide-react";
import { RegistrationJourney } from "@/components/registration/registration-journey";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { getPublicHome } from "@/server/services/public-site";
import { getInvitation } from "@/server/services/registrations";

export const metadata: Metadata = {
  title: "تسجيل جمعية",
  description: "استكمال بيانات الجمعية عبر رابط التسجيل الذي أصدرته الوحدة الإشرافية.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function InvitedRegistrationPage({ params }: PageProps<"/register/[token]">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="جارٍ التحميل" className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[22rem_1fr]">
          <Skeleton className="h-[34rem] rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      }
    >
      <Journey params={params} />
    </Suspense>
  );
}

async function Journey({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // The link's validity depends on the time of the request.
  await connection();
  const [invitation, home] = await Promise.all([getInvitation(token), getPublicHome()]);
  if (invitation.state !== "open") return <LinkUnusable state={invitation.state} />;
  return (
    <RegistrationJourney
      token={token}
      invite={{
        name: invitation.name,
        licenseNumber: invitation.licenseNumber,
        contactEmail: invitation.contactEmail,
        website: invitation.website,
        officerName: invitation.officerName,
        secondOfficerName: invitation.secondOfficerName,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
      }}
      vision={home.vision}
      values={home.values}
      objectives={home.objectives}
    />
  );
}

const UNUSABLE = {
  expired: { icon: Clock, title: "انتهت صلاحية رابط التسجيل", text: "مضت مدة صلاحية هذا الرابط. تواصلوا مع الوحدة الإشرافية لتمديده أو إصدار رابط جديد." },
  used: { icon: SearchCheck, title: "أُرسلت بيانات الجمعية من هذا الرابط", text: "يُستعمل الرابط مرة واحدة. تابعوا حالة طلبكم برقم الطلب ورقم الترخيص." },
  invalid: { icon: LinkIcon, title: "رابط التسجيل غير صالح", text: "تأكدوا من نسخ الرابط كاملًا كما وصلكم، أو تواصلوا مع الوحدة الإشرافية." },
} as const;

function LinkUnusable({ state }: { state: keyof typeof UNUSABLE }) {
  const s = UNUSABLE[state];
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-16 sm:px-8">
      <section className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center shadow-2">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <s.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 text-xl font-bold text-brand-ink">{s.title}</h1>
        <p className="mt-2 max-w-md leading-[1.9] text-ink-muted">{s.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/register/status" className={buttonClasses("primary", "lg")}>
            <SearchCheck aria-hidden="true" />
            متابعة طلب التسجيل
          </Link>
          <Link href="/" className={buttonClasses("outline", "lg")}>
            الصفحة الرئيسية
          </Link>
        </div>
      </section>
    </div>
  );
}
