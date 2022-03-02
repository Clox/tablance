class Tablance {
	#container;//container-element for table
	#colStructs=[];//column-objects. See constructor for structure
	#cols=[];//array of col-elements for each column
	#headerTr;//the tr for the top header-row
	#data=[];//all the data that has been added and is viewable. This is different from what has been added to the DOM
	#topRenderedRowIndex=0;//the index in the #data of the top row in the view
	#scrollY=0;//keep track of the scrolling. To know if viewport has moved up or down and rows need (un)rendering
	#scrollBody;
	#mainTable;
	

	/**
	 * 
	 * @param {HTMLElement} container An element which the table is going to be added to
	 * @param {{}[]} columns An array of objects where each object has the following structure: {
	 * 			id String A unique identifier for the column
	 * 			title String The header-string of the column
	 * 			width String The width of the column. This can be in either px or % units.
	 * 				In case of % it will be calculated on the remaining space after all the fixed widths
	 * 				have been accounted for.
	 * 		}
	 */
	constructor(container,columns) {
		this.#container=container;
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
		(new ResizeObserver(()=>this.#updateColWidths())).observe(container);
		this.#updateColWidths();
	}

	#createTableHeader() {
		const table=this.#container.appendChild(document.createElement("table"));
		const thead=table.appendChild(document.createElement("thead"));
		this.#headerTr=thead.insertRow();
		for (let col of this.#colStructs) 
			this.#headerTr.appendChild(document.createElement("th")).innerText=col.title;
	}

	#createTableBody() {
		this.#scrollBody=this.#container.appendChild(document.createElement("div"));
		this.#mainTable=this.#scrollBody.appendChild(document.createElement("table"));
		for (let colStruct of this.#colStructs) {
			let col=document.createElement("col");
			this.#cols.push(col);
			this.#mainTable.appendChild(document.createElement("colgroup")).appendChild(col);
		}
	}

	#updateColWidths() {
		const percentageWidthRegex=/\d+\%/;
		let containerWidth=this.#container.clientWidth;
		let totalFixedWidth=0;
		let numUndefinedWidths=0;
		for (let col of this.#colStructs)
			if (!col.width)
				numUndefinedWidths++;
			else if (!percentageWidthRegex.test(col))//if fixed width
				totalFixedWidth+=(col.pxWidth=parseInt(col.width));
		let totalFixedAndFlexibleWidth=totalFixedWidth;
		for (let col of this.#colStructs)
			if (col.width&&percentageWidthRegex.test(col))//if flexible width
				totalFixedAndFlexibleWidth+=(col.pxWidth=(containerWidth-totalFixedWidth)*parseFloat(col.width)/100);
		for (let col of this.#colStructs)
			if (!col.width)//if undefined width
				col.pxWidth=(containerWidth-totalFixedAndFlexibleWidth)/numUndefinedWidths;
		
		for (let colI=0; colI<this.#colStructs.length; colI++) 
			this.#cols[colI].style.width=this.#headerTr.children[colI].style.width=this.#colStructs[colI].pxWidth+"px";
	}

	addData(data) {
		this.#data.push(...data);//much, much faster than concat
		this.#updateAdjustNumberOfTrs();
	}

	/**Should be called if tr-elements might need to be created or deleted which is when data is added or removed, 
	 * or when the table is resized vertically*/
	#updateAdjustNumberOfTrs() {
		if (!this.#mainTable.rows.length&&this.#data.length) {//if there is data but table has 0 rows
			let newTr=this.#mainTable.insertRow();
			for (let i=0; i<this.#colStructs.length; i++)
				newTr.insertCell();
			this.#updateRowValues(newTr);
		}
	}

	/**Update the values of a row in the table. The tr needs to be passed in and the function will figure out the
	 * corresponding data-item from #data and read from that. The row needs to already have the right amount of td's.
	 * @param {HTMLTableRowElement} tr The tr-element whose cells that should be updated*/
	#updateRowValues(tr) {
		const dataRow=this.#data[tr.rowIndex+this.#topRenderedRowIndex];
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