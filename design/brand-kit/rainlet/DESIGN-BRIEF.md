# Admin design brief: Mist

Status: design prototype only, not yet ported to code. Prototype canvas: https://claude.ai/artifact/33LUNdoemJvb6skuLvHCsA
Tokens and components: [`admin-mist.css`](admin-mist.css) (one stylesheet, every class prefixed `a-`).

## Direction (from Dương)

0. **Name: Rainlet** (working name, Dương asked for one, 2026-11-07). The admin product and its design set are called Rainlet; the system is Mist, its visual language. Sample data in every board uses the made-up workspace "Acme Studio" and example.com style domains; no client or project name appears in any board.
   0b. **Brand:** logo, lockups, favicon and guidelines are in [`brand/`](brand/index.html): a drop of water filled to a still level in a blue tile, lowercase "rainlet" drawn with the Mist round stroke. One blue (#0B63CE), one ink, no gradients.
   0c. **Typeface:** the admin interface keeps the system font stack (native, nothing to load, every script covered). Brand surfaces (Sign in title, emails, social card, docs) use **Be Vietnam Pro** 400/500/600 (open source, made for Vietnamese, token `--f-brand`); Chinese and Russian fall back to the system font. See [`brand/`](brand/index.html) section 7.
1. **Project-agnostic.** The admin is meant to be split out and reused, so nothing is project-specific (no client or project name, colour or copy). The workspace name lives in a switcher at the top of the sidebar.
2. **Creative, consistency first.** Few rules, applied everywhere, one component per pattern.
3. **Comfortably high contrast, not extreme.** No pure black on white.
4. **Soft and light**, not technical. White sidebar.
5. **System blue accent**, as operating systems use.
6. **Durable over first impression.** System font stack, no ornament, no gradients, no decorative type.
7. **Icon-first buttons.** Every labelled button leads with an icon. Icon-only buttons need `aria-label` and a tooltip.
8. **Fewer frames, less dead space.** One border per surface, never a box inside a box.

## Rules

- One accent (`--accent`) marks the primary action, the current place and focus. Nothing is blue for decoration.
- 1px lines. Control outlines use `--line-strong` (3.4:1). Dividers use `--line`.
- Soft shadow only on floating things: menu, dialog, toast, bulk bar.
- Selected = accent tint + accent text. Rows and blocks add a 3px accent bar.
- Status never relies on colour alone: Published ●, Draft ○, Scheduled ◆, Hidden ▬, Error ▲.
- 4px grid. Controls 40px (small 32px). Radius 8px controls, 12px panels, pill badges. Table and list rows 48px.
- Toasts: success 4 s, info 6 s, warning 8 s, error until dismissed, anything with an action at least 8 s, timer pauses on hover and focus. Errors use `role="alert"`, the rest `role="status"`. Bottom right, max 3, 88px up when a sticky save bar is present. Mobile: full width, one at a time.

- Tooltips: dark, 12px, one line (max 240px), optional shortcut chip. Every icon-only button has one; 400 ms delay on hover, immediate on focus; closes on Esc, blur, scroll; stays open while hovered; `role="tooltip"` + `aria-describedby`. Never holds links or required information: that is the click-to-open info popover. Disabled controls use a focusable wrapper that states the reason.

- Navigation: sidebar order follows how often a tool is used. Daily tools are always visible; rare ones (trash, translations, content audit, redirects, import and export, notifications, integrations, backups, activity log, system status) are in a collapsed **Advanced** group at the bottom, which opens by itself when one of them is the current page.
- Backups: the admin shows status and starts a run (full or changes only) but never restores. Restore stays a command-line step.

- Scrollbars: the track and corner are always transparent, only the thumb is drawn (6px inside a 12px hit area, 40px minimum, #B4BFC9 at rest, #7E8C99 on hover, #5A6877 while dragging). The sidebar scrolls inside itself, with the workspace switcher and account row pinned.
- When the current sidebar item sits below the fold (for example inside the open Advanced group), scroll it into view (`scrollIntoView({ block: 'nearest' })`).
- Controls: see the Controls board for the full set (slider, stepper, pickers, multi-select, combobox, tag input, code input, copy field, button group, split button, accordion, steps, avatars, skeleton, command palette). Native elements are used where they exist (checkbox, radio, range, details) and styled with the accent.
- Switch (`Switch` board): `<button role="switch" aria-checked>`, 44×24 (small 36×20 in rows, 44px hit area kept), blue track with a check in the knob when on so state never relies on colour alone. States: hover, focus ring, pressed (knob stretches), busy (`aria-busy`, spinning knob), disabled (50%). Settings row: title and optional hint on the left, optional On/Off word and the switch on the right, 48px, divider between rows, no frame. Switch = one setting on or off; checkbox = pick from a list or bulk select; `aria-pressed` toggle button = a tool that stays active. Label names the setting (never "Turn on…"), "on" is the active state. In a form it saves with the form; outside a form it saves at once, locks while busy, shows a status toast, and on failure reverts and shows an error toast. Risky settings confirm in a dialog first.

## Measured contrast (WCAG 2.x)

| Pair                                          | Ratio           |
| --------------------------------------------- | --------------- |
| `--text` on card                              | 14.6            |
| `--text-2` on card                            | 8.7             |
| `--text-3` on card / on sunken                | 5.7 / 5.0       |
| `--line-strong` on card (controls)            | 3.4             |
| white on `--accent`                           | 5.7             |
| `--accent-strong` on `--accent-tint`          | 7.3             |
| `--ok` / `--warn` / `--danger` on their tints | 4.9 / 5.2 / 5.2 |

## Rules in the repo

Locked in AGENTS.md §3.9 (replaces the Vercel-dashboard rule) and §3.19 (fieldset grouping without frames). §3.15 (`AdminSelect`) is unchanged: it adopts the Mist control style when ported. Not ported yet: legacy `--admin-*` tokens stay until a port PR maps them, see [`../design-tokens.md`](../design-tokens.md).

## Pages tree (board 4b)

- Tree mode (no filter, no search): the table shows every page in sitemap order with indent, never paginates, and each Page cell starts with a 20x32 grip button. Dragging leaves the source row at 40%, a floating copy follows the pointer, a drop between rows is a 2px accent line on the row edge, a drop inside is the accent tint row with the 3px accent bar. Keyboard: Space lifts, arrows move and change level, Space drops, Esc cancels, an `aria-live` region announces the result.
- Flat mode (filter or search on): no grip, no indent, full path as sub-line, 25 rows per page, and a note "Showing N results. Clear the filter to reorder." with a Clear filter link.
- Row actions: Edit is a button on the row; the "..." menu is fixed in five groups (Move up, Move down, Move out one level, Make child of page above, Move to... | Add child page, View on site, Duplicate | Publish or Unpublish | Delete). Impossible items are `aria-disabled` and dimmed, not removed. Delete always asks first and is blocked, with a message that lists them, when the page has child pages.
- "Move to..." is a dialog with a search field and an indented page list; the page itself and its children are disabled.
- Status tabs show only states that exist (All, Published, Draft). Updated shows relative time only.

## Page editor decisions (board 5, PR 4)

Where the build departs from `Editor.html` on purpose (no backend yet, or an AGENTS rule wins):

- **Tabs:** Blocks (default), SEO, Settings. History, Schedule and Review are left out until they have a backend; no dimmed placeholders.
- **One save for the whole page:** one sticky SaveBar (Discard, Save draft) and one `UnsavedChangesGuard`; one transaction. Status text: "Unsaved changes", "Saving...", "Last saved 2 min ago" (relative, updates each minute). A failed save shows an error toast (stays until dismissed) and keeps the unsaved state. Publish or Unpublish sits in the header and is disabled while there are unsaved changes ("Save your changes first").
- **Preview:** iframe of the last saved version, labelled "Showing the last saved version" with a "Refresh preview" icon button; refreshes itself after a successful save. Desktop | Mobile toggle stays. No highlight of the selected block.
- **Language:** one form-level switcher (AGENTS 3.19) in the tab row, right aligned, visible on every tab; it drives fields, preview and the missing-translation dots. The switcher inside the Inspector head on the board is dropped.
- **Inspector:** only "Content" exists, so the Content / Style / Advanced tab bar is hidden until a second tab has content.
- **Block row:** grip, name and type, eye button (hide or show, tooltip), "..." menu (Move up, Move down, Duplicate, Delete). Delete is a local change with an "Undo" toast and is reverted by Discard. Drag and keyboard reorder as in the Pages tree.
- **Switches:** every boolean setting is a `SwitchRow`, saved with the SaveBar (not instantly). Labels name the setting: "Home page", "Show in menu", "Index in search engines".
- **Add block:** a Dialog titled "Add block" with a search field (focused on open) and groups; 48px rows: 32px icon tile, name, muted type id. Enter or click adds the block after the selected one (at the end when none is selected), selects it and scrolls to it. Empty result: "No blocks match "q"". Full-screen on mobile.
- **Below 1024px:** tabs stay Blocks, SEO, Settings; inside Blocks a segmented List | Preview. The Inspector opens as a full-screen sheet with Back (arrow, `aria-label` "Back to blocks"), the block name and Done; Done only closes the sheet, the page SaveBar keeps the changes.

## Page header and guide (board 2d)

- Every page opens with eyebrow, h1, one description (15px, `--text-2`, 60ch, at most 2 lines) and actions on the right. The description is the page's help; an optional "Learn more" link (new tab, icon after the text) points at a longer document.
- No "i" button next to the title (Dương). Long help (steps, images) is `guide` content: the header gets a **Guide** button (book icon, label kept on mobile, `aria-expanded`) before the primary action, which opens a 420px right side panel over a 40% scrim (full width under 640px). The panel is `role="dialog"`, focus goes to the close button and returns to the Guide button; Esc, scrim and the close button close it. Content is static: headings, short paragraphs, at most one numbered list, optional footer link "Open the full guide".
- A single field that needs explaining uses its hint or the click-to-open info popover beside that field, never the page title.

### Accepted deviations in the built Page editor (PR 4 review)

- Three panes from 1280px (sidebar takes 264px); below that one column with List | Preview and the Inspector as a full-screen sheet.
- Save button reads "Save changes" on a published page and "Save draft" on a draft page (there is one stored version).
- Block rows and the Add block list use the widget thumbnail instead of an icon tile; a block with no thumbnail, or a blank one, falls back to a neutral 32px icon tile.
- The three panes sit in a bordered card inset by the 24px page padding, not edge to edge.
- Block name is 14px/500 with the type id in 12px mono; no per-block translation dots and no "+" between blocks (Add inserts after the selected block).
- Esc in the picker search clears the text first, a second Esc closes the dialog.
- Carried to the Articles/Media phase: the rich text toolbar (compact 32px, ghost buttons, one outer border, see `ArticleEditor.html`) and the image field (dashed frame only around the empty drop area, no frame once an image is set).

## Image optimization (Dương; revised 2026-11-08; board 16.2b)

The library keeps pictures as they are unless the person asks for a smaller file. **Optimize is opt-in:**

- **Default (Optimize off):** the file is stored unchanged: same format, same name, same size (a logo or favicon is never altered). The note reads: "Off: pictures are stored as they are, and a PNG asks first. Tick it for smaller, web-ready files." The result line reads `64 × 64 · 1.2 KB · stored as it is`.
- **PNG question (board 16.2c):** with Optimize off, every PNG asks first in a dialog "PNG picture" ("N PNG pictures" for several): "“logo.png” is a PNG. A PNG keeps exact colours and transparency, which suits a logo or an icon, but the file is large and pages load slower. Optimize converts it to WebP and resizes it to at most 1920 px. Choose what to do; nothing is uploaded until you do." Buttons: Cancel, Keep as PNG, Optimize to WebP (primary, initial focus). Ticking Optimize first skips the question; JPG, WebP, GIF and AVIF never ask. It applies to the Upload tab, to files dropped on the Media grid and to files dropped on an image field.
- **Optimize on** (checkbox "Optimize (convert to WebP, smaller file)", unticked by default, in the Upload tab of Insert image, the single-image picker and the Media upload dialog): the picture is converted to WebP, resized so the longest side is at most 1920 px (never enlarged) and compressed to about 70% quality; the stored name takes `.webp`. The result line reads `dimensions · original size → stored size (−NN%)`.
- **Only while Optimize is on:** "Keep higher quality (larger file)" (unticked; up to 2560 px and about 90% quality; its warning text is always visible under the label: "Image looks too soft? Tick here to keep more detail (up to 2560 px, about 90% quality). Pages will load slower and your SEO score may drop.") and, per file with transparent pixels, "Keep transparent background" (ticked; warning: "A transparent background makes the file larger. Untick to fill it with white and save space, but do not untick for logos used on dark sections."). With Optimize off these two rows are hidden.
- **Crop dialog:** note with Optimize off: "The result keeps the picture's format (a PNG stays a PNG) at its cropped size."; with Optimize on: "Saved as WebP and resized to at most 1920 px on the longest side (2560 with higher quality)."
- The limits on input stay: 10 files, 4.5 MB each, images only.

## Language switcher and row actions (Dương, 2026-11-07)

- **Language switcher** (every form, one per form): the Mist segmented control (`.a-seg`), items are the language codes only (EN VI ZH RU ES). The full name ("Tiếng Việt") is the tooltip and the `aria-label`. The active item uses the accent text like every other segmented control. A language with missing text gets the amber "!" badge after its code (a glyph, not a colour-only dot) and the tooltip says "Vietnamese · missing translation". Where space is tight it scrolls, it never wraps.
- **Language tooltips everywhere:** every language code shown anywhere (the form switcher, the Languages column chips in tables, alt-text switchers, status chips) has a tooltip with the full English name: EN "English", VI "Vietnamese", ZH "Chinese", RU "Russian", ES "Spanish". Where translation state matters the tooltip adds it: "Vietnamese · translated" or "Vietnamese · missing translation". The tooltip text equals the `aria-label`, opens after 400 ms on hover and at once on keyboard focus, as for every tooltip.
- **Row Edit in tables** (Pages, Articles, Collections, Users, and the rest): icon only (pencil), tooltip "Edit", `aria-label` "Edit <name>", 44px hit area, 32px button. The title cell is also a link to the same page. Labelled "Edit" buttons stay for page headers and cards, where there is room.
- **No wrapping buttons:** every button label is `white-space: nowrap`; if a label does not fit, the button loses its label and becomes icon-only with a tooltip, never wraps to two lines.

## Rich text: text style menu (Dương, 2026-11-07)

The "H" toggle is replaced by a **Text style** dropdown at the start of the formatting group (after Undo and Redo). The trigger shows the current style ("Paragraph", "Heading 2", "Heading 3", or "Mixed" when the selection spans several) with a chevron, has `aria-haspopup="menu"`, `aria-expanded` and `aria-label` "Text style: <current>", and a tooltip "Text style". The menu lists Paragraph, Heading 2 and Heading 3, each drawn in its own size (14/400, 18/600, 16/600) with a check on the current one and its shortcut on the right (Ctrl Alt 0, 2, 3); one click applies the style and closes the menu. Keyboard: Enter or Down opens, arrows move, Enter applies, Esc closes and returns focus to the trigger. Quote stays its own toggle button. Heading 3 must be in the sanitize allowlist (with a test that old content still parses).

## Wide screens and the Page editor (Dương, 2026-11-08; board 5b)

Board 5 is drawn at 1440. Nothing may sit empty on bigger windows, so the editor is fluid:

- **No width cap** on editors, lists and tables (the content area uses the full width next to the 264px sidebar). Only prose forms (Settings, Users form, Account security) keep their 720px column.
- **Columns** (class `.a-editor--fluid`): list `clamp(280px, 16vw, 340px)`, preview `minmax(480px, 1fr)`, inspector `clamp(340px, 24vw, 480px)`. Below 1280px it is one column (tabs, a List | Preview switch, inspector as a sheet).
- **Preview:** renders at its real width (Desktop 1280, Mobile 390) and is scaled with `min(1, pane / 1280)`, never below 0.5 (then it scrolls). Zoom control Fit | 50% | 75% | 100% remembered per browser; "Open preview in a new tab" shows the real size.
- **Rich text toolbar has two sizes.** Full (Undo, Redo, Text style, Bold, Italic, Underline, lists, Quote, Link, Image) where the editor is 580px or wider: the article body and the Expand dialog. Compact (Text style as P / H2 / H3 / Mixed, Bold, Italic, Bulleted list, Link, Image icon, More) in the block inspector at every viewport; "More" holds Underline, Numbered list, Quote, Undo, Redo. The toolbar never scrolls sideways and never wraps.
- **Expand editor:** a ghost icon button on the field label row opens the same editor in a 960px dialog (full screen under 768px); Done and Esc close it, it never saves by itself.
