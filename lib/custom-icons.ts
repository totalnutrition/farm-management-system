/**
 * Custom icons in the @hugeicons/core-free-icons data shape so they
 * render through <HugeiconsIcon /> with the same sizing and stroke
 * conventions as built-in icons.
 *
 * The data shape is documented in the hugeicons-react types:
 *   IconSvgElement = readonly (readonly [string, { [key]: string|number }])[]
 *
 * The renderer iterates the array, calls React.createElement(tag, attrs)
 * for each tuple inside an <svg viewBox="0 0 24 24">. Values must be
 * string or number (no booleans).
 */

import type { IconSvgElement } from "@hugeicons/react";

/**
 * Cow face — front view. Used for the Animals section since the
 * upstream icon set doesn't include cattle. Designed to read at 14–18 px
 * with currentColor stroke + dotted eyes/nostrils.
 */
export const CowFaceIcon: IconSvgElement = [
  // Horn tips
  [
    "path",
    {
      d: "M7 4.5 L5 2.5",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      key: "horn-l",
    },
  ],
  [
    "path",
    {
      d: "M17 4.5 L19 2.5",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      key: "horn-r",
    },
  ],
  // Ears (curve out + back)
  [
    "path",
    {
      d: "M5.5 8 C3 7.5 2 9.5 3 11.5",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      key: "ear-l",
    },
  ],
  [
    "path",
    {
      d: "M18.5 8 C21 7.5 22 9.5 21 11.5",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      key: "ear-r",
    },
  ],
  // Head (rounded "shield")
  [
    "path",
    {
      d: "M6 7 C6 4.8 8.7 4 12 4 C15.3 4 18 4.8 18 7 L18 12 C18 13.4 17.1 14.2 15.5 14.2 L8.5 14.2 C6.9 14.2 6 13.4 6 12 Z",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      key: "head",
    },
  ],
  // Snout (broader rounded shape sitting below the head)
  [
    "path",
    {
      d: "M7.5 14.2 C7.5 17.7 9.5 20 12 20 C14.5 20 16.5 17.7 16.5 14.2 Z",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      key: "snout",
    },
  ],
  // Eyes
  [
    "circle",
    {
      cx: "9.5",
      cy: "9",
      r: "0.9",
      fill: "currentColor",
      key: "eye-l",
    },
  ],
  [
    "circle",
    {
      cx: "14.5",
      cy: "9",
      r: "0.9",
      fill: "currentColor",
      key: "eye-r",
    },
  ],
  // Nostrils
  [
    "circle",
    {
      cx: "10.5",
      cy: "17",
      r: "0.55",
      fill: "currentColor",
      key: "nos-l",
    },
  ],
  [
    "circle",
    {
      cx: "13.5",
      cy: "17",
      r: "0.55",
      fill: "currentColor",
      key: "nos-r",
    },
  ],
];
