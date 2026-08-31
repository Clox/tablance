const Tablance=window.Tablance;

const result=document.getElementById("test-results");
const assertions=[];
const assert=(condition,message)=>{
	if (!condition)
		throw new Error(message);
	assertions.push(message);
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const key=(target,key,code=key,options={})=>{
	const event=new KeyboardEvent("keydown",{key,code,bubbles:true,cancelable:true,...options});
	target.dispatchEvent(event);
	return event;
};
const host=()=>{
	const element=document.body.appendChild(document.createElement("div"));
	element.className="host";
	return element;
};

try {
	assert(Tablance.version==="2.0.0","built UMD exposes the breaking 2.0.0 version");
	let changes=0,commits=0,validations=0,actions=0,buttonActions=0;
	const row={editable:"edit",computed:"source",explicit:"locked",conditional:"conditional",canEdit:true,
		disabledValue:"unavailable",isDisabled:true,action:"act",button:"button",detail:"detail rendered",
		history:[{date:"2026-01-01"},{date:"2026-02-01"}],
		file:{name:"report.pdf",lastModified:"2026-08-30T10:00:00Z",size:1024,type:"application/pdf"}};
	const schema={
		onDataCommit:()=>commits++,
		main:{columns:[
			{dataKey:"editable",title:"Editable",input:{type:"text",onChange:()=>changes++}},
			{dataKey:"computed",title:"Computed",render:()=>"Rendered age: 31"},
			{dataKey:"explicit",title:"Explicit",readOnly:true,input:{type:"text",validation:()=>{validations++;return true;},onChange:()=>changes++}},
			{dataKey:"conditional",title:"Conditional",editableIf:({rowData})=>rowData.canEdit,input:{type:"text"}},
			{dataKey:"disabledValue",title:"Disabled",disabledIf:({rowData})=>rowData.isDisabled,input:{type:"text"}},
			{dataKey:"action",title:"Action",onEnter:()=>actions++},
			{dataKey:"button",title:"Button",input:{type:"button",text:"Run",onClick:()=>buttonActions++}},
		]},
		details:{type:"list",entries:[
			{title:"Detail",dataKey:"detail",nodeId:"detail",render:({value})=>value.toUpperCase()},
			{title:"Explicit detail",dataKey:"explicit",readOnly:true,input:{type:"textarea"}},
			{type:"group",title:"History",nodeId:"historyGroup",entries:[
				{type:"repeated",dataKey:"history",entry:{type:"group",closedRender:({date})=>date,entries:[
					{title:"Date",dataKey:"date",input:{type:"text"}},
				]}},
			]},
			{title:"File",dataKey:"file",readOnly:true,input:{type:"file",onOpenFile:()=>actions++}},
		]},
	};
	const table=new Tablance(host(),schema,true,true,{searchbar:false});
	table.setData([row]);
	await tick();
	const cells=table._mainTbody.querySelector('tr[data-data-row-index="0"]:not(.details)').cells;
	assert(cells[0].dataset.cellState==="editable","ordinary input resolves editable");
	assert(cells[1].dataset.cellState==="readOnly","field without input resolves implicit readOnly");
	assert(cells[2].dataset.cellState==="readOnly","explicit readOnly wins with an editor defined");
	assert(cells[3].dataset.cellState==="editable","editableIf true resolves editable");
	assert(cells[4].dataset.cellState==="disabled"&&cells[4].getAttribute("aria-disabled")==="true","disabledIf true resolves disabled with ARIA");
	assert(cells[5].dataset.cellState==="action","onEnter field resolves action");
	assert(cells[6].dataset.cellState==="action","button resolves action");
	assert(getComputedStyle(cells[0]).paddingLeft==="12px"&&getComputedStyle(cells[1]).paddingLeft==="14px"
		&&getComputedStyle(cells[1]).paddingTop==="9px"&&getComputedStyle(cells[5]).paddingLeft==="14px"
		&&getComputedStyle(cells[5]).paddingTop==="9px"&&getComputedStyle(cells[6]).paddingLeft==="12px",
		"only text-like main-row state cells reserve permanent space for their indicator");
	assert([...cells].every(cell=>cell.classList.contains("tablance-cell-state")),
		"every rendered main cell receives the canonical state styling hook");
	assert(table._headerTable.querySelectorAll(".tablance-sort-icon").length===schema.main.columns.length,
		"Tablance renders its native outline sort icons by default");
	assert(table._focusEl===table._tableArea&&table._tableArea.tabIndex===0&&table.rootEl.tabIndex===-1
		&&table._tableArea.contains(table._headerTable)&&table._tableArea.contains(table._scrollBody),
		"the keyboard focus stop wraps the header and rows without wrapping the toolbar");
	const headerStyle=getComputedStyle(table._headerTable);
	assert(headerStyle.backgroundColor==="rgb(243, 246, 250)"&&headerStyle.borderTopColor==="rgb(217, 226, 239)"
		&&headerStyle.borderTopLeftRadius==="10px","the modern header theme is the Tablance default");
	assert(getComputedStyle(cells[0]).backgroundColor==="rgb(255, 255, 255)"
		&&getComputedStyle(cells[1]).backgroundColor==="rgb(255, 255, 255)",
		"ordinary and read-only cells share the default white cell surface");

	const fixedHeightTable=new Tablance(host(),{
		main:{columns:[{type:"expand",width:45},{dataKey:"value",input:{type:"text"}}]},
		details:{type:"list",entries:[{title:"Value",dataKey:"value",input:{type:"text"}}]},
	},true,true,{searchbar:false,ordering:false});
	fixedHeightTable.setData([{value:"one"},{value:"two"},{value:"three"}]);
	await tick();
	const fixedRows=[...fixedHeightTable._mainTbody.querySelectorAll(":scope>tr:not(.details)")];
	const fixedRowHeights=fixedRows.map(tableRow=>tableRow.getBoundingClientRect().height);
	assert(fixedRowHeights.every(height=>height===fixedHeightTable._rowHeight)
		&&fixedHeightTable._rowHeight===41,
		"fixed-height rows all match the natural measured row height");
	assert(fixedHeightTable._rowInnerHeights[0]!==fixedHeightTable._rowInnerHeights[1],
		"each column derives its inner height from its own padding and borders");

	const emptyGroupTable=new Tablance(host(),{details:{type:"list",entries:[
		{title:"Addresses",type:"group",nodeId:"addressesGroup",entries:[
			{type:"repeated",dataKey:"addresses",create:true,entry:{type:"group",entries:[]}},
		]},
	]}},true,true,{searchbar:false});
	emptyGroupTable.setData([{addresses:[]}]);
	await tick();
	const emptyGroup=emptyGroupTable.getDetailCell(0,"addressesGroup");
	const emptyGroupValueCell=emptyGroup.el.parentElement;
	emptyGroupValueCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(emptyGroup.selEl===emptyGroupValueCell&&emptyGroupTable._selectedCell===emptyGroupValueCell,
		"a list group uses its full value cell as the hit target even when its inner content is empty");

	let deleteDecision="prevent",beforeDeleteCalls=0,afterDeleteCalls=0,deleteCommits=0;
	const repeatedRows=[{name:"keep"},{name:"candidate"}];
	const guardedDeleteTable=new Tablance(host(),{
		onDataCommit:({mode})=>mode==="delete"&&deleteCommits++,
		details:{type:"list",entries:[{type:"repeated",dataKey:"items",nodeId:"items",create:true,
			beforeDelete:({deletedDataItem,remainingData,preventDelete})=>{
				beforeDeleteCalls++;
				assert(deletedDataItem===repeatedRows[1]&&remainingData.length===1&&remainingData[0]===repeatedRows[0],
					"beforeDelete receives the candidate and a non-mutating view of the remaining data");
				if (deleteDecision==="prevent")
					preventDelete("Deletion blocked");
				else if (deleteDecision==="returnFalse")
					return false;
			},
			onDelete:()=>afterDeleteCalls++,entry:{dataKey:"name",input:{type:"text"}},
		}]},
	},true,true,{searchbar:false});
	guardedDeleteTable.setData([{items:repeatedRows}]);
	await tick();
	const guardedRepeated=guardedDeleteTable.getDetailCell(0,"items");
	const guardedEntry=guardedRepeated.children.find(child=>child.dataObj===repeatedRows[1]);
	guardedEntry.select();
	const deleteControl={parent:{parent:guardedEntry}};
	assert(guardedDeleteTable._repeatedOnDelete({instanceNode:deleteControl})===false
		&&repeatedRows.length===2&&guardedRepeated.children.includes(guardedEntry)
		&&afterDeleteCalls===0&&deleteCommits===0,
		"beforeDelete can veto deletion before data, instances, DOM, callbacks, or persistence change");
	deleteDecision="returnFalse";
	assert(guardedDeleteTable._repeatedOnDelete({instanceNode:deleteControl})===false
		&&repeatedRows.length===2&&afterDeleteCalls===0&&deleteCommits===0,
		"returning false from beforeDelete also vetoes deletion");
	deleteDecision="allow";
	assert(guardedDeleteTable._repeatedOnDelete({instanceNode:deleteControl})===true
		&&beforeDeleteCalls===3&&repeatedRows.length===1&&!guardedRepeated.children.includes(guardedEntry)
		&&afterDeleteCalls===1&&deleteCommits===1,
		"an allowed deletion continues through mutation, onDelete, and persistence");

	const resolve=node=>table._resolveCellState(node,{rowData:row});
	assert(resolve({input:{type:"text"},editableIf:()=>false}).kind==="readOnly","editableIf false resolves readOnly");
	assert(resolve({input:{type:"text"},editableIf:()=>({editable:false,message:"locked"})}).message==="locked","editableIf object message is retained");
	assert(resolve({input:{type:"text"},disabledIf:()=>false}).kind==="editable","disabledIf false preserves editable");
	assert(resolve({input:{type:"text"},disabled:true,readOnly:true,editableIf:()=>true}).kind==="disabled","disabled has highest precedence");
	assert(resolve({input:{type:"text"},readOnly:true,editableIf:()=>true}).kind==="readOnly","readOnly precedes editableIf");
	assert(resolve({input:{type:"button"}}).kind==="action","button/control precedence resolves action");
	assert(["expand","select","group"].every(type=>!table._showsActionIndicator({kind:"action"},{type}))
		&&!table._showsActionIndicator({kind:"action"},{input:{type:"button"}}),
		"controls with an explicit affordance are excluded from the generic action indicator");

	const geometry=element=>{
		const rect=element.getBoundingClientRect();
		return [rect.left,rect.top,rect.width,rect.height];
	};
	const actionCellGeometry=geometry(cells[5]);
	const actionTextGeometry=geometry(cells[5].firstElementChild);
	assert(cells[5].classList.contains("action-indicator")&&getComputedStyle(cells[5],"::before").content==="none",
		"an unselected text-like action cell exposes its canonical indicator hook without showing it permanently");
	table.selectCell(row,"action");
	const actionIndicatorStyle=getComputedStyle(table._cellCursor,"::before");
	assert(cells[5].classList.contains("tablance-active-cell")
		&&table._cellCursor.classList.contains("action-indicator")&&actionIndicatorStyle.content==="\"\""
		&&(actionIndicatorStyle.maskImage!=="none"||actionIndicatorStyle.webkitMaskImage!=="none"),
		"a selected text-like action cell receives the native active hook and shows the action indicator");
	assert(actionIndicatorStyle.pointerEvents==="none","the action indicator cannot intercept pointer interaction");
	assert(JSON.stringify(geometry(cells[5]))===JSON.stringify(actionCellGeometry)
		&&JSON.stringify(geometry(cells[5].firstElementChild))===JSON.stringify(actionTextGeometry),
		"the action indicator does not move text or change cell dimensions");
	table.selectCell(row,"button");
	assert(!cells[5].classList.contains("tablance-active-cell")&&cells[6].classList.contains("tablance-active-cell")
		&&table._selectedCellState.kind==="action"&&!cells[6].classList.contains("action-indicator")
		&&!table._cellCursor.classList.contains("action-indicator"),
		"native active-cell ownership moves while a button action keeps its own affordance");
	table.selectCell(row,"editable");
	assert(!cells[6].classList.contains("tablance-active-cell")&&cells[0].classList.contains("tablance-active-cell")
		&&!cells[0].classList.contains("action-indicator")&&!table._cellCursor.classList.contains("action-indicator")
		&&!table._cellCursor.classList.contains("read-only"),
		"an editable active cell shows no read-only or action state indicator");
	assert(table.selectCell(row,"disabledValue")===false&&!table._cellCursor.classList.contains("action-indicator"),
		"a disabled cell cannot show the selected action indicator");

	table.selectCell(row,"computed");
	const lockIndicatorStyle=getComputedStyle(table._cellCursor,"::before");
	assert(cells[1].classList.contains("read-only")&&!cells[1].classList.contains("action-indicator")
		&&cells[1].classList.contains("tablance-active-cell")&&table._cellCursor.classList.contains("read-only")
		&&!table._cellCursor.classList.contains("action-indicator")&&lockIndicatorStyle.content==="\"\""
		&&(lockIndicatorStyle.maskImage!=="none"||lockIndicatorStyle.webkitMaskImage!=="none"),
		"a selected readOnly cell shows Tablance's native lock without the action indicator");
	let copied="";
	Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:text=>{copied=text;return Promise.resolve();}}});
	key(table.rootEl,"c","KeyC",{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="Rendered age: 31","whole-cell Ctrl+C uses displayed text");
	key(table.rootEl,"Enter","Enter");
	let presentation=table._cellCursor.querySelector("textarea.read-only-presentation");
	assert(presentation?.getAttribute("aria-readonly")==="true"&&presentation.value==="Rendered age: 31",
		"Enter opens an immutable read-only presentation with rendered text");
	assert(getComputedStyle(presentation).backgroundColor==="rgb(247, 249, 252)",
		"the native read-only presentation uses the subtle active surface");
	assert(document.activeElement===presentation,"Enter gives the read-only textarea DOM focus immediately");
	assert(presentation.selectionStart===presentation.value.length&&presentation.selectionEnd===presentation.value.length,
		"Enter creates a caret at the end of the text");
	const nativeKeyboard={};
	const nativeKeyboardDone=new Promise((resolve,reject)=>{
		const timeout=setTimeout(()=>reject(new Error("Timed out waiting for trusted read-only keyboard input")),5000);
		presentation.addEventListener("keyup",event=>{
			if (event.key==="ArrowRight"&&event.shiftKey)
				nativeKeyboard.shiftArrow=[presentation.selectionStart,presentation.selectionEnd];
			else if (event.key==="ArrowRight")
				nativeKeyboard.arrow=[presentation.selectionStart,presentation.selectionEnd];
			else if (event.key==="End")
				nativeKeyboard.end=[presentation.selectionStart,presentation.selectionEnd];
			else if (event.key==="Home")
				nativeKeyboard.home=[presentation.selectionStart,presentation.selectionEnd];
		});
		presentation.addEventListener("copy",()=>{
			nativeKeyboard.copied=presentation.value.slice(presentation.selectionStart,presentation.selectionEnd);
		});
		document.addEventListener("keyup",function escapeFinished(event) {
			if (event.key!=="Escape")
				return;
			document.removeEventListener("keyup",escapeFinished);
			clearTimeout(timeout);
			setTimeout(resolve);
		});
	});
	result.textContent="awaiting trusted caret-navigation keys";
	result.dataset.status="awaiting-native-keys";
	await nativeKeyboardDone;
	assert(nativeKeyboard.arrow?.[0]===1&&nativeKeyboard.arrow?.[1]===1,
		`ArrowRight moves the native caret (${JSON.stringify(nativeKeyboard.arrow)})`);
	assert(nativeKeyboard.shiftArrow?.[0]===1&&nativeKeyboard.shiftArrow?.[1]===2,
		"Shift+ArrowRight creates a native partial selection");
	assert(nativeKeyboard.copied===presentation.value.slice(1,2),"native Ctrl+C copies the partial selection");
	assert(nativeKeyboard.end?.[0]===presentation.value.length&&nativeKeyboard.end?.[1]===presentation.value.length,
		"End moves the native caret to the end of the line");
	assert(nativeKeyboard.home?.[0]===0&&nativeKeyboard.home?.[1]===0,
		"Home moves the native caret to the start of the line");
	assert(presentation.value==="Rendered age: 31","trusted text input cannot mutate the read-only presentation");
	assert(!table._inReadOnlyMode&&document.activeElement===table._focusEl,
		"trusted Escape closes presentation and restores Tablance focus");
	key(table.rootEl,"Enter","Enter");
	presentation=table._cellCursor.querySelector("textarea.read-only-presentation");
	presentation.setSelectionRange(9,12);
	assert(presentation.selectionStart===9&&presentation.selectionEnd===12,"native caret and partial text selection work");
	const partialCopy=key(presentation,"c","KeyC",{ctrlKey:true});
	assert(!partialCopy.defaultPrevented&&presentation.value.slice(presentation.selectionStart,presentation.selectionEnd)==="age","partial Ctrl+C is left to the native control");
	for (const type of ["beforeinput","paste","drop","cut"]) {
		const event=new Event(type,{bubbles:true,cancelable:true});
		presentation.dispatchEvent(event);
		assert(event.defaultPrevented,`${type} mutation is blocked in read-only presentation`);
	}
	for (const name of ["Backspace","Delete"])
		key(presentation,name,name);
	presentation.value="mutated";
	presentation.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertCompositionText",data:"x"}));
	assert(presentation.value==="Rendered age: 31","input/IME mutation is restored to immutable displayed text");
	key(presentation,"Escape","Escape");
	assert(!table._inReadOnlyMode&&!table._cellCursor.querySelector("textarea"),"Escape closes read-only presentation");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(table._inReadOnlyMode,"double-click opens read-only presentation");
	presentation=table._cellCursor.querySelector("textarea.read-only-presentation");
	assert(presentation.selectionStart===presentation.value.length&&presentation.selectionEnd===presentation.value.length,
		"double-click creates its caret directly at the end of the text");
	key(table._cellCursor.querySelector("textarea"),"Tab","Tab");
	assert(!table._inReadOnlyMode&&table._mainColIndex===2,"Tab closes presentation and resumes grid navigation");
	table.selectCell(row,"computed");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	const outside=document.body.appendChild(document.createElement("input"));
	outside.focus();
	await new Promise(resolve=>setTimeout(resolve,10));
	assert(!table._inReadOnlyMode,"blur closes read-only presentation without commit");

	table.selectCell(row,"explicit");
	key(table.rootEl,"Enter","Enter");
	assert(table._inReadOnlyMode,"explicit readOnly opens presentation instead of its editor");
	table._inputVal="illegal";
	assert(table._doEditSave()===false&&row.explicit==="locked","final save guard rejects readOnly mutation");
	table._exitReadOnlyMode();
	assert(changes===0&&commits===0&&validations===0,"readOnly triggers no validation, onChange, or onDataCommit callbacks");

	table.selectCell(row,"editable");
	key(table.rootEl,"Enter","Enter");
	const editor=table._cellCursor.querySelector("input");
	editor.value="changed";
	editor.dispatchEvent(new Event("change",{bubbles:true}));
	table._exitEditMode(true);
	assert(row.editable==="changed"&&changes===1,"editable cell still commits normally");

	table.selectCell(row,"action");
	key(table.rootEl,"Enter","Enter");
	assert(actions===1,"onEnter action activates without an editor");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(actions===2,"double-click preserves the existing text-action activation behavior");
	table.selectCell(row,"button");
	key(table.rootEl,"Enter","Enter");
	assert(buttonActions===1,"button control activates as an action");

	table.selectCell(row,"conditional");
	row.canEdit=false;
	table.updateData(row,"conditional",row.conditional,false,true);
	assert(cells[3].dataset.cellState==="readOnly"&&table._selectedCellState.kind==="readOnly"
		&&table._cellCursor.classList.contains("read-only"),
		"dynamic editableIf change refreshes both rendered and selected canonical state");
	row.isDisabled=false;
	table.updateData(row,"disabledValue",row.disabledValue,false,true);
	assert(cells[4].dataset.cellState==="editable"&&!cells[4].hasAttribute("aria-disabled"),"dynamic disabledIf false restores editable state");
	table.selectCell(row,"disabledValue");
	row.isDisabled=true;
	table.updateData(row,"disabledValue",row.disabledValue,false,true);
	assert(table._selectedCellState.kind==="disabled"&&table._cellCursor.style.display==="none",
		"a selected cell becoming disabled immediately loses its interactive cursor");

	table.selectCell(row,"editable");
	table.expandRow(0,false);
	const detailsRow=table._mainTbody.querySelector('tr.details[data-data-row-index="0"]');
	const detailsPanel=detailsRow.querySelector(":scope>td>.content");
	const detailsPanelStyle=getComputedStyle(detailsPanel);
	const detailsShadowStyle=getComputedStyle(detailsPanel.querySelector(":scope>.details-shadow"));
	assert(getComputedStyle(detailsRow.cells[0]).backgroundColor==="rgba(0, 0, 0, 0)"
		&&detailsPanelStyle.marginLeft==="20px"&&detailsPanelStyle.marginRight==="0px"
		&&detailsPanelStyle.borderBottomLeftRadius==="6px"&&detailsPanelStyle.borderBottomRightRadius==="0px"
		&&detailsPanelStyle.backgroundImage.includes("linear-gradient")&&detailsShadowStyle.zIndex==="2",
		"expanded details use Tablance's native transparent wrapper and layered indented panel");
	const detail=table.getDetailCell(0,"detail");
	assert(detail.cellState.kind==="readOnly"&&detail.el.classList.contains("read-only")
		&&detail.el.classList.contains("tablance-cell-state"),"details presentation field resolves readOnly with a canonical styling hook");
	assert(getComputedStyle(detail.el).paddingLeft==="5px",
		"main-row indicator spacing does not affect read-only cells in details");
	detail.select();
	assert(detail.el.classList.contains("tablance-active-cell")&&!cells[1].classList.contains("tablance-active-cell"),
		"native active-cell ownership also follows selection into details");
	key(table.rootEl,"Enter","Enter");
	assert(table._cellCursor.querySelector("textarea")?.value==="DETAIL RENDERED","details presentation uses rendered text");
	table._exitReadOnlyMode();
	const fileButtons=[...table._mainTbody.querySelector('tr.details').querySelectorAll("button")];
	assert(fileButtons.find(button=>button.textContent==="Open")?.disabled===false,
		"existing readOnly file retains its non-mutating open action");
	assert(fileButtons.filter(button=>button.textContent!=="Open").every(button=>button.disabled),
		"existing readOnly file disables delete mutation controls");

	const historyGroup=table.getDetailCell(0,"historyGroup");
	historyGroup.select();
	key(table.rootEl,"Enter","Enter");
	const historyEntries=historyGroup.children[0].children;
	assert(getComputedStyle(historyGroup.el).borderTopColor==="rgb(184, 198, 216)"
		&&getComputedStyle(historyEntries[0].el).borderTopColor==="rgb(184, 198, 216)"
		&&getComputedStyle(historyGroup.el).borderTopLeftRadius==="4px"
		&&getComputedStyle(historyEntries[0].el).borderTopLeftRadius==="4px"
		&&getComputedStyle(historyGroup.el).borderCollapse==="separate"
		&&getComputedStyle(historyEntries[0].el).borderSpacing==="0px 0px",
		"details groups use the subtle rounded blue-gray border with and without closedRender");
	historyEntries[0].select();
	assert(table._selectedCellState?.kind==="action","a closed-render group selection retains its canonical action state");
	const closedGroupRenderStyle=getComputedStyle(historyEntries[0].el.querySelector("tbody>tr.group-render>td"));
	assert(closedGroupRenderStyle.paddingLeft==="4px"&&closedGroupRenderStyle.paddingTop==="2px"
		&&closedGroupRenderStyle.paddingBottom==="2px",
		"a closed group render uses compact horizontal and vertical padding");
	const nestedGroupCellStyle=getComputedStyle(historyEntries[0].el.parentElement);
	assert(nestedGroupCellStyle.paddingRight==="4px"&&getComputedStyle(historyEntries[0].el).boxSizing==="border-box",
		"a nested group keeps visible space between its right border and its parent border");
	const firstHistorySeparator=historyEntries[0].children[0].selEl.querySelector(":scope>.separator");
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="dashed"
		&&getComputedStyle(firstHistorySeparator).marginLeft==="0px"
		&&getComputedStyle(firstHistorySeparator).marginRight==="4px",
		"closed inner cell separators are dashed with balanced horizontal indentation");
	key(table.rootEl,"Enter","Enter");
	assert(historyEntries[0].el.classList.contains("open")&&table._activeSchemaNode.title==="Date",
		"Enter opens a selected closed-render group and selects its first editable field");
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="solid"
		&&getComputedStyle(firstHistorySeparator).marginLeft==="0px"
		&&getComputedStyle(firstHistorySeparator).marginRight==="4px",
		"open inner cell separators become solid while retaining the same indentation");
	historyEntries[0].el.classList.remove("open");
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="dashed",
		"inner cell separators return to dashed when their group closes");
	historyEntries[0].el.classList.add("open");
	const openGroupFieldStyle=getComputedStyle(historyEntries[0].children[0].selEl);
	assert(openGroupFieldStyle.paddingLeft==="4px"&&openGroupFieldStyle.paddingTop==="2px"
		&&openGroupFieldStyle.paddingBottom==="2px",
		"separate fields inside an open group use compact horizontal and vertical padding");
	const openGroupTitleStyle=getComputedStyle(historyEntries[0].children[0].selEl.querySelector(":scope>span.title"));
	const openGroupValueStyle=getComputedStyle(historyEntries[0].children[0].selEl.querySelector(":scope>div"));
	const openGroupSeparatorStyle=getComputedStyle(historyEntries[0].children[0].selEl.querySelector(":scope>.separator"));
	assert(openGroupTitleStyle.marginLeft==="4px"&&openGroupTitleStyle.marginRight==="6px"
		&&openGroupTitleStyle.marginBottom==="4px"&&openGroupTitleStyle.fontSize==="13px"
		&&openGroupTitleStyle.fontWeight==="500"&&openGroupTitleStyle.color==="rgb(100, 116, 139)"
		&&openGroupValueStyle.marginLeft==="4px"
		&&openGroupValueStyle.marginRight==="6px"&&openGroupSeparatorStyle.marginLeft==="0px"
		&&openGroupSeparatorStyle.marginRight==="4px",
		"group field content gains subtle horizontal breathing room without changing separators");
	historyEntries[1].select();
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(historyEntries[1].el.classList.contains("open")&&table._activeSchemaNode.title==="Date",
		"double-click opens another closed-render group through the same canonical action path");

	const mainRow=table._mainTbody.querySelector('tr[data-data-row-index="0"]:not(.details)');
	const detailsRoot=table._openDetailsPanes[0];
	table._contractRow(mainRow);
	const selectedWhenCollapseStarted=table._selectedCell;
	assert(detailsRoot.collapsing===true&&!table._activeDetailsCell,
		"details become non-navigable as soon as their collapse animation starts");
	key(table.rootEl,"ArrowDown","ArrowDown");
	assert(!table._activeDetailsCell&&table._selectedCell===selectedWhenCollapseStarted&&detail.select()===false,
		"keyboard and programmatic selection cannot re-enter collapsing details");
	detail.el.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true}));
	assert(!table._activeDetailsCell,"mouse selection cannot re-enter collapsing details");
	detailsPanel.style.height="0px";
	detailsPanel.dispatchEvent(new Event("transitionend"));

	const navigationSchema={main:{columns:[
		{dataKey:"a",input:{type:"text"}},
		{dataKey:"b",disabled:true,input:{type:"text"}},
		{dataKey:"c",input:{type:"text"}},
	]}};
	const navigationTable=new Tablance(host(),navigationSchema,true,true,{searchbar:false,ordering:false});
	navigationTable.setData([{a:"a",b:"b",c:"c"}]);
	await tick();
	navigationTable.selectCell(0,"a");
	key(navigationTable.rootEl,"ArrowRight","ArrowRight");
	assert(navigationTable._mainColIndex===2,"keyboard navigation skips disabled cells");
	assert(navigationTable.selectCell(0,"b")===false,"disabled cells cannot be selected or activated");

	const toolbarTable=new Tablance(host(),{main:{
		toolbar:{defaultInsert:true},columns:[{dataKey:"value",input:{type:"text"}}],
	}},true,true,{ordering:false});
	assert(toolbarTable._toolbar.querySelector("button").tabIndex===0&&toolbarTable._searchInput.tabIndex===0
		&&!toolbarTable._focusEl.contains(toolbarTable._toolbar)
		&&toolbarTable._toolbar.nextElementSibling===toolbarTable._focusEl,
		"toolbar controls are separate tab stops before the table focus stop");
	toolbarTable._focusEl.focus();
	const focusRect=toolbarTable._focusEl.getBoundingClientRect();
	const headerRect=toolbarTable._headerTable.getBoundingClientRect();
	const bodyRect=toolbarTable._scrollBody.getBoundingClientRect();
	assert(Math.abs(focusRect.top-headerRect.top)<1&&Math.abs(focusRect.bottom-bodyRect.bottom)<1
		&&toolbarTable._focusEl.classList.contains("show-focus-ring")
		&&getComputedStyle(toolbarTable._focusEl,"::after").borderLeftWidth==="3px",
		"the overlaid focus ring follows the table and is painted visibly above its contents");

	const reuseRows=[{value:"one",disabled:false},{value:"two",disabled:true}];
	const reuseTable=new Tablance(host(),{main:{columns:[{dataKey:"value",disabledIf:({rowData})=>rowData.disabled,input:{type:"text"}}]}},true,true,{searchbar:false,ordering:false});
	reuseTable.setData(reuseRows);
	await tick();
	const reusedRow=reuseTable._mainTbody.querySelector('tr[data-data-row-index="0"]');
	const reusedCell=reusedRow.cells[0];
	reuseTable._updateRowValues(reusedRow,1);
	assert(reusedCell.dataset.cellState==="disabled"&&reusedCell.classList.contains("disabled")&&!reusedCell.classList.contains("read-only"),"virtualized/reused cell replaces prior state rather than retaining CSS state");

	const headerlessTable=new Tablance(host(),{main:{columns:[{dataKey:"value",input:{type:"text"}}]}},true,true,
		{searchbar:false,ordering:false,autoHeight:true,showHeader:false});
	headerlessTable.setData([{value:"headerless"}]);
	await tick();
	const headerlessBodyStyle=getComputedStyle(headerlessTable._scrollBody);
	assert(headerlessBodyStyle.borderTopWidth==="1px"&&headerlessBodyStyle.borderTopLeftRadius==="10px",
		"headerless auto-height tables receive a complete rounded native frame");

	const detailsOnlyTable=new Tablance(host(),{details:{type:"list",entries:[
		{title:"Only detail",dataKey:"value",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	detailsOnlyTable.setData([{value:"detail-only"}]);
	await tick();
	assert(detailsOnlyTable.rootEl.querySelector(".details .tablance-cell-state")
		&&getComputedStyle(detailsOnlyTable.rootEl).fontFamily.includes("Inter"),
		"details-only tables use the same native state hooks and default theme");

	const bulkRows=[{locked:"one"},{locked:"two"}];
	const bulkTable=new Tablance(host(),{main:{columns:[
		{type:"select"},
		{dataKey:"locked",readOnly:true,bulkEdit:true,input:{type:"text"}},
	]}},true,true,{searchbar:false,ordering:false});
	bulkTable.setData(bulkRows);
	await tick();
	bulkTable._toggleRowsSelected(true,0,1);
	bulkTable._updateBulkEditAreaCells();
	const bulkCell=bulkTable._bulkEditTable._openDetailsPanes[0].children[0];
	assert(bulkCell.cellState.kind==="readOnly","bulk editor aggregates source rows as readOnly");
	bulkCell.select();
	bulkTable._bulkEditTable._inputVal="illegal bulk";
	assert(bulkTable._bulkEditTable._doEditSave()===false&&bulkRows.every(item=>item.locked!=="illegal bulk"),"bulk save guard blocks readOnly mutation");

	result.textContent=`${assertions.length} cell-state assertions passed`;
	result.dataset.status="passed";
} catch (error) {
	result.textContent=error.stack??String(error);
	result.dataset.status="failed";
}
