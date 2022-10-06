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
	#allData=[];//contains all, unfiltered data that has been added via addData()
	#data=[];//with no filter applied(empty seachbar) then this is reference to #allData, otherwise is a subset of it
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
	#staticRowHeight;//This is set in the constructor. If it is true then all rows should be of same height which
					 //improves performance.
	#spreadsheet;//whether the table is a spreadsheet, which is set in the constructor
	#opts; //reference to the object passed as opts in the constructor
	#sortingCols=[{index:0,order:"asc"}];//contains data on how the table currently is sorted. It is an array of 
										//objects which each contain "index" which is the index of the column and
										//"order" which value should be either "desc" or "asc". The array may contain
										//multiple of these objects for having it sorted on multiple ones.
	#searchInput;//the input-element used for filtering data
	#filter;//the currently applied filter. Same as #searchInput.value but also used for comparing old & new values
	
	#cellCursor;//The element that for spreadsheets shows which cell is selected
	#mainRowIndex;//the index of the row that the cellcursor is at
	#mainColIndex;//the index of the column that the cellcursor is at
	#activeCellStruct;//reference to the struct-object of the selcted cell. For cells in the maintable this would
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
	#input;//input-element of cell-cursor. Can be different kind of inputs depending on data
	//main-table in order to reveal the outermost line when an outermost cell is selected
	highlightOnFocus=true;//when the spreadsheet is focused  we want focus-outline to appear but only if focused by
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
	#expandedRowHeights={};//for tables where rows can be expanded, this object will keep track of which rows
	//have been expanded and also their combined height. key is data-row-index
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
	 *				title:"Foobar",//displayed title if placed in list placed in a list as they can be nested
	 * 				entries:[]//each element should be another entry
	 * 				titlesColWidth:String Width of the column with the titles. Don't forget adding the unit.
	 * 					Default is null which enables setting the width via css.
	 *			}
	 *			{
  	 * 				type:"field",//this is what will display data and which also can be editable
  	 * 				title:"Foobar",//displayed title if placed in list
  	 * 				id:"foobar",//the key of the property in the data that the row should display
	 * 				maxHeight int For textareas, sets the max-height in pixels that it should be able to be resized to
	 * 				edit: Object {//field is editable if this object is supplied and its disabled-prop is falsey
	 * 				dataType String This is mandatory and specifies the type of input. Possible values are:
	 * 					"text"(single line text), "textarea"(multi-line text),"number"(number with stepper),
	 * 					"date"(a date and possibly time with a calendar), "select"(selection of multiple items).
	 * 				Depending on which one is selected certain properties
	 * 					below are (dis)allowed.
	 * 				maxLength int Sets max-length for strings if dataType is text
	 * 				placeholder String adds a placeholder-string to the input-element
  	 * 			}
  	 * 			{
  	 * 				type:"repeated",//used when the number of rows is undefined and where more may be able to be added, 
	 * 								//perhaps by the user
  	 * 				title:"Foobar",//displayed title in placed in a list
  	 * 				id:"foobar",//this should be the key of an array in the data where each object corresponds to each
	 * 							//element in this repeated rows.
  	 * 				entry: any entry //may be item or list for instance. the data retrieved for these will be 1
	 * 								//level deeper so the path from the base would be idOfRepeatedRows->arrayIndex->*
  	 * 			}
  	 * 			{
  	 * 				type:"group",//used when a set of data should be grouped, like for instance having an address and
	 * 							//all the rows in it belongs together. the group also has to be entered
	 * 							//with enter/doubleclick
  	 * 				title:"Foobar",//displayed title if placed in list
  	 * 				entries: Array any entries. fields, lists, etc.. 
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
			opts.sortAscHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#000" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortDescHtml==null)
			opts.sortDescHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#000" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortNoneHtml==null)
			opts.sortNoneHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" '
									+'points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
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

	#spreadsheetOnFocus(e) {
		if (this.#mainRowIndex==null)
			this.#selectMainTableCell(this.#mainTbody.rows[0].cells[0]);
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		if (this.highlightOnFocus)
			this.#container.style.removeProperty("outline");
		else
			this.#container.style.outline="none"
			
		this.highlightOnFocus=true;
	}

	#moveCellCursor(numCols,numRows) {
		//const newColIndex=Math.min(this.#cols.length-1,Math.max(0,this.#cellCursorColIndex+numCols));
		let newTd;
		this.#scrollToCursor();
		if (numRows) {//moving up or down

			//need to call this manually before getting the td-element or else it might not even exist yet. 
			//#onScrollStaticRowHeight() will actually get called once more through the scroll-event since we called
			//#scrollToRow() above, but it doesn't get fired immediately. Running it twice is not a big deal.
			this.#scrollMethod();
			let newColIndex=this.#mainColIndex;
			if (this.#activeExpCell) {//moving from inside expansion.might move to another cell inside,or outside
				this.#selectAdjacentExpansionCell(this.#activeExpCell,numRows==1?true:false);
			} else if (numRows===1&&this.#expandedRowHeights[this.#mainRowIndex]){//moving down into expansion
				this.#selectFirstSelectableExpansionCell(this.#openExpansions[this.#mainRowIndex],true);
			} else if (numRows===-1&&this.#expandedRowHeights[this.#mainRowIndex-1]){//moving up into expansion
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
		for (let childI=isGoingDown?0:children.length-1; childI>=0&&childI<children.length; childI+=isGoingDown||-1) {
			let resultObj=this.#getFirstSelectableExpansionCell(children[childI],isGoingDown);
			if (resultObj)
				return resultObj;
		}
	}
	

	#spreadsheetKeyDown(e) {
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
				break; case "+":
					this.#expandRow(this.#selectedCell.parentElement,this.#mainRowIndex);
				break; case "-":
					this.#contractRow(this.#mainRowIndex);
				break; case "Enter":
					this.#scrollToCursor();
					if (this.#selectedCell.classList.contains("expandcol"))
						return this.#toggleRowExpanded(this.#selectedCell.parentElement);
					this.#enterCell();
					e.preventDefault();//prevent newline from being entered into textareas
			}
		} else {
			switch (e.key) {
				case "Enter":
				if (e.ctrlKey&&this.#activeCellStruct.edit.dataType==="textarea") {
					this.#insertAtCursor(this.#input,"\r\n");
					this.#autoTextAreaResize();
				} else {
					this.#exitEditMode(true);
					this.#moveCellCursor(0,e.shiftKey?-1:1);
				}
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

	#expandRow(tr,dataRowIndex) {
		if (!this.#expansion||this.#expandedRowHeights[dataRowIndex])
			return;
		const expansionRow=this.#renderExpansion(tr,dataRowIndex,false);
		this.#expandedRowHeights[dataRowIndex]=this.#rowHeight+expansionRow.offsetHeight+this.#borderSpacingY;
		const contentDiv=expansionRow.querySelector(".content");
		if (!this.#expBordersHeight)//see declarataion of #expansionTopBottomBorderWidth
			this.#expBordersHeight=this.#expandedRowHeights[dataRowIndex]-contentDiv.offsetHeight;
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)//adjust scroll-height reflect change...
			+this.#expandedRowHeights[dataRowIndex]-this.#rowHeight+"px";//...in height of the table
		//animate
		contentDiv.style.height="0px";//start at 0
		setTimeout(()=>contentDiv.style.height=this.#expandedRowHeights[dataRowIndex]-this.#expBordersHeight+"px");
		this.#animateCellcursorPos();
	}

	#contractRow(dataRowIndex) {
		if (!this.#expansion||!this.#expandedRowHeights[dataRowIndex])
			return;
		const tr=this.#mainTbody.querySelector(`[data-data-row-index="${dataRowIndex}"].expanded`);
		if (this.#mainRowIndex==dataRowIndex&&this.#activeExpCell)//if cell-cursor is inside the expansion
			this.#selectMainTableCell(tr.cells[this.#mainColIndex]);//then move it out
		const contentDiv=tr.nextSibling.querySelector(".content");
		if (contentDiv.style.height==="auto") {//if fully expanded
			contentDiv.style.height=this.#expandedRowHeights[dataRowIndex]-this.#expBordersHeight+"px";
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
		const navMap=this.#openExpansions[rowIndex]={};
		const expansion=this.#generateExpansionContent(this.#expansion,rowIndex,navMap,expansionDiv,[]);
		expansion.rowIndex=rowIndex;
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
			 	-this.#expandedRowHeights[dataRowIndex]+this.#rowHeight+"px";
			expansionTr.remove();
			delete this.#expandedRowHeights[dataRowIndex];
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
	#generateExpansionContent(struct,dataIndex,cellObject,parentEl,path,isGroupMember=false) {
		switch (struct.type) {
			case "list": return this.#generateExpansionList(struct,dataIndex,cellObject,parentEl,path);
			case "field": return this.#generateExpansionField(struct,dataIndex,cellObject,parentEl,path,isGroupMember);
			case "group": return this.#generateExpansionGroup(struct,dataIndex,cellObject,parentEl,path);
		}
	}

	#generateExpansionGroup(groupStructure,dataIndex,cellObj,parentEl,path) {
		cellObj.children=[];
		const groupTable=document.createElement("table");
		parentEl.classList.add("group-cell");
		cellObj.el=groupTable;//so that the whole group-table can be selected
		cellObj.struct=groupStructure;
		groupTable.className="expansion-group";
		for (let entryI=-1,struct; struct=groupStructure.entries[++entryI];) {
			let tr=groupTable.insertRow();
			tr.className="empty";//start as empty to hide when closed.updateCell() will remove it if a cell is non-empty
			let td=tr.insertCell();
			if (entryI>0) {
				const separator=td.appendChild(document.createElement("div"));
				separator.className="separator";
			}
			let header=td.appendChild(document.createElement("h4"));
			header.innerText=struct.title;
			
			let contentDiv=td.appendChild(document.createElement("div"));
			contentDiv.className="value";
			path.push(entryI);

			//create cell-object for group-member. nonEmptyDescentants keeps track of how many descendant-cells that are
			//non-empty in order to mark group-rows as empty to hide them while group is closed
			let childCellObj=cellObj.children[entryI]={nonEmptyDescentants:0,parent:cellObj,index:entryI};

			let cellChild=this.#generateExpansionContent(struct,dataIndex,childCellObj,td,path,true);
			path.pop();
		}
		parentEl.appendChild(groupTable);
		return cellObj;
	}

	#generateExpansionList(listStructure,dataIndex,cellObject,parentEl,path) {
		cellObject.children=[];
		cellObject.struct=listStructure;
		const listTable=document.createElement("table");
		listTable.className="expansion-list";
		let titlesCol=document.createElement("col");
		listTable.appendChild(document.createElement("colgroup")).appendChild(titlesCol);
		if (listStructure.titlesColWidth)
			titlesCol.style.width=listStructure.titlesColWidth;
		for (let entryI=-1,struct; struct=listStructure.entries[++entryI];) {
			let listTr=listTable.insertRow();
			let titleTd=listTr.insertCell();
			titleTd.className="title";
			titleTd.innerText=struct.title;
			let contentTd=listTr.insertCell();
			contentTd.className="value";
			path.push(entryI);
			let cellChild=this.#generateExpansionContent(struct,dataIndex,cellObject.children[entryI]={},contentTd,path);
			path.pop();
			cellChild.parent=cellObject;
			cellChild.index=entryI;
		}
		parentEl.appendChild(listTable);
		return cellObject;
	}

	#generateExpansionField(fieldStructure,dataIndex,cellObject,parentEl,path,isGroupMember) {
		if (isGroupMember)
			parentEl=parentEl.parentElement;
		cellObject.el=parentEl;
		this.#updateCell(parentEl,dataIndex,fieldStructure,cellObject);
		parentEl.dataset.path=path.join("-");
		cellObject.dataObject=this.#data[dataIndex];
		cellObject.struct=fieldStructure;
		return cellObject;
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
	}

	#spreadsheetMouseDown(e) {
		if (document.activeElement!==this.#container)
			this.highlightOnFocus=false;//see decleration
		this.#container.style.outline="none";//see #spreadsheetOnFocus
	}
	
	#mainTableMouseDown(e) {
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

	#autoTextAreaResize() {
		const maxHeight=this.#activeCellStruct.maxHeight??Infinity;
		//change size of cellcursor which holds the textarea, to the new scrollHeight of textarea. This results in
		//the height of textarea to change too because its height is 100% of the cellcursor.
		//also changing the height of the underlying cell which affects the height of the expansion
		this.#cellCursor.style.height=this.#selectedCell.style.height=Math.min(maxHeight,this.#input.scrollHeight)+'px';

		//need to call this to make the height of the expansion adjust and reflect the change in size of the textarea
		this.#updateExpansionHeight(this.#selectedCell.closest("tr.expansion"),this.#mainRowIndex);
	}

	#updateExpansionHeight(expansionTr) {
		const contentDiv=expansionTr.querySelector(".content");
		contentDiv.style.height="auto";//set to auto in case of in middle of animation, get correct height

		const prevRowHeight=this.#expandedRowHeights[this.#mainRowIndex];
		const newRowHeight=this.#rowHeight+expansionTr.offsetHeight+this.#borderSpacingY;
		this.#expandedRowHeights[this.#mainRowIndex]=newRowHeight;
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)//adjust scroll-height reflect change...
			+newRowHeight-prevRowHeight+"px";//...in height of the table
	}

	#enterCell(e) {
		if (this.#activeCellStruct.edit) {
			this.#selectedCellVal=this.#cellCursorDataObj[this.#activeCellStruct.id];
			this.#inEditMode=true;
			this.#cellCursor.classList.add("edit-mode");
			if (this.#activeCellStruct.edit.dataType==="textarea") {
				this.#input=document.createElement("textarea");
				this.#input.addEventListener('input', e=>this.#autoTextAreaResize.call(this,e));
			} else
				this.#input=document.createElement("input");
			this.#cellCursor.appendChild(this.#input);
			this.#input.focus();
			this.#input.value=this.#selectedCellVal??"";
			if (this.#activeCellStruct.edit.maxLength)
				this.#input.maxLength=this.#activeCellStruct.edit.maxLength;
			this.#input.placeholder=this.#activeCellStruct.edit.placeholder??"";
			if (this.#activeCellStruct.edit.cleave)
				new Cleave(this.#input,this.#activeCellStruct.edit.cleave);
		} else if (this.#activeCellStruct.type==="group") {
			this.#activeExpCell.el.classList.add("open");
			this.#selectExpansionCell(this.#getFirstSelectableExpansionCell(this.#activeExpCell,true,true));
		}
	}

	#exitEditMode(save) {
		let newVal;
		if (!this.#inEditMode)
			return;
		this.#inEditMode=false;
		this.#cellCursor.classList.remove("edit-mode");
		if (save) {
			newVal=this.#input.value;
			if (newVal!=this.#selectedCellVal) {
				this.#cellCursorDataObj[this.#activeCellStruct.id]=newVal;
				if (this.#updateCell(this.#selectedCell,this.#mainRowIndex,this.#activeCellStruct,this.#activeExpCell))
					this.#updateExpansionHeight(this.#selectedCell.closest("tr.expansion"),this.#mainRowIndex);
			}
		}
		this.#cellCursor.innerHTML="";
		if (this.#activeCellStruct.edit.dataType==="textarea") {
			this.#autoTextAreaResize();
			this.#adjustCursorPosSize(this.#selectedCell);
		}
		this.highlightOnFocus=false;
		this.#container.focus();//make the table focused again so that it accepts keystrokes
	}

	#selectMainTableCell(cell) {
		if (!cell)//in case trying to move up from top row etc
			return;
		if (this.#activeExpCell) {
			for (let oldCellParent=this.#activeExpCell; oldCellParent=oldCellParent.parent;)
				if (oldCellParent.struct.type==="group")
					oldCellParent.el.classList.remove("open");//close any open group above old cell
			this.#activeExpCell=null;//should be null when not inside expansion
		}
		this.#exitEditMode(true);
		this.#selectedCell=cell;
		this.#adjustCursorPosSize(cell);
		
		this.#mainRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);
		if (!cell.parentElement.classList.contains("expansion"))
			this.#mainColIndex=cell.cellIndex;
		this.#activeCellStruct=this.#colStructs[this.#mainColIndex];

		//make cellcursor click-through if it's on an expand-row-button-td
		this.#cellCursor.style.pointerEvents=this.#activeCellStruct.type==="expand"?"none":"auto";

		this.#cellCursorDataObj=this.#data[this.#mainRowIndex];
		this.#activeCellStruct=this.#colStructs[this.#mainColIndex];
	}

	#selectExpansionCell(cellObject) {
		if (!cellObject)
			return;

		//remove cellcursor click-through in case an expand-button-cell was previously selected
		this.#cellCursor.style.pointerEvents="auto";
		for (var root=cellObject; root.parent; root=root.parent);
		this.#mainRowIndex=root.rowIndex;;
		if (this.#activeExpCell)//changing from an old expansionCell
			for (let oldParent=this.#activeExpCell; oldParent=oldParent?.parent;)//traverse parents of old cell
				if (oldParent.struct.type==="group") {//found a parent-group, which means that group is open
					for (let newParent=cellObject; newParent=newParent.parent;)//traverse parents of new cell
						if (newParent===oldParent) {//if this new parent-group is also part of old parents
							oldParent=null;//break out of outer loop
							break;
						}
					oldParent?.el.classList.remove("open");//if this old parent-group is not part of new then close it
				}
		this.#activeExpCell=cellObject;
		this.#exitEditMode(true);
		this.#adjustCursorPosSize(cellObject.el);
		this.#selectedCell=cellObject.el;
		this.#cellCursorDataObj=cellObject.dataObject;
		this.#activeCellStruct=cellObject.struct;
	}

	#adjustCursorPosSize(el,onlyPos=false) {
		if (!el)
			return;
		const tableSizerPos=this.#tableSizer.getBoundingClientRect();
		const cellPos=el.getBoundingClientRect();
		this.#cellCursor.style.top=cellPos.y-tableSizerPos.y+this.#tableSizer.offsetTop+"px";
		this.#cellCursor.style.left=cellPos.x-tableSizerPos.x+"px";
		if (!onlyPos) {
			this.#cellCursor.style.height=cellPos.height+"px";
			this.#cellCursor.style.width=cellPos.width+"px";
		}
	}

	#createTableHeader() {
		this.#headerTable=this.#container.appendChild(document.createElement("table"));
		const thead=this.#headerTable.appendChild(document.createElement("thead"));
		this.#headerTr=thead.insertRow();
		for (let col of this.#colStructs) {
			let th=document.createElement("th");
			th.addEventListener("mousedown",e=>this.#onThClick(e));
			this.#headerTr.appendChild(th).innerText=col.title??"";

			//create the divs used for showing html for sorting-up/down-arrow or whatever has been configured
			col.sortDiv=th.appendChild(document.createElement("DIV"));
			col.sortDiv.className="sortSymbol";
		}
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
		if (sortingColIndex==this.#sortingCols.length)//if the clicked header wasn't sorted upon at all
			if (e.shiftKey)
				this.#sortingCols.push({index:clickedIndex,order:"asc"});
			else
				this.#sortingCols=[{index:clickedIndex,order:"asc"}];
		this.#updateHeaderSortClasses();
		e.preventDefault();//prevent text-selection when shift-clicking and double-clicking
		this.#sortData();
		this.#refreshRows();
	}

	#updateHeaderSortClasses() {
		for (let [thIndex,th] of Object.entries(this.#headerTr.cells)) {
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
		for (let sortCol of sortCols)//go through all the columns in the sorting-order and set their id (the 
			sortCol.id=this.#colStructs[sortCol.index].id;			//key of that  column in the data) for fast access
		this.#data.sort(compare);
		
		function compare(a,b) {
			for (let sortCol of sortCols) {
				if (a[sortCol.id]<b[sortCol.id])
					return sortCol.order=="asc"?-1:1;
				if (a[sortCol.id]>b[sortCol.id])
					return sortCol.order=="asc"?1:-1;
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
			for (let colI=0; colI<this.#colStructs.length; colI++) 
				this.#cols[colI].style.width=this.#headerTr.cells[colI].style.width=this.#colStructs[colI].pxWidth+"px";
		}			
		this.#headerTable.style.width=areaWidth+"px";
		this.#adjustCursorPosSize(this.#selectedCell);
	}

	#filterData(filterString) {
		this.#filter=filterString;

		const colsToFilterBy=[];
		for (let col of this.#colStructs) {
			if (col.type!=="expand")
				colsToFilterBy.push(col);
		}

		if (!filterString||filterString=="")
			this.#data=this.#allData;
		else {
			this.#data=[];
			for (let dataRow of this.#allData) {
				for (let col of colsToFilterBy) {
					if (dataRow[col.id].includes(filterString)) {
						this.#data.push(dataRow);
						break;
					}
				}
			}
		}
		this.#scrollRowIndex=0;
		this.#refreshRows();
		this.#refreshTableSizerNoExpansions();
	}

	addData(data) {
		const priorlyEmpty=!data.length;
		this.#allData=this.#allData.concat(data);
		//this.#data.push(...data);//much faster than above but causes "Maximum call stack size exceeded" for large data
		this.#sortData();
		if (this.#filter)
			this.#filterData(this.#filter);
		else {
			this.#data=this.#allData;
			this.#maybeAddTrs();
			this.#refreshTableSizerNoExpansions();
		}		
	}

	#refreshRows() {
		this.#mainTbody.replaceChildren();
		this.#numRenderedRows=0;
		this.#maybeAddTrs();
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
			this.#refreshRows();
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
			>(this.#expandedRowHeights[this.#scrollRowIndex]??this.#rowHeight)) {//if a whole top row is outside
				if (this.#scrollRowIndex+this.#numRenderedRows>this.#data.length-1)
					break;
				

				//check if the top row (the one that is to be moved to the bottom) is expanded
				if (this.#expandedRowHeights[this.#scrollRowIndex]) {
					delete this.#openExpansions[this.#scrollRowIndex];
					var scrollJumpDistance=this.#expandedRowHeights[this.#scrollRowIndex];
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

				if (this.#expandedRowHeights[dataIndex])
					this.#renderExpansion(trToMove,dataIndex);
				else
					trToMove.classList.remove("expanded");

				this.#lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row
			}
		} else {//if scrolling up
			while (newScrY<parseInt(this.#tableSizer.style.top)) {//while top row is below top of viewport
				this.#scrollRowIndex--;

				//check if the bottom row (the one that is to be moved to the top) is expanded
				if (this.#expandedRowHeights[this.#scrollRowIndex+this.#numRenderedRows]) {
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

				if (this.#expandedRowHeights[this.#scrollRowIndex])
					this.#renderExpansion(trToMove,this.#scrollRowIndex);
				else
					trToMove.classList.remove("expanded");

				this.#lookForActiveCellInRow(trToMove);//look for active cell (cellcursor) in the row

				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)
										-this.#expandedRowHeights[this.#scrollRowIndex]+this.#rowHeight+"px";
				this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)+this.#rowHeight+"px";
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
				let cell=lastTr.insertCell();
				if (this.#colStructs[i].type==="expand")
					cell.classList.add("expandcol");
			}
			this.#updateRowValues(lastTr,this.#scrollRowIndex+this.#numRenderedRows-1);
			if (this.#expandedRowHeights[this.#scrollRowIndex+this.#numRenderedRows-1])
				this.#renderExpansion(lastTr,this.#scrollRowIndex+this.#numRenderedRows-1);
			this.#lookForActiveCellInRow(lastTr);//look for active cell (cellcursor) in the row
			if (!this.#rowHeight)//if there were no rows prior to this
				this.#rowHeight=lastTr.offsetHeight+this.#borderSpacingY;
		}
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	#maybeRemoveTrs() {
		const scrH=this.#scrollBody.offsetHeight;
		const trs=this.#mainTbody.rows;
		while (this.#numRenderedRows>3&&(this.#numRenderedRows-1)*this.#rowHeight>scrH) {
			if (this.#expandedRowHeights[this.#scrollRowIndex+this.#numRenderedRows-1]) {
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
	#updateRowValues(tr,dataIndex) {
		tr.dataset.dataRowIndex=dataIndex;
		const dataRow=this.#data[dataIndex];
		for (let colI=0; colI<this.#colStructs.length; colI++) {
			let td=tr.cells[colI];
			let colStruct=this.#colStructs[colI];
			if (colStruct.type==="expand")
				td.innerHTML="<a><span></span></a>";
			else 
				this.#updateCell(td,dataIndex,colStruct);
		}
		return tr;
	}

	#updateCell(cellEl,dataIndex,cellStruct,expCellObj) {
		let numVisibleGrouprowsChange=false;
		if (cellEl.closest("table").classList.contains("expansion-group"))
			cellEl=cellEl.querySelector("div.value");
		let valEl=cellEl;
		if (cellStruct.maxHeight) {
			cellEl.innerHTML="";
			valEl=cellEl.appendChild(document.createElement("div"));
			valEl.style.maxHeight=cellStruct.maxHeight;
			valEl.style.overflow="auto";
		}
		let newCellContent;
		if (cellStruct.render)
			newCellContent=cellStruct.render(this.#data[dataIndex],cellStruct,dataIndex);
		else
			newCellContent=this.#data[dataIndex][cellStruct.id]??"";
		if (expCellObj&&!newCellContent!=!valEl.innerText) {
			for (let ancestorCell=expCellObj; ancestorCell; ancestorCell=ancestorCell.parent)
				if (ancestorCell.nonEmptyDescentants!=null) {
					if (ancestorCell.nonEmptyDescentants^!!newCellContent)
						numVisibleGrouprowsChange=true;
					ancestorCell.el.classList.toggle("empty",!(ancestorCell.nonEmptyDescentants+=newCellContent?1:-1));

				}
		}
		valEl.innerText=newCellContent;
		if (this.#spreadsheet&&(!cellStruct.edit&&cellStruct.type!=="expand"))
			cellEl.classList.add("disabled");
		return numVisibleGrouprowsChange;
	}
}