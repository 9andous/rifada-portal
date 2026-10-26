import { Suspense } from "react";
import {
  ClosingCta,
  HeroFigures,
  HeroFiguresSkeleton,
  HomeHero,
  HowSection,
  InitiativeSection,
  LeadershipSection,
  ObjectivesSection,
  ProgramsSection,
  StrategySkeleton,
  ValuesSection,
  VisionSection,
} from "@/components/home/home-sections";
import { getPublicHome } from "@/server/services/public-site";

// Public home page (docs/ROADMAP.md Phase 5): the Presidency's strategy (vision, mission, values,
// objectives, programmes) from the database, the supervision initiative, and the login entry.
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
      <HowSection />
      <ClosingCta />
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
      <ProgramsSection home={data} />
    </>
  );
}
