
/** Symbol used to tag wrapper objects to avoid ever double-wrapping. Symbol used over string but not really needed. */
const SCHEMA_WRAPPER_MARKER=Symbol("schemaWrapper");

const TABLANCE_VERSION = typeof __TABLANCE_VERSION__!=="undefined"?__TABLANCE_VERSION__:"dev";
const TABLANCE_BUILD = typeof __TABLANCE_BUILD__!=="undefined"?__TABLANCE_BUILD__:"dev";

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
const REPEATED_INSTANCE_NODE_PROTOTYPE=Object.create(INSTANCE_NODE_PROTOTYPE);
REPEATED_INSTANCE_NODE_PROTOTYPE.createNewEntry=function(e,_groupObject) {
	e?.preventDefault?.();
	let repeatData=this.dataObj;
	if (!repeatData) {
		const parentDataObj=this.parent?.dataObj;
		repeatData=parentDataObj?.[this.schemaNode.dataKey]??(parentDataObj?parentDataObj[this.schemaNode.dataKey]=[]:[]);
		this.dataObj=repeatData;
	}
	this.tablance?._repeatInsert(this,true,repeatData[repeatData.length]={});
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
	deleteAreYouSure:"Are you sure?",
	deleteAreYouSureYes:"Yes",
	deleteAreYouSureNo:"No",
	datePlaceholder:"YYYY-MM-DD",
	selectNoResultsFound:"No results found",
	selectEmpty:"<None>",
	selectCreateOption:"Create [{text}]",
	insertEntry:"Insert new",
	insertRow:"Insert new",
	creationValidationFailed:"Invalid entry. Please check the fields and try again.",
	creationValidationFailedCancelInfo:"\n Select Delete to cancel.",
	fieldValidationFailedHint:"Press Esc to cancel.",
	groupValidationFailedHint:"Press Ctrl+Esc to discard changes and back out.",
});


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
	_sourceData=[];//complete dataset provided to the table; table never mutates this array and it reflects all rows provided
	_viewData=[];//rows belonging to the active viewMode, derived from _sourceData before any filtering/search
	_filteredData=[];//rows after applying search/filter pipeline to _viewData; rendering consumes this dataset
	_currentViewModeKey="default";//active viewMode key
	_viewDefinitions=Object.create(null);//lookup table of viewMode predicates keyed by view name
	_scrollRowIndex=0;//the index in the #data of the top row in the view
	_scrollBody;//resides directly inside #container and is the element with the scrollbar. It contains #scrollingDiv
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
	_rowInnerHeight=0;//this is the height that the div inside main-tds should be set to. It's calculated from 
					//#rowHeight minus top&bottom-padding minus #borderSpacingY of td. This is needed to make sure each
					//row is always of the same height and things don't get messed up because some row is heigher
					//because it has high content.
	_staticRowHeight;//This is set in the constructor. If it is true then all rows should be of same height which
					 //improves performance.
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
	_inEditMode;//whether the user is currently in edit-mode
	//and values are px as ints. This is used to offset the position and adjust position of #cellCursor in order to
	//center it around the cell. It is also used in conjunction with cellCursorOutlineWidth to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	_inputVal;//the current val of the input when in edit-mode. Will be read and commited if cell is exited correctly
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
	_rowFilterCache=new WeakMap();//per-row filter text cache keyed by row data objects
	_selectedRows=[];//array of the actual data-objects of rows that are currently selected/checked using the select-col
	_scrollY=0;//this keeps track of the "old" scrollTop of the table when a scroll occurs to know 
	_numRenderedRows=0;//number of tr-elements in the table excluding tr's that are details (details too are tr's)
	_openDetailsPanes={};//for any row that is expanded and also in view this will hold navigational data which
						//is read from when clicking or navigating using keyboard to know which cell is next, and
						//which elements even are selectable and so on. Keys are data-row-index. As soon as a row
						//is either contracted or scrolled out of view it is removed from here and then re-added
						//if expanded again or scrolled into view.
						//keys are rowDataindex and the values are instanceTrees rooted at an instance-node shaped as:
						//	el: HTMLElement the cell-element itself
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
	_highlightRowsOnView={};//Rows can be added to this object with rowindex in #data as key, value needs to be truthy.
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
	_dropdownAlignmentContainer;
	lang;//object holding strings used in the table for various purposes. See DEFAULT_LANG for default values					
	_rowMeta=new WeakMap();//tracks row metadata (isNew flags, expanded heights, etc.) keyed by row data objects


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
	 * 					- dependedValue: the resolved dependee value when dependsOn* is used
	 * 			html Bool Default is false. If true then the content of the cell will be rendered as html
	 * 			type String The default is "data". Possible values are:
	 * 				"data" - As it it implies, simply to display data but also input-elements such as fields or buttons
	 * 				"expand" - The column will be buttons used for expanding/contracting the rows. See param details
	 * 				"select" - The column will be checkboxes used to (un)select rows	
	 * 		}
	 * 			
	 * 	@param	{Boolean} staticRowHeight Set to true if all rows are of same height. With this option on, scrolling
	 * 				quickly through large tables will be more performant.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.
	 * 	@param	{Object} details This allows for having rows that can be expanded to show more data. An "entry"-object
	 * 			is expected and some of them can hold other entry-objects so that they can be nested.
	 * 			Properties that are valid for all types of entries:
	 * 				* title String displayed title if placed in a container which displays the title
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
	 * 				* dependsOn String Optional string identifying another entry that this entry depends on.
	 * 					Whenever the referenced entry is edited, this entry automatically refreshes.
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
  	 * 				type "field" this is what will display data and which also can be editable by specifying "input"
 	 * 				dataKey String the key of the property in the data that the row should display
	 * 				cssClass String Css-classes to be added to the field
	 * 				render Function Function that can be set to render the content of the cell. The return-value is what
	 * 					will be displayed in the cell. Similiarly to columns->render it gets passed the following:
	 * 					1: The value from data pointed to by "dataKey". If dataKey is not set but dependsOn is then this
	 * 						will instead get passed the value that the dataKey of the depended cell points to, 
	 * 					2: data-row, 
	 * 					3: schemaNode,
	 * 					4: main-index, 
	 * 					5: instanceNode
	 * 				input Object field is editable if this object is supplied and its "disabled"-prop is not true
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
	 * 						enabledIf Function Optional callback that decides if the cell is editable.
	 * 							Receives a payload from _makeCallbackPayload plus:
	 * 							- value: resolved cell value (dataKey wins when present, select uses option.value when 
	 * 																										available)
	 * 							- idValue: rowData[schemaNode.dataKey] (if dataKey is set)
	 * 							- dependedValue: the resolved dependee value when dependsOn* is used
	 * 							Return false (or {enabled:false, message:String}) to disable the field.
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
	 * 						openHandler Function callback-function for when the open-button is pressed. It gets the
	 * 							following arguments passed to it: 
	 * 							1: Event, 2: File-object, 3:schemaNode,4:rowData,5:mainIndex,
	 * 							6:instanceNode(if in details)
	 * 						deleteHandler Function callback-function for when the user deletes a file. It gets the 
	 * 							following arguments passed to it:
	 * 							1: Event, 2: File-object, 3:schemaNode,4:rowData,5:mainIndex,
	 * 							6:instanceNode(if in details)
	 * 					----Properties specific to input "select"----
	 * 						minOptsFilter Integer - The minimum number of options required for the filter-input to
	 * 							appear. Can also be set via param opts->defaultMinOptsFilter
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
	 * 						onClick Function A callback-function that will get called  when the button is pressed. 
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
	 * 				onCreate Function Callback fired when the user has created an entry via the interface available if
	 * 					"create" is true. It is considered committed when the cell-cursor has left the repeat-row after
	 * 					having created it. Receives a single object:
	 * 					- newDataItem: the newly created data object
	 * 					- dataKey: optional key for the repeated array (creation context)
	 * 					- dataArray: optional repeated array reference (creation context)
	 * 					- itemIndex: index of the new item within dataArray
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
	 * 				onDelete Function Callback fired when the user has deleted an entry via the interface available if
	 * 					"create" is true. Receives a payload object:
	 * 					- deletedDataItem: the deleted data object
	 * 					- dataKey: optional key for the repeated array (creation context)
	 * 					- dataArray: optional repeated array reference
	 * 					- itemIndex: index the deleted item had before removal
	 * 					- repeatedSchemaNode: the repeated container schema node
	 * 					- entrySchemaNode: the schema node for the deleted entry (often a group)
	 * 					- deletedInstanceNode: the instance node for the deleted entry
	 * 					- mainIndex: index of the root row
	 * 					- bulkEdit: true if triggered from bulk-edit
	 * 					- closestMeta: function(key) to read meta data closest to the schema node
	 * 				sortCompare Function Passing in a function allows for sorting the entries. As expected this
	 * 					function will get called multiple times to compare the entries to one another.
	 * 					It gets 4 arguments: 1: object A, 2: object B, 3: rowData, 4: instanceNode
	 * 					Return >0 to sort A after B, <0 to sort B after A, or ===0 to keep original order of A and B
	 * 				creationText String Used if "create" is true. the text of the creation-cell. Default is "Insert new"
	 * 					May also be set via opts->lang->insertEntry
	 * 				deleteText String used if "create" is true. the text of the deletion-button. Default is "Delete"
	 * 					can also be set via param opts->lang->delete
	 * 				deleteAreYouSureText String Used if "create" is true. Text above yes/no-btns.
	 * 					Default is "Are you sure?". Can also be set via param opts->lang->deleteAreYouSure
	 * 				areYouSureYesText String Used if "create" is true. Text of confirm-button for delete.
	 * 					Default is "Yes". Can also be set via param opts->lang->deleteAreYouSureYes
	 * 				areYouSureNoText String Used if "create" is true. Text of cancel-button for delete. Default is "No"
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
	 * */
