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
const sourceIndicator=standalone.createCellTypeIcon('source','Kan hämta värden från en vald källa eller fyllas manuellt.');
cell('both').outerContainerEl.querySelector(':scope>span.title').appendChild(sourceIndicator);
let sourceIconClickBubbled=false;
cell('both').outerContainerEl.addEventListener('click',()=>sourceIconClickBubbled=true,{once:true});
sourceIndicator.dispatchEvent(new MouseEvent('click',{bubbles:true}));
assert(sourceIconClickBubbled&&sourceIndicator.dataset.tablanceCellTypeTooltip.startsWith('Källkopplad cell')
 &&getComputedStyle(sourceIndicator).cursor==='help',
 'the source type icon explains its cell type and clicks bubble normally without becoming an action');
sourceIndicator.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:0,clientY:0}));
await new Promise(resolve=>setTimeout(resolve,0));
assert(standalone._tooltip.isConnected&&standalone._tooltip.firstChild.textContent.startsWith('Källkopplad cell'),
 'source type icons use the shared Tablance tooltip');
standalone._clearCellTypeTooltip();
const sourceRelationTable=new Tablance(host(),{details:{type:'grid',columns:3,rows:[
 {cells:[{type:'field',nodeId:'priorValue',dataKey:'priorValue',title:'Prior value',input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'recordSource',dataKey:'recordSource',title:'Record source',sourceLinked:true,
  sourceSelector:{manualValue:'manual'},displayPlaceholder:'Choose record',input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'recordNumber',dataKey:'recordNumber',title:'Record number',dependsOn:'recordSource',input:{type:'text'}},
  {type:'field',nodeId:'recordName',dataKey:'recordName',title:'Record name',dependsOn:'recordSource',input:{type:'text'}},
  {type:'field',nodeId:'hiddenValue',dataKey:'hiddenValue',title:'Hidden value',dependsOn:'recordSource',
   visibleIf:()=>false,input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'unrelatedValue',dataKey:'unrelatedValue',title:'Unrelated source',sourceLinked:true,input:{type:'text'}}]},
]}},true,true,{searchbar:false});
sourceRelationTable.setData({priorValue:'Prior',recordSource:'',recordNumber:'123',recordName:'Example',hiddenValue:'Hidden',unrelatedValue:'Other'});
const relationCell=id=>sourceRelationTable.getDetailCell(0,id);
const relationSource=relationCell('recordSource');
const relationNumber=relationCell('recordNumber');
const relationName=relationCell('recordName');
const relationHidden=relationCell('hiddenValue');
const ordinaryRelationShadow=getComputedStyle(relationNumber.selEl).boxShadow;
const ordinaryRelationBackground=getComputedStyle(relationNumber.selEl).backgroundImage;
const relationGrid=relationNumber.selEl.closest('.details-grid');
const relationRowSeparator=relationGrid.querySelector(':scope>.grid-row-separator');
const ordinarySeparatorColor=getComputedStyle(relationRowSeparator).borderTopColor;
const ordinaryColumnDividerColor=getComputedStyle(relationName.selEl).borderInlineStartColor;
assert(relationSource.selEl.classList.contains('tablance-source-linked-cell'),
 'source-linked cells have a persistent semantic styling hook');
assert(getComputedStyle(relationSource.selEl).backgroundColor
 ===getComputedStyle(relationCell('unrelatedValue').selEl).backgroundColor,
 'source-linked cells have no permanent background fill');
assert(getComputedStyle(relationSource.selEl).boxShadow===ordinaryRelationShadow,
 'source-linked cells keep the same resting edge as ordinary cells');
const targetIcon=relationNumber.outerContainerEl.querySelector('.tablance-cell-state-icon-source-target');
const targetEditIcon=relationNumber.outerContainerEl.querySelector('.tablance-cell-state-icon-editable');
assert(targetEditIcon&&targetIcon
 &&targetEditIcon.dataset.tablanceCellTypeTooltip.startsWith('Redigeringscell')
 &&targetEditIcon.getBoundingClientRect().right<=targetIcon.getBoundingClientRect().left,
 'an editable source target keeps both independent, nonoverlapping state icons');
assert(targetIcon?.dataset.tablanceCellTypeTooltip
 ==='Källkopplat fält – fylls från Record source.'
 &&getComputedStyle(targetIcon).cursor==='help',
 'source targets use the ordinary cell-state icon and describe their source');
let targetIconClickBubbled=false;
relationNumber.selEl.addEventListener('click',()=>targetIconClickBubbled=true,{once:true});
targetIcon.dispatchEvent(new MouseEvent('click',{bubbles:true}));
assert(targetIconClickBubbled,'source target icon clicks bubble to the cell');
assert(relationSource.schemaNode.dependencyPaths?.length===3,
 'source relations reuse the existing dependency graph');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationSource.selEl});
const relationClock=relationSource.selEl.closest('.tablance');
const relationPill=relationSource.el.querySelector('.tablance-source-pill');
const numberChain=relationNumber.selEl.querySelector('.tablance-cell-state-icon-source-target');
const nameChain=relationName.selEl.querySelector('.tablance-cell-state-icon-source-target');
assert(relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&getComputedStyle(relationSource.selEl).boxShadow===ordinaryRelationShadow
 &&getComputedStyle(relationNumber.selEl).backgroundImage===ordinaryRelationBackground
 &&getComputedStyle(relationClock).animationName==='none'
 &&getComputedStyle(numberChain).visibility==='visible'
 &&getComputedStyle(nameChain).visibility==='visible'
 &&getComputedStyle(relationPill).boxShadow==='none'
 &&getComputedStyle(numberChain).animationName==='none',
 'hovering a source reveals both target chains without pill glow, fill, or animation');
assert(getComputedStyle(relationRowSeparator).borderTopColor===ordinarySeparatorColor
 &&getComputedStyle(relationName.selEl).borderInlineStartColor===ordinaryColumnDividerColor,
 'relation styling retains grid dividers');
assert(relationNumber.selEl.classList.contains('tablance-source-related-highlight')
 &&relationName.selEl.classList.contains('tablance-source-related-highlight')
 &&!relationHidden.selEl.classList.contains('tablance-source-related-highlight'),
 'hovering a source highlights only visible, already rendered dependents');
sourceRelationTable.rootEl.dispatchEvent(new PointerEvent('pointerleave'));
assert(sourceRelationClassesCleared()
 &&!relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&getComputedStyle(numberChain).visibility==='hidden'
 &&getComputedStyle(relationPill).boxShadow==='none',
 'leaving the table restores the resting icon and pill styling');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationSource.selEl});
assert(getComputedStyle(relationNumber.selEl).backgroundColor
 ===getComputedStyle(relationCell('unrelatedValue').selEl).backgroundColor,
 'related cells leave their underlying background color intact');
assert(getComputedStyle(relationNumber.selEl).backgroundImage===ordinaryRelationBackground,
 'related cells have no relation background');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationNumber.selEl});
assert(relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&relationNumber.selEl.classList.contains('tablance-source-related-highlight')
 &&relationName.selEl.classList.contains('tablance-source-related-highlight'),
 'hovering a target reverses the relation to its source and sibling target');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationName.selEl});
sourceRelationTable.selectCell(0,'recordSource');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationName.selEl});
assert(relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&relationNumber.selEl.classList.contains('tablance-source-related-highlight'),
 'hovered target and active source retain their shared relation');
sourceRelationTable.rootEl.dispatchEvent(new PointerEvent('pointerleave'));
assert(relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&relationNumber.selEl.classList.contains('tablance-source-related-highlight'),
 'active source relation remains highlighted after pointer leaves');
sourceRelationTable.selectCell(0,'unrelatedValue');
assert(!relationSource.selEl.classList.contains('tablance-source-related-highlight')
 &&!relationSource.selEl.classList.contains('tablance-source-relation-active')
 &&!relationNumber.selEl.classList.contains('tablance-source-related-highlight'),
 'source relation highlight clears after selection moves away');
assert(!relationCell('unrelatedValue').selEl.classList.contains('tablance-source-related-highlight'),
 'another source cell stays outside the active relation');

// Pointer selection and the public API must use the same active-cell relation transition as keyboard navigation.
sourceRelationTable.selectCell(0,'recordSource');
sourceRelationTable._handleCellTypeTooltipPointer({target:relationSource.selEl});
assert(sourceRelationClassesCleared()===false,'source is related before pointer navigation');
relationName.selEl.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
assert(sourceRelationTable._activeDetailsCell?.schemaNode?.nodeId==='recordName'
 &&!sourceRelationClassesCleared()
 &&relationSource.selEl.classList.contains('tablance-source-relation-active'),
 'clicking a target keeps the relation to its source');
sourceRelationTable.selectCell(0,'recordSource');
sourceRelationTable.selectCell(0,'recordNumber');
assert(!sourceRelationClassesCleared(),'programmatic target selection keeps the relation');
sourceRelationTable.refreshSubtree(relationCell('recordNumber'));
assert(!sourceRelationClassesCleared(),'passive repaint preserves the active target relation');

// Leaving the active source in either keyboard direction clears the relation immediately.
sourceRelationTable.selectCell(0,'recordSource');
sourceRelationTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowDown',code:'ArrowDown',bubbles:true,cancelable:true}));
assert(sourceRelationTable._activeDetailsCell?.schemaNode?.nodeId==='recordNumber',
 'ArrowDown moves from the active source to its next cell');
assert(!sourceRelationClassesCleared());
sourceRelationTable.selectCell(0,'recordSource');
sourceRelationTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'ArrowUp',code:'ArrowUp',bubbles:true,cancelable:true}));
assert(sourceRelationTable._activeDetailsCell?.schemaNode?.nodeId==='priorValue',
 'ArrowUp moves from the active source to its previous cell');
assert(sourceRelationClassesCleared());

