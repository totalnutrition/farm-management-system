"use client";

/**
 * RFID-scanner-friendly animal lookup input.
 *
 * Works two ways:
 *   1. Herdsman types an on-farm tag ("1398") and hits Enter.
 *   2. HID barcode / RFID wedge scanner emits the ISO 11784/11785 or
 *      USDA-840 number as fast keystrokes ending with Enter — the
 *      input field receives those exactly like typed input but at
 *      machine speed, then the trailing Enter triggers the lookup.
 *
 * On Enter we call findAnimalByCode (looks up by official_id first,
 * then animal_id) scoped to the active location, and notify the
 * caller via onSelect. Empty / no-match cases bubble up so the parent
 * can show its own toast.
 */

import { useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { findAnimalByCode, type AnimalLookupHit } from "@/lib/animals";

export function AnimalScanInput({
  onSelect,
  onMiss,
  placeholder = "Scan tag or type animal ID…",
  autoFocus = false,
  clearOnSelect = true,
  className,
}: {
  /** Fires with the matched animal. */
  onSelect: (animal: AnimalLookupHit) => void;
  /** Fires when the code didn't match anything. */
  onMiss?: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Clear the field after a successful lookup (default true — fast subsequent scans). */
  clearOnSelect?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, startTransition] = useTransition();
  // Track time between keystrokes — fast (<30ms) means a scanner, slow
  // means human typing. We use it just to skip the "Enter to search"
  // hint when a scan is in flight.
  const lastKeyAt = useRef<number>(0);
  const [isScanner, setIsScanner] = useState(false);

  const submit = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    startTransition(async () => {
      const hit = await findAnimalByCode(code);
      if (!hit) {
        onMiss?.(code);
      } else {
        onSelect(hit);
        if (clearOnSelect) setValue("");
      }
      setIsScanner(false);
      // Re-focus for the next scan / entry.
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        inputMode="text"
        disabled={busy}
        onChange={(e) => {
          const now = performance.now();
          const dt = now - lastKeyAt.current;
          lastKeyAt.current = now;
          if (dt > 0 && dt < 30) setIsScanner(true);
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit(value);
          } else if (e.key === "Escape") {
            setValue("");
          }
        }}
      />
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {busy
          ? "Looking up…"
          : isScanner
            ? "Scanner detected — release to lookup"
            : "Enter to lookup · Esc to clear"}
      </span>
    </div>
  );
}
