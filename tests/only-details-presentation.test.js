const Tablance=window.Tablance;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const host=()=>document.body.appendChild(document.createElement('div'));
const settleLayout=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>requestAnimationFrame(resolve))};
const fields=()=>[
 {dataKey:'none',nodeId:'none',title:'No hint',input:{type:'text'}},
 {dataKey:'editOnly',nodeId:'editOnly',title:'Edit only',input:{type:'text',placeholder:'Editor hint'}},
 {dataKey:'displayOnly',nodeId:'displayOnly',title:'Display only',displayPlaceholder:'Display hint',input:{type:'text'}},
 {dataKey:'both',nodeId:'both',title:'Both',displayPlaceholder:'Short hint',input:{type:'text',placeholder:'Long hint'}},
 {dataKey:'boolean',nodeId:'boolean',displayPlaceholder:'Choose',input:{type:'select',boolean:true}},
 {dataKey:'selectEmpty',nodeId:'selectEmpty',displayPlaceholder:'Select a value',
  input:{type:'select',options:[{value:'',text:'None'},{value:'chosen',text:'Chosen'}]}},
];
const row={none:'',editOnly:'',displayOnly:'',both:'',boolean:null,selectEmpty:''};
const standalone=new Tablance(host(),{details:{type:'grid',title:'Contact details',columns:2,entries:fields()}},true,true,{searchbar:false});
standalone.setData(row);
const cell=key=>standalone.getDetailCell(0,key);
const panel=standalone.rootEl.querySelector(':scope>.only-details-content');
const header=panel.querySelector(':scope>.only-details-header');
const body=panel.querySelector(':scope>.only-details-body');
assert(header.textContent==='Contact details'&&body.contains(cell('both').el),'existing details.title renders an integrated header');
assert(getComputedStyle(header).borderBottomWidth==='1px'&&getComputedStyle(header).backgroundColor!==getComputedStyle(panel).backgroundColor,'header has subtle background and divider');
assert(getComputedStyle(panel).borderTopWidth==='1px'&&getComputedStyle(panel).borderTopLeftRadius!=='0px'&&parseFloat(getComputedStyle(body).paddingLeft)>0,'standalone panel has a frame and padded body');
assert(cell('none').el.textContent===''&&cell('editOnly').el.textContent==='','neither an absent nor an edit placeholder appears in display mode');
assert(cell('displayOnly').el.textContent==='Display hint'&&cell('both').el.textContent==='Short hint'&&cell('boolean').el.textContent==='Choose'&&cell('selectEmpty').el.textContent==='Select a value','displayPlaceholder works without fallback to the editor placeholder or empty select option text');
for(const key of ['displayOnly','both','boolean','selectEmpty'])assert(cell(key).el.classList.contains('tablance-presentation-placeholder'),`${key} uses placeholder styling`);
const placeholderColor=getComputedStyle(standalone.rootEl).getPropertyValue('--tablance-placeholder-color').trim();
const colorSample=standalone.rootEl.appendChild(document.createElement('span'));
colorSample.style.color=placeholderColor;
assert(getComputedStyle(cell('both').el).color===getComputedStyle(colorSample).color&&getComputedStyle(cell('both').el).color!==getComputedStyle(cell('none').el).color,'display placeholder uses a distinct Tablance color');
colorSample.remove();
assert(getComputedStyle(cell('both').el).fontStyle==='normal'&&getComputedStyle(cell('both').el).cursor==='cell','display placeholder uses normal text style with a cell cursor');
assert(cell('none').outerContainerEl.getBoundingClientRect().height<55&&getComputedStyle(cell('editOnly').outerContainerEl).borderInlineStartWidth==='1px'&&panel.querySelector('.grid-row-separator'),'standalone grid is compact with subtle separators');
for(const [key,expected] of [['none',''],['editOnly','Editor hint'],['displayOnly',''],['both','Long hint']]){
 standalone.selectCell(0,key,{enterEditMode:true});const input=standalone._cellCursor.querySelector('input.text-editor');
 assert(input?.placeholder===expected&&getComputedStyle(input).cursor==='text',`${key} has its own edit placeholder`);
	if(expected)assert(getComputedStyle(input,'::placeholder').color===getComputedStyle(cell('both').el).color&&getComputedStyle(input,'::placeholder').fontStyle==='normal',`${key} editor placeholder uses Tablance styling`);
 standalone._exitEditMode(false);
}
standalone.selectCell(0,'both');
assert(getComputedStyle(standalone._cellCursor).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(standalone._cellCursor).paddingTop==='0px','cell cursor does not inherit the panel frame');
standalone.selectCell(0,'both',{enterEditMode:true});
assert(standalone._cellCursor.querySelector('.cell-value-editor').getBoundingClientRect().top>=cell('both').selEl.querySelector(':scope>span.title').getBoundingClientRect().bottom,'inline title stays visible in edit mode');
standalone._exitEditMode(false);
standalone.updateData(row,'displayOnly','Real value');standalone.updateData(row,'both','Real value');standalone.updateData(row,'boolean',false);standalone.updateData(row,'selectEmpty','chosen');
assert(cell('displayOnly').el.textContent==='Real value'&&cell('both').el.textContent==='Real value'&&cell('boolean').el.textContent==='No'&&cell('selectEmpty').el.textContent==='Chosen'&&!cell('both').el.classList.contains('tablance-presentation-placeholder'),'real values replace display placeholders including false');
const renderedSchema={type:'field',dataKey:'stored',displayPlaceholder:'Unused hint',
 render:()=>({content:'',presenceValue:true}),input:{type:'text'}};
