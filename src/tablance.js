class Tablance {
	#container;
	#columns;
	#headerTr;
	

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
		this.#columns=[];
		const allowedColProps=["id","title","width"];
		for (let col of columns) {
			let processedCol={};
			for (let [colKey,colVal] of Object.entries(col)) {
				if (allowedColProps.includes(colKey))
					processedCol[colKey]=colVal;
			}
			this.#columns.push(processedCol);
		}
		this.#createHeaderTable();
		(new ResizeObserver(()=>{this.#updateColWidths()})).observe(container);
	}
	#createHeaderTable=function() {
		const table=document.createElement("table");
		this.#container.appendChild(table);
		const thead=document.createElement("thead");
		table.append(thead);

		this.#headerTr=thead.insertRow();
		for (let col of this.#columns) {
			let th=document.createElement("th");
			th.innerText=col.title;
			this.#headerTr.appendChild(th);
		}
		this.#updateColWidths(true);
	}

	#updateColWidths=function() {
		const percentageWidthRegex=/\d+\%/;
		let containerWidth=this.#container.clientWidth;
		let totalFixedWidth=0;
		let numUndefinedWidths=0;
		for (let col of this.#columns)
			if (!col.width)
				numUndefinedWidths++;
			else if (!percentageWidthRegex.test(col))//if fixed width
				totalFixedWidth+=(col.pxWidth=parseInt(col.width));
		let totalFixedAndFlexibleWidth=totalFixedWidth;
		for (let col of this.#columns)
			if (col.width&&percentageWidthRegex.test(col))//if flexible width
				totalFixedAndFlexibleWidth+=(col.pxWidth=(containerWidth-totalFixedWidth)*parseFloat(col.width)/100);
		for (let col of this.#columns)
			if (!col.width)//if undefined width
				col.pxWidth=(containerWidth-totalFixedAndFlexibleWidth)/numUndefinedWidths;
		
		console.log(this.#headerTr);
		for (let [colI,th] of Object.entries(this.#headerTr.children)) {
			th.style.width=this.#columns[colI].pxWidth;
			console.log(th);
			console.log(this.#columns[colI].pxWidth);
		}
	}
}