const Tablance=window.Tablance;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const host=()=>document.body.appendChild(document.createElement('div'));
const settleLayout=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>requestAnimationFrame(resolve))};
const fields=()=>[
 {dataKey:'none',nodeId:'none',title:'No hint',input:{type:'text'}},
 {dataKey:'editOnly',nodeId:'editOnly',title:'Edit only',input:{type:'text',placeholder:'Editor hint'}},
 {dataKey:'displayOnly',nodeId:'displayOnly',title:'Display only',displayPlaceholder:'Display hint',input:{type:'text'}},
 {dataKey:'both',nodeId:'both',title:'Both',displayPlaceholder:'Short hint',helpText:'Expanded detail help',input:{type:'text',placeholder:'Long hint'}},
 {dataKey:'boolean',nodeId:'boolean',displayPlaceholder:'Choose',input:{type:'select',boolean:true}},
 {dataKey:'selectEmpty',nodeId:'selectEmpty',displayPlaceholder:'Select a value',helpText:'Select help',
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
standalone.selectCell(0,'selectEmpty',{enterEditMode:true});
const selectPopup=standalone._selectContext.selectContainer;
assert(selectPopup.scrollWidth<=selectPopup.clientWidth
 &&selectPopup.querySelector('ul.main').scrollWidth<=selectPopup.querySelector('ul.main').clientWidth,
 'short select options do not scroll horizontally because of the hidden keyboard input');
assert(standalone._tooltip.classList.contains('cell-help')
 &&standalone._selectContext.input.getAttribute('aria-describedby')===standalone._tooltip.id,
 'select editors receive the same contextual help and accessible description');
standalone._exitEditMode(false);
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
expanded.selectCell(0,'both',{enterEditMode:true});assert(expanded._cellCursor.querySelector('input.text-editor')?.placeholder==='Long hint','expanded editor uses its own placeholder');
assert(expanded._tooltip.classList.contains('cell-help')
 &&expanded._tooltip.firstChild.textContent==='Expanded detail help',
 'ordinary expanded details also show edit-only field help');expanded._exitEditMode(false);
expanded.updateData(expandedRow,'both','Filled');assert(expanded.getDetailCell(0,'both').el.textContent==='Filled','expanded real value replaces placeholder');
expanded.selectCell(0,'both');expandedHost.style.width='420px';await settleLayout();
const expandedRect=expanded._getCursorGeometryEl().getBoundingClientRect(),expandedCursorRect=expanded._cellCursor.getBoundingClientRect();
assert(Math.abs(expandedRect.left-expandedCursorRect.left)<1&&Math.abs(expandedRect.width-expandedCursorRect.width)<1,'expanded ordinary details reuse cursor geometry synchronization');
expanded.selectCell(0,'name');expandedHost.style.width='560px';await settleLayout();
const mainRect=expanded._selectedCell.getBoundingClientRect(),mainCursorRect=expanded._cellCursor.getBoundingClientRect();
assert(Math.abs(mainRect.left-mainCursorRect.left)<1&&Math.abs(mainRect.width-mainCursorRect.width)<1,'ordinary main cells reuse cursor geometry synchronization');
const expandCell=expanded._mainTbody.querySelector('tr:not(.details)>td.expand-col');
expanded._selectCell(expandCell,expanded._colSchemaNodes[0],expandedRow);
assert(expanded._cellCursor.classList.contains('action-cell')
 &&!expanded._cellCursor.classList.contains('button-action-cell')
 &&getComputedStyle(expanded._cellCursor).outlineStyle==='none'
 &&getComputedStyle(expanded._cellCursor).borderBottomWidth==='2px',
 'expand controls keep a complete inset cell cursor instead of a button ring');
for(const withMain of [false,true]){
 const conditionalData={name:'Conditional',show:false,value:''};
 const conditionalSchema={details:{type:'grid',columns:3,preserveRowsWhenHidden:true,entries:[
  {type:'field',title:'Duration',disabledIf:()=>true,render:()=>({content:'',presenceValue:true})},
  {type:'field',dataKey:'show',nodeId:'show',input:{type:'select',options:[{value:false,text:'Hide'},{value:true,text:'Show'}]}},
  {type:'field',dataKey:'value',nodeId:'value',dependsOn:'show',
   visibleIf:({rowData})=>rowData.show,input:{type:'text'}},
  {type:'field',title:'Next row',disabledIf:()=>true,render:()=>({content:'',presenceValue:true})},
  {type:'field',dataKey:'next',nodeId:'next',columnSpan:2,input:{type:'text'}},
 ]}};
 if(withMain)conditionalSchema.main={columns:[{type:'expand'},{dataKey:'name'}]};
 const conditionalHost=host();conditionalHost.style.width='700px';
 const conditionalTable=new Tablance(conditionalHost,conditionalSchema,true,true,{searchbar:false,ordering:false});
 conditionalTable.setData(withMain?[conditionalData]:conditionalData);
 if(withMain)conditionalTable.expandRow(0);
 const conditionalCell=conditionalTable.getDetailCell(0,'value');
 const showCell=conditionalTable.getDetailCell(0,'show');
 const nextCell=conditionalTable.getDetailCell(0,'next');
 const grid=showCell.parent;
 const matchesCursor=()=>{const cellRect=showCell.outerContainerEl.getBoundingClientRect();
  const cursorRect=conditionalTable._cellCursor.getBoundingClientRect();
  return Math.abs(cellRect.left-cursorRect.left)<1&&Math.abs(cellRect.width-cursorRect.width)<1};
 assert(conditionalCell.hidden&&!conditionalCell.outerContainerEl.isConnected
  &&showCell.gridColumn===1&&showCell.gridColumnSpan===2
  &&grid.gridRows[0][1]===showCell&&grid.gridRows[0][2]===showCell
  &&nextCell.gridRow===1,
  'a hidden final field in a schema row expands the preceding cell without pulling up the next row');
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
  &&grid.gridRows[0][2]===conditionalCell&&nextCell.gridRow===1,
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
const hiddenEditData={show:true,choice:'Visible',value:'Draft',next:'Next'};
const hiddenEditTable=new Tablance(host(),{details:{type:'grid',columns:1,entries:[
 {dataKey:'choice',nodeId:'choice',input:{type:'text'}},
 {dataKey:'value',nodeId:'value',visibleIf:({rowData})=>rowData.show,input:{type:'text'}},
 {dataKey:'next',nodeId:'next',input:{type:'text'}},
]}},true,true,{searchbar:false});
hiddenEditTable.setData(hiddenEditData);
hiddenEditTable.selectCell(0,'value',{enterEditMode:true});
hiddenEditData.show=false;
hiddenEditTable.refreshSubtree(hiddenEditTable._openDetailsPanes[0]);
assert(hiddenEditTable.getDetailCell(0,'value').hidden
 &&hiddenEditTable._cellCursor.style.display==='none',
 'hiding an edited only-details cell during refresh hides its detached cursor without accessing a main-table viewport');
assert(hiddenEditTable.selectCell(0,'choice'),
 'a later click can still select a visible cell after the edited cell disappeared');
assert(hiddenEditTable.selectCell(0,'choice',{enterEditMode:true})&&hiddenEditTable._inEditMode,
 'the remaining visible cell can still enter edit mode after the conditional row disappears');
hiddenEditTable._exitEditMode(false);
hiddenEditTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(hiddenEditTable._activeSchemaNode?.dataKey==='next',
 'keyboard navigation still reaches the next visible cell after a conditional row disappears');
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
linkedTables[1].rootEl.dispatchEvent(new MouseEvent('mousedown',
 {bubbles:true,cancelable:true,button:0}));
linkedTables[1]._focusEl.focus();
assert(document.activeElement===linkedTables[0]._focusEl
 &&linkedTables[0]._cellCursor.style.display==='block'
 &&linkedTables[1]._cellCursor.style.display==='none',
 'a non-cell click in a linked onlyDetails table keeps focus with the active cell');
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
const focusTables=Array.from({length:2},(_,index)=>{
 const columns=[{title:'Value',dataKey:'value'}];
 if(index===1)columns.push({title:'Unavailable',dataKey:'disabled',disabled:true});
 const table=new Tablance(host(),{main:{columns}},true,true,
  {searchbar:false,ordering:index===1});
 table.setData([{value:`${index}-0`},{value:`${index}-1`}]);
 return table;
});
focusTables[0].chainTables(focusTables[1]);
focusTables[1].selectCell(0,'value');
focusTables[0].selectCell(0,'value');
const chainedHeader=focusTables[1]._headerTr.cells[0];
chainedHeader.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
focusTables[1]._focusEl.focus();
assert(document.activeElement===focusTables[0]._focusEl
 &&focusTables[0]._cellCursor.style.display==='block'
 &&focusTables[1]._cellCursor.style.display==='none',
 'a non-cell pointer focus in a chained table returns to the visible cursor owner');
window.nativeLinkedHeader=chainedHeader;
chainedHeader.scrollIntoView({behavior:'instant',block:'center'});
document.getElementById('test-results').dataset.status='awaiting-native-linked-header';
await new Promise(resolve=>window.finishNativeLinkedHeader=resolve);
assert(document.activeElement===focusTables[0]._focusEl
 &&focusTables[0]._cellCursor.style.display==='block'
 &&focusTables[1]._cellCursor.style.display==='none',
 'a trusted linked-header click keeps keyboard focus on the active cell table');
const headerSelection=getSelection(),headerRange=document.createRange();
headerRange.selectNodeContents(chainedHeader.querySelector('.tablance-main-header-title'));
headerSelection.removeAllRanges();headerSelection.addRange(headerRange);
chainedHeader.click();
assert(headerSelection.toString().trim()==='Value'&&focusTables[1]._sortingCols.length===1
 &&document.activeElement===focusTables[0]._focusEl,
 'linked header sorting and ordinary text selection remain available without transferring focus');
headerSelection.removeAllRanges();
const linkedPassiveRow=focusTables[1]._mainRowIndex;
focusTables[0]._focusEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(focusTables[0]._mainRowIndex===1&&focusTables[1]._mainRowIndex===linkedPassiveRow,
 'arrow navigation after a linked header click moves the owning table cursor');
focusTables[0].selectCell(0,'value');
for(const [surface,label] of [
 [focusTables[1]._tableArea,'blank table area'],
 [focusTables[1]._mainTbody.rows[0].cells[1],'nonselectable cell'],
]){
 surface.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
 focusTables[1]._focusEl.focus();
 assert(document.activeElement===focusTables[0]._focusEl
  &&focusTables[0]._cellCursor.style.display==='block'
  &&focusTables[1]._cellCursor.style.display==='none',
  `${label} in a chained table keeps keyboard focus with its active cell owner`);
}
const blankLinkedArea=focusTables[1]._tableArea.insertBefore(
 document.createElement('div'),focusTables[1]._tableArea.firstChild);
blankLinkedArea.textContent='Blank table area';
blankLinkedArea.style.height='24px';
window.nativeLinkedNonCellTargets=[blankLinkedArea,focusTables[1]._mainTbody.rows[0].cells[1]];
for(let index=0;index<window.nativeLinkedNonCellTargets.length;index++){
 window.nativeLinkedNonCellTargets[index].scrollIntoView({behavior:'instant',block:'center'});
 document.getElementById('test-results').dataset.status=`awaiting-native-linked-noncell-${index}`;
 await new Promise(resolve=>window.finishNativeLinkedNonCell=resolve);
 assert(document.activeElement===focusTables[0]._focusEl
  &&focusTables[0]._cellCursor.style.display==='block'
  &&focusTables[1]._cellCursor.style.display==='none',
  `a trusted non-cell click ${index} in a chained table preserves the active cell owner`);
}
const separateTables=Array.from({length:2},()=>{
 const table=new Tablance(host(),{main:{columns:[{title:'Value',dataKey:'value'}]}},true,true,
  {searchbar:false,ordering:false});
 table.setData([{value:'First'},{value:'Second'}]);
 return table;
});
separateTables[1].selectCell(0,'value');
separateTables[0].selectCell(0,'value');
separateTables[1]._headerTr.cells[0].dispatchEvent(new MouseEvent('mousedown',
 {bubbles:true,cancelable:true,button:0}));
separateTables[1]._focusEl.focus();
assert(document.activeElement===separateTables[1]._focusEl,
 'a non-cell pointer focus transfers to an unchained table');
separateTables[0]._focusEl.focus();
separateTables[1]._tableArea.dispatchEvent(new MouseEvent('mousedown',
 {bubbles:true,cancelable:true,button:0}));
separateTables[1]._focusEl.focus();
assert(document.activeElement===separateTables[1]._focusEl,
 'blank space focuses a clicked unchained table');
separateTables[1]._focusEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(separateTables[1]._mainRowIndex===1&&separateTables[0]._mainRowIndex===0,
 'arrow navigation after an unchained header click moves the clicked table cursor');
const helpTable=new Tablance(host(),{details:{type:'grid',columns:2,entries:[
 {type:'field',dataKey:'helped',nodeId:'helped',helpText:'How to enter this value',input:{type:'text'}},
 {type:'field',dataKey:'plain',nodeId:'plain',input:{type:'text'}},
]}},true,true,{searchbar:false});
helpTable.setData({helped:'',plain:''});
helpTable.selectCell(0,'helped');
assert(!helpTable._tooltip.isConnected,'cell help does not appear for the selected cursor');
helpTable.selectCell(0,'helped',{enterEditMode:true});
let helpEditor=helpTable._cellCursor.querySelector('input.text-editor');
assert(helpTable._tooltip.isConnected&&helpTable._tooltip.classList.contains('cell-help')
 &&helpTable._tooltip.textContent.includes('How to enter this value')
 &&helpEditor.getAttribute('aria-describedby')===helpTable._tooltip.id,
 'entering edit mode opens accessible cell help without a hover trigger');
await new Promise(resolve=>setTimeout(resolve,0));
assert(getComputedStyle(helpTable._tooltip).visibility==='visible',
 'cell help becomes visible while the editor remains active');
const tooltipAnchor=document.createElement('div');
tooltipAnchor.style.cssText=`position:fixed;left:${document.documentElement.clientWidth-160}px;top:260px;width:110px;height:28px`;
helpTable.rootEl.appendChild(tooltipAnchor);
const longHelp='Antal månader är en uppskattning. Den särskilda postadressen tas inte bort automatiskt när perioden har gått ut. Borttagande måste anmälas separat.';
helpTable.rootEl.parentElement.style.width='500px';
helpTable._showTooltip(longHelp,tooltipAnchor,undefined,true);
await settleLayout();
let tooltipRect=helpTable._tooltip.getBoundingClientRect();
let anchorRect=tooltipAnchor.getBoundingClientRect();
let caretX=parseFloat(helpTable._tooltip.style.getPropertyValue('--tooltip-caret-x'));
assert(helpTable._tooltip.matches(':popover-open')&&helpTable._tooltip.classList.contains('above')
 &&tooltipRect.bottom<anchorRect.top&&tooltipRect.width<=380&&tooltipRect.height>40
 &&tooltipRect.right>helpTable.rootEl.getBoundingClientRect().right
 &&tooltipRect.right<=document.documentElement.clientWidth-12,
 'cell help prefers above, may extend past the table, and keeps a viewport margin');
assert(document.activeElement===helpEditor,
 'opening the popover leaves keyboard focus in the active editor');
assert(Math.abs(tooltipRect.left+caretX-(anchorRect.left+anchorRect.width/2))<1
 &&getComputedStyle(helpTable._tooltip,'::after').borderTopColor!==getComputedStyle(helpTable._tooltip,'::after').borderBottomColor
 &&getComputedStyle(helpTable._tooltip).overflow==='visible',
 'visible lower-edge caret points to the actual cell after horizontal shifting');
tooltipAnchor.style.top='8px';
window.dispatchEvent(new Event('resize'));
await settleLayout();
tooltipRect=helpTable._tooltip.getBoundingClientRect();
anchorRect=tooltipAnchor.getBoundingClientRect();
caretX=parseFloat(helpTable._tooltip.style.getPropertyValue('--tooltip-caret-x'));
assert(helpTable._tooltip.classList.contains('below')&&tooltipRect.top>anchorRect.bottom
 &&tooltipRect.left>=12&&tooltipRect.right<=document.documentElement.clientWidth-12
 &&Math.abs(tooltipRect.left+caretX-(anchorRect.left+anchorRect.width/2))<1
 &&getComputedStyle(helpTable._tooltip,'::after').borderBottomColor!==getComputedStyle(helpTable._tooltip,'::after').borderTopColor,
 'popover moves below near the top edge and keeps its caret aimed at the cell');
tooltipAnchor.style.top='120px';
document.dispatchEvent(new Event('scroll'));
await settleLayout();
assert(helpTable._tooltip.getBoundingClientRect().top!==tooltipRect.top,
 'tooltip position follows scrolling and anchor movement');
tooltipAnchor.remove();
helpTable.rootEl.parentElement.style.removeProperty('width');
helpTable._dismissTooltip();
helpTable._showCellEditHelp();
helpEditor.dispatchEvent(new KeyboardEvent('keydown',{key:'a',code:'KeyA',bubbles:true}));
assert(helpTable._tooltip.isConnected,'typing leaves edit help visible');
helpTable._showTooltip('Invalid value');
assert(!helpTable._tooltip.classList.contains('cell-help')
 &&helpTable._tooltip.firstChild.textContent==='Invalid value'
 &&helpTable._tooltip.lastChild.textContent==='How to enter this value'
 &&helpTable._tooltip.matches(':popover-open')
 &&getComputedStyle(helpTable._tooltip).position==='fixed',
 'validation takes the primary tooltip position while retaining secondary help');
helpEditor.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));
assert(!helpTable._inEditMode&&!helpTable._tooltip.isConnected,
 'Escape closes both editor and cell help');
helpTable.selectCell(0,'helped');
helpTable._cellCursor.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,button:0}));
assert(helpTable._inEditMode&&helpTable._tooltip.isConnected,
 'pointer activation opens the same cell help');