const formRelationsData={principal:'andreas',personalNumber:'19800101-1234',name:'Andreas',
 address:'norrings',street:'Norrings väg 3',apartment:'1201',postalCode:'654 32',city:'Karlstad',
 showApartment:true};
const formRelations=new Tablance(host(),{details:{type:'grid',columns:4,rows:[
 {cells:[{type:'field',nodeId:'principal',dataKey:'principal',title:'Huvudman',sourceLinked:true,
  sourceLinkedTargets:['personalNumber','name'],sourceSelector:{manualValue:'manual'},
  input:{type:'text'},render:({rowData})=>rowData.principal==='andreas'?'Andreas':'Annan huvudman'}]},
 {cells:[{type:'field',nodeId:'personalNumber',dataKey:'personalNumber',title:'Personnummer',
  dependsOn:'principal',input:{type:'text'}},
  {type:'field',nodeId:'name',dataKey:'name',title:'Namn',dependsOn:'principal',input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'address',dataKey:'address',title:'Adress',sourceLinked:true,
  sourceLinkedTargets:['street','apartment','postalCode','city'],sourceSelector:{manualValue:'manual'},
  input:{type:'text'},render:({rowData})=>rowData.address==='norrings'?'Norrings väg 3 · Andreas':'Annan adress'}]},
 {cells:[{type:'field',nodeId:'street',dataKey:'street',title:'Gatuadress',dependsOn:'address',input:{type:'text'}},
  {type:'field',nodeId:'apartment',dataKey:'apartment',title:'Lägenhetsnummer',dependsOn:'address',
   visibleIf:({rowData})=>rowData.showApartment,input:{type:'text'}},
  {type:'field',nodeId:'postalCode',dataKey:'postalCode',title:'Postnummer',dependsOn:'address',input:{type:'text'}},
  {type:'field',nodeId:'city',dataKey:'city',title:'Postort',dependsOn:'address',input:{type:'text'}}]},
]}},true,true,{searchbar:false});
formRelations.setData(formRelationsData);
const formNode=id=>formRelations.getDetailCell(0,id);
const formCell=id=>formNode(id).selEl;
const formChain=id=>formCell(id).querySelector('.tablance-cell-state-icon-source-target');
const formSourceIcon=id=>formNode(id).el.querySelector('.tablance-source-pill');
const formSourceGlyph=id=>formSourceIcon(id).querySelector('.tablance-source-pill-icon');
const animations=(element,name)=>element.getAnimations({subtree:true}).filter(animation=>animation.animationName===name);
const iconPosition=element=>{const rect=element.getBoundingClientRect();return [rect.x,rect.y,rect.width,rect.height]};
const positionUnchanged=(element,before)=>iconPosition(element).every((value,index)=>Math.abs(value-before[index])<.05);
const principalTargets=['personalNumber','name'];
const addressTargets=['street','apartment','postalCode','city'];
const marked=id=>formCell(id).classList.contains('tablance-source-related-highlight');
const sourceMarked=id=>formCell(id).classList.contains('tablance-source-relation-active');
const allChainsHidden=ids=>ids.every(id=>getComputedStyle(formChain(id)).visibility==='hidden');
const restingTargetBackground=getComputedStyle(formCell('street')).backgroundImage;
assert(allChainsHidden([...principalTargets,...addressTargets])
 &&!sourceMarked('principal')&&!sourceMarked('address')
 &&getComputedStyle(formRelations.rootEl).animationName==='none',
 'resting Huvudman and Adress relations show no target chains or breath');
formRelations._handleCellTypeTooltipPointer({target:formCell('principal')});
assert(sourceMarked('principal')&&principalTargets.every(marked)
 &&principalTargets.every(id=>getComputedStyle(formChain(id)).visibility==='visible')
 &&principalTargets.every(id=>!formCell(id).classList.contains('tablance-source-related-active-source'))
 &&getComputedStyle(formCell('personalNumber')).backgroundImage===restingTargetBackground
 &&!animations(formSourceIcon('principal'),'tablance-relation-chain-ping').length
 &&principalTargets.every(id=>!animations(formChain(id),'tablance-relation-chain-ping').length)
 &&addressTargets.every(id=>!marked(id))&&!sourceMarked('address'),
 'hovering Huvudman reveals only its chains without an active tint');
formRelations._handleCellTypeTooltipPointer({target:formCell('street')});
assert(sourceMarked('address')&&addressTargets.every(marked)
 &&addressTargets.every(id=>getComputedStyle(formChain(id)).visibility==='visible')
 &&getComputedStyle(formCell('street')).backgroundImage===restingTargetBackground
 &&!animations(formSourceIcon('address'),'tablance-relation-chain-ping').length
 &&principalTargets.every(id=>!marked(id))&&!sourceMarked('principal'),
 'hovering Gatuadress resolves back to Adress without an active tint');
formRelations.rootEl.dispatchEvent(new PointerEvent('pointerleave'));
const addressIconPositions=new Map([['source',formSourceGlyph('address')],
 ...addressTargets.map(id=>[id,formChain(id)])].map(([id,element])=>[id,iconPosition(element)]));
formRelations.selectCell(0,'address');
assert(formCell('street').classList.contains('tablance-source-related-active-source')
 &&addressTargets.every(id=>getComputedStyle(formChain(id)).visibility==='visible')
 &&getComputedStyle(formCell('street')).backgroundImage===restingTargetBackground
 &&formCell('principal').classList.contains('tablance-source-relation-selected-source')===false,
 'active Adress strengthens only its target chains without changing target backgrounds');
if (matchMedia('(prefers-reduced-motion: reduce)').matches)
 assert(getComputedStyle(formChain('street')).animationName==='none'
  &&getComputedStyle(formSourceGlyph('address')).animationName==='none'
  &&getComputedStyle(formChain('street')).visibility==='visible',
  'reduced motion keeps chains visible and static');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
 assert(animations(formSourceIcon('address'),'tablance-relation-chain-ping').length
  &&addressTargets.every(id=>animations(formChain(id),'tablance-relation-chain-ping').length)
  &&!formCell('street').getAnimations().length,
  'activating a source gives its source and target chains one shared 580 ms ping');
 for(const [id,element] of [['source',formSourceGlyph('address')],
  ...addressTargets.map(target=>[target,formChain(target)])]) {
  const ping=animations(element,'tablance-relation-chain-ping')[0];
  assert(ping?.effect?.getKeyframes().length
   &&getComputedStyle(element).animationName==='none'
   &&positionUnchanged(element,addressIconPositions.get(id)),
   `${id} keeps its anchor while its glyph begins pulsing`);
  ping.currentTime=ping.effect.getTiming().duration*.45;
  assert(positionUnchanged(element,addressIconPositions.get(id)),
   `${id} keeps its anchor at the largest pulse frame`);
 }
 await new Promise(resolve=>setTimeout(resolve,650));
 assert(!animations(formChain('street'),'tablance-relation-chain-ping').length
  &&!formChain('street').getAnimations().length
  &&!formSourceIcon('address').getAnimations({subtree:true}).length
  &&formCell('street').classList.contains('tablance-source-related-active-chain')
  &&formCell('address').classList.contains('tablance-source-relation-active-chain')
  &&getComputedStyle(formCell('street')).backgroundImage===restingTargetBackground,
  'the one-shot ping ends in a static high-contrast chain state without a target background');
 const streetBeforeRepaint=iconPosition(formChain('street'));
 formRelations.refreshSubtree(formNode('street'));
 assert(!animations(formChain('street'),'tablance-relation-chain-ping').length
  &&positionUnchanged(formChain('street'),streetBeforeRepaint),
  'passive target repaint preserves the chain anchor without restarting its ping');
}
const nameChainPosition=iconPosition(formChain('name'));
formRelations.selectCell(0,'name');
assert(positionUnchanged(formChain('name'),nameChainPosition),
 'switching to another source relation does not move the new target chain');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
 const chain=formChain('name'),before=iconPosition(chain);
 const ping=animations(chain,'tablance-relation-chain-ping')[0];
 assert(ping,'switching relation starts a new target-chain pulse');
 ping.currentTime=ping.effect.getTiming().duration*.45;
 assert(positionUnchanged(chain,before),
  'the new target chain keeps its position through the repeated pulse');
}
assert(sourceMarked('principal')&&principalTargets.every(marked)
 &&formCell('principal').classList.contains('tablance-source-relation-selected-target')
 &&formCell('name').classList.contains('tablance-source-related-active-target')
 &&formCell('name').classList.contains('tablance-source-related-active-chain')
 &&formCell('personalNumber').classList.contains('tablance-source-related-active-chain')
 &&addressTargets.every(id=>!marked(id))&&!sourceMarked('address'),
 'an active Namn target keeps every chain in its Huvudman group animated');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
 assert(animations(formSourceIcon('principal'),'tablance-relation-chain-ping').length
  &&animations(formChain('personalNumber'),'tablance-relation-chain-ping').length
  &&animations(formChain('name'),'tablance-relation-chain-ping').length,
  'active target pings its source, its own chain, and sibling chains together');
await new Promise(resolve=>setTimeout(resolve,650));
const activeParentIcon=getComputedStyle(formSourceGlyph('principal'),'::before');
const neutralParentIcon=getComputedStyle(formSourceGlyph('address'),'::before');
assert(activeParentIcon.backgroundColor==='rgb(0, 108, 224)'
 &&new DOMMatrix(activeParentIcon.transform).a>1.16
 &&getComputedStyle(formSourceGlyph('principal')).boxShadow==='none'
 &&neutralParentIcon.backgroundColor!==activeParentIcon.backgroundColor
 &&neutralParentIcon.transform==='none'
 &&getComputedStyle(formSourceGlyph('address')).boxShadow==='none'
 &&getComputedStyle(formChain('name'),'::before').backgroundColor===activeParentIcon.backgroundColor
 &&new DOMMatrix(getComputedStyle(formChain('name'),'::before').transform).a>1.16
 &&getComputedStyle(formChain('personalNumber'),'::before').backgroundColor===activeParentIcon.backgroundColor
 &&formChain('name').getBoundingClientRect().width===formChain('city').getBoundingClientRect().width
 &&formSourceGlyph('principal').getBoundingClientRect().width===formSourceGlyph('address').getBoundingClientRect().width
 &&getComputedStyle(formChain('name')).filter==='none'
 &&getComputedStyle(formSourceIcon('principal')).boxShadow==='none',
 'the active target enlarges only the blue chain shapes without changing icon layout or adding a halo');
