import type { Metadata } from "next";
import { Suspense } from "react";
import { RegistrationJourney } from "@/components/registration/registration-journey";
import { Skeleton } from "@/components/ui/surface";
import { getPublicHome } from "@/server/services/public-site";

export const metadata: Metadata = {
  title: "تسجيل جمعية",
  description: "انضموا إلى منصة رفادة: سجّلوا جمعيتكم لتقديم برامجها ومشروعاتها في خدمة قاصدي الحرمين الشريفين.",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="جارٍ التحميل" className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 py-10 sm:px-8 lg:grid-cols-[22rem_1fr]">
          <Skeleton className="h-[34rem] rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      }
    >
      <Journey />
    </Suspense>
  );
}

async function Journey() {
  const home = await getPublicHome();
  return (
    <RegistrationJourney
      vision={home.vision}
      programs={home.programs}
      values={home.values}
      objectives={home.objectives}
    />
  );
}
