---
name: icon-fill-and-optics
description: How to draw the fill variant of an icon and balance icons optically. Use when adding svg/fill/<name>.svg or reviewing visual weight.
---

# Fill variant and optical balance

## Fill
- `svg/fill/<name>.svg` root: `fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`. The 1.5 stroke on a filled shape rounds its corners; draw the shape about 0.75 inside the outline's edge so it ends where the outline ended.
- **Detail is cut out, not drawn in another colour** (the icon is a mask: there is only alpha). Use a mask: `<mask id="k-<name>"><rect width="24" height="24" fill="#fff" stroke="none"/> ...cuts drawn in #000... </mask><g mask="url(#k-<name>)"> ...shape... </g>`. The id must be `k-<name>` (unique, so inlined icons do not clash; a test checks).
- Cuts are 1.5 to 1.9 wide, round, and keep 2px of fill around them.
- Open details of the outline (a trash lid, a bell clapper, a folder tab line, a calendar ring) stay as strokes drawn with `fill="none" stroke-width="1.75"`.
- No fill drawing for an icon that is only strokes (plus, minus, check, arrows, chevrons, menu, grip, code, undo): do not make one, the bold outline serves as its fill.
- The fill and regular versions must be recognisably the same object with the same silhouette size.

## Optical balance
- Round shapes overshoot: a circle may reach 1/2 unit beyond a square's edge. Triangles sit lower than their centre (centre the visual mass, not the box).
- Diagonals and dense areas look heavier; give them more air. Thin sparse icons (dots, a plus) get no extra mass: bold exists for that.
- Compare at 16, 20, 24 and 48px next to neighbours (a similar object: user and users, mail and message). The eye, not the bounding box, decides.
- Keep the set's density even: no icon should look like a blot or a hairline next to the others.