formRelations.updateData(formRelationsData,'principal','other');
const repaintedPill=formNode('principal').el.querySelector('.tablance-source-pill');
assert(!animations(repaintedPill,'tablance-relation-chain-ping').length
 &&sourceMarked('principal')&&principalTargets.every(marked),
 'repainting the source pill after the ping does not restart the one-shot animation');
formRelations._handleCellTypeTooltipPointer({target:formCell('street')});
assert(sourceMarked('address')&&addressTargets.every(marked)
 &&principalTargets.every(id=>!marked(id))&&!sourceMarked('principal'),
 'hovering Adress while Huvudman is active shows only the hovered relation');
formRelations.rootEl.dispatchEvent(new PointerEvent('pointerleave'));
assert(sourceMarked('principal')&&principalTargets.every(marked)
 &&addressTargets.every(id=>!marked(id)),
 'pointer leave restores the active Huvudman relation');
formRelations.selectCell(0,'postalCode');
assert(sourceMarked('address')&&addressTargets.every(marked)
 &&principalTargets.every(id=>!marked(id))&&!sourceMarked('principal'),
 'programmatic movement to Postnummer replaces the entire relation group');
formRelations.updateData(formRelationsData,'address','other');
assert(sourceMarked('address')&&formNode('address').el.textContent.includes('Annan adress')
 &&addressTargets.every(marked),
 'repainting a selected source value preserves the current relation without stale source identity');
formRelationsData.showApartment=false;
formRelations.refreshSubtree(formNode('apartment'));
assert(!marked('apartment')&&['street','postalCode','city'].every(marked),
 'disclosing a target removes only the hidden target from an active relation');
formRelations.selectCell(0,'principal');
assert(sourceMarked('principal')&&principalTargets.every(marked)
 &&addressTargets.every(id=>!marked(id))&&!sourceMarked('address'),
 'moving back to Huvudman clears the previous Adress group');
formRelations.selectCell(0,'street');
assert(sourceMarked('address')&&!sourceMarked('principal'),
 'active source-target relation resolves in the reverse direction after a source switch');
formRelations.selectCell(0,'principal');
formRelations.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
assert(formRelations._inEditMode&&sourceMarked('principal')&&principalTargets.every(marked),
 'Enter editor activation retains the source relation state');
formRelations._exitEditMode(false);
formRelations.selectCell(0,'name');
formRelations.rootEl.dispatchEvent(new KeyboardEvent('keydown',
 {key:'Tab',code:'Tab',bubbles:true,cancelable:true}));
assert(formRelations._activeDetailsCell?.schemaNode?.nodeId!=='name'
 &&!sourceMarked('principal')
 &&(formRelations._activeDetailsCell?.schemaNode?.nodeId!=='address'||sourceMarked('address')),
 'Tab updates the relation to the new active cell without retaining Huvudman');
const groupLifecycle=new Tablance(host(),{details:{type:'grid',columns:2,rows:[
 {cells:[{type:'field',nodeId:'sourceA',dataKey:'sourceA',sourceLinked:true,
  sourceLinkedTargets:['targetA1','targetA2'],sourceSelector:{manualValue:'manual'},input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'targetA1',dataKey:'targetA1',dependsOn:'sourceA',input:{type:'text'}},
  {type:'field',nodeId:'targetA2',dataKey:'targetA2',dependsOn:'sourceA',input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'sourceB',dataKey:'sourceB',sourceLinked:true,
  sourceLinkedTargets:['targetB'],sourceSelector:{manualValue:'manual'},input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'targetB',dataKey:'targetB',dependsOn:'sourceB',input:{type:'text'}},
  {type:'field',nodeId:'outside',dataKey:'outside',input:{type:'text'}}]},
]}},true,true,{searchbar:false});
groupLifecycle.setData({sourceA:'A',targetA1:'A one',targetA2:'A two',
 sourceB:'B',targetB:'B one',outside:'Outside'});
const groupCell=id=>groupLifecycle.getDetailCell(0,id).selEl;
const groupChain=id=>groupCell(id).querySelector('.tablance-cell-state-icon-source-target');
const groupSource=id=>groupLifecycle.getDetailCell(0,id).el.querySelector('.tablance-source-pill');
const oneShot='tablance-relation-chain-ping';
groupLifecycle.selectCell(0,'sourceA');
const firstAPing=animations(groupChain('targetA1'),oneShot)[0];
const secondAPing=animations(groupChain('targetA2'),oneShot)[0];
const sourceAPing=animations(groupSource('sourceA'),oneShot)[0];
assert(firstAPing&&secondAPing&&sourceAPing,
 'entering relation group A starts one synchronized ping on all its chains');
for (const id of ['targetA1','targetA2','sourceA']) {
 groupLifecycle.selectCell(0,id);
 assert(animations(groupChain('targetA1'),oneShot)[0]===firstAPing
  &&animations(groupChain('targetA2'),oneShot)[0]===secondAPing
  &&animations(groupSource('sourceA'),oneShot)[0]===sourceAPing,
  'moving within one relation group preserves the original one-shot animations');
}
await new Promise(resolve=>setTimeout(resolve,650));
assert(!groupChain('targetA1').getAnimations().length
 &&!groupChain('targetA2').getAnimations().length
 &&!groupSource('sourceA').getAnimations({subtree:true}).length
 &&groupCell('targetA1').classList.contains('tablance-source-related-active-chain')
 &&groupCell('targetA2').classList.contains('tablance-source-related-active-chain')
 &&groupCell('sourceA').classList.contains('tablance-source-relation-active-chain')
 &&getComputedStyle(groupChain('targetA1')).filter==='none',
 'after the one-shot all related chains have a static blue state and no looping animation');
for (const id of ['targetA1','targetA2','sourceA']) {
 groupLifecycle.selectCell(0,id);
 assert(!groupChain('targetA1').getAnimations().length
  &&!groupChain('targetA2').getAnimations().length
  &&!groupSource('sourceA').getAnimations({subtree:true}).length
  &&groupCell('targetA1').classList.contains('tablance-source-related-active-chain'),
  'moving within group A preserves its static state without another one-shot');
}
groupLifecycle.selectCell(0,'outside');
assert(!groupCell('targetA1').classList.contains('tablance-source-related-active-chain')
 &&getComputedStyle(groupChain('targetA1')).filter==='none'
 &&!groupCell('targetA1').classList.contains('tablance-source-related-highlight'),
 'leaving the relation restores the target chain to its normal state');
groupLifecycle.selectCell(0,'sourceA');
assert(animations(groupChain('targetA1'),oneShot).length,
 'reentering group A after leaving starts a new one-shot');
groupLifecycle.selectCell(0,'sourceB');
assert(animations(groupChain('targetB'),oneShot).length
 &&!animations(groupChain('targetA1'),oneShot).length
 &&!groupCell('targetA1').classList.contains('tablance-source-related-highlight'),
 'moving directly from group A to group B pings only B and clears A');
const emergingData={source:'',target:'',showTarget:false};
const emergingRelation=new Tablance(host(),{details:{type:'grid',columns:1,rows:[
 {cells:[{type:'field',nodeId:'source',dataKey:'source',sourceLinked:true,
  sourceLinkedTargets:['target'],sourceSelector:{manualValue:'manual'},
  displayPlaceholder:'Välj source',input:{type:'text'}}]},
 {cells:[{type:'field',nodeId:'target',dataKey:'target',dependsOn:'source',
  visibleIf:({rowData})=>rowData.showTarget,input:{type:'text'}}]},
]}},true,true,{searchbar:false});
emergingRelation.setData(emergingData);
const emergingSource=emergingRelation.getDetailCell(0,'source');
const emergingTarget=emergingRelation.getDetailCell(0,'target');
emergingRelation.selectCell(0,'source');
assert(emergingSource.el.querySelector('.tablance-source-pill-empty')
 &&!emergingSource.selEl.classList.contains('tablance-source-relation-active-chain')
 &&!emergingSource.selEl.classList.contains('tablance-source-relation-ping')
 &&!emergingSource.el.querySelector('.tablance-source-pill').getAnimations({subtree:true}).length,
 'an empty active source selector with no visible targets keeps its ordinary pill and never pings alone');
emergingData.showTarget=true;
emergingRelation.refreshSubtree(emergingTarget);
const emergedChain=emergingTarget.selEl.querySelector('.tablance-cell-state-icon-source-target');
assert(emergingSource.selEl.classList.contains('tablance-source-relation-active-chain')
 &&emergingTarget.selEl.classList.contains('tablance-source-related-active-chain')
 &&animations(emergingSource.el.querySelector('.tablance-source-pill'),oneShot).length
 &&animations(emergedChain,oneShot).length,
 'making the first target visible while its source is active starts one group-wide ping');
emergingRelation.refreshSubtree(emergingTarget);
const repaintedChain=emergingTarget.selEl.querySelector('.tablance-cell-state-icon-source-target');
assert(!animations(repaintedChain,oneShot).length
 &&emergingTarget.selEl.classList.contains('tablance-source-related-active-chain'),
 'ordinary repaint of the established relation does not restart its one-shot ping');
