/* eslint-disable */
// @ts-check
/// <reference path="../src/tablance-types.d.ts" />
/** @typedef {import("../src/tablance-types").TablanceOnChangeCallback} TablanceOnChangeCallback */

/** @type {TablanceOnChangeCallback} */
const handleDescriptionChange=(payload)=>{
	const {newValue,oldValue,dataKey,dataContext,schemaNode,instanceNode,closestMeta}=payload;
	console.log(payload);
	console.log({newValue,oldValue,dataKey,dataContext,schemaNode,instanceNode,closestMeta});
	console.log(closestMeta("foo"));//should log 69
	// payload.cancelUpdate(); // Uncomment to stop Tablance from writing newValue
};

import Tablance from "../src/tablance.js";
document.addEventListener("DOMContentLoaded", ()=>{
	function descFunc(value, dataRow,col,rowIndex) {
		return `fo<u>ob</u>ar ${rowIndex} - ${dataRow.descLetter??"foo"}`
	}
	var renderPNum=(pnumInt)=>{
	if (!pnumInt)
		return "";
	if (String(pnumInt).length===8)//if coming straight from db then it's an int and length wont work, so cast to string
		return pnumInt+"-XXXX";
	return String(pnumInt).substring(0, 8) + "-" + String(pnumInt).substring(8);
	
};
	function btnClickHandler({mainIndex,tablance}) {
		tablance.getDetailCell(mainIndex,"förordnande1").createNewEntry();
	}
	const foods=[{text:"banana",value:1,visibleIf:({rowIndex})=>rowIndex%2},
				{text:"apple",value:2},
				{text:"cucumber",value:3},{text:"orange",value:4},{text:"grapes",value:5},
				{text:"melon",value:6},{text:"pineapple",value:7},{text:"carrot",value:8},
				{text:"another banana",value:9},{text:"another apple",value:10},
				{text:"another cucumber",value:11},{text:"another orange",value:12},
				{text:"another set of grapes",value:13},{text:"another melon",value:14},
				{text:"another pineapple",value:15},{text:"another carrot",value:13}];
	const myTablanceCols=[{type:"select", width:45},{type:"expand", width:45}
		,{id:"desc",title:"Description",cellId:"description", width:"150px",html:true,input:{bulkEdit:false,
			/** @type {TablanceOnChangeCallback} */
			onChange:handleDescriptionChange,type:"text",maxLength:5,placeholder:"placeholder"
			,enabled:()=>Math.random()>.5},render:descFunc}
		,{id:"amount",title:"Amount",width:"85px",input:{bulkEdit:true},bulkEdit:true},{id:"balance",title:"Balance",width:"85px"}
		,{id:"food",title:"Food",width:"120px",input:{multiCellWidth:100,type:"select"
			,options:foods,minOptsFilter:100,allowCreateNew:true,allowSelectEmpty:true
			,selectInputPlaceholder:"Sök/Skapa"},bulkEdit:true}
		,{id:"mainDate",title:"Main Date",width:"120px",input:{multiCellWidth:100,type:"date"},bulkEdit:true}, 
		{title:"numtwice", render:num=>num*2, dependsOn:"num", onEnter:({mainIndex})=>{
			myTablance.selectCell(mainIndex,"personnummer",{enterEditMode:true})
		}},
		{title: "5 chars",input:{type:"text",
							validation:(newVal,message)=> {
								message("Det ska vara 5 tecken.");
								return newVal.toString().length==5;
							}
						}
			},
		];
	const myExpansion={meta:{"foo":"details", "baz":42},type:"list",titlesColWidth:"8em",entries:[
		{type:"field",title:"OnEnter demo",id:"enter_demo",onEnter:({mainIndex})=>{
			myTablance.selectCell(mainIndex,"personnummer",{enterEditMode:true})
		}},
		{type:"field",title: "Personnummer",id:"personal_identity_number", render:renderPNum,cellId:"personnummer",
					input:{type:"text",
						format:{ blocks: [8, 4], delimiter: "-", numericOnly: true,stripDelimiterOnSave:true},
						placeholder:"ÅÅÅÅMMDD-XXXX",
					}},
		{type:"field",title:"Phone Number",id:"phoneNumber",input:{type:"text",
			livePattern:/^\+?\d*$/,validation:/^\+?\d+$/}},
		{type:"field",title:"amount+10",render:amount=>(Number(amount)+10).toFixed(2)
			, dependsOn:"amount",/* visibleIf:()=>false */},
		{type:"field",title:"num",id:"num", input:{type:"text"},bulkEdit:true},
	{type:"field",title:"Format field",id:"myFormattedData"
		,input:{type:"text", format:{ blocks: [8, 4], delimiter: "-", numericOnly: true , 
		stripDelimiterOnSave:true}}},
{type:"group",dataPath:"hemadress",title:"Hemadress",bulkEdit:true,entries:[
	{type:"field",title:"Gata",id:"street",input:{type:"text",
			onChange:(...args)=>console.log(args)}},
	{type:"field",title:"Postnummer",id:"zip",input:{type:"text",
			onChange:(...args)=>console.log(args)}},
	{type:"field",title:"Ort",id:"city",input:{type:"text",
			onChange:(...args)=>console.log(args)}}
]},
	{type:"group",id:"innergrejer",title:"Inre grej",onClose:({preventClose})=>preventClose("nope!"),
		entries:[{type:"field",id:"innerFoo"}]},
		{type:"field",title:"File",id:"file",input:{type:"file",fileUploadHandler:xhr=>{
				xhr.open("POST", "http://localhost:3000/tests/serve.php", true);
			},
			fileMetasToShow:{filename:true},
			openHandler:(...args)=>{
				console.log(args);
			}
		}}
		,{type:"field",title:"Select",id:"sel",input:{type:"select",options:foods,minOptsFilter:100
							,allowCreateNew:true,allowSelectEmpty:true,selectInputPlaceholder:"Sök/Skapa"}},
		
			{type:"repeated",id:"addresses",sortCompare:(a,b)=>a.zip>b.zip?1:-1,entry:{type:"group",title:"Adress"
			,entries:
			[{type:"field",title:"Gata",id:"street"},
			{type:"field",title:"Postnummer",id:"zip"},
				{type:"field",title:"Ort",id:"city",cellId:"addrCity",input:{type:"text", onChange:args=>console.log(args.closestMeta("foo"))}},
				{type:"field",title:"Ort i versaler"
					,render:city=>city.toUpperCase()
					,dependsOn:"addrCity"},
				{type:"field",title:"test1", render:val=>val, dependsOn:"amount"}
			]}},
		
		
		{type:"field",title:"Date",id:"date",input:{type:"date",onChange:(...args)=>console.log(args)}},
		{type:"repeated",id:"repeatedField",sortCompare:(a,b)=>a.bar>b.bar?1:-1,entry:
			{type:"field",title:"repeated row",id:"foo"}
		},
		{type:"field",input:{type:"button",btnText:"Cool button",clickHandler:btnClickHandler}},
		 {type:"group",title:"förordnande1",bulkEdit:true,entries:[
			{type:"repeated",id:"custodianshipChanges",bulkEdit:true,create:true,cellId:"förordnande1",
			sortCompare:(a,b)=>a.date>b.date?1:-1
			,onCreate:payload=>console.log(payload)
			,onDelete:(...args)=>console.log(args)
			,creationText:"Lägg till",deleteAreYouSureText:"Är du säker?",deleteText:"Ta bort"
			,areYouSureYesText:"Ja",areYouSureNoText:"Nej",entry:
				{type:"group",closedRender:data=>{
						return `${{trustee:"God Man", administrator:"Förvaltare"}[data.type]} sedan ${data.date??""}`;
					},entries:[
						{type:"field",title:"Datum",id:"date",input:{type:"date",bulkEdit:true}},
						{type:"field",title:"Typ av ställföreträdarskap",id:"type",input:{type:"select",
							options:[{text:"God Man",value:"trustee"},{text:"Förvaltare",value:"administrator"},
							{text:"Avslut",value:"end"}]
							,bulkEdit:true
						}},
						{type:"field",title:"Förvalta egendom",id:"administrationOfProperty"
							,input:{type:"select",
							options:[{text:"Ja",value:true},{text:"Nej",value:false}]
						},dependsOn:"type",visibleIf:typeVal=>typeVal&&typeVal!="end"}
					],
					creationValidation:({newDataItem:data})=>{
						return !!(data.date&&data.type);
					}
				}
			}
		]}, 
		{type:"list",onBlur:(a,b,c,d,e,)=>{
			a=a;
		},
			title:"förordnande-lista",titlesColWidth:0,entries:[
			{type:"repeated",id:"custodianshipChanges",create:true,onCreate:payload=>console.log(payload)
			,onDelete:(...args)=>console.log(args)
			,sortCompare:(a,b)=>a.date>b.date?1:-1
			,creationText:"Lägg till",deleteAreYouSureText:"Är du säker?",deleteText:"Ta bort"
			,areYouSureYesText:"Ja",areYouSureNoText:"Nej",entry:
				{type:"group",closedRender:data=>{
						return `${{trustee:"God Man", administrator:"Förvaltare"}[data.type]} sedan ${data.date??""}`;
					},entries:[
						{type:"field",title:"Datum",id:"date",input:{type:"date"}},
						{type:"field",title:"Typ av ställföreträdarskap",id:"type",input:{type:"select",
							options:[{text:"God Man",value:"trustee"},{text:"Förvaltare",value:"administrator"}]
							,allowSelectEmpty:false
						}}],
					creationValidation:({newDataItem:data})=>{
						return !!(data.date&&data.type);
					}
				}
			}
		]},
		{type:"lineup",title:"Bunch ",entries:[
			{type:"field",title:"First thing",id:"first"},
			{type:"field",title:"Second thing",id:"second",/* visibleIf:()=>false */},
			{type:"field",title:"Third thing",id:"third"},
			{type:"field",input:{type:"button",btnText:"My button"}},
			{type:"field",title:"Fourth thing",id:"fourth"},
			{type:"field",title:"Fifth thing",id:"fifth"},
			{type:"field",title:"Sixth thing",id:"sixth"},
			{type:"field",title:"Seventh thing",id:"seventh"},
			{type:"field",title:"Input thing",id:"inputthing",input:{type:"text"}},
		]},
		{type:"group",title:"grupp",entries:[
			{type:"field",title:"Hello",id:"hello",input:{type:"text"}},
			{type:"field",title:"World",id:"world",input:{type:"text"}},
			{type:"field",title:"Emptytest",id:"emptykey",input:{type:"text"}}]},
		{type:"field",title:"Foobar One",id:"foobar1"
			,input:{type:"text",maxLength:5,placeholder:"boo",bulkEdit:true,
			validation:(newVal,message)=>{
				message("Must be \"Foo\"");
				return newVal=="Foo";
			}}},
		{type:"field",title:"Foobar Two",id:"foobar2"},
		{type:"list",title:"Baz entries",titlesColWidth:"6em",entries:[
			{type:"field",title:"Baz One",id:"baz1"},
			{type:"field",title:"Baz Two",id:"baz2"},
			{type:"field",title:"datum",id:"formatdate",
				input:{format:{date: true},placeholder:"ÅÅÅÅ-MM-DD"}},
			{type:"field",title:"Anteckningar",id:"notes",maxHeight:150,input:{type:"textarea"}},
		]},
	]};
	const lang={fileName:"Filnamn",fileLastModified:"Senast ändrad", fileSize:"Filstorlek"
						,fileUploadDone:"Färdig!",fileType:"Filtyp"
						,fileChooseOrDrag:"<b>Tryck för att välja en fil</b> eller dra den hit"
						,fileDropToUpload:"<b>Släpp för att ladda upp<b>"
						,filterPlaceholder:"Sök"
					};
	const tablanceContainer=document.getElementById("tablanceContainer1");

	const schema={main:{columns:myTablanceCols, toolbar:{
		defaultInsert:true,
		items:[]
	}}
					,details:myExpansion, meta:{foo:"root"}};
	
	const myTablance=new Tablance(tablanceContainer,schema, true, true
					,{defaultFileMetasToShow:{filename:false},lang:lang, useFakeFileUploadTest:true});


	// const myTablance=window.myTablance=new Tablance(tablanceContainer,myTablanceCols,true,true
	// 	,myExpansion,{defaultFileMetasToShow:{filename:false},lang:lang},false);

	window.tablance=myTablance;//to play with public methods via console


	let data;
	for (let i=0; i<3; i++) {
		data=[];
		for (let ii=0; ii<1000; ii++) {
			data.push({janej:0,num:55,myFormattedData:123456789123,desc:"dummy",foobar1:i+ii,foobar2:i*2+ii*2,
				descLetter:String.fromCharCode(ii+33)
				,amount:(Math.random()*100).toFixed(2),balance:(Math.random()*100).toFixed(2),baz1:69,baz2:70
				,hello:"Hallå",world:"Världen",innerFoo:1337,hemadress:{street:"Inre Kaplan",zip:"060606",city:"Inre Skara"}
				,addresses:[{street:"kaplan",zip:9999,city:"skara"},{street:"kaplan",zip:8999,city:"skara"}]
				//,sel:Math.random()<.5?null:foods[Math.round(Math.random()*(foods.length-1))]
				,sel:Math.random()<.5?null:foods[Math.round(Math.random()*(foods.length-1))].value
				,repeatedField:[{foo:"row one in repeated",bar:5},{foo:"row two in repeated",bar:1}
								,{foo:"row three in repeated",bar:3},{foo:"row four in repeated",bar:30}]
				,repeatedGroup:[{foo1:"blahblah",foo2:"lalala"},{foo1:"bloj",foo2:"kapapa"}]
				,custodianshipChanges:[
								{date:"2020-01-01",type:"trustee"},{date:"1999-01-01",type:"administrator"}
								,{date:"2003-01-01",type:"trustee"},{date:"1999-05-01",type:"administrator"}],
				first:"One",second:"Second",third:"Third",fourth:"Fourth",fifth:"Five",sixth:"Sixth"
				,seventh:"Seven"});
		}
		myTablance.addData(data);
	}
	myTablance._allData[0].file={lastModified:1669981639918,name:"foo.txt",size:1337,type: "text"};


	const tablanceContainer2=document.getElementById("tablanceContainer2");
	// const myTablance2=new Tablance(document.getElementById("tablanceContainer2"),null,true,true
	// 	,myExpansion,null,true);
	// 	myTablance2.addData(data);
});
