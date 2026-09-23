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

## Search representations

Search uses a field's rendered value when `render` is configured, the visible option text for an unrendered select,
and the raw primitive value otherwise. Set `searchValue(payload)` when a field needs different or multiple searchable
representations. The callback receives the standard render payload plus `renderedValue` and may return one primitive
value or an array of primitive values; `null`, `undefined`, an empty array, objects, and nested arrays add no search
text. HTML and DOM results are reduced to their visible text.

Query text and every individual search representation normalize whitespace symmetrically: whitespace characters are
converted to ordinary spaces, consecutive whitespace is collapsed, and leading/trailing whitespace is removed.
Representations remain separate, so normalization never permits a match across field or representation boundaries.

For example, this makes both a stored and a formatted identifier searchable without exposing raw values for every
rendered field:

```js
{
  dataKey: "identityNumber",
  render: ({value}) => formatIdentityNumber(value),
  searchValue: ({value, renderedValue}) => [value, renderedValue]
}
```

## Clipboard representations

Ctrl+C resolves the selected logical cell from schema and row data; it does not read text from the rendered cell DOM.
Ordinary fields use their rendered text, selects use the visible option text, and trusted HTML renderers are reduced to
visible text without markup. A group is always one clipboard cell: it uses `closedRender` even while open, and has no
default representation when `closedRender` is absent.

Set `clipboardValue(payload)` on any logical cell node to override that default. The payload contains the standard
cell context plus `value`, `idValue`, `dependedValue`, `displayValue`, `displayText`, `rowData`, and `instanceNode`.
Return a string, number, bigint, or boolean for that one cell. `null` and `undefined` mean that no clipboard
representation exists; objects and arrays are not serialized. An empty string remains a valid, distinct
representation in the resolver, although direct Ctrl+C does not write empty clipboard text.

```js
{
  dataKey: "identityNumber",
  clipboardValue: ({value, displayText}) => value ?? displayText
}
```

### Row clipboard representations

Tablance can also resolve a DOM-independent, human-readable representation of a complete logical row. The generic
default uses the currently visible main-table data columns followed by presented details content, whether details is
open or not. Control columns and data outside the schema are excluded. Empty fields are omitted; read-only and
disabled presentation fields remain eligible. Details traversal honors `dataPath`, `visibleIf`, repeated data and its
presented sorting.

For a details group, Tablance first resolves the group's own clipboard representation using `clipboardValue` or
`closedRender`. When one exists—even an explicit empty string—it represents the complete subtree and the group's
children are not included. A group without a representation contributes its presented children instead. This row
behavior does not change ordinary Ctrl+C: direct group copy still treats the group as one logical cell and never
implicitly flattens it.

Set synchronous `clipboardRowValue(payload)` on the root schema to replace the generic row text completely. Its
payload is the standard root callback context (`tablance`, `schemaTree`, root `schemaNode`, `rowData`, `mainIndex`,
and lifecycle context), plus `defaultText`, `visibleColumns`, and `detailsSchema`. Return a string, number, bigint, or
boolean. As with `clipboardValue`, `null` and `undefined` mean no representation, objects and arrays are rejected,
and an empty string remains distinct from a missing representation.

```js
{
  clipboardRowValue: ({rowData, defaultText}) =>
    rowData.reference ? `Reference: ${rowData.reference}\n\n${defaultText}` : defaultText,
  main: {columns: [/* ... */]},
  details: {/* ... */}
}
```

Ctrl+Shift+C opens a small copy menu at the active cell. Its first command, "Copy whole row", uses the row resolver
even when the selected cell is in details; the item is disabled if the root row has no clipboard representation.
Enter copies the row without cell-specific success feedback, and Escape closes the menu. Ctrl+C remains direct
cell/group copy with its usual feedback. The menu is currently internal and does not expose a public
`clipboardScopes` API; range selection remains a separate interaction model.

### Cell ranges

Shift+Arrow and Shift+click select one rectangular range in either the main table's presented data columns or one
details `grid`. The ordinary cell cursor is the range head; the first cell remains its fixed anchor. Unmodified
navigation or pointer selection collapses the range. Main-table control columns, ordinary details cells, and movement
between separate grids are never part of a range. Grid `columnSpan` cells expand the logical bounds to cover their
complete span while remaining one clipboard value.

