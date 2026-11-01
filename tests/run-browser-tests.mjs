import {createServer} from "node:http";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {extname,join,normalize} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=normalize(join(fileURLToPath(new URL(".",import.meta.url)),".."));
const onlyDetails=process.argv.includes("--only-details");
const numberEditor=process.argv.includes("--number-editor");
const dateFreeText=process.argv.includes("--date-free-text");
const dateCalendarStacking=process.argv.includes("--date-calendar-stacking");
const copySelection=process.argv.includes("--copy-selection");
const keyboardScroll=process.argv.includes("--keyboard-scroll");
const types={".css":"text/css",".htm":"text/html",".html":"text/html",".js":"text/javascript",".mjs":"text/javascript"};
const server=createServer(async (req,res)=>{
	try {
		const relative=decodeURIComponent(new URL(req.url,"http://localhost").pathname).replace(/^\/+/,"");
		const path=normalize(join(root,relative||"tests/cell-state.test.htm"));
		if (!path.startsWith(root))
			throw new Error("Invalid path");
		res.setHeader("content-type",types[extname(path)]??"application/octet-stream");
		res.end(await readFile(path));
	} catch (error) {
		res.statusCode=404;
		res.end(String(error));
	}
});

await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const {port}=server.address();
const profile=await mkdtemp(join(tmpdir(),"tablance-chrome-"));
const externalEndpoint=process.env.CODEX_BROWSER_ENDPOINT;
const chrome=externalEndpoint?null:spawn(process.env.CHROME_BIN??"/usr/bin/google-chrome",[
	"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
	"--remote-debugging-port=0","--remote-allow-origins=*",`--user-data-dir=${profile}`,"about:blank",
],{stdio:["ignore","ignore","pipe"]});

