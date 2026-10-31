const result=document.getElementById("test-results");
const assert=(condition,message)=>{if (!condition) throw new Error(message);};
const key=(target,options={})=>{
	const event=new KeyboardEvent("keydown",{key:"c",code:"KeyC",bubbles:true,cancelable:true,...options});
	target.dispatchEvent(event);
	return event;
};
const copy=target=>{
	const event=new Event("copy",{bubbles:true,cancelable:true});
	target.dispatchEvent(event);
	return event;
};
try {
	let copied=null;
	Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:text=>{
		copied=text;return Promise.resolve();
	}}});
	const host=document.body.appendChild(document.createElement("div"));
	host.className="host";
	const row={first:"First value",second:"Second value"};
	const table=new Tablance(host,{
		main:{columns:[{dataKey:"first",nodeId:"first"},{dataKey:"second",nodeId:"second"}]},
		details:{type:"list",entries:[{dataKey:"first",nodeId:"detail",title:"Visible label"}]},
	},true,true,{searchbar:false});
	table.setData([row]);
	await new Promise(resolve=>setTimeout(resolve,20));
	table.expandRow(0);
	table.selectCell(row,"second");
	const detail=table.getDetailCell(row,"detail");
	const label=(detail.selEl??detail.el).closest("tr").querySelector(".title");
	const selection=getSelection();
	const range=document.createRange();
	range.selectNodeContents(label);
	selection.removeAllRanges();
	selection.addRange(range);
	assert(selection.toString().trim()==="Visible label"&&table._activeSchemaNode.nodeId==="second",
		"label text selected while another cell is active");
	for (const modifier of [{ctrlKey:true},{metaKey:true}]) {
		copied=null;
		assert(!key(table.rootEl,modifier).defaultPrevented&&!copy(table.rootEl).defaultPrevented
			&&copied===null&&table._activeSchemaNode.nodeId==="second",
			"native text copy has priority for Ctrl+C, Cmd+C, and copy commands");
	}
	const selectLabel=()=>{selection.removeAllRanges();selection.addRange(range);};
	const navigate=(direction,options={})=>table.rootEl.dispatchEvent(new KeyboardEvent("keydown",{
		key:direction,code:direction,bubbles:true,cancelable:true,...options,
	}));
	navigate("ArrowLeft");
	assert(table._activeSchemaNode.nodeId==="first"&&selection.isCollapsed,
		"keyboard navigation clears selected label text when the active cell changes");
	copied=null;
	key(table.rootEl,{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="First value","Ctrl+C copies the new active cell after keyboard navigation");
	selectLabel();
	const secondCell=table._mainTbody.querySelector('[data-data-row-index="0"]:not(.details)').cells[1];
	secondCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true,button:0}));
	assert(table._activeSchemaNode.nodeId==="second"&&selection.isCollapsed,
		"pointer selection clears selected label text when the active cell changes");
	copied=null;
	key(table.rootEl,{metaKey:true});
	await Promise.resolve();
	assert(copied==="Second value","Cmd+C copies the new active cell after pointer selection");
	selectLabel();
	copied=null;
	assert(!key(table.rootEl,{ctrlKey:true}).defaultPrevented&&copied===null,
		"freshly selected text regains copy priority after a cell change");
	navigate("ArrowRight");
	assert(table._activeSchemaNode.nodeId==="second"&&selection.toString().trim()==="Visible label",
		"navigation without a cell change keeps ordinary text selection");
	table._adjustCursorPosSize(table._selectedCell);
	assert(selection.toString().trim()==="Visible label",
		"presentation updates do not clear ordinary text selection");
	selection.removeAllRanges();
	for (const modifier of [{ctrlKey:true},{metaKey:true}]) {
		copied=null;
		assert(key(table.rootEl,modifier).defaultPrevented,"cell shortcut is handled");
		await Promise.resolve();
		assert(copied==="Second value","cell shortcut copies the active value");
	}
	const outside=document.body.appendChild(document.createElement("span"));
	outside.textContent="Old selection";
	const outsideRange=document.createRange();
	outsideRange.selectNodeContents(outside);
	selection.addRange(outsideRange);
	navigate("ArrowLeft");
	assert(table._activeSchemaNode.nodeId==="first"&&selection.toString()==="Old selection",
		"cell navigation does not clear text selected outside this Tablance instance");
	copied=null;
	assert(copy(table.rootEl).defaultPrevented,"browser copy command handles active cell");
	await Promise.resolve();
	assert(copied==="First value","outside selection does not override cell copy");
	selection.removeAllRanges();
	outside.remove();
	const nested=table.rootEl.appendChild(document.createElement("div"));
	nested.className="tablance";
	nested.textContent="Nested selection";
	const nestedRange=document.createRange();
	nestedRange.selectNodeContents(nested);
	selection.addRange(nestedRange);
	navigate("ArrowRight");
	assert(table._activeSchemaNode.nodeId==="second"&&selection.toString()==="Nested selection",
		"navigation in one Tablance instance preserves a nested instance's text selection");
	selection.removeAllRanges();
	nested.remove();
	navigate("ArrowLeft");
	selectLabel();
	navigate("ArrowRight",{shiftKey:true});
	assert(table._activeSchemaNode.nodeId==="second"&&selection.isCollapsed&&table._cellRange,
		"extending a multi-cell range clears ordinary text selection");
	copied=null;
	key(table.rootEl,{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="First value\tSecond value","multi-cell shortcut copy is unchanged");
	copied=null;
	assert(copy(table.rootEl).defaultPrevented,"browser command handles a cell range");
	await Promise.resolve();
	assert(copied==="First value\tSecond value","browser command copies the cell range");
	table._clearCellRange();
	const input=table.rootEl.appendChild(document.createElement("input"));
	const textarea=table.rootEl.appendChild(document.createElement("textarea"));
	const editable=table.rootEl.appendChild(document.createElement("div"));
	editable.contentEditable="true";
	editable.textContent="Editable text";
	for (const control of [input,textarea,editable]) {
		copied=null;
		assert(!key(control,{ctrlKey:true}).defaultPrevented&&!copy(control).defaultPrevented
			&&copied===null,"native editable copy is preserved");
	}
	const editableRange=document.createRange();
	editableRange.selectNodeContents(editable);
	selection.addRange(editableRange);
	navigate("ArrowRight");
	assert(table._activeSchemaNode.nodeId==="second"&&selection.toString()==="Editable text",
		"cell navigation leaves contenteditable text selection intact");
	selection.removeAllRanges();
	for (const control of [input,textarea]) {
		control.value="Selected input text";
		control.setSelectionRange(2,10);
		navigate("ArrowLeft");
		assert(table._activeSchemaNode.nodeId==="first"
			&&control.selectionStart===2&&control.selectionEnd===10,
			"cell navigation leaves input and textarea selections intact");
		navigate("ArrowRight");
	}
	input.remove();textarea.remove();editable.remove();
	table.selectCell(row,"first");
	const before=table._activeSchemaNode.nodeId;
	table.rootEl.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",code:"ArrowRight",bubbles:true}));
	assert(before==="first"&&table._activeSchemaNode.nodeId==="second",
		"keyboard navigation remains active");
	result.textContent="copy selection tests passed";
	result.dataset.status="passed";
} catch(error) {
	result.textContent=error.stack??String(error);
	result.dataset.status="failed";
}