await new Promise(resolve=>setTimeout(resolve,650));
assert(!animations(repaintedChain,oneShot).length
 &&!emergingSource.el.querySelector('.tablance-source-pill').getAnimations({subtree:true}).length,
 'the newly formed relation also settles into a static state without a loop');
const dataKeyRelation=new Tablance(host(),{details:{type:'list',entries:[
 {nodeId:'source',dataKey:'source',sourceLinked:true,sourceLinkedTargets:['child'],input:{type:'text'}},
 {type:'field',dataKey:'child',dependsOn:'source',input:{type:'text'}},
]}},true,true,{searchbar:false});
dataKeyRelation.setData({source:'Source',child:'Child'});
const findDataKey=(node,key)=>node?.schemaNode?.dataKey===key?node
 :node?.children?.map(child=>findDataKey(child,key)).find(Boolean);
const dataKeyTarget=findDataKey(dataKeyRelation._openDetailsPanes[0],'child');
dataKeyRelation.selectCell(0,'source');
assert((dataKeyTarget.selEl??dataKeyTarget.el).classList.contains('tablance-source-related-highlight'),
 'sourceLinkedTargets can identify a target by dataKey when nodeId is absent');
dataKeyTarget.select();
assert((dataKeyRelation.getDetailCell(0,'source').selEl
 ??dataKeyRelation.getDetailCell(0,'source').el).classList.contains('tablance-source-relation-active'),
 'a dataKey-only target also resolves the relation back to its source');
const singleTargetCell=dataKeyTarget.selEl??dataKeyTarget.el;
assert(singleTargetCell.classList.contains('tablance-source-related-active-chain')
 &&singleTargetCell.classList.contains('tablance-source-related-ping')
 &&(dataKeyRelation.getDetailCell(0,'source').selEl
  ??dataKeyRelation.getDetailCell(0,'source').el).classList.contains('tablance-source-relation-active-chain'),
 'a relation with only one target animates both its source and target chains');

const horizontalRelations=new Tablance(host(),{details:{type:'grid',columns:3,rows:[
 {cells:[
  {type:'field',nodeId:'leftCell',dataKey:'left',input:{type:'text'}},
  {type:'field',nodeId:'horizontalSource',dataKey:'source',sourceLinked:true,input:{type:'text'}},
  {type:'field',nodeId:'rightCell',dataKey:'right',input:{type:'text'}},
 ]},
 {cells:[{type:'field',nodeId:'horizontalDependent',dataKey:'dependent',dependsOn:'horizontalSource',input:{type:'text'}}]},
]}},true,true,{searchbar:false});
horizontalRelations.setData({left:'Left',source:'Source',right:'Right',dependent:'Dependent'});
const horizontalDependent=horizontalRelations.getDetailCell(0,'horizontalDependent').selEl;
for (const [key,destination] of [['ArrowLeft','leftCell'],['ArrowRight','rightCell']]) {
 horizontalRelations.selectCell(0,'horizontalSource');
 assert(horizontalDependent.classList.contains('tablance-source-related-highlight'),
  'active source highlights its dependent before horizontal navigation');
 horizontalRelations.rootEl.dispatchEvent(new KeyboardEvent('keydown',
  {key,code:key,bubbles:true,cancelable:true}));
 assert(horizontalRelations._activeDetailsCell?.schemaNode?.nodeId===destination
  &&!horizontalDependent.classList.contains('tablance-source-related-highlight'),
  `${key} leaves the source without a stale relation`);
}
for (const direction of ['ArrowUp','ArrowDown']) {
 const sourceEntry={type:'field',nodeId:'boundarySource',dataKey:'source',sourceLinked:true,input:{type:'text'}};
 const dependentEntry={type:'field',nodeId:'boundaryDependent',dataKey:'dependent',
  dependsOn:'boundarySource',input:{type:'text'}};
 const entries=direction==='ArrowUp'?[sourceEntry,dependentEntry]:[dependentEntry,sourceEntry];
 const boundaryTable=new Tablance(host(),{details:{type:'list',entries}},true,true,{searchbar:false});
 boundaryTable.setData({source:'Source',dependent:'Dependent'});
 const neighbour=new Tablance(host(),{details:{type:'list',entries:[
  {type:'field',nodeId:'neighbourCell',dataKey:'value',input:{type:'text'}},
 ]}},true,true,{searchbar:false});
 neighbour.setData({value:'Neighbour'});
 boundaryTable.neighbourTables=direction==='ArrowUp'?{up:neighbour}:{down:neighbour};
 boundaryTable.selectCell(0,'boundarySource');
 const dependent=boundaryTable.getDetailCell(0,'boundaryDependent');
 const boundaryDependent=dependent.selEl??dependent.el;
 assert(boundaryDependent.classList.contains('tablance-source-related-highlight'),
  'active source highlights its dependent before leaving its table');
 boundaryTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',
  {key:direction,code:direction,bubbles:true,cancelable:true}));
 assert(neighbour._activeDetailsCell?.schemaNode?.nodeId==='neighbourCell'
  &&!boundaryDependent.classList.contains('tablance-source-related-highlight'),
  `${direction} into a neighbouring table clears the old table's active relation`);
}

function sourceRelationClassesCleared() {
 return !relationNumber.selEl.classList.contains('tablance-source-related-highlight')
  &&!relationName.selEl.classList.contains('tablance-source-related-highlight');
}
const repeatedRelations=new Tablance(host(),{details:{type:'list',entries:[
 {type:'repeated',nodeId:'people',dataKey:'people',entry:{type:'lineup',entries:[
 {type:'field',nodeId:'personSource',dataKey:'source',title:'Huvudman',sourceLinked:true,
   sourceLinkedTargets:['personNumber','personName'],input:{type:'text',
    onChange:({newValue,instanceNode})=>{
     instanceNode.dataObj.number=`Number ${newValue}`;
     instanceNode.dataObj.name=`Name ${newValue}`;
    }}},
  {type:'field',nodeId:'personNumber',dataKey:'number',title:'Personnummer',dependsOn:'personSource',input:{type:'text'}},
  {type:'field',nodeId:'personName',dataKey:'name',title:'Namn',dependsOn:'personSource',input:{type:'text'}},
 ]}},
]}},true,true,{searchbar:false});
repeatedRelations.setData({people:[
 {id:'first',source:'A',number:'111',name:'First'},
 {id:'second',source:'B',number:'222',name:'Second'},
]});
const repeatedPeople=repeatedRelations.getDetailCell(0,'people').children;
const [firstPerson,secondPerson]=repeatedPeople;
const [firstSource,firstNumber,firstName]=firstPerson.children;
const [secondSource,secondNumber,secondName]=secondPerson.children;
const ordinaryLineupDividerColor=getComputedStyle(firstName.selEl,'::before').borderInlineStartColor;
const isRelated=node=>node.selEl.classList.contains('tablance-source-related-highlight');
assert(firstSource.schemaNode===secondSource.schemaNode&&firstSource!==secondSource,
 'repeated people share a schema template but have distinct source instances');
assert(firstSource.selEl.classList.contains('tablance-source-linked-cell')
 &&secondSource.selEl.classList.contains('tablance-source-linked-cell')
 &&![firstNumber,firstName,secondNumber,secondName].some(isRelated),
 'only repeated source cells have permanent styling');
repeatedRelations._handleCellTypeTooltipPointer({target:firstSource.selEl});
assert(getComputedStyle(firstName.selEl,'::before').borderInlineStartColor===ordinaryLineupDividerColor,
 'relation styling keeps the original lineup divider');
assert(isRelated(firstNumber)&&isRelated(firstName)
 &&![firstSource,secondSource,secondNumber,secondName].some(isRelated),
 'first repeated source highlights only its own two dependent instances');
repeatedRelations.rootEl.dispatchEvent(new PointerEvent('pointerleave'));
assert(![firstNumber,firstName,secondNumber,secondName].some(isRelated),
 'mouseleave clears the repeated source relation immediately');
firstSource.select();
assert(isRelated(firstNumber)&&isRelated(firstName)
 &&![secondSource,secondNumber,secondName].some(isRelated),
 'an active repeated source has the same instance-scoped relation');
repeatedRelations.refreshSubtree(firstPerson);
assert(isRelated(firstNumber)&&isRelated(firstName)
 &&![secondSource,secondNumber,secondName].some(isRelated),
 're-render keeps active relations only on the same repeated instance');
secondSource.select();
assert(!isRelated(firstNumber)&&!isRelated(firstName)
 &&isRelated(secondNumber)&&isRelated(secondName),
 'selecting the second repeated source replaces the first relation without a stale class');
secondNumber.select();
assert(!isRelated(firstNumber)&&!isRelated(firstName)
 &&isRelated(secondNumber)&&isRelated(secondName)
 &&secondSource.selEl.classList.contains('tablance-source-relation-active'),
 'an active repeated target identifies its own source and sibling target');
secondSource.select();
repeatedRelations.updateData(secondSource.dataObj,'source','Picked source');
const selectedSourceIcon=secondSource.selEl.querySelector('.tablance-cell-state-icon-editable');
assert(secondSource.selEl.classList.contains('tablance-active-cell')
 &&selectedSourceIcon&&getComputedStyle(selectedSourceIcon).visibility==='visible',
 'a source-linked cell keeps its editing icon after its selected value repaints the active cell');
firstSource.select();
repeatedRelations._inputVal='C';
repeatedRelations._doEditSave();
await settleLayout();
const repeatedGhosts=[...document.querySelectorAll('.tablance-source-transfer-ghost')];
assert(firstPerson.dataObj.number==='Number C'&&firstPerson.dataObj.name==='Name C'
 &&secondPerson.dataObj.number==='222'&&secondPerson.dataObj.name==='Second'
 &&(matchMedia('(prefers-reduced-motion: reduce)').matches?repeatedGhosts.length===0:repeatedGhosts.length===2)
 &&repeatedGhosts.every(node=>node.textContent.endsWith('C')),
 'repeatRows transfer animates only the changed values in the selected source instance');
