# Layout

Every page needs the same four arrangements: things one under the other, things side by side, equal columns, and a centred page column. `xoong.css` has them as **four elements with a few
attributes**. They are drawn by CSS alone (no script, nothing to import but the stylesheet), they live in the `xoong.components` cascade layer (so your own CSS always wins, whatever its
specificity), and they are not utility classes: four names and a handful of values, all checked by `xoong check`.

```html
<link rel="stylesheet" href="/@xoong/ui/src/xoong.css">
```

## The four elements

| Element | What it does | Attributes |
|---|---|---|
| `<xo-stack>` | children one under the other | `gap` 0 to 4 (default 3); `align` start, center or end (default: they fill the width) |
| `<xo-row>` | children side by side, vertically centred | `gap` 0 to 4 (default 2); `wrap`; `align` start, center (default), end, baseline or stretch; `justify` start (default), center, end or between; a child with `grow` takes the free space |
| `<xo-grid>` | equal columns | `gap` 0 to 4 (default 3); `cols` 1 to 4 (one column under 40rem); without `cols`: as many columns of at least 16rem as fit |
| `<xo-center>` | the page column: centred, readable width, side padding | `size` narrow (40rem) or wide (80rem); default 64rem |

`gap` is one scale for all of them: 1 is 0.25rem, 2 is 0.5rem, 3 is 1rem, 4 is 1.5rem (the `--xo-space-1` to `--xo-space-4` tokens), and 0 is none.

## Stack

```html
<xo-stack gap="2">
  <h2>Account</h2>
  <p>Children one under the other.</p>
  <button>Save</button>
</xo-stack>
```

Children fill the width. `align="start"` (or `center`, `end`) lets them keep their own width and places them: a button that should not stretch.

## Row

```html
<xo-row justify="between" wrap>
  <h1>Articles</h1>
  <xo-row gap="1"><input type="search" aria-label="Search" grow> <button>New</button></xo-row>
</xo-row>
```

* `justify="between"` pushes the first child to the start and the last to the end; `center` and `end` move the whole group.
* `grow` on a child makes it take the rest of the row, and lets it shrink below its content (a search box beside a button on a phone).
* `wrap` lets children go on a new line when they do not fit; without it they stay on one line.
* `align` is the vertical alignment (`baseline` for text of different sizes, `stretch` for equal heights).

## Grid

```html
<xo-grid cols="3">
  <article>…</article> <article>…</article> <article>…</article>
</xo-grid>
```

`cols` fixes the number of equal columns (1 to 4) and falls to one column under 40rem, so a phone never gets three squeezed ones. Without `cols` the grid fits as many columns as there is room for,
each at least `--xo-grid-min` wide (16rem; set it on the element or on `:root`): a card list that needs no breakpoint.

## Center

```html
<xo-center size="narrow">
  <h1>Sign in</h1>
  <xo-stack>…</xo-stack>
</xo-center>
```

The page column: centred, at most 64rem (`size="narrow"` 40rem, for text and forms; `size="wide"` 80rem), with 1rem of padding at the sides so text never touches the edge of a phone.
Change the default with `--xo-center-max`.

## Recipes

A page: `<xo-center>` around `<xo-stack>`, with a `<xo-row justify="between">` for the title and its actions, and an `<xo-grid>` for the content.

```html
<body>
  <xo-center>
    <xo-stack gap="4">
      <xo-row justify="between" wrap><h1>Team</h1><button>Invite</button></xo-row>
      <xo-grid>
        <xo-view get="listPeople"><article xo-each="items"><h3>{name}</h3><p>{role}</p></article></xo-view>
      </xo-grid>
    </xo-stack>
  </xo-center>
</body>
```

A toolbar over a table: `<xo-row wrap><input type="search" grow> <select>…</select> <button>New</button></xo-row>` above the `<xo-table>`.

A form of two columns that becomes one on a phone: `<xo-grid cols="2">` around the fields.

## When you need more

* **Your CSS wins.** The layout is in a cascade layer, so a rule of yours needs no `!important`: `xo-row { gap: 12px; }` replaces the scale for every row.
* **A sidebar, a hero, a masonry, a sticky header** are not here, on purpose: write them with your own CSS and the tokens (`var(--xo-space-3)`, `var(--xo-color-border)`), or use the admin shell
  (`<body class="xo-admin">`, see [admin.md](admin.md)) for an application with a header, a navigation and a main area.
* **`xoong check`** warns about a value the CSS does not know (`<xo-row gap="9">`, `<xo-grid cols="5">`), because the browser would silently use the default. Editors complete the elements and values from
  the same data (`explain_syntax` in the MCP server answers for each).
* The form-array row of a generated form is `.xo-array-row` (it was `.xo-row` before these elements: the name belongs to the layout now).
* The Mist skin (`mist.css`) keeps its older helpers (`.toolbar`, `.row-inline`, `.stack`); new code should use the elements.
