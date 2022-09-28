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
	#selectedCell;//the HTML-element of the cell-cursor. probably TD's most of the time.
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
	#expansionBordesHeight;//when animating expansions for expanding/contracting the height of them fully
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
	#openExpansionNavMap={};//for any row that is expanded and also in view this will hold navigational data which
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
	#activeExpansionCell;	//points to an object in #openExpansionNavMap and in extension the cell of an expension.
							//If this is set then it means the cursor is inside an expansion.
	#animateCellCursorUntil;//used by #animateCellcursorPos to set the end-time for animation for adjusting its position
							//while rows are being expanded/contracted
							

	/**
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column. unless "render" is set a prop of this name from the
	 * 						data-rows will be used as value for the cells
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			edit false|String Defaults to false. Can be set to "text" to make it editable
	 * 			type String Can be set to "expand" to make it a column with buttons for expanding/contracting
	 * 						The edit-prop will be ignored if this is set.
	 * 			maxLength int If edit is set to text then this may be set to limit the number of characters allowed
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
  	 * 			}
  	 * 			{
  	 * 				type:"repeated",//used when the number of rows is undefined and where more may be able to be added, 
	 * 								//perhaps by the user
  	 * 				title:"Foobar",//displayed title in placed in a list
  	 * 				id:"foobar",//this should be the key of an array in the data where each object corresponds to each
	 * 							//element in this repeated rows.
  	 * 				entry: any entry //may be item or list for instance. the data retrieved for these will be 1
	 * 								//level deeper so the path from the base would be idOfRepeatedRows->arrayIndex->*
  	 * 				}
  	 * 				{
  	 * 				type:"group",//used when a set of data should be grouped, like for instance having an address and
	 * 							//all the rows in it belongs together. the group also has to be entered
	 * 							//with enter/doubleclick
  	 * 				title:"Foobar",//displayed title if placed in list
  	 * 				entry: any entry //may be item or list for instance. 
  	 * 				}
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
		const allowedColProps=["id","title","width","edit","type","maxLength","render"];
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
		if (this.#cellCursorRowIndex==null)
			this.#selectMainTableCell(this.#mainTbody.rows[0].cells[0]);
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		if (this.#focusByMouse)
			this.#container.style.outline="none"
		else
			this.#container.style.removeProperty("outline")
		this.#focusByMouse=null;
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
			let newColIndex=this.#cellCursorColIndex;
			if (this.#activeExpansionCell) {//moving from inside expansion.might move to another cell inside,or outside
				//first go up the tree as many times as needed to find a adjacent cell in the right direction
				let adjacentCell;
				for (let cell=this.#activeExpansionCell; cell.parent&&!adjacentCell; cell=cell.parent)
					adjacentCell=cell.parent.children[cell.index+numRows];
				//now we're either at the top of the tree while nextCell is null which means there's no adjacent cell
				//in that direction, or we did find an adjacent cell which can be an item which means we've reached
				//our goal, or its a list and we need to start digging down until we find an item

				if (adjacentCell) {//found an adjacent cell
					while (adjacentCell.children)//but if it is a list (has children) then dig down until item is found
						adjacentCell=adjacentCell.children[numRows===1?0:adjacentCell.children.length-1];
					this.#selectExpansionCell(this.#cellCursorRowIndex,adjacentCell);//finally select it
				} else //no adjacent cell is found in the expansion
					this.#selectMainTableCell(this.#mainTbody.querySelector
						(`[data-data-row-index="${this.#cellCursorRowIndex+(numRows===1?1:0)}"]`)?.cells[newColIndex]);
			} else if (numRows===1&&this.#expandedRowHeights[this.#cellCursorRowIndex]){//moving down into expansion
				let cell=this.#openExpansionNavMap[this.#cellCursorRowIndex].children[0];
				for (;cell.children;cell=cell.children[0]);//if list then dig down to first item
				this.#selectExpansionCell(this.#cellCursorRowIndex,cell);
			} else if (numRows===-1&&this.#expandedRowHeights[this.#cellCursorRowIndex-1]){//moving up into expansion
				let cell=this.#openExpansionNavMap[this.#cellCursorRowIndex-1].children.slice(-1)[0];
				for (;cell.children;cell=cell.children[cell.children.length-1]);//if list then dig down to first item
				this.#selectExpansionCell(this.#cellCursorRowIndex-1,cell);
			} else {//moving from and to maintable-cells
				this.#selectMainTableCell(
					this.#selectedCell.parentElement[(numRows>0?"next":"previous")+"Sibling"]?.cells[newColIndex]);
			}
			//need to call this a second time. first time is to scroll to old td to make sure the new td is rendered
			this.#scrollToCursor();//this time it is to actually scroll to the new td
		} else if (!this.#activeExpansionCell){
			this.#selectMainTableCell(this.#selectedCell[(numCols>0?"next":"previous")+"Sibling"]);
		}
	}

	#spreadsheetKeyDown(e) {
		this.#container.style.outline="none";//see #spreadsheetOnFocus
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
			break;  case " ":
				if (!this.#inEditMode&&this.#selectedCell.classList.contains("expandcol"))
					return this.#toggleRowExpanded(this.#selectedCell.parentElement);
			break; case "Enter":
				if (!this.#inEditMode) {
					if (this.#selectedCell.classList.contains("expandcol"))
						return this.#toggleRowExpanded(this.#selectedCell.parentElement);
					this.#scrollToCursor();
					this.#tryEnterEditMode();
				} else {
					this.#exitEditMode(true);
					this.#moveCellCursor(0,e.shiftKey?-1:1);
				}
			break; case "+":
				this.#expandRow(this.#selectedCell.parentElement,this.#cellCursorRowIndex);
			break; case "-":
				this.#contractRow(this.#selectedCell.parentElement,this.#cellCursorRowIndex);
		}
	}

	#expandRow(tr,dataRowIndex) {
		if (!this.#expansion||this.#expandedRowHeights[dataRowIndex])
			return;
		const expansionRow=this.#renderExpansion(tr,dataRowIndex,false);
		this.#expandedRowHeights[dataRowIndex]=this.#rowHeight+expansionRow.offsetHeight+this.#borderSpacingY;
		const contentDiv=expansionRow.querySelector(".content");
		if (!this.#expansionBordesHeight)//see declarataion of #expansionTopBottomBorderWidth
			this.#expansionBordesHeight=this.#expandedRowHeights[dataRowIndex]-contentDiv.offsetHeight;
		this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)//adjust scroll-height reflect change...
			+this.#expandedRowHeights[dataRowIndex]-this.#rowHeight+"px";//...in height of the table

		//animate
		contentDiv.style.height="0px";
		setTimeout(()=>contentDiv.style.height=this.#expandedRowHeights[dataRowIndex]-this.#expansionBordesHeight+"px");
		this.#animateCellcursorPos();
	}

	#contractRow(tr,dataRowIndex) {
		if (!this.#expansion||!this.#expandedRowHeights[dataRowIndex])
			return;
		const contentDiv=tr.nextSibling.querySelector(".content");
		const contractFinished=()=> {
			tr.classList.remove("expanded");
			this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height)
				-this.#expandedRowHeights[dataRowIndex]+this.#rowHeight+"px";
			tr.nextElementSibling.remove();
			delete this.#expandedRowHeights[dataRowIndex];
			delete this.#openExpansionNavMap[dataRowIndex];
		};
		if (contentDiv.style.height!=="0px") {//this is the normal scenario. its open and height is more than 0.
			contentDiv.style.height="0px";	//so transition it to 0
			contentDiv.ontransitionend=contractFinished;//and add listener
		} else //however, if user manages to attempt to contract when height is exactly at 0 which actually isn't too
			contractFinished();//hard then the event would never fire so just call it directly instead
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
	 * @param {*} dataRowIndex 
	 * @param Bool setHeight Expanded rows, or rather the div inside them needs to have their height set in order to
	 * 				animate correctly when expanding/contracting. When this method is called on scroll the height of
	 * 				the div should be set by this method, but if #expandRow is called because the user expanded a row
	 * 				
	 * @returns */
	#renderExpansion(tr,dataRowIndex,setHeight=true) {
		tr.classList.add("expanded");
		const expansionRow=tr.parentElement.insertRow(tr.rowIndex+1);
		expansionRow.className="expansion";
		expansionRow.dataset.dataRowIndex=dataRowIndex;
		const expansionCell=expansionRow.insertCell();
		expansionCell.colSpan=this.#cols.length;
		const expansionDiv=expansionCell.appendChild(document.createElement("div"));//single div inside td for animate
		expansionDiv.style.height=this.#expandedRowHeights[dataRowIndex]-this.#expansionBordesHeight+"px"
		expansionDiv.className="content";
		const shadowLine=expansionDiv.appendChild(document.createElement("div"));
		shadowLine.className="expansion-shadow";
		const navMap=this.#openExpansionNavMap[dataRowIndex]={};
		this.#generateExpansionContent(this.#expansion,this.#data[dataRowIndex],navMap,expansionDiv,[]);
		return expansionRow;
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
	#generateExpansionContent(struct,data,cellObject,parentEl,path) {
	/* 	return {
			list:this.#generateExpansionList,
			field:this.#generateExpansionField
		}[expansionStructure.type](expansionStructure,data); */
		switch (struct.type) {
			case "list": return this.#generateExpansionList(struct,data,cellObject,parentEl,path);
			case "field": return this.#generateExpansionField(struct,data,cellObject,parentEl,path);
		}
	}

	#generateExpansionList(listStructure,data,cellObject,parentEl,path) {
		cellObject.children=[];
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
			let cellChild=this.#generateExpansionContent(struct,data,cellObject.children[entryI]={},contentTd,path);
			path.pop();
			cellChild.parent=cellObject;
			cellChild.index=entryI;
		}
		parentEl.appendChild(listTable);
		return cellObject;
	}

	#generateExpansionField(fieldStructure,data,cellObject,parentEl,path) {
		cellObject.el=parentEl;
		//navMap.children.push({parent:navMap,index:navMap.children.length,el:parentEl});
		parentEl.innerText=data[fieldStructure.id];
		parentEl.dataset.path=path.join("-");
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
			this.#focusByMouse=true;//see decleration
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
			let cellObject=this.#openExpansionNavMap[mainTr.dataset.dataRowIndex];
			console.log(cellObject);
			for (let step of interactiveEl.dataset.path.split("-"))
				cellObject=cellObject.children[step];
			console.log(cellObject);

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
			this.#selectExpansionCell(mainTr.dataset.dataRowIndex,cellObject);
		} else {//not in expansion
			const td=e.target.closest(".main-table>tbody>tr>td");
				if (td.classList.contains("expandcol")) {
					if (this.#cellCursorRowIndex==null)
						this.#selectMainTableCell(td);
					return this.#toggleRowExpanded(td.parentElement);
				}
			this.#selectMainTableCell(td);
		}
	}

	#toggleRowExpanded(tr) {
		if (tr.classList.contains("expanded"))
			this.#contractRow(tr,tr.dataset.dataRowIndex);
		else
			this.#expandRow(tr,tr.dataset.dataRowIndex);
	}

	#tryEnterEditMode(e) {
		this.#selectedCellVal=this.#cellCursorRowData[this.#cellCursorColId];
		if (this.#activeExpansionCell) {
			console.log(this.#activeExpansionCell);
		} if (this.#cellCursorColStruct.edit) {
			this.#inEditMode=true;
			this.#cellCursor.classList.add("edit-mode");
			this.#input=document.createElement("input");
			this.#cellCursor.appendChild(this.#input);
			this.#input.focus();
			this.#input.value=this.#selectedCellVal;
			if (this.#cellCursorColStruct.maxLength)
				this.#input.maxLength=this.#cellCursorColStruct.maxLength;
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
			if (newVal!=this.#selectedCellVal)
				this.#updateCellValue(this.#selectedCell,this.#cellCursorRowData[this.#cellCursorColId]=newVal);
		}
		this.#cellCursor.innerHTML="";
		this.#container.focus();//make the table focused again so that it accepts keystrokes
	}

	#selectMainTableCell(cell) {
		if (!cell)//in case trying to move up from top row etc
			return;
		this.#activeExpansionCell=null;//should be null when not inside expansion
		this.#exitEditMode(true);
		this.#selectedCell=cell;
		this.#adjustCursorPosSize(cell);
		
		this.#cellCursorRowIndex=parseInt(cell.parentElement.dataset.dataRowIndex);
		if (!cell.parentElement.classList.contains("expansion"))
			this.#cellCursorColIndex=cell.cellIndex;
		this.#cellCursorColStruct=this.#colStructs[this.#cellCursorColIndex];

		//make cellcursor click-through if it's on an expand-row-button-td
		this.#cellCursor.style.pointerEvents=this.#cellCursorColStruct.type==="expand"?"none":"auto";

		this.#cellCursorRowData=this.#data[this.#cellCursorRowIndex];
		this.#cellCursorColId=this.#colStructs[this.#cellCursorColIndex].id;
	}

	#selectExpansionCell(dataRowIndex,cellObject) {
		if (!cellObject)
			return;
		this.#cellCursorRowIndex=parseInt(dataRowIndex);
		this.#activeExpansionCell=cellObject;
		this.#exitEditMode(true);
		this.#adjustCursorPosSize(cellObject.el);
		this.#selectedCell=cellObject.el;
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
					delete this.#openExpansionNavMap[this.#scrollRowIndex];
					var scrollJumpDistance=this.#expandedRowHeights[this.#scrollRowIndex];
					this.#mainTbody.rows[1].remove();
					
				} else {
					scrollJumpDistance=this.#rowHeight;
				}

				if (this.#scrollRowIndex===this.#cellCursorRowIndex)//cell-cursor is on moved row
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
					delete this.#openExpansionNavMap[this.#scrollRowIndex+this.#numRenderedRows];
					this.#mainTbody.lastChild.remove();//remove the expansion-tr
				}

				if (this.#scrollRowIndex+this.#numRenderedRows===this.#cellCursorRowIndex)//cell-cursor is on moved row
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
		if (tr.dataset.dataRowIndex==this.#cellCursorRowIndex) {
			if (!this.#activeExpansionCell)
				this.#selectedCell=tr.cells[this.#cellCursorColIndex];
			else {//if inside expansion
				//generate the path to the cellObject in #activeExpansionCell by stepping through its parents to root
				let path=[];
				for (let cellObject=this.#activeExpansionCell; cellObject.parent; cellObject=cellObject.parent)
					path.unshift(cellObject.index);
				//now follow the same path in the new #openExpansionNavMap[rowIndex], eg the cellObjects..
				let cellObject=this.#openExpansionNavMap[this.#cellCursorRowIndex];
				for (let step of path)
					cellObject=cellObject.children[step];
				this.#selectedCell=cellObject.el;
				this.#activeExpansionCell=cellObject;//should be identical but this allows for the old one to be gc'd
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
				delete this.#openExpansionNavMap[this.#scrollRowIndex+this.#numRenderedRows];
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
			else if (colStruct.render!=null) {
				if (colStruct.render instanceof Function)
					this.#updateCellValue(td,colStruct.render(dataRow,colStruct,dataIndex,colI));
				else
					this.#updateCellValue(td,colStruct.render);
			} else
				this.#updateCellValue(td,dataRow[colStruct.id]);
			if (this.#spreadsheet&&(colStruct.edit!=="text"&&colStruct.type!=="expand"))
				td.classList.add("disabled");
		}
		return tr;
	}

	#updateCellValue(td,value) {
		td.innerText=value;
	}
}