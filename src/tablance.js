/** 
 * Base class providing shared table logic, structure management,
 * data handling, and rendering helpers etc used by both Tablance and TablanceBulk.
 */
class TablanceBase {
	container;//Readonly, container-element for table
	neighbourTables;//Object of other Tablance-instances. Possible keys are "up" and "down". If any of these are set
				//then if one keeps pressing up/down until there are no more cells then one will get o the next table.
				//Except for manually this can also be set via chainTables()
	_containerHeight=0;//height of #container. Used to keep track of if height shrinks or grows
	_containerWidth=0;//height of #container. Used to keep track of if width shrinks or grows
	_colStructs=[];//column-objects. See columns-param in constructor for structure.
		//In addition to that structure these may also contain "sortDiv" reffering to the div with the sorting-html
																				//(see for example opts->sortAscHtml)
	_cols=[];//array of col-elements for each column
	_headerTr;//the tr for the top header-row
	_headerTable;//the tabe for the #headerTr. This table only contains that one row.
	_allData=[];//contains all, unfiltered data that has been added via addData()
	_data=[];//with no filter applied(empty seachbar) then this is reference to _allData, otherwise is a subset of it
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
	_bulkEditStructs;//Array of structs with inputs that are present in the bulk-edit-area
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
	_activeStruct;//reference to the struct-object of the selcted cell. For cells in the maintable this would
							//point to an object in #colStructs, otherwise to the struct-object of expansion-cells
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
	_expansion;//the expansion-argument passed to the constructor
	_expBordersHeight;//when animating expansions for expanding/contracting the height of them fully
			//expanded needs to be known to know where to animate to and from. This is different from 
			//#expandedRowIndicesHeights because that is the height of the whole row and not the div inside.
			//we could retrieve offsetheight of the div each time a row needs to be animated or instead we can get
			//the border-top-width + border-bottom-width once and then substract that from the value of  what's in
			//#expandedRowIndicesHeights instead
	_scrollMethod;//this will be set to a reference of the scroll-method that will be used. This depends on settings for
				//staticRowHeight and expansion
	_rowsMeta={keys:[],vals:[]};//This holds meta-data for the data-rows. The structure is essentially like a hashmap
			//from Java where objects are used as keys which in this case it is the data-row-object. This is done by
			//having 2 arrays: keys & vals. A references to a row is placed in "keys" and meta-data placed in "vals"
			//and index X in "keys" always corresponds to index X in "values". As for the meta-data itself this is
			//another object:
			//	h Integer 	If this is present then the row is expanded, otherwise not. The value is the combined height
			//				of the main row and its expansion-row.
	_filesMeta={keys:[],vals:[]};//Similiar to rowsMeta as it is structured the same but used for files that the user
								//has uploaded during the current session. This is to keep track of upload-progress.
								//keys are filled with File-objects while vals is filled with objects containing
								//metadata: uploadedBytes
	_selectedRows=[];//array of the actual data-objects of rows that are currently selected/checked using the select-col
	_scrollY=0;//this keeps track of the "old" scrollTop of the table when a scroll occurs to know 
	_numRenderedRows=0;//number of tr-elements in the table excluding tr's that are expansions (expansions too are tr's)
	_openExpansions={};//for any row that is expanded and also in view this will hold navigational data which
							//is read from when clicking or navigating using keyboard to know which cell is next, and
							//which elements even are selectable and so on. Keys are data-row-index. As soon as a row
							//is either contracted or scrolled out of view it is removed from here and then re-added
							//if expanded again or scrolled into view.
							//keys are rowDataindex and the values are "cell-objects" structured as: {
							//	el: HTMLElement the cell-element itself
							//	children: Array May be null but groups can have children which would be put in here
							//  				each element would be another one of these cell-objects
							//	parent: points to the parent cell-object. for non nested cells this would point to a
							//						root cell-object. and for the root cell-object this would be null.
							//						despite the root being a cell-object it cant be naviagted to. 
							//						it simply holds the top cell-objects
							//  index: the index of the cell/object in the children-array of its parent
							//}
	_activeExpCell;	//points to an object in #openExpansionNavMap and in extension the cell of an expansion.
							//If this is set then it means the cursor is inside an expansion.
	/* #generatingExpansion=false;//this is a flag that gets set to true when a row gets expanded or an already expanded
		//row gets scrolled into view, in short whenver the expansion-elements are generated. Then it gets unset when
		//creation finishes. The reason for having this flag is so that update */
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
	_onlyExpansion;//See constructor-param onlyExpansion
	_tooltip;//reference to html-element used as tooltip
	_dropdownAlignmentContainer;						

	/**
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column. The value in the data that has this key will be used as
	 * 				the value in the cell.
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			input: See param expansion -> input. This is the same as that one except textareas are only valid for
	 * 												expansion-cells and not directly in a maintable-cell
	 * 			render Function Function that can be set to render the content of the cell. The return-value is what
	 * 					will be displayed in the cell. Similiarly to columns->render it gets passed the following:
	 * 					1: The value from data pointed to by "id". If id is not set but dependsOn is then this will 
	 * 						instead get passed the value that the id of the depended cell points to, 
	 * 					2: data-row, 
	 * 					3: struct,
	 * 					4: main-index 
	 * 			html Bool Default is false. If true then the content of the cell will be rendered as html
	 * 1: The value from data pointed to by "id", 2: data-row, 3: struct,4: main-index, 5: Cell-object
	 * 			type String The default is "data". Possible values are:
	 * 				"data" - As it it implies, simply to display data but also input-elements such as fields or buttons
	 * 				"expand" - The column will be buttons used for expanding/contracting the rows. See param expansion
	 * 				"select" - The column will be checkboxes used to (un)select rows	
	 * 		}
	 * 			
	 * 	@param	{Boolean} staticRowHeight Set to true if all rows are of same height. With this option on, scrolling
	 * 				quickly through large tables will be more performant.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.
	 * 	@param	{Object} expansion This allows for having rows that can be expanded to show more data. An "entry"-object
	 * 			is expected and some of them can hold other entry-objects so that they can be nested.
	 * 			Properties that are valid for all types of entries:
	 * 				* title String displayed title if placed in a container which displays the title
	 *
	 * 				* visibleIf Function Optional callback that determines whether this entry should be visible.
	 * 					The function is called whenever the entry is rendered or any of its dependencies
	 * 					(see `dependsOn`) change. It receives the following arguments:
	 * 						(1: The value from data pointed to by "id"(or if dependsOn is set the value of that cell)
	 * 						2: data-row, 3: struct, 4: main-index, 5: Cell-object)
	 * 					Return `true` to make the entry visible, or `false` to hide it.
	 *
	 * 					When hidden:
	 *   					- The entry’s DOM element is not displayed.
	 *   					- `render` will not be called for this entry.
	 *
	 * 					Visibility state:
	 *   					- The cellObject receives an internal `hidden` flag when the entry is hidden.
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
	 * 						1. If `cellId` is set on the struct of a field, that ID is the identifier of that entry.
	 * 						2. If `id` is set (and `cellId` is not), the value of `id` becomes the entry’s identifier.
	 * 						3. `dependsOn` must match the identifier of another entry. If both `id` and `cellId` exist,
	 * 							`cellId` takes priority.
	 * 			Types of entries:
	 * 			{
  	 *				type "list" this is an entry that holds multiple rows laid out vertically, each item in the list 
	 *							can have a title on the left side by specifying "title" in each item within the list
	 * 				entries Array each element should be another entry
	 * 				titlesColWidth:String Width of the column with the titles. Don't forget adding the unit.
	 * 					Default is null which enables setting the width via css.Setting 0/false turns it off completely.
	 * 				onBlur: Function Callback fired when cellcursor goes from being inside the container to outside
	 * 					It will get passed arguments 1:cellObject, 2:mainIndex
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
	 * 					It will get passed arguments 1:cellObject, 2:mainIndex
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
  	 * 				id String the key of the property in the data that the row should display
	 * 				cssClass String Css-classes to be added to the field
	 * 				render Function Function that can be set to render the content of the cell. The return-value is what
	 * 					will be displayed in the cell. Similiarly to columns->render it gets passed the following:
	 * 					1: The value from data pointed to by "id". If id is not set but dependsOn is then this will 
	 * 						instead get passed the value that the id of the depended cell points to, 
	 * 					2: data-row, 
	 * 					3: struct,
	 * 					4: main-index, 
	 * 					5: Cell-object
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
	 * 							It gets passed the following arhuments:
	 * 							1:newValue, 2: message-function - A function that that takes a message-string as its
	 * 							first argument. If it the validation didn't go through then this string will be
	 * 							displayed to the user. 3:struct, 4:rowData, 5:mainIndex, 6:cellObject(if expansion-cell)
	 *						title String String displayed title if placed in a container which displays the title
	 * 						bulkEdit Bool Whether this input should be editable via bulk-edit-area, the section that 
	 * 							appears when selecting/checking multiple rows using the select-col. Default is true if
	 * 							not in expansion, or false if in expansion.
	 * 							Containers can too be added to the bulk-edit-area by setting bulkEdit on the container.
	 * 						multiCellWidth Int For inputs that are present in the bulk-edit-area. This property can be 
	 * 							used to specify the number of pixels in width of the cell in that section.
	 * 						onChange Function Callback fired when the user has changed the value of the input.
	 * 							It will get passed arguments:
	 * 							1:TablanceEvent. It has a method with key "preventDefault" which if called prevents the
	 * 							data/cell from actually being changed. ,2:property-name (id) of edited value
	 * 							,3:newValue,4:oldValue,5:rowData or rowData[] if bulk-edit-cell was edited,6:struct
	 * 							,7:cellObject of the input if in expansion,null if not inside expansion
	 * 						onBlur Function Callback fired when cellcursor goes from being inside the container
	 * 							to outside. It will get passed arguments 1:cellObject, 2:mainIndex
	 * 						enabled Function - If present then this function will be run and if it returns falsey then
	 * 							the cell will not be editable. It may also return an object structured as:
	 * 							{enabled:Bool, message:String}. The message will be displayed to the user 
	 * 							if edit is attempted and enabled is set to false, disabling the field
	 * 							It gets passed the following arguments - 
	 * 							1:struct,2:rowData,3:mainIndex,4:cellObject(if in expansion)
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
	 * 							2: The File-object, 3:struct,4:rowData,5:mainIndex,6:cellObject(if in expansion)
	 * 						fileMetasToShow Object An object specifying which meta-bits to show. Default of all are true
	 * 							{filename Bool, lastModified Bool, size Bool, type Bool}
	 * 							May also be set via opts->defaultFileMetasToShow
	 * 						openHandler Function callback-function for when the open-button is pressed. It gets the
	 * 							following arguments passed to it: 
	 * 							1: Event, 2: File-object, 3:struct,4:rowData,5:mainIndex,6:cellObject(if in expansion)
	 * 						deleteHandler Function callback-function for when the user deletes a file. It gets the 
	 * 							following arguments passed to it:
	 * 							1: Event, 2: File-object, 3:struct,4:rowData,5:mainIndex,6:cellObject(if in expansion)
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
	 * 							5:struct,6:cellObject(if inside expansion)
	 * 						selectInputPlaceholder String - A placeholder for the input which is
	 * 							visible either if the number of options exceed minOptsFilter or allowCreateNew is true
	 * 					}
	 * 					----Properties specific to input "button"----
	 * 						btnText String If type is "button" then this will be the text on it
	 * 						clickHandler Function A callback-function that will get called  when the button is pressed. 
	 * 							It will get passed arguments 1:event, 2:dataObject
	 * 							,3:mainDataIndex,4:struct,5:cellObject(if inside expansion)
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
  	 * 				id String this should be the key of an array in the data where each object corresponds to each
	 * 							element in this repeated rows.
  	 * 				entry Object Any entry. May be item or list for instance. The data retrieved for these will be 1
	 * 								level deeper so the path from the base would be idOfRepeatedRows->arrayIndex->*
	 * 				create: Bool If true then there will be a user-interface for creating and deleting entries
	 * 				onCreate Function Callback fired when the user has created an entry via the interface available if
	 * 					"create" is true. It is considered committed when the cell-cursor has left the repeat-row after
	 * 					having created it. It will normally get passed arguments: 1:new data,2:rowData,3:repeatedStruct
	 * 					,4:cellObject
	 * 					However if in the bulk-edit-area by setting "bulkEdit" to true then it will get passed
	 * 					1:new data, 2:array of rowData, 3:repeatedStruct,4:true (to easily check for bulk-edit-row edit)
	 * 				onCreateOpen Function If the entry of the repeated is group and "create" is set to true, then this
	 * 					callback-function will be called when a new group is added, i.e. when the user interacts with
	 * 					insertNew-cell, not when the data is actually created, that triggers "onCreate".
	 * 					It will get passed arguments: 1:cellObject of the repeated-object
	 * 				onCreateCancel Function If the entry of the repeated is group and "create" is set to true, then this
	 * 					callback-function will be called when the creation of a new entry is canceled, either by leaving
	 * 					the group with no data inserted, or by pressing the delete/cancel-button.
	 * 					It will get passed arguments: 1:cellObject of the repeated-object
	 * 				onDelete Function Callback fired when the user has deleted an entry via the interface available if
	 * 					"create" is true. It will get passed arguments: 1:rowData,2:cellObject
	 * 				sortCompare Function Passing in a function allows for sorting the entries. As expected this
	 * 					function will get called multiple times to compare the entries to one another.
	 * 					It gets 4 arguments: 1: object A, 2: object B, 3: rowData, 4: cellObject
	 * 					Return >0 to sort A after B, <0 to sort B after A, or ===0 to keep original order of A and B
	 * 				creationText String Used if "create" is true. the text of the creation-cell. Default is "Insert new"
	 * 					May also be set via opts->lang->insertNew
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
	 * 								true then this function will be executed upon commiting the creation. If the
	 * 								function returns true then the validation succeeded and the group will be created.
	 * 								It will get passed the following arguments:
	 * 								1: message-function - A function that that takes a message-string as its first
	 * 									argument. If it the validation didn't go through then this string will be
	 * 									displayed to the user.
	 * 								2:struct, 3:rowData(all the entered data of the group), 4:mainIndex, 5:cellObject
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
	 * 				onClose Function Callback that is fired when the group closes. Gets passed the following arguments:
	 * 					1: group-object
  	 * 			}
	 * 			{
	 * 				type "context" Used when a set of entries should be evaluated within the scope of a nested object
	 * 					on the current record. It does not render any visible content of its own, but changes
	 * 					the data context for its child entries. This is useful when the data is stored as a single
	 * 					object rather than an array, for example when a client record has a single homeAddress
	 * 					object instead of an array of addresses.
	 * 				id String The property name of the nested object to use as the new context.
	 * 				entry Object Any entry. May be field or list for instance or even further context or group entries
	 * 				Notes:
	 * 					- The context entry itself produces no DOM elements; it simply delegates rendering to its
	 * 					  child entries with a modified data scope.
	 * 					- Context entries can be nested multiple levels deep to traverse complex object structures.
	 * 					- Unlike "group" or "list", context entries cannot be directly opened or closed by the user
	 * 					  and have no visual representation on their own.
	 * 
	 * 				Example:
	 * 				{
	 * 					type: "context",
	 * 					id: "homeAddress",
	 * 					entry: {
	 * 						type:"group",
	 * 						entries:[
	 * 							{ title: "Street", id: "street", editable: "text" },
	 * 							{ title: "City", id: "city", editable: "text" }
	 * 						]
	 * 					}
	 * 				}
	 * 			}
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
	 * 													See prop fileMetasToShow in param expansion
	 * 							lang Object {  Object to replace language-specific text. The strings may be html-code
	 * 										except for ones used as placeholders. Below are the keys and defaults.
	 * 								fileName "Filename"
	 * 								fileLastModified "Last Modified"
	 * 								fileSize "Size"
	 * 								fileType "Type"
	 * 								fileUploadDone "Done!"
	 * 								fileChooseOrDrag "<b>Press to choose a file</b> or drag it here"
	 * 								fileDropToUpload "<b>Drop to upload</b>"
	 *								filterPlaceholder "Search"
	 * 								delete "Delete" (used in the deletion of repeat-items or files)
	 * 								deleteAreYouSure "Are you sure?" (Used in the deletion of repeat-items or files)
	 * 								deleteAreYouSureYes "Yes"  (Used in the deletion of repeat-items or files)
	 * 								deleteAreYouSureNo	"No" (Used in the deletion of repeat-items)
	 * 								datePlaceholder "YYYY-MM-DD"
	 * 								selectNoResultsFound "No results found"
	 * 								insertNew "Insert New" (Used in repeat-struct if create is set to true)
	 * 							}
	 * 	@param {Bool} onlyExpansion If this is set to true then the table will not have any actual rows and will instead
	 * 								only have an expansion specified in param expansion. It will also not have a
	 * 								scrollpane and the expansion will always be expanded. Method addData is still used
	 * 								to add the actual data but it will only use the last row sent. So adding multiple
	 * 								ones will cause it to discard all but the last.
	 * */
	constructor(container,columns,staticRowHeight=false,spreadsheet=false,expansion=null,opts=null,onlyExpansion=false){
		Object.defineProperty(this, 'container', {value: container,writable: false});
		this._spreadsheet=spreadsheet;
		this._expansion=expansion;
		this._staticRowHeight=staticRowHeight;
		this._opts=opts??{};
		this._onlyExpansion=onlyExpansion;
		container.classList.add("tablance");
		//const allowedColProps=["id","title","width","input","type","render","html"];//should we really do filtering?
		if (!onlyExpansion){
			for (let col of columns) {
				let processedCol={};
				if ((col.type=="expand"||col.type=="select")&&!col.width)
					processedCol.width=50;
				for (let [colKey,colVal] of Object.entries(col))
					//if (allowedColProps.includes(colKey))
						processedCol[colKey]=colVal;
				this._colStructs.push(processedCol);
			}
			if (opts?.searchbar!=false)
				this._setupSearchbar();
			this._createTableHeader();
			this._createTableBody();
			(new ResizeObserver(this._updateSizesOfViewportAndCols.bind(this))).observe(container);
			this._setupSpreadsheet(false);
			this._updateSizesOfViewportAndCols();
			if (opts?.sortAscHtml==null)
				opts.sortAscHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#000" points="4,10,0,6,8,6"/></svg>';
			if (opts?.sortDescHtml==null)
				opts.sortDescHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#000" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
			if (opts?.sortNoneHtml==null)
				opts.sortNoneHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
			this._updateHeaderSortHtml();
			this._buildDependencyGraph();
		} else
			this._setupSpreadsheet(true);
	}

