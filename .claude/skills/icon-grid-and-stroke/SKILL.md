---
name: icon-grid-and-stroke
description: The grid, stroke and corner rules of the xoong icon set (24px, 1.75 stroke, round caps and joins). Use before drawing or reviewing any icon.
---

# Grid and stroke

- **Canvas** `viewBox="0 0 24 24"`. **Live area** 20x20 (2px margin). Keyline shapes: circle 18 (r=9), square 16 (rounded, `rx` 2.5 to 3), portrait rect 14x18 or 16x20, landscape rect 18x14 or 20x16. Use the keyline that matches the object; do not stretch a circle into an oval.
- **Stroke** `1.75` for every outline, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`, `stroke="currentColor"`. One weight: never thin out a detail, simplify it instead.
- **Corners**: outer corners of containers `rx` 2.5 to 3 (3 for big, 2 for small ones), consistent inside one icon. Sharp tips (arrowheads, chevrons, the star) are softened by the round join, not by extra curves.
- **Gaps**: between two strokes at least 2px centre-to-centre beyond the stroke width (3.75 total); a detail closer than that merges at 16px, drop it.
- **Arrowheads** are 45 degree, legs of 6 to 6.5 units. **Chevrons** span 12x6 to 12x7. **Dots** are `r=.75` circles with the stroke (about 3.25 px wide) or `r=.5` for small marks.
- **Alignment**: use whole and half units; do not chase pixel snapping, the set is used from 12 to 48px.
- **Orientation**: objects face up/right by default, "action" arrows are 45 or 90 degrees. Directional icons (arrow, chevron) come in four; RTL is handled by the page, not by new drawings.
- **Metaphor**: one idea per icon, 1 to 3 shapes. If it needs a fourth, it is too busy for 16px.
