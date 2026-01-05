/* eslint-disable */
// @ts-check
/// <reference path="../src/tablance-types.d.ts" />
/** @typedef {import("../src/tablance-types").TablanceOnChangeCallback} TablanceOnChangeCallback */

/** @type {TablanceOnChangeCallback} */
const handleDescriptionChange=payload=>{
	const {newValue,oldValue,dataKey,dataContext,schemaNode,instanceNode,closestMeta}=payload;
	console.log(payload);
	console.log({newValue,oldValue,dataKey,dataContext,schemaNode,instanceNode,closestMeta});
	console.log(closestMeta("foo"));//should log 69
	// payload.cancelUpdate(); // Uncomment to stop Tablance from writing newValue
};

import Tablance from "../src/tablance.js";
document.addEventListener("DOMContentLoaded", ()=>{
	function descFunc({value,rowData,mainIndex}) {
		return `fo<u>ob</u>ar ${rowData.index} - ${rowData.descLetter??"foo"}`
	}
	var renderPNum=({value})=>{
	const pnumInt=value;
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
		,{dataKey:"desc",title:"Description",nodeId:"description", width:"150px",html:true,input:{bulkEdit:false,
			/** @type {TablanceOnChangeCallback} */
			onChange:handleDescriptionChange,type:"text",maxLength:5,placeholder:"placeholder"
			,enabledIf:()=>Math.random()>.5},render:descFunc, cssClass:()=>"fooclass"}
		,{dataKey:"amount",title:"Amount",width:"85px",input:{bulkEdit:true},bulkEdit:true},{dataKey:"balance",title:"Balance",width:"85px"}
		,{dataKey:"food",title:"Food",width:"120px",input:{multiCellWidth:100,type:"select"
			,options:foods,minOptsFilter:100,allowCreateNew:true,allowSelectEmpty:true
			,selectInputPlaceholder:"Sök/Skapa"},bulkEdit:true}
		,{dataKey:"mainDate",title:"Main Date",width:"120px",input:{multiCellWidth:100,type:"date"},bulkEdit:true}, 
		{title:"numtwice", render:({value})=>value*2, dependsOn:"num", onEnter:({mainIndex})=>{
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
		{type:"repeated",dataKey:"bar1",create:true,entry:
			{type:"group",title:"repeated group with nested repeated group",onCommit:()=>console.log("outer group"),entries:[
					{type:"repeated",dataKey:"bar2",title:"inner repeated group",create:true,entry:
						{type:"group",onCommit:()=>console.log("inner group"),entries:[
							{type:"field", title:"inner field",dataKey:"foooo",input:"text"}
						]}
					},
				],
			},
		},
		{title:"dynamic food", input:{type:"select", options:()=>[{text:"cheese", value:1},{text:"bread", value:2}]}},
		{type:"field",title:"OnEnter demo",dataKey:"enter_demo",onEnter:({mainIndex})=>{
			myTablance.selectCell(mainIndex,"personnummer",{enterEditMode:true})
		}},
		{type:"field",title: "Personnummer",dataKey:"personal_identity_number", render:renderPNum,nodeId:"personnummer",
					input:{type:"text",
						format:{ blocks: [8, 4], delimiter: "-", numericOnly: true,stripDelimiterOnSave:true},
						placeholder:"ÅÅÅÅMMDD-XXXX",
					}},
		{type:"field",title:"Phone Number",dataKey:"phoneNumber",input:{type:"text",
			livePattern:/^\+?\d*$/,validation:/^\+?\d+$/}},
		{type:"field",title:"amount+10",render:({value})=>(Number(value)+10).toFixed(2)
			, dependsOn:"amount",/* visibleIf:({value})=>false */},
		{type:"field",title:"num",dataKey:"num", input:{type:"text"},bulkEdit:true},
	{type:"field",title:"Format field",dataKey:"myFormattedData"
		,input:{type:"text", format:{ blocks: [8, 4], delimiter: "-", numericOnly: true , 
		stripDelimiterOnSave:true}}},
{type:"group",dataPath:"hemadress",title:"Hemadress",bulkEdit:true,entries:[
	{type:"field",title:"Gata",dataKey:"street",input:{type:"text",
			onChange:payload=>console.log(payload)}},
	{type:"field",title:"Postnummer",dataKey:"zip",input:{type:"text",
			onChange:payload=>console.log(payload)}},
	{type:"field",title:"Ort",dataKey:"city",input:{type:"text",
			onChange:payload=>console.log(payload)}}
]},
	{type:"group",dataKey:"innergrejer",title:"Inre grej",onClose:({preventClose})=>preventClose("nope!"),
		entries:[{type:"field",dataKey:"innerFoo"}]},
		{type:"field",title:"File",dataKey:"file",input:{type:"file",fileUploadHandler:xhr=>{
				xhr.open("POST", "http://localhost:3000/tests/serve.php", true);
			},
			fileMetasToShow:{filename:true},
			openHandler:(...args)=>{
				console.log(args);
			}
		}}
		,{type:"field",title:"Select",dataKey:"sel",input:{type:"select",options:foods,minOptsFilter:100
							,allowCreateNew:true,allowSelectEmpty:true,selectInputPlaceholder:"Sök/Skapa"}},
		
			{type:"repeated",dataKey:"addresses",sortCompare:(a,b)=>a.zip>b.zip?1:-1,entry:{type:"group",title:"Adress"
			,entries:
			[{type:"field",title:"Gata",dataKey:"street"},
			{type:"field",title:"Postnummer",dataKey:"zip"},
				{type:"field",title:"Ort",dataKey:"city",nodeId:"addrCity",input:{type:"text", onChange:args=>console.log(args.closestMeta("foo"))}},
				{type:"field",title:"Ort i versaler"
					,render:({value})=>value.toUpperCase()
					,dependsOn:"addrCity"},
				{type:"field",title:"test1", render:({value})=>value, dependsOn:"amount"}
			]}},
		
		
		{type:"field",title:"Date",dataKey:"date",input:{type:"date",onChange:payload=>console.log(payload)}},
		{type:"repeated",dataKey:"repeatedField",sortCompare:(a,b)=>a.bar>b.bar?1:-1,entry:
			{type:"field",title:"repeated row",dataKey:"foo"}
		},
		{type:"field",input:{type:"button",btnText:"Cool button",clickHandler:btnClickHandler}},
		 {type:"group",title:"förordnande1",bulkEdit:true,entries:[
			{type:"repeated",dataKey:"custodianshipChanges",bulkEdit:true,create:true,nodeId:"förordnande1",
			sortCompare:(a,b)=>a.date>b.date?1:-1
			,onCreate:payload=>console.log(payload)
			,onDelete:(...args)=>console.log(args)
			,creationText:"Lägg till",deleteAreYouSureText:"Är du säker?",deleteText:"Ta bort"
			,areYouSureYesText:"Ja",areYouSureNoText:"Nej",entry:
				{type:"group",closedRender:data=>{
						return `${{trustee:"God Man", administrator:"Förvaltare"}[data.type]} sedan ${data.date??""}`;
					},entries:[
						{type:"field",title:"Datum",dataKey:"date",input:{type:"date",bulkEdit:true}},
						{type:"field",title:"Typ av ställföreträdarskap",dataKey:"type",input:{type:"select",
							options:[{text:"God Man",value:"trustee"},{text:"Förvaltare",value:"administrator"},
							{text:"Avslut",value:"end"}]
							,bulkEdit:true
						}},
						{type:"field",title:"Förvalta egendom",dataKey:"administrationOfProperty"
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


		{type:"list",title:"förordnande-lista",titlesColWidth:0,entries:[
			{type:"repeated",dataKey:"custodianshipChanges",create:true,entry:
				{type:"group",entries:[
						{type:"field",title:"Datum",dataKey:"date",input:{type:"date"}},
						{type:"field",title:"Typ av ställföreträdarskap",dataKey:"type",input:{type:"text",}}
					],
				}
			}
		]},


/* 		{type:"list",title:"förordnande-lista",titlesColWidth:0,entries:[
			{type:"repeated",dataKey:"custodianshipChanges",create:true,onCreate:payload=>console.log(payload)
			,onDelete:(...args)=>console.log(args)
			,sortCompare:(a,b)=>a.date>b.date?1:-1
			,creationText:"Lägg till",deleteAreYouSureText:"Är du säker?",deleteText:"Ta bort"
			,areYouSureYesText:"Ja",areYouSureNoText:"Nej",entry:
				{type:"group",closedRender:data=>{
						return `${{trustee:"God Man", administrator:"Förvaltare"}[data.type]} sedan ${data.date??""}`;
					},entries:[
						{type:"field",title:"Datum",dataKey:"date",input:{type:"date"}},
						{type:"field",title:"Typ av ställföreträdarskap",dataKey:"type",input:{type:"select",
							options:[{text:"God Man",value:"trustee"},{text:"Förvaltare",value:"administrator"}]
							,allowSelectEmpty:false
						}}],
					creationValidation:({newDataItem:data})=>{
						return !!(data.date&&data.type);
					}
				}
			}
		]}, */


		{type:"lineup",title:"Bunch ",entries:[
			{type:"field",title:"First thing",dataKey:"first"},
			{type:"field",title:"Second thing",dataKey:"second",/* visibleIf:()=>false */},
			{type:"field",title:"Third thing",dataKey:"third"},
			{type:"field",input:{type:"button",btnText:"My button"}},
			{type:"field",title:"Fourth thing",dataKey:"fourth"},
			{type:"field",title:"Fifth thing",dataKey:"fifth"},
			{type:"field",title:"Sixth thing",dataKey:"sixth"},
			{type:"field",title:"Seventh thing",dataKey:"seventh"},
			{type:"field",title:"Input thing",dataKey:"inputthing",input:{type:"text"}},
		]},
		{type:"group",title:"grupp",entries:[
			{type:"field",title:"Hello",dataKey:"hello",input:{type:"text"}},
			{type:"field",title:"World",dataKey:"world",input:{type:"text"}},
			{type:"field",title:"Emptytest",dataKey:"emptykey",input:{type:"text"}}]},
		{type:"field",title:"Foobar One",dataKey:"foobar1"
			,input:{type:"text",maxLength:5,placeholder:"boo",bulkEdit:true,
			validation:(newVal,message)=>{
				message("Must be \"Foo\"");
				return newVal=="Foo";
			}}},
		{type:"field",title:"Foobar Two",dataKey:"foobar2"},
		{type:"list",title:"Baz entries",titlesColWidth:"6em",entries:[
			{type:"field",title:"Baz One",dataKey:"baz1"},
			{type:"field",title:"Baz Two",dataKey:"baz2"},
			{type:"field",title:"datum",dataKey:"formatdate",
				input:{format:{date: true},placeholder:"ÅÅÅÅ-MM-DD"}},
			{type:"field",title:"Anteckningar",dataKey:"notes",maxHeight:150,input:{type:"textarea"}},
		]},
	]};
	const lang={fileName:"Filnamn",fileLastModified:"Senast ändrad", fileSize:"Filstorlek"
						,fileUploadDone:"Färdig!",fileType:"Filtyp"
						,fileChooseOrDrag:"<b>Tryck för att välja en fil</b> eller dra den hit"
						,fileDropToUpload:"<b>Släpp för att ladda upp<b>"
						,filterPlaceholder:"Sök"
					};
	const tablanceContainer=document.getElementById("tablanceContainer1");

	const schema={
		onDataCommit:payload=>console.log(payload),
		main:{columns:myTablanceCols, toolbar:{
		defaultInsert:true,
		items:[]
	}}
					,details:myExpansion, meta:{foo:"root"}
//					,onRowCommit:payload=>console.log("onRowCommit",payload)
					,onChange:payload=>console.log("root.onChange",payload)
					,onCommit:payload=>console.log("group.onCommit",payload)
					,onClose:payload=>console.log("group.onClose",payload)};
	
	const myTablance=new Tablance(tablanceContainer,schema, true, true
					,{defaultFileMetasToShow:{filename:false},lang:lang, useFakeFileUploadTest:true});


	// const myTablance=window.myTablance=new Tablance(tablanceContainer,myTablanceCols,true,true
	// 	,myExpansion,{defaultFileMetasToShow:{filename:false},lang:lang},false);

	window.tablance=myTablance;//to play with public methods via console


	let data;
	for (let i=0; i<3; i++) {
		data=[];
		for (let ii=0; ii<1000; ii++) {
			data.push({index:1000*i+ii,janej:0,num:55,myFormattedData:123456789123,desc:"dummy",foobar1:i+ii,foobar2:i*2+ii*2,
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
	myTablance._sourceData[0].file={lastModified:1669981639918,name:"foo.txt",size:1337,type: "text"};


	const tablanceContainer2=document.getElementById("tablanceContainer2");
	// const myTablance2=new Tablance(document.getElementById("tablanceContainer2"),null,true,true
	// 	,myExpansion,null,true);
	// 	myTablance2.addData(data);
});