repeatedRelations._cancelSourceTransfer();
const indicatorTable=new Tablance(host(),{details:{type:'grid',columns:1,entries:[
 {title:'Navigation',dataKey:'navigation',nodeId:'navigation',onEnter:()=>{}},
 {title:'Editable',dataKey:'editable',nodeId:'editable',input:{type:'text'}},
 {title:'Locked',dataKey:'locked',nodeId:'locked',readOnly:true,input:{type:'text'}},
]}},true,true,{searchbar:false});
const indicatorRow={navigation:'Open details',editable:'Value',locked:'Locked'};
indicatorTable.setData(indicatorRow);
const activeIndicatorTooltip=async key=>{
 indicatorTable.selectCell(0,key);
 const icon=indicatorTable.getDetailCell(0,key).outerContainerEl.querySelector('.tablance-cell-state-icon');
 indicatorTable._handleCellTypeTooltipPointer({target:icon});
 await new Promise(resolve=>setTimeout(resolve,0));
 const text=indicatorTable._tooltip.firstChild.textContent;
 indicatorTable._clearCellTypeTooltip();
 return text;
};
assert((await activeIndicatorTooltip('navigation')).startsWith('Navigeringscell')
 &&(await activeIndicatorTooltip('editable')).startsWith('Redigeringscell'),
 'navigation and editing icons show concise, named cell-type tooltips while their cells are active');
for(const [key,kind] of [['navigation','navigation'],['editable','editable'],['locked','read-only']]){
 indicatorTable.selectCell(0,key);
 const selected=indicatorTable.getDetailCell(0,key);
 indicatorTable.updateData(indicatorRow,key,`Updated ${key}`);
 const icon=selected.outerContainerEl.querySelector(`.tablance-cell-state-icon-${kind}`);
assert(selected.selEl.classList.contains('tablance-active-cell')
  &&icon&&(kind==='editable'||getComputedStyle(icon).visibility==='visible'),
  `${kind} cell-type icon remains visible when the selected cell is repainted`);
}
const transferData={source:'',number:'',name:'',hidden:''};
const transferTable=new Tablance(host(),{details:{type:'list',entries:[
 {type:'field',nodeId:'transferSource',dataKey:'source',sourceLinked:true,
  sourceLinkedTargets:['transferNumber','transferName','transferHidden'],
  input:{type:'select',options:['first','second','third','after-scroll','after-resize',
   'after-refresh','fourth','source-only-change','mouse'].map(value=>({value,text:value})),
   onChange:({newValue})=>{
   transferData.number=`Number ${newValue}`;
   transferData.name=`Name ${newValue}`;
   transferData.hidden=`Hidden ${newValue}`;
  }}},
 {type:'field',nodeId:'transferNumber',dataKey:'number',dependsOn:'transferSource',input:{type:'text'}},
 {type:'field',nodeId:'transferName',dataKey:'name',dependsOn:'transferSource',input:{type:'text'}},
 {type:'field',nodeId:'transferHidden',dataKey:'hidden',dependsOn:'transferSource',
  visibleIf:()=>false,input:{type:'text'}},
]}},true,true,{searchbar:false});
transferTable.setData(transferData);
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'initial rendering does not produce transfer presentation');
const commitTransfer=value=>{
 transferTable.selectCell(0,'transferSource');
 transferTable._inputVal=value;
 transferTable._doEditSave();
};
commitTransfer('first');
assert(transferData.number==='Number first'&&transferData.name==='Name first',
 'source commit updates the real target values independently of transfer presentation');
await settleLayout();
let ghosts=[...document.querySelectorAll('.tablance-source-transfer-ghost')];
assert(ghosts.length===2&&ghosts.map(node=>node.textContent).sort().join('|')==='Name first|Number first'
 &&ghosts.every(node=>node.getAnimations().length===1),
 'one user source change sends two presentation ghosts to visible changed targets only');
assert(ghosts[0].getAnimations()[0].effect.getTiming().duration===720
 &&ghosts[0].getAnimations()[0].effect.getTiming().delay===60
 &&ghosts[1].getAnimations()[0].effect.getTiming().delay===105
 &&Math.abs(ghosts[0].getAnimations()[0].effect.getKeyframes()[1].offset-590/720)<.001
 &&parseFloat(ghosts[0].style.opacity)===.7
 &&parseFloat(ghosts[1].style.opacity)===0,
 'the first ghost stays visible at the source during the short start delay');
const firstGhosts=ghosts;
const textCenter=element=>{
 const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
 const rects=[];
 for(let node;node=walker.nextNode();){
  if(!node.textContent.trim())continue;
  const range=document.createRange();range.selectNodeContents(node);
  rects.push(...[...range.getClientRects()].filter(rect=>rect.width&&rect.height));
 }
 return {x:(Math.min(...rects.map(rect=>rect.left))+Math.max(...rects.map(rect=>rect.right)))/2,
  y:(Math.min(...rects.map(rect=>rect.top))+Math.max(...rects.map(rect=>rect.bottom)))/2};
};
const sourceValue=transferTable.getDetailCell(0,'transferSource').el;
const sourcePoint=textCenter(sourceValue);
for(const ghost of ghosts){
 const target=transferTable.getDetailCell(0,ghost.dataset.targetNodeId);
 const targetPoint=textCenter(target.el);
 const dx=targetPoint.x-sourcePoint.x;
 const dy=targetPoint.y-sourcePoint.y;
 const transform=ghost.getAnimations()[0].effect.getKeyframes()[1].transform;
 const offsets=[...transform.matchAll(/\+ (-?\d+(?:\.\d+)?)px/g)].map(match=>Number(match[1]));
 assert(Math.abs(parseFloat(ghost.style.left)-sourcePoint.x)<.02
  &&Math.abs(parseFloat(ghost.style.top)-sourcePoint.y)<.02
  &&offsets.length===2&&Math.abs(offsets[0]-dx)<.02&&Math.abs(offsets[1]-dy)<.02,
  `ghosts travel between painted text: ${JSON.stringify({sourcePoint,ghostLeft:ghost.style.left,ghostTop:ghost.style.top,targetPoint,offsets,dx,dy,sourceHtml:sourceValue.outerHTML,targetHtml:target.el.outerHTML})}`);
 const reveal=target.el.querySelector('.tablance-source-transfer-reveal');
 assert(target.el.textContent.trim()===ghost.textContent&&reveal
  &&parseFloat(getComputedStyle(reveal).opacity)<1
  &&getComputedStyle(target.el).opacity==='1',
  'committed target text is in the DOM immediately but visually withheld without dimming its cell');
}
assert(Math.abs(sourcePoint.x-(sourceValue.getBoundingClientRect().left+sourceValue.getBoundingClientRect().width/2))>20,
 'text positioning, rather than the wide source-cell center, determines the launch point');
const fallbackEl=document.createElement('div');
fallbackEl.style.cssText='position:fixed;left:100px;top:100px;width:160px;height:40px;padding:0 10px;text-align:right';
fallbackEl.textContent='Aligned';
document.body.appendChild(fallbackEl);
const paintedRight=textCenter(fallbackEl);
const measuredRight=transferTable._sourceTransferValuePoint({el:fallbackEl});
assert(Math.abs(paintedRight.x-measuredRight.x)<.02,
 'right-aligned value text, not its wide value container, supplies the transfer anchor');
fallbackEl.textContent='';
const rightFallback=transferTable._sourceTransferValuePoint({el:fallbackEl});
fallbackEl.style.textAlign='left';
const leftFallback=transferTable._sourceTransferValuePoint({el:fallbackEl});
fallbackEl.style.textAlign='center';
const centerFallback=transferTable._sourceTransferValuePoint({el:fallbackEl});
assert(rightFallback.x>centerFallback.x&&centerFallback.x>leftFallback.x,
 'empty value nodes fall back to computed left/right/center alignment');
fallbackEl.remove();
await new Promise(resolve=>setTimeout(resolve,710));
const fadingTarget=transferTable.getDetailCell(0,'transferNumber').el;
const fadingOpacity=parseFloat(getComputedStyle(fadingTarget.querySelector('.tablance-source-transfer-reveal')).opacity);
assert(fadingOpacity>.04&&fadingOpacity<1,
 'the real target value fades in near the end of the ghost flight');
await new Promise(resolve=>setTimeout(resolve,250));
assert(!document.querySelector('.tablance-source-transfer-layer')
 &&!fadingTarget.querySelector('.tablance-source-transfer-reveal')
 &&getComputedStyle(fadingTarget).opacity==='1',
 'after landing the real value is fully visible and temporary wrappers are removed');
commitTransfer('second');
await settleLayout();
ghosts=[...document.querySelectorAll('.tablance-source-transfer-ghost')];
assert(firstGhosts.every(node=>!node.isConnected)&&ghosts.length===2
 &&ghosts.every(node=>node.textContent.endsWith('second')),
 'rapid source changes cancel old ghosts and show only the latest values');
commitTransfer('second');
await settleLayout();
assert(ghosts.every(node=>node.isConnected)
 ||!document.querySelector('.tablance-source-transfer-layer'),
 'an unchanged source may cancel the prior presentation when its cells repaint');
assert(document.querySelectorAll('.tablance-source-transfer-ghost').length<=2,
 'choosing an unchanged source never creates another transfer');
commitTransfer('third');
await settleLayout();
document.dispatchEvent(new Event('scroll'));
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'scroll cancels transfer and removes the overlay');
assert(!transferTable.getDetailCell(0,'transferNumber').el.querySelector('.tablance-source-transfer-reveal')
 &&getComputedStyle(transferTable.getDetailCell(0,'transferNumber').el).opacity==='1',
 'scroll cancellation immediately restores the real value');
