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
	Tablance.defaultLang={filterPlaceholder:"Global search"};
	const globalLangTable=new Tablance(host(),{main:{columns:[{dataKey:"value"}]}},true,true,{ordering:false});
	const localLangTable=new Tablance(host(),{main:{columns:[{dataKey:"value"}]}},true,true,
		{ordering:false,lang:{filterPlaceholder:"Local search"}});
	assert(globalLangTable._searchInput.placeholder==="Global search"
		&&localLangTable._searchInput.placeholder==="Local search",
		"global language defaults apply to every table while per-instance language keeps priority");
	Tablance.defaultLang={};
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
	const lockedPresentationRow={summary:"Ratsit",nested:{source:"Register",synced:"2026-09-01 10:15"}};
	const lockedPresentationTable=new Tablance(host(),{
		main:{columns:[{title:"Source",dataKey:"summary",nodeId:"lockedMain",render:({value})=>value}]},
		details:{type:"list",entries:[{type:"group",title:"Metadata",nodeId:"metadataGroup",dataPath:"nested",
			entries:[{title:"Source",dataKey:"source",nodeId:"lockedDetail",render:({value})=>value},
				{type:"lineup",entries:[{type:"field",title:"Last synced",dataKey:"synced",
					nodeId:"lockedLineupDetail",readOnly:true,render:({value})=>value}]}]}]},
	},true,true,{searchbar:false});
	lockedPresentationTable.setData([lockedPresentationRow]);
	await tick();
	lockedPresentationTable.selectCell(lockedPresentationRow,"lockedMain");
	key(lockedPresentationTable.rootEl,"c","KeyC",{ctrlKey:true});
	await Promise.resolve();
	assert(copied==="Ratsit","whole-cell Ctrl+C remains available for an implicit read-only main cell");
	const doubleClickLockedCursor=()=>lockedPresentationTable._cellCursor.dispatchEvent(
		new MouseEvent("dblclick",{bubbles:true,cancelable:true}));
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
	historyGroup.select();
	key(table.rootEl,"Enter","Enter");
	const historyEntries=historyGroup.children[0].children;
	assert(historyEntries.every(entry=>getComputedStyle(entry.el.parentElement.parentElement).paddingTop==="2px"),
		"every nested group row reserves the same space above its selection outline");
	assert(getComputedStyle(historyGroup.el).borderTopColor==="rgb(184, 198, 216)"
		&&getComputedStyle(historyEntries[0].el).borderTopColor==="rgb(184, 198, 216)"
		&&getComputedStyle(historyGroup.el).borderTopLeftRadius==="4px"
		&&getComputedStyle(historyEntries[0].el).borderTopLeftRadius==="4px"
		&&getComputedStyle(historyGroup.el).borderCollapse==="separate"
		&&getComputedStyle(historyEntries[0].el).borderSpacing==="0px 0px",
		"details groups use the subtle rounded blue-gray border with and without closedRender");
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
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="dashed"
		&&getComputedStyle(firstHistorySeparator).marginLeft==="0px"
		&&getComputedStyle(firstHistorySeparator).marginRight==="4px",
		"closed inner cell separators are dashed with balanced horizontal indentation");
	key(table.rootEl,"Enter","Enter");
	assert(historyEntries[0].el.classList.contains("open")&&table._activeSchemaNode.title==="Date",
		"Enter opens a selected closed-render group and selects its first editable field");
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
	assert(getComputedStyle(firstHistorySeparator).borderTopStyle==="dashed",
		"inner cell separators return to dashed when their group closes");
	historyEntries[0].el.classList.add("open");
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
			{type:"field",title:"Source",dataKey:"source",nodeId:"variantSource"},
			{type:"field",title:"Synced",dataKey:"synced",nodeId:"variantSynced"},
		]},
		{type:"lineup",entries:[
			{type:"field",nodeId:"variantControl",input:{type:"button",text:"Open"}},
		]},
		{type:"lineup",variant:"fields",entries:[
			{type:"field",title:"Forced field one",dataKey:"source",nodeId:"forcedFieldOne"},
			{type:"field",title:"Forced field two",dataKey:"synced",nodeId:"forcedFieldTwo"},
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
		{type:"group",title:"Nested",entries:[
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
	const [tabEntryOne,tabEntryTwo]=tabRepeated.children;
	const tabNestedCells=[tabEntryOne.children[0],...tabEntryOne.children[1].children,
		tabEntryTwo.children[0],...tabEntryTwo.children[1].children];
	const logicalCells=[];
	tabTable._collectLogicalDetailsCells(tabTable._openDetailsPanes[0],logicalCells);
	const expectedLogicalCells=[tabBefore,tabFirst,tabChoice,tabAfter,tabSource,tabSynced,
		...tabNestedCells,tabFinal];
	assert(logicalCells.length===expectedLogicalCells.length
		&&logicalCells.every((cell,index)=>cell===expectedLogicalCells[index]),
		"logical details order traverses rows, lineups, nested repeated entries, and skips hidden/disabled cells");
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
	for (const expected of [tabSource,tabSynced,...tabNestedCells,tabFinal]) {
		key(tabTable.rootEl,"Tab","Tab");
		assert(tabTable._activeDetailsCell===expected,"Tab follows logical details instance order");
	}
	key(tabTable.rootEl,"Tab","Tab");
	assert(tabTable._activeDetailsCell===tabFinal,"Tab at the final detail cell does not invent a DOM target");
	const reverse=[...tabNestedCells].reverse().concat(
		[tabSynced,tabSource,tabAfter,tabChoice,tabFirst,tabBefore]);
	for (const expected of reverse) {
		key(tabTable.rootEl,"Tab","Tab",{shiftKey:true});
		assert(tabTable._activeDetailsCell===expected,"Shift+Tab follows reverse logical details instance order");
	}
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
