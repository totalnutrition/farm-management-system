"use client";

/**
 * Renders a top-down view of one barn with its pens drawn inside.
 *
 * Two orientations:
 *   - landscape (default, Settings → Infrastructure): long axis runs
 *     horizontally. Best on a wide page where one barn at a time gets
 *     the full canvas.
 *   - portrait (used in the /pen-moves farm-plan grid): long axis runs
 *     vertically. Lets several narrow tall barn cards sit side-by-side
 *     across the screen, like a property plan.
 *
 * Layouts:
 *   - single_side  → pens on one side of a feed alley
 *   - double_side  → pens on both sides of a central feed alley
 *   - free         → single row/column, pens flow with capacity
 *
 * Pens are rendered as draggable HTML divs overlaid on the SVG outline
 * so we can use native HTML5 drag-and-drop (SVG drag doesn't work
 * reliably across browsers). Drops are reported via onPenDrop so the
 * caller can move the pen to this barn.
 */

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Pen } from "@/lib/pens";
import type { Barn } from "@/lib/barns";

const DEFAULT_CANVAS_LONG = 720;
const PADDING = 8;
export const PEN_DRAG_MIME = "application/x-pen-id";

type GroupColor = { fill: string; stroke: string };
const PALETTE: GroupColor[] = [
  { fill: "#7c3aed20", stroke: "#7c3aed" },
  { fill: "#0ea5e920", stroke: "#0ea5e9" },
  { fill: "#10b98120", stroke: "#10b981" },
  { fill: "#f59e0b20", stroke: "#f59e0b" },
  { fill: "#ef444420", stroke: "#ef4444" },
  { fill: "#ec489920", stroke: "#ec4899" },
  { fill: "#64748b20", stroke: "#64748b" },
];
function colorFor(idOrNull: string | null | undefined): GroupColor {
  if (!idOrNull) return { fill: "#94a3b820", stroke: "#94a3b8" };
  let h = 0;
  for (let i = 0; i < idOrNull.length; i++)
    h = (h * 31 + idOrNull.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export type BarnOrientation = "landscape" | "portrait";

export function BarnVisualizer({
  barn,
  pens,
  groupLabel,
  headcountByPen = {},
  onPenClick,
  onPenDrop,
  canvasLong,
  compact = false,
  orientation: orientationProp,
}: {
  barn: Barn;
  pens: Pen[];
  groupLabel: (groupId: string | null) => string;
  headcountByPen?: Record<string, number>;
  onPenClick?: (pen: Pen) => void;
  /**
   * Fires when a pen is dropped on this barn. Receives the dragged
   * pen id (read from PEN_DRAG_MIME) and the side hint detected from
   * the pointer position (for double_side barns). If undefined, the
   * barn is not a drop target.
   */
  onPenDrop?: (penId: string, side: "left" | "right" | null) => void;
  /**
   * Canvas size along the barn's long axis, in px. Defaults to 720
   * (or 360 in compact mode). In portrait this is the SVG height; in
   * landscape it's the SVG width.
   */
  canvasLong?: number;
  /** Drop internal header + outer ring (caller renders its own). */
  compact?: boolean;
  /** Orientation override. Defaults to portrait when compact, else landscape. */
  orientation?: BarnOrientation;
}) {
  const orientation: BarnOrientation =
    orientationProp ?? (compact ? "portrait" : "landscape");
  const longPx = canvasLong ?? (compact ? 360 : DEFAULT_CANVAS_LONG);

  const [hoverPen, setHoverPen] = useState<Pen | null>(null);
  const [dropHover, setDropHover] = useState<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openPenEdit = (pen: Pen) => {
    if (onPenClick) {
      onPenClick(pen);
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.set("edit", pen.id);
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const lengthFt = barn.length_ft ?? 200;
  const widthFt = barn.width_ft ?? 80;

  const ftPerPx = lengthFt / (longPx - 2 * PADDING);
  const shortPx =
    Math.round(widthFt / ftPerPx + 2 * PADDING) || (compact ? 140 : 320);

  const canvasW = orientation === "portrait" ? shortPx : longPx;
  const canvasH = orientation === "portrait" ? longPx : shortPx;

  const layout = (barn.layout ?? "double_side") as
    | "single_side"
    | "double_side"
    | "free";
  const alleyWidthFt =
    barn.alley_width_ft ?? (layout === "double_side" ? 14 : 12);
  const alleyShortPx = alleyWidthFt / ftPerPx;

  const ownPens = pens
    .filter((p) => p.barn_id === barn.id)
    .sort((a, b) => a.position_index - b.position_index);

  type Placed = {
    rect: { long: number; short: number; longLen: number; shortLen: number };
    pen: Pen;
  };
  function layoutRow(
    rowPens: Pen[],
    shortOffset: number,
    shortLen: number,
  ): Placed[] {
    const sizedFt = rowPens.map((p) => p.length_ft ?? 0);
    const totalSizedFt = sizedFt.reduce((s, v) => s + v, 0);
    const remainingFt = Math.max(0, lengthFt - totalSizedFt);
    const unsized = sizedFt.filter((v) => v === 0).length;
    const evenFt = unsized > 0 ? remainingFt / unsized : 0;
    let cursor = PADDING;
    const out: Placed[] = [];
    for (const p of rowPens) {
      const ftAlong =
        p.length_ft ?? (evenFt || lengthFt / Math.max(1, rowPens.length));
      const longPxLen = ftAlong / ftPerPx;
      out.push({
        rect: {
          long: cursor,
          short: shortOffset,
          longLen: longPxLen,
          shortLen,
        },
        pen: p,
      });
      cursor += longPxLen;
    }
    return out;
  }

  let placements: Placed[] = [];
  if (layout === "double_side") {
    const rowShort = (shortPx - 2 * PADDING - alleyShortPx) / 2;
    const top = ownPens.filter((p) => p.side === "left");
    const bot = ownPens.filter((p) => p.side === "right");
    const orphan = ownPens.filter(
      (p) => p.side !== "left" && p.side !== "right",
    );
    const topAll = [...top, ...orphan.filter((_, i) => i % 2 === 0)];
    const botAll = [...bot, ...orphan.filter((_, i) => i % 2 === 1)];
    placements = [
      ...layoutRow(topAll, PADDING, rowShort),
      ...layoutRow(botAll, PADDING + rowShort + alleyShortPx, rowShort),
    ];
  } else if (layout === "single_side") {
    const rowShort = shortPx - 2 * PADDING - alleyShortPx;
    placements = layoutRow(ownPens, PADDING, rowShort);
  } else {
    placements = layoutRow(ownPens, PADDING, shortPx - 2 * PADDING);
  }

  function project(rect: Placed["rect"]): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    if (orientation === "portrait") {
      return {
        x: rect.short,
        y: rect.long,
        w: rect.shortLen,
        h: rect.longLen,
      };
    }
    return {
      x: rect.long,
      y: rect.short,
      w: rect.longLen,
      h: rect.shortLen,
    };
  }

  const alleyRect = (() => {
    if (layout === "double_side") {
      if (orientation === "portrait") {
        return {
          x: (canvasW - alleyShortPx) / 2,
          y: 0,
          w: alleyShortPx,
          h: canvasH,
        };
      }
      return {
        x: 0,
        y: (canvasH - alleyShortPx) / 2,
        w: canvasW,
        h: alleyShortPx,
      };
    }
    if (layout === "single_side") {
      if (orientation === "portrait") {
        return {
          x: canvasW - PADDING - alleyShortPx,
          y: 0,
          w: alleyShortPx,
          h: canvasH,
        };
      }
      return {
        x: 0,
        y: canvasH - PADDING - alleyShortPx,
        w: canvasW,
        h: alleyShortPx,
      };
    }
    return null;
  })();

  const sideFromPointer = (
    e: React.DragEvent<HTMLElement>,
    bbox: DOMRect,
  ): "left" | "right" | null => {
    if (layout !== "double_side") return null;
    if (orientation === "portrait") {
      const x = e.clientX - bbox.left;
      return x < bbox.width / 2 ? "left" : "right";
    }
    const y = e.clientY - bbox.top;
    return y < bbox.height / 2 ? "left" : "right";
  };

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    if (!onPenDrop) return;
    if (!e.dataTransfer.types.includes(PEN_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHover(true);
  };
  const onDragLeave = () => setDropHover(false);
  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    setDropHover(false);
    if (!onPenDrop) return;
    const penId = e.dataTransfer.getData(PEN_DRAG_MIME);
    if (!penId) return;
    e.preventDefault();
    const bbox = e.currentTarget.getBoundingClientRect();
    onPenDrop(penId, sideFromPointer(e, bbox));
  };

  return (
    <section
      className={
        compact ? "flex flex-col" : "ring-1 ring-foreground/10 flex flex-col"
      }
      onDragOver={onPenDrop ? onDragOver : undefined}
      onDragLeave={onPenDrop ? onDragLeave : undefined}
      onDrop={onPenDrop ? onDrop : undefined}
    >
      {compact ? (
        <p className="text-[10px] text-muted-foreground px-1 pb-1">
          {ownPens.length} pen{ownPens.length === 1 ? "" : "s"}
          {barn.length_ft && barn.width_ft
            ? ` · ${barn.length_ft}ft × ${barn.width_ft}ft`
            : " · dimensions not set"}
          {` · ${layout.replace("_", "-")}`}
        </p>
      ) : (
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
      )}

      <div
        className={`relative bg-background ${compact ? "" : "p-2"} ${
          dropHover ? "ring-2 ring-primary ring-offset-1" : ""
        }`}
        style={{ width: canvasW, height: canvasH, maxWidth: "100%" }}
      >
        <svg
          width={canvasW}
          height={canvasH}
          className="block absolute inset-0"
          role="img"
          aria-label={`Visual layout of ${barn.name}`}
        >
          <rect
            x={0.5}
            y={0.5}
            width={canvasW - 1}
            height={canvasH - 1}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
          {alleyRect ? (
            <rect
              x={alleyRect.x}
              y={alleyRect.y}
              width={alleyRect.w}
              height={alleyRect.h}
              fill="currentColor"
              fillOpacity={0.06}
            />
          ) : null}
          {alleyRect ? (
            <text
              x={alleyRect.x + alleyRect.w / 2}
              y={alleyRect.y + alleyRect.h / 2 + 3}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.45}
              transform={
                orientation === "portrait" && layout !== "free"
                  ? `rotate(-90 ${alleyRect.x + alleyRect.w / 2} ${
                      alleyRect.y + alleyRect.h / 2 + 3
                    })`
                  : undefined
              }
            >
              feed alley {alleyWidthFt}ft
            </text>
          ) : null}
        </svg>

        <div className="absolute inset-0">
          {placements.map(({ rect: r, pen }) => {
            const p = project(r);
            const c = colorFor(pen.group_id);
            const head = headcountByPen[pen.id] ?? 0;
            const cap = pen.capacity_head;
            const isHovered = hoverPen?.id === pen.id;
            return (
              <div
                key={pen.id}
                role="button"
                tabIndex={0}
                draggable={!!onPenDrop}
                onDragStart={(e) => {
                  e.dataTransfer.setData(PEN_DRAG_MIME, pen.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onMouseEnter={() => setHoverPen(pen)}
                onMouseLeave={() => setHoverPen(null)}
                onClick={() => openPenEdit(pen)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPenEdit(pen);
                  }
                }}
                title={`${pen.name}${cap !== null ? ` · cap ${cap}` : ""} · ${head} cow${head === 1 ? "" : "s"}`}
                className={`absolute overflow-hidden text-[10px] leading-tight ${
                  onPenDrop ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                style={{
                  left: p.x,
                  top: p.y,
                  width: Math.max(2, p.w - 2),
                  height: Math.max(2, p.h - 2),
                  background: c.fill,
                  border: `${isHovered ? 2 : 1}px solid ${c.stroke}`,
                  padding: "3px 4px",
                  boxSizing: "border-box",
                }}
              >
                {p.w > 50 || p.h > 50 ? (
                  <span className="font-medium block truncate text-foreground/85">
                    {pen.name}
                  </span>
                ) : null}
                {(p.w > 50 && p.h > 28) || (p.h > 50 && p.w > 28) ? (
                  <span className="block text-foreground/55 tabular-nums">
                    {head}
                    {cap !== null ? ` / ${cap}` : ""}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {hoverPen ? (
        <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-foreground/10">
          <span className="font-medium text-foreground">{hoverPen.name}</span>
          {" — "}
          <span>{groupLabel(hoverPen.group_id)}</span>
          {hoverPen.capacity_head !== null
            ? ` · cap ${hoverPen.capacity_head}`
            : ""}
          {` · ${headcountByPen[hoverPen.id] ?? 0} cow${(headcountByPen[hoverPen.id] ?? 0) === 1 ? "" : "s"} now`}
        </div>
      ) : null}
    </section>
  );
}