helpTable._exitEditMode(false);
helpTable.selectCell(0,'helped');
helpTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
assert(helpTable._inEditMode&&helpTable._tooltip.isConnected
 &&helpTable._tooltip.classList.contains('cell-help'),
 'keyboard activation opens cell help without pointer interaction');
helpTable._exitEditMode(false);
helpTable.selectCell(0,'plain',{enterEditMode:true});
assert(!helpTable._tooltip.isConnected,'changing to a field without help leaves no tooltip');
helpTable._exitEditMode(false);
const mainHelp=new Tablance(host(),{main:{columns:[{dataKey:'helped',helpText:'Main cell help',input:{type:'text'}}]}},true,true,{searchbar:false});
mainHelp.setData([{helped:''}]);
mainHelp.selectCell(0,'helped',{enterEditMode:true});
assert(mainHelp._tooltip.isConnected&&mainHelp._tooltip.textContent.includes('Main cell help'),
 'main-table fields use the same edit help behavior');
mainHelp._exitEditMode(false);
let buttonActivations=0;
const buttonTable=new Tablance(host(),{details:{type:'grid',columns:2,entries:[
 {type:'field',nodeId:'primaryAction',input:{type:'button',text:'Primary',onClick:()=>buttonActivations++}},
 {type:'field',nodeId:'secondaryAction',input:{type:'button',text:'Secondary',onClick:()=>buttonActivations++}},
]}},true,true,{searchbar:false});
buttonTable.setData({});
const primaryButton=buttonTable.getDetailCell(0,'primaryAction').el;
const secondaryButton=buttonTable.getDetailCell(0,'secondaryAction').el;
primaryButton.style.cssText='background:#2563eb;color:white;border:1px solid #1d4ed8;padding:8px 12px';
secondaryButton.style.cssText='background:white;color:#1d4ed8;border:1px solid #1d4ed8;padding:8px 12px';
buttonTable.selectCell(0,'primaryAction');
const buttonCursorStyle=getComputedStyle(buttonTable._cellCursor);
const accentSample=document.body.appendChild(document.createElement('span'));
accentSample.style.color='var(--tablance-accent-color)';
buttonTable.rootEl.appendChild(accentSample);
assert(buttonCursorStyle.outlineOffset==='2px'
 &&buttonTable._cellCursor.classList.contains('button-action-cell')
 &&buttonCursorStyle.outlineColor===getComputedStyle(accentSample).color
 &&buttonCursorStyle.boxShadow.includes('2px'),
 'primary button cursor uses the shared blue ring outside a light separation');