Ctrl+C on a multi-cell range resolves every logical data cell through the same DOM-independent clipboard resolver
and writes a tab/newline matrix. Copy success uses the ordinary copy/check animation at the visible range's upper-right
corner rather than attaching it to the head cell. Missing values and covered span positions are empty fields. The
clipboard also receives an HTML table when the browser supports rich clipboard writes; this is the interoperable
representation for cell values containing tabs or line breaks in spreadsheet applications. The plain text fallback
uses TSV with CSV-style quoting for such values. A one-cell range retains ordinary cell-copy behavior.

## Editable combobox inputs

Use `input.type: "combobox"` when a field stores unrestricted text but should offer common suggestions. Options use
the same static array or callback form as select options, but they do not define or restrict the stored value. The
complete suggestion list remains visible while editing. Arrow keys move through suggestions and immediately put the
active suggestion's text in the focused input; after free typing, Down starts at the first suggestion and Up at the
last. Pointer selection also inserts suggestion text without committing. Enter, Tab, outside focus, and Escape follow
the same commit, navigation, and cancel lifecycle as ordinary text inputs.

```js
{
  dataKey: "label",
  input: {
    type: "combobox",
    options: [{text: "Mobile"}, {text: "Home"}, {text: "Work"}]
  }
}
```

## Menu columns

Use a main-table column with `type: "menu"` for row actions that do not represent or edit a data value. Menu columns
are never sortable or searchable. Their `actions` may be an array or a callback receiving the standard cell payload.
Actions use `onSelect` and may set `disabled` to a boolean or a callback. A disabled action remains visible and
keyboard-navigable; set `disabledReason` to a string or callback to explain why it is unavailable.
An optional `beforeSelect` callback may return `false` to cancel activation without closing the menu.
Use `label` (or the existing `text`/`title`) to set the visible copy and optional `icon` for a named icon such as
`"trash"` or `"restore"`, or an `Element`; both fields may be callbacks receiving the action payload. Icons are
cloned before rendering, so descriptors remain reusable. Omit `icon` for a text-only action. Built-in trash actions
use `lang.trashAction`/`lang.restoreAction` and the corresponding icons by default; `label` and `icon` override them.
Add `{type: "copyRow"}` explicitly to a row menu to offer the same whole-row copy operation as Ctrl+Shift+C.
Its default label is `lang.copyWholeRow` ("Copy whole row") with the same copy icon used by cell feedback;
the icon can be overridden with `icon`. The action is disabled when that row has no clipboard
representation. It uses the menu row, not the current cell cursor, and does not show cell-specific copy feedback.
A menu column never adds this action automatically. A custom `label` and the usual action-level `disabled` rule may
further customize it, but cannot enable a row with no clipboard representation.
Pointer opening leaves all actions unfocused until the pointer actually hovers an item or keyboard navigation begins.
Keyboard opening with Enter/Space focuses the first action immediately. After pointer opening, Arrow Down starts at
the first action and Arrow Up at the last. Hover and keyboard focus are independent visual states, including for
disabled actions; disabled actions remain navigable and explanatory but cannot be activated.

```js
{
  type: "menu",
  width: 45,
  ariaLabel: ({rowData}) => `Actions for ${rowData.name}`,
  actions: ({rowData}) => [
    {type: "copyRow"},
    {
      id: "open",
      text: "Open",
      onSelect: ({rowData, mainIndex, event}) => openRow(rowData, mainIndex)
    },
    {
      id: "archive",
      text: "Archive",
      disabled: rowData.locked,
      disabledReason: rowData.locked ? "The row is locked" : "",
      onSelect: ({rowData}) => archiveRow(rowData)
    }
  ]
}
```

Clicking the cell or its `⋮` control opens the menu. Enter and Space do the same for a selected menu cell. Within the
menu, Arrow Up/Down, Home/End, Enter/Space, Escape, and Tab follow the table's keyboard and focus model. Closing the
menu returns focus to the table cursor unless focus is intentionally moving elsewhere through an outside click.

## Commit lifecycle

Every edit uses one `prepare → handoff → finalize` lifecycle. Direct fields produce a one-commit transaction. Nested
groups belong to the implicitly outermost open group transaction and are handed off once in root-to-leaf order. Live
group drafts remain in `rowData`, but snapshots distinguish draft state from finalized state; no post-commit effect,
snapshot cleanup, or committed closed presentation runs before handoff succeeds.

