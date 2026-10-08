const Tablance=window.Tablance;
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const host=()=>document.body.appendChild(document.createElement('div'));
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
const muted=standalone.rootEl.appendChild(document.createElement('span'));muted.style.color='var(--tablance-muted-color)';
assert(getComputedStyle(cell('both').el).color===getComputedStyle(muted).color&&getComputedStyle(cell('both').el).fontStyle==='italic'&&getComputedStyle(cell('both').el).cursor==='cell','display placeholder is secondary text with a cell cursor');muted.remove();
assert(cell('none').outerContainerEl.getBoundingClientRect().height<55&&getComputedStyle(cell('editOnly').outerContainerEl).borderInlineStartWidth==='1px'&&panel.querySelector('.grid-row-separator'),'standalone grid is compact with subtle separators');
for(const [key,expected] of [['none',''],['editOnly','Editor hint'],['displayOnly',''],['both','Long hint']]){
 standalone.selectCell(0,key,{enterEditMode:true});const input=standalone._cellCursor.querySelector('input.text-editor');
 assert(input?.placeholder===expected&&getComputedStyle(input).cursor==='text',`${key} has its own edit placeholder`);
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
const expanded=new Tablance(host(),{main:{columns:[{type:'expand'},{dataKey:'name'}]},details:{type:'list',title:'Expanded title',entries:fields()}},true,true,{searchbar:false,ordering:false});
const expandedRow={name:'Row',...row,displayOnly:'',both:'',boolean:null,selectEmpty:''};expanded.setData([expandedRow]);expanded.expandRow(0);
assert(expanded.getDetailCell(0,'editOnly').el.textContent===''&&expanded.getDetailCell(0,'both').el.textContent==='Short hint','expanded details use independent placeholders');
assert(!expanded.rootEl.classList.contains('only-details')&&!expanded.rootEl.querySelector('.only-details-header'),'expanded details do not gain a standalone panel/header');
expanded.selectCell(0,'both',{enterEditMode:true});assert(expanded._cellCursor.querySelector('input.text-editor')?.placeholder==='Long hint','expanded editor uses its own placeholder');expanded._exitEditMode(false);
expanded.updateData(expandedRow,'both','Filled');assert(expanded.getDetailCell(0,'both').el.textContent==='Filled','expanded real value replaces placeholder');
const bulk=new Tablance(host(),{main:{columns:[{type:'select'},{dataKey:'name',input:{type:'text',bulkEdit:true}}]}},true,true,{searchbar:false,ordering:false});
bulk.setData([{name:'First'},{name:'Second'}]);
const bulkRoot=bulk._bulkEditTable.rootEl,bulkPanel=bulkRoot.querySelector(':scope>.only-details-content');
assert(bulkRoot.classList.contains('tablance-bulk-edit-details')&&bulkPanel&&!bulkPanel.querySelector('.only-details-header')&&getComputedStyle(bulkPanel).borderTopWidth==='0px','bulkEdit is an explicit internal variant without a standalone frame');
const result=document.getElementById('test-results');result.textContent='standalone, expanded, and bulkEdit presentation checks passed';result.dataset.status='passed';
