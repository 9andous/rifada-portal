import Link from "next/link";
import { BookOpen, Download, FileStack, FilePen, Paperclip, Search, X } from "lucide-react";
import { EmptyState } from "@/components/states/states";
import { buttonClasses } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { TabNav } from "@/components/ui/tab-nav";
import { cn } from "@/lib/cn";
import { formatFileSize, formatHijri, formatNumber, toArabicDigits } from "@/lib/format";
import { firstParam, type SearchParams } from "@/lib/list-params";
import { FILE_TYPES, type AllowedExtension } from "@/lib/uploads";
import { TEMPLATE_KIND_LABEL, type TemplateKindKey } from "@/lib/validation/templates";
import type { Actor } from "@/server/authz/scope";
import { readerTemplateFilters, readerTemplates, type ReaderTemplate } from "@/server/services/admin/templates";
import { downloadHref } from "./templates-list";

const KIND_KEYS = { guides: "GUIDE", forms: "FORM" } as const satisfies Record<string, TemplateKindKey>;
type KindParam = keyof typeof KIND_KEYS;

/** The file's kind as a coloured tag: PDF red, Word blue, Excel green, images grey. */
function FileTag({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() as AllowedExtension | undefined;
  const type = ext && ext in FILE_TYPES ? FILE_TYPES[ext] : null;
  const tone =
    type?.group === "pdf" ? "bg-st-bad-soft text-st-bad" : type?.group === "word" ? "bg-st-info-soft text-st-info" : type?.group === "excel" ? "bg-st-ok-soft text-st-ok" : "bg-surface-sunken text-ink-muted";
  return (
    <span aria-hidden="true" className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold", tone)} dir="ltr">
      {type?.label ?? "ملف"}
    </span>
  );
}

/** «دليل» in blue with a book, «نموذج» in gold with a pen: the first thing read on a card. */
function KindPill({ kind }: { kind: TemplateKindKey }) {
  const Icon = kind === "GUIDE" ? BookOpen : FilePen;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold", kind === "GUIDE" ? "bg-st-info-soft text-st-info" : "bg-accent-soft text-accent-ink")}>
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {TEMPLATE_KIND_LABEL[kind]}
    </span>
  );
}