assert(standalone._getCellPresentation(renderedSchema,{stored:'Stored value'},0).placeholder==null,
 'a field renderer cannot expose displayPlaceholder over a nonempty actual value');
standalone.selectCell(0,'both',{enterEditMode:true});
const filledEditor=standalone._cellCursor.querySelector('input.text-editor');
assert(filledEditor?.value==='Real value'&&filledEditor.placeholder==='Long hint','filled edit cells retain their real value and independent editor hint');
standalone._exitEditMode(false);
standalone.selectCell(0,'none');
standalone.rootEl.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true}));
assert(standalone._activeSchemaNode?.dataKey==='editOnly','keyboard navigation still moves between onlyDetails cells');
const expandedHost=host();expandedHost.style.width='700px';
const expanded=new Tablance(expandedHost,{main:{columns:[{type:'expand'},{dataKey:'name'}]},details:{type:'list',title:'Expanded title',entries:fields()}},true,true,{searchbar:false,ordering:false});
const expandedRow={name:'Row',...row,displayOnly:'',both:'',boolean:null,selectEmpty:''};expanded.setData([expandedRow]);expanded.expandRow(0);
assert(expanded.getDetailCell(0,'editOnly').el.textContent===''&&expanded.getDetailCell(0,'both').el.textContent==='Short hint','expanded details use independent placeholders');
assert(!expanded.rootEl.classList.contains('only-details')&&!expanded.rootEl.querySelector('.only-details-header'),'expanded details do not gain a standalone panel/header');
expanded.selectCell(0,'both',{enterEditMode:true});assert(expanded._cellCursor.querySelector('input.text-editor')?.placeholder==='Long hint','expanded editor uses its own placeholder');expanded._exitEditMode(false);
expanded.updateData(expandedRow,'both','Filled');assert(expanded.getDetailCell(0,'both').el.textContent==='Filled','expanded real value replaces placeholder');
expanded.selectCell(0,'both');expandedHost.style.width='420px';await settleLayout();
const expandedRect=expanded._getCursorGeometryEl().getBoundingClientRect(),expandedCursorRect=expanded._cellCursor.getBoundingClientRect();
assert(Math.abs(expandedRect.left-expandedCursorRect.left)<1&&Math.abs(expandedRect.width-expandedCursorRect.width)<1,'expanded ordinary details reuse cursor geometry synchronization');
expanded.selectCell(0,'name');expandedHost.style.width='560px';await settleLayout();
const mainRect=expanded._selectedCell.getBoundingClientRect(),mainCursorRect=expanded._cellCursor.getBoundingClientRect();
assert(Math.abs(mainRect.left-mainCursorRect.left)<1&&Math.abs(mainRect.width-mainCursorRect.width)<1,'ordinary main cells reuse cursor geometry synchronization');
for(const withMain of [false,true]){
 const conditionalData={name:'Conditional',show:false,value:''};
 const conditionalSchema={details:{type:'grid',columns:3,entries:[
  {type:'field',title:'Duration',disabledIf:()=>true,render:()=>({content:'',presenceValue:true})},
  {type:'field',dataKey:'show',nodeId:'show',input:{type:'select',options:[{value:false,text:'Hide'},{value:true,text:'Show'}]}},
  {type:'field',dataKey:'value',nodeId:'value',dependsOn:'show',
   visibleIf:({rowData})=>rowData.show,input:{type:'text'}},
 ]}};
 if(withMain)conditionalSchema.main={columns:[{type:'expand'},{dataKey:'name'}]};
 const conditionalHost=host();conditionalHost.style.width='700px';
 const conditionalTable=new Tablance(conditionalHost,conditionalSchema,true,true,{searchbar:false,ordering:false});
 conditionalTable.setData(withMain?[conditionalData]:conditionalData);
 if(withMain)conditionalTable.expandRow(0);
 const conditionalCell=conditionalTable.getDetailCell(0,'value');
 const showCell=conditionalTable.getDetailCell(0,'show');
 const grid=showCell.parent;
 const matchesCursor=()=>{const cellRect=showCell.outerContainerEl.getBoundingClientRect();
  const cursorRect=conditionalTable._cellCursor.getBoundingClientRect();
  return Math.abs(cellRect.left-cursorRect.left)<1&&Math.abs(cellRect.width-cursorRect.width)<1};
 assert(conditionalCell.hidden&&!conditionalCell.outerContainerEl.isConnected
  &&showCell.gridColumn===1&&showCell.gridColumnSpan===2
  &&grid.gridRows[0][1]===showCell&&grid.gridRows[0][2]===showCell,
  'a trailing visibleIf field is absent and the preceding real grid cell fills its tracks');
 assert(conditionalTable.selectCell(0,'value')===false,
  'a hidden field cannot be selected through the public cell API');
 conditionalTable.selectCell(0,'show');
 assert(matchesCursor()&&Math.abs(showCell.outerContainerEl.getBoundingClientRect().right
  -grid.containerEl.getBoundingClientRect().right)<2,
  'the ordinary cell cursor follows a real cell reaching the end of the grid');
 conditionalHost.style.width='530px';await settleLayout();
 assert(matchesCursor(),'the actual cell and cursor resize together when narrowed');
 conditionalHost.style.width='760px';await settleLayout();
 assert(matchesCursor(),'the actual cell and cursor resize together when widened');
 conditionalTable.selectCell(0,'show',{enterEditMode:true});
 assert(matchesCursor(),'edit mode still uses the actual cell geometry');
 conditionalTable._exitEditMode(false);
 conditionalTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true}));
 assert(conditionalTable._activeDetailsCell===showCell,'keyboard navigation skips the hidden field');
 conditionalData.show=true;conditionalTable.refreshSubtree(conditionalCell);
 assert(!conditionalCell.hidden&&conditionalCell.outerContainerEl.isConnected
  &&showCell.gridColumnSpan===1&&conditionalCell.gridColumn===2
  &&grid.gridRows[0][2]===conditionalCell,
  'revealing visibleIf restores the two separate grid cells');
 assert(matchesCursor(),'the selected cell and cursor both return to their original width');
 conditionalTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true}));
 assert(conditionalTable._activeDetailsCell===conditionalCell,
  'keyboard navigation reaches the revealed cell');
 conditionalData.show=false;conditionalTable.refreshSubtree(conditionalCell);
 assert(conditionalCell.hidden&&!conditionalCell.outerContainerEl.isConnected
  &&showCell.gridColumnSpan===2&&conditionalTable._activeDetailsCell===showCell&&matchesCursor(),
  'hiding the selected cell restores the single wide cell and moves the cursor onto it');
 conditionalTable._clearCursorForViewTransition();
 (window.nativeGridHoverTargets??=[]).push({table:conditionalTable,showCell});
}
const reflowData={first:'First',conditional:'Conditional',next:'Next',show:false};
const reflowTable=new Tablance(host(),{details:{type:'grid',columns:2,entries:[
 {dataKey:'first',nodeId:'first',input:{type:'text'}},
 {dataKey:'conditional',nodeId:'conditional',dependsOn:'show',
  visibleIf:({rowData})=>rowData.show,input:{type:'text'}},
 {dataKey:'next',nodeId:'next',input:{type:'text'}},
]}},true,true,{searchbar:false});
reflowTable.setData(reflowData);
const reflowNext=reflowTable.getDetailCell(0,'next');
const reflowConditional=reflowTable.getDetailCell(0,'conditional');
assert(reflowConditional.hidden&&reflowNext.gridRow===0&&reflowNext.gridColumn===1,
 'a visible field following a hidden field keeps the existing compact grid reflow');
