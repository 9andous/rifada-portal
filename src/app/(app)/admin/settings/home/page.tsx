import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Quote } from "lucide-react";
import { HeroQuoteStyleForm, HomeQuoteRowActions, NewHomeQuoteButton } from "@/components/admin/home-quote-controls";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { PageBody } from "@/components/layout/app-shell";
import { PageBand } from "@/components/layout/page-band";
import { ForbiddenPage } from "@/components/states/forbidden-page";
import { EmptyState } from "@/components/states/states";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelHeader, StatusText } from "@/components/ui/surface";
import { DataTable, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatNumber, toArabicDigits } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/permissions";
import { listHomeQuotes } from "@/server/services/admin/home-quotes";
import { HERO_QUOTE_STYLES, SETTING_DEFAULTS } from "@/server/settings/defaults";
import { getSetting } from "@/server/settings/read";

export const metadata: Metadata = { title: "كلمات الصفحة الرئيسية" };

export default async function HomeQuotesPage() {
  const user = await requireUser();
  if (!can(user.role, "content.manage")) return <ForbiddenPage />;
  const [quotes, storedStyle] = await Promise.all([listHomeQuotes(user), getSetting("public.heroQuoteStyle")]);
  const style = (HERO_QUOTE_STYLES as readonly string[]).includes(storedStyle) ? storedStyle : SETTING_DEFAULTS["public.heroQuoteStyle"];
  const shown = quotes.filter((q) => q.isActive).length;

  return (
    <>
      <PageBand
        compact
        title="الإعدادات"
        lead="كلمات القيادة التي تتعاقب في أعلى الصفحة الرئيسية، كل كلمة بصورتها. يُسجَّل كل تغيير في سجل التدقيق."
        actions={<NewHomeQuoteButton />}
      />
      <PageBody className="flex flex-col gap-5">
        <SettingsTabs active="home" />

        <Panel>
          <PanelHeader
            title="الكلمات"
            description={`المعروضة: ${formatNumber(shown)} من ${formatNumber(quotes.length)}، بالترتيب أدناه، وتتبدّل كل سبع ثوانٍ.`}
            actions={
              <Link href="/#leadership" target="_blank" className={buttonClasses("outline", "sm")}>
                <ExternalLink aria-hidden="true" />
                عرض الصفحة الرئيسية
              </Link>
            }
          />
          {quotes.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<Quote strokeWidth={1.75} />}
              title="لا توجد كلمات بعد"
              description="أضف كلمة من الزر أعلى الصفحة. حتى ذلك الحين تظهر صورة الكعبة المشرفة في مكانها."
            />
          ) : (
            <DataTable caption="كلمات الصفحة الرئيسية" minWidth="52rem">
              <THead>
                <Th className="w-14 ps-6">الترتيب</Th>
                <Th>صاحب الكلمة</Th>
                <Th>الكلمة</Th>
                <Th className="w-28">الحالة</Th>
                <Th className="w-44 pe-6">
                  <span className="sr-only">إجراءات</span>
                </Th>
              </THead>
              <tbody>
                {quotes.map((q, i) => (
                  <Tr key={q.id} className={q.isActive ? undefined : "text-ink-subtle"}>
                    <Td className="t-figure ps-6 text-center">{toArabicDigits(i + 1)}</Td>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={q.name} src={q.image} className="size-11 rounded-full" />
                        <span className="min-w-0">
                          {q.honorific ? <span className="t-caption block">{q.honorific}</span> : null}
                          <span className="block font-semibold">{q.name}</span>
                          {q.title ? <span className="t-caption block">{q.title}</span> : null}
                        </span>
                      </span>
                    </Td>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 text-sm leading-relaxed">{q.quote}</p>
                    </Td>
                    <Td>
                      <StatusText tone={q.isActive ? "ok" : "neutral"}>{q.isActive ? "معروضة" : "مخفية"}</StatusText>
                    </Td>
                    <Td className="pe-6">
                      <HomeQuoteRowActions q={q} first={i === 0} last={i === quotes.length - 1} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="شكل الكلمات" description="كيف تظهر الكلمات على الخلفية الخضراء في أعلى الصفحة الرئيسية." />
          <HeroQuoteStyleForm current={style} />
        </Panel>
      </PageBody>
    </>
  );
}
