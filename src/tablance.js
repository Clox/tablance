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
	#cellCursorRowIndex;//the index of the row that the cellcursor is at
	#cellCursorColIndex;//the index of the column that the cellcursor is at
	#cellCursorColStruct;//reference to element in #colStructs that the column of the currently selected cell belongs to
	#cellCursorRowData;//reference to the actual data-row-array from #data that the cell-cursor is at
	#cellCursorColId;//the id of the column that the cellcursor is at
	#selectedCellVal;//the value of the cell that the cellCursor is at
	#selectedTd;//the td-element of the cell-cursor
	#inEditMode;//whether the user is currently in edit-mode
	#cellCursorBorderWidths={};//This object holds the border-widths of the cell-cursor. keys are left,right,top,bottom
	//and values are px as ints. This is used to offset the position and adjust position of #cellCursor in order to
	//center it around the cell. It is also used in conjunction with cellCursorOutlineWidth to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#cellCursorOutlineWidth;//px-width as int, used in conjunction with #cellCursorBorderWidths to adjust margins of the
	#input;//input-element of cell-cursor. Can be different kind of inputs depending on data
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#focusByMouse;//when the spreadsheet is focused we want to know if it was by keyboard or mouse because we want
				//focus-outline to appear only if it was by keyboard. By setting this to true in mouseDownEvent we can 
				//check which input was used last when the focus-method is triggerd
	#expansion;//the expansion-argument passed to the constructor
	#scrollMethod;//this will be set to a reference of the scroll-method that will be used. This depends on settings for
				//staticRowHeight and expansion
	#expandedRowIndicesHeights={};//for tables where rows can be expanded, this object will keep track of which rows
	//have been expanded and also their combined height. key is row-index
	#scrollY=0;//this keeps track of the "old" scrollTop of the table when a scroll occurs to know 
	#numRenderedRows=0;//number of tr-elements in the table excluding tr's that are expansions (expansions too are tr's)
	#cellCursorInExpansion=false;//if cellCursor is currently inside an expansion

	/**
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			}
	 * 			editable false|String Defaults to false. Can be set to "text" to make it editable
	 * 	@param	{Boolean} staticRowHeight Set to true if all rows are of same height. With this option on, scrolling
	 * 				quickly through large tables will be more performant.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.
	 * 	@param	{Object} expansion This allows for having rows that can be expanded to show more data. An object with
	 * 							the following structure is expected:{
	 * 								rows: [
	 * 									{
	 * 										title:String the title of the row, displayed to the left of the value
	 * 										id:String The key of the corresponding property in the row-data
	 * 										editable:String can be set to "text" to make editable. Can also be set to
	 * 											"textarea" to allow for linebreaks
	 * 										
	 * 									}
	 * 									,...
	 * 								]
	 * 							}
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
		const allowedColProps=["id","title","width","edit"];
		for (let col of columns) {
			let processedCol={};
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
			opts.sortAscHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#000" points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortDescHtml==null)
			opts.sortDescHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" points="4,0,8,4,0,4"/><polygon style="fill:#000" points="4,10,0,6,8,6"/></svg>';
		if (opts.sortNoneHtml==null)
			opts.sortNoneHtml='<svg viewBox="0 0 8 10" style="height:1em"><polygon style="fill:#ccc" points="4,0,8,4,0,4"/><polygon style="fill:#ccc" points="4,10,0,6,8,6"/></svg>';;

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
		this.#cellCursor.addEventListener("dblclick",e=>this.#tryEnterEditMode(e));
	}

	#spreadsheetOnFocus(e) {
		if (this.#cellCursorRowIndex==null) {
			this.#selectTd(this.#mainTbody.rows[0].cells[0]);
		}
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		this.#focusByMouse?this.#container.style.outline="none":this.#container.style.removeProperty("outline");
		this.#focusByMouse=null;
	}

	#moveCellCursor(numCols,numRows) {
		const newColIndex=Math.min(this.#cols.length-1,Math.max(0,this.#cellCursorColIndex+numCols));
		let newTd;
		this.#scrollToCursor();
		if (numRows) {

			//need to call this manually before getting the td-element or else it might not even exist yet. 
			//#onScrollStaticRowHeight() will actually get called once more through the scroll-event since we called
			//#scrollToRow() above, but it doesn't get fired immediately. Running it twice is not a big deal.
			this.#scrollMethod();

			newTd=this.#selectedTd.parentElement[(numRows>0?"next":"previous")+"Sibling"]?.cells[newColIndex];
		} else {
			newTd=this.#selectedTd[(numCols>0?"next":"previous")+"Sibling"];
		}
			
		if (!newTd)
			return;
		this.#selectTd(newTd);
	}

	#spreadsheetKeyDown(e) {
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
				this.#exitEditMode(false);
			break; case "Enter":
				if (!this.#inEditMode) {
					this.#scrollToCursor();
					this.#tryEnterEditMode();
				} else {
					this.#exitEditMode(true);
					this.#moveCellCursor(0,e.shiftKey?-1:1);
				}
			break; case "+":
				this.#expandRow(this.#selectedTd.parentElement,this.#cellCursorRowIndex);
			break; case "-":
				this.#contractRow(this.#selectedTd.parentElement,this.#cellCursorRowIndex);
		}
		this.#container.style.outline="none";//see #spreadsheetOnFocus
	}

	#expandRow(tr,dataRowIndex) {
		if (!this.#expansion||this.#expandedRowIndicesHeights[dataRowIndex])
			return;
		const expansionRow=this.#renderExpansion(tr,dataRowIndex);
		this.#expandedRowIndicesHeights[dataRowIndex]=this.#rowHeight+expansionRow.offsetHeight+this.#borderSpacingY;
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)
			+this.#expandedRowIndicesHeights[dataRowIndex]-this.#rowHeight+"px";
	}

	#contractRow(tr,rowIndex) {
		if (!this.#expansion||!this.#expandedRowIndicesHeights[rowIndex])
			return;
		if (tr.classList.contains("expansion")) {
			tr=tr.previousSibling;
			this.#selectTd(tr.firstChild);
		}
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)
			-this.#expandedRowIndicesHeights[rowIndex]+this.#rowHeight+"px";
		tr.nextElementSibling.remove();
		delete this.#expandedRowIndicesHeights[rowIndex];
	}

	#renderExpansion(tr,dataRowIndex) {
		const expansionRow=tr.parentElement.insertRow(tr.rowIndex+1);
		expansionRow.className="expansion";
		expansionRow.dataset.dataRowIndex=dataRowIndex;
		const expansionCell=expansionRow.insertCell();
		expansionCell.colSpan=this.#cols.length;
		expansionCell.innerHTML="foo";
		expansionRow.style.height="100px";
		return expansionRow;
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
		this.#focusByMouse=true;//see decleration
	}
	
	#mainTableMouseDown(e) {
		const td=e.target;
		this.#selectTd(td);
	}

	#tryEnterEditMode(e) {
		this.#selectedCellVal=this.#cellCursorRowData[this.#cellCursorColId];
		if (this.#cellCursorColStruct.edit) {
			this.#inEditMode=true;
			this.#cellCursor.classList.add("edit-mode");
			this.#input=document.createElement("input");
			this.#cellCursor.appendChild(this.#input);
			this.#input.focus();
			this.#input.value=this.#selectedCellVal;
		}
	}

	#exitEditMode(save) {
		let newVal;
		if (!this.#inEditMode)
			return;
		this.#inEditMode=false;
		this.#cellCursor.classList.remove("edit-mode");
		if (save) {
			if (this.#cellCursorColStruct.edit==="text") {
				newVal=this.#input.value;
			}
			if (newVal!=this.#selectedCellVal) {
				this.#cellCursorRowData[this.#cellCursorColId]=newVal;
				this.#updateCellValue(this.#selectedTd,this.#cellCursorRowData);
			}
		}
		this.#cellCursor.innerHTML="";
		this.#container.focus();//make the table focused again so that it accepts keystrokes
	}

	#selectTd(td) {
		this.#exitEditMode(true);
		this.#selectedTd=td;
		this.#cellCursor.style.top=td.offsetTop+this.#tableSizer.offsetTop-this.#cellCursorBorderWidths.top+"px";
		this.#cellCursor.style.left=td.offsetLeft-this.#cellCursorBorderWidths.left+"px";
		this.#cellCursor.style.height
							=td.offsetHeight-this.#cellCursorBorderWidths.top+this.#cellCursorBorderWidths.bottom+"px";
		this.#cellCursor.style.width=td.offsetWidth-this.#cellCursorBorderWidths.left+"px";

		this.#cellCursorRowIndex=parseInt(td.parentElement.dataset.dataRowIndex);
		this.#cellCursorColIndex=td.cellIndex;
		this.#cellCursorColStruct=this.#colStructs[this.#cellCursorColIndex];
		this.#cellCursorRowData=this.#data[this.#cellCursorRowIndex];
		this.#cellCursorColId=this.#colStructs[this.#cellCursorColIndex].id;
	}

	#createTableHeader() {
		this.#headerTable=this.#container.appendChild(document.createElement("table"));
		const thead=this.#headerTable.appendChild(document.createElement("thead"));
		this.#headerTr=thead.insertRow();
		for (let col of this.#colStructs) {
			let th=document.createElement("th");
			th.addEventListener("mousedown",e=>this.#onThClick(e));
			this.#headerTr.appendChild(th).innerText=col.title;

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
	}

	#filterData(filterString) {
		this.#filter=filterString;
		if (!filterString||filterString=="")
			this.#data=this.#allData;
		else {
			this.#data=[];
			for (let dataRow of this.#allData) {
				for (let col of this.#colStructs) {
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
			>(this.#expandedRowIndicesHeights[this.#scrollRowIndex]??this.#rowHeight)) {//if a whole top row is outside
				if (this.#scrollRowIndex+this.#numRenderedRows>this.#data.length-1)
					break;
				

				//check if the top row (the one that is to be moved to the bottom) is expanded
				if (this.#expandedRowIndicesHeights[this.#scrollRowIndex]) {
					var scrollJumpDistance=this.#expandedRowIndicesHeights[this.#scrollRowIndex];
					this.#mainTbody.rows[1].remove();
					
				} else {
					scrollJumpDistance=this.#rowHeight;
				}
				

				const dataIndex=this.#numRenderedRows+this.#scrollRowIndex;//the data-index of the new row

				this.#scrollRowIndex++;

				//move the top row to bottom and update its values
				const trToMove=this.#updateRowValues(this.#mainTbody.appendChild(this.#mainTbody.firstChild),dataIndex);

				


				//move the table down by the height of the removed row to compensate,else the whole table would shift up
				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)+scrollJumpDistance+"px";

				//also shrink the container of the table the same amount to maintain the scrolling-range.
				this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)-scrollJumpDistance+"px";

				if (this.#expandedRowIndicesHeights[dataIndex])
					this.#renderExpansion(trToMove,dataIndex);
			}
		} else {//if scrolling up
			while (newScrY<parseInt(this.#tableSizer.style.top)) {//while top row is below top of viewport
				this.#scrollRowIndex--;

				//check if the bottom row (the one that is to be moved to the top) is expanded
				if (this.#expandedRowIndicesHeights[this.#scrollRowIndex+this.#numRenderedRows]) {
					this.#mainTbody.lastChild.remove();//remove the expansion-tr
				}

				let trToMove=this.#mainTbody.lastChild;									//move bottom row to top
				this.#mainTbody.prepend(trToMove);
				this.#updateRowValues(trToMove,this.#scrollRowIndex);//the data of the new row;

				//move the table up by the height of the removed row to compensate,else the whole table would shift down
				this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)-this.#rowHeight+"px";

				//also grow the container of the table the same amount to maintain the scrolling-range.
				//this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)+this.#rowHeight+"px";

				if (this.#expandedRowIndicesHeights[this.#scrollRowIndex])
					this.#renderExpansion(trToMove,this.#scrollRowIndex);
					this.#tableSizer.style.top=parseInt(this.#tableSizer.style.top)-this.#expandedRowIndicesHeights[this.#scrollRowIndex]+this.#rowHeight+"px";
					this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)+this.#rowHeight+"px";
			}
		}
		this.#scrollY=newScrY;
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
		const trs=this.#mainTable.rows;
		//if there are fewer trs than datarows, and if there is empty space below bottom tr
		
		while (this.#numRenderedRows*this.#rowHeight<scrH&&this.#scrollRowIndex+this.#numRenderedRows<dataLen) {
		//while (this.#scrollRowIndex+trs.length<dataLen&&(!lastTr||lastTr.offsetTop+this.#rowHeight/2<=scrH)) {
			lastTr=this.#mainTable.insertRow();
			this.#numRenderedRows++;
			for (let i=0; i<this.#colStructs.length; i++)
				lastTr.insertCell();
			this.#updateRowValues(lastTr,this.#scrollRowIndex+this.#numRenderedRows-1);
			if (!this.#rowHeight)//if there were no rows prior to this
				this.#rowHeight=lastTr.offsetHeight+this.#borderSpacingY;
		}
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	#maybeRemoveTrs() {
		const scrH=this.#scrollBody.offsetHeight;
		const trs=this.#mainTbody.rows;
		while (trs.length>3&&trs[trs.length-2].offsetTop>scrH) {
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
			if (this.#spreadsheet&&colStruct.edit!=="text")
				td.classList.add("disabled");
			this.#updateCellValue(td,dataRow);
		}
		return tr;
	}

	#updateCellValue(td,dataRow) {
		let col=this.#colStructs[td.cellIndex];
		td.innerHtml="";
		td.innerText=dataRow[col.id];
	}
}