reflowTable.selectCell(0,'first');
reflowTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowRight',code:'ArrowRight',bubbles:true,cancelable:true}));
assert(reflowTable._activeDetailsCell===reflowNext,
 'navigation reaches the next visible field after a hidden field');
reflowData.show=true;reflowTable.refreshSubtree(reflowConditional);
assert(!reflowConditional.hidden&&reflowConditional.gridColumn===1&&reflowNext.gridRow===1,
 'reveal returns the following field to its original row');
const bulk=new Tablance(host(),{main:{columns:[{type:'select'},{dataKey:'name',input:{type:'text',bulkEdit:true}}]}},true,true,{searchbar:false,ordering:false});
bulk.setData([{name:'First'},{name:'Second'}]);
const bulkRoot=bulk._bulkEditTable.rootEl,bulkPanel=bulkRoot.querySelector(':scope>.only-details-content');
assert(bulkRoot.classList.contains('tablance-bulk-edit-details')&&bulkPanel&&!bulkPanel.querySelector('.only-details-header')&&getComputedStyle(bulkPanel).borderTopWidth==='0px','bulkEdit is an explicit internal variant without a standalone frame');
const layoutHost=host();layoutHost.style.width='760px';
const layoutTable=new Tablance(layoutHost,{details:{type:'grid',columns:['fit-content(16rem)','8rem','minmax(0, 1fr)'],entries:[
 {type:'field',title:'C/O',disabledIf:()=>true,render:()=>({content:'',presenceValue:true})},
 {type:'field',dataKey:'fixed',nodeId:'fixed',input:{type:'text'}},
 {type:'field',dataKey:'fluid',nodeId:'fluid',input:{type:'text'}},
]}},true,true,{searchbar:false});
layoutTable.setData({fixed:'Fixed',fluid:'Flexible'});
const cursorMatches=key=>{const cellRect=layoutTable.getDetailCell(0,key).outerContainerEl.getBoundingClientRect();
 const cursorRect=layoutTable._cellCursor.getBoundingClientRect();
 return Math.abs(cellRect.left-cursorRect.left)<1&&Math.abs(cellRect.top-cursorRect.top)<1
  &&Math.abs(cellRect.width-cursorRect.width)<1&&Math.abs(cellRect.height-cursorRect.height)<1};
