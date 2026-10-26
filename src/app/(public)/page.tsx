import { Suspense } from "react";
import {
  HeroFigures,
  HeroFiguresSkeleton,
  HomeHero,
  InitiativeSection,
  LeadershipSection,
  ObjectivesSection,
  StrategySkeleton,
  ValuesSection,
  VisionSection,
} from "@/components/home/home-sections";
import { getPublicHome } from "@/server/services/public-site";

// Public home page (docs/ROADMAP.md Phase 5): the Presidency's strategy (vision, mission, values,
// objectives) from the database and the supervision initiative. The programmes, «كيف يعمل الإشراف
// الفني» and the closing band were removed at the owner's request (D-095).
export default function HomePage() {
  const home = getPublicHome();
  return (
    <>
      <HomeHero
        figures={
          <Suspense fallback={<HeroFiguresSkeleton />}>
            <HeroFiguresLoader home={home} />
          </Suspense>
        }
      />
      <LeadershipSection />
      <Suspense fallback={<StrategySkeleton />}>
        <StrategySections home={home} />
      </Suspense>
      <InitiativeSection />
    </>
  );
}

async function HeroFiguresLoader({ home }: { home: ReturnType<typeof getPublicHome> }) {
  return <HeroFigures home={await home} />;
}

async function StrategySections({ home }: { home: ReturnType<typeof getPublicHome> }) {
  const data = await home;
  return (
    <>
      <VisionSection home={data} />
      <ValuesSection home={data} />
      <ObjectivesSection home={data} />
    </>
  );
}
