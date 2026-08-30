import {createServer} from "node:http";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {extname,join,normalize} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=normalize(join(fileURLToPath(new URL(".",import.meta.url)),".."));
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
const chrome=spawn(process.env.CHROME_BIN??"/usr/bin/google-chrome",[
	"--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
	"--remote-debugging-port=0","--remote-allow-origins=*",`--user-data-dir=${profile}`,"about:blank",
],{stdio:["ignore","ignore","pipe"]});

let socket;
try {
	const debuggerUrl=await new Promise((resolve,reject)=>{
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
	const testUrl=`http://127.0.0.1:${port}/tests/cell-state.test.htm`;
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
		const deadline=Date.now()+15000;
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
	const finalResult=await waitForStatus(["passed"]);
	console.log(finalResult.text);
	await send("Target.closeTarget",{targetId});
} catch (error) {
	console.error(error.stack??String(error));
	process.exitCode=1;
} finally {
	socket?.close();
	const chromeExited=chrome.exitCode==null
		?new Promise(resolve=>chrome.once("exit",resolve)):Promise.resolve();
	chrome.kill("SIGTERM");
	await chromeExited;
	await new Promise(resolve=>server.close(resolve));
	await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:50});
}
