const Tablance=window.Tablance;
const result=document.getElementById("test-results");
const assertions=[];
const assert=(condition,message)=>{
    if (!condition) throw new Error(message);
    assertions.push(message);
};
const host=()=>{
    const frame=document.body.appendChild(document.createElement("div"));
    frame.className="calendar-case";
    const element=frame.appendChild(document.createElement("div"));
    element.className="host";
    return {frame,element};
};
try {
    const realPikaday=window.Pikaday;
    const pickers=[];
    window.Pikaday=class {
        constructor(options) {
            this.options=options;
            this.el=document.createElement("div");
            this.el.className="pika-single is-hidden";
            this.el.style.cssText="box-sizing:border-box;width:260px;height:220px;background:white;border:1px solid #64748b;";
            this.el.textContent="Mock calendar surface";
            options.container.appendChild(this.el);
            this.open=()=>{
                this.el.classList.remove("is-hidden");
                options.onOpen?.();
            };
            options.field.addEventListener("focus",this.open);
            this.field=options.field;
            this.close=()=>options.onClose?.();
            this.destroy=()=>{};
            pickers.push(this);
        }
    };

    const cases=[
        {name:"details-list strict date",schema:{type:"list",entries:[
            {type:"field",nodeId:"date",dataKey:"date",input:{type:"date"}},
            {type:"field",nodeId:"next",dataKey:"next",input:{type:"text"}},
        ]}},
        {name:"details-list free-text date",schema:{type:"list",entries:[
            {type:"field",nodeId:"date",dataKey:"date",input:{type:"date",allowFreeText:true}},
            {type:"field",nodeId:"next",dataKey:"next",input:{type:"text"}},
        ]}},
        {name:"details-grid strict date",schema:{type:"grid",columns:2,rows:[
            {cells:[{type:"field",nodeId:"date",dataKey:"date",input:{type:"date"}},
                {type:"field",nodeId:"next",dataKey:"next",input:{type:"text"}}]},
        ]}},
        {name:"details-grid free-text date",schema:{type:"grid",columns:2,rows:[
            {cells:[{type:"field",nodeId:"date",dataKey:"date",input:{type:"date",allowFreeText:true}},
                {type:"field",nodeId:"next",dataKey:"next",input:{type:"text"}}]},
        ]}},
    ];

    const diagnostics=[];
    for (const testCase of cases) {
        const {frame,element}=host();
        const table=new Tablance(element,{details:testCase.schema},true,true,{searchbar:false});
        table.setData({date:"2026-10-30",next:"Following section"});
        table.selectCell(0,"date",{enterEditMode:true});
        const picker=pickers.at(-1);
        const calendar=picker?.options.container;
        assert(calendar?.parentElement===document.body,`${testCase.name}: calendar is portaled outside details and clipping ancestors`);
        assert(calendar.matches(":popover-open"),`${testCase.name}: calendar is promoted to the top layer while open`);
        assert(getComputedStyle(calendar).position==="fixed",`${testCase.name}: calendar uses viewport positioning`);

        const ancestorStyles=[];
        for (let node=table._cellCursor;node;node=node.parentElement) {
            const style=getComputedStyle(node);
            ancestorStyles.push({className:node.className?.toString?.()??node.tagName,
                position:style.position,zIndex:style.zIndex,overflow:style.overflow,
                transform:style.transform,isolation:style.isolation,contain:style.contain,
                containerType:style.containerType,willChange:style.willChange});
        }
		const detailNode=table.getDetailCell(0,"date");
		const detailCell=detailNode?.el??detailNode?.outerContainerEl??detailNode;
        const cellAncestors=[];
        for (let node=detailCell;node;node=node.parentElement) {
            const style=getComputedStyle(node);
            cellAncestors.push({className:node.className?.toString?.()??node.tagName,
                position:style.position,zIndex:style.zIndex,overflow:style.overflow,
                transform:style.transform,isolation:style.isolation,contain:style.contain,
                containerType:style.containerType,willChange:style.willChange});
        }
        diagnostics.push({case:testCase.name,calendarParent:calendar.parentElement.tagName,
            calendarPosition:getComputedStyle(calendar).position,calendarZIndex:getComputedStyle(calendar).zIndex,
            ancestorStyles,cellAncestors});

        const calendarRect=calendar.getBoundingClientRect();
        const following=frame.appendChild(document.createElement("div"));
        following.className="following-section";
        following.style.left=`${calendarRect.left+18}px`;
        following.style.top=`${calendarRect.top+60}px`;
        following.style.width="130px";
        const overlapX=calendarRect.left+35;
        const overlapY=calendarRect.top+75;
        const overlap=Math.min(calendarRect.right,following.getBoundingClientRect().right)>overlapX
            &&Math.min(calendarRect.bottom,following.getBoundingClientRect().bottom)>overlapY;
        assert(overlap,`${testCase.name}: fixture places a following section over the calendar area`);
        const hit=document.elementFromPoint(overlapX,overlapY);
        assert(calendar.contains(hit),`${testCase.name}: calendar wins hit-testing above the following section`);

        picker.close();
        assert(!calendar.isConnected,`${testCase.name}: closing the editor removes the portaled calendar`);
        table.destroy?.();
        frame.remove();
    }
    window.calendarStackingDiagnostics=diagnostics;
    window.Pikaday=realPikaday;
    result.textContent=`${assertions.length} date calendar stacking assertions passed`;
    result.dataset.status="passed";
} catch(error) {
    result.textContent=error.stack??String(error);
    result.dataset.status="failed";
}
