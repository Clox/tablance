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
	const shortcuts=new Tablance(host(),{
		main:{columns:[{dataKey:"name",input:{type:"text"}}]},
		details:{type:"list",entries:[{dataKey:"detail"}]},
	},true,true,{ordering:false});
	shortcuts.setData([{name:"one",detail:"details"},{name:"two",detail:"more"}]);
	await tick();
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
		await new Promise(resolve=>setTimeout(resolve,350));
		assert(!shortcuts._openDetailsPanes[0],`${JSON.stringify(minus)} closes the same row`);
		if (plus.altKey)
			assert(expandEvent.defaultPrevented&&collapseEvent.defaultPrevented,"Alt arrows suppress browser default");
	}
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
		viewModeKey:"default",search:"",counts:{source:3,view:2,filtered:2},
	})&&viewStateEvents.at(-1).reason==="data",
		"getViewState and viewstatechange expose committed source, view, filtered, view-key, and search state");
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
		&&viewTable.getViewState().counts.filtered===1,
		"a main-row draft stays editable in its creation view but is excluded from every public count");
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
		&&emptyDraftTable.getViewState().counts.source===0,
		"the first draft in an empty dataset retains its creation-view metadata and remains uncounted");

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
	tableHelp.dispatchEvent(new MouseEvent("mouseenter"));
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
			{title:"Notes",dataKey:"notes",nodeId:"notes",input:{type:"textarea"}},
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
	assert(getComputedStyle(cells[0]).paddingLeft==="12px"&&getComputedStyle(cells[1]).paddingLeft==="14px"
		&&getComputedStyle(cells[1]).paddingTop==="9px"&&getComputedStyle(cells[5]).paddingLeft==="14px"
		&&getComputedStyle(cells[5]).paddingTop==="9px"&&getComputedStyle(cells[6]).paddingLeft==="12px",
		"only text-like main-row state cells reserve permanent space for their indicator");
	table.selectCell(row,"editable");
	key(table.rootEl,"Enter","Enter");
	const textEditor=table._cellCursor.querySelector("input.text-editor");
	assert(textEditor&&getComputedStyle(textEditor).paddingLeft==="4px",
		"a text cell editor keeps a small amount of space before its text");
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
	const emptyGroupValueCell=emptyGroup.el.parentElement;
	emptyGroupValueCell.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0}));
	assert(emptyGroup.selEl===emptyGroupValueCell&&emptyGroupTable._selectedCell===emptyGroupValueCell,
		"a list group uses its full value cell as the hit target even when its inner content is empty");

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
		&&guardedDeleteIconStyle.width==="16px"&&guardedDeleteIconStyle.height==="16px"
		&&(guardedDeleteIconStyle.maskImage!=="none"||guardedDeleteIconStyle.webkitMaskImage!=="none")
		&&getComputedStyle(guardedDeleteControls.querySelector(".no")).display==="none"
		&&getComputedStyle(guardedDeleteControls.querySelector(".yes")).display==="none",
		"repeated entries expose a compact neutral delete action with an outline trash icon");
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
	assert(sortedIdentityTable._closeGroup(cancelledSortedEntry)===false
		&&!sortedRepeated.children.includes(cancelledSortedEntry)&&sortedCreateCancelCalls===1
		&&sortedCommits.filter(payload=>payload.mode==="create").length===createCommitsBeforeCancel
		&&JSON.stringify(sortedBacking.map(entry=>entry.id??"new"))===JSON.stringify([1,2,"new"]),
		"cancelCreate removes the pending object and instance without persistence or backing-array residue");

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
	assert(lockedLineupDetail.selEl.classList.contains("read-only-activation-feedback")
		&&getComputedStyle(lockedLineupDetail.selEl.querySelector(":scope>span.title"),"::after").animationName
			==="tablance-read-only-lock-feedback",
		"a blocked Lineup field applies feedback to the inline lock on its canonical cell");
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
	assert(notesEditor?.rows===1,"an editable textarea measures one line as its minimum height");
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
	const historyGroupValueStyle=getComputedStyle(historyGroup.el.parentElement);
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
	assert(historyEntries.every(entry=>getComputedStyle(entry.el.parentElement.parentElement).paddingTop==="2px"),
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
	const nestedGroupChevron=historyEntries[0].groupChevronEl;
	const nestedClosedRender=historyEntries[0].el.querySelector("tbody>tr.group-render>td");
	assert(nestedGroupChevron?.classList.contains("group-chevron")
		&&nestedClosedRender.lastElementChild?.classList.contains("group-closed-content")
		&&nestedGroupChevron.parentElement===historyEntries[0].el
		&&nestedGroupChevron.previousElementSibling===historyEntries[0].containerEl
		&&getComputedStyle(nestedGroupChevron).marginLeft==="6px"
		&&getComputedStyle(nestedGroupChevron).backgroundColor!=="rgba(0, 0, 0, 0)"
		&&getComputedStyle(nestedGroupChevron,"::before").content==='""'
		&&getComputedStyle(nestedGroupChevron).pointerEvents==="none",
		"closedRender groups place the chevron's subtle non-interactive icon container after the preview table");
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
	assert(table._cellCursor.classList.contains("group-cell-cursor")
		&&getComputedStyle(table._cellCursor).outlineOffset==="-1px",
		"a selected details group draws its outline one pixel inward on every side");
	const closedGroupRenderStyle=getComputedStyle(historyEntries[0].el.querySelector("tbody>tr.group-render>td"));
	assert(closedGroupRenderStyle.paddingLeft==="4px"&&closedGroupRenderStyle.paddingTop==="2px"
		&&closedGroupRenderStyle.paddingBottom==="2px",
		"a closed group render uses compact horizontal and vertical padding");
	const nestedGroupCellStyle=getComputedStyle(historyEntries[0].el.parentElement);
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
		&&getComputedStyle(editableHistoryField.selEl.querySelector(":scope>span.title"),"::after").content==="none",
		"group value fields retain their compact left edge and fields without indicators reserve no empty space");
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
	variantStreet.select();
	const streetRect=variantStreet.outerContainerEl.getBoundingClientRect();
	const streetCursorRect=lineupVariantTable._cellCursor.getBoundingClientRect();
	const streetTitleRect=variantStreet.outerContainerEl.querySelector(":scope>span.title").getBoundingClientRect();
	assert(Math.abs(streetCursorRect.left-streetRect.left)<1&&Math.abs(streetCursorRect.top-streetRect.top)<1
		&&Math.abs(streetCursorRect.width-streetRect.width)<1&&Math.abs(streetCursorRect.height-streetRect.height)<1
		&&streetTitleRect.top>=streetCursorRect.top&&streetTitleRect.bottom<=streetCursorRect.bottom,
		"a lineup cursor covers the entire logical cell including its title and padding");
	const sourceTitle=variantSource.outerContainerEl.querySelector(":scope>span.title");
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
		&&Math.abs(parseFloat(selectedSourceIndicator.left)-sourceTitle.getBoundingClientRect().width)<1
		&&getComputedStyle(lineupVariantTable._cellCursor,"::before").content==="none"
		&&JSON.stringify(sourceLayoutSelected)===JSON.stringify(sourceLayoutBefore),
		"a selected Lineup lock sits directly after the stable title structure without moving the label or cell");
	key(lineupVariantTable.rootEl,"Enter","Enter");
	assert(lineupVariantTable._inReadOnlyMode&&getComputedStyle(sourceTitle,"::after").content==='""',
		"the inline Lineup lock remains visible during an active read-only presentation");
	key(lineupVariantTable.rootEl,"Escape","Escape");
	forcedAction.select();
	assert(getComputedStyle(forcedAction.outerContainerEl.querySelector(":scope>span.title"),"::after").content==='""'
		&&getComputedStyle(lineupVariantTable._cellCursor,"::before").content==="none",
		"a selected textlike Lineup action uses the same inline title indicator presentation");
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
	assert(reusedCell.dataset.cellState==="disabled"&&reusedCell.classList.contains("disabled")&&!reusedCell.classList.contains("read-only"),"virtualized/reused cell replaces prior state rather than retaining CSS state");

	const headerlessTable=new Tablance(host(),{main:{columns:[{dataKey:"value",input:{type:"text"}}]}},true,true,
		{searchbar:false,ordering:false,autoHeight:true,showHeader:false});
	headerlessTable.setData([{value:"headerless"}]);
	await tick();
	const headerlessBodyStyle=getComputedStyle(headerlessTable._scrollBody);
	assert(headerlessBodyStyle.borderTopWidth==="1px"&&headerlessBodyStyle.borderTopLeftRadius==="10px",
		"headerless auto-height tables receive a complete rounded native frame");

	const detailsOnlyTable=new Tablance(host(),{details:{type:"list",entries:[
		{title:"Only detail",dataKey:"value",nodeId:"onlyDetail",input:{type:"text"}},
	]}},true,true,{searchbar:false});
	detailsOnlyTable.setData([{value:"detail-only"}]);
	await tick();
	assert(detailsOnlyTable.rootEl.querySelector(".details .tablance-cell-state")
		&&getComputedStyle(detailsOnlyTable.rootEl).fontFamily.includes("Inter"),
		"details-only tables use the same native state hooks and default theme");
	const onlyDetail=detailsOnlyTable.getDetailCell(0,"onlyDetail");
	onlyDetail.select();
	key(detailsOnlyTable.rootEl,"Enter","Enter");
	const ordinaryListEditor=detailsOnlyTable._cellCursor.querySelector("input.text-editor");
	assert(ordinaryListEditor?.parentElement===detailsOnlyTable._cellCursor
		&&!detailsOnlyTable._cellCursor.querySelector(".cell-value-editor"),
		"ordinary list-details with a separate title column retain the existing full-value-cell editor path");
	detailsOnlyTable._exitEditMode(false);

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

	let untouchedCreateClosePayload,untouchedCreateCommits=0;
	const untouchedCreateRows=[];
	const untouchedCreateTable=new Tablance(host(),{
		onDataCommit:()=>untouchedCreateCommits++,details:{type:"list",entries:[
			{type:"repeated",dataKey:"history",nodeId:"untouchedCreateHistory",create:true,
				createData:()=>({event:"change",scope:null}),entry:{type:"group",
					closedRender:data=>`${data.event}:${data.scope??"missing"}`,onClose:payload=>{
						untouchedCreateClosePayload=payload;
						if (!payload.data.scope)
							payload.preventClose("A scope is required");
					},entries:[
						{title:"Event",dataKey:"event",input:{type:"text"}},
						{title:"Scope",dataKey:"scope",input:{type:"text"}},
					]},
			},
		]},
	},true,true,{searchbar:false});
	untouchedCreateTable.setData([{history:untouchedCreateRows}]);
	await tick();
	const untouchedRepeated=untouchedCreateTable.getDetailCell(0,"untouchedCreateHistory");
	untouchedRepeated.createNewEntry();
	const untouchedEntry=untouchedRepeated.children.find(child=>child.creating);
	assert(untouchedCreateTable._closeGroup(untouchedEntry)===false
		&&untouchedCreateClosePayload.mode==="create"&&untouchedCreateClosePayload.changed===true
		&&untouchedCreateRows.length===0&&untouchedEntry.creating&&untouchedEntry.el.classList.contains("open")
		&&untouchedCreateCommits===0,
		"an untouched non-empty createData draft must pass onClose validation before array insertion or persistence");
	untouchedEntry.dataObj.scope="legacy";
	assert(untouchedCreateTable._closeGroup(untouchedEntry)===true&&untouchedCreateRows.length===1
		&&untouchedCreateRows[0]===untouchedEntry.dataObj&&!untouchedEntry.creating&&untouchedCreateCommits===1
		&&untouchedEntry.el.querySelector("tr.group-render")?.textContent==="change:legacy",
		"a validated untouched createData draft commits once and receives its real closed render immediately");

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

	result.textContent=`${assertions.length} cell-state assertions passed`;
	result.dataset.status="passed";
} catch (error) {
	result.textContent=error.stack??String(error);
	result.dataset.status="failed";
}