constructor(hostEl,schema,staticRowHeight=false,spreadsheet=false,opts=null){
		this.lang=Object.assign(Object.create(null),DEFAULT_LANG,opts?.lang??{});
		this.hostEl=hostEl;
		const rootEl=this.rootEl = document.createElement("div");
		this.hostEl.appendChild(this.rootEl);
		this._spreadsheet=spreadsheet;
		this._staticRowHeight=staticRowHeight;
		this._opts=opts??{};
		rootEl.classList.add("tablance");
		this._schema=this._buildSchemaFacade(schema);
		this._viewDefinitions=this._buildViewDefinitions(schema?.views);
		this._currentViewModeKey="default";
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
			this._createTableHeader();
			this._createTableBody();
			(new ResizeObserver(this._updateSizesOfViewportAndCols.bind(this))).observe(hostEl);
			this._setupSpreadsheet(false);
			

			if (this._opts.sortAscHtml==null)
				this._opts.sortAscHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#000" points="4,10,0,6,8,6"/></svg>';
			if (this._opts.sortDescHtml==null)
				this._opts.sortDescHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#000" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
			if (this._opts.sortNoneHtml==null)
				this._opts.sortNoneHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
			this._updateHeaderSortHtml();
			this._buildDependencyGraph(this._schema);
			this._createBulkEditArea(schema);//send in the raw schema for this one
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
					views[key]={filter: filterFn};
			}
		if (!("default" in views))
			views.default={filter:()=>true};
		return views;
	}

	_rebuildViewData() {
		const predicate=this._viewDefinitions?.[this._currentViewModeKey].filter;
		const nextView=[];
		for (let i=0;i<this._sourceData.length;i++) {
			const row=this._sourceData[i];
			if (predicate(row))
				nextView.push(row);
		}
		this._viewData=nextView;
	}

	/**Add data-rows to the main table.
	 * @param {object[]} data Rows to insert.
	 * @param {boolean} highlight If true, clear filter, highlight, and scroll to the first new row.
	 * @param {boolean} prepend If true, insert rows at the start of the dataset instead of the end. */
	addData(data, highlight=false, prepend=false) {
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
		const viewMatches = data.filter(this._viewDefinitions[this._currentViewModeKey].filter);
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
		this._applyFilters(this._filter);
	}

	/**Explicitly create and insert a new, uncommitted row. */
	insertNewRow(rowData={}, options) {
		const {highlight=true,prepend=true}=options??{};
		const newRow=rowData?structuredClone(rowData):Object.assign(Object.create(null),{});
		this._rowMeta.set(newRow,{isNew:true});
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
				if (i==dataPath.length-1) {//final array-index not specified. replace all of the data in repeated

					//remove all the current entries. Do it backwards so that the remaining entries doesn't have to
					//have their index&path updates each time
					const children=nodeToUpdate.children;
					for (let entryI=children.length-!!nodeToUpdate.schemaNode.create,entry; entry=children[--entryI];)
						this._deleteCell(entry,true);

					//insert all the new data
					nodeToUpdate.dataObj=nodeToUpdate.parent.dataObj[nodeToUpdate.schemaNode.dataKey];
					nodeToUpdate.dataObj.forEach(
									dataEntry=>updatedEls.push(this._repeatInsert(nodeToUpdate,false,dataEntry)));
					break;
				} else if (arrayIndex) {//index pointing at existing repeated-child
					nodeToUpdate=nodeToUpdate.children[arrayIndex];
				} else {//[] - insert new
					updatedEls.push(this._repeatInsert(nodeToUpdate,false,nodeToUpdate.dataObj.at(-1)));
					break;
				}
			}
		}

		if (nodeToUpdate.schemaNode.type=="field")
			this._updateDetailsCell(nodeToUpdate,dataRow);
		if (scrollTo) {
			nodeToUpdate.el.scrollIntoView({behavior:'smooth',block:"center"});
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
		for (const col of schemaRoot.main.columns)
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
		const dependedValue=(schemaNode.dependsOnDataPath||schemaNode.dependsOnCellPaths)
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
			let elA=a.container, elB=b.container;
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
				this._selectDetailsCell(targetNode);
				if (enterEditMode&&this._activeSchemaNode?.input)
					this._enterCell(new Event("enter",{cancelable:true}));
				return;
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
			this._selectMainTableCell(tr.cells[colIndex]);
			if (enterEditMode&&this._activeSchemaNode?.input)
				this._enterCell(new Event("enter",{cancelable:true}));
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
	 *  - dependsOnDataPath: absolute data path for non-exp→exp deps
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
						if (rev && rev.length)
							cellPaths.push(rev);
					} else {
						if (dependee._dataPath)
							dataPaths.push(dependee._dataPath);
						else if (dependee.dataKey != null || dependee.nodeId != null)
							console.warn("Dependee has no dataPath:", dependee);
					}
				}

				this._dep_finalizeDependency(schemaNode, cellPaths, dataPaths);
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
	_dep_finalizeDependency(schemaNode, cellPaths, dataPaths) {

		if (cellPaths.length) {
			schemaNode.dependsOnCellPaths = cellPaths;
			delete schemaNode.dependsOnDataPath;
			return;
		}

		if (dataPaths.length === 1) {
			schemaNode.dependsOnDataPath = dataPaths[0];
			delete schemaNode.dependsOnCellPaths;

			if (!schemaNode._dataPath)
				schemaNode._dataPath = dataPaths[0];

			return;
		}

		if (dataPaths.length > 1) {
			console.warn("Multiple data dependencies not supported:", schemaNode);

			schemaNode.dependsOnDataPath = dataPaths[0];
			delete schemaNode.dependsOnCellPaths;

			if (!schemaNode._dataPath)
				schemaNode._dataPath = dataPaths[0];
		}
	}





	_updateViewportHeight = () => {
		this._scrollBody.style.height = this.hostEl.clientHeight - this._headerTable.offsetHeight
		- (this._searchInput?.offsetHeight ?? 0) - this._bulkEditArea.offsetHeight + "px";
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
		if (!toolbarItems.length&&this._opts.searchbar==false)
			return;

		const bar=this.rootEl.appendChild(document.createElement("div"));
		bar.className="toolbar";

		const btnWrap=bar.appendChild(document.createElement("div"));
		btnWrap.className="toolbar-left";

		for (const schemaNode of toolbarItems)
			this._generateButton(schemaNode,null,btnWrap,null);

		if (this._opts.searchbar!=false) {
			this._searchInput=bar.appendChild(document.createElement("input"));
			this._searchInput.type="search";
			this._searchInput.className="search";
			this._searchInput.placeholder=this.lang.filterPlaceholder;
			this._searchInput.addEventListener("input",e=>this._onSearchInput(e));
		}
	}

	_onSearchInput(_e) {
		this._applyFilters(this._searchInput.value);
	}

	_setupSpreadsheet(onlyDetails) {
		this.rootEl.classList.add("spreadsheet");
		this._cellCursor=document.createElement("div");
		this._cellCursor.className="cell-cursor";
		this._cellCursor.style.display="none";
		if (!onlyDetails) {
			//remove any border-spacing beacuse if spacing is clicked the target-element will be the table itself and
			//no cell will be selected which is bad user experience. Set it to 0 for headerTable too in order to match
			this._mainTable.style.borderSpacing=this._headerTable.style.borderSpacing=this._borderSpacingY=0;
		}
		this.rootEl.addEventListener("focus",e=>this._spreadsheetOnFocus(e));
		this.rootEl.addEventListener("blur",e=>this._spreadsheetOnBlur(e));
		this.rootEl.tabIndex=0;//so that the table can be tabbed to
		this.rootEl.addEventListener("keydown",e=>this._spreadsheetKeyDown(e));
		this.rootEl.addEventListener("mousedown",e=>this._spreadsheetMouseDown(e));
		this._cellCursor.addEventListener("dblclick",e=>this._enterCell(e));

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
		if (!this._onlyDetails&&this._highlightOnFocus)
			this.rootEl.style.removeProperty("outline");
		else
			this.rootEl.style.outline="none";
		
		//why is this needed? it messes things up when cellcursor is in mainpage of bulk-edit-area but hidden because
		//other page is open, and the tablance gets focus because then it will be visible through the active page
		//this._cellCursor.style.display="block";
		
		if (tabbedTo&&(this._mainRowIndex!=null||this._mainColIndex!=null))
			this._scrollToCursor();
	}

	_spreadsheetOnBlur(_e) {
		setTimeout(()=>{
			if (!this.rootEl.contains(document.activeElement)||this._bulkEditArea?.contains(document.activeElement)) {
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
		if (!this._onlyDetails)
			this._scrollToCursor();//need this first to make sure adjacent cell is even rendered

		if (this._activeDetailsCell?.parent?.schemaNode.type==="lineup")
			this._moveInsideLineup(hSign,vSign);
		else if (vSign) {//moving up or down
			let newColIndex=this._mainColIndex;
			if (this._activeDetailsCell) {//moving from inside details.might move to another cell inside,or outside
					this._selectAdjacentDetailsCell(this._activeDetailsCell,vSign==1);
			} else if (vSign===1&&this._rowMeta.get(this._filteredData[this._mainRowIndex])?.h){//moving down into details
				this._selectFirstSelectableDetailsCell(this._openDetailsPanes[this._mainRowIndex],true);
			} else if (vSign===-1&&this._rowMeta.get(this._filteredData[this._mainRowIndex-1])?.h){//moving up into details
				this._selectFirstSelectableDetailsCell(this._openDetailsPanes[this._mainRowIndex-1],false);
			} else {//moving from and to maintable-cells
				this._selectMainTableCell(
					this._selectedCell.parentElement[(vSign>0?"next":"previous")+"Sibling"]?.cells[newColIndex]);
			}
		} else if (!this._activeDetailsCell)
			this._selectMainTableCell(this._selectedCell[(hSign>0?"next":"previous")+"Sibling"]);
		if (this._onlyDetails&&this._mainRowIndex!=null)
			this._scrollToCursor();
	}

	_moveInsideLineup(numCols,numRows) {
		const currentCellX=this._activeDetailsCell.el.offsetLeft;
		const currCelTop=this._activeDetailsCell.el.offsetTop;
		const currCelBottom=currCelTop+this._activeDetailsCell.el.offsetHeight;
		if (numCols) {//moving left or right
			for (let i=this._activeDetailsCell.index,nextCel;nextCel=this._activeDetailsCell.parent.children[i+=numCols];) {
				if (nextCel.el.offsetParent != null && (nextCel?.el.offsetLeft>currentCellX)==(numCols>0)) {
					if (currCelBottom>nextCel.el.offsetTop&&nextCel.el.offsetTop+nextCel.el.offsetHeight>currCelTop)
						this._selectDetailsCell(nextCel);
					break;
				}
			}
		} else {//moving up or down
			let closestCell,closestCellX;
			const siblings=this._activeDetailsCell.parent.children;
			for (let i=this._activeDetailsCell.index,otherCell;otherCell=siblings[i+=numRows];) {
				const skipCell=Math.max(otherCell.el.offsetTop,currCelTop) <= 					 //cell is on the
								Math.min(otherCell.el.offsetTop+otherCell.el.offsetHeight,currCelBottom)//same line
								||otherCell.el.offsetParent == null;//cell is hidden
				if (skipCell)
					continue;
				else if (closestCell&&(otherCell.el.offsetLeft<closestCellX)===(numRows>0))//scrolled past whole row
					break;
				if (!closestCell||Math.abs(otherCell.el.offsetLeft-currentCellX)<Math.abs(closestCellX-currentCellX)) {
					closestCell=otherCell;
					closestCellX=closestCell.el.offsetLeft;
				} else//if further away than current closest one.
					break;
			}
			if (closestCell)
				this._selectDetailsCell(closestCell);
			else
				this._selectAdjacentDetailsCell(this._activeDetailsCell.parent,numRows==1?true:false);
		}
	}

	_selectAdjacentDetailsCell(instanceNode,isGoingDown) {
		let cell=this._getAdjacentDetailsCell(instanceNode,isGoingDown);//repeat this line until valid cell is found?
		if (cell)
			return this._selectDetailsCell(cell);
		if (!this._onlyDetails)
			this._selectMainTableCell(this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+isGoingDown}"]`)?.cells[this._mainColIndex]);
		else {
			const nextTable=this.neighbourTables?.[isGoingDown?"down":"up"];
			if (nextTable) {
				this._mainColIndex=this._mainRowIndex=this._activeDetailsCell=null;
				nextTable.container.style.outline=this._cellCursor.style.display="none";
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
			if (sibling.el)
				return sibling;
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
		this._selectMainTableCell(this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+(isGoingDown||-1)}"]`)?.cells[this._mainColIndex]);
	}

	/**Given an instanceNode, like the details of a row or any of its sub-containers, it will return the first
	 * selectable cell from top or bottom
	 * @param {*} instanceNode
	 * @param {Boolean} isGoingDown 
	 * @param {Boolean} onlyGetChild if set to true then it will never return the passed in instanceNode and instead
	 *			only look at its (grand)children. Used for groups where both itself and its children can be selected*/
	_getFirstSelectableDetailsCell(instanceNode,isGoingDown,onlyGetChild=false) {
		if (!onlyGetChild&&instanceNode.el)
			return instanceNode;
		const children=instanceNode.children;
		let startI=isGoingDown?0:children.length-1;
		if (instanceNode.schemaNode.type==="lineup"&&!isGoingDown) {
			let chosenCell;
			for (let i=startI,otherCell;otherCell=children[i--];)
				if (otherCell.el.offsetParent)
					if (!chosenCell||otherCell.el.offsetLeft<chosenCell.el.offsetLeft)
						chosenCell=otherCell;
					else
						break;
			startI=chosenCell.index;
		}
		for (let childI=startI;childI>=0&&childI<children.length; childI+=isGoingDown||-1)
			if (!children[childI].hidden&&(children[childI].children||children[childI].select))
				 return this._getFirstSelectableDetailsCell(children[childI],isGoingDown);
	}
	
	_spreadsheetKeyDown(e) {
		//prevent this from running in outer Tablance if an inner Tablance-instance is selected
		if (this._bulkEditArea?.contains(document.activeElement))
			return;
		if (this._searchInput && document.activeElement === this._searchInput) {
			// Block navigation when the search bar is active; add keys here to passthrough in the future.
			const searchPassthroughKeys=[];
			if (!searchPassthroughKeys.includes(e.key))
				return;
		}
		this._tooltip.style.visibility="hidden";
		const keysThatEnterFromOutline=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape",
								"NumpadAdd","NumpadSubtract","Enter","NumpadEnter","Space"];

		if (!this._inEditMode&&this._mainRowIndex==null&&this._mainColIndex==null) {
			if (e.code==="Tab")
				return;

			// First navigation keystroke after focusing the table should select the top-left cell (or top details cell).
			if (keysThatEnterFromOutline.includes(e.code)&&this._filteredData.length) {
				if (this._onlyDetails)
					this.selectTopBottomCellOnlyDetails(true);
				else
					this._selectMainTableCell(this._mainTbody.rows[0].cells[0]);
			}
		}

		this._highlightOnFocus=false;
		this.rootEl.style.outline="none";//see #spreadsheetOnFocus

		if (this._inEditMode&&this._activeSchemaNode.input.type==="date") {
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

	_spreadsheetKeyDown_non_edit_mode(e) {
		const scrollKeys=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Escape",
							"NumpadAdd","NumpadSubtract","Enter","NumpadEnter"];
		if (scrollKeys.includes(e.code))
			this._scrollToCursor();
		switch (e.code) {
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
			if (instanceNode.schemaNode.type==="group")
				return this._selectDetailsCell(instanceNode);
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
			mainTr.classList.remove("expanded");
			this._tableSizer.style.height=parseInt(this._tableSizer.style.height)
				 -(rowMeta?.h??this._rowHeight)+this._rowHeight+"px";
			detailsTr.remove();
			if (rowMeta){delete rowMeta.h; if (!Object.keys(rowMeta).length) this._rowMeta.delete(rowData);}
			delete this._openDetailsPanes[dataRowIndex];
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
		let scopedRowData=rowData;
		if (schemaNode.dataPath) {
			const ctx=Array.isArray(schemaNode.dataPath)
				? schemaNode.dataPath
				: String(schemaNode.dataPath).split(".").filter(Boolean);
			let target=scopedRowData;
			for (const key of ctx) {
				if (!target[key]||typeof target[key]!="object") {
					target[key]={};
					notYetCreated=true;
				}
				target=target[key];
			}
			scopedRowData=target;
		}
		if (!path.length)
		instanceNode.rowIndex=mainIndex;
		instanceNode.path=[...path];
		instanceNode.dataObj=scopedRowData;
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
			case "list": return this._generateDetailsList(schemaNode,mainIndex,instanceNode,parentEl,path,scopedRowData,notYetCreated);
			case "field": return this._generateField(schemaNode,mainIndex,instanceNode,parentEl,path,scopedRowData);
			case "group": return this._generateDetailsGroup(schemaNode,mainIndex,instanceNode,parentEl,path,scopedRowData,notYetCreated);
			case "repeated": return this._generateDetailsRepeated(schemaNode,mainIndex,instanceNode,parentEl,path,scopedRowData,notYetCreated);
			case "lineup": return this._generateDetailsLineup(schemaNode,mainIndex,instanceNode,parentEl,path,scopedRowData,notYetCreated);
		}
	}

	_repeatedOnDelete=({instanceNode})=>{
		const entryNode=instanceNode.parent.parent;
		const repeatedContainer=entryNode.parent;
		const payload=this._makeCallbackPayload(entryNode,{
			deletedDataItem: entryNode.dataObj,
			itemIndex: entryNode.index,
			repeatedSchemaNode: repeatedContainer?.schemaNode,
			entrySchemaNode: entryNode.schemaNode,
			deletedInstanceNode: entryNode,
			dataArray: repeatedContainer?.dataObj,
			dataKey: repeatedContainer?.schemaNode?.dataKey
		},{
			mainIndex: entryNode.rowIndex,
			rowData: repeatedContainer?.parent?.dataObj
		});
		this._deleteCell(entryNode);
		repeatedContainer?.schemaNode.onDelete?.(payload);
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
		let repeatData=instanceNode.dataObj=rowData[repeatedSchemaNode.dataKey]
			??(rowData[repeatedSchemaNode.dataKey]=[]);
		instanceNode.insertionPoint=parentEl.appendChild(document.createComment("repeated-insert"));
		repeatedSchemaNode.create&&this._generateRepeatedCreator(instanceNode);
		repeatData?.forEach(repeatData=>this._repeatInsert(instanceNode,false,repeatData));
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
				if (buttonInstanceNode.el.offsetParent) {
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

	_schemaCopyWithDeleteButton(schemaNode,deleteHandler) {
		const deleteControls={type:"lineup",cssClass:"delete-controls"
			,onBlur:cel=>cel.selEl.querySelector(".lineup").classList.remove("delete-confirming")
			,entries:[{type:"field",input:{type:"button",
				text:schemaNode.deleteText??this.lang.delete
				,onClick:this._beginDeleteRepeated.bind(this)},cssClass:"delete"},
			{type:"field",input:{type:"button"
				,text:schemaNode.areYouSureNoText??this.lang.deleteAreYouSureNo
				,onClick:this._cancelDelete.bind(this)},cssClass:"no"
				,title:schemaNode.deleteAreYouSureText??this.lang.deleteAreYouSure},
			{type:"field",input:{type:"button"
				,text:schemaNode.areYouSureYesText??this.lang.deleteAreYouSureYes
				,onClick:deleteHandler},cssClass:"yes"}]};
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
		for (const key of ["dependencyPaths","dependsOnCellPaths","dependsOnDataPath"])
			if (sourceNode?.[key]!==undefined)
				targetNode[key]=copyMeta(sourceNode[key]);
		const sourceChildren=this._dep_children(sourceNode);
		const targetChildren=this._dep_children(targetNode);
		for (let i=0;i<sourceChildren.length&&i<targetChildren.length;i++)
			this._cloneDependencyMetadata(sourceChildren[i],targetChildren[i]);
	}

		_generateButton(schemaNode,mainIndex,parentEl,rowData,instanceNode=null) {
			const btn=parentEl.appendChild(document.createElement("button"));
			btn.tabIndex="-1";//so it can't be tabbed to
			btn.innerHTML=schemaNode.input.text;
			btn.addEventListener("click",e=>{
				const payload=this._makeCallbackPayload(instanceNode,{event:e},{
					schemaNode,
					mainIndex
				});
				schemaNode.input.onClick?.(payload);
			});

			//prevent gaining focus upon clicking it whhich would cause problems. It should be "focused" by having the
			//cellcursor on its cell which triggers it with enter-key anyway
			btn.addEventListener("mousedown",e=>e.preventDefault());
			return true;
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
		instanceNode.el=groupTable;//so that the whole group-table can be selectedf
		this._generateDetailsCollection(groupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
		groupTable.className="details-group "+(groupSchemaNode.cssClass??"");
		if (notYetCreated)
			instanceNode.creating=true;
		else if (groupSchemaNode.closedRender)
			this._setClosedRender(instanceNode,groupSchemaNode.closedRender(rowData),path,tbody);
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
		instanceNode.containerEl.classList.add("lineup","collection",...lineupSchemaNode.cssClass?.split(" ")??[]);
		return this._generateDetailsCollection(lineupSchemaNode,mainIndex,instanceNode,parentEl,path,rowData);
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
				const repeatData=rowData[childSchemaNode.dataKey]??(rowData[childSchemaNode.dataKey]=[]);
				const rptCelObj=collectionObj.children[entryI]=Object.assign(
					this._createInstanceNode(collectionObj,entryI,REPEATED_INSTANCE_NODE_PROTOTYPE),
					{children:[],schemaNode:childSchemaNode,dataObj:repeatData,path:[...path,entryI]}
				);
				// Capture parentData at creation time so persistence never walks ancestors later.
				const ownerData=collectionObj.dataObj;
				rptCelObj.parentData=ownerData&&typeof ownerData==="object"&&!Array.isArray(ownerData)?ownerData:null;
				rptCelObj.dataArray=Array.isArray(repeatData)?repeatData:undefined;
				rptCelObj.insertionPoint=collectionObj.containerEl.appendChild(document.createComment("repeat-insert"));
				childSchemaNode.create&&this._generateRepeatedCreator(rptCelObj);
				repeatData?.forEach(repeatData=>this._repeatInsert(rptCelObj,false,repeatData));
			} else
				this._generateCollectionItem(childSchemaNode,mainIndex,collectionObj,path,rowData);
		}
		return true;
	}

	/**
	 * Build correct DOM structure for a collection item depending on collection type.
	 * Returns both outermost element (outerContainerEl) and the inner element (containerEl)
	 * where the content will be placed.
	 * 
	 * Also sets special properties on itemObj for group items.
	 */
	_buildCollectionItemDOM(schemaNode,collection,itemObj,title) {
		let outerContainerEl,containerEl;
		const type=collection.schemaNode.type;

		// LIST: Each item is a <tr> with title cell optionally + value cell
		if (type=="list") {
			outerContainerEl=document.createElement("tr");
			if (collection.schemaNode.titlesColWidth!=false) {
				const td=outerContainerEl.insertCell();
				td.className="title";
				td.innerText=schemaNode.title??"";
			}
			containerEl=outerContainerEl.insertCell();
		} else if (type=="lineup") {// LINEUP: Items rendered inline, outerContainerEl wraps title + inner content
			outerContainerEl=document.createElement("span");
			if (title)
				outerContainerEl.appendChild(title);
			containerEl=itemObj.selEl=outerContainerEl.appendChild(document.createElement("div"));
		} else if (type=="group") {//GROUP: More complex <tr> with special rules for empty/hiding and more
			outerContainerEl=document.createElement("tr");
			outerContainerEl.className="empty";	// Will be hidden while group is closed until content becomes non-empty

			const td=outerContainerEl.insertCell();
			td.classList.toggle("disabled",schemaNode.type=="field"&&!schemaNode.input&&!schemaNode.onEnter);

			// Add separator for non-group members
			if (schemaNode.type!="group")
				td.appendChild(document.createElement("hr")).className="separator";

			if (title)
				td.appendChild(title);

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

		// Optional title element
		let title;
		if (schemaNode.title) {
			title=document.createElement("span");
			title.className="title";
			title.innerHTML=schemaNode.title;
		}

		// Build DOM structure for this item
		const {outerContainerEl,containerEl}=this._buildCollectionItemDOM(schemaNode,collection,itemObj,title);


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

	_generateField(fieldSchemaNode,mainIndex,instanceNode,parentEl,path,rowData) {
		instanceNode.el=parentEl;
		this._updateDetailsCell(instanceNode,rowData);
		instanceNode[instanceNode.selEl?"selEl":"el"].dataset.path=path.join("-");
		return true;
	}
	
	_spreadsheetMouseDown(e) {
		this._highlightOnFocus=false;//see decleration
		this.rootEl.style.outline="none";//see #spreadsheetOnFocus
		this._tooltip.style.visibility="hidden";
		if (Date.now()<this._ignoreClicksUntil)//see decleration of #ignoreClicksUntil
			return;
		if (e.which===3)//if right click
			return;
		const mainTr=e.target.closest(".main-table>tbody>tr");
		if (this._onlyDetails||mainTr?.classList.contains("details")) {//in details
			const interactiveEl=e.target.closest('[data-path]');
			if (!interactiveEl)
				return;
			let instanceNode=this._openDetailsPanes[mainTr?.dataset.dataRowIndex??0];
			for (let step of interactiveEl.dataset.path.split("-")) {
				instanceNode=instanceNode.children[step];
				if (instanceNode.schemaNode.type==="group"&&!instanceNode.el.classList.contains("open"))
					break;
			}
			this._selectDetailsCell(instanceNode);
		} else {//not in details
			const td=e.target.closest(".main-table>tbody>tr>td");
			if (td?.classList.contains("expand-col")||td?.classList.contains("select-col")) {
				if (e.shiftKey)
					e.preventDefault();//prevent text-selection when shift-clicking checkboxes
				if (this._mainRowIndex==null) {
					this._selectMainTableCell(td);
					this.rootEl.focus({preventScroll:true});
				}
				if (td.classList.contains("expand-col"))
					return this._toggleRowExpanded(td.parentElement);
				return this._rowCheckboxChange(td,e.shiftKey);
			}
			this._selectMainTableCell(td);
		}
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
		this._cellCursor.style.height=this._selectedCell.style.height=Math.min(maxHeight,e.target.scrollHeight+1)+"px";
		//now set height of textarea to 100% of cellcursor which height is set with above line. this line and the one
		//setting it to auto "could" be skipped but that will result in the textarea not shrinking when needed.
		e.target.style.height="100%";

		//need to call this to make the height of the details adjust and reflect the change in size of the textarea
		this._updateDetailsHeight(this._selectedCell.closest("tr.details"));
	}

	_updateDetailsHeight(detailsTr) {
		const contentDiv=detailsTr.querySelector(".content");
		const mainRowIndex=parseInt(detailsTr.dataset.dataRowIndex);
		const rowData=this._filteredData[mainRowIndex];
		if (!rowData) return;
		const rowMeta=this._rowMeta.get(rowData)??(this._rowMeta.set(rowData,{}),this._rowMeta.get(rowData));
		contentDiv.style.height="auto";//set to auto in case of in middle of animation, get correct height
		const prevRowHeight=rowMeta.h??this._rowHeight;
		const newRowHeight=this._rowHeight+detailsTr.offsetHeight+this._borderSpacingY;
		rowMeta.h=newRowHeight;
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)//adjust scroll-height reflect change...
			+newRowHeight-prevRowHeight+"px";//...in height of the table
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
		
		this._cellCursor.appendChild(input);
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
	_alignDropdown(dropdown,target=this._cellCursor,preferredVertical) {

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
			if (this._inEditMode||this._cellCursor.classList.contains("disabled"))
				return;
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
		if (this._activeSchemaNode.input) {
			e.preventDefault();//prevent text selection upon entering editmode
			if (this._activeSchemaNode.input.type==="button")
				return this._activeDetailsCell.el.click();
			this._inputVal=this._selectedCellVal;
			this._inEditMode=true;
			this._cellCursor.classList.add("edit-mode");
			({textarea:this._openTextAreaEdit,date:this._openDateEdit,select:this._openSelectEdit
				,file:this._openFileEdit}[this._activeSchemaNode.input.type]??this._openTextEdit).call(this,e);
		} else if (this._activeSchemaNode.type==="group") {
			this._openGroup(this._activeDetailsCell);
		}
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
		const {changed,changes}=this._collectGroupChanges(groupObject);
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
		const txn=this._queueCommitIntent(payload,{instanceNode,depth: depthOverride});
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
		const emitDataCommit=(payload,dataKey,dataArray)=>{
			if (!onDataCommit)
				return;
			const creationContext=payload.mode==="create"?{
				...(dataKey!==undefined?{dataKey}:{}),
				...(dataArray!==undefined?{dataArray}:{}),
			}:{};
			onDataCommit({...payload,changes: payload?.changes==null?null:{...(payload?.changes??{})},
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
				emitDataCommit(rowPayload);
				if (rowData)
					this._rowFilterCache?.delete(rowData);
				rowMeta.isNew=false;
				// If this payload is the row itself, skip it; child commits still emit after the row create.
				if (payload.data===rowData)
					continue;
			}
			emitDataCommit(payload,dataKey,dataArray);
			if (rowData)
				this._rowFilterCache?.delete(rowData);
		}
		for (const group of groupsTouched)
			delete group?._openSnapshot;
		txn.intents.length=0;
		this._editTransaction=null;
	}

	_closeGroup(groupObject,targetCell=null) {
		this._enterEditTransaction(groupObject);
		const {payload,closePayload,closeState}=this._buildGroupPayload(groupObject);
		const commitPayload={...payload};
		groupObject.schemaNode.onClose?.(closePayload);
		if (!closeState.doClose) {
			const tooltipMessage=[closeState.preventMessage,this.lang.groupValidationFailedHint].filter(Boolean).join("\n");
			this._showTooltip(tooltipMessage,groupObject.el,this._determinePreventPlacement(groupObject.el,targetCell));
			return false;
		}
		if (groupObject.creating&&!this._closeRepeatedInsertion(groupObject))
			return false;
		this._finalizeGroupClose(groupObject);
		// Buffer commit so outer groups can still cancel; flush once the outermost edit scope commits.
		this._bufferGroupCommit(groupObject,commitPayload);
		this._removeGroupFromTransaction(groupObject);
		if (!this._editTransaction?.stack.length)
			this._flushBufferedGroupCommits();
		return true;
	}

	_finalizeGroupClose(groupObject) {
		groupObject.el.classList.remove("open");
		this._ignoreClicksUntil=Date.now()+500;
		if (groupObject.updateRenderOnClose) {//if group is flagged for having its closed-render updated on close
			delete groupObject.updateRenderOnClose;//delete the flag so it doesn't get triggered again
			this._setClosedRender(groupObject,groupObject.schemaNode.closedRender(groupObject.dataObj));
		}
		delete groupObject._dirtyFields;
	}

	_setClosedRender(groupObject,renderText,path=groupObject.path,tbody=groupObject.el.tBodies?.[0]) {
		const renderRow=groupObject.el.querySelector("tbody>tr.group-render");
		if (renderText==null) {
			groupObject.el.classList.remove("closed-render");
			renderRow?.remove();
			return;
		}
		groupObject.el.classList.add("closed-render");
		const row=renderRow??tbody?.insertRow();
		if (!row)
			return;
		row.className="group-render";
		row.dataset.path=path?.join("-")??"";
		const cell=row.cells[0]??row.insertCell();
		cell.innerText=renderText;
	}

	_repeatInsert(repeated,creating,data,entrySchemaNode=null) {
		//normally entrySchemaNode should be the entry of repeated, 
		// but schemaNode can be supplied for creating creation-entries
		entrySchemaNode??=repeated.schemaNode.entry;

		let indexOfNew,rowIndex;
		if (!creating&&repeated.schemaNode.sortCompare&&!entrySchemaNode.creator) {
			for (indexOfNew=0;indexOfNew<repeated.children.length-!!repeated.schemaNode.create; indexOfNew++)
				if (repeated.schemaNode.sortCompare(data,repeated.children[indexOfNew].dataObj)<0)
					break;
		} else
			indexOfNew=repeated.children.length-(repeated.schemaNode.create&&!entrySchemaNode.creator)//pos be4 creator
		for (let root=repeated.parent; root.parent; root=root.parent,rowIndex=root.rowIndex);//get main-index
		let entryNode=entrySchemaNode;
		if (repeated.schemaNode.create&&entrySchemaNode.type==="group")
			entryNode=this._schemaCopyWithDeleteButton(entrySchemaNode,this._repeatedOnDelete);
			//make a wrapped copy of the entry so delete-controls can be appended without touching the original
		const newObj=this._generateCollectionItem(entryNode,rowIndex,repeated,repeated.path,data,indexOfNew,creating);
		if (creating) {
			newObj.creating=true;//creating means it hasn't been commited yet.
			this._selectFirstSelectableDetailsCell(newObj,true,true);
			repeated.schemaNode.onCreateOpen?.(repeated);
		}
		return newObj.el;
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

	_deleteCell(instanceNode,programatically=false) {
		let newSelectedCell;
		for (let i=instanceNode.index,otherCell; otherCell=instanceNode.parent.children[++i];)
			this._changeInstanceNodeIndex(otherCell,i-1)
		if (instanceNode.parent.children.length>=instanceNode.index+1)
			newSelectedCell=instanceNode.parent.children[instanceNode.index+1];
		else if (instanceNode.parent.children.length>1)
			newSelectedCell=instanceNode.parent.children[instanceNode.index-1];
		instanceNode.parent.children.splice(instanceNode.index,1);
		if (!programatically)
			instanceNode.parent.dataObj.splice(instanceNode.index,1);
		if (instanceNode.parent.schemaNode.type==="repeated"&&instanceNode.parent.parent.schemaNode.type==="list")
			instanceNode.el.parentElement.parentElement.remove();
		else
			instanceNode.el.parentElement.remove();
		this._activeDetailsCell=null;//causes problem otherwise when #selectDetailsCell checks old cell
		if (!programatically)
			this._selectDetailsCell(newSelectedCell??instanceNode.parent.parent);
		instanceNode.creating&&instanceNode.parent.schemaNode.onCreateCancel?.(instanceNode.parent);
	}

	_openTextEdit() {
		const input=this._cellCursor.appendChild(document.createElement("input"));

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
	
		const fileDiv = this._cellCursor.appendChild(document.createElement("div"));
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
	
		this._activeSchemaNode.input.fileUploadHandler?.(xhr,file,this._activeSchemaNode,this._cellCursorDataObj,
			this._mainRowIndex,this._activeDetailsCell);
	
		const formData = new FormData();
		formData.append("file", file);
		xhr.send(formData);
	
		this._exitEditMode(true);
		this._selectDetailsCell(this._activeDetailsCell);
	}
	

	_openTextAreaEdit() {
		const textarea=this._cellCursor.appendChild(document.createElement("textarea"));
		textarea.addEventListener('input', this._autoTextAreaResize.bind(this));

		{	const {paddingLeft,paddingRight,paddingTop,paddingBottom}=window.getComputedStyle(this._selectedCell);
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
			const ul=ctx.ulDiv.children[ctx.highlightUlIndex=ulIndex];
			const li=ul.children[ctx.highlightLiIndex=liIndex];
			if (!li)
				return;
			li.classList.add("highlighted");
			if (ulIndex&&keyboardNavigating)
				ul.scrollTop=li.offsetTop-ul.offsetTop+li.offsetHeight/2-ul.offsetHeight/2;
		}
	
		/**
		 * Filter loose options based on the current input value and update rendered lists and create-option state.
		 * @param {Object} ctx
		 */
		_handleSelectInputChange(ctx) {
			const value=ctx.input.value;
			const hadFilter=!!ctx.filterText;
			const filterChangedAtEdges=!value.includes(ctx.filterText)||!hadFilter;
			ctx.canCreate=!!value;
			if (filterChangedAtEdges)
				ctx.looseOpts.splice(0,Infinity,...ctx.allOpts);
			for (let i=-1,opt; opt=ctx.looseOpts[++i];)
				if ((!opt.text.includes(value)||opt.pinned)&&!opt.isEmpty)
					ctx.looseOpts.splice(i--,1);
				else if (opt.text.toLowerCase()==value.toLowerCase())
					ctx.canCreate=false;
			this._updateCreateOptionVisibility(ctx);
			const foundSelected=this._renderSelectOptions(ctx.mainUl,ctx.looseOpts,this._inputVal,ctx);
			if (foundSelected)
				ctx.pinnedUl.querySelector(".highlighted")?.classList.remove("highlighted");
			else if (ctx.highlightUlIndex) {
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
					this._closeSelectDropdown(ctx,e);
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
		_closeSelectDropdown(ctx,e) {
			if (!ctx.selectContainer.parentElement)
				return;
			if (!ctx.highlightUlIndex&&ctx.pinnedUl.children[ctx.highlightLiIndex]?.dataset.type=="create") {
				ctx.filterText=ctx.filterText??ctx.input.value;
				this._inputVal={text:ctx.filterText};
				ctx.strctInp.options.push(this._inputVal);
				ctx.allOpts.push(this._inputVal);
				ctx.strctInp.createNewOptionHandler?.(this._inputVal,e,this._cellCursorDataObj,this._mainRowIndex
																,this._activeSchemaNode,this._activeDetailsCell);
			} else
				this._inputVal=(ctx.highlightUlIndex?ctx.looseOpts:ctx.pinnedOpts)[ctx.highlightLiIndex];
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
			this._cellCursor.parentElement.appendChild(ctx.selectContainer);
			ctx.selectContainer.className="tablance-select-container";
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
	 * This method propagates changes from a modified cell to its dependent cells,
	 * ensuring that the dependent cells are updated accordingly. It traverses the
	 * hierarchical structure of cells and updates both details cells and main-row
	 * cells as needed.
	 *
	 * @param {Object} editedCellSchemaNode - The schema-node of the cell that was edited.
	 * @param {Object} [editedInstanceNode] - The instance-node representing the edited cell. This is used to determine
	 *                                   the closest scope for dependency updates.
	 */
	_updateDependentCells(editedCellSchemaNode, editedInstanceNode) {
		for (const depPath of editedCellSchemaNode.dependencyPaths??[])
			if (depPath[0]==="m") {//if cell is in main row cell
				// Find the corresponding table row for the main data row
				const tr=this._mainTbody.querySelector(`[data-data-row-index="${this._mainRowIndex}"]:not(.details)`);
				// Update the content of the dependent cell in the main table
				this._updateMainRowCell(tr.cells[depPath[1]], this._colSchemaNodes[depPath[1]]);
			} else if (this._openDetailsPanes[this._mainRowIndex]) {//if cell is in details and details is open
				//cells is an array that potentially can hold more than 1 cell. The reason is that when going into
				//repeated structures, it "splits" into multiple cells if there are multiple repeated-entries/instances
				let cells=depPath[0]==="r"?[editedInstanceNode]:[this._openDetailsPanes[this._mainRowIndex]];

				for (var step=1; depPath[step]===".."; step++)//if there are any, iterate all the ".."
					cells[0] = cells[0].parent;//go up one level per "..". At this point cells will only have one cell

				for (; step<depPath.length; step++) {//iterate the steps
					if (cells[0].schemaNode.type==="repeated") {
						const newCells=[];//will hold the new set of cells after this step
						for (const cell of cells)
							newCells.push(...cell.children);//add all repeated-children of current cell
						cells=newCells;//set cells to the new set of cells
					}
					for (let cellI=0; cellI<cells.length; cellI++)//iterate the cell(s)
						cells[cellI]=cells[cellI].children[depPath[step]];//and do the step
				}
				for (const cell of cells)//iterate the cell(s) again
					this._updateDetailsCell(cell,cell.dataObj);//and do the actual update
			}
	}

	_exitEditMode(save) {
		if (!this._inEditMode)
			return true;	
		const input=this._cellCursor.querySelector("input");
		if (this._activeSchemaNode.input.format?.stripDelimiterOnSave&&this._activeSchemaNode.input.format.delimiter)
			input.value=input.value.replaceAll(this._activeSchemaNode.input.format.delimiter, "");
		if (this._activeSchemaNode.input.validation&&save&&!this._validateInput(input.value))
			return false;
		//make the table focused again so that it accepts keystrokes and also trigger any blur-event on input-element
		this.rootEl.focus({preventScroll:true});//so that #inputVal gets updated-


		this._inEditMode=false;
		this._cellCursor.classList.remove("edit-mode");
		const inputValNorm=this._activeSchemaNode.input?.type==="select"
			?this._getSelectValue(this._inputVal):this._inputVal;
		const selectedValNorm=this._activeSchemaNode.input?.type==="select"
			?this._getSelectValue(this._selectedCellVal):this._selectedCellVal;
		if (save&&inputValNorm!=selectedValNorm) {
			this._doEditSave();
		}
		this._cellCursor.innerHTML="";
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

	_objectHasData(obj) {
		for (const val of Object.values(obj))
			if (val != null && !(Array.isArray(val) && val.length === 0))
				return true;
		return false;
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
		const {payload}=this._buildGroupPayload(group);
		payload.reason="discard";
		if (group.creating) {
			group.schemaNode.onClose?.(payload);
			return this._deleteCell(group);
		}

		// Restore data back to snapshot. It *should* only be needed if there are dirty fields so probably could run in
		// a condition together with  _rerenderDirtyFields. But running it just in case and it's cheap anyway
		if (group._openSnapshot)
			this._restoreGroupSnapshot(group.dataObj,group._openSnapshot);
		
		this._rerenderDirtyFields(group);
		group.schemaNode.onClose?.(payload);
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
		if (this._objectHasData(repeatEntry.dataObj)) {
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
			const payload=this._makeCallbackPayload(repeatEntry,{
				newDataItem: repeatEntry.dataObj,
				itemIndex: repeatEntry.index,
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
			creationContainer.schemaNode.onCreate?.(payload);
			if (!doCreate) {
				this._deleteCell(repeatEntry);
				return false;
			}
		} else {
			this._deleteCell(repeatEntry);
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
		if (!this._exitEditMode(true))//try to exit-mode and commit any changes.
			return false;//if exiting edit-mode was denied then do nothing more
			
		
		this._mainColIndex=cell.cellIndex;
		const mainRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);//save it here rather than setting it 
					//directly because we do not want it to change if #selectCell returns false, preventing the select
					
		if (this._closeActiveDetailsCell(cell)) {
			this._selectCell(cell,this._colSchemaNodes[this._mainColIndex],this._filteredData[mainRowIndex]);
			this._mainRowIndex=mainRowIndex;
		}
	}

	_selectDetailsCell(instanceNode) {
		if (!this._exitEditMode(true))//try to exit-mode and commit any changes.
			return false;//if exiting edit-mode was denied then do nothing more

		const oldExpCell=this._activeDetailsCell;//need to know the current/old details-cell if any for closing groups
					//etc but we can't just use this._activeDetailsCell because #selectCell changes it and we do want
					//to call #selectCell first in order to know if changing cell is being prevented by validation()

		for (var root=instanceNode; root.parent; root=root.parent);
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
		this._selectCell(instanceNode.selEl??instanceNode.el,instanceNode.schemaNode,instanceNode.dataObj,false);
		this._mainRowIndex=mainRowIndex;

		//in case this was called via instanceNode.select() it might be necessary to make sure parent-groups are open
		for (let parentCell=instanceNode; parentCell=parentCell.parent;)
			if (parentCell.schemaNode.type=="group") {
				parentCell.el.classList.add("open");
				this._enterEditTransaction(parentCell);
			}

		this._adjustCursorPosSize(instanceNode.selEl??instanceNode.el);
		this._activeDetailsCell=instanceNode;
		return instanceNode;
	}

	_selectCell(cellEl,schemaNode,dataObj,adjustCursorPosSize=true) {
		this.rootEl.focus({preventScroll:true});
		if (adjustCursorPosSize)
			this._adjustCursorPosSize(cellEl);
		this._cellCursor.classList.toggle("details",cellEl.closest(".details"));
		this._cellCursor.classList.toggle("disabled",cellEl.classList.contains("disabled"));
		(this._scrollingContent??this.rootEl).appendChild(this._cellCursor);
		this._selectedCell=cellEl;
		this._activeSchemaNode=schemaNode;
		//make cellcursor click-through if it's on an expand-row-button-td, select-row-button-td or button
		const noPtrEvent=schemaNode.type==="expand"||schemaNode.type==="select"||schemaNode.input?.type==="button";
		this._cellCursor.style.pointerEvents=noPtrEvent?"none":"auto";
		this._cellCursor.style.removeProperty("background-color");//select-input sets it to transparent, revert here
		this._cellCursorDataObj=dataObj;
		this._selectedCellVal=dataObj?.[schemaNode.dataKey];
	}

	_getElPos(el,container) {
		const cellPos=el.getBoundingClientRect();
		if (!container)
			container=this._tableSizer??this.rootEl;
		const contPos=container.getBoundingClientRect();
		return {x:cellPos.x-contPos.x, y:cellPos.y-contPos.y+(this._tableSizer?.offsetTop??0)}
	}

	_adjustCursorPosSize(el,onlyPos=false) {
		if (!el)
			return;
		const elPos=this._getElPos(el);
		this._cellCursor.style.top=elPos.y+"px";
		this._cellCursor.style.left=elPos.x+"px";
		this._cellCursor.style.display="block";//it starts at display none since #setupSpreadsheet, so make visible now
		if (!onlyPos) {
			this._cellCursor.style.height=el.offsetHeight+"px";
			this._cellCursor.style.width=el.offsetWidth+"px";
		}
	}

	_createTableHeader() {
		this._headerTable=this.rootEl.appendChild(document.createElement("table"));
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
			} else
				th.innerText=col.title??"\xa0";//non breaking space if nothing else or else
																	//sorting arrows wont be positioned correctly

			//create the divs used for showing html for sorting-up/down-arrow or whatever has been configured
			col.sortDiv=th.appendChild(document.createElement("DIV"));
			col.sortDiv.className="sortSymbol";
		}
		this._headerTr.appendChild(document.createElement("th"));
	}

	_onThClick(e) {
		const clickedIndex=e.currentTarget.cellIndex;
		if (this._colSchemaNodes[clickedIndex].type=="select"&&e.target.tagName.toLowerCase()=="input")
			return this._toggleRowsSelected(e.target.checked,0,this._filteredData.length-1);
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
					const aVal=normalizeVal(this._getDisplayValue(schemaNode,a,mainIndexMap.get(a),true));
					const bVal=normalizeVal(this._getDisplayValue(schemaNode,b,mainIndexMap.get(b),true));
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
		this._scrollBody=this.rootEl.appendChild(document.createElement("div"));

		if (this._staticRowHeight&&!this._schema.details)
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
	}

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

	_getSelectOptions(inputOpts,schemaNode=null,rowData=null,mainIndex=null,instanceNode=null) {
		const resolvedOptions=typeof inputOpts.options==="function"
			?inputOpts.options(this._makeCallbackPayload(instanceNode??null,{rowData},{schemaNode,mainIndex,rowData}))
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
	 * @param {*} schema Should be details or column when called from outside, but it calls itself recursively
	 * 						when hitting upon containers which then are passed to this param
	 * @returns */
	_buildBulkEditSchemaNodes(schema) {
		const result=[];
		if (schema.type=="field"&&schema.bulkEdit) {
			result.push(Object.assign(Object.create(null), schema, {type:"field"}));
		} else if ((schema.entries?.length&&schema.bulkEdit)||schema===this._schema.details) {
			for (const schemaNode of schema.entries)
				result.push(...this._buildBulkEditSchemaNodes(schemaNode));//TODO this has to be fixed to deal with wrapped...
		}
		return result;
	}

	/**Updates the displayed values in the bulk-edit-area */
	_updateBulkEditAreaCells(schemaNodesToUpdateCellsFor=this._bulkEditTable._schema.details.entries) {
		const mixedText="(Mixed)";
		for (let multiCellI=-1, multiCellSchemaNode; multiCellSchemaNode=schemaNodesToUpdateCellsFor[++multiCellI];) {

			//work out if there are mixed values for this cell among the selected rows, or if all are same
			let mixed=false;
			let val,lastVal;
			for (let rowI=-1,row; row=this._selectedRows[++rowI];) {
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


			//update both the data and the dom
			this._bulkEditTable.updateData(0,multiCellSchemaNode.dataKey,mixed?mixedText:val?.text??val??"");
			const el=this._bulkEditTable._openDetailsPanes[0].children[multiCellI].el;
			el.innerText=mixed?mixedText:val?.text??val??"";
			this._bulkEditTable._data[0][multiCellSchemaNode.dataKey]=mixed?"":val;
		}
	}

	_updateSizesOfViewportAndCols() {
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
	}

	_updateColsWidths() {
		if (this.rootEl.offsetWidth>this._containerWidth) {
			let areaWidth=this._tableSizer.offsetWidth;
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
	_applyFilters(filterString, includeDetails=true,caseSensitive=false) {

		//currently all of the rows will have to be closed. This is because Tablance doesn't have the logic needed now
		//to recalculate the virtualization based on artibrary rows that are expanded with variable heights. It only
		//has the logic to recalculate when expanding rows one by one, which are currently in view. This is mostly
		//it actually needs to generate and render the dom to calculate height. I think in the future it should guess
		//height of expansions(details) based on the knowledge it already has, and then adjust accordingly when
		//scrolling. This will also allow for a button in the titlebar that expands all.
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
		this._filter=filterString;
		const viewData=this._viewData??[];
		if (filterString) {
			const selectOptsCache=this._createSelectOptsCache();
			const nextData=[];
			for (let dataIndex=0; dataIndex<viewData.length; dataIndex++) {
				const dataRow=viewData[dataIndex];
				if (this._rowSatisfiesFilters(filterString,dataRow,dataIndex,selectOptsCache))
					nextData.push(dataRow);
			}
			this._filteredData=nextData;
		} else
			this._filteredData=viewData;
		this._sortData();
		this._scrollRowIndex=0;
		this._refreshTable();
		this._refreshTableSizerNoDetails();
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
				let text;
				const optionsSrc=schemaNode.input.options;
				if (typeof optionsSrc==="function") {
					const opts=this._getSelectOptions(schemaNode.input,schemaNode,dataObj,mainIndex,null);
					const match=opts.find(opt=>this._getSelectValue(opt)==this._getSelectValue(cellVal));
					text=match?.text;
				} else {
					const cacheEntry=selectOptsCache.get(optionsSrc);
					const valKey=this._getSelectValue(cellVal);
					text=cacheEntry?.[valKey];
					if (text==null) {
						const opts=this._getSelectOptions(schemaNode.input,schemaNode,dataObj,mainIndex,null);
						const match=opts.find(opt=>this._getSelectValue(opt)==valKey);
						text=match?.text;
					}
				}
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
		this._sourceData=[data[data.length-1]];
		this._viewData=this._sourceData;
		this._filteredData=this._viewData;
		this.rootEl.innerHTML="";
		const detailsDiv=this.rootEl.appendChild(document.createElement("div"));
		detailsDiv.classList.add("details");
		this._generateDetailsContent(this._schema.details,0,this._openDetailsPanes[0]=this._createInstanceNode(),detailsDiv,[],this._filteredData[0]);
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
					this._updateRowValues(this._mainTbody.appendChild(this._mainTbody.firstChild),dataIndex);
				} else {//moving up
					let trToMove=this._mainTbody.lastChild;									//move bottom row to top
					this._mainTbody.prepend(trToMove);
					this._updateRowValues(trToMove,this._scrollRowIndex);
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
		if (tr.dataset.dataRowIndex==this._mainRowIndex&&!this._activeDetailsCell)
				this._selectedCell=tr.cells[this._mainColIndex];
			//this._adjustCursorPosSize(this._selectedCell);
	}

	_refreshTableSizerNoDetails() {	
		this._tableSizer.style.top=this._scrollRowIndex*this._rowHeight+"px";
		this._tableSizer.style.height=(this._filteredData.length-this._scrollRowIndex)*this._rowHeight+"px";
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
		while ((this._numRenderedRows-1)*this._rowHeight<scrH&&this._scrollRowIndex+this._numRenderedRows<dataLen) {
			lastTr=this._mainTable.insertRow();
			this._numRenderedRows++;
			for (let i=0; i<this._colSchemaNodes.length; i++) {
				const cell=lastTr.insertCell();
				const div=cell.appendChild(document.createElement("div"));//used to set height of cells
				div.style.height=this._rowInnerHeight||"auto";				
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
				const tdComputedStyle=window.getComputedStyle(lastTr.firstChild);
				for (let prop of ["paddingTop","paddingBottom","borderBottomWidth","borderTopWidth"])
					this._rowInnerHeight-=parseInt(tdComputedStyle[prop]);
				this._rowInnerHeight=this._rowInnerHeight+lastTr.offsetHeight+"px";
			}
		}
	}

	_preventDefault(e){
		e.preventDefault();
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	_maybeRemoveTrs() {
		const scrH=this._scrollBody.offsetHeight+this._scrollMarginPx*2;
		while ((this._numRenderedRows-2)*this._rowHeight>scrH) {
			if (this._rowMeta.get(this._filteredData[this._scrollRowIndex+this._numRenderedRows-1])?.h) {
				this._mainTbody.lastChild.remove();
				delete this._openDetailsPanes[this._scrollRowIndex+this._numRenderedRows];
			}
			this._mainTbody.lastChild.remove();
			this._numRenderedRows--;
		}
	}

	/**Update the values of a row in the table. The tr needs to be passed in as well as the index of the data in #data
	 * The row needs to already have the right amount of td's.
	 * @param {HTMLTableRowElement} tr The tr-element whose cells that should be updated*/
	_updateRowValues(tr,mainIndex) {
		tr.dataset.dataRowIndex=mainIndex;
		const selected=this._selectedRows.indexOf(this._filteredData[mainIndex])!=-1;
		tr.classList.toggle("selected",!!selected);
		for (let colI=0; colI<this._colSchemaNodes.length; colI++) {
			let td=tr.cells[colI];
			let colSchemaNode=this._colSchemaNodes[colI];
			if (colSchemaNode.type!="expand"&&colSchemaNode.type!="select")
				this._updateMainRowCell(td,colSchemaNode);
			else if (colSchemaNode.type=="select")
				td.querySelector("input").checked=selected;
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

		//saving this ref here which is used to revert with if user deletes file
		fileInstanceNode.fileInputSchemaNode=fileSchemaNode;

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
		
		const fileGroup=this._schemaCopyWithDeleteButton({type:"group",entries:[]},this._fileOnDelete);
		fileGroup.entries[0].entries.unshift({type:"field",input:{type:"button",text:"Open"
				,onClick:(e,file,mainIndex,schemaNode,btnObj)=>{
					rowData??=this._filteredData[mainIndex];
					fileSchemaNode.input.openHandler?.(e,file,fileSchemaNode,fileInstanceNode.dataObj,mainIndex,btnObj);
			}},
		});
		fileGroup.entries.push({type:"lineup",entries:metaEntries});
		const wrappedFileGroup=this._buildSchemaFacade(fileGroup);//WRAPPED
		
		const fileData=rowData[fileInstanceNode.schemaNode.dataKey];
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
	_updateDetailsCell(instanceNode,rowData=null) {
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
		if (instanceNode.schemaNode.input?.type=="file"&&rowData[instanceNode.schemaNode.dataKey]) {
			this._generateFileCell(instanceNode,cellEl,rowData,rootCell.rowIndex);
		} else {
			if (instanceNode.schemaNode.visibleIf)
				this._applyVisibleIf(instanceNode);
			this._updateCell(instanceNode.schemaNode,cellEl,instanceNode.selEl,rowData,rootCell.rowIndex,instanceNode);
			if (instanceNode.schemaNode.input?.type!=="button") {
				const newCellContent=cellEl.innerText;
				if (!newCellContent!=!oldCellContent) {
					for (let cellI=instanceNode; cellI; cellI=cellI.parent)
						if (cellI.nonEmptyDescentants!=null)
							cellI.grpTr.classList.toggle("empty",!(cellI.nonEmptyDescentants+=newCellContent?1:-1));
					return true;
				}
			} else
				instanceNode.el=instanceNode.selEl=instanceNode.el.querySelector("button");
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
		if (schemaNode.dependsOnDataPath) {
			if (instanceNode)
				for (var root=instanceNode; root.parent; root=root.parent,rowData=root.dataObj);
			 return this._getValueByPath(rowData,schemaNode.dependsOnDataPath);
		}
		if (schemaNode.dependsOnCellPaths) {
			const dependee=this._resolveCellPaths(instanceNode,schemaNode.dependsOnCellPaths[0]);
			return dependee?.dataObj?.[dependee.schemaNode.dataKey];
		}
		return rowData[schemaNode.dataKey];
	}
	

	_updateCell(schemaNode,el,selEl,rowData,mainIndex,instanceNode=null) {
		let valueBundle;
		if (!instanceNode)
			selEl.className="";
		else if (instanceNode.baseCss)
			(selEl??el).className=instanceNode.baseCss;
		if (schemaNode.input?.type==="button") {
			this._generateButton(schemaNode,mainIndex,el,rowData,instanceNode);
		} else {
			let newCellContent;
			if (schemaNode.render||schemaNode.input?.type!="select") {
				valueBundle=this._getCellValueBundle(schemaNode,rowData,mainIndex,instanceNode);
				if (schemaNode.render) {
					const payload=this._makeCallbackPayload(instanceNode,{...valueBundle,rowData},{
						schemaNode,mainIndex,rowData});
					newCellContent=schemaNode.render(payload);
				} else
					newCellContent=valueBundle.value;
			} else { //if (schemaNode.input?.type==="select") {
				const rawVal=rowData[schemaNode.dataKey];
				const selOptObj=this._isObject(rawVal)?rawVal:this._getSelectOptions(
					schemaNode.input,schemaNode,rowData,mainIndex,instanceNode)
					.find(opt=>this._getSelectValue(opt)==this._getSelectValue(rawVal));
				newCellContent=rawVal==null?"":(selOptObj?.text??rawVal??"");
			}
			let isDisabled=false;
			if (this._spreadsheet&&schemaNode.type!=="expand") {
				const hasOnEnter=!!schemaNode.onEnter;
				let enabledFuncResult;
				if (schemaNode.input?.enabledIf) {
					const valuePayload=valueBundle??this._getCellValueBundle(schemaNode,rowData,mainIndex,instanceNode);
					const enabledPayload=this._makeCallbackPayload(instanceNode,valuePayload,
						{schemaNode,mainIndex,rowData});
					enabledFuncResult=schemaNode.input.enabledIf(enabledPayload);
				}
				if (enabledFuncResult==false||enabledFuncResult?.enabled==false)
					isDisabled=true;
				else if (!schemaNode.input&&!hasOnEnter)
					isDisabled=true;
			}
			(selEl??el).classList.toggle("disabled",isDisabled);
			if (schemaNode.html)
				el.innerHTML=newCellContent??"";
			else
				el.innerText=newCellContent??"";
		}
		if (instanceNode&&!instanceNode.schemaNode.baseCss)
			instanceNode.baseCss=(selEl??el).className;
		if (schemaNode.cssClass) {
			let cssAddition;
			if (typeof schemaNode.cssClass==="function") {
				cssAddition=schemaNode.cssClass(
					this._makeCallbackPayload(instanceNode,valueBundle
						??this._getCellValueBundle(schemaNode,rowData,mainIndex,instanceNode),
						{schemaNode:schemaNode,rowData,mainIndex}));
			} else 
				cssAddition=schemaNode.cssClass;
			if (cssAddition)//guard against undefined/null in case function returns that
				(selEl??el).classList.add(...(Array.isArray(cssAddition)?cssAddition:cssAddition.split(" ")));
		}
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
	}

	

	_doEditSave() {
		const inputVal=this._activeSchemaNode.input.type==="select"?this._getSelectValue(this._inputVal):this._inputVal;
		const commitKey=this.mainInstance._getCommitChangeKey(this._activeSchemaNode);
		const commitVal=this.mainInstance._normalizeCommitValue(this._activeSchemaNode,inputVal);
		this._cellCursorDataObj[this._activeSchemaNode.dataKey]=inputVal;
		for (const selectedRow of this.mainInstance._selectedRows) {
			selectedRow[this._activeSchemaNode.dataKey]=inputVal;
			const mainIndex=this.mainInstance._data.indexOf(selectedRow);
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
					schemaNode: this._activeSchemaNode,
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

	constructor() {
		super(...arguments);
		this._dropdownAlignmentContainer=this._onlyDetails?this.rootEl:this._scrollBody;
		this._collectFilterSchemaCaches(this._schema);
	}
	
	_doEditSave() {
		let doUpdate=true;//if false then the data will not actually change in either dataObject or the html
		const inputVal=this._activeSchemaNode.input.type==="select"
			?this._getSelectValue(this._inputVal):this._inputVal;
		const openGroup=this._getOpenGroupAncestor(this._activeDetailsCell);
		const mainIndex=this._mainRowIndex;
		const rowData=Number.isInteger(mainIndex)?this._filteredData?.[mainIndex]:null;
		const mainRow=!openGroup?rowData:null;
		const prevVal=this._cellCursorDataObj[this._activeSchemaNode.dataKey];
		this._cellCursorDataObj[this._activeSchemaNode.dataKey]=inputVal;
		const commitKey=this._getCommitChangeKey(this._activeSchemaNode);
		const commitVal=this._normalizeCommitValue(this._activeSchemaNode,this._cellCursorDataObj[this._activeSchemaNode.dataKey]);
		const commitChanges=commitKey?{[commitKey]:commitVal}:{};
		const rowIsNew=mainRow?this._rowMeta.get(mainRow)?.isNew:false;
		const mode=rowIsNew?"create":"update";

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
		} else {
			// Revert data if change was cancelled.
			this._cellCursorDataObj[this._activeSchemaNode.dataKey]=prevVal;
			this._inputVal=this._selectedCellVal;
		}
	}

	_scrollToCursor() {
		if (this._onlyDetails)
			return this._cellCursor.scrollIntoView({block: "center"});
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
		const expHeight=this._rowHeight+expRow.offsetHeight+this._borderSpacingY;
		rowMeta.h=expHeight;
		const contentDiv=expRow.querySelector(".content");
		if (!this._detailsBordersHeight)//see declarataion of _detailsTopBottomBorderWidth
			this._detailsBordersHeight=expHeight-contentDiv.offsetHeight;
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)//adjust scroll-height reflect change...
			+expHeight-this._rowHeight+"px";//...in height of the table
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
			if (openGroup?.creating&&!this._objectHasData(openGroup.dataObj))
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
		const dependedValue=(schemaNode.dependsOnDataPath||schemaNode.dependsOnCellPaths)?val:undefined;
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
		}

		return !instanceNode.hidden;
	}
}
