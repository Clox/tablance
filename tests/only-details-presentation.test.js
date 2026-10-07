const Tablance=window.Tablance;
const assert=(condition,message)=>{if (!condition) throw new Error(message);};
const host=()=>document.body.appendChild(document.createElement("div"));
const fields=()=>[
	{dataKey:"ordinary",nodeId:"ordinary",title:"Person 1",input:{type:"text",placeholder:"Editor only"}},
	{dataKey:"visible",nodeId:"visible",title:"Person 2",showPlaceholderInDisplay:true,
		input:{type:"text",placeholder:"Visible hint"}},
	{dataKey:"boolean",nodeId:"boolean",showPlaceholderInDisplay:true,
		input:{type:"select",boolean:true,placeholder:"Choose"}},
];

const standalone=new Tablance(host(),{details:{type:"grid",columns:2,entries:fields()}},
	true,true,{searchbar:false});
const standaloneRow={ordinary:"",visible:"",boolean:null};
standalone.setData(standaloneRow);
const ordinary=standalone.getDetailCell(0,"ordinary");
const visible=standalone.getDetailCell(0,"visible");
const boolean=standalone.getDetailCell(0,"boolean");
const panel=standalone.rootEl.querySelector(":scope > .details");
const panelStyle=getComputedStyle(panel);
const hintStyle=getComputedStyle(visible.el);
const mutedProbe=standalone.rootEl.appendChild(document.createElement("span"));
mutedProbe.style.color="var(--tablance-muted-color)";
const mutedColor=getComputedStyle(mutedProbe).color;
mutedProbe.remove();
assert(ordinary.el.textContent===""&&!ordinary.el.classList.contains("tablance-presentation-placeholder"),
	"default placeholder remains editor-only in onlyDetails");
standalone.selectCell(0,"ordinary");
assert(standalone._cellCursor.classList.contains("details")
	&&getComputedStyle(standalone._cellCursor).backgroundColor==="rgba(0, 0, 0, 0)"
	&&getComputedStyle(standalone._cellCursor).paddingTop==="0px",
	"the onlyDetails frame does not style the selected-cell cursor");
standalone.selectCell(0,"ordinary",{enterEditMode:true});
assert(standalone._cellCursor.querySelector("input.text-editor")?.placeholder==="Editor only",
	"the ordinary editor still receives its input placeholder");
const ordinaryTitle=ordinary.selEl.querySelector(":scope > span.title");
const inlineEditor=standalone._cellCursor.querySelector(":scope > .cell-value-editor");
assert(ordinaryTitle?.textContent==="Person 1"&&inlineEditor
	&&inlineEditor.getBoundingClientRect().top>=ordinaryTitle.getBoundingClientRect().bottom
	&&getComputedStyle(standalone._cellCursor).backgroundColor==="rgba(0, 0, 0, 0)"
	&&getComputedStyle(standalone._cellCursor).paddingTop==="0px"
	&&!standalone._cellCursor.classList.contains("only-details-content"),
	"editing an inline-title grid field leaves its label visible above the editor");
standalone._exitEditMode(false);
assert(visible.el.textContent==="Visible hint"
	&&visible.el.classList.contains("tablance-presentation-placeholder")
	&&hintStyle.color===mutedColor&&hintStyle.fontStyle==="italic",
	"opted-in onlyDetails placeholder uses muted placeholder styling");
assert(boolean.el.textContent==="Choose"
	&&boolean.el.classList.contains("tablance-presentation-placeholder"),
	"an empty boolean select can use the same field-level placeholder opt-in");
assert(standalone.rootEl.classList.contains("only-details")
	&&panelStyle.borderTopWidth==="1px"&&panelStyle.borderTopStyle==="solid"
	&&panelStyle.borderTopLeftRadius!=="0px"&&parseFloat(panelStyle.paddingLeft)>0,
	"onlyDetails owns the standalone frame and padding");
standalone.updateData(standaloneRow,"visible","Real value");
assert(visible.el.textContent==="Real value"
	&&!visible.el.classList.contains("tablance-presentation-placeholder"),
	"a real value replaces the onlyDetails placeholder");
standalone.updateData(standaloneRow,"boolean",false);
assert(!boolean.el.classList.contains("tablance-presentation-placeholder")
	&&boolean.el.textContent==="No",
	"a real boolean value replaces its placeholder with the select's displayed value");

const expanded=new Tablance(host(),{main:{columns:[{type:"expand"},{dataKey:"name"}]},
	details:{type:"list",entries:fields()}},true,true,{searchbar:false,ordering:false});
const expandedRow={name:"Row",ordinary:"",visible:"",boolean:null};
expanded.setData([expandedRow]);
expanded.expandRow(0);
const expandedOrdinary=expanded.getDetailCell(0,"ordinary");
const expandedVisible=expanded.getDetailCell(0,"visible");
const expandedPanel=expanded.rootEl.querySelector(".main-table > tbody > tr.details > td > .content");
assert(expandedOrdinary.el.textContent===""
	&&expandedVisible.el.textContent==="Visible hint"
	&&expandedVisible.el.classList.contains("tablance-presentation-placeholder"),
	"expanded details keep the same per-field opt-in and default");
assert(!expanded.rootEl.classList.contains("only-details")
	&&!expanded.rootEl.querySelector(":scope > .details")
	&&getComputedStyle(expandedPanel).borderTopWidth==="1px",
	"expanded details have only their existing main-row frame");
expanded.updateData(expandedRow,"visible","Filled");
assert(expandedVisible.el.textContent==="Filled"
	&&!expandedVisible.el.classList.contains("tablance-presentation-placeholder"),
	"a real value replaces the expanded-details placeholder");

const result=document.getElementById("test-results");
result.textContent="onlyDetails and expanded-details placeholder and frame checks passed";
result.dataset.status="passed";