accentSample.remove();
buttonTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
assert(buttonActivations===1,'Enter activates the selected primary button');
buttonTable.selectCell(0,'secondaryAction');
assert(getComputedStyle(buttonTable._cellCursor).outlineOffset==='2px'
 &&getComputedStyle(buttonTable._cellCursor).boxShadow.includes('2px'),
 'outline button receives the same external cursor ring');
const mainButtonTable=new Tablance(host(),{main:{columns:[
 {dataKey:'name',title:'Name'},
 {nodeId:'openAction',title:'Action',input:{type:'button',text:'Open',onClick:()=>{}}},
]}},true,true,{searchbar:false,ordering:false});
mainButtonTable.setData([{name:'Example'}]);
mainButtonTable.selectCell(0,'openAction');
assert(mainButtonTable._cellCursor.classList.contains('button-action-cell')
 &&!mainButtonTable._cellCursor.classList.contains('details')
 &&getComputedStyle(mainButtonTable._cellCursor).outlineStyle==='none'
 &&getComputedStyle(mainButtonTable._cellCursor).borderBottomWidth==='2px',
 'main-table action buttons retain the complete inset cursor around their whole cell');
const bottomEdgeTable=new Tablance(host(),{main:{columns:[
 {type:'expand',width:32},{dataKey:'name',title:'Name'},
 {nodeId:'openAction',title:'Action',input:{type:'button',text:'Open',onClick:()=>{}}},
]},details:{type:'list',entries:[{dataKey:'description',title:'Information'}]}},true,true,
 {searchbar:false,ordering:false,autoHeight:true});
