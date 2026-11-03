import { Suspense } from "react";
import {
  HeroQuotesPanel,
  HeroQuotesSkeleton,
  HomeHero,
  InitiativeSection,
  StrategySkeleton,
  ValuesSection,
  VisionSection,
} from "@/components/home/home-sections";
import { getHeroQuotes, getPublicHome } from "@/server/services/public-site";

// Public home page (docs/ROADMAP.md Phase 5): the Presidency's strategy (vision, mission, values)
// from the database and the supervision initiative. The programmes, «كيف يعمل الإشراف الفني» and the
// closing band were removed at the owner's request (D-095); the strategic objectives section is
// hidden at the owner's request (D-098; `ObjectivesSection` is kept for when it returns), and so are
// the hero's figures (2026-10-28; `HeroFigures` is kept).
export default function HomePage() {
  const home = getPublicHome();
  return (
    <>
      <HomeHero
        quotes={
          <Suspense fallback={<HeroQuotesSkeleton />}>
            <HeroQuotesLoader />
          </Suspense>
        }
      />
      <Suspense fallback={<StrategySkeleton />}>
        <StrategySections home={home} />
      </Suspense>
      <InitiativeSection />
    </>
  );
}

async function HeroQuotesLoader() {
  const { slides, style } = await getHeroQuotes();
  return <HeroQuotesPanel slides={slides} style={style} />;
}

async function StrategySections({ home }: { home: ReturnType<typeof getPublicHome> }) {
  const data = await home;
  return (
    <>
      <VisionSection home={data} />
      <ValuesSection home={data} />
    </>
  );
}
