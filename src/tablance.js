class Tablance {
	#container;//container-element for table
	#containerHeight=0;//height of #container. Used to keep track of if height shrinks or grows
	#containerWidth=0;//height of #container. Used to keep track of if width shrinks or grows
	#colStructs=[];//column-objects. See constructor for structure
	#cols=[];//array of col-elements for each column
	#headerTr;//the tr for the top header-row
	#headerTable;//the tabe for the #headerTr. This table only contains that one row.
	#data=[];//all the data that has been added and is viewable. This is different from what has been added to the DOM
	#scrollRowIndex=0;//the index in the #data of the top row in the view
	#scrollBody;//resides directly inside #container and is the element with the scrollbar. It contains #scrollingDiv
	#scrollingContent;//a div that is inside #scrollbody and holds #tablesizer and #cellCursor if spreadsheet
					//this is needed because putting #cellCursor directly inside #scrollBody will not make it scroll
					//because it has position absolute and needs that. And putting it inside #tableSizer will cause it
					//to jump up and down when pos and height of #tableSizer is adjusted to keep correct scroll-height
	#tableSizer;//a div inside #scrollingDiv which wraps #mainTable. The purpose of it is to set its height to the 
				//"true" height of the table so that the scrollbar reflects all the data that can be scrolled through
	#mainTable;
	
	#mainTbody;
	#borderSpacingY;//the border-spacing of #mainTable. This needs to be summed with offsetHeight of tr (#rowHeight) to 
					//get real distance between the top of adjacent rows
	#rowHeight;//the height of (non expanded) rows with #borderSpacingY included
	#staticRowHeight;//This is set in the constructor. If it is true then all rows should be of same height which
					 //improves performance.
	#sortingCols=[{index:0,order:"asc"}];//contains data on how the table currently is sorted. It is an array of 
										//objects which each contain "index" which is the index of the column and
										//"order" which value should be either "desc" or "asc". The array may contain
										//multiple of these objects for having it sorted on multiple ones.
	
	#cellCursor;//The element that for spreadsheets shows which cell is selected
	#cellCursorBorderWidths={};//This object holds the border-widths of the cell-cursor. keys are left,right,top,bottom
	//and values are px as ints. This is used to offset the position and adjust position of #cellCursor in order to
	//center it around the cell. It is also used in conjunction with cellCursorOutlineWidth to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#cellCursorOutlineWidth;//px-width as int, used in conjunction with #cellCursorBorderWidths to adjust margins of the
	//main-table in order to reveal the outermost line when an outermost cell is selected
	#focusByMouse;//when the spreadsheet is focused we want to know if it was by keyboard or mouse because we want
				//focus-outline to appear only if it was by keyboard. By setting this to true in mouseDownEvent we can 
				//check which input was used last when the focus-method is triggerd

	

	/**
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 			}
	 * 	@param	{Boolean} staticRowHeight Set to true if all rows are of same height. With this option on, scrolling
	 * 				quickly through large tables will be more performant.
	 * 	@param	{Boolean} spreadsheet If true then the table will work like a spreadsheet. Cells can be selected and the
	 * 				keyboard can be used for navigating the cell-selection.*/
	constructor(container,columns,staticRowHeight=false,spreadsheet=false) {
		this.#container=container;
		container.classList.add("tablance");
		this.#staticRowHeight=staticRowHeight;
		const allowedColProps=["id","title","width"];
		for (let col of columns) {
			let processedCol={};
			for (let [colKey,colVal] of Object.entries(col)) {
				if (allowedColProps.includes(colKey))
					processedCol[colKey]=colVal;
			}
			this.#colStructs.push(processedCol);
		}
		this.#createTableHeader();
		this.#createTableBody();
		(new ResizeObserver(e=>this.#updateSizesOfViewportAndCols())).observe(container);
		this.#updateSizesOfViewportAndCols();
		if (spreadsheet)
			this.#setupSpreadsheet();
	}

	#setupSpreadsheet() {
		this.#cellCursor=this.#scrollingContent.appendChild(document.createElement("div"));
		this.#cellCursor.className="cell-cursor";
		this.#scrollBody.addEventListener("click",e=>this.#spreadsheetClick(e));
		
		//remove any bord-spacing beause if the spacing is clicked the target-element will be the table itself and
		//no cell will be selected which is bad user experience
		this.#mainTable.style.borderSpacing=this.#borderSpacingY=0;
		
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
		
	}

	#spreadsheetOnFocus(e) {
		//when the table is tabbed to, whatever focus-outline that the css has set for it should show, but then when the
		//user starts to navigate using the keyboard we want to hide it because it is a bit distracting when both it and
		//a cell is highlighted. Thats why #spreadsheetKeyDown sets outline to none, and this line undos that
		//also, we dont want it to show when focusing by mouse so we use #focusMethod (see its declaration)
		this.#focusByMouse?this.#container.style.outline="none":this.#container.style.removeProperty("outline");
		this.#focusByMouse=null;
	}

	#spreadsheetKeyDown(e) {
		this.#container.style.outline="none";//see #spreadsheetOnFocus
	}

	#spreadsheetMouseDown(e) {
		this.#focusByMouse=true;//see decleration
	}
	#spreadsheetClick(e) {
		const td=e.target;
		this.#selectTd(td);
	}

	#selectTd(td) {
		this.#cellCursor.style.top=td.offsetTop+this.#tableSizer.offsetTop-this.#cellCursorBorderWidths.top+"px";
		this.#cellCursor.style.left=td.offsetLeft-this.#cellCursorBorderWidths.left+"px";
		this.#cellCursor.style.height
							=td.offsetHeight-this.#cellCursorBorderWidths.top+this.#cellCursorBorderWidths.bottom+"px";
		this.#cellCursor.style.width=td.offsetWidth-this.#cellCursorBorderWidths.left+"px";
	}

	#createTableHeader() {
		this.#headerTable=this.#container.appendChild(document.createElement("table"));
		const thead=this.#headerTable.appendChild(document.createElement("thead"));
		this.#headerTr=thead.insertRow();
		for (let col of this.#colStructs) {
			let th=document.createElement("th");
			th.addEventListener("mousedown",e=>this.#onThClick(e));
			this.#headerTr.appendChild(th).innerText=col.title;
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
			for (let sortingCol of this.#sortingCols) {
				if (sortingCol.index==thIndex) {
					order=sortingCol.order;
					break;
				}
			}
			if (!order||th.classList.contains(order=="asc"?"desc":"asc"))
				th.classList.remove("asc","desc");
			if (order)
				th.classList.add(order);		
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
		this.#scrollBody.addEventListener("scroll",e=>this.#onScrollStaticRowHeight(),{passive:true});
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
			this.#scrollBody.style.height=this.#container.offsetHeight-this.#headerTable.offsetHeight+"px";
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

	addData(data) {
		const priorlyEmpty=!data.length;
		this.#data=this.#data.concat(data);
		this.#sortData();
		//this.#data.push(...data);//much faster than above but causes "Maximum call stack size exceeded" for large data

		this.#maybeAddTrs();
		// this.#tableSizer.style.height=parseInt(this.#tableSizer.style.height||0)+
		// 				data.length*this.#rowHeight-(priorlyEmpty?this.#borderSpacingY:0)+"px";
		this.#refreshTableSizer();
	}

	#refreshRows() {
		this.#mainTbody.replaceChildren();
		this.#maybeAddTrs();
	}

	#onScrollStaticRowHeight() {
		const scrY=this.#scrollBody.scrollTop;
		//let rowScrollingDone=false;//whether the user has scrolled enough for rows to move and table to adjust
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
				if (scrollSignum==1)//moving down
					this.#updateRowValues(this.#mainTbody.appendChild(this.#mainTbody.firstChild));
				else {//moving up
					let trToMove=this.#mainTbody.lastChild;
					this.#mainTbody.prepend(trToMove);
					this.#updateRowValues(trToMove);
				}
			} while (this.#scrollRowIndex!=newScrollRowIndex);
		}
		this.#refreshTableSizer();
	}

	#refreshTableSizer() {
		this.#tableSizer.style.top=this.#scrollRowIndex*this.#rowHeight+"px";
		this.#tableSizer.style.height=(this.#data.length-this.#scrollRowIndex)*this.#rowHeight+"px";
	}

	/**Should be called if tr-elements might need to be created which is when data is added or if table grows*/
	#maybeAddTrs() {
		let lastTr=this.#mainTbody.lastChild;
		const scrH=this.#scrollBody.offsetHeight;
		const dataLen=this.#data.length;
		const trs=this.#mainTable.rows;
		//if there are fewer trs than datarows, and if there is space left below bottom tr
		while (this.#scrollRowIndex+trs.length<dataLen&&(!lastTr||lastTr.offsetTop+this.#rowHeight/2<=scrH)) {
			lastTr=this.#mainTable.insertRow();
			for (let i=0; i<this.#colStructs.length; i++)
				lastTr.insertCell();
			this.#updateRowValues(lastTr);
			if (!this.#rowHeight)//if there were no rows prior to this
				this.#rowHeight=lastTr.offsetHeight+this.#borderSpacingY;
		}
	}

	/**Should be called if tr-elements might need to be removed which is when table shrinks*/
	#maybeRemoveTrs() {
		const scrH=this.#scrollBody.offsetHeight;
		const trs=this.#mainTbody.rows;
		while (trs.length>3&&trs[trs.length-2].offsetTop>scrH)
			this.#mainTbody.lastChild.remove();
	}

	/**Update the values of a row in the table. The tr needs to be passed in and the function will figure out the
	 * corresponding data-item from #data and read from that. The row needs to already have the right amount of td's.
	 * @param {HTMLTableRowElement} tr The tr-element whose cells that should be updated*/
	#updateRowValues(tr) {
		const dataRow=this.#data[tr.rowIndex+this.#scrollRowIndex];
		for (let colI=0; colI<this.#colStructs.length; colI++) {
			let td=tr.cells[colI];
			this.#updateCellValue(td,dataRow);
		}
	}

	#updateCellValue(td,dataRow) {
		let col=this.#colStructs[td.cellIndex];
		td.innerHtml="";
		td.innerText=dataRow[col.id];
	}
}