bottomEdgeTable.setData([{name:'Last row',description:'Details'}]);
const bottomRow=bottomEdgeTable._mainTbody.querySelector('tr:not(.details)');
const paintedHeight=bottomEdgeTable._mainTable.offsetHeight;
bottomEdgeTable._tableSizer.style.height=`${paintedHeight-1}px`;
bottomEdgeTable._updateAutoHeight();
const cursorFitsViewport=()=>bottomEdgeTable._cellCursor.getBoundingClientRect().bottom
 <=bottomEdgeTable._scrollBody.getBoundingClientRect().top+bottomEdgeTable._scrollBody.clientHeight;
bottomEdgeTable._selectMainTableCell(bottomRow.cells[2]);
assert(bottomEdgeTable._scrollBody.clientHeight>=paintedHeight&&cursorFitsViewport(),
 'auto-height includes the final painted row even when the virtual sizer is one pixel short');
bottomEdgeTable._selectMainTableCell(bottomRow.cells[0]);
assert(cursorFitsViewport(),'the last-row expand cursor also fits above the viewport bottom');
bottomEdgeTable._scrollBody.style.height=`${paintedHeight-1}px`;
bottomEdgeTable._selectMainTableCell(bottomRow.cells[2]);
assert(cursorFitsViewport()&&bottomEdgeTable._cellCursor.getBoundingClientRect().height<bottomRow.cells[2].getBoundingClientRect().height,
 'a one-pixel scroll clip does not hide half of the main action cursor border');