commitTransfer('after-scroll');
await settleLayout();
window.dispatchEvent(new Event('resize'));
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'resize also cancels transfer and removes the overlay');
assert(getComputedStyle(transferTable.getDetailCell(0,'transferNumber').el).opacity==='1',
 'resize cancellation restores target visibility');
commitTransfer('after-resize');
await settleLayout();
transferTable.refreshSubtree(transferTable.getDetailCell(0,'transferNumber'));
assert(!document.querySelector('.tablance-source-transfer-layer'),
 're-rendering a participating cell cancels the transfer overlay');
assert(getComputedStyle(transferTable.getDetailCell(0,'transferNumber').el).opacity==='1',
 're-render cancellation restores target visibility');
commitTransfer('after-refresh');
await settleLayout();
transferTable._exitEditMode(false);
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'discarding or closing an editor cleans up the transfer overlay');
assert(getComputedStyle(transferTable.getDetailCell(0,'transferNumber').el).opacity==='1',
 'editor close restores target visibility');
const originalMatchMedia=window.matchMedia;
window.matchMedia=()=>({matches:true});
commitTransfer('fourth');
await settleLayout();
assert(!document.querySelector('.tablance-source-transfer-ghost')
 &&(transferTable.getDetailCell(0,'transferNumber').selEl
  ??transferTable.getDetailCell(0,'transferNumber').el).classList.contains('tablance-source-transfer-arrival'),
 'reduced motion uses a brief target highlight without flying text');
assert(getComputedStyle(transferTable.getDetailCell(0,'transferNumber').el).opacity==='1',
 'reduced motion never delays the real target value');
transferTable._cancelSourceTransfer();
window.matchMedia=originalMatchMedia;
const transferSourceEntry=transferTable.getDetailCell(0,'transferSource').schemaNode;
const originalTransferChange=transferSourceEntry.input.onChange;
transferSourceEntry.input.onChange=()=>{};
commitTransfer('source-only-change');
await settleLayout();
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'a changed source with unchanged target values does not animate');
transferSourceEntry.input.onChange=originalTransferChange;
transferTable.updateData(transferData,'number','Programmatic update');
await settleLayout();
assert(!document.querySelector('.tablance-source-transfer-layer'),
 'programmatic target repaint does not create a transfer');
transferTable.selectCell(0,'transferSource',{enterEditMode:true});
const mouseOption=[...transferTable._selectContext.mainUl.children]
 .find(option=>option.textContent.trim()==='mouse');
mouseOption.click();
await settleLayout();
assert(transferData.source==='mouse'&&transferData.number==='Number mouse'
 &&document.querySelectorAll('.tablance-source-transfer-ghost').length===2,
 'clicking a source option starts transfer after the real targets update');
transferTable._cancelSourceTransfer();
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
const editIndicatorIcon=cell('none').selEl.querySelector(':scope>span.title>.tablance-cell-state-icon-editable');
assert(getComputedStyle(editIndicatorIcon).cursor==='help'
 &&getComputedStyle(editIndicatorIcon).pointerEvents==='auto'
 &&getComputedStyle(editIndicatorIcon,'::before').pointerEvents==='none',
 'cell type indicators expose one full-box help target with a pointer-transparent visual beside the title');
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
assert(headerSelection.toString().trim().toLowerCase()==='value'&&focusTables[1]._sortingCols.length===1
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
assert(buttonActivations===3&&buttonTable._activeSchemaNode?.nodeId==='secondaryAction',
 'pointer button action runs without selecting its underlying cell');
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
const checkboxData={approved:false,ordinary:'Text'};
let checkboxChanges=0;
const checkboxTable=new Tablance(document.body.appendChild(document.createElement('div')),
 {details:{type:'grid',columns:2,entries:[
  {type:'field',nodeId:'approved',dataKey:'approved',input:{type:'checkbox',label:'Approve',onChange:()=>checkboxChanges++}},
  {type:'field',nodeId:'ordinary',dataKey:'ordinary',input:{type:'text'}},
 ]}},true,true,{searchbar:false});
checkboxTable.setData(checkboxData);
const checkboxCell=checkboxTable.getDetailCell(0,'approved');
const checkboxInput=checkboxCell.el.querySelector('input[type="checkbox"]');
assert(checkboxInput&&checkboxInput.closest('label')?.textContent==='Approve'&&checkboxInput.tabIndex===-1,
 `checkbox cell exposes a native labeled control inside the Tablance navigation model: ${checkboxCell.el.outerHTML} / ${checkboxCell.schemaNode.input?.type}`);
const checkboxPadding=getComputedStyle(checkboxInput.closest('label'));
assert(parseFloat(checkboxPadding.paddingLeft)>=8&&parseFloat(checkboxPadding.paddingTop)>=6,
 'checkbox action controls keep breathing room inside their cell cursor');
checkboxTable.selectCell(0,'approved');
let bubbledCheckboxKeys=0;
checkboxTable.hostEl.addEventListener('keydown',()=>bubbledCheckboxKeys++);
const checkboxKey=code=>{
 const event=new KeyboardEvent('keydown',{key:code==='Space'?' ':code,code,bubbles:true,cancelable:true});
 const allowed=checkboxTable.rootEl.dispatchEvent(event);
 assert(!allowed,'checkbox keyboard action prevents native scrolling or submit');
};
checkboxKey('Enter');
assert(checkboxData.approved===true&&checkboxInput.checked&&!checkboxTable._inEditMode
 &&document.activeElement===checkboxTable._focusEl,'Enter toggles without edit mode or losing table focus');
checkboxKey('Space');
assert(checkboxData.approved===false&&!checkboxInput.checked&&checkboxChanges===2
 &&checkboxTable._activeDetailsCell===checkboxCell&&bubbledCheckboxKeys===0,
 'Space toggles once, stops propagation and retains the active cell');
checkboxInput.click();
assert(checkboxData.approved===true&&checkboxChanges===3&&document.activeElement===checkboxTable._focusEl
 &&checkboxTable._activeDetailsCell===checkboxCell,'native click toggles once and returns focus to active cell');
checkboxInput.closest('label').click();
assert(checkboxData.approved===false&&checkboxChanges===4,'clicking the native label toggles exactly once');
checkboxTable.selectCell(0,'ordinary');
checkboxTable.rootEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
assert(checkboxTable._inEditMode,'ordinary cells still use edit mode');
checkboxTable._exitEditMode(false);
checkboxTable.selectCell(0,'ordinary');
checkboxInput.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
checkboxInput.click();
assert(checkboxData.approved===true&&checkboxChanges===5
 &&checkboxTable._activeSchemaNode?.dataKey==='ordinary'
 &&document.activeElement===checkboxTable._focusEl,
 'pointer checkbox toggle preserves the previously active details cell and focus');
const checkboxLabel=checkboxInput.closest('label');
checkboxLabel.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
checkboxLabel.click();
await Promise.resolve();
assert(checkboxData.approved===false&&checkboxChanges===6
 &&checkboxTable._activeSchemaNode?.dataKey==='ordinary'
 &&document.activeElement===checkboxTable._focusEl,
 'pointer label click toggles without selecting the checkbox cell or moving focus');
const mainCheckboxData=[{approved:false,name:'First'},{approved:false,name:'Second'}];
const mainCheckboxTable=new Tablance(document.body.appendChild(document.createElement('div')),
 {main:{columns:[{dataKey:'approved',input:{type:'checkbox',label:'Approve'}},
  {dataKey:'name',input:{type:'text'}},
  {dataKey:'status',dependsOn:'approved',render:({rowData})=>rowData.approved?'Approved':'Pending'}]}},true,true,
 {searchbar:false,ordering:false});
mainCheckboxTable.setData(mainCheckboxData);
mainCheckboxTable.selectCell(0,'name');
const mainCheckboxInput=mainCheckboxTable.rootEl.querySelector('.main-table tbody input[type="checkbox"]');
mainCheckboxInput.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
mainCheckboxInput.click();
assert(mainCheckboxData[0].approved===true&&mainCheckboxTable._activeSchemaNode?.dataKey==='name'
 &&document.activeElement===mainCheckboxTable._focusEl,
 'main-table checkbox click commits without selecting its cell or losing prior focus');
const secondCheckbox=mainCheckboxTable._mainTbody.querySelectorAll('tr:not(.details)')[1]
 .querySelector('input[type="checkbox"]');
secondCheckbox.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
secondCheckbox.click();
const mainRows=[...mainCheckboxTable._mainTbody.querySelectorAll('tr:not(.details)')];
assert(mainCheckboxData[1].approved===true&&mainCheckboxTable._activeSchemaNode?.dataKey==='name'
 &&mainCheckboxTable._mainRowIndex===0
 &&mainRows[0].cells[2].textContent.includes('Approved')
 &&mainRows[1].cells[2].textContent.includes('Approved'),
 'pointer checkbox updates the clicked row and its dependents without moving the active row');
const pointerActionTable=new Tablance(document.body.appendChild(document.createElement('div')),
 {main:{columns:[{type:'expand'},{dataKey:'name',input:{type:'text'}},
  {type:'menu',actions:[{text:'Inspect'}]}]},details:{type:'list',entries:[
  {dataKey:'note',title:'Note'}]}},true,true,{searchbar:false,ordering:false});
pointerActionTable.setData([{name:'Record',note:'Detail'}]);
pointerActionTable.selectCell(0,'name');
const actionRow=pointerActionTable._mainTbody.querySelector('tr:not(.details)');
const wasExpanded=actionRow.classList.contains('expanded');
const expandControl=actionRow.querySelector('.expand-col a');
expandControl.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
assert(actionRow.classList.contains('expanded')!==wasExpanded
 &&pointerActionTable._activeSchemaNode?.dataKey==='name',
 'expand child control toggles details without selecting the action cell');
const menuControl=actionRow.querySelector('.tablance-menu-trigger');
menuControl.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0}));
menuControl.click();
assert(pointerActionTable._menuState&&pointerActionTable._activeSchemaNode?.dataKey==='name',
 'menu child control opens its menu without selecting the action cell');