layoutTable.selectCell(0,'fluid');
assert(cursorMatches('fluid'),'active cursor initially matches a flexible grid cell');
layoutHost.style.width='360px';await settleLayout();
assert(cursorMatches('fluid')&&layoutTable._activeSchemaNode.dataKey==='fluid','active cursor follows a narrower flexible grid track without changing selection');
layoutHost.style.width='900px';await settleLayout();
assert(cursorMatches('fluid')&&layoutTable._activeSchemaNode.dataKey==='fluid','active cursor follows a wider flexible grid track');
layoutTable.selectCell(0,'fluid',{enterEditMode:true});
layoutHost.style.width='500px';await settleLayout();
assert(layoutTable._inEditMode&&cursorMatches('fluid'),'resize keeps an active editor aligned with its cell');
layoutTable._exitEditMode(false);
layoutTable.selectCell(0,'fixed');
const fixedLeft=layoutTable.getDetailCell(0,'fixed').outerContainerEl.getBoundingClientRect().left;
layoutHost.querySelector('.details-grid>span .title').textContent='A much longer label that changes the first grid track';
await settleLayout();
assert(layoutTable.getDetailCell(0,'fixed').outerContainerEl.getBoundingClientRect().left>fixedLeft
 &&cursorMatches('fixed'),'sibling content moves a fixed-width cell and its cursor together');