bottomEdgeTable._selectMainTableCell(bottomRow.cells[0]);
assert(cursorFitsViewport(),'the expand cursor also keeps its full lower border at a clipped viewport edge');
buttonTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:' ',code:'Space',bubbles:true,cancelable:true}));
assert(buttonActivations===2,'Space activates the selected secondary button');
primaryButton.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
primaryButton.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail:1}));
assert(buttonTable._activeSchemaNode?.nodeId==='primaryAction'
 &&getComputedStyle(buttonTable._cellCursor).outlineOffset==='2px',
 'pointer selection also shows the external button cursor ring');
const explicitData={first:'A',second:'B',source:'hidden',detail:'D',postalCode:'12345'};
const explicit=new Tablance(host(),{details:{type:'grid',columns:['13ch','1fr','1fr'],rows:[
 {id:'names',label:'Names',cells:[
  {type:'field',nodeId:'first',dataKey:'first',input:{type:'text'}},
  {type:'field',nodeId:'second',dataKey:'second',dependsOn:['source'],
   visibleIf:({rowData})=>rowData.source!=='single',input:{type:'text'}}]},
 {rowBand:{id:'person',label:'Person',visibleIf:({rowData})=>rowData.source!=='gone',
  dependsOn:['source']},rows:[
  {cells:[{type:'field',nodeId:'source',dataKey:'source',columnSpan:2,input:{type:'text'}}]},
  {visibleIf:({rowData})=>rowData.source==='shown',dependsOn:['source'],cells:[
   {type:'field',nodeId:'detail',dataKey:'detail',columnSpan:2,input:{type:'text'}}]}]},
 {id:'postal',label:'Postnummer',cells:[
  {type:'field',nodeId:'postalCode',dataKey:'postalCode',columnSpan:2,input:{type:'text'}}]},
]}},true,true,{searchbar:false});
explicit.setData(explicitData);
const explicitGrid=explicit.getDetailCell(0,'first').parent;
const listLabelStyle=getComputedStyle(expanded.rootEl.querySelector('.details-list td.title'));
const gridLabelStyle=getComputedStyle(explicit.getGridLabel(0,'postal').querySelector(':scope > span.title'));
assert(['fontFamily','fontSize','fontWeight','color','lineHeight'].every(property=>
 listLabelStyle[property]===gridLabelStyle[property]),
 'ordinary list and labeled grid details share Tablance label typography');
