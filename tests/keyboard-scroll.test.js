const result=document.getElementById("test-results");
const assert=(condition,message)=>{if (!condition) throw new Error(message);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const key=(target,name)=>target.dispatchEvent(new KeyboardEvent("keydown",{
	key:name,code:name,bubbles:true,cancelable:true}));

try {
	for (const trailingKey of ["ArrowLeft","ArrowRight","ArrowUp"]) {
		const host=document.body.appendChild(document.createElement("div"));
		host.style.cssText="width:420px;height:190px";
		const table=new window.Tablance(host,{main:{columns:[
			{dataKey:"left",width:140},{dataKey:"middle",width:140},{dataKey:"right",width:140},
		]}},true,true,{searchbar:false,ordering:false});
		table.setData(Array.from({length:60},(_,index)=>({
			left:`Left ${index}`,middle:`Middle ${index}`,right:`Right ${index}`,
		})));
		await tick();
		table.selectCell(0,"middle");
		let reachedScroll=false;
		for (let count=0;count<30;count++) {
			const before=table._scrollBody.scrollTop;
			key(table.rootEl,"ArrowDown");
			if (table._scrollBody.scrollTop>before+.5) {
				reachedScroll=true;
				break;
			}
		}
		assert(reachedScroll,`ArrowDown reaches follow-scroll before ${trailingKey}`);
		const scroll=table._scrollBody.scrollTop,row=table._mainRowIndex,col=table._mainColIndex;
		key(table.rootEl,trailingKey);
		assert(table._scrollBody.scrollTop<=scroll+.5
			&&(trailingKey==="ArrowUp"?table._mainRowIndex===row-1
				:table._mainRowIndex===row&&table._mainColIndex===col+(trailingKey==="ArrowLeft"?-1:1)),
			`${trailingKey} after follow-scroll moved ${scroll} -> ${table._scrollBody.scrollTop}, row ${row} -> ${table._mainRowIndex}, col ${col} -> ${table._mainColIndex}`);
	}
	result.textContent="keyboard follow-scroll passed";
	result.dataset.status="passed";
} catch (error) {
	result.textContent=error.stack??String(error);
	result.dataset.status="failed";
}