const linkedTables=Array.from({length:3},(_,index)=>{
 const table=new Tablance(host(),{details:{type:'grid',columns:1,entries:[
  {type:'field',dataKey:'value',nodeId:'value',input:{type:'text',validation:value=>value!=='blocked'}},
 ]}},true,true,{searchbar:false});
 table.setData({value:`Table ${index+1}`});
 return table;
});
linkedTables[0].chainTables(...linkedTables.slice(1));
const clickLinked=table=>table.getDetailCell(0,'value').selEl.dispatchEvent(
 new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
clickLinked(linkedTables[0]);clickLinked(linkedTables[2]);
assert(linkedTables[0]._cellCursor.style.display==='none'
 &&!linkedTables[0]._selectedCell?.classList.contains('tablance-active-cell')
 &&linkedTables[2]._cellCursor.style.display==='block',
 'clicking a nonadjacent chained onlyDetails table hides the previous cursor');
clickLinked(linkedTables[1]);
assert(linkedTables[2]._cellCursor.style.display==='none'
 &&linkedTables[1]._cellCursor.style.display==='block','another pointer switch keeps one linked cursor visible');
linkedTables[0].selectCell(0,'value');
assert(linkedTables[1]._cellCursor.style.display==='none'
 &&!linkedTables[1]._selectedCell?.classList.contains('tablance-active-cell')
 &&linkedTables[0]._cellCursor.style.display==='block',
 'public selectCell transfers cursor ownership across linked tables');
clickLinked(linkedTables[0]);
linkedTables[0].rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(linkedTables[0]._cellCursor.style.display==='none'
 &&linkedTables[1]._cellCursor.style.display==='block','keyboard navigation still transfers the linked cursor');
linkedTables[1].selectCell(0,'value',{enterEditMode:true});
const linkedEditor=linkedTables[1]._cellCursor.querySelector('input.text-editor');
linkedEditor.value='blocked';
assert(linkedTables[2].selectCell(0,'value')===false
 &&linkedTables[1]._inEditMode&&linkedTables[1]._cellCursor.style.display==='block'
 &&linkedTables[2]._cellCursor.style.display==='none',
 'programmatic selection cannot strand an invalid draft in another linked table');
clickLinked(linkedTables[2]);
assert(linkedTables[1]._inEditMode&&linkedTables[1]._cellCursor.style.display==='block'
 &&linkedTables[2]._cellCursor.style.display==='none','a rejected edit keeps the old linked cursor and draft');
linkedEditor.value='Saved';clickLinked(linkedTables[2]);
assert(!linkedTables[1]._inEditMode&&linkedTables[1]._filteredData[0].value==='Saved'
 &&linkedTables[1]._cellCursor.style.display==='none'
 &&linkedTables[2]._cellCursor.style.display==='block','a valid draft commits before pointer activation moves to another linked table');
linkedTables[0].selectCell(0,'value');
assert(linkedTables[2]._cellCursor.style.display==='none'
 &&linkedTables[0]._cellCursor.style.display==='block',
 'public selection after pointer activation still leaves a single linked cursor');
const mainTables=Array.from({length:2},()=>{
 const table=new Tablance(host(),{main:{columns:[{type:'select'},{dataKey:'value'}]}},true,true,{searchbar:false,ordering:false});
 table.setData([{value:'Main'}]);return table;
});
mainTables[0].chainTables(mainTables[1]);mainTables[0].selectCell(0,'value');
mainTables[1]._mainTbody.querySelector('tr:not(.details)>td:nth-child(2)').dispatchEvent(
 new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
assert(mainTables[0]._cellCursor.style.display==='none'
 &&mainTables[1]._cellCursor.style.display==='block','ordinary chained main tables share pointer cursor ownership');
mainTables[0]._mainTbody.querySelector('tr:not(.details)>td.select-col').dispatchEvent(
 new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
assert(mainTables[0]._cellCursor.style.display==='block'
 &&mainTables[1]._cellCursor.style.display==='none','an action cell reactivates a previously hidden chained main table');
mainTables[1].selectCell(0,'value');
assert(mainTables[0]._cellCursor.style.display==='none'
 &&mainTables[1]._cellCursor.style.display==='block',
 'programmatic selection also transfers cursor ownership for chained main tables');
const result=document.getElementById('test-results');result.textContent='standalone, expanded, bulkEdit, and linked table checks passed';result.dataset.status='passed';
