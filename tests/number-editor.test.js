const result=document.getElementById("test-results");
const assert=(condition,message)=>{if(!condition) throw new Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const key=(target,key)=>target.dispatchEvent(new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true}));
const host=()=>document.body.appendChild(document.createElement("div"));
const Tablance=window.Tablance;
try {
	const numericData={amount:""};
	const numericTable=new Tablance(host(),{main:{columns:[{dataKey:"amount",input:{type:"number",integer:true,min:6,max:8}}]}},
		true,true,{ordering:false,searchbar:false});
	numericTable.setData([numericData]);
	await tick();
	numericTable.selectCell(0,"amount",{enterEditMode:true});
	let numericInput=numericTable._cellCursor.querySelector("input");
	assert(numericInput.type==="text"&&numericInput.inputMode==="numeric",
		"number editor uses a text control with a numeric keyboard");
	const stepper=numericTable._cellCursor.querySelectorAll(".number-stepper-button");
	assert(stepper.length===2,"number editor exposes visible increment and decrement controls");
	stepper[0].click();
	assert(numericInput.value==="6","increment from empty begins at the minimum");
	stepper[1].click();
	assert(numericInput.value==="6","decrement cannot step below the minimum");
	key(numericInput,"ArrowUp");
	assert(numericInput.value==="7","keyboard uses the same stepper semantics");
	stepper[0].click();
	stepper[0].click();
	assert(numericInput.value==="8","increment stops at the maximum");
	numericInput.value="3";
	key(numericInput,"ArrowUp");
	assert(numericInput.value==="6","stepping toward the range corrects a manually typed low value");
	numericInput.value="9";
	key(numericInput,"ArrowDown");
	assert(numericInput.value==="8","stepping toward the range corrects a manually typed high value");
	numericInput.value="abc";
	key(numericInput,"ArrowUp");
	assert(numericInput.value==="abc","stepping leaves an invalid raw draft untouched");
	assert(numericTable._exitEditMode(true)===true&&numericData.amount==="abc",
		"number editor commits invalid raw input without sanitizing it");
	numericTable.selectCell(0,"amount",{enterEditMode:true});
	numericInput=numericTable._cellCursor.querySelector("input");
	assert(numericInput.value==="abc","invalid raw value survives reopening");
	numericInput.value="6";
	key(numericInput,"ArrowUp");
	assert(numericInput.value==="7","integer ArrowUp steps by one");
	key(numericInput,"ArrowDown");
	assert(numericInput.value==="6","integer ArrowDown steps by one");
	key(numericInput,"ArrowDown");
	assert(numericInput.value==="6","keyboard decrement stops at the minimum");
	numericTable._exitEditMode(true);
	const decimalData={amount:"2,5"};
	const decimalTable=new Tablance(host(),{main:{columns:[{dataKey:"amount",input:{type:"number"}}]}},
		true,true,{ordering:false,searchbar:false});
	decimalTable.setData([decimalData]);
	await tick();
	decimalTable.selectCell(0,"amount",{enterEditMode:true});
	const decimalInput=decimalTable._cellCursor.querySelector("input");
	assert(decimalInput.inputMode==="decimal","decimal number editor requests a decimal keyboard");
	key(decimalInput,"ArrowUp");
	assert(decimalInput.value==="3,5","decimal stepping retains the typed separator");
	decimalTable._exitEditMode(true);

 result.dataset.status="passed";
 result.textContent="Numeric editor assertions passed";
} catch(error) {
 result.dataset.status="failed";
 result.textContent=error.stack??String(error);
}
