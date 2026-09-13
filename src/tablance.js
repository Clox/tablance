
/** Symbol used to tag wrapper objects to avoid ever double-wrapping. Symbol used over string but not really needed. */
const SCHEMA_WRAPPER_MARKER=Symbol("schemaWrapper");

const TABLANCE_VERSION = typeof __TABLANCE_VERSION__!=="undefined"?__TABLANCE_VERSION__:"dev";
const TABLANCE_BUILD = typeof __TABLANCE_BUILD__!=="undefined"?__TABLANCE_BUILD__:"dev";
let helpPopoverId=0;

// Shared prototype for instance-nodes so utility getters stay in sync after inserts/deletes.
const INSTANCE_NODE_PROTOTYPE=Object.create(null);
Object.defineProperties(INSTANCE_NODE_PROTOTYPE,{
	previousSibling:{get() {
		const siblings=this.parent?.children;
		return siblings!=null&&Number.isInteger(this.index)?siblings[this.index-1]:undefined;
	}},
	nextSibling:{get() {
		const siblings=this.parent?.children;
		return siblings!=null&&Number.isInteger(this.index)?siblings[this.index+1]:undefined;
	}},
	closestMeta:{value(metaKey) {
		return this.tablance?._closestMeta(this.schemaNode, metaKey);
	}}
});
const SELECTABLE_DETAILS_NODE_PROTOTYPE=Object.assign(Object.create(INSTANCE_NODE_PROTOTYPE),{
	select() {
		return this.tablance?._selectDetailsCell(this);
	}
});
const FIELD_INSTANCE_NODE_PROTOTYPE=Object.create(SELECTABLE_DETAILS_NODE_PROTOTYPE);
const GROUP_INSTANCE_NODE_PROTOTYPE=Object.create(SELECTABLE_DETAILS_NODE_PROTOTYPE);
const REORDER_INSTANCE_NODE_PROTOTYPE=Object.create(SELECTABLE_DETAILS_NODE_PROTOTYPE);
const REPEATED_INSTANCE_NODE_PROTOTYPE=Object.create(INSTANCE_NODE_PROTOTYPE);
REPEATED_INSTANCE_NODE_PROTOTYPE.createNewEntry=function(e,_groupObject) {
	e?.preventDefault?.();
	let repeatData=this.dataObj;
	if (!Array.isArray(repeatData))
		this.dataObj=repeatData=[];
	const mainIndex=this.rowIndex??this.tablance?._mainRowIndex??0;
	const payload=this.tablance?._makeCallbackPayload(this,{
		dataArray:repeatData,
		itemIndex:repeatData.length,
		repeatedSchemaNode:this.schemaNode
	},{schemaNode:this.schemaNode,mainIndex});
	const createdData=typeof this.schemaNode.createData==="function"
		?this.schemaNode.createData(payload):{};
	if (createdData==null||typeof createdData!=="object"||Array.isArray(createdData))
		throw new TypeError("repeated.createData must return an object.");
	if (repeatData.includes(createdData))
		throw new TypeError("repeated.createData must return a new object identity.");
	const pendingData=createdData;
	this.tablance?._repeatInsert(this,true,pendingData);
};

const DEFAULT_LANG=Object.freeze({
	fileName:"Filename",
	fileLastModified:"Last Modified",
	fileSize:"Size",
	fileType:"Type",
	fileUploadDone:"Done!",
	fileChooseOrDrag:"<b>Press to choose a file</b> or drag it here",
	fileDropToUpload:"Drop to upload",
	filterPlaceholder:"Search",
	delete:"Delete",
	deleteAreYouSure:"Delete this entry?",
	deleteAreYouSureYes:"Delete",
	deleteAreYouSureNo:"Cancel",
	datePlaceholder:"YYYY-MM-DD",
	selectNoResultsFound:"No results found",
	selectEmpty:"<None>",
	selectCreateOption:"Create [{text}]",
	booleanTrue:"Yes",
	booleanFalse:"No",
	copiedToClipboard:"Copied to clipboard!",
	insertEntry:"Insert new",
	insertRow:"Insert new",
	creationValidationFailed:"Invalid entry. Please check the fields and try again.",
	creationValidationFailedCancelInfo:"\n Select Delete to cancel.",
	fieldValidationFailedHint:"Press Esc to cancel.",
	groupValidationFailedHint:"Press Ctrl+Esc to discard changes and back out.",
	helpLabel:"Help",
	viewsLabel:"Views",
	reorder:"Change order",
	reorderUp:"Move up",
	reorderDown:"Move down",
});
let defaultLangOverrides=Object.create(null);


/** 
 * Base class providing shared table logic, structure management,
 * data handling, and rendering helpers etc used by both Tablance and TablanceBulk.
 */
class TablanceBase {
	hostEl;//the element that is passed to the constructor and which the table is added to
	rootEl;//Readonly, container-element for table
	neighbourTables;//Object of other Tablance-instances. Possible keys are "up" and "down". If any of these are set
				//then if one keeps pressing up/down until there are no more cells then one will get o the next table.
				//Except for manually this can also be set via chainTables()
	_containerHeight=0;//height of #container. Used to keep track of if height shrinks or grows
	_containerWidth=0;//height of #container. Used to keep track of if width shrinks or grows
	_colSchemaNodes;//column-objects. Essentially the same as schema.main.columns but have been processed an may in
		// addition contain "sortDiv" reffering to the div with the sorting-html (see for example opts->sortAscHtml)
	_cols=[];//array of col-elements for each column
	_headerTr;//the tr for the top header-row
	_headerTable;//the tabe for the #headerTr. This table only contains that one row.
	_sourceData;//complete dataset provided to the table; table never mutates this array and it reflects all rows provided
	_viewData;//rows belonging to the active viewMode, derived from _sourceData before any filtering/search
	_filteredData;//rows after applying search/filter pipeline to _viewData; rendering consumes this dataset
	_currentViewModeKey="default";//active viewMode key
	_viewDefinitions=Object.create(null);//lookup table of viewMode predicates keyed by view name
	_viewSwitcher;//optional segmented toolbar control for schema.views
	_refreshingView=false;//guards commit flushing while rebuilding the active view pipeline
	_scrollRowIndex=0;//the index in the #data of the top row in the view
	_scrollBody;//resides directly inside #container and is the element with the scrollbar. It contains #scrollingDiv
	_toolbar;
	_tableArea;//focusable area containing the header and scrollable rows, but not the toolbar
	_focusEl;//the element receiving spreadsheet focus (tableArea, or rootEl for details-only tables)
	_scrollingContent;//a div that is inside #scrollbody and holds #tablesizer and #cellCursor if spreadsheet
					//this is needed because putting #cellCursor directly inside #scrollBody will not make it scroll
					//because it has position absolute and needs that. And putting it inside #tableSizer will cause it
					//to jump up and down when pos and height of #tableSizer is adjusted to keep correct scroll-height
	_scrollMarginPx=150;//is used to allow for more rows to be rendered outside of the view so to speak. At least in
						//firefox when scrolling it is really noticable that the scrolling is done before the rows are
						//moved which reveals white area before the rows are rendered. Increasing this number will
						//basically add that many pixels to the height of the viewport on top and bottom. It will not
						//actually be higher but the scroll-method will see it as if it is higher than it is
	_tableSizer;//a div inside #scrollingDiv which wraps #mainTable. The purpose of it is to set its height to the 
				//"true" height of the table so that the scrollbar reflects all the data that can be scrolled through
	_mainTable;//the actual main-table that contains the actual data. Resides inside #tableSizer
	_mainTbody;//tbody of #mainTable

	_bulkEditArea;//a div displayed under #scrollBody if rows are selected/checked using select-column. This 
						//section is used to edit multiple rows at once
	_bulkEditTable;//this holds another instance of the Tablance class which is used inside the bulk-edit-area
	_bulkEditAreaOpen=false;//whether the section is currently open or not
	_bulkEditSchemaNodes;//Array of schema-nodes with inputs that are present in the bulk-edit-area
	_bulkEditAreaHeightPx;//height of bulk-edit-area in px. Used to animate from 0 to full height when opening/closing
	_numberOfRowsSelectedSpan;//resides in the bulk-edit-area. Should be set to the number of rows selected
	_borderSpacingY;//the border-spacing of #mainTable. This needs to be summed with offsetHeight of tr (#rowHeight) to 
					//get real distance between the top of adjacent rows
	_rowHeight=0;//the height of (non expanded) rows with #borderSpacingY included. Assume 0 first until first row added
	_rowInnerHeights=[];//inner div height per column, used to keep fixed-height rows equal when cells have different
					//vertical padding or borders
	_staticRowHeight;//This is set in the constructor. If it is true then all rows should be of same height which
					 //improves performance.
	_naturalAutoHeight;//true when every row is rendered and allowed to take its natural height in autoHeight mode
	_spreadsheet;//whether the table is a spreadsheet, which is set in the constructor
	_opts; //reference to the object passed as opts in the constructor
	_sortingCols=[];//contains data on how the table currently is sorted. It is an array of 
										//objects which each contain "index" which is the index of the column and
										//"order" which value should be either "desc" or "asc". The array may contain
										//multiple of these objects for having it sorted on multiple ones.
	_searchInput;//the input-element used for filtering data
	_filter;//the currently applied filter. Same as #searchInput.value but also used for comparing old & new values
	
	_cellCursor;//The element that for spreadsheets shows which cell is selected
	_mainRowIndex;//the index of the row that the cellcursor is at
	_mainColIndex;//the index of the column that the cellcursor is at.
	_activeSchemaNode;//reference to the schemaNode-object of the selcted cell. For cells in the maintable this would
						//point to an object in #colSchemaNodes, otherwise to the schemaNode-object of details-cells
	_cellCursorDataObj;//reference to the actual object holding the data that the cell-cursor currently is at.
						//Usually this will simply point to an object in #data but for data that is nested with
						//repeat-entries this will point to the correct inner object
	_selectedCellVal;//the value of the cell that the cellCursor is at
	_selectedCell;//the HTML-element of the cell-cursor. probably TD's most of the time.
	_cellStates=new WeakMap();//canonical functional state for every currently rendered cell element
	_selectedCellState;//canonical state for the selected cell; DOM classes are styling hooks only
	_activeVerticalLayout=null;//logical layout whose preferred column is active during vertical navigation
	_activeVerticalLayoutColumnKey=null;
	_inEditMode;//whether the user is currently in edit-mode
	_editModeController;//optional non-field editor participating in the ordinary commit/cancel/navigation lifecycle
	_inReadOnlyMode=false;//whether a read-only presentation textarea is currently open
	_readOnlyDisplayedText;//immutable displayed text used while read-only presentation mode is open
	//and values are px as ints. This is used to offset the position and adjust position of #cellCursor in order to
	//center it around the cell. It is also used in conjunction with cellCursorOutlineWidth to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	_inputVal;//the current val of the input when in edit-mode. Will be read and commited if cell is exited correctly
	_inlineEditorHost;//value-scoped editor layer for details cells whose title shares the canonical cell box
	_inlineEditorValueEl;
	_inlineEditorValueHeight;
	_highlightOnFocus=true;//when the spreadsheet is focused  we want focus-outline to appear but only if focused by
				//keyboard-tabbing, and not when clicking or exiting out of edit-mode which again focuses the table.
				//By setting this to true in mouseDownEvent we can 
				//check which input was used last when the focus-method is triggerd
	_detailsBordersHeight;//when animating details-pane for expanding/contracting the height of them fully
			//expanded needs to be known to know where to animate to and from. This is different from 
			//#expandedRowIndicesHeights because that is the height of the whole row and not the div inside.
			//we could retrieve offsetheight of the div each time a row needs to be animated or instead we can get
			//the border-top-width + border-bottom-width once and then substract that from the value of  what's in
			//#expandedRowIndicesHeights instead
	_scrollMethod;//this will be set to a reference of the scroll-method that will be used. This depends on settings for
				//staticRowHeight and details
	_fileMeta=new WeakMap();//Tracks upload progress per File object (uploadedBytes, progress bars, etc.)
	_rowFilterCache;//per-row filter text cache keyed by row data objects
	_selectedRows;//array of the actual data-objects of rows that are currently selected/checked using the select-col
	_scrollY=0;//this keeps track of the "old" scrollTop of the table when a scroll occurs to know 
	_numRenderedRows=0;//number of tr-elements in the table excluding tr's that are details (details too are tr's)
	_openDetailsPanes;//for any row that is expanded and also in view this will hold navigational data which
						//is read from when clicking or navigating using keyboard to know which cell is next, and
						//which elements even are selectable and so on. Keys are data-row-index. As soon as a row
						//is either contracted or scrolled out of view it is removed from here and then re-added
						//if expanded again or scrolled into view.
						//keys are rowDataindex and the values are instanceTrees rooted at an instance-node shaped as:
						//	el: HTMLElement the cell-element itself
						//	selEl: optional canonical selection/state/hit-test element when it differs from el
						//	cursorEl: optional visual geometry element used only for drawing the cell cursor
						//	children: Array May be null but groups can have children which would be put in here
						//  				each element would be another instance-node
						//	parent: points to the parent instance-node. for non nested cells this would point to a
						//						root instance-node. and for the root instance-node this would be null.
						//						despite the root being an instance-node it cant be naviagted to. 
						//						it simply holds the top instance-nodes
						//  index: the index of the node in the children-array of its parent
						//	prevSibling/nextSibling: getters for adjacent siblings (null if none)
						//}
	_activeDetailsCell;	//points to an object in #openDetailsNavMap and in extension the cell of an details.
							//If this is set then it means the cursor is inside an details.
	/* #generatingDetails=false;//this is a flag that gets set to true when a row gets expanded or an already expanded
		//row gets scrolled into view, in short whenever the details-elements are generated. Then it gets unset when
		//creation finishes. The reason for having this flag is so that update */
	_editTransaction;//tracks buffered group commits so inner scopes can still be cancelled
	_ignoreClicksUntil;//when being inside an open group and trying to double-click on another cell further down to


		//interact with it the first click will highlight it but then the current group closes and what's below it will
		//get shifted up and the second click hits something else. By setting this var to current time plus 500 ms
		//when a group closes and checking if current time is past this one in mouseDown handler we'll ignore the second
		//click which is better user-experience
	_highlightRowsOnView;//Rows can be added to this object with rowindex in #data as key, value needs to be truthy.
		//Rows that are outside of view can be added and when scrolled into view they will be highlighted. 
	_lastCheckedIndex;//This is the index of the row that was last (un)checked/selected, meaning the checkbox in the
					//select-column was interacted with. This is used if the user interacts with another checkbox while
					//shift is being held
	_numRowsSelected=0;//number of rows that are selected/checked using the select-column
	_numRowsInViewSelected=0;//number of rows in the current view/filter that are selected/checked using select-column
	_animations={};//keeps tracks of animations. Key is a unique id-string, identifying the animation so multiple
					//instances of the same animation can't run. Value is the end-time in ms since epoch.
	_onlyDetails;//If this is set to true then the table will not have any actual rows and will instead only have an
					// details specified in param details. It will also not have a scrollpane and the details will
					// always be expanded. Method addData is still used to add the actual data but it will only use the
					// last row sent. So adding multiple ones will cause it to discard all but the last.
	_tooltip;//reference to html-element used as tooltip
	_helpPopover;//single contextual-help popover reused by this Tablance instance
	_helpState;//current help target/context and whether the popover is pinned
	_helpOpenTimer;
	_helpCloseTimer;
	_helpResizeObserver;
	_lineupResizeObserver;
	_readOnlyFeedbackTarget;
	_readOnlyFeedbackTimer;
	_dropdownAlignmentContainer;
	lang;//object holding strings used in the table for various purposes. See DEFAULT_LANG for default values					
	_rowMeta;//tracks row metadata (isNew flags, expanded heights, etc.) keyed by row data objects


	/**
	 * Set of unique select input definitions used for filtering.
	 *
	 * Purpose:
	 * This cache exists to support efficient filtering of rows that depend on
	 * select-type inputs. During filtering, the current option values for each
	 * select input need to be resolved once per filter pass, rather than by
	 * repeatedly walking the schema tree.
	 *
	 * Design details:
	 *
	 * • Each entry is the `input` object of a schema node with `input.type === "select"`
	 * • The set is keyed by the input object itself (not by options or schema nodes)
	 * • This allows external code to freely mutate or replace `input.options`
	 *   without invalidating the cache
	 *
	 * Usage:
	 *
	 * • Iterated during filtering to derive the active option key/value mappings
	 * • Decouples filter logic from schema traversal
	 * • Prevents repeated schema walks on every filter keystroke
	 *
	 * Populated by `_collectFilterSchemaCaches`.
	 *
	 * @type {Set<Object>}
	 */
	_selectInputs;

	/**
	 * Ordered list of schema nodes that are eligible for text search.
	 *
	 * Includes:
	 * • All field nodes in `schemaRoot.main.columns` (unless `input.type === "button"`)
	 * • Field nodes found within the `schemaRoot.details` subtree
	 *
	 * Excludes:
	 * • Non-field container nodes (e.g. lists)
	 * • Fields with `input.type === "button"`
	 *
	 * The list is ordered according to schema traversal and is intended
	 * for repeated iteration during filtering/search operations.
	 *
	 * Populated by `_collectFilterSchemaCaches`.
	 *
	 * @type {Object[]}
	 */
	_searchableFieldNodes;


	/**
	 * @param {HTMLElement} hostEl An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			dataKey String A unique identifier for the column. The value in the data that has this key will be used
	 * 				as the value in the cell.
	 * 			onEnter Function Callback fired when the cell is entered (before edit mode). Receives
	 * 				{event,value,schemaNode,instanceNode,mainIndex,closestMeta,preventEnter}.
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			input: See param details -> input. This is the same as that one except textareas are only valid for
	 * 												details-cells and not directly in a maintable-cell
	 * 			render Function Function that can be set to render the content of the cell. The return-value is what
	 * 					will be displayed in the cell. It receives a payload from _makeCallbackPayload plus:
	 * 					- value: resolved cell value (dataKey wins when present, otherwise dependsOn*)
	 * 					- idValue: rowData[schemaNode.dataKey] (if dataKey is set)
	 * 					- dependedValue: the resolved dependee value when dependsOn* is used; an array when
	 * 						dependsOn contains multiple identifiers
	 * 			html Bool Default is false. If true then the content of the cell will be rendered as html
	 * 			type String The default is "data". Possible values are:
	 * 				"data" - As it it implies, simply to display data but also input-elements such as fields or buttons
	 * 				"expand" - The column will be buttons used for expanding/contracting the rows. See param details
	 * 				"select" - The column will be checkboxes used to (un)select rows	
	 * 		}
	 * 			
	 * 	@param	{Boolean} staticRowHeight Legacy row-height setting retained for call compatibility. Prefer
	 * 				opts.rowHeight; autoHeight now determines the default mode.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.
	 * 	The root schema may set help to provide general table help at the right edge of the main header. The same
	 * 		popover also collects help from main columns. Help accepts the safe content forms described below.
	 * 	The root schema may set views to an object keyed by view name. Each value may be a filter callback shorthand,
	 * 		or {title, filter}. Rows for which filter(rowData) returns true belong to that view. An all-rows `default`
	 * 		view is supplied when omitted. Set main.toolbar.viewSwitcher to true to render these views in the toolbar.
	 * 	@param	{Object} details This allows for having rows that can be expanded to show more data. An "entry"-object
	 * 			is expected and some of them can hold other entry-objects so that they can be nested.
	 * 			Properties that are valid for all types of entries:
	 * 				* title String displayed title if placed in a container which displays the title
	 * 				* titleHtml Bool Defaults to false. If true, title is rendered as HTML instead of text.
	 * 				* help String|Function Contextual help shown next to an already visible title. Strings are always
	 * 					rendered as text. A callback receives the standard cell context and must return a string, Node,
	 * 					or DocumentFragment. Repeated is a transparent container and receives no new heading for help.
	 *
	 
	 //todo visibleIf should get payload. (I think it already does but is not reflected in the docs here) The payload should also get valueBundle
	 * 				* visibleIf Function Optional callback that determines whether this entry should be visible.
	 * 					Receives a payload from _makeCallbackPayload plus:
	 * 					- value: resolved cell value (dataKey wins when present, select uses option.value when available)
	 * 					- idValue: rowData[schemaNode.dataKey] (if dataKey is set)
	 * 					- dependedValue: the resolved dependee value when dependsOn* is used
	 * 					The function is called whenever the entry is rendered or any of its dependencies
	 * 					(see `dependsOn`) change. It receives the following arguments:
	 * 						(1: The value from data pointed to by "dataKey"(or if dependsOn is set the value of that cell)
	 * 						2: data-row, 3: schemaNode, 4: main-index, 5: instanceNode)
	 * 					Return `true` to make the entry visible, or `false` to hide it.
	 *
	 * 					When hidden:
	 *   					- The entry’s DOM element is not displayed.
	 *   					- `render` will not be called for this entry.
	 *
	 * 					Visibility state:
	 *   					- The instanceNode receives an internal `hidden` flag when the entry is hidden.
	 *   					- `hidden` is read-only and should not be modified manually.
	 *   					- If the entry is visible, no `hidden` property is present.
	 *
	 *
	 * 				* dependsOn String|String[] Optional identifier(s) for entries that this entry depends on.
	 * 					Whenever the referenced entry is edited, this entry and its transitive dependents automatically
	 * 					refresh. Each concrete cell refreshes at most once per propagation, including when paths converge
	 * 					or contain a cycle.
	 * 					The refresh cycle includes:
 	 *						- Re-evaluating `visibleIf` (if provided).
	 *						- Re-rendering this entry (unless it is hidden).
	 *
 	 *					Targeting rules:
	 * 						1. If `nodeId` is set on the schemaNode of a field, that ID is the identifier of that entry.
	 * 						2. If `dataKey` is set (and `nodeId` is not), the value of `dataKey` becomes the entry’s identifier.
	 * 						3. `dependsOn` must match the identifier of another entry. If both `dataKey` and `nodeId` exist,
	 * 							`nodeId` takes priority.
	 * 			Types of entries:
	 * 			{
  	 *				type "list" this is an entry that holds multiple rows laid out vertically, each item in the list 
	 *							can have a title on the left side by specifying "title" in each item within the list
	 * 				entries Array each element should be another entry
	 * 				titlesColWidth:String Width of the column with the titles. Don't forget adding the unit.
	 * 					Default is null which enables setting the width via css.Setting 0/false turns it off completely.
	 * 				onBlur: Function Callback fired when cellcursor goes from being inside the container to outside
	 * 					It will get passed arguments 1:instanceNode, 2:mainIndex
	 * 				bulkEdit Bool Besides setting bulkEdit on input of fields it can also be set on containers which
	 * 							will add the container to the bulk-edit-area. Any input-fields in the container that
	 * 							have bulkEdit true will appear in the container there. Remember that both the container
	 * 							and input of fields have to have true bulkEdit for this to work. These can also be
	 * 							nested so if there's another group in the group where both have true bulkEdit and the
	 * 							inner group has inputs with true bulkEdit as well then multi-level groups will be 
	 * 							added to the bulk-edit-area. Containers in the bulk-edit-area appear as a normal cell
	 * 							at first but by entering it a page dedicated to that container is changed to.
	 * 				dependsOn String Can be set up to 
	 *			}
	 *			{	
	 *				type "lineup" similiar to a list but each item is inlined, meaning they will be lined up
	 *									in a horizontal line and will also wrap to multiple lines if needed
	 * 				entries Array each element should be another entry
	 * 				variant "auto"|"fields"|"metadata"|"controls" Semantic presentation. Auto (default) resolves
	 * 					to fields when a non-button editor is present, controls for action/button lineups, and metadata
	 * 					for presentation-only fields. Set explicitly for intentionally ambiguous lineups.
	 * 				wrap Bool Whether cells may wrap onto additional visual rows. Defaults to true.
	 * 				cssClass String Css-classes to be added to the lineup-div
	 * 				onBlur Function Callback fired when cellcursor goes from being inside the container to outside
	 * 					It will get passed arguments 1:instanceNode, 2:mainIndex
	 * 				bulkEdit Bool Besides setting bulkEdit on input of fields it can also be set on containers which
	 * 							will add the container to the bulk-edit-area. Any input-fields in the container that
	 * 							have bulkEdit true will appear in the container there. Remember that both the container
	 * 							and input of fields have to have true bulkEdit for this to work. These can also be
	 * 							nested so if there's another group in the group where both have true bulkEdit and the
	 * 							inner group has inputs with true bulkEdit as well then multi-level groups will be 
	 * 							added to the bulk-edit-area. Containers in the bulk-edit-area appear as a normal cell
	 * 							at first but by entering it a page dedicated to that container is changed to.
	 *	 		}
 *			{
	 *			type "grid" lays entries out in a fixed logical grid with equal-width columns
	 *			columns Positive integer number of equal flexible columns, or a non-empty array of CSS track values
	 *			entries Array of entries, placed left-to-right and then top-to-bottom in schema order. A repeated
	 *				container cannot be a direct grid child in Grid v1.
	 *			A direct child may set columnSpan to a positive integer no larger than columns. It defaults to 1.
	 *		}
	 *		{
  	 * 				type "field" this is what will display data and which also can be editable by specifying "input"
 	 * 				dataKey String the key of the property in the data that the row should display
	 * 				cssClass String Css-classes to be added to the field
	 * 				width Number|String Preferred width when the field is inside a lineup. Numbers are pixels and
	 * 					strings are CSS lengths. It becomes the flex basis; the cell may still shrink or wrap.
	 * 				grow Bool|Number Flex growth when the field is inside a lineup. Defaults to 0. True means 1;
	 * 					a non-negative number is used directly. No cell grows implicitly.
	 * 				render Function Function that can be set to render the content of the cell. The return-value is what
	 * 					will be displayed in the cell. Similiarly to columns->render it gets passed the following:
	 * 					1: The value from data pointed to by "dataKey". If dataKey is not set but dependsOn is then this
	 * 						will instead get passed the value that the dataKey of the depended cell points to, 
	 * 					2: data-row, 
	 * 					3: schemaNode,
	 * 					4: main-index, 
	 * 					5: instanceNode
	 * 				input Object defining the editor used when the field is editable. Cell state is configured on the
	 * 					schema node through readOnly, editableIf, disabled and disabledIf.
	 * 					{
	 * 					type String This is mandatory and specifies the type of input. Se further down for properties 
	 * 						specific to each type of input. The possible types are:
	 * 							"text"(single line text),
	 * 							"textarea"(multi-line text),
	 * 							"number"(number with stepper),
	 * 							"date"(a date and possibly time with a calendar),
	 * 							"select"(selection from a list of items. The values for cells may either be the "value" 
	 * 										specified in one the the options in "options", or it can be an actual 
	 * 										reference to the option)
	 * 							"button"(simple button)
	 * 							"file" (An input for uploading files. The data for a file entry may be a 
	 * 								File-object which it will be if the file has been uploaded during the current
	 * 								session. Or it may be an object which basically have the same properties
	 * 								as File:lastModified, name, size, type altough none of those properties are
	 * 								mandatory. Use property "fileUploadHandler" to handle the actual upload.)
	 * 					----Properties valid for ALL types of inputs----
	 * 						placeholder String adds a placeholder-string to the input-element
	 * 						validation Function A callback function which can be used to validate the data upon
	 * 							comitting it. Return true if validation was successfull.
	 * 							It gets passed the following arguments:
	 * 							1:newValue, 2: message-function - A function that that takes a message-string as its
	 * 							first argument. If it the validation didn't go through then this string will be
	 * 							displayed to the user. 3:schemaNode, 4:rowData, 5:mainIndex, 
	 * 							6:instanceNode(if details-cell)
	 *						title String String displayed title if placed in a container which displays the title
	 * 						bulkEdit Bool Whether this input should be editable via bulk-edit-area, the section that 
	 * 							appears when selecting/checking multiple rows using the select-col. Default is true if
	 * 							not in details, or false if in details.
	 * 							Containers can too be added to the bulk-edit-area by setting bulkEdit on the container.
	 * 						multiCellWidth Int For inputs that are present in the bulk-edit-area. This property can be 
	 * 							used to specify the number of pixels in width of the cell in that section.
	 * 						onChange Function Callback fired when the user has changed the value of the input.
	 * 							It receives a single object with:
	 * 							- newValue: the incoming value
	 * 							- oldValue: the previous value
	 * 							- schemaNode: schema node for the edited field
	 * 							- instanceNode: the instance node if in details
	 * 							- closestMeta: function(key) to read meta data closest to the schema node. In the schema
	 * 								objects may be specified via "meta" propert and this object may contain any custom
	 * 								data. This function allows reading that data easily. It traverses up the schema tree
	 * 								until it finds a meta with the specified key or reaches the root.
	 * 							- cancelUpdate: function() to prevent the value from being persisted
	 * 						onBlur Function Callback fired when cellcursor goes from being inside the container
	 * 							to outside. It will get passed arguments 1:instanceNode, 2:mainIndex
	 * 				readOnly Bool If true, the field is permanently read-only and cannot be activated.
	 * 				readOnlyPresentation Bool Explicit opt-in that lets a read-only field open a native read-only
	 * 					text presentation for native selection and copying. Read-only fields are
	 * 					non-activatable by default, including implicit presentation fields without input.
	 * 				editableIf Function Optional callback deciding whether an input field is editable. It receives a
	 * 							payload from _makeCallbackPayload plus:
	 * 							- value: resolved cell value (dataKey wins when present, select uses option.value when 
	 * 																										available)
	 * 							- idValue: rowData[schemaNode.dataKey] (if dataKey is set)
	 * 							- dependedValue: the resolved dependee value when dependsOn* is used
	 * 					Return false, or {editable:false,message:String}, to make the field read-only.
	 * 				disabled Bool If true, the cell is unavailable, non-selectable and non-activatable.
	 * 				disabledIf Function Optional callback with the same payload as editableIf. Return true, or
	 * 					{disabled:true,message:String}, to make the cell unavailable. Disabled takes precedence.
	 * 				Fields without input and without onEnter are implicitly read-only. Cells with onEnter but no input,
	 * 					buttons, expand/select controls and groups are action cells.
	 * 					----Properties specific to input "text"----
	 * 						format object When defined, Tablance automatically applies the specified pattern to 
	 * 							the <input> element as the user types. It can enforce numeric-only input, insert
	 * 							delimiters, and handle smart date validation.
	 * 							Supported properties:
	 * 							 - blocks:        			Array of block lengths to group the input (e.g. [4,2,2])
	 * 							 - delimiter:     			String inserted between blocks (default: none)
	 * 							 - numericOnly:   			Boolean, removes all non-digit characters
	 * 							 - date:          			Boolean, enables smart date validation
	 * 							 - stripDelimiterOnSave:	Boolean, if true delimiters are excluded in the saved data
	 * 							Examples:
	 * 							// Personnummer: 19900218-9999
	 * 							input: {
	 * 								type: "text",
	 * 								format: { blocks: [8, 4], delimiter: "-", numericOnly: true }
	 * 							}
	 * 							// Date (YYYY-MM-DD) with month/day clamping and leap-year handling
	 * 							input: {
	 * 								type: "text",
	 * 								format: { date: true, blocks: [4, 2, 2], delimiter: "-", numericOnly: true }
	 * 							}
	 * 							
	 * 						maxLength int Sets max-length for the string							
	 * 					----Properties specific to input "textarea"----
	 * 						maxHeight int Sets the max-height in pixels that it should be able to be resized to
	 * 					----Properties specific to input "file"----
	 * 						fileUploadHandler Function This callback will be triggered when the user does a file-upload.
	 * 							Arguments: 1:XMLHttpRequest - call open() on this to specify url and such,
	 * 							2: The File-object, 3:schemaNode,4:rowData,5:mainIndex,6:instanceNode(if in details)
	 * 						fileMetasToShow Object An object specifying which meta-bits to show. Default of all are true
	 * 							{filename Bool, lastModified Bool, size Bool, type Bool}
	 * 							May also be set via opts->defaultFileMetasToShow
	 * 						onOpenFile Function callback fired when the open-button is pressed. Receives a payload from
	 * 							_makeCallbackPayload plus {event,file,fileData:dataObj,btnObj}.
	 * 						deleteHandler Function callback-function for when the user deletes a file. It gets the 
	 * 							following arguments passed to it:
	 * 							1: Event, 2: File-object, 3:schemaNode,4:rowData,5:mainIndex,
	 * 							6:instanceNode(if in details)
	 * 					----Properties specific to input "select"----
	 * 						minOptsFilter Integer - The minimum number of options required for the filter-input to
	 * 							appear. Can also be set via param opts->defaultMinOptsFilter
	 * 						boolean Bool When true, Tablance supplies localized true/false options and presents them
	 * 							with checkbox visuals. Stored and committed values remain booleans. Editing still uses
	 * 							the normal select editor and its keyboard semantics.
	 * 						noResultsText String A string which is displayed when a user filters the 
	 * 							options in a select and there are no results. 
	 * 							Can also be set globally via param opts->lang->selectNoResultsFound
	 * 						options: Array Each element should be an object: {
	 * 							value * The value of the cell will be mapped to the option with the same value
	 * 							text String Unless a render-method has been set then this string will be shown
	 * 							pinned Bool If true then this option will be pinned at the top. Default is false
	 * 							cssClass: Css-classes to be added to the opt which actually is a li-element
	 * 						}
	 * 						allowCreateNew bool - Allows user to create new options.
	 * 								If this is true then minOptsFilter will be ignored, input-field is required anyway.
	 * 						createNewOptionHandler Function - Callback which is called when the user creates a new 
	 * 							option, which can be done if allowCreateNew is true. It will get passed arguments 
	 * 							1:new option-object,2:event, 3:dataObject,4:mainDataIndex,
	 * 							5:schemaNode,6:instanceNode(if inside details)
	 * 						selectInputPlaceholder String - A placeholder for the input which is
	 * 							visible either if the number of options exceed minOptsFilter or allowCreateNew is true
	 * 					}
	 * 					----Properties specific to input "button"----
	 * 						text String If type is "button" then this will be the text on it
	 * 						onClick Function A callback-function that will get called when the button is pressed.
	 * 							Receives payload from _makeCallbackPayload with {event,rowData,mainIndex,...}.
	 * 							It will get passed arguments 1:event, 2:dataObject
	 * 							,3:mainDataIndex,4:schemaNode,5:instanceNode(if inside details)
  	 * 				}
	 * 			}
	 * 			{
  	 * 				type:"repeated" Used for "repeated" sets of data. The same data-structure is repeated as many times 
	 * 					as there are data for it. This also allows adding/removing data on the fly and besides doing it 
	 * 					programatically there's a built in interface for the user to do that.
	 * 					Having a list-structure with a repeated->field basically works the same as having a list with
	 * 					multiple field-structures. List-structures can mix repeated(dynamic) and static fields.
	 * 					The structure could look something like:
	 * 								list
 	 * 									repeated
	 * 										field
	 * 									field1
	 * 									field2
 	 * 				dataKey String this should be the key of an array in the data where each object corresponds to each
	 * 							element in this repeated rows.
 	 * 				entry Object Any entry. May be item or list for instance. The data retrieved for these will be 1
	 * 								level deeper so the path from the base would be dataKeyOfRepeatedRows->arrayIndex->*
	 * 				create: Bool If true then there will be a user-interface for creating and deleting entries
	 * 				createData Function Optional callback invoked immediately before a new entry is rendered. It must
	 * 					return the initial data object and receives a standard callback payload plus dataArray,
	 * 					itemIndex and repeatedSchemaNode. Use this for context-dependent defaults; the returned object
	 * 					remains pending until the user commits data in the entry.
	 * 				onCreate Function Callback fired when the user has created an entry via the interface available if
	 * 					"create" is true. It is considered committed when the cell-cursor has left the repeat-row after
	 * 					having created it. Receives a single object:
	 * 					- newDataItem: the newly created data object
	 * 					- dataKey: optional key for the repeated array (creation context)
	 * 					- dataArray: optional repeated array reference (creation context)
	 * 					- itemIndex: index of the new item within dataArray
	 * 					- visualIndex: visual position before any post-commit sort
	 * 					- repeatedSchemaNode: the repeated container schema node
	 * 					- entrySchemaNode: the schema node for the created entry (often a group)
	 * 					- newInstanceNode: the instance node for the created entry
	 * 					- mainIndex: index of the root row
	 * 					- bulkEdit: true if triggered from bulk-edit
	 * 					- closestMeta: function(key) to read meta data closest to the schema node
	 * 					- cancelCreate: function() to abort the creation (removes the new item)
	 * 				onCreateOpen Function If the entry of the repeated is group and "create" is set to true, then this
	 * 					callback-function will be called when a new group is added, i.e. when the user interacts with
	 * 					insertEntry-cell, not when the data is actually created, that triggers "onCreate".
	 * 					It will get passed arguments: 1:instanceNode of the repeated-object
	 * 				onCreateCancel Function If the entry of the repeated is group and "create" is set to true, then this
	 * 					callback-function will be called when the creation of a new entry is canceled, either by leaving
	 * 					the group with no data inserted, or by pressing the delete/cancel-button.
	 * 					It will get passed arguments: 1:instanceNode of the repeated-object
	 * 				beforeDelete Function Synchronous callback fired before an entry is deleted. It receives the same
	 * 					context as onDelete plus remainingData (a shallow copy without the candidate) and
	 * 					preventDelete(message?).
	 * 					Call preventDelete or return false to leave the data, instance tree and DOM unchanged.
	 * 				onDelete Function Lifecycle callback fired after the user has successfully deleted an entry via the
	 * 					interface available if "create" is true. Persistence is emitted once through root
	 * 					`onDataCommit`;
	 * 					use this callback only for local follow-up effects. Receives a payload object:
	 * 					- deletedDataItem: the deleted data object
	 * 					- dataKey: optional key for the repeated array (creation context)
	 * 					- dataArray: optional repeated array reference
	 * 					- itemIndex: index the deleted item had before removal
	 * 					- visualIndex: visual position the deleted item had before removal
	 * 					- repeatedSchemaNode: the repeated container schema node
	 * 					- entrySchemaNode: the schema node for the deleted entry (often a group)
	 * 					- deletedInstanceNode: the instance node for the deleted entry
	 * 					- mainIndex: index of the root row
	 * 					- bulkEdit: true if triggered from bulk-edit
	 * 					- closestMeta: function(key) to read meta data closest to the schema node
	 * 				sortCompare Function Passing in a function allows for sorting the entries. As expected this
	 * 					function will get called multiple times to compare the entries to one another.
	 * 					Sorting affects only rendered instances; backing-array order and object identity are unchanged.
	 * 					It gets 4 arguments: 1: object A, 2: object B, 3: rowData, 4: instanceNode
	 * 					Return >0 to sort A after B, <0 to sort B after A, or ===0 to keep original order of A and B
	 * 				grouping Object Optional presentational grouping of repeated entries:
	 * 					by String|Function Data-key or callback used to obtain each entry's group key. A callback
	 * 						receives 1: entry data, 2: rowData, 3: repeated instanceNode.
	 * 					order Array Optional explicit group order. Each item is {key:*,title:String}. Undeclared
	 * 						keys follow in stable first-occurrence order. Empty groups are not rendered.
	 * 					Grouping only changes presentation. Entry instances and backing-array identity remain flat,
	 * 					and sortCompare is applied only between entries in the same group.
	 * 				reorder Object Optional reorder editor for closed repeated entries.
	 * 					canMove(direction, payload) decides whether "up" or "down" is available.
	 * 					onCommit(payload) persists the accepted order. payload.baselineOrder and payload.order
	 * 					contain data objects; payload.refresh() reapplies canonical sorting after persistence.
	 * 					The handle is an internal auxiliary cell reached spatially from its entry. It is intentionally
	 * 					excluded from the repeated entry list and therefore from ordinary Tab/vertical navigation.
	 * 				creationText String Used if "create" is true. the text of the creation-cell. Default is "Insert new"
	 * 					May also be set via opts->lang->insertEntry
	 * 				deleteText String used if "create" is true. the text of the deletion-button. Default is "Delete"
	 * 					can also be set via param opts->lang->delete
	 * 				deleteAreYouSureText String Used if "create" is true. Text in the inline delete confirmation.
	 * 					Default is "Delete this entry?". Can also be set via param opts->lang->deleteAreYouSure
	 * 				areYouSureYesText String Used if "create" is true. Text of confirm-button for delete.
	 * 					Default is "Delete". Can also be set via param opts->lang->deleteAreYouSureYes
	 * 				areYouSureNoText String Used if "create" is true. Text of cancel-button for delete. Default is "Cancel"
	 * 					Can also be set via param opts->lang->deleteAreYouSureNo
	 * 				bulkEdit Bool If set to true then this will appear in the bulk-edit-area which allows editing
	 * 					repeated data for multiple data-rows at once. Applying the data does not append the data but it
	 * 					replaces it meaning the repeated rows already present in the selected rows are removed.
  	 * 			}
  	 * 			{
  	 * 				type "group" Used when a set of data should be grouped. An example is when having an address and
	 * 					all the rows in it belongs together. The group also has to be entered/opened with enter/dblclick
  	 * 				title String String displayed title if placed in a container which displays the title
	 * 				cssClass String Css-classes to be added to the group
  	 * 				entries Array Array of entries. fields, lists, etc.. 
	 * 				closedRender Function pass a method here that will get the data for the group as first arg.
	 * 								it needs to return a string which will replace the group-content when it is closed
	 * 				closedRenderHtml Bool Defaults to false. If true, closedRender output is inserted as HTML. Only
	 * 								enable this for trusted or escaped output; the default text rendering remains injection-safe.
	 * 				creationValidation Function If this group is placed within a repeated-container with create set to
	 * 								true then this function will be executed upon commiting the creation. The callback
	 * 								gets a single payload-object with the following keys:
	 * 								{
	 * 									schemaNode: Object - current schema-node
	 * 									newDataItem: Object - all entered data of the new item
	 * 									mainIndex: Number - index of the main row
	 * 									instanceNode: Object - the repeated instance
	 * 								}
	 * 								The callback should return either a boolean or an object:
	 * 									- Boolean: true passes validation; false fails and shows lang.creationValidationFailed
	 * 									- Object: {valid:Boolean,message:String?}. If no message is supplied,
	 * 										lang.creationValidationFailed is shown on failure.
	 * 				bulkEdit Bool Besides setting bulkEdit on input of fields it can also be set on containers which
	 * 							will add the container to the bulk-edit-area. Any input-fields in the container that
	 * 							have bulkEdit true will appear in the container there. Remember that both the container
	 * 							and input of fields have to have true bulkEdit for this to work. These can also be
	 * 							nested so if there's another group in the group where both have true bulkEdit and the
	 * 							inner group has inputs with true bulkEdit as well then multi-level groups will be 
	 * 							added to the bulk-edit-area. Containers in the bulk-edit-area appear as a normal cell
	 * 							at first but by entering it a page dedicated to that container is changed to.
	 * 				onOpen Function Function that fires when the group is opened, before it has been rendered.
	 * 					Gets passed the following arguments:
	 * 					1: tablanceEvent-object. It has a preventDefault-function that can be called in order to
	 * 					prevent the group from actually opening. 2: group-object
	 * 				onOpenAfter Function Function that fires when the group is opened, but after it has been rendered.
	 * 					Gets passed the following arguments:
	 * 					1: group-object
	 * 				onClose Function Callback that fires when attempting to close the group (create or edit).
	 * 					Call payload.preventClose(message?) to keep the group open and skip committing.
	 * 					If a message is passed it will be shown as a tooltip.
	 * 					Receives payload:
	 * 					- schemaNode: current schema-node
	 * 					- data: dataObj of the group
	 * 					- parentData: immediate parent data object (never the repeated array), null at root
	 * 					- instanceNode: instance-node of the group
	 * 					- mainIndex: index of the main row
	 * 					- mode: "create"|"update", whether the group was being created or already existed
	 * 					- changed: true for dirty existing groups and for pending creations whose current data differs
	 * 						from the initial draft produced by repeated.createData/render-time initialization
	 * 					- preventClose(message?): cancel closing/committing, optional tooltip message
	 *					- closestMeta: function(key) to read meta data closest to the schema node. In the schema
	 * 								objects may be specified via "meta" propert and this object may contain any custom
	 * 								data. This function allows reading that data easily. It traverses up the schema tree
	 * 								until it finds a meta with the specified key or reaches the root.
  	 * 			}
	 * 			Schema root may also define:
	 * 				onDataCommit Function Root-level persistence hook fired on the final commit flush (root->leaf).
	 * 					Receives payload from _makeCallbackPayload plus a changes diff and parentData. parentData is
	 * 					captured when the node is created so
	 * 					no ancestor walk is needed; it is always the owning object (never the repeated array), and
	 * 					null for root rows so persistence never has to inspect schema structure. dataKey/dataArray are
	 * 					included for creation context only so persistence can avoid inspecting schema shape. The
	 * 					onDataCommit payload is intentionally strict: legacy flags are not emitted, and creation-only
	 * 					fields are excluded for updates. Row creation is emitted via onDataCommit before any child
	 * 					commit when the row is still marked new.
	 * 				schema Object The full schema tree passed to the constructor (wrapper facade).
	 * 	@param	{Object} opts An object where different options may be set. The following options/keys are valid:
	 * 							searchbar Bool that defaults to true. If true then there will be a searchbar that
	 * 								can be used to filter the data.
	 * 							showHeader Bool that defaults to true. If false then the main table's header row
	 * 								is hidden.
	 * 							ordering Bool that defaults to true. If false then column-header sorting and its
	 * 								sort symbols are disabled.
	 * 							autoHeight Bool that defaults to false. If true then the table grows to fit all
	 * 								rows instead of using its own vertical scrollbar. Such tables use natural row
	 * 								heights by default.
	 * 							rowHeight String "auto" or "fixed". Defaults to "auto" with autoHeight and
	 * 								"fixed" otherwise. "auto" currently requires autoHeight.
	 * 							sortAscHtml String - html to be added to the end of the th-element when the column
	 * 													is sorted in ascending order
	 * 							sortDescHtml String - html to be added to the end of the th-element when the column
	 * 													is sorted in descending order
	 * 							sortNoneHtml String - html to be added to the end of the th-element when the column
	 * 													is not sorted
	 * 							defaultMinOptsFilter Integer The minimum number of options required for the
	 * 								filter-input of input-type "select" to appear
	 * 							defaultFileMetasToShow Object Default meta-data for files to show.
	 * 													See prop fileMetasToShow in param details
	 * 							lang Object {  Object to replace language-specific text. The strings may be html-code
	 * 										except for ones used as placeholders. Below are the keys and defaults.
	 * 								fileName "Filename"
	 * 								fileLastModified "Last Modified"
	 * 								fileSize "Size"
	 * 								fileType "Type"
	 * 								fileUploadDone "Done!"
	 * 								fileChooseOrDrag "<b>Press to choose a file</b> or drag it here"
	 * 								fileDropToUpload "Drop to upload"
	 *								filterPlaceholder "Search"
	 * 								delete "Delete" (used in the deletion of repeat-items or files)
	 * 								deleteAreYouSure "Are you sure?" (Used in the deletion of repeat-items or files)
	 * 								deleteAreYouSureYes "Yes"  (Used in the deletion of repeat-items or files)
	 * 								deleteAreYouSureNo	"No" (Used in the deletion of repeat-items)
	 * 								datePlaceholder "YYYY-MM-DD"
	 * 								selectNoResultsFound "No results found"
	 * 								insertEntry "Insert new" (Used in repeat-schemaNode if create is set to true)
	 * 								insertRow "Insert new" (Used for default toolbar insert button)
	 * 							}
	 * Language defaults for every instance can also be set through Tablance.defaultLang.
	 * */
constructor(hostEl,schema,staticRowHeight=true,spreadsheet=false,opts=null){
		this.lang=Object.assign(Object.create(null),DEFAULT_LANG,defaultLangOverrides,opts?.lang??{});
		this.hostEl=hostEl;
		const rootEl=this.rootEl = document.createElement("div");
		this.hostEl.appendChild(this.rootEl);
		this._spreadsheet=spreadsheet;
		this._opts=opts??{};
		const rowHeightMode=this._opts.rowHeight??(this._opts.autoHeight?"auto":staticRowHeight?"fixed":"auto");
		if (rowHeightMode!=="auto"&&rowHeightMode!=="fixed")
			throw new Error('opts.rowHeight must be either "auto" or "fixed".');
		if (rowHeightMode==="auto"&&!this._opts.autoHeight&&schema.main?.columns)
			throw new Error('rowHeight "auto" currently requires autoHeight: true.');
		this._staticRowHeight=rowHeightMode==="fixed";
		this._naturalAutoHeight=!!this._opts.autoHeight&&!this._staticRowHeight;
		rootEl.classList.add("tablance");
		rootEl.classList.toggle("static-row-height",this._staticRowHeight);
		rootEl.classList.toggle("natural-row-height",this._naturalAutoHeight);
		this._schema=this._buildSchemaFacade(schema);
		this._viewDefinitions=this._buildViewDefinitions(schema?.views);
		this._currentViewModeKey="default";
		this._resetDataState();
		this._rebuildViewData();
		this._filteredData=this._viewData;
		if (!schema.main?.columns) {
			this._setupSpreadsheet(true);
			this._onlyDetails=true;
		} else {
			// for (let col of this._schema.main.columns) {
			// 	let processedCol={};
			// 	if ((col.type=="expand"||col.type=="select")&&!col.width)
			// 		processedCol.width=50;
			// 	for (let [colKey,colVal] of Object.entries(col))
			// 		//if (allowedColProps.includes(colKey))
			// 			processedCol[colKey]=colVal;
			// 	this._colSchemaNodes.push(processedCol);
			// }
			this._colSchemaNodes=this._schema.main.columns;
			this._setupToolbar();
			this._tableArea=this.rootEl.appendChild(document.createElement("div"));
			this._tableArea.className="table-area";
			this._createTableHeader();
			this._headerTable.hidden=this._opts.showHeader===false;
			this._createTableBody();
			(new ResizeObserver(this._updateSizesOfViewportAndCols.bind(this))).observe(hostEl);
			this._setupSpreadsheet(false);
			

			const sortIconAttrs='class="tablance-sort-icon" viewBox="0 0 24 24" fill="none" '
				+'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
				+'aria-hidden="true"';
			if (this._opts.sortAscHtml==null)
				this._opts.sortAscHtml=`<svg ${sortIconAttrs}><path d="m18 15-6-6-6 6"/></svg>`;
			if (this._opts.sortDescHtml==null)
				this._opts.sortDescHtml=`<svg ${sortIconAttrs}><path d="m6 9 6 6 6-6"/></svg>`;
			if (this._opts.sortNoneHtml==null)
				this._opts.sortNoneHtml=`<svg ${sortIconAttrs}><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`;
			this._updateHeaderSortHtml();
			this._buildDependencyGraph(this._schema);
			// Bulk-edit clones raw nodes but needs wrapper metadata (parents/meta), so pass the wrapped schema.
			this._createBulkEditArea(this._schema);
			this._updateSizesOfViewportAndCols();
			}
		}

	_createInstanceNode(parent=null,index=null,proto=INSTANCE_NODE_PROTOTYPE) {
		const instanceNode=Object.create(proto);
		instanceNode.parent=parent;
		instanceNode.index=index;
		Object.defineProperty(instanceNode,"tablance",{value:this});
		return instanceNode;
	}

	_buildViewDefinitions(schemaViews) {
		const views=Object.create(null);
		if (schemaViews&&typeof schemaViews==="object")
			for (const [key,viewDef] of Object.entries(schemaViews)) {
				const filterFn=typeof viewDef==="function"?viewDef:viewDef?.filter;
				if (typeof filterFn==="function")
					views[key]={filter: filterFn,title:typeof viewDef?.title==="string"?viewDef.title:null};
			}
		if (!("default" in views))
			views.default={filter:()=>true,title:null};
		return views;
	}

	_rowMatchesView(row,viewModeKey=this._currentViewModeKey) {
		const rowMeta=row?this._rowMeta?.get(row):null;
		if (rowMeta?.isNew&&rowMeta.draftViewModeKey===viewModeKey)
			return true;
		return !!this._viewDefinitions?.[viewModeKey]?.filter(row);
	}

	_rebuildViewData() {
		const nextView=[];
		for (let i=0;i<this._sourceData.length;i++) {
			const row=this._sourceData[i];
			if (this._rowMatchesView(row))
				nextView.push(row);
		}
		this._viewData=nextView;
	}

	_countCommittedRows(rows) {
		let count=0;
		for (const row of rows??[])
			if (!this._rowMeta?.get(row)?.isNew)
				count++;
		return count;
	}

	getViewState() {
		return {
			viewModeKey:this._currentViewModeKey,
			search:this._filter??"",
			counts:{
				source:this._countCommittedRows(this._sourceData),
				view:this._countCommittedRows(this._viewData),
				filtered:this._countCommittedRows(this._filteredData),
			},
		};
	}

	_emitViewStateChange(reason) {
		this._updateViewSwitcher();
		this.rootEl.dispatchEvent(new CustomEvent("viewstatechange",{
			detail:{...this.getViewState(),reason},
		}));
	}

	/**Reset all per-dataset state to an empty baseline. */
	_resetDataState({clearFilter=true}={}) {
		this._closeHelp();
		this._sourceData=[];
		this._viewData=[];
		this._filteredData=[];
		this._rowMeta=new WeakMap();
		this._rowFilterCache=new WeakMap();
		this._openDetailsPanes=Object.create(null);
		this._selectedRows=[];
		this._highlightRowsOnView=Object.create(null);
		this._lastCheckedIndex=null;
		this._numRowsSelected=0;
		this._numRowsInViewSelected=0;
		this._mainRowIndex=null;
		this._mainColIndex=null;
		this._activeDetailsCell=null;
		this._cellCursorDataObj=null;
		this._setSelectedCellElement(null);
		this._scrollRowIndex=0;
		this._scrollY=0;
		if (clearFilter) {
			this._filter="";
			if (this._searchInput)
				this._searchInput.value="";
		}
	}

	/**Add data-rows to the main table.
	 * @param {object[]} data Rows to insert.
	 * @param {boolean} highlight If true, clear filter, highlight, and scroll to the first new row.
	 * @param {boolean} prepend If true, insert rows at the start of the dataset instead of the end. */
	addData(data, highlight=false, prepend=false) {
		if (!this._sourceData?.length) {
			const pendingMeta=data.map(row=>row?this._rowMeta?.get(row):undefined);
			this._resetDataState({clearFilter:false});
			for (let i=0;i<data.length;i++)
				if (pendingMeta[i]&&data[i])
					this._rowMeta.set(data[i],pendingMeta[i]);
		}
		if (this._onlyDetails)
			return this._setDataForOnlyDetails(data)
		const oldLen=this._filteredData.length;
		if (highlight) {
			this._filter="";
			if (this._searchInput)
				this._searchInput.value="";
		}
		if (prepend)
			this._sourceData=data.concat(this._sourceData);
		else
			this._sourceData=this._sourceData.concat(data);
		
		// Fast path: slot only the new rows into the active view instead of rebuilding from scratch.
		const viewMatches = data.filter(row=>this._rowMatchesView(row));
		const viewLenBefore=this._viewData.length;
		this._viewData=prepend?viewMatches.concat(this._viewData):this._viewData.concat(viewMatches);
		if (this._filter) {
			const selectOptsCache=this._createSelectOptsCache();
			const newFiltered=[];
			for (let i=0;i<viewMatches.length;i++) {
				const mainIndex=prepend?i:viewLenBefore+i;
				if (this._rowSatisfiesFilters(this._filter,viewMatches[i],mainIndex,selectOptsCache))
					newFiltered.push(viewMatches[i]);
			}
			this._filteredData=prepend?newFiltered.concat(this._filteredData):this._filteredData.concat(newFiltered);
			this._sortData();
			this._refreshTable();
			this._refreshTableSizerNoDetails();
		} else {
			this._filteredData=this._viewData;
			const sortingOccured=this._sortData();
			if (sortingOccured||prepend)
				this._refreshTable();
			else
				this._maybeAddTrs();
			const numNewInData=this._filteredData.length-oldLen;
			this._tableSizer.style.height=parseInt(this._tableSizer.style.height||0)+numNewInData*this._rowHeight+"px";
			this._updateAutoHeight();
		}
		if (highlight) {
			for (let dataRow of data) {
				const rowIndex=this._filteredData.indexOf(dataRow);
				if (rowIndex!==-1)
					this._highlightRowIndex(rowIndex);
			}
			if (this._filteredData.indexOf(data[0])!==-1)
				this.scrollToDataRow(data[0],false);//false for not highlighting, above line does the highlight anyway
		}
		this._emitViewStateChange("data");
	}

	/**Replace the full dataset with a new set of rows (pass an empty array to clear).
	 * @param {object[]} data New rows to render.
	 * @param {{highlight?:boolean,resetFilter?:boolean}|null} options
	 *        highlight: clear filter, highlight, and scroll to the first row.
	 *        resetFilter: clear the active filter/search before rendering. */
	setData(data=[], options=null) {
		if (!this._flushValidatedEdits())
			this._editTransaction=null;
		const {highlight=false,resetFilter=false}=options??{};
		const clearFilter=highlight||resetFilter;
		const nextData=Array.isArray(data)?data:(data==null?[]:[data]);

		this._resetDataState({clearFilter});

		if (this._bulkEditArea) {
			this._bulkEditAreaOpen=false;
			this._bulkEditArea.style.height=0;
			if (this._numberOfRowsSelectedSpan)
				this._numberOfRowsSelectedSpan.innerText="0";
		}

		if (this._onlyDetails) {
			this._setDataForOnlyDetails(nextData);
			return this;
		}

		if (this._scrollBody)
			this._scrollBody.scrollTop=0;
		this._mainTbody.replaceChildren();
		this._numRenderedRows=0;
		this._tableSizer.style.top="0px";
		this._tableSizer.style.height="0px";
		const headerCheckbox=this._headerTr?.querySelector(".select-col input");
		if (headerCheckbox) {
			headerCheckbox.checked=false;
			headerCheckbox.indeterminate=false;
		}

		this._sourceData=nextData;
		this._rebuildViewData();
		this._applyFilters(this._filter??"",true,false,"data");

		if (highlight&&this._filteredData.length) {
			this._highlightRowIndex(0);
			this.scrollToDataRow(this._filteredData[0],false);
		}
		return this;
	}

	setViewMode(viewModeKey) {
		if (viewModeKey===this._currentViewModeKey)
			return;
		if (!(viewModeKey in this._viewDefinitions)) {
			const validKeys=Object.keys(this._viewDefinitions).join(", ");
			throw new Error(`Unknown viewMode "${viewModeKey}". Valid viewModes: ${validKeys}`);
		}
		this._currentViewModeKey=viewModeKey;
		this._rebuildViewData();
		this._applyFilters(this._filter,true,false,"view");
	}

	refreshView(reason="refresh") {
		if (this._onlyDetails)
			return this.getViewState();
		if (this._refreshingView)
			return this.getViewState();
		this._refreshingView=true;
		try {
			if (!this._flushValidatedEdits())
				return this.getViewState();
			const previousRows=[...(this._filteredData??[])];
			this._rebuildViewData();
			this._filterCurrentView(this._filter??"");
			this._sortData();
			const rowsChanged=previousRows.length!==this._filteredData.length
				||previousRows.some((row,index)=>row!==this._filteredData[index]);
			if (rowsChanged)
				this._refreshAfterViewRowsChanged();
			else
				this._refreshRenderedViewRows();
			this._emitViewStateChange(reason);
			return this.getViewState();
		} finally {
			this._refreshingView=false;
		}
	}

	/**Explicitly create and insert a new, uncommitted row. */
	insertNewRow(rowData={}, options) {
		const {highlight=true,prepend=true}=options??{};
		const newRow=rowData?structuredClone(rowData):Object.assign(Object.create(null),{});
		this._rowMeta.set(newRow,{isNew:true,draftViewModeKey:this._currentViewModeKey});
		this.addData([newRow],highlight,prepend);
		return newRow;
	}

	/**Change or add any data in the table
	 * @param {int|object} dataRow_or_mainIndex Either the actual data-object that should be updated, or its index in
	 * 											the current view
	 * @param {string|string[]} dataPath The path to the data-value that should be updated or added to. For a value in
	 * 			the base which is not nested within repeated-containers it should simply be the dataKey of the property.
	 * 			It can either be a string of keys separated by dots(.) or an array where each element is a key.
	 * 			For repeated-arrays which data should be added to, "[]" can be used similiar to how it's done in PHP.
	 * 			For instance the path could be "foo[]" or "foo[].bar". Objects/arrays will be created recursively
	 * 			if they don't yet exist.
	 * @param {*} newData The actual data to be replaced with or added
	 * @param {bool} scrollTo Whether the modified/added data should be scrolled to and highlighted.
	 * @param {bool} onlyRefresh If true then no new data will be written and argument "data" will be ignored.
	 * 							The cell will only be refreshed with the value already present in the data.
	 * @returns The tablance-object, for chaining*/
	updateData(dataRow_or_mainIndex,dataPath,newData,scrollTo=false,onlyRefresh=false) {
		let dataRow;//simply an element from #data, e.g. a whole dataset for a row of the maintable.
		let mainIndx;//the index of dataRow
		let updatedEls=[];
		if (!isNaN(dataRow_or_mainIndex))
			dataRow=this._filteredData[mainIndx=dataRow_or_mainIndex];
		else //if (typeof dataRow_or_mainIndex=="object")
			mainIndx=this._filteredData.indexOf(dataRow=dataRow_or_mainIndex);
		dataPath=typeof dataPath=="string"?dataPath.split(/\.|(?=\[\d*\])/):dataPath;

		if (!onlyRefresh) {//if we're not only refreshing the cell but actually modifying/adding data
			//update the actual data, deal with the dom later
			let dataPortion=dataRow;//object that is going to have a property updated, or array that will be pushed to
			for (let i=0; i<dataPath.length; i++) {
				const key=i%2?dataPath[i].replace(/^\[|\]$/g,""):dataPath[i];//get rid of brackets. 
				//key is now either property-name, string-int for index, or empty string for pushing
				if (i==dataPath.length-1)//if last step
					dataPortion[key||dataPortion.length]=newData;//assign the data
				else if (!key)//not last step and empty string, meaning push
					dataPortion=dataPortion[dataPortion.length]={};//do push
				else//not last step and key is index or property-name
					dataPortion=dataPortion[key]??(dataPortion[key]=i%2?[]:{});
			}
		}

		if (mainIndx<this._scrollRowIndex||mainIndx>=this._scrollRowIndex+this._numRenderedRows)
			return;//the row to be updated is outside of view. It'll be updated automatically if scrolled into view
		
		//is it a column of the main-table?
		if (dataPath.length==1) //it's possible only if the path is a single dataKey. (but still not guaranteed)
			for (let colI=-1,colSchemaNode;colSchemaNode=this._colSchemaNodes[++colI];)
				if (colSchemaNode.dataKey==dataPath[0]) {//if true then yes, it was a column of main-table
					const tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndx}"]:not(.details)`);
					return this._updateMainRowCell(tr.cells[colI],colSchemaNode);//update it and be done with this
				}

		//The data is somewhere in details
		
		let nodeToUpdate=this._openDetailsPanes[mainIndx];//points to the instance-node that will be subject for update
		const repeatedMutations=new Set;
		if (!nodeToUpdate)//if the updates details is not open
			return;

		//look through the celObjToUpdate and its descendants-tree (currently set to whole details), following the
		//dataPath. At the end of this loop celObjToUpdate should be set to the deepest down object that dataPath points
		//to, and pathIndex should be the index in dataPath that is the last step pointing to celObjToUpdate.
		//When simply editing an already existing field then celObjToUpdate would be the container of that cell, and
		//pathIndex would be set to the index of the last element in dataPath
		for (let i=0,instanceNodeId; instanceNodeId=dataPath[i]; i+=2) {
			const arrayIndex=dataPath[i+1]?.replace(/^\[|\]$/g,"");
			nodeToUpdate=this._findDescendantInstanceNodeById(nodeToUpdate,instanceNodeId);
			if (nodeToUpdate.schemaNode.type=="repeated") {//should be true until possibly last iteration
				repeatedMutations.add(nodeToUpdate);
				if (i==dataPath.length-1) {//final array-index not specified. replace all of the data in repeated
					const replacement=nodeToUpdate.parent.dataObj[nodeToUpdate.schemaNode.dataKey];
					this._validateRepeatedDataArray(replacement);

					//remove all the current entries. Do it backwards so that the remaining entries doesn't have to
					//have their index&path updates each time
					const children=nodeToUpdate.children;
					for (let entryI=children.length-!!nodeToUpdate.schemaNode.create,entry; entry=children[--entryI];)
						this._deleteCell(entry,true);

					//insert all the new data
					nodeToUpdate.dataObj=replacement;
					nodeToUpdate.dataObj.forEach(
									dataEntry=>updatedEls.push(this._repeatInsert(nodeToUpdate,false,dataEntry)));
					break;
				} else if (arrayIndex!==undefined&&arrayIndex!=="") {//backing-array index pointing at an entry
					const dataEntry=nodeToUpdate.dataObj[Number(arrayIndex)];
					nodeToUpdate=nodeToUpdate.children.find(child=>!child.schemaNode.creator
						&&child.dataObj===dataEntry);
					if (!nodeToUpdate)
						throw new RangeError(`No repeated entry exists at data index ${arrayIndex}.`);
				} else {//[] - insert new
					this._validateRepeatedDataArray(nodeToUpdate.dataObj);
					updatedEls.push(this._repeatInsert(nodeToUpdate,false,nodeToUpdate.dataObj.at(-1)));
					break;
				}
			}
		}

		if (nodeToUpdate.schemaNode.type=="field")
			this._updateDetailsCell(nodeToUpdate,dataRow);
		for (const repeated of repeatedMutations)
			this._finalizeRepeatedMutation(repeated);
		if (scrollTo) {
			(nodeToUpdate.selEl??nodeToUpdate.el).scrollIntoView({behavior:'smooth',block:"center"});
			updatedEls.forEach(el=>this._highlightElements([el,...el.getElementsByTagName('*')]));
		}
		this._adjustCursorPosSize(this._selectedCell,true);
	}

	/**
	 * Build a wrapped-schema tree from the raw user schema.
	 *
	 * RULES:
	 * - The raw schema is never cloned or mutated.
	 * - Only schema-structure keys (main, details, columns, entry, entries) are recursed into.
	 * - Config objects (input, meta, validators, etc.) are ignored and never wrapped.
	 * - The wrapper tree mirrors schema structure but contains only:
	 *       { raw: <raw node>, parent: <wrapped parent>, and wrapped children }
	 * @param {*} rawSchema	The user-provided schema node.
	 * @param {*} parentWrappedNode The wrapped parent, if any.
	 * @returns {*}         The root wrapped schema-node.
	 */
	_buildSchemaFacade(rawNode, parentWrappedNode=null) {

		// Already wrapped? Return as-is to avoid double wrapping.
		if (rawNode && rawNode[SCHEMA_WRAPPER_MARKER])
			return rawNode;

		// Reject null/undefined & non-objects. Could be left for isPojo-check but that throws error on undefined
		if (!rawNode || typeof rawNode!="object")
			return null;

		// Accept only POJOs and arrays.
		// This ensures we only traverse expected schema structures
		// and never recurse into exotic/custom objects.
		const proto = Object.getPrototypeOf(rawNode);
		const isPojo = proto===Object.prototype || proto===null;
		if (!isPojo && !Array.isArray(rawNode))
			return null;

		const wrappedNode = createSchemaNodeFacade(rawNode, parentWrappedNode);

		// ---- CHILD NODE PROCESSING ----
		// We recurse ONLY into known schema-node containers.
		// Everything else inside the raw schema object is left untouched.

		// main
		if (rawNode.main && typeof rawNode.main=="object")
			wrappedNode.main = this._buildSchemaFacade(rawNode.main, wrappedNode);

		// details
		if (rawNode.details && typeof rawNode.details=="object")
			wrappedNode.details = this._buildSchemaFacade(rawNode.details, wrappedNode);

		// columns (array of schema-nodes)
		if (Array.isArray(rawNode.columns)) {
			const cols = [];
			for (const col of rawNode.columns) {
				const wrappedCol = this._buildSchemaFacade(col, wrappedNode);
				if (wrappedCol)
					cols.push(wrappedCol);
			}
			if (cols.length)
				wrappedNode.columns = cols;
		}

		// entry (single schema-node)
		if (rawNode.entry && typeof rawNode.entry=="object")
			wrappedNode.entry = this._buildSchemaFacade(rawNode.entry, wrappedNode);

		// entries (multiple schema-nodes)
		if (Array.isArray(rawNode.entries)) {
			const arr = [];
			for (const child of rawNode.entries) {
				const wrappedChild = this._buildSchemaFacade(child, wrappedNode);
				if (wrappedChild)
					arr.push(wrappedChild);
			}
			wrappedNode.entries = arr;
		}

		return wrappedNode;

		function createSchemaNodeFacade(rawNode, parentProxy) {
			const wrapper = Object.create(null);
			Object.defineProperty(wrapper,"raw",{value:rawNode, enumerable:false, configurable:true});
			Object.defineProperty(wrapper,SCHEMA_WRAPPER_MARKER,{value:true, enumerable:false});
			if (parentProxy)
				wrapper.parent = parentProxy;
			if (!Object.prototype.hasOwnProperty.call(rawNode,"type"))
				wrapper.type="field";
			return new Proxy(wrapper,{
				get(target,prop) {
					if (prop in target)
						return target[prop];
					if (rawNode && Object.prototype.hasOwnProperty.call(rawNode,prop))
						return rawNode[prop];
					return undefined;
				},
				set(target,prop,value) {
					target[prop]=value;
					return true;
				},
				has(target,prop) {
					return prop in target || prop in rawNode;
				}
			});
		}
	}


	/**
	 * Collects schema-derived caches used by filtering and searching.
	 *
	 * This function walks the validated schema and extracts:
	 *
	 * • All unique select input definitions (keyed by the `input` object itself)
	 * • All schema nodes that should be considered searchable fields
	 *
	 * Structural assumptions (enforced elsewhere by schema validation):
	 *
	 * • `schemaRoot.main.columns` contains field nodes only
	 *   - Columns never have `entry` or `entries`
	 *   - All column fields are implicitly searchable (unless input.type==="button")
	 *
	 * • `schemaRoot.details` is a single schema node (often a list)
	 *   - Only the details subtree may contain `entry` / `entries`
	 *   - Only nodes of type "field" inside details are searchable
	 *
	 * • A node may have either `entry` or `entries`, never both
	 *
	 * Notes:
	 *
	 * • Select inputs are keyed by the `input` object, not by options or nodes,
	 *   to allow external mutation or replacement of the options array.
	 * @param {Object} schemaRoot
	 *   The validated root schema facade.
	 *
	 * @returns {{
	 *   selectInputs: Set<Object>,
	 *   searchableFieldNodes: Object[]
	 * }}
	 *   An object containing:
	 *   - `selectInputs`: unique select input definitions
	 *   - `searchableFieldNodes`: ordered list of schema nodes eligible for search
	 */
	_collectFilterSchemaCaches(schemaRoot) {
		this._selectInputs=new Set();
		this._searchableFieldNodes=[];
		const stack=schemaRoot.details?[schemaRoot.details]:[];

		const processNode=(node,isDetails)=>{
			const input=node.input;
			if (input?.type==="select")
				this._selectInputs.add(input);
			if ((node.type==="field"||!isDetails) && input?.type!=="button")
				this._searchableFieldNodes.push(node);
			if (isDetails)
				if (node.entry)
					stack.push(node.entry);
				else if (node.entries)
					stack.push(...node.entries);
		};
		for (const col of (schemaRoot.main?.columns ?? []))
			processNode(col,false);
		while (stack.length)
			processNode(stack.pop(),true);
	}




	/**
	 * Searches upward through schema-node parents to find a meta value.
	 * @param {*} startNode  The schema-node where the search begins.
	 * @param {string} metaKey  The meta key to look for.
	 * @returns {*} The found value or undefined.
	 */
	_closestMeta(startNode, metaKey) {
		for (let node=startNode; node; node=node.parent)
			if (node.meta && metaKey in node.meta)
				return node.meta[metaKey];
	}

	/**
	 * Resolve the actual commit target for a schema/data pair.
	 *
	 * @param {Object} schemaNode The schema node originating the commit.
	 * @param {Object} data The data object associated with that node.
	 * @returns {Object} The object that should receive the commit.
	 */
	_resolveCommitTarget(schemaNode,data) {
		if (!schemaNode)
			return data;
		let targetKey=null;
		if (schemaNode.type==="field")
			targetKey=schemaNode.commitDataTarget;
		// For implicit auto-groups that wrap a single field (e.g. repeated entry wrapper),
		// honor the child's commitDataTarget without making the container own the target.
		else if (schemaNode.entryAutoGroup&&schemaNode.entries?.length)
			targetKey=schemaNode.entries[0]?.commitDataTarget;
		return targetKey?data?.[targetKey]:data;
	}

	/**
	 * Apply commit target redirection: move payload.data to the resolved target and keep the original.
	 * @param {Object} payload Commit payload about to be emitted.
	 * @param {Object} schemaNode Schema node originating the commit.
	 * @returns {Object} New payload with data redirected and sourceData preserved.
	 */
	_applyCommitTargetToPayload(payload,schemaNode) {
		if (!payload)
			return payload;
		const sourceData=payload.data;
		const target=this._resolveCommitTarget(schemaNode??payload?.schemaNode,sourceData);
		if (target===sourceData) {
			if (payload.sourceData===undefined&&sourceData!==undefined)
				return {...payload,sourceData};
			return payload;
		}
		return {...payload,data:target,sourceData};
	}

	// Build a callback payload with sensible defaults derived from an instance-node.
	_makeCallbackPayload(instanceNode, extra={}, overrides={}) {
		const schemaNode=overrides.schemaNode??instanceNode?.schemaNode;
		let mainIndex=overrides.mainIndex;
		if (mainIndex==null) {
			if (Number.isInteger(instanceNode?.rowIndex))
				mainIndex=instanceNode.rowIndex;
			else if (instanceNode) {
				let root=instanceNode;
				for (;root?.parent; root=root.parent);
				if (Number.isInteger(root?.rowIndex))
					mainIndex=root.rowIndex;
			}
			if (mainIndex==null)
				mainIndex=this._mainRowIndex??0;
		}
		const rowData=overrides.rowData??(Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:undefined);
		const bulkEdit=overrides.bulkEdit??!!this.mainInstance;
		// Base payload is intentionally minimal; creation-only context (dataKey/dataArray) is injected only
		// for onDataCommit so other callbacks are not burdened with persistence-only fields.
		return {tablance:this,schemaTree:this._schema,schemaNode,instanceNode,rowData,mainIndex,bulkEdit,
			closestMeta: key => this._closestMeta(schemaNode,key),...extra};
	}

	_getCellValueBundle(schemaNode,dataObj,mainIndex,instanceNode=null) {
		if (!schemaNode)
			return {value: undefined, idValue: undefined, dependedValue: undefined};
		const idValue=schemaNode.dataKey!=null?dataObj?.[schemaNode.dataKey]:undefined;
		const dependedValue=(schemaNode.dependsOnDataPath||schemaNode.dependsOnDataPaths||schemaNode.dependsOnCellPaths)
			?this._getTargetVal(false,schemaNode,instanceNode,dataObj)
			:undefined;
		const value=this._getTargetVal(true,schemaNode,instanceNode,dataObj);
		return {value,idValue,dependedValue};
	}

	_getDisplayValue(schemaNode,dataObj,mainIndex,stripHtml=false,instanceNode=null) {
		const {value,idValue,dependedValue}=this._getCellValueBundle(schemaNode,dataObj,mainIndex,instanceNode);
		const payload=this._makeCallbackPayload(instanceNode??null,{value,idValue,dependedValue,rowData: dataObj},{
			schemaNode,mainIndex,rowData: dataObj});
		let displayVal=schemaNode?.render?schemaNode.render(payload):value;
		if (stripHtml&&schemaNode?.html&&typeof displayVal==="string") {
			const htmlToTextDiv=this._htmlToTextDiv??=(typeof document!=="undefined"?document.createElement("div"):null);
			if (htmlToTextDiv) {
				htmlToTextDiv.innerHTML=displayVal;
				displayVal=htmlToTextDiv.textContent??"";
			}
		}
		return displayVal;
	}

	/**
	 * Re-evaluate and repaint an already rendered details subtree after external or cross-entry data changes.
	 * Visibility, cell state, field rendering and group closedRender output are refreshed recursively.
	 * @param {object} instanceNode Root instance node of the subtree to refresh.
	 * @returns {boolean} True when a rendered node was refreshed.
	 */
	refreshSubtree(instanceNode) {
		if (!instanceNode?.schemaNode)
			return false;
		let refreshed=false;
		const visit=node=>{
			if (!node?.schemaNode||node.schemaNode.creator)
				return;
			if (node.schemaNode.visibleIf)
				this._applyVisibleIf(node,node.rowIndex??this._mainRowIndex);
			if (node.schemaNode.type==="field"&&!node.hidden) {
				this._updateDetailsCell(node,node.dataObj);
				refreshed=true;
			}
			for (const child of node.children??[])
				visit(child);
			if (node.schemaNode.type==="group"&&node.schemaNode.closedRender)
				this._setClosedRender(node,node.schemaNode.closedRender(node.dataObj));
		};
		visit(instanceNode);
		const detailsTr=instanceNode.outerContainerEl?.closest?.("tr.details")
			??instanceNode.el?.closest?.("tr.details");
		if (detailsTr&&!this._onlyDetails)
			this._updateDetailsHeight(detailsTr);
		this._adjustCursorPosSize?.(this._selectedCell,true);
		return refreshed;
	}

	_getSortValue(schemaNode,dataObj,mainIndex) {
		const {value,idValue,dependedValue}=this._getCellValueBundle(schemaNode,dataObj,mainIndex,null);
		const payload=this._makeCallbackPayload(null,{value,idValue,dependedValue,rowData: dataObj},
			{schemaNode,mainIndex,rowData: dataObj});
		if (schemaNode.sortValue)
			return schemaNode.sortValue(payload);
		return value;
	}

	_findDescendantInstanceNodeById(searchInObj,idToFind) {
		for (const child of searchInObj.children)
			if (child.schemaNode.dataKey==idToFind)//if true then its the repeated-obj we're looking for
				return child;
			else if (child.children) {//if container-obj
				const result=this._findDescendantInstanceNodeById(child,idToFind);
				if (result)
					return result;
			}
	}

	_findInstanceNodeByCellId(searchInNode,nodeId) {
		if (!searchInNode)
			return;
		const stack=[searchInNode];
		while (stack.length) {
			const node=stack.pop();
			if (node.schemaNode?.nodeId===nodeId)
				return node;
			const children=node.children;
			if (!children?.length)
				continue;
			// Repeated entries share structure; searching only the first is enough for locating the first match.
			if (node.schemaNode?.type==="repeated") {
				if (children.length)
					stack.push(children[0]);
				continue;
			}
			for (let i=children.length-1; i>=0; i--)
				stack.push(children[i]);
		}
	}

	/**Expands a row and returns the details instance-tree root.
	 * @param int mainIndex
	 * @returns Object Root instance-node (outer-most instanceNode)*/
	expandRow(mainIndex) {
		if (this._onlyDetails)
			return this._openDetailsPanes[0];
		let tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]`);
		if (!tr) {
			this.scrollToDataRow(this._filteredData[mainIndex],false,false);
			this._scrollMethod();//needed to get everythig to render before having to wait for next frame
			tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]`);
		}
		this._expandRow(tr);
		return this._openDetailsPanes[mainIndex];
	}

	scrollToDataRow(dataRow,highlight=true,smooth=true) {
		if (this._naturalAutoHeight) {
			const mainIndex=this._filteredData.indexOf(dataRow);
			const tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]:not(.details)`);
			tr?.scrollIntoView({behavior:smooth?"smooth":"auto",block:"center"});
			if (highlight&&mainIndex!==-1)
				this._highlightRowIndex(mainIndex);
			return;
		}
		let scrollY=0;
		for (let i=-1,otherDataRow;otherDataRow=this._filteredData[++i];) {
			if (otherDataRow==dataRow) {
				scrollY=scrollY-this._scrollBody.offsetHeight/2+this._rowHeight;
				this._scrollBody.scrollTo({top:scrollY,behavior:smooth?"smooth":"auto"});
				if (highlight)
					this._highlightRowIndex(i);
				return;
			}
			scrollY+=this._rowMeta.get(otherDataRow)?.h??this._rowHeight;
		}
	}

	/**Use this method to set neighbourTables automatically by just supplying all the other tables. It will figure out
	 * in which order they appear in the html and set neighbourTables accordingly.
	 * @param  {...Tablance} otherTablances */
	chainTables(...otherTablances) {
		const tablances=[this,...otherTablances];
		tablances.sort(sort);
		for (let i=-1,tablance;tablance=tablances[++i];)
			tablance.neighbourTables={up:tablances[i-1],down:tablances[i+1]};
		function sort(a,b) {
			let elA=a.rootEl, elB=b.rootEl;
			//set elA to its (grand)parent which is the closest element where the parent also holds elB in its hiearchy
			for (;!elA.parentElement.contains(elB);elA=elA.parentElement);
			const commonCont=elA.parentElement;//the closest element that holds both elA and elB
			//set elB to the closest element that is a direct child of commonCont
			for (;elA.parentElement!=elB.parentElement;elB=elB.parentElement);
			return Array.from(commonCont.children).indexOf(elA)>Array.from(commonCont.children).indexOf(elB)?1:-1;
		}
	}

	selectTopBottomCellOnlyDetails(top) {
		this._highlightOnFocus=false;
		this._selectFirstSelectableDetailsCell(this._openDetailsPanes[0],top);
	}

	/**Return the first details instance-node matching nodeId for a row (expands row if needed). */
	getDetailCell(dataRow_or_mainIndex,nodeId,searchInNode=null) {
		let dataRow,mainIndex;
		if (!isNaN(dataRow_or_mainIndex))
			dataRow=this._filteredData[mainIndex=dataRow_or_mainIndex];
		else {
			dataRow=dataRow_or_mainIndex;
			mainIndex=this._filteredData.indexOf(dataRow);
		}
		if (!dataRow||mainIndex<0)
			return;
		const root=searchInNode??this.expandRow(mainIndex);
		if (!root)
			return;
		return this._findInstanceNodeByCellId(root,nodeId);
	}

	/**Select a cell by nodeId. Prefers details, falls back to main table if no details match.
	 * @param {object|number} dataRow_or_mainIndex Row object or its index in the current view.
	 * @param {string} nodeId Identifier set on schemaNode.nodeId (or column dataKey for main table).
	 * @param {{searchInNode?:object,enterEditMode?:boolean}|null} opts Options:
	 * 			- searchInNode: details instance-node to scope the search to
	 * 			- enterEditMode: whether to enter edit mode after selecting (default false) */
	selectCell(dataRow_or_mainIndex,nodeId,opts=null) {
		const searchInNode=opts?.searchInNode??null;
		const enterEditMode=!!opts?.enterEditMode;
		let dataRow,mainIndex;
		if (!isNaN(dataRow_or_mainIndex))
			dataRow=this._filteredData[mainIndex=dataRow_or_mainIndex];
		else {
			dataRow=dataRow_or_mainIndex;
			mainIndex=this._filteredData.indexOf(dataRow);
		}
		if (!dataRow||mainIndex<0)
			return;

		// Details: ensure details are rendered, then search live instance tree.
		const root=searchInNode??this.expandRow(mainIndex);
		if (root) {
			const targetNode=this._findInstanceNodeByCellId(root,nodeId);
			if (targetNode) {
				const selected=this._selectDetailsCell(targetNode);
				if (selected&&enterEditMode&&this._activeSchemaNode?.input)
					this._enterCell(new Event("enter",{cancelable:true}));
				return selected;
			}
		}

		// Main: find matching column by dataKey or nodeId.
		let colIndex=-1;
		for (let i=0,schemaNode; schemaNode=this._colSchemaNodes[i]; i++)
			if (schemaNode.dataKey===nodeId||schemaNode.nodeId===nodeId) {
				colIndex=i;
				break;
			}
		if (colIndex===-1)
			return;

		let tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]:not(.details)`);
		if (!tr) {
			this.scrollToDataRow(dataRow,false,false);
			this._scrollMethod();
			tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]:not(.details)`);
		}
		if (tr) {
			const selected=this._selectMainTableCell(tr.cells[colIndex]);
			if (selected&&enterEditMode&&this._activeSchemaNode?.input)
				this._enterCell(new Event("enter",{cancelable:true}));
			return selected;
		}
	}

	
	/**
	 * Build a complete dependency graph and assign internal autoIds.
	 *
	 * This walks the wrapped schema tree (main.columns + details) and enriches each
	 * schema-node with metadata needed for dependency resolution and runtime lookups.
	 *
	 * Permanent runtime metadata produced on wrapped schema-nodes:
	 *  - dependencyPaths: UI-forward paths (dependee → dependent)
	 *  - dependsOnCellPaths: reverse structural path(s) (exp→exp)
	 *  - dependsOnDataPath: absolute data path for one non-exp→exp dependency
	 *  - dependsOnDataPaths: absolute data paths for multiple non-exp→exp dependencies
	 *
	 * Temporary builder-only metadata (removed in PASS 4):
	 *  - _autoId
	 *  - _path
	 *  - _dataContextPath
	 *  - _dataPath
	 *
	 * @param {*} schema	Root of the wrapped schema tree.
	 */
	_buildDependencyGraph(schema) {

		//---- PASS 1 — Assign autoIds + collect ID maps ----
		const ctx = this._dep_pass1_assignAutoIdsAndMaps(schema);

		//---- PASS 2 — Compute UI path & data paths ----
		this._dep_pass2_assignPathsAndData(schema);

		//---- PASS 3 — Resolve dependsOn and build dependency metadata ----
		this._dep_pass3_resolveDependencies(ctx);

		//---- PASS 4 — Cleanup: remove all temporary builder-only metadata ----
		this._dep_pass4_cleanup(ctx);
	}

	/*───────────────────────────────────────────────────────────
		PASS 1 — Assign autoIds + collect ID maps
	───────────────────────────────────────────────────────────*/
	_dep_pass1_assignAutoIdsAndMaps(wrappedSchema) {
		const ctx = Object.create(null);
		ctx.autoIdCounter      = 0;
		ctx.explicitIdToAutoId = Object.create(null);
		ctx.implicitDataKeyToAutoId = Object.create(null);
		ctx.schemaNodeByAutoId = Object.create(null);
		ctx.seenCellIds        = Object.create(null);

		const roots = [];
		const cols = wrappedSchema.main && Array.isArray(wrappedSchema.main.columns)? wrappedSchema.main.columns: [];
		for (let i = 0; i < cols.length; i++)
			roots.push(cols[i]);

		if (wrappedSchema.details)
			roots.push(wrappedSchema.details);

		ctx.initialRoots = roots;

		let stack = [...roots];

		for (let schemaNode; schemaNode = stack.pop();) {
			const autoId = ++ctx.autoIdCounter;
			schemaNode._autoId = autoId;
			ctx.schemaNodeByAutoId[autoId] = schemaNode;

			if (schemaNode.nodeId != null) {
				if (ctx.seenCellIds[schemaNode.nodeId])
					throw new Error(`Duplicate nodeId "${schemaNode.nodeId}".`);
				ctx.seenCellIds[schemaNode.nodeId] = true;
				ctx.explicitIdToAutoId[schemaNode.nodeId] = autoId;
			} else if (schemaNode.dataKey != null)
				ctx.implicitDataKeyToAutoId[schemaNode.dataKey] = autoId;

			stack.push(...this._dep_children(schemaNode));
		}

		ctx.autoIdByName = Object.assign(
			Object.create(null),
			ctx.implicitDataKeyToAutoId,
			ctx.explicitIdToAutoId
		);

		return ctx;
	}

	/*───────────────────────────────────────────────────────────
		PASS 2 — Assign _path, _dataContextPath, and _dataPath
	───────────────────────────────────────────────────────────*/
	_dep_pass2_assignPathsAndData(wrappedSchema) {
		if (wrappedSchema.details)
			this._dep_assignPathsAndData(wrappedSchema.details, [], []);

		const cols = wrappedSchema.main && Array.isArray(wrappedSchema.main.columns)? wrappedSchema.main.columns: [];

		for (let i = 0; i < cols.length; i++)
			this._dep_assignPathsAndData(cols[i], ["m", i], []);
	}

	_dep_assignPathsAndData(schemaNode, uiPath, parentCtx = []) {
		schemaNode._path = uiPath;

		let myCtx=parentCtx;
		if (schemaNode.dataPath) {
			const dataPathArr=Array.isArray(schemaNode.dataPath) ? schemaNode.dataPath
				: String(schemaNode.dataPath).split(".").filter(Boolean);
			myCtx = [...parentCtx, ...dataPathArr];
		}

		schemaNode._dataContextPath = myCtx;

		if (schemaNode.dataKey != null)
			schemaNode._dataPath = [...myCtx, String(schemaNode.dataKey)];

		const kids = this._dep_children(schemaNode);

		for (let i = 0; i < kids.length; i++)
			this._dep_assignPathsAndData(kids[i], [...uiPath, i], myCtx);
	}

	/*───────────────────────────────────────────────────────────
		PASS 3 — Resolve dependsOn and build dependency metadata
	───────────────────────────────────────────────────────────*/
	_dep_pass3_resolveDependencies(ctx) {
		let stack = [...ctx.initialRoots];

		for (let schemaNode; schemaNode = stack.pop();) {

			if (schemaNode.dependsOn) {
				const deps = Array.isArray(schemaNode.dependsOn) ? schemaNode.dependsOn : [schemaNode.dependsOn];

				const dependentIsExp = schemaNode._path && schemaNode._path[0] !== "m";
				const cellPaths = [];
				const cellSources = [];
				const dataPaths = [];

				for (const depName of deps) {
					const depAutoId = ctx.autoIdByName[depName];

					if (depAutoId == null) {
						console.warn(`Unknown dependsOn "${depName}".`, schemaNode);
						continue;
					}

					const dependee = ctx.schemaNodeByAutoId[depAutoId];
					const dependeeIsExp = dependee._path && dependee._path[0] !== "m";

					const fwd = this._dep_computeForwardPath(dependee, schemaNode);

					if (fwd)
						(dependee.dependencyPaths ??= []).push(fwd);

					if (dependentIsExp && dependeeIsExp) {
						const rev = this._dep_computeReversePath(schemaNode, dependee);
						if (rev && rev.length) {
							cellPaths.push(rev);
							cellSources.push({type:dependee.type,nodeId:dependee.nodeId,dataKey:dependee.dataKey});
						}
					} else {
						if (dependee._dataPath)
							dataPaths.push(dependee._dataPath);
						else if (dependee.dataKey != null || dependee.nodeId != null)
							console.warn("Dependee has no dataPath:", dependee);
					}
				}

				this._dep_finalizeDependency(schemaNode, cellPaths, dataPaths,cellSources);
			}

			stack.push(...this._dep_children(schemaNode));
		}
	}

	/*───────────────────────────────────────────────────────────
		PASS 4 — Cleanup: remove temporary builder-only metadata
	───────────────────────────────────────────────────────────*/
	_dep_pass4_cleanup(ctx) {
		let stack = [...ctx.initialRoots];

		for (let schemaNode; schemaNode = stack.pop();) {
			delete schemaNode._autoId;
			delete schemaNode._path;
			delete schemaNode._dataContextPath;
			delete schemaNode._dataPath;
			stack.push(...this._dep_children(schemaNode));
		}
	}


	/*───────────────────────────────────────────────────────────
		Helper: Normalize schemaNode children
		- Skips nodes that only serve as wrappers (repeated)
		- Returns the "real" children array.
	───────────────────────────────────────────────────────────*/
	_dep_children(schemaNode) {
		while (schemaNode.entry)
			schemaNode = schemaNode.entry;
		if (Array.isArray(schemaNode.entries))
			return schemaNode.entries;
		return [];
	}

	/*───────────────────────────────────────────────────────────
		Helper: Compute UI-forward dependency path
	───────────────────────────────────────────────────────────*/
	_dep_computeForwardPath(dependee, dependent) {
		const from = dependee._path;
		const to = dependent._path;

		if (!from || !to)
			return null;

		// main → main
		if (from[0] === "m" && to[0] === "m")
			return ["m", to[1]];

		// details → main
		if (from[0] !== "m" && to[0] === "m")
			return ["m", to[1]];

		// main → details
		if (from[0] === "m" && to[0] !== "m")
			return ["e", ...to];

		// details → details
		let common = 0;

		while (common < from.length && common < to.length && from[common] === to[common])
			common++;

		const up   = Array(from.length - common).fill("..");
		const down = to.slice(common);

		return ["r", ...up, ...down];
	}

	/*───────────────────────────────────────────────────────────
		Helper: Compute reverse dependency path (exp→exp)
	───────────────────────────────────────────────────────────*/
	_dep_computeReversePath(from, to) {
		if (!from._path || !to._path)
			return null;
		if (from._path[0] === "m" || to._path[0] === "m")
			return null;

		const a = from._path;
		const b = to._path;

		let common = 0;

		while (common < a.length && common < b.length && a[common] === b[common])
			common++;

		const up   = Array(a.length - common).fill("..");
		const down = b.slice(common);

		return [...up, ...down];
	}

	/*───────────────────────────────────────────────────────────
		Helper: Finalize dependency classification (exclusive)
	───────────────────────────────────────────────────────────*/
	_dep_finalizeDependency(schemaNode, cellPaths, dataPaths,cellSources=[]) {

		if (cellPaths.length) {
			schemaNode.dependsOnCellPaths = cellPaths;
			schemaNode.dependsOnCellSources = cellSources;
			delete schemaNode.dependsOnDataPath;
			delete schemaNode.dependsOnDataPaths;
			return;
		}

		if (dataPaths.length === 1) {
			schemaNode.dependsOnDataPath = dataPaths[0];
			delete schemaNode.dependsOnDataPaths;
			delete schemaNode.dependsOnCellPaths;
			delete schemaNode.dependsOnCellSources;

			if (!schemaNode._dataPath)
				schemaNode._dataPath = dataPaths[0];

			return;
		}

		if (dataPaths.length > 1) {
			schemaNode.dependsOnDataPaths = dataPaths;
			delete schemaNode.dependsOnDataPath;
			delete schemaNode.dependsOnCellPaths;
			delete schemaNode.dependsOnCellSources;
		}
	}





	_updateViewportHeight = () => {
		this._scrollBody.style.height = this.hostEl.clientHeight - this._headerTable.offsetHeight
		- (this._toolbar?.offsetHeight ?? 0) - this._bulkEditArea.offsetHeight + "px";
	}

	_updateAutoHeight() {
		if (!this._opts.autoHeight||this._onlyDetails)
			return;
		const contentHeight=this._naturalAutoHeight?this._mainTable.offsetHeight
			:Math.max(parseInt(this._tableSizer.style.height)||0,0);
		if (this._naturalAutoHeight)
			this._tableSizer.style.height=contentHeight+"px";
		this._scrollBody.style.height=contentHeight+"px";
		this._scrollBody.style.overflowY="hidden";
		this.hostEl.style.height=contentHeight+this._headerTable.offsetHeight
			+(this._toolbar?.offsetHeight??0)+this._bulkEditArea.offsetHeight+"px";
		if (!this._naturalAutoHeight)
			this._maybeAddTrs();
	}

	_attachInputFormatter(el, format, livePattern) {
		format = this._normalizeInputFormat(format);
		if (Array.isArray(format.blocks) && format._maxBlockLen === undefined)
			format._maxBlockLen = format.blocks.reduce((a, b) => a + b, 0);

		const liveRegex = livePattern instanceof RegExp ? livePattern
			: (typeof livePattern === "string" ? new RegExp(livePattern) : null);
	
		// Live filtering (raw value, before formatting)
		if (format.numericOnly || liveRegex) {
			el.addEventListener("beforeinput", e => {
				if (!e.data)
					return; // allow deletions/composition steps
	
				const start = el.selectionStart;
				const end = el.selectionEnd;
				const nextVal = el.value.slice(0, start) + e.data + el.value.slice(end);
	
				if (liveRegex && !liveRegex.test(nextVal))
					return e.preventDefault();
	
				if (format.numericOnly && /\D/.test(e.data))
					e.preventDefault();
			});
			if (format.numericOnly)
				el.setAttribute("inputmode", "numeric");
		}
	
		// Backspace over delimiter
		el.addEventListener("keydown", e => {
			if (e.key !== "Backspace" || !format.delimiter)
				return;
	
			const pos = el.selectionStart;
			if (pos > 0 && el.value[pos - 1] === format.delimiter) {
				e.preventDefault();
				el.value = el.value.slice(0, pos - 2) + el.value.slice(pos);
				el.setSelectionRange(pos - 2, pos - 2);
				el.dispatchEvent(new Event("input"));
			}
		});
	
		// Main formatting
		const apply = () => {
			el.value = this._applyInputFormatting(el.value, format);
		};
	
		el.addEventListener("input", apply);
		apply();
	}
	
	_normalizeInputFormat(format) {
		format = format ?? {};
		if (!format.date)
			return format;
	
		format = { ...format };
	
		if (format.blocks === undefined)
			format.blocks = [4, 2, 2];
		if (format.delimiter === undefined)
			format.delimiter = "-";
		if (format.numericOnly === undefined)
			format.numericOnly = true;
	
		return format;
	}

	_applyInputFormatting(value, format) {
		if (format.numericOnly)
			value = value.replace(/\D/g, "");
	
		// Date mode
		if (format.date)
			return this._formatDateValue(value, format);
	
		// Generic block formatting
		if (Array.isArray(format.blocks)) {
			if (value.length > format._maxBlockLen)
				value = value.slice(0, format._maxBlockLen);

			let out = "", i = 0;
			const delim = format.delimiter ?? "";
			const blocks = format.blocks;
			for (let b = 0; b < blocks.length; b++) {
				const block = blocks[b];
				const part = value.slice(i, i + block);
				out += part;
				i += part.length;
				if (part.length === block && b < blocks.length - 1 && delim && i < value.length)
					out += delim;
			}
			return out;
		}
	
		return value;
	}

	_formatDateValue(digits, format) {
		// --- clamp month ---
		if (digits.length >= 5) {
			const y = digits.slice(0, 4);
			let m = digits.slice(4, 6);
	
			if (m.length === 1 && +m > 1)
				m = "0" + m;
			else if (m.length === 2) {
				let mm = Math.min(Math.max(+m, 1), 12);
				m = String(mm).padStart(2, "0");
			}
			digits = y + m + digits.slice(6);
		}
	
		// --- clamp day ---
		if (digits.length >= 7) {
			const y = +digits.slice(0, 4);
			const m = +digits.slice(4, 6);
			let d = digits.slice(6, 8);
	
			if (d.length === 1 && +d > 3)
				d = "0" + d;
			else if (d.length === 2) {
				let dd = +d;
				const max = new Date(y, m, 0).getDate();
				d = String(Math.min(Math.max(dd, 1), max)).padStart(2, "0");
			}
			digits = digits.slice(0, 6) + d + digits.slice(8);
		}
	
		// --- rebuild output ---
		const blocks = format.blocks;
		const delim  = format.delimiter ?? "-";
		let out = "", i = 0;
	
		for (let b = 0; b < blocks.length; b++) {
			const part = digits.slice(i, i + blocks[b]);
			out += part;
			i += part.length;
			if (part.length === blocks[b] && b < blocks.length - 1)
				out += delim;
		}
	
		return out;
	}
	
	
	
		
	
	_setupToolbar() {
		const toolbarCfg=this._schema.main?.toolbar;

		//clone schema.main.toolbar.items so that we can make changes to it depending on certain options,  
		// without actually modifying the passed in schema. Keep it user-owned.
		const toolbarItems=[...(toolbarCfg?.items??[])];
		if (toolbarCfg?.defaultInsert) {
			toolbarItems.unshift({
				input:{type:"button",text:this.lang.insertRow,onClick:()=>this.insertNewRow()},
			});
		}
		if (!toolbarItems.length&&!toolbarCfg?.viewSwitcher&&this._opts.searchbar==false)
			return;

		const bar=this._toolbar=this.rootEl.appendChild(document.createElement("div"));
		bar.className="toolbar";

		const btnWrap=bar.appendChild(document.createElement("div"));
		btnWrap.className="toolbar-left";
		if (toolbarCfg?.viewSwitcher)
			this._generateViewSwitcher(btnWrap);

		for (const schemaNode of toolbarItems)
			this._generateButton(schemaNode,null,btnWrap,null).tabIndex=0;

		const rightWrap=bar.appendChild(document.createElement("div"));
		rightWrap.className="toolbar-right";
		if (this._opts.searchbar!=false) {
			this._searchInput=rightWrap.appendChild(document.createElement("input"));
			this._searchInput.type="search";
			this._searchInput.className="search";
			this._searchInput.placeholder=this.lang.filterPlaceholder;
			this._searchInput.addEventListener("input",e=>this._onSearchInput(e));
		}
	}

	_onSearchInput(_e) {
		this._applyFilters(this._searchInput.value,true,false,"search");
	}

	_generateViewSwitcher(parentEl) {
		const switcher=this._viewSwitcher=parentEl.appendChild(document.createElement("div"));
		switcher.className="tablance-view-switcher";
		switcher.setAttribute("role","group");
		switcher.setAttribute("aria-label",this.lang.viewsLabel);
		for (const [key,definition] of Object.entries(this._viewDefinitions)) {
			const button=switcher.appendChild(document.createElement("button"));
			button.type="button";
			button.className="tablance-view-option";
			button.dataset.viewMode=key;
			const title=definition.title?.trim()||key;
			const widthLabel=button.appendChild(document.createElement("span"));
			widthLabel.className="tablance-view-option-width";
			widthLabel.setAttribute("aria-hidden","true");
			widthLabel.textContent=title;
			const label=button.appendChild(document.createElement("span"));
			label.className="tablance-view-option-label";
			label.textContent=title;
			button.addEventListener("click",()=>this.setViewMode(key));
		}
		this._updateViewSwitcher();
	}

	_updateViewSwitcher() {
		for (const button of this._viewSwitcher?.querySelectorAll(".tablance-view-option")??[]) {
			const active=button.dataset.viewMode===this._currentViewModeKey;
			button.classList.toggle("active",active);
			button.setAttribute("aria-pressed",String(active));
		}
	}

	_hasHelp(schemaNode) {
		const help=schemaNode?.help;
		if (help==null)
			return false;
		if (typeof help!=="string"&&typeof help!=="function")
			throw new TypeError("help must be a string or a callback.");
		return true;
	}

	_hasTableHelp() {
		return this._hasHelp(this._schema)
			||this._schema.main?.columns?.some(schemaNode=>this._hasHelp(schemaNode))===true;
	}

	_populateSchemaTitle(container,schemaNode,instanceNode=null,
		{fallback="",showHelp=true,reserveHelpSlot=false}={}) {
		const title=schemaNode.title??fallback;
		const hasTitle=schemaNode.title!=null&&String(schemaNode.title)!=="";
		if (hasTitle&&reserveHelpSlot) {
			const layout=container.appendChild(document.createElement("span"));
			layout.className="tablance-title-layout";
			const text=layout.appendChild(document.createElement("span"));
			text.className="tablance-title-text";
			if (schemaNode.titleHtml===true)
				text.innerHTML=String(title);
			else
				text.textContent=String(title);
			const slot=layout.appendChild(document.createElement("span"));
			slot.className="tablance-help-slot";
			if (showHelp&&this._hasHelp(schemaNode))
				slot.appendChild(this._createHelpTrigger(schemaNode,instanceNode));
		} else {
			if (schemaNode.titleHtml===true)
				container.innerHTML=String(title);
			else
				container.textContent=String(title);
			if (hasTitle&&showHelp&&this._hasHelp(schemaNode))
				container.appendChild(this._createHelpTrigger(schemaNode,instanceNode));
		}
		return container;
	}

	_createHelpTrigger(schemaNode,instanceNode=null,{table=false}={}) {
		this._hasHelp(schemaNode);
		const trigger=document.createElement("button");
		trigger.type="button";
		trigger.className=`tablance-help-trigger${table?" table-help-trigger":""}`;
		trigger.tabIndex=-1;
		trigger.textContent="?";
		trigger.setAttribute("aria-label",this.lang.helpLabel);
		trigger.setAttribute("aria-expanded","false");
		trigger.addEventListener("mouseenter",()=>this._showHelp(trigger,schemaNode,instanceNode,false));
		trigger.addEventListener("mouseleave",()=>this._scheduleHelpClose(trigger));
		trigger.addEventListener("mousedown",e=>{
			e.preventDefault();
			e.stopPropagation();
		});
		trigger.addEventListener("click",e=>{
			e.preventDefault();
			e.stopPropagation();
			if (this._helpState?.trigger===trigger&&this._helpState.pinned)
				this._closeHelp();
			else
				this._showHelp(trigger,schemaNode,instanceNode,true);
		});
		if (instanceNode)
			instanceNode.helpTriggerEl=trigger;
		return trigger;
	}

	_setupMainHeaderHelp(trigger,schemaNode) {
		trigger.classList.add("has-help");
		trigger.addEventListener("mouseenter",()=>{
			this._cancelHelpOpen();
			this._helpOpenTimer=setTimeout(()=>{
				this._helpOpenTimer=null;
				this._showHelp(trigger,schemaNode,null,false);
			},600);
		});
		trigger.addEventListener("mouseleave",()=>{
			this._cancelHelpOpen();
			this._scheduleHelpClose(trigger);
		});
		trigger.addEventListener("mousedown",()=>this._cancelHelpOpen());
	}

	_ensureHelpPopover() {
		if (this._helpPopover)
			return this._helpPopover;
		const popover=this._helpPopover=this.rootEl.appendChild(document.createElement("div"));
		popover.id=`tablance-help-${++helpPopoverId}`;
		popover.className="tablance-help-popover";
		popover.hidden=true;
		popover.addEventListener("mouseenter",()=>this._cancelHelpClose());
		popover.addEventListener("mouseleave",()=>this._scheduleHelpClose(this._helpState?.trigger));
		this._helpResizeObserver=new ResizeObserver(()=>this._positionHelp());
		return popover;
	}

	_getHelpPayload(schemaNode,instanceNode,context={}) {
		let mainIndex=context.mainIndex;
		if (mainIndex==null&&instanceNode) {
			let root=instanceNode;
			for (;root?.parent;root=root.parent);
			mainIndex=Number.isInteger(root?.rowIndex)?root.rowIndex:null;
		}
		const mainRowData=Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:undefined;
		const rowData=instanceNode?.dataObj??mainRowData;
		const values=schemaNode?.type==="field"&&rowData
			?this._getCellValueBundle(schemaNode,rowData,mainIndex,instanceNode):{};
		return {tablance:this,schemaTree:this._schema,schemaNode,instanceNode,rowData,mainIndex,
			bulkEdit:!!this.mainInstance,closestMeta:key=>this._closestMeta(schemaNode,key),...values};
	}

	_setHelpContent(schemaNode,instanceNode,context) {
		if (schemaNode===this._schema)
			return this._setTableHelpContent(context);
		this._ensureHelpPopover().replaceChildren(this._resolveHelpContent(schemaNode,instanceNode,context));
	}

	_resolveHelpContent(schemaNode,instanceNode,context) {
		const help=schemaNode.help;
		const content=typeof help==="function"
			?help(this._getHelpPayload(schemaNode,instanceNode,context)):help;
		if (typeof content==="string")
			return document.createTextNode(content);
		if (content?.nodeType)
			return content;
		throw new TypeError("A help callback must return a string, Node, or DocumentFragment.");
	}

	_schemaTitleText(schemaNode) {
		if (schemaNode.titleHtml!==true)
			return String(schemaNode.title??"");
		const title=document.createElement("span");
		title.innerHTML=String(schemaNode.title??"");
		return title.textContent;
	}

	_setTableHelpContent(context) {
		const popover=this._ensureHelpPopover();
		const content=document.createDocumentFragment();
		if (this._hasHelp(this._schema)) {
			const introduction=content.appendChild(document.createElement("div"));
			introduction.className="tablance-table-help-introduction";
			introduction.appendChild(this._resolveHelpContent(this._schema,null,context));
		}
		for (const schemaNode of this._schema.main?.columns??[]) {
			if (!this._hasHelp(schemaNode))
				continue;
			const section=content.appendChild(document.createElement("section"));
			section.className="tablance-table-help-section";
			const heading=section.appendChild(document.createElement("h3"));
			heading.textContent=this._schemaTitleText(schemaNode);
			const body=section.appendChild(document.createElement("div"));
			body.appendChild(this._resolveHelpContent(schemaNode,null,{}));
		}
		popover.replaceChildren(content);
	}

	_showHelp(trigger,schemaNode,instanceNode,pinned,context={}) {
		if (!trigger?.isConnected
			||!(schemaNode===this._schema?this._hasTableHelp():this._hasHelp(schemaNode)))
			return false;
		if (this._helpState?.pinned&&!pinned&&this._helpState.trigger!==trigger)
			return false;
		this._cancelHelpClose();
		if (this._helpState?.trigger===trigger) {
			this._helpState.pinned||=pinned;
			this._helpState.context=context;
			if (pinned)
				this._setHelpContent(schemaNode,instanceNode,context);
			this._positionHelp();
			return true;
		}
		this._closeHelp();
		this._setHelpContent(schemaNode,instanceNode,context);
		const popover=this._ensureHelpPopover();
		this._helpState={trigger,schemaNode,instanceNode,pinned,context};
		trigger.setAttribute("aria-controls",popover.id);
		trigger.setAttribute("aria-expanded","true");
		popover.hidden=false;
		if (typeof popover.showPopover==="function") {
			popover.popover="manual";
			if (!popover.matches(":popover-open"))
				popover.showPopover();
		}
		this._helpResizeObserver.observe(popover);
		this._attachHelpGlobalListeners();
		this._positionHelp();
		return true;
	}

	_positionHelp() {
		const {trigger}=this._helpState??{};
		if (!trigger?.isConnected||trigger.getClientRects().length===0)
			return this._closeHelp();
		this._alignDropdown(this._helpPopover,trigger,undefined,8);
	}

	_scheduleHelpClose(trigger) {
		if (!trigger||this._helpState?.trigger!==trigger||this._helpState.pinned)
			return;
		this._cancelHelpClose();
		this._helpCloseTimer=setTimeout(()=>this._closeHelp(),120);
	}

	_cancelHelpClose() {
		clearTimeout(this._helpCloseTimer);
		this._helpCloseTimer=null;
	}

	_cancelHelpOpen() {
		clearTimeout(this._helpOpenTimer);
		this._helpOpenTimer=null;
	}

	_attachHelpGlobalListeners() {
		if (this._helpState?.outsideMouseDown)
			return;
		const state=this._helpState;
		state.outsideMouseDown=e=>{
			if (!state.trigger.contains(e.target)&&!this._helpPopover.contains(e.target))
				this._closeHelp();
		};
		state.keyDown=e=>{
			if (e.key!=="Escape")
				return;
			e.preventDefault();
			e.stopPropagation();
			this._closeHelp(true);
		};
		state.resize=()=>this._positionHelp();
		state.scroll=e=>{
			if (!this._helpPopover.contains(e.target))
				this._positionHelp();
		};
		document.addEventListener("mousedown",state.outsideMouseDown,true);
		document.addEventListener("keydown",state.keyDown,true);
		document.addEventListener("scroll",state.scroll,true);
		window.addEventListener("resize",state.resize);
	}

	_closeHelp(restoreFocus=false) {
		this._cancelHelpOpen();
		this._cancelHelpClose();
		const state=this._helpState;
		if (!state)
			return false;
		const restoreTableFocus=restoreFocus&&this._helpPopover.contains(document.activeElement);
		document.removeEventListener("mousedown",state.outsideMouseDown,true);
		document.removeEventListener("keydown",state.keyDown,true);
		document.removeEventListener("scroll",state.scroll,true);
		window.removeEventListener("resize",state.resize);
		state.trigger?.setAttribute("aria-expanded","false");
		state.trigger?.removeAttribute("aria-controls");
		this._helpResizeObserver?.disconnect();
		if (typeof this._helpPopover?.hidePopover==="function"&&this._helpPopover.matches(":popover-open"))
			this._helpPopover.hidePopover();
		this._helpPopover.hidden=true;
		this._helpPopover.replaceChildren();
		this._helpState=null;
		if (restoreTableFocus)
			this._focusEl?.focus({preventScroll:true});
		return true;
	}

	_showSelectedCellHelp() {
		const schemaNode=this._activeSchemaNode;
		if (!this._selectedCell||!this._hasHelp(schemaNode))
			return false;
		const instanceNode=this._activeDetailsCell;
		const trigger=instanceNode?.helpTriggerEl??this._selectedCell;
		return this._showHelp(trigger,schemaNode,instanceNode,true,{mainIndex:this._mainRowIndex});
	}

	_setupSpreadsheet(onlyDetails) {
		const focusEl=this._focusEl=onlyDetails?this.rootEl:this._tableArea;
		this.rootEl.classList.add("spreadsheet");
		this._cellCursor=document.createElement("div");
		this._cellCursor.className="cell-cursor";
		this._cellCursor.style.display="none";
		if (!onlyDetails) {
			//remove any border-spacing beacuse if spacing is clicked the target-element will be the table itself and
			//no cell will be selected which is bad user experience. Set it to 0 for headerTable too in order to match
			this._mainTable.style.borderSpacing=this._headerTable.style.borderSpacing=this._borderSpacingY=0;
		}
		focusEl.addEventListener("focus",e=>this._spreadsheetOnFocus(e));
		focusEl.addEventListener("blur",e=>this._spreadsheetOnBlur(e));
		focusEl.tabIndex=0;//so that the table can be tabbed to
		this.rootEl.addEventListener("keydown",e=>this._spreadsheetKeyDown(e));
		this.rootEl.addEventListener("mousedown",e=>this._spreadsheetMouseDown(e));
		this.rootEl.addEventListener("dblclick",e=>this._detailsRowExtensionDoubleClick(e));
		this._cellCursor.addEventListener("click",e=>{
			if (!this._activeRepeatedReorderEntry||e.target.closest("button"))
				return;
			// A click on the active editor surface keeps the edit session alive. Deliberately leave pointerdown/
			// mousedown untouched so the handle can gain drag semantics later without another lifecycle exception.
			e.preventDefault();
			e.stopPropagation();
			this._focusEl.focus({preventScroll:true});
		});
		this._cellCursor.addEventListener("dblclick",e=>{
			if (this._activeDetailsCell?.schemaNode?.type==="reorder") {
				e.preventDefault();
				e.stopPropagation();
			if (this._activeRepeatedReorderEntry===this._activeDetailsCell.ownerEntry)
				return this._exitEditMode(true);
			}
			this._enterCell(e);
		});

		this._tooltip=document.createElement("div");
		this._tooltip.classList.add("tooltip");
		this._tooltip.appendChild(document.createElement("span"));
	}

	_spreadsheetOnFocus(_e) {
		const tabbedTo=this._highlightOnFocus;
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		this._focusEl.classList.toggle("show-focus-ring",!this._onlyDetails&&this._highlightOnFocus);
		if (this._onlyDetails||!this._highlightOnFocus)
			this._focusEl.style.outline="none";
		
		//why is this needed? it messes things up when cellcursor is in mainpage of bulk-edit-area but hidden because
		//other page is open, and the tablance gets focus because then it will be visible through the active page
		//this._cellCursor.style.display="block";
		
		if (tabbedTo&&(this._mainRowIndex!=null||this._mainColIndex!=null))
			this._scrollToCursor();
	}

	_spreadsheetOnBlur(_e) {
		setTimeout(()=>{
			if (!this._focusEl.contains(document.activeElement)||this._bulkEditArea?.contains(document.activeElement)) {
				this._highlightOnFocus=true;
				//if (this.neighbourTables&&Object.values(this.neighbourTables).filter(Boolean).length)
					this._cellCursor.style.display="none";
			}
		});
	}

	_moveCellCursor(hSign,vSign,e) {
		
		if (!this._exitEditMode(true))//try to exit-mode and commit any changes.
			return false;//if exiting edit-mode was denied then do nothing more
		//it's important to run this here before deciding on the cell to move to, because exiting edit-mode may have
		//triggered visibleIf changes that may have changed which cells are selectable.


		if (this._mainRowIndex==null&&this._mainColIndex==null)//if table has focus but no cell is selected.
			return;//can happen if table is clicked but not on a cell
		e?.preventDefault();//to prevent native scrolling when pressing arrow-keys. Needed if #onlyDetails==true but
							//not otherwise. Seems the native scrolling is only done on the body and not scrollpane..?
		//const newColIndex=Math.min(this._cols.length-1,Math.max(0,this._cellCursorColIndex+numCols));
		if (!this._onlyDetails&&!this._naturalAutoHeight)
			this._scrollToCursor();//need this first to make sure adjacent cell is even rendered

		// Tab follows the logical details instance tree. Grid arrows use logical rows/columns; geometry is reserved for
		// choosing between visual rows created by wrapping within one lineup.
		const isVerticalArrow=vSign!==0&&(e?.key==="ArrowUp"||e?.key==="ArrowDown"
			||e?.code==="ArrowUp"||e?.code==="ArrowDown");
		if (!isVerticalArrow)
			this._resetVerticalLayoutPreferredColumn();
		if ((e?.key==="Tab"||e?.code==="Tab")&&this._activeDetailsCell)
			this._moveDetailsTab(hSign<0?-1:1);
		else if (this._getActiveRepeatedReorderLayout())
			this._moveInsideRepeatedReorder(hSign,vSign);
		else if (this._activeDetailsCell?.parent?.schemaNode.type==="grid")
			this._moveInsideGrid(hSign,vSign);
		else if (this._activeDetailsCell?.parent?.schemaNode.type==="lineup")
			this._moveInsideLineup(hSign,vSign,isVerticalArrow);
		else if (vSign) {//moving up or down
			let newColIndex=this._mainColIndex;
			if (this._activeDetailsCell) {//moving from inside details.might move to another cell inside,or outside
				this._selectAdjacentDetailsCell(this._activeDetailsCell,vSign==1);
			} else if (vSign===1&&this._openDetailsPanes[this._mainRowIndex]
				&&!this._openDetailsPanes[this._mainRowIndex].collapsing
				&&this._rowMeta.get(this._filteredData[this._mainRowIndex])?.h){//moving down into details
				this._selectFirstSelectableDetailsCell(this._openDetailsPanes[this._mainRowIndex],true);
			} else if (vSign===-1&&this._openDetailsPanes[this._mainRowIndex-1]
				&&!this._openDetailsPanes[this._mainRowIndex-1].collapsing
				&&this._rowMeta.get(this._filteredData[this._mainRowIndex-1])?.h){//moving up into details
				this._selectFirstSelectableDetailsCell(this._openDetailsPanes[this._mainRowIndex-1],false);
			} else {//moving from and to maintable-cells
				const adjacentCell=this._findSelectableMainCellFromRow(
					this._selectedCell.parentElement[(vSign>0?"next":"previous")+"ElementSibling"],vSign,newColIndex);
				if (adjacentCell)
					this._selectMainTableCell(adjacentCell);
				else
					this._selectAdjacentMainTable(vSign>0,newColIndex);
			}
		} else if (!this._activeDetailsCell)
			this._selectMainTableCell(this._getAdjacentSelectableMainCell(this._selectedCell,hSign));
		if ((this._onlyDetails||this._naturalAutoHeight)&&this._mainRowIndex!=null)
			this._scrollToCursor();
	}

	/**
	 * Move to the previous/next logical navigable details cell for Tab/Shift+Tab.
	 * Ordering comes exclusively from the rendered instance tree; DOM geometry is intentionally irrelevant. Every
	 * closed group is one logical cell, while open groups expose their children. Hidden and disabled
	 * nodes use the same instance flags and canonical cell-state rules as the rest of Tablance navigation.
	 */
	_moveDetailsTab(direction) {
		const root=this._openDetailsPanes[this._mainRowIndex];
		if (!root||!this._activeDetailsCell)
			return false;
		const cells=[];
		this._collectLogicalDetailsCells(root,cells);
		const logicalCurrent=this._activeDetailsCell.schemaNode?.type==="reorder"
			?this._activeDetailsCell.ownerEntry:this._activeDetailsCell;
		const currentIndex=cells.indexOf(logicalCurrent);
		const target=currentIndex<0?null:cells[currentIndex+direction];
		if (target)
			return this._selectDetailsCell(target);
		return this._leaveDetailsByTab(direction);
	}

	_resetVerticalLayoutPreferredColumn() {
		if (this._activeVerticalLayout&&this._activeVerticalLayoutColumnKey)
			this._activeVerticalLayout[this._activeVerticalLayoutColumnKey]=null;
		this._activeVerticalLayout=null;
		this._activeVerticalLayoutColumnKey=null;
	}

	_getDetailsCellRect(instanceNode) {
		const cellEl=instanceNode?.selEl??instanceNode?.el;
		if (!cellEl?.isConnected||!cellEl.getClientRects().length)
			return;
		const rect=cellEl.getBoundingClientRect();
		if (rect.bottom<=rect.top||rect.right<=rect.left)
			return;
		return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
			centerX:(rect.left+rect.right)/2};
	}

	/**Build visual rows only for one lineup. Geometry is ephemeral; instance nodes remain navigation identity.*/
	_getLineupVisualRows(lineup,navigableOnly=true) {
		const geometries=[];
		for (let logicalOrder=0;logicalOrder<(lineup?.children?.length??0);logicalOrder++) {
			const instanceNode=lineup.children[logicalOrder];
			if (instanceNode.hidden||(navigableOnly&&!this._isNavigableDetailsInstance(instanceNode)))
				continue;
			const rect=this._getDetailsCellRect(instanceNode);
			if (!rect)
				continue;
			geometries.push({instanceNode,logicalOrder,...rect});
		}
		geometries.sort((a,b)=>a.top-b.top||a.left-b.left||a.logicalOrder-b.logicalOrder);
		const rows=[];
		const overlapEpsilon=.5;
		for (const geometry of geometries) {
			const row=rows.at(-1);
			const overlap=row
				?Math.min(row.overlapBottom,geometry.bottom)-Math.max(row.overlapTop,geometry.top):0;
			if (!row||overlap<=overlapEpsilon) {
				rows.push({items:[geometry],overlapTop:geometry.top,overlapBottom:geometry.bottom,
					top:geometry.top,bottom:geometry.bottom});
				continue;
			}
			row.items.push(geometry);
			// Keeping the common intersection prevents partial/transitive overlaps from joining separate visual rows.
			row.overlapTop=Math.max(row.overlapTop,geometry.top);
			row.overlapBottom=Math.min(row.overlapBottom,geometry.bottom);
			row.top=Math.min(row.top,geometry.top);
			row.bottom=Math.max(row.bottom,geometry.bottom);
		}
		return rows;
	}

	_refreshLineupRowExtensions(lineup) {
		if (lineup?.schemaNode?.type!=="lineup")
			return;
		for (const extension of lineup.lineupRowExtensions??[])
			this._removeLineupRowExtension(extension);
		lineup.lineupRowExtensions=[];
		this._syncLineupResizeObservation(lineup);
		const containerRect=lineup.containerEl.getBoundingClientRect();
		if (!lineup.containerEl.isConnected||containerRect.right<=containerRect.left)
			return;
		for (const row of this._getLineupVisualRows(lineup,false)) {
			const rightmostOccupied=row.items.reduce((rightmost,item)=>!rightmost||item.right>rightmost.right?item:rightmost,null);
			const target=row.items.filter(item=>this._isNavigableDetailsInstance(item.instanceNode))
				.reduce((rightmost,item)=>!rightmost||item.right>rightmost.right?item:rightmost,null);
			if (!rightmostOccupied||!target||rightmostOccupied.right>=containerRect.right-.5)
				continue;
			const extension=lineup.containerEl.appendChild(document.createElement("span"));
			extension.className="lineup-row-extension";
			extension.setAttribute("aria-hidden","true");
			extension.style.left=`${rightmostOccupied.right-containerRect.left}px`;
			extension.style.top=`${row.top-containerRect.top}px`;
			extension.style.height=`${row.bottom-row.top}px`;
			extension._tablanceLineupTarget=target.instanceNode;
			extension._tablanceLineupHoverEl=target.instanceNode.schemaNode.type==="group"
				?target.instanceNode.el:(target.instanceNode.selEl??target.instanceNode.el);
			extension.addEventListener("mouseenter",()=>this._setLineupRowExtensionHover(extension,true));
			extension.addEventListener("mouseleave",()=>this._setLineupRowExtensionHover(extension,false));
			lineup.lineupRowExtensions.push(extension);
		}
	}

	_syncLineupResizeObservation(lineup) {
		this._lineupResizeObserver??=new ResizeObserver(entries=>{
			const changedLineups=new Set(entries.map(entry=>entry.target._tablanceLineupOwner).filter(Boolean));
			for (const changedLineup of changedLineups)
				this._refreshLineupRowExtensions(changedLineup);
		});
		const current=new Set([lineup.containerEl,...(lineup.children??[]).map(child=>child.outerContainerEl).filter(Boolean)]);
		for (const oldElement of lineup.lineupObservedElements??[])
			if (!current.has(oldElement)) {
				this._lineupResizeObserver.unobserve(oldElement);
				delete oldElement._tablanceLineupOwner;
			}
		for (const element of current)
			if (!lineup.lineupObservedElements?.has(element)) {
				element._tablanceLineupOwner=lineup;
				this._lineupResizeObserver.observe(element);
			}
		lineup.lineupObservedElements=current;
	}

	_setLineupRowExtensionHover(extension,hovered) {
		extension?.classList.toggle("lineup-extension-hover",hovered);
		extension?._tablanceLineupHoverEl?.classList.toggle("lineup-extension-target-hover",hovered);
	}

	_removeLineupRowExtension(extension) {
		this._setLineupRowExtensionHover(extension,false);
		extension?.remove();
	}

	_pickLineupRowTarget(row,sourceRect) {
		if (!row?.items.length)
			return;
		if (!sourceRect)
			return row.items[0].instanceNode;
		const pointX=sourceRect.centerX;
		const score=item=>[
			pointX<item.left?item.left-pointX:pointX>item.right?pointX-item.right:0,
			Math.abs(item.centerX-pointX),
			item.logicalOrder
		];
		const compare=(a,b)=>{
			const aScore=score(a),bScore=score(b);
			return aScore[0]-bScore[0]||aScore[1]-bScore[1]||aScore[2]-bScore[2];
		};
		return row.items.reduce((best,item)=>compare(item,best)<0?item:best).instanceNode;
	}

	_collectLogicalDetailsCells(instanceNode,cells) {
		if (!instanceNode||instanceNode.hidden)
			return cells;
		const schemaNode=instanceNode.schemaNode;
		const children=instanceNode.children??[];
		if (schemaNode?.type==="group") {
			const isOpen=instanceNode.el?.classList.contains("open");
			if (!isOpen) {
				if (this._isNavigableDetailsInstance(instanceNode))
					cells.push(instanceNode);
				return cells;
			}
			const before=cells.length;
			for (const child of children)
				this._collectLogicalDetailsCells(child,cells);
			// Empty structural groups remain reachable through their existing group/action cell.
			if (cells.length===before&&this._isNavigableDetailsInstance(instanceNode))
				cells.push(instanceNode);
			return cells;
		}
		if (schemaNode?.type==="field"||(!children.length&&instanceNode.el)) {
			if (this._isNavigableDetailsInstance(instanceNode))
				cells.push(instanceNode);
			return cells;
		}
		for (const child of children)
			this._collectLogicalDetailsCells(child,cells);
		return cells;
	}

	_isNavigableDetailsInstance(instanceNode) {
		const cellEl=instanceNode?.selEl??instanceNode?.el;
		return !!cellEl&&!instanceNode.hidden&&this._getCellState(cellEl,instanceNode)?.selectable!==false;
	}

	_leaveDetailsByTab(direction) {
		if (!this._onlyDetails) {
			const row=this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+direction}"]:not(.details)`);
			const target=this._findSelectableMainCellFromRow(row,direction,this._mainColIndex);
			return target?this._selectMainTableCell(target):false;
		}
		const nextTable=this.neighbourTables?.[direction>0?"down":"up"];
		if (!nextTable)
			return false;
		this._mainColIndex=this._mainRowIndex=this._activeDetailsCell=null;
		nextTable._focusEl.style.outline=this._cellCursor.style.display="none";
		return nextTable.selectTopBottomCellOnlyDetails(direction>0);
	}

	_selectAdjacentMainTable(isGoingDown,preferredColIndex) {
		const nextTable=this.neighbourTables?.[isGoingDown?"down":"up"];
		if (!nextTable||!nextTable._selectTopBottomMainCell(isGoingDown,preferredColIndex))
			return;
		this._mainColIndex=this._mainRowIndex=null;
		this._cellCursor.style.display="none";
	}

	_selectTopBottomMainCell(isGoingDown,preferredColIndex) {
		if (this._onlyDetails) {
			this.selectTopBottomCellOnlyDetails(isGoingDown);
			return true;
		}
		const rows=[...this._mainTbody.querySelectorAll(":scope>tr:not(.details)")];
		const row=isGoingDown?rows[0]:rows.at(-1);
		if (!row)
			return;
		const selectableCells=[...row.cells].filter(cell=>this._getCellState(cell)?.selectable!==false);
		if (!selectableCells.length)
			return;
		const targetCell=selectableCells.reduce((closest,cell)=>
			Math.abs(cell.cellIndex-preferredColIndex)<Math.abs(closest.cellIndex-preferredColIndex)?cell:closest);
		this._focusEl.focus({preventScroll:true});
		this._selectMainTableCell(targetCell);
		this._scrollToCursor();
		return true;
	}

	_getAdjacentSelectableMainCell(cell,direction) {
		for (let candidate=cell?.[direction>0?"nextElementSibling":"previousElementSibling"];
			candidate;candidate=candidate[direction>0?"nextElementSibling":"previousElementSibling"])
			if (this._getCellState(candidate)?.selectable!==false)
				return candidate;
	}

	_findSelectableMainCellFromRow(row,direction,preferredColIndex) {
		for (let candidateRow=row;candidateRow;
			candidateRow=candidateRow[direction>0?"nextElementSibling":"previousElementSibling"]) {
			if (candidateRow.classList.contains("details"))
				continue;
			const selectable=[...candidateRow.cells].filter(cell=>this._getCellState(cell)?.selectable!==false);
			if (selectable.length)
				return selectable.reduce((closest,cell)=>Math.abs(cell.cellIndex-preferredColIndex)
					<Math.abs(closest.cellIndex-preferredColIndex)?cell:closest);
		}
	}

	_getActiveRepeatedReorderLayout() {
		const active=this._activeDetailsCell;
		const repeated=active?.schemaNode?.type==="reorder"?active.parent
			:active?.parent?.schemaNode?.type==="repeated"?active.parent:null;
		return repeated?.schemaNode?.reorder==null?null:repeated;
	}

	_getRepeatedReorderRows(repeated) {
		return (repeated?.children??[]).filter(entry=>this._isNavigableDetailsInstance(entry)).map(entry=>[
			entry.reorderCell&&!entry.reorderCell.hidden
				&&this._isNavigableDetailsInstance(entry.reorderCell)?entry.reorderCell:null,
			entry,
		]);
	}

	_moveInsideRepeatedReorder(numCols,numRows) {
		const repeated=this._getActiveRepeatedReorderLayout();
		if (!repeated)
			return false;
		return this._moveInsideLogicalRows(repeated,this._getRepeatedReorderRows(repeated),
			this._activeDetailsCell,numCols,numRows,"reorderPreferredColumn",repeated);
	}

	_moveInsideGrid(numCols,numRows) {
		const current=this._activeDetailsCell;
		const grid=current?.parent;
		if (!grid||grid.schemaNode.type!=="grid")
			return false;
		this._refreshGridLayout(grid);
		return this._moveInsideLogicalRows(grid,grid.gridRows,current,numCols,numRows,
			"gridPreferredColumn",grid);
	}

	_moveInsideLogicalRows(layout,rows,current,numCols,numRows,preferredColumnKey,boundaryNode) {
		const currentRow=rows.findIndex(row=>row.includes(current));
		if (currentRow<0)
			return false;
		const row=rows[currentRow];
		const currentStart=row.indexOf(current);
		const currentEnd=row.lastIndexOf(current);
		if (numCols) {
			this._resetVerticalLayoutPreferredColumn();
			const candidates=[...new Set(row)].filter(candidate=>candidate&&candidate!==current
				&&this._isNavigableDetailsInstance(candidate));
			const start=candidate=>row.indexOf(candidate);
			const end=candidate=>row.lastIndexOf(candidate);
			const target=candidates.filter(candidate=>numCols>0
				?start(candidate)>currentEnd:end(candidate)<currentStart)
				.sort((a,b)=>numCols>0?start(a)-start(b):end(b)-end(a))[0];
			return target?this._selectDetailsCell(target):false;
		}
		if (!numRows)
			return false;
		if (this._activeVerticalLayout!==layout
				||this._activeVerticalLayoutColumnKey!==preferredColumnKey) {
			this._resetVerticalLayoutPreferredColumn();
			this._activeVerticalLayout=layout;
			this._activeVerticalLayoutColumnKey=preferredColumnKey;
		}
		layout[preferredColumnKey]??=currentStart;
		const preferred=layout[preferredColumnKey];
		const direction=numRows>0?1:-1;
		for (let rowIndex=currentRow+direction;rowIndex>=0&&rowIndex<rows.length;
			rowIndex+=direction) {
			const candidateRow=rows[rowIndex]??[];
			const exact=candidateRow[preferred];
			if (exact&&exact!==current&&this._isNavigableDetailsInstance(exact))
				return this._selectDetailsCell(exact,true);
			const candidates=[...new Set(candidateRow)].filter(candidate=>candidate&&candidate!==current
				&&this._isNavigableDetailsInstance(candidate));
			if (!candidates.length)
				continue;
			const start=candidate=>candidateRow.indexOf(candidate);
			const end=candidate=>candidateRow.lastIndexOf(candidate);
			const distance=candidate=>preferred<start(candidate)
				?start(candidate)-preferred:preferred>end(candidate)?preferred-end(candidate):0;
			const target=candidates.reduce((best,candidate)=>distance(candidate)<distance(best)
				||(distance(candidate)===distance(best)&&start(candidate)<start(best))?candidate:best);
			return this._selectDetailsCell(target,true);
		}
		this._resetVerticalLayoutPreferredColumn();
		return this._selectAdjacentDetailsCell(boundaryNode,direction>0);
	}

	_moveInsideLineup(numCols,numRows,isVerticalArrow=false) {
		const activeCellEl=this._activeDetailsCell.selEl??this._activeDetailsCell.el;
		const currentCellX=activeCellEl.offsetLeft;
		const currCelTop=activeCellEl.offsetTop;
		const currCelBottom=currCelTop+activeCellEl.offsetHeight;
		if (numCols) {//moving left or right
			for (let i=this._activeDetailsCell.index,nextCel;nextCel=this._activeDetailsCell.parent.children[i+=numCols];) {
				const nextCellEl=nextCel.selEl??nextCel.el;
				if (nextCellEl.offsetParent != null && (nextCellEl.offsetLeft>currentCellX)==(numCols>0)) {
					if (this._getCellState(nextCellEl,nextCel)?.selectable!==false
						&&currCelBottom>nextCellEl.offsetTop&&nextCellEl.offsetTop+nextCellEl.offsetHeight>currCelTop)
						this._selectDetailsCell(nextCel);
					break;
				}
			}
		} else {//moving up or down
			const direction=numRows>0?1:-1;
			if (!isVerticalArrow) {
				let closestCell,closestCellX;
				const siblings=this._activeDetailsCell.parent.children;
				for (let i=this._activeDetailsCell.index,otherCell;otherCell=siblings[i+=numRows];) {
					const otherCellEl=otherCell.selEl??otherCell.el;
					const skipCell=this._getCellState(otherCellEl,otherCell)?.selectable===false
						||Math.max(otherCellEl.offsetTop,currCelTop)
							<=Math.min(otherCellEl.offsetTop+otherCellEl.offsetHeight,currCelBottom)
						||otherCellEl.offsetParent==null;
					if (skipCell)
						continue;
					if (closestCell&&(otherCellEl.offsetLeft<closestCellX)===(numRows>0))
						break;
					if (!closestCell||Math.abs(otherCellEl.offsetLeft-currentCellX)
						<Math.abs(closestCellX-currentCellX)) {
						closestCell=otherCell;
						closestCellX=otherCellEl.offsetLeft;
					} else
						break;
				}
				return closestCell?this._selectDetailsCell(closestCell)
					:this._selectAdjacentDetailsCell(this._activeDetailsCell.parent,direction>0);
			}
			const sourceRect=this._getDetailsCellRect(this._activeDetailsCell);
			const rows=this._getLineupVisualRows(this._activeDetailsCell.parent);
			const currentRowIndex=rows.findIndex(row=>row.items.some(
				item=>item.instanceNode===this._activeDetailsCell));
			const target=this._pickLineupRowTarget(rows[currentRowIndex+direction],sourceRect);
			if (target)
				return this._selectDetailsCell(target);
			return this._selectAdjacentDetailsCell(this._activeDetailsCell.parent,direction>0);
		}
	}

	_selectAdjacentDetailsCell(instanceNode,isGoingDown) {
		let cell=this._getAdjacentDetailsCell(instanceNode,isGoingDown);//repeat this line until valid cell is found?
		if (cell)
			return this._selectDetailsCell(cell);
		if (!this._onlyDetails) {
			const row=this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+isGoingDown}"]`);
			const target=this._findSelectableMainCellFromRow(row,isGoingDown?1:-1,this._mainColIndex);
			if (target)
				this._selectMainTableCell(target);
		}
		else {
			const nextTable=this.neighbourTables?.[isGoingDown?"down":"up"];
			if (nextTable) {
				this._mainColIndex=this._mainRowIndex=this._activeDetailsCell=null;
				nextTable._focusEl.style.outline=this._cellCursor.style.display="none";
				nextTable.selectTopBottomCellOnlyDetails(isGoingDown);
			}
		}
	}
	
	_getAdjacentDetailsCell (instanceNode,isGoingDown) {
		if (!instanceNode.parent)//parent is null if the class-instance is in the bulk-edit-area
			return;
		const siblings=instanceNode.parent.children;
		const index=instanceNode.index;
		for (let i=index+(isGoingDown||-1); i>=0&&i<siblings.length; i+=isGoingDown||-1) {
			const sibling=siblings[i];
			if (sibling.hidden)
				continue;
			if (sibling.el) {
				if (this._getCellState(sibling.selEl??sibling.el,sibling)?.selectable!==false)
					return sibling;
				continue;
			}
			//else if sibling.children
			const niece=this._getFirstSelectableDetailsCell(sibling,isGoingDown);
			if (niece)
				return niece;
		}
		if (instanceNode.parent.parent)
			return this._getAdjacentDetailsCell(instanceNode.parent,isGoingDown);
	}

	_selectFirstSelectableDetailsCell(instanceNode,isGoingDown,onlyGetChild=false) {
		const newInstanceNode=this._getFirstSelectableDetailsCell(instanceNode,isGoingDown,onlyGetChild);
		if (newInstanceNode)
			return this._selectDetailsCell(newInstanceNode);
		const row=this._mainTbody.querySelector(
			`[data-data-row-index="${this._mainRowIndex+(isGoingDown||-1)}"]`);
		const target=this._findSelectableMainCellFromRow(row,isGoingDown?1:-1,this._mainColIndex);
		if (target)
			this._selectMainTableCell(target);
	}

	/**Given an instanceNode, like the details of a row or any of its sub-containers, it will return the first
	 * selectable cell from top or bottom
	 * @param {*} instanceNode
	 * @param {Boolean} isGoingDown 
	 * @param {Boolean} onlyGetChild if set to true then it will never return the passed in instanceNode and instead
	 *			only look at its (grand)children. Used for groups where both itself and its children can be selected*/
	_getFirstSelectableDetailsCell(instanceNode,isGoingDown,onlyGetChild=false) {
		if (!onlyGetChild&&instanceNode.el) {
			if (this._getCellState(instanceNode.selEl??instanceNode.el,instanceNode)?.selectable!==false)
				return instanceNode;
			return;
		}
		const children=instanceNode.children;
		if (!children?.length)//check needed if a repeated-container hs a single field instead of a group
			return onlyGetChild?instanceNode:undefined;
		let startI=isGoingDown?0:children.length-1;
		if (instanceNode.schemaNode.type==="lineup"&&!isGoingDown) {
			let chosenCell;
			for (let i=startI,otherCell;otherCell=children[i--];)
				if ((otherCell.selEl??otherCell.el)?.offsetParent)
					if (!chosenCell||(otherCell.selEl??otherCell.el).offsetLeft
						<(chosenCell.selEl??chosenCell.el).offsetLeft)
						chosenCell=otherCell;
					else
						break;
			if (chosenCell)
				startI=chosenCell.index;
		}
		for (let childI=startI;childI>=0&&childI<children.length; childI+=isGoingDown||-1)
			if (!children[childI].hidden&&(children[childI].children||children[childI].select)) {
				const target=this._getFirstSelectableDetailsCell(children[childI],isGoingDown);
				if (target)
					return target;
			}
	}
	
	_spreadsheetKeyDown(e) {
		//prevent this from running in outer Tablance if an inner Tablance-instance is selected
		if (this._bulkEditArea?.contains(document.activeElement))
			return;
		if (this._toolbar?.contains(e.target))
			return;
		if (this._searchInput && document.activeElement === this._searchInput) {
			// Block navigation when the search bar is active; add keys here to passthrough in the future.
			const searchPassthroughKeys=[];
			if (!searchPassthroughKeys.includes(e.key))
				return;
		}
		if (e.key==="F1"&&this._showSelectedCellHelp()) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (this._inReadOnlyMode)
			return this._readOnlyPresentationKeyDown(e);
		if (this._handleRepeatedReorderKey(e))
			return;
		this._tooltip.style.visibility="hidden";
		const keysThatEnterFromOutline=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape",
								"NumpadAdd","NumpadSubtract","Enter","NumpadEnter","Space"];

		if (!this._inEditMode&&this._mainRowIndex==null&&this._mainColIndex==null) {
			if (e.code==="Tab")
				return;

			// First navigation keystroke after focusing the table should select the top-left cell (or top details cell).
			if (keysThatEnterFromOutline.includes(this._expansionShortcutCode(e))&&this._filteredData.length) {
				if (this._onlyDetails)
					this.selectTopBottomCellOnlyDetails(true);
				else {
					const firstCell=this._findSelectableMainCellFromRow(this._mainTbody.rows[0],1,0);
					if (firstCell)
						this._selectMainTableCell(firstCell);
				}
			}
		}

		this._highlightOnFocus=false;
		this._focusEl.classList.remove("show-focus-ring");
		this._focusEl.style.outline="none";//see #spreadsheetOnFocus

		if (this._inEditMode&&this._activeSchemaNode.input?.type==="date") {
			if (e.key.slice(0,5)==="Arrow") {
				if (e.ctrlKey)
					e.stopPropagation();//allow moving textcursor if ctrl is held so prevent date-change then
				else
					e.preventDefault();//prevent textcursor from moving when arrowkey-selecting dates in date-picker
			} else if (e.key==="Backspace")
				e.stopPropagation();
		}
		if (!this._inEditMode) {
			this._spreadsheetKeyDown_non_edit_mode(e);
		} else {
			// Scroll back to the active cell if the user types (non-modifier key) or hits Escape while editing;
			// this also catches blocked keystrokes so the cursor stays in view even when input is denied.
			const inputKeyPressed=!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.isComposing&&
				(e.key.length === 1 || ["Backspace","Delete","Space"].includes(e.code));
			if (inputKeyPressed||e.key=="Escape")
				this._scrollToCursor();
			switch (e.key) {
				case "Tab":
					e.preventDefault();
					this._moveCellCursor(e.shiftKey?-1:1,0,e);
				break; case "Enter":
					this._moveCellCursor(0,e.shiftKey?-1:1,e);
				break; case "Escape":
					this._exitEditMode(false);
					if (e.ctrlKey) {
						e.preventDefault();
						e.stopPropagation();
						if (this._inEditMode)
							this._exitEditMode(false);
						// Ctrl+Esc: discard current open-group edits (or delete creator) and close it.
						this._discardActiveGroupEdits();
					}
			}
		}
	}

	_expansionShortcutCode(e) {
		if (!e.ctrlKey&&!e.metaKey&&!e.isComposing) {
			// Match the character, not a physical key position, across keyboard layouts.
			if (!e.altKey&&(e.key==="+"||e.key==="-"))
				return e.key==="+"?"NumpadAdd":"NumpadSubtract";
			if (e.altKey&&!e.shiftKey&&(e.key==="ArrowDown"||e.key==="ArrowUp"))
				return e.key==="ArrowDown"?"NumpadAdd":"NumpadSubtract";
		}
		return e.code;
	}

	_spreadsheetKeyDown_non_edit_mode(e) {
		const code=this._expansionShortcutCode(e);
		if (code!==e.code&&e.altKey)
			e.preventDefault();
		const scrollKeys=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape",
							"NumpadAdd","NumpadSubtract","Enter","NumpadEnter"];
		if (scrollKeys.includes(code))
			this._scrollToCursor();
		switch (code) {
			case "ArrowUp":
				this._moveCellCursor(0,-1,e);
			break; case "ArrowDown":
				this._moveCellCursor(0,1,e);
			break; case "ArrowLeft":
				this._moveCellCursor(-1,0,e);
			break; case "ArrowRight":
				this._moveCellCursor(1,0,e);
			break; case "Tab":
				e.preventDefault();
				this._moveCellCursor(e.shiftKey?-1:1,0,e);
			break; case "Escape":
				if (this._cancelActiveDeleteConfirmation()) {
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				if (e.ctrlKey) {
					e.preventDefault();
					e.stopPropagation();
					this._discardActiveGroupEdits();
					return;
				}
				this._groupEscape();
			break; case "NumpadAdd":
				this. _expandRow(this._selectedCell.closest(".main-table>tbody>tr"));
			break; case "NumpadSubtract":
				this._contractRow(this._selectedCell.closest(".main-table>tbody>tr"));
			break; case "KeyC":
				if (e.ctrlKey&&!e.metaKey&&!e.shiftKey) {
					e.preventDefault();
					this._copySelectedCellText();
				}
			break; case "Enter": case "NumpadEnter": case "Space":
				if (e.code=="Space")
					e.preventDefault();//prevent scrolling when pressing space
				if (this._activeSchemaNode.type=="expand")
					// the preventDefault() above can SOMETIMES suppress transitionend;
					// deferring one frame ensures the animation completes and details is closed properly.
					return requestAnimationFrame(()=>this._toggleRowExpanded(this._selectedCell.parentElement));
				if (this._activeSchemaNode.type=="select")
					return this._rowCheckboxChange(this._selectedCell,e.shiftKey);
				if (e.code.endsWith("Enter")||this._activeSchemaNode.input?.type==="button") {
					e.preventDefault();//prevent newline from being entered into textareas
					return this._enterCell(e);
				}
			}
	}

	_groupEscape() {
		for (let instanceNode=this._activeDetailsCell; instanceNode=instanceNode?.parent;)
			if (instanceNode.schemaNode.type==="group") {
				if (this._isUntouchedCreatingGroup(instanceNode))
					return this._deleteCell(instanceNode);
				return this._selectDetailsCell(instanceNode);
			}
	}

	_copySelectedCellText() {
		// Copy displayed text of the selected field when not in edit mode.
		if (this._inEditMode||this._selectedCellState?.selectable===false
			||this._activeSchemaNode?.type!=="field"||!this._selectedCell)
			return;
		const text=this._getDisplayedCellText();
		if (!text)
			return;
		const fallback=()=>this._copySelectedCellText_fallback(text);
		if (navigator?.clipboard?.writeText)
			navigator.clipboard.writeText(text).then(()=>this._showTooltip?.(this.lang.copiedToClipboard),fallback);
		else
			fallback();
	}

	_copySelectedCellText_fallback(text) {
		// Fallback using a hidden textarea; refocus table afterward so the cursor stays visible.
		const ta=document.createElement("textarea");
		ta.value=text;
		ta.style.position="fixed";
		ta.style.left="-9999px";
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand("copy"); } catch(_e) {}
		ta.remove();
		this.rootEl?.focus({preventScroll:true});
		this._showTooltip?.(this.lang.copiedToClipboard);
	}

	_insertAtCursor(myField, myValue) {
		
		if (document.selection) {//IE support
			myField.focus();
			const sel = document.selection.createRange();
			sel.text = myValue;
		} else if (myField.selectionStart || myField.selectionStart == '0') {//MOZILLA and others
			var startPos = myField.selectionStart;
			var endPos = myField.selectionEnd;
			myField.value = myField.value.substring(0, startPos)
				+ myValue
				+ myField.value.substring(endPos, myField.value.length);
		} else {
			myField.value += myValue;
		}
	}

	_unsortCol(dataKey,type) {
		for (let sortCol,i=-1;sortCol=this._sortingCols[++i];)
			if (dataKey&&dataKey==sortCol.dataKey||type&&type==sortCol.type) {
				this._sortingCols.splice(i,1);
				this._updateHeaderSortHtml();
				return;
			}
	}

	/**Creates the actual content of a expanded row. When the user expands a row #expandRow is first called which in
	 * turn calls this one. When scrolling and already expanded rows are found only this one needs to be called.
	 * @param {*} tr 
	 * @param {*} rowIndex 
	 * @returns */
	_renderDetails(tr,rowIndex) {
		tr.classList.add("expanded");
		const detailsRow=tr.parentElement.insertRow(tr.rowIndex+1);
		detailsRow.className="details";
		detailsRow.dataset.dataRowIndex=rowIndex;
		const detailsCell=detailsRow.insertCell();
		detailsCell.colSpan=this._cols.length;
		const detailsDiv=detailsCell.appendChild(document.createElement("div"));//single div inside td for animate
		detailsDiv.style.height="auto";
		detailsDiv.className="content";
		detailsDiv.addEventListener("transitionend",this._detailsAnimationEnd.bind(this));
		const shadowLine=detailsDiv.appendChild(document.createElement("div"));
		shadowLine.className="details-shadow";
		const instanceNode=this._openDetailsPanes[rowIndex]=this._createInstanceNode();
		this._generateDetailsContent(this._schema.details,rowIndex,instanceNode,detailsDiv,[],this._filteredData[rowIndex]);
		instanceNode.rowIndex=rowIndex;
		return detailsRow;
	}

	_detailsAnimationEnd(e) {
		if (e.currentTarget!==e.target)
			return;//otherwise it will apply to transitions of child-elements as well
		if (parseInt(e.target.style.height)) {//if expand finished

			e.target.style.height="auto";
		} else {//if contract finished

			const detailsTr=e.target.closest("tr");
			const mainTr=detailsTr.previousSibling;
			const dataRowIndex=parseInt(mainTr.dataset.dataRowIndex);
			const rowData=this._filteredData[dataRowIndex];
			const rowMeta=rowData?this._rowMeta.get(rowData):undefined;
			const mainRowHeight=this._naturalAutoHeight?mainTr.offsetHeight+this._borderSpacingY:this._rowHeight;
			mainTr.classList.remove("expanded");
			this._tableSizer.style.height=parseInt(this._tableSizer.style.height)
					 -(rowMeta?.h??mainRowHeight)+mainRowHeight+"px";
			detailsTr.remove();
			if (rowMeta){delete rowMeta.h; if (!Object.keys(rowMeta).length) this._rowMeta.delete(rowData);}
			delete this._openDetailsPanes[dataRowIndex];
			this._updateAutoHeight();
		}
	}

	/**
	 * Creates details content based on the provided structure.
	 *
	 * @param {object} schemaNode Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this details belongs to.
	 * @param {object} instanceNode The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this details is representing.
	 * @param {boolean} notYetCreated True if the instanceNode points to data within objects that do not yet exist.
	 * 		This happens when child objects get created lazily during user input.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		schemaNode with no create option).
	 */
	_generateDetailsContent(schemaNode,mainIndex,instanceNode,parentEl,path,rowData,_notYetCreated) {
		let notYetCreated=_notYetCreated;
		let scopedData=rowData;
		if (schemaNode.dataPath) {
			const ctx=Array.isArray(schemaNode.dataPath)
				? schemaNode.dataPath
				: String(schemaNode.dataPath).split(".").filter(Boolean);
			let target=scopedData;
			for (const key of ctx) {
				if (!target[key]||typeof target[key]!="object") {
					target[key]={};
					notYetCreated=true;
				}
				target=target[key];
			}
			scopedData=target;
		}
		if (!path.length)
		instanceNode.rowIndex=mainIndex;
		instanceNode.path=[...path];
		instanceNode.dataObj=scopedData;
		instanceNode.schemaNode=schemaNode;
		if (instanceNode.parentData===undefined) {
			const owner=instanceNode.parent?.schemaNode?.type==="repeated"
				?instanceNode.parent.parent?.dataObj:instanceNode.parent?.dataObj;
			instanceNode.parentData=owner&&typeof owner==="object"&&!Array.isArray(owner)?owner:null;
		}
		const protoForType=schemaNode.type==="field"?FIELD_INSTANCE_NODE_PROTOTYPE
			:schemaNode.type==="group"?GROUP_INSTANCE_NODE_PROTOTYPE
			:schemaNode.type==="repeated"?REPEATED_INSTANCE_NODE_PROTOTYPE
			:INSTANCE_NODE_PROTOTYPE;
		if (Object.getPrototypeOf(instanceNode)===INSTANCE_NODE_PROTOTYPE&&protoForType!==INSTANCE_NODE_PROTOTYPE)
			Object.setPrototypeOf(instanceNode,protoForType);
		if (schemaNode.visibleIf)
			this._applyVisibleIf(instanceNode);
		switch (schemaNode.type) {
			case "list": return this._generateDetailsList(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData,notYetCreated);
			case "field": return this._generateField(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData);
			case "group": return this._generateDetailsGroup(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData,notYetCreated);
			case "repeated": return this._generateDetailsRepeated(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData,notYetCreated);
			case "lineup": return this._generateDetailsLineup(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData,notYetCreated);
			case "grid": return this._generateDetailsGrid(schemaNode,mainIndex,instanceNode,parentEl,path,scopedData,notYetCreated);
		}
	}

	_repeatedOnDelete=({instanceNode})=>{
		const entryNode=instanceNode.parent.parent;
		const repeatedContainer=entryNode.parent;
		const itemIndex=this._getRepeatedDataIndex(entryNode);
		const payload=this._makeCallbackPayload(entryNode,{
			deletedDataItem: entryNode.dataObj,
			itemIndex,
			visualIndex: entryNode.index,
			repeatedSchemaNode: repeatedContainer?.schemaNode,
			entrySchemaNode: entryNode.schemaNode,
			deletedInstanceNode: entryNode,
			dataArray: repeatedContainer?.dataObj,
			dataKey: repeatedContainer?.schemaNode?.dataKey
		},{
			mainIndex: entryNode.rowIndex,
			rowData: repeatedContainer?.parent?.dataObj
		});
		let doDelete=true;
		let preventMessage;
		const beforeDelete=repeatedContainer?.schemaNode.beforeDelete;
		if (beforeDelete) {
			const remainingData=Array.isArray(payload.dataArray)
				?payload.dataArray.filter((_item,index)=>index!==itemIndex):[];
			const result=beforeDelete({...payload,remainingData,preventDelete:(message)=>{
				doDelete=false;
				preventMessage=message??preventMessage;
			}});
			if (result===false)
				doDelete=false;
		}
		if (!doDelete) {
			if (preventMessage)
				this._showTooltip(preventMessage,entryNode.selEl??entryNode.el);
			return false;
		}
		const deletion=this._deleteCell(entryNode);
		if (!deletion?.wasCreating)
			repeatedContainer?.schemaNode.onDelete?.(payload);
		return true;
	}

	_fileOnDelete=(payload)=>{
		const fileCell=payload.instanceNode.parent.parent;
		const inputSchemaNode=fileCell.fileInputSchemaNode;
		const dataRow=fileCell.parent.dataObj;
		delete dataRow[inputSchemaNode.dataKey];
		const fileTd=fileCell.el.parentElement;
		fileTd.innerHTML="";
		fileTd.classList.remove("group-cell");
		this._generateDetailsContent(inputSchemaNode,payload.mainIndex,fileCell,fileTd,fileCell.path,dataRow);
		inputSchemaNode.deleteHandler?.(payload);
		this._selectDetailsCell(fileCell);
	}

	/** Build the delete controls schema snippet for repeated/file entries. */
	_buildDeleteControls(schemaNode,fallbackSchemaNode=null) {
		const setting=key=>schemaNode?.[key]??fallbackSchemaNode?.[key];
		return {type:"lineup",variant:"controls",cssClass:"delete-controls"
			,deleteConfirmationText:setting("deleteAreYouSureText")??this.lang.deleteAreYouSure
			,onBlur:cel=>cel.selEl.querySelector(".lineup").classList.remove("delete-confirming")
			,entries:[{type:"field",input:{type:"button",
				text:setting("deleteText")??this.lang.delete
				,onClick:this._beginDeleteRepeated.bind(this)},cssClass:"delete"},
			{type:"field",input:{type:"button"
				,text:setting("areYouSureNoText")??this.lang.deleteAreYouSureNo
				,onClick:this._cancelDelete.bind(this)},cssClass:"no"},
			{type:"field",input:{type:"button"
				,text:setting("areYouSureYesText")??this.lang.deleteAreYouSureYes
				,onClick:this._fileOnDelete},cssClass:"yes"}]};
	}

	/**
	 * This is "supposed" to get called when a repeated-schemaNode is found however in #generateDetailsList,
	 * repeated schema-nodes are looked for and handled by that method instead so that titles can be added to the list
	 * which isn't handled by #generateDetailsContent but by the list-method itself
	 *
	 * @param {object} repeatedSchemaNode Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this details belongs to.
	 * @param {object} instanceNode The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this details is representing.
	 * @param {boolean} notYetCreated True if the instanceNode points to data within objects that do not yet exist.
	 * 		This happens when child objects get created lazily during user input.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		schemaNode with no create option).
	 */
	_generateDetailsRepeated(repeatedSchemaNode,mainIndex,instanceNode,parentEl,path,rowData,_notYetCreated) {
		instanceNode.children=[];
		let repeatData=rowData?.[repeatedSchemaNode.dataKey];
		if (!Array.isArray(repeatData))
			repeatData=[];
		this._validateRepeatedDataArray(repeatData);
		instanceNode.dataObj=repeatData;
		instanceNode.insertionPoint=parentEl.appendChild(document.createComment("repeated-insert"));
		repeatedSchemaNode.create&&this._generateRepeatedCreator(instanceNode);
		repeatData?.forEach(repeatData=>this._repeatInsert(instanceNode,false,repeatData));
		this._arrangeRepeatedInstances(instanceNode);
		return !!repeatData?.length||repeatedSchemaNode.create;
	}

	/**For repeated schema-nodes with create set to true (meaning users can create more entries via user-interface),
	 * this method creates the last entry that the user interacts with to create another entry
	 * @param {Object} repeatedObj The object representing the repeated-container*/
	_generateRepeatedCreator(repeatedObj) {
		const creationTxt=repeatedObj.schemaNode.creationText??this.lang.insertEntry;
		const creationSchemaNode={type:"group",closedRender:()=>creationTxt,entries:[],
							creator:true//used to know that this entry is the creator and that it should not be sorted
							,onOpen:repeatedObj.createNewEntry.bind(repeatedObj),cssClass:"repeat-insertion"};
		const wrappedCreationSchemaNode=this._buildSchemaFacade(creationSchemaNode);//WRAPPED
		const el=this._repeatInsert(repeatedObj,false,{},wrappedCreationSchemaNode);
		el.parentElement.classList.add("empty");//this will make it hidden if inside a group that is closed
	}

	_beginDeleteRepeated({instanceNode}) {
		if (!instanceNode.parent.parent.creating) {
			instanceNode.parent.containerEl.classList.add("delete-confirming");

			//select "No" button (or rather the first visible button). We're doing this in a loop because depending on
			// the circumstance the index of it may be different. For file-deletion the button-container also contains
			//open-button, but not for when deleting other repeated-entries.
			for (const buttonInstanceNode of instanceNode.parent.children)
				if ((buttonInstanceNode.selEl??buttonInstanceNode.el).offsetParent) {
					this._selectDetailsCell(buttonInstanceNode);
					break;
				}
		} else
			this._deleteCell(instanceNode.parent.parent);
	}

	_cancelDelete({instanceNode}) {
			instanceNode.parent.containerEl.classList.remove("delete-confirming");
			this._selectDetailsCell(instanceNode.parent.children[0]);
	}

	_cancelActiveDeleteConfirmation() {
		const controls=this._activeDetailsCell?.parent;
		if (!controls?.containerEl?.classList.contains("delete-confirming")
			||!controls.containerEl.classList.contains("delete-controls"))
			return false;
		this._cancelDelete({instanceNode:this._activeDetailsCell});
		return true;
	}

	_wrapRepeatedEntryForDeletion(entrySchemaNode,repeatedSchemaNode=null) {
		if (entrySchemaNode?.creator)
			return entrySchemaNode;
		if (entrySchemaNode?.type==="group")
			return this._schemaCopyWithDeleteButton(entrySchemaNode,this._repeatedOnDelete,repeatedSchemaNode);
		const rawEntry=entrySchemaNode?.[SCHEMA_WRAPPER_MARKER]?entrySchemaNode.raw:entrySchemaNode;
		const rawGroup={type:"group",entries:[rawEntry],origin:"internal",isImplicit:true,entryAutoGroup:true};
		const wrappedGroup=this._schemaCopyWithDeleteButton(rawGroup,this._repeatedOnDelete,repeatedSchemaNode);
		wrappedGroup.isImplicit=true;
		if (!wrappedGroup.parent&&entrySchemaNode?.parent)
			wrappedGroup.parent=entrySchemaNode.parent;
		if (!wrappedGroup.origin)
			wrappedGroup.origin="internal";
		if (entrySchemaNode?.[SCHEMA_WRAPPER_MARKER])
			this._cloneDependencyMetadata(entrySchemaNode,wrappedGroup.entries?.[0]);
		return wrappedGroup;
	}

	_schemaCopyWithDeleteButton(schemaNode,deleteHandler,deleteConfigSchemaNode=null) {
		const deleteControls=this._buildDeleteControls(deleteConfigSchemaNode??schemaNode,schemaNode);
		deleteControls.entries[2].input.onClick=deleteHandler;
		const rawNode=schemaNode?.[SCHEMA_WRAPPER_MARKER]?schemaNode.raw:schemaNode;
		const parentWrapped=schemaNode?.[SCHEMA_WRAPPER_MARKER]?schemaNode.parent:null;
		if (!rawNode)
			return schemaNode;
		const clonedEntries=[...(rawNode.entries??[]),deleteControls];
		const clonedNode={...rawNode, entries:clonedEntries};
		// Wrap the cloned schema so delete controls can be injected without mutating the original schema tree.
		const wrappedClone=this._buildSchemaFacade(clonedNode,parentWrapped);
		if (schemaNode?.[SCHEMA_WRAPPER_MARKER])
			this._cloneDependencyMetadata(schemaNode,wrappedClone);
		return wrappedClone;
	}

	_cloneDependencyMetadata(sourceNode,targetNode) {
		// Delete-button clones must preserve dependency metadata (forward/backward dep paths),
		// otherwise dependents stop updating because the cloned nodes never register dependencies.
		const copyMeta=(srcVal)=>{
			if (Array.isArray(srcVal))
				return srcVal.map(v=>Array.isArray(v)?[...v]:v);
			if (srcVal&&typeof srcVal==="object")
				return {...srcVal};
			return srcVal;
		};
		for (const key of ["dependencyPaths","dependsOnCellPaths","dependsOnCellSources",
			"dependsOnDataPath","dependsOnDataPaths"])
			if (sourceNode?.[key]!==undefined)
				targetNode[key]=copyMeta(sourceNode[key]);
		const sourceChildren=this._dep_children(sourceNode);
		const targetChildren=this._dep_children(targetNode);
		for (let i=0;i<sourceChildren.length&&i<targetChildren.length;i++)
			this._cloneDependencyMetadata(sourceChildren[i],targetChildren[i]);
	}

		_generateButton(schemaNode,mainIndex,parentEl,scopedData,instanceNode=null) {
		// Details refreshes pass the button itself after the initial render. Reuse it instead of appending a new button
		// inside the existing control on every refreshSubtree call.
		if (parentEl.matches?.("button")) {
			parentEl.innerHTML=schemaNode.input.text;
			return parentEl;
		}
			const btn=parentEl.appendChild(document.createElement("button"));
			btn.tabIndex="-1";//so it can't be tabbed to
			btn.innerHTML=schemaNode.input.text;
			btn.addEventListener("click",e=>{
				const payload=this._makeCallbackPayload(instanceNode,{event:e,file:scopedData},{
					schemaNode,
					mainIndex,
				});
				schemaNode.input.onClick?.(payload);
			});

			//prevent gaining focus upon clicking it whhich would cause problems. It should be "focused" by having the
			//cellcursor on its cell which triggers it with enter-key anyway
			btn.addEventListener("mousedown",e=>e.preventDefault());
			return btn;
	}

		/**
	 * Creates details content based on the provided structure.
	 *
	 * @param {object} groupSchemaNode Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this details belongs to.
	 * @param {object} instanceNode The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this details is representing.
	 * @param {boolean} notYetCreated True if the instanceNode points to data within objects that do not yet exist.
	 * 		This happens when child objects get created lazily during user input.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		schemaNode with no create option).
	 */
	_generateDetailsGroup(groupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData,notYetCreated) {
		const groupTable=parentEl.appendChild(document.createElement("table"));
		const tbody=instanceNode.containerEl=groupTable.appendChild(document.createElement("tbody"));
		groupTable.dataset.path=path.join("-");
		parentEl.classList.add("group-cell");
		instanceNode.el=groupTable;
		// A group instance is visually represented by its own table even when its canonical selection/state surface is
		// an enclosing cell. Keep cursor geometry at that semantic group level for every group, including repeated
		// entries and repeated creators; presentation containers such as repeated.grouping must not decide this.
		instanceNode.cursorEl=groupTable;
		//A group directly inside a list is visually a full value cell, including the cell's padding. Use that cell as
		//the hit target so an empty group does not shrink the clickable area to the height of its inner table.
		if (instanceNode.parent?.schemaNode.type==="list") {
			instanceNode.selEl=parentEl;
			parentEl.dataset.path=groupTable.dataset.path;
		}
		this._generateDetailsCollection(groupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
		groupTable.className="details-group "+(groupSchemaNode.cssClass??"");
		const chevron=document.createElement("span");
		chevron.className="group-chevron";
		chevron.setAttribute("aria-hidden","true");
		instanceNode.groupChevronEl=chevron;
		// A missing dataPath is created lazily for ordinary structural groups as well. Only an entry whose direct
		// owner is a repeated container is a pending creation; treating every lazy data object as one makes closing an
		// untouched static group delete its instance from the details tree.
		const isRepeatedCreation=notYetCreated&&instanceNode.parent?.schemaNode.type==="repeated";
		if (isRepeatedCreation) {
			instanceNode.creating=true;
			this._placeGroupChevron(instanceNode);
		} else if (groupSchemaNode.closedRender)
			this._setClosedRender(instanceNode,groupSchemaNode.closedRender(rowData),path,tbody);
		else
			this._placeGroupChevron(instanceNode);
		const statePayload=this._makeCallbackPayload(instanceNode,{value:rowData},{
			schemaNode:groupSchemaNode,mainIndex,rowData
		});
		this._setCellState(groupTable,this._resolveCellState(groupSchemaNode,statePayload),instanceNode);
		this._setupRepeatedReorderEntry(instanceNode);
		return true;
	}

	/**
	 * Creates details content based on the provided structure.
	 *
	 * @param {object} listSchemaNode Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this details belongs to.
	 * @param {object} instanceNode The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this details is representing.
	* @param {boolean} notYetCreated True if the instanceNode points to data within objects that do not yet exist.
	 * 		This happens when child objects get created lazily during user input.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		schemaNode with no create option).
	 */
	_generateDetailsList(listSchemaNode,mainIndex,instanceNode,parentEl,path,rowData,_notYetCreated) {
		const listTable=parentEl.appendChild(document.createElement("table"));
		instanceNode.containerEl=listTable.appendChild(document.createElement("tbody"));
		listTable.className="details-list";
		if (listSchemaNode.titlesColWidth!=false) {
			let titlesCol=document.createElement("col");
			listTable.appendChild(document.createElement("colgroup")).appendChild(titlesCol);
			if (listSchemaNode.titlesColWidth!=null)
				titlesCol.style.width=listSchemaNode.titlesColWidth;
		}
		return this._generateDetailsCollection(listSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
	}

	/**
	 * Creates details content based on the provided structure.
	 *
	 * @param {object} lineupSchemaNode Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this details belongs to.
	 * @param {object} instanceNode The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this details is representing.
	* @param {boolean} notYetCreated True if the instanceNode points to data within objects that do not yet exist.
	 * 		This happens when child objects get created lazily during user input.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		schemaNode with no create option).
	 */
	_generateDetailsLineup(lineupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData,_notYetCreated) {
		instanceNode.containerEl=parentEl.appendChild(document.createElement("div"));
		const variant=this._resolveLineupVariant(lineupSchemaNode);
		const wrap=lineupSchemaNode.wrap??true;
		if (typeof wrap!=="boolean")
			throw new TypeError("lineup.wrap must be a boolean.");
		instanceNode.lineupVariant=variant;
		instanceNode.containerEl.classList.add("lineup",`lineup-${variant}`,wrap?"lineup-wrap":"lineup-nowrap","collection",
			...lineupSchemaNode.cssClass?.split(" ")??[]);
		if (lineupSchemaNode.deleteConfirmationText!=null) {
			const prompt=instanceNode.containerEl.appendChild(document.createElement("span"));
			prompt.className="delete-confirmation-prompt";
			prompt.textContent=String(lineupSchemaNode.deleteConfirmationText);
		}
		const generated=this._generateDetailsCollection(lineupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
		this._refreshLineupRowExtensions(instanceNode);
		return generated;
	}

	_generateDetailsGrid(gridSchemaNode,mainIndex,instanceNode,parentEl,path,rowData,_notYetCreated) {
		const columnSchema=gridSchemaNode.columns;
		let columns,gridTemplateColumns;
		if (Number.isInteger(columnSchema)&&columnSchema>0) {
			columns=columnSchema;
			gridTemplateColumns=`repeat(${columns}, minmax(0, 1fr))`;
		} else if (Array.isArray(columnSchema)&&columnSchema.length
			&&columnSchema.every(track=>typeof track==="string"&&track.trim())) {
			columns=columnSchema.length;
			gridTemplateColumns=columnSchema.map(track=>track.trim()).join(" ");
			const validationStyle=document.createElement("div").style;
			validationStyle.gridTemplateColumns=gridTemplateColumns;
			if (!validationStyle.gridTemplateColumns)
				throw new TypeError("grid.columns contains an invalid CSS track value.");
		} else
			throw new TypeError("grid.columns must be a positive integer or a non-empty array of CSS track values.");
		if (gridSchemaNode.entries?.some(entry=>entry.type==="repeated"))
			throw new TypeError("A repeated container cannot be a direct child of a grid.");
		instanceNode.gridColumns=columns;
		instanceNode.gridPreferredColumn=null;
		instanceNode.containerEl=parentEl.appendChild(document.createElement("div"));
		instanceNode.containerEl.classList.add("details-grid","collection",
			...gridSchemaNode.cssClass?.split(" ")??[]);
		instanceNode.containerEl.style.gridTemplateColumns=gridTemplateColumns;
		const generated=this._generateDetailsCollection(gridSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
		this._refreshGridLayout(instanceNode);
		return generated;
	}

	_refreshGridLayout(grid) {
		if (grid?.schemaNode?.type!=="grid")
			return;
		const columns=grid.gridColumns;
		const rows=[];
		let row=0,column=0;
		for (const child of grid.children??[]) {
			const span=child.schemaNode.columnSpan??1;
			if (!Number.isInteger(span)||span<1||span>columns)
				throw new TypeError("A grid child columnSpan must be a positive integer no larger than grid.columns.");
			child.gridColumnSpan=span;
			if (child.hidden) {
				child.gridRow=child.gridColumn=null;
				continue;
			}
			if (column+span>columns) {
				row++;
				column=0;
			}
			child.gridRow=row;
			child.gridColumn=column;
			rows[row]??=Array(columns).fill(null);
			for (let slot=column;slot<column+span;slot++)
				rows[row][slot]=child;
			child.outerContainerEl.style.gridRow=String(row*2+1);
			child.outerContainerEl.style.gridColumn=`${column+1} / span ${span}`;
			column+=span;
			if (column===columns) {
				row++;
				column=0;
			}
		}
		grid.gridRows=rows;
		const separatorCount=Math.max(0,rows.length-1);
		grid.gridRowSeparators??=[];
		while (grid.gridRowSeparators.length<separatorCount) {
			const separator=grid.containerEl.appendChild(document.createElement("hr"));
			separator.className="grid-row-separator";
			separator.setAttribute("aria-hidden","true");
			grid.gridRowSeparators.push(separator);
		}
		while (grid.gridRowSeparators.length>separatorCount)
			grid.gridRowSeparators.pop().remove();
		grid.gridRowSeparators.forEach((separator,index)=>{
			separator.style.gridRow=String((index+1)*2);
			separator.style.gridColumn="1 / -1";
		});
		this._refreshGridRowExtensions(grid);
	}

	_refreshGridRowExtensions(grid) {
		for (const extension of grid.gridRowExtensions??[])
			this._removeGridRowExtension(extension);
		grid.gridRowExtensions=[];
		for (let rowIndex=0;rowIndex<(grid.gridRows?.length??0);rowIndex++) {
			const row=grid.gridRows[rowIndex];
			const distinct=[...new Set(row.filter(Boolean))];
			const rightmostOccupied=distinct.reduce((rightmost,cell)=>!rightmost
				||cell.gridColumn+cell.gridColumnSpan>rightmost.gridColumn+rightmost.gridColumnSpan?cell:rightmost,null);
			const target=distinct.filter(cell=>this._isNavigableDetailsInstance(cell))
				.reduce((rightmost,cell)=>!rightmost
					||cell.gridColumn+cell.gridColumnSpan>rightmost.gridColumn+rightmost.gridColumnSpan?cell:rightmost,null);
			if (!rightmostOccupied||!target)
				continue;
			const extension=document.createElement("span");
			extension.className="grid-row-extension";
			extension.setAttribute("aria-hidden","true");
			extension._tablanceGridTarget=target;
			extension._tablanceGridHoverEl=target.schemaNode.type==="group"?target.el:(target.selEl??target.el);
			extension.addEventListener("mouseenter",()=>this._setGridRowExtensionHover(extension,true));
			extension.addEventListener("mouseleave",()=>this._setGridRowExtensionHover(extension,false));
			rightmostOccupied.outerContainerEl.appendChild(extension);
			grid.gridRowExtensions.push(extension);
		}
	}

	_setGridRowExtensionHover(extension,hovered) {
		extension?.classList.toggle("grid-extension-hover",hovered);
		extension?._tablanceGridHoverEl?.classList.toggle("grid-extension-target-hover",hovered);
	}

	_removeGridRowExtension(extension) {
		this._setGridRowExtensionHover(extension,false);
		extension?.remove();
	}

	_resolveLineupVariant(lineupSchemaNode) {
		const requested=lineupSchemaNode.variant??"auto";
		if (!["auto","fields","metadata","controls"].includes(requested))
			throw new TypeError(`Unknown lineup variant: ${requested}`);
		if (requested!=="auto")
			return requested;
		let hasFieldEditor=false;
		let hasControl=false;
		for (const entry of lineupSchemaNode.entries??[]) {
			if (entry.input?.type==="button"||(!entry.input&&entry.onEnter))
				hasControl=true;
			else if (entry.input)
				hasFieldEditor=true;
		}
		if (hasFieldEditor)
			return "fields";
		if (hasControl)
			return "controls";
		return "metadata";
	}

	/**
	 * Generates the children of a container schema node (list/lineup/group).
	 * Handles repeated entries specially; otherwise delegates to _generateCollectionItem.
	 */
	_generateDetailsCollection(containerSchemaNode,mainIndex,collectionObj,parentEl,path,rowData) {
		//allows for easily finding the outer-most parent of elements that are placed in collection
		collectionObj.containerEl.classList.add("collection");

		collectionObj.children=[];
		for (let entryI=-1,childSchemaNode; childSchemaNode=containerSchemaNode.entries[++entryI];) {
			if (childSchemaNode.type==="repeated") {
				const repeatData=rowData?.[childSchemaNode.dataKey];
				if (Array.isArray(repeatData))
					this._validateRepeatedDataArray(repeatData);
				const rptCelObj=collectionObj.children[entryI]=Object.assign(
					this._createInstanceNode(collectionObj,entryI,REPEATED_INSTANCE_NODE_PROTOTYPE),
					{children:[],schemaNode:childSchemaNode,dataObj:Array.isArray(repeatData)?repeatData:[],path:[...path,entryI]}
				);
				// Capture parentData at creation time so persistence never walks ancestors later.
				const ownerData=collectionObj.dataObj;
				rptCelObj.parentData=ownerData&&typeof ownerData==="object"&&!Array.isArray(ownerData)?ownerData:null;
				rptCelObj.dataArray=Array.isArray(repeatData)?repeatData:undefined;
				rptCelObj.insertionPoint=collectionObj.containerEl.appendChild(document.createComment("repeat-insert"));
				childSchemaNode.create&&this._generateRepeatedCreator(rptCelObj);
				repeatData?.forEach(repeatData=>this._repeatInsert(rptCelObj,false,repeatData));
				this._arrangeRepeatedInstances(rptCelObj);
				for (const entry of rptCelObj.children)
					this._syncRepeatedReorderEntry(entry);
			} else
				this._generateCollectionItem(childSchemaNode,mainIndex,collectionObj,path,rowData);
		}
		return true;
	}

	_validateRepeatedDataArray(dataArray) {
		if (!Array.isArray(dataArray))
			throw new TypeError("Repeated data must be an array.");
		const identities=new Set;
		for (const entry of dataArray) {
			if (entry==null||typeof entry!=="object"||Array.isArray(entry))
				throw new TypeError("Every repeated data entry must be an object.");
			if (identities.has(entry))
				throw new TypeError("Repeated data entries must have unique object identities.");
			identities.add(entry);
		}
	}

	/**
	 * Build correct DOM structure for a collection item depending on collection type.
	 * Returns both outermost element (outerContainerEl) and the inner element (containerEl)
	 * where the content will be placed.
	 * 
	 * Also sets special properties on itemObj for group items.
	 */
	_buildCollectionItemDOM(schemaNode,collection,itemObj) {
		let outerContainerEl,containerEl;
		const type=collection.schemaNode.type;
		const hasTitle=schemaNode.title!=null&&String(schemaNode.title)!=="";

		// LIST: Each item is a <tr> with title cell optionally + value cell
		if (type=="list") {
			outerContainerEl=document.createElement("tr");
			if (collection.schemaNode.titlesColWidth!=false) {
				const td=outerContainerEl.insertCell();
				td.className="title";
				this._populateSchemaTitle(td,schemaNode,itemObj,{reserveHelpSlot:true});
			}
			containerEl=outerContainerEl.insertCell();
		} else if (type=="lineup"||type==="grid") {// Flow/grid items use their outer box as the canonical cell.
			outerContainerEl=document.createElement("span");
			if (hasTitle) {
				const title=outerContainerEl.appendChild(document.createElement("span"));
				title.className="title";
				this._populateSchemaTitle(title,schemaNode,itemObj,{reserveHelpSlot:true});
			}
			itemObj.selEl=outerContainerEl;
			containerEl=outerContainerEl.appendChild(document.createElement("div"));
		} else if (type=="group") {//GROUP: More complex <tr> with special rules for empty/hiding and more
			outerContainerEl=document.createElement("tr");
			outerContainerEl.className="empty";	// Will be hidden while group is closed until content becomes non-empty

			const td=outerContainerEl.insertCell();

			// Add separator for non-group members
			if (schemaNode.type!="group")
				td.appendChild(document.createElement("hr")).className="separator";

			if (hasTitle) {
				const title=td.appendChild(document.createElement("span"));
				title.className="title";
				this._populateSchemaTitle(title,schemaNode,itemObj,{reserveHelpSlot:true});
			}

			containerEl=td.appendChild(document.createElement("div"));

			// Track non-empty descendants so empty group rows can hide visually
			Object.assign(itemObj,{
				nonEmptyDescentants:0,
				grpTr:outerContainerEl,
				selEl:td
			});
		} else
			outerContainerEl=containerEl=document.createElement("div");
		return {outerContainerEl,containerEl};
	}

	/**
	 * Insert the newly generated collection item into the DOM, either at end or at a precise insert position.
	 * Handles "repeated" collections where insertion point is not always end of list.
	 */
	_insertCollectionItem(schemaNode,index,itemObj,outerContainerEl,collectionOrRepeated,collectionEl) {
		let siblingAfter=null;

		// For repeated collections: determine the real insertion position based on insertionPoint
		if (collectionOrRepeated.schemaNode.type=="repeated") {
			const next=collectionOrRepeated.insertionPoint.nextSibling;
			const base=collectionOrRepeated.children.length;
			const pos=(next?.rowIndex??base)-base+index;
			siblingAfter=collectionOrRepeated.children[pos];
		}

		// Where to insert in the DOM
		const beforeEl=siblingAfter?.el.closest(".collection>*")?? collectionOrRepeated.insertionPoint;

		collectionEl.insertBefore(outerContainerEl,beforeEl);

		// Insert into internal children array
		collectionOrRepeated.children.splice(index,0,itemObj);

		// Extra CSS class if defined in schemaNode
		if (schemaNode.cssClass)
			outerContainerEl.className+=" "+schemaNode.cssClass;
	}
	
	

	/**
	 * Generate one item inside a collection or repeated block.
	 * Creates DOM, updates indices, generates inner content, and inserts into DOM
	 * only if details content was actually created (e.g., repeated with empty data should not add item).
	 */
	_generateCollectionItem(schemaNode,mainIndex,collectionOrRepeated,path,data,index=null, creating=false) {
		// Determine actual collection (repeated uses parent collection visually)
		const collection=collectionOrRepeated.schemaNode.type=="repeated"
									?collectionOrRepeated.parent:collectionOrRepeated;

		const collectionEl=collection.containerEl;
		index??=collectionOrRepeated.children.length;

		// Item object (holds metadata for this item)
		const prototypeForChild=schemaNode.type==="field"?FIELD_INSTANCE_NODE_PROTOTYPE
			:schemaNode.type==="group"?GROUP_INSTANCE_NODE_PROTOTYPE
			:INSTANCE_NODE_PROTOTYPE;
		const itemObj=this._createInstanceNode(collectionOrRepeated,index,prototypeForChild);
		// Capture parentData when the instance is created (never search later).
		const ownerData=collectionOrRepeated.schemaNode.type==="repeated"
			?collectionOrRepeated.parent?.dataObj:collectionOrRepeated.dataObj;
		itemObj.parentData=ownerData&&typeof ownerData==="object"&&!Array.isArray(ownerData)?ownerData:null;
		if (collectionOrRepeated.schemaNode.type==="repeated")
			itemObj.dataArray=Array.isArray(collectionOrRepeated.dataObj)?collectionOrRepeated.dataObj:undefined;

		// Build DOM structure for this item
		const {outerContainerEl,containerEl}=this._buildCollectionItemDOM(schemaNode,collection,itemObj);
		if (collection.schemaNode.type==="lineup")
			this._applyLineupCellSizing(schemaNode,outerContainerEl);


		// Visual CSS classes
		if (schemaNode.input&&schemaNode.input.type!="button")
			containerEl.classList.add("input-cell");
		containerEl.classList.add("value");
		if (schemaNode.input)
			outerContainerEl.classList.add((schemaNode.input.type??"text")+"-container");

		// If inserting in middle: update sibling item indices
		if (index<collectionOrRepeated.children.length)
			for (let i=index-1,sibling; sibling=collectionOrRepeated.children[++i];)
				this._changeInstanceNodeIndex(sibling,i+1);

		path.push(index);

		itemObj.outerContainerEl=outerContainerEl;//reference to outer-most container belonging exclusively to this item

		// Expand inner content; may return false if nothing should be rendered
		const generated=this._generateDetailsContent(schemaNode,mainIndex,itemObj,containerEl,path,data,creating);

		// Only insert if it actually has content (important for sparse repeated arrays)
		if (generated)
			this._insertCollectionItem(schemaNode,index,itemObj,outerContainerEl,collectionOrRepeated,collectionEl);

		path.pop();
		return itemObj;
	}

	_applyLineupCellSizing(schemaNode,cellEl) {
		if (schemaNode.width!=null) {
			const width=typeof schemaNode.width==="number"?`${schemaNode.width}px`:schemaNode.width;
			if (typeof width!=="string"||!width.trim())
				throw new TypeError("A lineup cell width must be a number or non-empty CSS length.");
			cellEl.style.flexBasis=width;
		}
		let grow=schemaNode.grow??0;
		if (grow===true)
			grow=1;
		else if (grow===false)
			grow=0;
		if (typeof grow!=="number"||!Number.isFinite(grow)||grow<0)
			throw new TypeError("A lineup cell grow value must be true, false, or a non-negative number.");
		cellEl.style.flexGrow=String(grow);
	}

	_generateField(fieldSchemaNode,mainIndex,instanceNode,parentEl,path,scopedData) {
		instanceNode.el=parentEl;
		this._updateDetailsCell(instanceNode,scopedData);
		instanceNode[instanceNode.selEl?"selEl":"el"].dataset.path=path.join("-");
		return true;
	}
	
	_spreadsheetMouseDown(e) {
		this._resetVerticalLayoutPreferredColumn();
		this._highlightOnFocus=false;//see decleration
		this._focusEl.classList.remove("show-focus-ring");
		this._focusEl.style.outline="none";//see #spreadsheetOnFocus
		this._tooltip.style.visibility="hidden";
		if (Date.now()<this._ignoreClicksUntil)//see decleration of #ignoreClicksUntil
			return;
		if (e.which===3)//if right click
			return;
		const mainTr=e.target.closest(".main-table>tbody>tr");
		if (this._onlyDetails||mainTr?.classList.contains("details")) {//in details
			const extension=e.target.closest(".grid-row-extension,.lineup-row-extension");
			const extensionTarget=extension?._tablanceGridTarget??extension?._tablanceLineupTarget;
			const directInstance=e.target.closest(".repeated-reorder-cell")?._tablanceInstanceNode;
			const interactiveEl=extensionTarget?.selEl??extensionTarget?.el??e.target.closest('[data-path]');
			if (!interactiveEl)
				return directInstance?this._selectDetailsCell(directInstance):undefined;
			const instanceNode=directInstance??this._resolvePointerDetailsInstance(interactiveEl,mainTr);
			this._selectDetailsCell(instanceNode);
		} else {//not in details
			const td=e.target.closest(".main-table>tbody>tr>td");
			if (this._getCellState(td)?.selectable===false)
				return;
			if (td?.classList.contains("expand-col")||td?.classList.contains("select-col")) {
				if (e.shiftKey)
					e.preventDefault();//prevent text-selection when shift-clicking checkboxes
				if (this._mainRowIndex==null) {
					this._selectMainTableCell(td);
					this._focusEl.focus({preventScroll:true});
				}
				if (td.classList.contains("expand-col"))
					return this._toggleRowExpanded(td.parentElement);
				return this._rowCheckboxChange(td,e.shiftKey);
			}
			this._selectMainTableCell(td);
		}
	}

	_resolvePointerDetailsInstance(interactiveEl,mainTr=null) {
		let instanceNode=this._openDetailsPanes[mainTr?.dataset.dataRowIndex??0];
		if (!instanceNode||instanceNode.collapsing||!interactiveEl?.dataset.path)
			return;
		for (const step of interactiveEl.dataset.path.split("-")) {
			instanceNode=instanceNode.children[step];
			if (!instanceNode)
				return;
			if (instanceNode.schemaNode.type==="group"&&!instanceNode.el.classList.contains("open"))
				break;
		}
		return instanceNode;
	}

	_detailsRowExtensionDoubleClick(e) {
		const extension=e.target.closest(".grid-row-extension,.lineup-row-extension");
		if (!extension)
			return;
		const mainTr=extension.closest(".main-table>tbody>tr.details");
		const target=extension._tablanceGridTarget??extension._tablanceLineupTarget;
		const targetEl=target?.selEl??target?.el;
		const pointerTarget=this._resolvePointerDetailsInstance(targetEl,mainTr);
		if (pointerTarget&&pointerTarget===this._activeDetailsCell)
			this._enterCell(e);
	}

	_toggleRowExpanded(tr) {
		if (tr.classList.contains("expanded"))
			this._contractRow(tr);
		else
			this._expandRow(tr);
	}

	_rowCheckboxChange(td,shift) {
		const checked=!td.querySelector("input").checked;
		const mainIndex=parseInt(td.parentElement.dataset.dataRowIndex);
		if (!shift)//shift not held, 
			this._lastCheckedIndex=mainIndex;//set #lastCheckedIndex to the current index to both start and stop at it
		this._toggleRowsSelected(checked,...[mainIndex,this._lastCheckedIndex??mainIndex].sort((a,b)=>a-b));
		this._lastCheckedIndex=mainIndex;//if shift held next time then rows between this and new mainIndex are checked
	}

	_toggleRowsSelected(checked,fromIndex,toIndex) {
		this._unsortCol(null,"select");
		for (var i=fromIndex;i<=toIndex; i++){
			if (i>=this._scrollRowIndex&&i<this._scrollRowIndex+this._numRenderedRows) {
				const tr=this._mainTbody.querySelector(`[data-data-row-index="${i}"]`);
				tr.querySelector(".select-col input").checked=checked;
				tr.classList.toggle("selected",checked);
			}
			if (checked&&this._selectedRows.indexOf(this._filteredData[i])==-1) {
				this._selectedRows.push(this._filteredData[i]);
				this._numRowsSelected++;
				this._numRowsInViewSelected++;
			} else if (!checked&&this._selectedRows.indexOf(this._filteredData[i])!=-1) {
				this._selectedRows.splice(this._selectedRows.indexOf(this._filteredData[i]),1);
				this._numRowsSelected--;
				this._numRowsInViewSelected--;
			}
		}
		this._numberOfRowsSelectedSpan.innerText=this._numRowsSelected;
		this._updateNumRowsSelectionState();
		this._updateBulkEditAreaCells();
	}

	_updateNumRowsSelectionState() {
		const checkbox=this._headerTr.querySelector(".select-col input");
		if (this._numRowsInViewSelected==this._filteredData.length||!this._numRowsInViewSelected) {
			checkbox.indeterminate=false;
			checkbox.checked=this._numRowsInViewSelected;
		} else
			checkbox.indeterminate=true;
		if (this._numRowsSelected^this._bulkEditAreaOpen) {
			this._bulkEditAreaOpen=!!this._numRowsSelected;
			this._bulkEditArea.style.height=this._bulkEditAreaOpen?this._bulkEditAreaHeightPx+"px":0;
			this._animate(this._updateViewportHeight,Infinity,"adjustViewportHeight");
		}
	}

	_animate(func,runForMs,id) {
		const runUntil=Date.now()+runForMs;
		const animations=this._animations;
		if (!animations[id]) {
			animations[id]=runUntil;
			requestAnimationFrame(frame);
		} else
			animations[id]=runUntil;
		function frame() {
			func();
			if (Date.now()<animations[id])
				requestAnimationFrame(frame);
			else
				delete animations[id];
		}
	}

	_autoTextAreaResize(e) {
		const maxHeight=this._activeSchemaNode.maxHeight??Infinity;
		
		//__auto-resize__
		//first set height to auto.This won't make it auto-resize or anything but will rather set its height to about 40
		e.target.style.height="auto";
		//then set size of cellcursor, and also the underlying cell in order to make details-height adjust to scroll-
		//height of the textarea. Also add 1px because *sometimes* without logic the textarea would recieve a scrollbar
		//which can scroll about 1 px. Not sure if 1px is actually sufficent but let's start there.
		const editorHeight=Math.min(maxHeight,e.target.scrollHeight+1);
		if (this._inlineEditorValueEl) {
			this._inlineEditorValueEl.style.height=editorHeight+"px";
			this._adjustCursorPosSize(this._selectedCell);
		} else
			this._cellCursor.style.height=this._selectedCell.style.height=editorHeight+"px";
		//now set height of textarea to 100% of cellcursor which height is set with above line. this line and the one
		//setting it to auto "could" be skipped but that will result in the textarea not shrinking when needed.
		e.target.style.height="100%";

		//need to call this to make the height of the details adjust and reflect the change in size of the textarea
		this._updateDetailsHeight(this._selectedCell.closest("tr.details"));
	}

	_updateDetailsHeight(detailsTr) {
		if (!detailsTr)
			return;
		const contentDiv=detailsTr.querySelector(".content");
		const mainRowIndex=parseInt(detailsTr.dataset.dataRowIndex);
		const rowData=this._filteredData[mainRowIndex];
		if (!rowData) return;
		const rowMeta=this._rowMeta.get(rowData)??(this._rowMeta.set(rowData,{}),this._rowMeta.get(rowData));
		contentDiv.style.height="auto";//set to auto in case of in middle of animation, get correct height
		const mainRowHeight=this._naturalAutoHeight?detailsTr.previousElementSibling.offsetHeight+this._borderSpacingY
			:this._rowHeight;
		const prevRowHeight=rowMeta.h??mainRowHeight;
		const newRowHeight=mainRowHeight+detailsTr.offsetHeight+this._borderSpacingY;
		rowMeta.h=newRowHeight;
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)//adjust scroll-height reflect change...
			+newRowHeight-prevRowHeight+"px";//...in height of the table
		this._updateAutoHeight();
	}

	_openDateEdit(e) {
		const input=document.createElement("input");
		let pika,pikaContainer;
		//this._input.type="date";//using Pikaday instead which I find more user-friendly. Calendar can be opened
								//up right away and typing manualy is still permitted
		this._attachInputFormatter(input,{date:true});
		if (!window.Pikaday)
			console.warn("Pikaday-library not found");
		else {
			pikaContainer=this._cellCursor.parentElement.appendChild(document.createElement("div"));
			pikaContainer.className="pika-container";
			pika=new Pikaday({field:input,
				toString: d=>d.getFullYear()+"-"+('0'+(d.getMonth()+1)).slice(-2)+"-"+('0'+d.getDate()).slice(-2),
				onClose:()=>{
					pikaContainer.remove();
					pika.destroy();
					setTimeout(()=>this._exitEditMode(true));
				},
				container:pikaContainer,
				firstDay:1,//week starts on monday
				showWeekNumber:true,
				defaultDate: this._selectedCellVal ? new Date(this._selectedCellVal) : undefined,
				setDefaultDate:true,
				i18n: {
					previousMonth : 'Tidigare Månad',
					nextMonth     : 'Nästa Månad',
					months        : ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September'
																					,'Oktober','November','December'],
					weekdays      : ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag'],
					weekdaysShort : ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']
				},
				onOpen:()=>this._alignDropdown(pikaContainer),//have to wait until onOpen or size is 0
				onDraw: () => this._alignDropdown(pikaContainer)//not all months include the same number of weeks,
								//so sometimes the calendar gets taller or shorter and that's why we have to re-align
			});
			pika.el.style.position="static";//otherwise size of pikaContainer will be 0 and alignDropdown wont work
			if (e instanceof KeyboardEvent)
				e.stopPropagation();//otherwise the enter-press is propagated to Pikaday, immediately closing it
			input.addEventListener("input",onInput.bind(this));
			input.addEventListener("change",()=>this._inputVal=input.value);
		}
		
		this._appendCellEditor(input);
		input.value=this._selectedCellVal??"";
		input.placeholder=this._activeSchemaNode.input.placeholder??this.lang.datePlaceholder;
		input.focus();
		
		function onInput(_e) {
			const inputVal=input.value;
			pika.setDate(input.value);
			//the above line will change the text above by guessing where there should be zeroes and such so prevent
			//that by setting it back so that the user can type freely
			input.value=inputVal;
		}
	}

	/**Aligns dropdowns like select and date-picker correctly by the cellcursor or any other target-element specified */
	_alignDropdown(dropdown,target=this._cellCursor,preferredVertical,viewportMargin=0) {
		const isOpenPopover=typeof dropdown.showPopover==="function"&&dropdown.matches(":popover-open");
		if (isOpenPopover) {
			const targetRect=target.getBoundingClientRect();
			const viewportWidth=document.documentElement.clientWidth;
			const viewportHeight=document.documentElement.clientHeight;
			const spaceAbove=targetRect.top;
			const spaceBelow=viewportHeight-targetRect.bottom;
			const placeAbove=preferredVertical==="above"||(preferredVertical!=="below"
				&&spaceBelow<dropdown.offsetHeight&&spaceAbove>spaceBelow);
			const spaceLeft=targetRect.left;
			const spaceRight=viewportWidth-targetRect.right;
			const alignRight=spaceRight+targetRect.width<dropdown.offsetWidth&&spaceLeft>spaceRight;

			dropdown.classList.remove("above","below","left","right");
			dropdown.style.position="fixed";
			const desiredTop=placeAbove?targetRect.top-dropdown.offsetHeight:targetRect.bottom;
			const desiredLeft=alignRight?targetRect.right-dropdown.offsetWidth:targetRect.left;
			dropdown.style.top=Math.max(viewportMargin,
				Math.min(desiredTop,viewportHeight-dropdown.offsetHeight-viewportMargin))+"px";
			dropdown.style.left=Math.max(viewportMargin,
				Math.min(desiredLeft,viewportWidth-dropdown.offsetWidth-viewportMargin))+"px";
			dropdown.classList.add(placeAbove?"above":"below",alignRight?"right":"left");
			return;
		}

		const alignmentContainer=this._dropdownAlignmentContainer;//container of the dropdown
		const alignmentPos=this._getElPos(target);
		const viewportPos=alignmentContainer===dropdown.offsetParent?alignmentPos
							:this._getElPos(target,alignmentContainer);
		
		dropdown.classList.remove("above","below","left","right");
		if (preferredVertical==="above") {
			dropdown.style.top=alignmentPos.y-dropdown.offsetHeight+"px";
			dropdown.classList.add("above");
		} else if (preferredVertical==="below") {
			dropdown.style.top=alignmentPos.y+target.clientHeight+"px";
			dropdown.classList.add("below");
		} else {
			//if target-element is below middle of viewport or if in bulk-edit-area
			if (viewportPos.y+target.clientHeight/2>alignmentContainer.scrollTop+alignmentContainer.clientHeight/2) {
				//then place dropdown above target-element
				dropdown.style.top=alignmentPos.y-dropdown.offsetHeight+"px";
				dropdown.classList.add("above");
			} else {
				//else place dropdown below target-element
				dropdown.style.top=alignmentPos.y+target.clientHeight+"px";
				dropdown.classList.add("below");
			}
		}

		//if there's enough space to the right of target-element
		if (alignmentContainer.clientWidth-viewportPos.x>dropdown.offsetWidth) {
			//then align the left of the dropdown with the left of the target-element
			dropdown.style.left=alignmentPos.x+"px";
			dropdown.classList.add("left");
		} else {
			//otherwise align the right of the dropdown with the right of the target-element
			dropdown.style.left=alignmentPos.x-(dropdown.offsetWidth-target.offsetWidth)+"px";
			dropdown.classList.add("right");
		}
	}

	_enterCell(e) {
		this._resetVerticalLayoutPreferredColumn();
		if (this._inEditMode||this._inReadOnlyMode)
			return;
		if (!this._selectedCellState?.activatable) {
			if (this._selectedCellState?.kind==="readOnly")
				this._showReadOnlyActivationFeedback();
			return;
		}
		const selBefore=this._selectedCell;
		const schemaBefore=this._activeSchemaNode;
		let doEnter=true;
		if (this._activeSchemaNode.onEnter) {
			const payload=this._makeCallbackPayload(this._activeDetailsCell,{
				event:e,
				value:this._selectedCellVal,
				preventEnter:()=>doEnter=false
			},{
				schemaNode:this._activeSchemaNode,
				mainIndex:this._mainRowIndex
			});
			this._activeSchemaNode.onEnter(payload);
		}
		if (!doEnter||selBefore!==this._selectedCell||schemaBefore!==this._activeSchemaNode)
			return;
		if (this._selectedCellState.kind==="readOnly")
			return this._openReadOnlyPresentation(e);
		if (this._activeSchemaNode.type==="reorder") {
			e.preventDefault();
			return this._enterRepeatedReorderMode(this._activeDetailsCell.ownerEntry);
		}
		if (this._activeSchemaNode.input) {
			e.preventDefault();//prevent text selection upon entering editmode
			if (this._activeSchemaNode.input.type==="button")
				return (this._activeDetailsCell?.el??this._selectedCell.querySelector("button"))?.click();
			if (!this._selectedCellState.mutable)
				return false;
			this._clearStaticCellOverflowPreview();
			this._inputVal=this._selectedCellVal;
			this._inEditMode=true;
			this._cellCursor.classList.add("edit-mode");
			({textarea:this._openTextAreaEdit,date:this._openDateEdit,select:this._openSelectEdit
				,file:this._openFileEdit}[this._activeSchemaNode.input.type]??this._openTextEdit).call(this,e);
		} else if (this._activeSchemaNode.type==="group")
			this._openGroup(this._activeDetailsCell);
	}

	_showReadOnlyActivationFeedback() {
		const inlineTitle=this._selectedCell?.querySelector(":scope>span.title");
		const target=inlineTitle?this._selectedCell:this._cellCursor;
		if (!target)
			return false;
		this._clearReadOnlyActivationFeedback();
		target.classList.remove("read-only-activation-feedback");
		void target.offsetWidth;//Restart one short animation instead of queueing repeated activation attempts.
		target.classList.add("read-only-activation-feedback");
		this._readOnlyFeedbackTarget=target;
		this._readOnlyFeedbackTimer=setTimeout(()=>{
			target.classList.remove("read-only-activation-feedback");
			if (this._readOnlyFeedbackTarget===target)
				this._readOnlyFeedbackTarget=null;
		},640);
		return true;
	}

	_clearReadOnlyActivationFeedback() {
		clearTimeout(this._readOnlyFeedbackTimer);
		this._readOnlyFeedbackTarget?.classList.remove("read-only-activation-feedback");
		this._readOnlyFeedbackTarget=null;
	}

	_getInlineEditorValueEl() {
		if (!this._cellCursor.classList.contains("inline-title-indicator"))
			return null;
		const instanceNode=this._activeDetailsCell;
		return instanceNode?.el&&instanceNode.el!==(instanceNode.selEl??instanceNode.el)?instanceNode.el:null;
	}

	_getCellEditorHost() {
		const valueEl=this._getInlineEditorValueEl();
		if (!valueEl)
			return this._cellCursor;
		if (!this._inlineEditorHost) {
			this._inlineEditorValueEl=valueEl;
			this._inlineEditorValueHeight=valueEl.style.height;
			this._inlineEditorHost=this._cellCursor.appendChild(document.createElement("div"));
			this._inlineEditorHost.className="cell-value-editor";
		}
		this._syncInlineEditorGeometry();
		return this._inlineEditorHost;
	}

	_appendCellEditor(editor) {
		this._getCellEditorHost().appendChild(editor);
		return editor;
	}

	_syncInlineEditorGeometry() {
		if (!this._inlineEditorHost||!this._inlineEditorValueEl)
			return;
		const cursorRect=this._cellCursor.getBoundingClientRect();
		const valueRect=this._inlineEditorValueEl.getBoundingClientRect();
		Object.assign(this._inlineEditorHost.style,{
			left:valueRect.left-cursorRect.left+"px",
			top:valueRect.top-cursorRect.top+"px",
			width:valueRect.width+"px",
			height:valueRect.height+"px",
		});
	}

	_restoreInlineEditorLayout() {
		const valueEl=this._inlineEditorValueEl;
		if (valueEl)
			valueEl.style.height=this._inlineEditorValueHeight;
		this._inlineEditorHost=this._inlineEditorValueEl=this._inlineEditorValueHeight=null;
		if (valueEl) {
			const detailsTr=this._selectedCell?.closest("tr.details");
			if (detailsTr)
				this._updateDetailsHeight(detailsTr);
		}
	}

	_openReadOnlyPresentation(activationEvent=null) {
		if (this._selectedCellState?.kind!=="readOnly"||this._inReadOnlyMode)
			return false;
		activationEvent?.preventDefault?.();
		this._clearStaticCellOverflowPreview();
		this._readOnlyDisplayedText=this._getDisplayedCellText();
		this._inReadOnlyMode=true;
		this._cellCursor.classList.add("read-only-mode");
		const textarea=this._cellCursor.appendChild(document.createElement("textarea"));
		textarea.className="read-only-presentation";
		textarea.readOnly=true;
		textarea.setAttribute("aria-readonly","true");
		textarea.value=this._readOnlyDisplayedText;
		textarea.style.padding=getComputedStyle(this._selectedCell).padding;
		textarea.addEventListener("keydown",e=>this._readOnlyPresentationKeyDown(e));
		textarea.addEventListener("beforeinput",e=>e.preventDefault());
		textarea.addEventListener("paste",e=>e.preventDefault());
		textarea.addEventListener("drop",e=>e.preventDefault());
		textarea.addEventListener("cut",e=>{
			e.preventDefault();
			const selected=textarea.value.slice(textarea.selectionStart,textarea.selectionEnd);
			e.clipboardData?.setData("text/plain",selected);
		});
		textarea.addEventListener("input",()=>{
			if (textarea.value!==this._readOnlyDisplayedText) {
				const start=textarea.selectionStart;
				textarea.value=this._readOnlyDisplayedText;
				textarea.setSelectionRange(Math.min(start,textarea.value.length),Math.min(start,textarea.value.length));
			}
		});
		textarea.addEventListener("blur",()=>setTimeout(()=>this._exitReadOnlyMode(false)));
		const caretPosition=textarea.value.length;
		textarea.setSelectionRange(caretPosition,caretPosition);
		textarea.focus({preventScroll:true});
		textarea.setSelectionRange(caretPosition,caretPosition);
		return true;
	}

	_readOnlyPresentationKeyDown(e) {
		if (e.key==="Escape") {
			e.preventDefault();
			e.stopPropagation();
			return this._exitReadOnlyMode();
		}
		if (e.key==="Tab") {
			e.preventDefault();
			e.stopPropagation();
			this._exitReadOnlyMode();
			return this._moveCellCursor(e.shiftKey?-1:1,0,e);
		}
		if (e.key==="Enter")
			e.preventDefault();
		// Leave text navigation and copy shortcuts entirely to the native presentation control. The event may
		// bubble to the Tablance root, whose read-only-mode branch deliberately performs no cell navigation.
	}

	_exitReadOnlyMode(focusTable=true) {
		if (!this._inReadOnlyMode)
			return true;
		this._inReadOnlyMode=false;
		this._readOnlyDisplayedText=undefined;
		this._cellCursor.classList.remove("read-only-mode");
		this._cellCursor.replaceChildren();
		if (focusTable)
			this._focusEl.focus({preventScroll:true});
		this._adjustCursorPosSize(this._selectedCell);
		this._highlightOnFocus=false;
		return true;
	}

	_openGroup(groupObj) {
		let doOpen=true;
		groupObj.schemaNode.onOpen?.({preventDefault:()=>doOpen=false},groupObj);
		if (!doOpen)
			return;
		this._enterEditTransaction(groupObj);
		// Capture data snapshot on first open so cancel can restore in-place without breaking references.
		if (!groupObj._openSnapshot)
			groupObj._openSnapshot=this._cloneGroupData(groupObj.dataObj);
		groupObj.el.classList.add("open");
		this._syncGroupChevronVisibility(groupObj);
		this._selectDetailsCell(this._getFirstSelectableDetailsCell(groupObj,true,true));
		groupObj.schemaNode.onOpenAfter?.(groupObj);
		
	}

	_getCommitChangeKey(schemaNode) {
		if (!schemaNode)
			return;
		return schemaNode._dataPath?.join(".")??schemaNode.dataKey
			??(schemaNode._autoId!=null?String(schemaNode._autoId):undefined);
	}

	_normalizeCommitValue(schemaNode,rawVal) {
		// For selects, store the option value instead of the full {text,value} object.
		return schemaNode?.input?.type==="select"?this._getSelectValue(rawVal):rawVal;
	}

	_collectGroupChanges(groupObject) {
		const dirty=groupObject?._dirtyFields;
		if (!dirty?.size)
			return {changed:false,changes:{}};
		const changes={};
		for (const node of dirty) {
			const key=this._getCommitChangeKey(node.schemaNode);
			if (key==null)
				continue;
			const rawVal=node.dataObj?.[node.schemaNode.dataKey];
			changes[key]=this._normalizeCommitValue(node.schemaNode,rawVal);
		}
		return {changed:true,changes};
	}

	_buildGroupPayload(groupObject) {
		let mainIndex=groupObject.rowIndex;
		for (let root=groupObject; root.parent; root=root.parent)
			if (root.rowIndex!=null)
				mainIndex=root.rowIndex;
		const {changed:fieldsChanged,changes}=this._collectGroupChanges(groupObject);
		// Creation defaults form the draft baseline rather than a user change. Compare the complete current object so
		// editing and then restoring every value also returns the creation to its untouched state.
		const changed=groupObject.creating
			?!this._isUntouchedCreatingGroup(groupObject):fieldsChanged;
		const closeState={doClose:true,preventMessage:undefined};
		const mode=groupObject.creating?"create":"update";
		const normalizedChanges=groupObject.creating?null:changes;
		const basePayload=this._makeCallbackPayload(groupObject,{
			data: groupObject.dataObj,
			parentData: groupObject.parentData??null,
			mode,
			changes: normalizedChanges
		},{
			schemaNode: groupObject.schemaNode,
			mainIndex,
			rowData: Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:undefined,
			instanceNode: groupObject
		});
		const closePayload={...basePayload,
			// the below are on the onClose payload only; they are not propagated to onDataCommit.
			changed,preventClose:(message)=>{
				closeState.doClose=false;
				closeState.preventMessage=message??closeState.preventMessage;
			}
		};
		return {payload: basePayload,closePayload,closeState,changed};
	}

	_enterEditTransaction(groupObject) {
		// Track the currently open group stack; outermost close will flush buffered commits.
		const txn=this._editTransaction??(this._editTransaction={stack:[],intents:[],seq:0});
		if (!txn.stack.includes(groupObject))
			txn.stack.push(groupObject);
		return txn;
	}

	_isDescendantGroup(group,ancestor) {
		// Check if one group path is nested under another so cancels can drop child intents.
		if (!group||!ancestor)
			return false;
		if (group===ancestor)
			return true;
		const groupPath=group.path;
		const ancestorPath=ancestor.path;
		if (!Array.isArray(groupPath)||!Array.isArray(ancestorPath)||ancestorPath.length>groupPath.length)
			return false;
		for (let i=0;i<ancestorPath.length;i++)
			if (groupPath[i]!==ancestorPath[i])
				return false;
		return true;
	}

	_queueCommitIntent(payload,{group=null,instanceNode=null,depth=null,schemaNode=null}={}) {
		// Central place to collect commit payloads so flush ordering stays deterministic.
		const txn=this._editTransaction??(this._editTransaction={stack:[],intents:[],seq:0});
		const schema=schemaNode??payload?.schemaNode??instanceNode?.schemaNode??group?.schemaNode;
		const commitDepth=depth??instanceNode?.path?.length??group?.path?.length??0;
		if (payload.parentData===undefined) {
			// parentData is captured when the node is created; avoid any runtime ancestor searching.
			const capturedParent=instanceNode?.parentData??group?.parentData??null;
			payload.parentData=Array.isArray(capturedParent)?null:capturedParent;
		}
		if (!payload.mode)
			payload.mode="update";
		// Creation-only context should only be present for create commits.
		const intentDataKey=payload.mode==="create"
			?instanceNode?.schemaNode?.dataKey??schema?.dataKey
			:undefined;
		const intentDataArray=payload.mode==="create"
			?instanceNode?.dataArray
			:undefined;
		txn.intents.push({
			group,
			instanceNode: instanceNode??group,
			schemaNode: schema,
			dataKey: intentDataKey,
			dataArray: intentDataArray,
			payload,
			depth: commitDepth,
			seq: txn.seq++
		});
		return txn;
	}

	_bufferGroupCommit(groupObject,payload) {
		// Buffer commit intent until the outermost group closes; keep sequence for stable ordering.
		this._queueCommitIntent(payload,{group: groupObject, instanceNode: groupObject});
	}

	_queueDataCommit(payload,instanceNode=null,depthOverride=null) {
		// Queue a non-group commit and flush immediately when no outer transactions are open.
		// parentData must already be captured on the instance; we avoid searching ancestors here.
		if (payload.parentData===undefined) {
			const capturedParent=instanceNode?.parentData??null;
			payload.parentData=Array.isArray(capturedParent)?null:capturedParent;
		}
		if (!payload.mode)
			payload.mode="update";
		if (payload.mode==="create")
			payload.changes=null;
		for (const repeated of this._getRepeatedAncestors(instanceNode))
			this._finalizeRepeatedMutation(repeated);
		const transactionGroup=this._getOpenGroupAncestor(instanceNode?.parent);
		const txn=this._queueCommitIntent(payload,{group:transactionGroup,instanceNode,depth: depthOverride});
		if (!txn.stack.length)
			this._flushBufferedGroupCommits();
	}

	_removeGroupFromTransaction(groupObject,discardIntents=false) {
		// Remove a group (and optionally its descendants) from the open stack and buffered intents.
		const txn=this._editTransaction;
		if (!txn)
			return;
		txn.stack=txn.stack.filter(openGroup=>!this._isDescendantGroup(openGroup,groupObject));
		if (discardIntents)
			txn.intents=txn.intents.filter(({group})=>!this._isDescendantGroup(group,groupObject));
		if (!txn.stack.length&&(!txn.intents.length))
			this._editTransaction=null;
	}

	_flushBufferedGroupCommits() {
		// Emit commits in root->leaf order once no open groups remain; repeated nodes are structural only.
		// Persistence is centralized here;
		const txn=this._editTransaction;
		if (!txn?.intents.length)
			return;
		// Flush only after the outermost group commits so parents fire before children and cancels can discard safely.
		const commits=txn.intents.filter(({schemaNode})=>schemaNode?.type!=="repeated")
			.sort((a,b)=>a.depth-b.depth||a.seq-b.seq);
		const groupsTouched=new Set(commits.map(({group})=>group).filter(Boolean));
		const isRevertedUpdate=intent=>{
			const {group,payload}=intent;
			if (payload?.mode!=="update"||!group?._openSnapshot)
				return false;
			try {
				return JSON.stringify(group._openSnapshot)===JSON.stringify(group.dataObj);
			} catch(_e) {
				return false;
			}
		};
		const hasAnyRealCommit=commits.some(intent=>{
			const {payload}=intent;
			if (!payload)
				return false;
			if (payload.mode!=="update")
				return true;
			const changes=payload.changes;
			if (!changes||!Object.keys(changes).length)
				return false;
			return !isRevertedUpdate(intent);
		});
		if (!hasAnyRealCommit) {
			txn.intents.length=0;
			this._editTransaction=null;
			return;
		}
		const onDataCommit=this._schema?.onDataCommit;
		const emitDataCommit=(payload,dataKey,dataArray,schemaNode)=>{
			if (!onDataCommit)
				return;
			const targetedPayload=this._applyCommitTargetToPayload(payload,schemaNode);
			const creationContext=payload.mode==="create"?{
				...(dataKey!==undefined?{dataKey}:{}),
				...(dataArray!==undefined?{dataArray}:{}),
			}:{};
			onDataCommit({...targetedPayload,
				changes: targetedPayload?.changes==null?null:{...(targetedPayload?.changes??{})},
				...creationContext});
		};
		for (const intent of commits) {
			const {payload,dataKey,dataArray}=intent;
			if (payload?.mode==="update") {
				const payloadChanges=payload?.changes;
				if (!payloadChanges||!Object.keys(payloadChanges).length)
					continue;
				if (isRevertedUpdate(intent))
					continue;
			}
			const rowData=payload.rowData;
			const rowMeta=rowData?this._rowMeta.get(rowData):undefined;
			if (rowMeta?.isNew) {
				// Persist the owning row first
				const rowPayload=this._makeCallbackPayload(null,{
					data: rowData,
					parentData: null,
					mode: "create",
					changes: null
				},{
					schemaNode: this._schema,
					mainIndex: payload.mainIndex,
					rowData,
					bulkEdit: payload.bulkEdit
				});
				emitDataCommit(rowPayload,undefined,undefined,this._schema);
				if (rowData)
					this._rowFilterCache?.delete(rowData);
				rowMeta.isNew=false;
				delete rowMeta.draftViewModeKey;
				// If this payload is the row itself, skip it; child commits still emit after the row create.
				if (payload.data===rowData)
					continue;
			}
			emitDataCommit(payload,dataKey,dataArray,intent.schemaNode);
			if (rowData)
				this._rowFilterCache?.delete(rowData);
		}
		for (const group of groupsTouched)
			delete group?._openSnapshot;
		txn.intents.length=0;
		this._editTransaction=null;
		this.refreshView("commit");
	}

	_closeGroup(groupObject,targetCell=null,suppressTooltip=false) {
		// An untouched creation is a disposable draft, not a commit attempt. Remove it before onClose/creation
		// validation; ordinary navigation can then continue to its requested target.
		if (this._isUntouchedCreatingGroup(groupObject)) {
			this._deleteCell(groupObject,false,false);
			return true;
		}
		this._enterEditTransaction(groupObject);
		const {payload,closePayload,closeState,changed}=this._buildGroupPayload(groupObject);
		const commitPayload={...payload};
		groupObject.schemaNode.onClose?.(closePayload);
		if (!closeState.doClose) {
			if (!suppressTooltip) {
				const tooltipMessage=[closeState.preventMessage,this.lang.groupValidationFailedHint]
					.filter(Boolean).join("\n");
				this._showTooltip(tooltipMessage,groupObject.el,this._determinePreventPlacement(groupObject.el,targetCell));
			}
			return false;
		}
		if (groupObject.creating&&groupObject.parent?.schemaNode.type==="repeated"
			&&!this._closeRepeatedInsertion(groupObject))
			return false;
		this._finalizeGroupClose(groupObject);
		if (changed)
			for (const repeated of this._getRepeatedAncestors(groupObject))
				this._finalizeRepeatedMutation(repeated);
		// Buffer commit so outer groups can still cancel; flush once the outermost edit scope commits.
		this._bufferGroupCommit(groupObject,commitPayload);
		this._removeGroupFromTransaction(groupObject);
		if (!this._editTransaction?.stack.length)
			this._flushBufferedGroupCommits();
		return true;
	}

	/**
	 * Attempt to close all open groups (inner -> outer) so buffered commits can flush when safe.
	 * If a group refuses to close (validation failure), its edits are discarded/reverted so data does not linger
	 * unpersisted, and traversal continues to higher groups.
	 */
	_flushValidatedEdits() {
		// If currently editing a cell, try to save/exit first.
		if (this._inEditMode&&!this._exitEditMode(true))
			return false;
		const stack=this._editTransaction?.stack;
		if (!stack?.length)
			return true;
		// Close from deepest to outermost so parent validations still have the latest child data.
		for (let i=stack.length-1;i>=0;i--) {
			const grp=stack[i];
			if (grp?.schemaNode?.type==="group") {
				if (!this._closeGroup(grp,null,true)) {
					// Validation failed: discard edits for this group and keep closing parents.
					if (grp===this._getOpenGroupAncestor(this._activeDetailsCell))
						this._discardActiveGroupEdits();
					else {
						// Temporarily select this group to reuse discard logic.
						const prevActive=this._activeDetailsCell;
						this._activeDetailsCell=grp;
						this._discardActiveGroupEdits();
						this._activeDetailsCell=prevActive;
					}
				}
			}
		}
		return true;
	}

	_finalizeGroupClose(groupObject) {
		groupObject.el.classList.remove("open");
		this._ignoreClicksUntil=Date.now()+500;
		if (groupObject.updateRenderOnClose) {//if group is flagged for having its closed-render updated on close
			delete groupObject.updateRenderOnClose;//delete the flag so it doesn't get triggered again
			this._setClosedRender(groupObject,groupObject.schemaNode.closedRender(groupObject.dataObj));
		}
		this._syncGroupChevronVisibility(groupObject);
		this._syncRepeatedReorderEntry(groupObject);
		delete groupObject._dirtyFields;
	}

	_placeGroupChevron(groupObject) {
		const chevron=groupObject?.groupChevronEl;
		if (!chevron)
			return;
		// Every group uses the same preview-adjacent placement. A closed group lays out its complete tbody preview and
		// this sibling as one flex row, so the icon is vertically centered against all visible preview rows.
		groupObject.el.appendChild(chevron);
	}

	_getNearestAncestorGroup(instanceNode) {
		for (let ancestor=instanceNode?.parent;ancestor;ancestor=ancestor.parent)
			if (ancestor.schemaNode?.type==="group")
				return ancestor;
	}

	_canExposeDetailsAffordances(instanceNode) {
		const ancestorGroup=this._getNearestAncestorGroup(instanceNode);
		return !ancestorGroup||ancestorGroup.el.classList.contains("open");
	}

	_applyDetailsAffordanceState(instanceNode) {
		const exposed=this._canExposeDetailsAffordances(instanceNode);
		instanceNode.detailsAffordancesExposed=exposed;
		const targets=new Set([instanceNode.outerContainerEl,instanceNode.selEl,instanceNode.el,
			instanceNode.containerEl].filter(Boolean));
		for (const target of targets)
			target.classList.toggle("details-affordances-suppressed",!exposed);
		if (instanceNode.schemaNode?.type==="group"&&instanceNode.groupChevronEl) {
			const closed=!instanceNode.el.classList.contains("open");
			instanceNode.groupChevronEl.hidden=!exposed||!closed||instanceNode.cellState?.activatable!==true;
		}
		this._syncRepeatedReorderEntry(instanceNode);
	}

	_syncDetailsPresentation(instanceNode) {
		if (!instanceNode)
			return;
		const visit=node=>{
			this._applyDetailsAffordanceState(node);
			for (const child of node.children??[])
				visit(child);
		};
		visit(instanceNode);
	}

	_syncGroupChevronVisibility(groupObject) {
		// Kept as the compatibility entry point for existing callers; chevron, border and dividers now share state.
		this._syncDetailsPresentation(groupObject);
	}

	_setClosedRender(groupObject,renderText,path=groupObject.path,tbody=groupObject.el.tBodies?.[0]) {
		const renderRow=groupObject.el.querySelector("tbody>tr.group-render");
		if (renderText==null) {
			groupObject.el.classList.remove("closed-render");
			renderRow?.remove();
			this._placeGroupChevron(groupObject);
			return;
		}
		groupObject.el.classList.add("closed-render");
		const row=renderRow??tbody?.insertRow();
		if (!row)
			return;
		row.className="group-render";
		row.dataset.path=path?.join("-")??"";
		const cell=row.cells[0]??row.insertCell();
		const content=document.createElement("span");
		content.className="group-closed-content";
		if (groupObject.schemaNode.closedRenderHtml===true)
			content.innerHTML=renderText;
		else
			content.innerText=renderText;
		cell.replaceChildren(content);
		this._placeGroupChevron(groupObject);
	}

	_repeatInsert(repeated,creating,data,entrySchemaNode=null) {
		//normally entrySchemaNode should be the entry of repeated, 
		// but schemaNode can be supplied for creating creation-entries
		entrySchemaNode??=repeated.schemaNode.entry;

		let indexOfNew,rowIndex;
		if (!creating&&repeated.schemaNode.sortCompare&&!repeated.schemaNode.grouping&&!entrySchemaNode.creator) {
			const rowData=repeated.parent?.dataObj;
			for (indexOfNew=0;indexOfNew<repeated.children.length-!!repeated.schemaNode.create; indexOfNew++)
				if (repeated.schemaNode.sortCompare(
					data,repeated.children[indexOfNew].dataObj,rowData,repeated)<0)
					break;
		} else
			indexOfNew=repeated.children.length-(repeated.schemaNode.create&&!entrySchemaNode.creator)//pos be4 creator
		for (let root=repeated.parent; root.parent; root=root.parent,rowIndex=root.rowIndex);//get main-index
		let entryNode=entrySchemaNode;
		if (repeated.schemaNode.create&&!entrySchemaNode.creator)
			entryNode=this._wrapRepeatedEntryForDeletion(entrySchemaNode,repeated.schemaNode);
		const newObj=this._generateCollectionItem(entryNode,rowIndex,repeated,repeated.path,data,indexOfNew,creating);
		if (creating) {
			newObj.creating=true;//creating means it hasn't been commited yet.
			// Creating groups have no closed render until their first successful commit. Ensure that commit renders the
			// actual summary even when every value came from createData and no individual field became dirty.
			if (newObj.schemaNode.closedRender)
				newObj.updateRenderOnClose=true;
			this._selectFirstSelectableDetailsCell(newObj,true,true);
			repeated.schemaNode.onCreateOpen?.(repeated);
			// Capture the canonical draft baseline after the complete creation lifecycle, so createData values, objects
			// initialized declaratively while rendering, and synchronous onCreateOpen defaults are all untouched state.
			newObj._openSnapshot=this._cloneGroupData(newObj.dataObj);
		}
		return newObj.el;
	}

	_getRepeatedDataIndex(instanceNode) {
		const repeated=instanceNode?.parent;
		if (repeated?.schemaNode?.type!=="repeated"||!Array.isArray(repeated.dataObj))
			return -1;
		return repeated.dataObj.indexOf(instanceNode.dataObj);
	}

	_getRepeatedAncestors(instanceNode) {
		const repeatedAncestors=[];
		for (let node=instanceNode;node;node=node.parent)
			if (node.schemaNode?.type==="repeated")
				repeatedAncestors.push(node);
		return repeatedAncestors;
	}

	_getRepeatedReorderConfig(entry) {
		const repeated=entry?.parent;
		const config=repeated?.schemaNode?.reorder;
		if (repeated?.schemaNode?.type!=="repeated"||config==null)
			return null;
		if (!config||typeof config!=="object"||Array.isArray(config)
			||typeof config.canMove!=="function"||typeof config.onCommit!=="function")
			throw new TypeError("Repeated reorder requires canMove and onCommit callbacks.");
		return config;
	}

	_getRepeatedReorderEntries(repeated) {
		return (repeated?.children??[]).filter(child=>!child.schemaNode?.creator&&!child.creating&&!child.hidden);
	}

	_makeRepeatedReorderPayload(entry,direction=null) {
		const repeated=entry.parent;
		const entries=this._getRepeatedReorderEntries(repeated);
		const visualIndex=entries.indexOf(entry);
		const target=direction?entries[visualIndex+(direction==="up"?-1:1)]:null;
		const session=this._editModeController?.kind==="repeated-reorder"
			&&this._editModeController.entry===entry?this._editModeController:null;
		return this._makeCallbackPayload(entry,{
			data:entry.dataObj,
			dataArray:repeated.dataObj,
			dataKey:repeated.schemaNode.dataKey,
			itemIndex:this._getRepeatedDataIndex(entry),
			visualIndex,
			direction,
			target:target?.dataObj??null,
			order:entries.map(item=>item.dataObj),
			baselineOrder:(session?.baselineEntries??entries).filter(item=>entries.includes(item))
				.map(item=>item.dataObj),
			repeatedSchemaNode:repeated.schemaNode,
			refresh:()=>{
				this._finalizeRepeatedMutation(repeated);
				if (this._activeRepeatedReorderEntry===entry)
					this._syncRepeatedReorderEntry(entry);
			}
		},{schemaNode:repeated.schemaNode,mainIndex:entry.rowIndex,
			rowData:repeated.parent?.dataObj});
	}

	_repeatedReorderDirections(entry) {
		const config=this._getRepeatedReorderConfig(entry);
		if (!config||entry.creating||entry.schemaNode?.creator||entry.el?.classList.contains("open")
			||!this._canExposeDetailsAffordances(entry))
			return {up:false,down:false};
		const canMove=direction=>config.canMove(direction,this._makeRepeatedReorderPayload(entry,direction))===true;
		return {up:canMove("up"),down:canMove("down")};
	}

	_setupRepeatedReorderEntry(entry) {
		if (!this._getRepeatedReorderConfig(entry)||entry.reorderCell)
			return;
		const outer=entry.outerContainerEl;
		if (!outer)
			return;
		let column;
		if (outer.cells?.length) {
			entry.reorderContentEl=outer.cells[outer.cells.length-1];
			column=outer.insertCell(entry.reorderContentEl.cellIndex);
		} else {
			column=document.createElement("span");
			entry.el?.parentElement?.insertBefore(column,entry.el);
		}
		column.className="repeated-reorder-column";
		const cell=column.appendChild(document.createElement("span"));
		cell.className="repeated-reorder-cell";
		cell.setAttribute("aria-label",this.lang.reorder);
		const surface=cell.appendChild(document.createElement("span"));
		surface.className="repeated-reorder-surface";
		const handle=surface.appendChild(document.createElement("span"));
		handle.className="repeated-reorder-handle";
		handle.setAttribute("aria-hidden","true");
		handle.appendChild(this._createRepeatedReorderIcon());
		const reorderCell=this._createInstanceNode(entry.parent,null,REORDER_INSTANCE_NODE_PROTOTYPE);
		Object.assign(reorderCell,{
			schemaNode:{type:"reorder"},dataObj:entry.dataObj,rowIndex:entry.rowIndex,
			el:cell,selEl:cell,cursorEl:cell,outerContainerEl:cell,ownerEntry:entry,
		});
		cell._tablanceInstanceNode=reorderCell;
		entry.reorderColumnEl=column;
		entry.reorderCell=reorderCell;
		entry.outerContainerEl.classList.add("repeated-reorder-entry");
		this._setCellState(cell,this._resolveCellState(reorderCell.schemaNode),reorderCell);
		this._syncRepeatedReorderEntry(entry);
		this._syncRepeatedReorderColumns(entry.parent);
	}

	_createRepeatedReorderIcon() {
		const ns="http://www.w3.org/2000/svg";
		const icon=document.createElementNS(ns,"svg");
		icon.classList.add("repeated-reorder-icon");
		icon.setAttribute("viewBox","0 0 16 16");
		icon.setAttribute("focusable","false");
		icon.setAttribute("aria-hidden","true");
		const up=icon.appendChild(document.createElementNS(ns,"path"));
		up.classList.add("repeated-reorder-icon-up");
		up.setAttribute("d","M8 .2 4.5 4.35h7Z");
		const bars=icon.appendChild(document.createElementNS(ns,"path"));
		bars.classList.add("repeated-reorder-icon-bars");
		bars.setAttribute("d","M3.8 6.7h8.4M3.8 9.3h8.4");
		const down=icon.appendChild(document.createElementNS(ns,"path"));
		down.classList.add("repeated-reorder-icon-down");
		down.setAttribute("d","M8 15.8 4.5 11.65h7Z");
		return icon;
	}

	_syncRepeatedReorderColumns(repeated) {
		if (repeated?.parent?.containerEl?.tagName!=="TBODY"
				||repeated.schemaNode?.reorder==null)
			return;
		for (const entry of repeated.children) {
			const row=entry.outerContainerEl;
			if (entry.reorderContentEl)
				entry.reorderContentEl.colSpan=entry.reorderCell.hidden?2:1;
			else if (row?.cells?.length)
				row.cells[row.cells.length-1].colSpan=2;
		}
	}

	_syncRepeatedReorderEntry(entry) {
		const reorderCell=entry?.reorderCell;
		if (!reorderCell)
			return;
		const possible=this._repeatedReorderDirections(entry);
		const hidden=!possible.up&&!possible.down;
		reorderCell.hidden=reorderCell.el.hidden=entry.reorderColumnEl.hidden=hidden;
		if (entry.reorderContentEl)
			entry.reorderContentEl.colSpan=hidden?2:1;
		if (this._activeRepeatedReorderEntry===entry) {
			this._cellCursor.querySelector(".repeated-reorder-up").hidden=!possible.up;
			this._cellCursor.querySelector(".repeated-reorder-down").hidden=!possible.down;
		}
		if (hidden&&this._activeRepeatedReorderEntry===entry)
			this._exitEditMode(false);
	}

	_setRepeatedReorderPeerPresentation(repeated,activeEntry=null) {
		for (const entry of repeated?.children??[])
			entry.reorderCell?.el.classList.toggle("repeated-reorder-peer-suppressed",
				!!activeEntry&&entry!==activeEntry);
	}

	_enterRepeatedReorderMode(entry) {
		if (!entry?.reorderCell||entry.reorderCell.hidden
			||this._activeDetailsCell!==entry.reorderCell)
			return false;
		if (!this._exitEditMode(true))
			return false;
		const baselineEntries=[...entry.parent.children];
		this._activeRepeatedReorderEntry=entry;
		this._editModeController={
			kind:"repeated-reorder",entry,repeated:entry.parent,baselineEntries,
			finish:save=>this._finishRepeatedReorderEdit(save),
		};
		this._inEditMode=true;
		this._setRepeatedReorderPeerPresentation(entry.parent,entry);
		this._cellCursor.classList.add("edit-mode","repeated-reorder-editor");
		const control=this._cellCursor.appendChild(document.createElement("span"));
		control.className="repeated-reorder-control";
		const addDirection=(direction,symbol,label)=>{
			const button=control.appendChild(document.createElement("button"));
			button.type="button";
			button.tabIndex=-1;
			button.className=`repeated-reorder-${direction}`;
			button.textContent=symbol;
			button.setAttribute("aria-label",label);
			button.addEventListener("mousedown",e=>{
				e.preventDefault();
				e.stopPropagation();
			});
			button.addEventListener("click",e=>{
				e.preventDefault();
				e.stopPropagation();
				this._performRepeatedReorder(entry,direction);
			});
			return button;
		};
		addDirection("up","↑",this.lang.reorderUp);
		control.appendChild(entry.reorderCell.el.querySelector(".repeated-reorder-handle").cloneNode(true));
		addDirection("down","↓",this.lang.reorderDown);
		this._syncRepeatedReorderEntry(entry);
		return true;
	}

	_exitRepeatedReorderMode() {
		const entry=this._activeRepeatedReorderEntry;
		if (!entry)
			return false;
		this._activeRepeatedReorderEntry=null;
		return true;
	}

	_finishRepeatedReorderEdit(save) {
		const session=this._editModeController;
		if (session?.kind!=="repeated-reorder")
			return true;
		const {entry,repeated,baselineEntries}=session;
		const changed=baselineEntries.length!==repeated.children.length
			||baselineEntries.some((item,index)=>repeated.children[index]!==item);
		if (!save&&changed) {
			repeated.children=[...baselineEntries];
			this._arrangeRepeatedInstances(repeated,true);
		}
		const payload=save&&changed?this._makeRepeatedReorderPayload(entry):null;
		const config=this._getRepeatedReorderConfig(entry);
		this._exitRepeatedReorderMode();
		this._editModeController=null;
		this._inEditMode=false;
		this._cellCursor.classList.remove("edit-mode","repeated-reorder-editor");
		this._cellCursor.replaceChildren();
		this._setRepeatedReorderPeerPresentation(repeated);
		for (const item of repeated.children)
			this._syncRepeatedReorderEntry(item);
		this._focusEl.focus({preventScroll:true});
		this._adjustCursorPosSize(this._selectedCell);
		this._highlightOnFocus=false;
		if (payload)
			config.onCommit(payload);
		return true;
	}

	_performRepeatedReorder(entry,direction) {
		const possible=this._repeatedReorderDirections(entry);
		if (!possible[direction])
			return false;
		const repeated=entry.parent;
		const payload=this._makeRepeatedReorderPayload(entry,direction);
		const targetEntry=this._getRepeatedReorderEntries(repeated)
			.find(item=>item.dataObj===payload.target);
		const from=repeated.children.indexOf(entry);
		const to=repeated.children.indexOf(targetEntry);
		if (from<0||to<0)
			return false;
		repeated.children.splice(from,1);
		repeated.children.splice(to,0,entry);
		this._arrangeRepeatedInstances(repeated,true);
		for (const item of repeated.children)
			this._syncRepeatedReorderEntry(item);
		return true;
	}

	_handleRepeatedReorderKey(e) {
		const entry=this._activeRepeatedReorderEntry;
		if (entry) {
			if (e.key==="Escape") {
				e.preventDefault();
				e.stopPropagation();
				this._exitEditMode(false);
				return true;
			}
			if (e.key==="ArrowRight") {
				e.preventDefault();
				this._exitEditMode(true);
				this._selectDetailsCell(entry);
				return true;
			}
			if (e.key==="ArrowUp"||e.key==="ArrowDown") {
				e.preventDefault();
				e.stopPropagation();
				this._performRepeatedReorder(entry,e.key==="ArrowUp"?"up":"down");
				return true;
			}
			if (e.key==="Enter"||e.code==="NumpadEnter") {
				e.preventDefault();
				e.stopPropagation();
				this._exitEditMode(true);
				return true;
			}
			if (e.code==="Space") {
				e.preventDefault();
				return true;
			}
			return false;
		}
		return false;
	}

	_getRepeatedGrouping(repeated) {
		const grouping=repeated?.schemaNode?.grouping;
		if (grouping==null)
			return null;
		if (!grouping||typeof grouping!=="object"||Array.isArray(grouping)
				||!(typeof grouping.by==="function"
					||typeof grouping.by==="string"&&grouping.by.trim()))
			throw new TypeError("Repeated grouping.by must be a dataKey or callback.");
		if (grouping.order!=null&&!Array.isArray(grouping.order))
			throw new TypeError("Repeated grouping.order must be an array.");
		const definitions=[];
		const keys=new Set;
		for (const definition of grouping.order??[]) {
			if (!definition||typeof definition!=="object"||Array.isArray(definition)
					||!("key" in definition)||typeof definition.title!=="string"||!definition.title.trim())
				throw new TypeError("Every repeated grouping.order item must have a key and non-empty title.");
			if (keys.has(definition.key))
				throw new TypeError("Repeated grouping.order cannot contain duplicate keys.");
			keys.add(definition.key);
			definitions.push(definition);
		}
		return {by:grouping.by,definitions};
	}

	_getRepeatedGroupKey(grouping,entry,rowData,repeated) {
		return typeof grouping.by==="function"
			?grouping.by(entry.dataObj,rowData,repeated)
			:entry.dataObj?.[grouping.by];
	}

	_createRepeatedGroupHeading(repeated,title,key) {
		const collectionEl=repeated.parent?.containerEl;
		if (!collectionEl)
			return null;
		let heading;
		if (collectionEl.tagName==="TBODY") {
			heading=document.createElement("tr");
			const cell=heading.insertCell();
			const sample=repeated.children?.find(child=>!child.schemaNode?.creator)?.outerContainerEl;
			cell.colSpan=Math.max(1,sample?.cells?.length??1);
		} else {
			heading=document.createElement("span");
		}
		const headingContent=heading.cells?.[0]??heading;
		const titleEl=headingContent.appendChild(document.createElement("span"));
		titleEl.className="repeated-group-title";
		titleEl.textContent=title;
		heading.className="repeated-group-heading";
		heading.dataset.groupKey=String(key??"");
		heading.setAttribute("aria-hidden","true");
		return heading;
	}

	_arrangeRepeatedInstances(repeated,preserveEntryOrder=false) {
		const compare=repeated?.schemaNode?.sortCompare;
		const grouping=this._getRepeatedGrouping(repeated);
		if (!grouping&&typeof compare!=="function")
			return false;
		const creators=[];
		const drafts=[];
		const entries=[];
		for (const child of repeated.children??[])
			(child.schemaNode?.creator?creators:child.creating?drafts:entries).push(child);
		const rowData=repeated.parent?.dataObj;
		const previousOrder=new Map(entries.map((entry,index)=>[entry,index]));
		let sorted,groups=[];
		if (grouping) {
			const buckets=new Map;
			const keyByEntry=new Map;
			for (const entry of entries) {
				const key=this._getRepeatedGroupKey(grouping,entry,rowData,repeated);
				keyByEntry.set(entry,key);
				if (!buckets.has(key))
					buckets.set(key,[]);
				buckets.get(key).push(entry);
			}
			const orderedKeys=[];
			const includedKeys=new Set;
			for (const definition of grouping.definitions)
				if (buckets.has(definition.key)) {
					orderedKeys.push(definition.key);
					includedKeys.add(definition.key);
				}
			const backingOrder=new Map(Array.isArray(repeated.dataObj)
				?repeated.dataObj.map((data,index)=>[data,index]):[]);
			const occurrenceEntries=[...entries].sort((a,b)=>{
				const aIndex=backingOrder.get(a.dataObj)??-1;
				const bIndex=backingOrder.get(b.dataObj)??-1;
				return (aIndex<0?Number.MAX_SAFE_INTEGER:aIndex)-(bIndex<0?Number.MAX_SAFE_INTEGER:bIndex)
					||(previousOrder.get(a)-previousOrder.get(b));
			});
			for (const entry of occurrenceEntries) {
				const key=keyByEntry.get(entry);
				if (!includedKeys.has(key)) {
					orderedKeys.push(key);
					includedKeys.add(key);
				}
			}
			const definitionByKey=new Map(grouping.definitions.map(definition=>[definition.key,definition]));
			groups=orderedKeys.map(key=>{
				const groupEntries=buckets.get(key);
				if (typeof compare==="function"&&!preserveEntryOrder)
					groupEntries.sort((a,b)=>compare(a.dataObj,b.dataObj,rowData,repeated)
						||(previousOrder.get(a)-previousOrder.get(b)));
				return {key,title:definitionByKey.get(key)?.title??String(key??""),entries:groupEntries};
			});
			sorted=groups.flatMap(group=>group.entries);
		} else if (preserveEntryOrder)
			sorted=[...entries];
		else
			sorted=[...entries].sort((a,b)=>compare(a.dataObj,b.dataObj,rowData,repeated)
				||(previousOrder.get(a)-previousOrder.get(b)));

		const orderChanged=!sorted.every((entry,index)=>entry===entries[index]);
		repeated.children=[...sorted,...drafts,...creators];
		const collectionEl=repeated.parent?.containerEl;
		const hasVisibleGroupedEntries=!!grouping&&groups.some(group=>group.entries.some(entry=>!entry.hidden));
		for (const entry of entries)
			entry.outerContainerEl?.classList.remove("repeated-group-entry","repeated-group-first","repeated-group-last");
		for (const creator of creators)
			creator.outerContainerEl?.classList.toggle("grouped-repeated-creator",hasVisibleGroupedEntries);
		for (const heading of repeated.groupHeadings??[])
			heading.remove();
		repeated.groupHeadings=[];
		if (collectionEl&&grouping) {
			for (const group of groups) {
				const visibleEntries=group.entries.filter(entry=>!entry.hidden);
				for (const entry of visibleEntries)
					entry.outerContainerEl?.classList.add("repeated-group-entry");
				visibleEntries[0]?.outerContainerEl?.classList.add("repeated-group-first");
				visibleEntries.at(-1)?.outerContainerEl?.classList.add("repeated-group-last");
				if (group.title&&visibleEntries.length) {
					const heading=this._createRepeatedGroupHeading(repeated,group.title,group.key);
					collectionEl.insertBefore(heading,repeated.insertionPoint);
					repeated.groupHeadings.push(heading);
				}
				for (const entry of group.entries)
					if (entry.outerContainerEl)
						collectionEl.insertBefore(entry.outerContainerEl,repeated.insertionPoint);
			}
			for (const pinned of [...drafts,...creators])
				if (pinned.outerContainerEl)
					collectionEl.insertBefore(pinned.outerContainerEl,repeated.insertionPoint);
		} else for (const entry of repeated.children) {
			if (entry.outerContainerEl&&collectionEl)
				collectionEl.insertBefore(entry.outerContainerEl,repeated.insertionPoint);
		}
		for (let index=0;index<repeated.children.length;index++)
			this._changeInstanceNodeIndex(repeated.children[index],index);
		this._syncRepeatedReorderColumns(repeated);
		this._adjustCursorPosSize?.(this._selectedCell,true);
		return orderChanged;
	}

	_finalizeRepeatedMutation(repeated) {
		if (!repeated?.schemaNode||repeated.schemaNode.type!=="repeated")
			return;
		this._arrangeRepeatedInstances(repeated);
		for (const entry of repeated.children??[])
			this._syncRepeatedReorderEntry(entry);
		this._updateDependentCells(repeated.schemaNode,repeated);
		const detailsTr=repeated.outerContainerEl?.closest?.("tr.details")
			??repeated.parent?.containerEl?.closest?.("tr.details");
		if (detailsTr&&!this._onlyDetails)
			this._updateDetailsHeight(detailsTr);
	}

	/**
	 * Ensure a creating repeated entry is actually inserted into its backing data array.
	 * This is invoked when a pending entry first commits, so the array isn't mutated
	 * until there is user data to keep.
	 */
	_ensureRepeatedEntryInsertion(instanceNode) {
		const repeated=instanceNode?.parent;
		if (!repeated||repeated.schemaNode?.type!=="repeated"||instanceNode.schemaNode?.creator)
			return;
		const dataKey=repeated.schemaNode?.dataKey;
		const parentData=repeated.parent?.dataObj;
		let dataArray=Array.isArray(repeated.dataObj)?repeated.dataObj:null;
		const dataObj=instanceNode.dataObj??(instanceNode.dataObj={});
		// Create backing array lazily.
		if (!dataArray) {
			dataArray=[];
			repeated.dataObj=dataArray;
		}
		// Attach array to parent data on first real commit.
		if (parentData&&dataKey!=null&&parentData[dataKey]!==dataArray) {
			if (Array.isArray(parentData[dataKey]))
				dataArray=repeated.dataObj=parentData[dataKey];
			else
				parentData[dataKey]=dataArray;
		}
		if (!dataObj||dataArray.includes(dataObj))
			return;
		// Backing-array order is data order. Visual sort order is maintained independently in repeated.children.
		dataArray.push(dataObj);
		instanceNode.dataArray=dataArray;
	}

	_changeInstanceNodeIndex(instanceNode,newIndex) {
		instanceNode.index=newIndex;
		const level=instanceNode.path.length-1;
		for (const pathEl of instanceNode.el.parentElement.querySelectorAll('[data-path]')) {
			const path=pathEl.dataset.path.split("-");
			path[level]=newIndex;
			pathEl.dataset.path=path.join("-");
		}
		fixObjPath(instanceNode,newIndex);
		function fixObjPath(instanceNode) {
			if (instanceNode.path)
				instanceNode.path[level]=newIndex;
			instanceNode.children?.forEach(fixObjPath);
		}
	}

	_deleteCell(instanceNode,programatically=false,selectNext=true) {
		const parent=instanceNode.parent;
		const visualIndex=instanceNode.index;
		const dataArray=parent?.dataObj;
		const dataIndex=this._getRepeatedDataIndex(instanceNode);
		const deletedData=instanceNode.dataObj;
		const wasCreating=!!instanceNode.creating;
		let mainIndex;
		for (let root=instanceNode; root.parent; root=root.parent)
			if (root.rowIndex!=null)
				mainIndex=root.rowIndex;
		const rowData=Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:undefined;
		const parentData=instanceNode.parentData??null;

		// Mutate data array
		if (!programatically&&parent?.schemaNode?.type==="repeated"&&Array.isArray(dataArray)&&dataIndex>-1)
			dataArray.splice(dataIndex,1);

		// Remove instance and reindex siblings
		parent.children.splice(visualIndex,1);
		for (let i=visualIndex,otherCell; otherCell=parent.children[i]; i++)
			this._changeInstanceNodeIndex(otherCell,i);

		// DOM removal
		if (parent.schemaNode.type==="repeated"&&parent.parent.schemaNode.type==="list")
			instanceNode.el.parentElement.parentElement.remove();
		else
			instanceNode.el.parentElement.remove();
		// Replacing repeated data programmatically removes and rebuilds its entry instances. Clear the logical cursor
		// only when the selected instance is actually part of the removed subtree. A selected ancestor (for example the
		// group containing the repeated) remains the same connected canonical instance and must stay activatable.
		for (let active=this._activeDetailsCell;active;active=active.parent)
			if (active===instanceNode) {
				this._activeDetailsCell=null;
				break;
			}
		if (instanceNode.schemaNode?.type==="group")
			this._removeGroupFromTransaction(instanceNode,true);

		// Commit deletion after mutation/reindex
		if (!programatically&&parent?.schemaNode?.type==="repeated"&&dataIndex>-1) {
			const payload=this._makeCallbackPayload(instanceNode,{
				data: deletedData,
				dataArray,
				itemIndex:dataIndex,
				visualIndex
			},{
				schemaNode: instanceNode.schemaNode,
				mainIndex,
				rowData,
				instanceNode
			});
			payload.mode="delete";
			payload.parentData=parentData;
			this._queueDataCommit(payload,instanceNode);
		}

		// Select next cell
		let newSelectedCell=parent.children[visualIndex]??parent.children[visualIndex-1];
		if (!programatically&&selectNext)
			this._selectDetailsCell(newSelectedCell??parent.parent);
		instanceNode.creating&&parent.schemaNode.onCreateCancel?.(parent);
		return {deletedDataItem:deletedData,itemIndex:dataIndex,visualIndex,wasCreating};
	}

	_openTextEdit() {
		const input=this._appendCellEditor(document.createElement("input"));
		input.className="text-editor";

		//for when blurring by clicking outside of table etc. exit edit-mode and commit the change but keep the cell
		//selected. not sure why the timeout is needed but it is.
		input.addEventListener("blur",()=>setTimeout(this._exitEditMode.bind(this,true)));
		
		input.addEventListener("change",()=>this._inputVal=input.value);
		input.value=this._selectedCellVal??"";
		if (this._activeSchemaNode.input.format||this._activeSchemaNode.input.livePattern)
			this._attachInputFormatter(input,this._activeSchemaNode.input.format
				,this._activeSchemaNode.input.livePattern);
		input.focus();
		if (this._activeSchemaNode.input.maxLength)
			input.maxLength=this._activeSchemaNode.input.maxLength;
		input.placeholder=this._activeSchemaNode.input.placeholder??"";
	}

	/**
	 * Enter "file edit mode" for a file-input cell.
	 *
	 * This method is called when the user activates a file-input cell
	 * (via Enter, double-click, etc). It temporarily replaces the cell
	 * contents with an interactive file-drop zone that supports:
	 *
	 *   - Clicking or pressing Enter/Space to open the system file picker.
	 *   - Drag-and-drop of a file directly onto the cell.
	 *   - Visual feedback while dragging a file over the target.
	 *
	 * During this mode:
	 *   - The cell is replaced with a small UI component containing
	 *     a text prompt and a hidden <input type="file">.
	 *   - Once a file is selected or dropped, the event is forwarded to
	 *     #processFileUpload(), which performs the actual upload logic.
	 *
	 * After a file is chosen, the edit mode automatically exits and
	 * the details cell is re-selected.
	 */
	_openFileEdit() {
		window.getSelection().empty();
	
		const fileDiv = this._appendCellEditor(document.createElement("div"));
		fileDiv.classList.add("file");
		fileDiv.tabIndex = 0;
		fileDiv.focus();
	
		const fileInput = fileDiv.appendChild(document.createElement("input"));
		fileInput.type = "file";
	
		fileDiv.innerHTML = this.lang.fileChooseOrDrag;
	
		const dropDiv = fileDiv.appendChild(document.createElement("div"));
		dropDiv.classList.add("drop");
		dropDiv.innerHTML = this.lang.fileDropToUpload;
	
		// Local small handler
		const keydown = e => {
			if (e.key === "Escape")
				return; // let Tablance handle it
			
			e.stopPropagation();
	
			if (e.key.startsWith("Arrow"))
				e.preventDefault();
			else if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				fileInput.click();
			}
		};
	
		// Bind handleFile to preserve `this`
		const handleFile = this._processFileUpload.bind(this);
	
		// Events
		fileDiv.addEventListener("keydown", keydown);
		fileDiv.addEventListener("click", () => fileInput.click());
		fileDiv.addEventListener("dragenter", () => dropDiv.style.display = "block");
		dropDiv.addEventListener("dragleave", () => dropDiv.style.display = "none");
		dropDiv.addEventListener("dragover", e => e.preventDefault());
		fileDiv.addEventListener("drop", e => {
			e.preventDefault();
			e.stopPropagation();
			handleFile(e.dataTransfer.files[0]);
		});
		fileInput.addEventListener("change", e => handleFile(e.target.files[0]));
	}

	/**
	 * Called by #openFileEdit() after the user selects or drops a file.
	 * Handle the actual upload of a selected file.
	 *
	 * This method:
	 *
	 *   1. Stores the file as the cell's input value.
	 *   2. Creates and registers a metadata object for tracking:
	 *        - uploadedBytes (updated during upload)
	 *        - progress bars currently displayed for this file
	 *   3. Initiates an XMLHttpRequest upload and wires up:
	 *        - upload progress events (to update progress bars)
	 *        - final load event (to mark completion and clean up metadata)
	 *   4. Invokes the user-defined fileUploadHandler attached to the
	 *      cell’s schemaNode, allowing full customization of how the file
	 *      is handled on the server side.
	 *   5. Sends the file using multipart/form-data via FormData.
	 *
	 * After initiating the upload:
	 *   - The cell exits edit mode.
	 *   - The original details cell is automatically re-selected.
	 *
	 * This method does not handle UI creation — only the upload workflow
	 * and progress bookkeeping.
	 */
	_processFileUpload(file) {
		this._inputVal = file;
	
		const meta = Object.assign(Object.create(null), {uploadedBytes: 0,bars: []});
		this._fileMeta.set(file, meta);

		const xhr = !this._opts.useFakeFileUploadTest ? new XMLHttpRequest()
			: new FakeXMLHttpRequest({totalBytes:file.size||1,rate:this._opts.fakeUploadRate,
				startAt:this._opts.fakeUploadStartAt});

		const updateProgressBars=(loaded,total)=>{
			for (let i=0; i<meta.bars.length; i++) {
				const bar=meta.bars[i];
				if (!bar.isConnected) {
					meta.bars.splice(i--,1);
					continue;
				}
				meta.uploadedBytes=loaded;
				const pct=total?parseInt(loaded/total*100):0;
				bar.style.width=bar.firstChild.innerText=pct+"%";
				}
		};
		const finalizeUpload=()=>{
			this._fileMeta.delete(file);
			for (const bar of meta.bars)
				if (bar.isConnected) {
					bar.parentElement.classList.remove("active");
					bar.firstChild.innerText=this.lang.fileUploadDone;
				}
		};
		const totalBytes=file.size||1;
		xhr.upload.addEventListener("progress", e=>updateProgressBars(e.loaded,e.total));
		xhr.addEventListener("load", () => {
			updateProgressBars(totalBytes,totalBytes);
			finalizeUpload();
		});
		const formData = new FormData();
		this._activeSchemaNode.input.fileUploadHandler?.(xhr,formData,file,this._activeSchemaNode,
			this._cellCursorDataObj,this._mainRowIndex,this._activeDetailsCell);
	
		
		formData.append("file", file);
		xhr.send(formData);
	
		this._exitEditMode(true);
		this._selectDetailsCell(this._activeDetailsCell);
	}
	

	_openTextAreaEdit() {
		const textarea=this._appendCellEditor(document.createElement("textarea"));
		textarea.rows=1;
		textarea.addEventListener('input', this._autoTextAreaResize.bind(this));

		{	const {paddingLeft,paddingRight,paddingTop,paddingBottom}=window.getComputedStyle(
				this._inlineEditorValueEl??this._selectedCell);
			//add the padding of the cell to the textarea for consistency
			Object.assign(textarea.style,{paddingLeft,paddingRight,paddingTop,paddingBottom});}
		
		textarea.value=this._selectedCellVal??"";
		textarea.addEventListener("keydown",keydown.bind(this));
		textarea.focus();
		textarea.addEventListener("change",_e=>this._inputVal=textarea.value);
		if (this._activeSchemaNode.input.maxLength)
			textarea.maxLength=this._activeSchemaNode.input.maxLength;
		textarea.placeholder=this._activeSchemaNode.input.placeholder??"";
		function keydown(e) {
			if (e.key==="Enter"&&e.ctrlKey) {
				this._insertAtCursor(textarea,"\r\n");
				textarea.dispatchEvent(new Event('input'));//trigger input so that autoTextAreaResize gets called
				e.stopPropagation();
			} else if (e.key==="Escape") {
				textarea.value=this._selectedCellVal??"";
				textarea.dispatchEvent(new Event('input'));
			}
		}
	}

		/**
	 * Render all select options into a given <ul> and update highlighted indices if the selected value is found.
	 * @param {HTMLUListElement} ul
	 * @param {Array} opts
	 * @param {*} selectedVal
	 * @param {Object} ctx
	 * @returns {boolean} true if the selected option was found among opts
	 */
	_renderSelectOptions(ul,opts,selectedVal,ctx) {
			let foundSelected=false;
			const selectedValNorm=this._getSelectValue(selectedVal);
			ul.innerHTML="";
			for (const opt of opts) {
				const li=ul.appendChild(document.createElement("li"));
				if (opt.cssClass)
					li.className=opt.cssClass;
			if (ctx.strctInp.boolean)
				this._renderBooleanSelectValue(li,this._getSelectValue(opt),opt.text);
			else
				li.innerText=opt.text;
				const optVal=this._getSelectValue(opt);
				if (selectedVal==opt||selectedValNorm==optVal) {
					foundSelected=true;
					li.classList.add("selected","highlighted");
					ctx.highlightLiIndex=ul.children.length-1;
					ctx.highlightUlIndex=parseInt(ul.dataset.ulIndex);
				}
			}
			return foundSelected;
		}
	
		/**
		 * Highlight a specific option in one of the ULs and optionally scroll it into view when keyboard navigating.
		 * @param {Object} ctx
		 * @param {number} ulIndex 0 for pinned, 1 for main
		 * @param {number} liIndex index within the selected UL
		 * @param {boolean} keyboardNavigating whether the change came from arrow keys
		 */
		_highlightSelectOption(ctx,ulIndex,liIndex,keyboardNavigating) {
			const highlighted=ctx.ulDiv.getElementsByClassName("highlighted")[0];
			if (highlighted)
				highlighted.classList.remove("highlighted");
			const ul=ctx.ulDiv.children[ulIndex];
			const li=ul?.children[liIndex];
			if (!li) {
				ctx.highlightUlIndex=ctx.highlightLiIndex=null;
				return;
			}
			ctx.highlightUlIndex=ulIndex;
			ctx.highlightLiIndex=liIndex;
			li.classList.add("highlighted");
			if (ulIndex&&keyboardNavigating)
				ul.scrollTop=li.offsetTop-ul.offsetTop+li.offsetHeight/2-ul.offsetHeight/2;
		}

		/**
		 * Highlight the first rendered option when an empty cell opens a select.
		 * Pinned options are rendered before the main list and therefore take precedence.
		 * @param {Object} ctx
		 * @returns {boolean} whether an option was highlighted
		 */
		_highlightFirstSelectOption(ctx) {
			if (ctx.pinnedUl.children.length)
				this._highlightSelectOption(ctx,0,0,false);
			else if (ctx.mainUl.children.length)
				this._highlightSelectOption(ctx,1,0,false);
			else
				return false;
			return true;
		}
	
		/**
		 * Filter loose options based on the current input value and update rendered lists and create-option state.
		 * @param {Object} ctx
		 */
		_handleSelectInputChange(ctx) {
				const scoreOptionMatch=(optionText,inputText)=>{
					if (!inputText)
						return 0;
					const option=optionText.toLowerCase().trim();
					const input=inputText.toLowerCase().trim();
					if (!option)
						return 0;
					// absolute winner
					if (option===input)
						return 2000;
					let score=0;
					if (option.startsWith(input))
						score+=700;
					else if (option.includes(input))
						score+=300;
					const words=option.split(/\s+/);
					for (let i=0;i<words.length;i++) {
						const word=words[i];
						if (word===input) {
							score+=600;
							score+=Math.max(0,100-i*20);
						} else if (word.startsWith(input)) {
							score+=350;
							score+=Math.max(0,70-i*15);
						} else if (word.includes(input)) {
							score+=150;
							score+=Math.max(0,40-i*10);
						}
					}
					// penalize length, but gently
					score-=option.length*0.3;
					return score;
				};

			const value=ctx.input.value;
			const filter=value.toLowerCase();
			const hadFilter=!!ctx.filterText;
			// Detect when the filter text diverges so we can rebuild the option list.
			const filterChangedAtEdges=!filter.includes((ctx.filterText??"").toLowerCase())||!hadFilter;
			ctx.canCreate=!!value;
			// If the user broadened the search (backspaced), restore all options before filtering again.
			if (filterChangedAtEdges)
				ctx.looseOpts.splice(0,Infinity,...ctx.allOpts);
			for (let i=-1,opt; opt=ctx.looseOpts[++i];) {
				// Normalize option text for case-insensitive matching.
				const optText=typeof opt.text==="string"?opt.text.toLowerCase():String(opt.text??"");
				// Narrowing search: remove non-matching, non-empty, non-pinned options in place for efficiency.
				if ((opt.pinned||!optText.includes(filter))&&!opt.isEmpty)
					ctx.looseOpts.splice(i--,1);
				else if (optText===filter)
					ctx.canCreate=false;
				ctx.matchScores?.set(opt,scoreOptionMatch(optText,value));
				}
				// Reorder by match score so the best matches appear first.
				ctx.looseOpts.sort((a,b)=>{
					if (a.isEmpty) return -1;
					if (b.isEmpty) return 1;
					return (ctx.matchScores.get(b)??0)-(ctx.matchScores.get(a)??0);
				});
			this._updateCreateOptionVisibility(ctx);
			const foundSelected=this._renderSelectOptions(ctx.mainUl,ctx.looseOpts,this._inputVal,ctx);
			if (value.length) {// User is typing: drop any previous highlight and move focus to the first search result.
				if (ctx.looseOpts.length)//select first result. check allowSelectEmpty to skip empty-option
					this._highlightSelectOption(ctx,1,ctx.strctInp.allowSelectEmpty?1:0,true);
				else if (ctx.pinnedUl.children.length)
					// No main results; fall back to the first pinned option (e.g. create/new or pinned entries).
					this._highlightSelectOption(ctx,0,0,true);
				else {
					// Nothing to highlight, so clear highlight state entirely.
					ctx.ulDiv.getElementsByClassName("highlighted")[0]?.classList.remove("highlighted");
					ctx.highlightUlIndex=ctx.highlightLiIndex=null;
				}
			} else if (foundSelected) {
				ctx.pinnedUl.querySelector(".highlighted")?.classList.remove("highlighted");
			} else if (ctx.highlightUlIndex!=null) {
				if (ctx.looseOpts.length)
					this._highlightSelectOption(ctx,1,0,true);
				else if (ctx.pinnedUl.children.length)
					this._highlightSelectOption(ctx,0,0,true);
			}
			ctx.noResults.style.display=ctx.looseOpts.length?"none":"block";
			ctx.filterText=value;
			if (ctx.creationLi)
				this._setCreateOptionLabel(ctx.creationLi,
					this._formatCreateOptionText(ctx.strctInp,ctx.filterText));
		}
	
		/**
		 * Show or hide the "create new option" list item depending on ctx.canCreate and current DOM state.
		 * @param {Object} ctx
		 */
		_updateCreateOptionVisibility(ctx) {
			if (!ctx.creationLi)
				return;
			if (ctx.canCreate) {
				if (ctx.creationLi.parentElement!=ctx.pinnedUl)
					ctx.pinnedUl.appendChild(ctx.creationLi);
				ctx.creationLi.classList.add("create-option");
			} else if (ctx.creationLi.parentElement==ctx.pinnedUl)
				ctx.pinnedUl.removeChild(ctx.creationLi);
		}
	
		/**
		 * Handle keyboard navigation and selection inside the open select dropdown.
		 * @param {KeyboardEvent} e
		 * @param {Object} ctx
		 */
			_handleSelectKeyDown(e,ctx) {
				if (e.key==="ArrowDown"||e.key==="ArrowUp") {
					e.preventDefault();
					const direction=e.key==="ArrowDown"?1:-1;
					const currentIndex=ctx.highlightLiIndex==null?0:ctx.highlightLiIndex;
					const newIndex=currentIndex+direction;
					if (ctx.highlightUlIndex??true) {
						if (ctx.looseOpts.length&&newIndex<ctx.looseOpts.length&&newIndex>=0)
							this._highlightSelectOption(ctx,1,newIndex,true);
						else if (newIndex==-1&&ctx.pinnedUl.children.length)
							this._highlightSelectOption(ctx,0,ctx.pinnedUl.children.length-1,true);
					} else if (newIndex>=0&&newIndex<ctx.pinnedUl.children.length)
						this._highlightSelectOption(ctx,0,newIndex,true);
					else if (newIndex>=ctx.pinnedUl.children.length&&ctx.looseOpts.length)
						this._highlightSelectOption(ctx,1,0,true);
				} else if (e.key==="Enter") {
					this._closeSelectDropdown(ctx,e);
					this._moveCellCursor(0,e.shiftKey?-1:1);
					e.stopPropagation();
				} else if (e.key==="Tab") {
					e.preventDefault();
					this._closeSelectDropdown(ctx,e);
					this._moveCellCursor(e.shiftKey?-1:1,0,e);
					e.stopPropagation();
				} else if (e.key==="Escape")
					this._closeSelectDropdown(ctx,e,true);
			}
	
		/**
		 * Handle mouse movement over list items by updating the highlighted option.
		 * @param {MouseEvent} e
		 * @param {Object} ctx
		 */
		_handleSelectMouseMove(e,ctx) {
			const li=e.target.closest("li");
			if (!li)
				return;
			const ul=li.parentNode;
			const ulIndex=parseInt(ul.dataset.ulIndex);
			const liIndex=[...ul.children].indexOf(li);
			this._highlightSelectOption(ctx,ulIndex,liIndex,false);
		}
	
		/**
		 * Handle mouse click on a list item: select it, close the dropdown and exit edit mode.
		 * @param {MouseEvent} e
		 * @param {Object} ctx
		 */
		_handleSelectClick(e,ctx) {
			const li=e.target.closest("li");
			if (!li)
				return;
			const ul=e.currentTarget;
			ctx.highlightUlIndex=parseInt(ul.dataset.ulIndex);
			ctx.highlightLiIndex=Array.prototype.indexOf.call(ul.children,li);
			this._closeSelectDropdown(ctx,e);
			this._exitEditMode(true);
		}
	
		/**
		 * Create base DOM structure and context object for the select dropdown.
		 * Splits options into pinned/loose arrays and prepares elements but does not attach listeners.
		 * @param {Object} strctInp the input-definition object from the active cell schemaNode
		 * @returns {Object} ctx a state container for the open select dropdown
		 */
		_createSelectDropdownContext(strctInp) {
			const selectContainer=document.createElement("div");
			const pinnedOpts=[];
			const looseOpts=[];
			const inputWrapper=selectContainer.appendChild(document.createElement("div"));
			const input=inputWrapper.appendChild(document.createElement("input"));
			inputWrapper.classList.add("input-wrapper");
			const ulDiv=selectContainer.appendChild(document.createElement("div"));
			const pinnedUl=ulDiv.appendChild(document.createElement("ul"));
			pinnedUl.classList.add("pinned");
			const mainUl=ulDiv.appendChild(document.createElement("ul"));
			mainUl.classList.add("main");
			const noResults=selectContainer.appendChild(document.createElement("div"));
			noResults.innerHTML=strctInp.noResultsText??this.lang.selectNoResultsFound;
			noResults.className="no-results";
			const allOpts=this._getSelectOptions(strctInp,this._activeSchemaNode,this._cellCursorDataObj,
				this._mainRowIndex,this._activeDetailsCell);
			for (const opt of allOpts) {
				const visible=!opt.visibleIf || opt.visibleIf({dataContext:this._cellCursorDataObj,
					schemaNode:this._activeSchemaNode, rowIndex:this._mainRowIndex, 
					instanceNode:this._activeDetailsCell});
				if (visible)
					(opt.pinned?pinnedOpts:looseOpts).push(opt);
			}
			const ctx=Object.assign(Object.create(null),{
				strctInp,
				selectContainer,
				inputWrapper,
				input,
				ulDiv,
				pinnedUl,
				mainUl,
				noResults,
				pinnedOpts,
				looseOpts,
				matchScores:new Map(),
				allOpts,
				creationLi:null,
				canCreate:false,
				filterText:"",
				highlightLiIndex:null,
				highlightUlIndex:null,
				windowMouseDown:null,
				wheelHandler:null
			});
			return ctx;
		}

		_attachSelectWheelHandler(ctx) {
			const onWheel=e=>{
				const scrollEl=e.target.closest("ul");
				if (!scrollEl||!ctx.selectContainer.contains(scrollEl))
					return;
				const {scrollTop,scrollHeight,clientHeight}=scrollEl;
				const delta=e.deltaY;
				// Prevent scrolling the page while wheel-scrolling inside the dropdown.
				e.preventDefault();
				if (scrollHeight<=clientHeight)
					return;
				const next=Math.max(0,Math.min(scrollHeight-clientHeight,scrollTop+delta));
				scrollEl.scrollTop=next;
			};
			ctx.selectContainer.addEventListener("wheel",onWheel,{passive:false});
			ctx.wheelHandler=onWheel;
		}
	
		/**
		 * Close the select dropdown, update the current value (including create-new if applicable) 
		 * and clean up listeners.
		 * @param {Object} ctx
		 * @param {Event} e the event that triggered the close (click, keydown, etc.)
		 */
		_closeSelectDropdown(ctx,e,cancel=false) {
			if (!ctx.selectContainer.parentElement)
				return;
			const highlightedUl=ctx.highlightUlIndex==null?null:ctx.ulDiv.children[ctx.highlightUlIndex];
			const highlightedLi=ctx.highlightLiIndex==null?null:highlightedUl?.children[ctx.highlightLiIndex];
			if (!cancel&&ctx.highlightUlIndex===0&&highlightedLi?.dataset.type=="create") {
				ctx.filterText=ctx.filterText??ctx.input.value;
				this._inputVal={text:ctx.filterText};
				ctx.strctInp.options.push(this._inputVal);
				ctx.allOpts.push(this._inputVal);
				ctx.strctInp.createNewOptionHandler?.(this._inputVal,e,this._cellCursorDataObj,this._mainRowIndex
															,this._activeSchemaNode,this._activeDetailsCell);
			} else if (!cancel&&highlightedLi) {
				const highlightedOpts=ctx.highlightUlIndex===1?ctx.looseOpts:ctx.pinnedOpts;
				this._inputVal=highlightedOpts[ctx.highlightLiIndex]?.value;
			}
			if (typeof ctx.selectContainer.hidePopover==="function") {
				try { ctx.selectContainer.hidePopover(); } catch(_e) {}
			}
			ctx.selectContainer.remove();
			if (ctx.windowMouseDown)
				window.removeEventListener("mousedown",ctx.windowMouseDown);
			if (ctx.wheelHandler)
				ctx.selectContainer.removeEventListener("wheel",ctx.wheelHandler);
		}
	
		/**
		 * Open edit mode for a cell that uses a select-input: creates the dropdown UI,
		 * wires up filtering, keyboard navigation and mouse interaction, and focuses the input.
		 */
	_openSelectEdit() {
			const strctInp=this._activeSchemaNode.input;
			this._inputVal=this._cellCursorDataObj[this._activeSchemaNode.dataKey];
			const ctx=this._createSelectDropdownContext(strctInp);
			this._cellCursor.style.backgroundColor="transparent";
			const allowCreateNew=strctInp.allowCreateNew;
			if (allowCreateNew||ctx.looseOpts.length>=(strctInp.minOptsFilter??this._opts.defaultMinOptsFilter??5))
				ctx.input.addEventListener("input",()=>this._handleSelectInputChange(ctx));
			else
				ctx.inputWrapper.classList.add("hide");
			ctx.input.addEventListener("keydown",e=>this._handleSelectKeyDown(e,ctx));
			ctx.input.placeholder=strctInp.selectInputPlaceholder??"";
			ctx.input.addEventListener("blur",ctx.input.focus);
			for (let i=-1,ul;ul=[ctx.pinnedUl,ctx.mainUl][++i];) {
				ul.dataset.ulIndex=i;
				ul.addEventListener("mousemove",e=>this._handleSelectMouseMove(e,ctx));
				ul.addEventListener("click",e=>this._handleSelectClick(e,ctx));
			}
			if (strctInp.allowCreateNew) {
				ctx.creationLi=document.createElement("li");
				ctx.creationLi.dataset.type="create";
			}
			this._renderSelectOptions(ctx.pinnedUl,ctx.pinnedOpts,this._inputVal,ctx);
			this._renderSelectOptions(ctx.mainUl,ctx.looseOpts,this._inputVal,ctx);
			if (this._getSelectValue(this._inputVal)==null&&ctx.highlightUlIndex==null)
				this._highlightFirstSelectOption(ctx);
			this._cellCursor.parentElement.appendChild(ctx.selectContainer);
			ctx.selectContainer.className="tablance-select-container";
			if (typeof ctx.selectContainer.showPopover==="function") {
				ctx.selectContainer.popover="manual";
				ctx.selectContainer.showPopover();
			}
			this._alignDropdown(ctx.selectContainer);
			this._attachSelectWheelHandler(ctx);
			const windowMouseDown=e=>{
				let el=e.target;
				while (el&&el!=ctx.selectContainer)
					el=el.parentElement;
				if (!el) {
					this._closeSelectDropdown(ctx,e);
					this._exitEditMode(false);
				}
			};
			ctx.windowMouseDown=windowMouseDown;
			window.addEventListener("mousedown",windowMouseDown);
			ctx.input.focus();
		}
	

	_validateInput(newVal) {
		let message;
		const input=this._cellCursor.querySelector("input");
		const validator=this._activeSchemaNode.input.validation;
		let doCommit;
		if (validator instanceof RegExp)
			doCommit=validator.test(newVal);
		else if (typeof validator==="function")
			doCommit=validator(newVal,m=>message=m,this._activeSchemaNode
												,this._cellCursorDataObj,this._mainRowIndex,this._activeDetailsCell);
		else
			doCommit=true;
		if (doCommit)
			return true;
		input.focus();
		if (message)
			this._showTooltip([message,this.lang.fieldValidationFailedHint].filter(Boolean).join("\n"));
	}

	/**
	 * Updates dependent cells when a cell's value changes.
	 *
	 * This method propagates changes transitively from a modified cell to all of its
	 * dependent cells. The queue is keyed by concrete instance-node (or by schema-node
	 * for main cells), so repeated instances stay in their own scope while converging
	 * dependency paths are de-duplicated. Marking the edited source as visited also
	 * makes cycles terminate without repainting the source that initiated the update.
	 *
	 * @param {Object} editedCellSchemaNode - The schema-node of the cell that was edited.
	 * @param {Object} [editedInstanceNode] - The instance-node representing the edited cell. This is used to determine
	 *                                   the closest scope for dependency updates.
	 */
	_updateDependentCells(editedCellSchemaNode, editedInstanceNode) {
		if (!editedCellSchemaNode)
			return;
		const queue=[];
		const seenMainSchemas=new WeakSet;
		const seenInstances=new WeakMap;
		const enqueue=(schemaNode,instanceNode)=>{
			if (!schemaNode)
				return false;
			if (!instanceNode) {
				if (seenMainSchemas.has(schemaNode))
					return false;
				seenMainSchemas.add(schemaNode);
			} else {
				let instances=seenInstances.get(schemaNode);
				if (!instances)
					seenInstances.set(schemaNode,instances=new WeakSet);
				if (instances.has(instanceNode))
					return false;
				instances.add(instanceNode);
			}
			queue.push({schemaNode,instanceNode});
			return true;
		};
		const resolveDetailsCells=(depPath,sourceInstance)=>{
			const detailsRoot=depPath[0]==="r"?null:this._openDetailsPanes[this._mainRowIndex];
			let cells=depPath[0]==="r"?[sourceInstance]:[detailsRoot];
			if (!cells[0])
				return [];
			let step=1;
			for (;depPath[step]==="..";step++) {
				cells=[cells[0]?.parent].filter(Boolean);
				if (!cells.length)
					return [];
			}
			for (;step<depPath.length;step++) {
				const childIndex=depPath[step];
				const next=[];
				for (const cell of cells) {
					const parents=cell?.schemaNode?.type==="repeated"?(cell.children??[]):[cell];
					for (const parent of parents) {
						const child=parent?.children?.[childIndex];
						if (child)
							next.push(child);
					}
				}
				cells=next;
				if (!cells.length)
					break;
			}
			return cells;
		};

		// The initiating cell is a signal source, not a dependent repaint target. Recording it up front is the
		// cycle guard for graphs such as A -> B -> C -> A.
		enqueue(editedCellSchemaNode,editedInstanceNode);
		for (let queueIndex=0;queueIndex<queue.length;queueIndex++) {
			const {schemaNode,instanceNode}=queue[queueIndex];
			for (const depPath of schemaNode.dependencyPaths??[]) {
				if (depPath[0]==="m") {
					const dependentSchema=this._colSchemaNodes[depPath[1]];
					if (!enqueue(dependentSchema,null))
						continue;
					const rowSelector=`[data-data-row-index="${this._mainRowIndex}"]:not(.details)`;
					const tr=this._mainTbody.querySelector(rowSelector);
					if (tr?.cells?.[depPath[1]])
						this._updateMainRowCell(tr.cells[depPath[1]],dependentSchema);
					continue;
				}
				for (const cell of resolveDetailsCells(depPath,instanceNode)) {
					if (!enqueue(cell.schemaNode,cell))
						continue;
					// Hidden cells still propagate their dependency signal, but need no content repaint.
					if (cell.schemaNode.visibleIf&&!this._applyVisibleIf(cell,cell.rowIndex??this._mainRowIndex))
						continue;
					this._updateDetailsCell(cell,cell.dataObj);
				}
			}
		}
	}

	_exitEditMode(save) {
		if (this._inReadOnlyMode)
			return this._exitReadOnlyMode();
		if (!this._inEditMode)
			return true;
		if (this._editModeController)
			return this._editModeController.finish(save);
		if (!this._selectedCellState?.mutable)
			save=false;
		const input=this._cellCursor.querySelector("input,textarea");
		if (this._activeSchemaNode.input.format?.stripDelimiterOnSave&&this._activeSchemaNode.input.format.delimiter)
			input.value=input.value.replaceAll(this._activeSchemaNode.input.format.delimiter, "");
		if (this._activeSchemaNode.input.validation&&save&&!this._validateInput(input.value))
			return false;
		//make the table focused again so that it accepts keystrokes and also trigger any blur-event on input-element
		this._focusEl.focus({preventScroll:true});//so that #inputVal gets updated-


		this._inEditMode=false;
		this._cellCursor.classList.remove("edit-mode");
		const inputValNorm=this._normalizeCommitValue(this._activeSchemaNode,this._inputVal);
		const selectedValNorm=this._normalizeCommitValue(this._activeSchemaNode,this._selectedCellVal);
		if (save&&inputValNorm!=selectedValNorm) {
			this._doEditSave();
		}
		this._cellCursor.replaceChildren();
		this._restoreInlineEditorLayout();
		//if (this._activeSchemaNode.input.type==="textarea")//also needed for file..
		this._adjustCursorPosSize(this._selectedCell);
		this._highlightOnFocus=false;
		return true;
	}

	_showTooltip(message,target=this._cellCursor,preferredVertical) {
		this._cellCursor.parentElement.appendChild(this._tooltip);
		setTimeout(()=>this._tooltip.style.visibility="visible");//set it on a delay because mouseDownHandler might
						//otherwise immediately set it back to hidden when bubbling up depending on where the click was
		this._tooltip.firstChild.innerText=message;
		this._alignDropdown(this._tooltip,target,preferredVertical);
		this._scrollElementIntoView(this._tooltip);
		return true;
	}

	_determinePreventPlacement(groupEl,targetCell) {
		if (!targetCell?.getBoundingClientRect)
			return;
		const targetRect=targetCell.getBoundingClientRect();
		const groupRect=groupEl.getBoundingClientRect();
		//if desired target is above the group then place tooltip above, otherwise below
		return targetRect.top<groupRect.top?"above":"below";
	}

	_getOpenGroupAncestor(instanceNode) {
		for (let group=instanceNode; group; group=group.parent)
			if (group.schemaNode?.type==="group"&&group.el?.classList.contains("open"))
				return group;
	}

	/**
	 * Marks a details instance-node as dirty within its nearest open group so that discard
	 * can efficiently repaint only touched nodes. Dirty nodes are re-rendered in
	 * _rerenderDirtyFields (called from _discardActiveGroupEdits) and cleared in _finalizeGroupClose.
	 * Keeps the tracked set minimal by skipping already-tracked ancestors and pruning descendants.
	 * @param {object} instanceNode Instance node whose rendered value just changed
	 */
	_markDirtyField(instanceNode) {
		// Track fields/groups touched while a group is open so discard can repaint only those nodes.
		// Keeps the set minimal by skipping ancestors already tracked and removing descendants.
		const group=this._getOpenGroupAncestor(instanceNode);
		if (!group)
			return;
		const dirty=group._dirtyFields??(group._dirtyFields=new Set());
		//if any ancestor already tracked, skip
		for (let node=instanceNode; node&&node!==group; node=node.parent)
			if (dirty.has(node))
				return;
		//remove any tracked descendants to keep set minimal
		for (const tracked of Array.from(dirty)) {
			for (let node=tracked; node; node=node.parent)
				if (node===instanceNode) {
					dirty.delete(tracked);
					break;
				}
		}
		dirty.add(instanceNode);
	}

	/**
	 * Creates a deep clone of group data to serve as an undo snapshot. Returns primitives as-is,
	 * prefers structuredClone and falls back to JSON. Snapshot is stored on the group while open.
	 * @param {*} dataObj Data object to clone
	 * @returns {*} Deep clone suitable for later restore
	 */
	_cloneGroupData(dataObj) {
		if (dataObj==null)
			return dataObj;
		// Prefer structuredClone; fall back to JSON for environments without it.
		if (typeof structuredClone==="function") {
			try {return structuredClone(dataObj);} catch(_e){}
		}
		return JSON.parse(JSON.stringify(dataObj));
	}

	/** Compare live group data with a snapshot without depending on property insertion order. */
	_groupDataEquals(left,right,seen=new WeakMap()) {
		if (Object.is(left,right))
			return true;
		if (left==null||right==null||typeof left!=="object"||typeof right!=="object")
			return false;
		if (left instanceof Date||right instanceof Date)
			return left instanceof Date&&right instanceof Date&&left.getTime()===right.getTime();
		if (Array.isArray(left)!==Array.isArray(right))
			return false;
		if (seen.has(left))
			return seen.get(left)===right;
		seen.set(left,right);
		const leftKeys=Object.keys(left);
		const rightKeys=Object.keys(right);
		if (leftKeys.length!==rightKeys.length)
			return false;
		for (const key of leftKeys)
			if (!Object.prototype.hasOwnProperty.call(right,key)
				||!this._groupDataEquals(left[key],right[key],seen))
				return false;
		return true;
	}

	_isUntouchedCreatingGroup(group) {
		return !!group?.creating&&Object.prototype.hasOwnProperty.call(group,"_openSnapshot")
			&&this._groupDataEquals(group.dataObj,group._openSnapshot);
	}

	/**
	 * Restores a previously-cloned snapshot into an existing data object in place,
	 * preserving external references. Recursively walks arrays/objects, deletes
	 * removed keys, and assigns primitives.
	 * @param {*} target Live data object to mutate
	 * @param {*} snapshot Snapshot to restore from
	 */
	_restoreGroupSnapshot(target,snapshot) {
		// Mutate target to match snapshot in place so external references stay valid.
		if (target===snapshot||snapshot==null)
			return;
		if (Array.isArray(snapshot)) {
			target.length=snapshot.length;
			for (let i=0;i<snapshot.length;i++)
				if (snapshot[i]&&typeof snapshot[i]==="object") {
					if (target[i]==null||(typeof target[i]!=="object"))
						target[i]=Array.isArray(snapshot[i])?[]:{};
					this._restoreGroupSnapshot(target[i],snapshot[i]);
				} else
					target[i]=snapshot[i];
			return;
		}
		if (typeof snapshot==="object") {
			for (const key of Object.keys(target))
				if (!(key in snapshot))
					delete target[key];
			for (const [key,val] of Object.entries(snapshot)) {
				if (val&&typeof val==="object") {
					if (target[key]==null||(typeof target[key]!=="object"))
						target[key]=Array.isArray(val)?[]:{};
					this._restoreGroupSnapshot(target[key],val);
				} else
					target[key]=val;
			}
			return;
		}
		// primitives
		return snapshot;
	}

	/**
	 * Cancels edits in the currently open group: deletes the creator entry if applicable,
	 * restores data from snapshot, repaints dirty fields, refreshes main row, and closes.
	 */
	_discardActiveGroupEdits() {
		const group=this._getOpenGroupAncestor(this._activeDetailsCell);
		if (!group)
			return;
		this._removeGroupFromTransaction(group,true);
		const {payload,closePayload}=this._buildGroupPayload(group);
		closePayload.reason=payload.reason="discard";
		if (group.creating) {
			group.schemaNode.onClose?.(closePayload);
			return this._deleteCell(group);
		}

		// Restore data back to snapshot. It *should* only be needed if there are dirty fields so probably could run in
		// a condition together with  _rerenderDirtyFields. But running it just in case and it's cheap anyway
		if (group._openSnapshot)
			this._restoreGroupSnapshot(group.dataObj,group._openSnapshot);
		
		this._rerenderDirtyFields(group);
		group.schemaNode.onClose?.(closePayload);
		this._finalizeGroupClose(group);
		this._selectCell(group.el,group.schemaNode,group.dataObj);
		this._activeDetailsCell=group;
		if (!this._editTransaction?.stack?.length)
			this._flushBufferedGroupCommits();
	}

	/**
	 * Repaints only nodes that were marked dirty while the group was open.
	 * @param {*} group Instance node of the open group
	 */
	_rerenderDirtyFields(group) {
		// Repaint only nodes that were dirtied while open, after data restore.
		const dirty=group._dirtyFields;
		if (!dirty?.size)
			return;
		for (const node of dirty)
			this._updateDetailsCell(node,node.dataObj);
		dirty.clear();
	}

	_scrollElementIntoView(){}//default is to do nothing. Tablance (main) overrides this.

	_closeRepeatedInsertion(repeatEntry) {
		let message=this.lang.creationValidationFailed;//message to show to the user if creation was unsucessful
		for (var root=repeatEntry; root.parent; root=root.parent);//get root-object in order to retrieve rowIndex
		const creationContainer=repeatEntry.schemaNode.type=="group"?repeatEntry:repeatEntry.parent;
		const repeatedContainer=creationContainer.parent;
		const parentDataContext=repeatedContainer?.parent?.dataObj??this._filteredData[root.rowIndex];
		let doCreate=true;
		if (repeatEntry.schemaNode.creationValidation) {
			const payload=this._makeCallbackPayload(repeatEntry,{
				newDataItem:repeatEntry.dataObj
			},{
				mainIndex: root.rowIndex
			});
			const res=repeatEntry.schemaNode.creationValidation(payload);
			if (typeof res==="boolean")
				doCreate=res;
			else {
				doCreate=!!res.valid;
				message=res.message??message;
			}
		}
		if (!doCreate) {
			message+=this.lang.creationValidationFailedCancelInfo
			this._showTooltip(message,repeatEntry.el);
			return false;//prevent commiting/closing the group
		}
		this._ensureRepeatedEntryInsertion(repeatEntry);
		const insertedIndex=this._getRepeatedDataIndex(repeatEntry);
		const payload=this._makeCallbackPayload(repeatEntry,{
			newDataItem: repeatEntry.dataObj,
			itemIndex: insertedIndex,
			visualIndex: repeatEntry.index,
			repeatedSchemaNode: repeatedContainer?.schemaNode,
			entrySchemaNode: creationContainer.schemaNode,
			newInstanceNode: repeatEntry,
			cancelCreate: ()=>doCreate=false,
			dataArray: repeatedContainer?.dataObj,
			dataKey: repeatedContainer?.schemaNode?.dataKey
		},{
			mainIndex: root.rowIndex,
			rowData: parentDataContext,
			bulkEdit: false
		});
		repeatEntry.creating=false;
		repeatedContainer.schemaNode.onCreate?.(payload);
		if (!doCreate) {
			if (insertedIndex>-1)
				repeatedContainer.dataObj.splice(insertedIndex,1);
			repeatEntry.creating=true;
			this._deleteCell(repeatEntry,true);
			return false;
		}
		return true;
	}

	_closeActiveDetailsCell(targetCell) {
		if (this._activeDetailsCell) {
			for (let oldCellParent=this._activeDetailsCell; oldCellParent=oldCellParent.parent;) {
				if (oldCellParent.schemaNode.type==="group") {
					if (!this._closeGroup(oldCellParent,targetCell))//close any open group above old cell
						return false;
					this._ignoreClicksUntil=Date.now()+500;
				}
				
				oldCellParent.schemaNode.onBlur?.(oldCellParent,this._mainRowIndex);
			}
			this._activeDetailsCell=null;//should be null when not inside details
		}
		return true;
	}


	_selectMainTableCell(cell) {
		if (!cell)	//in case of trying to move up from top row etc,
			return;
		if (this._getCellState(cell)?.selectable===false)
			return false;
		if (!this._exitEditMode(true))//try to exit-mode and commit any changes.
			return false;//if exiting edit-mode was denied then do nothing more
			
		
		this._mainColIndex=cell.cellIndex;
		const mainRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);//save it here rather than setting it 
					//directly because we do not want it to change if #selectCell returns false, preventing the select
					
		if (this._closeActiveDetailsCell(cell)) {
			const selected=this._selectCell(cell,this._colSchemaNodes[this._mainColIndex],
				this._filteredData[mainRowIndex]);
			this._mainRowIndex=mainRowIndex;
			return selected;
		}
	}

	_selectDetailsCell(instanceNode,preserveVerticalPreferredColumn=false) {
		if (!instanceNode)
			return false;
		let root=instanceNode;
		while (root.parent) root=root.parent;
		if (root.collapsing)
			return false;
		for (let node=instanceNode;node;node=node.parent)
			if (this._getCellState(node.selEl??node.el,node)?.selectable===false)
				return false;
		if (!this._exitEditMode(true))//try to exit-mode and commit any changes.
			return false;//if exiting edit-mode was denied then do nothing more

		const oldExpCell=this._activeDetailsCell;//need to know the current/old details-cell if any for closing groups
					//etc but we can't just use this._activeDetailsCell because #selectCell changes it and we do want
					//to call #selectCell first in order to know if changing cell is being prevented by validation()

		const mainRowIndex=root.rowIndex;
		if (oldExpCell)//changing from an old detailsCell
			for (let oldParnt=oldExpCell; oldParnt=oldParnt?.parent;)//traverse parents of old cell
				if(oldParnt.schemaNode.type==="group"||oldParnt.schemaNode.onBlur||oldParnt.creating){//found group/cell
					//...with onBlur or cell that is being created. For any of these we want to observe the cell being
					//left so that appropriate action can be taken
					for (let newParent=instanceNode; newParent=newParent.parent;)//traverse parents of new cell
						if (newParent===oldParnt) {//if this new parent-group is also part of old parents
							oldParnt=null;//break out of outer loop
							break;
						}
					if (oldParnt) {
						if (oldParnt.schemaNode.type==="group"&&!this._closeGroup(oldParnt,instanceNode.selEl??instanceNode.el))
							return false;
						if (oldParnt.schemaNode.onBlur)
							oldParnt.schemaNode.onBlur?.(oldParnt,mainRowIndex);
					}
				}
		this._selectCell(instanceNode.selEl??instanceNode.el,instanceNode.schemaNode,instanceNode.dataObj,false,
			instanceNode,preserveVerticalPreferredColumn);
		this._mainRowIndex=mainRowIndex;

		//in case this was called via instanceNode.select() it might be necessary to make sure parent-groups are open
		let openedPresentationRoot=null;
		for (let parentCell=instanceNode; parentCell=parentCell.parent;)
			if (parentCell.schemaNode.type=="group") {
				if (!parentCell.el.classList.contains("open"))
					openedPresentationRoot=parentCell;
				parentCell.el.classList.add("open");
				this._enterEditTransaction(parentCell);
			}
		if (openedPresentationRoot)
			this._syncDetailsPresentation(openedPresentationRoot);

		this._activeDetailsCell=instanceNode;
		this._adjustCursorPosSize(this._getCursorGeometryEl(instanceNode));
		return instanceNode;
	}

	_selectCell(cellEl,schemaNode,dataObj,adjustCursorPosSize=true,instanceNode=null,
		preserveVerticalPreferredColumn=false) {
		this._closeHelp();
		this._clearReadOnlyActivationFeedback();
		if (!preserveVerticalPreferredColumn)
			this._resetVerticalLayoutPreferredColumn();
		const cellState=this._getCellState(cellEl,instanceNode);
		if (cellState?.selectable===false)
			return false;
		this._focusEl.focus({preventScroll:true});
		this._clearStaticCellOverflowPreview();
		if (adjustCursorPosSize)
			this._adjustCursorPosSize(instanceNode?this._getCursorGeometryEl(instanceNode):cellEl);
		this._cellCursor.classList.toggle("details",cellEl.closest(".details"));
		this._cellCursor.classList.toggle("group-cell-cursor",schemaNode.type==="group");
		this._cellCursor.classList.toggle("inline-title-indicator",Boolean(
			cellEl.closest(".details")&&cellEl.querySelector(":scope>span.title")
				&&cellEl.querySelector(":scope>div.value:not(.group-cell)")
		));
		this._cellCursor.classList.toggle("read-only",cellState?.kind==="readOnly");
		this._cellCursor.classList.toggle("disabled",cellState?.kind==="disabled");
		this._cellCursor.classList.toggle("action-cell",cellState?.kind==="action");
		this._cellCursor.classList.toggle("delete-confirmation-action",
			["no","yes"].includes(schemaNode.cssClass));
		this._cellCursor.classList.toggle("repeated-reorder-cell-cursor",schemaNode.type==="reorder");
		this._cellCursor.classList.toggle("action-indicator",this._showsActionIndicator(cellState,schemaNode));
		(this._scrollingContent??this.rootEl).appendChild(this._cellCursor);
		this._setSelectedCellElement(cellEl);
		this._selectedCellState=cellState;
		this._activeSchemaNode=schemaNode;
		//make cellcursor click-through if it's on an expand-row-button-td, select-row-button-td or button
		const noPtrEvent=schemaNode.type==="expand"||schemaNode.type==="select"||schemaNode.input?.type==="button";
		this._cellCursor.style.pointerEvents=noPtrEvent?"none":"auto";
		this._cellCursor.style.removeProperty("background-color");//select-input sets it to transparent, revert here
		this._cellCursorDataObj=dataObj;
		this._selectedCellVal=dataObj?.[schemaNode.dataKey];
		this._updateStaticCellOverflowPreview();
		return true;
	}

	_setSelectedCellElement(cellEl) {
		if (this._selectedCell!==cellEl)
			this._selectedCell?.classList.remove("tablance-active-cell");
		this._selectedCell=cellEl;
		cellEl?.classList.add("tablance-active-cell");
	}

	_getCursorGeometryEl(instanceNode=this._activeDetailsCell) {
		return instanceNode?.cursorEl??instanceNode?.selEl??instanceNode?.el;
	}

	_cellElementRepresentsLogicalCursor(cellEl,instanceNode=null) {
		if (!cellEl)
			return false;
		if (this._activeDetailsCell) {
			const activeCellEl=this._activeDetailsCell.selEl??this._activeDetailsCell.el;
			return cellEl===activeCellEl&&(!instanceNode||instanceNode===this._activeDetailsCell);
		}
		const tr=cellEl.parentElement;
		const rowIndex=Number(tr?.dataset?.dataRowIndex);
		return tr?.parentElement===this._mainTbody&&cellEl.cellIndex===this._mainColIndex
			&&rowIndex===this._mainRowIndex&&this._filteredData[rowIndex]===this._cellCursorDataObj;
	}

	_showsActionIndicator(cellState,schemaNode) {
		return cellState?.kind==="action"&&!["expand","select","group","reorder"].includes(schemaNode?.type)
			&&schemaNode?.input?.type!=="button";
	}

	_getElPos(el,container) {
		const cellPos=el.getBoundingClientRect();
		if (!container)
			container=this._tableSizer??this.rootEl;
		const contPos=container.getBoundingClientRect();
		return {x:cellPos.x-contPos.x, y:cellPos.y-contPos.y+(this._tableSizer?.offsetTop??0)}
	}

	_adjustCursorPosSize(el,onlyPos=false) {
		if (this._activeDetailsCell&&el===this._selectedCell)
			el=this._getCursorGeometryEl(this._activeDetailsCell);
		if (!el)
			return;
		const elPos=this._getElPos(el);
		this._cellCursor.style.top=elPos.y+"px";
		this._cellCursor.style.left=elPos.x+"px";
		this._cellCursor.style.display="block";//it starts at display none since #setupSpreadsheet, so make visible now
		if (!onlyPos) {
			const explicitCursorRect=this._activeDetailsCell?.cursorEl===el?el.getBoundingClientRect():null;
			this._cellCursor.style.height=(explicitCursorRect?.height??el.offsetHeight)+"px";
			this._cellCursor.style.width=(explicitCursorRect?.width??el.offsetWidth)+"px";
			if (el===this._selectedCell)
				this._updateStaticCellOverflowPreview();
		}
		this._syncInlineEditorGeometry?.();
	}

	_clearStaticCellOverflowPreview() {
		this._cellCursor?.querySelector(":scope>.static-row-overflow-preview")?.remove();
		this._cellCursor?.classList.remove("has-static-row-overflow-preview");
	}

	_updateStaticCellOverflowPreview() {
		this._clearStaticCellOverflowPreview();
		const cell=this._selectedCell;
		if (!this._staticRowHeight||this._inEditMode||!cell||cell.closest("tr.details")
			||cell.classList.contains("expand-col")||cell.classList.contains("select-col")
			||this._activeSchemaNode?.input?.type==="button")
			return;
		const content=cell.firstElementChild;
		if (!content||content.scrollWidth<=content.clientWidth+1)
			return;

		const preview=this._cellCursor.appendChild(document.createElement("div"));
		preview.className="static-row-overflow-preview";
		preview.innerText=content.innerText;
		const contentStyle=window.getComputedStyle(content);
		preview.style.color=contentStyle.color;
		preview.style.font=contentStyle.font;
		preview.style.textAlign=contentStyle.textAlign;
		preview.style.backgroundColor=this._getOpaqueBackgroundColor(cell);
		this._cellCursor.classList.add("has-static-row-overflow-preview");

		const cellRect=cell.getBoundingClientRect();
		const viewportRect=this._scrollBody.getBoundingClientRect();
		preview.style.whiteSpace="nowrap";
		const naturalWidth=preview.offsetWidth;
		const roomRight=Math.max(cellRect.width,viewportRect.right-cellRect.left);
		const roomLeft=Math.max(cellRect.width,cellRect.right-viewportRect.left);
		const alignRight=naturalWidth>roomRight&&roomLeft>roomRight;
		preview.classList.toggle("align-right",alignRight);
		preview.style.maxWidth=Math.floor(alignRight?roomLeft:roomRight)+"px";
		preview.style.removeProperty("white-space");

		const roomBelow=viewportRect.bottom-cellRect.top;
		const roomAbove=cellRect.bottom-viewportRect.top;
		preview.classList.toggle("align-bottom",preview.offsetHeight>roomBelow&&roomAbove>roomBelow);
	}

	_getOpaqueBackgroundColor(el) {
		for (let current=el;current;current=current.parentElement) {
			const color=window.getComputedStyle(current).backgroundColor;
			if (color&&color!=="transparent"&&!color.endsWith(", 0)")&&!color.endsWith(" / 0)"))
				return color;
		}
		return "white";
	}

	_createTableHeader() {
		this._headerTable=this._tableArea.appendChild(document.createElement("table"));
		this._headerTable.classList.add("header-table");
		const thead=this._headerTable.appendChild(document.createElement("thead"));
		this._headerTr=thead.insertRow();
		for (let col of this._colSchemaNodes) {
			let th=this._headerTr.appendChild(document.createElement("th"));
			th.addEventListener("click",e=>this._onThClick(e));
			if (col.type=="select") {
				th.appendChild(this._createCheckbox());
				th.classList.add("select-col");
			} else if (col.type=="expand") {
				const expandDiv=th.appendChild(document.createElement("div"));
				expandDiv.classList.add("expand-div");//used to identify if expand-button was clicked in click-handler
				//expandDiv.appendChild(this._createExpandContractButton());//functionality not fully implemented yet
				th.classList.add("expand-col");
			} else {
				const title=th.appendChild(document.createElement("span"));
				title.className="tablance-main-header-title";
				this._populateSchemaTitle(title,col,null,{fallback:"\xa0",showHelp:false});
				if (this._hasHelp(col))
					this._setupMainHeaderHelp(title,col);
			}

			if (this._opts.ordering!==false) {
				//create the divs used for showing html for sorting-up/down-arrow or whatever has been configured
				col.sortDiv=th.appendChild(document.createElement("DIV"));
				col.sortDiv.className="sortSymbol";
			} else
				th.style.cursor="default";
		}
		const spacer=this._headerTr.appendChild(document.createElement("th"));
		spacer.className="scrollbar-spacer";
		if (this._hasTableHelp()) {
			this._headerTable.classList.add("has-table-help");
			this._headerTr.cells[this._colSchemaNodes.length-1].classList.add("before-table-help");
			const helpTrigger=this._createHelpTrigger(this._schema,null,{table:true});
			helpTrigger.tabIndex=0;
			spacer.appendChild(helpTrigger);
		}
	}

	_onThClick(e) {
		const clickedIndex=e.currentTarget.cellIndex;
		if (this._colSchemaNodes[clickedIndex].type=="select"&&e.target.tagName.toLowerCase()=="input")
			return this._toggleRowsSelected(e.target.checked,0,this._filteredData.length-1);
		if (this._opts.ordering===false)
			return;
		let sortingColIndex=-1,sortingCol;
		while (sortingCol=this._sortingCols[++sortingColIndex]) {
			if (sortingCol.index===clickedIndex) {
				if (e.shiftKey&&this._sortingCols.length>1&&sortingCol.order=="desc") {
					this._sortingCols.splice(sortingColIndex,1);
					sortingColIndex=0;//to not make condition below loop fall true
				} else
					sortingCol.order=sortingCol.order=="asc"?"desc":"asc";
				if (!e.shiftKey)
					this._sortingCols=[sortingCol];
				break;
			}
		}
		if (sortingColIndex==this._sortingCols.length) {//if the clicked header wasn't sorted upon at all
			const {dataKey,type}=this._colSchemaNodes[clickedIndex];
			const sortCol={dataKey,type,order:"asc",index:clickedIndex};
			if (!e.shiftKey)
				this._sortingCols=[];
			this._sortingCols.push(sortCol);
		}
		this._updateHeaderSortHtml();
		e.preventDefault();//prevent text-selection when shift-clicking and double-clicking
		this._sortData();
		this._refreshTable();
	}

	_updateHeaderSortHtml() {
		if (this._opts.ordering===false)
			return;
		for (let [thIndex,th] of Object.entries(this._headerTr.cells)) {
			if (thIndex==this._headerTr.cells.length-1)
				break;
			let order=null;
			let sortDiv=this._colSchemaNodes[thIndex].sortDiv;
			for (let sortingCol of this._sortingCols) {
				if (sortingCol.index==thIndex) {
					order=sortingCol.order;
					break;
				}
			}
			if (!order||th.classList.contains(order=="asc"?"desc":"asc"))
				th.classList.remove("asc","desc");
			if (order) {
				th.classList.add(order);
				sortDiv.innerHTML=(order=="asc"?this._opts?.sortAscHtml:this._opts?.sortDescHtml)??"";
			} else
				sortDiv.innerHTML=this._opts?.sortNoneHtml??"";
		}
	}

	_sortData(caseSensitive=false) {
		const sortCols=this._sortingCols;
		if (!sortCols.length)
			return false;
		const mainIndexMap=new WeakMap();
		for (let i=0;i<this._viewData.length;i++)
			mainIndexMap.set(this._viewData[i],i);
		const compare=(a,b)=>{
			const normalizeVal=val=>{
				if (typeof val==="string"&&!caseSensitive)
					return val.toLowerCase();
				return val;
			};
			for (let sortCol of sortCols) {
				if (sortCol.type==="expand") {
					const aExpanded=!!this._rowMeta.get(a)?.h;
					const bExpanded=!!this._rowMeta.get(b)?.h;
					if (aExpanded!==bExpanded)
						return (aExpanded?-1:1)*(sortCol.order=="asc"?1:-1);
				} else if (sortCol.type==="select") {
					let aSel;
					if ((aSel=this._selectedRows.indexOf(a)!=-1)!=(this._selectedRows.indexOf(b)!=-1))
						return (aSel?-1:1)*(sortCol.order=="asc"?1:-1);
				} else {
					const schemaNode=this._colSchemaNodes[sortCol.index];
					const aVal=normalizeVal(this._getSortValue(schemaNode,a,mainIndexMap.get(a)));
					const bVal=normalizeVal(this._getSortValue(schemaNode,b,mainIndexMap.get(b)));
					if (aVal==bVal)
						continue;
					return (aVal>bVal?1:-1)*(sortCol.order=="asc"?1:-1);
				}
			}
		};
		this._viewData.sort(compare);
		if (this._filteredData!==this._viewData)
			this._filteredData.sort(compare);
		if (this._mainRowIndex>=0)//if there is a selected row
			this._mainRowIndex=this._filteredData.indexOf(this._cellCursorDataObj);//then find it's new pos
		return true;
	}

	_createTableBody() {
		this._scrollBody=this._tableArea.appendChild(document.createElement("div"));

		if (this._naturalAutoHeight)
			this._scrollMethod=this._onScrollNaturalAutoHeight;
		else if (this._staticRowHeight&&!this._schema.details)
			this._scrollMethod=this._onScrollStaticRowHeightNoDetails;
		else if (this._staticRowHeight&&this._schema.details)
			this._scrollMethod=this._onScrollStaticRowHeightDetails;
		this._scrollBody.addEventListener("scroll",e=>this._scrollMethod(e),{passive:true});
		this._scrollBody.className="scroll-body";
		
		this._scrollingContent=this._scrollBody.appendChild(document.createElement("div"));
		this._scrollingContent.className="scrolling-content";

		this._tableSizer=this._scrollingContent.appendChild(document.createElement("div"));
		this._tableSizer.style.position="relative";
		this._tableSizer.style.top="0px";//need to have so that scrolling works properly when reading parseInt of it
		this._tableSizer.className="table-sizer";

		this._mainTable=this._tableSizer.appendChild(document.createElement("table"));
		this._mainTable.className="main-table";
		this._mainTbody=this._mainTable.appendChild(document.createElement("tbody"));
		for (let i = 0; i < this._colSchemaNodes.length; i++) {
			let col=document.createElement("col");
			this._cols.push(col);
			this._mainTable.appendChild(document.createElement("colgroup")).appendChild(col);
		}
		this._borderSpacingY=parseInt(window.getComputedStyle(this._mainTable)['border-spacing'].split(" ")[1]);
		if (this._naturalAutoHeight)
			(new ResizeObserver(()=>this._updateAutoHeight())).observe(this._mainTable);
	}

	_onScrollNaturalAutoHeight() {}

	_createBulkEditArea(schema) {
		this._bulkEditArea=this.rootEl.appendChild(document.createElement("div"));
		this._bulkEditArea.classList.add("bulk-edit-area");
		this._bulkEditArea.addEventListener("transitionend",()=>{
			delete this._animations["adjustViewportHeight"];
			if (this._bulkEditArea.style.height!="0px")
			this._bulkEditArea.style.overflow="visible";//have to shift between hidden/visible because hidden is needed
									//for animation but visible is needed for dropdowns to be able to go outside of area
		});

		//extra div needed for having padding while also being able to animate height all the way to 0
		const bulkContent=this._bulkEditArea.appendChild(document.createElement("div"));

		const numberOfRowsSelectedDiv=bulkContent.appendChild(document.createElement("div"));
		numberOfRowsSelectedDiv.innerText="Number of selected rows: ";
		this._numberOfRowsSelectedSpan=numberOfRowsSelectedDiv.appendChild(document.createElement("span"));

		const pagesDiv=bulkContent.appendChild(document.createElement("div"));//for having multiple pages
		pagesDiv.classList.add("pages");										//which is needed if having groups in it
		
		const mainPage=pagesDiv.appendChild(document.createElement("div"));
		const tableContainer=mainPage.appendChild(document.createElement("div"));
		mainPage.classList.add("main");
		mainPage.style.display="block";

		const bulkEditFields=schema.details?this._buildBulkEditSchemaNodes(schema.details):[];
		for (const column of schema.main.columns)
			bulkEditFields.push(...this._buildBulkEditSchemaNodes(column));

		//Build schema for bulk-edit-area based on the real schema
		const bulkSchema={details:{type:"lineup",entries:bulkEditFields}};//WRAP

		this._bulkEditTable=new TablanceBulk(tableContainer,bulkSchema,null,true,null);
		this._bulkEditTable.mainInstance=this;
		this._bulkEditTable._dropdownAlignmentContainer=this._bulkEditArea;
		this._bulkEditTable.addData([{}]);

		this._bulkEditAreaHeightPx=this._bulkEditArea.firstChild.offsetHeight;
		this._bulkEditArea.style.height=0;//start at height 0 before expanded. but do this after having measured above
	}

	_isObject(val) {
		return val&&typeof val==="object"&&!Array.isArray(val);
	}

	_getSelectValue(val) {
		return this._isObject(val)?val.value:val;
	}

	//TODO why optionS (plural)? shouldn't always be singular?
	_getSelectOptions(inputOpts,schemaNode=null,rowData=null,mainIndex=null,instanceNode=null) {
		const resolvedOptions=inputOpts.boolean
			?[{text:this.lang.booleanFalse,value:false},{text:this.lang.booleanTrue,value:true}]
			:typeof inputOpts.options==="function"
			?inputOpts.options(this._makeCallbackPayload(instanceNode??null,{rowData,value: rowData?.[schemaNode?.dataKey]},{
				schemaNode,
				mainIndex,
				rowData
			}))
			:inputOpts.options;
		const opts=[...(resolvedOptions??[])];
		if (inputOpts.allowSelectEmpty) {
			const emptyVal=opts.find(opt=>this._getSelectValue(opt)==null);
			const emptyText=inputOpts.emptyText??this.lang.selectEmpty;
			if (!emptyVal)
				opts.unshift({text:emptyText,value:null,isEmpty:true,cssClass:"empty-option"});
			else {
				if (!emptyVal.text)
					emptyVal.text=emptyText;
				emptyVal.cssClass??="empty-option";
			}
		}
		return opts;
	}

	_renderBooleanSelectValue(parent,value,text) {
		parent.replaceChildren();
		const presentation=parent.appendChild(document.createElement("span"));
		presentation.className="boolean-select-value";
		const checkbox=presentation.appendChild(document.createElement("input"));
		checkbox.type="checkbox";
		checkbox.className="boolean-select-checkbox";
		checkbox.tabIndex=-1;
		checkbox.setAttribute("aria-hidden","true");
		checkbox.checked=value===true;
		const label=presentation.appendChild(document.createElement("span"));
		label.className="boolean-select-label";
		label.innerText=text??(value===true?this.lang.booleanTrue:this.lang.booleanFalse);
		return presentation;
	}

	_formatCreateOptionText(strctInp,text) {
		let res;
		if (typeof strctInp.createOptionFormatter==="function")
			res=strctInp.createOptionFormatter(text,this._cellCursorDataObj,this._activeSchemaNode,
				this._mainRowIndex,this._activeDetailsCell);
		if (!res)
			res=strctInp.createOptionText??this.lang.selectCreateOption??"Create [{text}]";
		const normalize=(val)=>{
			if (typeof val==="string") {
				if (val.includes("{text}")) {
					const [before,after]=val.split("{text}");
					return {before,text,after};
				}
				return {before:val+" ",text,after:""};
			}
			if (typeof val==="object")
				return {before:val.before??"",text:val.text??text,after:val.after??""};
			return {before:"Create [",text,after:"]"};
		};
		return normalize(res);
	}

	_setCreateOptionLabel(li,labelParts) {
		li.innerHTML="";
		const beforeSpan=li.appendChild(document.createElement("span"));
		beforeSpan.textContent=labelParts.before;
		const textSpan=li.appendChild(document.createElement("span"));
		textSpan.textContent=labelParts.text;
		textSpan.classList.add("create-option-text");
		const afterSpan=li.appendChild(document.createElement("span"));
		afterSpan.textContent=labelParts.after;
	}

	/**Given a schemaNode like details or column, will add inputs to this._bulkEditSchemaNodes which later is iterated
	 * and the contents added to the bulk-edit-area. 
	 * @param {*} schemaNode Should be details or column when called from outside, but it calls itself recursively
	 * 						when hitting upon containers which then are passed to this param
	 * @returns */
	_buildBulkEditSchemaNodes(schemaNode) {
		const result=[];
		if (schemaNode.type=="field"&&schemaNode.bulkEdit) {
			//Clone the raw node for the bulk schema, but keep reference to the wrapped original for closestMeta.
			result.push(Object.assign(Object.create(null),schemaNode.raw,{type:"field",originalSchemaNode:schemaNode}));
		} else if ((schemaNode.entries?.length&&schemaNode.bulkEdit)||schemaNode===this._schema.details) {
			for (const childNode of schemaNode.entries)
				result.push(...this._buildBulkEditSchemaNodes(childNode));
		}
		return result;
	}

	/**Updates the displayed values in the bulk-edit-area */
		_updateBulkEditAreaCells(schemaNodesToUpdateCellsFor=this._bulkEditTable._schema.details.entries) {
			const mixedText="(Mixed)";
			for (let multiCellI=-1, multiCellSchemaNode; multiCellSchemaNode=schemaNodesToUpdateCellsFor[++multiCellI];) {

				//work out if there are mixed values for this cell among the selected rows, or if all are same
				let mixed=false;
				let val,lastVal,firstRow=null;
				for (let rowI=-1,row; row=this._selectedRows[++rowI];) {
					firstRow??=row;
					val=row[multiCellSchemaNode.dataKey];
					const normalizedVal=multiCellSchemaNode.input?.type==="select"
						?this._getSelectValue(val):val;
					const normalizedLast=multiCellSchemaNode.input?.type==="select"
						?this._getSelectValue(lastVal):lastVal;
				if (rowI&&normalizedVal!=normalizedLast) {
					mixed=true;
					break;
				}
				lastVal=val;
				}


				// Update the bulk-edit table's backing row and let its own rendering resolve display text.
				const bulkRow=this._bulkEditTable._filteredData[0];
				const bulkCell=this._bulkEditTable._openDetailsPanes[0].children[multiCellI];
				if (mixed) {
					bulkCell.el.innerText=mixedText;
				} else {
					bulkRow[multiCellSchemaNode.dataKey]=val;
					this._bulkEditTable._updateDetailsCell(bulkCell,bulkRow);
				}
			}
		}

	_updateSizesOfViewportAndCols() {
		if (!this.hostEl.offsetWidth||!this.hostEl.offsetHeight)
			return;
		if (this.hostEl.offsetHeight != this._containerHeight) {
			this._updateViewportHeight();
			if (this.hostEl.offsetHeight > this._containerHeight)
				this._maybeAddTrs();
			else
				this._maybeRemoveTrs();
			this._containerHeight = this.hostEl.offsetHeight;
		}
		this._updateColsWidths();
		this._headerTable.style.width = this._scrollBody.offsetWidth + "px";
		this._adjustCursorPosSize(this._selectedCell);
		this._updateAutoHeight();
	}

	_updateColsWidths() {
		if (this.rootEl.offsetWidth>this._containerWidth) {
			let areaWidth=this._scrollBody.clientWidth;
			const percentageWidthRegex=/\d+%/;
			let totalFixedWidth=0;
			let numUndefinedWidths=0;
			for (let col of this._colSchemaNodes)
				if (!col.width)
					numUndefinedWidths++;
				else if (!percentageWidthRegex.test(col.width))//if fixed width
					totalFixedWidth+=(col.pxWidth=parseInt(col.width));
			let sumFixedAndFlexibleWidth=totalFixedWidth;
			for (let col of this._colSchemaNodes)
				if (col.width&&percentageWidthRegex.test(col.width))//if flexible width
					sumFixedAndFlexibleWidth+=(col.pxWidth=(areaWidth-totalFixedWidth)*parseFloat(col.width)/100);
			for (let col of this._colSchemaNodes)
				if (!col.width)//if undefined width
					col.pxWidth=(areaWidth-sumFixedAndFlexibleWidth)/numUndefinedWidths;
			for (var colI=0; colI<this._colSchemaNodes.length; colI++) 
				this._cols[colI].style.width=this._headerTr.cells[colI].style.width
																			=this._colSchemaNodes[colI].pxWidth+"px";
			//last col is empty col with the width of table-scrollbar if its present in order to make the header span
			//the whole with while not actually using that last bit in the calculations for the normal cols
			this._headerTr.cells[colI].style.width=this._scrollBody.offsetWidth-areaWidth+"px";
		}
	}

	/**
	 * Build a lookup of select options keyed by the options array itself.
	 * Uses the pre-collected select inputs to avoid walking the entire schema tree.
	 * @returns {WeakMap<object, Record<string, any>>} WeakMap keyed by options arrays with value->option maps.
	 */
	_createSelectOptsCache() {
		const cache=new WeakMap();
		for (const input of this._selectInputs) {
			const opts=input?.options;
			if (typeof opts==="function"||!opts)
				continue;
			if (cache.has(opts))
				continue;
			const optionsByVal=Object.create(null);
			for (const opt of opts)
				optionsByVal[this._getSelectValue(opt)]=opt.text;
			cache.set(opts,optionsByVal);
		}
		return cache;
	}

	/**
	 * Run the full filter pipeline: reset filter state, apply the filter to the current view,
	 * then sort and refresh rendered output.
	 * @param {*} filterString The filter string to apply (empty/falsey clears filtering).
	 * @param {boolean} includeDetails Whether to include details entries when matching.
	 * @param {boolean} caseSensitive Whether text matching should be case sensitive.
	 */
	_filterCurrentView(filterString,includeDetails=true,caseSensitive=false) {
		this._filter=filterString;
		const viewData=this._viewData??[];
		if (filterString) {
			const selectOptsCache=this._createSelectOptsCache();
			const nextData=[];
			for (let dataIndex=0; dataIndex<viewData.length; dataIndex++) {
				const dataRow=viewData[dataIndex];
				if (this._rowSatisfiesFilters(filterString,dataRow,dataIndex,selectOptsCache,
					includeDetails,caseSensitive))
					nextData.push(dataRow);
			}
			this._filteredData=nextData;
		} else
			this._filteredData=viewData;
	}

	_refreshAfterViewRowsChanged() {
		const selectedData=this._cellCursorDataObj;
		const selectedRowIndex=selectedData?this._filteredData.indexOf(selectedData):-1;
		this._openDetailsPanes={};

		for (const row of this._sourceData) {
			const meta=row?this._rowMeta.get(row):undefined;
			if (meta&&"h"in meta) {
				delete meta.h;
				if (!Object.keys(meta).length)
					this._rowMeta.delete(row);
			}
		}
		for (const tr of this._mainTbody.querySelectorAll("tr.details"))
			tr.remove();

		if (selectedRowIndex<0) {
			this._mainRowIndex=this._mainColIndex=null;
			this._activeDetailsCell=null;
			this._cellCursorDataObj=null;
			this._selectedCellState=null;
			this._setSelectedCellElement(null);
		} else {
			this._mainRowIndex=selectedRowIndex;
			// View changes close details panes. Preserve the selected row and return to its main-table anchor column.
			this._activeDetailsCell=null;
		}
		this._scrollRowIndex=0;
		this._refreshTable();
		this._refreshTableSizerNoDetails();
	}

	_refreshRenderedViewRows() {
		for (const tr of this._mainTbody.querySelectorAll(":scope>tr:not(.details)")) {
			const mainIndex=Number(tr.dataset.dataRowIndex);
			if (!Number.isInteger(mainIndex)||!this._filteredData[mainIndex])
				continue;
			this._updateRowValues(tr,mainIndex);
			this._lookForActiveCellInRow(tr);
		}
	}

	_applyFilters(filterString, includeDetails=true,caseSensitive=false,reason="search") {
		if (!this._flushValidatedEdits())
			this._editTransaction=null;

		//currently all of the rows will have to be closed. This is because Tablance doesn't have the logic needed now
		//to recalculate the virtualization based on artibrary rows that are expanded with variable heights. It only
		//has the logic to recalculate when expanding rows one by one, which are currently in view. This is mostly
		//it actually needs to generate and render the dom to calculate height. I think in the future it should guess
		//height of expansions(details) based on the knowledge it already has, and then adjust accordingly when
		//scrolling. This will also allow for a button in the titlebar that expands all.
		this._filterCurrentView(filterString,includeDetails,caseSensitive);
		this._sortData();
		this._refreshAfterViewRowsChanged();
		this._emitViewStateChange(reason);
	}

	/**
	 * Check whether a single row satisfies the current filter/search criteria.
	 * @param {*} filterString  The filter string (empty/falsey means always match).
	 * @param {object} dataRow  Row data object to test.
	 * @param {number} mainIndex Index of the row within the active view.
	 * @param {WeakMap<object, Record<string, any>>} selectOptsCache Cache for select options keyed by options array.
	 * @param {boolean} includeDetails Whether to search nested details entries.
	 * @param {boolean} caseSensitive Whether text matching should be case sensitive.
	 * @returns {boolean} True if the row matches the filter.
	 */
	_rowSatisfiesFilters(filterString,dataRow,mainIndex,selectOptsCache,includeDetails=true,caseSensitive=false) {
		const filterNeedle=!caseSensitive&&typeof filterString==="string"?filterString.toLowerCase():filterString;
		const searchDelim="\u0001";//separator to prevent cross-field substring matches when caching
		let rowSearchText;
		const matchesFilter=value=>{
			rowSearchText+=(value==null?"":String(value))+searchDelim;
			if (value==null)
				return false;
			const haystackStr=typeof value==="string"?value:String(value);
			const haystack=caseSensitive?haystackStr:haystackStr.toLowerCase();
			return haystack.includes(filterNeedle);
		};
		const shouldSkipField=schemaNode=>
			schemaNode?.input?.type==="button"//buttons carry no filterable text
			||schemaNode?.dependsOnCellPaths;//needs live instance nodes; skip for now
		const matchesFieldValue=(schemaNode,dataObj,mainIndex)=>{
			if (!schemaNode||shouldSkipField(schemaNode)||dataObj==null)
				return false;
			if (schemaNode.input?.type=="select"&&!schemaNode.render) {
				const cellVal=dataObj?.[schemaNode.dataKey];
				if (schemaNode.input.boolean) {
					const option=this._getSelectOptions(schemaNode.input,schemaNode,dataObj,mainIndex)
						.find(opt=>this._getSelectValue(opt)===this._getSelectValue(cellVal));
					return option?matchesFilter(option.text):false;
				}
				const optionsSrc=schemaNode.input.options;
				if (typeof optionsSrc==="function")
					return false;
				const cacheEntry=selectOptsCache.get(optionsSrc);
				const valKey=this._getSelectValue(cellVal);
				const text=cacheEntry?.[valKey];
				if (!text)
					return false;
				return matchesFilter(text);
			}
			const filterVal=this._getDisplayValue(schemaNode,dataObj,mainIndex,true);//strip tags if html-rendered
			return matchesFilter(filterVal);
		};
		// Some details containers re-root their data with dataPath; adjust before reading children.
		const applyDataPath=(schemaNode,dataObj)=>{
			if (!schemaNode?.dataPath)
				return dataObj;
			const path=Array.isArray(schemaNode.dataPath)?schemaNode.dataPath:String(schemaNode.dataPath).split(".").filter(Boolean);
			let cur=dataObj;
			for (const key of path) {
				if (!cur||typeof cur!=="object")
					return undefined;
				cur=cur[key];
			}
			return cur;
		};
		// Depth-first walk of details schema; repeated nodes fan out across all entries.
		const detailsMatch=(schemaNode,dataObj,mainIndex)=>{
			if (!schemaNode)
				return false;
			const scopedData=applyDataPath(schemaNode,dataObj);
			switch (schemaNode.type) {
				case "field":
					return matchesFieldValue(schemaNode,scopedData,mainIndex);
				case "repeated": {
					const repeatArr=scopedData?.[schemaNode.dataKey];
					if (!Array.isArray(repeatArr))
						return false;
					for (const item of repeatArr)//fan out over each repeated entry
						if (detailsMatch(schemaNode.entry,item,mainIndex))
							return true;
					return false;
				}
				case "group":
				case "list":
				case "lineup":
					for (const child of schemaNode.entries)//depth-first search down details schema
						if (detailsMatch(child,scopedData,mainIndex))
							return true;
					return false;
			}
			return false;
		};
		const colsToFilterBy=[];
		for (let col of this._colSchemaNodes)
			if (col.type!=="expand"&&col.type!=="select")
				colsToFilterBy.push(col);
		const cachedSearchText=this._rowFilterCache.get(dataRow);
		if (cachedSearchText!=null&&cachedSearchText.includes(searchDelim)) {
			const haystack=caseSensitive?cachedSearchText:cachedSearchText.toLowerCase();
			return haystack.includes(filterNeedle);
		}

		rowSearchText="";
		let match=false;
		for (let colI=-1,col; col=colsToFilterBy[++colI];)
			if (matchesFieldValue(col,dataRow,mainIndex)) {
				match=true;
				break;
			}
		if (!match&&includeDetails&&this._schema.details)
			match=detailsMatch(this._schema.details,dataRow,mainIndex);
		if (!match)
			this._rowFilterCache.set(dataRow,rowSearchText);
		return match;
	}

	_setDataForOnlyDetails(data) {
		this._openDetailsPanes=Object.create(null);
		const lastRow=data?.[data.length-1];
		this._sourceData=lastRow?[lastRow]:[];
		this._viewData=this._sourceData;
		this._filteredData=this._viewData;
		this.rootEl.innerHTML="";
		if (!lastRow)
			return;
		const detailsDiv=this.rootEl.appendChild(document.createElement("div"));
		detailsDiv.classList.add("details");
		const rootInstance=this._openDetailsPanes[0]=this._createInstanceNode();
		this._generateDetailsContent(this._schema.details,0,rootInstance,detailsDiv,[],lastRow);
	}

	/**Refreshes the table-rows. Should be used after sorting or filtering or such.*/
	_refreshTable() {
		//In order to render everything correctly and know which rows should be rendered in the view we need to go from
		//top to bottom because the number of expanded rows above the view might have changed. So go to 
		//#scrollRowIndex 0 to start at top row, also set #scrollY to 0 so the scrollMethod compares the current
		//scrollTop with 0.
		this._scrollRowIndex=this._scrollY=0;

		this._lastCheckedIndex=null;

		//adjust the sizer to what its top and height would be when scrolled all the way up.
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)+parseInt(this._tableSizer.style.top)+"px";
		this._tableSizer.style.top=this._numRenderedRows=0;

		//its position and size needs to be udated.Hide for now and let #updateRowValues or #renderDetails add it back
		this._cellCursor.style.display="none";
		this._detachMainCursorFromRow(this._selectedCell?.parentElement);

		this._mainTbody.replaceChildren();//remove all the tr-elements
		this._maybeAddTrs();//add them again and with their correct data, at least based on them being the top rows 
		this._scrollMethod();//now scroll back to the real scroll-position
	}

	/**This onScroll-handler is used when rows are of static height and can't be expanded either.
	 * It is the fastest scroll-method since row-heights are known and it is easy to calculate which rows should be
	 * rendered even when scrolling more than a whole page at once as each row won't have to be iterated, and rows
	 * will only have to be created or deleted if the table is resized so the same tr-elements are reused.* 
	 * @returns */
	_onScrollStaticRowHeightNoDetails() {
		const scrY=Math.max(this._scrollBody.scrollTop-this._scrollMarginPx,0);
		const newScrollRowIndex=Math.min(parseInt(scrY/this._rowHeight),this._filteredData.length-this._mainTbody.rows.length);
		
		if (newScrollRowIndex==this._scrollRowIndex)
			return;
		if(Math.abs(newScrollRowIndex-this._scrollRowIndex)>this._mainTbody.rows.length){//if scrolling by whole page(s)
			this._scrollRowIndex=parseInt(scrY/this._rowHeight);
			this._refreshTable();
		} else {
			const scrollSignum=Math.sign(newScrollRowIndex-this._scrollRowIndex);//1 if moving down, -1 if up
			do {
				this._scrollRowIndex+=scrollSignum;
				if (scrollSignum==1) {//moving down												move top row to bottom
					const dataIndex=this._scrollRowIndex+this._numRenderedRows-1;
					const trToMove=this._updateRowValues(
						this._mainTbody.appendChild(this._mainTbody.firstChild),dataIndex);
					this._lookForActiveCellInRow(trToMove);
				} else {//moving up
					let trToMove=this._mainTbody.lastChild;									//move bottom row to top
					this._mainTbody.prepend(trToMove);
					this._updateRowValues(trToMove,this._scrollRowIndex);
					this._lookForActiveCellInRow(trToMove);
				}
			} while (this._scrollRowIndex!=newScrollRowIndex);
		}
		this._refreshTableSizerNoDetails();
	}

	_onScrollStaticRowHeightDetails(_e) {
		const newScrY=Math.max(this._scrollBody.scrollTop-this._scrollMarginPx,0);
		if (newScrY>parseInt(this._scrollY)) {//if scrolling down
			while (newScrY-parseInt(this._tableSizer.style.top)
			>(this._rowMeta.get(this._filteredData[this._scrollRowIndex])?.h??this._rowHeight)) {//if a whole top row is outside
				if (this._scrollRowIndex+this._numRenderedRows>this._filteredData.length-1)
					break;
				let topShift;//height of the row that is at the top before scroll and which will be removed which is the
																	// amount of pixels the whole table is shiftet by
				//check if the top row (the one that is to be moved to the bottom) is expanded
				const topMeta=this._rowMeta.get(this._filteredData[this._scrollRowIndex]);
				if (topShift=topMeta?.h) {
					delete this._openDetailsPanes[this._scrollRowIndex];
					this._mainTbody.rows[1].remove();
				} else
					topShift=this._rowHeight;
				const dataIndex=this._numRenderedRows+this._scrollRowIndex;//the data-index of the new row

				//move the top row to bottom and update its values
				const trToMove=this._updateRowValues(this._mainTbody.appendChild(this._mainTbody.firstChild),dataIndex);

				//move the table down by the height of the removed row to compensate,else the whole table would shift up

				this._doRowScrollDetails(trToMove,dataIndex,this._scrollRowIndex,-topShift);
				this._scrollRowIndex++;
			}
		} else if (newScrY<parseInt(this._scrollY)) {//if scrolling up
			while (newScrY<parseInt(this._tableSizer.style.top)) {//while top row is below top of viewport
				this._scrollRowIndex--;

				//check if the bottom row (the one that is to be moved to the top) is expanded
				if (this._rowMeta.get(this._filteredData[this._scrollRowIndex+this._numRenderedRows])?.h) {
					delete this._openDetailsPanes[this._scrollRowIndex+this._numRenderedRows];
					this._mainTbody.lastChild.remove();//remove the details-tr
				}

				let trToMove=this._mainTbody.lastChild;									//move bottom row to top
				this._mainTbody.prepend(trToMove);
				this._updateRowValues(trToMove,this._scrollRowIndex);//the data of the new row;

				//height of the row that is added at the top which is amount of pixels the whole table is shiftet by
				const topShift=this._rowMeta.get(this._filteredData[this._scrollRowIndex])?.h??this._rowHeight;

				this._doRowScrollDetails(trToMove,this._scrollRowIndex,this._scrollRowIndex+this._numRenderedRows,topShift);
			}
		}
		this._scrollY=newScrY;
	}

	/**Used by #onScrollStaticRowHeightDetails whenever a row is actually added/removed(or rather moved)*/
	_doRowScrollDetails(trToMove,newMainIndex,oldMainIndex,topShift) {
		const newRow=this._filteredData[newMainIndex];
		const detailsHeight=newRow?this._rowMeta.get(newRow)?.h:undefined;
		if (detailsHeight>0) {

			if (trToMove.dataset.dataRowIndex==this._mainRowIndex&&this._activeDetailsCell) {
				//if the details-pane just scrolled into view contains the cell-cursor. In this case we want to restore
				//the old instance to retain the state of opened groups and such.
				trToMove.classList.add("expanded");
				trToMove.after(this._activeDetailsCell.el.closest("tr.details"));
				for (var detailsRoot=this._activeDetailsCell;detailsRoot.parent;detailsRoot=detailsRoot.parent);
				this._openDetailsPanes[newMainIndex]=detailsRoot;
			} else
				this._renderDetails(trToMove,newMainIndex);

		} else if (detailsHeight==-1) {
			this._scrollBody.scrollTop+=this._expandRow(trToMove,false);
		} else
			trToMove.classList.remove("expanded");
		
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)+topShift+"px";
		this._tableSizer.style.top=parseInt(this._tableSizer.style.top)-topShift+"px";

		this._lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row. This is needed
		//in order to reassign the dom-element and such and also adjust the pos of the cellcursor in case
		//the pos of the cell is not the same due to sorting/filtering
	}
	

	/**This should be called on each row that is being scrolled into view that might hold the active cell in order
	 * to set #selectedCell to the correct element
	 * @param {HTMLTableRowElement} tr */
	_lookForActiveCellInRow(tr) {
		const rowIndex=Number(tr.dataset.dataRowIndex);
		if (rowIndex!==this._mainRowIndex||this._activeDetailsCell
			||this._filteredData[rowIndex]!==this._cellCursorDataObj)
			return;
		const cell=tr.cells[this._mainColIndex];
		this._setSelectedCellElement(cell);
		const state=this._getCellState(cell);
		if (state)
			this._setCellState(cell,state,null,this._colSchemaNodes[this._mainColIndex]);
	}

	_detachMainCursorFromRow(tr,nextMainIndex=null) {
		if (this._activeDetailsCell||this._selectedCell?.parentElement!==tr)
			return;
		if (nextMainIndex===this._mainRowIndex
			&&this._filteredData[nextMainIndex]===this._cellCursorDataObj)
			return;
		this._setSelectedCellElement(null);
		this._clearStaticCellOverflowPreview();
		this._cellCursor.style.display="none";
	}

	_refreshTableSizerNoDetails() {
		if (this._naturalAutoHeight)
			return this._updateAutoHeight();
		this._tableSizer.style.top=this._scrollRowIndex*this._rowHeight+"px";
		this._tableSizer.style.height=(this._filteredData.length-this._scrollRowIndex)*this._rowHeight+"px";
		this._updateAutoHeight();
	}

	_createExpandContractButton() {
		const a=document.createElement("a");
		a.appendChild(document.createElement("span"));
		return a;
	}

	_createCheckbox(preventClickSelect) {
		const checkbox=document.createElement("input");
		checkbox.type="checkbox";
		checkbox.tabIndex="-1";

		if (preventClickSelect)//prevent checking and leave to #toggleRowSelected for consistant behavior when 
			checkbox.addEventListener("click",this._preventDefault);//clicking checkbox vs clicking its cell

		//prevent gaining focus when clicking it. Otherwise it does gain focus despite tabIndex -1
		checkbox.addEventListener("mousedown",this._preventDefault);

		return checkbox;
	}

	/**Should be called if tr-elements might need to be created which is when data is added or if table grows*/
	_maybeAddTrs() {
		let lastTr=this._mainTbody.lastChild;
		const scrH=this._scrollBody.offsetHeight+this._scrollMarginPx*2;
		const dataLen=this._filteredData.length;
		//if there are fewer trs than datarows, and if there is empty space below bottom tr
		while ((this._naturalAutoHeight||(this._numRenderedRows-1)*this._rowHeight<scrH)
			&&this._scrollRowIndex+this._numRenderedRows<dataLen) {
			lastTr=this._mainTable.insertRow();
			this._numRenderedRows++;
			for (let i=0; i<this._colSchemaNodes.length; i++) {
				const cell=lastTr.insertCell();
				const div=cell.appendChild(document.createElement("div"));//used to set height of cells
				div.style.height=this._naturalAutoHeight?"auto":this._rowInnerHeights[i]??"auto";
				if (this._colSchemaNodes[i].type==="expand") {
					div.appendChild(this._createExpandContractButton());
					cell.classList.add("expand-col");
				} else if (this._colSchemaNodes[i].type==="select") {
					div.appendChild(this._createCheckbox(true));
					cell.classList.add("select-col");
				}
			}
			const newRowIndex=this._scrollRowIndex+this._numRenderedRows-1;
			this._updateRowValues(lastTr,newRowIndex);
			if (this._rowMeta.get(this._filteredData[newRowIndex])?.h)
				this._renderDetails(lastTr,newRowIndex);
			this._lookForActiveCellInRow(lastTr);//look for active cell (cellcursor) in the row
			if (!this._rowHeight) {//if there were no rows prior to this
				this._rowHeight=lastTr.offsetHeight+this._borderSpacingY;
				//The first row establishes the natural row height. Derive each column's inner height from that row
				//and the cell's own box model; one shared value would make differently padded columns change row height.
				this._rowInnerHeights=[...lastTr.cells].map(cell=>{
					const tdComputedStyle=window.getComputedStyle(cell);
					let innerHeight=lastTr.offsetHeight;
					for (let prop of ["paddingTop","paddingBottom","borderBottomWidth","borderTopWidth"])
						innerHeight-=parseFloat(tdComputedStyle[prop])||0;
					const height=Math.max(0,innerHeight)+"px";
					cell.firstElementChild.style.height=height;
					return height;
				});
			}
		}
	}

	_preventDefault(e){
		e.preventDefault();
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	_maybeRemoveTrs() {
		if (this._naturalAutoHeight)
			return;
		const scrH=this._scrollBody.offsetHeight+this._scrollMarginPx*2;
		while ((this._numRenderedRows-2)*this._rowHeight>scrH) {
			if (this._rowMeta.get(this._filteredData[this._scrollRowIndex+this._numRenderedRows-1])?.h) {
				this._mainTbody.lastChild.remove();
				delete this._openDetailsPanes[this._scrollRowIndex+this._numRenderedRows];
			}
			this._detachMainCursorFromRow(this._mainTbody.lastChild);
			this._mainTbody.lastChild.remove();
			this._numRenderedRows--;
		}
	}

	/**Update the values of a row in the table. The tr needs to be passed in as well as the index of the data in #data
	 * The row needs to already have the right amount of td's.
	 * @param {HTMLTableRowElement} tr The tr-element whose cells that should be updated*/
	_updateRowValues(tr,mainIndex) {
		this._detachMainCursorFromRow(tr,mainIndex);
		for (const cell of tr.querySelectorAll(":scope>td.tablance-active-cell"))
			cell.classList.remove("tablance-active-cell");
		tr.dataset.dataRowIndex=mainIndex;
		const selected=this._selectedRows.indexOf(this._filteredData[mainIndex])!=-1;
		tr.classList.toggle("selected",!!selected);
		for (let colI=0; colI<this._colSchemaNodes.length; colI++) {
			let td=tr.cells[colI];
			let colSchemaNode=this._colSchemaNodes[colI];
			if (colSchemaNode.type!="expand"&&colSchemaNode.type!="select")
				this._updateMainRowCell(td,colSchemaNode);
			else {
				const rowData=this._filteredData[mainIndex];
				const valueBundle=this._getCellValueBundle(colSchemaNode,rowData,mainIndex,null);
				const payload=this._makeCallbackPayload(null,valueBundle,{schemaNode:colSchemaNode,mainIndex,rowData});
				const cellState=this._resolveCellState(colSchemaNode,payload);
				this._setCellState(td,cellState,null,colSchemaNode);
				if (colSchemaNode.type=="select") {
					const checkbox=td.querySelector("input");
					checkbox.checked=selected;
					checkbox.disabled=cellState.kind==="disabled";
				}
			}
		}
		if (this._highlightRowsOnView[mainIndex]) {
			delete this._highlightRowsOnView[mainIndex];
			this._highlightRowIndex(mainIndex);
		}
		return tr;
	}

	/**
	 * Format bytes as human-readable text.
	 * 
	 * @param bytes Number of bytes.
	 * @param si True to use metric (SI) units, aka powers of 1000. False to use 
	 *           binary (IEC), aka powers of 1024.
	 * @param dp Number of decimal places to display.
	 * 
	 * @return Formatted string.
	 */
	_humanFileSize(bytes, si=false, dp=1) {
		const thresh = si ? 1000 : 1024;
	
		if (Math.abs(bytes) < thresh) {
		return bytes + ' B';
		}
	
		const units = si 
		? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
		: ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
		let u = -1;
		const r = 10**dp;
	
		do {
		bytes /= thresh;
		++u;
		} while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
	
	
		return bytes.toFixed(dp) + ' ' + units[u];
	}

	_generateFileCell(fileInstanceNode,cellEl,rowData,dataIndex) {
		//schemaNode of instanceNode will get overwritten. Save reference here.
		const fileSchemaNode=fileInstanceNode.schemaNode;
		const valueBundle=this._getCellValueBundle(fileSchemaNode,rowData,dataIndex,fileInstanceNode);
		const statePayload=this._makeCallbackPayload(fileInstanceNode,valueBundle,
			{schemaNode:fileSchemaNode,mainIndex:dataIndex,rowData});
		const fileFieldState=this._resolveCellState(fileSchemaNode,statePayload);

		//saving this ref here which is used to revert with if user deletes file
		fileInstanceNode.fileInputSchemaNode=fileSchemaNode;
		const fileData=rowData[fileSchemaNode.dataKey];

		//define all the file-meta-props
		const lang=this.lang;
			let metaEntries=[{type:"field",title:lang.fileName,dataKey:"name"},
				{type:"field",title:lang.fileLastModified,dataKey:"lastModified",render:({value})=>
				new Date(value).toISOString().slice(0, 16).replace('T', ' ')},
				{type:"field",title:lang.fileSize,dataKey:"size",render:({value})=>this._humanFileSize(value)},
				{type:"field",title:lang.fileType,dataKey:"type"}];
		for (let metaI=-1,metaName; metaName=["filename","lastModified","size","type"][++metaI];)
			if(!(fileSchemaNode.input.fileMetasToShow?.[metaName]??this._opts.defaultFileMetasToShow?.[metaName]??true))
				metaEntries.splice(metaI,1);//potentially remove (some of) them
		//define the group-structure for the file
		const parentSchema=fileInstanceNode.parent?.schemaNode;
		const parentRepeated=fileInstanceNode.parent?.parent?.schemaNode;
		const suppressFileDelete=!!(parentSchema?.entryAutoGroup&&parentSchema?.isImplicit
			&&parentRepeated?.type==="repeated"&&parentRepeated?.create);
		const baseOpenControl={type:"field",input:{type:"button",text:"Open"
			,onClick:(payload)=>{
				rowData??=this._filteredData[dataIndex];
				fileSchemaNode.input.onOpenFile?.(payload);
		}}};

		let fileGroup;
		if (suppressFileDelete) {
			fileGroup={type:"group",entries:[{type:"lineup",variant:"controls",entries:[baseOpenControl]}],origin:"internal"};
		} else {
			fileGroup=this._schemaCopyWithDeleteButton({type:"group",entries:[]},this._fileOnDelete);
			fileGroup.entries[0].entries.unshift(baseOpenControl);
			for (const mutationControl of fileGroup.entries[0].entries.slice(1))
				mutationControl.disabled=!fileFieldState.mutable;
		}
		fileGroup.disabled=fileFieldState.kind==="disabled";
		fileGroup.entries.push({type:"lineup",variant:"metadata",entries:metaEntries});
		// Anchor synthetic schema to the parent so closestMeta can traverse implicit groups.
		const wrappedFileGroup=this._buildSchemaFacade(fileGroup,fileSchemaNode.parent??parentSchema);//WRAPPED
		
		//call _buildSchemaTreeFacade on fileGroup here?
		this._generateDetailsContent(wrappedFileGroup,dataIndex,fileInstanceNode,cellEl,fileInstanceNode.path,fileData);
		const fileMeta=this._fileMeta.get(fileData);
		if (fileMeta!=null) {
			const progressbarOuter=cellEl.appendChild(document.createElement("div"));
			progressbarOuter.classList.add("progressbar","active");
			const progressbarInner=progressbarOuter.appendChild(document.createElement("div"));
			progressbarInner.style.transition="none";//get to the current pos immediately in case running from before
			fileMeta.bars.push(progressbarInner);
			progressbarInner.role="progressbar";
			const progressSpan=progressbarInner.appendChild(document.createElement("span"));
			progressbarInner.style.width=progressSpan.innerText=parseInt(fileMeta.uploadedBytes/fileData.size*100)+"%";
			progressbarInner.style.removeProperty("transition");//enable transitioning again, it was disabled above
		}
	}


	/**Updates the html-element of a cell inside an details. Also updates nonEmptyDescentants of the instanceNode of 
	 * 	group-rows as well as toggling the empty-class of them. Reports back whether visibility has been changed.
	 * @param {*} instanceNode */
	_updateDetailsCell(instanceNode,scopedData=null) {
		let cellEl=instanceNode.el;
		if (instanceNode.schemaNode.maxHeight) {//if there's a maxHeight stated, which is used for textareas
			cellEl.innerHTML="";//empty the cell, otherwise multiple calls to this would add more and more content to it
			cellEl=cellEl.appendChild(document.createElement("div"));//then put a div inside and change cellEl to that
			cellEl.style.maxHeight=instanceNode.schemaNode.maxHeight;//then set its maxHeight
			cellEl.style.overflow="auto";//and male it scrollable
			//can't make td directly scrollable which is why the div is needed
		}
		for (var rootCell=instanceNode;rootCell.parent;rootCell=rootCell.parent);
		const oldCellContent=cellEl.innerText;
		if (instanceNode.schemaNode.input?.type=="file"&&scopedData[instanceNode.schemaNode.dataKey]) {
			this._generateFileCell(instanceNode,cellEl,scopedData,rootCell.rowIndex);
		} else {
			const cellState=this._updateCell(instanceNode.schemaNode,cellEl,instanceNode.selEl,scopedData,
				rootCell.rowIndex,instanceNode);
			if (instanceNode.schemaNode.input?.type!=="button") {
				const newCellContent=cellEl.innerText;
				if (!newCellContent!=!oldCellContent) {
					for (let cellI=instanceNode; cellI; cellI=cellI.parent)
						if (cellI.nonEmptyDescentants!=null)
							cellI.grpTr.classList.toggle("empty",!(cellI.nonEmptyDescentants+=newCellContent?1:-1));
					return true;
				}
				} else {
					const button=cellEl.matches?.("button")?cellEl:cellEl.querySelector("button");
					instanceNode.el=button;
					if (instanceNode.parent?.schemaNode.type!=="lineup")
						instanceNode.selEl=button;
					this._setCellState(instanceNode.selEl??instanceNode.el,cellState,instanceNode);
				}
		}
	}

	_getValueByPath(obj, path) {
		let cur = obj;
		for (const key of path) {
			if (cur == null)
				return undefined;
			cur = cur[key];
		}
		return cur;
	}

	_resolveCellPaths(baseCell, path) {
		let target = baseCell;

		// Step 1: go up for each ".."
		for (var i=0; i < path.length && path[i] === ".."; i++) {
			if (!target?.parent)
				return null;
			target = target.parent;
		}

		// Step 2: go down via the remaining indices
		for (; i < path.length; i++) {
			target = target?.children?.[path[i]];
			if (!target)
				return null;
		}
		return target;
	}

	_resolveDependeeInstance(baseCell,path,source={}) {
		let target=this._resolveCellPaths(baseCell,path);
		if (source.type!=="repeated")
			return target;
		for (let node=target;node;node=node.parent)
			if (node.schemaNode?.type==="repeated"
				&&(source.nodeId==null||node.schemaNode.nodeId===source.nodeId)
				&&(source.dataKey==null||node.schemaNode.dataKey===source.dataKey))
				return node;
		return target;
	}

	_getInstanceNodeValue(instanceNode) {
		if (!instanceNode)
			return;
		if (instanceNode.schemaNode?.type==="field")
			return instanceNode.dataObj?.[instanceNode.schemaNode.dataKey];
		return instanceNode.dataObj;
	}

	/**
	 * Gets the value of a cell, pointed to by its ID, or if it depends on another cell, gets that value. The value
	 * is the raw data from the data-object, not rendered.
	 * @param {*} schemaNode 
	 * @param {*} rowData 
	 * @param {*} instanceNode 
	 * @returns 
	 */
	_getTargetVal(idOverDependee,schemaNode, instanceNode, rowData=instanceNode.dataObj) {
		if (idOverDependee&&schemaNode.dataKey)
			return rowData[schemaNode.dataKey];
		if (schemaNode.dependsOnDataPaths) {
			if (instanceNode)
				for (var root=instanceNode; root.parent; root=root.parent,rowData=root.dataObj);
			return schemaNode.dependsOnDataPaths.map(dataPath=>this._getValueByPath(rowData,dataPath));
		}
		if (schemaNode.dependsOnDataPath) {
			if (instanceNode)
				for (var root=instanceNode; root.parent; root=root.parent,rowData=root.dataObj);
			 return this._getValueByPath(rowData,schemaNode.dependsOnDataPath);
		}
		if (schemaNode.dependsOnCellPaths) {
			const values=schemaNode.dependsOnCellPaths.map((path,index)=>this._getInstanceNodeValue(
				this._resolveDependeeInstance(instanceNode,path,schemaNode.dependsOnCellSources?.[index])));
			return values.length===1?values[0]:values;
		}
		return rowData[schemaNode.dataKey];
	}

	_resolveCellState(schemaNode,payload={}) {
		const disabledResult=typeof schemaNode.disabledIf==="function"?schemaNode.disabledIf(payload):false;
		const isDisabled=schemaNode.disabled===true||disabledResult===true||disabledResult?.disabled===true;
		if (isDisabled)
			return {kind:"disabled",selectable:false,activatable:false,mutable:false,activation:"none",
				message:disabledResult?.message};

		const isAction=schemaNode.type==="expand"||schemaNode.type==="select"||schemaNode.type==="group"
			||schemaNode.type==="reorder"||schemaNode.input?.type==="button"||(!schemaNode.input&&!!schemaNode.onEnter);
		if (isAction)
			return {kind:"action",selectable:true,activatable:true,mutable:false,activation:"action"};

		let editableResult=true;
		if (typeof schemaNode.editableIf==="function")
			editableResult=schemaNode.editableIf(payload);
		const isReadOnly=schemaNode.readOnly===true||!schemaNode.input||editableResult===false
			||editableResult?.editable===false;
		if (isReadOnly) {
			// The lock indicator and activation behavior derive from the same canonical state. Text presentation is
			// available only as an explicit opt-in; an absent editor never implies activatability.
			const hasReadOnlyPresentation=schemaNode.readOnlyPresentation===true;
			return {kind:"readOnly",selectable:true,activatable:hasReadOnlyPresentation,mutable:false,
				activation:hasReadOnlyPresentation?"presentation":"none",message:editableResult?.message};
		}

		return {kind:"editable",selectable:true,activatable:true,mutable:true,activation:"editor"};
	}

	_setCellState(cellEl,state,instanceNode=null,schemaNode=instanceNode?.schemaNode) {
		if (!cellEl)
			return state;
		if (!schemaNode&&!instanceNode&&cellEl.parentElement?.parentElement===this._mainTbody)
			schemaNode=this._colSchemaNodes[cellEl.cellIndex];
		this._cellStates.set(cellEl,state);
		if (instanceNode)
			instanceNode.cellState=state;
		cellEl.classList.add("tablance-cell-state");
		cellEl.classList.toggle("read-only",state.kind==="readOnly");
		cellEl.classList.toggle("disabled",state.kind==="disabled");
		cellEl.classList.toggle("action-cell",state.kind==="action");
		cellEl.classList.toggle("action-indicator",this._showsActionIndicator(state,schemaNode));
		cellEl.dataset.cellState=state.kind;
		if (cellEl.matches("button,input,select,textarea"))
			cellEl.disabled=state.kind==="disabled";
		else if (instanceNode?.schemaNode.type==="group") {
			for (const control of cellEl.querySelectorAll("button:not(.tablance-help-trigger),input,select,textarea")) {
				const controlCell=control.closest(".tablance-cell-state");
				control.disabled=state.kind==="disabled"
					||this._getCellState(controlCell??control)?.kind==="disabled";
			}
		} else if (instanceNode?.schemaNode.type!=="group") {
			const button=cellEl.querySelector("button:not(.tablance-help-trigger)");
			if (button)
				button.disabled=state.kind==="disabled";
		}
		if (state.kind==="readOnly")
			cellEl.setAttribute("aria-readonly","true");
		else
			cellEl.removeAttribute("aria-readonly");
		if (state.kind==="disabled")
			cellEl.setAttribute("aria-disabled","true");
		else
			cellEl.removeAttribute("aria-disabled");
		if (instanceNode?.schemaNode.type==="group")
			this._syncGroupChevronVisibility(instanceNode);
		if (cellEl===this._selectedCell&&this._cellElementRepresentsLogicalCursor(cellEl,instanceNode)) {
			this._selectedCellState=state;
			this._cellCursor?.classList.toggle("read-only",state.kind==="readOnly");
			this._cellCursor?.classList.toggle("disabled",state.kind==="disabled");
			this._cellCursor?.classList.toggle("action-cell",state.kind==="action");
			this._cellCursor?.classList.toggle("action-indicator",this._showsActionIndicator(state,this._activeSchemaNode));
			if (!state.mutable&&this._inEditMode)
				this._exitEditMode(false);
			if (state.kind==="disabled") {
				this._exitReadOnlyMode(false);
				this._cellCursor.style.display="none";
			} else
				this._adjustCursorPosSize(cellEl);
		}
		return state;
	}

	_getCellState(cellEl,instanceNode=null) {
		if (!cellEl&&!instanceNode)
			return;
		return instanceNode?.cellState??this._cellStates.get(cellEl);
	}

	_getDisplayedCellText(cellEl=this._selectedCell) {
		// A field inside a group selects its containing <td>, which also contains the title. Presentation and copy
		// operations belong to the field value only; the title is structural UI and is never part of the field data.
		if (cellEl===this._selectedCell&&this._activeDetailsCell?.schemaNode.type==="field")
			cellEl=this._activeDetailsCell.el;
		return (cellEl?.innerText??"").trim();
	}


	_updateCell(schemaNode,el,selEl,scopedData,mainIndex,instanceNode=null) {
		const valueBundle=this._getCellValueBundle(schemaNode,scopedData,mainIndex,instanceNode);
		const statePayload=this._makeCallbackPayload(instanceNode,valueBundle,
			{schemaNode,mainIndex,rowData:scopedData});
		const cellState=this._resolveCellState(schemaNode,statePayload);
		if (!instanceNode)
			selEl.className="";
		else if (instanceNode.baseCss)
			(selEl??el).className=instanceNode.baseCss;
		if (schemaNode.input?.type==="button") {
			this._generateButton(schemaNode,mainIndex,el,scopedData,instanceNode);
		} else if (schemaNode.input?.type==="select"&&schemaNode.input.boolean&&!schemaNode.render) {
			const rawVal=scopedData[schemaNode.dataKey];
			const option=this._getSelectOptions(schemaNode.input,schemaNode,scopedData,mainIndex,instanceNode)
				.find(opt=>this._getSelectValue(opt)===this._getSelectValue(rawVal));
			this._renderBooleanSelectValue(el,this._getSelectValue(rawVal),option?.text);
		} else {
			let newCellContent;
			if (schemaNode.render||schemaNode.input?.type!="select") {
				if (schemaNode.render) {
					const payload=this._makeCallbackPayload(instanceNode,{...valueBundle,rowData: scopedData},{
						schemaNode,mainIndex,rowData: scopedData});
					newCellContent=schemaNode.render(payload);
				} else
					newCellContent=valueBundle.value;
			} else { //if (schemaNode.input?.type==="select") {
				const rawVal=scopedData[schemaNode.dataKey];
				if (typeof schemaNode.input?.options==="function") {
					console.warn("Performance notice:\n" +
						"This select field uses dynamic options but does not define render().\n\n" +
						"As a result, closed-cell rendering may regenerate the full options list, " +
						"which can be expensive in large tables.\n\n" +
						"Adding render() is recommended.\n" +
						"This warning can be suppressed by setting " +
						"`allowDynamicOptionsWithoutRender: true` on the input configuration.");
						console.log(schemaNode);
					newCellContent="";
				} else {
					const selOptObj=this._getSelectOptions(schemaNode.input,schemaNode,scopedData,mainIndex,instanceNode)
						.find(opt=>this._getSelectValue(opt)==this._getSelectValue(rawVal));
					newCellContent=selOptObj?.text??rawVal??"";
				}
			}
			if (schemaNode.html)
				el.innerHTML=newCellContent??"";
			else
				el.innerText=newCellContent??"";
		}
		if (instanceNode&&!instanceNode.schemaNode.baseCss)
			instanceNode.baseCss=(selEl??el).className;
		this._setCellState(selEl??el,cellState,instanceNode,schemaNode);
		if (schemaNode.cssClass) {
			let cssAddition;
			if (typeof schemaNode.cssClass==="function") {
				cssAddition=schemaNode.cssClass(
					this._makeCallbackPayload(instanceNode,valueBundle
						??this._getCellValueBundle(schemaNode,scopedData,mainIndex,instanceNode),
						{schemaNode:schemaNode,rowData: scopedData,mainIndex}));
			} else 
				cssAddition=schemaNode.cssClass;
			if (cssAddition)//guard against undefined/null in case function returns that
				(selEl??el).classList.add(...(Array.isArray(cssAddition)?cssAddition:cssAddition.split(" ")));
		}
		return cellState;
	}

	/**Updates the html-element of a main-table-cell
	 * @param {*} cellEl 
	 * @param {*} colSchemaNode */
	_updateMainRowCell(cellEl,colSchemaNode) {
		cellEl.firstChild.innerHTML="";
		const mainIndex=cellEl.closest(".main-table>tbody>tr").dataset.dataRowIndex;
		this._updateCell(colSchemaNode,cellEl.firstChild,cellEl,this._filteredData[mainIndex],mainIndex);
	}

	_highlightRowIndex(index) {
		const tr=this._mainTbody.querySelector(`[data-data-row-index="${index}"]`);
		if (tr)
			this._highlightElements(tr.children);
		else
			this._highlightRowsOnView[index]=true;
	}

	_highlightElements(elements) {
		const origColors=[];
		for (const el of elements) {
			origColors.push(window.getComputedStyle(el).backgroundColor);
			el.style.transition = "none";
			el.style.backgroundColor="blue";
		}
		setTimeout(()=>{
			for (const el of elements) {
				el.style.transition="background-color 1s linear";
				el.style.backgroundColor=origColors.shift();
			}
		});
	}

	_scrollToCursor(){}//default is to do nothing. Tablance (main) overrides this.
	_applyVisibleIf(){}//default is to do nothing. Tablance (main) overrides this.
}

// Test-only XMLHttpRequest stub to simulate slow uploads in a single spot.
class FakeXMLHttpRequest {
	constructor({totalBytes,rate=1,startAt=0}) {
		this.totalBytes=totalBytes||1;
		const parsedRate=parseFloat(rate);
		this.pctPerSecond=Math.max(0.0001,isNaN(parsedRate)?1:parsedRate);//avoid hangs at 0
		const parsedStart=parseFloat(startAt);
		const startPercent=isNaN(parsedStart)?0:parsedStart;
		this.startPercent=Math.max(0,Math.min(100,startPercent));
		this._listeners=Object.create(null);
		this._uploadListeners=Object.create(null);
		this.upload={addEventListener:(type,fn)=>this._addListener(this._uploadListeners,type,fn)};
	}

	_addListener(target,type,fn) {
		(target[type]??=[]).push(fn);
	}

	addEventListener(type,fn) { this._addListener(this._listeners,type,fn); }
	open() {}
	setRequestHeader() {}
	abort() { this._clearTimer(); }

	send() {
		let loaded=this.totalBytes*this.startPercent/100;
		this._emit(this._uploadListeners.progress,{loaded,total:this.totalBytes});
		if (loaded>=this.totalBytes) {
			Promise.resolve().then(()=>this._emit(this._listeners.load,{}));
			return;
		}
		this._timer=setInterval(()=>{
			loaded=Math.min(this.totalBytes,loaded+this.totalBytes*this.pctPerSecond/100);
			this._emit(this._uploadListeners.progress,{loaded,total:this.totalBytes});
			if (loaded>=this.totalBytes) {
				this._clearTimer();
				this._emit(this._listeners.load,{});
			}
		},1000);
	}

	_emit(listeners,event) {
		if (!listeners)
			return;
		for (const fn of listeners)
			fn(event);
	}

	_clearTimer() {
		if (this._timer) {
			clearInterval(this._timer);
			this._timer=null;
		}
	}
}

/**
 * Secondary Tablance used for the bulk-edit area.
 * Reflects and updates selected rows in the main Tablance instance.
 */
class TablanceBulk extends TablanceBase {
	/** @type {Tablance} main tablance owning this bulk instance */
	mainInstance;
	_dropdownAlignmentContainer=this.rootEl;
	constructor() {
		super(...arguments);
		this._resetDataState();
	}

	_resolveCellState(schemaNode,payload={}) {
		const sourceSchemaNode=schemaNode.originalSchemaNode;
		const selectedRows=this.mainInstance?._selectedRows;
		if (!sourceSchemaNode||!selectedRows?.length)
			return super._resolveCellState(schemaNode,payload);
		const states=selectedRows.map(rowData=>{
			const mainIndex=this.mainInstance._filteredData.indexOf(rowData);
			const valueBundle=this.mainInstance._getCellValueBundle(sourceSchemaNode,rowData,mainIndex,null);
			const sourcePayload=this.mainInstance._makeCallbackPayload(null,valueBundle,
				{schemaNode:sourceSchemaNode,mainIndex,rowData,bulkEdit:true});
			return this.mainInstance._resolveCellState(sourceSchemaNode,sourcePayload);
		});
		return states.find(state=>state.kind==="disabled")
			??states.find(state=>state.kind==="readOnly")
			??states.find(state=>state.kind==="action")
			??states[0];
	}

	_selectedSourceRowsAreMutable() {
		const sourceSchemaNode=this._activeSchemaNode.originalSchemaNode??this._activeSchemaNode;
		return this.mainInstance._selectedRows.every(rowData=>{
			const mainIndex=this.mainInstance._filteredData.indexOf(rowData);
			const valueBundle=this.mainInstance._getCellValueBundle(sourceSchemaNode,rowData,mainIndex,null);
			const payload=this.mainInstance._makeCallbackPayload(null,valueBundle,
				{schemaNode:sourceSchemaNode,mainIndex,rowData,bulkEdit:true});
			return this.mainInstance._resolveCellState(sourceSchemaNode,payload).mutable;
		});
	}

	_doEditSave() {
		if (!this._selectedCellState?.mutable||!this._selectedSourceRowsAreMutable())
			return false;
		const sourceSchemaNode=this._activeSchemaNode.originalSchemaNode??this._activeSchemaNode;
		const inputVal=this._activeSchemaNode.input.type==="select"?this._getSelectValue(this._inputVal):this._inputVal;
		const commitKey=this.mainInstance._getCommitChangeKey(sourceSchemaNode);
		const commitVal=this.mainInstance._normalizeCommitValue(sourceSchemaNode,inputVal);
		this._cellCursorDataObj[this._activeSchemaNode.dataKey]=inputVal;
		for (const selectedRow of this.mainInstance._selectedRows) {
			selectedRow[this._activeSchemaNode.dataKey]=inputVal;
			const mainIndex=this.mainInstance._filteredData.indexOf(selectedRow);
			if (mainIndex!==-1) {
				const changes=commitKey?{[commitKey]:commitVal}:{};
				const rowIsNew=this.mainInstance._rowMeta.get(selectedRow)?.isNew??false;
				const mode=rowIsNew?"create":"update";
				const normalizedChanges=mode==="create"?null:changes;
				const payload=this.mainInstance._makeCallbackPayload(null,{
					data: selectedRow,
					changes: normalizedChanges,
					mode
				},{
					schemaNode: sourceSchemaNode,
					rowData: selectedRow,
					mainIndex,
					bulkEdit: true
				});
				this.mainInstance._queueDataCommit(payload,null);
			}
		}
		for (const selectedTr of this.mainInstance._mainTbody.querySelectorAll("tr.selected"))
			this.mainInstance.updateData(selectedTr.dataset.dataRowIndex,this._activeSchemaNode.dataKey,inputVal,false,true);
		this._updateDetailsCell(this._activeDetailsCell,this._cellCursorDataObj);
		this._selectedCellVal=inputVal;
	}
}

/**
 * Primary Tablance component representing the main interactive table.
 * Handles full data display, user interaction, editing, details, and rendering.
 */
export default class Tablance extends TablanceBase {
	static version=TABLANCE_VERSION;
	static build=TABLANCE_BUILD;
	static get defaultLang() {
		return defaultLangOverrides;
	}
	static set defaultLang(lang) {
		defaultLangOverrides=lang??Object.create(null);
	}

	constructor() {
		super(...arguments);
		this._dropdownAlignmentContainer=this._onlyDetails?this.rootEl:this._scrollBody;
		this._collectFilterSchemaCaches(this._schema);
	}
	
		_doEditSave() {
			if (!this._selectedCellState?.mutable)
				return false;
			let doUpdate=true;//if false then the data will not actually change in either dataObject or the html
			const inputVal=this._activeSchemaNode.input.type==="select"
				?this._getSelectValue(this._inputVal):this._inputVal;
			const openGroup=this._getOpenGroupAncestor(this._activeDetailsCell);
			const isRepeatedCreate=this._activeDetailsCell?.creating
				&&this._activeDetailsCell.parent?.schemaNode?.type==="repeated";
			const mainIndex=this._mainRowIndex;
			const rowData=Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:null;
			const mainRow=!openGroup?rowData:null;
			const prevVal=this._cellCursorDataObj[this._activeSchemaNode.dataKey];
			this._cellCursorDataObj[this._activeSchemaNode.dataKey]=inputVal;
			const commitKey=this._getCommitChangeKey(this._activeSchemaNode);
			const commitVal=this._normalizeCommitValue(this._activeSchemaNode,this._cellCursorDataObj[this._activeSchemaNode.dataKey]);
			const commitChanges=commitKey?{[commitKey]:commitVal}:{};
			const rowIsNew=mainRow?this._rowMeta.get(mainRow)?.isNew:false;
			if (isRepeatedCreate)
				this._ensureRepeatedEntryInsertion(this._activeDetailsCell);
			const mode=rowIsNew||isRepeatedCreate?"create":"update";

			this._activeSchemaNode.input.onChange?.(this._makeCallbackPayload(this._activeDetailsCell,{
				newValue: inputVal,oldValue: this._selectedCellVal,cancelUpdate: () => doUpdate=false
			},{schemaNode: this._activeSchemaNode,mainIndex,rowData}));

		if (doUpdate) {
				if (this._activeDetailsCell){
					
					//so if discarding group-changes (ctrl+esc) only repaints touched nodes
					if (openGroup)
						this._markDirtyField(this._activeDetailsCell);

				const doHeightUpdate=this._updateDetailsCell(this._activeDetailsCell,this._cellCursorDataObj);
				if (doHeightUpdate&&!this._onlyDetails)
					this._updateDetailsHeight(this._selectedCell.closest("tr.details"));
				for (let cell=this._activeDetailsCell.parent; cell; cell=cell.parent)
					if (cell.schemaNode.closedRender)//found a group with a closed-group-render func
						cell.updateRenderOnClose=true;//update closed-group-render
			} else {
				this._updateMainRowCell(this._selectedCell,this._activeSchemaNode);
				this._unsortCol(this._activeSchemaNode.dataKey);
			}
			if (this._selectedRows.indexOf(this._cellCursorDataObj)!=-1)//if edited row is checked/selected
			this._updateBulkEditAreaCells([this._activeSchemaNode]);
			this._updateDependentCells(this._activeSchemaNode,this._activeDetailsCell);
			this._selectedCellVal=inputVal;
				if (!openGroup) {
					const normalizedChanges=mode==="create"?null:commitChanges;
					const payload=this._makeCallbackPayload(this._activeDetailsCell,{
						data: this._cellCursorDataObj,
						changes: normalizedChanges,
						mode
					},{
						schemaNode: this._activeSchemaNode,
						rowData,
						mainIndex,
						instanceNode: this._activeDetailsCell
					});
					this._queueDataCommit(payload,this._activeDetailsCell);
				}
				if (isRepeatedCreate)
					this._activeDetailsCell.creating=false;
			} else {
				// Revert data if change was cancelled.
				this._cellCursorDataObj[this._activeSchemaNode.dataKey]=prevVal;
				this._inputVal=this._selectedCellVal;
		}
	}

	_scrollToCursor() {
		if (this._onlyDetails)
			return this._cellCursor.scrollIntoView({block: "center"});
		if (this._naturalAutoHeight)
			return this._selectedCell?.scrollIntoView({block:"nearest",inline:"nearest"});
		const distanceRatioDeadzone=.5;//when moving the cellcursor within this distance from center of view no 
										//scrolling will be done. 0.5 is half of view, 1 is entire height of view
		const distanceRatioCenteringTollerance=1;//if moving the cellcursor within this ratio, but outside of 
					//distanceRatioDeadzone then minimum scrolling will occur only to get within distanceRatioDeadzone
		const scrollPos=this._scrollBody.scrollTop;
		const scrollHeight=this._scrollBody.offsetHeight;
		const cursorY=parseInt(this._cellCursor.style.top);
		const cursorHeight=this._cellCursor.offsetHeight;
		const distanceFromCenter=cursorY+cursorHeight/2-scrollPos-scrollHeight/2;
		const distanceFromCenterRatio=Math.abs(distanceFromCenter/scrollHeight);
		if (distanceFromCenterRatio>distanceRatioDeadzone/2) {
			if (distanceFromCenterRatio>distanceRatioCenteringTollerance/2)
				this._scrollBody.scrollTop=cursorY-scrollHeight/2+this._rowHeight/2;
			else
				this._scrollBody.scrollTop=cursorY-scrollHeight/2+cursorHeight/2
								+(distanceFromCenter<0?1:-1)*scrollHeight*distanceRatioDeadzone/2;
		}
		//need to call this manually so that elements that are expected to exist after scroll are guaranteed to do so.
		//changing this._scrollBody.scrollTop actually calls this method anyway but not until all other code as hun.
		//This will cause it to run it twice but it's not a big deal.
		this._scrollMethod();
	}

	_expandRow(tr,animate=true) {
		const dataRowIndex=parseInt(tr.dataset.dataRowIndex);
		const rowData=this._filteredData[dataRowIndex];
		if (!rowData||!this._schema.details)
			return;
		const rowMeta=this._rowMeta.get(rowData)??(this._rowMeta.set(rowData,{}),this._rowMeta.get(rowData));
		if (rowMeta.h>0)
			return;
		const expRow=this._renderDetails(tr,dataRowIndex);
		const mainRowHeight=this._naturalAutoHeight?tr.offsetHeight+this._borderSpacingY:this._rowHeight;
		const expHeight=mainRowHeight+expRow.offsetHeight+this._borderSpacingY;
		rowMeta.h=expHeight;
		const contentDiv=expRow.querySelector(".content");
		if (!this._detailsBordersHeight)//see declarataion of _detailsTopBottomBorderWidth
			this._detailsBordersHeight=expHeight-contentDiv.offsetHeight;
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)//adjust scroll-height reflect change...
			+expHeight-mainRowHeight+"px";//...in height of the table
		this._updateAutoHeight();
		if (animate) {
			this._unsortCol(null,"expand");
			contentDiv.style.transition="";
			contentDiv.style.height="0px";//start at 0
			setTimeout(()=>contentDiv.style.height=expHeight-this._detailsBordersHeight+"px");
			this._animate(()=>this._adjustCursorPosSize(this._selectedCell,true),500,"cellCursor");
		} else {
			contentDiv.style.transition="none";
			contentDiv.style.height=expHeight-this._detailsBordersHeight+"px";
		}
		return expHeight;
	}

	_contractRow(tr) {
		if (tr.classList.contains("details"))
			tr=tr.previousSibling;
		const dataRowIndex=parseInt(tr.dataset.dataRowIndex);
		const hasOpenDetails=dataRowIndex==this._mainRowIndex&&this._activeDetailsCell;
		if (hasOpenDetails) {
			this._exitEditMode(false);//cancel out of edit-mode so field-validation doesn't cause problems
			const openGroup=this._getOpenGroupAncestor(this._activeDetailsCell);
			if (this._isUntouchedCreatingGroup(openGroup))
				this._discardActiveGroupEdits();//remove empty creator before contracting
		}
		const rowMeta=this._rowMeta.get(this._filteredData[dataRowIndex]);
		if (!this._schema.details||!rowMeta?.h)
			return;
		this._unsortCol(null,"expand");
		if (hasOpenDetails) {//if cell-cursor is inside the details
			this._selectMainTableCell(tr.cells[this._mainColIndex]);//then move it out
			if (this._activeDetailsCell)//closing group failed (validation), so keep details open
				return;
			this._scrollToCursor();
		}
		if (this._openDetailsPanes[dataRowIndex])
			this._openDetailsPanes[dataRowIndex].collapsing=true;
		const contentDiv=tr.nextSibling.querySelector(".content");
		if (contentDiv.style.height==="auto") {//if fully expanded
			contentDiv.style.height=rowMeta.h-this._detailsBordersHeight+"px";
			setTimeout(()=>contentDiv.style.height=0);
		} else if (parseInt(contentDiv.style.height)==0)//if previous closing-animation has reached 0 but transitionend 
		//hasn't been called yet which happens easily, for instance by selecting expand-button and holding space/enter
			contentDiv.dispatchEvent(new Event('transitionend'));
		else//if in the middle of animation, either expanding or contracting. make it head towards 0
			contentDiv.style.height=0;
		this._animate(()=>this._adjustCursorPosSize(this._selectedCell,true),500,"cellCursor");
	}

	_scrollElementIntoView(element) {
		if (this._naturalAutoHeight)
			return element.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
		if (!this._onlyDetails) {
			const pos=this._getElPos(element);
			this._scrollBody.scrollTop=pos.y+element.offsetHeight/2-this._scrollBody.offsetHeight/2;
			this._scrollMethod();
		} else
			this._tooltip.scrollIntoView({behavior:'smooth',block:"center"});
	}

	_applyVisibleIf(instanceNode,mainIndex) {
		const schemaNode=instanceNode.schemaNode;
		let val=this._getTargetVal(false,schemaNode,instanceNode);
		if (schemaNode.input?.type==="select"&&val?.value)
			val=val.value;
		const idValue=schemaNode.dataKey!=null?instanceNode.dataObj?.[schemaNode.dataKey]:undefined;
		const dependedValue=(schemaNode.dependsOnDataPath||schemaNode.dependsOnDataPaths
			||schemaNode.dependsOnCellPaths)?val:undefined;
		const payload=this._makeCallbackPayload(instanceNode,{value: val,idValue,dependedValue},{
			schemaNode,
			mainIndex,
			rowData: instanceNode.dataObj
		});

		instanceNode.hidden = !!instanceNode.hidden;

		//the !! is needed or else undefined will be treated the same as true
		if (!!schemaNode.visibleIf(payload) == instanceNode.hidden) {
			instanceNode.hidden=!instanceNode.hidden;
			instanceNode.outerContainerEl.style.display=instanceNode.hidden?"none":"";
			instanceNode.outerContainerEl.classList.toggle("tablance-hidden",instanceNode.hidden);
			if (instanceNode.parent?.schemaNode?.type==="grid"
				&&instanceNode.parent.children?.includes(instanceNode))
				this._refreshGridLayout(instanceNode.parent);
			else if (instanceNode.parent?.schemaNode?.type==="lineup"
				&&instanceNode.parent.children?.includes(instanceNode))
				this._refreshLineupRowExtensions(instanceNode.parent);
			else if (instanceNode.parent?.schemaNode?.type==="repeated"
				&&instanceNode.parent.children?.includes(instanceNode))
				this._arrangeRepeatedInstances(instanceNode.parent);
		}

		return !instanceNode.hidden;
	}
}