	addData(data, highlight=false) {
		if (this._onlyExpansion)
			return this._setDataForOnlyExpansion(data)
		const oldLen=this._data.length;
		if (highlight)
			this._searchInput.value=this._filter="";//remove any filter
		this._data=this._allData=this._allData.concat(data);
		//this._data.push(...data);//much faster than above but causes "Maximum call stack size exceeded" for large data
		let sortingOccured=this._sortData();
		if (this._filter)
			this._filterData(this._filter);
		else {
			if (sortingOccured)
				this._refreshTable();
			else
				this._maybeAddTrs();
			const numNewInData=this._data.length-oldLen;
			this._tableSizer.style.height=parseInt(this._tableSizer.style.height||0)+numNewInData*this._rowHeight+"px";
		}
		if (highlight) {
			for (let dataRow of data)
				this._highlightRowIndex(this._data.indexOf(dataRow));
			this.scrollToDataRow(data[0],false);//false for not highlighting, above line does the highlight anyway
		}
	}

	/**Change or add any data in the table
	 * @param {int|object} dataRow_or_mainIndex Either the actual data-object that should be updated, or its index in
	 * 											the current view
	 * @param {string|string[]} dataPath The path to the data-value that should be updated or added to. For a value in
	 * 			the base which is not nested within repeated-containers it should simply be the id of the property.
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
			dataRow=this._data[mainIndx=dataRow_or_mainIndex];
		else //if (typeof dataRow_or_mainIndex=="object")
			mainIndx=this._data.indexOf(dataRow=dataRow_or_mainIndex);
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
		if (dataPath.length==1) //it's possible only if the path is a single id-key. (but still not guaranteed)
			for (let colI=-1,colStruct;colStruct=this._colStructs[++colI];)
				if (colStruct.id==dataPath[0]) {//if true then yes, it was a column of main-table
					dataRow[colStruct.id]=newData;//update the actual data
					const tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndx}"]:not(.expansion)`);
					return this._updateMainRowCell(tr.cells[colI],colStruct);//update it and be done with this
				}

		//The data is somewhere in expansion
		
		let cellObjToUpdate=this._openExpansions[mainIndx];//points to the cellObject that will be subject to update
		if (!cellObjToUpdate)//if the updates expansion is not open
			return;

		//look through the celObjToUpdate and its descendants-tree (currently set to whole expansion), following the
		//dataPath. At the end of this loop celObjToUpdate should be set to the deepest down object that dataPath points
		//to, and pathIndex should be the index in dataPath that is the last step pointing to celObjToUpdate.
		//When simply editing an already existing field then celObjToUpdate would be the container of that cell, and
		//pathIndex would be set to the index of the last element in dataPath
		for (let i=0,cellObjId; cellObjId=dataPath[i]; i+=2) {
			const arrayIndex=dataPath[i+1]?.replace(/^\[|\]$/g,"");
			cellObjToUpdate=this._findDescendantOfIdInCellObj(cellObjToUpdate,cellObjId);
			if (cellObjToUpdate.struct.type=="repeated") {//should be true until possibly last iteration
				if (i==dataPath.length-1) {//final array-index not specified. replace all of the data in repeated

					//remove all the current entries. Do it backwards so that the remaining entries doesn't have to
					//have their index&path updates each time
					const children=cellObjToUpdate.children;
					for (let entryI=children.length-!!cellObjToUpdate.struct.create,entry; entry=children[--entryI];)
						this._deleteCell(entry,true);

					//insert all the new data
					cellObjToUpdate.dataObj=cellObjToUpdate.parent.dataObj[cellObjToUpdate.struct.id];
					cellObjToUpdate.dataObj.forEach(dataEntry=>updatedEls.push(this._repeatInsert(cellObjToUpdate,false,dataEntry)));
					break;
				} else if (arrayIndex) {//index pointing at existing repeated-child
					cellObjToUpdate=cellObjToUpdate.children[arrayIndex];
				} else {//[] - insert new
					updatedEls.push(this._repeatInsert(cellObjToUpdate,false,cellObjToUpdate.dataObj.at(-1)));
					break;
				}
			}
		}

		if (cellObjToUpdate.struct.type=="field")
			this._updateExpansionCell(cellObjToUpdate,dataRow);
		if (scrollTo) {
			cellObjToUpdate.el.scrollIntoView({behavior:'smooth',block:"center"});
			updatedEls.forEach(el=>this._highlightElements([el,...el.getElementsByTagName('*')]));
		}
		this._adjustCursorPosSize(this._selectedCell,true);
	}

	_findDescendantOfIdInCellObj(searchInObj,idToFind) {
		for (const child of searchInObj.children)
			if (child.struct.id==idToFind)//if true then its the repeated-obj we're looking for
				return child;
			else if (child.children) {//if container-obj
				const result=this._findDescendantOfIdInCellObj(child,idToFind);
				if (result)
					return result;
			}
	}

	/**Expands a row and returns the expansion-object.
	 * @param int mainIndex
	 * @returns Object Expansion-object (outer-most cell-object)*/
	expandRow(mainIndex) {
		if (this._onlyExpansion)
			return this._openExpansions[0];
		let tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]`);
		if (!tr) {
			this.scrollToDataRow(this._data[mainIndex],false,false);
			this._scrollMethod();//needed to get everythig to render before having to wait for next frame
			tr=this._mainTbody.querySelector(`[data-data-row-index="${mainIndex}"]`);
		}
		this._expandRow(tr);
		return this._openExpansions[mainIndex];
	}

	scrollToDataRow(dataRow,highlight=true,smooth=true) {
		let scrollY=0;
		for (let i=-1,otherDataRow;otherDataRow=this._data[++i];) {
			if (otherDataRow==dataRow) {
				scrollY=scrollY-this._scrollBody.offsetHeight/2+this._rowHeight;
				this._scrollBody.scrollTo({top:scrollY,behavior:smooth?"smooth":"auto"});
				if (highlight)
					this._highlightRowIndex(i);
				return;
			}
			scrollY+=this._rowMetaGet(i)?.h??this._rowHeight;
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

	selectTopBottomCellOnlyExpansion(top) {
		this._highlightOnFocus=false;
		this._selectFirstSelectableExpansionCell(this._openExpansions[0],top);
	}

	/**
	 * Build a complete dependency graph and assign internal autoIds.
	 *
	 * This walks the column + expansion struct tree and enriches each node with
	 * the metadata needed for dependency resolution and runtime lookups.
	 *
	 * Permanent runtime metadata produced:
	 *  - struct.dependencyPaths: UI-forward paths (dependee → dependent)
	 *  - struct.dependsOnCellPaths: reverse structural path(s) (exp→exp)
	 *  - struct.dependsOnDataPath: absolute data path for non-exp→exp deps
	 *
	 * Temporary builder-only metadata (removed in Pass 4):
	 *  - struct._autoId
	 *  - struct._path
	 *  - struct._dataContextPath
	 *  - struct._dataPath
	 *  - ctx.explicitIdToAutoId, ctx.implicitIdToAutoId, ctx.structByAutoId, ctx.autoIdByName, etc.
	 */
	_buildDependencyGraph() {

		//---- PASS 1 — Assign autoIds + collect ID maps ----
		const ctx = this._pass1_assignAutoIdsAndMaps();

		//---- PASS 2 — Compute UI path & data paths ----
		for (let i = 0; i < this._expansion.entries.length; i++)// Expansion roots
			this._assignPathsAndData(this._expansion.entries[i], [i], []);
		for (let i = 0; i < this._colStructs.length; i++)// Main columns
			this._assignPathsAndData(this._colStructs[i], ["m", i], []);

		//---- PASS 3 — Resolve dependsOn and build dependency metadata ----
		this._pass3_resolveDependencies(ctx);

		//---- PASS 4 — Cleanup: remove all temporary builder-only metadata ----
		let stack = [...ctx.initialRoots];
		for (let struct; struct = stack.pop();) {
			delete struct._autoId;
			delete struct._path;
			delete struct._dataContextPath;
			delete struct._dataPath;
			stack.push(...this._structChildren(struct));
		}
	}

	/*───────────────────────────────────────────────────────────
		PASS 1 — Assign autoIds + collect ID maps
	───────────────────────────────────────────────────────────*/
	_pass1_assignAutoIdsAndMaps() {
		const ctx = Object.create(null);
		ctx.autoIdCounter       = 0;
		ctx.explicitIdToAutoId  = Object.create(null);
		ctx.implicitIdToAutoId  = Object.create(null);
		ctx.structByAutoId      = Object.create(null);
		ctx.seenCellIds         = Object.create(null);

		ctx.initialRoots = [...this._colStructs, ...this._expansion.entries];

		let stack = [...ctx.initialRoots];

		for (let struct; struct = stack.pop();) {

			const autoId = ++ctx.autoIdCounter;
			struct._autoId = autoId;
			ctx.structByAutoId[autoId] = struct;

			if (struct.cellId != null) {

				if (ctx.seenCellIds[struct.cellId])
					throw new Error(`Duplicate cellId "${struct.cellId}".`);

				ctx.seenCellIds[struct.cellId] = true;
				ctx.explicitIdToAutoId[struct.cellId] = autoId;
			} else if (struct.id != null)
				ctx.implicitIdToAutoId[struct.id] = autoId;

			stack.push(...this._structChildren(struct));
		}

		// Id/cellId → autoId lookup
		ctx.autoIdByName = Object.assign(Object.create(null), ctx.implicitIdToAutoId, ctx.explicitIdToAutoId);

		return ctx;
	}

	/*───────────────────────────────────────────────────────────
		PASS 3 — Resolve dependsOn and build dependency metadata
	───────────────────────────────────────────────────────────*/
	_pass3_resolveDependencies(ctx) {
		let stack = [...ctx.initialRoots];

		for (let struct; struct = stack.pop();) {

			if (struct.dependsOn) {
				const deps = Array.isArray(struct.dependsOn) ? struct.dependsOn : [struct.dependsOn];

				const dependentIsExp = struct._path[0] !== "m";
				const cellPaths = [];
				const dataPaths = [];

				for (const depName of deps) {

					const depAutoId = ctx.autoIdByName[depName];

					if (depAutoId == null) {
						console.warn(`Unknown dependsOn "${depName}".`, struct);
						continue;
					}

					const dependee = ctx.structByAutoId[depAutoId];
					const dependeeIsExp = dependee._path[0] !== "m";

					// UI-forward dependency path
					const fwd = this._computeDependencyPath(dependee, struct);

					if (fwd)
						(dependee.dependencyPaths ??= []).push(fwd);

					// classify dependency type
					if (dependentIsExp && dependeeIsExp) {
						const rev = this._computeReversePath(struct, dependee);
						if (rev && rev.length)
							cellPaths.push(rev);
					} else {
						if (dependee._dataPath)
							dataPaths.push(dependee._dataPath);
						else if (dependee.id != null || dependee.cellId != null)
							console.warn("Dependee has no dataPath:", dependee);
					}
				}

				this._finalizeDependency(struct, cellPaths, dataPaths);
			}

			stack.push(...this._structChildren(struct));
		}
	}

	/*───────────────────────────────────────────────────────────
		Helper: Normalize struct children
	───────────────────────────────────────────────────────────*/
	_structChildren(struct) {
		while (struct.entry)
			struct = struct.entry;
		if (Array.isArray(struct.entries))
			return struct.entries;
		return [];
	}

	/*───────────────────────────────────────────────────────────
		Helper: Assign _path, _dataContextPath, and _dataPath
	───────────────────────────────────────────────────────────*/
	_assignPathsAndData(struct, uiPath, parentCtx = []) {
		struct._path = uiPath;

		const hasCtx = typeof struct.context === "string" && struct.context.length;
		const myCtx = hasCtx ? [...parentCtx, struct.context] : parentCtx;

		struct._dataContextPath = myCtx;

		if (struct.id != null)
			struct._dataPath = [...myCtx, String(struct.id)];

		const kids = this._structChildren(struct);

		for (let i = 0; i < kids.length; i++)
			this._assignPathsAndData(kids[i], [...uiPath, i], myCtx);
	}

	/*───────────────────────────────────────────────────────────
		Helper: Compute UI-forward dependency path
	───────────────────────────────────────────────────────────*/
	_computeDependencyPath(dependee, dependent) {
		const from = dependee._path;
		const to   = dependent._path;

		if (!from || !to)
			return null;

		// main → main
		if (from[0] === "m" && to[0] === "m")
			return ["m", to[1]];

		// expansion → main
		if (from[0] !== "m" && to[0] === "m")
			return ["m", to[1]];

		// main → expansion
		if (from[0] === "m" && to[0] !== "m")
			return ["e", ...to];

		// expansion → expansion
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
	_computeReversePath(from, to) {
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
	_finalizeDependency(struct, cellPaths, dataPaths) {

		if (cellPaths.length) {
			struct.dependsOnCellPaths = cellPaths;
			delete struct.dependsOnDataPath;
			return;
		}

		if (dataPaths.length === 1) {
			struct.dependsOnDataPath = dataPaths[0];
			delete struct.dependsOnCellPaths;

			if (!struct._dataPath)
				struct._dataPath = dataPaths[0];

			return;
		}

		if (dataPaths.length > 1) {
			console.warn("Multiple data dependencies not supported:", struct);

			struct.dependsOnDataPath = dataPaths[0];
			delete struct.dependsOnCellPaths;

			if (!struct._dataPath)
				struct._dataPath = dataPaths[0];
		}
	}





	_updateViewportHeight=()=>{
		this._scrollBody.style.height=this.container.clientHeight-this._headerTable.offsetHeight
				-(this._searchInput?.offsetHeight??0)-this._bulkEditArea.offsetHeight+"px";
	}

	_attachInputFormatter(el, format) {
		format = this._normalizeInputFormat(format);
	
		// Numeric filtering
		if (format.numericOnly) {
			el.addEventListener("beforeinput", e => {
				if (e.data && /\D/.test(e.data))
					e.preventDefault();
			});
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
			let out = "", i = 0;
			const delim = format.delimiter ?? "";
			for (const block of format.blocks) {
				const part = value.slice(i, i + block);
				out += part;
				i += part.length;
				if (part.length === block && delim)
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
	
	
	
		
	
	_setupSearchbar() {
		this._searchInput=this.container.appendChild(document.createElement("input"));
		this._searchInput.type=this._searchInput.className="search";
		this._searchInput.placeholder=this._opts.lang?.filterPlaceholder??"Search";
		this._searchInput.addEventListener("input",e=>this._onSearchInput(e));
	}

	_onSearchInput(_e) {
		this._filterData(this._searchInput.value);
	}

	_setupSpreadsheet(onlyExpansion) {
		this.container.classList.add("spreadsheet");
		this._cellCursor=document.createElement("div");
		this._cellCursor.className="cell-cursor";
		this._cellCursor.style.display="none";
		if (!onlyExpansion) {
			this._createBulkEditArea();
			//remove any border-spacing beacuse if spacing is clicked the target-element will be the table itself and
			//no cell will be selected which is bad user experience. Set it to 0 for headerTable too in order to match
			this._mainTable.style.borderSpacing=this._headerTable.style.borderSpacing=this._borderSpacingY=0;
		}
		this.container.addEventListener("focus",e=>this._spreadsheetOnFocus(e));
		this.container.addEventListener("blur",e=>this._spreadsheetOnBlur(e));
		this.container.tabIndex=0;//so that the table can be tabbed to
		this.container.addEventListener("keydown",e=>this._spreadsheetKeyDown(e));
		this.container.addEventListener("mousedown",e=>this._spreadsheetMouseDown(e));
		this._cellCursor.addEventListener("dblclick",e=>this._enterCell(e));

		this._tooltip=document.createElement("div");
		this._tooltip.classList.add("tooltip");
		this._tooltip.appendChild(document.createElement("span"));
	}

	_rowMetaGet(dataIndex) {
		return this._rowsMeta.vals[this._rowsMeta.keys.indexOf(this._data[dataIndex])];
	}

	_rowMetaSet(dataIndex,key,val) {
		const linkIndex=this._rowsMeta.keys.indexOf(this._data[dataIndex]);
		if (linkIndex==-1&&val!=null) {
			this._rowsMeta.vals.push({[key]:val});
			this._rowsMeta.keys.push(this._data[dataIndex]);
		} else if (linkIndex!=-1&&val==null) {
			delete this._rowsMeta.vals[linkIndex][key];
			if (!Object.keys(this._rowsMeta.vals[linkIndex]).length) {
				this._rowsMeta.vals.splice(linkIndex,1);
				this._rowsMeta.keys.splice(linkIndex,1);
			}
		} else if (linkIndex!=-1&&val!=null)
			this._rowsMeta.vals[linkIndex][key]=val;	
		return val;
	}

	_spreadsheetOnFocus(_e) {
		const tabbedTo=this._highlightOnFocus;
		if (this._mainRowIndex==null&&this._mainColIndex==null&&this._data.length&&tabbedTo)
				if (this._onlyExpansion)
					this.selectTopBottomCellOnlyExpansion(true);
				else
					this._selectMainTableCell(this._mainTbody.rows[0].cells[0]);
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		if (!this._onlyExpansion&&this._highlightOnFocus)
			this.container.style.removeProperty("outline");
		else
			this.container.style.outline="none";
		
		//why is this needed? it messes things up when cellcursor is in mainpage of bulk-edit-area but hidden because
		//other page is open, and the tablance gets focus because then it will be visible through the active page
		//this._cellCursor.style.display="block";
		
		if (tabbedTo)
			this._scrollToCursor();
	}

	_spreadsheetOnBlur(_e) {
		setTimeout(()=>{
			if (!this.container.contains(document.activeElement)||this._bulkEditArea?.contains(document.activeElement)) {
				this._highlightOnFocus=true;
				//if (this.neighbourTables&&Object.values(this.neighbourTables).filter(Boolean).length)
					this._cellCursor.style.display="none";
			}
		});
	}

	_moveCellCursor(hSign,vSign,e) {
		const prevSelectedCell=this._selectedCell;
		if (this._mainRowIndex==null&&this._mainColIndex==null)//if table has focus but no cell is selected.
			return;//can happen if table is clicked but not on a cell
		e?.preventDefault();//to prevent native scrolling when pressing arrow-keys. Needed if #onlyExpansion==true but
							//not otherwise. Seems the native scrolling is only done on the body and not scrollpane..?
		//const newColIndex=Math.min(this._cols.length-1,Math.max(0,this._cellCursorColIndex+numCols));
		if (!this._onlyExpansion)
			this._scrollToCursor();//need this first to make sure adjacent cell is even rendered

		if (this._activeExpCell?.parent?.struct.type==="lineup")
			this._moveInsideLineup(hSign,vSign);
		else if (vSign) {//moving up or down
			let newColIndex=this._mainColIndex;
			if (this._activeExpCell) {//moving from inside expansion.might move to another cell inside,or outside
					this._selectAdjacentExpansionCell(this._activeExpCell,vSign==1);
			} else if (vSign===1&&this._rowMetaGet(this._mainRowIndex)?.h){//moving down into expansion
				this._selectFirstSelectableExpansionCell(this._openExpansions[this._mainRowIndex],true);
			} else if (vSign===-1&&this._rowMetaGet(this._mainRowIndex-1)?.h){//moving up into expansion
				this._selectFirstSelectableExpansionCell(this._openExpansions[this._mainRowIndex-1],false);
			} else {//moving from and to maintable-cells
				this._selectMainTableCell(
					this._selectedCell.parentElement[(vSign>0?"next":"previous")+"Sibling"]?.cells[newColIndex]);
			}
		} else if (!this._activeExpCell){
			this._selectMainTableCell(this._selectedCell[(hSign>0?"next":"previous")+"Sibling"]);
		}
		if (this._onlyExpansion&&this._mainRowIndex!=null)
			this._scrollToCursor();
		
		//if active cell is still the same. this happens for example when pressing enter when at the bottom
		if (prevSelectedCell==this._selectedCell)
			this._exitEditMode(true);
	}

	_moveInsideLineup(numCols,numRows) {
		const currentCellX=this._activeExpCell.el.offsetLeft;
		const currCelTop=this._activeExpCell.el.offsetTop;
		const currCelBottom=currCelTop+this._activeExpCell.el.offsetHeight;
		if (numCols) {//moving left or right
			for (let i=this._activeExpCell.index,nextCel;nextCel=this._activeExpCell.parent.children[i+=numCols];) {
				if (nextCel.el.offsetParent != null && (nextCel?.el.offsetLeft>currentCellX)==(numCols>0)) {
					if (currCelBottom>nextCel.el.offsetTop&&nextCel.el.offsetTop+nextCel.el.offsetHeight>currCelTop)
						this._selectExpansionCell(nextCel);
					break;
				}
			}
		} else {//moving up or down
			let closestCell,closestCellX;
			const siblings=this._activeExpCell.parent.children;
			for (let i=this._activeExpCell.index,otherCell;otherCell=siblings[i+=numRows];) {
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
				this._selectExpansionCell(closestCell);
			else
				this._selectAdjacentExpansionCell(this._activeExpCell.parent,numRows==1?true:false);
		}
	}

	_selectAdjacentExpansionCell(cellObj,isGoingDown) {
		let cell=this._getAdjacentExpansionCell(cellObj,isGoingDown);//repeat this line until a valid cell is found?
		if (cell)
			return this._selectExpansionCell(cell);
		if (!this._onlyExpansion)
			this._selectMainTableCell(this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+isGoingDown}"]`)?.cells[this._mainColIndex]);
		else {
			const nextTable=this.neighbourTables?.[isGoingDown?"down":"up"];
			if (nextTable) {
				this._mainColIndex=this._mainRowIndex=this._activeExpCell=null;
				nextTable.container.style.outline=this._cellCursor.style.display="none";
				nextTable.selectTopBottomCellOnlyExpansion(isGoingDown);
			}
		}
	}
	
	_getAdjacentExpansionCell (cellObj,isGoingDown) {
		if (!cellObj.parent)//parent is null if the class-instance is in the bulk-edit-area
			return;
		const siblings=cellObj.parent.children;
		const index=cellObj.index;
		for (let i=index+(isGoingDown||-1); i>=0&&i<siblings.length; i+=isGoingDown||-1) {
			const sibling=siblings[i];
			if (sibling.hidden)
				continue;
			if (sibling.el)
				return sibling;
			//else if sibling.children
			const niece=this._getFirstSelectableExpansionCell(sibling,isGoingDown);
			if (niece)
				return niece;
		}
		if (cellObj.parent.parent)
			return this._getAdjacentExpansionCell(cellObj.parent,isGoingDown);
	}

	_selectFirstSelectableExpansionCell(cellObj,isGoingDown,onlyGetChild=false) {
		const newCellObj=this._getFirstSelectableExpansionCell(cellObj,isGoingDown,onlyGetChild);
		if (newCellObj)
			return this._selectExpansionCell(newCellObj);
		this._selectMainTableCell(this._mainTbody.querySelector(
				`[data-data-row-index="${this._mainRowIndex+(isGoingDown||-1)}"]`)?.cells[this._mainColIndex]);
	}

	/**Given a cell-object, like the expansion of a row or any of its sub-containers, it will return the first
	 * selectable cell from top or bottom
	 * @param {*} cellObj
	 * @param {Boolean} isGoingDown 
	 * @param {Boolean} onlyGetChild if this is set to true then it will never return the passed in cellObj and instead
	 *			only look at its (grand)children. Used for groups where both itself and its children can be selected*/
	_getFirstSelectableExpansionCell(cellObj,isGoingDown,onlyGetChild=false) {
		if (!onlyGetChild&&cellObj.el)
			return cellObj;
		const children=cellObj.children;
		let startI=isGoingDown?0:children.length-1;
		if (cellObj.struct.type==="lineup"&&!isGoingDown) {
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
				 return this._getFirstSelectableExpansionCell(children[childI],isGoingDown);
	}
	
	_spreadsheetKeyDown(e) {
		//prevent this from running in outer Tablance if an inner Tablance-instance is selected
		if (this._bulkEditArea?.contains(document.activeElement))
			return;
		this._tooltip.style.visibility="hidden";
		if (this._inEditMode&&this._activeStruct.input.type==="date") {
			if (e.key.slice(0,5)==="Arrow") {
				if (e.ctrlKey)
					e.stopPropagation();//allow moving textcursor if ctrl is held so prevent date-change then
				else
					e.preventDefault();//prevent textcursor from moving when arrowkey-selecting dates in date-picker
			} else if (e.key==="Backspace")
				e.stopPropagation();
		}
		this.container.style.outline="none";//see #spreadsheetOnFocus
		if (!this._inEditMode) {
			switch (e.code) {
				case "ArrowUp":
					this._moveCellCursor(0,-1,e);
				break; case "ArrowDown":
					this._moveCellCursor(0,1,e);
				break; case "ArrowLeft":
					this._moveCellCursor(-1,0,e);
				break; case "ArrowRight":
					this._moveCellCursor(1,0,e);
				break; case "Escape":
					this._groupEscape();
				break; case "NumpadAdd":
					this._scrollToCursor();
					this. _expandRow(this._selectedCell.closest(".main-table>tbody>tr"));
				break; case "NumpadSubtract":
					this._scrollToCursor();
					this._contractRow(this._selectedCell.closest(".main-table>tbody>tr"));
				break; case "Enter": case "NumpadEnter": case "Space":
					if (e.code=="Space")
						e.preventDefault();//prevent scrolling when pressing space
					this._scrollToCursor();
					if (this._activeStruct.type=="expand")
						// the preventDefault() above can SOMETIMES suppress transitionend;
						// deferring one frame ensures the animation completes and expansion is closed properly.
						return requestAnimationFrame(()=>this._toggleRowExpanded(this._selectedCell.parentElement));
					if (this._activeStruct.type=="select")
						return this._rowCheckboxChange(this._selectedCell,e.shiftKey);
					if (e.code.endsWith("Enter")||this._activeStruct.input?.type==="button") {
						e.preventDefault();//prevent newline from being entered into textareas
						return this._enterCell(e);
					}
			}
		} else {
			switch (e.key) {
				case "Enter":
					this._moveCellCursor(0,e.shiftKey?-1:1,e);
				break; case "Escape":
					this._exitEditMode(false);
			}
		}
	}

	_groupEscape() {
		for (let cellObj=this._activeExpCell; cellObj=cellObj?.parent;)
			if (cellObj.struct.type==="group")
				return this._selectExpansionCell(cellObj);
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

	_unsortCol(id,type) {
		for (let sortCol,i=-1;sortCol=this._sortingCols[++i];)
			if (id&&id==sortCol.id||type&&type==sortCol.type) {
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
	_renderExpansion(tr,rowIndex) {
		tr.classList.add("expanded");
		const expansionRow=tr.parentElement.insertRow(tr.rowIndex+1);
		expansionRow.className="expansion";
		expansionRow.dataset.dataRowIndex=rowIndex;
		const expansionCell=expansionRow.insertCell();
		expansionCell.colSpan=this._cols.length;
		const expansionDiv=expansionCell.appendChild(document.createElement("div"));//single div inside td for animate
		expansionDiv.style.height="auto";
		expansionDiv.className="content";
		expansionDiv.addEventListener("transitionend",this._expansionAnimationEnd.bind(this));
		const shadowLine=expansionDiv.appendChild(document.createElement("div"));
		shadowLine.className="expansion-shadow";
		const cellObject=this._openExpansions[rowIndex]={};
		this._generateExpansionContent(this._expansion,rowIndex,cellObject,expansionDiv,[],this._data[rowIndex]);
		cellObject.rowIndex=rowIndex;
		return expansionRow;
	}

	_expansionAnimationEnd(e) {
		if (e.currentTarget!==e.target)
			return;//otherwise it will apply to transitions of child-elements as well
		if (parseInt(e.target.style.height)) {//if expand finished

			e.target.style.height="auto";
		} else {//if contract finished

			const expansionTr=e.target.closest("tr");
			const mainTr=expansionTr.previousSibling;
			const dataRowIndex=mainTr.dataset.dataRowIndex;
			mainTr.classList.remove("expanded");
			this._tableSizer.style.height=parseInt(this._tableSizer.style.height)
				 -this._rowMetaGet(dataRowIndex).h+this._rowHeight+"px";
			expansionTr.remove();
			this._rowMetaSet(dataRowIndex,"h",null);
			delete this._openExpansions[dataRowIndex];
		}
	}

	/**
	 * Creates expansion content based on the provided structure.
	 *
	 * @param {object} struct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObject The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateExpansionContent(struct,mainIndex,cellObject,parentEl,path,rowData,_notYetCreated) {
		if (!path.length)
			cellObject.rowIndex=mainIndex;
		cellObject.path=[...path];
		cellObject.dataObj=rowData;
		cellObject.struct=struct;
		if (struct.visibleIf)
			this._applyVisibleIf(cellObject);
		switch (struct.type) {
			case "list": return this._generateExpansionList(...arguments);
			case "field": return this._generateField(...arguments);
			case "group": return this._generateExpansionGroup(...arguments);
			case "repeated": return this._generateExpansionRepeated(...arguments);
			case "lineup": return this._generateExpansionLineup(...arguments);
			case "context": return this._generateContext(...arguments);
		}
	}

	_repeatedOnDelete=(e,data,index,struct,cel)=>{
		this._deleteCell(cel.parent.parent);
		cel.parent.parent.parent.struct.onDelete?.(cel.parent.parent.dataObj,cel.parent.parent);
	}

	_fileOnDelete=(e,data,index,strct,cel)=>{
		const fileCell=cel.parent.parent;
		const inputStruct=fileCell.fileInputStruct;
		const dataRow=fileCell.parent.dataObj;
		delete dataRow[inputStruct.id];
		const fileTd=fileCell.el.parentElement;
		fileTd.innerHTML="";
		fileTd.classList.remove("group-cell");
		this._generateExpansionContent(inputStruct,index,fileCell,fileTd,fileCell.path,dataRow);
		inputStruct.deleteHandler?.(e,data,inputStruct,fileCell.parent.dataObj,index,fileCell);
		this._selectExpansionCell(fileCell);
	}

	_onOpenCreationGroup=(e,groupObject)=>{
		e.preventDefault();
		this._repeatInsert(groupObject.parent,true,groupObject.parent.dataObj[groupObject.parent.dataObj.length]={});
	}

	/**
	 * This is "supposed" to get called when a repeated-struct is found however in #generateExpansionList,
	 * repeated-structs are looked for and handled by that method instead so that titles can be added to the list
	 * which isn't handled by #generateExpansionContent but by the list-method itself
	 *
	 * @param {object} repeatedStruct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObject The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateExpansionRepeated(repeatedStruct,mainIndex,cellObject,parentEl,path,rowData,_notYetCreated) {
		cellObject.children=[];
		let repeatData=cellObject.dataObj=rowData[repeatedStruct.id]??(rowData[repeatedStruct.id]=[]);
		cellObject.insertionPoint=parentEl.appendChild(document.createComment("repeated-insert"));
		repeatedStruct.create&&this._generateRepeatedCreator(cellObject);
		repeatData?.forEach(repeatData=>this._repeatInsert(cellObject,false,repeatData));
		return !!repeatData?.length||repeatedStruct.create;
	}

	/**For repeated-structs with create set to true, meaning that the user can create more entries via a user-interface,
	 * this method creates the last entry that the user interacts with to create another entry
	 * @param {Object} repeatedObj The object representing the repeated-container*/
	_generateRepeatedCreator(repeatedObj) {
		const creationTxt=repeatedObj.struct.creationText??this._opts.lang?.insertNew??"Insert new";
		const creationStrct={type:"group",closedRender:()=>creationTxt,entries:[],
							creator:true//used to know that this entry is the creator and that it should not be sorted
							,onOpen:this._onOpenCreationGroup,cssClass:"repeat-insertion"};
		const el=this._repeatInsert(repeatedObj,false,{},creationStrct);
		el.parentElement.classList.add("empty");//this will make it hidden if inside a group that is closed
	}

	_beginDeleteRepeated(e,data,mainIndex,struct,cell) {
		if (!cell.parent.parent.creating) {
			cell.parent.containerEl.classList.add("delete-confirming");
			this._moveInsideLineup(1);//move away from the delete-button which now dissapeared, to the next btn
		} else
			this._deleteCell(cell.parent.parent);
	}

	_cancelDelete(e,data,mainIndex,struct,cell) {
			cell.parent.containerEl.classList.remove("delete-confirming");
			this._selectExpansionCell(cell.parent.children[0]);
	}

	_structCopyWithDeleteButton(struct,deleteHandler) {
		const deleteControls={type:"lineup",cssClass:"delete-controls"
			,onBlur:cel=>cel.selEl.querySelector(".lineup").classList.remove("delete-confirming")
			,entries:[{type:"field",input:{type:"button",
				btnText:struct.deleteText??this._opts.lang?.delete??"Delete"
				,clickHandler:this._beginDeleteRepeated.bind(this)},cssClass:"delete"},
			{type:"field",input:{type:"button"
				,btnText:struct.areYouSureNoText??this._opts.lang?.deleteAreYouSureNo??"No",
				clickHandler:this._cancelDelete.bind(this)},cssClass:"no"
				,title:struct.deleteAreYouSureText??this._opts.lang?.deleteAreYouSure??"Are you sure?"},
			{type:"field",input:{type:"button"
				,btnText:struct.areYouSureYesText??this._opts.lang?.deleteAreYouSureYes??"Yes",
				clickHandler:deleteHandler},cssClass:"yes"}]};
		struct={...struct};//make shallow copy so original is not affected
		struct.entries=[...struct.entries,deleteControls];
		return struct;
	}

	_generateButton(struct,mainIndex,parentEl,rowData,cellObj=null) {
		const btn=parentEl.appendChild(document.createElement("button"));
		btn.tabIndex="-1";//so it can't be tabbed to
		btn.innerHTML=struct.input.btnText;
		btn.addEventListener("click",e=>struct.input.clickHandler?.(e,rowData,mainIndex,struct,cellObj));

		//prevent gaining focus upon clicking it whhich would cause problems. It should be "focused" by having the
		//cellcursor on its cell which triggers it with enter-key anyway
		btn.addEventListener("mousedown",e=>e.preventDefault());
		return true;
	}

		/**
	 * Creates expansion content based on the provided structure.
	 *
	 * @param {object} groupStruct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObject The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateExpansionGroup(groupStruct,mainIndex,cellObj,parentEl,path,rowData,notYetCreated) {
		cellObj.select=()=>this._selectExpansionCell(cellObj);
		const groupTable=parentEl.appendChild(document.createElement("table"));
		const tbody=cellObj.containerEl=groupTable.appendChild(document.createElement("tbody"));
		groupTable.dataset.path=path.join("-");
		parentEl.classList.add("group-cell");
		cellObj.el=groupTable;//so that the whole group-table can be selectedf
		if (notYetCreated)
			cellObj.creating=true;
		groupTable.className="expansion-group "+(groupStruct.cssClass??"");
		this._generateExpansionCollection(groupStruct,mainIndex,cellObj,parentEl,path,rowData);
		if (groupStruct.closedRender) {
			groupTable.classList.add("closed-render");
			const renderRow=tbody.insertRow();
			renderRow.dataset.path=path.join("-");
			renderRow.className="group-render";
			const renderCell=renderRow.insertCell();
			renderCell.innerText=groupStruct.closedRender(rowData);
		}
		return true;
	}

		/**
	 * Creates expansion content based on the provided structure.
	 *
	 * @param {object} listStruct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObj The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateExpansionList(listStruct,mainIndex,cellObj,parentEl,path,rowData,_notYetCreated) {
		const listTable=parentEl.appendChild(document.createElement("table"));
		cellObj.containerEl=listTable.appendChild(document.createElement("tbody"));
		listTable.className="expansion-list";
		if (listStruct.titlesColWidth!=false) {
			let titlesCol=document.createElement("col");
			listTable.appendChild(document.createElement("colgroup")).appendChild(titlesCol);
			if (listStruct.titlesColWidth!=null)
				titlesCol.style.width=listStruct.titlesColWidth;
		}
		return this._generateExpansionCollection(listStruct,mainIndex,cellObj,parentEl,path,rowData);
	}

	/**
	 * Creates expansion content based on the provided structure.
	 *
	 * @param {object} lineupStruct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObject The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateExpansionLineup(lineupStruct,mainIndex,cellObj,parentEl,path,rowData,_notYetCreated) {
		cellObj.containerEl=parentEl.appendChild(document.createElement("div"));
		cellObj.containerEl.classList.add("lineup","collection",...lineupStruct.cssClass?.split(" ")??[]);
		return this._generateExpansionCollection(lineupStruct,mainIndex,cellObj,parentEl,path,rowData);
	}

	/**
	 * Generates a "context"-entry.
	 * A context entry does not produce its own visible container but instead
	 * changes the data scope to a nested object on the current row.
	 * Its child entries are then generated using this nested object as their data source.
	 * @param {object} contextStruct Structure object defining what to create.
	 * @param {number} mainIndex Index of the main data row that this expansion belongs to.
	 * @param {object} cellObject The object representing the cell that is being created.
	 * @param {HTMLElement} parentEl The parent element to which the created elements should be appended.
	 * @param {number[]} path Keeps track of the "path" by adding and removing index numbers when entering and leaving 
	 * 		nesting levels. This path is added as a data attribute to interactive cells so that the corresponding cell
	 * 		object can later be retrieved.
	 * @param {object} rowData The actual data object that this expansion is representing.
	 * @param {boolean} notYetCreated True if the cellObj points to data within objects that do not yet exist.
	 * 		This happens when the context points to a data object that will be created when the user adds data.
	 * @returns {boolean} True if any content was created; false if nothing was created (for example, an empty repeated
	 * 		struct with no create option).
	 */
	_generateContext(contextStruct,mainIndex,cellObject,parentEl,path,rowData,notYetCreated) {
		if (!rowData[contextStruct.id]) {//if the structure point to data within objects that doesn't yet exist
			notYetCreated=true;
			rowData[contextStruct.id]={};
		}
		return this._generateExpansionContent(contextStruct.entry, mainIndex, cellObject, parentEl, path
			,rowData[contextStruct.id],notYetCreated);
	}
	

	_generateExpansionCollection(containerStruct,mainIndex,collectionObj,parentEl,path,rowData) {
		//allows for easily finding the outer-most parent of elements that are placed in collection
		collectionObj.containerEl.classList.add("collection");

		collectionObj.children=[];
		for (let entryI=-1,childStruct; childStruct=containerStruct.entries[++entryI];) {
			if (childStruct.type==="repeated") {
				const repeatData=rowData[childStruct.id]??(rowData[childStruct.id]=[]);
				const rptCelObj=collectionObj.children[entryI]={parent:collectionObj,index:entryI,children:[]
														,struct:childStruct,dataObj:repeatData,path:[...path,entryI]};
				rptCelObj.insertionPoint=collectionObj.containerEl.appendChild(document.createComment("repeat-insert"));
				childStruct.create&&this._generateRepeatedCreator(rptCelObj);
				repeatData?.forEach(repeatData=>this._repeatInsert(rptCelObj,false,repeatData));
			} else
				this._generateCollectionItem(childStruct,mainIndex,collectionObj,path,rowData);
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
	_buildCollectionItemDOM(struct,collection,itemObj,title) {
		let outerContainerEl,containerEl;
		const type=collection.struct.type;

		// LIST: Each item is a <tr> with title cell optionally + value cell
		if (type=="list") {
			outerContainerEl=document.createElement("tr");
			if (collection.struct.titlesColWidth!=false) {
				const td=outerContainerEl.insertCell();
				td.className="title";
				td.innerText=struct.title??"";
			}
			containerEl=outerContainerEl.insertCell();
		} else if (type=="lineup") {// LINEUP: Items rendered inline, outerContainerEl wraps title + inner content
			outerContainerEl=document.createElement("span");
			if (title)
				outerContainerEl.appendChild(title);
			containerEl=itemObj.selEl=outerContainerEl.appendChild(document.createElement("div"));
		} else if (type=="group") {//GROUP: More complex <tr> with special rules for empty/hiding and more
			outerContainerEl=document.createElement("tr");
			outerContainerEl.className="empty";		// Will be hidden while group is closed until content becomes non-empty

			const td=outerContainerEl.insertCell();
			td.classList.toggle("disabled",struct.type=="field"&&!struct.input);

			// Add separator for non-group members
			if (struct.type!="group")
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
	_insertCollectionItem(struct,index,itemObj,outerContainerEl,collectionOrRepeated,collectionEl) {
		let siblingAfter=null;

		// For repeated collections: determine the real insertion position based on insertionPoint
		if (collectionOrRepeated.struct.type=="repeated") {
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

		// Extra CSS class if defined in struct
		if (struct.cssClass)
			outerContainerEl.className+=" "+struct.cssClass;
	}
	
	

	/**
	 * Generate one item inside a collection or repeated block.
	 * Creates DOM, updates indices, generates inner content, and inserts into DOM
	 * only if expansion content was actually created (e.g., repeated with empty data should not add item).
	 */
	_generateCollectionItem(struct,mainIndex,collectionOrRepeated,path,data,index=null) {
		// Determine actual collection (repeated uses parent collection visually)
		const collection=collectionOrRepeated.struct.type=="repeated"?collectionOrRepeated.parent:collectionOrRepeated;

		const collectionEl=collection.containerEl;
		index??=collectionOrRepeated.children.length;

		// Item object (holds metadata for this item)
		const itemObj=Object.assign(Object.create(null),{parent:collectionOrRepeated,index:index});

		// Optional title element
		let title;
		if (struct.title) {
			title=document.createElement("span");
			title.className="title";
			title.innerHTML=struct.title;
		}

		// Build DOM structure for this item
		const {outerContainerEl,containerEl}=this._buildCollectionItemDOM(struct,collection,itemObj,title);


		// Visual CSS classes
		if (struct.input&&struct.input.type!="button")
			containerEl.classList.add("input-cell");
		containerEl.classList.add("value");
		if (struct.input)
			outerContainerEl.classList.add((struct.input.type??"text")+"-container");

		// If inserting in middle: update sibling item indices
		if (index<collectionOrRepeated.children.length)
			for (let i=index-1,sibling; sibling=collectionOrRepeated.children[++i];)
				this._changeCellObjIndex(sibling,i+1);

		path.push(index);

		itemObj.outerContainerEl=outerContainerEl;//reference to outer-most container belonging exclusively to this item

		// Expand inner content; may return false if nothing should be rendered
		const generated=this._generateExpansionContent(struct,mainIndex,itemObj,containerEl,path,data,outerContainerEl);

		// Only insert if it actually has content (important for sparse repeated arrays)
		if (generated)
			this._insertCollectionItem(struct,index,itemObj,outerContainerEl,collectionOrRepeated,collectionEl);

		path.pop();
		return itemObj;
	}

	_generateField(fieldStruct,mainIndex,cellObject,parentEl,path,rowData) {
		cellObject.select=()=>this._selectExpansionCell(cellObject);
		cellObject.el=parentEl;
		this._updateExpansionCell(cellObject,rowData);
		cellObject[cellObject.selEl?"selEl":"el"].dataset.path=path.join("-");
		return true;
	}
	
	_spreadsheetMouseDown(e) {
		this._highlightOnFocus=false;//see decleration
		this.container.style.outline="none";//see #spreadsheetOnFocus
		this._tooltip.style.visibility="hidden";
		if (Date.now()<this._ignoreClicksUntil)//see decleration of #ignoreClicksUntil
			return;
		if (e.which===3)//if right click
			return;
		const mainTr=e.target.closest(".main-table>tbody>tr");
		if (this._onlyExpansion||mainTr?.classList.contains("expansion")) {//in expansion
			const interactiveEl=e.target.closest('[data-path]');
			if (!interactiveEl)
				return;
			let cellObject=this._openExpansions[mainTr?.dataset.dataRowIndex??0];
			for (let step of interactiveEl.dataset.path.split("-")) {
				cellObject=cellObject.children[step];
				if (cellObject.struct.type==="group"&&!cellObject.el.classList.contains("open"))
					break;
			}
			this._selectExpansionCell(cellObject);
		} else {//not in expansion
			const td=e.target.closest(".main-table>tbody>tr>td");
			if (td?.classList.contains("expand-col")||td?.classList.contains("select-col")) {
				if (e.shiftKey)
					e.preventDefault();//prevent text-selection when shift-clicking checkboxes
				if (this._mainRowIndex==null) {
					this._selectMainTableCell(td);
					this.container.focus({preventScroll:true});
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
			if (checked&&this._selectedRows.indexOf(this._data[i])==-1) {
				this._selectedRows.push(this._data[i]);
				this._numRowsSelected++;
				this._numRowsInViewSelected++;
			} else if (!checked&&this._selectedRows.indexOf(this._data[i])!=-1) {
				this._selectedRows.splice(this._selectedRows.indexOf(this._data[i]),1);
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
		if (this._numRowsInViewSelected==this._data.length||!this._numRowsInViewSelected) {
			checkbox.indeterminate=false;
			checkbox.checked=this._numRowsInViewSelected;
		} else
			checkbox.indeterminate=true;
		if (this._numRowsSelected^this._bulkEditAreaOpen) {
			this._bulkEditAreaOpen=!!this._numRowsSelected;
			this._bulkEditArea.style.height=this._bulkEditAreaOpen?this._bulkEditArea.firstChild.offsetHeight+"px":0;
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
		const maxHeight=this._activeStruct.maxHeight??Infinity;
		
		//__auto-resize__
		//first set height to auto.This won't make it auto-resize or anything but will rather set its height to about 40
		e.target.style.height="auto";
		//then set size of cellcursor, and also the underlying cell in order to make expansion-height adjust to scroll-
		//height of the textarea. Also add 1px because *sometimes* without logic the textarea would recieve a scrollbar
		//which can scroll about 1 px. Not sure if 1px is actually sufficent but let's start there.
		this._cellCursor.style.height=this._selectedCell.style.height=Math.min(maxHeight,e.target.scrollHeight+1)+"px";
		//now set height of textarea to 100% of cellcursor which height is set with above line. this line and the one
		//setting it to auto "could" be skipped but that will result in the textarea not shrinking when needed.
		e.target.style.height="100%";

		//need to call this to make the height of the expansion adjust and reflect the change in size of the textarea
		this._updateExpansionHeight(this._selectedCell.closest("tr.expansion"));
	}

	_updateExpansionHeight(expansionTr) {
		const contentDiv=expansionTr.querySelector(".content");
		const mainRowIndex=parseInt(expansionTr.dataset.dataRowIndex);
		contentDiv.style.height="auto";//set to auto in case of in middle of animation, get correct height
		const prevRowHeight=this._rowMetaGet(mainRowIndex).h;
		const newRowHeight=this._rowHeight+expansionTr.offsetHeight+this._borderSpacingY;
		this._rowMetaSet(mainRowIndex,"h",newRowHeight);
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
		input.placeholder=this._activeStruct.input.placeholder??this._opts.lang?.datePlaceholder??"YYYY-MM-DD";
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
	_alignDropdown(dropdown,target=this._cellCursor) {

		const alignmentContainer=this._dropdownAlignmentContainer;//container of the dropdown
		const alignmentPos=this._getElPos(target);//and its position inside
		
		//if target-element is below middle of viewport or if in bulk-edit-area
		dropdown.classList.remove("above","below","left","right");
		if (alignmentPos.y+target.clientHeight/2>alignmentContainer.scrollTop+alignmentContainer.clientHeight/2) {
			//then place dropdown above target-element
			dropdown.style.top=alignmentPos.y-dropdown.offsetHeight+"px";
			dropdown.classList.add("above");
		} else {
			//else place dropdown below target-element
			dropdown.style.top=alignmentPos.y+target.clientHeight+"px";
			dropdown.classList.add("below");
		}

		//if there's enough space to the right of target-element
		if (alignmentContainer.clientWidth-alignmentPos.x>dropdown.offsetWidth) {
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
		if (this._activeStruct.input) {
			e.preventDefault();//prevent text selection upon entering editmode
			if (this._activeStruct.input.type==="button")
				return this._activeExpCell.el.click();
			this._inputVal=this._selectedCellVal;
			this._inEditMode=true;
			this._cellCursor.classList.add("edit-mode");
			({textarea:this._openTextAreaEdit,date:this._openDateEdit,select:this._openSelectEdit
				,file:this._openFileEdit}[this._activeStruct.input.type]??this._openTextEdit).call(this,e);
		} else if (this._activeStruct.type==="group") {
			this._openGroup(this._activeExpCell);
		}
	}

	_openGroup(groupObj) {
		let doOpen=true;
		groupObj.struct.onOpen?.({preventDefault:()=>doOpen=false},groupObj);
		if (!doOpen)
			return;
		groupObj.el.classList.add("open");
		this._selectExpansionCell(this._getFirstSelectableExpansionCell(groupObj,true,true));
		groupObj.struct.onOpenAfter?.(groupObj);
		
	}

	_closeGroup(groupObject) {
		if (groupObject.creating&&!this._closeRepeatedInsertion(groupObject))
			return false;
		groupObject.el.classList.remove("open");
		this._ignoreClicksUntil=Date.now()+500;
		if (groupObject.updateRenderOnClose) {//if group is flagged for having its closed-render updated on close
			delete groupObject.updateRenderOnClose;//delete the flag so it doesn't get triggered again
			let cell,renderText;
			//look for ancestor-cell with rowData which repeated rows have. It's a sub-data-row of #data.
			//if we got all the way to the root without finding any repeated-rows then use datarow directly from #data
			for (cell=groupObject.parent;!cell.dataObj&&cell.parent;cell=cell.parent);//look for ancestor with rowData
			renderText=groupObject.struct.closedRender(groupObject.dataObj);
			groupObject.el.rows[groupObject.el.rows.length-1].cells[0].innerText=renderText;
		}
		groupObject.struct.onClose?.(groupObject);
		return true;
	}

	_repeatInsert(repeated,creating,data,entryStruct=null) {
		//normally entryStruct should be the entry of repeated, but struct can be supplied for creating creation-entries
		entryStruct??=repeated.struct.entry;

		let indexOfNew,rowIndex;
		if (!creating&&repeated.struct.sortCompare&&!entryStruct.creator) {
			for (indexOfNew=0;indexOfNew<repeated.children.length-!!repeated.struct.create; indexOfNew++)
				if (repeated.struct.sortCompare(data,repeated.children[indexOfNew].dataObj)<0)
					break;
		} else
			indexOfNew=repeated.children.length-(repeated.struct.create&&!entryStruct.creator)//place before creator;
		for (let root=repeated.parent; root.parent; root=root.parent,rowIndex=root.rowIndex);//get main-index
		let struct=repeated.struct;
		if (struct.create&&entryStruct.type==="group")
			(struct={...struct}).entry=this._structCopyWithDeleteButton(entryStruct,this._repeatedOnDelete);
			//copy repeat-struct not to edit orig. Then add delete-controls to its inner group which also gets copied.
		const newObj=this._generateCollectionItem(struct.entry,rowIndex,repeated,repeated.path,data,indexOfNew);
		if (creating) {
			newObj.creating=true;//creating means it hasn't been commited yet.
			this._selectFirstSelectableExpansionCell(newObj,true,true);
			repeated.struct.onCreateOpen?.(repeated);
		}
		return newObj.el;
	}

	_changeCellObjIndex(cellObj,newIndex) {
		cellObj.index=newIndex;
		const level=cellObj.path.length-1;
		for (const pathEl of cellObj.el.parentElement.querySelectorAll('[data-path]')) {
			const path=pathEl.dataset.path.split("-");
			path[level]=newIndex;
			pathEl.dataset.path=path.join("-");
		}
		fixObjPath(cellObj,newIndex);
		function fixObjPath(cellObj) {
			if (cellObj.path)
				cellObj.path[level]=newIndex;
			cellObj.children?.forEach(fixObjPath);
		}
	}

	_deleteCell(cellObj,programatically=false) {
		let newSelectedCell;
		for (let i=cellObj.index,otherCell; otherCell=cellObj.parent.children[++i];)
			this._changeCellObjIndex(otherCell,i-1)
		if (cellObj.parent.children.length>=cellObj.index+1)
			newSelectedCell=cellObj.parent.children[cellObj.index+1];
		else if (cellObj.parent.children.length>1)
			newSelectedCell=cellObj.parent.children[cellObj.index-1];
		cellObj.parent.children.splice(cellObj.index,1);
		if (!programatically)
			cellObj.parent.dataObj.splice(cellObj.index,1);
		if (cellObj.parent.struct.type==="repeated"&&cellObj.parent.parent.struct.type==="list")
			cellObj.el.parentElement.parentElement.remove();
		else
			cellObj.el.parentElement.remove();
		this._activeExpCell=null;//causes problem otherwise when #selectExpansionCell checks old cell
		if (!programatically)
			this._selectExpansionCell(newSelectedCell??cellObj.parent.parent);
		cellObj.creating&&cellObj.parent.struct.onCreateCancel?.(cellObj.parent);
	}

	_openTextEdit() {
		const input=this._cellCursor.appendChild(document.createElement("input"));
		input.addEventListener("blur",()=>setTimeout(this._exitEditMode.bind(this,true)));
		input.addEventListener("change",()=>this._inputVal=input.value);
		input.value=this._selectedCellVal??"";
		if (this._activeStruct.input.format)
			this._attachInputFormatter(input,this._activeStruct.input.format);
		input.focus();
		if (this._activeStruct.input.maxLength)
			input.maxLength=this._activeStruct.input.maxLength;
		input.placeholder=this._activeStruct.input.placeholder??"";
	}

	_mapAdd(map,key,val) {
		map.keys.push(key);
		map.vals.push(val);
	}

	_mapGet(map,key) {
		const index=map.keys.indexOf(key);
		if (index!=-1)
			return map.vals[index];
	}

	_mapRemove(map,key) {
		const index=map.keys.indexOf(key);
		map.keys.splice(index,1);
		map.vals.splice(index,1);
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
	 * the expansion cell is re-selected.
	 */
	_openFileEdit() {
		window.getSelection().empty();
	
		const fileDiv = this._cellCursor.appendChild(document.createElement("div"));
		fileDiv.classList.add("file");
		fileDiv.tabIndex = 0;
		fileDiv.focus();
	
		const fileInput = fileDiv.appendChild(document.createElement("input"));
		fileInput.type = "file";
	
		fileDiv.innerHTML = this._opts.lang?.fileChooseOrDrag ?? "<b>Press to choose a file</b> or drag it here";
	
		const dropDiv = fileDiv.appendChild(document.createElement("div"));
		dropDiv.classList.add("drop");
		dropDiv.innerHTML = this._opts.lang?.fileDropToUpload ?? "Drop to upload";
	
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
	 *      cell’s struct, allowing full customization of how the file
	 *      is handled on the server side.
	 *   5. Sends the file using multipart/form-data via FormData.
	 *
	 * After initiating the upload:
	 *   - The cell exits edit mode.
	 *   - The original expansion cell is automatically re-selected.
	 *
	 * This method does not handle UI creation — only the upload workflow
	 * and progress bookkeeping.
	 */
	_processFileUpload(file) {
		this._inputVal = file;
	
		const meta = Object.assign(Object.create(null), {uploadedBytes: 0,bars: []});
		this._mapAdd(this._filesMeta, file, meta);
	
		const xhr = new XMLHttpRequest();
	
		xhr.upload.addEventListener("progress", e => {
			for (let i = 0; i < meta.bars.length; i++) {
				const bar = meta.bars[i];
				if (!bar.isConnected) {
					meta.bars.splice(i--, 1);
					continue;
				}
				meta.uploadedBytes = e.loaded;
				const pct = parseInt(e.loaded / e.total * 100);
				bar.style.width = bar.firstChild.innerText = pct + "%";
			}
		});
	
		this._activeStruct.input.fileUploadHandler?.(xhr,file,this._activeStruct,this._cellCursorDataObj,
			this._mainRowIndex,this._activeExpCell);
	
		xhr.addEventListener("load", () => {
			this._mapRemove(this._filesMeta, file);
			for (const bar of meta.bars)
				if (bar.isConnected) {
					bar.parentElement.classList.remove("active");
					bar.firstChild.innerText = this._opts.lang?.fileUploadDone ?? "Done!";
				}
		});
	
		const formData = new FormData();
		formData.append("file", file);
		xhr.send(formData);
	
		this._exitEditMode(true);
		this._selectExpansionCell(this._activeExpCell);
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
		if (this._activeStruct.input.maxLength)
			textarea.maxLength=this._activeStruct.input.maxLength;
		textarea.placeholder=this._activeStruct.input.placeholder??"";
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
			ul.innerHTML="";
			for (const opt of opts) {
				const li=ul.appendChild(document.createElement("li"));
				if (opt.cssClass)
					li.className=opt.cssClass;
				li.innerText=opt.text;
				if ((selectedVal==opt.value)||selectedVal==opt) {
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
				ctx.looseOpts.splice(0,Infinity,...ctx.strctInp.options);
			for (let i=-1,opt; opt=ctx.looseOpts[++i];)
				if (!opt.text.includes(value)||opt.pinned)
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
				ctx.creationLi.innerText=`Create [${ctx.filterText}]`;
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
		 * @param {Object} strctInp the input-definition object from the active cell struct
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
			noResults.innerHTML=strctInp.noResultsText??this._opts.lang?.selectNoResultsFound??"No results found";
			noResults.className="no-results";
			for (const opt of strctInp.options)
				(opt.pinned?pinnedOpts:looseOpts).push(opt);
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
				creationLi:null,
				canCreate:false,
				filterText:"",
				highlightLiIndex:null,
				highlightUlIndex:null,
				windowMouseDown:null
			});
			return ctx;
		}
	
		/**
		 * Close the select dropdown, update the current value (including create-new if applicable) and clean up listeners.
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
				ctx.strctInp.createNewOptionHandler?.(this._inputVal,e,this._cellCursorDataObj,this._mainRowIndex
																,this._activeStruct,this._activeExpCell);
			} else
				this._inputVal=(ctx.highlightUlIndex?ctx.looseOpts:ctx.pinnedOpts)[ctx.highlightLiIndex];
			ctx.selectContainer.remove();
			if (ctx.windowMouseDown)
				window.removeEventListener("mousedown",ctx.windowMouseDown);
		}
	
		/**
		 * Open edit mode for a cell that uses a select-input: creates the dropdown UI,
		 * wires up filtering, keyboard navigation and mouse interaction, and focuses the input.
		 */
		_openSelectEdit() {
			const strctInp=this._activeStruct.input;
			this._inputVal=this._cellCursorDataObj[this._activeStruct.id];
			const ctx=this._createSelectDropdownContext(strctInp);
			this._cellCursor.style.backgroundColor="transparent";
			if (strctInp.allowCreateNew||ctx.looseOpts.length>=(strctInp.minOptsFilter??this._opts.defaultMinOptsFilter??5))
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
		const doCommit=this._activeStruct.input.validation(newVal,m=>message=m,this._activeStruct
												,this._cellCursorDataObj,this._mainRowIndex,this._activeExpCell);
		if (doCommit)
			return true;
		input.focus();
		if (message)
			this._showTooltip(message);
	}

	/**
	 * Updates dependent cells when a cell's value changes.
	 *
	 * This method propagates changes from a modified cell to its dependent cells,
	 * ensuring that the dependent cells are updated accordingly. It traverses the
	 * hierarchical structure of cells and updates both expansion cells and main-row
	 * cells as needed.
	 *
	 * @param {string} editedCellStruct - The unique identifier (autoId) of the cell that was edited.
	 * @param {Object} [editedCellObj] - The object representing the edited cell. This is used to determine
	 *                                   the closest scope for dependency updates.
	 */
	_updateDependentCells(editedCellStruct, editedCellObj) {
		for (const depPath of editedCellStruct.dependencyPaths??[])
			if (depPath[0]==="m") {//if cell is in main row cell
				// Find the corresponding table row for the main data row
				const tr=this._mainTbody.querySelector(`[data-data-row-index="${this._mainRowIndex}"]:not(.expansion)`);
				// Update the content of the dependent cell in the main table
				this._updateMainRowCell(tr.cells[depPath[1]], this._colStructs[depPath[1]]);
			} else if (this._openExpansions[this._mainRowIndex]) {//if cell is in expansion and expansion is open
				//cells is an array that potentially can hold more than 1 cell. The reason is that when going into
				//repeated structures, it "splits" into multiple cells if there are multiple repeated-entries/instances
				let cells=depPath[0]==="r"?[editedCellObj]:[this._openExpansions[this._mainRowIndex]];

				for (var step=1; depPath[step]===".."; step++)//if there are any, iterate all the ".."
					cells[0] = cells[0].parent;//go up one level per "..". At this point cells will only have one cell

				for (; step<depPath.length; step++) {//iterate the steps
					if (cells[0].struct.type==="repeated") {
						const newCells=[];//will hold the new set of cells after this step
						for (const cell of cells)
							newCells.push(...cell.children);//add all repeated-children of current cell
						cells=newCells;//set cells to the new set of cells
					}
					for (let cellI=0; cellI<cells.length; cellI++)//iterate the cell(s)
						cells[cellI]=cells[cellI].children[depPath[step]];//and do the step
				}
				for (const cell of cells)//iterate the cell(s) again
					this._updateExpansionCell(cell,cell.dataObj);//and do the actual update
			}
	}

	_exitEditMode(save) {
		if (!this._inEditMode)
			return true;	
		const input=this._cellCursor.querySelector("input");
		if (this._activeStruct.input.format?.stripDelimiterOnSave&&this._activeStruct.input.format.delimiter)
			input.value=input.value.replaceAll(this._activeStruct.input.format.delimiter, "");
		if (this._activeStruct.input.validation&&save&&!this._validateInput(input.value))
			return false;
		//make the table focused again so that it accepts keystrokes and also trigger any blur-event on input-element
		this.container.focus({preventScroll:true});//so that #inputVal gets updated-


		this._inEditMode=false;
		this._cellCursor.classList.remove("edit-mode");
		if (save&&this._inputVal!=this._selectedCellVal) {
			this._doEditSave();
		}
		this._cellCursor.innerHTML="";
		//if (this._activeStruct.input.type==="textarea")//also needed for file..
		this._adjustCursorPosSize(this._selectedCell);
		this._highlightOnFocus=false;
		return true;
	}

	_showTooltip(message,target=this._cellCursor) {
		this._cellCursor.parentElement.appendChild(this._tooltip);
		setTimeout(()=>this._tooltip.style.visibility="visible");//set it on a delay because mouseDownHandler might
						//otherwise immediately set it back to hidden when bubbling up depending on where the click was
		this._tooltip.firstChild.innerText=message;
		this._alignDropdown(this._tooltip,target);
		this._scrollElementIntoView(this._tooltip);
		return true;
	}

	_scrollElementIntoView(){}//default is to do nothing. Tablance (main) overrides this.

	_closeRepeatedInsertion(repeatEntry) {
		if (Object.values(repeatEntry.dataObj).filter(x=>x!=null).length) {
			let message;//message to show to the user if creation was unsucessful
			for (var root=repeatEntry; root.parent; root=root.parent);//get root-object in order to retrieve rowIndex
			let doCreate=true;
			if (repeatEntry.struct.creationValidation)
				doCreate=repeatEntry.struct.creationValidation(m=>message=m,repeatEntry.struct,repeatEntry.dataObj
																						,root.rowIndex,repeatEntry);
			if (!doCreate) {
				if (message)
					this._showTooltip(message,repeatEntry.el);
				return false;//prevent commiting/closing the group
			}
			repeatEntry.creating=false;
			const creationContainer=repeatEntry.struct.type=="group"?repeatEntry:repeatEntry.parent;
			creationContainer.struct.onCreate?.
								(repeatEntry.dataObj,this._data[root.rowIndex],creationContainer.struct,repeatEntry);
		} else {
			this._deleteCell(repeatEntry);
			return false;
		}
		return true;
	}

	_closeActiveExpCell() {
		if (this._activeExpCell) {
			for (let oldCellParent=this._activeExpCell; oldCellParent=oldCellParent.parent;) {
				if (oldCellParent.struct.type==="group") {
					if (!this._closeGroup(oldCellParent))//close any open group above old cell
						return false;
					this._ignoreClicksUntil=Date.now()+500;
				}
				
				oldCellParent.struct.onBlur?.(oldCellParent,this._mainRowIndex);
			}
			this._activeExpCell=null;//should be null when not inside expansion
		}
		return true;
	}


	_selectMainTableCell(cell) {
		if (!cell)	//in case of trying to move up from top row etc,
			return;
		this._mainColIndex=cell.cellIndex;
		const mainRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);//save it here rather than setting it 
					//directly because we do not want it to change if #selectCell returns false, preventing the select
		if (this._exitEditMode(true)&&this._closeActiveExpCell()) {
			this._selectCell(cell,this._colStructs[this._mainColIndex],this._data[mainRowIndex]);
			this._mainRowIndex=mainRowIndex;
		}
	}

	_selectExpansionCell(cellObj) {
		if (!cellObj)
			return;

		const oldExpCell=this._activeExpCell;//need to know the current/old expansion-cell if any for closing groups
					//etc but we can't just use this._activeExpCell because #selectCell changes it and we do want
					//to call #selectCell first in order to know if changing cell is being prevented by validation()

		if (!this._exitEditMode(true))
			return false;

		for (var root=cellObj; root.parent; root=root.parent);
		const mainRowIndex=root.rowIndex;
		if (oldExpCell)//changing from an old expansionCell
			for (let oldParnt=oldExpCell; oldParnt=oldParnt?.parent;)//traverse parents of old cell
				if(oldParnt.struct.type==="group"||oldParnt.struct.onBlur||oldParnt.creating){//found a group or cell
					//...with onBlur or cell that is being created. For any of these we want to observe the cell being
					//left so that appropriate action can be taken
					for (let newParent=cellObj; newParent=newParent.parent;)//traverse parents of new cell
						if (newParent===oldParnt) {//if this new parent-group is also part of old parents
							oldParnt=null;//break out of outer loop
							break;
						}
					if (oldParnt) {
						if (oldParnt.struct.type==="group"&&!this._closeGroup(oldParnt))
							return false;
						if (oldParnt.struct.onBlur)
							oldParnt.struct.onBlur?.(oldParnt,mainRowIndex);
					}
				}
		this._selectCell(cellObj.selEl??cellObj.el,cellObj.struct,cellObj.dataObj,false);
		this._mainRowIndex=mainRowIndex;

		//in case this was called through cellObject.select() it might be necessary to make sure parent-groups are open
		for (let parentCell=cellObj; parentCell=parentCell.parent;)
			if (parentCell.struct.type=="group")
				parentCell.el.classList.add("open");

		this._adjustCursorPosSize(cellObj.selEl??cellObj.el);
		this._activeExpCell=cellObj;
		return cellObj;
	}

	_selectCell(cellEl,struct,dataObj,adjustCursorPosSize=true) {
		this.container.focus({preventScroll:true});
		if (adjustCursorPosSize)
			this._adjustCursorPosSize(cellEl);
		this._cellCursor.classList.toggle("expansion",cellEl.closest(".expansion"));
		this._cellCursor.classList.toggle("disabled",cellEl.classList.contains("disabled"));
		(this._scrollingContent??this.container).appendChild(this._cellCursor);
		this._selectedCell=cellEl;
		this._activeStruct=struct;
		//make cellcursor click-through if it's on an expand-row-button-td, select-row-button-td or button
		const noPtrEvent=struct.type==="expand"||struct.type==="select"||struct.input?.type==="button";
		this._cellCursor.style.pointerEvents=noPtrEvent?"none":"auto";
		this._cellCursor.style.removeProperty("background-color");//select-input sets it to transparent, revert here
		this._cellCursorDataObj=dataObj;
		this._selectedCellVal=dataObj?.[struct.id];
	}

	_getElPos(el,container) {
		const cellPos=el.getBoundingClientRect();
		if (!container)
			container=this._tableSizer??this.container;
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
		this._headerTable=this.container.appendChild(document.createElement("table"));
		this._headerTable.classList.add("header-table");
		const thead=this._headerTable.appendChild(document.createElement("thead"));
		this._headerTr=thead.insertRow();
		for (let col of this._colStructs) {
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
		if (this._colStructs[clickedIndex].type=="select"&&e.target.tagName.toLowerCase()=="input")
			return this._toggleRowsSelected(e.target.checked,0,this._data.length-1);
		if (e.target.closest(".expand-div"))
			return this._expandOrContractAll(!e.target.closest("tr").classList.contains("expanded"));
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
			const {id,type}=this._colStructs[clickedIndex];
			const sortCol={id,type,order:"asc",index:clickedIndex};
			if (!e.shiftKey)
				this._sortingCols=[];
			this._sortingCols.push(sortCol);
		}
		this._updateHeaderSortHtml();
		e.preventDefault();//prevent text-selection when shift-clicking and double-clicking
		this._sortData();
		this._refreshTable();
	}

	_expandOrContractAll(expand) {
		this._scrollBody.scrollTop=0;
		this._scrollMethod();
		let rows;
		if (expand) {
			rows=this._tableSizer.querySelectorAll(".main-table>tbody>tr:not(.expansion):not(.expanded)");
			for (const row of rows)
				this._expandRow(row);
			for (const dataRow of this._data) {
				const index=this._rowsMeta.keys.indexOf(dataRow);
				if (index!=-1) {
					this._rowsMeta.vals[index].h??=-1;
				} else {
					this._rowsMeta.keys.push(dataRow);
					this._rowsMeta.vals.push({h:-1});
				}
			}

		}
		

		//#expandRow(tr,dataRowIndex) {
	}

	_updateHeaderSortHtml() {
		for (let [thIndex,th] of Object.entries(this._headerTr.cells)) {
			if (thIndex==this._headerTr.cells.length-1)
				break;
			let order=null;
			let sortDiv=this._colStructs[thIndex].sortDiv;
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

	_sortData() {
		const sortCols=this._sortingCols;
		if (!sortCols.length)
			return false;
		this._data.sort(compare.bind(this));
		if (this._mainRowIndex>=0)//if there is a selected row
			this._mainRowIndex=this._data.indexOf(this._cellCursorDataObj);//then find it's new pos
		return true;
		
		function compare(a,b) {
			for (let sortCol of sortCols) {
				if (sortCol.type==="expand") {
					let aV;
					if ((aV=!!this._rowMetaGet(this._data.indexOf(a))?.h)!=!!this._rowMetaGet(this._data.indexOf(b))?.h)
						return (aV?-1:1)*(sortCol.order=="asc"?1:-1);
				} else if (sortCol.type==="select") {
					let aSel;
					if ((aSel=this._selectedRows.indexOf(a)!=-1)!=(this._selectedRows.indexOf(b)!=-1))
						return (aSel?-1:1)*(sortCol.order=="asc"?1:-1);
				} else if (a[sortCol.id]!=b[sortCol.id])
					return (a[sortCol.id]>b[sortCol.id]?1:-1)*(sortCol.order=="asc"?1:-1);
			}
		}
	}

	_createTableBody() {
		this._scrollBody=this.container.appendChild(document.createElement("div"));

		if (this._staticRowHeight&&!this._expansion)
			this._scrollMethod=this._onScrollStaticRowHeightNoExpansion;
		else if (this._staticRowHeight&&this._expansion)
			this._scrollMethod=this._onScrollStaticRowHeightExpansion;
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
		for (let i = 0; i < this._colStructs.length; i++) {
			let col=document.createElement("col");
			this._cols.push(col);
			this._mainTable.appendChild(document.createElement("colgroup")).appendChild(col);
		}
		this._borderSpacingY=parseInt(window.getComputedStyle(this._mainTable)['border-spacing'].split(" ")[1]);
	}

	_createBulkEditArea() {
		this._bulkEditArea=this.container.appendChild(document.createElement("div"));
		this._bulkEditArea.classList.add("bulk-edit-area");
		this._bulkEditArea.style.height=0;//start at height 0 before expanded
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
		const bulkEditStructs=[];

		//Build structs for bulk-edit-area based on columns and expansion. They will get placed in this._bulkEditStructs
		//and later used to create the actual inputs in the bulk-edit-area
		for (const struct of [...this._colStructs,this._expansion])
			bulkEditStructs.push(...this._buildBulkEditStruct(struct));

		const bulkStructTree={type:"lineup",entries:bulkEditStructs};
		this._bulkEditTable=new TablanceBulk(tableContainer,{},null,true,bulkStructTree,null,true);
		this._bulkEditTable.mainInstance=this;
		this._bulkEditTable.addData([{}]);
	}

	_isObject(val) {
		return val&&typeof val==="object"&&!Array.isArray(val);
	}

	/**Given a struct like expansion or column, will add inputs to this._bulkEditStructs which later is iterated
	 * and the contents added to the bulk-edit-area. 
	 * @param {*} struct Should be expansion or column when called from outside, but it calls itself recursively
	 * 						when hitting upon containers which then are passed to this param
	 * @returns */
	_buildBulkEditStruct(struct) {
		const main=this._colStructs.includes(struct);//Whether the struct is in expansion or not.
		const result=[];
		if ((main||struct.type=="field")&&struct.bulkEdit) {
			const structCopy=Object.assign(Object.create(null), struct);
			structCopy.type="field";//struct of columns don't need to specify this, but it's needed in expansion
			result.push(structCopy);
		} else if ((struct.bulkEdit||struct==this._expansion)&&struct.entries?.length) {
			for (const entryStruct of struct.entries)
				result.push(...this._buildBulkEditStruct(entryStruct));
		}
		return result;
	}

	/**Updates the displayed values in the bulk-edit-area */
	_updateBulkEditAreaCells(structsToUpdateCellsFor=this._bulkEditTable._expansion.entries) {
		const mixedText="(Mixed)";
		for (let multiCellI=-1, multiCellStruct; multiCellStruct=structsToUpdateCellsFor[++multiCellI];) {

			//work out if there are mixed values for this cell among the selected rows, or if all are same
			let mixed=false;
			let val,lastVal;
			for (let rowI=-1,row; row=this._selectedRows[++rowI];) {
				val=row[multiCellStruct.id];
				if (rowI&&val!=lastVal) {
					mixed=true;
					break;
				}
				lastVal=val;
			}


			//update both the data and the dom
			this._bulkEditTable.updateData(0,multiCellStruct.id,mixed?mixedText:val?.text??val??"");
			const el=this._bulkEditTable._openExpansions[0].children[multiCellI].el;
			el.innerText=mixed?mixedText:val?.text??val??"";
			this._bulkEditTable._data[0][multiCellStruct.id]=mixed?"":val;
		}
	}

	_updateSizesOfViewportAndCols() {
		if (this.container.offsetHeight!=this._containerHeight) {
			this._updateViewportHeight();
			if (this.container.offsetHeight>this._containerHeight)
				this._maybeAddTrs();
			else
				this._maybeRemoveTrs();
			this._containerHeight=this.container.offsetHeight;
		}
		this._updateColsWidths();

		this._headerTable.style.width=this._scrollBody.offsetWidth+"px";
		this._adjustCursorPosSize(this._selectedCell);
	}

	_updateColsWidths() {
		if (this.container.offsetWidth>this._containerWidth) {
			let areaWidth=this._tableSizer.offsetWidth;
			const percentageWidthRegex=/\d+%/;
			let totalFixedWidth=0;
			let numUndefinedWidths=0;
			for (let col of this._colStructs)
				if (!col.width)
					numUndefinedWidths++;
				else if (!percentageWidthRegex.test(col))//if fixed width
					totalFixedWidth+=(col.pxWidth=parseInt(col.width));
			let sumFixedAndFlexibleWidth=totalFixedWidth;
			for (let col of this._colStructs)
				if (col.width&&percentageWidthRegex.test(col))//if flexible width
					sumFixedAndFlexibleWidth+=(col.pxWidth=(areaWidth-totalFixedWidth)*parseFloat(col.width)/100);
			for (let col of this._colStructs)
				if (!col.width)//if undefined width
					col.pxWidth=(areaWidth-sumFixedAndFlexibleWidth)/numUndefinedWidths;
			for (var colI=0; colI<this._colStructs.length; colI++) 
				this._cols[colI].style.width=this._headerTr.cells[colI].style.width=this._colStructs[colI].pxWidth+"px";
			//last col is empty col with the width of table-scrollbar if its present in order to make the header span
			//the whole with while not actually using that last bit in the calculations for the normal cols
			this._headerTr.cells[colI].style.width=this._scrollBody.offsetWidth-areaWidth+"px";
		}
	}

	_filterData(filterString) {
		this._openExpansions={};
		this._rowsMeta={keys:[],vals:[]};
		for (const tr of this._mainTbody.querySelectorAll("tr.expansion"))
		 	tr.remove();
		this._filter=filterString;
		const colsToFilterBy=[];
		const selectsOptsByVal={};//for each col that is of the select type, a entry will be placed in this with the
			//col-index as key and an object as val. the object holds all the options but they are keyed by teir value
			//rather than being in an indexed array.This is to simplify and likely improve speed of filtering by the col

		for (let col of this._colStructs)
			if (col.type!=="expand"&&col.type!=="select") {
				if (col.input?.type=="select") {
					const optsByVal=selectsOptsByVal[colsToFilterBy.length]={};
					for (const opt of col.input.options)
						optsByVal[opt.value]=opt;
				}
				colsToFilterBy.push(col);
			}
		if (filterString) {
			this._data=[];
			for (let dataRow of this._allData)
				for (let colI=-1,col; col=colsToFilterBy[++colI];) {
					if (dataRow[col.id]!=null) {
						let match=false;
						if (col.input?.type=="select") {
							if (typeof dataRow[col.id]=="string")
								match=selectsOptsByVal[dataRow[col.id]].text.includes(filterString);
							else
								match=dataRow[col.id].text.includes(filterString);
						} else
							match=dataRow[col.id].includes(filterString);
						if (match) {
							this._data.push(dataRow);
							break;
						}
					}
				}
		} else
			this._data=this._allData;
		this._scrollRowIndex=0;
		this._refreshTable();
		this._refreshTableSizerNoExpansions();
	}

	_setDataForOnlyExpansion(data) {
		this._allData=this._data=[data[data.length-1]];
		this.container.innerHTML="";
		const expansionDiv=this.container.appendChild(document.createElement("div"));
		expansionDiv.classList.add("expansion");
		this._generateExpansionContent(this._expansion,0,this._openExpansions[0]={},expansionDiv,[],this._data[0]);
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

		//its position and size needs to be udated.Hide for now and let #updateRowValues or #renderExpansion add it back
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
	_onScrollStaticRowHeightNoExpansion() {
		const scrY=Math.max(this._scrollBody.scrollTop-this._scrollMarginPx,0);
		const newScrollRowIndex=Math.min(parseInt(scrY/this._rowHeight),this._data.length-this._mainTbody.rows.length);
		
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
		this._refreshTableSizerNoExpansions();
	}

	_onScrollStaticRowHeightExpansion(_e) {
		const newScrY=Math.max(this._scrollBody.scrollTop-this._scrollMarginPx,0);
		if (newScrY>parseInt(this._scrollY)) {//if scrolling down
			while (newScrY-parseInt(this._tableSizer.style.top)
			>(this._rowMetaGet(this._scrollRowIndex)?.h??this._rowHeight)) {//if a whole top row is outside
				if (this._scrollRowIndex+this._numRenderedRows>this._data.length-1)
					break;
				let topShift;//height of the row that is at the top before scroll and which will be removed which is the
																	// amount of pixels the whole table is shiftet by
				//check if the top row (the one that is to be moved to the bottom) is expanded
				if (topShift=this._rowMetaGet(this._scrollRowIndex)?.h) {
					delete this._openExpansions[this._scrollRowIndex];
					this._mainTbody.rows[1].remove();
				} else
					topShift=this._rowHeight;
				const dataIndex=this._numRenderedRows+this._scrollRowIndex;//the data-index of the new row

				//move the top row to bottom and update its values
				const trToMove=this._updateRowValues(this._mainTbody.appendChild(this._mainTbody.firstChild),dataIndex);

				//move the table down by the height of the removed row to compensate,else the whole table would shift up

				this._doRowScrollExp(trToMove,dataIndex,this._scrollRowIndex,-topShift);
				this._scrollRowIndex++;
			}
		} else if (newScrY<parseInt(this._scrollY)) {//if scrolling up
			while (newScrY<parseInt(this._tableSizer.style.top)) {//while top row is below top of viewport
				this._scrollRowIndex--;

				//check if the bottom row (the one that is to be moved to the top) is expanded
				if (this._rowMetaGet(this._scrollRowIndex+this._numRenderedRows)?.h) {
					delete this._openExpansions[this._scrollRowIndex+this._numRenderedRows];
					this._mainTbody.lastChild.remove();//remove the expansion-tr
				}

				let trToMove=this._mainTbody.lastChild;									//move bottom row to top
				this._mainTbody.prepend(trToMove);
				this._updateRowValues(trToMove,this._scrollRowIndex);//the data of the new row;

				//height of the row that is added at the top which is amount of pixels the whole table is shiftet by
				const topShift=this._rowMetaGet(this._scrollRowIndex)?.h??this._rowHeight;

				this._doRowScrollExp(trToMove,this._scrollRowIndex,this._scrollRowIndex+this._numRenderedRows,topShift);
			}
		}
		this._scrollY=newScrY;
	}

	/**Used by #onScrollStaticRowHeightExpansion whenever a row is actually added/removed(or rather moved)*/
	_doRowScrollExp(trToMove,newMainIndex,oldMainIndex,topShift) {
		const expansionHeight=this._rowMetaGet(newMainIndex)?.h;
		if (expansionHeight>0) {
			this._renderExpansion(trToMove,newMainIndex);
		} else if (expansionHeight==-1) {
			this._scrollBody.scrollTop+=this._expandRow(trToMove,false);
		} else
			trToMove.classList.remove("expanded");
		
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)+topShift+"px";
		this._tableSizer.style.top=parseInt(this._tableSizer.style.top)-topShift+"px";

		if (oldMainIndex===this._mainRowIndex) {//cell-cursor is on moved row
			this._selectedCell=null;
			for (let cell=this._activeExpCell; cell&&(cell=cell.parent);)
				if (cell.creating) {
					cell.creating=false;//otherwise cell.select() below will not work
					this._exitEditMode(false);//in case field is validated. Could prevent cell.select() too otherwise
					cell.parent.dataObj.splice(cell.parent.dataObj.indexOf(cell.dataObj),1);
					while (cell&&(cell=cell.parent))
						if (cell.select) {
							cell.select();
							break;
						}
				}
		}

		this._lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row. This is needed
		//in order to reassign the dom-element and such and also adjust the pos of the cellcursor in case
		//the pos of the cell is not the same due to sorting/filtering
	}
	

	/**This should be called on each row that is being scrolled into view that might hold the active cell in order
	 * to set #selectedCell to the correct element
	 * @param {HTMLTableRowElement} tr */
	_lookForActiveCellInRow(tr) {
		if (tr.dataset.dataRowIndex==this._mainRowIndex) {
			if (!this._activeExpCell)
				this._selectedCell=tr.cells[this._mainColIndex];
			else {//if inside expansion
				//generate the path to the cellObject in #activeExpansionCell by stepping through its parents to root
				let path=[];
				for (let cellObject=this._activeExpCell; cellObject.parent; cellObject=cellObject.parent)
					path.unshift(cellObject.index);
				//now follow the same path in the new #openExpansionNavMap[rowIndex], eg the cellObjects..
				let cellObject=this._openExpansions[this._mainRowIndex];
				for (let step of path)
					cellObject=cellObject.children[step];
				this._selectedCell=cellObject.el;
				this._activeExpCell=cellObject;//should be identical but this allows for the old one to be gc'd
			}
			this._adjustCursorPosSize(this._selectedCell);
		}
	}

	_refreshTableSizerNoExpansions() {	
		this._tableSizer.style.top=this._scrollRowIndex*this._rowHeight+"px";
		this._tableSizer.style.height=(this._data.length-this._scrollRowIndex)*this._rowHeight+"px";
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
		const dataLen=this._data.length;
		//if there are fewer trs than datarows, and if there is empty space below bottom tr
		while ((this._numRenderedRows-1)*this._rowHeight<scrH&&this._scrollRowIndex+this._numRenderedRows<dataLen) {
			lastTr=this._mainTable.insertRow();
			this._numRenderedRows++;
			for (let i=0; i<this._colStructs.length; i++) {
				const cell=lastTr.insertCell();
				const div=cell.appendChild(document.createElement("div"));//used to set height of cells
				div.style.height=this._rowInnerHeight||"auto";				
				if (this._colStructs[i].type==="expand") {
					div.appendChild(this._createExpandContractButton());
					cell.classList.add("expand-col");
				} else if (this._colStructs[i].type==="select") {
					div.appendChild(this._createCheckbox(true));
					cell.classList.add("select-col");
				}
			}
			this._updateRowValues(lastTr,this._scrollRowIndex+this._numRenderedRows-1);
			if (this._rowMetaGet(this._scrollRowIndex+this._numRenderedRows-1)?.h)
				this._renderExpansion(lastTr,this._scrollRowIndex+this._numRenderedRows-1);
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
			if (this._rowMetaGet(this._scrollRowIndex+this._numRenderedRows-1)?.h) {
				this._mainTbody.lastChild.remove();
				delete this._openExpansions[this._scrollRowIndex+this._numRenderedRows];
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
		const selected=this._selectedRows.indexOf(this._data[mainIndex])!=-1;
		tr.classList.toggle("selected",!!selected);
		for (let colI=0; colI<this._colStructs.length; colI++) {
			let td=tr.cells[colI];
			let colStruct=this._colStructs[colI];
			if (colStruct.type!="expand"&&colStruct.type!="select")
				this._updateMainRowCell(td,colStruct);
			else if (colStruct.type=="select")
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

	_generateFileCell(fileCellObj,cellEl,rowData,dataIndex) {
		const fileStruct=fileCellObj.struct;//struct of cellObj will get overwritten. Save reference here.
		fileCellObj.fileInputStruct=fileStruct;//saving this ref here which is used to revert with if user deletes file

		//define all the file-meta-props
		const lang=this._opts.lang??{};
		let metaEntries=[{type:"field",title:lang.fileName??"Filename",id:"name"},
			{type:"field",title:lang.fileLastModified??"Last Modified",id:"lastModified",render:date=>
			new Date(date).toISOString().slice(0, 16).replace('T', ' ')},
			{type:"field",title:lang.fileSize??"Size",id:"size",render:size=>this._humanFileSize(size)},
			{type:"field",title:lang.fileType??"Type",id:"type"}];
		for (let metaI=-1,metaName; metaName=["filename","lastModified","size","type"][++metaI];)
			if(!(fileStruct.input.fileMetasToShow?.[metaName]??this._opts.defaultFileMetasToShow?.[metaName]??true))
				metaEntries.splice(metaI,1);//potentially remove (some of) them
		//define the group-structure for the file
		
		const fileGroup=this._structCopyWithDeleteButton({type:"group",entries:[]},this._fileOnDelete);
		fileGroup.entries[0].entries.unshift({type:"field",input:{type:"button",btnText:"Open"
				,clickHandler:(e,file,mainIndex,struct,btnObj)=>{
					rowData??=this._data[mainIndex];
					fileStruct.input.openHandler?.(e,file,fileStruct,fileCellObj.dataObj,mainIndex,btnObj);
			}},
		});
		fileGroup.entries.push({type:"lineup",entries:metaEntries});
		
		const fileData=rowData[fileCellObj.struct.id];
		this._generateExpansionContent(fileGroup,dataIndex,fileCellObj,cellEl,fileCellObj.path,fileData);
		const fileMeta=this._mapGet(this._filesMeta,fileData);
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


	/**Updates the html-element of a cell inside an expansion. Also updates nonEmptyDescentants of the cell-object of 
	 * 	group-rows as well as toggling the empty-class of them. Reports back whether visibility has been changed.
	 * @param {*} cellObj */
	_updateExpansionCell(cellObj,rowData=null) {
		let cellEl=cellObj.el;
		if (cellObj.struct.maxHeight) {//if there's a maxHeight stated, which is used for textareas
			cellEl.innerHTML="";//empty the cell, otherwise multiple calls to this would add more and more content to it
			cellEl=cellEl.appendChild(document.createElement("div"));//then put a div inside and change cellEl to that
			cellEl.style.maxHeight=cellObj.struct.maxHeight;//then set its maxHeight
			cellEl.style.overflow="auto";//and male it scrollable
			//can't make td directly scrollable which is why the div is needed
		}
		for (var rootCell=cellObj;rootCell.parent;rootCell=rootCell.parent);
		const oldCellContent=cellEl.innerText;
		if (cellObj.struct.input?.type=="file"&&rowData[cellObj.struct.id]) {
			this._generateFileCell(cellObj,cellEl,rowData,rootCell.rowIndex);
		} else {
			if (cellObj.struct.visibleIf)
				this._applyVisibleIf(cellObj);
			this._updateCell(cellObj.struct,cellEl,cellObj.selEl,rowData,rootCell.rowIndex,cellObj);
			if (cellObj.struct.input?.type!=="button") {
				const newCellContent=cellEl.innerText;
				if (!newCellContent!=!oldCellContent) {
					for (let cellI=cellObj; cellI; cellI=cellI.parent)
						if (cellI.nonEmptyDescentants!=null)
							cellI.grpTr.classList.toggle("empty",!(cellI.nonEmptyDescentants+=newCellContent?1:-1));
					return true;
				}
			} else
				cellObj.el=cellObj.selEl=cellObj.el.querySelector("button");
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
		for (var i=0; i < path.length && path[i] === ".."; i++)
			target = target.parent;

		// Step 2: go down via the remaining indices
		for (; i < path.length; i++)
			target = target.children[path[i]];
		return target;
	}

	/**
	 * Gets the value of a cell, pointed to by its ID, or if it depends on another cell, gets that value. The value
	 * is the raw data from the data-object, not rendered.
	 * @param {*} struct 
	 * @param {*} rowData 
	 * @param {*} cellObj 
	 * @returns 
	 */
	_getTargetVal(idOverDependee,struct, cellObj, rowData=cellObj.dataObj) {
		if (idOverDependee&&struct.id)
			return rowData[struct.id];
		if (struct.dependsOnDataPath) {
			if (cellObj)
				for (var root=cellObj; root.parent; root=root.parent,rowData=root.dataObj);
			 return this._getValueByPath(rowData,struct.dependsOnDataPath);
		}
		if (struct.dependsOnCellPaths) {
			const dependee=this._resolveCellPaths(cellObj,struct.dependsOnCellPaths[0]);
			return dependee.dataObj[dependee.struct.id];
		}
		return rowData[struct.id];
	}
	

	_updateCell(struct,el,selEl,rowData,mainIndex,cellObj=null) {
		if (struct.input?.type==="button") {
			this._generateButton(struct,mainIndex,el,rowData,cellObj);
		} else {
			let newCellContent;
			if (struct.render||struct.input?.type!="select") {
				newCellContent=this._getTargetVal(true,struct, cellObj, rowData);
				if (struct.render)
					newCellContent=struct.render(newCellContent,rowData,struct,mainIndex,cellObj);
			} else { //if (struct.input?.type==="select") {
				let selOptObj=rowData[struct.id];
				if (selOptObj&&typeof selOptObj!=="object")
					selOptObj=rowData[struct.id]=struct.input.options.find(opt=>opt.value==rowData[struct.id]);
				newCellContent=selOptObj?.text??"";
			}
			let isDisabled=false;
			if (this._spreadsheet&&struct.type!=="expand") {
				const enabledFuncResult=struct.input?.enabled?.(struct,rowData,mainIndex,cellObj);
				if (!struct.input||enabledFuncResult==false||enabledFuncResult?.enabled==false)
					isDisabled=true;
			}
			(selEl??el).classList.toggle("disabled",isDisabled);
			if (struct.html)
				el.innerHTML=newCellContent??"";
			else
				el.innerText=newCellContent??"";
		}
	}

	/**Updates the html-element of a main-table-cell
	 * @param {*} cellEl 
	 * @param {*} colStruct */
	_updateMainRowCell(cellEl,colStruct) {
		cellEl.firstChild.innerHTML="";
		const mainIndex=cellEl.closest(".main-table>tbody>tr").dataset.dataRowIndex;
		this._updateCell(colStruct,cellEl.firstChild,cellEl,this._data[mainIndex],mainIndex);
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

/**
 * Secondary Tablance used for the bulk-edit area.
 * Reflects and updates selected rows in the main Tablance instance.
 */
class TablanceBulk extends TablanceBase {

	/** @type {Tablance} main tablance owning this bulk instance */
	mainInstance;
	_dropdownAlignmentContainer=this.container;
	constructor() {
		super(...arguments);
	}

	

	_doEditSave() {
		const inputVal=this._activeStruct.input.type==="select"?this._inputVal.value:this._inputVal;
		this._cellCursorDataObj[this._activeStruct.id]=this._inputVal;
		for (const selectedRow of this.mainInstance._selectedRows)
			selectedRow[this._activeStruct.id]=inputVal;
		for (const selectedTr of this.mainInstance._mainTbody.querySelectorAll("tr.selected"))
			this.mainInstance.updateData(selectedTr.dataset.dataRowIndex,this._activeStruct.id,inputVal,false,true);
		this._updateExpansionCell(this._activeExpCell,this._cellCursorDataObj);
	}
}

/**
 * Primary Tablance component representing the main interactive table.
 * Handles full data display, user interaction, editing, expansion, and rendering.
 */
export default class Tablance extends TablanceBase {
	constructor() {
		super(...arguments);
		this._dropdownAlignmentContainer=this._onlyExpansion?this.container:this._scrollBody;
	}
	
	_doEditSave() {
		let doUpdate=true;//if false then the data will not actually change in either dataObject or the html
		const inputVal=this._activeStruct.input.type==="select"?this._inputVal.value:this._inputVal;
		this._activeStruct.input.onChange?.({preventDefault:()=>doUpdate=false},this._activeStruct.id,
				inputVal,this._selectedCellVal,this._cellCursorDataObj,this._activeStruct,this._activeExpCell);
		if (doUpdate) {
			this._cellCursorDataObj[this._activeStruct.id]=this._inputVal;
			if (this._activeExpCell){
				const doHeightUpdate=this._updateExpansionCell(this._activeExpCell,this._cellCursorDataObj);
				if (doHeightUpdate&&!this._onlyExpansion)
					this._updateExpansionHeight(this._selectedCell.closest("tr.expansion"));
				for (let cell=this._activeExpCell.parent; cell; cell=cell.parent)
					if (cell.struct.closedRender)//found a group with a closed-group-render func
						cell.updateRenderOnClose=true;//update closed-group-render
			} else {
				this._updateMainRowCell(this._selectedCell,this._activeStruct);
				this._unsortCol(this._activeStruct.id);
			}
			if (this._selectedRows.indexOf(this._cellCursorDataObj)!=-1)//if edited row is checked/selected
				this._updateBulkEditAreaCells([this._activeStruct]);
			this._updateDependentCells(this._activeStruct,this._activeExpCell);
		} else
			this._inputVal=this._selectedCellVal;
		this._selectedCellVal=this._inputVal;
	}

	_scrollToCursor() {
		if (this._onlyExpansion)
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
		if (!this._expansion||this._rowMetaGet(dataRowIndex)?.h>0)
			return;
		const expRow=this._renderExpansion(tr,dataRowIndex);
		const expHeight=this._rowMetaSet(dataRowIndex,"h",this._rowHeight+expRow.offsetHeight+this._borderSpacingY);
		const contentDiv=expRow.querySelector(".content");
		if (!this._expBordersHeight)//see declarataion of _expansionTopBottomBorderWidth
			this._expBordersHeight=expHeight-contentDiv.offsetHeight;
		this._tableSizer.style.height=parseInt(this._tableSizer.style.height)//adjust scroll-height reflect change...
			+expHeight-this._rowHeight+"px";//...in height of the table
		if (animate) {
			this._unsortCol(null,"expand");
			contentDiv.style.transition="";
			contentDiv.style.height="0px";//start at 0
			setTimeout(()=>contentDiv.style.height=expHeight-this._expBordersHeight+"px");
			this._animate(()=>this._adjustCursorPosSize(this._selectedCell,true),500,"cellCursor");
		} else {
			contentDiv.style.transition="none";
			contentDiv.style.height=expHeight-this._expBordersHeight+"px";
		}
		return expHeight;
	}

	_contractRow(tr) {
		if (tr.classList.contains("expansion"))
			tr=tr.previousSibling;
		const dataRowIndex=parseInt(tr.dataset.dataRowIndex);
		if (dataRowIndex==this._mainRowIndex&&this._activeExpCell)
			this._exitEditMode(false);//cancel out of edit-mode so field-validation doesn't cause problems
		if (!this._expansion||!this._rowMetaGet(dataRowIndex)?.h)
			return;
		this._unsortCol(null,"expand");
		if (this._mainRowIndex==dataRowIndex&&this._activeExpCell) {//if cell-cursor is inside the expansion
			this._selectMainTableCell(tr.cells[this._mainColIndex]);//then move it out
			this._scrollToCursor();
		}
		const contentDiv=tr.nextSibling.querySelector(".content");
		if (contentDiv.style.height==="auto") {//if fully expanded
			contentDiv.style.height=this._rowMetaGet(dataRowIndex).h-this._expBordersHeight+"px";
			setTimeout(()=>contentDiv.style.height=0);
		} else if (parseInt(contentDiv.style.height)==0)//if previous closing-animation has reached 0 but transitionend 
		//hasn't been called yet which happens easily, for instance by selecting expand-button and holding space/enter
			contentDiv.dispatchEvent(new Event('transitionend'));
		else//if in the middle of animation, either expanding or contracting. make it head towards 0
			contentDiv.style.height=0;
		this._animate(()=>this._adjustCursorPosSize(this._selectedCell,true),500,"cellCursor");
	}

	_scrollElementIntoView(element) {
		if (!this._onlyExpansion) {
			const pos=this._getElPos(element);
			this._scrollBody.scrollTop=pos.y+element.offsetHeight/2-this._scrollBody.offsetHeight/2;
			this._scrollMethod();
		} else
			this._tooltip.scrollIntoView({behavior:'smooth',block:"center"});
	}

	_applyVisibleIf(cellObj,mainIndex) {
		const struct=cellObj.struct;
		let val=this._getTargetVal(false,struct,cellObj);
		if (struct.input?.type==="select"&&val.value)
			val=val.value;
		if (!struct.visibleIf(val,cellObj.dataObj,struct,mainIndex,cellObj)) {//if hide
			cellObj.hidden=true;
			cellObj.outerContainerEl.style.display="none";
		}
		return !cellObj.hidden;
	}
}

