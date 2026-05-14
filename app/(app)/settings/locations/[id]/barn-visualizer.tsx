"use client";

/**
 * Renders a top-down SVG view of one barn with its pens drawn inside.
 * Geometry comes from the barn / pen rows. Layout fallbacks:
 *   - if barn.length_ft + width_ft are set, they drive the canvas
 *     aspect ratio; otherwise we use a 2:1 default
 *   - if a pen has length_ft set, the renderer respects it; otherwise
 *     the pen flows to fill its row proportional to capacity_head
 *   - double_side barns put pens with side='left' on top, side='right'
 *     on bottom, with a feed-alley strip in the middle
 *   - single_side puts a single row of pens with the alley on the
 *     bottom edge
 *   - free layout just lays them all out in one flow row
 */

import { useState } from "react";
import type { Pen } from "@/lib/pens";
import type { Barn } from "@/lib/barns";

const CANVAS_W = 720; // px — the SVG width we render at
const PADDING = 8;

type GroupColor = { fill: string; stroke: string };
const PALETTE: GroupColor[] = [
  { fill: "#7c3aed20", stroke: "#7c3aed" }, // violet
  { fill: "#0ea5e920", stroke: "#0ea5e9" }, // sky
  { fill: "#10b98120", stroke: "#10b981" }, // emerald
  { fill: "#f59e0b20", stroke: "#f59e0b" }, // amber
  { fill: "#ef444420", stroke: "#ef4444" }, // red
  { fill: "#ec489920", stroke: "#ec4899" }, // pink
  { fill: "#64748b20", stroke: "#64748b" }, // slate
];
function colorFor(idOrNull: string | null | undefined): GroupColor {
  if (!idOrNull) return { fill: "#94a3b820", stroke: "#94a3b8" }; // muted
  let h = 0;
  for (let i = 0; i < idOrNull.length; i++) h = (h * 31 + idOrNull.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function BarnVisualizer({
  barn,
  pens,
  groupLabel,
  headcountByPen = {},
}: {
  barn: Barn;
  pens: Pen[];
  /** id → label, for showing group name on tooltip */
  groupLabel: (groupId: string | null) => string;
  /** pen_id → live cow count */
  headcountByPen?: Record<string, number>;
}) {
  const [hoverPen, setHoverPen] = useState<Pen | null>(null);

  // Choose canvas dimensions. Use barn dims if set, else 2:1.
  const lengthFt = barn.length_ft ?? 200;
  const widthFt = barn.width_ft ?? 80;
  const aspect = widthFt / lengthFt;
  const canvasH = Math.max(120, Math.min(360, Math.round(CANVAS_W * aspect)));
  const ftPerPx = lengthFt / (CANVAS_W - 2 * PADDING);

  const layout = (barn.layout ?? "double_side") as "single_side" | "double_side" | "free";
  const alleyWidthFt = barn.alley_width_ft ?? (layout === "double_side" ? 14 : 12);
  const alleyHpx = alleyWidthFt / ftPerPx;

  // Filter pens to this barn.
  const ownPens = pens
    .filter((p) => p.barn_id === barn.id)
    .sort((a, b) => a.position_index - b.position_index);

  // Helper: compute x positions across the long axis. If pens have
  // length_ft set, pack them sequentially. Otherwise, divide evenly.
  function layoutRow(
    rowPens: Pen[],
    rowYpx: number,
    rowHpx: number,
  ): { rect: { x: number; y: number; w: number; h: number }; pen: Pen }[] {
    const sized = rowPens.map((p) => p.length_ft ?? 0);
    const totalSizedFt = sized.reduce((s, v) => s + v, 0);
    const remainingFt = Math.max(0, lengthFt - totalSizedFt);
    const unsizedCount = sized.filter((v) => v === 0).length;
    const evenFt = unsizedCount > 0 ? remainingFt / unsizedCount : 0;
    let cursorPx = PADDING;
    const out: { rect: { x: number; y: number; w: number; h: number }; pen: Pen }[] = [];
    for (let i = 0; i < rowPens.length; i++) {
      const p = rowPens[i];
      const widthFtPen =
        p.length_ft ?? (evenFt || lengthFt / Math.max(1, rowPens.length));
      const wpx = widthFtPen / ftPerPx;
      out.push({
        rect: { x: cursorPx, y: rowYpx, w: wpx, h: rowHpx },
        pen: p,
      });
      cursorPx += wpx;
    }
    return out;
  }

  type Placed = ReturnType<typeof layoutRow>;
  let placements: Placed = [];
  if (layout === "double_side") {
    const rowHpx = (canvasH - 2 * PADDING - alleyHpx) / 2;
    const top = ownPens.filter((p) => p.side === "left");
    const bot = ownPens.filter((p) => p.side === "right");
    const orphan = ownPens.filter((p) => p.side !== "left" && p.side !== "right");
    // Spread orphans across both sides round-robin so they're visible.
    const topAll = [...top, ...orphan.filter((_, i) => i % 2 === 0)];
    const botAll = [...bot, ...orphan.filter((_, i) => i % 2 === 1)];
    placements = [
      ...layoutRow(topAll, PADDING, rowHpx),
      ...layoutRow(botAll, PADDING + rowHpx + alleyHpx, rowHpx),
    ];
  } else if (layout === "single_side") {
    const rowHpx = canvasH - 2 * PADDING - alleyHpx;
    placements = layoutRow(ownPens, PADDING, rowHpx);
  } else {
    // free: single row, fill canvas height.
    placements = layoutRow(ownPens, PADDING, canvasH - 2 * PADDING);
  }

  return (
    <section className="ring-1 ring-foreground/10 flex flex-col">
      <header className="px-3 py-2 bg-foreground/5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">
          {barn.name}
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            {ownPens.length} pen{ownPens.length === 1 ? "" : "s"}
            {barn.length_ft && barn.width_ft
              ? ` · ${barn.length_ft}ft × ${barn.width_ft}ft`
              : " · dimensions not set"}
            {` · ${layout.replace("_", "-")} layout`}
          </span>
        </h3>
      </header>

      <div className="p-2 overflow-x-auto bg-background">
        <svg
          width={CANVAS_W}
          height={canvasH}
          className="block max-w-full h-auto"
          role="img"
          aria-label={`Visual layout of ${barn.name}`}
        >
          {/* barn outline */}
          <rect
            x={0.5}
            y={0.5}
            width={CANVAS_W - 1}
            height={canvasH - 1}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
          {/* feed alley */}
          {layout === "double_side" ? (
            <rect
              x={0}
              y={(canvasH - alleyHpx) / 2}
              width={CANVAS_W}
              height={alleyHpx}
              fill="currentColor"
              fillOpacity={0.06}
            />
          ) : layout === "single_side" ? (
            <rect
              x={0}
              y={canvasH - PADDING - alleyHpx}
              width={CANVAS_W}
              height={alleyHpx}
              fill="currentColor"
              fillOpacity={0.06}
            />
          ) : null}
          {/* pens */}
          {placements.map(({ rect, pen }) => {
            const c = colorFor(pen.group_id);
            const head = headcountByPen[pen.id] ?? 0;
            const cap = pen.capacity_head;
            return (
              <g
                key={pen.id}
                onMouseEnter={() => setHoverPen(pen)}
                onMouseLeave={() => setHoverPen(null)}
                className="cursor-pointer"
              >
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={Math.max(2, rect.w - 2)}
                  height={Math.max(2, rect.h - 2)}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={hoverPen?.id === pen.id ? 2 : 1}
                />
                {rect.w > 60 ? (
                  <text
                    x={rect.x + 6}
                    y={rect.y + 14}
                    fontSize={11}
                    fill="currentColor"
                    fillOpacity={0.85}
                    fontWeight={500}
                  >
                    {pen.name}
                  </text>
                ) : null}
                {rect.w > 60 && rect.h > 30 ? (
                  <text
                    x={rect.x + 6}
                    y={rect.y + 28}
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.6}
                  >
                    {head}
                    {cap !== null ? ` / ${cap}` : ""}
                  </text>
                ) : null}
              </g>
            );
          })}
          {/* alley label */}
          {layout !== "free" ? (
            <text
              x={CANVAS_W / 2}
              y={
                layout === "double_side"
                  ? canvasH / 2 + 4
                  : canvasH - PADDING - alleyHpx / 2 + 4
              }
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.45}
            >
              feed alley {alleyWidthFt}ft
            </text>
          ) : null}
        </svg>
      </div>

      {hoverPen ? (
        <div className="px-3 py-2 bg-foreground/[0.025] text-[11px] text-muted-foreground border-t border-foreground/10">
          <span className="font-medium text-foreground">{hoverPen.name}</span>
          {" — "}
          <span>{groupLabel(hoverPen.group_id)}</span>
          {hoverPen.capacity_head !== null
            ? ` · cap ${hoverPen.capacity_head}`
            : ""}
          {hoverPen.bunk_running_ft !== null
            ? ` · ${hoverPen.bunk_running_ft}ft bunk`
            : ""}
          {hoverPen.length_ft !== null && hoverPen.width_ft !== null
            ? ` · ${hoverPen.length_ft}ft × ${hoverPen.width_ft}ft`
            : ""}
          {` · ${headcountByPen[hoverPen.id] ?? 0} cow${(headcountByPen[hoverPen.id] ?? 0) === 1 ? "" : "s"} now`}
        </div>
      ) : null}
    </section>
  );
}