```js
{
  commit: (transaction, context) => outbox.journalAtomically(transaction.commits),
  afterCommit: (transaction, context) => updateExternalUi(transaction),
  details: {type: "list", entries: [{
    type: "group",
    validate: payload => payload.data.valid || payload.preventClose("Invalid value"),
    afterDiscard: payload => updateUiAfterRestore(payload),
    entries: []
  }]}
}
```

`validate(payload)` is synchronous and side-effect free. It may call `payload.preventClose(message)` or return
`false`/`{valid:false, message}`. The optional root `commit(transaction, context)` receives the complete transaction:

- without `commit`, Tablance finalizes immediately;
- a synchronous return finalizes immediately after return;
- a Promise locks the editor/group and finalizes after resolution;
- a throw or rejection keeps the draft and snapshots available for retry or Ctrl+Escape.

A Promise is a local durability boundary only; it must not wait for a server response. For a direct field, Tablance
keeps the editor open and the final `rowData` value unchanged until resolution. A group retains its live draft model
while pending and marks the transaction boundary `aria-busy`.

Commits use immutable `update`, `create`, `delete`, or `reorder` kinds. Structural commits provide
`collection: {nodeId, dataKey}`, `itemIndex`, and `visualIndex`. A create followed by more edits in the same transaction
is represented once with its final data, while create followed by delete cancels before handoff. A reorder descriptor
contains immutable `baselineOrder` and final `order`; consumers that cannot persist semantic set-order safely should
reject that transaction. The transaction, descriptors, cloned `rowData`, `data`, `sourceData`, `parentData`, `changes`,
and `instancePath` are frozen. Each descriptor also provides `index`, `depth`,
`parentCommitIndex`, `nodeId`, `schemaNode`, and `mainIndex`.
For group transactions, immutable `baselineRowData` contains the row snapshot captured when the outer group opened;
aggregate consumers can compare it with final `rowData` and avoid journaling semantic no-ops. Standalone field
transactions expose `baselineRowData: null`.
`schemaNode` is an immutable metadata snapshot (`nodeId`, `type`, `dataKey`, `dataPath`, and `meta`), not the live
schema facade.

`context` deliberately stays ephemeral and is not journal data. It provides `tablance`, the live `rowData`, and
`dataFor(commit)`, `sourceDataFor(commit)`, `parentDataFor(commit)`, `schemaNodeFor(commit)`, and
`closestMetaFor(commit, key)` for integrations that must resolve live objects while handing off the immutable command.

After successful handoff, synchronous root `afterCommit(transaction, context)` runs exactly once. It is only for
post-commit effects. An error is reported as `transactionpostcommiterror` and cannot roll back a durable commit.
`afterDiscard(payload)` runs after actual snapshot restoration and must also be synchronous. Repeated deletion may be
guarded by synchronous `validateDelete(payload)` before mutation. The removed callbacks `onDataCommit`, `onClose`,
`onCreate`, `onDelete`, and their transactional-mode variants are not part of this lifecycle.

## Trash lifecycle and table actions

Trash is opt-in and uses the same `setData`/`addData` source array as active rows. Tablance does not fetch rows or
assume a field name. `isTrashed` classifies a row; `getChanges` returns a non-empty, shallow root-row update diff that
must make `isTrashed` reflect the requested operation. Tablance applies that diff and sends an `update` descriptor
through the root `commit` hook with `operation: "trash" | "restore"`. The consumer persists it;
there is no built-in asynchronous confirmation or rollback. Related entries are not changed.

```js
{
  trash: {
    isTrashed: ({rowData}) => rowData.removedOn != null,
    getChanges: ({operation}) => ({
      removedOn: operation === "trash" ? new Date().toISOString() : null
    })
  },
  commit: (transaction, context) => persist(transaction, context),
  main: {
    toolbar: {tableActions: [{type: "trash"}]},
    columns: [
      {dataKey: "name", input: {type: "text"}},
      {type: "menu", actions: [
        {type: "trash"},
        {label: "Other action", icon: "restore", disabled: ({lifecycleMode}) => lifecycleMode === "trash",
          disabledReason: "Available only for active rows", onSelect: otherAction}
      ]}
    ]
  }
}
```