assert(explicitGrid.gridRows.length===3&&explicitGrid.gridRows[0][0]===null
 &&explicitGrid.gridRows[0][1]===explicit.getDetailCell(0,'first')
 &&explicitGrid.gridRows[0][2]===explicit.getDetailCell(0,'second'),
 'explicit row labels are static and values share logical grid tracks');
assert(explicit.getGridLabel(0,'names')?.textContent==='Names'
 &&explicit.getGridLabel(0,'person')?.style.gridRow==='3 / 4'
 &&explicit.getDetailCell(0,'detail').hidden,
 'hidden band rows leave no track and the band label spans only shown rows');
assert(explicit.getDetailCell(0,'source').gridColumnSpan===2
 &&explicit.getDetailCell(0,'postalCode').gridColumnSpan===2,
 'columnSpan is relative to the two value columns');
explicit.selectCell(0,'first');
explicit.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(explicit._activeSchemaNode?.nodeId==='source',
 'down navigation stays in the same value column across labeled and band rows');
explicit.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Tab',code:'Tab',bubbles:true,cancelable:true}));
assert(explicit._activeSchemaNode?.nodeId==='postalCode',
 'Tab continues through band rows in schema order');
explicit.selectCell(0,'second');
explicit.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Home',code:'Home',bubbles:true,cancelable:true}));
assert(explicit._activeSchemaNode?.nodeId==='first',
 'Home skips the presentation-only label');