function TemplateCard({ t }: { t: ReaderTemplate }) {
  return (
    <li className="flex flex-col rounded-lg border border-line bg-surface shadow-1 transition-shadow hover:shadow-2">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <FileTag fileName={t.fileName} />
          <div className="min-w-0 flex-1">
            <KindPill kind={t.kind} />
            <h4 className="mt-1.5 text-base font-bold leading-snug text-ink">{t.title}</h4>
          </div>
        </div>
        {t.description ? <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{t.description}</p> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-subtle">البرنامج</dt>
          <dd className="text-ink">{t.program ? t.program.name : "جميع البرامج"}</dd>
          {t.initiative ? (
            <>
              <dt className="text-ink-subtle">المبادرة</dt>
              <dd className="text-ink">
                {toArabicDigits(t.initiative.number)}. {t.initiative.name}
              </dd>
            </>
          ) : null}
        </dl>
        {t.kind === "FORM" && t.attachmentType ? (
          <p className="mt-auto flex items-start gap-2 rounded-md bg-primary-soft/50 px-3 py-2 text-sm text-ink">
            <Paperclip aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
            <span>
              بعد تعبئته أرفقوه في الطلب باسم <b className="font-bold">«{t.attachmentType.name}»</b>
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="t-caption">
          {formatFileSize(t.size)} · آخر تحديث {formatHijri(t.updatedAt)}
        </span>
        {/* A plain link: the route handler sends the file as an attachment. */}
        <a href={downloadHref(t.id)} className={buttonClasses("gold", "md")} aria-label={`تنزيل ${TEMPLATE_KIND_LABEL[t.kind]} «${t.title}»`}>
          <Download aria-hidden="true" strokeWidth={1.75} />
          تنزيل
        </a>
      </div>
    </li>
  );
}

/**
 * «الأدلة والنماذج» for every reader (D-113): guides and forms as cards grouped by programme, with
 * the kind as tabs and the programme and words as one search form. Published templates only.
 */
export async function TemplatesLibrary({ actor, searchParams, path }: { actor: Actor; searchParams: Promise<SearchParams>; path: string }) {
  const params = await searchParams;
  const kindParam = firstParam(params, "kind");
  const kindKey = kindParam && kindParam in KIND_KEYS ? (kindParam as KindParam) : undefined;
  const kind = kindKey ? KIND_KEYS[kindKey] : undefined;
  const program = firstParam(params, "program") || undefined;
  const q = firstParam(params, "q")?.trim() || undefined;
  const [filters, items] = await Promise.all([readerTemplateFilters(actor, kind), readerTemplates(actor, { kind, program, q })]);

  const href = (next: { kind?: KindParam; program?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (next.kind) search.set("kind", next.kind);
    if (next.program) search.set("program", next.program);
    if (next.q) search.set("q", next.q);
    const s = search.toString();
    return s ? `${path}?${s}` : path;
  };

  if (filters.all === 0) {
    return <EmptyState icon={<FileStack strokeWidth={1.75} />} title="لا توجد أدلة أو نماذج منشورة بعد" description="تظهر هنا الأدلة والنماذج التي تنشرها الوحدة الإشرافية لتنزيلها." />;
  }

  const programChoices = [
    ...(filters.general ? [{ value: "general", label: "عامة لجميع البرامج", count: filters.general }] : []),
    ...filters.programs.map((p) => ({ value: p.id, label: `${toArabicDigits(p.number)}. ${p.name}`, count: p.count })),
  ];
  const programLabel = programChoices.find((c) => c.value === program)?.label;
  const filtered = Boolean(program || q);

  // Grouped under the programme's name: the general ones first, then the programmes in order;
  // inside a group, guides before forms.
  const sorted = [...items].sort(
    (x, y) => (x.program?.number ?? 0) - (y.program?.number ?? 0) || x.kind.localeCompare(y.kind) || x.title.localeCompare(y.title, "ar"),
  );
  const groups: { key: string; title: string; items: ReaderTemplate[] }[] = [];
  for (const t of sorted) {
    const key = t.program?.id ?? "general";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, title: t.program ? `${toArabicDigits(t.program.number)}. ${t.program.name}` : "عامة لجميع البرامج", items: [] };
      groups.push(group);
    }
    group.items.push(t);
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <TabNav
          label="نوع الملفات"
          active={kindKey ?? "all"}
          items={[
            { key: "all", label: "الكل", href: href({ program, q }), count: formatNumber(filters.all) },
            { key: "guides", label: "الأدلة", href: href({ kind: "guides", program, q }), count: formatNumber(filters.guides) },
            { key: "forms", label: "النماذج", href: href({ kind: "forms", program, q }), count: formatNumber(filters.forms) },
          ]}
        />
        <form action={path} role="search" className="flex flex-wrap items-end gap-3 px-5 py-5 sm:px-6">
          {kindKey ? <input type="hidden" name="kind" value={kindKey} /> : null}
          <label htmlFor="tpl-program" className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
            <span className="text-[0.9375rem] font-semibold text-ink">البرنامج</span>
            <select
              id="tpl-program"
              name="program"
              defaultValue={program ?? ""}
              className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
            >
              <option value="">جميع البرامج ({formatNumber(filters.total)})</option>
              {programChoices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} ({formatNumber(c.count)})
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="tpl-q" className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5">
            <span className="text-[0.9375rem] font-semibold text-ink">البحث بالاسم أو الوصف</span>
            <input
              id="tpl-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="مثال: خطة البرنامج"
              className="h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
            />
          </label>
          <button type="submit" className={buttonClasses("primary")}>
            <Search aria-hidden="true" strokeWidth={1.75} />
            عرض النتائج
          </button>
          {filtered ? (
            <Link href={href({ kind: kindKey })} className={buttonClasses("ghost")}>
              <X aria-hidden="true" strokeWidth={1.75} />
              مسح التصفية
            </Link>
          ) : null}
        </form>
      </Panel>

      <p className="text-[0.9375rem] text-ink-muted" role="status">
        {items.length === 0 ? "لا نتائج" : `عدد النتائج: ${formatNumber(items.length)}`}
        {kind ? ` · ${kind === "GUIDE" ? "الأدلة" : "النماذج"}` : ""}
        {programLabel ? ` · ${programLabel}` : ""}
        {q ? ` · البحث: «${q}»` : ""}
      </p>

      {items.length === 0 ? (
        <Panel>
          <EmptyState variant="inline" title="لا توجد ملفات مطابقة" description="جرّبوا كلمة أخرى، أو اختاروا «جميع البرامج»، أو اضغطوا «مسح التصفية»." />
        </Panel>
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <h3 id={`grp-${g.key}`} className="mb-3 flex items-center gap-2 text-lg font-bold text-brand-ink">
              {g.title}
              <span className="t-figure rounded-full bg-surface-sunken px-2 text-sm font-medium text-ink-muted">{formatNumber(g.items.length)}</span>
            </h3>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {g.items.map((t) => (
                <TemplateCard key={t.id} t={t} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
