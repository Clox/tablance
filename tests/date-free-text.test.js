const Tablance=window.Tablance;
const result=document.getElementById("test-results");
const assertions=[];
const assert=(condition,message)=>{
    if (!condition) throw new Error(message);
    assertions.push(message);
};
const key=(target,key)=>{
    const event=new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true});
    target.dispatchEvent(event);
    return event;
};
const paste=(target,text)=>{
    const event=new Event("paste",{bubbles:true,cancelable:true});
    Object.defineProperty(event,"clipboardData",{value:{getData:()=>text}});
    target.dispatchEvent(event);
    return event;
};
const host=()=>{
    const element=document.body.appendChild(document.createElement("div"));
    element.className="host";
    return element;
};
try {
	const realPikaday=window.Pikaday;
	const pickers=[];
	window.Pikaday=class {
		constructor(options) {
			this.options=options;
			this.el=document.createElement("div");
			options.container.appendChild(this.el);
			pickers.push(this);
			this.onKey=e=>{
				if (pickers.at(-1)!==this||e.key!=="ArrowLeft") return;
				this.arrowEvents=(this.arrowEvents??0)+1;
				if (this.date) this.setDate(new Date(this.date.getFullYear(),this.date.getMonth(),
					this.date.getDate()-1));
			};
			document.addEventListener("keydown",this.onKey);
			if (options.defaultDate&&options.setDefaultDate) this.setDate(options.defaultDate,true);
		}
		setDate(date,silent=false) {
			this.date=date;
			this.options.field.value=date?this.options.toString(date):"";
			if (!silent) this.options.onSelect?.(date);
		}
		close() { this.options.onClose(); }
		destroy() { this.destroyed=true; document.removeEventListener("keydown",this.onKey); }
	};
	const freeDateRow={date:"foobar"};
	const freeDateTable=new Tablance(host(),{details:{type:"list",entries:[
		{dataKey:"date",nodeId:"freeDate",input:{type:"date",allowFreeText:true}},
	]}},true,true,{searchbar:false});
	freeDateTable.setData([freeDateRow]);
	freeDateTable.selectCell(0,"freeDate",{enterEditMode:true});
	let dateInput=freeDateTable._cellCursor.querySelector("input");
	assert(dateInput.value==="foobar"&&pickers.at(-1).options.parse("foobar")===null
		&&pickers.at(-1).options.keyboardInput===undefined,
		"free-text date opens with raw text and retains calendar keyboard support");
	const invalidPicker=pickers.at(-1);
	assert(!key(dateInput,"ArrowLeft").defaultPrevented
		&&invalidPicker.arrowEvents===undefined&&dateInput.value==="foobar",
		"an arrow key moves the caret instead of reaching the calendar for free text");
	dateInput.setSelectionRange(2,4);
	dateInput.value="2026-13-40";
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"2026-13-40"}));
	assert(dateInput.value==="2026-13-40"&&pickers.at(-1).options.parse(dateInput.value)===null,
		"invalid date-like text is not corrected or synchronized to the calendar");
	dateInput.value="2026-10-30";
	dateInput.setSelectionRange(4,7);
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"2026-10-30"}));
	assert(dateInput.value==="2026-10-30"&&dateInput.selectionStart===4&&dateInput.selectionEnd===7,
		"calendar synchronization preserves the caret and selection for valid manual dates");
	const validPicker=pickers.at(-1);
	assert(key(dateInput,"ArrowLeft").defaultPrevented
		&&validPicker.arrowEvents===1&&dateInput.value==="2026-10-29",
		"a valid date reuses calendar arrow navigation");
	dateInput.value="foobar längre än tio";
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"foobar längre än tio"}));
	assert(dateInput.value==="foobar längre än tio"&&dateInput.maxLength<0,
		"free-text date accepts arbitrary text longer than ten characters");
	const freePaste=paste(dateInput,"okänt");
	assert(!freePaste.defaultPrevented,"free-text date leaves paste to the native text input");
	dateInput.value="okänt";
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertFromPaste",data:"okänt"}));
	assert(dateInput.value==="okänt","pasted free text survives input handling");
	freeDateTable._exitEditMode(true);
	assert(freeDateRow.date==="okänt","free-text date commits arbitrary text");
	freeDateTable.selectCell(0,"freeDate",{enterEditMode:true});
	dateInput=freeDateTable._cellCursor.querySelector("input");
	assert(dateInput.value==="okänt","committed free text reopens unchanged");
	dateInput.value="text vid stängning";
	pickers.at(-1).close();
	await new Promise(resolve=>setTimeout(resolve,0));
	assert(freeDateRow.date==="text vid stängning",
		"closing the calendar commits raw free text without replacing it");
	freeDateTable.updateData(freeDateRow,"date","2026-10-30");
	freeDateTable.selectCell(0,"freeDate",{enterEditMode:true});
	dateInput=freeDateTable._cellCursor.querySelector("input");
	assert(dateInput.value==="2026-10-30"&&pickers.at(-1).date?.getFullYear()===2026
		&&pickers.at(-1).date?.getMonth()===9&&pickers.at(-1).date?.getDate()===30,
		"valid manual date opens the calendar on its exact day");
	dateInput.value="foobarbaz";
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"foobarbaz"}));
	key(dateInput,"Escape");
	assert(freeDateRow.date==="2026-10-30"&&!freeDateTable._inEditMode,
		"Escape cancels free-text edits as before");
	freeDateTable.selectCell(0,"freeDate",{enterEditMode:true});
	dateInput=freeDateTable._cellCursor.querySelector("input");
	pickers.at(-1).setDate(new Date(2026,9,30));
	assert(dateInput.value==="2026-10-30","calendar selection writes canonical YYYY-MM-DD");
	freeDateTable._exitEditMode(true);
	assert(freeDateRow.date==="2026-10-30","calendar selection commits the chosen day");
	const strictDateRow={date:"2026-10-30"};
	const strictDateTable=new Tablance(host(),{details:{type:"list",entries:[
		{dataKey:"date",nodeId:"strictDate",input:{type:"date"}},
	]}},true,true,{searchbar:false});
	strictDateTable.setData([strictDateRow]);
	strictDateTable.selectCell(0,"strictDate",{enterEditMode:true});
	const strictInput=strictDateTable._cellCursor.querySelector("input");
	const invalidLetter=new InputEvent("beforeinput",{bubbles:true,cancelable:true,data:"x"});
	strictInput.dispatchEvent(invalidLetter);
	assert(invalidLetter.defaultPrevented&&pickers.at(-1).options.parse===undefined
		&&pickers.at(-1).options.keyboardInput===undefined,
		"the default date editor keeps its digit mask and calendar keyboard behavior");
	strictDateTable._exitEditMode(false);
	window.Pikaday=realPikaday;
    result.textContent=`${assertions.length} free-text date assertions passed`;
    result.dataset.status="passed";
} catch(error) {
    result.textContent=error.stack??String(error);
    result.dataset.status="failed";
}