The capability and its controls are independent: omit either menu to keep the capability without that control.
`main.toolbar.tableActions` also accepts ordinary menu action descriptors or a callback returning an array. The
table-level `⋮` is shown only when that declaration resolves to at least one action; by default it lives in
`toolbar-right`, separate from sortable column headers and contextual help. A table-level `{type: "trash"}` toggles between active
rows and trash. In a row menu, the same descriptor trashes or restores the current row. Other actions remain visible
in trash; use the existing `disabled`/`disabledReason` callbacks and `lifecycleMode` payload to control them.

Set `opts.tableUtilitiesPlacement: "table"` to place common table help (`?`) and table actions (`⋮`) together in a
dedicated, non-data area at the right end of the column-header row, before the scrollbar gutter. The default,
`"default"`, preserves the existing header/toolbar locations. The area is omitted when neither utility has content;
toolbar search, insert actions, and view controls are unaffected. If `showHeader: false`, placement falls back to
`"default"` so table actions remain accessible without a header row.

`setLifecycleMode("active" | "trash")` switches lifecycle mode, and `trashRow(rowData, "trash" | "restore")` performs
the mutation directly. Both require `trash` to be configured. Lifecycle classification precedes normal views and
search: no normal view, even an all-rows view, can include trashed rows. Trash ignores normal view predicates and
has its own search text. Switching back restores the active view key and active search text. `getViewState()` and
`viewstatechange` add `lifecycleMode`, `activeViewModeKey`, and `counts.active`/`counts.trash` for enabled tables;
`viewModeKey` is `null` in trash. Tables without trash omit lifecycle mode and active/trash totals.

Set `main.resultStatus: true` to add a non-scrolling result status directly below the row viewport. It reports the
current Tablance view and search result. At zero results the count remains visible while a contextual empty state
inside the viewport explains why no rows are shown.
`getViewState().counts` retains committed `source`/`lifecycle`/`view`/`filtered` counts and also exposes the same
pipeline under `counts.visible`, including local draft rows. Result status uses `counts.visible.view` as its
denominator and `counts.visible.filtered` as its numerator. Language keys beginning with `result` customize the
default labels and templates; `main.resultStatus` may instead provide `itemLabel`, `formatter`, or `emptyFormatter`
callbacks for table-specific wording.

Toolbar controls support declarative visibility. `visible` may be a boolean or callback receiving the standard
Tablance payload plus `viewState`. It is supported by `toolbar.items`, and by object forms of `defaultInsert` and
`viewSwitcher`; search visibility is declared as `toolbar.search.visible`. Existing toolbar buttons and view controls
remain active-only by default, while search remains visible in every lifecycle mode. Visibility follows the element
even if a consumer reparents that Tablance-created control.

Main columns support the same declarative `visible` boolean or callback. The callback receives the standard payload
plus `viewState`, so a column may be active-only, trash-only, or depend on another Tablance-known view state. Tablance
keeps the complete declaration as its source and rebuilds the effective header, rows, search fields, sorting indexes,
cursor anchor, and fixed/proportional widths when visibility changes during a lifecycle or view switch. A sort whose
column disappears is removed; a still-visible sorted or focused column is remapped to its new effective index.

When a trash-enabled table renders a view switcher, trash mode replaces its ordinary view options with a visible
lifecycle return control in the same control group. Its label uses `lang.backToActive` (default `Leave trash`); the
table-menu action remains available as the second lifecycle navigation path. Search uses `lang.filterPlaceholder`
in active mode and `lang.filterPlaceholderTrash` in trash mode.

Trash mode shows the same columns but does not allow ordinary field editing, new rows, bulk editing, or changing
details controls. Expand/collapse, row menus, table actions and read-only inspection remain available. The default
visibility of toolbar buttons and normal view controls is active-only and can be overridden declaratively per
control. Programmatic `updateData` remains available for external
data synchronization; it does not create a persistence commit by itself.

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

## Repeated group previews

Entries in `repeated.grouping.order` may set `preview` to compact that group while its enclosing group is closed.
`preview.title` replaces the group title in that state, `preview.include(data, context)` filters candidates without
changing their existing visible and sorted order, and `preview.maxEntries` limits the remaining candidates. The
callback context contains `{entries, rowData, groupKey, repeatedInstance}`, where `entries` is the group's visible
data in presentation order. Opening the enclosing group restores the normal title and every ordinarily visible entry.
Previewing reuses the same repeated instances and never changes backing data, paths, sorting, or `visibleIf` state.

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