explicit.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'End',code:'End',bubbles:true,cancelable:true}));
assert(explicit._activeSchemaNode?.nodeId==='second',
 'End stays within value cells');
explicit.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',shiftKey:true,bubbles:true,cancelable:true}));
assert(explicit._cellRange?.surface===explicitGrid,
 'range selection uses the same grid across ordinary and band rows');
explicit.selectCell(0,'first');
explicit.updateData(explicitData,'source','shown');
assert(explicitGrid.gridRows.length===4
 &&explicit.getGridLabel(0,'person')?.style.gridRow==='3 / 6'
 &&explicit.getDetailCell(0,'detail').gridRow===2,
 'showing a band row extends its label and inserts one logical row');
explicit.updateData(explicitData,'source','hidden');
assert(explicitGrid.gridRows.length===3
 &&explicit.getGridLabel(0,'person')?.style.gridRow==='3 / 4',
 'hiding the band row removes its track and recomputes the span');
explicit.updateData(explicitData,'source','single');
assert(explicitGrid.gridRows.length===3
 &&explicit.getDetailCell(0,'second').hidden
 &&explicit.getDetailCell(0,'first').gridColumnSpan===2,
 'a hidden cell preserves its labeled row and extends the remaining value cell');
explicit.updateData(explicitData,'source','gone');
assert(explicitGrid.gridRows.length===2
 &&!explicit.getGridLabel(0,'person').isConnected,
 'a fully hidden band leaves neither a row nor a label');
const result=document.getElementById('test-results');result.textContent='standalone, expanded, bulkEdit, and linked table checks passed';result.dataset.status='passed';