let socket;
try {
	const debuggerUrl=externalEndpoint
		?(await (await fetch(`${externalEndpoint}/json/version`)).json()).webSocketDebuggerUrl
		:await new Promise((resolve,reject)=>{
		let stderr="";
		const timeout=setTimeout(()=>reject(new Error(`Chrome debugging endpoint timed out.\n${stderr}`)),10000);
		chrome.stderr.on("data",chunk=>{
			stderr+=chunk;
			const match=stderr.match(/DevTools listening on (ws:\/\/\S+)/);
			if (match) {
				clearTimeout(timeout);
				resolve(match[1]);
			}
		});
		chrome.once("exit",code=>reject(new Error(`Chrome exited before tests started (${code}).\n${stderr}`)));
	});
	socket=new WebSocket(debuggerUrl);
	await new Promise((resolve,reject)=>{
		socket.addEventListener("open",resolve,{once:true});
		socket.addEventListener("error",reject,{once:true});
	});
	let commandId=0;
	const pending=new Map();
	socket.addEventListener("message",event=>{
		const message=JSON.parse(event.data);
		if (!message.id)
			return;
		const request=pending.get(message.id);
		pending.delete(message.id);
		if (message.error)
			request?.reject(new Error(message.error.message));
		else
			request?.resolve(message.result);
	});
	const send=(method,params={},sessionId=null)=>new Promise((resolve,reject)=>{
		const id=++commandId;
		pending.set(id,{resolve,reject});
		socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
	});
	const testUrl=`http://127.0.0.1:${port}/tests/${dateCalendarStacking
		?"date-calendar-stacking.test.htm":keyboardScroll
		?"keyboard-scroll.test.htm":copySelection
		?"copy-selection.test.htm":dateFreeText
		?"date-free-text.test.htm":numberEditor
		?"number-editor.test.htm":onlyDetails
		?"only-details-presentation.test.htm":"cell-state.test.htm"}`;
	const {targetId}=await send("Target.createTarget",{url:testUrl});
	await send("Target.activateTarget",{targetId});
	const {sessionId}=await send("Target.attachToTarget",{targetId,flatten:true});
	await send("Runtime.enable",{},sessionId);
	await send("Page.bringToFront",{},sessionId);
	const evaluate=async expression=>{
		const response=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true},sessionId);
		if (response.exceptionDetails)
			throw new Error(response.exceptionDetails.exception?.description??response.exceptionDetails.text);
		return response.result.value;
	};
	const readResult=()=>evaluate(`(()=>{const el=document.getElementById("test-results");return el
		?{status:el.dataset.status,text:el.textContent}:null})()`);
	const waitForStatus=async accepted=>{
		const deadline=Date.now()+25000;
		while (Date.now()<deadline) {
			const current=await readResult();
			if (current?.status==="failed")
				throw new Error(current.text);
			if (accepted.includes(current?.status))
				return current;
			await new Promise(resolve=>setTimeout(resolve,25));
		}
		throw new Error(`Browser test timed out in state: ${JSON.stringify(await readResult())}`);
	};
	if (onlyDetails) {
		await waitForStatus(["awaiting-native-linked-header"]);
		const point=await evaluate(`(()=>{const rect=window.nativeLinkedHeader.getBoundingClientRect();return {
			x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
		await send("Input.dispatchMouseEvent",{type:"mousePressed",x:point.x,y:point.y,
			button:"left",buttons:1,clickCount:1},sessionId);
		await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x,y:point.y,
			button:"left",buttons:0,clickCount:1},sessionId);
		await evaluate(`window.finishNativeLinkedHeader()`);
		for (const index of [0,1]) {
			await waitForStatus([`awaiting-native-linked-noncell-${index}`]);
			const nonCellPoint=await evaluate(`(()=>{const rect=window.nativeLinkedNonCellTargets[${index}].getBoundingClientRect();return {
				x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
			await send("Input.dispatchMouseEvent",{type:"mousePressed",x:nonCellPoint.x,y:nonCellPoint.y,
				button:"left",buttons:1,clickCount:1},sessionId);
			await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:nonCellPoint.x,y:nonCellPoint.y,
				button:"left",buttons:0,clickCount:1},sessionId);
			await evaluate(`window.finishNativeLinkedNonCell()`);
		}
		await waitForStatus(["awaiting-cell-type-icon-hit-test"]);
		const targets=await evaluate(`window.cellTypeIconHitTest.targets.map((target,index)=>({index,name:target.name}))`);
		for (const target of targets) {
			for (const state of ["hover","active"]) {
				if (state==="hover") {
					const parentPoint=await evaluate(`(()=>{const icon=window.cellTypeIconHitTest.targets[${target.index}].icon;
						icon.closest(".tablance-cell-state")?.scrollIntoView({behavior:"instant",block:"center"});
						const rect=icon.closest(".tablance-cell-state").getBoundingClientRect();return {
							x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
					await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:parentPoint.x,y:parentPoint.y,
						button:"none",buttons:0},sessionId);
					await new Promise(resolve=>setTimeout(resolve,25));
				}
				const box=await evaluate(`(()=>{const target=window.cellTypeIconHitTest.targets[${target.index}];
					if (${JSON.stringify(state)}==="active") target.table.selectCell(0,target.dataKey);
					target.icon.scrollIntoView({behavior:"instant",block:"center",inline:"center"});
					const rect=target.icon.getBoundingClientRect();return {
						left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
						width:rect.width,height:rect.height};})()`);
			const iconPoints=[
				[box.left+1,box.top+1],[box.right-1,box.top+1],
				[box.right-1,box.bottom-1],[box.left+1,box.bottom-1],
				[box.left+box.width*.25,box.top+box.height*.5],
				[box.left+box.width*.75,box.top+box.height*.5],
			];
			const iconHits=[];
			for (const [x,y] of iconPoints) {
				await send("Input.dispatchMouseEvent",{type:"mouseMoved",x,y,button:"none",buttons:0},sessionId);
				await new Promise(resolve=>setTimeout(resolve,15));
				iconHits.push(await evaluate(`(()=>{const target=window.cellTypeIconHitTest.targets[${target.index}];
					const x=${x},y=${y},hit=document.elementFromPoint(x,y),tooltip=target.table._tooltip;
					return {x,y,target:hit?.className??hit?.tagName,targetHtml:hit?.outerHTML?.slice(0,140),cursor:hit?getComputedStyle(hit).cursor:null,
						wrapper:target.icon.className,wrapperCursor:getComputedStyle(target.icon).cursor,
						wrapperPointerEvents:getComputedStyle(target.icon).pointerEvents,
						visualPointerEvents:getComputedStyle(target.icon,"::before").pointerEvents,
						tooltipPointerEvents:getComputedStyle(tooltip).pointerEvents,
						tooltipVisible:tooltip.style.visibility==="visible",
						tooltipMatches:tooltip.firstChild.textContent===target.icon.dataset.tablanceCellTypeTooltip};})()`));
			}
			if (!iconHits.every(hit=>hit.target?.includes?.("tablance-cell-type-icon")
				||hit.target?.includes?.(`tablance-cell-state-icon-${target.name}`)))
				throw new Error(`Cell type icon hit testing must stay on the wrapper (${target.name}): ${JSON.stringify(iconHits)}`);
			if (!iconHits.every(hit=>hit.cursor==="help"&&hit.wrapperPointerEvents==="auto"
				&&hit.visualPointerEvents==="none"&&hit.tooltipPointerEvents==="none"
				&&hit.tooltipVisible&&hit.tooltipMatches))
				throw new Error(`Cell type icon cursor/tooltip hit area changed (${target.name}): ${JSON.stringify(iconHits)}`);
			}
		}
		console.log("Cell type hit testing stayed on the help wrapper across four icon types, hover/active states and six points per icon.");
		await evaluate(`window.finishCellTypeIconHitTest()`);
	}
	if (!onlyDetails&&!numberEditor&&!dateFreeText&&!dateCalendarStacking&&!copySelection&&!keyboardScroll) {
	await waitForStatus(["awaiting-native-keys"]);
	const dispatch=(type,key,code,keyCode,modifiers=0)=>send("Input.dispatchKeyEvent",{
		type,key,code,modifiers,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,
	},sessionId);
	const press=async (key,code,keyCode,modifiers=0)=>{
		await dispatch("keyDown",key,code,keyCode,modifiers);
		await dispatch("keyUp",key,code,keyCode,modifiers);
	};
	await press("Home","Home",36);
	await press("ArrowRight","ArrowRight",39);
	await dispatch("keyDown","Shift","ShiftLeft",16,8);
	await press("ArrowRight","ArrowRight",39,8);
	await dispatch("keyUp","Shift","ShiftLeft",16);
	await dispatch("keyDown","Control","ControlLeft",17,2);
	await press("c","KeyC",67,2);
	await dispatch("keyUp","Control","ControlLeft",17);
	await press("End","End",35);
	await press("Home","Home",36);
	await send("Input.insertText",{text:"X"},sessionId);
	await press("Escape","Escape",27);
	await waitForStatus(["awaiting-native-group-hover"]);
	const groupHoverPoint=await evaluate(`(()=>{const rect=window.nativeGroupHoverTarget.getBoundingClientRect();return {
		x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
	await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:groupHoverPoint.x,y:groupHoverPoint.y,
		button:"none",buttons:0},sessionId);
	await waitForStatus(["awaiting-native-sorting"]);
	const headerPoint=await evaluate(`(()=>{const rect=window.nativeSortingHeader.getBoundingClientRect();return {
		x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
	await send("Input.dispatchMouseEvent",{type:"mousePressed",x:headerPoint.x,y:headerPoint.y,
		button:"left",buttons:1,clickCount:1,modifiers:8},sessionId);
	await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:headerPoint.x,y:headerPoint.y,
		button:"left",buttons:0,clickCount:1,modifiers:8},sessionId);
	await waitForStatus(["awaiting-native-double-sorting"]);
	const doubleHeaderPoint=await evaluate(`(()=>{const rect=window.nativeDoubleSortingHeader.getBoundingClientRect();return {
		x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
	for (const clickCount of [1,2]) {
		await send("Input.dispatchMouseEvent",{type:"mousePressed",x:doubleHeaderPoint.x,y:doubleHeaderPoint.y,
			button:"left",buttons:1,clickCount},sessionId);
		await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:doubleHeaderPoint.x,y:doubleHeaderPoint.y,
			button:"left",buttons:0,clickCount},sessionId);
	}
	await waitForStatus(["awaiting-native-table-focus"]);
	await evaluate(`window.nativeTableFocus.cell.scrollIntoView({block:"center"})`);
	const tableFocusPoint=await evaluate(`(()=>{const rect=window.nativeTableFocus.cell.getBoundingClientRect();return {
		x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
	await send("Input.dispatchMouseEvent",{type:"mousePressed",x:tableFocusPoint.x,y:tableFocusPoint.y,
		button:"left",buttons:1,clickCount:1},sessionId);
	await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:tableFocusPoint.x,y:tableFocusPoint.y,
		button:"left",buttons:0,clickCount:1},sessionId);
	await evaluate(`window.verifyNativeTableFocus("pointer")`);
	const focusedAfter=await evaluate(`(()=>{window.nativeTableFocus.after.focus();return document.activeElement===window.nativeTableFocus.after})()`);
	if (!focusedAfter)
		throw new Error("Could not move focus after native table before Shift+Tab regression check");
	await evaluate(`window.nativeTableFocus.after.addEventListener("keydown",event=>event.preventDefault(),{once:true})`);
	await dispatch("rawKeyDown","Tab","Tab",9,8);
	await evaluate(`window.nativeTableFocus.table._focusEl.focus()`);
	await dispatch("keyUp","Tab","Tab",9,8);
	await evaluate(`window.verifyNativeTableFocus("tab-return")`);
	const outlineTabPrevented=await evaluate(`(()=>{const event=new KeyboardEvent("keydown",{
		key:"Tab",code:"Tab",bubbles:true,cancelable:true});window.nativeTableFocus.table.rootEl.dispatchEvent(event);
		return event.defaultPrevented})()`);
	if (outlineTabPrevented)
		throw new Error("Tab was prevented while the table had whole-table focus");
	await evaluate(`window.nativeTableFocus.after.focus()`);
	await evaluate(`window.verifyNativeTableFocus("tab-pass")`);
	await evaluate(`window.nativeTableFocus.after.addEventListener("keydown",event=>event.preventDefault(),{once:true})`);
	await dispatch("rawKeyDown","Tab","Tab",9,8);
	await evaluate(`window.nativeTableFocus.table._focusEl.focus()`);
	await dispatch("keyUp","Tab","Tab",9,8);
	await press("ArrowRight","ArrowRight",39);
	await evaluate(`window.verifyNativeTableFocus("interaction");window.finishNativeTableFocus()`);
	await waitForStatus(["awaiting-navigation-icon-reset"]);
	await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:2,y:2,button:"none",buttons:0},sessionId);
	await evaluate(`window.prepareNavigationIconRegression()`);
	await waitForStatus(["awaiting-navigation-icon-hover"]);
	const navigationIconPoint=await evaluate(`(()=>{const rect=window.navigationIconRegression.cell.getBoundingClientRect();return {
		x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
	await send("Input.dispatchMouseEvent",{type:"mouseMoved",x:navigationIconPoint.x,y:navigationIconPoint.y,
		button:"none",buttons:0},sessionId);
	const navigationIconResult=await evaluate(`window.finishNavigationIconRegression()`);
	if (!navigationIconResult.passed)
		throw new Error(navigationIconResult.message);
	console.log(`Navigation icon rects: ${JSON.stringify({
		normal:navigationIconResult.normal,hover:navigationIconResult.hover,active:navigationIconResult.active})}`);
	}
	const finalResult=await waitForStatus(["passed"]);
	console.log(finalResult.text);
	if (dateCalendarStacking)
		console.log(`Date calendar stacking diagnostics: ${JSON.stringify(await evaluate("window.calendarStackingDiagnostics"))}`);
	await send("Target.closeTarget",{targetId});
} catch (error) {
	console.error(error.stack??String(error));
	process.exitCode=1;
} finally {
	socket?.close();
	if (chrome) {
		const chromeExited=chrome.exitCode==null
			?new Promise(resolve=>chrome.once("exit",resolve)):Promise.resolve();
		chrome.kill("SIGTERM");
		await chromeExited;
	}
	await new Promise(resolve=>server.close(resolve));
	await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:50});
}