const result=document.getElementById('test-results');
const listIconTable=new Tablance(host(),{details:{type:'list',entries:[
 {title:'List value',nodeId:'listValue',dataKey:'listValue',input:{type:'text'}},
 {title:'Source',nodeId:'listSource',dataKey:'listSource',sourceLinked:true,
  sourceLinkedTargets:['listShortTarget','listLongTarget'],input:{type:'text'}},
 {title:'Short target',nodeId:'listShortTarget',dataKey:'listShortTarget',dependsOn:'listSource',input:{type:'text'}},
 {title:'Long target',nodeId:'listLongTarget',dataKey:'listLongTarget',dependsOn:'listSource',input:{type:'text'}},
 {title:'Multiline',nodeId:'listMultiline',dataKey:'listMultiline',input:{type:'textarea',placeholder:'Write several lines'}},
 {title:'No icon',nodeId:'listNoIcon',dataKey:'listNoIcon',disabled:true,input:{type:'text'}},
]}},true,true,{searchbar:false});
listIconTable.setData({listValue:'Editable list value',listSource:'Source',
 listShortTarget:'Short',listLongTarget:'A longer text value that can wrap across several lines in the list cell without moving its start position.',
 listMultiline:'First line',listNoIcon:'No accessory'});
const listIconCell=listIconTable.getDetailCell(0,'listValue');
const listEditIcon=listIconCell.el.querySelector('.tablance-cell-state-icon-editable');
const listShortCell=listIconTable.getDetailCell(0,'listShortTarget').el;
const listLongCell=listIconTable.getDetailCell(0,'listLongTarget').el;
const listNoIconCell=listIconTable.getDetailCell(0,'listNoIcon').el;
const listValue=cellEl=>cellEl.querySelector('.tablance-field-icon-value')??cellEl;
const listTextRects=cellEl=>{
 const range=document.createRange();range.selectNodeContents(listValue(cellEl).firstChild);
 return [...range.getClientRects()];
};
const listTextX=cellEl=>listTextRects(cellEl)[0].left-cellEl.getBoundingClientRect().left;
const listIcons=cellEl=>[...cellEl.querySelectorAll('.tablance-field-icon-slot>.tablance-cell-state-icons>.tablance-cell-state-icon')];
const shortIcons=listIcons(listShortCell);
const longIcons=listIcons(listLongCell);
assert(listEditIcon&&listIconCell.el.matches('td.value')
 &&!listNoIconCell.querySelector('.tablance-cell-state-icon')
 &&!listNoIconCell.querySelector('.tablance-field-icon-layout')
 &&shortIcons.length===2&&longIcons.length===2
 &&shortIcons[0].classList.contains('tablance-cell-state-icon-editable')
 &&shortIcons[1].classList.contains('tablance-cell-state-icon-source-target'),
 'details-list supports zero, one, or two independent state icons');
for(const listCell of [listIconCell.el,listShortCell,listLongCell]){
 assert(Math.abs(listTextX(listCell)-listTextX(listIconCell.el))<.1
  &&listTextX(listCell)>listTextX(listNoIconCell),
  'details-list reserves one narrow value inset only for cells with icons');
 const icons=listIcons(listCell);
 for(const icon of icons){
  const rect=icon.getBoundingClientRect();
  const fragments=listTextRects(listCell);
  assert(rect.left>=listCell.getBoundingClientRect().left
   &&rect.right+3<=fragments[0].left
   &&fragments.every(fragment=>rect.right<=fragment.left),
   'details-list icons occupy a column without overlapping text');
 }
 for(let index=1;index<icons.length;index++)
  assert(icons[index-1].getBoundingClientRect().bottom<icons[index].getBoundingClientRect().top,
   'multiple details-list icons stack vertically without overlap');
}
assert(listTextRects(listShortCell)[0].left-shortIcons[0].getBoundingClientRect().right<=6,
 'details-list icons stay close to a short value');
assert(shortIcons.every(icon=>getComputedStyle(icon).cursor==='help'
 &&icon.dataset.tablanceCellTypeTooltip&&getComputedStyle(icon).pointerEvents==='auto'),
 'each details-list icon keeps its own tooltip and help hit area');
let listIconClickBubbled=0;
listShortCell.addEventListener('click',()=>listIconClickBubbled++);
shortIcons.forEach(icon=>icon.dispatchEvent(new MouseEvent('click',{bubbles:true})));
assert(listIconClickBubbled===2,'both details-list icon clicks pass through to the cell');
for(const [key,listCell,icons] of [['listShortTarget',listShortCell,shortIcons],
 ['listLongTarget',listLongCell,longIcons]]){
 const before={x:listTextX(listCell),height:listCell.getBoundingClientRect().height,
  icons:icons.map(icon=>[icon.offsetLeft,icon.offsetTop])};
 listIconTable.selectCell(0,key);
 assert(icons.every((icon,index)=>getComputedStyle(icon).visibility==='visible'
  &&icon.offsetLeft===before.icons[index][0]&&icon.offsetTop===before.icons[index][1])
  &&Math.abs(listTextX(listCell)-before.x)<.1
  &&Math.abs(listCell.getBoundingClientRect().height-before.height)<.1,
  'activating a short or long details-list target reveals both icons without shifting text or height');
}
const mainIconTable=new Tablance(host(),{main:{columns:[
 {dataKey:'mainValue',input:{type:'text'}},
]}},true,true,{searchbar:false,ordering:false});
mainIconTable.setData([{mainValue:'Editable main value'}]);
const mainEditIcon=mainIconTable._mainTbody.querySelector('tr:not(.details)>td .tablance-cell-state-icon-editable');
assert(mainEditIcon,'an ordinary table cell keeps its editing icon');
const selectorIconTable=new Tablance(host(),{details:{type:'grid',columns:1,entries:[
 {title:'Person',nodeId:'selector',dataKey:'selector',sourceSelector:{manualValue:'manual'},
  displayPlaceholder:'Välj person',input:{type:'select',options:[{value:'andreas',text:'Andreas'},
   {value:'manual',text:'Manuell ifyllnad'}]}},
]}},true,true,{searchbar:false});
selectorIconTable.setData({selector:''});
const selectorIconCell=selectorIconTable.getDetailCell(0,'selector');
const selectorEditIcon=selectorIconCell.selEl.querySelector('.tablance-cell-state-icon-editable');
assert(selectorEditIcon&&selectorIconCell.el.querySelector('.tablance-source-pill-empty')
 &&!selectorIconCell.selEl.querySelector('.tablance-cell-state-icon-source-target')
 &&selectorEditIcon.closest('.tablance-field-icon-slot')
 &&selectorEditIcon.getBoundingClientRect().right
   <selectorIconCell.el.querySelector('.tablance-source-pill').getBoundingClientRect().left,
 'a sourceSelector keeps its pill chain and puts its independent editing icon in the shared left slot');
const gridEditIcon=cell('none').selEl.querySelector('.tablance-cell-state-icon-editable');
assert(gridEditIcon,'details-grid keeps its editing icon');
for (const type of ['grid','list','lineup']) {
 const narrowHost=host();narrowHost.style.width='205px';
 const narrowSchema=type==='grid'
  ?{details:{type:'grid',columns:1,entries:[{type:'field',nodeId:'narrowSource',dataKey:'source',
    title:'Source',sourceSelector:{manualValue:'manual'},input:{type:'text'}}]}}
  :{details:{type,entries:[{type:'field',nodeId:'narrowSource',dataKey:'source',
    title:'Source',sourceSelector:{manualValue:'manual'},input:{type:'text'}}]}};
 const narrowTable=new Tablance(narrowHost,narrowSchema,true,true,{searchbar:false});
 narrowTable.setData({source:'Norrings väg 3 · Andreas med ett mycket långt visningsnamn'});
 narrowTable.selectCell(0,'narrowSource');
 const value=narrowTable.getDetailCell(0,'narrowSource').el;
 const sourceContent=value.querySelector('.tablance-source-content');
 const pill=sourceContent?.querySelector('.tablance-source-pill');
 const label=pill?.querySelector('.tablance-source-pill-label');
 const pencil=value.querySelector('.tablance-field-icon-slot .tablance-cell-state-icon-editable');
 const pillRect=pill?.getBoundingClientRect(),pencilRect=pencil?.getBoundingClientRect();
 assert(sourceContent&&label&&pencil&&getComputedStyle(pencil).visibility==='visible'
  &&getComputedStyle(pencil).width==='12px'
  &&label.scrollWidth>label.clientWidth
  &&getComputedStyle(label).textOverflow==='ellipsis'
  &&pencilRect.right+3<=pillRect.left
  &&pencilRect.top>=value.getBoundingClientRect().top
  &&pencilRect.right<=value.getBoundingClientRect().right+1,
  `${type} keeps a fixed-size pencil in its left slot beside a shrinking ellipsized source pill`);
}
for(const [table,key,icon] of [[listIconTable,'listValue',listEditIcon],
 [mainIconTable,'mainValue',mainEditIcon],[selectorIconTable,'selector',selectorEditIcon],
 [standalone,'none',gridEditIcon]]){
 const before=icon.getBoundingClientRect();
 assert(getComputedStyle(icon).visibility==='hidden',`${key} edit icon is hidden at rest`);
 table.selectCell(0,key);
 const after=icon.getBoundingClientRect();
 assert(getComputedStyle(icon).visibility==='visible'
  &&Math.abs(before.x-after.x)<.1&&Math.abs(before.y-after.y)<.1,
  `${key} edit icon appears on the active cell without changing position`);
}
for(const [table,key,icon,cellEl] of [[listIconTable,'listValue',listEditIcon,listIconCell.el],
 [mainIconTable,'mainValue',mainEditIcon,mainEditIcon.closest('td')],
 [selectorIconTable,'selector',selectorEditIcon,selectorIconCell.selEl],
 [standalone,'none',gridEditIcon,cell('none').selEl],
 [standalone,'editOnly',cell('editOnly').selEl.querySelector('.tablance-cell-state-icon-editable'),cell('editOnly').selEl],
 [sourceRelationTable,'recordNumber',targetEditIcon,relationNumber.selEl]]){
 table.selectCell(0,key);
 const iconRect=icon.getBoundingClientRect();
 const cellLeft=cellEl.getBoundingClientRect().left;
 assert(getComputedStyle(icon).visibility==='visible',`${key} pencil is visible in active view mode`);
 table.selectCell(0,key,{enterEditMode:true});
 assert(table._inEditMode&&getComputedStyle(icon).visibility==='hidden'
  &&Math.abs(icon.getBoundingClientRect().left-iconRect.left)<.1
  &&Math.abs(cellEl.getBoundingClientRect().left-cellLeft)<.1,
  `${key} hides only the pencil during editing without moving its accessory or cell`);
 if(table===sourceRelationTable)assert(getComputedStyle(targetIcon).visibility==='visible',
  'the source-target chain remains visible while its editable cell is in edit mode');
 if(table===standalone)assert(table._cellCursor.querySelector('input.text-editor')?.value===''
  &&table._cellCursor.querySelector('input.text-editor')?.placeholder===(key==='editOnly'?'Editor hint':''),
  'the pencil stays hidden for empty grid editors with or without placeholders');
 table._exitEditMode(false);
 assert(getComputedStyle(icon).visibility==='visible'
  &&Math.abs(icon.getBoundingClientRect().left-iconRect.left)<.1
  &&Math.abs(cellEl.getBoundingClientRect().left-cellLeft)<.1,
  `${key} restores the pencil in active view mode at the original position`);
}
const multilineCell=listIconTable.getDetailCell(0,'listMultiline').el;
const multilineIcon=multilineCell.querySelector('.tablance-cell-state-icon-editable');
listIconTable.selectCell(0,'listMultiline');
const multilineIconX=multilineIcon.getBoundingClientRect().left;
const multilineTextX=listTextX(multilineCell);
listIconTable.selectCell(0,'listMultiline',{enterEditMode:true});
const multilineEditor=listIconTable._cellCursor.querySelector('textarea');
assert(multilineEditor&&getComputedStyle(multilineIcon).visibility==='hidden',
 'a multiline details-list editor hides the pencil');
