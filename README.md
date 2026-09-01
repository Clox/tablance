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
- `readOnly`: selectable but never mutable. Pure presentation fields can open a native read-only text presentation;
  a field with a configured editor that is currently locked cannot be activated.
- `action`: selectable and activatable but not mutable; activation invokes a control or callback.
- `disabled`: unavailable, non-selectable, non-activatable and non-mutable.

State precedence is `disabled`/`disabledIf`, action/control, `readOnly`, implicit read-only (no input and no action), `editableIf`, then editable. `readOnly: true` therefore wins over `editableIf: true`, while disabled always wins over both.

`editableIf(payload)` may return `false` or `{editable: false, message}`. `disabledIf(payload)` may return `true` or `{disabled: true, message}`. Presentation fields without `input` or `onEnter` are implicitly read-only. Buttons, expand/select controls, groups, and fields with `onEnter` but no input are action cells.

The former `input.enabledIf` API was removed in 2.0. Use schema-level `editableIf`; use `disabledIf` when a cell is genuinely unavailable rather than merely locked for editing. `input.disabled` is not an API.

## Read-only presentation

Enter or double-click on a read-only cell opens a `readonly` textarea containing the cell's rendered text. Native caret movement, partial selection and copying work there. Escape or blur closes it, and Tab returns to grid navigation. Outside presentation mode, Ctrl+C continues to copy the complete rendered cell text. Save and bulk-save paths also verify the canonical state, so read-only cells cannot invoke validation, change, or commit callbacks.

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
