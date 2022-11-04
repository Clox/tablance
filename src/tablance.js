class Tablance {
	#container;//container-element for table
	#containerHeight=0;//height of #container. Used to keep track of if height shrinks or grows
	#containerWidth=0;//height of #container. Used to keep track of if width shrinks or grows
	#colStructs=[];//column-objects. See columns-param in constructor for structure.
		//In addition to that structure these may also contain "sortDiv" reffering to the div with the sorting-html
																				//(see for example opts->sortAscHtml)
	#cols=[];//array of col-elements for each column
	#headerTr;//the tr for the top header-row
	#headerTable;//the tabe for the #headerTr. This table only contains that one row.
	_allData=[];//contains all, unfiltered data that has been added via addData()
	#data=[];//with no filter applied(empty seachbar) then this is reference to _allData, otherwise is a subset of it
	#scrollRowIndex=0;//the index in the #data of the top row in the view
	#scrollBody;//resides directly inside #container and is the element with the scrollbar. It contains #scrollingDiv
	#scrollingContent;//a div that is inside #scrollbody and holds #tablesizer and #cellCursor if spreadsheet
					//this is needed because putting #cellCursor directly inside #scrollBody will not make it scroll
					//because it has position absolute and needs that. And putting it inside #tableSizer will cause it
					//to jump up and down when pos and height of #tableSizer is adjusted to keep correct scroll-height
	#tableSizer;//a div inside #scrollingDiv which wraps #mainTable. The purpose of it is to set its height to the 
				//"true" height of the table so that the scrollbar reflects all the data that can be scrolled through
	#mainTable;//the actual main-table that contains the actual data. Resides inside #tableSizer
	#mainTbody;//tbody of #mainTable
	#borderSpacingY;//the border-spacing of #mainTable. This needs to be summed with offsetHeight of tr (#rowHeight) to 
					//get real distance between the top of adjacent rows
	#rowHeight=0;//the height of (non expanded) rows with #borderSpacingY included. Assume 0 first until first row added
	#rowInnerHeight=0;//this is the height that the div inside main-tds should be set to. It's calculated from 
					//#rowHeight minus top&bottom-padding minus #borderSpacingY of td. This is needed to make sure each
					//row is always of the same height and things don't get messed up because some row is heigher
					//because it has high content.
	#staticRowHeight;//This is set in the constructor. If it is true then all rows should be of same height which
					 //improves performance.
	#spreadsheet;//whether the table is a spreadsheet, which is set in the constructor
	#opts; //reference to the object passed as opts in the constructor
	#sortingCols=[];//contains data on how the table currently is sorted. It is an array of 
										//objects which each contain "index" which is the index of the column and
										//"order" which value should be either "desc" or "asc". The array may contain
										//multiple of these objects for having it sorted on multiple ones.
	#searchInput;//the input-element used for filtering data
	#filter;//the currently applied filter. Same as #searchInput.value but also used for comparing old & new values
	
	#cellCursor;//The element that for spreadsheets shows which cell is selected
	#mainRowIndex;//the index of the row that the cellcursor is at
	#mainColIndex;//the index of the column that the cellcursor is at
	#activeStruct;//reference to the struct-object of the selcted cell. For cells in the maintable this would
							//point to an object in #colStructs, otherwise to the struct-object of expansion-cells
	#cellCursorDataObj;//reference to the actual object holding the data that the cell-cursor currently is at.
						//Usually this will simply point to an object in #data but for data that is nested with
						//repeat-entries this will point to the correct inner object
	#selectedCellVal;//the value of the cell that the cellCursor is at
	#selectedCell;//the HTML-element of the cell-cursor. probably TD's most of the time.
	#inEditMode;//whether the user is currently in edit-mode
	#cellCursorBorderWidths={};//This object holds the border-widths of the cell-cursor. keys are left,right,top,bottom
	//and values are px as ints. This is used to offset the position and adjust position of #cellCursor in order to
	//center it around the cell. It is also used in conjunction with cellCursorOutlineWidth to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#cellCursorOutlineWidth;//px-width as int, used in conjunction with #cellCursorBorderWidths to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#inputVal;//the current val of the input when in edit-mode. Will be read and commited if cell is exited correctly
	#highlightOnFocus=true;//when the spreadsheet is focused  we want focus-outline to appear but only if focused by
				//keyboard-tabbing, and not when clicking or exiting out of edit-mode which again focuses the table.
				//By setting this to true in mouseDownEvent we can 
				//check which input was used last when the focus-method is triggerd
	#expansion;//the expansion-argument passed to the constructor
	#expBordersHeight;//when animating expansions for expanding/contracting the height of them fully
			//expanded needs to be known to know where to animate to and from. This is different from 
			//#expandedRowIndicesHeights because that is the height of the whole row and not the div inside.
			//we could retrieve offsetheight of the div each time a row needs to be animated or instead we can get
			//the border-top-width + border-bottom-width once and then substract that from the value of  what's in
			//#expandedRowIndicesHeights instead
	#scrollMethod;//this will be set to a reference of the scroll-method that will be used. This depends on settings for
				//staticRowHeight and expansion
	#expandedRowHeights={keys:[],vals:[]};//for tables where rows can be expanded this will keep track of which rows
			//have been expanded and what their total heights are including the mainrow and everything. The structure
			//is essentially as a hashmap in Java where keys are objects. Vals are simply the combined height. 
	#scrollY=0;//this keeps track of the "old" scrollTop of the table when a scroll occurs to know 
	#numRenderedRows=0;//number of tr-elements in the table excluding tr's that are expansions (expansions too are tr's)
	#openExpansions={};//for any row that is expanded and also in view this will hold navigational data which
							//is read from when clicking or navigating using keyboard to know which cell is next, and
							//which elemnts even are selectable and so on. Keys are data-row-index. As soon as a row
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
	#activeExpCell;	//points to an object in #openExpansionNavMap and in extension the cell of an expension.
							//If this is set then it means the cursor is inside an expansion.
	#animateCellCursorUntil;//used by #animateCellcursorPos to set the end-time for animation for adjusting its position
							//while rows are being expanded/contracted
	/* #generatingExpansion=false;//this is a flag that gets set to true when a row gets expanded or an already expanded
		//row gets scrolled into view, in short whenver the expansion-elements are generated. Then it gets unset when
		//creation finishes. The reason for having this flag is so that update */
	#ignoreClicksUntil;//when being inside an open group and trying to double-click on another cell further down to
		//interact with it the first click will highlight it but then the current group closes and what's below it will
		//get shifted up and the second click hits something else. By setting this var to current time plus 500 ms
		//when a group closes and checking if current time is past this one in mouseDown handler we'll ignore the second
		//click which is better user-experience
	#highlightRowsOnView={};//Rows can be added to this object with rowindex in #data as key, value needs to be truthy.
		//Rows that are outside of view can be added and when scrolled into view they will be highlighted. 

							

	/**
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column. unless "render" is set a prop of this name from the
	 * 						data-rows will be used as value for the cells
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			edit: See param expansion -> edit. This is the same as that one expect textareas are only valid for
	 * 												expansion-cells and not directly in a maintable-cell
	 * 			render Function pass in a callback-function here and what it returns will be used as value for the
	 * 					cells. It will get called with a reference to the data-row as its first argument, column-object
	 * 					as second, data-row-index as third and column-index and fourth.
	 * 		}
	 * 			
	 * 	@param	{Boolean} staticRowHeight Set to true if all rows are of same height. With this option on, scrolling
	 * 				quickly through large tables will be more performant.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.
	 * 	@param	{Object} expansion This allows for having rows that can be expanded to show more data. An "entry"-object
	 * 			is expected and some of them can hold other entry-objects so that they can be nested.
	 * 			Types of entries:
	 * 			{//this is an entry that holds multiple rows laid out vertically, each item in the list can have a 
	 * 			 //title on the left side by specifying "title" in each item within the list
  	 *				type:"list",
	 *				title:"Foobar",//displayed title if placed in a container which displays the title
	 * 				entries:[]//each element should be another entry
	 * 				titlesColWidth:String Width of the column with the titles. Don't forget adding the unit.
	 * 					Default is null which enables setting the width via css.
	 * 				onBlur: Function Callback fired when cellcursor goes from being inside the container to outside
	 * 					It will get passed arguments 1:cellObject, 2:mainIndex
	 *			}
	 *			{	
	 *				type: "collection" //basically like a list but each item is inlined, meaning they will be lined up
	 *									//in a horizontal line and will also wrap to multiple lines if needed
	 *				title:"Foobar",//displayed title if placed in a container which displays the title
	 * 				entries:[]//each element should be another entry
	 * 				class:String Css-classes to be added to the collection-div
	 * 				onBlur: Function Callback fired when cellcursor goes from being inside the container to outside
	 * 					It will get passed arguments 1:cellObject, 2:mainIndex
	 *	 		}
	 *			{
  	 * 				type:"field",//this is what will display data and which also can be editable
  	 * 				title:"Foobar",//displayed title if placed in list
  	 * 				id:"foobar",//the key of the property in the data that the row should display
	 * 				maxHeight int For textareas, sets the max-height in pixels that it should be able to be resized to
	 * 				class:String Css-classes to be added to the field
	 * 				edit: Object {//field is editable if this object is supplied and its disabled-prop is falsey
	 * 					onChange: Function Callback fired when the user has changed.
	 * 						It will get passed arguments: 1:newValue,2:oldValue,3:rowData,4:struct,5:cellObject
	 * 					onBlur: Function Callback fired when cellcursor goes from being inside the container to outside
	 * 							It will get passed arguments 1:cellObject, 2:mainIndex
	 * 					enabled Function - If present then this function will be run and if it returns falsey then the
	 * 										cell will not be editable. It may also return an object structured as:
	 * 										{enabled:Bool, message:String}. The message will be displayed to the user 
	 * 											if edit is attempted and enabled is set to false, disabling the field
	 * 							It gets passed the following arguments - 
	 * 													1:struct,2:rowData,3:mainIndex,4:cellObject(if in expansion)
	 * 					dataType String This is mandatory and specifies the type of input. Possible values are:
	 * 							"text"(single line text),
	 * 							"textarea"(multi-line text),
	 * 							"number"(number with stepper),
	 * 							"date"(a date and possibly time with a calendar),
	 * 							"select"(selection of multiple items).
	 * 							"button"(simple button)
	 * 						Depending on which one is selected certain properties
	 * 							below are (dis)allowed.
	 * 						maxLength int Sets max-length for strings if dataType is text
	 * 						placeholder String adds a placeholder-string to the input-element
	 * 					options: Array //may be supplied if dataType is "select". Each element should be an object: {
	 * 						value:the value of the cell will be mapped to the option with the same value
	 * 						text:unless a render-method has been specified then this is what will be shown to the user
	 * 					}
  	 * 					btnText: String,//If datatype is "button" then this will be the text on it
	 * 					clickHandler:Function //Used for datatype "button". A callback-function that will get called 
	 * 							//when the button is pressed. It will get passed arguments 1:event, 2:dataObject
	 * 							//,3:mainDataIndex,4:struct,5:cellObject(if inside expansion)
	 * 					noResultsText String For dataType "select", a string which is displayed when a user filters the 
	 * 						options in a select and there are no results. 
	 * 						Can also be set globally via param opts->defaultSelectNoResultText
	 * 					minOptsFilter Integer - The minimum number of options required for the filter-input to appear
	 * 						Can also be set via param opts->defaultMinOptsFilter
	 * 					allowSelectEmpty bool - Used for dataType "select". Default true.Pins an empty-option at the top
	 * 					emptyOptString String - For dataType "select", specifies the text of the empty option if 
	 * 						allowSelectEmpty is true. Can also be set via param opts->defaultEmptyOptString
  	 * 			}}
	 * 			{
  	 * 				type:"repeated",//used when the number of rows is undefined and where more may be able to be added, 
	 * 								//perhaps by the user. Having a list with a repeated->field basically works the same
	 * 								//as having a list with multiple fields. A list can also mix repeated/dynamic and
	 * 								//static fields. The structure could look something like:
	 * 								//list
	 * 								//	repeated
	 * 								//		field
	 * 								//	field1
	 * 								//	field2
  	 * 				id:"foobar",//this should be the key of an array in the data where each object corresponds to each
	 * 							//element in this repeated rows.
  	 * 				entry: any entry //may be item or list for instance. the data retrieved for these will be 1
	 * 								//level deeper so the path from the base would be idOfRepeatedRows->arrayIndex->*
	 * 				create: Bool //if true then a row is added which can be interacted with to insert more entries
	 * 				onCreate: Function Callback fired when the user has committed a new row. It is counted as committed
	 * 					when the cell-cursor has left the repeat-row after having created it.
	 * 					It will get passed arguments: 1:rowData,2:cellObject
	 * 				creationText: //used if "create" is true. the text of the creation-cell. default is "Create new"
	 * 				deleteText: //used if "create" is true. the text of the deletion-button. default is "Delete"
	 * 							//can also be set via param opts->defaultRepeatDeleteText
	 * 				deleteAreYouSureText: //used if "create" is true. text above yes/no-btns. default is "Are you sure?"
	 * 							//can also be set via param opts->defaultrepeatDeleteAreYouSureText
	 * 				areYouSureYesText: //used if "create" is true. text of confirm-button for delete. Default is "Yes"
	 * 							//can also be set via param opts->defaultrepeatDeleteAreYouSureYesText
	 * 				areYouSureNoText: //used if "create" is true. text of cancel-button for delete. Default is "No"
	 * 							//can also be set via param opts->defaultrepeatDeleteAreYouSureNoText
  	 * 			}
  	 * 			{
  	 * 				type:"group",//used when a set of data should be grouped, like for instance having an address and
	 * 							//all the rows in it belongs together. the group also has to be entered
	 * 							//with enter/doubleclick
  	 * 				title:"Foobar",//displayed title if placed in list
  	 * 				entries: Array any entries. fields, lists, etc.. 
	 * 				closedRender: Function //pass a method here that will get the data for the group as first arg.
	 * 								//it needs to return a string which will replace the group-content when it is closed
  	 * 			}
	 * 	@param	{Object} opts An object where different options may be set. The following options/keys are valid:
	 * 							"searchbar" Bool that defaults to true. If true then there will be a searchbar that
	 * 								can be used to filter the data.
	 * 							"sortAscHtml" String - html to be added to the end of the th-element when the column
	 * 													is sorted in ascending order
	 * 							"sortDescHtml" String - html to be added to the end of the th-element when the column
	 * 													is sorted in descending order
	 * 							"sortNoneHtml" String - html to be added to the end of the th-element when the column
	 * 													is not sorted
	 * 							"defaultDatePlaceholder" String - a default placeholder used for date-inputs.
	 * 							"defaultSelectNoResultText" String - a default string which is displayed when a user
	 * 									filters the options in a select and there are no results
	 * 							"defaultMinOptsFilter" Integer The minimum number of options required for the
	 * 								filter-input of edit-dataType "select" to appear
	 * 							"defaultEmptyOptString" Specifies the default text of the empty options for
	 * 								dataType "select" if allowSelectEmpty is true
	 * 							"defaultRepeatDeleteText" String default text used in the deletion of repeat-items
	 * 							"deleteAreYouSureText" String default text used in the deletion of repeat-items
	 * 							"areYouSureYesText"  String default text used in the deletion of repeat-items
	 * 							"areYouSureNoText"	 String default text used in the deletion of repeat-items
	 * */
	constructor(container,columns,staticRowHeight=false,spreadsheet=false,expansion=null,opts=null) {
		this.#container=container;
		this.#spreadsheet=spreadsheet;
		this.#expansion=expansion;
		container.classList.add("tablance");
		this.#staticRowHeight=staticRowHeight;
		this.#opts=opts;
		const allowedColProps=["id","title","width","edit","type","render"];
		for (let col of columns) {
			let processedCol={};
			if (col.type=="expand"&&!col.width)
				processedCol.width=50;
			for (let [colKey,colVal] of Object.entries(col)) {
				if (allowedColProps.includes(colKey))
					processedCol[colKey]=colVal;
			}
			this.#colStructs.push(processedCol);
		}
		if (opts?.searchbar!=false)
			this.#setupSearchbar();
		this.#createTableHeader();
		this.#createTableBody();
		(new ResizeObserver(e=>this.#updateSizesOfViewportAndCols())).observe(container);
		this.#updateSizesOfViewportAndCols();
		if (spreadsheet)
			this.#setupSpreadsheet();
		if (opts.sortAscHtml==null)
			opts.sortAscHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#000" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortDescHtml==null)
			opts.sortDescHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#000" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortNoneHtml==null)
			opts.sortNoneHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
		this.#updateHeaderSortHtml();
	}

	#setupSearchbar() {
		this.#searchInput=this.#container.appendChild(document.createElement("input"));
		this.#searchInput.type=this.#searchInput.className="search";
		this.#searchInput.placeholder="Search";
		const clearSearchCross=document.createElement("button");
		this.#searchInput.addEventListener("input",e=>this.#onSearchInput(e));
	}

	#onSearchInput(e) {
		this.#filterData(this.#searchInput.value);
	}

	#setupSpreadsheet() {
		this.#container.classList.add("spreadsheet");
		this.#cellCursor=this.#scrollingContent.appendChild(document.createElement("div"));
		this.#cellCursor.className="cell-cursor";
		this.#cellCursor.style.display="none";
		
		//remove any border-spacing beacuse if the spacing is clicked the target-element will be the table itself and
		//no cell will be selected which is bad user experience. Set it to 0 for headerTable too in order to match
		this.#mainTable.style.borderSpacing=this.#headerTable.style.borderSpacing=this.#borderSpacingY=0;
		
		const cellCursorComputedStyle=window.getComputedStyle(this.#cellCursor);
		for (let dir of ['top','right','bottom','left'])
			this.#cellCursorBorderWidths[dir]=parseInt(cellCursorComputedStyle[`border-${dir}-width`]);
		this.#cellCursorOutlineWidth=parseInt(cellCursorComputedStyle.outlineWidth);
		this.#scrollingContent.style.marginTop=this.#cellCursorBorderWidths.top+this.#cellCursorOutlineWidth+"px";
		this.#scrollingContent.style.marginLeft=this.#cellCursorBorderWidths.left+this.#cellCursorOutlineWidth+"px";
		this.#tableSizer.style.paddingBottom
				=this.#cellCursorBorderWidths.bottom+this.#cellCursorBorderWidths.top+this.#cellCursorOutlineWidth+"px";
		this.#tableSizer.style.paddingRight=this.#cellCursorOutlineWidth+"px";

		this.#container.tabIndex=0;//so the table can be tabbed to
		this.#container.addEventListener("keydown",e=>this.#spreadsheetKeyDown(e));
		this.#container.addEventListener("mousedown",e=>this.#spreadsheetMouseDown(e));
		this.#container.addEventListener("focus",e=>this.#spreadsheetOnFocus(e));
		this.#mainTable.addEventListener("mousedown",e=>this.#mainTableMouseDown(e));
		this.#cellCursor.addEventListener("dblclick",e=>this.#enterCell(e));

	}

	#expHeightGet(dataIndex) {
		return this.#expandedRowHeights.vals[this.#expandedRowHeights.keys.indexOf(this.#data[dataIndex])];
	}

	#expHeightSet(dataIndex,val) {
		const keyIndex=this.#expandedRowHeights.keys.indexOf(this.#data[dataIndex]);
		if (keyIndex==-1&&val!=null) {
			this.#expandedRowHeights.vals.push(val);
			this.#expandedRowHeights.keys.push(this.#data[dataIndex]);
		} else if (keyIndex!=-1&&val==null) {
			this.#expandedRowHeights.vals.splice(keyIndex,1);
			this.#expandedRowHeights.keys.splice(keyIndex,1);
		} else if (keyIndex!=-1&&val!=null)
			this.#expandedRowHeights.vals[keyIndex]=val;	
	}

	#spreadsheetOnFocus(e) {
		if (this.#mainRowIndex==null&&this.#data.length)
			this.#selectMainTableCell(this.#mainTbody.rows[0].cells[0]);
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		if (this.#highlightOnFocus)
			this.#container.style.removeProperty("outline");
		else
			this.#container.style.outline="none"
			
		this.#highlightOnFocus=true;
	}

	#moveCellCursor(numCols,numRows) {
		//const newColIndex=Math.min(this.#cols.length-1,Math.max(0,this.#cellCursorColIndex+numCols));
		this.#scrollToCursor();

		if (this.#activeExpCell?.parent?.struct.type==="collection")
			this.#moveInsideCollection(numCols,numRows);
		else if (numRows) {//moving up or down
			let newColIndex=this.#mainColIndex;
			if (this.#activeExpCell) {//moving from inside expansion.might move to another cell inside,or outside
					this.#selectAdjacentExpansionCell(this.#activeExpCell,numRows==1?true:false);
			} else if (numRows===1&&this.#expHeightGet(this.#mainRowIndex)){//moving down into expansion
				this.#selectFirstSelectableExpansionCell(this.#openExpansions[this.#mainRowIndex],true);
			} else if (numRows===-1&&this.#expHeightGet(this.#mainRowIndex-1)){//moving up into expansion
				this.#selectFirstSelectableExpansionCell(this.#openExpansions[this.#mainRowIndex-1],false);
			} else {//moving from and to maintable-cells
				this.#selectMainTableCell(
					this.#selectedCell.parentElement[(numRows>0?"next":"previous")+"Sibling"]?.cells[newColIndex]);
			}
			//need to call this a second time. first time is to scroll to old td to make sure the new td is rendered
			this.#scrollToCursor();//this time it is to actually scroll to the new td
		} else if (!this.#activeExpCell){
			this.#selectMainTableCell(this.#selectedCell[(numCols>0?"next":"previous")+"Sibling"]);
		}
	}

	#moveInsideCollection(numCols,numRows) {
		const currentCellX=this.#activeExpCell.el.offsetLeft;
		const currentCellTop=this.#activeExpCell.el.offsetTop;
		const currentCellBottom=this.#activeExpCell.el.offsetTop+this.#activeExpCell.el.offsetHeight;
		if (numCols) {//moving left or right
			for (let i=this.#activeExpCell.index,nextCell;nextCell=this.#activeExpCell.parent.children[i+=numCols];) {
				if (nextCell.el.offsetParent != null)
					if ((nextCell?.el.offsetLeft>currentCellX)==(numCols>0)) {
						this.#selectExpansionCell(nextCell);
						break;
					}
			}
		} else {//moving up or down
			let closestCell,closestCellX;
			const siblings=this.#activeExpCell.parent.children;
			for (let i=this.#activeExpCell.index,otherCell;otherCell=siblings[i+=numRows];) {
				const skipCell=Math.max(otherCell.el.offsetTop,currentCellTop) <= 					 //cells are on the
								Math.min(otherCell.el.offsetTop+otherCell.el.offsetHeight,currentCellBottom)//same line
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
				this.#selectExpansionCell(closestCell);
			else
				this.#selectAdjacentExpansionCell(this.#activeExpCell.parent,numRows==1?true:false);
		}
	}

	#selectAdjacentExpansionCell(cellObj,isGoingDown) {
		let cell=this.#getAdjacentExpansionCell(cellObj,isGoingDown);
		if (cell)
			return this.#selectExpansionCell(cell);
		this.#selectMainTableCell(this.#mainTbody.querySelector
				(`[data-data-row-index="${this.#mainRowIndex+isGoingDown}"]`)?.cells[this.#mainColIndex]);
	}
	
	#getAdjacentExpansionCell (cellObj,isGoingDown) {
		const siblings=cellObj.parent.children;
		const index=cellObj.index;
		for (let i=index+(isGoingDown||-1); i>=0&&i<siblings.length; i+=isGoingDown||-1) {
			const sibling=siblings[i];
			if (sibling.el)
				return sibling;
			//else if sibling.children
			const niece=this.#getFirstSelectableExpansionCell(sibling,isGoingDown);
			if (niece)
				return niece;
		}
		if (cellObj.parent.parent)
			return this.#getAdjacentExpansionCell(cellObj.parent,isGoingDown);
	}

	#selectFirstSelectableExpansionCell(cellObj,isGoingDown) {
		const newCellObj=this.#getFirstSelectableExpansionCell(cellObj,isGoingDown);
		if (newCellObj)
			return this.#selectExpansionCell(newCellObj);
		this.#selectMainTableCell(this.#mainTbody.querySelector
				(`[data-data-row-index="${this.#mainRowIndex+(isGoingDown||-1)}"]`)?.cells[this.#mainColIndex]);
	}

	/**Given a cell-object, like the expansion of a row or any of its sub-containers, it will return the first
	 * selectable cell from top or bottom
	 * @param {*} cellObj
	 * @param {Boolean} isGoingDown 
	 * @param {Boolean} onlyGetChild if this is set to true then it will never return the passed in cellObj and instead
	 *			only look at its (grand)children. Used for groups where both itself and its children can be selected*/
	#getFirstSelectableExpansionCell(cellObj,isGoingDown,onlyGetChild=false) {
		if (!onlyGetChild&&cellObj.el)
			return cellObj;
		const children=cellObj.children;
		let startI=isGoingDown?0:children.length-1;
		if (cellObj.struct.type==="collection"&&!isGoingDown) {
			let chosenCell;
			for (let i=startI,otherCell;otherCell=children[i--];) {
				if (!chosenCell||otherCell.el.offsetLeft<chosenCell.el.offsetLeft)
					chosenCell=otherCell;
				else
					break;
			}
			startI=chosenCell.index;
		}
		for (let childI=startI;childI>=0&&childI<children.length; childI+=isGoingDown||-1)
			if (children[childI].struct.type==="list"||(children[childI].el??children[childI].selEl)?.offsetParent)
				 return this.#getFirstSelectableExpansionCell(children[childI],isGoingDown);
	}
	

	#spreadsheetKeyDown(e) {
		if (this.#inEditMode&&this.#activeStruct.edit.dataType==="date") {
			if (e.key.slice(0,5)==="Arrow") {
				if (e.ctrlKey)
					e.stopPropagation();//allow moving textcursor if ctrl is held so prevent date-change then
				else
					e.preventDefault();//prevent textcursor from moving when arrowkey-selecting dates in date-picker
			} else if (e.key==="Backspace")
				e.stopPropagation();
		}
		this.#container.style.outline="none";//see #spreadsheetOnFocus
		if (!this.#inEditMode) {
			switch (e.key) {
				case "ArrowUp":
					this.#moveCellCursor(0,-1);
				break; case "ArrowDown":
					this.#moveCellCursor(0,1);
				break; case "ArrowLeft":
					this.#moveCellCursor(-1,0);
				break; case "ArrowRight":
					this.#moveCellCursor(1,0);
				break; case "Escape":
					this.#groupEscape();
				break;  case " ":
					if (this.#selectedCell.classList.contains("expandcol"))
						return this.#toggleRowExpanded(this.#selectedCell.parentElement);
					else if (this.#activeStruct.edit?.dataType==="button")
						this.#enterCell(e);
				break; case "+":
					this.#scrollToCursor();
					this.#expandRow(this.#selectedCell.parentElement,this.#mainRowIndex);
				break; case "-":
					this.#scrollToCursor();
					this.#contractRow(this.#mainRowIndex);
				break; case "Enter":
					this.#scrollToCursor();
					if (this.#selectedCell.classList.contains("expandcol"))
						return this.#toggleRowExpanded(this.#selectedCell.parentElement);
					this.#enterCell(e);
					e.preventDefault();//prevent newline from being entered into textareas
			}
		} else {
			switch (e.key) {
				case "Enter":
					this.#moveCellCursor(0,e.shiftKey?-1:1);
				break; case "Escape":
					this.#exitEditMode(false);
			}
		}
	}

	#groupEscape() {
		for (let cellObj=this.#activeExpCell; cellObj=cellObj.parent;)
			if (cellObj.struct.type==="group")
				return this.#selectExpansionCell(cellObj);
	}

	#insertAtCursor(myField, myValue) {
		//IE support
		if (document.selection) {
			myField.focus();
			sel = document.selection.createRange();
			sel.text = myValue;
		}
		//MOZILLA and others
		else if (myField.selectionStart || myField.selectionStart == '0') {
			var startPos = myField.selectionStart;
			var endPos = myField.selectionEnd;
			myField.value = myField.value.substring(0, startPos)
				+ myValue
				+ myField.value.substring(endPos, myField.value.length);
		} else {
			myField.value += myValue;
		}
	}

	#unsortCol(id,type) {
		for (let sortCol,i=-1;sortCol=this.#sortingCols[++i];)
			if (id&&id==sortCol.id||type&&type==sortCol.type) {
				this.#sortingCols.splice(i,1);
				this.#updateHeaderSortHtml();
				return;
			}
	}

	#expandRow(tr,dataRowIndex) {
		if (!this.#expansion||this.#expHeightGet(dataRowIndex))
			return;
		this.#unsortCol(null,"expand");
		const expansionRow=this.#renderExpansion(tr,dataRowIndex,false);
		this.#expHeightSet(dataRowIndex,this.#rowHeight+expansionRow.offsetHeight+this.#borderSpacingY);
		const contentDiv=expansionRow.querySelector(".content");
		if (!this.#expBordersHeight)//see declarataion of #expansionTopBottomBorderWidth
			this.#expBordersHeight=this.#expHeightGet(dataRowIndex)-contentDiv.offsetHeight;
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)//adjust scroll-height reflect change...
			+this.#expHeightGet(dataRowIndex)-this.#rowHeight+"px";//...in height of the table
		//animate
		contentDiv.style.height="0px";//start at 0
		setTimeout(()=>contentDiv.style.height=this.#expHeightGet(dataRowIndex)-this.#expBordersHeight+"px");
		this.#animateCellcursorPos();
	}

	#contractRow(dataRowIndex) {
		if (!this.#expansion||!this.#expHeightGet(dataRowIndex))
			return;
		this.#unsortCol(null,"expand");
		const tr=this.#mainTbody.querySelector(`[data-data-row-index="${dataRowIndex}"].expanded`);
		if (this.#mainRowIndex==dataRowIndex&&this.#activeExpCell)//if cell-cursor is inside the expansion
			this.#selectMainTableCell(tr.cells[this.#mainColIndex]);//then move it out
		const contentDiv=tr.nextSibling.querySelector(".content");
		if (contentDiv.style.height==="auto") {//if fully expanded
			contentDiv.style.height=this.#expHeightGet(dataRowIndex)-this.#expBordersHeight+"px";
			setTimeout(()=>contentDiv.style.height=0);
		} else if (parseInt(contentDiv.style.height)==0)//if previous closing-animation has reached 0 but transitionend 
		//hasn't been called yet which happens easily, for instance by selecting expand-button and holding space/enter
			contentDiv.dispatchEvent(new Event('transitionend'));
		else//if in the middle of animation, either expanding or contracting. make it head towards 0
			contentDiv.style.height=0;
		this.#animateCellcursorPos();
	}

	#animateCellcursorPos() {
		const recursiveCellPosAdjust=()=>{
			if (Date.now()<this.#animateCellCursorUntil)
				requestAnimationFrame(recursiveCellPosAdjust);
			else
				this.#animateCellCursorUntil=null;
			this.#adjustCursorPosSize(this.#selectedCell,true);
		}

		if (!this.#animateCellCursorUntil)//not being animated currently
			requestAnimationFrame(recursiveCellPosAdjust);
		this.#animateCellCursorUntil=Date.now()+500;
	}

	/**Creates the actual content of a expanded row. When the user expands a row #expandRow is first called which in
	 * turn calls this one. When scrolling and already expanded rows are found only this one needs to be called.
	 * @param {*} tr 
	 * @param {*} rowIndex 
	 * @param Bool setHeight Expanded rows, or rather the div inside them needs to have their height set in order to
	 * 				animate correctly when expanding/contracting. When this method is called on scroll the height of
	 * 				the div should be set by this method, but if #expandRow is called because the user expanded a row
	 * 				
	 * @returns */
	#renderExpansion(tr,rowIndex,setHeight=true) {
		tr.classList.add("expanded");
		const expansionRow=tr.parentElement.insertRow(tr.rowIndex+1);
		expansionRow.className="expansion";
		expansionRow.dataset.dataRowIndex=rowIndex;
		const expansionCell=expansionRow.insertCell();
		expansionCell.colSpan=this.#cols.length;
		const expansionDiv=expansionCell.appendChild(document.createElement("div"));//single div inside td for animate
		expansionDiv.style.height="auto";
		expansionDiv.className="content";
		expansionDiv.addEventListener("transitionend",this.#expansionAnimationEnd.bind(this));
		const shadowLine=expansionDiv.appendChild(document.createElement("div"));
		shadowLine.className="expansion-shadow";
		const cellObject=this.#openExpansions[rowIndex]={};
		this.#generateExpansionContent(this.#expansion,rowIndex,cellObject,expansionDiv,[],this.#data[rowIndex]);
		cellObject.rowIndex=rowIndex;
		return expansionRow;
	}

	#expansionAnimationEnd(e) {
		if (parseInt(e.target.style.height)) {//if expand finished

			e.target.style.height="auto";
		} else {//if contract finished

			const expansionTr=e.target.closest("tr");
			const mainTr=expansionTr.previousSibling;
			const dataRowIndex=mainTr.dataset.dataRowIndex;
			mainTr.classList.remove("expanded");
			this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)
				 -this.#expHeightGet(dataRowIndex)+this.#rowHeight+"px";
			expansionTr.remove();
			this.#expHeightSet(dataRowIndex,null);
			delete this.#openExpansions[dataRowIndex];
		}
	}

	/**
	 * 
	 * @param {*} struct 
	 * @param {*} data 
	 * @param {*} cellObject 
	 * @param {*} parentEl 
	 * @param []int path Keeps track of the "path" by adding and removing index-numbers from the array when going
	 * 				in and out of nesting. This path is then added as a data-attribute to the cells that can be
	 * 				interacted with and this data is then read from and the cell-object can then be retrieved from it.*/
	#generateExpansionContent(struct,dataIndex,cellObject,parentEl,path,rowData) {
		if (!path.length)
			cellObject.rowIndex=dataIndex;
		const args=[struct,dataIndex,cellObject,parentEl,path,rowData];
		switch (struct.type) {
			case "list": return this.#generateExpansionList(...args);
			case "field": return this.#generateField(...args);
			case "group": return this.#generateExpansionGroup(...args);
			case "repeated": return this.#generateExpansionRepeated(...args);
			case "collection": return this.#generateExpansionCollection(...args);
		}
	}

	/**This is supposed to get called when a repeated-struct is found however in #generateExpansionList,
	 * repeated-structs are looked for and handled by that method instead so that titles can be added to the list
	 * which isn't handled by #generateExpansionContent but by the list-method itself
	 * @param {*} struct 
	 * @param {*} dataIndex 
	 * @param {*} cellObj 
	 * @param {*} parentEl 
	 * @param {*} path 
	 * @param {*} rowData 
	 * @returns */
	#generateExpansionRepeated(struct,dataIndex,cellObj,parentEl,path,rowData) {
		cellObj.struct=struct;
		cellObj.children=[];
		const repeatData=cellObj.rowData=rowData[struct.id];
		if (repeatData?.length) {
			struct=this.#getStructCopyWithDeleteControlsMaybe(struct);
			for (let childI=0; childI<rowData[struct.id].length; childI++) {
				let childObj=cellObj.children[childI]={parent:cellObj,index:childI};
				path.push(childI);
				this.#generateExpansionContent(struct.entry,dataIndex,childObj,parentEl,path,repeatData[childI]);
				path.pop();
			}
		}
		if (struct.create) {
			const creationTable=parentEl.appendChild(document.createElement("table"));
			const creationCell=creationTable.insertRow().insertCell();
			creationCell.innerText=struct.creationText??"Insert new";
			creationTable.classList.add("repeat-insertion","empty");//empty for hiding it when group is closed if group
			cellObj.children.push(
								{parent:cellObj,el:creationTable,index:repeatData.length,struct:{type:"repeatCreate"}});
			creationTable.dataset.path=path.join("-")+"-"+repeatData.length;
		}
		
		return !!repeatData?.length||struct.create;
	}

	#beginDeleteRepeated(e,data,mainIndex,struct,cell) {
		if (!cell.parent.parent.creating) {
			cell.parent.containerEl.classList.add("delete-confirming");
			this.#moveInsideCollection(1);//move away from the delete-button which now dissapeared, to the next btn
		} else
			this.#deleteCell(cell.parent.parent);
	}

	#cancelDelete(e,data,mainIndex,struct,cell) {
			cell.parent.containerEl.classList.remove("delete-confirming");
			this.#selectExpansionCell(cell.parent.children[0]);
	}

	#getStructCopyWithDeleteControlsMaybe(struct) {
		if (struct.create&&struct.entry.type==="group") {//if repeater is group then add delete-controls
			const deleteControls={type:"collection",class:"delete-controls"
				,onBlur:cel=>cel.selEl.querySelector(".collection").classList.remove("delete-confirming")
				,entries:[{type:"field",edit:{dataType:"button",
					btnText:struct.deleteText??this.#opts.defaultRepeatDeleteText??"Delete"
					,clickHandler:this.#beginDeleteRepeated.bind(this)},class:"delete"},
				{type:"field",edit:{dataType:"button"
					,btnText:struct.areYouSureNoText??this.#opts.deleteAreYouSureNoText??"No",
					clickHandler:this.#cancelDelete.bind(this)},class:"no"
					,title:struct.deleteAreYouSureText??this.#opts.deleteAreYouSureText??"Are you sure?"},
				{type:"field",edit:{dataType:"button"
					,btnText:struct.areYouSureYesText??this.#opts.deleteAreYouSureYesText??"Yes",
					clickHandler:(e,data,mainIndex,strct,cel)=>this.#deleteCell(cel.parent.parent)},class:"yes"}]};
			struct={...struct};//make shallow copy so original is not affected
			struct.entry={...struct.entry};
			struct.entry.entries=[...struct.entry.entries,deleteControls];
		}
		return struct;
	}

	#generateButton(struct,mainIndex,parentEl,rowData,cellObj=null) {
		const btn=parentEl.appendChild(document.createElement("button"));
		btn.tabIndex="-1";//so it can't be tabbed to
		btn.innerText=struct.edit.btnText;
		btn.addEventListener("click",e=>struct.edit.clickHandler?.(e,rowData,mainIndex,struct,cellObj));

		//prevent gaining focus upon clicking it whhich would cause problems. It should be "focused" by having the
		//cellcursor on its cell which triggers it with enter-key anyway
		btn.addEventListener("mousedown",e=>e.preventDefault());
		return true;
	}

	#generateExpansionGroup(groupStructure,dataIndex,cellObj,parentEl,path,rowData) {
		parentEl.dataset.path=path.join("-");
		cellObj.children=[];
		cellObj.rowData=rowData;
		const groupTable=document.createElement("table");
		parentEl.classList.add("group-cell");
		cellObj.el=groupTable;//so that the whole group-table can be selected
		cellObj.struct=groupStructure;
		groupTable.className="expansion-group";
		for (let entryI=-1,struct; struct=groupStructure.entries[++entryI];) {
			let tr=groupTable.insertRow();
			tr.className="empty";//start as empty to hide when closed.updateCell() will remove it if a cell is non-empty
			let td=tr.insertCell();
			td.classList.toggle("disabled",struct.type=="field"&&!struct.edit)
			if (entryI>0) {
				const separator=td.appendChild(document.createElement("div"));
				separator.className="separator";
			}
			if (struct.title) {
				let header=td.appendChild(document.createElement("h4"));
				header.innerText=struct.title;
			}
			
			let contentDiv=td.appendChild(document.createElement("div"));
			contentDiv.className="value";
			path.push(entryI);

			//create cell-object for group-member. nonEmptyDescentants keeps track of how many descendant-cells that are
			//non-empty in order to mark group-rows as empty to hide them while group is closed
			//selEl is set and will be what the cell-cursor highlights. We do want to highlight the whole td but still
			//it can't be used as the normal el and therefore get its innerText set when editing it because it also
			//contains a header-element
			let childCellObj=cellObj.children[entryI]
												={nonEmptyDescentants:0,grpTr:tr,parent:cellObj,index:entryI,selEl:td};

			this.#generateExpansionContent(struct,dataIndex,childCellObj,contentDiv,path,rowData);
			path.pop();
		}
		if (groupStructure.closedRender) {
			groupTable.classList.add("closed-render");
			const renderRow=groupTable.insertRow();
			renderRow.dataset.path=path.join("-");
			renderRow.className="group-render";
			const renderCell=renderRow.insertCell();
			renderCell.innerText=groupStructure.closedRender(rowData);
		}
		parentEl.appendChild(groupTable);
		return true;
	}

	#generateExpansionCollection(collectionStructure,mainIndex,collObj,parentEl,path,rowData) {
		Object.assign(collObj,{children:[],struct:collectionStructure,rowData:rowData});
		const container=collObj.containerEl=parentEl.appendChild(document.createElement("div"));
		container.classList.add("collection",...collectionStructure.class?.split(" ")??[]);
		for (let entryI=-1,struct; struct=collectionStructure.entries[++entryI];) {
			path.push(entryI);
			const celObj=collObj.children[entryI]={parent:collObj,index:entryI,struct:struct};
			if (struct.type==="repeated"&&rowData[struct.id]?.length) {
				celObj.children=[];
				for (let repeatI=-1,repeatData;repeatData=rowData[struct.id][++repeatI];) {
					let repeatdObj=celObj.children[repeatI]={parent:celObj,index:repeatI,struct:struct.entry};
					this.#generateCollectionItem(struct,mainIndex,repeatdObj,container,path,repeatData);
				}
			} else {
				this.#generateCollectionItem(struct,mainIndex,celObj,container,path,rowData);
			}
			path.pop();
		}
		return true;
	}

	#generateCollectionItem(struct,mainIndex,cellObj,parentEl,path,data) {
		const containerSpan=cellObj.selEl=document.createElement("span");
		if (struct.title) {
			const header=containerSpan.appendChild(document.createElement("h4"));
			header.innerText=struct.title;
		}
		let contentDiv=containerSpan.appendChild(document.createElement("div"));
		contentDiv.className="value";
		if (this.#generateExpansionContent(struct,mainIndex,cellObj,contentDiv,path,data))
			parentEl.appendChild(containerSpan);
		if (struct.class)
			containerSpan.className+=" "+struct.class;
	}

	#generateExpansionList(listStructure,mainIndex,listCelObj,parentEl,path,rowData) {
		listCelObj.children=[];
		listCelObj.struct=listStructure;
		const listTable=document.createElement("table");
		const listTbody=listTable.appendChild(document.createElement("tbody"));
		listTable.className="expansion-list";
		let titlesCol=document.createElement("col");
		listTable.appendChild(document.createElement("colgroup")).appendChild(titlesCol);
		if (listStructure.titlesColWidth)
			titlesCol.style.width=listStructure.titlesColWidth;
		for (let entryI=-1,struct; struct=listStructure.entries[++entryI];) {
			if (struct.type==="repeated"&&rowData[struct.id]?.length) {
				let repeatCelObj=listCelObj.children[entryI]={parent:listCelObj,index:entryI,children:[],struct:struct};
				repeatCelObj.rowData=rowData[struct.id];
				for (let repeatI=-1,itemData; itemData=rowData[struct.id][++repeatI];) {
					path.push(entryI);
					this.#generateListItem(listTbody,struct.entry,repeatI,repeatI,repeatCelObj,path,itemData);
					path.pop();
				}
			} else
				this.#generateListItem(listTbody,struct,entryI,mainIndex,listCelObj,path,rowData);
		}
		parentEl.appendChild(listTable);
		return true;
	}

	#generateListItem(listTbody,struct,itemIndex,mainIndex,listCelObj,path,data) {
		let contentTd=document.createElement("td");
		contentTd.className="value";//not actually sure why but this can't be put inside condition below
		let cellChild={parent:listCelObj,index:itemIndex};
		path.push(itemIndex);
		if (this.#generateExpansionContent(struct,mainIndex,cellChild,contentTd,path,data)) {//generate content
			//and add it to dom if condition falls true, e.g. content was actually created. it might not be if it is
			//a repeated and there was no data for it add
			let listTr=listTbody.insertRow();
			let titleTd=listTr.insertCell();
			titleTd.className="title";
			titleTd.innerText=struct.title??"";
			listTr.appendChild(contentTd);
			listCelObj.children[itemIndex]=cellChild;
		}
		path.pop();
	}

	#generateField(fieldStructure,mainIndex,cellObject,parentEl,path,rowData) {	
		cellObject.dataObject=rowData;
		cellObject.struct=fieldStructure;
		cellObject.el=parentEl;
		this.#updateExpansionCell(cellObject,rowData);
		cellObject[cellObject.selEl?"selEl":"el"].dataset.path=path.join("-");
		return true;
	}

	#scrollToCursor() {
		const distanceRatioDeadzone=.5;//when moving the cellcursor within this distance from center of view no 
										//scrolling will be done. 0.5 is half of view, 1 is entire height of view
		const distanceRatioCenteringTollerance=1;//if moving the cellcursor within this ratio, but outside of 
					//distanceRatioDeadzone then minimum scrolling will occur only to get within distanceRatioDeadzone
		const scrollPos=this.#scrollBody.scrollTop;
		const scrollHeight=this.#scrollBody.offsetHeight;
		const cursorY=parseInt(this.#cellCursor.style.top);
		const cursorHeight=this.#cellCursor.offsetHeight;
		const distanceFromCenter=cursorY+cursorHeight/2-scrollPos-scrollHeight/2;
		const distanceFromCenterRatio=Math.abs(distanceFromCenter/scrollHeight);
		if (distanceFromCenterRatio>distanceRatioDeadzone/2) {
			if (distanceFromCenterRatio>distanceRatioCenteringTollerance/2)
				this.#scrollBody.scrollTop=cursorY-scrollHeight/2+this.#rowHeight/2;
			else
				this.#scrollBody.scrollTop=cursorY-scrollHeight/2+cursorHeight/2
								+(distanceFromCenter<0?1:-1)*scrollHeight*distanceRatioDeadzone/2;
		}
		//need to call this manually so that elements that are expected to exist after scroll are guaranteed to do so.
		//changing this.#scrollBody.scrollTop actually calls this method anyway but not until all other code as hun.
		//This will cause it to run it twice but it's not a big deal.
		this.#scrollMethod();
	}

	#spreadsheetMouseDown(e) {
		if (document.activeElement!==this.#container)
			this.#highlightOnFocus=false;//see decleration
		this.#container.style.outline="none";//see #spreadsheetOnFocus
	}
	
	#mainTableMouseDown(e) {
		if (Date.now()<this.#ignoreClicksUntil)//see decleration of #ignoreClicksUntil
			return;
		if (e.which===3)//if right click
			return;
		const mainTr=e.target.closest(".main-table>tbody>tr");
		if (mainTr.classList.contains("expansion")) {//in expansion
			const interactiveEl=e.target.closest('[data-path]');
			if (!interactiveEl)
				return;
			let cellObject=this.#openExpansions[mainTr.dataset.dataRowIndex];
			for (let step of interactiveEl.dataset.path.split("-")) {
				cellObject=cellObject.children[step];
				if (cellObject.struct.type==="group"&&!cellObject.el.classList.contains("open"))
					break;
			}
			/*while (cellObject.children) {
				let childI;
				for (childI=0; childI<cellObject.children.length; childI++) {
					if (cellObject.children[childI].el.contains(e.target)) {
						cellObject=cellObject.children[childI];
						break;
					}
				}
				if (childI==cellObject.children?.length){ //none of the children matched but the parent matched. 
					cellObject=null;
					break
				}
			} */
			this.#selectExpansionCell(cellObject);
		} else {//not in expansion
			const td=e.target.closest(".main-table>tbody>tr>td");
				if (td.classList.contains("expandcol")) {
					if (this.#mainRowIndex==null)
						this.#selectMainTableCell(td);
					return this.#toggleRowExpanded(td.parentElement);
				}
			this.#selectMainTableCell(td);
		}
	}

	#toggleRowExpanded(tr) {
		if (tr.classList.contains("expanded"))
			this.#contractRow(parseInt(tr.dataset.dataRowIndex));
		else
			this.#expandRow(tr,parseInt(tr.dataset.dataRowIndex));
	}

	#autoTextAreaResize(e) {
		const maxHeight=this.#activeStruct.maxHeight??Infinity;
		
		//__auto-resize__
		//first set height to auto.This won't make it auto-resize or anything but will rather set its height to about 40
		e.target.style.height="auto";
		//then set size of cellcursor, and also the underlying cell in order to make expansion-height adjust to scroll-
		//height of the textarea. Also add 1px because *sometimes* without logic the textarea would recieve a scrollbar
		//which can scroll about 1 px. Not sure if 1px is actually sufficent but let's start there.
		this.#cellCursor.style.height=this.#selectedCell.style.height=Math.min(maxHeight,e.target.scrollHeight+1)+"px";
		//now set height of textarea to 100% of cellcursor which height is set with above line. this line and the one
		//setting it to auto "could" be skipped but that will result in the textarea not shrinking when needed.
		e.target.style.height="100%";

		//need to call this to make the height of the expansion adjust and reflect the change in size of the textarea
		this.#updateExpansionHeight(this.#selectedCell.closest("tr.expansion"),this.#mainRowIndex);
	}

	#updateExpansionHeight(expansionTr) {
		const contentDiv=expansionTr.querySelector(".content");
		contentDiv.style.height="auto";//set to auto in case of in middle of animation, get correct height
		const prevRowHeight=this.#expHeightGet(this.#mainRowIndex);
		const newRowHeight=this.#rowHeight+expansionTr.offsetHeight+this.#borderSpacingY;
		this.#expHeightSet(this.#mainRowIndex,newRowHeight);
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)//adjust scroll-height reflect change...
			+newRowHeight-prevRowHeight+"px";//...in height of the table
	}

	#openDateEdit(e) {
		const input=document.createElement("input");
		let pika,pikaContainer;
		//this.#input.type="date";//using Pikaday instead which I find more user-friendly. Calendar can be opened
								//up right away and typing manualy is still permitted
		if (!Pikaday)
			console.warn("Pikaday-library not found");
		else {
			pikaContainer=this.#scrollingContent.appendChild(document.createElement("div"));
			pikaContainer.className="pika-container";
			pika=new Pikaday({field:input,
				toString: d=>d.getFullYear()+"-"+('0'+(d.getMonth()+1)).slice(-2)+"-"+('0'+d.getDate()).slice(-2),
				onClose:()=>{
					pikaContainer.remove();
					pika.destroy();
					setTimeout(()=>this.#exitEditMode(true));
				},
				container:pikaContainer,
				firstDay:1,//week starts on monday
				showWeekNumber:true,
				i18n: {
					previousMonth : 'Tidigare Månad',
					nextMonth     : 'Nästa Månad',
					months        : ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September'
																					,'Oktober','November','December'],
					weekdays      : ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag'],
					weekdaysShort : ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']
				}
			});
			if (this.#alignPickerBelowCellCursor()) {
				pikaContainer.style.top=parseInt(this.#cellCursor.style.top)+this.#cellCursor.clientHeight+"px";
				this.#cellCursor.style.zIndex=0;//prevent that the shadow of the cellcursor falls on the picker
			} else {
			 	requestAnimationFrame(()=>pikaContainer.style.top=parseInt(this.#cellCursor.style.top)
				 														-pikaContainer.firstChild.offsetHeight+"px");
				this.#cellCursor.style.zIndex=10000;//prevent that the shadow of the picker falls on the cellcursor
			}
			pikaContainer.style.left=this.#cellCursor.style.left;
			if (e instanceof KeyboardEvent)
				e.stopPropagation();//otherwise the enter-press is propagated to Pikaday, immediately closing it
			input.addEventListener("input",onInput.bind(this));
			input.addEventListener("change",()=>this.#inputVal=input.value);
		}
		new Cleave(input,{date: true,delimiter: '-',datePattern: ['Y', 'm', 'd']});
		this.#cellCursor.appendChild(input);
		input.value=this.#selectedCellVal??"";
		input.placeholder=this.#activeStruct.edit.placeholder??this.#opts.defaultDatePlaceholder??"";
		input.focus();
		
		function onInput(e) {
			const inputVal=input.value;
			pika.setDate(input.value);
			//the above line will change the text above by guessing where there should be zeroes and such so prevent
			//that by setting it back so that the user can type freely
			input.value=inputVal;
		}
	}

	/**Looks to see if there's more space above or below the cell-cursor in order to determine if a picker should be
	 * aligned above or below it. Returns true if it should be below or false if above.*/
	#alignPickerBelowCellCursor() {
		return parseInt(this.#cellCursor.style.top)+this.#cellCursor.clientHeight/2
															<this.#scrollBody.scrollTop+this.#scrollBody.clientHeight/2;
	}

	/**Returns true or false depending on if the cellcursor is "in view". It might not actually be in view but as long
	 * as it's a row that is present in the DOM then it will return true* */
	#cellCursorIsInDom() {
		return !!this.#selectedCell.offsetParent;
	}

	#enterCell(e) {
		if (this.#inEditMode)
			return;
		if (this.#activeStruct.edit) {
			if (this.#activeStruct.edit.dataType==="button")
				return this.#activeExpCell.el.click();
			this.#selectedCellVal=this.#cellCursorDataObj[this.#activeStruct.id];
			this.#inEditMode=true;
			this.#cellCursor.classList.add("edit-mode");
			switch (this.#activeStruct.edit.dataType) {
				case "textarea":
					this.#openTextAreaEdit(e);
				break; case "date":
					this.#openDateEdit(e);
				break; case "select":
					this.#openSelectEdit(e);
				break; default: case "text": 
					this.#openTextEdit(e);
			}
		} else if (this.#activeStruct.type==="group") {
			this.#activeExpCell.el.classList.add("open");
			this.#selectExpansionCell(this.#getFirstSelectableExpansionCell(this.#activeExpCell,true,true));
		} else if (this.#activeStruct.type==="repeatCreate") {
			this.#repeatInsertNew(this.#activeExpCell);
		}
	}

	#closeGroup(groupObject) {
		groupObject.el.classList.remove("open");
		if (groupObject.updateRenderOnClose) {//if group is flagged for having its closed-render updated on close
			delete groupObject.updateRenderOnClose;//delete the flag so it doesn't get triggered again
			let cell,renderText;
			//look for ancestor-cell with rowData which repeated rows have. It's a sub-data-row of #data.
			//if we got all the way to the root without finding any repeated-rows then use datarow directly from #data
			for (cell=groupObject.parent;!cell.rowData&&cell.parent;cell=cell.parent);//look for ancestor with rowData
			renderText=groupObject.struct.closedRender(cell.parent?cell.rowData[cell.index]:this.#data[cell.rowIndex]);
			groupObject.el.rows[groupObject.el.rows.length-1].cells[0].innerText=renderText;
		}
	}

	#repeatInsertNew(repeatCreater) {
		const reptPar=repeatCreater.parent;
		const indexOfNew=reptPar.children.length-1;
		const childObj={parent:reptPar,index:indexOfNew,creating:true};//creating means it hasn't been commited yet
		reptPar.children.splice(indexOfNew,0,childObj);
		const path=repeatCreater.el.dataset.path.split("-") ;
		const data=reptPar.rowData[indexOfNew]={};		
		const struct=this.#getStructCopyWithDeleteControlsMaybe(reptPar.struct);
		this.#generateExpansionContent(struct.entry,indexOfNew,childObj,repeatCreater.el.parentNode,path,data);
		for (var cellPar=childObj,cellI=0,cell=childObj;cell.struct.type!="field";cell=cellPar.children[cellI++]){
			if (cell.struct.type==="group")
				cell.el.classList.add("open");
			if (cell.children) {
				cellPar=cell;
				cellI=0;
			}
		}
		repeatCreater.index++;
		repeatCreater.el.parentElement.appendChild(repeatCreater.el);
		this.#selectExpansionCell(cell);
	}

	#deleteCell(cellObj) {
		let newSelectedCell;
		for (let i=cellObj.index,otherCell; otherCell=cellObj.parent.children[++i];)
			otherCell.index--;
		
		if (cellObj.parent.children.length>=cellObj.index+1)
			newSelectedCell=cellObj.parent.children[cellObj.index+1];
		else if (cellObj.parent.children.length>1)
			newSelectedCell=cellObj.parent.children[cellObj.index-1];
		cellObj.parent.children.splice(cellObj.index,1);
		cellObj.parent.rowData.splice(cellObj.index,1);
		cellObj.el.remove();
		this.#selectExpansionCell(newSelectedCell??cellObj.parent.parent);


		//correct the dataset.path of clickable elements so they can still be clicked
		const path=[];//get the current path
		let rootEl;
		for (let pathCell=cellObj;pathCell;pathCell=pathCell.parent) {
			if (pathCell.index!=null)
				path.unshift(pathCell.index);
			rootEl=pathCell.el??pathCell.selEl??rootEl;
		}
		for (const pathEl of rootEl.closest(".expansion").querySelectorAll('[data-path]')) {
			const otherPath=pathEl.dataset.path.split("-");
			for (var i=0; i<path.length-1&&path[i]==otherPath[i]; i++);
			if (i==path.length-1&&otherPath[i]>path[i]) {
				otherPath[i]--;
				pathEl.dataset.path=otherPath.join("-");
			}
		}
	}

	#openTextEdit() {
		const input=this.#cellCursor.appendChild(document.createElement("input"));
		input.addEventListener("change",()=>this.#inputVal=input.value);
		input.value=this.#selectedCellVal??"";
		input.focus();
		if (this.#activeStruct.edit.maxLength)
			input.maxLength=this.#activeStruct.edit.maxLength;
		input.placeholder=this.#activeStruct.edit.placeholder??"";
		if (this.#activeStruct.edit.cleave)
			new Cleave(input,this.#activeStruct.edit.cleave);
	}

	#openTextAreaEdit() {
		const textarea=this.#cellCursor.appendChild(document.createElement("textarea"));
		textarea.addEventListener('input', this.#autoTextAreaResize.bind(this));

		{	const {paddingLeft,paddingRight,paddingTop,paddingBottom}=window.getComputedStyle(this.#selectedCell);
			//add the padding of the cell to the textarea for consistency
			Object.assign(textarea.style,{paddingLeft,paddingRight,paddingTop,paddingBottom});}
		
		textarea.value=this.#selectedCellVal??"";
		textarea.addEventListener("keydown",keydown.bind(this));
		textarea.focus();
		textarea.addEventListener("change",e=>this.#inputVal=textarea.value);
		if (this.#activeStruct.edit.maxLength)
			textarea.maxLength=this.#activeStruct.edit.maxLength;
		textarea.placeholder=this.#activeStruct.edit.placeholder??"";
		function keydown(e) {
			if (e.key==="Enter"&&e.ctrlKey) {
				this.#insertAtCursor(textarea,"\r\n");
				textarea.dispatchEvent(new Event('input'));//trigger input so that autoTextAreaResize gets called
				e.stopPropagation();
			} else if (e.key==="Escape") {
				textarea.value=this.#selectedCellVal??"";
				textarea.dispatchEvent(new Event('input'));
			}
		}
	}

	#openSelectEdit() {
		let highlightLiIndex,highlightUlIndex;
		let filterText="";
		this.#inputVal=this.#cellCursorDataObj[this.#activeStruct.id];
		const selectContainer=document.createElement("div");
		let opts=[...this.#activeStruct.edit.options];
		const inputWrapper=selectContainer.appendChild(document.createElement("div"));//we use this to give the
		const input=inputWrapper.appendChild(document.createElement("input"));
		const windowClickBound=windowClick.bind(this);//saving reference to bound func so handler can be removed later
		const allowEmpty=this.#activeStruct.edit.allowSelectEmpty??true;
		const emptyString=this.#activeStruct.edit.emptyOptString??this.#opts.defaultEmptyOptString??"Empty";
		inputWrapper.classList.add("input-wrapper");//input-element a margin. Can't put padding in container because
							//that would cause the highlight-box of selected options not to go all the way to the sides
		const ulDiv=selectContainer.appendChild(document.createElement("div"));
		if (opts.length>=(this.#activeStruct.edit.minOptsFilter??this.#opts.defaultMinOptsFilter??5)) {
			input.addEventListener("input",inputInput.bind(this));//filtering is allowed, add listener to the input
		} else//else hide the input. still want to keep it to recieve focus and listening to keystrokes. tried focusing
			inputWrapper.classList.add("hide");//container-divs instead of input but for some reason it messed up scroll
		input.addEventListener("keydown",inputKeyDown.bind(this));
		const pinnedUl=ulDiv.appendChild(document.createElement("ul"));
		const ul=ulDiv.appendChild(document.createElement("ul"));
		pinnedUl.classList.add("pinned");
		for (let i=allowEmpty?0:1,currentUl;i<2&&(currentUl=i?ul:pinnedUl);i++) {
			currentUl.dataset.ulIndex=i;
			renderOpts(currentUl,i?opts:[{text:emptyString}],this.#inputVal);
			currentUl.addEventListener("mouseover",ulMouseOver.bind(this));
			currentUl.addEventListener("click",ulClick.bind(this));
		}
		if (!allowEmpty&&this.#inputVal==null)
			highlightOpt(1,0);//for selects where initial value is null but null cant be selected
		
		const noResults=selectContainer.appendChild(document.createElement("div"));
		noResults.innerText=
					this.#activeStruct.edit.noResultsText??this.#opts.defaultSelectNoResultText??"No results found";
		noResults.className="no-results";
		
		this.#scrollingContent.appendChild(selectContainer);
		selectContainer.className="tablance-select-container";
		selectContainer.style.left=parseInt(this.#cellCursor.style.left)+"px";
		if (this.#alignPickerBelowCellCursor()) {
			selectContainer.style.top=parseInt(this.#cellCursor.style.top)+this.#cellCursor.clientHeight+"px";
			this.#cellCursor.style.zIndex=0;//prevent that the shadow of the cellcursor falls on the picker
		} else {
			selectContainer.style.top=parseInt(this.#cellCursor.style.top)-selectContainer.offsetHeight+"px";
			this.#cellCursor.style.zIndex=10000;
		}

		window.addEventListener("click",windowClickBound);
		input.focus();

		function renderOpts(ul,opts,selectedVal) {
			let foundSelected=false;
			ul.innerHTML="";
			for (let optI=-1,opt; opt=opts[++optI];) {
				const li=ul.appendChild(document.createElement("li"));
				li.innerText=opt.text;
				if (selectedVal==opt.value) {
					foundSelected=true;
					li.classList.add("selected","highlighted");
					highlightLiIndex=optI;
					highlightUlIndex=parseInt(ul.dataset.ulIndex);
				}
			}
			return foundSelected;
		}

		function inputInput(e) {
			if (!input.value.includes(filterText)||!filterText)//unless text was added to beginning or end
				opts=[...this.#activeStruct.edit.options];//start off with all options there are
			for (let i=-1,opt; opt=opts[++i];)
				if (!opt.text.includes(input.value))//if searchstring wasn't found in this opt
					opts.splice(i--,1);//then remove it from view
			if (!renderOpts(ul,opts,this.#inputVal)&&highlightUlIndex)//didnt find selected opt & empty is not selected
					if (opts.length)//there are visible opts
						highlightOpt.call(this,1,0);//select first among the filtered ones
					else if (allowEmpty)//there are not visible ones after filtering but empty is available
						highlightOpt.call(this,0,0);//select empty
			noResults.style.display=opts.length?"none":"block";
		}
		function ulMouseOver(e) {
			highlightOpt.call(this,parseInt(e.target.closest("ul").dataset.ulIndex)
																,[...e.target.parentNode.children].indexOf(e.target));
		}
		function windowClick(e) {
			for (var el=e.target; el!=selectContainer&&(el=el.parentElement););//go up until container or root is found
			if (!el) {//click was outside select-container
				close();
				this.#exitEditMode(false);
			}
		}
		function close() {
			selectContainer.remove();
			window.removeEventListener("click",windowClickBound);
		}
		function highlightOpt(ulIndex,liIndex) {
			ulDiv.children[highlightUlIndex]?.children[highlightLiIndex]?.classList.remove("highlighted");
			ulDiv.children[highlightUlIndex=ulIndex].children[highlightLiIndex=liIndex].classList.add("highlighted");
		}
		function inputKeyDown(e) {
			if (["ArrowDown","ArrowUp"].includes(e.key)){
				e.preventDefault();//prevents moving the textcursor when pressing up or down
				const newIndex=highlightLiIndex+(e.key==="ArrowDown"?1:-1);
				if (highlightUlIndex) {
					if (opts.length&&newIndex<opts.length&&newIndex>=0)
						highlightOpt.call(this,1,newIndex);
					else if (newIndex==-1&&allowEmpty)
						highlightOpt.call(this,0,0);
				} else if (opts.length&&newIndex==1)
					highlightOpt.call(this,1,0);
			} else if (e.key==="Enter") {
				this.#inputVal=highlightUlIndex?opts[highlightLiIndex].value:null;
				close();
				this.#moveCellCursor(0,e.shiftKey?-1:1);
				e.stopPropagation();
			} else if (e.key==="Escape")
				close();
		}
		function ulClick(e) {
			if (e.target.tagName.toLowerCase()=="li") {//not sure if ul could be the target? check here to make sure
				this.#inputVal=e.currentTarget.dataset.ulIndex==1?opts[[...ul.children].indexOf(e.target)].value:null;
				close();
				this.#exitEditMode(true);
			}
		}
	}

	#exitEditMode(save) {
		if (!this.#inEditMode)
			return;
			
		//make the table focused again so that it accepts keystrokes and also trigger any blur-event on input-element
		this.#container.focus();//so that #inputVal gets updated

		this.#inEditMode=false;
		this.#cellCursor.classList.remove("edit-mode");
		if (save&&this.#inputVal!=this.#selectedCellVal) {
			this.#activeStruct.edit.onChange?.(this.#inputVal,this.#selectedCellVal,this.#cellCursorDataObj
																			,this.#activeStruct,this.#activeExpCell);
			this.#cellCursorDataObj[this.#activeStruct.id]=this.#inputVal;
			if (this.#activeExpCell){
				const doHeightUpdate=this.#updateExpansionCell(this.#activeExpCell,this.#cellCursorDataObj);
				if (doHeightUpdate)
					this.#updateExpansionHeight(this.#selectedCell.closest("tr.expansion"),this.#mainRowIndex);
				for (let cell=this.#activeExpCell.parent; cell; cell=cell.parent)//update closed-group-renders
					if (cell.struct.closedRender)//found a group with a closed-group-render func
						cell.updateRenderOnClose=true;
			} else {
				this.#updateMainRowCell(this.#selectedCell,this.#activeStruct);
				this.#unsortCol(this.#activeStruct.id);
			}
		}
		this.#cellCursor.innerHTML="";
		if (this.#activeStruct.edit.dataType==="textarea")
			this.#adjustCursorPosSize(this.#selectedCell);
		this.#highlightOnFocus=false;
	}

	#commitRepeatedInsert(repeatEntry) {
		repeatEntry.creating=false;
		repeatEntry.parent.struct.onCreate?.(repeatEntry.rowData,repeatEntry)
	}

	#selectMainTableCell(cell) {
		if (!cell)//in case trying to move up from top row etc
			return;
		this.#exitEditMode(true);

		if (this.#activeExpCell) {
			for (let oldCellParent=this.#activeExpCell; oldCellParent=oldCellParent.parent;) {
				if (oldCellParent.struct.type==="group") {
					this.#closeGroup(oldCellParent);//close any open group above old cell
					this.#ignoreClicksUntil=Date.now()+500;
				}
				if (oldCellParent.creating)
					this.#commitRepeatedInsert(oldCellParent);
				oldCellParent.struct.onBlur?.(oldCellParent,this.#mainRowIndex);
			}
			this.#activeExpCell=null;//should be null when not inside expansion
		}
		this.#cellCursor.classList.toggle("disabled",cell.classList.contains("disabled"));
		this.#selectedCell=cell;
		this.#adjustCursorPosSize(cell);
		
		this.#mainRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);
		if (!cell.parentElement.classList.contains("expansion"))
			this.#mainColIndex=cell.cellIndex;
		this.#activeStruct=this.#colStructs[this.#mainColIndex];

		//make cellcursor click-through if it's on an expand-row-button-td or button
		const noPointerEvent=this.#activeStruct.type==="expand"||this.#activeStruct.edit?.dataType==="button";
		this.#cellCursor.style.pointerEvents=noPointerEvent?"none":"auto";

		this.#cellCursorDataObj=this.#data[this.#mainRowIndex];
		this.#activeStruct=this.#colStructs[this.#mainColIndex];
	}

	#selectExpansionCell(cellObject) {
		if (!cellObject)
			return;
		this.#exitEditMode(true);

		this.#cellCursor.classList.toggle("disabled",(cellObject.selEl??cellObject.el).classList.contains("disabled"));

		//remove cellcursor click-through in case an expand-button-cell was previously selected
		this.#cellCursor.style.pointerEvents="auto";
		for (var root=cellObject; root.parent; root=root.parent);
		this.#mainRowIndex=root.rowIndex;;
		if (this.#activeExpCell)//changing from an old expansionCell
			for (let oldParnt=this.#activeExpCell; oldParnt=oldParnt?.parent;)//traverse parents of old cell
				if(oldParnt.struct.type==="group"||oldParnt.struct.onBlur||oldParnt.creating){//found a group or cell
					//...with onBlur or cell that is being created. For any of these we want to observe the cell being
					//left so that appropriate action can be taken
					for (let newParent=cellObject; newParent=newParent.parent;)//traverse parents of new cell
						if (newParent===oldParnt) {//if this new parent-group is also part of old parents
							oldParnt=null;//break out of outer loop
							break;
						}
					if (oldParnt) {
						if (oldParnt.struct.type==="group") {
							this.#closeGroup(oldParnt)//if old parent-group is not part of new then close it
							this.#ignoreClicksUntil=Date.now()+500;
						}
						if (oldParnt.struct.onBlur)
							oldParnt.struct.onBlur?.(oldParnt,this.#mainRowIndex);
						if (oldParnt.creating)
							this.#commitRepeatedInsert(oldParnt);
					}
				}
		this.#activeExpCell=cellObject;
		this.#selectedCell=cellObject.selEl??cellObject.el;
		this.#adjustCursorPosSize(this.#selectedCell);
		this.#cellCursorDataObj=cellObject.dataObject;
		this.#activeStruct=cellObject.struct;

		//make cellcursor click-through if it's on a button
		this.#cellCursor.style.pointerEvents=this.#activeStruct.edit?.dataType==="button"?"none":"auto";
	}

	#adjustCursorPosSize(el,onlyPos=false) {
		if (!el)
			return;
		const tableSizerPos=this.#tableSizer.getBoundingClientRect();
		const cellPos=el.getBoundingClientRect();
		this.#cellCursor.style.top=cellPos.y-tableSizerPos.y+this.#tableSizer.offsetTop+"px";
		this.#cellCursor.style.left=cellPos.x-tableSizerPos.x+"px";
		this.#cellCursor.style.display="block";//it starts at display none since #setupSpreadsheet, so make visible now
		if (!onlyPos) {
			this.#cellCursor.style.height=cellPos.height+"px";
			this.#cellCursor.style.width=cellPos.width+"px";
		}
	}

	#createTableHeader() {
		this.#headerTable=this.#container.appendChild(document.createElement("table"));
		this.#headerTable.classList.add("header-table");
		const thead=this.#headerTable.appendChild(document.createElement("thead"));
		this.#headerTr=thead.insertRow();
		for (let col of this.#colStructs) {
			let th=document.createElement("th");
			th.addEventListener("mousedown",e=>this.#onThClick(e));
			this.#headerTr.appendChild(th).innerText=col.title??"\xa0";//non breaking space if nothing else or else
																	//sorting arrows wont be positioned correctly

			//create the divs used for showing html for sorting-up/down-arrow or whatever has been configured
			col.sortDiv=th.appendChild(document.createElement("DIV"));
			col.sortDiv.className="sortSymbol";
		}
		this.#headerTr.appendChild(document.createElement("th"));
	}

	#onThClick(e) {
		const clickedIndex=e.currentTarget.cellIndex;
		let sortingColIndex=-1,sortingCol;
		while (sortingCol=this.#sortingCols[++sortingColIndex]) {
			if (sortingCol.index===clickedIndex) {
				if (e.shiftKey&&this.#sortingCols.length>1&&sortingCol.order=="desc") {
					this.#sortingCols.splice(sortingColIndex,1);
					sortingColIndex=0;//to not make condition below loop fall true
				} else
					sortingCol.order=sortingCol.order=="asc"?"desc":"asc";
				if (!e.shiftKey)
					this.#sortingCols=[sortingCol];
				break;
			}
		}
		if (sortingColIndex==this.#sortingCols.length) {//if the clicked header wasn't sorted upon at all
			const {id,type}=this.#colStructs[clickedIndex];
			const sortCol={id,type,order:"asc",index:clickedIndex};
			if (!e.shiftKey)
				this.#sortingCols=[];
			this.#sortingCols.push(sortCol);
		}
		this.#updateHeaderSortHtml();
		e.preventDefault();//prevent text-selection when shift-clicking and double-clicking
		this.#sortData();
		this.#refreshTable();
	}

	#updateHeaderSortHtml() {
		for (let [thIndex,th] of Object.entries(this.#headerTr.cells)) {
			if (thIndex==this.#headerTr.cells.length-1)
				break;
			let order=null;
			let sortDiv=this.#colStructs[thIndex].sortDiv;
			for (let sortingCol of this.#sortingCols) {
				if (sortingCol.index==thIndex) {
					order=sortingCol.order;
					break;
				}
			}
			if (!order||th.classList.contains(order=="asc"?"desc":"asc"))
				th.classList.remove("asc","desc");
			if (order) {
				th.classList.add(order);
				sortDiv.innerHTML=(order=="asc"?this.#opts?.sortAscHtml:this.#opts?.sortDescHtml)??"";
			} else
				sortDiv.innerHTML=this.#opts?.sortNoneHtml??"";
		}
	}

	#sortData() {
		const sortCols=this.#sortingCols;
		if (!sortCols.length)
			return false;
		this.#data.sort(compare.bind(this));
		this.#mainRowIndex=this.#data.indexOf(this.#cellCursorDataObj);
		return true;
		
		function compare(a,b) {
			for (let sortCol of sortCols) {
				if (sortCol.type==="expand") {
					let aIsExpanded=this.#expandedRowHeights.keys.indexOf(a)!=-1;
					let bIsExpanded=this.#expandedRowHeights.keys.indexOf(b)!=-1;
					if (aIsExpanded!=bIsExpanded)
						return (aIsExpanded<bIsExpanded?1:-1)*(sortCol.order=="asc"?1:-1);
				} else if (a[sortCol.id]!=b[sortCol.id])
					return (a[sortCol.id]>b[sortCol.id]?1:-1)*(sortCol.order=="asc"?1:-1);
			}
		}
	}

	#createTableBody() {
		this.#scrollBody=this.#container.appendChild(document.createElement("div"));

		if (this.#staticRowHeight&&!this.#expansion)
			this.#scrollMethod=this.#onScrollStaticRowHeightNoExpansion;
		else if (this.#staticRowHeight&&this.#expansion)
			this.#scrollMethod=this.#onScrollStaticRowHeightExpansion;
		this.#scrollBody.addEventListener("scroll",e=>this.#scrollMethod(e),{passive:true});
		this.#scrollBody.className="scroll-body";
		
		this.#scrollingContent=this.#scrollBody.appendChild(document.createElement("div"));
		this.#scrollingContent.className="scrolling-content";

		this.#tableSizer=this.#scrollingContent.appendChild(document.createElement("div"));
		this.#tableSizer.style.position="relative";
		this.#tableSizer.style.top="0px";//need to have so that scrolling works properly when reading parseInt of it
		this.#tableSizer.className="table-sizer";

		this.#mainTable=this.#tableSizer.appendChild(document.createElement("table"));
		this.#mainTable.className="main-table";
		this.#mainTbody=this.#mainTable.appendChild(document.createElement("tbody"));
		for (let colStruct of this.#colStructs) {
			let col=document.createElement("col");
			this.#cols.push(col);
			this.#mainTable.appendChild(document.createElement("colgroup")).appendChild(col);
		}
		this.#borderSpacingY=parseInt(window.getComputedStyle(this.#mainTable)['border-spacing'].split(" ")[1]);
	}

	#updateSizesOfViewportAndCols() {
		let areaWidth=this.#tableSizer.offsetWidth;
		if (this.#container.offsetHeight!=this.#containerHeight) {
			this.#scrollBody.style.height=this.#container.offsetHeight-this.#headerTable.offsetHeight
				-(this.#searchInput?.offsetHeight??0)+"px";
			if (this.#container.offsetHeight>this.#containerHeight)
				this.#maybeAddTrs();
			else
				this.#maybeRemoveTrs();
			this.#containerHeight=this.#container.offsetHeight;
		}
		if (this.#container.offsetWidth>this.#containerWidth) {
			const percentageWidthRegex=/\d+\%/;
			let totalFixedWidth=0;
			let numUndefinedWidths=0;
			for (let col of this.#colStructs)
				if (!col.width)
					numUndefinedWidths++;
				else if (!percentageWidthRegex.test(col))//if fixed width
					totalFixedWidth+=(col.pxWidth=parseInt(col.width));
			let sumFixedAndFlexibleWidth=totalFixedWidth;
			for (let col of this.#colStructs)
				if (col.width&&percentageWidthRegex.test(col))//if flexible width
					sumFixedAndFlexibleWidth+=(col.pxWidth=(areaWidth-totalFixedWidth)*parseFloat(col.width)/100);
			for (let col of this.#colStructs)
				if (!col.width)//if undefined width
					col.pxWidth=(areaWidth-sumFixedAndFlexibleWidth)/numUndefinedWidths;
			for (var colI=0; colI<this.#colStructs.length; colI++) 
				this.#cols[colI].style.width=this.#headerTr.cells[colI].style.width=this.#colStructs[colI].pxWidth+"px";
		}			
		this.#headerTr.cells[colI].style.width=this.#scrollBody.offsetWidth-areaWidth+"px";;
		this.#headerTable.style.width=this.#scrollBody.offsetWidth+"px";
		this.#adjustCursorPosSize(this.#selectedCell);
	}

	#filterData(filterString) {
		this.#openExpansions={};
		this.#expandedRowHeights={keys:[],vals:[]};
		for (const tr of this.#mainTbody.querySelectorAll("tr.expansion"))
		 	tr.remove();
		this.#filter=filterString;
		const colsToFilterBy=[];
		for (let col of this.#colStructs)
			if (col.type!=="expand")
				colsToFilterBy.push(col);
		if (filterString) {
			this.#data=[];
			for (let dataRow of this._allData)
				for (let col of colsToFilterBy)
					if (dataRow[col.id].includes(filterString)) {
						this.#data.push(dataRow);
						break;
					}
		} else
			this.#data=this._allData;
		this.#scrollRowIndex=0;
		this.#refreshTable();
		this.#refreshTableSizerNoExpansions();
	}

	addData(data, highlight=false) {
		const oldLen=this.#data.length;
		if (highlight)
			this.#searchInput.value=this.#filter="";//remove any filter
		this.#data=this._allData=this._allData.concat(data);
		//this.#data.push(...data);//much faster than above but causes "Maximum call stack size exceeded" for large data
		let sortingOccured=this.#sortData();
		if (this.#filter)
			this.#filterData(this.#filter);
		else {
			if (sortingOccured)
				this.#refreshTable();
			else
				this.#maybeAddTrs();
			const numNewInData=this.#data.length-oldLen;
			this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height||0)+numNewInData*this.#rowHeight+"px";
		}
		if (highlight) {
			for (let dataRow of data)
				this.#highlightRowIndex(this.#data.indexOf(dataRow));
			this.scrollToDataRow(data[0],false);//false for not highlighting, above line does the highlight anyway
		}
	}

	/**Refreshes the table-rows. Should be used after sorting or filtering or such.*/
	#refreshTable() {
		//In order to render everything correctly and know which rows should be rendered in the view we need to go from
		//top to bottom because the number of expanded rows above the view might have changed. So go to 
		//#scrollRowIndex 0 to start at top row, also set #scrollY to 0 so the scrollMethod compares the current
		//scrollTop with 0.
		this.#scrollRowIndex=this.#scrollY=0;

		//adjust the sizer to what its top and height would be when scrolled all the way up.
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)+parseInt(this.#tableSizer.style.top)+"px";
		this.#tableSizer.style.top=this.#numRenderedRows=0;

		//its position and size needs to be udated.Hide for now and let #updateRowValues or #renderExpansion add it back
		this.#cellCursor.style.display="none";

		this.#mainTbody.replaceChildren();//remove all the tr-elements
		this.#maybeAddTrs();//add them again and with their correct data, at least based on them being the top rows 
		this.#scrollMethod();//now scroll back to the real scroll-position
	}

	/**This onScroll-handler is used when rows are of static height and can't be expanded either.
	 * It is the fastest scroll-method since row-heights are known and it is easy to calculate which rows should be
	 * rendered even when scrolling more than a whole page at once as each row won't have to be iterated, and rows
	 * will only have to be created or deleted if the table is resized so the same tr-elements are reused.* 
	 * @returns */
	#onScrollStaticRowHeightNoExpansion() {
		const scrY=this.#scrollBody.scrollTop;
		const newScrollRowIndex=Math.min(parseInt(scrY/this.#rowHeight),this.#data.length-this.#mainTbody.rows.length);
		
		if (newScrollRowIndex==this.#scrollRowIndex)
			return;
		if(Math.abs(newScrollRowIndex-this.#scrollRowIndex)>this.#mainTbody.rows.length){//if scrolling by whole page(s)
			this.#scrollRowIndex=parseInt(scrY/this.#rowHeight);
			this.#refreshTable();
		} else {
			const scrollSignum=Math.sign(newScrollRowIndex-this.#scrollRowIndex);//1 if moving down, -1 if up
			do {
				this.#scrollRowIndex+=scrollSignum;
				if (scrollSignum==1) {//moving down												move top row to bottom
					const dataIndex=this.#scrollRowIndex+this.#numRenderedRows-1;
					this.#updateRowValues(this.#mainTbody.appendChild(this.#mainTbody.firstChild),dataIndex);
				} else {//moving up
					let trToMove=this.#mainTbody.lastChild;									//move bottom row to top
					this.#mainTbody.prepend(trToMove);
					this.#updateRowValues(trToMove,this.#scrollRowIndex);
				}
			} while (this.#scrollRowIndex!=newScrollRowIndex);
		}
		this.#refreshTableSizerNoExpansions();
	}

	#onScrollStaticRowHeightExpansion(e) {
		const newScrY=this.#scrollBody.scrollTop;
		if (newScrY>parseInt(this.#scrollY)) {//if scrolling down
			while (newScrY-parseInt(this.#tableSizer.style.top)
			>(this.#expHeightGet(this.#scrollRowIndex)??this.#rowHeight)) {//if a whole top row is outside
				if (this.#scrollRowIndex+this.#numRenderedRows>this.#data.length-1)
					break;
				

				//check if the top row (the one that is to be moved to the bottom) is expanded
				if (this.#expHeightGet(this.#scrollRowIndex)) {
					delete this.#openExpansions[this.#scrollRowIndex];
					var scrollJumpDistance=this.#expHeightGet(this.#scrollRowIndex);
					this.#mainTbody.rows[1].remove();
					
				} else {
					scrollJumpDistance=this.#rowHeight;
				}

				if (this.#scrollRowIndex===this.#mainRowIndex)//cell-cursor is on moved row
					this.#selectedCell=null;
				

				const dataIndex=this.#numRenderedRows+this.#scrollRowIndex;//the data-index of the new row

				this.#scrollRowIndex++;

				//move the top row to bottom and update its values
				const trToMove=this.#updateRowValues(this.#mainTbody.appendChild(this.#mainTbody.firstChild),dataIndex);

				//move the table down by the height of the removed row to compensate,else the whole table would shift up
				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)+scrollJumpDistance+"px";

				//also shrink the container of the table the same amount to maintain the scrolling-range.
				this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)-scrollJumpDistance+"px";

				if (this.#expHeightGet(dataIndex))
					this.#renderExpansion(trToMove,dataIndex);
				else
					trToMove.classList.remove("expanded");

				this.#lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row
			}
		} else if (newScrY<parseInt(this.#scrollY)) {//if scrolling up
			while (newScrY<parseInt(this.#tableSizer.style.top)) {//while top row is below top of viewport
				this.#scrollRowIndex--;

				//check if the bottom row (the one that is to be moved to the top) is expanded
				if (this.#expHeightGet(this.#scrollRowIndex+this.#numRenderedRows)) {
					delete this.#openExpansions[this.#scrollRowIndex+this.#numRenderedRows];
					this.#mainTbody.lastChild.remove();//remove the expansion-tr
				}

				if (this.#scrollRowIndex+this.#numRenderedRows===this.#mainRowIndex)//cell-cursor is on moved row
					this.#selectedCell=null;

				let trToMove=this.#mainTbody.lastChild;									//move bottom row to top
				this.#mainTbody.prepend(trToMove);
				this.#updateRowValues(trToMove,this.#scrollRowIndex);//the data of the new row;

				//move the table up by the height of the removed row to compensate,else the whole table would shift down
				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)-this.#rowHeight+"px";

				//also grow the container of the table the same amount to maintain the scrolling-range.
				//this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)+this.#rowHeight+"px";

				if (this.#expHeightGet(this.#scrollRowIndex))
					this.#renderExpansion(trToMove,this.#scrollRowIndex);
				else
					trToMove.classList.remove("expanded");

				this.#lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row

				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)
								 -(this.#expHeightGet(this.#scrollRowIndex)??this.#rowHeight)+this.#rowHeight+"px";
				this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)
										+(this.#expHeightGet(this.#scrollRowIndex)??this.#rowHeight)+"px";
			}
		}
		this.#scrollY=newScrY;
	}

	

	/**This should be called on each row that is being scrolled into view that might hold the active cell in order
	 * to set #selectedCell to the correct element
	 * @param {HTMLTableRowElement} tr */
	#lookForActiveCellInRow(tr) {
		if (tr.dataset.dataRowIndex==this.#mainRowIndex) {
			if (!this.#activeExpCell)
				this.#selectedCell=tr.cells[this.#mainColIndex];
			else {//if inside expansion
				//generate the path to the cellObject in #activeExpansionCell by stepping through its parents to root
				let path=[];
				for (let cellObject=this.#activeExpCell; cellObject.parent; cellObject=cellObject.parent)
					path.unshift(cellObject.index);
				//now follow the same path in the new #openExpansionNavMap[rowIndex], eg the cellObjects..
				let cellObject=this.#openExpansions[this.#mainRowIndex];
				for (let step of path)
					cellObject=cellObject.children[step];
				this.#selectedCell=cellObject.el;
				this.#activeExpCell=cellObject;//should be identical but this allows for the old one to be gc'd
			}
			this.#adjustCursorPosSize(this.#selectedCell);
		}
	}

	#refreshTableSizerNoExpansions() {	
		this.#tableSizer.style.top=this.#scrollRowIndex*this.#rowHeight+"px";
		this.#tableSizer.style.height=(this.#data.length-this.#scrollRowIndex)*this.#rowHeight+"px";
	}

	/**Should be called if tr-elements might need to be created which is when data is added or if table grows*/
	#maybeAddTrs() {
		let lastTr=this.#mainTbody.lastChild;
		const scrH=this.#scrollBody.offsetHeight;
		const dataLen=this.#data.length;
		//if there are fewer trs than datarows, and if there is empty space below bottom tr
		while ((this.#numRenderedRows-1)*this.#rowHeight<scrH&&this.#scrollRowIndex+this.#numRenderedRows<dataLen) {
			lastTr=this.#mainTable.insertRow();
			this.#numRenderedRows++;
			for (let i=0; i<this.#colStructs.length; i++) {
				const cell=lastTr.insertCell();
				cell.appendChild(document.createElement("div"));
				cell.firstChild.style.height=this.#rowInnerHeight||"auto";				
				if (this.#colStructs[i].type==="expand")
					cell.classList.add("expandcol");
			}
			this.#updateRowValues(lastTr,this.#scrollRowIndex+this.#numRenderedRows-1);
			if (this.#expHeightGet(this.#scrollRowIndex+this.#numRenderedRows-1))
				this.#renderExpansion(lastTr,this.#scrollRowIndex+this.#numRenderedRows-1);
			this.#lookForActiveCellInRow(lastTr);//look for active cell (cellcursor) in the row
			if (!this.#rowHeight) {//if there were no rows prior to this
				this.#rowHeight=lastTr.offsetHeight+this.#borderSpacingY;
				const tdComputedStyle=window.getComputedStyle(lastTr.firstChild);
				for (let prop of ["paddingTop","paddingBottom","borderBottomWidth","borderTopWidth"])
					this.#rowInnerHeight-=parseInt(tdComputedStyle[prop]);
				this.#rowInnerHeight=this.#rowInnerHeight+lastTr.offsetHeight+"px";
			}
		}
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	#maybeRemoveTrs() {
		const scrH=this.#scrollBody.offsetHeight;
		const trs=this.#mainTbody.rows;
		while (this.#numRenderedRows>3&&(this.#numRenderedRows-1)*this.#rowHeight>scrH) {
			if (this.#expHeightGet(this.#scrollRowIndex+this.#numRenderedRows-1)) {
				this.#mainTbody.lastChild.remove();
				delete this.#openExpansions[this.#scrollRowIndex+this.#numRenderedRows];
			}
			this.#mainTbody.lastChild.remove();
			this.#numRenderedRows--;
		}
	}

	/**Update the values of a row in the table. The tr needs to be passed in as well as the index of the data in #data
	 * The row needs to already have the right amount of td's.
	 * @param {HTMLTableRowElement} tr The tr-element whose cells that should be updated*/
	#updateRowValues(tr,mainIndex) {
		tr.dataset.dataRowIndex=mainIndex;
		for (let colI=0; colI<this.#colStructs.length; colI++) {
			let td=tr.cells[colI];
			let colStruct=this.#colStructs[colI];
			if (colStruct.type==="expand")
				td.innerHTML=`<div style="height:${this.#rowInnerHeight||"auto"}"><a><span></span></a></div>`;
			else 
				this.#updateMainRowCell(td,colStruct);
		}
		if (this.#highlightRowsOnView[mainIndex]) {
			delete this.#highlightRowsOnView[mainIndex];
			this.#highlightRowIndex(mainIndex);
		}
		return tr;
	}


	/**Updates the html-element of a cell inside an expansion. Also updates nonEmptyDescentants of the cell-object of 
	 * 	group-rows as well as toggling the empty-class of them. Reports back whether visibility has been changed.
	 * @param {*} cellObject */
	#updateExpansionCell(cellObject,rowData) {
		let cellEl=cellObject.el;
		if (cellObject.struct.maxHeight) {//if there's a maxHeight stated, which is used for textareas
			cellEl.innerHTML="";//empty the cell, otherwise multiple calls to this would add more and more content to it
			cellEl=cellEl.appendChild(document.createElement("div"));//then put a div inside and change cellEl to that
			cellEl.style.maxHeight=cellObject.struct.maxHeight;//then set its maxHeight
			cellEl.style.overflow="auto";//and male it scrollable
			//can't make td directly scrollable which is why the div is needed
		}
		for (var rootCell=cellObject;rootCell.parent;rootCell=rootCell.parent);
		const oldCellContent=cellEl.innerText;
		this.#updateCell(cellObject.struct,cellEl,cellObject.selEl,rowData,rootCell.rowIndex,cellObject);
		if (cellObject.struct.edit?.dataType!=="button") {
			const newCellContent=cellEl.innerText;
			if (!newCellContent!=!oldCellContent) {
				for (let cellI=cellObject; cellI; cellI=cellI.parent)
					if (cellI.nonEmptyDescentants!=null)
						cellI.grpTr.classList.toggle("empty",!(cellI.nonEmptyDescentants+=newCellContent?1:-1));
				return true;
			}
		} else
			cellObject.el=cellObject.selEl=cellObject.el.querySelector("button");
	}

	#updateCell(struct,el,selEl,rowData,mainIndex,cellObj=null) {
		if (struct.edit?.dataType==="button") {
			this.#generateButton(struct,mainIndex,el,rowData,cellObj);
		} else {
			let newCellContent;
			if (struct.render)
				newCellContent=struct.render(rowData,struct,mainIndex);
			else if (struct.edit?.dataType==="select")
				newCellContent=struct.edit.options.find(opt=>opt.value==rowData[struct.id])?.text??"";
			else
				newCellContent=rowData[struct.id]??"";
			let isDisabled=false;
			if (this.#spreadsheet&&struct.type!=="expand") {
				const enabledFuncResult=struct.edit?.enabled?.(struct,rowData,mainIndex,cellObj);
				if (!struct.edit||enabledFuncResult==false||enabledFuncResult?.enabled==false)
					isDisabled=true;
			}
			(selEl??el).classList.toggle("disabled",isDisabled);
			el.innerText=newCellContent;
		}
	}

	/**Updates the html-element of a main-table-cell
	 * @param {*} cellEl 
	 * @param {*} colStruct */
	#updateMainRowCell(cellEl,colStruct) {
		cellEl.firstChild.innerHTML="";
		const mainIndex=cellEl.closest(".main-table>tbody>tr").dataset.dataRowIndex;
		this.#updateCell(colStruct,cellEl.firstChild,cellEl,this.#data[mainIndex],mainIndex);
	}

	scrollToDataRow(dataRow,highlight=true) {
		let scrollY=0;
		for (let i=-1,otherDataRow;otherDataRow=this.#data[++i];) {
			if (otherDataRow==dataRow) {
				scrollY=scrollY-this.#scrollBody.offsetHeight/2+this.#rowHeight;
				this.#scrollBody.scrollTo({top:scrollY,behavior:'smooth'});
				if (highlight)
					this.#highlightRowIndex(i);
				return;
			}
			scrollY+=this.#expHeightGet(i)??this.#rowHeight;
		}
	}

	#highlightRowIndex(index) {
		const tr=this.#mainTbody.querySelector(`[data-data-row-index="${index}"]`);
		if (tr) {
			const currentColors=[];
			for (const td of tr.children) {
				currentColors.push(window.getComputedStyle(td).backgroundColor);
				td.style.transition = "none";
				td.style.backgroundColor="blue";
			}
			setTimeout(()=>{
				for (const td of tr.children) {
					td.style.transition="background-color 1s linear";
					td.style.backgroundColor=currentColors.shift();
				}
			})
		} else {
			this.#highlightRowsOnView[index]=true;
		}
	}
}