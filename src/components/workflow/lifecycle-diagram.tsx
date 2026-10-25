import type { Role } from "@/generated/prisma/client";
import type { StatusTone } from "@/components/ui/surface";
import { cn } from "@/lib/cn";

// Read-only picture of the request lifecycle (colours from the raw tokens in src/styles/tokens.css:
// the Tailwind theme is `@theme inline`, so `--color-*` variables do not exist at runtime) (Phase 2b stop 2). The seven statuses are fixed
// (D-060), so their places are fixed too: the main path runs from the start edge (right, RTL) to the
// two terminal statuses; «معاد للتعديل» sits under «قيد المراجعة». Automatic transitions are drawn
// thinner and lighter (DESIGN.md forbids dashed lines). The SVG is decorative for assistive
// technology; the transitions table beside it carries the same information.

type Node = { id: string; key: string; name: string; tone: StatusTone; isTerminal: boolean };
type Edge = { id: string; fromStatusId: string; toStatusId: string; allowedRoles: Role[]; isAutomatic: boolean };

const W = 1100;
const H = 320;
const NODE_W = 150;
const NODE_H = 46;

// Centres for the fixed keys (x decreases along the flow: right-to-left reading order). The 70px
// gaps on the main row leave room for an edge label between two boxes.
const PLACES: Record<string, [number, number]> = {
  DRAFT: [1010, 130],
  SUBMITTED: [790, 130],
  COMPLETENESS_CHECK: [570, 130],
  UNDER_REVIEW: [350, 130],
  APPROVED: [85, 45],
  REJECTED: [85, 215],
  RETURNED: [350, 275],
};

const ROLE_SHORT: Partial<Record<Role, string>> = { ASSOCIATION_OFFICER: "الجمعية", SUPERVISOR: "المشرف", UNIT_MANAGER: "مدير الوحدة" };

function place(node: Node, index: number): [number, number] {
  return PLACES[node.key] ?? [1010 - (index % 5) * 220, 40 + Math.floor(index / 5) * 110];
}

type DrawnEdge = { id: string; d: string; automatic: boolean; label: string; lx: number; ly: number };

/** The point where the segment from the node's centre towards (tx, ty) leaves its rectangle. */
function edgePoint([cx, cy]: [number, number], [tx, ty]: [number, number]): [number, number] {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const scale = Math.min(Math.abs(NODE_W / 2 / (dx || 1e-9)), Math.abs(NODE_H / 2 / (dy || 1e-9)));
  return [cx + dx * scale, cy + dy * scale];
}

export function LifecycleDiagram({ statuses, transitions, className }: { statuses: Node[]; transitions: Edge[]; className?: string }) {
  const centres = new Map(statuses.map((s, i) => [s.id, place(s, i)]));
  const pairs = new Set(transitions.map((t) => `${t.fromStatusId}>${t.toStatusId}`));

  const edges: DrawnEdge[] = transitions.flatMap((t) => {
    const from = centres.get(t.fromStatusId);
    const to = centres.get(t.toStatusId);
    if (!from || !to) return [];
    // Bend an edge when the opposite edge exists; an edge that jumps over a node on the same row arcs
    // from the top of one box to the top of the other, clear of the labels between them.
    const reverse = pairs.has(`${t.toStatusId}>${t.fromStatusId}`);
    const jumps = from[1] === to[1] && Math.abs(from[0] - to[0]) > 250;
    const [x1, y1] = jumps ? [from[0], from[1] - NODE_H / 2] : edgePoint(from, to);
    const [x2, y2] = jumps ? [to[0], to[1] - NODE_H / 2] : edgePoint(to, from);
    const bend = jumps ? -60 : reverse ? 22 : 0;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const cx = mx + (-(y2 - y1) / len) * bend;
    const cy = my + ((x2 - x1) / len) * bend;
    // A label sits above its line, except on a downward diagonal, where above would meet the box it leaves.
    const downward = to[1] > from[1] && from[0] !== to[0];
    return [
      {
        id: t.id,
        d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
        automatic: t.isAutomatic,
        label: t.isAutomatic ? "تلقائي" : t.allowedRoles.map((r) => ROLE_SHORT[r] ?? r).join("، "),
        lx: bend ? (mx + cx) / 2 : mx,
        ly: (bend ? (my + cy) / 2 : my) + (downward ? 16 : -6),
      },
    ];
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" className={cn("h-auto w-full", className)} style={{ fontFamily: "inherit", direction: "rtl" }}>
      <defs>
        <marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--ink-muted)" }} />
        </marker>
        <marker id="lc-arrow-auto" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--line-strong)" }} />
        </marker>
      </defs>

      {edges.map((e) => (
        <path
          key={e.id}
          d={e.d}
          fill="none"
          markerEnd={e.automatic ? "url(#lc-arrow-auto)" : "url(#lc-arrow)"}
          style={{ stroke: e.automatic ? "var(--line-strong)" : "var(--ink-muted)", strokeWidth: e.automatic ? 1.25 : 1.75 }}
        />
      ))}

      {statuses.map((s, i) => {
        const [x, y] = place(s, i);
        return (
          <g key={s.id}>
            <rect
              x={x - NODE_W / 2}
              y={y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={2}
              style={{ fill: "var(--surface)", stroke: `var(--st-${s.tone})`, strokeWidth: s.isTerminal ? 2.5 : 1.5 }}
            />
            <circle cx={x + NODE_W / 2 - 16} cy={y} r={4} style={{ fill: `var(--st-${s.tone})` }} />
            <text x={x + NODE_W / 2 - 28} y={y + 5} textAnchor="start" style={{ fill: "var(--ink)", fontSize: 14, fontWeight: 600 }}>
              {s.name}
            </text>
          </g>
        );
      })}

      {/* Labels last, so no box covers them; a halo in the surface colour keeps them readable over lines. */}
      {edges.map((e) => (
        <text
          key={e.id}
          x={e.lx}
          y={e.ly}
          textAnchor="middle"
          style={{ fill: e.automatic ? "var(--ink-subtle)" : "var(--ink-muted)", fontSize: 12, paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 5, strokeLinejoin: "round" }}
        >
          {e.label}
        </text>
      ))}
    </svg>
  );
}
