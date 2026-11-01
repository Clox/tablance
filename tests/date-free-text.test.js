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
				const offsets={ArrowLeft:-1,ArrowUp:-7,ArrowRight:1,ArrowDown:7};
				if (pickers.at(-1)!==this||!Object.hasOwn(offsets,e.key)) return;
				this.arrowEvents=(this.arrowEvents??0)+1;
				this.lastArrowStart=this.date?new Date(this.date):new Date();
				const nextDate=new Date(this.lastArrowStart);
				nextDate.setDate(nextDate.getDate()+offsets[e.key]);
				this.setDate(nextDate);
			};
			document.addEventListener("keydown",this.onKey);
			if (options.defaultDate&&options.setDefaultDate) this.setDate(options.defaultDate,true);
		}
	setDate(date,silent=false) {
		this.date=date;
		this.options.field.value=date?this.options.toString(date):"";
		this.options.field.dispatchEvent(new Event("change"));
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
	const invalidRight=key(dateInput,"ArrowRight");
	assert(!invalidRight.defaultPrevented&&invalidPicker.arrowEvents===undefined&&dateInput.value==="foobar",
		"ArrowRight preserves non-date free text and native caret navigation");
	dateInput.setSelectionRange(2,4);
	dateInput.value="2026-13-40";
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"2026-13-40"}));
	assert(dateInput.value==="2026-13-40"&&pickers.at(-1).options.parse(dateInput.value)===null,
		"invalid date-like text is not corrected or synchronized to the calendar");
	const invalidUp=key(dateInput,"ArrowUp");
	assert(!invalidUp.defaultPrevented&&invalidPicker.arrowEvents===undefined&&dateInput.value==="2026-13-40",
		"ArrowUp preserves invalid date-like text and native caret navigation");
	const invalidDown=key(dateInput,"ArrowDown");
	assert(!invalidDown.defaultPrevented&&invalidPicker.arrowEvents===undefined&&dateInput.value==="2026-13-40",
		"ArrowDown preserves invalid date-like text and native caret navigation");
	dateInput.value="2026-10-30";
	dateInput.setSelectionRange(4,7);
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"2026-10-30"}));
	assert(dateInput.value==="2026-10-30"&&dateInput.selectionStart===4&&dateInput.selectionEnd===7,
		"calendar synchronization preserves the caret and selection for valid manual dates");
	const validPicker=pickers.at(-1);
	assert(key(dateInput,"ArrowLeft").defaultPrevented
		&&validPicker.arrowEvents===1&&dateInput.value==="2026-10-29",
		"a valid date reuses calendar arrow navigation");
	const invalidPartial="2026-10-3";
	dateInput.value=invalidPartial;
	dateInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:invalidPartial}));
	const partialRight=key(dateInput,"ArrowRight");
	assert(!partialRight.defaultPrevented&&validPicker.arrowEvents===1&&dateInput.value===invalidPartial,
		"partial date-like free text is not intercepted or completed by calendar navigation");
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
	const emptyDateRow={date:""};
	const emptyDateTable=new Tablance(host(),{details:{type:"list",entries:[
		{dataKey:"date",nodeId:"emptyDate",input:{type:"date",allowFreeText:true}},
	]}},true,true,{searchbar:false});
	emptyDateTable.setData([emptyDateRow]);
	emptyDateTable.selectCell(0,"emptyDate",{enterEditMode:true});
	const emptyInput=emptyDateTable._cellCursor.querySelector("input");
	const emptyPicker=pickers.at(-1);
	const arrows={ArrowLeft:-1,ArrowUp:-7,ArrowRight:1,ArrowDown:7};
	const formatDate=date=>date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")
		+"-"+String(date.getDate()).padStart(2,"0");
	for (const [arrow,offset] of Object.entries(arrows)) {
		emptyInput.value="";
		emptyInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:""}));
		const before=emptyPicker.arrowEvents??0;
		const event=key(emptyInput,arrow);
		const expected=new Date(emptyPicker.lastArrowStart);
		expected.setDate(expected.getDate()+offset);
		assert(event.defaultPrevented&&emptyPicker.arrowEvents===before+1
			&&emptyInput.value===formatDate(expected),
			`${arrow} on an empty free-text date uses Pikaday's normal no-selection date navigation`);
	}
	emptyInput.value="2026-10-30";
	emptyInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:"2026-10-30"}));
	emptyInput.value=" \t ";
	emptyInput.dispatchEvent(new InputEvent("input",{bubbles:true,data:" \t "}));
	const whitespaceEvent=key(emptyInput,"ArrowLeft");
	const whitespaceExpected=new Date(emptyPicker.lastArrowStart);
	whitespaceExpected.setDate(whitespaceExpected.getDate()-1);
	assert(whitespaceEvent.defaultPrevented&&emptyInput.value===formatDate(whitespaceExpected)
		&&emptyInput.value!==" \t ",
		"whitespace-only text clears stale picker selection and is replaced by the first resulting date");
	emptyPicker.close();
	emptyDateTable._exitEditMode(false);
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
	const strictPicker=pickers.at(-1);
	strictPicker.setDate(null,true);
	const strictEmptyArrow=key(strictInput,"ArrowLeft");
	const strictExpected=new Date(strictPicker.lastArrowStart);
	strictExpected.setDate(strictExpected.getDate()-1);
	assert(strictEmptyArrow.defaultPrevented&&strictPicker.arrowEvents===1
		&&strictInput.value===formatDate(strictExpected),
		"strict date mode retains native no-selection ArrowLeft behavior");
	strictDateTable._exitEditMode(false);
	window.Pikaday=realPikaday;
    result.textContent=`${assertions.length} free-text date assertions passed`;
    result.dataset.status="passed";
} catch(error) {
    result.textContent=error.stack??String(error);
    result.dataset.status="failed";
}
