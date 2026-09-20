const Tablance=window.Tablance;

const result=document.getElementById("test-results");
const assertions=[];
const assert=(condition,message)=>{
	if (!condition)
		throw new Error(message);
	assertions.push(message);
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const waitFor=async (condition,message,timeout=1000)=>{
	const deadline=performance.now()+timeout;
	while (!condition()) {
		if (performance.now()>=deadline)
			throw new Error(`Timed out waiting for ${message}`);
		await new Promise(resolve=>requestAnimationFrame(resolve));
	}
};
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
	const shortcuts=new Tablance(host(),{
		main:{columns:[{dataKey:"name",input:{type:"text"}}]},
		details:{type:"list",entries:[{dataKey:"detail"}]},
	},true,true,{ordering:false});
	shortcuts.setData([{name:"one",detail:"details"},{name:"two",detail:"more"}]);
	await tick();
	assert(!shortcuts._headerTr.cells[0].classList.contains("sortable-header"),
		"headers remain visually non-interactive when ordering is disabled");
	for (const [plus,minus] of [
		[{key:"+",code:"NumpadAdd"},{key:"-",code:"NumpadSubtract"}],
		[{key:"+",code:"Equal",shiftKey:true},{key:"-",code:"Minus"}],
		[{key:"+",code:"Minus"},{key:"-",code:"Slash"}],
		[{key:"+",code:"BracketRight"},{key:"-",code:"Digit6"}],
		[{key:"ArrowDown",code:"ArrowDown",altKey:true},{key:"ArrowUp",code:"ArrowUp",altKey:true}],
	]) {
		shortcuts._mainRowIndex=shortcuts._mainColIndex=null;
		shortcuts.rootEl.focus();
		const expandEvent=key(shortcuts.rootEl,plus.key,plus.code,plus);
		await tick();
		assert(!!shortcuts._openDetailsPanes[0],`${JSON.stringify(plus)} opens first row from outline`);
		assert(shortcuts._mainRowIndex===0,"expansion shortcut does not navigate to another row");
		const collapseEvent=key(shortcuts.rootEl,minus.key,minus.code,minus);
		await waitFor(()=>!shortcuts._openDetailsPanes[0],"details collapse cleanup");
		assert(!shortcuts._openDetailsPanes[0],`${JSON.stringify(minus)} closes the same row`);
		if (plus.altKey)
			assert(expandEvent.defaultPrevented&&collapseEvent.defaultPrevented,"Alt arrows suppress browser default");
	}
	const collapsedSizerHeight=shortcuts._tableSizer.style.height;
	key(shortcuts.rootEl,"+","NumpadAdd");
	await tick();
	const fallbackDetails=shortcuts._mainTbody.querySelector("tr.details");
	const fallbackContent=fallbackDetails.querySelector(".content");
	const suppressTransitionCompletion=event=>{
		if (event.target===fallbackContent&&(!event.propertyName||event.propertyName==="height"))
			event.stopImmediatePropagation();
	};
	fallbackContent.addEventListener("transitionend",suppressTransitionCompletion,{capture:true});
	fallbackContent.addEventListener("transitioncancel",suppressTransitionCompletion,{capture:true});
	key(shortcuts.rootEl,"-","NumpadSubtract");
	await waitFor(()=>!shortcuts._openDetailsPanes[0],"fallback details collapse cleanup");
	assert(!fallbackDetails.isConnected&&!shortcuts._rowMeta.get(shortcuts._filteredData[0])?.h
		&&shortcuts._tableSizer.style.height===collapsedSizerHeight,
		"collapse fallback finalizes DOM, row metadata, navigation state, and sizer exactly once without transition events");
	for (const binding of [{key:"=",code:"Equal"},{key:"_",code:"Minus",shiftKey:true},
		{key:"+",code:"Equal",ctrlKey:true},{key:"+",code:"Equal",metaKey:true},
		{key:"+",code:"Equal",isComposing:true}]) {
		key(shortcuts.rootEl,binding.key,binding.code,binding);
		assert(!shortcuts._openDetailsPanes[0],"unrelated characters and modified shortcuts do not expand");
	}
	shortcuts._inEditMode=true;
	for (const binding of [{key:"+",code:"Equal"},{key:"-",code:"Minus"},
		{key:"ArrowDown",code:"ArrowDown",altKey:true}]) {
		key(shortcuts.rootEl,binding.key,binding.code,binding);
		assert(!shortcuts._openDetailsPanes[0],"editing does not trigger expansion bindings");
	}
	shortcuts._inEditMode=false;
	key(shortcuts.rootEl,"ArrowDown");
	assert(shortcuts._mainRowIndex===1,"ordinary ArrowDown retains row navigation");
	key(shortcuts.rootEl,"ArrowUp");
	assert(shortcuts._mainRowIndex===0,"ordinary ArrowUp retains row navigation");
	const homeEndMain=new Tablance(host(),{main:{columns:[
		{dataKey:"left"},{dataKey:"middle"},{dataKey:"right"},
	]}},true,true,{searchbar:false,ordering:false});
	homeEndMain.setData([
		{left:"A1",middle:"B1",right:"C1"},
		{left:"A2",middle:"B2",right:"C2"},
		{left:"A3",middle:"B3",right:"C3"},
	]);
	await tick();
	homeEndMain._selectMainTableCell(homeEndMain._mainTbody.rows[1].cells[1]);
	key(homeEndMain.rootEl,"Home","Home");
	assert(homeEndMain._mainRowIndex===1&&homeEndMain._mainColIndex===0,
		"Home selects the first selectable main cell on the current row");
	key(homeEndMain.rootEl,"End","End");
	assert(homeEndMain._mainRowIndex===1&&homeEndMain._mainColIndex===2,
		"End selects the last selectable main cell on the current row");
	homeEndMain._selectMainTableCell(homeEndMain._mainTbody.rows[1].cells[1]);
	key(homeEndMain.rootEl,"End","End",{ctrlKey:true});
	assert(homeEndMain._mainRowIndex===2&&homeEndMain._mainColIndex===1,
		"Ctrl+End selects the final main row while retaining the current column");
	key(homeEndMain.rootEl,"Home","Home",{ctrlKey:true});
	assert(homeEndMain._mainRowIndex===0&&homeEndMain._mainColIndex===1,
		"Ctrl+Home selects the first main row while retaining the current column");

	let menuActionsResolved=0,menuActivations=[];
	const menuRows=[
		{name:"Alpha",locked:false},
		{name:"Beta",locked:true},
	];
	const callbackMenuColumn={type:"menu",title:"",width:45,
		ariaLabel:({rowData})=>`Actions for ${rowData.name}`,
		actions:payload=>{
			menuActionsResolved++;
			return [
				{label:({rowData})=>`Open ${rowData.name}`,icon:"restore",
					onSelect:actionPayload=>menuActivations.push(actionPayload)},
				{text:"Conditional action",disabled:({rowData})=>rowData.locked,
					disabledReason:({rowData})=>rowData.locked?`${rowData.name} is locked`:"",
					onSelect:actionPayload=>menuActivations.push(actionPayload)},
				{text:"Always unavailable",disabled:true,disabledReason:"Requires permission"},
			];
		},
	};
	let allowStaticAction=false;
	const staticMenuColumn={type:"menu",title:"More",width:45,actions:[
		{text:"Static action",beforeSelect:()=>allowStaticAction,
			onSelect:({rowData})=>menuActivations.push({rowData,static:true})},
	]};
	const menuTable=new Tablance(host(),{main:{columns:[
		{dataKey:"name",title:"Name"},callbackMenuColumn,staticMenuColumn,{dataKey:"locked",title:"Locked"},
	]}},true,true,{searchbar:true});
	menuTable.setData(menuRows);
	await tick();
	const firstMenuCell=menuTable._mainTbody.rows[0].cells[1];
	const secondMenuCell=menuTable._mainTbody.rows[1].cells[1];
	const staticMenuCell=menuTable._mainTbody.rows[0].cells[2];
	const firstMenuTrigger=firstMenuCell.querySelector(".tablance-menu-trigger");
	assert(firstMenuTrigger.textContent==="⋮"&&firstMenuTrigger.tabIndex===-1
		&&firstMenuTrigger.getAttribute("aria-haspopup")==="menu"
		&&menuTable._getCellState(firstMenuCell).kind==="action",
		"menu columns render a non-tabbable vertical-ellipsis action control with canonical action state");
	assert(!menuTable._searchableFieldNodes.includes(menuTable._colSchemaNodes[1])
		&&!menuTable._searchableFieldNodes.includes(menuTable._colSchemaNodes[2]),
		"menu columns are excluded from main-column search semantics");
	menuTable._headerTr.cells[1].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(!menuTable._sortingCols.length&&!menuTable._colSchemaNodes[1].sortDiv,
		"menu headers are not sortable and do not receive sort UI");

	firstMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	assert(menuTable._menuState?.rowData===menuRows[0]&&menuActionsResolved===1
		&&menuTable._mainRowIndex===0&&menuTable._mainColIndex===1
		&&menuTable._selectedCellVal===undefined&&!menuTable._inEditMode
		&&!menuTable._menuState.items.some(item=>item.el===document.activeElement)
		&&menuTable._menuState.openedFromKeyboard===false
		&&menuTable._cellCursor.style.display==="block"
		&&firstMenuTrigger.getAttribute("aria-expanded")==="true",
		"a pointer click opens the row menu without pre-highlighting an item or changing cell semantics");
	assert(document.activeElement===menuTable._menuPopover
		&&getComputedStyle(menuTable._menuPopover).outlineStyle==="none",
		"the internally focused row-menu container has no visible browser focus outline");
	assert(menuTable._menuState.items[0].el.querySelector(".tablance-icon-restore.tablance-menu-item-icon")
		&&menuTable._menuState.items[0].el.querySelector(".tablance-menu-item-label").textContent==="Open Alpha"
		&&!menuTable._menuState.items[1].el.querySelector(".tablance-menu-item-icon")
		&&getComputedStyle(menuTable._menuState.items[0].el.querySelector(".tablance-menu-item-icon")).width==="16px",
		"ordinary actions support callback labels and optional named icons while text-only actions remain icon-free");
	const pointerOpenFocus=document.activeElement;
	menuTable._menuState.items[0].el.dispatchEvent(new MouseEvent("mouseenter"));
	assert(document.activeElement===pointerOpenFocus,
		"pointer hover remains separate from keyboard focus");
	key(document.activeElement,"ArrowDown","ArrowDown");
	assert(document.activeElement===menuTable._menuState.items[0].el,
		"ArrowDown establishes keyboard navigation at the first item after a pointer open");
	key(document.activeElement,"ArrowDown","ArrowDown");
	assert(document.activeElement===menuTable._menuState.items[1].el,
		"ArrowDown moves menu focus to the next action");
	key(document.activeElement,"Enter","Enter");
	assert(!menuTable._menuState&&menuActivations.length===1
		&&menuActivations[0].rowData===menuRows[0]
		&&document.activeElement===menuTable._focusEl&&menuTable._selectedCell===firstMenuCell,
		"Enter activates an enabled action and restores table focus without moving the cursor");

	const priorPointerCell=menuTable._mainTbody.rows[0].cells[0];
	const nextPriorPointerCell=menuTable._mainTbody.rows[1].cells[0];
	menuTable._selectMainTableCell(priorPointerCell);
	secondMenuCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	secondMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	assert(menuTable._menuState?.rowData===menuRows[1]&&menuTable._selectedCell===priorPointerCell
		&&menuTable._mainRowIndex===0&&menuTable._mainColIndex===0,
		"pointer-opening a menu preserves an established cell cursor");
	key(document.activeElement,"Escape","Escape");
	assert(!menuTable._menuState&&document.activeElement===menuTable._focusEl
		&&menuTable._selectedCell===priorPointerCell,
		"Escape from a pointer-opened menu restores focus to the previous cell cursor");
	key(menuTable.rootEl,"ArrowDown","ArrowDown");
	assert(menuTable._selectedCell===nextPriorPointerCell,
		"keyboard navigation after Escape continues from the cursor that preceded the pointer-opened menu");

	menuTable._selectMainTableCell(priorPointerCell);
	secondMenuCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	secondMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	menuTable._menuState.items[0].el.click();
	assert(!menuTable._menuState&&menuTable._selectedCell===priorPointerCell
		&&document.activeElement===menuTable._focusEl&&menuActivations.length===2,
		"pointer menu action activation restores focus without moving the established cursor");

	secondMenuCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	secondMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	await tick();
	assert(!menuTable._menuState&&menuTable._selectedCell===priorPointerCell
		&&document.activeElement===menuTable._focusEl,
		"outside pointer close restores table focus to the cursor that preceded the menu");
	key(menuTable.rootEl,"ArrowDown","ArrowDown");
	assert(menuTable._selectedCell===nextPriorPointerCell,
		"keyboard navigation after outside close continues from the previous cursor");
	menuTable._selectMainTableCell(priorPointerCell);
	secondMenuCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	secondMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	const externalButton=document.body.appendChild(document.createElement("button"));
	externalButton.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	externalButton.focus();
	await tick();
	assert(!menuTable._menuState&&document.activeElement===externalButton
		&&menuTable._selectedCell===priorPointerCell,
		"outside close does not reclaim focus from an explicitly focusable pointer target");
	externalButton.remove();
	menuActivations.splice(1);

	menuTable._selectMainTableCell(secondMenuCell);
	menuTable._openMenuForCell(secondMenuCell,new KeyboardEvent("keydown",{key:"Enter",code:"Enter"}));
	await tick();
	assert(document.activeElement===menuTable._menuState.items[0].el
		&&menuTable._menuState.openedFromKeyboard===true
		&&getComputedStyle(document.activeElement).backgroundColor!=="rgba(0, 0, 0, 0)"
		&&getComputedStyle(document.activeElement).boxShadow==="none",
		"keyboard opening focuses the first full menu row without a separate blue indicator");
	key(document.activeElement,"ArrowDown","ArrowDown");
	const disabledMenuItem=menuTable._menuState.items[1].el;
	assert(document.activeElement===disabledMenuItem
		&&disabledMenuItem.getAttribute("aria-disabled")==="true"
		&&disabledMenuItem.textContent.includes("Beta is locked")
		&&getComputedStyle(disabledMenuItem).backgroundColor!=="rgba(0, 0, 0, 0)",
		"row-dependent disabled actions remain visible, focused, and expose their reason");
	key(disabledMenuItem,"Enter","Enter");
	key(disabledMenuItem," ","Space");
	disabledMenuItem.click();
	assert(!!menuTable._menuState&&menuActivations.length===1,
		"disabled actions cannot be activated by mouse, Enter, or Space");
	key(document.activeElement,"End","End");
	assert(document.activeElement===menuTable._menuState.items[2].el,
		"End focuses the final action including a statically disabled action");
	key(document.activeElement,"Home","Home");
	assert(document.activeElement===menuTable._menuState.items[0].el,
		"Home focuses the first menu action");
	key(document.activeElement,"ArrowUp","ArrowUp");
	assert(document.activeElement===menuTable._menuState.items[2].el,
		"ArrowUp wraps menu focus to the final action");
	key(document.activeElement,"Escape","Escape");
	assert(!menuTable._menuState&&document.activeElement===menuTable._focusEl
		&&menuTable._selectedCell===secondMenuCell&&menuTable._cellCursor.style.display==="block",
		"Escape closes the menu and restores table focus and the existing cursor");

	key(menuTable.rootEl," ","Space");
	await tick();
	assert(menuTable._menuState?.rowData===menuRows[1]&&document.activeElement===menuTable._menuState.items[0].el,
		"Space opens the focused menu cell");
	key(document.activeElement,"Tab","Tab");
	assert(!menuTable._menuState&&menuTable._mainRowIndex===1&&menuTable._mainColIndex===2
		&&menuTable._selectedCell===staticMenuCell.parentElement.nextElementSibling.cells[2],
		"Tab closes the menu and resumes ordinary grid navigation in the next cell");
	key(menuTable.rootEl,"Enter","Enter");
	await tick();
	assert(menuTable._menuState?.actions===staticMenuColumn.actions,
		"a declarative action array opens without passing through edit or select machinery");
	menuTable._menuState.items[0].el.click();
	assert(!!menuTable._menuState&&!menuActivations.some(item=>item.static),
		"beforeSelect may cancel an enabled action without closing its menu");
	allowStaticAction=true;
	key(document.activeElement,"Tab","Tab",{shiftKey:true});
	assert(!menuTable._menuState&&menuTable._mainColIndex===1,
		"Shift+Tab closes the menu and resumes reverse grid navigation");
	key(menuTable.rootEl,"Enter","Enter");
	await tick();
	document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(!menuTable._menuState,"an outside click closes an open menu");
	menuTable._selectMainTableCell(firstMenuCell);
	key(menuTable.rootEl,"Enter","Enter");
	await tick();
	assert(!!menuTable._menuState,"Enter opens the focused menu cell");
	firstMenuCell.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,button:0,cancelable:true}));
	assert(!menuTable._inEditMode,"double-click never puts a menu cell into edit mode");
	menuTable._closeMenu(true);
	const lifecycleRows=[
		{name:"Alpha",group:"left",deletedOn:null,notes:"Editable",entries:[{value:"child"}]},
		{name:"Beta",group:"right",deletedOn:null,notes:"Other",entries:[]},
		{name:"Closed",group:"right",deletedOn:"2026-01-01",notes:"Old",entries:[{value:"old child"}]},
	];
	const lifecycleCommits=[];
	let detailsButtonClicks=0;
	const lifecycleTable=new Tablance(host(),{
		trash:{
			isTrashed:({rowData})=>!!rowData.deletedOn,
			getChanges:({operation})=>({deletedOn:operation==="trash"?"2026-09-16":null}),
		},
		views:{default:{title:"Left",filter:row=>row.group==="left"},all:{title:"All",filter:()=>true}},
		onDataCommit:payload=>lifecycleCommits.push(payload),
		main:{toolbar:{defaultInsert:true,viewSwitcher:true,tableActions:[{type:"trash"}]},columns:[
			{type:"expand",width:40},
			{dataKey:"name",title:"Name",input:{type:"text"}},
			{type:"menu",width:45,actions:[
				{type:"trash"},
				{text:"Other action",disabled:({lifecycleMode})=>lifecycleMode==="trash",
					disabledReason:"Unavailable in trash"},
			]},
		]},
		details:{type:"list",entries:[
			{dataKey:"notes",title:"Notes",input:{type:"text"}},
			{title:"Change",input:{type:"button",text:"Change",onClick:()=>detailsButtonClicks++}},
			{type:"repeated",dataKey:"entries",create:true,entry:{type:"group",entries:[
				{dataKey:"value",title:"Value",input:{type:"text"}},
			]}},
		]},
	},true,true,{searchbar:true,lang:{trashAction:"Flytta till papperskorgen",restoreAction:"Återställ"}});
	lifecycleTable.setData(lifecycleRows);
	await tick();
	assert(lifecycleTable._filteredData.length===1&&lifecycleTable._filteredData[0]===lifecycleRows[0]
		&&lifecycleTable.getViewState().counts.active===2&&lifecycleTable.getViewState().counts.trash===1,
		"lifecycle filtering excludes trashed rows before the normal view and reports separate counts");
	lifecycleTable.setViewMode("all");
	assert(lifecycleTable._filteredData.length===2&&!lifecycleTable._filteredData.includes(lifecycleRows[2]),
		"an all-rows normal view cannot include trashed rows");
	lifecycleTable.setViewMode("default");
	lifecycleTable._searchInput.value="Alpha";
	lifecycleTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(lifecycleTable._filteredData.length===1&&lifecycleTable.getViewState().search==="Alpha",
		"active search filters only active-view rows");
	const tableMenuButton=lifecycleTable._tableMenuButton;
	assert(!!tableMenuButton&&!tableMenuButton.hidden
		&&tableMenuButton.parentElement.classList.contains("toolbar-right")
		&&!lifecycleTable._viewSwitcher.querySelector(".tablance-view-option").hidden
		&&lifecycleTable._lifecycleBackButton.hidden,
		"table actions render a toolbar menu independently of column headers");
	tableMenuButton.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	const defaultTrashIcon=lifecycleTable._tableMenuState?.items[0].el.querySelector(".tablance-icon-trash");
	const defaultTrashIconMask=getComputedStyle(defaultTrashIcon).maskImage;
	const defaultTrashIconWebkitMask=getComputedStyle(defaultTrashIcon).webkitMaskImage;
	assert(lifecycleTable._tableMenuState?.items[0].action.text==="Show trash"
		&&defaultTrashIcon&&(defaultTrashIconMask!=="none"
			||defaultTrashIconWebkitMask!=="none")
		&&!lifecycleTable._tableMenuState.items.some(item=>item.el===document.activeElement),
		"pointer activation opens the table-level menu without pre-highlighting its default trash action");
	assert(document.activeElement===lifecycleTable._tableMenuPopoverController.el
		&&getComputedStyle(lifecycleTable._tableMenuPopoverController.el).outlineStyle==="none",
		"the internally focused table-menu container has no visible browser focus outline");
	key(document.activeElement,"ArrowUp","ArrowUp");
	assert(document.activeElement===lifecycleTable._tableMenuState.items.at(-1).el,
		"ArrowUp establishes keyboard navigation at the final table action after a pointer open");
	key(document.activeElement,"Escape","Escape");
	assert(!lifecycleTable._tableMenuState&&document.activeElement===tableMenuButton,
		"Escape from table menu restores the table-level trigger");
	tableMenuButton.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(!lifecycleTable._tableMenuState,
		"outside pointer interaction dismisses the table-level menu");
	tableMenuButton.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	key(document.activeElement,"Tab","Tab",{shiftKey:true});
	assert(!lifecycleTable._tableMenuState&&document.activeElement===lifecycleTable._searchInput,
		"Shift+Tab closes the table menu and moves to the previous toolbar control");
	tableMenuButton.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	key(document.activeElement,"Tab","Tab");
	assert(!lifecycleTable._tableMenuState&&document.activeElement===lifecycleTable._tableArea,
		"Tab closes the table menu and moves into the table");
	tableMenuButton.focus();
	key(tableMenuButton,"Enter","Enter");
	assert(document.activeElement===lifecycleTable._tableMenuState.items[0].el
		&&lifecycleTable._tableMenuState.openedFromKeyboard===true
		&&getComputedStyle(document.activeElement).backgroundColor!=="rgba(0, 0, 0, 0)"
		&&getComputedStyle(document.activeElement).boxShadow==="none",
		"Enter on the table-menu trigger highlights its first full row without a separate indicator");
	lifecycleTable._tableMenuState.items[0].el.click();
	await tick();
	assert(lifecycleTable.getViewState().lifecycleMode==="trash"
		&&lifecycleTable.getViewState().viewModeKey===null
		&&lifecycleTable.getViewState().activeViewModeKey==="default"
		&&lifecycleTable._filteredData.length===1&&lifecycleTable._filteredData[0]===lifecycleRows[2]
		&&lifecycleTable._searchInput.value===""
		&&[...lifecycleTable._viewSwitcher.querySelectorAll(".tablance-view-option")].every(button=>button.hidden)
		&&!lifecycleTable._lifecycleBackButton.hidden
		&&lifecycleTable._toolbarInsertButton.hidden,
		"trash is a distinct lifecycle mode with its own empty search and read-only toolbar");
	const trashNameCell=lifecycleTable._mainTbody.rows[0].cells[1];
	lifecycleTable._selectMainTableCell(trashNameCell);
	assert(lifecycleTable._getCellState(trashNameCell).kind==="readOnly"
		&&lifecycleTable.insertNewRow({name:"Blocked"})===false,
		"trash mode blocks field edits and direct row insertion");
	key(lifecycleTable.rootEl,"Enter","Enter");
	assert(!lifecycleTable._inEditMode,"Enter does not enter an editor in trash mode");
	lifecycleTable._mainTbody.rows[0].cells[0].dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	await tick();
	assert(!!lifecycleTable._openDetailsPanes[0],"expand remains available in trash mode");
	const trashDetails=lifecycleTable._openDetailsPanes[0];
	assert(!lifecycleTable.rootEl.querySelector(".repeat-insertion")
		&&JSON.stringify(lifecycleRows[2].entries)==='[{"value":"old child"}]',
		"trash details show related data without a creator or changes to child rows");
	const notesNode=trashDetails.children.find(node=>node.schemaNode.dataKey==="notes");
	const detailsButton=trashDetails.children.find(node=>node.schemaNode.input?.type==="button")?.el;
	assert(lifecycleTable._getCellState(notesNode.selEl??notesNode.el).kind==="readOnly"
		&&detailsButtonClicks===0,"details fields are read-only in trash mode");
	if (detailsButton)
		detailsButton.click();
	assert(detailsButtonClicks===0,"changing details buttons do not activate in trash mode");
	const trashMenuCell=lifecycleTable._mainTbody.rows[0].cells[2];
	trashMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	assert(lifecycleTable._selectedCell===trashNameCell
		&&!lifecycleTable._menuState.items.some(item=>item.el===document.activeElement),
		"pointer-opening a trash row menu keeps the prior cell cursor and leaves its items unfocused");
	assert(lifecycleTable.lang.trashAction==="Flytta till papperskorgen"
		&&lifecycleTable.lang.restoreAction==="Återställ"
		&&lifecycleTable._menuState?.items[0].action.text==="Återställ"
		&&lifecycleTable._menuState.items[0].el.querySelector(".tablance-icon-restore")
		&&lifecycleTable._menuState.items[1].el.getAttribute("aria-disabled")==="true"
		&&lifecycleTable._menuState.items[1].el.textContent.includes("Unavailable in trash"),
		"restore uses localized copy and its default icon while other row actions stay visible in trash");
	key(document.activeElement,"ArrowDown","ArrowDown");
	key(document.activeElement,"ArrowDown","ArrowDown");
	key(document.activeElement,"Enter","Enter");
	assert(!!lifecycleTable._menuState&&lifecycleCommits.length===0,
		"disabled row actions cannot activate in trash mode");
	key(document.activeElement,"Home","Home");
	key(document.activeElement,"Escape","Escape");
	assert(!lifecycleTable._menuState&&lifecycleTable._selectedCell===trashNameCell
		&&document.activeElement===lifecycleTable._focusEl,
		"closing a trash row menu restores focus and the prior cell cursor");
	trashMenuCell.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	await tick();
	key(document.activeElement,"ArrowDown","ArrowDown");
	key(document.activeElement,"Enter","Enter");
	await tick();
	assert(lifecycleRows[2].deletedOn===null&&lifecycleTable._filteredData.length===0
		&&lifecycleCommits.length===1&&lifecycleCommits[0].mode==="update"
		&&lifecycleCommits[0].operation==="restore"
		&&lifecycleCommits[0].changes.deletedOn===null
		&&lifecycleCommits[0].data===lifecycleRows[2]
		&&JSON.stringify(lifecycleRows[2].entries)==='[{"value":"old child"}]',
		"Restore updates the shared row immediately and dispatches a normal update commit");
	lifecycleTable._searchInput.value="Closed";
	lifecycleTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	tableMenuButton.click();
	key(document.activeElement,"Enter","Enter");
	await tick();
	assert(lifecycleTable.getViewState().lifecycleMode==="active"
		&&lifecycleTable.getViewState().viewModeKey==="default"
		&&lifecycleTable._searchInput.value==="Alpha"
		&&lifecycleTable._filteredData.length===1&&lifecycleTable._filteredData[0]===lifecycleRows[0],
		"returning to active rows restores the normal view and its separate search state");
	lifecycleTable._mainTbody.rows[0].cells[2].click();
	assert(lifecycleTable._menuState.items[0].action.text==="Flytta till papperskorgen"
		&&lifecycleTable._menuState.items[0].el.querySelector(".tablance-icon-trash"),
		"trash uses localized copy and the same trash icon primitive as repeated deletion");
	lifecycleTable._menuState.items[0].el.click();
	await tick();
	assert(lifecycleRows[0].deletedOn==="2026-09-16"&&lifecycleTable._filteredData.length===0
		&&lifecycleCommits.length===2&&lifecycleCommits[1].operation==="trash"
		&&lifecycleCommits[1].changes.deletedOn==="2026-09-16",
		"Trash moves a row out of every active view immediately and commits only its configured change");
	tableMenuButton.click();
	key(document.activeElement,"Enter","Enter");
	await tick();
	assert(lifecycleTable.getViewState().lifecycleMode==="trash"
		&&lifecycleTable._searchInput.value==="Closed"
		&&lifecycleTable._filteredData.length===0,
		"trash mode retains its own search text across lifecycle switches");
	const capabilityOnly=new Tablance(host(),{
		trash:{isTrashed:({rowData})=>!!rowData.removed,
			getChanges:({operation})=>({removed:operation==="trash"})},
		main:{columns:[{dataKey:"name",input:{type:"text"}}]},
	},true,true,{searchbar:false});
	const capabilityRows=[{name:"Kept",removed:false},{name:"Removed",removed:true}];
	capabilityOnly.setData(capabilityRows);
	capabilityOnly.setLifecycleMode("trash");
	assert(!capabilityOnly._tableMenuButton&&!capabilityOnly._mainTbody.querySelector(".tablance-menu-trigger")
		&&capabilityOnly._filteredData.length===1&&capabilityOnly._filteredData[0]===capabilityRows[1],
		"trash capability works without exposing any row or table menu");
	assert(capabilityOnly.trashRow(capabilityRows[1],"restore")
		&&capabilityRows[1].removed===false&&capabilityOnly._filteredData.length===0,
		"capability-only tables may restore through the public lifecycle mutation method");

	const removalSchema=()=>({
		trash:{isTrashed:({rowData})=>!!rowData.removed,
			getChanges:({operation})=>({removed:operation==="trash"})},
		main:{columns:[{type:"expand",width:36},{dataKey:"name"},{dataKey:"code"}]},
		details:{type:"list",entries:[{dataKey:"detail"}]},
	});
	const makeRemovalTable=rows=>{
		const table=new Tablance(host(),removalSchema(),true,true,{searchbar:false,ordering:false});
		table.setData(rows);
		return table;
	};
	const assertSelectedRemoval=(selectedIndex,expectedName,label)=>{
		const rows=["Alpha","Beta","Gamma"].map((name,index)=>({name,code:`C${index}`,detail:`D${index}`,removed:false}));
		const table=makeRemovalTable(rows);
		table._selectMainTableCell(table._mainTbody.rows[selectedIndex].cells[2]);
		assert(table.trashRow(rows[selectedIndex],"trash")
			&&table._cellCursorDataObj.name===expectedName
			&&table._mainColIndex===2&&table._selectedCell.cellIndex===2
			&&table._cellCursor.style.display==="block",label);
		key(table.rootEl,"ArrowDown","ArrowDown");
		assert(table._mainColIndex===2,"vertical navigation after row removal retains the sticky main column");
		return table;
	};
	assertSelectedRemoval(0,"Beta","removing the first selected row moves the cursor to the next row");
	assertSelectedRemoval(1,"Gamma","removing a middle selected row moves the cursor to the next row");
	assertSelectedRemoval(2,"Beta","removing the final selected row moves the cursor to the previous row");

	const preservedRows=["One","Two","Three"].map((name,index)=>
		({name,code:`P${index}`,detail:`PD${index}`,removed:false}));
	const preservedTable=makeRemovalTable(preservedRows);
	preservedTable._selectMainTableCell(preservedTable._mainTbody.rows[1].cells[2]);
	const externalDialogButton=document.body.appendChild(document.createElement("button"));
	externalDialogButton.focus();
	await tick();
	assert(preservedTable._cellCursorDataObj===preservedRows[1]
		&&preservedTable._mainColIndex===2&&preservedTable._cellCursor.style.display==="block",
		"moving DOM focus into an external dialog leaves the logical and visible cell cursor intact");
	preservedTable.trashRow(preservedRows[0],"trash");
	assert(document.activeElement===externalDialogButton
		&&preservedTable._cellCursorDataObj===preservedRows[1]
		&&preservedTable._mainRowIndex===0&&preservedTable._mainColIndex===2
		&&preservedTable._cellCursor.style.display==="block",
		"removing another row preserves the exact cursor without stealing focus from a dialog");
	preservedTable._focusEl.focus({preventScroll:true});
	await tick();
	assert(preservedTable._cellCursorDataObj===preservedRows[1]
		&&preservedTable._mainColIndex===2&&!preservedTable._focusEl.classList.contains("show-focus-ring"),
		"dialog cancellation can restore DOM focus without replacing the cell cursor with a table outline");
	externalDialogButton.remove();

	const detailsRows=["Detail one","Detail two","Detail three"].map((name,index)=>
		({name,code:`D${index}`,detail:`Nested ${index}`,removed:false}));
	const detailsRemovalTable=makeRemovalTable(detailsRows);
	await tick();
	detailsRemovalTable._selectMainTableCell(detailsRemovalTable._mainTbody.rows[1].cells[2]);
	const selectedDetail=detailsRemovalTable.expandRow(1)?.children[0];
	selectedDetail.select();
	assert(detailsRemovalTable._activeDetailsCell===selectedDetail
		&&detailsRemovalTable.trashRow(detailsRows[1],"trash")
		&&detailsRemovalTable._activeDetailsCell===null
		&&detailsRemovalTable._cellCursorDataObj===detailsRows[2]
		&&detailsRemovalTable._mainColIndex===2,
		"a disappearing details row exits through the sticky main-column destination on the next row");

	const restoreRows=["Restore one","Restore two","Restore three"].map((name,index)=>
		({name,code:`R${index}`,detail:`RD${index}`,removed:true}));
	const restoreRemovalTable=makeRemovalTable(restoreRows);
	restoreRemovalTable.setLifecycleMode("trash");
	restoreRemovalTable._selectMainTableCell(restoreRemovalTable._mainTbody.rows[1].cells[2]);
	assert(restoreRemovalTable.trashRow(restoreRows[1],"restore")
		&&restoreRemovalTable._cellCursorDataObj===restoreRows[2]
		&&restoreRemovalTable._mainColIndex===2,
		"restore uses the same adjacent-row cursor semantics when its selected row leaves trash");

	const finalRemovalRow={name:"Only",code:"final",detail:"last",removed:false};
	const finalRemovalTable=makeRemovalTable([finalRemovalRow]);
	finalRemovalTable._selectMainTableCell(finalRemovalTable._mainTbody.rows[0].cells[2]);
	finalRemovalTable.trashRow(finalRemovalRow,"trash");
	key(finalRemovalTable.rootEl,"ArrowDown","ArrowDown");
	assert(finalRemovalTable._filteredData.length===0&&finalRemovalTable._selectedCell===null
		&&finalRemovalTable._mainRowIndex===null&&finalRemovalTable._mainColIndex===null
		&&finalRemovalTable._cellCursorDataObj===null&&finalRemovalTable._cellCursor.style.display==="none",
		"removing the final visible row clears the cursor stably without a ghost selection on the next arrow");
	const removedRows=[{name:"One",code:"1"},{name:"Two",code:"2"},{name:"Three",code:"3"}];
	const removeDataTable=new Tablance(host(),{main:{columns:[{dataKey:"name"},{dataKey:"code"}]}},true,true,
		{searchbar:false});
	removeDataTable.addData(removedRows);
	removeDataTable._selectMainTableCell(removeDataTable._mainTbody.rows[1].cells[1]);
	assert(removeDataTable.removeData(removedRows[1])
		&&removeDataTable._cellCursorDataObj===removedRows[2]
		&&removeDataTable._activeSchemaNode.dataKey==="code"
		&&!removeDataTable._sourceData.includes(removedRows[1]),
		"removeData preserves the nearest sticky-column cursor while removing the source row");
	removeDataTable.removeData(removedRows[2]);
	assert(removeDataTable._cellCursorDataObj===removedRows[0]
		&&removeDataTable._activeSchemaNode.dataKey==="code",
		"removeData falls back to the preceding row without losing its sticky column");
	removeDataTable.removeData(removedRows[0]);
	key(removeDataTable.rootEl,"ArrowDown","ArrowDown");
	assert(removeDataTable._filteredData.length===0&&removeDataTable._selectedCell===null
		&&removeDataTable._mainRowIndex===null&&removeDataTable._mainColIndex===null
		&&removeDataTable._cellCursorDataObj===null&&removeDataTable._cellCursor.style.display==="none",
		"removeData clears the only remaining cursor without leaving a ghost navigation column");
	const firstRemovedRows=[{name:"First",code:"A"},{name:"Next",code:"B"}];
	removeDataTable.addData(firstRemovedRows);
	removeDataTable._selectMainTableCell(removeDataTable._mainTbody.rows[0].cells[1]);
	assert(removeDataTable.removeData(firstRemovedRows[0])
		&&removeDataTable._cellCursorDataObj===firstRemovedRows[1]
		&&removeDataTable._activeSchemaNode.dataKey==="code",
		"removeData moves a first-row cursor to the following row in the same sticky column");
	const overriddenTrashTable=new Tablance(host(),{
		trash:{isTrashed:({rowData})=>!!rowData.removed,
			getChanges:({operation})=>({removed:operation==="trash"})},
		main:{columns:[{dataKey:"name"},{type:"menu",actions:[
			{type:"trash",label:({rowData})=>`Archive ${rowData.name}`,icon:false},
		]}]},
	},true,true,{searchbar:false});
	overriddenTrashTable.setData([{name:"Custom",removed:false}]);
	overriddenTrashTable._mainTbody.rows[0].cells[1].click();
	await tick();
	assert(overriddenTrashTable._menuState.items[0].el.querySelector(".tablance-menu-item-label").textContent
		==="Archive Custom"&&!overriddenTrashTable._menuState.items[0].el.querySelector(".tablance-menu-item-icon"),
		"a built-in action accepts the same generic label and icon overrides as ordinary actions");
	overriddenTrashTable._closeMenu();
	const genericTableMenu=new Tablance(host(),{
		main:{toolbar:{tableActions:[{text:"Inspect",onSelect:()=>detailsButtonClicks++}]},
			columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false});
	genericTableMenu.setData([{name:"Plain"}]);
	genericTableMenu._tableMenuButton.click();
	await tick();
	assert(!!genericTableMenu._tableMenuState
		&&genericTableMenu._tableMenuState.items[0].action.text==="Inspect",
		"table actions work without a trash capability");
	key(document.activeElement,"Enter","Enter");
	assert(detailsButtonClicks===1&&!genericTableMenu._tableMenuState
		&&document.activeElement===genericTableMenu._tableMenuButton,
		"keyboard activation of a table action restores toolbar focus");
	const tableUtilityHost=host();
	tableUtilityHost.style.width="280px";
	const tableUtility=new Tablance(tableUtilityHost,{
		help:"General table help",
		trash:{isTrashed:({rowData})=>!!rowData.removed,
			getChanges:({operation})=>({removed:operation==="trash"})},
		main:{toolbar:{tableActions:[{type:"trash"}]},columns:[
			{dataKey:"name",title:"Name"},{type:"menu",actions:[{text:"Inspect"}]},
		]},
	},true,true,{searchbar:false,tableUtilitiesPlacement:"table"});
	tableUtility.setData([{name:"Active",removed:false},{name:"Removed",removed:true}]);
	await tick();
	const utilityRow=tableUtility._tableUtilities;
	const utilityHelp=utilityRow.querySelector(".table-help-trigger");
	const utilityMenu=tableUtility._tableMenuButton;
	assert(!tableUtility._toolbar&&utilityRow.parentElement===tableUtility._tableArea
		&&utilityRow.firstElementChild===utilityMenu&&utilityRow.lastElementChild===utilityHelp
		&&tableUtility._headerTr.lastElementChild.classList.contains("scrollbar-spacer")
		&&tableUtility._headerTr.cells[0].classList.contains("sortable-header")
		&&!tableUtility._headerTr.cells[1].classList.contains("sortable-header")
		&&tableUtility._tableArea.classList.contains("has-table-utilities"),
		"table placement groups menu then help while marking only sortable data headers as interactive");
	const utilityRect=utilityRow.getBoundingClientRect();
	const helpRect=utilityHelp.getBoundingClientRect();
	const menuRect=utilityMenu.getBoundingClientRect();
	const utilityHeaderRect=tableUtility._headerTable.getBoundingClientRect();
	const defaultUtilityLayout=new Tablance(host(),{
		help:"General table help",
		main:{toolbar:{tableActions:[{text:"Inspect"}]},columns:[{dataKey:"name",title:"Name"}]},
	},true,true,{searchbar:false});
	defaultUtilityLayout.setData([{name:"Default"}]);
	await tick();
	const lastDataHeader=tableUtility._headerTr.cells[tableUtility._colSchemaNodes.length-1]
		.getBoundingClientRect();
	const lastDataCell=tableUtility._mainTbody.rows[0].cells[tableUtility._colSchemaNodes.length-1]
		.getBoundingClientRect();
	assert(menuRect.left>=utilityRect.left&&helpRect.right<=utilityRect.right
		&&menuRect.right<helpRect.left
		&&Math.abs(utilityRect.top-utilityHeaderRect.top)<=1
		&&Math.abs(utilityRect.bottom-utilityHeaderRect.bottom)<=1
		&&tableUtility._headerTable.offsetHeight===defaultUtilityLayout._headerTable.offsetHeight
		&&Math.abs(lastDataHeader.left-lastDataCell.left)<2
		&&Math.abs(lastDataHeader.right-lastDataCell.right)<2
		&&Math.abs(lastDataCell.right-tableUtility._headerTr.lastElementChild.getBoundingClientRect().left)<2
		&&utilityRect.right<=utilityHeaderRect.right
		&&Math.abs(parseFloat(tableUtility._scrollBody.style.height)
			-(tableUtilityHost.clientHeight-utilityHeaderRect.height
				-tableUtility._bulkEditArea.offsetHeight))<1,
		"utilities share the unchanged header height while data columns align with the scrolling table");
	assert(helpRect.width===menuRect.width&&helpRect.height===menuRect.height
		&&getComputedStyle(utilityHelp).borderStyle==="none"
		&&getComputedStyle(utilityMenu).borderStyle==="none"
		&&getComputedStyle(utilityHelp).backgroundColor===getComputedStyle(utilityMenu).backgroundColor,
		"both table utilities share the same borderless hit area and resting appearance");
	tableUtility._headerTr.cells[0].click();
	assert(tableUtility._sortingCols.length===1&&tableUtility._sortingCols[0].index===0
		&&tableUtility._headerTr.cells[0].classList.contains("asc"),
		"the data header keeps its normal sorting and chevron behavior beside the utility area");
	utilityRow.click();
	assert(tableUtility._sortingCols.length===1&&tableUtility._sortingCols[0].index===0,
		"the separate utility overlay never participates in column sorting");
	utilityHelp.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,180));
	utilityHelp.dispatchEvent(new MouseEvent("mouseleave"));
	utilityMenu.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,200));
	assert(!tableUtility._helpState,
		"moving quickly from table help to the adjacent table menu cancels the pending help open");
	utilityHelp.click();
	assert(tableUtility._helpState?.trigger===utilityHelp
		&&tableUtility._helpPopover.getBoundingClientRect().left>=0,
		"table-attached help anchors its existing popover to the utility trigger");
	tableUtility._closeHelp();
	utilityMenu.focus();
	key(utilityMenu,"Enter","Enter");
	assert(tableUtility._tableMenuState?.items[0].el===document.activeElement,
		"table-attached menu preserves keyboard opening and first-item focus");
	tableUtility._tableMenuState.items[0].el.click();
	await tick();
	assert(tableUtility.getViewState().lifecycleMode==="trash"
		&&tableUtility._tableMenuButton===document.activeElement
		&&tableUtility._tableUtilities===utilityRow&&!utilityRow.hidden,
		"table-attached menu switches to trash and restores focus without changing placement");
	utilityMenu.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,detail:1,cancelable:true}));
	assert(document.activeElement===tableUtility._tableMenuPopoverController.el,
		"pointer opening the table-attached menu retains the shared neutral focus state");
	key(document.activeElement,"ArrowDown","ArrowDown");
	key(document.activeElement,"Enter","Enter");
	await tick();
	assert(tableUtility.getViewState().lifecycleMode==="active"
		&&tableUtility._tableUtilities===utilityRow,
		"table-attached menu returns to active data through the same action flow");
	tableUtilityHost.style.width="180px";
	tableUtility._updateSizesOfViewportAndCols();
	const narrowUtilities=utilityRow.getBoundingClientRect();
	assert(utilityMenu.getBoundingClientRect().left>=narrowUtilities.left
		&&utilityHelp.getBoundingClientRect().right<=narrowUtilities.right
		&&tableUtility._headerTr.cells[0].classList.contains("before-table-utilities")
		&&narrowUtilities.right<=tableUtility._headerTable.getBoundingClientRect().right
		&&narrowUtilities.bottom<=tableUtility._headerTable.getBoundingClientRect().bottom+1,
		"utilities remain clear of the sorting chevron at a narrow table width");
	tableUtility.setData(Array.from({length:80},(_,index)=>({name:`Row ${index}`,removed:false})));
	await tick();
	tableUtility._updateSizesOfViewportAndCols();
	const scrollbarGutter=tableUtility._headerTr.lastElementChild.getBoundingClientRect();
	assert(tableUtility._scrollBody.offsetWidth>tableUtility._scrollBody.clientWidth
		&&utilityHelp.getBoundingClientRect().right>scrollbarGutter.left
		&&utilityHelp.getBoundingClientRect().right<=tableUtility._headerTable.getBoundingClientRect().right
		&&utilityMenu.getBoundingClientRect().right<utilityHelp.getBoundingClientRect().left,
		"rightmost help may use the scrollbar gutter while table menu remains immediately to its left");
	assert(tableUtility._colSchemaNodes[1].pxWidth===48
		&&Math.abs(lastDataHeader.width-48)<1&&Math.abs(lastDataCell.width-48)<1,
		"a menu column without an explicit width keeps a compact fixed 48 px width");
	const lifecycleColumnHost=host();
	lifecycleColumnHost.style.width="760px";
	const columnVisibilityCalls=[];
	const lifecycleColumns=new Tablance(lifecycleColumnHost,{
		trash:{isTrashed:({rowData})=>rowData.deleted,
			getChanges:({operation})=>({deleted:operation==="trash"})},
		main:{toolbar:{search:{visible:true}},columns:[
			{title:"Name",dataKey:"name",width:"40%"},
			{title:"City",dataKey:"city"},
			{title:"Active note",dataKey:"activeNote",visible:payload=>{
				columnVisibilityCalls.push([payload.lifecycleMode,payload.viewState.lifecycleMode]);
				return payload.lifecycleMode==="active";
			}},
			{title:"Removed",dataKey:"deletedAt",width:"150px",
				visible:({lifecycleMode})=>lifecycleMode==="trash"},
			{title:"Never",dataKey:"never",visible:false},
			{type:"menu",actions:[{text:"Inspect"}]},
		]},
	},true,true);
	lifecycleColumns.setData([
		{name:"Active A",city:"Malmö",activeNote:"Only active A",deletedAt:"hidden active value",deleted:false},
		{name:"Active B",city:"Lund",activeNote:"Only active B",deletedAt:"hidden active value",deleted:false},
		{name:"Removed A",city:"Umeå",activeNote:"hidden trash value",deletedAt:"2026-09-18 10:20",deleted:true},
		{name:"Removed B",city:"Falun",activeNote:"hidden trash value",deletedAt:"2026-09-19 11:30",deleted:true},
	]);
	await tick();
	const activeWidths=lifecycleColumns._colSchemaNodes.map(column=>column.pxWidth);
	assert(lifecycleColumns._colSchemaNodes.map(column=>column.title??column.type).join("|")
		==="Name|City|Active note|menu"
		&&lifecycleColumns._headerTr.cells.length===5
		&&lifecycleColumns._mainTbody.rows[0].cells.length===4
		&&columnVisibilityCalls.some(([mode,stateMode])=>mode==="active"&&stateMode==="active"),
		"column visible callbacks receive lifecycle/view state and define the initial effective column set");
	lifecycleColumns._selectMainTableCell(lifecycleColumns._mainTbody.rows[0].cells[0]);
	lifecycleColumns._headerTr.cells[0].click();
	const survivingSortSchema=lifecycleColumns._sortingCols[0].schemaNode;
	lifecycleColumns.setLifecycleMode("trash");
	await tick();
	assert(lifecycleColumns._colSchemaNodes.map(column=>column.title??column.type).join("|")
		==="Name|City|Removed|menu"
		&&lifecycleColumns._headerTr.cells.length===5
		&&lifecycleColumns._mainTbody.rows[0].cells.length===4
		&&lifecycleColumns._sortingCols[0]?.schemaNode===survivingSortSchema
		&&lifecycleColumns._sortingCols[0]?.index===0
		&&lifecycleColumns._activeSchemaNode===survivingSortSchema,
		"lifecycle switching rebuilds header/rows while preserving a still-visible sort and sticky cursor column");
	assert(Math.abs(lifecycleColumns._colSchemaNodes[2].pxWidth-150)<1
		&&Math.abs(lifecycleColumns._mainTbody.rows[0].cells[2].getBoundingClientRect().width-150)<1,
		"a newly visible fixed-width lifecycle column participates in a fresh width calculation");
	key(lifecycleColumns.rootEl,"ArrowDown");
	assert(lifecycleColumns._mainRowIndex===1&&lifecycleColumns._mainColIndex===0,
		"vertical keyboard navigation continues from the preserved lifecycle cursor anchor");
	lifecycleColumns._headerTr.cells[2].click();
	assert(lifecycleColumns._sortingCols[0].schemaNode===lifecycleColumns._colSchemaNodes[2],
		"a trash-only column can be sorted while it is visible");
	lifecycleColumns._searchInput.value="hidden trash value";
	lifecycleColumns._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(lifecycleColumns._filteredData.length===0,
		"search ignores lifecycle-hidden main columns");
	lifecycleColumns._searchInput.value="";
	lifecycleColumns._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	lifecycleColumns.setLifecycleMode("active");
	await tick();
	assert(lifecycleColumns._colSchemaNodes.map(column=>column.title??column.type).join("|")
		==="Name|City|Active note|menu"
		&&!lifecycleColumns._sortingCols.length
		&&lifecycleColumns._colSchemaNodes.every((column,index)=>Math.abs(column.pxWidth-activeWidths[index])<1),
		"returning active restores its declarative layout and drops sorting for a column that disappeared");
	lifecycleColumns._selectMainTableCell(lifecycleColumns._mainTbody.rows[0].cells[2]);
	lifecycleColumns.setLifecycleMode("trash");
	await tick();
	assert(lifecycleColumns._activeSchemaNode.dataKey==="deletedAt"&&lifecycleColumns._mainColIndex===2,
		"a disappearing focused column deterministically chooses the nearest visible declared column");
	const explicitMenuWidth=new Tablance(host(),{main:{columns:[
		{dataKey:"name"},{type:"menu",width:"64px",actions:[{text:"Inspect"}]},
	]}},true,true,{searchbar:false});
	explicitMenuWidth.setData([{name:"Explicit"}]);
	await tick();
	assert(explicitMenuWidth._colSchemaNodes[1].pxWidth===64
		&&Math.abs(explicitMenuWidth._mainTbody.rows[0].cells[1].getBoundingClientRect().width-64)<1,
		"an explicit menu-column width continues to override the compact default");
	const utilityWithoutMenuColumn=new Tablance(host(),{
		help:"General help",main:{toolbar:{tableActions:[{text:"Inspect"}]},columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false,tableUtilitiesPlacement:"table"});
	utilityWithoutMenuColumn.setData([{name:"No menu column"}]);
	await tick();
	assert(utilityWithoutMenuColumn._tableUtilities.firstElementChild
		===utilityWithoutMenuColumn._tableMenuButton
		&&utilityWithoutMenuColumn._tableUtilities.lastElementChild.matches(".table-help-trigger")
		&&utilityWithoutMenuColumn._headerTr.cells[0].classList.contains("before-table-utilities"),
		"the same compact menu-help order works without a menu column");
	const noUtilityTable=new Tablance(host(),{main:{columns:[{dataKey:"name"}]}},true,true,
		{searchbar:false,tableUtilitiesPlacement:"table"});
	assert(!noUtilityTable._tableUtilities&&!noUtilityTable._toolbar,
		"table placement adds no utility area when neither help nor table actions exist");
	let exposeUtilityAction=false;
	const conditionalUtility=new Tablance(host(),{
		main:{toolbar:{tableActions:()=>exposeUtilityAction?[{text:"Inspect"}]:[]},
			columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false,tableUtilitiesPlacement:"table"});
	assert(conditionalUtility._tableUtilities.hidden&&conditionalUtility._tableMenuButton.hidden,
		"an empty table-actions callback leaves the table utility area hidden");
	exposeUtilityAction=true;
	conditionalUtility._updateLifecycleControls();
	await tick();
	assert(!conditionalUtility._tableUtilities.hidden&&!conditionalUtility._tableMenuButton.hidden
		&&conditionalUtility._tableArea.classList.contains("has-table-utilities"),
		"the shared utility area appears when a table action becomes available");
	const headerlessUtility=new Tablance(host(),{
		main:{toolbar:{tableActions:[{text:"Inspect"}]},columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false,showHeader:false,tableUtilitiesPlacement:"table"});
	assert(!headerlessUtility._tableUtilities
		&&headerlessUtility._tableMenuButton.parentElement.classList.contains("toolbar-right"),
		"a hidden header falls back to the default toolbar trigger instead of losing table actions");
	const relocatedToolbarTable=new Tablance(host(),{
		main:{toolbar:{defaultInsert:true},columns:[{dataKey:"name"}]},
	},true,true,{searchbar:true});
	relocatedToolbarTable.setData([{name:"Layout"}]);
	await tick();
	const toolbarHeight=relocatedToolbarTable._toolbar.offsetHeight;
	const viewportHeightBefore=parseFloat(relocatedToolbarTable._scrollBody.style.height);
	const hostHeightBefore=relocatedToolbarTable.hostEl.offsetHeight;
	relocatedToolbarTable._toolbar.style.display="none";
	relocatedToolbarTable._updateSizesOfViewportAndCols();
	const viewportHeightAfter=parseFloat(relocatedToolbarTable._scrollBody.style.height);
	assert(relocatedToolbarTable.hostEl.offsetHeight===hostHeightBefore&&toolbarHeight>0
		&&Math.abs(viewportHeightAfter-viewportHeightBefore-toolbarHeight)<1,
		"an explicit layout refresh immediately fills space freed by a relocated toolbar without requiring resize");
	const emptyTableMenu=new Tablance(host(),{
		main:{toolbar:{tableActions:[]},columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false});
	assert(emptyTableMenu._tableMenuButton.hidden,
		"an empty declarative table-actions list exposes no visible menu button");
	shortcuts.rootEl.remove();
	assert(Tablance.version==="2.0.0","built UMD exposes the breaking 2.0.0 version");
	Tablance.defaultLang={filterPlaceholder:"Global search"};
	const globalLangTable=new Tablance(host(),{main:{columns:[{dataKey:"value"}]}},true,true,{ordering:false});
	const localLangTable=new Tablance(host(),{main:{columns:[{dataKey:"value"}]}},true,true,
		{ordering:false,lang:{filterPlaceholder:"Local search"}});
	assert(globalLangTable._searchInput.placeholder==="Global search"
		&&localLangTable._searchInput.placeholder==="Local search",
		"global language defaults apply to every table while per-instance language keeps priority");
	Tablance.defaultLang={};

	const implicitViewTable=new Tablance(host(),{
		views:{flagged:row=>row.flagged},
		main:{columns:[{dataKey:"name"}]},
	},true,true,{searchbar:false,ordering:false});
	implicitViewTable.setData([{name:"plain",flagged:false},{name:"flagged",flagged:true}]);
	assert(Object.keys(implicitViewTable._viewDefinitions).join(",")==="flagged,default"
		&&implicitViewTable._viewDefinitions.flagged.title===null
		&&implicitViewTable.getViewState().counts.view===2,
		"function-shorthand views retain declaration order and receive an implicit all-rows default view");
	implicitViewTable.setViewMode("flagged");
	assert(implicitViewTable.getViewState().counts.view===1,
		"the existing function-shorthand predicate remains usable through setViewMode");

	const viewRows=[
		{name:"Beta",active:true},
		{name:"Alpha",active:true},
		{name:"Archived",active:false},
	];
	const viewCommits=[];
	let viewNameRenders=0;
	const viewTable=new Tablance(host(),{
		views:{
			default:{title:"Aktiva",filter:row=>row.active===true},
			all:{title:"Alla",filter:()=>true},
			archived:row=>row.active===false,
		},
		onDataCommit:payload=>viewCommits.push(payload),
		main:{toolbar:{defaultInsert:true,viewSwitcher:true},columns:[
			{dataKey:"name",render:({value})=>{ viewNameRenders++; return value; },input:{type:"text"}},
			{dataKey:"active",input:{type:"text"}},
		]},
	},true,true,{ordering:true,lang:{viewsLabel:"Datavyer"}});
	const viewStateEvents=[];
	viewTable.rootEl.addEventListener("viewstatechange",event=>viewStateEvents.push(event.detail));
	viewTable.setData(viewRows);
	await tick();
	const viewButtons=[...viewTable._viewSwitcher.querySelectorAll("button")];
	const viewButtonWidths=viewButtons.map(button=>button.getBoundingClientRect().width);
	assert(viewButtons.map(button=>button.querySelector(".tablance-view-option-label").textContent).join(",")
		==="Aktiva,Alla,archived"
		&&viewButtons.every(button=>button.querySelector(".tablance-view-option-width")
			?.getAttribute("aria-hidden")==="true")
		&&viewTable._viewSwitcher.getAttribute("role")==="group"
		&&viewTable._viewSwitcher.getAttribute("aria-label")==="Datavyer"
		&&viewButtons[0].getAttribute("aria-pressed")==="true"
		&&viewButtons.slice(1).every(button=>button.getAttribute("aria-pressed")==="false")
		&&viewTable._viewSwitcher.parentElement.classList.contains("toolbar-left")
		&&viewTable._searchInput.parentElement.classList.contains("toolbar-right"),
		"viewSwitcher renders titled views in declaration order as an ARIA segmented control on toolbar-left");
	assert(JSON.stringify(viewTable.getViewState())===JSON.stringify({
		viewModeKey:"default",search:"",counts:{source:3,lifecycle:3,view:2,filtered:2,
			visible:{source:3,lifecycle:3,view:2,filtered:2}},
	})&&viewStateEvents.at(-1).reason==="data",
		"getViewState and viewstatechange expose committed and visible pipeline counts with view-key and search state");
	viewTable._searchInput.value="Beta";
	viewTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(viewTable._filteredData.length===1&&viewTable._filteredData[0]===viewRows[0]
		&&viewTable.getViewState().search==="Beta"&&viewTable.getViewState().counts.filtered===1,
		"native text search filters within the active view and is represented in public view state");
	viewButtons[1].click();
	assert(viewTable._currentViewModeKey==="all"&&viewTable._filteredData.length===1
		&&viewTable._filteredData[0]===viewRows[0]
		&&viewButtons[1].getAttribute("aria-pressed")==="true"
		&&viewButtons.every((button,index)=>Math.abs(button.getBoundingClientRect().width-viewButtonWidths[index])<.1)
		&&new Set(viewButtonWidths.map(width=>Math.round(width))).size>1,
		"switching views reapplies the active text search and updates the segmented control state");
	const rendersBeforeExplicitRefresh=viewNameRenders;
	const explicitlyRefreshedState=viewTable.refreshView();
	assert(explicitlyRefreshedState.viewModeKey==="all"&&explicitlyRefreshedState.search==="Beta"
		&&viewTable._filteredData[0]===viewRows[0]&&viewNameRenders>rendersBeforeExplicitRefresh
		&&viewStateEvents.at(-1).reason==="refresh",
		"refreshView preserves the active key and search while re-sorting and re-rendering the current view");
	viewTable._searchInput.value="";
	viewTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	viewButtons[0].click();
	viewTable._headerTr.cells[0].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(viewTable._filteredData.map(row=>row.name).join(",")==="Alpha,Beta",
		"ordinary main sorting applies to the selected view");
	viewTable.selectCell(viewRows[0],"name");
	viewRows[1].active=false;
	viewTable._queueDataCommit(viewTable._makeCallbackPayload(null,{
		data:viewRows[1],changes:{active:false},mode:"update",
	},{schemaNode:viewTable._colSchemaNodes[1],rowData:viewRows[1],mainIndex:0}),null);
	assert(viewTable._filteredData.length===1&&viewTable._filteredData[0]===viewRows[0]
		&&viewTable._sortingCols[0]?.index===0&&viewTable._cellCursorDataObj===viewRows[0]
		&&viewStateEvents.at(-1).reason==="commit",
		"an accepted main commit refreshes membership while preserving sorting and a surviving logical selection");
	const draft=viewTable.insertNewRow({name:"Draft",active:false},{highlight:false,prepend:true});
	assert(viewTable._viewData.includes(draft)&&viewTable._filteredData.includes(draft)
		&&viewTable.getViewState().counts.source===3&&viewTable.getViewState().counts.view===1
		&&viewTable.getViewState().counts.filtered===1
		&&viewTable.getViewState().counts.visible.source===4
		&&viewTable.getViewState().counts.visible.view===2
		&&viewTable.getViewState().counts.visible.filtered===2,
		"a main-row draft stays editable and appears in visible counts without changing committed counts");
	viewTable.setViewMode("all");
	viewTable.setViewMode("default");
	assert(viewTable._filteredData.includes(draft),
		"an uncommitted row remains in the view where it was created after switching away and back");
	viewTable._queueDataCommit(viewTable._makeCallbackPayload(null,{
		data:draft,changes:null,mode:"create",
	},{schemaNode:viewTable._colSchemaNodes[0],rowData:draft,
		mainIndex:viewTable._filteredData.indexOf(draft)}),null);
	assert(!viewTable._filteredData.includes(draft)&&viewTable.getViewState().counts.source===4
		&&viewTable.getViewState().counts.view===1
		&&viewCommits.some(payload=>payload.mode==="create"&&payload.data===draft),
		"committing a draft starts counting it and removes it when it no longer belongs to its creation view");
	const emptyDraftTable=new Tablance(host(),{
		views:{default:{title:"Matching",filter:row=>row.matches===true}},
		main:{toolbar:{defaultInsert:true},columns:[{dataKey:"name",input:{type:"text"}}]},
	},true,true,{searchbar:false,ordering:false});
	const firstDraft=emptyDraftTable.insertNewRow({name:"First",matches:false},{highlight:false});
	assert(emptyDraftTable._filteredData[0]===firstDraft&&emptyDraftTable._rowMeta.get(firstDraft)?.isNew
		&&emptyDraftTable.getViewState().counts.source===0
		&&emptyDraftTable.getViewState().counts.visible.filtered===1,
		"the first draft in an empty dataset retains its creation-view metadata and is visible but uncommitted");

	const resultHost=host();
	const resultTable=new Tablance(resultHost,{
		trash:{
			isTrashed:({rowData})=>!!rowData.deleted,
			getChanges:({operation})=>({deleted:operation==="trash"}),
		},
		views:{default:{title:"Current",filter:row=>row.current},empty:{title:"Empty",filter:()=>false}},
		main:{resultStatus:true,toolbar:{
			defaultInsert:{visible:({lifecycleMode})=>lifecycleMode==="active"},
			viewSwitcher:{visible:({lifecycleMode})=>lifecycleMode==="active"},
			search:{visible:true},tableActions:[{type:"trash"}],
		},columns:[{type:"select",width:40},{dataKey:"name",input:{type:"text"}}]},
	},true,true,{lang:{
		filterPlaceholder:"Find entry",filterPlaceholderTrash:"Find trash",
		resultItemSingular:"entry",resultItemPlural:"entries",
		resultEmptyTrash:"The bin is empty.",resultEmptyView:"This view is empty.",
		resultEmptyFiltered:"Nothing matches.",
	}});
	resultTable.setData([
		{name:"Alpha",current:true,deleted:false},
		{name:"Beta",current:true,deleted:false},
		{name:"Archived",current:false,deleted:false},
	]);
	await tick();
	assert(resultTable._resultStatus.textContent==="2 entries shown"
		&&resultTable._emptyState.hidden
		&&resultTable._resultStatus.previousElementSibling===resultTable._scrollBody
		&&resultTable._scrollBody.parentElement===resultTable._tableArea
		&&getComputedStyle(resultTable._resultStatus).borderTopWidth==="1px"
		&&getComputedStyle(resultTable._resultStatus).borderTopStyle==="solid",
		"opt-in result status is a non-scrolling sibling immediately after the row viewport");
	assert(!resultTable._viewportRemainder.hidden
		&&getComputedStyle(resultTable._viewportRemainder).borderLeftWidth==="1px"
		&&getComputedStyle(resultTable._viewportRemainder).borderTopWidth==="1px"
		&&getComputedStyle(resultTable._resultStatus).borderLeftWidth==="1px"
		&&getComputedStyle(resultTable._resultStatus).borderRightWidth==="1px"
		&&Math.abs(resultTable._viewportRemainder.getBoundingClientRect().left
			-resultTable._resultStatus.getBoundingClientRect().left)<1
		&&Math.abs(resultTable._viewportRemainder.getBoundingClientRect().right
			-resultTable._resultStatus.getBoundingClientRect().right)<1
		&&Math.abs(resultTable._viewportRemainder.getBoundingClientRect().top
			-(resultTable._mainTbody.lastElementChild.getBoundingClientRect().bottom-1))<1
		&&getComputedStyle(resultTable._mainTbody.rows[0]).borderLeftWidth==="0px",
		"unused viewport shares one horizontal boundary with rows and continues through status without changing rows");
	const statusHeight=resultTable._resultStatus.offsetHeight;
	const fixedViewportHeight=resultTable._scrollBody.offsetHeight;
	assert(statusHeight>0&&Math.abs(parseFloat(resultTable._scrollBody.style.height)
		-(resultHost.clientHeight-resultTable._headerTable.offsetHeight-resultTable._toolbar.offsetHeight
			-statusHeight-resultTable._bulkEditArea.offsetHeight))<1,
		"the fixed viewport calculation reserves the result-status height before bulk edit");
	resultTable._toggleRowsSelected(true,0,0);
	await new Promise(resolve=>setTimeout(resolve,180));
	resultTable._updateViewportHeight();
	assert(resultTable._bulkEditAreaOpen&&resultTable._resultStatus.nextElementSibling==null
		&&resultTable._bulkEditArea.parentElement===resultTable.rootEl
		&&Math.abs(parseFloat(resultTable._scrollBody.style.height)
			-(resultHost.clientHeight-resultTable._headerTable.offsetHeight-resultTable._toolbar.offsetHeight
				-statusHeight-resultTable._bulkEditArea.offsetHeight))<1,
		"bulk edit reduces only the row viewport while status remains directly below it");
	resultTable._toggleRowsSelected(false,0,0);
	await new Promise(resolve=>setTimeout(resolve,180));
	resultTable._searchInput.value="Alpha";
	resultTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(resultTable._resultStatus.textContent==="1 of 2 entries shown",
		"result status uses visible filtered and view counts from the normal filter pipeline");
	resultTable._searchInput.value="missing";
	resultTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(resultTable._resultStatus.textContent==="0 of 2 entries shown"&&!resultTable._emptyState.hidden
		&&resultTable._emptyState.textContent==="Nothing matches."
		&&getComputedStyle(resultTable._emptyState).alignItems==="flex-start"
		&&resultTable._scrollBody.offsetHeight===fixedViewportHeight,
		"zero search matches use a contextual viewport empty state instead of a zero status");
	resultTable._searchInput.value="";
	resultTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	resultTable.setViewMode("empty");
	assert(resultTable._emptyState.textContent==="This view is empty."
		&&resultTable._resultStatus.textContent==="0 entries shown",
		"an empty Tablance view is distinguished from zero search matches");
	resultTable.setViewMode("default");
	const resultDraft=resultTable.insertNewRow({name:"Draft",current:false,deleted:false},{highlight:false});
	assert(resultTable._resultStatus.textContent==="3 entries shown"
		&&resultTable.getViewState().counts.view===2
		&&resultTable.getViewState().counts.visible.view===3
		&&resultTable._filteredData.includes(resultDraft),
		"a visible local draft is included in result status while committed counts stay separate");
	resultTable.setLifecycleMode("trash");
	assert(resultTable._emptyState.textContent==="The bin is empty."
		&&resultTable._resultStatus.textContent==="0 entries shown"
		&&resultTable._searchInput.placeholder==="Find trash"
		&&[...resultTable._viewSwitcher.querySelectorAll(".tablance-view-option")].every(button=>button.hidden)
		&&!resultTable._lifecycleBackButton.hidden&&resultTable._toolbarInsertButton.hidden
		&&!resultTable._searchInput.hidden,
		"trash empty state and declarative per-control visibility replace category-wide hiding");
	resultTable.setData([{name:"Deleted Alpha",current:true,deleted:true},{name:"Deleted Beta",current:true,deleted:true}]);
	assert(resultTable._resultStatus.textContent==="2 entries in trash"
		&&resultTable._emptyState.hidden,
		"trash rows use the shared lifecycle-aware result status");
	resultTable._searchInput.value="Alpha";
	resultTable._searchInput.dispatchEvent(new Event("input",{bubbles:true}));
	assert(resultTable._resultStatus.textContent==="1 of 2 entries in trash shown",
		"trash search reductions use the same visible view and filtered counts");
	assert(!resultTable._viewportRemainder.hidden
		&&getComputedStyle(resultTable._viewportRemainder).borderTopWidth==="1px"
		&&Math.abs(resultTable._viewportRemainder.getBoundingClientRect().top
			-(resultTable._mainTbody.lastElementChild.getBoundingClientRect().bottom-1))<1,
		"trash rows use the same single boundary into decorative unused viewport space as active rows");
	assert(resultTable._lifecycleBackButton.textContent==="Leave trash"
		&&resultTable._lifecycleBackButton.querySelector(".tablance-lifecycle-back-icon")
		&&resultTable._lifecycleBackButton.parentElement===resultTable._viewSwitcher
		&&resultTable._viewSwitcher.classList.contains("lifecycle-only"),
		"trash exposes a localized lifecycle return beside the ordinary view controls");
	resultTable._lifecycleBackButton.click();
	assert(resultTable.getViewState().lifecycleMode==="active"
		&&resultTable._lifecycleBackButton.hidden
		&&!resultTable._viewSwitcher.classList.contains("lifecycle-only")
		&&resultTable._searchInput.placeholder==="Find entry"
		&&[...resultTable._viewSwitcher.querySelectorAll(".tablance-view-option")].every(button=>!button.hidden),
		"the visible lifecycle return restores active rows and ordinary view controls");
	resultTable._tableMenuButton.click();
	resultTable._tableMenuState.items[0].el.click();
	assert(resultTable.getViewState().lifecycleMode==="trash"&&!resultTable._lifecycleBackButton.hidden,
		"the existing table menu remains an independent path back into trash");
	const filledResultTable=new Tablance(host(),{main:{resultStatus:true,columns:[{dataKey:"name"}]}},
		true,true,{searchbar:false,ordering:false});
	filledResultTable.setData(Array.from({length:80},(_,index)=>({name:`Row ${index}`})));
	await tick();
	assert(filledResultTable._viewportRemainder.hidden
		&&filledResultTable._scrollBody.scrollHeight>filledResultTable._scrollBody.clientHeight,
		"no decorative remainder is shown when real rows fill and scroll the viewport");
	const expandedStatusTable=new Tablance(host(),{main:{resultStatus:true,columns:[
		{type:"expand",width:36},{dataKey:"name"},
	]},details:{type:"list",entries:[{dataKey:"detail",nodeId:"expandedStatusDetail"}]}},
	true,true,{searchbar:false,ordering:false});
	expandedStatusTable.setData([{name:"Expanded",detail:"Nested"},{name:"After",detail:"Second"}]);
	await tick();
	expandedStatusTable.expandRow(0);
	await waitFor(()=>expandedStatusTable._mainTbody.querySelector("tr.details .content")?.style.height==="auto",
		"details expansion cleanup");
	const expandedLastMainRow=[...expandedStatusTable._mainTbody.querySelectorAll(":scope>tr:not(.details)")].at(-1);
	assert(!expandedStatusTable._viewportRemainder.hidden
		&&expandedStatusTable._mainTbody.querySelector("tr.details")
		&&Math.abs(expandedStatusTable._viewportRemainder.getBoundingClientRect().top
			-(expandedLastMainRow.getBoundingClientRect().bottom-1))<1,
		"expanded details share the same single boundary with remaining decorative viewport space");
	const noStatusTable=new Tablance(host(),{main:{columns:[{dataKey:"name"}]}},true,true,
		{searchbar:false,ordering:false});
	assert(!noStatusTable._resultStatus&&!noStatusTable._emptyState
		&&!noStatusTable._tableArea.classList.contains("has-result-status"),
		"tables without result-status opt-in keep their existing DOM and layout");

	const nestedRow={name:"Nested",profile:{enabled:true}};
	const nestedViewTable=new Tablance(host(),{
		views:{default:{title:"Enabled",filter:row=>row.profile.enabled},all:{title:"All",filter:()=>true}},
		main:{toolbar:{viewSwitcher:true},columns:[{dataKey:"name"}]},
		details:{type:"list",entries:[{type:"group",nodeId:"profileGroup",dataPath:"profile",entries:[
			{dataKey:"enabled",nodeId:"profileEnabled",input:{type:"text"}},
		]}]},
	},true,true,{searchbar:false,ordering:false});
	nestedViewTable.setData([nestedRow]);
	await tick();
	const profileGroup=nestedViewTable.getDetailCell(0,"profileGroup");
	nestedViewTable._openGroup(profileGroup);
	const profileEnabled=profileGroup.children[0];
	nestedRow.profile.enabled=false;
	nestedViewTable._markDirtyField(profileEnabled);
	assert(nestedViewTable._closeGroup(profileGroup)&&nestedViewTable._filteredData.length===0,
		"an accepted nested group update automatically refreshes root-row view membership");

	const repeatedCreateRow={name:"Create",items:[{value:"existing"}]};
	const repeatedCreateTable=new Tablance(host(),{
		views:{default:{title:"One item",filter:row=>row.items.length===1},all:{title:"All",filter:()=>true}},
		main:{columns:[{dataKey:"name"}]},details:{type:"list",entries:[
			{type:"repeated",dataKey:"items",nodeId:"viewItems",create:true,
				createData:()=>({value:"new"}),entry:{type:"group",entries:[
					{dataKey:"value",input:{type:"text"}},
				]}},
		]},
	},true,true,{searchbar:false,ordering:false});
	repeatedCreateTable.setData([repeatedCreateRow]);
	await tick();
	const repeatedCreate=repeatedCreateTable.getDetailCell(0,"viewItems");
	repeatedCreate.createNewEntry();
	const pendingViewEntry=repeatedCreate.children.find(child=>child.creating);
	pendingViewEntry.dataObj.value="created";
	repeatedCreateTable._markDirtyField(pendingViewEntry.children[0]);
	assert(repeatedCreateTable._closeGroup(pendingViewEntry)
		&&repeatedCreateRow.items.length===2&&repeatedCreateTable._filteredData.length===0,
		"an accepted repeated creation automatically refreshes root-row view membership");

	const repeatedUpdateRow={name:"Update",items:[{enabled:true}]};
	const repeatedUpdateTable=new Tablance(host(),{
		views:{default:{title:"Enabled item",filter:row=>row.items.some(item=>item.enabled)},
			all:{title:"All",filter:()=>true}},
		main:{columns:[{dataKey:"name"}]},details:{type:"list",entries:[
			{type:"repeated",dataKey:"items",nodeId:"updateViewItems",entry:{type:"group",entries:[
				{dataKey:"enabled",nodeId:"itemEnabled",input:{type:"text"}},
			]}},
		]},
	},true,true,{searchbar:false,ordering:false});
	repeatedUpdateTable.setData([repeatedUpdateRow]);
	await tick();
	const repeatedUpdate=repeatedUpdateTable.getDetailCell(0,"updateViewItems");
	const updatedViewEntry=repeatedUpdate.children[0];
	repeatedUpdateTable._openGroup(updatedViewEntry);
	repeatedUpdateRow.items[0].enabled=false;
	repeatedUpdateTable._markDirtyField(updatedViewEntry.children[0]);
	assert(repeatedUpdateTable._closeGroup(updatedViewEntry)&&repeatedUpdateTable._filteredData.length===0,
		"an accepted update inside repeated data automatically refreshes root-row view membership");

	const repeatedDeleteRow={name:"Delete",items:[{value:"one"},{value:"two"}]};
	const repeatedDeleteTable=new Tablance(host(),{
		views:{default:{title:"Two items",filter:row=>row.items.length===2},all:{title:"All",filter:()=>true}},
		main:{columns:[{dataKey:"name"}]},details:{type:"list",entries:[
			{type:"repeated",dataKey:"items",nodeId:"deleteViewItems",create:true,
				entry:{type:"group",entries:[{dataKey:"value",input:{type:"text"}}]}},
		]},
	},true,true,{searchbar:false,ordering:false});
	repeatedDeleteTable.setData([repeatedDeleteRow]);
	await tick();
	const repeatedDelete=repeatedDeleteTable.getDetailCell(0,"deleteViewItems");
	const deletedViewEntry=repeatedDelete.children.find(child=>!child.schemaNode.creator);
	assert(repeatedDeleteTable._repeatedOnDelete({instanceNode:{parent:{parent:deletedViewEntry}}})===true
		&&repeatedDeleteRow.items.length===1&&repeatedDeleteTable._filteredData.length===0,
		"an accepted repeated deletion automatically refreshes root-row view membership");

	let richHelpPayload,repeatedHelpPayload;
	const helpRows=[{plain:"Plain",rich:"Rich",without:"No help",detail:"Detail",
		detailWithoutHelp:"No detail help",line:"Line",
		items:[{name:"Repeated item"}]}];
	const helpTable=new Tablance(host(),{
		help:"General table help",
		main:{toolbar:{items:[{input:{type:"button",text:"Action"}}]},columns:[
			{dataKey:"plain",title:"<b>Plain title</b>",help:"<img src=x onerror=alert(1)>"},
			{dataKey:"rich",title:"<em>Trusted title</em>",titleHtml:true,help:payload=>{
				richHelpPayload=payload;
				const fragment=document.createDocumentFragment();
				const link=fragment.appendChild(document.createElement("a"));
				link.href="#help-target";
				link.textContent="Rich link";
				fragment.appendChild(document.createElement("img")).alt="Help image";
				return fragment;
			}},
			{dataKey:"without",title:"Without help"},
		]},
		details:{type:"list",entries:[
			{title:"Detail help",dataKey:"detail",nodeId:"helpDetail",help:"Detail explanation"},
			{title:"Detail without help",dataKey:"detailWithoutHelp",nodeId:"detailWithoutHelp"},
			{type:"group",title:"Group help",nodeId:"helpGroup",help:"Group explanation",entries:[
				{type:"lineup",entries:[
					{title:"Line help",dataKey:"line",nodeId:"helpLine",help:"Line explanation",
						render:({value})=>`Displayed ${value}`,input:{type:"text"}},
				]},
				{type:"repeated",title:"Repeated help",help:"Repeated explanation",dataKey:"items",
					entry:{type:"group",closedRender:item=>item.name,entries:[
						{title:"Repeated field",dataKey:"name",nodeId:"helpRepeatedField",help:payload=>{
							repeatedHelpPayload=payload;
							return "Repeated field explanation";
						}},
					]}},
			]},
		]},
	},true,true,{searchbar:false});
	helpTable.setData(helpRows);
	await tick();
	const helpHeaders=[...helpTable._headerTr.cells];
	const tableHelp=helpTable._headerTr.lastElementChild.querySelector(".table-help-trigger");
	const plainHeaderTitle=helpHeaders[0].querySelector(".tablance-main-header-title");
	assert(helpHeaders[0].textContent.includes("<b>Plain title</b>")&&!helpHeaders[0].querySelector("b")
		&&helpHeaders[1].querySelector("em")?.textContent==="Trusted title",
		"ordinary titles render as text while titleHtml remains an explicit trusted opt-in");
	assert(!helpHeaders.slice(0,-1).some(header=>header.querySelector(".tablance-help-trigger"))
		&&!helpTable._toolbar.querySelector(".tablance-help-trigger")&&tableHelp?.tabIndex===0,
		"main columns have no help icon and common help occupies the right edge of the main header row");
	const tableHelpRect=tableHelp.getBoundingClientRect();
	const helpHeaderRect=helpTable._headerTable.getBoundingClientRect();
	const tableHelpRightInset=helpHeaderRect.right-tableHelpRect.right;
	assert(tableHelpRect.width===20&&tableHelpRightInset>=9&&tableHelpRightInset<=11,
		"the common help trigger has a usable hitbox with ten pixels of breathing room at the header edge");
	tableHelp.focus();
	assert(helpTable._helpState?.trigger===tableHelp&&!helpTable._helpState.pinned,
		"keyboard focus exposes table help immediately without the pointer hover delay");
	helpTable._closeHelp();
	tableHelp.blur();
	tableHelp.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,220));
	assert(!helpTable._helpState,"contextual help does not open before the shared hover delay");
	tableHelp.dispatchEvent(new MouseEvent("mouseleave"));
	await new Promise(resolve=>setTimeout(resolve,160));
	assert(!helpTable._helpState,"leaving a help icon before the delay fully cancels its pending open");
	tableHelp.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,370));
	const tableHelpSections=[...helpTable._helpPopover.querySelectorAll(".tablance-table-help-section")];
	assert(helpTable._helpPopover.querySelector(".tablance-table-help-introduction")?.textContent
		==="General table help"&&tableHelpSections.length===2
		&&tableHelpSections[0].querySelector("h3").textContent==="<b>Plain title</b>"
		&&tableHelpSections[0].textContent.includes("<img src=x onerror=alert(1)>")
		&&!tableHelpSections[0].querySelector("img")
		&&tableHelpSections[1].querySelector("h3").textContent==="Trusted title"
		&&tableHelpSections[1].querySelector("a")?.textContent==="Rich link"
		&&tableHelpSections[1].querySelector("img")?.alt==="Help image"
		&&!helpTable._helpPopover.textContent.includes("Detail explanation")
		&&richHelpPayload.instanceNode==null&&richHelpPayload.rowData===undefined
		&&!helpTable._helpState.pinned,
		"common header help safely combines schema.help and titled main-column help while excluding details");
	const fittingHelpRect=helpTable._helpPopover.getBoundingClientRect();
	assert(helpTable._helpPopover.scrollHeight<=helpTable._helpPopover.clientHeight+1
		&&fittingHelpRect.height<innerHeight-16&&fittingHelpRect.top>=8
		&&fittingHelpRect.bottom<=innerHeight-8,
		"help content that fits uses its natural height without an internal scrollbar");
	tableHelp.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(helpTable._helpState.pinned&&tableHelp.getAttribute("aria-expanded")==="true"
		&&!helpTable._sortingCols.length,
		"clicking the main-header table-help trigger pins the shared popover without sorting");
	document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));
	assert(!helpTable._helpState&&tableHelp.getAttribute("aria-expanded")==="false",
		"an outside click closes pinned help without adding a separate overlay interaction layer");
	helpTable._schema.help=Array.from({length:100},(_,index)=>`Long help line ${index+1}`).join("\n");
	tableHelp.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,370));
	const overflowingHelpRect=helpTable._helpPopover.getBoundingClientRect();
	assert(helpTable._helpPopover.scrollHeight>helpTable._helpPopover.clientHeight
		&&overflowingHelpRect.height<=innerHeight-16&&overflowingHelpRect.top>=8
		&&overflowingHelpRect.bottom<=innerHeight-8,
		"help content taller than the viewport is constrained with internal scrolling and edge margins");
	helpTable._closeHelp();
	helpTable._schema.help="General table help";
	const noToolbarHelpTable=new Tablance(host(),{help:"Unavailable without a toolbar",
		main:{columns:[{title:"Value",dataKey:"value",help:"Column help"}]}},true,true,{searchbar:false});
	noToolbarHelpTable.setData([{value:"value"}]);
	await tick();
	assert(!noToolbarHelpTable._toolbar
		&&noToolbarHelpTable._headerTr.lastElementChild.querySelector(".table-help-trigger"),
		"table or column help uses the main header without creating an otherwise absent toolbar");
	const columnsOnlyHelpTable=new Tablance(host(),{main:{columns:[
		{title:"Column only",dataKey:"value",help:"Only column help"},
		{title:"Excluded",dataKey:"other"},
	]}},true,true,{ordering:false});
	columnsOnlyHelpTable.setData([{value:"value",other:"other"}]);
	await tick();
	const columnsOnlyTableHelp=columnsOnlyHelpTable._headerTr.lastElementChild
		.querySelector(".table-help-trigger");
	columnsOnlyTableHelp.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,370));
	assert(!columnsOnlyHelpTable._helpPopover.querySelector(".tablance-table-help-introduction")
		&&columnsOnlyHelpTable._helpPopover.querySelectorAll(".tablance-table-help-section").length===1
		&&columnsOnlyHelpTable._helpPopover.querySelector("h3").textContent==="Column only"
		&&columnsOnlyHelpTable._helpPopover.textContent.includes("Only column help")
		&&!columnsOnlyHelpTable._helpPopover.textContent.includes("Excluded"),
		"common header help aggregates main-column help even when schema.help is absent");
	columnsOnlyHelpTable._closeHelp();
	helpTable.selectCell(helpRows[0],"plain");
	const helpF1=key(helpTable.rootEl,"F1","F1");
	assert(helpF1.defaultPrevented&&helpTable._helpState?.pinned
		&&helpTable._helpPopover.textContent==="<img src=x onerror=alert(1)>"
		&&!helpTable._helpPopover.querySelector("img")
		&&helpTable._helpState.trigger===helpTable._selectedCell,
		"F1 pins the selected main cell's own safe column help without a header trigger");
	const helpEscape=key(helpTable.rootEl,"Escape","Escape");
	assert(helpEscape.defaultPrevented&&!helpTable._helpState,
		"Escape closes pinned help before Tablance applies any ordinary Escape behavior");
	helpTable.selectCell(helpRows[0],"without");
	const noHelpF1=key(helpTable.rootEl,"F1","F1");
	assert(!noHelpF1.defaultPrevented&&!helpTable._helpState,
		"F1 is left completely unhandled when the selected cell has no help");
	helpTable.selectCell(helpRows[0],"rich");
	const richHelpF1=key(helpTable.rootEl,"F1","F1");
	assert(helpTable._helpPopover.querySelector("a")?.textContent==="Rich link"
		&&helpTable._helpPopover.querySelector("img")?.alt==="Help image"
		&&richHelpPayload.instanceNode==null&&richHelpPayload.rowData===helpRows[0]
		&&richHelpF1.defaultPrevented,
		"main-cell F1 evaluates the same rich column help with selected-row context");
	helpTable._closeHelp();
	plainHeaderTitle.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,480));
	assert(!helpTable._helpState,
		"main-column title hover does not open help before its short delay has elapsed");
	await new Promise(resolve=>setTimeout(resolve,150));
	assert(helpTable._helpPopover.textContent==="<img src=x onerror=alert(1)>"
		&&!helpTable._helpState.pinned&&helpTable._helpState.trigger===plainHeaderTitle,
		"main-column title hover opens the column's own safe help after about 600 ms");
	plainHeaderTitle.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(helpTable._sortingCols[0]?.index===0,
		"column-title help listeners do not prevent or replace ordinary header sorting clicks");
	plainHeaderTitle.dispatchEvent(new MouseEvent("mouseleave"));
	helpTable._helpPopover.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,140));
	assert(!!helpTable._helpState,"moving from a column header into its popover keeps transient help open");
	helpTable._helpPopover.dispatchEvent(new MouseEvent("mouseleave"));
	await new Promise(resolve=>setTimeout(resolve,140));
	assert(!helpTable._helpState,"transient help closes after leaving both trigger and popover");
	const helpGroup=helpTable.getDetailCell(helpRows[0],"helpGroup");
	const helpDetail=helpTable.getDetailCell(helpRows[0],"helpDetail");
	const detailWithoutHelp=helpTable.getDetailCell(helpRows[0],"detailWithoutHelp");
	const helpDetailSlot=helpDetail.helpTriggerEl?.closest(".tablance-help-slot");
	const emptyDetailSlot=detailWithoutHelp.outerContainerEl.querySelector(".tablance-help-slot");
	const helpDetailLayout=helpDetailSlot?.closest(".tablance-title-layout");
	const helpDetailText=helpDetailLayout?.querySelector(".tablance-title-text");
	const detailTextRect=helpDetailText?.getBoundingClientRect();
	const detailLayoutRect=helpDetailLayout?.getBoundingClientRect();
	const detailHelpRect=helpDetail.helpTriggerEl.getBoundingClientRect();
	assert(helpDetailSlot?.closest("td.title")&&helpDetail.helpTriggerEl.tabIndex===-1
		&&emptyDetailSlot&&!emptyDetailSlot.children.length
		&&getComputedStyle(helpDetailSlot).width===getComputedStyle(emptyDetailSlot).width,
		"detail titles retain the same compact non-navigable help slot with or without help");
	assert(getComputedStyle(helpDetailSlot).position==="absolute"
		&&Math.abs(detailLayoutRect.height-detailTextRect.height)<1,
		"the help slot does not contribute to the one-line label block's natural height");
	const helpDetailRowHeight=helpDetail.outerContainerEl.getBoundingClientRect().height;
	helpDetailSlot.style.display="none";
	const noHelpDetailRowHeight=helpDetail.outerContainerEl.getBoundingClientRect().height;
	helpDetailSlot.style.removeProperty("display");
	assert(Math.abs(helpDetailRowHeight-noHelpDetailRowHeight)<1,
		"a detail row keeps exactly the same natural height when its out-of-flow help slot is present");
	assert(Math.abs((detailTextRect.top+detailTextRect.bottom)/2-(detailHelpRect.top+detailHelpRect.bottom)/2)<1,
		"one-line detail help remains centered against its label text");
	const groupTitleLayout=helpGroup.helpTriggerEl.closest(".tablance-title-layout");
	const groupTitleText=groupTitleLayout.querySelector(".tablance-title-text");
	groupTitleText.style.width="42px";
	groupTitleText.style.lineHeight="14px";
	const groupTitleTextRect=groupTitleText.getBoundingClientRect();
	const groupTitleLayoutRect=groupTitleLayout.getBoundingClientRect();
	const groupHelpRect=helpGroup.helpTriggerEl.getBoundingClientRect();
	assert(groupTitleTextRect.height>14
		&&Math.abs(groupTitleLayoutRect.height-groupTitleTextRect.height)<1
		&&Math.abs((groupTitleTextRect.top+groupTitleTextRect.bottom)/2-(groupHelpRect.top+groupHelpRect.bottom)/2)<1,
		"wrapped detail help stays out of flow and centers against the complete rendered text block");
	helpDetail.select();
	const detailHelpF1=key(helpTable.rootEl,"F1","F1");
	assert(detailHelpF1.defaultPrevented&&helpTable._helpPopover.textContent==="Detail explanation",
		"F1 resolves help for an ordinary selected detail field");
	helpTable._closeHelp();
	const selectedBeforeGroupHelp=helpTable._activeDetailsCell;
	assert(helpGroup.helpTriggerEl.closest(".tablance-help-slot"),
		"group help uses the same reserved detail-title slot");
	helpGroup.helpTriggerEl.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	helpGroup.helpTriggerEl.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(helpTable._activeDetailsCell===selectedBeforeGroupHelp&&!helpGroup.el.classList.contains("open")
		&&helpTable._helpState?.pinned,
		"clicking group help neither selects nor opens the group and does not disturb the current cell");
	helpTable._closeHelp();
	helpGroup.select();
	const groupHelpF1=key(helpTable.rootEl,"F1","F1");
	assert(groupHelpF1.defaultPrevented&&helpTable._helpPopover.textContent==="Group explanation",
		"F1 resolves help for a selected group instance");
	helpTable._closeHelp();
	const helpLine=helpTable.getDetailCell(helpRows[0],"helpLine");
	helpLine.select();
	const selectedHelpTrigger=helpLine.helpTriggerEl;
	selectedHelpTrigger.scrollIntoView({block:"center"});
	await tick();
	const selectedHelpRect=selectedHelpTrigger.getBoundingClientRect();
	assert(document.elementFromPoint(selectedHelpRect.left+selectedHelpRect.width/2,
		selectedHelpRect.top+selectedHelpRect.height/2)===selectedHelpTrigger,
		"a selected inline-title detail cell keeps its help trigger above the pointer-active cell cursor");
	selectedHelpTrigger.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,370));
	assert(helpTable._helpState?.trigger===selectedHelpTrigger&&!helpTable._helpState.pinned,
		"hovering help in a selected detail cell opens the contextual popover");
	const selectedBeforeHelpClick=helpTable._activeDetailsCell;
	selectedHelpTrigger.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	selectedHelpTrigger.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(helpTable._helpState?.pinned&&helpTable._activeDetailsCell===selectedBeforeHelpClick
		&&!helpTable._inEditMode,
		"clicking help in a selected detail cell pins it without changing selection or entering edit mode");
	helpTable._closeHelp();
	const lineHelpF1=key(helpTable.rootEl,"F1","F1");
	assert(lineHelpF1.defaultPrevented&&helpTable._helpPopover.textContent==="Line explanation"
		&&helpLine.helpTriggerEl?.closest(".lineup")
		&&helpLine.helpTriggerEl.closest(".tablance-help-slot"),
		"Lineup fields expose contextual help through their ordinary title and selected instance");
	helpTable._closeHelp();
	const lineTitle=helpLine.outerContainerEl.querySelector(":scope>span.title");
	const lineTitleBefore=lineTitle.getBoundingClientRect();
	const lineValueBefore=helpLine.el.getBoundingClientRect();
	const lineCellBefore=helpLine.outerContainerEl.getBoundingClientRect();
	key(helpTable.rootEl,"Enter","Enter");
	const lineEditor=helpTable._cellCursor.querySelector("input.text-editor");
	const lineEditorRect=lineEditor.getBoundingClientRect();
	const lineCursorRect=helpTable._cellCursor.getBoundingClientRect();
	const lineTitleDuring=lineTitle.getBoundingClientRect();
	assert(lineEditor.value==="Line"&&helpLine.el.textContent==="Displayed Line"
		&&Math.abs(lineCursorRect.top-lineCellBefore.top)<1
		&&Math.abs(lineCursorRect.height-lineCellBefore.height)<1
		&&Math.abs(lineTitleDuring.top-lineTitleBefore.top)<1
		&&Math.abs(lineEditorRect.left-lineValueBefore.left)<1
		&&Math.abs(lineEditorRect.top-lineValueBefore.top)<1
		&&Math.abs(lineEditorRect.width-lineValueBefore.width)<1
		&&lineEditorRect.top>=lineTitleDuring.bottom,
		"Lineup edit keeps its title and formatted presentation stable while only the value box exposes the raw editor");
	const helpDuringEditRect=selectedHelpTrigger.getBoundingClientRect();
	assert(document.elementFromPoint(helpDuringEditRect.left+helpDuringEditRect.width/2,
		helpDuringEditRect.top+helpDuringEditRect.height/2)===selectedHelpTrigger,
		"Lineup help remains pointer-accessible in edit mode without overlapping the value editor");
	selectedHelpTrigger.dispatchEvent(new MouseEvent("mouseenter"));
	selectedHelpTrigger.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,cancelable:true}));
	selectedHelpTrigger.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(helpTable._helpState?.pinned&&helpTable._inEditMode&&document.activeElement===lineEditor,
		"clicking inline help during edit leaves the value editor and its focus intact");
	helpTable._closeHelp();
	helpTable._exitEditMode(false);
	const repeatedHelp=helpGroup.children.find(node=>node.schemaNode.type==="repeated");
	assert(!repeatedHelp.helpTriggerEl&&!helpGroup.el.textContent.includes("Repeated help"),
		"help does not introduce a new heading or navigable UI structure for transparent repeated containers");
	const repeatedField=helpTable.getDetailCell(helpRows[0],"helpRepeatedField");
	repeatedField.select();
	const repeatedFieldF1=key(helpTable.rootEl,"F1","F1");
	assert(repeatedFieldF1.defaultPrevented
		&&helpTable._helpPopover.textContent==="Repeated field explanation",
		"F1 exposes help for a field nested inside a repeated entry");
	assert(repeatedHelpPayload.instanceNode===repeatedField,
		"nested repeated help receives the stable selected instance");
	assert(repeatedHelpPayload.rowData===repeatedField.dataObj
		&&repeatedHelpPayload.rowData.name==="Repeated item",
		"nested repeated help resolves against the repeated entry's current draft data object");
	helpTable._closeHelp();
	const separateHelpTable=new Tablance(host(),{main:{columns:[
		{title:"Other",dataKey:"other",help:"Other table help"},
	]}},true,true,{searchbar:false,ordering:false});
	separateHelpTable.setData([{other:"other"}]);
	await tick();
	helpTable.selectCell(helpRows[0],"plain");
	key(helpTable.rootEl,"F1","F1");
	separateHelpTable.selectCell(0,"other");
	key(separateHelpTable.rootEl,"F1","F1");
	assert(helpTable._helpState?.pinned&&separateHelpTable._helpState?.pinned
		&&helpTable._helpPopover!==separateHelpTable._helpPopover,
		"multiple Tablance instances keep independent shared help popovers and context");
	helpTable._closeHelp();
	separateHelpTable._closeHelp();
	let changes=0,commits=0,validations=0,actions=0,buttonActions=0;
	const row={editable:"edit",computed:"source",explicit:"locked",conditional:"conditional",canEdit:true,
		disabledValue:"unavailable",isDisabled:true,action:"act",button:"button",detail:"detail rendered",
		notes:"One line",
		history:[{date:"2026-01-01",event:"Appointment"},{date:"2026-02-01",event:"Change"}],
		file:{name:"report.pdf",lastModified:"2026-08-30T10:00:00Z",size:1024,type:"application/pdf"}};
	const schema={
		onDataCommit:()=>commits++,
		main:{columns:[
			{dataKey:"editable",title:"Editable",input:{type:"text",onChange:()=>changes++}},
			{dataKey:"computed",title:"Computed",render:()=>"Rendered age: 31",readOnlyPresentation:true},
			{dataKey:"explicit",title:"Explicit",readOnly:true,input:{type:"text",validation:()=>{validations++;return true;},onChange:()=>changes++}},
			{dataKey:"conditional",title:"Conditional",editableIf:({rowData})=>rowData.canEdit,input:{type:"text"}},
			{dataKey:"disabledValue",title:"Disabled",disabledIf:({rowData})=>rowData.isDisabled,input:{type:"text"}},
			{dataKey:"action",title:"Action",onEnter:()=>actions++},
			{dataKey:"button",title:"Button",input:{type:"button",text:"Run",onClick:()=>buttonActions++}},
		]},
		details:{type:"list",entries:[
			{title:"Detail",dataKey:"detail",nodeId:"detail",render:({value})=>value.toUpperCase(),
				readOnlyPresentation:true},
			{title:"Explicit detail",dataKey:"explicit",readOnly:true,input:{type:"textarea"}},
			{title:"Notes",dataKey:"notes",nodeId:"notes",
				input:{type:"textarea",newLineShortcutHint:true}},
			{type:"group",title:"History",nodeId:"historyGroup",entries:[
				{type:"repeated",dataKey:"history",entry:{type:"group",closedRender:({date})=>date,entries:[
					{title:"Date",dataKey:"date",input:{type:"text"}},
					{title:"Event",dataKey:"event",editableIf:()=>false,input:{type:"text"}},
				]}},
			]},
			{type:"group",title:"Safe text",nodeId:"safeTextGroup",closedRender:()=>"<u>literal</u>",entries:[]},
			{type:"group",title:"Trusted HTML",nodeId:"trustedHtmlGroup",closedRenderHtml:true,
				closedRender:()=>"<u>underlined</u>",entries:[]},
			{type:"group",title:"Long summary",nodeId:"longSummaryGroup",
				closedRender:()=>"A deliberately long group summary that wraps naturally without allowing its chevron to overlap the visible content",
				entries:[]},
			{type:"group",title:"Unavailable group",nodeId:"disabledGroup",disabled:true,
				closedRender:()=>"Unavailable",entries:[]},
			{type:"group",title:"Phone numbers",nodeId:"emptyGroup",entries:[]},
			{type:"group",title:"Lazy empty group",nodeId:"lazyEmptyGroup",dataPath:"lazyEmpty",entries:[
				{title:"First",dataKey:"first",input:{type:"text"}},
				{title:"Second",dataKey:"second",input:{type:"text"}},
			]},
			{type:"group",title:"Visual hierarchy",nodeId:"visualHierarchyGroup",entries:[
				{type:"grid",columns:1,entries:[
					{type:"lineup",variant:"fields",entries:[
						{title:"Bridge field",dataKey:"detail",input:{type:"text"}},
					]},
					{type:"group",nodeId:"deepVisualGroup",closedRender:()=>"Nested preview",entries:[
						{title:"Nested first",dataKey:"editable",input:{type:"text"}},
						{title:"Nested second",dataKey:"notes",input:{type:"text"}},
					]},
				]},
			]},
			{title:"File",dataKey:"file",nodeId:"file",readOnly:true,
				input:{type:"file",onOpenFile:()=>actions++}},
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
	assert(getComputedStyle(cells[0]).paddingLeft==="14px"&&getComputedStyle(cells[0]).paddingTop==="9px"
		&&getComputedStyle(cells[1]).paddingLeft==="14px"
		&&getComputedStyle(cells[1]).paddingTop==="9px"&&getComputedStyle(cells[5]).paddingLeft==="14px"
		&&getComputedStyle(cells[5]).paddingTop==="9px"&&getComputedStyle(cells[6]).paddingLeft==="12px",
		"text-like editable, read-only, and action cells reserve permanent space for their indicator");
	table.selectCell(row,"editable");
	key(table.rootEl,"Enter","Enter");
	const textEditor=table._cellCursor.querySelector("input.text-editor");
	assert(textEditor&&getComputedStyle(textEditor).paddingLeft==="4px"
		&&getComputedStyle(table._cellCursor,"::before").content==="none",
		"a text cell editor keeps its spacing and hides the now-redundant pencil while editing");
	table._exitEditMode(false);
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

	const scrollbarHost=host();
	scrollbarHost.style.height="150px";
	const scrollbarTable=new Tablance(scrollbarHost,{main:{columns:[
		{dataKey:"a"},{dataKey:"b"},{dataKey:"c"},
	]}},true,true,{searchbar:false,ordering:false});
	const scrollbarWidthsAligned=()=>{
		const row=scrollbarTable._mainTbody.querySelector(":scope>tr:not(.details)");
		return !!row&&[...row.cells].every((cell,index)=>Math.abs(cell.getBoundingClientRect().width
			-scrollbarTable._headerTr.cells[index].getBoundingClientRect().width)<1);
	};
	const scrollbarSpacerAligned=()=>Math.abs(
		scrollbarTable._headerTr.lastElementChild.getBoundingClientRect().width
		-(scrollbarTable._scrollBody.offsetWidth-scrollbarTable._scrollBody.clientWidth))<1;
	scrollbarTable.setData([{a:"A",b:"B",c:"C"}]);
	await tick();
	await tick();
	assert(scrollbarTable._scrollBody.offsetWidth===scrollbarTable._scrollBody.clientWidth
		&&scrollbarWidthsAligned()&&scrollbarSpacerAligned(),
		"header and body share column geometry before a vertical scrollbar is needed");
	scrollbarTable.setData(Array.from({length:30},(_,index)=>({a:index,b:index,c:index})));
	await tick();
	await tick();
	assert(scrollbarTable._scrollBody.offsetWidth>scrollbarTable._scrollBody.clientWidth
		&&scrollbarWidthsAligned()&&scrollbarSpacerAligned(),
		"header geometry resynchronizes when body growth introduces a vertical scrollbar");
	scrollbarTable.setData([{a:"A",b:"B",c:"C"}]);
	await tick();
	await tick();
	assert(scrollbarTable._scrollBody.offsetWidth===scrollbarTable._scrollBody.clientWidth
		&&scrollbarWidthsAligned()&&scrollbarSpacerAligned(),
		"header geometry resynchronizes when body shrink removes the vertical scrollbar");

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

	const stateRebindHost=host();
	stateRebindHost.style.height="160px";
	const stateRebindRows=Array.from({length:80},(_entry,index)=>({value:`Row ${index}`,action:"Open"}));
	const stateRebindTable=new Tablance(stateRebindHost,{main:{columns:[
		{type:"expand",width:40},
		{type:"select",width:40},
		{title:"Action",dataKey:"action",onEnter:()=>{}},
		{title:"Value",dataKey:"value",input:{type:"text"}},
	]},details:{type:"list",entries:[{title:"Value",dataKey:"value"}]}},true,true,
	{searchbar:false,ordering:false});
	stateRebindTable.setData(stateRebindRows);
	await tick();
	assert(stateRebindTable._numRenderedRows<stateRebindRows.length,
		"state rebinding regression uses a viewport with recycled rows");
	const recycleSelectedColumn=async columnIndex=>{
		const rowBefore=stateRebindTable._mainTbody.querySelector('[data-data-row-index="0"]:not(.details)');
		stateRebindTable._selectMainTableCell(rowBefore.cells[columnIndex]);
		stateRebindTable._scrollBody.scrollTop=stateRebindTable._scrollMarginPx+stateRebindTable._rowHeight+1;
		stateRebindTable._scrollBody.dispatchEvent(new Event("scroll"));
		stateRebindTable._scrollBody.scrollTop=0;
		stateRebindTable._scrollBody.dispatchEvent(new Event("scroll"));
		return stateRebindTable._mainTbody.querySelector('[data-data-row-index="0"]:not(.details)')
			.cells[columnIndex];
	};
	const initialExpandCell=stateRebindTable._mainTbody
		.querySelector('[data-data-row-index="0"]:not(.details)').cells[0];
	const initialExpandAnchor=initialExpandCell.querySelector("a");
	const initialExpandPadding=getComputedStyle(initialExpandCell).padding;
	const initialExpandOffset=initialExpandAnchor.getBoundingClientRect().left
		-initialExpandCell.getBoundingClientRect().left;
	const reboundExpandCell=await recycleSelectedColumn(0);
	const reboundExpandOffset=reboundExpandCell.querySelector("a").getBoundingClientRect().left
		-reboundExpandCell.getBoundingClientRect().left;
	assert(!reboundExpandCell.classList.contains("action-indicator")
		&&getComputedStyle(reboundExpandCell).padding===initialExpandPadding
		&&Math.abs(reboundExpandOffset-initialExpandOffset)<.01,
		"recycling restores expand-cell state with its schema and preserves chevron padding and x-position");
	stateRebindTable._expandRow(reboundExpandCell.parentElement,false);
	const expandedExpandOffset=reboundExpandCell.querySelector("a").getBoundingClientRect().left
		-reboundExpandCell.getBoundingClientRect().left;
	assert(getComputedStyle(reboundExpandCell).padding===initialExpandPadding
		&&Math.abs(expandedExpandOffset-initialExpandOffset)<.01,
		"expanded and collapsed rows keep the same expand-chevron box geometry");
	stateRebindTable._setCellState(reboundExpandCell,stateRebindTable._getCellState(reboundExpandCell));
	assert(!reboundExpandCell.classList.contains("action-indicator"),
		"main-cell state updates infer the structural column schema when callers omit it");
	stateRebindTable._contractRow(reboundExpandCell.parentElement);
	await new Promise(resolve=>setTimeout(resolve,200));
	const reboundSelectCell=await recycleSelectedColumn(1);
	assert(!reboundSelectCell.classList.contains("action-indicator"),
		"recycling does not add a generic action indicator to structural select cells");
	const reboundActionCell=await recycleSelectedColumn(2);
	assert(reboundActionCell.classList.contains("action-indicator"),
		"recycling retains the generic indicator on ordinary text-like action fields");

	const assertVirtualCursorRecycling=async withDetails=>{
		const virtualHost=host();
		virtualHost.style.height="160px";
		const virtualRows=Array.from({length:80},(_entry,index)=>({id:index,value:`Row ${index}`}));
		const virtualSchema={main:{columns:[
			{title:"ID",dataKey:"id"},{title:"Value",dataKey:"value",input:{type:"text"}},
		]}};
		if (withDetails)
			virtualSchema.details={type:"list",entries:[{title:"Value",dataKey:"value"}]};
		const virtualTable=new Tablance(virtualHost,virtualSchema,true,true,{searchbar:false,ordering:false});
		virtualTable.setData(virtualRows);
		await tick();
		const viewportKind=withDetails?"details":"plain";
		assert(virtualTable._numRenderedRows<virtualRows.length,
			`${viewportKind} virtual cursor test uses a viewport with recycled rows`);
		const firstVirtualRow=virtualTable._mainTbody.querySelector('[data-data-row-index="0"]:not(.details)');
		virtualTable._selectMainTableCell(firstVirtualRow.cells[1]);
		key(virtualTable.rootEl,"End","End",{ctrlKey:true});
		await tick();
		assert(virtualTable._mainRowIndex===virtualRows.length-1&&virtualTable._mainColIndex===1
			&&virtualTable._selectedCell?.parentElement.dataset.dataRowIndex===String(virtualRows.length-1),
			`${viewportKind} Ctrl+End renders and selects the final virtualized row in the same column`);
		key(virtualTable.rootEl,"Home","Home",{ctrlKey:true});
		await tick();
		assert(virtualTable._mainRowIndex===0&&virtualTable._mainColIndex===1
			&&virtualTable._selectedCell?.parentElement.dataset.dataRowIndex==="0",
			`${viewportKind} Ctrl+Home renders and selects the first virtualized row in the same column`);
		const logicalRowIndex=virtualTable._mainRowIndex;
		const logicalData=virtualTable._cellCursorDataObj;
		const recycledRow=virtualTable._selectedCell.parentElement;
		const recycledCell=virtualTable._selectedCell;
		virtualTable._scrollBody.scrollTop=virtualTable._scrollMarginPx+virtualTable._rowHeight+1;
		virtualTable._scrollBody.dispatchEvent(new Event("scroll"));
		assert(Number(recycledRow.dataset.dataRowIndex)!==logicalRowIndex
			&&virtualTable._selectedCell===null&&virtualTable._cellCursor.style.display==="none"
			&&!recycledCell.classList.contains("tablance-active-cell")
			&&virtualTable._mainRowIndex===logicalRowIndex&&virtualTable._cellCursorDataObj===logicalData,
			`${viewportKind} recycled row hides the cursor without changing its logical data cell`);
		virtualTable._scrollBody.scrollTop=0;
		virtualTable._scrollBody.dispatchEvent(new Event("scroll"));
		assert(virtualTable._selectedCell===recycledCell
			&&Number(virtualTable._selectedCell.parentElement.dataset.dataRowIndex)===logicalRowIndex
			&&virtualTable._selectedCell.cellIndex===1&&virtualTable._cellCursor.style.display==="block"
			&&virtualTable._mainRowIndex===logicalRowIndex&&virtualTable._cellCursorDataObj===logicalData,
			`${viewportKind} cursor returns to exactly the same logical cell after recycling`);
	};
	await assertVirtualCursorRecycling(false);
	await assertVirtualCursorRecycling(true);

	const emptyGroupTable=new Tablance(host(),{details:{type:"list",entries:[
		{title:"Addresses",type:"group",nodeId:"addressesGroup",entries:[
			{type:"repeated",dataKey:"addresses",create:true,entry:{type:"group",entries:[]}},
		]},
	]}},true,true,{searchbar:false});
	emptyGroupTable.setData([{addresses:[]}]);
	await tick();
	const emptyGroup=emptyGroupTable.getDetailCell(0,"addressesGroup");
	const emptyGroupValueCell=emptyGroup.viewportEl.parentElement;
	emptyGroupValueCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(emptyGroup.selEl===emptyGroupValueCell&&emptyGroupTable._selectedCell===emptyGroupValueCell,
		"a list group uses its full value cell as the hit target even when its inner content is empty");

	const homeEndDetails=new Tablance(host(),{details:{type:"list",entries:[
		{title:"First",dataKey:"first",nodeId:"homeEndFirst"},
		{title:"Middle",dataKey:"middle",nodeId:"homeEndMiddle"},
		{type:"group",title:"Last group",nodeId:"homeEndGroup",entries:[
			{title:"Inner",dataKey:"inner",nodeId:"homeEndInner"},
		]},
	]}},true,true,{searchbar:false});
	homeEndDetails.setData([{first:"First",middle:"Middle",inner:"Inner"}]);
	await tick();
	const homeEndFirst=homeEndDetails.getDetailCell(0,"homeEndFirst");
	const homeEndMiddle=homeEndDetails.getDetailCell(0,"homeEndMiddle");
	const homeEndGroup=homeEndDetails.getDetailCell(0,"homeEndGroup");
	const homeEndInner=homeEndDetails.getDetailCell(0,"homeEndInner");
	homeEndMiddle.select();
	key(homeEndDetails.rootEl,"Home","Home");
	assert(homeEndDetails._activeDetailsCell===homeEndFirst,
		"Home selects the first child of the current details List");
	key(homeEndDetails.rootEl,"End","End");
	assert(homeEndDetails._activeDetailsCell===homeEndGroup,
		"End selects the last child of the current details List and treats a group as terminal");
	homeEndDetails._openGroup(homeEndGroup);
	homeEndInner.select();
	key(homeEndDetails.rootEl,"Home","Home",{ctrlKey:true});
	assert(homeEndDetails._activeDetailsCell===homeEndFirst&&!homeEndGroup.el.classList.contains("open"),
		"details Ctrl+Home starts at the details root and closes groups outside the destination path");
	homeEndDetails._openGroup(homeEndGroup);
	homeEndInner.select();
	key(homeEndDetails.rootEl,"End","End",{ctrlKey:true});
	assert(homeEndDetails._activeDetailsCell===homeEndGroup&&!homeEndGroup.el.classList.contains("open"),
		"details Ctrl+End descends from the root but never opens or descends through a group terminal");

	let deleteDecision="prevent",beforeDeleteCalls=0,afterDeleteCalls=0,deleteCommits=0;
	const repeatedRows=[{name:"keep"},{name:"candidate"}];
	const guardedDeleteTable=new Tablance(host(),{
		onDataCommit:({mode})=>mode==="delete"&&deleteCommits++,
		details:{type:"list",entries:[{type:"repeated",dataKey:"items",nodeId:"items",create:true,
			deleteAreYouSureText:"Remove this candidate?",
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
	guardedDeleteTable._openGroup(guardedEntry);
	const renderedDeleteButton=guardedEntry.el.querySelector(".delete-controls .delete button");
	const guardedDeleteInstance=guardedDeleteTable._resolvePointerDetailsInstance(
		renderedDeleteButton.closest("[data-path]"));
	const guardedDeleteControls=guardedDeleteInstance.parent.containerEl;
	const guardedDeleteButton=guardedDeleteControls.querySelector(".delete button");
	const guardedCancelButton=guardedDeleteControls.querySelector(".no button");
	const guardedConfirmButton=guardedDeleteControls.querySelector(".yes button");
	const guardedDeleteButtonStyle=getComputedStyle(guardedDeleteButton);
	const guardedDeleteIconStyle=getComputedStyle(guardedDeleteButton,"::before");
	assert(guardedDeleteButton.textContent==="Delete"
		&&guardedDeleteButtonStyle.appearance==="none"
		&&guardedDeleteButtonStyle.minHeight==="31px"
		&&guardedDeleteButtonStyle.paddingLeft==="10px"
		&&guardedDeleteButtonStyle.paddingRight==="10px"
		&&guardedDeleteButtonStyle.gap==="6px"
		&&guardedDeleteIconStyle.width==="18px"&&guardedDeleteIconStyle.height==="18px"
		&&(guardedDeleteIconStyle.maskImage!=="none"||guardedDeleteIconStyle.webkitMaskImage!=="none")
		&&(guardedDeleteIconStyle.maskImage===defaultTrashIconMask
			||guardedDeleteIconStyle.webkitMaskImage===defaultTrashIconWebkitMask)
		&&getComputedStyle(guardedDeleteControls.querySelector(".no")).display==="none"
		&&getComputedStyle(guardedDeleteControls.querySelector(".yes")).display==="none",
		"repeated entries and menu actions share the same outline trash icon primitive");
	assert(guardedDeleteInstance?.schemaNode.cssClass==="delete",
		"the rendered delete action remains bound to its logical field instance");
	guardedDeleteTable._beginDeleteRepeated({instanceNode:guardedDeleteInstance});
	assert(guardedDeleteInstance.parent.containerEl.classList.contains("delete-confirming"),
		"the restyled delete action enters the existing confirmation state");
	const guardedDeletePrompt=guardedDeleteControls.querySelector(":scope>.delete-confirmation-prompt");
	const guardedDeleteCopy=[guardedDeletePrompt.textContent,
		guardedCancelButton.textContent,guardedConfirmButton.textContent];
	assert(guardedDeleteTable.lang.deleteAreYouSure==="Delete this entry?"
		&&guardedDeleteCopy.join("|")==="Remove this candidate?|Cancel|Delete",
		`delete confirmation uses its repeated-level question override and generic action labels (${guardedDeleteCopy.join("|")})`);
	assert(getComputedStyle(guardedDeleteControls).flexWrap==="wrap"
		&&getComputedStyle(guardedDeletePrompt).display==="block"
		&&!guardedDeletePrompt.hasAttribute("data-path")
		&&getComputedStyle(guardedDeleteControls.querySelector(".no")).display==="block"
		&&getComputedStyle(guardedDeleteControls.querySelector(".no")).marginRight==="0px",
		"delete confirmation forms one responsive row with a non-navigable prompt and no positional offsets");
	assert(guardedDeleteTable._activeDetailsCell?.schemaNode.cssClass==="no"
		&&guardedDeleteTable._cellCursor.classList.contains("delete-confirmation-action")
		&&getComputedStyle(guardedDeleteTable._cellCursor).outlineStyle==="none"
		&&getComputedStyle(guardedCancelButton).outlineStyle==="solid",
		"confirmation selection belongs to the action button rather than outlining the prompt as a cell");
	assert(getComputedStyle(guardedConfirmButton).backgroundColor==="rgb(220, 38, 38)",
		"the compact confirming delete action receives explicit destructive styling");
	const guardedConfirmInstance=guardedDeleteTable._resolvePointerDetailsInstance(
		guardedConfirmButton.closest("[data-path]"));
	let escapedDeleteKeyBubbled=false;
	const observeEscapedDeleteKey=()=>escapedDeleteKeyBubbled=true;
	document.addEventListener("keydown",observeEscapedDeleteKey);
	const cancelSelectedEscape=key(guardedDeleteTable.rootEl,"Escape","Escape");
	document.removeEventListener("keydown",observeEscapedDeleteKey);
	assert(cancelSelectedEscape.defaultPrevented&&!escapedDeleteKeyBubbled
		&&!guardedDeleteControls.classList.contains("delete-confirming")
		&&guardedEntry.el.classList.contains("open"),
		"Escape on the selected cancel action consumes the key and cancels only delete confirmation");
	guardedDeleteTable._beginDeleteRepeated({instanceNode:guardedDeleteInstance});
	guardedDeleteTable._selectDetailsCell(guardedConfirmInstance);
	const confirmSelectedEscape=key(guardedDeleteTable.rootEl,"Escape","Escape");
	assert(confirmSelectedEscape.defaultPrevented
		&&!guardedDeleteControls.classList.contains("delete-confirming")
		&&guardedEntry.el.classList.contains("open")
		&&guardedDeleteTable._activeDetailsCell===guardedDeleteInstance,
		"Escape on the selected confirming action has the same cancel semantics and leaves the entry open");
	key(guardedDeleteTable.rootEl,"Escape","Escape");
	assert(!guardedEntry.el.classList.contains("open")&&guardedDeleteTable._activeDetailsCell===guardedEntry,
		"a separate subsequent Escape resumes the existing group-close behavior");
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

	const sortedBacking=[{id:1,order:30,label:"thirty"},{id:2,order:10,label:"ten"},
		{id:3,order:20,label:"twenty"}];
	const sortedCommits=[];
	let sortedCreatePayload,sortedDeletePayload,sortedDeleteLifecycleCalls=0,sortedCreateCancelCalls=0;
	let cancelSortedCreate=false,compareContextValid=true;
	const sortedIdentityTable=new Tablance(host(),{
		onDataCommit:payload=>sortedCommits.push(payload),main:{columns:[{dataKey:"title"}]},
		details:{type:"list",entries:[
			{type:"repeated",dataKey:"items",nodeId:"sortedItems",create:true,
				createData:()=>({order:7,label:"new"}),
				onCreate:payload=>{
					sortedCreatePayload=payload;
					if (cancelSortedCreate)
						payload.cancelCreate();
				},
				onCreateCancel:()=>sortedCreateCancelCalls++,
				sortCompare:(a,b,rowData,instanceNode)=>{
					compareContextValid&&=rowData?.items===sortedBacking
						&&instanceNode?.schemaNode?.nodeId==="sortedItems";
					return a.order-b.order;
				},
				beforeDelete:payload=>sortedDeletePayload=payload,
				onDelete:()=>sortedDeleteLifecycleCalls++,entry:{type:"group",entries:[
					{title:"Order",dataKey:"order",nodeId:"sortedOrder",input:{type:"text"}},
					{title:"Label",dataKey:"label",input:{type:"text"}},
					{title:"Collection state",dataKey:"state",dependsOn:"sortedItems",
						visibleIf:({dependedValue})=>dependedValue.length<3,
						render:({dependedValue})=>dependedValue.map(item=>item.order).join(",")},
					{title:"Collection edit",dataKey:"collectionEdit",dependsOn:"sortedItems",
						editableIf:({dependedValue})=>dependedValue.length<3,input:{type:"text"}},
				]}},
		]},
	},true,true,{searchbar:false});
	sortedIdentityTable.setData([{title:"Sorted",items:sortedBacking}]);
	await tick();
	const sortedRepeated=sortedIdentityTable.getDetailCell(0,"sortedItems");
	const visualEntries=()=>sortedRepeated.children.filter(child=>!child.schemaNode.creator);
	assert(JSON.stringify(visualEntries().map(entry=>entry.dataObj.id))===JSON.stringify([2,3,1])
		&&JSON.stringify(sortedBacking.map(entry=>entry.id))===JSON.stringify([1,2,3])&&compareContextValid,
		"sortCompare creates a visual order without mutating backing-array order and receives full context");
	assert(!sortedRepeated.children.find(entry=>entry.schemaNode.creator).outerContainerEl
		.classList.contains("grouped-repeated-creator"),
		"an ungrouped repeated creator does not receive grouped separation styling");
	const sortedCandidate=visualEntries()[1];
	assert(sortedCandidate.dataObj.id===3&&sortedCandidate.index===1,
		"the deletion candidate can have a visual index different from its backing-array index");
	sortedCandidate.children[0].select();
	const sortedDeleteControl={parent:{parent:sortedCandidate}};
	assert(sortedIdentityTable._repeatedOnDelete({instanceNode:sortedDeleteControl})===true
		&&JSON.stringify(sortedBacking.map(entry=>entry.id))===JSON.stringify([1,2])
		&&sortedDeletePayload.deletedDataItem.id===3&&sortedDeletePayload.itemIndex===2
		&&sortedDeletePayload.visualIndex===1
		&&JSON.stringify(sortedDeletePayload.remainingData.map(entry=>entry.id))===JSON.stringify([1,2])
		&&sortedCommits.filter(payload=>payload.mode==="delete").length===1
		&&sortedCommits.find(payload=>payload.mode==="delete").data.id===3
		&&sortedDeleteLifecycleCalls===1,
		"sorted deletion mutates, validates, and persists exactly once by object identity");
	const identityOne=visualEntries().find(entry=>entry.dataObj.id===1);
	const identityOneElement=identityOne.outerContainerEl;
	const identityOneOrder=identityOne.children[0];
	identityOneOrder.select();
	identityOne.dataObj.order=5;
	sortedIdentityTable._markDirtyField(identityOneOrder);
	assert(sortedIdentityTable._closeGroup(identityOne)
		&&visualEntries()[0]===identityOne&&identityOne.outerContainerEl===identityOneElement
		&&sortedIdentityTable._activeDetailsCell===identityOneOrder
		&&JSON.stringify(sortedBacking.map(entry=>entry.id))===JSON.stringify([1,2]),
		"accepted sort-key updates move the existing instance and DOM without changing identity, "
			+"focus, or backing order");
	const collectionState=visualEntries().find(entry=>entry.dataObj.id===2).children[2];
	const collectionEdit=visualEntries().find(entry=>entry.dataObj.id===2).children[3];
	assert(!collectionState.hidden&&collectionState.el.textContent==="5,10"
		&&collectionEdit.cellState.kind==="editable",
		"a committed repeated mutation natively refreshes cross-entry visibility, rendering, and editability");
	sortedRepeated.createNewEntry();
	const pendingSortedEntry=sortedRepeated.children.find(entry=>entry.creating);
	const pendingSortedElement=pendingSortedEntry.outerContainerEl;
	pendingSortedEntry.dataObj.label="created";
	sortedIdentityTable._markDirtyField(pendingSortedEntry.children[1]);
	assert(!collectionState.hidden&&collectionEdit.cellState.kind==="editable"
		&&JSON.stringify(sortedBacking.map(entry=>entry.id))===JSON.stringify([1,2]),
		"an open repeated draft neither mutates backing data nor invalidates committed collection dependents");
	assert(sortedIdentityTable._closeGroup(pendingSortedEntry)
		&&JSON.stringify(sortedBacking.map(entry=>entry.id??"new"))===JSON.stringify([1,2,"new"])
		&&visualEntries()[1]===pendingSortedEntry&&pendingSortedEntry.outerContainerEl===pendingSortedElement
		&&sortedCreatePayload.itemIndex===2&&sortedCreatePayload.visualIndex===2
		&&collectionState.hidden&&collectionEdit.cellState.kind==="readOnly",
		"accepted creation appends to backing data, sorts the existing instance visually, "
			+"and invalidates collection dependents");
	const identityOneLabel=identityOne.children[1];
	identityOneLabel.select();
	sortedIdentityTable.updateData(sortedIdentityTable._filteredData[0],"items[0].order",50);
	assert(visualEntries().at(-1)===identityOne&&identityOne.el.classList.contains("open")
		&&sortedIdentityTable._activeDetailsCell===identityOneLabel&&identityOne.outerContainerEl===identityOneElement,
		"external re-sorting moves DOM without losing an open group or its active field");
	sortedIdentityTable.updateData(sortedIdentityTable._filteredData[0],"items[1].order",1);
	assert(sortedBacking[1].id===2&&sortedBacking[1].order===1&&visualEntries()[0].dataObj.id===2
		&&JSON.stringify(sortedBacking.map(entry=>entry.id??"new"))===JSON.stringify([1,2,"new"]),
		"updateData addresses a backing-array index by object identity and then re-sorts only the presentation");
	const createCommitsBeforeCancel=sortedCommits.filter(payload=>payload.mode==="create").length;
	cancelSortedCreate=true;
	sortedRepeated.createNewEntry();
	const cancelledSortedEntry=sortedRepeated.children.find(entry=>entry.creating);
	cancelledSortedEntry.dataObj.label="cancelled";
	sortedIdentityTable._markDirtyField(cancelledSortedEntry.children[1]);
	assert(sortedIdentityTable._closeGroup(cancelledSortedEntry)===false
		&&!sortedRepeated.children.includes(cancelledSortedEntry)&&sortedCreateCancelCalls===1
		&&sortedCommits.filter(payload=>payload.mode==="create").length===createCommitsBeforeCancel
		&&JSON.stringify(sortedBacking.map(entry=>entry.id??"new"))===JSON.stringify([1,2,"new"]),
		"cancelCreate removes the pending object and instance without persistence or backing-array residue");

	const groupedBacking=[
		{id:"b-2",kind:"b",order:2,label:"B two"},
		{id:"a-3",kind:"a",order:3,label:"A three"},
		{id:"y-1",kind:"y",order:1,label:"Y one"},
		{id:"x-1",kind:"x",order:1,label:"X one"},
		{id:"a-1",kind:"a",order:1,label:"A one"},
		{id:"b-hidden",kind:"b",order:1,label:"Hidden",visible:false},
	];
	let groupedCompareOnlyWithinGroups=true;
	const groupedTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
		{type:"repeated",dataKey:"items",nodeId:"groupedItems",create:true,
			createData:()=>({kind:"a",order:0,label:"Draft"}),
			grouping:{by:"kind",order:[{key:"a",title:"Alpha",description:"Newest first"},
				{key:"b",title:"Beta"},
				{key:"empty",title:"Empty"}]},
			sortCompare:(a,b)=>{
				groupedCompareOnlyWithinGroups&&=a.kind===b.kind;
				return a.order-b.order;
			},entry:{type:"group",visibleIf:({rowData})=>rowData.visible!==false,
				closedRender:({label})=>label,entries:[
					{title:"Kind",dataKey:"kind",input:{type:"text"}},
					{title:"Order",dataKey:"order",input:{type:"text"}},
					{title:"Label",dataKey:"label",input:{type:"text"}},
				]}},
	]}},true,true,{searchbar:false});
	groupedTable.setData([{title:"Grouped",items:groupedBacking}]);
	await tick();
	const groupedRepeated=groupedTable.getDetailCell(0,"groupedItems");
	const groupedEntries=()=>groupedRepeated.children.filter(child=>!child.schemaNode.creator);
	const groupedHeadings=()=>[...groupedRepeated.parent.containerEl.querySelectorAll(":scope>.repeated-group-heading")];
	const groupedSpacers=()=>[...groupedRepeated.parent.containerEl.querySelectorAll(":scope>.repeated-group-spacer")];
	const initialGroupedCreator=groupedRepeated.children.find(entry=>entry.schemaNode.creator);
	assert(JSON.stringify(groupedEntries().map(entry=>entry.dataObj.id))
		===JSON.stringify(["a-1","a-3","b-hidden","b-2","y-1","x-1"])
		&&JSON.stringify(groupedBacking.map(entry=>entry.id))
		===JSON.stringify(["b-2","a-3","y-1","x-1","a-1","b-hidden"])
		&&groupedCompareOnlyWithinGroups,
		"grouping orders groups independently from within-group sorting without mutating backing identity");
	assert(JSON.stringify(groupedHeadings().map(heading=>heading.querySelector(".repeated-group-title").textContent))
		===JSON.stringify(["Alpha","Beta","y","x"])
		&&groupedHeadings().every(heading=>heading.getAttribute("aria-hidden")==="true"
			&&!heading.hasAttribute("data-path")
			&&heading.querySelector(":scope>td>.repeated-group-title")
			&&!heading.querySelector(".repeated-group-frame"))
		&&groupedHeadings()[0].querySelector(".repeated-group-description")?.textContent==="Newest first"
		&&groupedHeadings()[0].classList.contains("repeated-group-heading-with-description")
		&&getComputedStyle(groupedHeadings()[0].querySelector(".repeated-group-description")).display==="block",
		"declared groups render descriptions beneath non-navigable headings while empty groups stay hidden");
	await tick();
	const groupedCollectionRect=groupedRepeated.parent.containerEl.getBoundingClientRect();
	const initialGroupHeadingRects=groupedHeadings().map(heading=>heading.getBoundingClientRect());
	const initialVisibleGroupedEntries=groupedEntries().filter(entry=>!entry.hidden);
	assert(initialVisibleGroupedEntries.every(entry=>entry.outerContainerEl.classList.contains("repeated-group-entry"))
		&&groupedEntries().find(entry=>entry.dataObj.id==="a-1").outerContainerEl.classList.contains("repeated-group-first")
		&&groupedEntries().find(entry=>entry.dataObj.id==="b-2").outerContainerEl.classList.contains("repeated-group-first")
		&&!groupedEntries().find(entry=>entry.dataObj.id==="b-hidden").outerContainerEl.classList.contains("repeated-group-entry")
		&&initialVisibleGroupedEntries.every(entry=>parseFloat(getComputedStyle(entry.outerContainerEl.cells[0]).paddingLeft)===24)
		&&groupedSpacers().length===4
		&&groupedSpacers().every(spacer=>spacer.getAttribute("aria-hidden")==="true"
			&&!spacer.hasAttribute("data-path")&&spacer.getBoundingClientRect().height===8)
		&&initialGroupHeadingRects.every(rect=>rect.left===groupedCollectionRect.left),
		"each visible group keeps its heading at the repeated baseline while indentation and spacing remain presentational");
	assert(initialGroupedCreator.outerContainerEl.classList.contains("grouped-repeated-creator")
		&&parseFloat(getComputedStyle(initialGroupedCreator.outerContainerEl.cells[0]).paddingTop)>0
		&&parseFloat(getComputedStyle(initialGroupedCreator.outerContainerEl.cells[0]).paddingLeft)===10
		&&parseFloat(getComputedStyle(initialGroupedCreator.outerContainerEl.cells[0]).paddingBottom)>0,
		"a grouped creator remains at the repeated baseline with breathing room below it");
	const groupedIdentity=groupedEntries().find(entry=>entry.dataObj.id==="a-3");
	const groupedIdentityElement=groupedIdentity.outerContainerEl;
	const groupedKind=groupedIdentity.children[0];
	groupedTable._openGroup(groupedIdentity);
	await tick();
	const openGroupedEntry=groupedIdentity.el.getBoundingClientRect();
	assert(openGroupedEntry.left>groupedCollectionRect.left
		&&groupedSpacers().every(spacer=>spacer.getBoundingClientRect().height>0),
		"an open grouped entry uses the indented content width without absorbing inter-group spacing into its row");
	groupedIdentity.dataObj.kind="b";
	groupedTable._markDirtyField(groupedKind);
	assert(groupedTable._closeGroup(groupedIdentity)
		&&groupedIdentity.outerContainerEl===groupedIdentityElement
		&&JSON.stringify(groupedEntries().map(entry=>entry.dataObj.id))
			===JSON.stringify(["a-1","b-hidden","b-2","a-3","y-1","x-1"]),
		"committing a changed group key moves the existing instance and DOM without replacing its identity");
	const externalGroupedIdentity=groupedEntries().find(entry=>entry.dataObj.id==="b-2");
	const externalGroupedElement=externalGroupedIdentity.outerContainerEl;
	groupedTable.updateData(groupedTable._filteredData[0],"items[0].kind","a");
	assert(externalGroupedIdentity.outerContainerEl===externalGroupedElement
		&&JSON.stringify(groupedEntries().map(entry=>entry.dataObj.id))
			===JSON.stringify(["a-1","b-2","b-hidden","a-3","y-1","x-1"]),
		"updateData regroups the existing instance by backing-array identity");
	groupedIdentity.dataObj.visible=false;
	groupedTable._applyVisibleIf(groupedIdentity,0);
	assert(!groupedHeadings().some(heading=>heading.textContent==="Beta"),
		"a group with only hidden entries has no heading");
	groupedIdentity.dataObj.visible=true;
	groupedTable._applyVisibleIf(groupedIdentity,0);
	assert(groupedHeadings().some(heading=>heading.textContent==="Beta"),
		"a heading returns when a grouped entry becomes visible again");
	groupedRepeated.createNewEntry();
	const groupedDraft=groupedRepeated.children.find(entry=>entry.creating);
	const groupedCreator=groupedRepeated.children.find(entry=>entry.schemaNode.creator);
	groupedTable._finalizeRepeatedMutation(groupedRepeated);
	assert(groupedRepeated.children.indexOf(groupedDraft)===groupedRepeated.children.indexOf(groupedCreator)-1,
		"an open create draft stays at the creation position through refresh instead of jumping into its eventual group");
	groupedDraft.dataObj.label="Created";
	groupedTable._markDirtyField(groupedDraft.children[2]);
	assert(groupedTable._closeGroup(groupedDraft)&&groupedEntries()[0]===groupedDraft
		&&groupedBacking.at(-1)===groupedDraft.dataObj,
		"a committed draft joins its group and sorts visually while remaining appended in backing data");
	const callbackGrouping=groupedTable._getRepeatedGrouping({schemaNode:{grouping:{
		by:(data,rowData,instanceNode)=>`${rowData.title}:${data.kind}:${instanceNode.schemaNode.nodeId}`,
	}}});
	assert(groupedTable._getRepeatedGroupKey(callbackGrouping,groupedEntries()[0],
		{title:"row"},groupedRepeated)==="row:a:groupedItems",
		"grouping.by callbacks receive entry data, root row data, and the stable repeated instance");
	const unknownEntry=groupedEntries().find(entry=>entry.dataObj.id==="x-1");
	assert(groupedTable._repeatedOnDelete({instanceNode:{parent:{parent:unknownEntry}}})===true
		&&!groupedHeadings().some(heading=>heading.textContent==="x"),
		"deleting the final visible entry removes its now-empty group heading");

	const previewBacking=[
		{id:"a-hidden",kind:"a",order:0,label:"Hidden Alpha",visible:false},
		{id:"a-first",kind:"a",order:1,label:"First Alpha",visible:true},
		{id:"a-second",kind:"a",order:2,label:"Second Alpha",visible:true},
		{id:"b-first",kind:"b",order:1,label:"First Beta",visible:true},
		{id:"b-chosen",kind:"b",order:2,label:"Chosen Beta",visible:true},
		{id:"empty",kind:"empty",order:1,label:"Filtered out",visible:true},
		{id:"unknown-one",kind:"unknown",order:1,label:"Unknown one",visible:true},
		{id:"unknown-two",kind:"unknown",order:2,label:"Unknown two",visible:true},
	];
	const previewIncludeCalls=[];
	const previewRow={title:"Preview",items:previewBacking};
	const previewTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
		{type:"group",nodeId:"previewOuter",entries:[
			{type:"repeated",dataKey:"items",nodeId:"previewItems",grouping:{by:"kind",order:[
				{key:"a",title:"Alphas",preview:{title:"Alpha",maxEntries:1}},
				{key:"b",title:"Betas",preview:{title:"Beta",maxEntries:1,
					include:(data,context)=>{
						previewIncludeCalls.push({data,context});
						return data.id==="b-chosen";
					}}},
				{key:"empty",title:"Empty group",preview:{maxEntries:1,include:()=>false}},
			]},sortCompare:(a,b)=>a.order-b.order,entry:{type:"group",
				visibleIf:({rowData})=>rowData.visible!==false,closedRender:({label})=>label,
				entries:[{title:"Label",dataKey:"label",input:{type:"text"}}]}},
		]},
	]}},true,true,{searchbar:false});
	previewTable.setData([previewRow]);
	await tick();
	const previewOuter=previewTable.getDetailCell(0,"previewOuter");
	const previewRepeated=previewTable.getDetailCell(0,"previewItems");
	const previewEntries=()=>previewRepeated.children.filter(child=>!child.schemaNode.creator);
	const previewEntry=id=>previewEntries().find(entry=>entry.dataObj.id===id);
	const previewTitles=()=>previewRepeated.groupHeadings.map(heading=>
		heading.querySelector(".repeated-group-title").textContent);
	const previewPaths=new Map(previewEntries().map(entry=>[entry.dataObj.id,JSON.stringify(entry.path)]));
	const previewChildren=[...previewRepeated.children];
	const previewViewport=previewOuter.viewportEl;
	assert(previewViewport?.classList.contains("tablance-group-viewport")
		&&previewViewport.firstElementChild===previewOuter.el
		&&getComputedStyle(previewViewport).transitionProperty==="all"
		&&!previewViewport.classList.contains("tablance-group-animating"),
		"every details group is wrapped by an idle dedicated animation viewport");
	assert(JSON.stringify(previewTitles())===JSON.stringify(["Alpha","Beta","unknown"])
		&&!previewEntry("a-first").previewHidden&&previewEntry("a-second").previewHidden
		&&previewEntry("a-hidden").hidden&&!previewEntry("a-hidden").previewHidden
		&&previewEntry("b-first").previewHidden&&!previewEntry("b-chosen").previewHidden
		&&previewEntry("empty").previewHidden
		&&!previewEntry("unknown-one").previewHidden&&!previewEntry("unknown-two").previewHidden
		&&previewRepeated.groupSpacers.length===3,
		"a closed parent applies per-group preview titles, include, limits, and omits empty preview groups");
	assert(previewIncludeCalls.length>=2
		&&previewIncludeCalls.every(call=>call.context.rowData===previewRow
			&&call.context.groupKey==="b"&&call.context.repeatedInstance===previewRepeated
			&&JSON.stringify(call.context.entries.map(data=>data.id))===JSON.stringify(["b-first","b-chosen"])),
		"preview include receives visible data in the existing grouped and sorted presentation order");
	assert(!previewTable._isNavigableDetailsInstance(previewEntry("a-second"))
		&&previewTable._getFirstSelectableDetailsCell(previewRepeated,true)===previewEntry("a-first"),
		"preview-hidden repeated entries are excluded from logical keyboard navigation");
	const previewBackingSnapshot=[...previewBacking];
	previewEntry("a-second").select();
	const openingPreviewTransition=previewViewport._tablanceGroupTransition;
	assert(previewOuter.el.classList.contains("open")&&openingPreviewTransition
		&&openingPreviewTransition.targetHeight===previewTable._groupNaturalHeight(previewOuter)
		&&previewEntries().every(entry=>!entry.previewHidden)
		&&JSON.stringify(previewTitles())===JSON.stringify(["Alphas","Betas","Empty group","unknown"]),
		"programmatic opening synchronizes full presentation before measuring and animating its viewport");
	await tick();
	assert(previewOuter.el.classList.contains("open")
		&&previewEntries().every(entry=>!entry.previewHidden)
		&&JSON.stringify(previewTitles())===JSON.stringify(["Alphas","Betas","Empty group","unknown"])
		&&previewTable._activeDetailsCell===previewEntry("a-second"),
		"programmatic selection opens the enclosing group and restores full repeated rendering");
	previewTable._finalizeGroupClose(previewOuter);
	const reversedPreviewTransition=previewViewport._tablanceGroupTransition;
	assert(reversedPreviewTransition&&reversedPreviewTransition!==openingPreviewTransition
		&&!previewOuter.el.classList.contains("open")
		&&JSON.stringify(previewTitles())===JSON.stringify(["Alpha","Beta","unknown"]),
		"closing during opening replaces the transition while applying compact logical state immediately");
	previewViewport.dispatchEvent(new TransitionEvent("transitioncancel",{propertyName:"height"}));
	assert(previewViewport._tablanceGroupTransition===reversedPreviewTransition,
		"a transitioncancel away from the current target cannot finalize a reversed group animation");
	const suppressPreviewAnimationEvent=event=>{
		if (event.target===previewViewport&&event.propertyName==="height")
			event.stopImmediatePropagation();
	};
	previewViewport.addEventListener("transitionend",suppressPreviewAnimationEvent,{capture:true});
	previewViewport.addEventListener("transitioncancel",suppressPreviewAnimationEvent,{capture:true});
	await waitFor(()=>!previewViewport._tablanceGroupTransition,"group transition fallback cleanup");
	previewViewport.removeEventListener("transitionend",suppressPreviewAnimationEvent,{capture:true});
	previewViewport.removeEventListener("transitioncancel",suppressPreviewAnimationEvent,{capture:true});
	assert(JSON.stringify(previewTitles())===JSON.stringify(["Alpha","Beta","unknown"])
		&&previewRepeated.children.every((entry,index)=>entry===previewChildren[index])
		&&previewEntries().every(entry=>JSON.stringify(entry.path)===previewPaths.get(entry.dataObj.id))
		&&previewRow.items===previewBacking
		&&previewBacking.every((entry,index)=>entry===previewBackingSnapshot[index])
		&&!previewViewport.style.height&&!previewViewport.style.overflow
		&&!previewViewport.classList.contains("tablance-group-animating"),
		"fallback cleanup restores natural layout without changing repeated instances, paths, or backing data");
	previewTable._openGroup(previewOuter);
	await waitFor(()=>!previewViewport._tablanceGroupTransition,"ordinary group transition completion");
	assert(previewOuter.el.classList.contains("open")&&!previewViewport.style.height&&!previewViewport.style.overflow,
		"an ordinary transition event leaves an open group at natural height with no temporary inline state");
	const originalMatchMedia=window.matchMedia;
	window.matchMedia=query=>({matches:query==="(prefers-reduced-motion: reduce)",media:query,
		addEventListener:()=>{},removeEventListener:()=>{}});
	previewTable._finalizeGroupClose(previewOuter);
	window.matchMedia=originalMatchMedia;
	assert(!previewOuter.el.classList.contains("open")&&!previewViewport._tablanceGroupTransition
		&&!previewViewport.style.height&&!previewViewport.style.overflow
		&&JSON.stringify(previewTitles())===JSON.stringify(["Alpha","Beta","unknown"]),
		"reduced motion applies compact state synchronously without retaining animation state");
	previewEntry("a-second").dataObj.order=-1;
	previewTable._finalizeRepeatedMutation(previewRepeated);
	assert(!previewEntry("a-second").previewHidden&&previewEntry("a-first").previewHidden,
		"preview recomputes after repeated sorting changes");
	const externallyAdded={id:"a-new",kind:"a",order:-2,label:"External",visible:true};
	previewBacking.push(externallyAdded);
	previewTable.updateData(previewRow,"items",null,false,true);
	assert(previewEntry("a-new")&&!previewEntry("a-new").previewHidden
		&&previewEntry("a-second").previewHidden,
		"updateData additions are reconciled into the compact preview");
	previewBacking.splice(previewBacking.indexOf(externallyAdded),1);
	previewTable.updateData(previewRow,"items",null,false,true);
	assert(!previewEntry("a-new")&&!previewEntry("a-second").previewHidden,
		"updateData removals restore the next eligible compact preview entry");
	const reorderedAlpha=previewEntry("a-first");
	previewRepeated.children.splice(previewRepeated.children.indexOf(reorderedAlpha),1);
	previewRepeated.children.unshift(reorderedAlpha);
	previewTable._arrangeRepeatedInstances(previewRepeated,true);
	assert(!reorderedAlpha.previewHidden&&previewEntry("a-second").previewHidden,
		"a preserved repeated reorder immediately determines the first compact preview entry");
	previewTable._finalizeRepeatedMutation(previewRepeated);
	assert(!previewEntry("a-second").previewHidden&&previewEntry("a-first").previewHidden,
		"canonical repeated sorting restores the compact preview after reorder refresh");
	previewEntry("a-second").dataObj.kind="b";
	previewTable._finalizeRepeatedMutation(previewRepeated);
	assert(!previewEntry("a-first").previewHidden&&previewEntry("a-second").previewHidden
		&&previewTitles().includes("Alpha"),
		"regrouping recomputes each group's compact preview without replacing entry instances");
	let invalidPreviewError;
	try {
		previewTable._getRepeatedGrouping({schemaNode:{grouping:{by:"kind",order:[
			{key:"bad",title:"Bad",preview:{maxEntries:1.5}},
		]}}});
	} catch (error) {
		invalidPreviewError=error;
	}
	assert(/preview\.maxEntries/.test(invalidPreviewError?.message),
		"invalid repeated preview limits fail declaratively");

	const nestedAnimationRow={title:"Nested animation",value:"Value"};
	const nestedAnimationTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
		{type:"group",nodeId:"animationOuter",entries:[
			{type:"group",nodeId:"animationInner",closedRender:()=>"Compact",entries:[
				{title:"Value",dataKey:"value",nodeId:"animationValue",input:{type:"text"}},
			]},
		]},
	]}},true,true,{searchbar:false});
	nestedAnimationTable.setData([nestedAnimationRow]);
	await tick();
	const animationOuter=nestedAnimationTable.getDetailCell(0,"animationOuter");
	const animationInner=nestedAnimationTable.getDetailCell(0,"animationInner");
	const animationValue=nestedAnimationTable.getDetailCell(0,"animationValue");
	const animationValuePath=JSON.stringify(animationValue.path);
	animationValue.select();
	assert(animationOuter.el.classList.contains("open")&&animationInner.el.classList.contains("open")
		&&animationOuter.viewportEl._tablanceGroupTransition
		&&!animationInner.viewportEl._tablanceGroupTransition
		&&nestedAnimationTable._activeDetailsCell===animationValue
		&&animationValue.dataObj===nestedAnimationRow&&JSON.stringify(animationValue.path)===animationValuePath,
		"programmatic descendant selection opens every logical ancestor but animates only the outermost changed group");
	await waitFor(()=>!animationOuter.viewportEl._tablanceGroupTransition,"nested outer group animation cleanup");
	assert(!animationOuter.viewportEl.style.height&&!animationOuter.viewportEl.style.overflow
		&&!animationInner.viewportEl.style.height&&!animationInner.viewportEl.style.overflow,
		"nested programmatic opening cleans both viewports without altering the selected instance");

	const hiddenReorderTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
		{type:"group",nodeId:"hiddenReorderOuter",entries:[
			{type:"repeated",dataKey:"items",nodeId:"hiddenReorderItems",create:true,
				grouping:{by:"kind",order:[{key:"a",title:"Grouped entries"}]},
				reorder:{canMove:()=>false,onCommit:()=>{}},entry:{type:"group",
					closedRender:({label})=>label,entries:[{title:"Label",dataKey:"label",input:{type:"text"}}]}},
		]},
	]}},true,true,{searchbar:false});
	hiddenReorderTable.setData([{title:"Inset",items:[{kind:"a",label:"Entry"}]}]);
	await tick();
	const hiddenReorderOuter=hiddenReorderTable.getDetailCell(0,"hiddenReorderOuter");
	const hiddenReorderRepeated=hiddenReorderTable.getDetailCell(0,"hiddenReorderItems");
	hiddenReorderTable._openGroup(hiddenReorderOuter);
	await tick();
	const hiddenReorderEntry=hiddenReorderRepeated.children.find(entry=>!entry.schemaNode.creator);
	const hiddenReorderCreator=hiddenReorderRepeated.children.find(entry=>entry.schemaNode.creator);
	const hiddenReorderTitle=hiddenReorderRepeated.groupHeadings[0].querySelector(".repeated-group-title");
	const hiddenReorderContentCell=hiddenReorderEntry.reorderContentEl;
	const hiddenReorderCollectionRect=hiddenReorderRepeated.parent.containerEl.getBoundingClientRect();
	assert(hiddenReorderEntry.reorderColumnEl.hidden
		&&parseFloat(getComputedStyle(hiddenReorderContentCell).paddingLeft)===24
		&&parseFloat(getComputedStyle(hiddenReorderContentCell).paddingRight)===16
		&&hiddenReorderTitle.getBoundingClientRect().left>hiddenReorderCreator.el.getBoundingClientRect().left
		&&hiddenReorderEntry.el.getBoundingClientRect().left>hiddenReorderCreator.el.getBoundingClientRect().left
		&&hiddenReorderEntry.el.getBoundingClientRect().left>hiddenReorderCollectionRect.left
		&&hiddenReorderEntry.el.getBoundingClientRect().right<hiddenReorderCollectionRect.right,
		"a hidden reorder column preserves the grouped content inset while the creator stays at the repeated baseline");

	const nestedGroupedTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
		{type:"group",nodeId:"groupingOuter",entries:[
			{type:"group",nodeId:"groupingInner",entries:[
				{type:"repeated",dataKey:"items",nodeId:"nestedGroupedItems",create:true,
					grouping:{by:"kind",order:[{key:"a",title:"Alpha",description:"Group guidance"}]},
					entry:{type:"group",
						closedRender:({label})=>label,entries:[{title:"Label",dataKey:"label",input:{type:"text"}}]}},
			]},
		]},
	]}},true,true,{searchbar:false});
	nestedGroupedTable.setData([{title:"Nested",items:[{kind:"a",label:"Entry"}]}]);
	await tick();
	const groupingOuter=nestedGroupedTable.getDetailCell(0,"groupingOuter");
	const groupingInner=nestedGroupedTable.getDetailCell(0,"groupingInner");
	const nestedGroupedRepeated=nestedGroupedTable.getDetailCell(0,"nestedGroupedItems");
	const nestedGroupTitle=nestedGroupedRepeated.groupHeadings[0].querySelector(".repeated-group-title");
	const nestedGroupDescription=nestedGroupedRepeated.groupHeadings[0]
		.querySelector(".repeated-group-description");
	const compactGroupTitleOffset=nestedGroupTitle.getBoundingClientRect().top
		-nestedGroupedRepeated.groupHeadings[0].getBoundingClientRect().top;
	const nestedGroupedEntry=nestedGroupedRepeated.children.find(child=>!child.schemaNode.creator);
	const nestedGroupedEntryCell=nestedGroupedEntry.outerContainerEl.cells[0];
	assert(!nestedGroupedRepeated.groupHeadings[0].querySelector(".repeated-group-frame")
		&&nestedGroupTitle.getBoundingClientRect().width>0
		&&getComputedStyle(nestedGroupDescription).display==="none"
		&&parseFloat(getComputedStyle(nestedGroupedEntryCell).paddingLeft)<24,
		"grouped repeated under a closed parent keeps its compact heading without adding indentation");
	nestedGroupedTable._openGroup(groupingOuter);
	await tick();
	assert(parseFloat(getComputedStyle(nestedGroupedEntryCell).paddingLeft)<24,
		"opening a grandparent does not indent grouped entries while their direct parent remains closed");
	nestedGroupedTable._openGroup(groupingInner);
	await tick();
	assert(parseFloat(getComputedStyle(nestedGroupedEntryCell).paddingLeft)===24
		&&getComputedStyle(nestedGroupDescription).display!=="none"
		&&Math.abs((nestedGroupTitle.getBoundingClientRect().top
			-nestedGroupedRepeated.groupHeadings[0].getBoundingClientRect().top)-compactGroupTitleOffset)<.1,
		"the editable context indents entries without shifting the group title relative to its top edge");
	nestedGroupedEntry.select();
	await tick();
	const groupedSelectionRect=nestedGroupedEntry.selEl.getBoundingClientRect();
	const groupedVisualRect=nestedGroupedEntry.el.getBoundingClientRect();
	const groupedCursorRect=nestedGroupedTable._cellCursor.getBoundingClientRect();
	const sameRect=(a,b)=>["left","right","top","bottom"].every(edge=>Math.abs(a[edge]-b[edge])<.5);
	assert(nestedGroupedEntry.cursorEl===nestedGroupedEntry.el
		&&nestedGroupedTable._selectedCell===nestedGroupedEntry.selEl
		&&nestedGroupedEntry.selEl.classList.contains("tablance-active-cell")
		&&sameRect(groupedCursorRect,groupedVisualRect)
		&&!sameRect(groupedCursorRect,groupedSelectionRect)
		&&nestedGroupedTable._resolvePointerDetailsInstance(nestedGroupedEntry.el)===nestedGroupedEntry
		&&nestedGroupedTable._getDetailsCellRect(nestedGroupedEntry).left===groupedSelectionRect.left,
		"a grouped entry can use separate cursor geometry without changing selection, hit testing, or navigation geometry");
	const nestedGroupedCreator=nestedGroupedRepeated.children.find(child=>child.schemaNode.creator);
	nestedGroupedCreator.select();
	await tick();
	const groupedCreatorSelectionRect=nestedGroupedCreator.selEl.getBoundingClientRect();
	const groupedCreatorVisualRect=nestedGroupedCreator.el.getBoundingClientRect();
	const groupedCreatorCursorRect=nestedGroupedTable._cellCursor.getBoundingClientRect();
	assert(nestedGroupedCreator.cursorEl===nestedGroupedCreator.el
		&&nestedGroupedTable._selectedCell===nestedGroupedCreator.selEl
		&&nestedGroupedCreator.selEl.classList.contains("tablance-active-cell")
		&&sameRect(groupedCreatorCursorRect,groupedCreatorVisualRect)
		&&!sameRect(groupedCreatorCursorRect,groupedCreatorSelectionRect)
		&&nestedGroupedTable._resolvePointerDetailsInstance(nestedGroupedCreator.el)===nestedGroupedCreator,
		"a repeated creator uses the same semantic group cursor box without changing its canonical selection or hit target");
	nestedGroupedTable._finalizeGroupClose(groupingOuter);
	await tick();
	assert(parseFloat(getComputedStyle(nestedGroupedEntryCell).paddingLeft)<24
		&&nestedGroupTitle.getBoundingClientRect().width>0,
		"closing a grandparent removes nested indentation without hiding group headings");
	nestedGroupedTable._finalizeGroupClose(groupingInner);
	groupingInner.select();
	const groupingInnerSelectionEl=groupingInner.selEl;
	const nestedRowData=nestedGroupedTable._filteredData[0];
	nestedGroupedTable.updateData(nestedRowData,"items",null,false,true);
	assert(nestedGroupedTable._activeDetailsCell===groupingInner
		&&nestedGroupedTable._selectedCell===groupingInnerSelectionEl
		&&groupingInnerSelectionEl.isConnected,
		"programmatic repeated replacement preserves a selected containing group instance");
	nestedGroupedTable._enterCell(new Event("enter",{cancelable:true}));
	assert(groupingInner.el.classList.contains("open")
		&&nestedGroupedTable._activeDetailsCell?.parent===nestedGroupedRepeated,
		"a containing group remains activatable after its repeated entries are rebound");

	const reorderBacking=[
		{id:"old",position:1,label:"Old"},
		{id:"middle",position:2,label:"Middle"},
		{id:"new",position:3,label:"New"},
	];
	const reorderCommits=[];
	const reorderTable=new Tablance(host(),{details:{type:"list",entries:[
		{type:"repeated",dataKey:"items",nodeId:"reorderItems",create:true,
			 sortCompare:(a,b)=>b.position-a.position,
			reorder:{
				canMove:(_direction,{target})=>!!target,
				onCommit:payload=>reorderCommits.push(payload),
			},
			entry:{type:"group",closedRender:data=>data.label,entries:[
				{title:"Label",dataKey:"label",input:{type:"text"}},
			]}},
	]}},true,true,{searchbar:false});
	reorderTable.setData([{items:reorderBacking}]);
	await tick();
	const reorderRepeated=reorderTable.getDetailCell(0,"reorderItems");
	const reorderEntries=()=>reorderRepeated.children.filter(child=>!child.schemaNode.creator&&!child.creating);
	const entry=id=>reorderEntries().find(item=>item.dataObj.id===id);
	const middleReorderEntry=entry("middle");
	const middleClosedRender=middleReorderEntry.el.textContent;
	const reorderCreatorCells=reorderRepeated.children.find(child=>child.schemaNode.creator).outerContainerEl.cells;
	assert(middleReorderEntry.reorderCell?.schemaNode.type==="reorder"
		&&!middleReorderEntry.reorderCell.hidden
		&&middleReorderEntry.reorderCell.parent===reorderRepeated
		&&middleReorderEntry.reorderCell.ownerEntry===middleReorderEntry
		&&middleReorderEntry.reorderColumnEl.matches("td.repeated-reorder-column")
		&&middleReorderEntry.reorderCell.el.matches("td.repeated-reorder-column > span.repeated-reorder-cell")
		&&middleReorderEntry.reorderCell.el.querySelector(":scope>.repeated-reorder-surface")
		&&middleReorderEntry.reorderCell.el.querySelector("svg.repeated-reorder-icon")
		&&middleReorderEntry.reorderCell.el.querySelectorAll(".repeated-reorder-icon-bars").length===1
		&&(middleReorderEntry.reorderCell.el.querySelector(".repeated-reorder-icon-bars")
			.getAttribute("d").match(/M/g)??[]).length===2
		&&middleReorderEntry.reorderCell.el.querySelectorAll(".repeated-reorder-icon-up, .repeated-reorder-icon-down").length===2
		&&getComputedStyle(middleReorderEntry.reorderCell.el.querySelector("svg.repeated-reorder-icon")).width==="18px"
		&&getComputedStyle(middleReorderEntry.reorderCell.el).userSelect==="none"
		&&middleReorderEntry.reorderCell.el.querySelectorAll("button").length===0
		&&reorderCreatorCells[reorderCreatorCells.length-1].colSpan===2
		&&reorderRepeated.children.filter(child=>!child.schemaNode.creator).length===3,
		"a closed reorderable entry owns a real auxiliary Tablance cell without changing repeated entry identity");
	middleReorderEntry.select();
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	assert(reorderTable._activeDetailsCell.dataObj.id==="old"&&!reorderTable._activeRepeatedReorderEntry,
		"ordinary vertical navigation skips the reorder handle and remains entry-to-entry");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	assert(reorderTable._activeDetailsCell===middleReorderEntry,
		"ArrowUp in the repeated entry column stays in the entry column");
	middleReorderEntry.select();
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	assert(getComputedStyle(middleReorderEntry.reorderCell.el
		.querySelector(".repeated-reorder-surface")).opacity==="1"
		&&getComputedStyle(middleReorderEntry.reorderCell.el
			.querySelector(".repeated-reorder-surface")).backgroundColor==="rgba(226, 232, 240, 0.55)"
		&&reorderEntries().filter(item=>item!==middleReorderEntry).every(item=>
			getComputedStyle(item.reorderCell.el.querySelector(".repeated-reorder-surface")).opacity==="0.5"),
		"idle reorder handles stay discoverable while only the cursor row has full visual emphasis");
	const reorderCursorRect=reorderTable._cellCursor.getBoundingClientRect();
	const reorderCellRect=middleReorderEntry.reorderCell.el.getBoundingClientRect();
	const reorderColumnRect=middleReorderEntry.reorderColumnEl.getBoundingClientRect();
	const middleNormalRowHeight=middleReorderEntry.outerContainerEl.getBoundingClientRect().height;
	assert(reorderTable._activeDetailsCell===middleReorderEntry.reorderCell
		&&reorderTable._selectedCell===middleReorderEntry.reorderCell.el
		&&!reorderTable._activeRepeatedReorderEntry
		&&middleReorderEntry.el.textContent===middleClosedRender
		&&Math.abs(reorderCursorRect.left-reorderCellRect.left)<.1
		&&Math.abs(reorderCursorRect.width-reorderCellRect.width)<.1
		&&reorderCellRect.left>reorderColumnRect.left
		&&reorderCellRect.right<reorderColumnRect.right
		&&reorderCellRect.top>reorderColumnRect.top
		&&reorderCellRect.bottom<reorderColumnRect.bottom
		&&Math.abs((reorderCellRect.left-reorderColumnRect.left)-7)<.1
		&&Math.abs((reorderColumnRect.right-reorderCellRect.right)-3)<.1,
		"ArrowLeft selects only the inset real reorder cell while preserving the entry's closed render");
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	assert(reorderTable._activeDetailsCell===entry("old").reorderCell
		&&getComputedStyle(entry("old").reorderCell.el.querySelector(".repeated-reorder-surface")).opacity==="1"
		&&getComputedStyle(middleReorderEntry.reorderCell.el
			.querySelector(".repeated-reorder-surface")).opacity==="0.5",
		"ArrowDown stays in the reorder column and immediately transfers its visual emphasis");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	assert(reorderTable._activeDetailsCell===middleReorderEntry.reorderCell,
		"ArrowUp in the reorder column stays in the reorder column");
	key(reorderTable.rootEl,"ArrowRight","ArrowRight");
	assert(reorderTable._activeDetailsCell===middleReorderEntry,
		"ArrowRight returns from the reorder cell to its owning entry");
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	key(reorderTable.rootEl,"Enter","Enter");
	const reorderControl=reorderTable._cellCursor.querySelector(".repeated-reorder-control");
	assert(reorderTable._activeRepeatedReorderEntry===middleReorderEntry
		&&reorderTable._inEditMode
		&&reorderTable._cellCursor.classList.contains("repeated-reorder-editor")
		&&Math.abs(middleReorderEntry.outerContainerEl.getBoundingClientRect().height-middleNormalRowHeight)<.1
		&&getComputedStyle(reorderControl).position==="absolute"
		&&getComputedStyle(reorderControl.querySelector(".repeated-reorder-up")).position==="absolute"
		&&getComputedStyle(reorderControl.querySelector(".repeated-reorder-down")).position==="absolute"
		&&getComputedStyle(reorderControl.querySelector(".repeated-reorder-up")).backgroundColor!=="rgba(0, 0, 0, 0)"
		&&Math.abs(reorderControl.querySelector(".repeated-reorder-up").getBoundingClientRect().width
			-middleReorderEntry.reorderCell.el.getBoundingClientRect().width)<.1
		&&Math.abs((middleReorderEntry.reorderCell.el.getBoundingClientRect().top
			-reorderControl.querySelector(".repeated-reorder-up").getBoundingClientRect().bottom)-3)<.1
		&&Math.abs((reorderControl.querySelector(".repeated-reorder-down").getBoundingClientRect().top
			-middleReorderEntry.reorderCell.el.getBoundingClientRect().bottom)-3)<.1
		&&!middleReorderEntry.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")
		&&reorderEntries().filter(item=>item!==middleReorderEntry).every(item=>
			item.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")
			&&getComputedStyle(item.reorderCell.el).opacity==="1"
			&&getComputedStyle(item.reorderCell.el.querySelector(".repeated-reorder-surface")).opacity==="0.3"
			&&getComputedStyle(item.reorderCell.el).pointerEvents!=="none")
		&&[...reorderControl.children].map(child=>child.className).join(",")==="repeated-reorder-up,repeated-reorder-handle,repeated-reorder-down"
		&&middleReorderEntry.el.textContent===middleClosedRender,
		"Enter overlays a vertical up-handle-down editor without changing row geometry or hiding closedRender");
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	assert(reorderCommits.length===0&&reorderBacking[1].position===2
		&&reorderTable._activeDetailsCell===middleReorderEntry.reorderCell
		&&reorderTable._activeRepeatedReorderEntry===middleReorderEntry
		&&reorderEntries()[1]===middleReorderEntry
		&&reorderBacking[1]===middleReorderEntry.dataObj
		&&!reorderTable._cellCursor.querySelector(".repeated-reorder-up").hidden
		&&!reorderTable._cellCursor.querySelector(".repeated-reorder-down").hidden
		&&reorderEntries().filter(item=>item!==middleReorderEntry).every(item=>
			item.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")),
		"multiple arrow moves stay local, retain object identity, and immediately update available controls");
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	key(reorderTable.rootEl,"Escape","Escape");
	assert(!reorderTable._activeRepeatedReorderEntry&&!reorderTable._inEditMode
		&&!middleReorderEntry.el.classList.contains("open")
		&&!middleReorderEntry.reorderCell.el.classList.contains("editing")
		&&reorderTable._activeDetailsCell===middleReorderEntry.reorderCell
		&&reorderEntries().map(item=>item.dataObj.id).join(",")==="new,middle,old"
		&&reorderEntries().every(item=>!item.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")
			&&getComputedStyle(item.reorderCell.el).opacity==="1"
			&&getComputedStyle(item.reorderCell.el).pointerEvents!=="none")
		&&getComputedStyle(middleReorderEntry.reorderCell.el
			.querySelector(".repeated-reorder-surface")).opacity==="1"
		&&reorderEntries().filter(item=>item!==middleReorderEntry).every(item=>
			getComputedStyle(item.reorderCell.el.querySelector(".repeated-reorder-surface")).opacity==="0.5")
		&&reorderCommits.length===0,
		"Escape cancels the reorder editor and restores its complete entry-order baseline");

	const oldReorderEntry=entry("old");
	oldReorderEntry.select();
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	key(reorderTable.rootEl,"Enter","Enter");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	assert(reorderTable._cellCursor.querySelector(".repeated-reorder-up").hidden
		&&!reorderTable._cellCursor.querySelector(".repeated-reorder-down").hidden,
		"the active vertical control displays only directions that remain possible after a move");
	key(reorderTable.rootEl,"Enter","Enter");
	assert(reorderCommits.length===1
		&&reorderCommits[0].baselineOrder.map(item=>item.id).join(",")==="new,middle,old"
		&&reorderCommits[0].order.map(item=>item.id).join(",")==="old,new,middle"
		&&reorderTable._activeDetailsCell===oldReorderEntry.reorderCell&&!reorderTable._inEditMode,
		"Enter commits several local moves once and retains the cursor on the moved entry's reorder cell");
	reorderTable._finalizeRepeatedMutation(reorderRepeated);

	entry("middle").select();
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	key(reorderTable.rootEl,"Enter","Enter");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	key(reorderTable.rootEl,"Tab","Tab");
	assert(reorderCommits.length===2&&reorderTable._activeDetailsCell.dataObj.id==="new"
		&&!reorderTable._inEditMode,
		"Tab commits reorder and moves forward using normal editor navigation");
	reorderTable._finalizeRepeatedMutation(reorderRepeated);
	entry("middle").select();
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	key(reorderTable.rootEl,"Enter","Enter");
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	key(reorderTable.rootEl,"Tab","Tab",{shiftKey:true});
	assert(reorderCommits.length===3&&reorderTable._activeDetailsCell.dataObj.id==="old"
		&&!reorderTable._inEditMode,
		"Shift+Tab commits reorder and moves backward using normal editor navigation");
	reorderTable._finalizeRepeatedMutation(reorderRepeated);
	entry("middle").select();
	key(reorderTable.rootEl,"ArrowLeft","ArrowLeft");
	key(reorderTable.rootEl,"Enter","Enter");
	key(reorderTable.rootEl,"ArrowUp","ArrowUp");
	entry("old").el.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true,button:0}));
	assert(reorderCommits.length===4&&reorderTable._activeDetailsCell.dataObj.id==="old"
		&&!reorderTable._inEditMode,
		"clicking another cell commits the reorder through the ordinary editor exit path");
	reorderTable._finalizeRepeatedMutation(reorderRepeated);
	const pointerReorderEntry=entry("middle");
	pointerReorderEntry.reorderCell.el.dispatchEvent(new MouseEvent("mousedown",{
		bubbles:true,cancelable:true,button:0,
	}));
	assert(reorderTable._activeDetailsCell===pointerReorderEntry.reorderCell
		&&!reorderTable._activeRepeatedReorderEntry,
		"pointer selection resolves directly to the real reorder cell");
	const reorderDoubleClick=new MouseEvent("dblclick",{bubbles:true,cancelable:true});
	pointerReorderEntry.reorderCell.el.dispatchEvent(reorderDoubleClick);
	assert(reorderTable._activeRepeatedReorderEntry===pointerReorderEntry&&reorderTable._inEditMode,
		"double-click activates the selected canonical reorder cell without relying on the visual cursor as its target");
	assert(reorderDoubleClick.defaultPrevented
		&&getComputedStyle(reorderTable._cellCursor).userSelect==="none",
		"reorder double-click and its editor overlay suppress native text selection");
	const activeReorderClick=new MouseEvent("click",{bubbles:true,cancelable:true});
	reorderTable._cellCursor.dispatchEvent(activeReorderClick);
	assert(activeReorderClick.defaultPrevented&&reorderTable._inEditMode
		&&reorderTable._activeRepeatedReorderEntry===pointerReorderEntry&&reorderCommits.length===4,
		"a click on the active reorder cell keeps its editor and local session active");
	const dimmedPeerEntry=entry("old");
	dimmedPeerEntry.reorderCell.el.dispatchEvent(new MouseEvent("mousedown",{
		bubbles:true,cancelable:true,button:0,
	}));
	assert(!reorderTable._inEditMode&&!reorderTable._activeRepeatedReorderEntry
		&&reorderTable._activeDetailsCell===dimmedPeerEntry.reorderCell
		&&reorderTable._selectedCell===dimmedPeerEntry.reorderCell.el
		&&!dimmedPeerEntry.el.classList.contains("open")
		&&reorderEntries().every(item=>!item.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")),
		"clicking a dimmed canonical peer commits the active editor and selects that peer without opening entries");
	pointerReorderEntry.reorderCell.select();
	reorderTable._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	const activeReorderDoubleClick=new MouseEvent("dblclick",{bubbles:true,cancelable:true});
	reorderTable._cellCursor.dispatchEvent(activeReorderDoubleClick);
	assert(activeReorderDoubleClick.defaultPrevented&&!reorderTable._inEditMode
		&&reorderTable._activeDetailsCell===pointerReorderEntry.reorderCell
		&&reorderEntries().every(item=>!item.reorderCell.el.classList.contains("repeated-reorder-peer-suppressed")),
		"double-clicking the active reorder cell accepts and closes its editor");
	reorderTable._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	key(reorderTable.rootEl,"Enter","Enter",{shiftKey:true});
	assert(reorderTable._activeDetailsCell===pointerReorderEntry.reorderCell&&!reorderTable._inEditMode,
		"Shift+Enter accepts reorder and stays on the same stable reorder cell like Enter");
	reorderTable._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	key(reorderTable.rootEl,"Escape","Escape");
	const missingReorderEntry=entry("middle");
	missingReorderEntry.reorderCell.hidden=missingReorderEntry.reorderCell.el.hidden=
		missingReorderEntry.reorderColumnEl.hidden=true;
	entry("new").reorderCell.select();
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	assert(reorderTable._activeDetailsCell===missingReorderEntry,
		"a missing reorder cell uses the shared logical-grid fallback for that row");
	key(reorderTable.rootEl,"ArrowDown","ArrowDown");
	assert(reorderTable._activeDetailsCell===entry("old").reorderCell,
		"the preferred reorder column survives a row whose reorder cell is missing");
	missingReorderEntry.reorderCell.hidden=missingReorderEntry.reorderCell.el.hidden=
		missingReorderEntry.reorderColumnEl.hidden=false;
	reorderTable._openGroup(middleReorderEntry);
	assert(middleReorderEntry.reorderCell.hidden,
		"an open repeated entry has no reorder UI");
	reorderRepeated.createNewEntry();
	const reorderDraft=reorderRepeated.children.find(child=>child.creating);
	assert(reorderDraft.reorderCell?.hidden!==false,
		"an uncommitted create draft cannot expose or enter repeated reorder mode");
	reorderTable._deleteCell(reorderDraft,true);

	const transactionalRows=[{id:"older",position:1,label:"Older"},{id:"newer",position:2,label:"Newer"}];
	const transactionalEvents=[];
	const transactionalTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},
		onDataCommit:payload=>transactionalEvents.push(`data:${payload.mode}:${payload.data.label}`),
		details:{type:"list",entries:[{type:"group",nodeId:"transactionalOuter",entries:[
			{type:"repeated",dataKey:"items",nodeId:"transactionalItems",create:true,
				createData:()=>({position:3,label:"Draft"}),sortCompare:(a,b)=>b.position-a.position,
				reorder:{canMove:(_direction,{target})=>!!target,
					onCommit:payload=>transactionalEvents.push(`reorder:${payload.data.label}`)},
				entry:{type:"group",closedRender:data=>data.label,entries:[
					{title:"Label",dataKey:"label",input:{type:"text"}},
				]}},
		]}]},
	},true,true,{searchbar:false});
	transactionalTable.setData([{title:"Transactional",items:transactionalRows}]);
	await tick();
	let transactionalOuter=transactionalTable.getDetailCell(0,"transactionalOuter");
	transactionalTable._openGroup(transactionalOuter);
	let transactionalRepeated=transactionalTable.getDetailCell(0,"transactionalItems");
	const originalInstances=transactionalRepeated.children.filter(child=>!child.schemaNode.creator);
	transactionalRepeated.createNewEntry();
	let transactionalDraft=transactionalRepeated.children.find(child=>child.creating);
	transactionalDraft.dataObj.label="Created then discarded";
	transactionalTable._markDirtyField(transactionalDraft.children[0]);
	transactionalDraft.select();
	assert(!transactionalDraft.creating&&transactionalDraft.dataObj.id==null
		&&transactionalRepeated.children[0]===transactionalDraft
		&&transactionalTable._activeDetailsCell===transactionalDraft
		&&!transactionalDraft.reorderCell.hidden&&transactionalEvents.length===0,
		"an accepted local child is fully positioned and reorderable without persistence identity");
	transactionalTable._enterCell(new Event("enter",{cancelable:true}));
	assert(transactionalDraft.el.classList.contains("open"),
		"an accepted unpersisted repeated entry can be reopened through the ordinary group lifecycle");
	transactionalTable._closeGroup(transactionalDraft);
	transactionalDraft.select();
	key(transactionalTable.rootEl,"Escape","Escape",{ctrlKey:true});
	assert(transactionalRows.length===2&&!transactionalRows.includes(transactionalDraft.dataObj)
		&&!transactionalRepeated.children.includes(transactionalDraft)&&!transactionalDraft.el.isConnected
		&&originalInstances.every(instance=>transactionalRepeated.children.includes(instance))
		&&transactionalEvents.length===0,
		"parent Ctrl+Escape removes an accepted create and reconciles its stale instance and DOM");

	transactionalOuter=transactionalTable.getDetailCell(0,"transactionalOuter");
	transactionalTable._openGroup(transactionalOuter);
	transactionalRepeated=transactionalTable.getDetailCell(0,"transactionalItems");
	const newerEntry=transactionalRepeated.children.find(child=>child.dataObj.id==="newer");
	newerEntry.reorderCell.select();
	key(transactionalTable.rootEl,"Enter","Enter");
	key(transactionalTable.rootEl,"ArrowDown","ArrowDown");
	key(transactionalTable.rootEl,"Enter","Enter");
	assert(transactionalRepeated.children.filter(child=>!child.schemaNode.creator)[1]===newerEntry
		&&transactionalEvents.length===0,
		"an accepted repeated reorder remains local while its parent transaction is open");
	key(transactionalTable.rootEl,"Escape","Escape",{ctrlKey:true});
	assert(transactionalRepeated.children.filter(child=>!child.schemaNode.creator)[0]===newerEntry
		&&transactionalEvents.length===0,
		"parent Ctrl+Escape restores accepted repeated instance and DOM order without persistence");

	transactionalOuter=transactionalTable.getDetailCell(0,"transactionalOuter");
	transactionalTable._openGroup(transactionalOuter);
	transactionalRepeated=transactionalTable.getDetailCell(0,"transactionalItems");
	transactionalRepeated.createNewEntry();
	transactionalDraft=transactionalRepeated.children.find(child=>child.creating);
	transactionalDraft.dataObj.label="Created and reordered";
	transactionalTable._markDirtyField(transactionalDraft.children[0]);
	transactionalDraft.select();
	transactionalDraft.reorderCell.select();
	key(transactionalTable.rootEl,"Enter","Enter");
	key(transactionalTable.rootEl,"ArrowDown","ArrowDown");
	key(transactionalTable.rootEl,"Enter","Enter");
	key(transactionalTable.rootEl,"Escape","Escape",{ctrlKey:true});
	assert(transactionalRows.length===2&&!transactionalRepeated.children.includes(transactionalDraft)
		&&transactionalEvents.length===0,
		"create plus reorder is discarded atomically by parent Ctrl+Escape");

	transactionalOuter=transactionalTable.getDetailCell(0,"transactionalOuter");
	transactionalTable._openGroup(transactionalOuter);
	transactionalRepeated=transactionalTable.getDetailCell(0,"transactionalItems");
	transactionalRepeated.createNewEntry();
	transactionalDraft=transactionalRepeated.children.find(child=>child.creating);
	transactionalDraft.dataObj.label="Created and committed";
	transactionalTable._markDirtyField(transactionalDraft.children[0]);
	transactionalDraft.select();
	transactionalDraft.reorderCell.select();
	key(transactionalTable.rootEl,"Enter","Enter");
	key(transactionalTable.rootEl,"ArrowDown","ArrowDown");
	key(transactionalTable.rootEl,"Enter","Enter");
	transactionalTable._closeGroup(transactionalOuter);
	assert(JSON.stringify(transactionalEvents)===JSON.stringify(
		["data:create:Created and committed","reorder:Created and committed"]),
		"parent commit emits create before its buffered reorder effect in deterministic order");

	const nestedDependencyRenders={};
	const countNestedRender=(kind,rowData,value)=>{
		const key=`${kind}:${rowData.id}`;
		nestedDependencyRenders[key]=(nestedDependencyRenders[key]??0)+1;
		return value;
	};
	const nestedRows=[{id:"outer-a",inner:[{id:"inner-a",value:1}]},
		{id:"outer-b",inner:[{id:"inner-b",value:2}]}];
	const nestedDependencyTable=new Tablance(host(),{
		main:{columns:[{dataKey:"title"}]},details:{type:"list",entries:[
			{type:"repeated",dataKey:"outer",nodeId:"outerCollection",entry:{type:"group",entries:[
				{type:"repeated",dataKey:"inner",nodeId:"innerCollection",entry:{type:"group",entries:[
					{title:"Value",dataKey:"value",input:{type:"text"}},
					{title:"Inner state",dataKey:"innerState",dependsOn:"innerCollection",
						render:({dependedValue,rowData})=>countNestedRender("inner",rowData,
							dependedValue.reduce((sum,item)=>sum+Number(item.value),0))},
				]}},
				{title:"Outer state",dataKey:"outerState",dependsOn:"outerCollection",
					render:({dependedValue,rowData})=>countNestedRender("outer",rowData,
						dependedValue.flatMap(item=>item.inner).reduce((sum,item)=>sum+Number(item.value),0))},
			]}},
	]}},true,true,{searchbar:false});
	nestedDependencyTable.setData([{title:"Nested",outer:nestedRows}]);
	await tick();
	const outerRepeated=nestedDependencyTable.getDetailCell(0,"outerCollection");
	const outerA=outerRepeated.children.find(entry=>entry.dataObj.id==="outer-a");
	const innerARepeated=outerA.children[0];
	const innerA=innerARepeated.children[0];
	const innerAValue=innerA.children[0];
	innerAValue.select();
	for (const key of Object.keys(nestedDependencyRenders))
		delete nestedDependencyRenders[key];
	innerA.dataObj.value=4;
	nestedDependencyTable._markDirtyField(innerAValue);
	assert(nestedDependencyTable._closeGroup(innerA)&&outerA.el.classList.contains("open")
		&&nestedDependencyRenders["inner:inner-a"]===1
		&&!nestedDependencyRenders["inner:inner-b"]
		&&nestedDependencyRenders["outer:outer-a"]===1&&nestedDependencyRenders["outer:outer-b"]===1,
		"accepted nested commits invalidate their collection dependencies while an outer group remains open");
	assert(nestedDependencyTable._closeGroup(outerA)
		&&nestedDependencyRenders["inner:inner-a"]===1
		&&nestedDependencyRenders["outer:outer-a"]===1&&nestedDependencyRenders["outer:outer-b"]===1,
		"closing the outer group flushes the already-finalized nested commit without another invalidation");

	const duplicateIdentity={id:"duplicate"};
	const duplicateIdentityTable=new Tablance(host(),{main:{columns:[{dataKey:"title"}]},
		details:{type:"list",entries:[{type:"repeated",dataKey:"items",entry:{dataKey:"id"}}]}},
	true,true,{searchbar:false});
	let duplicateIdentityRejected=false;
	try {
		duplicateIdentityTable._validateRepeatedDataArray([duplicateIdentity,duplicateIdentity]);
	} catch (error) {
		duplicateIdentityRejected=error instanceof TypeError
			&&error.message.includes("unique object identities");
	}
	assert(duplicateIdentityRejected,
		"repeated arrays reject duplicate object identities instead of silently making identity ambiguous");

	const resolve=node=>table._resolveCellState(node,{rowData:row});
	const conditionallyLockedState=resolve({input:{type:"text"},editableIf:()=>false});
	assert(conditionallyLockedState.kind==="readOnly"&&!conditionallyLockedState.activatable
		&&conditionallyLockedState.activation==="none",
		"editableIf false resolves to one canonical locked and non-activatable state");
	assert(resolve({input:{type:"text"},editableIf:()=>({editable:false,message:"locked"})}).message==="locked","editableIf object message is retained");
	assert(resolve({input:{type:"text"},disabledIf:()=>false}).kind==="editable","disabledIf false preserves editable");
	assert(resolve({input:{type:"text"},disabled:true,readOnly:true,editableIf:()=>true}).kind==="disabled","disabled has highest precedence");
	const explicitlyLockedState=resolve({input:{type:"text"},readOnly:true,editableIf:()=>true});
	assert(explicitlyLockedState.kind==="readOnly"&&!explicitlyLockedState.activatable,
		"explicit readOnly precedes editableIf and cannot activate its configured editor");
	const implicitPresentationState=resolve({render:()=>"presented"});
	assert(implicitPresentationState.kind==="readOnly"&&!implicitPresentationState.activatable
		&&implicitPresentationState.activation==="none",
		"a pure presentation field is locked and non-activatable by default");
	assert(resolve({render:()=>"presented",readOnlyPresentation:true}).activation==="presentation",
		"read-only text presentation remains available only through explicit opt-in");
	assert(resolve({input:{type:"button"}}).kind==="action","button/control precedence resolves action");
	assert(["expand","select","group"].every(type=>!table._showsActionIndicator({kind:"action"},{type}))
		&&!table._showsActionIndicator({kind:"action"},{input:{type:"button"}}),
		"controls with an explicit affordance are excluded from the generic action indicator");

	const geometry=element=>{
		const rect=element.getBoundingClientRect();
		return [rect.left,rect.top,rect.width,rect.height];
	};
	const editableCellGeometry=geometry(cells[0]);
	const editableTextGeometry=geometry(cells[0].firstElementChild);
	assert(cells[0].classList.contains("editable-indicator")
		&&getComputedStyle(cells[0],"::before").content==="none",
		"an unselected editable cell exposes its indicator hook without showing the pencil permanently");
	table.selectCell(row,"editable");
	const editIndicatorStyle=getComputedStyle(table._cellCursor,"::before");
	assert(cells[0].classList.contains("tablance-active-cell")
		&&table._cellCursor.classList.contains("editable-indicator")&&editIndicatorStyle.content==='""'
		&&(editIndicatorStyle.maskImage!=="none"||editIndicatorStyle.webkitMaskImage!=="none")
		&&editIndicatorStyle.pointerEvents==="none",
		"a selected editable cell shows a non-interactive pencil indicator");
	assert(JSON.stringify(geometry(cells[0]))===JSON.stringify(editableCellGeometry)
		&&JSON.stringify(geometry(cells[0].firstElementChild))===JSON.stringify(editableTextGeometry),
		"the pencil indicator does not move text or change cell dimensions");
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
		&&!table._cellCursor.classList.contains("action-indicator")
		&&!table._cellCursor.classList.contains("editable-indicator"),
		"native active-cell ownership moves while a button action keeps its own affordance");
	table.selectCell(row,"editable");
	assert(!cells[6].classList.contains("tablance-active-cell")&&cells[0].classList.contains("tablance-active-cell")
		&&!cells[0].classList.contains("action-indicator")&&!table._cellCursor.classList.contains("action-indicator")
		&&!table._cellCursor.classList.contains("read-only")
		&&table._cellCursor.classList.contains("editable-indicator"),
		"an editable active cell shows only the edit indicator");
	assert(table.selectCell(row,"disabledValue")===false&&!table._cellCursor.classList.contains("action-indicator"),
		"a disabled cell cannot show the selected action indicator");

	table.selectCell(row,"computed");
	const lockIndicatorStyle=getComputedStyle(table._cellCursor,"::before");
	assert(cells[1].classList.contains("read-only")&&!cells[1].classList.contains("action-indicator")
		&&cells[1].classList.contains("tablance-active-cell")&&table._cellCursor.classList.contains("read-only")
		&&!table._cellCursor.classList.contains("action-indicator")
		&&!table._cellCursor.classList.contains("editable-indicator")&&lockIndicatorStyle.content==="\"\""
		&&(lockIndicatorStyle.maskImage!=="none"||lockIndicatorStyle.webkitMaskImage!=="none"),
		"a selected readOnly cell shows Tablance's native lock without the action indicator");
	let copied="";
	Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:text=>{copied=text;return Promise.resolve();}}});
	const lockedPresentationRow={summary:"Ratsit",nested:{source:"Register",synced:"2026-09-01 10:15",
		gridSource:"Grid register"}};
	const lockedPresentationTable=new Tablance(host(),{
		main:{columns:[{title:"Source",dataKey:"summary",nodeId:"lockedMain",render:({value})=>value}]},
		details:{type:"list",entries:[{type:"group",title:"Metadata",nodeId:"metadataGroup",dataPath:"nested",
			entries:[{title:"Source",dataKey:"source",nodeId:"lockedDetail",render:({value})=>value},
				{type:"lineup",entries:[{type:"field",title:"Last synced",dataKey:"synced",
					nodeId:"lockedLineupDetail",readOnly:true,render:({value})=>value}]},
				{type:"grid",columns:1,entries:[{type:"field",title:"Grid source",dataKey:"gridSource",
					nodeId:"lockedGridDetail",readOnly:true,render:({value})=>value}]}]}]},
	},true,true,{searchbar:false});
	lockedPresentationTable.setData([lockedPresentationRow]);
	await tick();
	lockedPresentationTable.selectCell(lockedPresentationRow,"lockedMain");
	key(lockedPresentationTable.rootEl,"c","KeyC",{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="Ratsit","whole-cell Ctrl+C remains available for an implicit read-only main cell");
	const doubleClickLockedCursor=()=>lockedPresentationTable._cellCursor.dispatchEvent(
		new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	key(lockedPresentationTable.rootEl,"Enter","Enter");
	const mainLockFeedback=getComputedStyle(lockedPresentationTable._cellCursor,"::before");
	const [lockPivotX,lockPivotY]=mainLockFeedback.transformOrigin.split(" ").map(parseFloat);
	assert(lockedPresentationTable._cellCursor.classList.contains("read-only-activation-feedback")
		&&mainLockFeedback.animationName==="tablance-read-only-lock-feedback"
		&&mainLockFeedback.animationDuration==="0.62s"
		&&mainLockFeedback.width==="12px"&&mainLockFeedback.height==="12px"
		&&Math.abs(lockPivotX-6)<.01&&Math.abs(lockPivotY-1.5)<.01
		&&Math.abs(parseFloat(mainLockFeedback.left)-4)<.01
		&&Math.abs(parseFloat(mainLockFeedback.top)-2)<.01
		&&!lockedPresentationTable._inEditMode&&!lockedPresentationTable._inReadOnlyMode,
		"blocked main-cell activation animates only its existing lock while remaining non-activatable");
	const lockAnimation=document.getAnimations().find(animation=>
		animation.animationName==="tablance-read-only-lock-feedback");
	assert(JSON.stringify(lockAnimation?.effect.getKeyframes().map(frame=>frame.rotate))===JSON.stringify([
		"0deg","28deg","28deg","-28deg","-28deg","28deg","28deg",
		"-18deg","12deg","-8deg","4deg","0deg",
	]),"Chrome receives three forceful mechanical stops before the diminishing return swings");
	doubleClickLockedCursor();
	assert(lockedPresentationTable._cellCursor.classList.contains("read-only-activation-feedback"),
		"double-click restarts the same main-cell lock feedback without opening a presentation");
	for (const activate of [
		()=>key(lockedPresentationTable.rootEl,"Enter","Enter"),
		doubleClickLockedCursor,
		()=>lockedPresentationTable.selectCell(lockedPresentationRow,"lockedMain",{enterEditMode:true}),
	]) {
		activate();
		assert(!lockedPresentationTable._inEditMode&&!lockedPresentationTable._inReadOnlyMode
			&&!lockedPresentationTable._cellCursor.querySelector("input,textarea"),
			"implicit read-only main cells reject every normal activation path");
	}
	const lockedDetail=lockedPresentationTable.getDetailCell(lockedPresentationRow,"lockedDetail");
	lockedDetail.select();
	key(lockedPresentationTable.rootEl,"Enter","Enter");
	const lockedDetailTitle=lockedDetail.selEl.querySelector(":scope>span.title");
	const lockedDetailFeedback=getComputedStyle(lockedDetailTitle,"::after");
	assert(lockedDetail.selEl.classList.contains("read-only-activation-feedback")
		&&lockedDetailFeedback.animationName==="tablance-read-only-lock-feedback"
		&&lockedDetailFeedback.width==="12px"&&lockedDetailFeedback.height==="12px"
		&&Math.abs(parseFloat(lockedDetailFeedback.marginLeft)-4)<.01
		&&lockedDetailFeedback.transform==="none",
		"a blocked titled group field animates its inline lock rather than its cell");
	for (const activate of [
		()=>key(lockedPresentationTable.rootEl,"Enter","Enter"),
		doubleClickLockedCursor,
		()=>lockedPresentationTable.selectCell(lockedPresentationRow,"lockedDetail",{enterEditMode:true}),
	]) {
		activate();
		assert(!lockedPresentationTable._inEditMode&&!lockedPresentationTable._inReadOnlyMode
			&&!lockedPresentationTable._cellCursor.querySelector("input,textarea")
			&&lockedDetail.dataObj.source==="Register",
			"implicit read-only fields inside groups reject every normal activation path");
	}
	const lockedLineupDetail=lockedPresentationTable.getDetailCell(lockedPresentationRow,"lockedLineupDetail");
	lockedLineupDetail.select();
	key(lockedPresentationTable.rootEl,"Enter","Enter");
	const lockedLineupTitle=lockedLineupDetail.selEl.querySelector(":scope>span.title");
	assert(lockedLineupDetail.selEl.classList.contains("read-only-activation-feedback")
		&&getComputedStyle(lockedLineupTitle,"::after").animationName
			==="tablance-read-only-lock-feedback",
		"a blocked Lineup field applies feedback to the inline lock on its canonical cell");
	assert(getComputedStyle(lockedLineupTitle).paddingRight==="16px"
		&&!lockedLineupTitle.querySelector(".tablance-help-trigger"),
		"a Lineup label without help still reserves its lock inside the title box");
	for (const activate of [
		()=>key(lockedPresentationTable.rootEl,"Enter","Enter"),
		doubleClickLockedCursor,
		()=>lockedPresentationTable.selectCell(lockedPresentationRow,"lockedLineupDetail",{enterEditMode:true}),
	]) {
		activate();
		assert(!lockedPresentationTable._inEditMode&&!lockedPresentationTable._inReadOnlyMode
			&&!lockedPresentationTable._cellCursor.querySelector("input,textarea")
			&&lockedLineupDetail.dataObj.synced==="2026-09-01 10:15",
			"explicit read-only fields inside lineups reject every normal activation path");
	}
	const lockedGridDetail=lockedPresentationTable.getDetailCell(lockedPresentationRow,"lockedGridDetail");
	lockedGridDetail.select();
	key(lockedPresentationTable.rootEl,"Enter","Enter");
	assert(lockedGridDetail.selEl.classList.contains("read-only-activation-feedback")
		&&getComputedStyle(lockedGridDetail.selEl.querySelector(":scope>span.title"),"::after").animationName
			==="tablance-read-only-lock-feedback"
		&&!lockedPresentationTable._inEditMode&&!lockedPresentationTable._inReadOnlyMode,
		"a blocked Grid field receives identical lock-only feedback without changing activation state");

	key(table.rootEl,"c","KeyC",{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="Rendered age: 31","whole-cell Ctrl+C uses displayed text");
	key(table.rootEl,"Enter","Enter");
	let presentation=table._cellCursor.querySelector("textarea.read-only-presentation");
	assert(presentation?.readOnly&&presentation.getAttribute("aria-readonly")==="true"
		&&presentation.value==="Rendered age: 31",
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
	assert(nativeKeyboard.arrow&&nativeKeyboard.shiftArrow&&nativeKeyboard.end&&nativeKeyboard.home
		&&nativeKeyboard.copied!==undefined,
		"native navigation and copy events remain available to an opted-in readonly presentation");
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
	assert(!table._inEditMode&&!table._inReadOnlyMode&&!table._cellCursor.querySelector("input,textarea"),
		"Enter cannot activate an explicitly locked editor");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(!table._inEditMode&&!table._inReadOnlyMode&&!table._cellCursor.querySelector("input,textarea"),
		"double-click cannot activate an explicitly locked editor");
	table._inputVal="illegal";
	assert(table._doEditSave()===false&&row.explicit==="locked","final save guard rejects readOnly mutation");
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
	assert(actions===1&&!table._cellCursor.classList.contains("read-only-activation-feedback"),
		"onEnter action activates without an editor or read-only feedback");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(actions===2,"double-click preserves the existing text-action activation behavior");
	table.selectCell(row,"button");
	key(table.rootEl,"Enter","Enter");
	assert(buttonActions===1&&!table._cellCursor.classList.contains("read-only-activation-feedback"),
		"button control activates as an action without lock feedback");

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
	const detailStyle=getComputedStyle(detail.el);
	assert(detailStyle.paddingLeft==="5px"&&detailStyle.paddingTop==="12px"&&detailStyle.paddingBottom==="3px",
		`detail value content moves down without inheriting main-row indicator spacing or changing total padding (${detailStyle.paddingTop}/${detailStyle.paddingBottom}/${detailStyle.paddingLeft})`);
	detail.select();
	assert(detail.el.classList.contains("tablance-active-cell")&&!cells[1].classList.contains("tablance-active-cell"),
		"native active-cell ownership also follows selection into details");
	key(table.rootEl,"Enter","Enter");
	assert(table._cellCursor.querySelector("textarea")?.value==="DETAIL RENDERED","details presentation uses rendered text");
	table._exitReadOnlyMode();
	const notes=table.getDetailCell(0,"notes");
	notes.select();
	key(table.rootEl,"Enter","Enter");
	const notesEditor=table._cellCursor.querySelector("textarea");
	const newLineHint=table._cellCursor.querySelector(".tablance-textarea-shortcut-hint");
	const shortcutKeys=[...newLineHint.querySelectorAll("kbd")];
	const expectedModifier=table._textareaNewLineModifier();
	assert(notesEditor?.rows===1&&newLineHint
		&&shortcutKeys.length===2&&shortcutKeys[0].textContent===expectedModifier
		&&shortcutKeys[1].textContent==="Enter"&&newLineHint.textContent===`${expectedModifier} + Enter New line`
		&&notesEditor.getAttribute("aria-describedby")===newLineHint.id,
		"an opted-in textarea shows a semantic platform-specific new-line hint only in edit mode");
	assert(table._textareaNewLineModifier("Windows")==="Ctrl"
		&&table._textareaNewLineModifier("Linux")==="Ctrl"
		&&table._textareaNewLineModifier("macOS")==="⌘",
		"the new-line hint chooses Ctrl on Windows/Linux and Command on macOS");
	const notesEditorRect=notesEditor.getBoundingClientRect();
	const newLineHintRect=newLineHint.getBoundingClientRect();
	assert(parseFloat(getComputedStyle(notesEditor).paddingBottom)>=30
		&&newLineHintRect.left>=notesEditorRect.left&&newLineHintRect.right<=notesEditorRect.right
		&&newLineHintRect.bottom<=notesEditorRect.bottom-4,
		"the bottom-right shortcut hint stays inside the editor while reserved padding protects its text");
	notesEditor.value="First";
	notesEditor.setSelectionRange(notesEditor.value.length,notesEditor.value.length);
	const ctrlEnter=key(notesEditor,"Enter","Enter",{ctrlKey:true});
	assert(ctrlEnter.defaultPrevented&&notesEditor.value==="First\n"&&notesEditor.selectionStart===6
		&&table._inEditMode,
		"Ctrl+Enter inserts exactly one new line and keeps textarea edit mode active");
	const commandEnter=key(notesEditor,"Enter","Enter",{metaKey:true});
	assert(commandEnter.defaultPrevented&&notesEditor.value==="First\n\n"&&notesEditor.selectionStart===7
		&&table._inEditMode,
		"Command+Enter inserts exactly one new line and keeps textarea edit mode active");
	notesEditor.value="One line";
	notesEditor.dispatchEvent(new Event("input",{bubbles:true}));
	const oneLineHeight=parseFloat(table._selectedCell.style.height);
	notesEditor.value="First line\nSecond line";
	notesEditor.dispatchEvent(new Event("input",{bubbles:true}));
	const twoLineHeight=parseFloat(table._selectedCell.style.height);
	notesEditor.value="One line";
	notesEditor.dispatchEvent(new Event("input",{bubbles:true}));
	assert(twoLineHeight>oneLineHeight&&parseFloat(table._selectedCell.style.height)===oneLineHeight,
		"textarea auto-resize grows for multiple lines and returns consistently to one-line height");
	table._exitEditMode(false);
	assert(!table._cellCursor.querySelector(".tablance-textarea-shortcut-hint"),
		"the new-line shortcut hint is removed when textarea edit mode closes");

	const textareaHeightRow={label:"Textarea heights",empty:"",oneLine:"One line",
		multiLine:"First line\nSecond line\nThird line",preset:"Preset height"};
	const textareaHeightTable=new Tablance(host(),{
		main:{columns:[{title:"Case",dataKey:"label"}]},
		details:{type:"list",entries:[
			{title:"Empty",dataKey:"empty",nodeId:"heightEmpty",
				input:{type:"textarea",newLineShortcutHint:true}},
			{title:"One line",dataKey:"oneLine",nodeId:"heightOneLine",
				input:{type:"textarea",newLineShortcutHint:true}},
			{title:"Multiple lines",dataKey:"multiLine",nodeId:"heightMultiLine",
				input:{type:"textarea",newLineShortcutHint:true}},
			{title:"Preset",dataKey:"preset",nodeId:"heightPreset",
				input:{type:"textarea",newLineShortcutHint:true}},
		]},
	},true,true,{searchbar:false,ordering:false});
	textareaHeightTable.setData([textareaHeightRow]);
	textareaHeightTable.expandRow(0,false);
	await tick();
	const textareaHeightDetails=textareaHeightTable._mainTbody.querySelector("tr.details");
	const textareaHeightContent=textareaHeightDetails.querySelector(".content");
	const measureTextareaLayout=cell=>({
		cellHeight:cell.el.getBoundingClientRect().height,
		contentHeight:textareaHeightContent.getBoundingClientRect().height,
		inlineHeight:cell.el.style.height,
	});
	const assertTextareaLayoutRestored=(before,cell,message)=>{
		const after=measureTextareaLayout(cell);
		const cursorRect=textareaHeightTable._cellCursor.getBoundingClientRect();
		const cellRect=cell.el.getBoundingClientRect();
		const mainRowHeight=textareaHeightTable._naturalAutoHeight
			?textareaHeightDetails.previousElementSibling.offsetHeight+textareaHeightTable._borderSpacingY
			:textareaHeightTable._rowHeight;
		const expectedDetailsHeight=mainRowHeight+textareaHeightDetails.offsetHeight
			+textareaHeightTable._borderSpacingY;
		const recordedDetailsHeight=textareaHeightTable._rowMeta.get(textareaHeightRow)?.h;
		assert(Math.abs(after.cellHeight-before.cellHeight)<1
			&&after.inlineHeight===before.inlineHeight
			&&Math.abs(cursorRect.height-cellRect.height)<1
			&&textareaHeightContent.style.height==="auto"
			&&Math.abs(recordedDetailsHeight-expectedDetailsHeight)<1,
			`${message}: ${JSON.stringify({before,after,cursorHeight:cursorRect.height,cellHeight:cellRect.height,
				recordedDetailsHeight,expectedDetailsHeight})}`);
	};

	const emptyHeightCell=textareaHeightTable.getDetailCell(0,"heightEmpty");
	emptyHeightCell.select();
	const emptyHeightBefore=measureTextareaLayout(emptyHeightCell);
	key(textareaHeightTable.rootEl,"Enter","Enter");
	const emptyHeightEditor=textareaHeightTable._cellCursor.querySelector("textarea");
	assert(emptyHeightEditor&&emptyHeightCell.el.getBoundingClientRect().height>emptyHeightBefore.cellHeight,
		"an empty textarea can reserve shortcut-hint space while editing");
	textareaHeightTable._exitEditMode(false);
	assertTextareaLayoutRestored(emptyHeightBefore,emptyHeightCell,
		"cancel restores an empty textarea's compact read height, details height, cursor, and prior inline height");

	const oneLineHeightCell=textareaHeightTable.getDetailCell(0,"heightOneLine");
	oneLineHeightCell.select();
	const oneLineHeightBefore=measureTextareaLayout(oneLineHeightCell);
	key(textareaHeightTable.rootEl,"Enter","Enter");
	const oneLineHeightEditor=textareaHeightTable._cellCursor.querySelector("textarea");
	oneLineHeightEditor.value="Saved one line";
	oneLineHeightEditor.dispatchEvent(new Event("input",{bubbles:true}));
	oneLineHeightEditor.dispatchEvent(new Event("change",{bubbles:true}));
	textareaHeightTable._exitEditMode(true);
	assert(textareaHeightRow.oneLine==="Saved one line","ordinary textarea save still commits its value");
	assertTextareaLayoutRestored(oneLineHeightBefore,oneLineHeightCell,
		"save restores a one-line textarea's natural read height and previous empty inline height");

	const multiLineHeightCell=textareaHeightTable.getDetailCell(0,"heightMultiLine");
	multiLineHeightCell.select();
	const multiLineHeightBefore=measureTextareaLayout(multiLineHeightCell);
	key(textareaHeightTable.rootEl,"Enter","Enter");
	const multiLineHeightEditor=textareaHeightTable._cellCursor.querySelector("textarea");
	const multiLineEditHeight=multiLineHeightEditor.getBoundingClientRect().height;
	multiLineHeightEditor.value="One line";
	multiLineHeightEditor.dispatchEvent(new Event("input",{bubbles:true}));
	assert(multiLineHeightEditor.getBoundingClientRect().height<multiLineEditHeight,
		"a multiline textarea still shrinks naturally during editing");
	key(multiLineHeightEditor,"Escape","Escape");
	assert(!textareaHeightTable._inEditMode&&textareaHeightRow.multiLine==="First line\nSecond line\nThird line",
		"Escape cancels multiline textarea editing without changing its value");
	assertTextareaLayoutRestored(multiLineHeightBefore,multiLineHeightCell,
		"Escape restores a multiline textarea's natural read height and previous inline height");

	const presetHeightCell=textareaHeightTable.getDetailCell(0,"heightPreset");
	presetHeightCell.el.style.height="73px";
	presetHeightCell.select();
	const presetHeightBefore=measureTextareaLayout(presetHeightCell);
	key(textareaHeightTable.rootEl,"Enter","Enter");
	const presetHeightEditor=textareaHeightTable._cellCursor.querySelector("textarea");
	presetHeightEditor.value="First line\nSecond line";
	presetHeightEditor.dispatchEvent(new Event("input",{bubbles:true}));
	textareaHeightTable._exitEditMode(false);
	assertTextareaLayoutRestored(presetHeightBefore,presetHeightCell,
		"textarea cleanup restores an exact legitimate pre-existing inline height instead of removing it");
	const fileButtons=[...table._mainTbody.querySelector('tr.details').querySelectorAll("button")];
	assert(fileButtons.find(button=>button.textContent==="Open")?.disabled===false,
		"existing readOnly file retains its non-mutating open action");
	assert(fileButtons.filter(button=>button.textContent!=="Open").every(button=>button.disabled),
		"existing readOnly file disables delete mutation controls");
	const generatedFileGroup=fileButtons[0].closest(".details-group");
	assert(generatedFileGroup.querySelector(".lineup-metadata")
		&&generatedFileGroup.querySelector(".delete-controls.lineup-controls"),
		"generated file metadata and mutation actions use semantic metadata/control lineups");

	const historyGroup=table.getDetailCell(0,"historyGroup");
	const historyGroupValueStyle=getComputedStyle(historyGroup.viewportEl.parentElement);
	assert(historyGroupValueStyle.paddingTop==="5px"&&historyGroupValueStyle.paddingBottom==="5px",
		`detail group containers retain their original vertical padding (${historyGroupValueStyle.paddingTop}/${historyGroupValueStyle.paddingBottom})`);
	const safeTextRender=table.getDetailCell(0,"safeTextGroup").el.querySelector("tbody>tr.group-render>td");
	const trustedHtmlRender=table.getDetailCell(0,"trustedHtmlGroup").el.querySelector("tbody>tr.group-render>td");
	assert(safeTextRender.textContent==="<u>literal</u>"&&!safeTextRender.querySelector("u"),
		"closedRender remains injection-safe text by default");
	assert(trustedHtmlRender.textContent==="underlined"&&trustedHtmlRender.querySelector("u"),
		"closedRenderHtml explicitly enables trusted markup for closed groups");
	const historyGroupChevron=historyGroup.groupChevronEl;
	const initiallyNestedHistoryEntries=historyGroup.children[0].children;
	const initialChevronState=[historyGroupChevron?.classList.contains("group-chevron"),!historyGroupChevron?.hidden,
		historyGroupChevron?.getAttribute("aria-hidden")==="true",
		historyGroupChevron?.closest("table")===historyGroup.el,
		historyGroupChevron?.parentElement===historyGroup.el,
		!table.rootEl.querySelector(".group-chevron-footer"),
		["flex","inline-flex"].includes(getComputedStyle(historyGroupChevron).display),
		getComputedStyle(historyGroupChevron).pointerEvents==="none",
		initiallyNestedHistoryEntries.every(entry=>entry.groupChevronEl.hidden)];
	assert(initialChevronState.every(Boolean),
		`only the current closed atomic group exposes a non-interactive preview-adjacent chevron (${initialChevronState})`);
	const closedHistoryPreviewRect=historyGroup.containerEl.getBoundingClientRect();
	const closedHistoryChevronRect=historyGroupChevron.getBoundingClientRect();
	assert(Math.abs((closedHistoryPreviewRect.top+closedHistoryPreviewRect.bottom)/2
		-(closedHistoryChevronRect.top+closedHistoryChevronRect.bottom)/2)<1
		&&closedHistoryChevronRect.left>=closedHistoryPreviewRect.right,
		"a parent chevron is vertically centered against the complete multi-row preview");
	assert(initiallyNestedHistoryEntries.every(entry=>entry.detailsAffordancesExposed===false
		&&entry.el.classList.contains("details-affordances-suppressed")
		&&entry.el.querySelector(".group-closed-content")?.getClientRects().length
		&&getComputedStyle(entry.el).borderTopColor==="rgba(0, 0, 0, 0)"
		&&getComputedStyle(entry.el).boxShadow==="none"),
		"nested groups keep preview content but suppress their own boundaries behind a closed nearest group");
	const visualHierarchyGroup=table.getDetailCell(0,"visualHierarchyGroup");
	const hierarchyGrid=visualHierarchyGroup.children[0];
	const hierarchyLineup=hierarchyGrid.children[0];
	const hierarchyField=hierarchyLineup.children[0];
	const deepVisualGroup=hierarchyGrid.children[1];
	const deepFieldSeparator=deepVisualGroup.children[1].selEl.querySelector(":scope>.separator");
	assert(visualHierarchyGroup.detailsAffordancesExposed===true&&!visualHierarchyGroup.groupChevronEl.hidden
		&&getComputedStyle(visualHierarchyGroup.el).borderTopColor==="rgb(200, 205, 211)",
		"a top-level group exposes its own border and chevron");
	assert(deepVisualGroup.el.querySelector(".group-closed-content")?.textContent==="Nested preview"
		&&deepVisualGroup.detailsAffordancesExposed===false&&deepVisualGroup.groupChevronEl.hidden
		&&getComputedStyle(deepVisualGroup.el).borderTopColor==="rgba(0, 0, 0, 0)"
		&&getComputedStyle(hierarchyGrid.gridRowSeparators[0]).display==="none"
		&&hierarchyGrid.gridRowExtensions.every(extension=>getComputedStyle(extension).display==="none")
		&&getComputedStyle(hierarchyField.selEl,"::before").display==="none",
		"the nearest closed ancestor group suppresses group, group-row, Grid and Lineup affordances through containers");
	visualHierarchyGroup.select();
	key(table.rootEl,"Enter","Enter");
	const openedHierarchyState=[visualHierarchyGroup.el.classList.contains("open"),
		deepVisualGroup.detailsAffordancesExposed===true,!deepVisualGroup.groupChevronEl.hidden,
		getComputedStyle(deepVisualGroup.el).borderTopColor==="rgb(200, 205, 211)",
		getComputedStyle(hierarchyGrid.gridRowSeparators[0]).display==="block",
		hierarchyGrid.gridRowExtensions.every(extension=>getComputedStyle(extension).display!=="none"),
		getComputedStyle(hierarchyField.selEl,"::before").display==="block",
		getComputedStyle(deepFieldSeparator).display==="none"];
	assert(openedHierarchyState.every(Boolean),
		`opening the nearest group restores child affordances while a deeper closed group still suppresses its children (${openedHierarchyState})`);
	deepVisualGroup.select();
	key(table.rootEl,"Enter","Enter");
	assert(deepVisualGroup.el.classList.contains("open")&&getComputedStyle(deepFieldSeparator).display==="block",
		"opening the nearest nested group restores its descendants' separators");
	assert(table._closeGroup(deepVisualGroup)&&table._closeGroup(visualHierarchyGroup),
		"the presentation-state checks leave nested groups closable through their ordinary lifecycle");
	historyGroup.select();
	const selectedHistoryGroupTextPosition=historyGroup.el.querySelector("td").getBoundingClientRect().left;
	key(table.rootEl,"Enter","Enter");
	const historyEntries=historyGroup.children[0].children;
	assert(historyGroup.el.classList.contains("open")
		&&historyGroupChevron.hidden
		&&!table.rootEl.querySelector(".group-chevron-footer")
		&&historyEntries.every(entry=>!entry.groupChevronEl.hidden)
		&&historyGroup.el.querySelector("td").getBoundingClientRect().left===selectedHistoryGroupTextPosition,
		"opening a group hides its own chevron and exposes its closed child groups without moving content");
	assert(historyEntries.every(entry=>getComputedStyle(entry.viewportEl.parentElement.parentElement).paddingTop==="2px"),
		"every nested group row reserves the same space above its selection outline");
	const groupStyles=[getComputedStyle(historyGroup.el),getComputedStyle(historyEntries[0].el)];
	assert(groupStyles.every(style=>["Top","Right","Bottom","Left"].every(side=>
		style[`border${side}Width`]==="1px"&&style[`border${side}Style`]==="solid"
			&&style[`border${side}Color`]==="rgb(200, 205, 211)"))
		&&groupStyles.every(style=>style.boxShadow.includes("rgba(71, 86, 106, 0.1)")
			&&style.boxShadow.match(/rgba\(148, 163, 184, 0\.1\)/g)?.length===2
			&&style.boxShadow.includes("rgba(51, 65, 85, 0.1)")
			&&!style.boxShadow.includes("7px 7px 8px")
			&&style.boxShadow.split("inset").length===5)
		&&getComputedStyle(historyGroup.el).backgroundColor==="rgba(0, 0, 0, 0)"
		&&getComputedStyle(historyEntries[0].el).backgroundColor==="rgba(0, 0, 0, 0)"
		&&getComputedStyle(historyGroup.el).borderTopLeftRadius==="8px"
		&&getComputedStyle(historyEntries[0].el).borderTopLeftRadius==="8px"
		&&getComputedStyle(historyGroup.el).overflow==="hidden"
		&&getComputedStyle(historyEntries[0].el).overflow==="hidden"
		&&getComputedStyle(historyGroup.el).borderCollapse==="separate"
		&&getComputedStyle(historyEntries[0].el).borderSpacing==="0px 0px",
		"details groups use the finalized transparent inset design and clip child hover to their rounded shape");
	historyEntries[1].select();
	await waitFor(()=>!historyGroup.viewportEl._tablanceGroupTransition,"history group animation cleanup");
	const nestedGroupChevron=historyEntries[0].groupChevronEl;
	const groupHoverHost=table.rootEl.parentElement;
	groupHoverHost.style.position="fixed";
	groupHoverHost.style.inset="0 auto auto 0";
	groupHoverHost.style.zIndex="100";
	table._scrollBody.style.height="1100px";
	table._scrollBody.style.overflow="visible";
	table._scrollBody.scrollTop=0;
	await tick();
	table._scrollBody.scrollTop=0;
	const nestedClosedRender=historyEntries[0].el.querySelector("tbody>tr.group-render>td");
	const idleChevronStyle=getComputedStyle(nestedGroupChevron);
	const idleChevronGlyphStyle=getComputedStyle(nestedGroupChevron,"::before");
	const chevronLayout=()=>{
		const chevronRect=nestedGroupChevron.getBoundingClientRect();
		const groupRect=historyEntries[0].el.getBoundingClientRect();
		return [chevronRect.left-groupRect.left,chevronRect.top-groupRect.top,
			chevronRect.width,chevronRect.height];
	};
	const idleChevronLayout=chevronLayout();
	assert(nestedGroupChevron?.classList.contains("group-chevron")
		&&nestedClosedRender.lastElementChild?.classList.contains("group-closed-content")
		&&nestedGroupChevron.parentElement===historyEntries[0].el
		&&nestedGroupChevron.previousElementSibling===historyEntries[0].containerEl
		&&getComputedStyle(nestedGroupChevron).marginLeft==="6px"
		&&getComputedStyle(nestedGroupChevron).backgroundColor!=="rgba(0, 0, 0, 0)"
		&&getComputedStyle(nestedGroupChevron,"::before").content==='""'
		&&getComputedStyle(nestedGroupChevron).pointerEvents==="none",
		"closedRender groups place the chevron's subtle non-interactive icon container after the preview table");
	assert(idleChevronGlyphStyle.opacity==="0.72"&&idleChevronStyle.color==="rgb(100, 116, 139)",
		"an idle group chevron keeps its existing muted presentation");
	const nativeGroupHoverDone=new Promise((resolve,reject)=>{
		const timeout=setTimeout(()=>reject(new Error("Timed out waiting for trusted group hover")),5000);
		historyEntries[0].el.addEventListener("mousemove",()=>{
			clearTimeout(timeout);
			setTimeout(resolve,180);
		},{once:true});
	});
	window.nativeGroupHoverTarget=nestedGroupChevron;
	result.textContent="awaiting trusted group hover";
	result.dataset.status="awaiting-native-group-hover";
	await nativeGroupHoverDone;
	const hoverChevronLayout=chevronLayout();
	assert(historyEntries[0].el.matches(":hover")
		&&getComputedStyle(nestedGroupChevron,"::before").opacity==="1"
		&&JSON.stringify(hoverChevronLayout)===JSON.stringify(idleChevronLayout),
		"hover strengthens the existing group chevron without changing its size or position");
	const longSummaryGroup=table.getDetailCell(0,"longSummaryGroup");
	longSummaryGroup.el.style.width="240px";
	const longSummaryContent=longSummaryGroup.el.querySelector(".group-closed-content");
	const longSummaryChevron=longSummaryGroup.groupChevronEl;
	const textRange=document.createRange();
	textRange.selectNodeContents(longSummaryContent);
	const lastTextRect=[...textRange.getClientRects()].at(-1);
	const longChevronRect=longSummaryChevron.getBoundingClientRect();
	assert(longSummaryChevron.previousElementSibling===longSummaryGroup.containerEl
		&&(longChevronRect.top>lastTextRect.top||longChevronRect.left>=lastTextRect.right),
		"long closedRender content wraps with its inline chevron without overlap");
	assert(table.getDetailCell(0,"disabledGroup").groupChevronEl.hidden,
		"a disabled group does not advertise an open action with a chevron");
	const phoneEmptyGroup=table.getDetailCell(0,"emptyGroup");
	assert(!phoneEmptyGroup.groupChevronEl.hidden
		&&phoneEmptyGroup.groupChevronEl.parentElement===phoneEmptyGroup.el,
		"an empty group keeps its chevron inside its own visual container without footer markup");
	const lazyEmptyGroup=table.getDetailCell(0,"lazyEmptyGroup");
	assert(!lazyEmptyGroup.creating&&!lazyEmptyGroup.groupChevronEl.hidden,
		"a static group with a lazily created dataPath is not mistaken for a repeated-entry draft");
	lazyEmptyGroup.select();
	key(table.rootEl,"Enter","Enter");
	assert(lazyEmptyGroup.el.classList.contains("open")&&table._activeDetailsCell===lazyEmptyGroup.children[0],
		"a lazy empty static group opens and exposes its first editable field");
	assert(table._closeGroup(lazyEmptyGroup)===true&&lazyEmptyGroup.el.isConnected
		&&!lazyEmptyGroup.el.classList.contains("open")&&table.getDetailCell(0,"lazyEmptyGroup")===lazyEmptyGroup,
		"closing an untouched lazy empty static group preserves its instance and DOM cell");
	table._ignoreClicksUntil=0;
	lazyEmptyGroup.selEl.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(table._activeDetailsCell===lazyEmptyGroup&&table._selectedCell===lazyEmptyGroup.selEl,
		"the untouched lazy empty static group remains pointer-selectable after it closes");
	key(table.rootEl,"Enter","Enter");
	assert(lazyEmptyGroup.el.classList.contains("open")&&table._activeDetailsCell===lazyEmptyGroup.children[0],
		"the untouched lazy empty static group can be opened again after it closes");
	historyEntries[0].select();
	assert(table._selectedCellState?.kind==="action","a closed-render group selection retains its canonical action state");
	await new Promise(resolve=>setTimeout(resolve,150));
	const selectedChevronStyle=getComputedStyle(nestedGroupChevron);
	const selectedChevronLayout=chevronLayout();
	assert(historyEntries[0].el.classList.contains("tablance-selected-group")
		&&!historyEntries[1].el.classList.contains("tablance-selected-group")
		&&selectedChevronStyle.color==="rgb(37, 99, 235)"
		&&selectedChevronStyle.backgroundColor==="rgba(37, 99, 235, 0.18)"
		&&selectedChevronStyle.borderTopColor==="rgba(37, 99, 235, 0.55)"
		&&getComputedStyle(nestedGroupChevron,"::before").opacity==="1"
		&&JSON.stringify(selectedChevronLayout)===JSON.stringify(idleChevronLayout),
		"selection accents the existing group chevron without adding space or moving it");
	table._scrollBody.style.removeProperty("height");
	table._scrollBody.style.removeProperty("overflow");
	groupHoverHost.style.removeProperty("position");
	groupHoverHost.style.removeProperty("inset");
	groupHoverHost.style.removeProperty("z-index");
	assert(table._cellCursor.classList.contains("group-cell-cursor")
		&&getComputedStyle(table._cellCursor).outlineOffset==="-1px",
		"a selected details group draws its outline one pixel inward on every side");
	const closedGroupRenderStyle=getComputedStyle(historyEntries[0].el.querySelector("tbody>tr.group-render>td"));
	assert(closedGroupRenderStyle.paddingLeft==="4px"&&closedGroupRenderStyle.paddingTop==="2px"
		&&closedGroupRenderStyle.paddingBottom==="2px",
		"a closed group render uses compact horizontal and vertical padding");
	const nestedGroupCellStyle=getComputedStyle(historyEntries[0].viewportEl.parentElement);
	assert(nestedGroupCellStyle.paddingRight==="4px"&&getComputedStyle(historyEntries[0].el).boxSizing==="border-box",
		"a nested group keeps visible space between its right border and its parent border");
	const firstHistorySeparator=historyEntries[0].children[0].selEl.querySelector(":scope>.separator");
	assert(getComputedStyle(firstHistorySeparator).display==="none"
		&&getComputedStyle(firstHistorySeparator).marginLeft==="0px"
		&&getComputedStyle(firstHistorySeparator).marginRight==="4px",
		"entities behind their closed nearest group suppress their own separators");
	key(table.rootEl,"Enter","Enter");
	assert(historyEntries[0].el.classList.contains("open")&&table._activeSchemaNode.title==="Date",
		"Enter opens a selected closed-render group and selects its first editable field");
	assert(nestedGroupChevron.hidden,
		"an open child group no longer displays an open-state chevron");
	const [editableHistoryField,readOnlyHistoryField]=historyEntries[0].children;
	assert(getComputedStyle(editableHistoryField.selEl).paddingLeft==="4px"
		&&getComputedStyle(readOnlyHistoryField.selEl).paddingLeft==="4px"
		&&getComputedStyle(editableHistoryField.selEl.querySelector(":scope>span.title"),"::after").content==='""',
		"group value fields retain their compact left edge while the active editable field shows its pencil");
	const readOnlyTitle=readOnlyHistoryField.selEl.querySelector(":scope>span.title");
	const readOnlyValue=readOnlyHistoryField.selEl.querySelector(":scope>div.value");
	const layoutWithoutIndicator={
		cellHeight:readOnlyHistoryField.selEl.getBoundingClientRect().height,
		titleTop:readOnlyTitle.getBoundingClientRect().top,
		titleHeight:readOnlyTitle.getBoundingClientRect().height,
		valueTop:readOnlyValue.getBoundingClientRect().top,
	};
	readOnlyHistoryField.select();
	const readOnlyTitleIndicator=getComputedStyle(readOnlyTitle,"::after");
	const layoutWithIndicator={
		cellHeight:readOnlyHistoryField.selEl.getBoundingClientRect().height,
		titleTop:readOnlyTitle.getBoundingClientRect().top,
		titleHeight:readOnlyTitle.getBoundingClientRect().height,
		valueTop:readOnlyValue.getBoundingClientRect().top,
	};
	assert(readOnlyHistoryField.selEl.classList.contains("read-only")
		&&table._cellCursor.classList.contains("inline-title-indicator")
		&&getComputedStyle(table._cellCursor,"::before").content==="none"
		&&readOnlyTitleIndicator.content==='""'&&readOnlyTitleIndicator.width==="12px"
		&&readOnlyTitleIndicator.marginLeft==="4px"&&readOnlyTitleIndicator.position==="absolute"
		&&JSON.stringify(layoutWithIndicator)===JSON.stringify(layoutWithoutIndicator),
		"a selected group-field indicator is rendered inline directly after its title instead of at the cell edge");
	const lockedGroupTitleHtml=readOnlyTitle.innerHTML;
	const lockedGroupValue=readOnlyHistoryField.dataObj.event;
	copied="";
	key(table.rootEl,"c","KeyC",{ctrlKey:true});
	await Promise.resolve();
	assert(copied===lockedGroupValue,
		`copying a titled group field includes only its value, never its label (${JSON.stringify(copied)})`);
	key(table.rootEl,"Enter","Enter");
	assert(!table._inEditMode&&!table._inReadOnlyMode&&!table._cellCursor.querySelector("input,textarea")
		&&readOnlyTitle.innerHTML===lockedGroupTitleHtml&&readOnlyHistoryField.dataObj.event===lockedGroupValue,
		"a locked titled group field cannot activate an editor or involve its label via Enter");
	table._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
	assert(!table._inEditMode&&!table._inReadOnlyMode&&!table._cellCursor.querySelector("input,textarea")
		&&readOnlyTitle.innerHTML===lockedGroupTitleHtml&&readOnlyHistoryField.dataObj.event===lockedGroupValue,
		"a locked titled group field cannot activate an editor or involve its label via double-click");
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="solid"
		&&getComputedStyle(firstHistorySeparator).marginLeft==="0px"
		&&getComputedStyle(firstHistorySeparator).marginRight==="4px",
		"open inner cell separators become solid while retaining the same indentation");
	historyEntries[0].el.classList.remove("open");
	table._syncGroupChevronVisibility(historyEntries[0]);
	assert(getComputedStyle(firstHistorySeparator).display==="none"
		&&!nestedGroupChevron.hidden,
		"closing a nested group suppresses descendant separators while exposing the group's own chevron");
	historyEntries[0].el.classList.add("open");
	table._syncGroupChevronVisibility(historyEntries[0]);
	const openGroupFieldStyle=getComputedStyle(historyEntries[0].children[0].selEl);
	assert(openGroupFieldStyle.paddingLeft==="4px"&&openGroupFieldStyle.paddingTop==="4px"
		&&openGroupFieldStyle.paddingBottom==="0px",
		`separate value fields inside an open group retain compact padding without an indicator gutter (${openGroupFieldStyle.paddingTop}/${openGroupFieldStyle.paddingBottom}/${openGroupFieldStyle.paddingLeft})`);
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

	const lineupVariantTable=new Tablance(host(),{main:{columns:[{dataKey:"name"}]},details:{type:"list",entries:[
		{type:"lineup",entries:[
			{type:"field",title:"Street",dataKey:"street",nodeId:"variantStreet",input:{type:"text"}},
			{type:"field",title:"Apartment",dataKey:"apartment",nodeId:"variantApartment",input:{type:"text"}},
		]},
		{type:"lineup",entries:[
			{type:"field",title:"Source",dataKey:"source",nodeId:"variantSource",
				help:"Source help",readOnlyPresentation:true},
			{type:"field",title:"Synced",dataKey:"synced",nodeId:"variantSynced"},
		]},
		{type:"lineup",entries:[
			{type:"field",nodeId:"variantControl",input:{type:"button",text:"Open"}},
		]},
		{type:"lineup",variant:"fields",entries:[
			{type:"field",title:"Forced field one",dataKey:"source",nodeId:"forcedFieldOne"},
			{type:"field",title:"Forced field two",dataKey:"synced",nodeId:"forcedFieldTwo"},
			{type:"field",title:"Forced action",dataKey:"source",nodeId:"forcedAction",onEnter:()=>{}},
			{type:"field",title:"Help action",help:"Action help",dataKey:"source",
				nodeId:"forcedHelpAction",onEnter:()=>{}},
		]},
		{type:"lineup",variant:"metadata",entries:[
			{type:"field",title:"Forced metadata",dataKey:"street",nodeId:"forcedMetadata",
				input:{type:"text"}},
		]},
	]}},true,true,{searchbar:false,ordering:false});
	lineupVariantTable.setData([{name:"Variants",street:"Norrings väg 3",apartment:"",
		source:"Ratsit",synced:"2022-01-31 18:04"}]);
	await tick();
	const variantStreet=lineupVariantTable.getDetailCell(0,"variantStreet");
	const variantApartment=lineupVariantTable.getDetailCell(0,"variantApartment");
	const variantSource=lineupVariantTable.getDetailCell(0,"variantSource");
	const variantSynced=lineupVariantTable.getDetailCell(0,"variantSynced");
	const variantControl=lineupVariantTable.getDetailCell(0,"variantControl");
	const forcedFieldOne=lineupVariantTable.getDetailCell(0,"forcedFieldOne");
	const forcedFieldTwo=lineupVariantTable.getDetailCell(0,"forcedFieldTwo");
	const forcedAction=lineupVariantTable.getDetailCell(0,"forcedAction");
	const forcedHelpAction=lineupVariantTable.getDetailCell(0,"forcedHelpAction");
	const forcedMetadata=lineupVariantTable.getDetailCell(0,"forcedMetadata");
	assert(variantStreet.parent.containerEl.classList.contains("lineup-fields")
		&&variantSource.parent.containerEl.classList.contains("lineup-metadata")
		&&variantControl.parent.containerEl.classList.contains("lineup-controls")
		&&forcedFieldOne.parent.containerEl.classList.contains("lineup-fields")
		&&forcedMetadata.parent.containerEl.classList.contains("lineup-metadata"),
		"lineup auto inference and explicit overrides resolve all semantic variants");
	const fieldSeparatorStyle=getComputedStyle(variantApartment.outerContainerEl,"::before");
	assert(getComputedStyle(variantStreet.el).borderTopWidth==="0px"
		&&fieldSeparatorStyle.borderInlineStartWidth==="1px"
		&&fieldSeparatorStyle.borderInlineStartStyle==="solid",
		"field lineups present clean values with a native separator between logical cells");
	assert(getComputedStyle(variantSynced.outerContainerEl,"::before").content==="none"
		&&getComputedStyle(variantControl.outerContainerEl,"::before").content==="none"
		&&getComputedStyle(forcedMetadata.outerContainerEl,"::before").content==="none",
		"metadata and controls remain compact and separator-free");
	assert(getComputedStyle(forcedFieldTwo.outerContainerEl,"::before").borderInlineStartWidth==="1px",
		"an explicit fields override also receives field separators without consumer CSS");
	assert(variantStreet.selEl===variantStreet.outerContainerEl&&variantStreet.el!==variantStreet.selEl
		&&variantControl.selEl===variantControl.outerContainerEl&&variantControl.el!==variantControl.selEl,
		"the outer lineup item is the canonical selectable cell while the inner value remains the render surface");
	const streetTitle=variantStreet.outerContainerEl.querySelector(":scope>span.title");
	const streetLayoutBefore={
		cellHeight:variantStreet.outerContainerEl.getBoundingClientRect().height,
		titleLeft:streetTitle.getBoundingClientRect().left,
		titleTop:streetTitle.getBoundingClientRect().top,
		titleHeight:streetTitle.getBoundingClientRect().height,
	};
	assert(getComputedStyle(streetTitle).paddingRight==="16px"
		&&getComputedStyle(streetTitle,"::after").content==="none",
		"an inactive editable Lineup cell reserves stable title space without showing its pencil permanently");
	variantStreet.select();
	const streetRect=variantStreet.outerContainerEl.getBoundingClientRect();
	const streetCursorRect=lineupVariantTable._cellCursor.getBoundingClientRect();
	const streetTitleRect=streetTitle.getBoundingClientRect();
	const streetLayoutSelected={
		cellHeight:variantStreet.outerContainerEl.getBoundingClientRect().height,
		titleLeft:streetTitleRect.left,
		titleTop:streetTitleRect.top,
		titleHeight:streetTitleRect.height,
	};
	assert(Math.abs(streetCursorRect.left-streetRect.left)<1&&Math.abs(streetCursorRect.top-streetRect.top)<1
		&&Math.abs(streetCursorRect.width-streetRect.width)<1&&Math.abs(streetCursorRect.height-streetRect.height)<1
		&&streetTitleRect.top>=streetCursorRect.top&&streetTitleRect.bottom<=streetCursorRect.bottom
		&&getComputedStyle(streetTitle,"::after").content==='""'
		&&getComputedStyle(lineupVariantTable._cellCursor,"::before").content==="none"
		&&JSON.stringify(streetLayoutSelected)===JSON.stringify(streetLayoutBefore),
		"a Lineup cursor and pencil cover the logical cell without moving its title");
	const sourceTitle=variantSource.outerContainerEl.querySelector(":scope>span.title");
	const sourceTitleStyle=getComputedStyle(sourceTitle);
	assert(sourceTitleStyle.paddingRight==="16px"
		&&getComputedStyle(sourceTitle,"::after").right==="0px"
		&&variantSource.helpTriggerEl?.closest(".tablance-title-layout"),
		"a Lineup title with help permanently reserves its inline lock inside its own cellbox");
	const sourceLayoutBefore={
		cellHeight:variantSource.outerContainerEl.getBoundingClientRect().height,
		titleLeft:sourceTitle.getBoundingClientRect().left,
		titleTop:sourceTitle.getBoundingClientRect().top,
		titleHeight:sourceTitle.getBoundingClientRect().height,
	};
	assert(getComputedStyle(sourceTitle,"::after").content==="none",
		"an inactive textlike read-only Lineup cell does not show a state icon");
	variantSource.select();
	const selectedSourceIndicator=getComputedStyle(sourceTitle,"::after");
	const sourceLayoutSelected={
		cellHeight:variantSource.outerContainerEl.getBoundingClientRect().height,
		titleLeft:sourceTitle.getBoundingClientRect().left,
		titleTop:sourceTitle.getBoundingClientRect().top,
		titleHeight:sourceTitle.getBoundingClientRect().height,
	};
	assert(selectedSourceIndicator.content==='""'&&selectedSourceIndicator.position==="absolute"
		&&selectedSourceIndicator.right==="0px"
		&&sourceTitle.getBoundingClientRect().right
			<=variantSource.outerContainerEl.getBoundingClientRect().right+.5
		&&getComputedStyle(lineupVariantTable._cellCursor,"::before").content==="none"
		&&JSON.stringify(sourceLayoutSelected)===JSON.stringify(sourceLayoutBefore),
		"a selected Lineup lock sits inside the stable title structure without moving the label or cell");
	key(lineupVariantTable.rootEl,"Enter","Enter");
	assert(lineupVariantTable._inReadOnlyMode&&getComputedStyle(sourceTitle,"::after").content==='""',
		"the inline Lineup lock remains visible during an active read-only presentation");
	key(lineupVariantTable.rootEl,"Escape","Escape");
	forcedAction.select();
	const forcedActionTitle=forcedAction.outerContainerEl.querySelector(":scope>span.title");
	const forcedHelpActionTitle=forcedHelpAction.outerContainerEl.querySelector(":scope>span.title");
	assert(getComputedStyle(forcedActionTitle,"::after").content==='""'
		&&getComputedStyle(forcedActionTitle).paddingRight==="16px"
		&&getComputedStyle(lineupVariantTable._cellCursor,"::before").content==="none",
		"a label-only Lineup action reserves and uses the same inline indicator presentation");
	forcedHelpAction.select();
	assert(getComputedStyle(forcedHelpActionTitle,"::after").content==='""'
		&&getComputedStyle(forcedHelpActionTitle).paddingRight==="16px"
		&&forcedHelpAction.helpTriggerEl?.closest(".tablance-title-layout"),
		"a Lineup action with help keeps both affordances inside its stable title width");
	variantSource.select();
	variantStreet.outerContainerEl.querySelector(":scope>span.title").dispatchEvent(
		new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(lineupVariantTable._activeDetailsCell===variantStreet
		&&lineupVariantTable._selectedCell===variantStreet.outerContainerEl,
		"lineup hit testing resolves title content to the canonical outer cellbox");
	variantSource.select();
	variantStreet.outerContainerEl.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0,
		clientX:streetRect.right-2,clientY:streetRect.bottom-2}));
	assert(lineupVariantTable._activeDetailsCell===variantStreet,
		"lineup hit testing includes otherwise empty padding at the edge of the full cellbox");
	variantApartment.select();
	const apartmentRect=variantApartment.outerContainerEl.getBoundingClientRect();
	const apartmentValueRect=variantApartment.el.getBoundingClientRect();
	const apartmentCursorRect=lineupVariantTable._cellCursor.getBoundingClientRect();
	assert(Math.abs(apartmentCursorRect.width-apartmentRect.width)<1
		&&Math.abs(apartmentCursorRect.height-apartmentRect.height)<1
		&&apartmentCursorRect.height>apartmentValueRect.height,
		"an empty lineup value still receives a cursor for its full logical cell area");
	variantStreet.select();
	key(lineupVariantTable.rootEl,"ArrowRight","ArrowRight");
	assert(lineupVariantTable._activeDetailsCell===variantApartment,
		"field lineup variants retain existing geometric ArrowRight navigation");
	key(lineupVariantTable.rootEl,"ArrowLeft","ArrowLeft");
	assert(lineupVariantTable._activeDetailsCell===variantStreet,
		"field lineup variants retain existing geometric ArrowLeft navigation");
	let invalidVariantRejected=false;
	try { lineupVariantTable._resolveLineupVariant({variant:"unknown",entries:[]}); }
	catch(error) { invalidVariantRejected=error instanceof TypeError; }
	assert(invalidVariantRejected,"unknown explicit lineup variants fail fast");

	const wrappingHost=host();
	wrappingHost.style.width="320px";
	const wrappingTable=new Tablance(wrappingHost,{details:{type:"lineup",entries:[
		{type:"field",title:"Wide",dataKey:"wide",nodeId:"wrapWide",width:180,input:{type:"text"}},
		{type:"field",title:"Middle",dataKey:"middle",nodeId:"wrapMiddle",width:"80px",input:{type:"text"}},
		{type:"field",title:"Last",dataKey:"last",nodeId:"wrapLast",width:"80px",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	wrappingTable.setData([{wide:"wide",middle:"middle",last:"last"}]);
	await tick();
	const wrapWide=wrappingTable.getDetailCell(0,"wrapWide");
	const wrapMiddle=wrappingTable.getDetailCell(0,"wrapMiddle");
	const wrapLast=wrappingTable.getDetailCell(0,"wrapLast");
	const wrappingLineup=wrapWide.parent.containerEl;
	assert(wrappingLineup.classList.contains("lineup-wrap")
		&&wrapWide.outerContainerEl.style.flexBasis==="180px"
		&&wrapMiddle.outerContainerEl.style.flexBasis==="80px"
		&&wrapWide.outerContainerEl.style.flexGrow==="0",
		"lineups wrap by default and accept numeric or CSS-length preferred widths without implicit growth");
	assert(wrapWide.outerContainerEl.offsetTop===wrapMiddle.outerContainerEl.offsetTop
		&&wrapLast.outerContainerEl.offsetTop>wrapWide.outerContainerEl.offsetTop
		&&Math.abs(wrapLast.outerContainerEl.offsetLeft-wrapWide.outerContainerEl.offsetLeft)<1,
		"preferred widths preserve normal flex wrapping across multiple visual rows");
	wrapMiddle.select();
	key(wrappingTable.rootEl,"Home","Home");
	assert(wrappingTable._activeDetailsCell===wrapWide,
		"Lineup Home uses the first child on the currently rendered wrapped row");
	key(wrappingTable.rootEl,"End","End");
	assert(wrappingTable._activeDetailsCell===wrapMiddle,
		"Lineup End uses the last child on the currently rendered wrapped row");
	const wrappedSeparator=getComputedStyle(wrapLast.outerContainerEl,"::before");
	assert(getComputedStyle(wrappingLineup).overflow==="hidden"
		&&wrappedSeparator.borderInlineStartWidth==="1px"
		&&parseFloat(wrappedSeparator.insetInlineStart||wrappedSeparator.left)===-1,
		"a wrapped row's leading separator is clipped while same-row cell boundaries remain visible");
	const wrappingLineupInstance=wrapWide.parent;
	let [wrappingFirstExtension,wrappingSecondExtension]=wrappingLineupInstance.lineupRowExtensions;
	const wrappingLineupRect=wrappingLineup.getBoundingClientRect();
	const wrappingMiddleRect=wrapMiddle.outerContainerEl.getBoundingClientRect();
	const wrappingFirstExtensionRect=wrappingFirstExtension.getBoundingClientRect();
	assert(wrappingLineupInstance.lineupRowExtensions.length===2
		&&wrappingFirstExtension._tablanceLineupTarget===wrapMiddle
		&&wrappingSecondExtension._tablanceLineupTarget===wrapLast
		&&Math.abs(wrappingFirstExtensionRect.left-wrappingMiddleRect.right)<1
		&&Math.abs(wrappingFirstExtensionRect.right-wrappingLineupRect.right)<1,
		"each actual wrapped Lineup row extends from its rightmost cell to the Lineup interaction edge");
	wrappingFirstExtension.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,140));
	assert(wrappingFirstExtension.classList.contains("lineup-extension-hover")
		&&wrapMiddle.outerContainerEl.classList.contains("lineup-extension-target-hover")
		&&getComputedStyle(wrappingFirstExtension).backgroundColor!==getComputedStyle(wrapMiddle.outerContainerEl).backgroundColor,
		"Lineup empty-space hover combines ordinary target hover with a distinct weaker extension tone");
	wrappingFirstExtension.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	const wrappingMiddleCursor=wrappingTable._cellCursor.getBoundingClientRect();
	assert(wrappingTable._activeDetailsCell===wrapMiddle
		&&wrappingTable._selectedCell===wrapMiddle.outerContainerEl
		&&Math.abs(wrappingMiddleCursor.right-wrappingMiddleRect.right)<1
		&&!wrappingFirstExtension.classList.contains("tablance-active-cell"),
		"clicking a Lineup extension selects and outlines only its canonical real cell");
	wrappingFirstExtension.dispatchEvent(new MouseEvent("mouseleave"));
	wrappingHost.style.width="230px";
	await tick();
	[wrappingFirstExtension,wrappingSecondExtension]=wrappingLineupInstance.lineupRowExtensions;
	assert(wrappingLineupInstance.lineupRowExtensions.length===2
		&&wrappingFirstExtension._tablanceLineupTarget===wrapWide
		&&wrappingSecondExtension._tablanceLineupTarget===wrapLast
		&&wrapWide.outerContainerEl.offsetTop<wrapMiddle.outerContainerEl.offsetTop
		&&wrapMiddle.outerContainerEl.offsetTop===wrapLast.outerContainerEl.offsetTop,
		"Lineup extension ownership follows fresh DOM wrapping after resize rather than stale schema rows");
	wrapLast.select();
	key(wrappingTable.rootEl,"Home","Home");
	assert(wrappingTable._activeDetailsCell===wrapMiddle,
		"Lineup Home follows the new first child after an actual wrapping reflow");
	key(wrappingTable.rootEl,"End","End");
	assert(wrappingTable._activeDetailsCell===wrapLast,
		"Lineup End follows the new last child after an actual wrapping reflow");
	wrappingHost.style.width="420px";
	await tick();
	assert(wrappingLineupInstance.lineupRowExtensions.length===1
		&&wrappingLineupInstance.lineupRowExtensions[0]._tablanceLineupTarget===wrapLast,
		"Lineup extensions recompute when reflow combines all cells onto one visual row");

	const nowrapHost=host();
	nowrapHost.style.width="240px";
	const nowrapTable=new Tablance(nowrapHost,{details:{type:"lineup",wrap:false,entries:[
		{type:"field",title:"One",dataKey:"one",nodeId:"nowrapOne",width:180,input:{type:"text"}},
		{type:"field",title:"Two",dataKey:"two",nodeId:"nowrapTwo",width:180,input:{type:"text"}},
	]}},true,true,{searchbar:false});
	nowrapTable.setData([{one:"one",two:"two"}]);
	await tick();
	const nowrapOne=nowrapTable.getDetailCell(0,"nowrapOne");
	const nowrapTwo=nowrapTable.getDetailCell(0,"nowrapTwo");
	assert(nowrapOne.parent.containerEl.classList.contains("lineup-nowrap")
		&&nowrapOne.outerContainerEl.offsetTop===nowrapTwo.outerContainerEl.offsetTop
		&&nowrapOne.outerContainerEl.getBoundingClientRect().width<180
		&&nowrapTwo.outerContainerEl.getBoundingClientRect().width<180,
		"wrap false keeps one row and permits cells to shrink from their preferred basis");

	const statefulLineupHost=host();
	statefulLineupHost.style.width="420px";
	const statefulLineupRow={a:"A",b:"B",conditional:"Conditional",disabled:"Disabled",showConditional:true};
	const statefulLineupTable=new Tablance(statefulLineupHost,{details:{type:"lineup",entries:[
		{type:"field",dataKey:"a",nodeId:"statefulLineupA",width:80,input:{type:"text"}},
		{type:"field",dataKey:"b",nodeId:"statefulLineupB",width:80,input:{type:"text"}},
		{type:"field",dataKey:"conditional",nodeId:"statefulLineupConditional",width:80,
			visibleIf:({rowData})=>rowData.showConditional,input:{type:"text"}},
		{type:"field",dataKey:"disabled",nodeId:"statefulLineupDisabled",width:80,disabled:true,input:{type:"text"}},
	]}},true,true,{searchbar:false});
	statefulLineupTable.setData([statefulLineupRow]);
	await tick();
	const statefulLineupB=statefulLineupTable.getDetailCell(0,"statefulLineupB");
	const statefulConditional=statefulLineupTable.getDetailCell(0,"statefulLineupConditional");
	const statefulDisabled=statefulLineupTable.getDetailCell(0,"statefulLineupDisabled");
	const statefulLineup=statefulLineupB.parent;
	let statefulExtension=statefulLineup.lineupRowExtensions[0];
	assert(statefulExtension.parentElement===statefulLineup.containerEl
		&&statefulExtension._tablanceLineupTarget===statefulConditional
		&&Math.abs(parseFloat(statefulExtension.style.left)
			-(statefulDisabled.outerContainerEl.getBoundingClientRect().right
				-statefulLineup.containerEl.getBoundingClientRect().left))<1,
		"a disabled rightmost Lineup cell bounds empty space while the last selectable cell owns interaction");
	statefulLineupRow.showConditional=false;
	statefulLineupTable._applyVisibleIf(statefulConditional,0);
	statefulExtension=statefulLineup.lineupRowExtensions[0];
	assert(statefulConditional.hidden&&statefulExtension._tablanceLineupTarget===statefulLineupB,
		"hidden Lineup cells immediately update extended hit-area ownership without becoming candidates");

	const textWrapHost=host();
	textWrapHost.style.width="420px";
	const textWrapTable=new Tablance(textWrapHost,{details:{type:"lineup",wrap:false,entries:[
		{type:"field",title:"Natural text",dataKey:"natural",nodeId:"textWrapNatural",width:170,
			input:{type:"text"}},
		{type:"field",title:"Unbroken text",dataKey:"unbroken",nodeId:"textWrapUnbroken",width:170,
			input:{type:"text"}},
	]}},true,true,{searchbar:false});
	textWrapTable.setData([{natural:"A naturally wrapping sentence with several words",
		unbroken:"ThisIsOneDeliberatelyVeryLongUnbrokenValueThatMustRemainInsideItsCell"}]);
	await tick();
	const textWrapNatural=textWrapTable.getDetailCell(0,"textWrapNatural");
	const textWrapUnbroken=textWrapTable.getDetailCell(0,"textWrapUnbroken");
	const renderedLines=element=>{
		const range=document.createRange();
		range.selectNodeContents(element);
		return new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size;
	};
	const naturalBox=textWrapNatural.outerContainerEl.getBoundingClientRect();
	const unbrokenBox=textWrapUnbroken.outerContainerEl.getBoundingClientRect();
	const unbrokenFragments=[...(()=>{
		const range=document.createRange();
		range.selectNodeContents(textWrapUnbroken.el);
		return range.getClientRects();
	})()];
	assert(renderedLines(textWrapNatural.el)>1&&renderedLines(textWrapUnbroken.el)>1
		&&textWrapNatural.el.scrollWidth<=textWrapNatural.el.clientWidth+1
		&&textWrapUnbroken.el.scrollWidth<=textWrapUnbroken.el.clientWidth+1,
		"field lineup values wrap naturally and emergency-break long unbroken strings inside their value box");
	assert(Math.abs(naturalBox.width-170)<1&&Math.abs(unbrokenBox.width-170)<1
		&&Math.abs(naturalBox.right-unbrokenBox.left)<1
		&&textWrapNatural.outerContainerEl.offsetTop===textWrapUnbroken.outerContainerEl.offsetTop
		&&unbrokenFragments.every(rect=>rect.right<=unbrokenBox.right+1),
		"text wrapping neither changes declared canonical widths nor overlaps or wraps the neighbouring cell");
	textWrapUnbroken.select();
	const wrappedCursorBox=textWrapTable._cellCursor.getBoundingClientRect();
	assert(Math.abs(wrappedCursorBox.left-unbrokenBox.left)<1
		&&Math.abs(wrappedCursorBox.width-unbrokenBox.width)<1
		&&Math.abs(wrappedCursorBox.height-unbrokenBox.height)<1,
		"the cursor continues to follow the canonical cellbox after field content wraps");
	key(textWrapTable.rootEl,"Enter","Enter");
	const wrappedTextEditor=textWrapTable._cellCursor.querySelector("input");
	const wrappedEditorBox=wrappedTextEditor.getBoundingClientRect();
	const editingCursorBox=textWrapTable._cellCursor.getBoundingClientRect();
	assert(wrappedTextEditor&&wrappedEditorBox.left>=editingCursorBox.left-1
		&&wrappedEditorBox.right<=editingCursorBox.right+1,
		"a text editor remains contained by the same canonical field-lineup cellbox");
	textWrapTable._exitEditMode(false);

	const growHost=host();
	growHost.style.width="520px";
	const growTable=new Tablance(growHost,{details:{type:"lineup",wrap:false,entries:[
		{type:"field",title:"One",dataKey:"one",nodeId:"growOne",width:100,grow:true,input:{type:"text"}},
		{type:"field",title:"Two",dataKey:"two",nodeId:"growTwo",width:100,grow:2,input:{type:"text"}},
	]}},true,true,{searchbar:false});
	growTable.setData([{one:"one",two:"two"}]);
	await tick();
	const growOne=growTable.getDetailCell(0,"growOne");
	const growTwo=growTable.getDetailCell(0,"growTwo");
	const growOneExtra=growOne.outerContainerEl.getBoundingClientRect().width-100;
	const growTwoExtra=growTwo.outerContainerEl.getBoundingClientRect().width-100;
	assert(growOne.outerContainerEl.style.flexGrow==="1"&&growTwo.outerContainerEl.style.flexGrow==="2"
		&&growOneExtra>0&&Math.abs(growTwoExtra-growOneExtra*2)<2,
		"boolean and numeric grow values distribute remaining lineup width by their declared factors");

	const naturalHost=host();
	naturalHost.style.width="520px";
	const naturalTable=new Tablance(naturalHost,{details:{type:"lineup",variant:"metadata",entries:[
		{type:"field",title:"Source",dataKey:"source",nodeId:"naturalSource"},
		{type:"field",title:"Synced",dataKey:"synced",nodeId:"naturalSynced"},
	]}},true,true,{searchbar:false});
	naturalTable.setData([{source:"Ratsit",synced:"2022-01-31"}]);
	await tick();
	const naturalSource=naturalTable.getDetailCell(0,"naturalSource");
	const naturalSynced=naturalTable.getDetailCell(0,"naturalSynced");
	assert(naturalSource.outerContainerEl.style.flexBasis===""
		&&naturalSynced.outerContainerEl.style.flexBasis===""
		&&naturalSource.outerContainerEl.style.flexGrow==="0"
		&&naturalSynced.outerContainerEl.style.flexGrow==="0"
		&&getComputedStyle(naturalSource.el).overflowWrap==="normal"
		&&naturalSource.outerContainerEl.getBoundingClientRect().width
			+naturalSynced.outerContainerEl.getBoundingClientRect().width<naturalSource.parent.containerEl.clientWidth,
		"metadata retains natural width without explicit sizing or implicit last-cell growth");

	let invalidWrapRejected=false,invalidWidthRejected=false,invalidGrowRejected=false;
	try {
		const invalid=new Tablance(host(),{details:{type:"lineup",wrap:"yes",entries:[]}},true,true,{searchbar:false});
		invalid.setData([{}]);
	} catch(error) { invalidWrapRejected=error instanceof TypeError; }
	try { wrappingTable._applyLineupCellSizing({width:""},document.createElement("span")); }
	catch(error) { invalidWidthRejected=error instanceof TypeError; }
	try { wrappingTable._applyLineupCellSizing({grow:-1},document.createElement("span")); }
	catch(error) { invalidGrowRejected=error instanceof TypeError; }
	assert(invalidWrapRejected&&invalidWidthRejected&&invalidGrowRejected,
		"invalid lineup wrap, width, and grow declarations fail fast");

	const gridHost=host();
	gridHost.style.width="640px";
	const gridTable=new Tablance(gridHost,{details:{type:"list",titlesColWidth:false,entries:[
		{type:"field",title:"Before",dataKey:"before",nodeId:"gridBefore",input:{type:"text"}},
		{type:"grid",columns:2,entries:[
			{type:"field",title:"A1",dataKey:"a1",nodeId:"gridA1",input:{type:"text"}},
			{type:"field",title:"B1",dataKey:"b1",nodeId:"gridB1",input:{type:"text"}},
			{type:"field",title:"Spanning",dataKey:"span",nodeId:"gridSpan",columnSpan:2,input:{type:"text"}},
			{type:"field",title:"A2",dataKey:"a2",nodeId:"gridA2",input:{type:"text"}},
			{type:"field",title:"B2",dataKey:"b2",nodeId:"gridB2",input:{type:"textarea"}},
			{type:"field",title:"Disabled",dataKey:"disabled",nodeId:"gridDisabled",disabled:true,input:{type:"text"}},
			{type:"field",title:"Read only",dataKey:"readOnly",nodeId:"gridReadOnly",readOnly:true},
		]},
		{type:"lineup",variant:"metadata",entries:[
			{type:"field",title:"Source",dataKey:"source",nodeId:"gridMetadataSource",readOnly:true},
			{type:"field",title:"Synced",dataKey:"synced",nodeId:"gridMetadataSynced",readOnly:true},
		]},
	]}},true,true,{searchbar:false});
	gridTable.setData([{before:"Before",a1:"A1",b1:"B1",span:"Span",a2:"A2",b2:"B2",
		disabled:"Disabled",readOnly:"Read only",source:"Manual",synced:"Today"}]);
	await tick();
	const gridA1=gridTable.getDetailCell(0,"gridA1");
	const gridB1=gridTable.getDetailCell(0,"gridB1");
	const gridSpan=gridTable.getDetailCell(0,"gridSpan");
	const gridA2=gridTable.getDetailCell(0,"gridA2");
	const gridB2=gridTable.getDetailCell(0,"gridB2");
	const gridDisabled=gridTable.getDetailCell(0,"gridDisabled");
	const gridReadOnly=gridTable.getDetailCell(0,"gridReadOnly");
	const grid=gridA1.parent;
	assert(grid.schemaNode.type==="grid"&&grid.containerEl.classList.contains("details-grid")
		&&grid.containerEl.style.gridTemplateColumns.startsWith("repeat(2, minmax(0"),
		"Grid v1 renders a dedicated collection with equal flexible columns");
	assert(grid.gridRows.length===4&&grid.gridRows[1][0]===gridSpan&&grid.gridRows[1][1]===gridSpan
		&&gridSpan.gridColumn===0&&gridSpan.gridColumnSpan===2,
		"the logical occupancy matrix represents automatic rows and spanning cells with canonical instances");
	const defaultGridSeparators=[...grid.containerEl.querySelectorAll(":scope>.grid-row-separator")];
	assert(defaultGridSeparators.length===grid.gridRows.length-1
		&&defaultGridSeparators.every((separator,index)=>separator.style.gridRow===String((index+1)*2))
		&&defaultGridSeparators.at(-1).style.gridRow!==String(grid.gridRows.length*2),
		"Grid renders one logical full-row separator between rows and none after the final row");
	assert(Math.abs(gridA1.outerContainerEl.getBoundingClientRect().width
		-gridB1.outerContainerEl.getBoundingClientRect().width)<1,
		"two-column grids render equal canonical cellboxes");
	gridA1.select();
	key(gridTable.rootEl,"ArrowRight","ArrowRight");
	assert(gridTable._activeDetailsCell===gridB1,"ArrowRight moves to the next distinct cell on the same grid row");
	key(gridTable.rootEl,"Home","Home");
	assert(gridTable._activeDetailsCell===gridA1,
		"Grid Home selects the first cell on the current logical visual row");
	key(gridTable.rootEl,"End","End");
	assert(gridTable._activeDetailsCell===gridB1,
		"Grid End selects the last cell on the current logical visual row");
	key(gridTable.rootEl,"ArrowLeft","ArrowLeft");
	assert(gridTable._activeDetailsCell===gridA1,"ArrowLeft moves to the previous distinct cell on the same grid row");
	key(gridTable.rootEl,"ArrowLeft","ArrowLeft");
	assert(gridTable._activeDetailsCell===gridA1,"horizontal grid navigation does not wrap to another row");
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridSpan&&grid.gridPreferredColumn===0,
		"left-column vertical navigation enters a spanning cell while preserving column one");
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridA2,"left -> spanning -> left preserves the logical grid column");
	gridB1.select();
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridSpan&&grid.gridPreferredColumn===1,
		"right-column vertical navigation enters a spanning cell while preserving column two");
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridB2,"right -> spanning -> right preserves the logical grid column");
	gridSpan.select();
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridA2&&grid.gridPreferredColumn===0,
		"vertical navigation starting on a spanning cell uses its first column");
	gridA2.select();
	key(gridTable.rootEl,"ArrowDown","ArrowDown");
	assert(gridTable._activeDetailsCell===gridReadOnly&&gridTable._selectedCellState.kind==="readOnly",
		"a disabled target slot falls back to the nearest selectable grid cell and read-only remains navigable");
	key(gridTable.rootEl,"ArrowUp","ArrowUp");
	assert(gridTable._activeDetailsCell===gridA2,
		"the fallback target does not overwrite the preferred grid column");
	gridA1.select();
	key(gridTable.rootEl,"Tab","Tab");
	assert(gridTable._activeDetailsCell===gridB1,"Tab follows grid schema order");
	key(gridTable.rootEl,"Tab","Tab",{shiftKey:true});
	assert(gridTable._activeDetailsCell===gridA1,"Shift+Tab follows reverse grid schema order");
	gridB2.select();
	const gridTextareaTitle=gridB2.outerContainerEl.querySelector(":scope>span.title");
	const gridTextareaTitleBefore=gridTextareaTitle.getBoundingClientRect();
	const gridTextareaCellBefore=gridB2.outerContainerEl.getBoundingClientRect();
	const gridTextareaHeightBefore=gridTextareaCellBefore.height;
	const gridTextareaTitleOffsetBefore=gridTextareaTitleBefore.top-gridTextareaCellBefore.top;
	key(gridTable.rootEl,"Enter","Enter");
	const gridTextarea=gridTable._cellCursor.querySelector("textarea");
	assert(gridTextarea?.parentElement.classList.contains("cell-value-editor")
		&&!gridTextarea.classList.contains("tablance-textarea-with-shortcut-hint")
		&&!gridTextarea.parentElement.querySelector(".tablance-textarea-shortcut-hint")
		&&gridB2.outerContainerEl.querySelector(".tablance-help-slot:empty")
		&&gridTextarea.getBoundingClientRect().top>=gridTextareaTitle.getBoundingClientRect().bottom,
		"Grid edit without help preserves the same inline title structure and confines its editor to the value box");
	gridTextarea.value="A long Grid textarea value that grows onto several lines without replacing its title. ".repeat(6);
	gridTextarea.dispatchEvent(new Event("input",{bubbles:true}));
	const grownGridCell=gridB2.outerContainerEl.getBoundingClientRect();
	const grownGridEditor=gridTextarea.getBoundingClientRect();
	const grownGridCursor=gridTable._cellCursor.getBoundingClientRect();
	const grownGridTitle=gridTextareaTitle.getBoundingClientRect();
	assert(grownGridCell.height>gridTextareaHeightBefore
		&&Math.abs((grownGridTitle.top-grownGridCell.top)-gridTextareaTitleOffsetBefore)<1
		&&grownGridEditor.top>=grownGridTitle.bottom
		&&grownGridEditor.bottom<=grownGridCursor.bottom+1
		&&Math.abs(grownGridCursor.height-grownGridCell.height)<1,
		"an inline Grid textarea grows the value region and canonical cell without moving or covering its title");
	gridTable._exitEditMode(false);
	assert(gridB2.el.style.height===""&&gridB2.outerContainerEl.contains(gridTextareaTitle),
		"exiting Grid edit restores temporary value sizing while retaining the stable title DOM");

	const explicitGridTable=new Tablance(host(),{details:{type:"grid",columns:["34ch","34ch"],entries:[
		{type:"field",title:"Left",dataKey:"left",nodeId:"explicitGridLeft",input:{type:"text"}},
		{type:"field",title:"Right",dataKey:"right",nodeId:"explicitGridRight",input:{type:"text"}},
		{type:"field",title:"Span",dataKey:"span",nodeId:"explicitGridSpan",columnSpan:2,input:{type:"text"}},
		{type:"field",title:"Next left",dataKey:"nextLeft",nodeId:"explicitGridNextLeft",input:{type:"text"}},
		{type:"field",title:"Next right",dataKey:"nextRight",nodeId:"explicitGridNextRight",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	explicitGridTable.setData([{left:"Left",right:"Right",span:"Span",nextLeft:"Next left",nextRight:"Next right"}]);
	await tick();
	const explicitLeft=explicitGridTable.getDetailCell(0,"explicitGridLeft");
	const explicitRight=explicitGridTable.getDetailCell(0,"explicitGridRight");
	const explicitSpan=explicitGridTable.getDetailCell(0,"explicitGridSpan");
	const explicitNextRight=explicitGridTable.getDetailCell(0,"explicitGridNextRight");
	const explicitGrid=explicitLeft.parent;
	const explicitSeparators=[...explicitGrid.containerEl.querySelectorAll(":scope>.grid-row-separator")];
	assert(explicitGrid.gridColumns===2&&explicitGrid.gridRows.every(row=>row.length===2)
		&&explicitGrid.containerEl.style.gridTemplateColumns==="34ch 34ch",
		"an explicit track array defines both CSS widths and the logical occupancy column count");
	assert(explicitGrid.gridRows[1][0]===explicitSpan&&explicitGrid.gridRows[1][1]===explicitSpan,
		"columnSpan uses the same logical columns with explicit track widths");
	const explicitTrackWidth=explicitLeft.outerContainerEl.getBoundingClientRect().width;
	const separatorWidth=explicitSeparators[0].getBoundingClientRect().width;
	const explicitGridWidth=explicitGrid.containerEl.getBoundingClientRect().width;
	assert(Math.abs(explicitTrackWidth-explicitRight.outerContainerEl.getBoundingClientRect().width)<1
		&&explicitTrackWidth*2<explicitGridWidth
		&&Math.abs(separatorWidth-explicitGridWidth)<1&&explicitSeparators.length===2,
		"explicit tracks stay compact while row separators span the full Grid/details container width");
	const explicitGridStyle=getComputedStyle(explicitGrid.containerEl);
	assert(explicitGridStyle.borderTopWidth==="0px"
		&&explicitGridStyle.backgroundColor==="rgba(0, 0, 0, 0)"
		&&getComputedStyle(explicitLeft.outerContainerEl).borderRightWidth==="0px",
		"Grid adds neither an outer container treatment nor vertical cell dividers");
	const [explicitFirstExtension,explicitSpanExtension,explicitLastExtension]=explicitGrid.gridRowExtensions;
	const explicitRightRect=explicitRight.outerContainerEl.getBoundingClientRect();
	const explicitGridRect=explicitGrid.containerEl.getBoundingClientRect();
	const explicitExtensionRect=explicitFirstExtension.getBoundingClientRect();
	assert(explicitGrid.gridRowExtensions.length===3
		&&explicitFirstExtension.parentElement===explicitRight.outerContainerEl
		&&explicitFirstExtension._tablanceGridTarget===explicitRight
		&&explicitSpanExtension.parentElement===explicitSpan.outerContainerEl
		&&explicitSpanExtension._tablanceGridTarget===explicitSpan
		&&explicitLastExtension._tablanceGridTarget===explicitNextRight
		&&Math.abs(explicitExtensionRect.left-explicitRightRect.right)<1
		&&explicitGridRect.right-explicitExtensionRect.left>100,
		"each logical Grid row extends only the empty area after its rightmost occupied cell and targets its last selectable instance");
	explicitRight.outerContainerEl.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(explicitGridTable._activeDetailsCell===explicitRight,
		"clicking the real last Grid cell keeps its ordinary selection path");
	explicitFirstExtension.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	const extensionSelectedCursor=explicitGridTable._cellCursor.getBoundingClientRect();
	assert(explicitGridTable._activeDetailsCell===explicitRight
		&&explicitGridTable._selectedCell===explicitRight.outerContainerEl
		&&Math.abs(extensionSelectedCursor.left-explicitRightRect.left)<1
		&&Math.abs(extensionSelectedCursor.right-explicitRightRect.right)<1
		&&!explicitFirstExtension.classList.contains("tablance-active-cell"),
		"clicking a row extension selects and outlines only its canonical real cell");
	assert(!explicitFirstExtension.classList.contains("grid-extension-hover")
		&&!explicitRight.outerContainerEl.classList.contains("grid-extension-target-hover"),
		"hovering the real cell does not activate its separate extension presentation");
	explicitFirstExtension.dispatchEvent(new MouseEvent("mouseenter"));
	await new Promise(resolve=>setTimeout(resolve,140));
	const extensionHoverColor=getComputedStyle(explicitFirstExtension).backgroundColor;
	const extensionTargetHoverColor=getComputedStyle(explicitRight.outerContainerEl).backgroundColor;
	assert(explicitFirstExtension.classList.contains("grid-extension-hover")
		&&explicitRight.outerContainerEl.classList.contains("grid-extension-target-hover")
		&&["rgb(243, 247, 252)","rgba(243, 247, 252, 1)"].includes(extensionTargetHoverColor)
		&&extensionHoverColor!=="rgba(0, 0, 0, 0)"&&extensionHoverColor!==extensionTargetHoverColor,
		`extension hover keeps the target's normal hover and adds a distinct weaker tone only over empty space (${extensionTargetHoverColor}/${extensionHoverColor})`);
	explicitFirstExtension.dispatchEvent(new MouseEvent("mouseleave"));
	assert(!explicitFirstExtension.classList.contains("grid-extension-hover")
		&&!explicitRight.outerContainerEl.classList.contains("grid-extension-target-hover"),
		"leaving the extension clears both hover layers without changing selection");
	explicitFirstExtension.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	explicitFirstExtension.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,button:0,cancelable:true}));
	assert(explicitGridTable._activeDetailsCell===explicitRight&&explicitGridTable._inEditMode
		&&explicitGridTable._cellCursor.querySelector("input.text-editor"),
		"double-clicking a row extension activates the associated real cell through the ordinary editor path");
	explicitGridTable._exitEditMode(false);
	explicitRight.select();
	key(explicitGridTable.rootEl,"ArrowDown","ArrowDown");
	key(explicitGridTable.rootEl,"ArrowDown","ArrowDown");
	assert(explicitGridTable._activeDetailsCell===explicitNextRight,
		"logical vertical navigation is unchanged for explicitly sized Grid tracks");
	const threeColumnGridTable=new Tablance(host(),{details:{type:"grid",columns:3,entries:[
		{type:"field",dataKey:"a"},{type:"field",dataKey:"b",columnSpan:2},
		{type:"field",dataKey:"c",columnSpan:3},{type:"field",dataKey:"d"},
		{type:"field",dataKey:"e"},{type:"field",dataKey:"f",disabled:true},
	]}},true,true,{searchbar:false});
	threeColumnGridTable.setData([{a:"A",b:"B",c:"C",d:"D",e:"E",f:"F"}]);
	await tick();
	const threeColumnGrid=threeColumnGridTable._openDetailsPanes[0];
	assert(threeColumnGrid.gridRows.length===3&&threeColumnGrid.gridRows.every(row=>row.length===3)
		&&threeColumnGrid.gridRowSeparators.length===2
		&&threeColumnGrid.gridRowSeparators.every(separator=>separator.style.gridColumn==="1 / -1"),
		"row separators span the complete logical width of grids with arbitrary column counts and spans");
	const disabledLastExtension=threeColumnGrid.gridRowExtensions[2];
	const threeColumnE=threeColumnGrid.children[4];
	const threeColumnF=threeColumnGrid.children[5];
	assert(disabledLastExtension.parentElement===threeColumnF.outerContainerEl
		&&disabledLastExtension._tablanceGridTarget===threeColumnE,
		"a disabled geometrical last cell bounds empty space while the same row's last selectable cell owns interaction");
	disabledLastExtension.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(threeColumnGridTable._activeDetailsCell===threeColumnE,
		"a row extension never selects its disabled geometrical anchor");

	const hiddenGridTable=new Tablance(host(),{details:{type:"grid",columns:2,entries:[
		{type:"field",title:"One",dataKey:"one",nodeId:"hiddenGridOne",input:{type:"text"}},
		{type:"field",title:"Conditional",dataKey:"conditional",nodeId:"hiddenGridConditional",
			dependsOn:"show",visibleIf:({rowData})=>rowData.show,input:{type:"text"}},
		{type:"field",title:"Show",dataKey:"show",nodeId:"hiddenGridShow",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	const hiddenGridRow={one:"One",conditional:"Conditional",show:false};
	hiddenGridTable.setData([hiddenGridRow]);
	await tick();
	const hiddenGridOne=hiddenGridTable.getDetailCell(0,"hiddenGridOne");
	const hiddenGridConditional=hiddenGridTable.getDetailCell(0,"hiddenGridConditional");
	const hiddenGridShow=hiddenGridTable.getDetailCell(0,"hiddenGridShow");
	assert(hiddenGridConditional.hidden&&hiddenGridShow.gridRow===0&&hiddenGridShow.gridColumn===1
		&&hiddenGridOne.parent.gridRowSeparators.length===0
		&&hiddenGridOne.parent.gridRowExtensions.length===1
		&&hiddenGridOne.parent.gridRowExtensions[0]._tablanceGridTarget===hiddenGridShow,
		"hidden grid children do not occupy slots and following children are re-placed");
	const preRefreshExtension=hiddenGridOne.parent.gridRowExtensions[0];
	hiddenGridRow.show=true;
	hiddenGridTable.refreshSubtree(hiddenGridOne.parent);
	assert(!hiddenGridConditional.hidden&&hiddenGridConditional.gridColumn===1
		&&hiddenGridShow.gridRow===1&&hiddenGridShow.gridColumn===0
		&&hiddenGridOne.parent.gridRowSeparators.length===1&&!preRefreshExtension.isConnected
		&&hiddenGridOne.parent.gridRowExtensions.length===2
		&&hiddenGridOne.parent.gridRowExtensions[0]._tablanceGridTarget===hiddenGridConditional
		&&hiddenGridOne.parent.gridRowExtensions[1]._tablanceGridTarget===hiddenGridShow,
		"visibility refresh rebuilds rendering and navigation from the same grid placement");

	const repeatedGridTable=new Tablance(host(),{details:{type:"list",entries:[
		{type:"repeated",dataKey:"items",entry:{type:"group",closedRender:({name})=>name,entries:[
			{type:"grid",columns:2,entries:[
				{type:"field",title:"Left",dataKey:"left",input:{type:"text"}},
				{type:"field",title:"Right",dataKey:"right",input:{type:"text"}},
			]},
		]}},
	]}},true,true,{searchbar:false});
	repeatedGridTable.setData([{items:[{name:"Entry",left:"Left",right:"Right"}]}]);
	await tick();
	const repeatedGridGroup=repeatedGridTable._openDetailsPanes[0].children[0].children[0];
	repeatedGridGroup.select();
	key(repeatedGridTable.rootEl,"Enter","Enter");
	const repeatedGrid=repeatedGridGroup.children[0];
	assert(repeatedGrid.schemaNode.type==="grid"&&repeatedGrid.gridRows[0][1].dataObj.name==="Entry",
		"a grid nested in repeated/group retains the repeated entry's logical data identity");

	const mainGridTable=new Tablance(host(),{main:{columns:[
		{dataKey:"left",input:{type:"text"}},{dataKey:"right",input:{type:"text"}},
	]},details:{type:"grid",columns:2,entries:[
		{type:"field",title:"Detail left",dataKey:"detailLeft",nodeId:"mainGridLeft",input:{type:"text"}},
		{type:"field",title:"Detail right",dataKey:"detailRight",nodeId:"mainGridRight",input:{type:"text"}},
	]}},true,true,{searchbar:false,ordering:false});
	mainGridTable.setData([
		{left:"1L",right:"1R",detailLeft:"DL",detailRight:"DR"},
		{left:"2L",right:"2R",detailLeft:"DL2",detailRight:"DR2"},
	]);
	await tick();
	mainGridTable.selectCell(0,"right");
	mainGridTable.expandRow(0,false);
	mainGridTable.getDetailCell(0,"mainGridRight").select();
	key(mainGridTable.rootEl,"ArrowDown","ArrowDown");
	assert(!mainGridTable._activeDetailsCell&&mainGridTable._mainRowIndex===1&&mainGridTable._mainColIndex===1,
		"leaving a Grid through an expansion preserves the main table's independent logical column");

	let invalidColumns=false,emptyColumns=false,invalidTrack=false,invalidSpan=false,directRepeated=false;
	try {
		const invalid=new Tablance(host(),{details:{type:"grid",columns:0,entries:[]}},true,true,{searchbar:false});
		invalid.setData([{}]);
	} catch(error) { invalidColumns=error instanceof TypeError; }
	try {
		const invalid=new Tablance(host(),{details:{type:"grid",columns:[],entries:[]}},true,true,{searchbar:false});
		invalid.setData([{}]);
	} catch(error) { emptyColumns=error instanceof TypeError; }
	try {
		const invalid=new Tablance(host(),{details:{type:"grid",columns:["34ch","not("],entries:[]}},true,true,
			{searchbar:false});
		invalid.setData([{}]);
	} catch(error) { invalidTrack=error instanceof TypeError; }
	try {
		const invalid=new Tablance(host(),{details:{type:"grid",columns:2,entries:[
			{type:"field",dataKey:"value",columnSpan:3},
		]}},true,true,{searchbar:false});
		invalid.setData([{value:"x"}]);
	} catch(error) { invalidSpan=error instanceof TypeError; }
	try {
		const invalid=new Tablance(host(),{details:{type:"grid",columns:2,entries:[
			{type:"repeated",dataKey:"items",entry:{type:"field",dataKey:"value"}},
		]}},true,true,{searchbar:false});
		invalid.setData([{items:[]}]);
	} catch(error) { directRepeated=error instanceof TypeError; }
	assert(invalidColumns&&emptyColumns&&invalidTrack&&invalidSpan&&directRepeated,
		"Grid rejects invalid integer/track columns, invalid spans, and direct repeated row models");

	const wrappedVerticalHost=host();
	wrappedVerticalHost.style.width="340px";
	const wrappedVerticalTable=new Tablance(wrappedVerticalHost,{details:{type:"lineup",entries:[
		{type:"field",title:"Top left",dataKey:"a",nodeId:"wrappedA",width:180,input:{type:"text"}},
		{type:"field",title:"Top right",dataKey:"b",nodeId:"wrappedB",width:80,input:{type:"text"}},
		{type:"field",title:"Bottom left",dataKey:"c",nodeId:"wrappedC",width:180,input:{type:"text"}},
		{type:"field",title:"Bottom right",dataKey:"d",nodeId:"wrappedD",width:80,input:{type:"text"}},
	]}},true,true,{searchbar:false});
	wrappedVerticalTable.setData([{a:"A long value that makes the first cell taller",b:"B",c:"C",d:"D"}]);
	await tick();
	const wrappedA=wrappedVerticalTable.getDetailCell(0,"wrappedA");
	const wrappedB=wrappedVerticalTable.getDetailCell(0,"wrappedB");
	const wrappedC=wrappedVerticalTable.getDetailCell(0,"wrappedC");
	const wrappedD=wrappedVerticalTable.getDetailCell(0,"wrappedD");
	wrappedB.select();
	key(wrappedVerticalTable.rootEl,"ArrowDown","ArrowDown");
	assert(wrappedVerticalTable._activeDetailsCell===wrappedD,
		"Lineup retains fresh geometric navigation between visual rows inside the same wrapped flow");
	key(wrappedVerticalTable.rootEl,"ArrowUp","ArrowUp");
	assert(wrappedVerticalTable._activeDetailsCell===wrappedB,
		"wrapped Lineup geometry remains bidirectional and does not use Grid state");

	const tabRow={name:"Tab order",before:"before",first:"first",hidden:"hidden",disabled:"disabled",
		choice:"two",after:"after",source:"Ratsit",synced:"2022-01-31 18:04",final:"final",
		items:[{label:"entry one",left:"one left",right:"one right"},
			{label:"entry two",left:"two left",right:"two right"}]};
	const tabTable=new Tablance(host(),{main:{columns:[{dataKey:"name"}]},details:{type:"list",entries:[
		{title:"Before",dataKey:"before",nodeId:"tabBefore",input:{type:"text"}},
		{type:"lineup",entries:[
			{type:"field",title:"First",dataKey:"first",nodeId:"tabFirst",input:{type:"text"}},
			{type:"field",title:"Hidden",dataKey:"hidden",nodeId:"tabHidden",visibleIf:()=>false,
				input:{type:"text"}},
			{type:"field",title:"Disabled",dataKey:"disabled",nodeId:"tabDisabled",disabled:true,
				input:{type:"text"}},
			{type:"field",title:"Choice",dataKey:"choice",nodeId:"tabChoice",input:{type:"select",
				options:[{value:"one",text:"One"},{value:"two",text:"Two"}]}},
		]},
		{title:"After",dataKey:"after",nodeId:"tabAfter",input:{type:"text"}},
		{type:"lineup",entries:[
			{type:"field",title:"Source",dataKey:"source",nodeId:"tabSource"},
			{type:"field",title:"Synced",dataKey:"synced",nodeId:"tabSynced"},
		]},
		{type:"group",title:"Nested",nodeId:"tabNestedGroup",entries:[
			{type:"repeated",dataKey:"items",nodeId:"tabRepeated",entry:{type:"group",entries:[
				{title:"Label",dataKey:"label",input:{type:"text"}},
				{type:"lineup",entries:[
					{type:"field",title:"Left",dataKey:"left",input:{type:"text"}},
					{type:"field",title:"Right",dataKey:"right",input:{type:"text"}},
				]},
			]}},
		]},
		{title:"Final",dataKey:"final",nodeId:"tabFinal",input:{type:"text"}},
	]}},true,true,{searchbar:false,ordering:false});
	tabTable.setData([tabRow]);
	await tick();
	const tabBefore=tabTable.getDetailCell(0,"tabBefore");
	const tabFirst=tabTable.getDetailCell(0,"tabFirst");
	const tabHidden=tabFirst.parent.children[1];
	const tabDisabled=tabFirst.parent.children[2];
	const tabChoice=tabTable.getDetailCell(0,"tabChoice");
	const tabAfter=tabTable.getDetailCell(0,"tabAfter");
	const tabSource=tabTable.getDetailCell(0,"tabSource");
	const tabSynced=tabTable.getDetailCell(0,"tabSynced");
	const tabFinal=tabTable.getDetailCell(0,"tabFinal");
	const tabRepeated=tabTable.getDetailCell(0,"tabRepeated");
	const tabNestedGroup=tabTable.getDetailCell(0,"tabNestedGroup");
	const [tabEntryOne,tabEntryTwo]=tabRepeated.children;
	const tabEntryOneCells=[tabEntryOne.children[0],...tabEntryOne.children[1].children];
	const tabEntryTwoCells=[tabEntryTwo.children[0],...tabEntryTwo.children[1].children];
	const tabNestedCells=[...tabEntryOneCells,...tabEntryTwoCells];
	const logicalCells=[];
	tabTable._collectLogicalDetailsCells(tabTable._openDetailsPanes[0],logicalCells);
	const expectedLogicalCells=[tabBefore,tabFirst,tabChoice,tabAfter,tabSource,tabSynced,
		tabNestedGroup,tabFinal];
	assert(logicalCells.length===expectedLogicalCells.length
		&&logicalCells.every((cell,index)=>cell===expectedLogicalCells[index]),
		"logical details order treats a closed group as one cell and skips hidden/disabled cells");
	assert(!logicalCells.some(cell=>tabNestedCells.includes(cell)),
		"children of a closed group are absent from logical navigation");
	assert(tabHidden.outerContainerEl.classList.contains("tablance-hidden"),
		"hidden lineup entries expose Tablance's canonical layout hook");
	assert(tabHidden.selEl===tabHidden.outerContainerEl&&tabDisabled.selEl===tabDisabled.outerContainerEl
		&&tabDisabled.outerContainerEl.dataset.cellState==="disabled"
		&&tabSource.selEl===tabSource.outerContainerEl&&tabSource.outerContainerEl.dataset.cellState==="readOnly"
		&&tabNestedCells.slice(1,3).every(cell=>cell.selEl===cell.outerContainerEl),
		"hidden, disabled, read-only, and nested repeated lineup cells keep state on their canonical outer box");
	tabBefore.select();
	key(tabTable.rootEl,"Tab","Tab");
	assert(tabTable._activeDetailsCell===tabFirst,"Tab enters a field lineup from the preceding detail row");
	key(tabTable.rootEl,"Enter","Enter");
	const tabTextEditor=tabTable._cellCursor.querySelector("input");
	assert(tabTextEditor,"Enter retains ordinary field edit semantics inside a lineup");
	key(tabTextEditor,"Tab","Tab");
	assert(tabTable._activeDetailsCell===tabChoice&&!tabTable._inEditMode,
		"Tab commits an active editor and skips hidden/disabled lineup cells");
	key(tabTable.rootEl,"Enter","Enter");
	const tabSelectEditor=tabTable.rootEl.querySelector(".tablance-select-container input");
	assert(tabSelectEditor,"Enter retains select activation semantics");
	key(tabSelectEditor,"Tab","Tab");
	assert(tabTable._activeDetailsCell===tabAfter&&!tabTable._inEditMode,
		"Tab commits an active select and continues to the next logical row");
	for (const expected of [tabSource,tabSynced,tabNestedGroup]) {
		key(tabTable.rootEl,"Tab","Tab");
		assert(tabTable._activeDetailsCell===expected,"Tab follows logical details instance order");
	}
	key(tabTable.rootEl,"Enter","Enter");
	assert(tabNestedGroup.el.classList.contains("open")
		&&tabTable._activeDetailsCell===tabEntryOne,
		"Enter opens a closed group before its first nested group becomes navigable");
	key(tabTable.rootEl,"Enter","Enter");
	assert(tabEntryOne.el.classList.contains("open")
		&&tabTable._activeDetailsCell===tabEntryOne.children[0],
		"a nested closed group remains atomic until it is opened in turn");
	for (const expected of [...tabEntryOneCells.slice(1),tabEntryTwo]) {
		key(tabTable.rootEl,"Tab","Tab");
		assert(tabTable._activeDetailsCell===expected,"Tab traverses children only while their group is open");
	}
	key(tabTable.rootEl,"Enter","Enter");
	assert(tabEntryTwo.el.classList.contains("open")
		&&tabTable._activeDetailsCell===tabEntryTwo.children[0],
		"Enter exposes the children of the next repeated group independently");
	for (const expected of [...tabEntryTwoCells.slice(1),tabFinal]) {
		key(tabTable.rootEl,"Tab","Tab");
		assert(tabTable._activeDetailsCell===expected,"Tab traverses an opened repeated group in logical order");
	}
	assert(!tabNestedGroup.el.classList.contains("open"),
		"leaving an open group closes it and restores its atomic navigation state");
	key(tabTable.rootEl,"Tab","Tab");
	assert(tabTable._activeDetailsCell===tabFinal,"Tab at the final detail cell does not invent a DOM target");
	key(tabTable.rootEl,"Tab","Tab",{shiftKey:true});
	assert(tabTable._activeDetailsCell===tabNestedGroup
		&&!tabNestedGroup.el.classList.contains("open"),
		"reverse navigation reaches the closed group itself instead of a hidden child");
	tabTable._cellCursor.dispatchEvent(new MouseEvent("dblclick",{bubbles:true,button:0}));
	assert(tabNestedGroup.el.classList.contains("open")
		&&tabTable._activeDetailsCell===tabEntryOne,
		"double-click opens a selected closed group before selecting its first nested group");
	tabSynced.select();
	const reverse=[tabSource,tabAfter,tabChoice,tabFirst,tabBefore];
	for (const expected of reverse) {
		key(tabTable.rootEl,"Tab","Tab",{shiftKey:true});
		assert(tabTable._activeDetailsCell===expected,"Shift+Tab follows reverse logical details instance order");
	}
	tabSynced.select();
	key(tabTable.rootEl,"ArrowDown","ArrowDown");
	assert(tabTable._activeDetailsCell===tabNestedGroup,
		"vertical navigation reaches a closed group instead of descending into its children");
	tabNestedCells[1].selEl.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(tabTable._activeDetailsCell===tabNestedGroup,
		"clicking visible descendant content cannot bypass its closed group as the navigation unit");
	key(tabTable.rootEl,"Enter","Enter");
	assert(tabNestedGroup.el.classList.contains("open")
		&&tabTable._activeDetailsCell===tabEntryOne,
		"a closed group reached by vertical navigation opens normally with Enter");
	tabBefore.select();
	assert(!tabNestedGroup.el.classList.contains("open"),
		"closing the group after pointer and arrow navigation makes it atomic again");
	key(tabTable.rootEl,"Enter","Enter");
	assert(tabTable._inEditMode&&tabTable._activeDetailsCell===tabBefore,
		"Tab traversal does not alter Enter semantics for ordinary detail fields");
	tabTable._exitEditMode(false);

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
	assert(reusedCell.dataset.cellState==="disabled"&&reusedCell.classList.contains("disabled")
		&&!reusedCell.classList.contains("read-only")&&!reusedCell.classList.contains("editable-indicator"),
		"virtualized/reused cell replaces prior state and edit indicator rather than retaining CSS state");

	const headerlessTable=new Tablance(host(),{main:{columns:[{dataKey:"value",input:{type:"text"}}]}},true,true,
		{searchbar:false,ordering:false,autoHeight:true,showHeader:false});
	headerlessTable.setData([{value:"headerless"}]);
	await tick();
	const headerlessBodyStyle=getComputedStyle(headerlessTable._scrollBody);
	assert(headerlessBodyStyle.borderTopWidth==="1px"&&headerlessBodyStyle.borderTopLeftRadius==="10px",
		"headerless auto-height tables receive a complete rounded native frame");

	const detailsOnlyTable=new Tablance(host(),{main:{resultStatus:true},details:{type:"list",entries:[
		{title:"Only detail",dataKey:"value",nodeId:"onlyDetail",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	detailsOnlyTable.setData([{value:"detail-only"}]);
	await tick();
	assert(!detailsOnlyTable._resultStatus&&!detailsOnlyTable._emptyState
		&&detailsOnlyTable.rootEl.querySelector(".details .tablance-cell-state")
		&&getComputedStyle(detailsOnlyTable.rootEl).fontFamily.includes("Inter"),
		"details-only tables ignore result-status opt-in and keep their native state hooks and theme");
	const onlyDetail=detailsOnlyTable.getDetailCell(0,"onlyDetail");
	onlyDetail.select();
	key(detailsOnlyTable.rootEl,"Enter","Enter");
	const ordinaryListEditor=detailsOnlyTable._cellCursor.querySelector("input.text-editor");
	assert(ordinaryListEditor?.parentElement===detailsOnlyTable._cellCursor
		&&!detailsOnlyTable._cellCursor.querySelector(".cell-value-editor"),
		"ordinary list-details with a separate title column retain the existing full-value-cell editor path");
	detailsOnlyTable._exitEditMode(false);
	assert(getComputedStyle(detailsOnlyTable._cellCursor).outlineWidth==="2px"
		&&getComputedStyle(detailsOnlyTable._cellCursor).outlineOffset==="-2px",
		"ordinary details cursors keep their two-pixel outline fully inside the overlay geometry");

	const groupAlignmentTable=new Tablance(host(),{details:{type:"list",titlesColWidth:"11em",entries:[
		{title:"Ordinary",dataKey:"ordinary",nodeId:"alignedOrdinary",input:{type:"text"}},
		{type:"group",title:"Group",nodeId:"alignedGroup",closedRender:()=>"Summary",entries:[
			{title:"Inner",dataKey:"inner",nodeId:"alignedInner",input:{type:"text"}},
			{type:"group",title:"Nested",nodeId:"alignedNested",closedRender:()=>"Nested summary",entries:[
				{title:"Nested inner",dataKey:"nestedInner",input:{type:"text"}},
			]},
		]},
	]}},true,true,{searchbar:false});
	groupAlignmentTable.setData([{ordinary:"Ordinary value",inner:"Inner value",nestedInner:"Nested value"}]);
	await tick();
	const alignedOrdinary=groupAlignmentTable.getDetailCell(0,"alignedOrdinary");
	const alignedGroup=groupAlignmentTable.getDetailCell(0,"alignedGroup");
	const alignedValueLeft=alignedOrdinary.el.getBoundingClientRect().left;
	const alignedGroupLeft=alignedGroup.viewportEl.getBoundingClientRect().left;
	assert(Math.abs(alignedGroupLeft-alignedValueLeft)<1
		&&getComputedStyle(alignedGroup.selEl).paddingLeft==="0px",
		"a direct list group frame shares the ordinary details value-cell left edge while labels remain separate");
	alignedGroup.select();
	const alignedCursorLeft=groupAlignmentTable._cellCursor.getBoundingClientRect().left;
	assert(Math.abs(alignedCursorLeft-alignedGroupLeft)<1
		&&getComputedStyle(groupAlignmentTable._cellCursor).outlineOffset==="-1px",
		"direct list group selection follows the newly aligned frame and retains its intentional outline offset");
	key(groupAlignmentTable.rootEl,"Enter","Enter");
	await waitFor(()=>alignedGroup.el.classList.contains("open")
		&&!alignedGroup.viewportEl.classList.contains("tablance-group-animating"),"aligned group opening");
	const alignedNested=groupAlignmentTable.getDetailCell(0,"alignedNested");
	const alignedOpenValueLeft=alignedOrdinary.el.getBoundingClientRect().left;
	const alignedOpenLeft=alignedGroup.viewportEl.getBoundingClientRect().left;
	const alignedNestedLeft=alignedNested.viewportEl.getBoundingClientRect().left;
	assert(Math.abs(alignedOpenLeft-alignedOpenValueLeft)<1&&alignedNestedLeft>alignedOpenLeft,
		"opening preserves the top-level alignment while nested groups retain their hierarchy inset");
	groupAlignmentTable._closeGroup(alignedGroup);
	await waitFor(()=>!alignedGroup.el.classList.contains("open")
		&&!alignedGroup.viewportEl.classList.contains("tablance-group-animating"),"aligned group closing");
	assert(Math.abs(alignedGroup.viewportEl.getBoundingClientRect().left
		-alignedOrdinary.el.getBoundingClientRect().left)<1,
		"closing and viewport cleanup preserve the direct list group alignment");

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

	let multiDependedValue,chainedMainRenders=0;
	const multiDependencyTable=new Tablance(host(),{main:{columns:[
		{dataKey:"combined",dependsOn:["firstSource","secondSource"],
			render:({dependedValue})=>(multiDependedValue=dependedValue).join(" | "),
			onEnter:({mainIndex,tablance})=>tablance.selectCell(mainIndex,"firstSource")},
		{dataKey:"chained",dependsOn:"combined",render:({rowData})=>{
			chainedMainRenders++;
			return `Chain: ${rowData.first}`;
		}},
	]},details:{type:"list",entries:[
		{dataKey:"first",nodeId:"firstSource"},
		{dataKey:"second",nodeId:"secondSource"},
	]}},true,true,{searchbar:false,ordering:false});
	const multiDependencyRow={combined:"stored",first:"Alpha",second:"Beta"};
	multiDependencyTable.setData([multiDependencyRow]);
	await tick();
	const multiDependencyCell=multiDependencyTable._mainTbody
		.querySelector('tr[data-data-row-index="0"]:not(.details)').cells[0];
	const chainedMainCell=multiDependencyCell.parentElement.cells[1];
	assert(multiDependencyCell.textContent==="Alpha | Beta"
		&&JSON.stringify(multiDependedValue)===JSON.stringify(["Alpha","Beta"]),
		"multiple data dependencies expose their values in declaration order");
	multiDependencyTable.selectCell(multiDependencyRow,"combined");
	assert(multiDependencyCell.dataset.cellState==="action"&&!multiDependencyTable._selectedCellState.mutable,
		"a derived navigation field is an immutable action rather than a read-only presentation");
	key(multiDependencyTable.rootEl,"Enter","Enter");
	const firstSource=multiDependencyTable._activeDetailsCell;
	assert(firstSource?.schemaNode.nodeId==="firstSource"&&!multiDependencyTable._inEditMode,
		"activating a derived navigation field selects its source without opening a main-row editor");
	firstSource.dataObj.first="Changed";
	chainedMainRenders=0;
	multiDependencyTable._updateDependentCells(firstSource.schemaNode,firstSource);
	assert(multiDependencyCell.textContent==="Changed | Beta"&&chainedMainCell.textContent==="Chain: Changed"
		&&chainedMainRenders===1,
		"main-cell dependencies propagate transitively and repaint each target once");

	const repeatedChainRenders={};
	const countRepeatedRender=(kind,rowData)=>{
		const key=`${kind}:${rowData.id}`;
		repeatedChainRenders[key]=(repeatedChainRenders[key]??0)+1;
		return `${kind}:${rowData.source}`;
	};
	const repeatedChainTable=new Tablance(host(),{main:{columns:[{dataKey:"label"}]},details:{type:"list",entries:[
		{type:"repeated",dataKey:"chains",nodeId:"dependencyChains",entry:{type:"group",entries:[
			{title:"Source",dataKey:"source",nodeId:"chainSource",dependsOn:"chainLeaf",input:{type:"text"}},
			{title:"Middle",dataKey:"middle",nodeId:"chainMiddle",dependsOn:"chainSource",
				render:({rowData})=>countRepeatedRender("middle",rowData)},
			{title:"Leaf",dataKey:"leaf",nodeId:"chainLeaf",dependsOn:["chainSource","chainMiddle"],
				visibleIf:({rowData})=>rowData.source==="show",
				render:({rowData})=>countRepeatedRender("leaf",rowData)},
		]}},
	]}},true,true,{searchbar:false});
	const repeatedChainRows=[{id:"first",source:"hide",middle:"",leaf:""},
		{id:"second",source:"hide",middle:"",leaf:""}];
	repeatedChainTable.setData([{label:"Repeated dependencies",chains:repeatedChainRows}]);
	await tick();
	const repeatedChains=repeatedChainTable.getDetailCell(0,"dependencyChains");
	const firstChain=repeatedChains.children.find(child=>child.dataObj.id==="first");
	const firstChainSource=firstChain.children[0];
	const firstChainLeaf=firstChain.children[2];
	assert(firstChainLeaf.hidden,"a repeated dependent starts hidden according to its own entry data");
	firstChainSource.select();
	for (const key of Object.keys(repeatedChainRenders))
		delete repeatedChainRenders[key];
	repeatedChainRows[0].source="show";
	repeatedChainTable._updateDependentCells(firstChainSource.schemaNode,firstChainSource);
	assert(!firstChainLeaf.hidden&&repeatedChainRenders["middle:first"]===1
		&&repeatedChainRenders["leaf:first"]===1
		&&!repeatedChainRenders["middle:second"]&&!repeatedChainRenders["leaf:second"],
		"repeated dependencies propagate transitively per instance, de-duplicate paths, and stop cycles");

	let createDataPayload;
	const initializedRows=[];
	const initializedTable=new Tablance(host(),{details:{type:"list",entries:[
		{type:"repeated",dataKey:"history",nodeId:"initializedHistory",create:true,
			createData:payload=>{
				createDataPayload=payload;
				return {event:"appointment",scope:"legacy",showScope:true};
			},
			entry:{type:"group",closedRender:data=>`${data.event}:${data.scope}`,entries:[
				{title:"Event",dataKey:"event",input:{type:"text"}},
				{title:"Scope",dataKey:"scope",visibleIf:({rowData})=>rowData.showScope,input:{type:"text"}},
			]},
		},
	]}},true,true,{searchbar:false});
	initializedTable.setData([{history:initializedRows}]);
	await tick();
	const initializedRepeated=initializedTable.getDetailCell(0,"initializedHistory");
	initializedRepeated.createNewEntry();
	const initializedEntry=initializedRepeated.children.find(child=>child.creating);
	assert(initializedEntry?.dataObj.event==="appointment"&&initializedEntry.dataObj.scope==="legacy"
		&&createDataPayload.dataArray===initializedRows&&createDataPayload.itemIndex===0,
		"repeated createData supplies contextual pending entry defaults before rendering");
	const scopeField=initializedEntry.children[1];
	assert(initializedEntry.el.querySelectorAll(".delete-controls button").length===3,
		"a repeated group initially renders one set of delete controls");
	initializedEntry.dataObj.showScope=false;
	initializedEntry.dataObj.scope="current";
	initializedTable.refreshSubtree(initializedEntry);
	initializedTable.refreshSubtree(initializedEntry);
	assert(scopeField.hidden&&scopeField.outerContainerEl.style.display==="none"
		&&initializedEntry.el.querySelector("tr.group-render").textContent==="appointment:current",
		"refreshSubtree recursively refreshes visibility and closed group rendering after cross-entry changes");
	assert(initializedEntry.el.querySelectorAll(".delete-controls button").length===3
		&&![...initializedEntry.el.querySelectorAll(".delete-controls button")]
			.some(button=>button.querySelector("button")),
		"refreshSubtree reuses repeated-entry controls without nesting new buttons inside them");

	let untouchedCreateClosePayload,untouchedCreateCloseCalls=0,untouchedCreateCommits=0;
	const untouchedCreateRows=[];
	const untouchedCreateTable=new Tablance(host(),{
		onDataCommit:()=>untouchedCreateCommits++,details:{type:"list",entries:[
			{type:"repeated",dataKey:"history",nodeId:"untouchedCreateHistory",create:true,
				createData:()=>({event:"change",scope:null,capacities:["none","none"]}),entry:{type:"group",
					closedRender:data=>`${data.event}:${data.scope??"missing"}`,onClose:payload=>{
						untouchedCreateCloseCalls++;
						untouchedCreateClosePayload=payload;
						if (!payload.data.scope)
							payload.preventClose("A scope is required");
					},entries:[
						{title:"Event",dataKey:"event",input:{type:"text"}},
						{title:"Scope",dataKey:"scope",input:{type:"text"}},
						{type:"group",dataPath:"renderDefaults",entries:[
							{title:"Generated",dataKey:"value",input:{type:"text"}},
						]},
					]},
			},
			{type:"field",dataKey:"after",nodeId:"afterUntouchedCreate",input:{type:"text"}},
		]},
	},true,true,{searchbar:false});
	untouchedCreateTable.setData([{history:untouchedCreateRows,after:"next"}]);
	await tick();
	const untouchedRepeated=untouchedCreateTable.getDetailCell(0,"untouchedCreateHistory");
	const untouchedCollection=untouchedRepeated.parent.containerEl;
	const untouchedBaselineElements=[...untouchedCollection.children];
	const untouchedBaselineHeight=untouchedCollection.getBoundingClientRect().height;
	for (let cycle=0;cycle<4;cycle++) {
		untouchedRepeated.createNewEntry();
		const untouchedEntry=untouchedRepeated.children.find(child=>child.creating);
		assert(Object.keys(untouchedEntry.dataObj.renderDefaults).length===0
			&&untouchedCreateTable._isUntouchedCreatingGroup(untouchedEntry)
			&&untouchedCreateTable._buildGroupPayload(untouchedEntry).changed===false,
			"createData values and nested defaults form the canonical untouched draft baseline");
		const draftOuter=untouchedEntry.outerContainerEl;
		if (cycle%2)
			untouchedCreateTable._deleteCell(untouchedEntry);
		else
			key(untouchedCreateTable.rootEl,"Escape","Escape");
		const remainingElements=[...untouchedCollection.children];
		assert(!draftOuter.isConnected,
			"repeated create then abandon/delete removes its canonical owning wrapper");
		assert(!untouchedRepeated.children.includes(untouchedEntry),
			"repeated create then abandon/delete removes its instance node");
		assert(remainingElements.length===untouchedBaselineElements.length
			&&remainingElements.every((element,index)=>element===untouchedBaselineElements[index])
			,"repeated create then abandon/delete leaves the original collection DOM unchanged");
		assert(Math.abs(untouchedCollection.getBoundingClientRect().height-untouchedBaselineHeight)<.1,
			`repeated create then abandon/delete does not accumulate height (${untouchedBaselineHeight} -> ${untouchedCollection.getBoundingClientRect().height})`);
	}
	assert(untouchedCreateRows.length===0&&untouchedCreateCloseCalls===0&&untouchedCreateCommits===0,
		"discarding untouched creations does not run blocking group validation or create commits");

	untouchedRepeated.createNewEntry();
	let editedEntry=untouchedRepeated.children.find(child=>child.creating);
	editedEntry.dataObj.event="edited";
	untouchedCreateTable._markDirtyField(editedEntry.children[0]);
	const afterUntouchedCreate=untouchedCreateTable.getDetailCell(0,"afterUntouchedCreate");
	afterUntouchedCreate.select();
	assert(untouchedCreateCloseCalls===1&&untouchedCreateClosePayload.mode==="create"
		&&untouchedCreateClosePayload.changed===true&&editedEntry.creating
		&&untouchedRepeated.children.includes(editedEntry)&&untouchedCreateRows.length===0,
		"a real change from the creation baseline still runs validation and blocks ordinary navigation");
	editedEntry.dataObj.event="change";
	afterUntouchedCreate.select();
	assert(untouchedCreateCloseCalls===1&&!untouchedRepeated.children.includes(editedEntry)
		&&untouchedCreateRows.length===0&&untouchedCreateTable._activeDetailsCell===afterUntouchedCreate,
		"restoring the complete initial state makes the draft untouched again and navigation discards it");

	untouchedRepeated.createNewEntry();
	const validEntry=untouchedRepeated.children.find(child=>child.creating);
	validEntry.dataObj.scope="legacy";
	untouchedCreateTable._markDirtyField(validEntry.children[1]);
	assert(untouchedCreateTable._closeGroup(validEntry)===true&&untouchedCreateRows.length===1
		&&untouchedCreateRows[0]===validEntry.dataObj&&!validEntry.creating&&untouchedCreateCommits===1
		&&validEntry.outerContainerEl.isConnected
		&&untouchedCollection.getBoundingClientRect().height>untouchedBaselineHeight
		&&validEntry.el.querySelector("tr.group-render")?.textContent==="change:legacy",
		"a changed and validated createData draft commits once and receives its real closed render immediately");
	untouchedRepeated.createNewEntry();
	const forcedEntry=untouchedRepeated.children.find(child=>child.creating);
	forcedEntry.dataObj.event="forced-discard";
	untouchedCreateTable._markDirtyField(forcedEntry.children[0]);
	key(untouchedCreateTable.rootEl,"Escape","Escape",{ctrlKey:true});
	assert(!untouchedRepeated.children.includes(forcedEntry)&&untouchedCreateRows.length===1
		&&untouchedCreateClosePayload.reason==="discard"&&untouchedCreateCommits===1,
		"Ctrl+Escape retains its force-discard behavior for a changed creation draft");

	const guardedActionEditorTable=new Tablance(host(),{main:{columns:[
		{type:"group",dataKey:"invalid",input:{type:"text"}},
	]}},true,true,{searchbar:false,ordering:false});
	guardedActionEditorTable.setData([{invalid:"must stay unchanged"}]);
	await tick();
	guardedActionEditorTable.selectCell(0,"invalid");
	key(guardedActionEditorTable.rootEl,"Enter","Enter");
	assert(!guardedActionEditorTable._inEditMode&&!guardedActionEditorTable._selectedCellState.mutable,
		"a non-mutable action schema cannot open an ordinary editor even if one was configured");

	const emptySelectRows=[{scope:null},{scope:"current"}];
	const emptySelectTable=new Tablance(host(),{main:{columns:[
		{dataKey:"scope",input:{type:"select",minOptsFilter:100,options:[
			{text:"Legacy",value:"legacy"},{text:"Current",value:"current"},
		]}},
	]}},true,true,{searchbar:false,ordering:false});
	emptySelectTable.setData(emptySelectRows);
	await tick();
	emptySelectTable.selectCell(emptySelectRows[0],"scope");
	key(emptySelectTable.rootEl,"Enter","Enter");
	let selectDropdown=emptySelectTable.rootEl.querySelector(".tablance-select-container");
	let selectInput=selectDropdown.querySelector("input");
	assert(selectDropdown.querySelector("ul.main>li.highlighted")?.textContent==="Legacy",
		"opening a select for a cell without a value highlights its first rendered option");
	key(selectInput,"Enter","Enter");
	assert(emptySelectRows[0].scope==="legacy"&&!emptySelectTable._inEditMode
		&&!emptySelectTable.rootEl.querySelector(".tablance-select-container"),
		"Enter commits the initial select option and closes the dropdown before navigation");
	emptySelectTable.selectCell(emptySelectRows[1],"scope");
	key(emptySelectTable.rootEl,"Enter","Enter");
	selectDropdown=emptySelectTable.rootEl.querySelector(".tablance-select-container");
	assert(selectDropdown.querySelector("ul.main>li.highlighted")?.textContent==="Current",
		"an existing select value remains highlighted instead of defaulting to the first option");
	key(selectDropdown.querySelector("input"),"Escape","Escape");

	let booleanSelectCommit;
	const booleanSelectRows=[{enabled:false,name:"First"},{enabled:true,name:"Second"}];
	const booleanSelectTable=new Tablance(host(),{
		onDataCommit:payload=>booleanSelectCommit=payload,
		main:{columns:[
			{dataKey:"enabled",input:{type:"select",boolean:true}},
			{dataKey:"name",input:{type:"text"}},
		]},
	},true,true,{searchbar:false,ordering:false,lang:{booleanTrue:"Ja",booleanFalse:"Nej"}});
	booleanSelectTable.setData(booleanSelectRows);
	await tick();
	const falsePresentation=booleanSelectTable._mainTbody.rows[0].cells[0].querySelector(".boolean-select-value");
	const truePresentation=booleanSelectTable._mainTbody.rows[1].cells[0].querySelector(".boolean-select-value");
	assert(falsePresentation?.textContent==="Nej"
		&&!falsePresentation.querySelector('input[type="checkbox"].boolean-select-checkbox').checked
		&&truePresentation?.textContent==="Ja"
		&&truePresentation.querySelector('input[type="checkbox"].boolean-select-checkbox').checked,
		"boolean selects generate localized checkbox presentations without caller-supplied options");
	booleanSelectTable.selectCell(booleanSelectRows[0],"enabled");
	key(booleanSelectTable.rootEl,"Enter","Enter");
	let booleanDropdown=booleanSelectTable.rootEl.querySelector(".tablance-select-container");
	let booleanInput=booleanDropdown.querySelector("input");
	const booleanOptions=booleanDropdown.querySelectorAll("ul.main>li");
	assert(booleanDropdown&&document.activeElement===booleanInput&&booleanOptions.length===2
		&&booleanOptions[0].textContent==="Nej"&&booleanOptions[1].textContent==="Ja"
		&&booleanOptions[0].querySelector('input[type="checkbox"].boolean-select-checkbox')
		&&[...booleanSelectTable.rootEl.querySelectorAll('input[type="checkbox"].boolean-select-checkbox')]
			.every(checkbox=>checkbox.tabIndex===-1&&checkbox.getAttribute("aria-hidden")==="true"
				&&getComputedStyle(checkbox).pointerEvents==="none"&&!checkbox.disabled),
		"Enter opens the ordinary select editor with checkbox-presented boolean options");
	key(booleanInput,"ArrowDown","ArrowDown");
	key(booleanInput,"Tab","Tab");
	assert(booleanSelectRows[0].enabled===true&&typeof booleanSelectRows[0].enabled==="boolean"
		&&booleanSelectCommit?.changes?.enabled===true&&booleanSelectTable._mainColIndex===1,
		"the ordinary select flow commits a canonical boolean and keeps its Tab navigation");
	booleanSelectTable.selectCell(booleanSelectRows[0],"enabled");
	key(booleanSelectTable.rootEl,"Enter","Enter");
	booleanDropdown=booleanSelectTable.rootEl.querySelector(".tablance-select-container");
	booleanInput=booleanDropdown.querySelector("input");
	key(booleanInput,"ArrowUp","ArrowUp");
	key(booleanInput,"Escape","Escape");
	assert(booleanSelectRows[0].enabled===true&&!booleanSelectTable._inEditMode,
		"Escape cancels a boolean select without changing its canonical value");

	const booleanDetailRows=[{settings:[{enabled:false,note:"Next"}]}];
	const booleanDetailTable=new Tablance(host(),{main:{columns:[{type:"expand"}]},details:{type:"list",entries:[
		{type:"repeated",dataKey:"settings",nodeId:"booleanRepeated",entry:{type:"group",entries:[
			{type:"grid",columns:2,entries:[
				{title:"Enabled",dataKey:"enabled",nodeId:"detailBoolean",help:"Boolean help",
					input:{type:"select",boolean:true}},
				{title:"Note",dataKey:"note",nodeId:"booleanNote",input:{type:"text"}},
			]},
		]}},
	]}},true,true,{searchbar:false,ordering:false});
	booleanDetailTable.setData(booleanDetailRows);
	await tick();
	const booleanGroup=booleanDetailTable.getDetailCell(0,"booleanRepeated").children[0];
	booleanGroup.select();
	key(booleanDetailTable.rootEl,"Enter","Enter");
	const detailBoolean=booleanDetailTable.getDetailCell(0,"detailBoolean");
	detailBoolean.select();
	key(booleanDetailTable.rootEl,"Enter","Enter");
	booleanDropdown=booleanDetailTable.rootEl.querySelector(".tablance-select-container");
	booleanInput=booleanDropdown.querySelector("input");
	assert(booleanDropdown&&detailBoolean.outerContainerEl.querySelector(":scope>span.title .tablance-title-text")
		?.textContent==="Enabled"
		&&detailBoolean.helpTriggerEl?.isConnected,
		"a Grid boolean select preserves its stable title and help structure while editing");
	key(booleanInput,"ArrowDown","ArrowDown");
	key(booleanInput,"Tab","Tab");
	const booleanGroupPayload=booleanDetailTable._buildGroupPayload(booleanGroup);
	assert(booleanDetailRows[0].settings[0].enabled===true
		&&booleanDetailTable._activeDetailsCell.schemaNode.nodeId==="booleanNote"
		&&booleanGroupPayload.changed===true
		&&Object.values(booleanGroupPayload.payload.changes).includes(true),
		"Grid boolean selects participate in dirty-state and existing Tab navigation");

	const sortingRows=[
		{account:"Beta",amount:2,date:"2026-09-02"},
		{account:"Alpha",amount:2,date:"2026-09-03"},
		{account:"Alpha",amount:1,date:"2026-09-01"},
	];
	const sortingTable=new Tablance(host(),{main:{columns:[
		{title:"Account",dataKey:"account"},
		{title:"Amount",dataKey:"amount"},
		{title:"Date",dataKey:"date"},
	]}},true,true,{searchbar:false});
	sortingTable.setData(sortingRows);
	await tick();
	const sortingHeaders=sortingTable._headerTr.cells;
	const unsortedTitle=sortingHeaders[0].querySelector(".tablance-main-header-title");
	const unsortedIcon=sortingHeaders[0].querySelector(".tablance-sort-icon");
	const unsortedTitleGeometry=unsortedTitle.getBoundingClientRect();
	const unsortedIconGeometry=unsortedIcon.getBoundingClientRect();
	assert(sortingHeaders[0].classList.contains("sortable-header")
		&&sortingHeaders[1].classList.contains("sortable-header")
		&&unsortedIcon.querySelectorAll(".tablance-sort-chevron").length===2
		&&getComputedStyle(unsortedIcon.querySelector(".tablance-sort-chevron-up")).opacity==="1"
		&&getComputedStyle(unsortedIcon.querySelector(".tablance-sort-chevron-down")).opacity==="1"
		&&unsortedIcon.querySelector(".tablance-sort-chevron-up").getBBox().width===12
		&&unsortedIcon.querySelector(".tablance-sort-chevron-up").getBBox().height===6
		&&unsortedIcon.querySelector(".tablance-sort-chevron-down").getBBox().y
			-unsortedIcon.querySelector(".tablance-sort-chevron-up").getBBox().y
			-unsortedIcon.querySelector(".tablance-sort-chevron-up").getBBox().height===6,
		"unsorted headers show both enlarged, proportionate chevrons with the established gap");
	const normalMouseDown=new MouseEvent("mousedown",{bubbles:true,cancelable:true,button:0});
	sortingHeaders[0].dispatchEvent(normalMouseDown);
	assert(!normalMouseDown.defaultPrevented,"ordinary header mousedown keeps native text selection available");
	const shiftMouseDown=new MouseEvent("mousedown",{bubbles:true,cancelable:true,button:0,shiftKey:true});
	sortingHeaders[0].dispatchEvent(shiftMouseDown);
	assert(shiftMouseDown.defaultPrevented,"Shift+mousedown on a sortable header suppresses native range extension");
	const doubleMouseDown=new MouseEvent("mousedown",{bubbles:true,cancelable:true,button:0,detail:2});
	sortingHeaders[0].dispatchEvent(doubleMouseDown);
	assert(doubleMouseDown.defaultPrevented,"a second sortable-header mousedown suppresses native word selection");
	sortingHeaders[0].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(sortingTable._sortingCols.length===1
		&&!sortingHeaders[0].querySelector(".tablance-sort-priority"),
		"single-column sorting retains its existing icon without a priority number");
	const sortedAscIcon=sortingHeaders[0].querySelector(".tablance-sort-icon");
	const sortedAscTitle=sortingHeaders[0].querySelector(".tablance-main-header-title");
	const ascIconGeometry=sortedAscIcon.getBoundingClientRect();
	const ascTitleGeometry=sortedAscTitle.getBoundingClientRect();
	assert(sortedAscIcon.querySelectorAll(".tablance-sort-chevron").length===2
		&&getComputedStyle(sortedAscIcon.querySelector(".tablance-sort-chevron-up")).opacity==="1"
		&&getComputedStyle(sortedAscIcon.querySelector(".tablance-sort-chevron-down")).opacity==="0.25"
		&&unsortedIconGeometry.x===ascIconGeometry.x&&unsortedIconGeometry.y===ascIconGeometry.y
		&&unsortedIconGeometry.width===ascIconGeometry.width&&unsortedIconGeometry.height===ascIconGeometry.height
		&&unsortedTitleGeometry.x===ascTitleGeometry.x&&unsortedTitleGeometry.y===ascTitleGeometry.y,
		"ascending sorting preserves header geometry, keeps both chevrons visible, and subdues the inactive direction");
	sortingHeaders[0].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	const sortedDescIcon=sortingHeaders[0].querySelector(".tablance-sort-icon");
	const sortedDescTitle=sortingHeaders[0].querySelector(".tablance-main-header-title");
	const descIconGeometry=sortedDescIcon.getBoundingClientRect();
	const descTitleGeometry=sortedDescTitle.getBoundingClientRect();
	assert(sortedDescIcon.querySelectorAll(".tablance-sort-chevron").length===2
		&&getComputedStyle(sortedDescIcon.querySelector(".tablance-sort-chevron-up")).opacity==="0.25"
		&&getComputedStyle(sortedDescIcon.querySelector(".tablance-sort-chevron-down")).opacity==="1"
		&&ascIconGeometry.x===descIconGeometry.x&&ascIconGeometry.y===descIconGeometry.y
		&&ascIconGeometry.width===descIconGeometry.width&&ascIconGeometry.height===descIconGeometry.height
		&&ascTitleGeometry.x===descTitleGeometry.x&&ascTitleGeometry.y===descTitleGeometry.y,
		"descending sorting preserves the exact header geometry and subdues only the up chevron");
	sortingHeaders[0].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	const selection=getSelection();
	const anchor=sortingHeaders[0].querySelector(".tablance-main-header-title").firstChild;
	const range=document.createRange();
	range.setStart(anchor,1);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
	const nativeSortDone=new Promise((resolve,reject)=>{
		const timeout=setTimeout(()=>reject(new Error("Timed out waiting for trusted Shift+click sorting")),5000);
		sortingHeaders[1].addEventListener("click",event=>{
			if (!event.shiftKey)
				return;
			clearTimeout(timeout);
			setTimeout(resolve);
		},{once:true});
	});
	window.nativeSortingHeader=sortingHeaders[1];
	sortingHeaders[1].scrollIntoView({block:"center"});
	result.textContent="awaiting trusted Shift+click sorting";
	result.dataset.status="awaiting-native-sorting";
	await nativeSortDone;
	assert(selection.isCollapsed&&selection.toString()==="",
		"trusted Shift+click sorting does not extend the browser text selection");
	assert(sortingTable._sortingCols.map(col=>`${col.dataKey}:${col.order}`).join(",")==="account:asc,amount:asc"
		&&sortingTable._filteredData.map(row=>`${row.account}:${row.amount}`).join(",")==="Alpha:1,Alpha:2,Beta:2",
		"trusted Shift+click adds a secondary sort and applies it after the primary sort");
	assert(sortingHeaders[0].querySelector(".tablance-sort-priority")?.textContent==="1"
		&&sortingHeaders[1].querySelector(".tablance-sort-priority")?.textContent==="2",
		"multi-sort icons show their actual primary and secondary priorities");
	const primaryPriority=sortingHeaders[0].querySelector(".tablance-sort-priority");
	const secondaryPriority=sortingHeaders[1].querySelector(".tablance-sort-priority");
	const secondaryPriorityGeometry=secondaryPriority.getBoundingClientRect();
	const multiIconGeometry=sortingHeaders[0].querySelector(".tablance-sort-icon").getBoundingClientRect();
	const multiTitleGeometry=sortingHeaders[0].querySelector(".tablance-main-header-title").getBoundingClientRect();
	assert(getComputedStyle(primaryPriority).fontSize==="9px"&&getComputedStyle(secondaryPriority).fontSize==="9px"
		&&multiIconGeometry.x-multiTitleGeometry.x===ascIconGeometry.x-ascTitleGeometry.x
		&&multiIconGeometry.y-multiTitleGeometry.y===ascIconGeometry.y-ascTitleGeometry.y,
		"multi-sort preserves the existing priority size and the single-sort header geometry");
	sortingHeaders[1].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,shiftKey:true}));
	const toggledPriorityGeometry=sortingHeaders[1].querySelector(".tablance-sort-priority").getBoundingClientRect();
	assert(secondaryPriorityGeometry.x===toggledPriorityGeometry.x&&secondaryPriorityGeometry.y===toggledPriorityGeometry.y
		&&secondaryPriorityGeometry.width===toggledPriorityGeometry.width
		&&secondaryPriorityGeometry.height===toggledPriorityGeometry.height,
		"a multi-sort priority does not move or resize when its direction changes");
	sortingHeaders[2].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,shiftKey:true}));
	const priorities=[...sortingHeaders].slice(0,3)
		.map(th=>th.querySelector(".tablance-sort-priority")?.textContent).join(",");
	assert(priorities==="1,2,3",
		"priority numbers remain ordered when another sort column is appended");
	sortingHeaders[1].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,shiftKey:true}));
	assert(sortingTable._sortingCols.map(col=>col.dataKey).join(",")==="account,date"
		&&sortingHeaders[0].querySelector(".tablance-sort-priority")?.textContent==="1"
		&&!sortingHeaders[1].querySelector(".tablance-sort-priority")
		&&sortingHeaders[2].querySelector(".tablance-sort-priority")?.textContent==="2",
		"removing a Shift-sorted column immediately compacts the remaining priorities");
	sortingHeaders[2].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));
	assert(sortingTable._sortingCols.length===1&&sortingTable._sortingCols[0].dataKey==="date"
		&&![...sortingHeaders].slice(0,3).some(th=>th.querySelector(".tablance-sort-priority")),
		"returning to a single sort removes every secondary priority number");
	const doubleClickRange=document.createRange();
	doubleClickRange.setStart(sortingHeaders[2].querySelector(".tablance-main-header-title").firstChild,1);
	doubleClickRange.collapse(true);
	selection.removeAllRanges();
	selection.addRange(doubleClickRange);
	const nativeDoubleSortDone=new Promise((resolve,reject)=>{
		const timeout=setTimeout(()=>reject(new Error("Timed out waiting for trusted double-click sorting")),5000);
		sortingHeaders[2].addEventListener("dblclick",()=>{
			clearTimeout(timeout);
			setTimeout(resolve);
		},{once:true});
	});
	window.nativeDoubleSortingHeader=sortingHeaders[2];
	result.textContent="awaiting trusted double-click sorting";
	result.dataset.status="awaiting-native-double-sorting";
	await nativeDoubleSortDone;
	assert(selection.isCollapsed&&selection.toString()==="",
		"trusted double-click sorting does not select header text");

	result.textContent=`${assertions.length} cell-state assertions passed`;
	result.dataset.status="passed";
} catch (error) {
	result.textContent=error.stack??String(error);
	result.dataset.status="failed";
}