multilineEditor.value='';
multilineEditor.dispatchEvent(new Event('input',{bubbles:true}));
assert(multilineEditor.placeholder==='Write several lines'
 &&getComputedStyle(multilineIcon).visibility==='hidden',
 'an empty multiline editor keeps its placeholder without showing the pencil');
multilineEditor.value='First line\nSecond line\nThird line';
multilineEditor.dispatchEvent(new Event('input',{bubbles:true}));
await settleLayout();
assert(getComputedStyle(multilineIcon).visibility==='hidden'
 &&Math.abs(multilineIcon.getBoundingClientRect().left-multilineIconX)<.1
 &&Math.abs(listTextX(multilineCell)-multilineTextX)<.1,
 'growing multiline text does not reveal or move the pencil or underlying text start');
listIconTable._exitEditMode(false);
assert(getComputedStyle(multilineIcon).visibility==='visible'
 &&Math.abs(multilineIcon.getBoundingClientRect().left-multilineIconX)<.1
 &&Math.abs(listTextX(multilineCell)-multilineTextX)<.1,
 'closing a multiline editor restores the pencil without shifting the text start');
sourceRelationTable.selectCell(0,'unrelatedValue');
const targetIconOffsets=[targetEditIcon,targetIcon].map(icon=>[icon.offsetLeft,icon.offsetTop]);
assert([targetEditIcon,targetIcon].every(icon=>getComputedStyle(icon).visibility==='hidden'),
 'both target state icons are hidden at rest');
sourceRelationTable.selectCell(0,'recordNumber');
assert(getComputedStyle(targetEditIcon).visibility==='visible'
 &&getComputedStyle(targetIcon).visibility==='visible'
 &&[targetEditIcon,targetIcon].every((icon,index)=>icon.offsetLeft===targetIconOffsets[index][0]
  &&icon.offsetTop===targetIconOffsets[index][1]),
 'both editable and source-target icons appear without moving the cell layout');
const iconLayoutHost=host();iconLayoutHost.style.width='230px';
const iconLayoutTable=new Tablance(iconLayoutHost,{details:{type:'list',entries:[
 {type:'lineup',entries:[
  {type:'field',nodeId:'untitledIcon',dataKey:'longText',readOnly:true},
  {type:'field',nodeId:'titledIcon',title:'Titled',dataKey:'shortText',readOnly:true},
 ]},
 {type:'list',title:'Nested',entries:[
  {type:'field',nodeId:'blockIcon',dataKey:'html',html:true,readOnly:true},
 ]},
 {type:'group',nodeId:'nestedIconGroup',title:'Group',entries:[
  {type:'field',nodeId:'groupUntitledIcon',dataKey:'groupText',readOnly:true},
 ]},
]}},true,true,{searchbar:false});
iconLayoutTable.setData({longText:'First line\nSecond line with enough text to wrap in a narrow cell',
 shortText:'Short',html:'<div>First block</div><p>Second block with longer content</p>',
 groupText:'Untitled group field'});
iconLayoutTable._openGroup(iconLayoutTable.getDetailCell(0,'nestedIconGroup'));
const untitled=iconLayoutTable.getDetailCell(0,'untitledIcon');
const titled=iconLayoutTable.getDetailCell(0,'titledIcon');
const block=iconLayoutTable.getDetailCell(0,'blockIcon');
const groupUntitled=iconLayoutTable.getDetailCell(0,'groupUntitledIcon');
const checkColumn=(cell,label)=>{
 const layout=cell.el.querySelector('.tablance-field-icon-layout');
 const icon=layout?.querySelector('.tablance-cell-state-icon-read-only');
 const value=layout?.querySelector('.tablance-field-icon-value');
 const cellRect=(cell.selEl??cell.el).getBoundingClientRect();
 const iconRect=icon?.getBoundingClientRect(),valueRect=value?.getBoundingClientRect();
 assert(layout&&icon&&value&&iconRect.left>=cellRect.left
  &&iconRect.right+3<=valueRect.left&&iconRect.top>=cellRect.top
  &&iconRect.bottom<=cellRect.bottom&&valueRect.right<=cellRect.right+1,
  `${label} keeps its icon column inside the selectable cell without overlap`);
 return {icon,value};
};
checkColumn(untitled,'untitled narrow lineup');
const blockParts=checkColumn(block,'nested block HTML');
checkColumn(groupUntitled,'untitled group field');
assert(blockParts.value.querySelector('div')?.textContent==='First block'
 &&blockParts.value.querySelector('p')?.textContent?.startsWith('Second block'),
 'nested block HTML keeps its elements inside the value column');
assert(!titled.el.querySelector('.tablance-field-icon-layout')
 &&titled.selEl.querySelector(':scope>span.title>.tablance-cell-state-icon-read-only'),
 'titled lineup keeps the icon beside its title');
for(const [cell,key] of [[untitled,'untitledIcon'],[block,'blockIcon']]){
 const rect=(cell.selEl??cell.el).getBoundingClientRect();
 const value=cell.el.querySelector('.tablance-field-icon-value');
 const before={x:value.getBoundingClientRect().x,y:value.getBoundingClientRect().y,
  width:value.getBoundingClientRect().width,height:rect.height};
 iconLayoutTable.selectCell(0,key);
 const cursor=iconLayoutTable._cellCursor.getBoundingClientRect();
 assert(Math.abs(cursor.x-rect.x)<1&&Math.abs(cursor.width-rect.width)<1
  &&Math.abs(value.getBoundingClientRect().x-before.x)<.1
  &&Math.abs(value.getBoundingClientRect().y-before.y)<.1
  &&Math.abs(value.getBoundingClientRect().width-before.width)<.1
  &&Math.abs((cell.selEl??cell.el).getBoundingClientRect().height-before.height)<.1,
  `${key} selection keeps outer cursor geometry and stable content`);
}
iconLayoutTable.selectCell(0,'untitledIcon');
const untitledIcon=untitled.el.querySelector('.tablance-field-icon-slot .tablance-cell-state-icon-read-only');
untitledIcon.scrollIntoView({block:'center',inline:'center'});
const untitledIconRect=untitledIcon.getBoundingClientRect();
assert(document.elementFromPoint(untitledIconRect.left+6,untitledIconRect.top+6)===untitledIcon,
 'the icon column retains a pointer hit area inside its cell');
window.cellTypeIconHitTest={targets:[
 {name:'source',icon:sourceIndicator,table:standalone,dataKey:'both'},
 {name:'source-target',icon:targetIcon,table:sourceRelationTable,dataKey:'recordNumber'},
 {name:'editable',icon:targetEditIcon,table:sourceRelationTable,dataKey:'recordNumber'},
 ...[['editable','editable'],['navigation','navigation'],['read-only','locked']].map(([kind,key])=>({
  name:kind,icon:indicatorTable.getDetailCell(0,key).outerContainerEl.querySelector(`.tablance-cell-state-icon-${kind}`),
  table:indicatorTable,dataKey:key,
 })),
]};
result.textContent='awaiting-cell-type-icon-hit-test';result.dataset.status='awaiting-cell-type-icon-hit-test';
await new Promise(resolve=>window.finishCellTypeIconHitTest=resolve);
result.textContent='standalone, expanded, bulkEdit, and linked table checks passed';result.dataset.status='passed';
