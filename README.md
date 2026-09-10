# Tablance

Tablance 2 separates a cell's availability from its editor configuration. State options belong on the schema node; `input` only describes the editor.

```js
{
  title: "Notes",
  dataKey: "notes",
  editableIf: ({rowData}) => rowData.reportOpen,
  disabledIf: ({rowData}) => !rowData.isApplicable,
  input: {type: "textarea"}
}
```

## Cell states

The canonical states and capabilities are:

- `editable`: selectable, activatable and mutable; activation opens the configured editor.
- `readOnly`: selectable but never mutable or activatable by default. This includes pure presentation fields without
  an `input` as well as fields whose configured editor is currently locked.
- `action`: selectable and activatable but not mutable; activation invokes a control or callback.
- `disabled`: unavailable, non-selectable, non-activatable and non-mutable.

State precedence is `disabled`/`disabledIf`, action/control, `readOnly`, implicit read-only (no input and no action), `editableIf`, then editable. `readOnly: true` therefore wins over `editableIf: true`, while disabled always wins over both.

`editableIf(payload)` may return `false` or `{editable: false, message}`. `disabledIf(payload)` may return `true` or `{disabled: true, message}`. Presentation fields without `input` or `onEnter` are implicitly read-only. Buttons, expand/select controls, groups, and fields with `onEnter` but no input are action cells.

The former `input.enabledIf` API was removed in 2.0. Use schema-level `editableIf`; use `disabledIf` when a cell is genuinely unavailable rather than merely locked for editing. `input.disabled` is not an API.

## Read-only presentation

Read-only cells are non-activatable by default. Set `readOnlyPresentation: true` on a field to explicitly allow Enter
or double-click to open a native `readonly` textarea containing the rendered text. Native text selection and copying
work there. Escape or blur closes it, and Tab returns to grid navigation. Outside presentation
mode, Ctrl+C continues to copy the complete rendered cell text for every selected read-only field. Save and bulk-save
paths also verify the canonical state, so read-only cells cannot invoke validation, change, or commit callbacks.

## Default theme

Tablance ships with its complete default table, details, hover, selection, and state-indicator styling. Canonical state is projected to DOM classes by Tablance itself; consumers do not need observers or interaction hooks to keep styling synchronized.

The default palette can be themed by overriding CSS custom properties on a `.tablance` element. Common properties include:

```css
.tablance {
  --tablance-border-color: #D9E2EF;
  --tablance-header-background: #F3F6FA;
  --tablance-cell-background: #FFFFFF;
  --tablance-hover-background: #F3F7FC;
  --tablance-selected-background: #EDF4FF;
  --tablance-selected-hover-background: #E6F0FF;
  --tablance-accent-color: #2563EB;
  --tablance-indicator-color: #0D2B59;
}
```

Text-like action cells and read-only cells display their native navigation and lock indicators on hover or selection. The indicators are non-interactive absolute overlays and do not affect cell content or geometry.

## Contextual help

Set `help` on a titled details entry to show a non-navigable `?` in the title's fixed help slot. Main columns may also
have `help`, but do not display header icons: hovering their title briefly shows the column help, while F1 opens it for
the selected cell. A string is always rendered as text. A callback receives the standard cell context and may return a
string, a DOM `Node`, or a `DocumentFragment`; build rich help with DOM APIs rather than raw HTML. Detail-icon hover
shows transient help, click pins it, and F1 pins help only when the selected cell has `help`. Escape or an outside click
closes pinned help.

The permanent help trigger at the right edge of the main header renders root-schema `help` followed by sections for
main columns that have `help`; detail help is not included. Details containers without an existing visible title,
including transparent repeated containers, do not gain a heading solely for help.

Schema `title` values are rendered as text by default. Set `titleHtml: true` only for explicitly trusted title markup.

## Lineup variants

Lineups support `variant: "auto" | "fields" | "metadata" | "controls"`. The default `auto` variant resolves from
the schema: a non-button editor makes it a field lineup, action/button entries make it a controls lineup, and pure
presentation entries make it metadata. Use an explicit variant for intentionally mixed or otherwise ambiguous rows.

Field lineups present ordinary detail values separated into discrete horizontal cells. Metadata stays compact and
separator-free, while controls retain their button/action layout. Tab and Shift+Tab follow logical instance-tree order
through ordinary detail rows and lineups; horizontal-arrow and Enter behavior remain unchanged.

ArrowUp and ArrowDown retain structural detail navigation. Geometry is consulted only between visual rows created by
wrapping inside the same lineup; it is not used to infer columns between separate containers.

Lineups wrap by default; set `wrap: false` for a single flex row. Fields inside a lineup may reuse the schema-level
`width` property as a preferred flex basis and may opt into free-space growth with `grow: true` (equivalent to `1`) or
a non-negative numeric grow factor. Without `width`, a cell keeps its natural width; without `grow`, it never expands
merely because it is last. The outer lineup item is the canonical physical cell box used for cursor, hit testing and
navigation geometry, while its inner value element remains the rendering/editing surface.

Static values in field lineups wrap inside that canonical box. Normal text uses ordinary wrapping opportunities, and
an otherwise unbreakable string may break at any point rather than overflow into a neighbouring cell. Metadata lineups
retain their compact presentation and do not inherit this field-value wrapping rule.

## Details grids

Use `{type: "grid", columns: 2, entries: [...]}` for a fixed logical grid of equally flexible columns. Entries are
placed left-to-right and then top-to-bottom in schema order. A direct child may set `columnSpan` (default `1`); hidden
children do not occupy a slot, disabled children occupy their slot but are skipped by navigation, and read-only cells
remain navigable. Grid arrow navigation uses logical occupancy rows and columns without viewport geometry, while Tab
and Shift+Tab retain schema order.

`columns` may instead be a non-empty array of CSS track values, such as `columns: ["34ch", "34ch"]`. The array length
defines the logical column count. Grid renders one subtle full-width separator between each pair of logical rows.

Grid v1 intentionally excludes direct repeated children, explicit coordinates, row spans, responsive column changes,
and responsive column changes.

## Closed group rendering

Groups with `closedRender` render its result as text by default. A consumer that needs markup may explicitly opt in with
`closedRenderHtml: true`. HTML output must be trusted or escaped by the consumer.

```js
{
  type: "group",
  closedRenderHtml: true,
  closedRender: data => `<strong>${escapeHtml(data.name)}</strong>`,
  entries: []
}
```

## Multiple dependencies

`dependsOn` accepts either one identifier or an array of identifiers. With an array, dependent cells refresh when any
source changes and callback payloads receive `dependedValue` as an array in declaration order.
