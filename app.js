/* ================= Constants ================= */
const DAYS=["MON","TUE","WED","THU","FRI","SAT"];
const NAMES={MON:"Mon",TUE:"Tue",WED:"Wed",THU:"Thu",FRI:"Fri",SAT:"Sat"};
const DN={MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6};            // matches Date#getDay()
const COLORS=["#cfe0ff","#ffd9c2","#d4f0d0","#f3d1f0","#fff0b8","#c9eef0","#ffd0d6","#e0dcff"];
const TYPES={class:{n:"Class"},work:{n:"Work"},workout:{n:"Workout"},study:{n:"Study"},other:{n:"Other"}};
const TCOL={work:"#ffd8a8",workout:"#b2f2bb",study:"#d0bfff",other:"#dee2e6"};
const PXM=48/60;                                           // px per minute (CSS uses 48px per hour)
const STORE_KEY="sched.v2";
const PARSE_ENDPOINT="/api/parse-schedule";                // your own server, see api/parse-schedule.js

const EXAMPLE=[
{code:"CS 411",name:"CS Thesis 1",instructor:"Melo, Princess Marie B.",slots:[{day:"TUE",start:"10:00",end:"11:30",room:"106"},{day:"THU",start:"08:30",end:"10:00",room:"106"}]},
{code:"CS 412",name:"Fundamentals of Data Science",instructor:"Montalbo, Francis Jesmar P.",slots:[{day:"WED",start:"13:00",end:"16:00",room:"LAB 2"},{day:"FRI",start:"10:00",end:"12:00",room:"401"}]},
{code:"CS 413",name:"Advanced Software Engineering",instructor:"Barican, John Andrei A.",slots:[{day:"MON",start:"10:00",end:"12:00",room:"101"},{day:"TUE",start:"07:00",end:"10:00",room:"LAB 2"}]},
{code:"CS 414",name:"Artificial Intelligence",instructor:"Montalbo, Francis Jesmar P.",slots:[{day:"THU",start:"10:00",end:"13:00",room:"LAB 2"},{day:"FRI",start:"08:00",end:"10:00",room:"401"}]},
{code:"CS 415",name:"Principles of Operating Systems",instructor:"Esguerra, John Richard M",slots:[{day:"WED",start:"10:00",end:"11:30",room:"106"},{day:"FRI",start:"13:00",end:"14:30",room:"401"}]},
{code:"CSE 402",name:"CS Professional Elective 2",instructor:"Bayyou, Demeke G.",slots:[{day:"MON",start:"08:00",end:"10:00",room:"101"},{day:"WED",start:"07:00",end:"10:00",room:"LAB 2"}]}];

/* ================= Helpers ================= */
const $=id=>document.getElementById(id);
const F=id=>$("f_"+id);
const msg=t=>{$("msg").textContent=t};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const z2=n=>String(n).padStart(2,"0");
const mins=t=>{const [h,m]=t.split(":").map(Number);return h*60+(m||0)};
const hm=m=>z2(Math.floor(m/60))+":"+z2(m%60);
const pad=t=>{const [h,m]=String(t).split(":");return z2(h)+":"+z2(m||"00")};
const fmt=m=>{let h=Math.floor(m/60),mm=m%60,s=h>=12?"PM":"AM";h=h%12||12;return h+(mm?":"+z2(mm):"")+" "+s};
const t12=m=>{const h=Math.floor(m/60);return (h%12||12)+":"+z2(m%60)+" "+(h>=12?"PM":"AM")};
const hm6=m=>z2(Math.floor(m/60))+z2(m%60)+"00";
const pd=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const ymd=d=>d.getFullYear()+z2(d.getMonth()+1)+z2(d.getDate());
const snap=m=>Math.round(m/15)*15;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const slugOf=n=>String(n).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"schedule";
const safeUrl=u=>/^https?:\/\//i.test(u)?u:"https://"+u;
const termOk=t=>t.s&&t.e&&t.e>=t.s;
function firstDate(day,from){const d=new Date(from);while(d.getDay()!==DN[day])d.setDate(d.getDate()+1);return d}
function termDates(){
  const a=new Date(),b=new Date(a);b.setMonth(b.getMonth()+4);
  const f=d=>d.getFullYear()+"-"+z2(d.getMonth()+1)+"-"+z2(d.getDate());
  return {s:f(a),e:f(b)};
}

/* ================= State ================= */
let courses=[];            // blocks of the current schedule
let store=null;            // {cur, otherLabel?, list:[{id,name,courses,term?}]}
let view={};               // current grid range {start,end,days}
let bad=new Set();         // "courseIdx:slotIdx" of conflicting blocks
let cur=null;              // block being edited in the dialog
let warnedKey=null;        // overlap warning already shown for this time
let lastType="class";
let drag=null;
let pickSel=new Set();     // schedules ticked in the calendar dialog
let nmMode="new";

/* ================= Platform adapters =================
   The only parts that depend on where the page is hosted. */

// Save a file in the browser. data: string or Blob.
function saveFile(name,data){
  const type=/\.csv$/i.test(name)?"text/csv;charset=utf-8":/\.json$/i.test(name)?"application/json":"";
  const blob=data instanceof Blob?data:new Blob([data],{type});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  msg("Saved "+name+".");
}

// Read a screenshot. Must resolve to an array of courses:
// [{code,name,instructor,slots:[{day:"MON",start:"HH:MM",end:"HH:MM",room}]}]
async function readScheduleImage(blob){
  const res=await fetch(PARSE_ENDPOINT,{method:"POST",headers:{"Content-Type":blob.type||"image/png"},body:blob});
  if(!res.ok)throw new Error("server answered "+res.status);
  const data=await res.json();
  return Array.isArray(data)?data:data.courses||[];
}

/* ================= Block types ================= */
const oLabel=()=>(store&&store.otherLabel)||"Other";
const tName=t=>t==="other"?oLabel():(TYPES[t]||TYPES.class).n;
const col=(c,i)=>(c.type&&c.type!=="class"&&TCOL[c.type])||COLORS[i%COLORS.length];
const detail=c=>[c.instructor,c.link?"Meeting link: "+c.link:"",c.notes].filter(Boolean).join("\n");
const detailHtml=c=>[
  c.instructor?esc(c.instructor):"",
  c.link?`<a href="${esc(safeUrl(c.link))}" target="_blank" rel="noopener">${esc(c.link)}</a>`:"",
  c.notes?esc(c.notes):""].filter(Boolean).join("<br>");

function applyType(){
  const t=F("type").value,cl=t==="class";
  $("l_code").style.display=$("l_inst").style.display=cl?"":"none";
  $("l_notes").style.display=cl?"none":"";
  $("l_ol").style.display=t==="other"?"":"none";
  $("l_name").querySelector("span").textContent=cl?"Course name":"Title";
  $("l_room").querySelector("span").textContent=cl?"Room":"Location / address";
  $("l_room").classList.toggle("w",!cl);
}

/* ================= Conflicts & layout ================= */
function findConflicts(){
  const L=[],out=[];
  courses.forEach((c,ci)=>(c.slots||[]).forEach((s,si)=>L.push({ci,si,s})));
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const a=L[i],b=L[j];
    if(a.s.day===b.s.day&&mins(a.s.start)<mins(b.s.end)&&mins(b.s.start)<mins(a.s.end))out.push([a,b]);
  }
  return out;
}
function conflictsWith(day,st,en,skipCi,skipSi){
  const hits=[];
  courses.forEach((c,ci)=>(c.slots||[]).forEach((o,si)=>{
    if(ci===skipCi&&si===skipSi)return;
    if(o.day===day&&st<mins(o.end)&&mins(o.start)<en)hits.push(c.code||c.name);
  }));
  return [...new Set(hits)];
}
function banner(){
  const cf=findConflicts();bad=new Set();
  cf.forEach(([a,b])=>{bad.add(a.ci+":"+a.si);bad.add(b.ci+":"+b.si)});
  if(!cf.length)return "";
  return `<div class="warn">\u26a0 ${cf.length} scheduling conflict${cf.length>1?"s":""}. Click one to fix it:<br>`
    +cf.map(([a,b])=>`<button class="cfb" data-c="${a.ci}" data-s="${a.si}">${esc(courses[a.ci].code||courses[a.ci].name)} \u2194 ${esc(courses[b.ci].code||courses[b.ci].name)} \u00b7 ${NAMES[a.s.day]||a.s.day} ${fmt(Math.max(mins(a.s.start),mins(b.s.start)))}\u2013${fmt(Math.min(mins(a.s.end),mins(b.s.end)))}</button>`).join("")
    +`</div>`;
}
// Side-by-side lanes so overlapping blocks stay visible. Returns Map(slot -> {l: lane, n: lanes in cluster}).
function lanes(){
  const M=new Map();
  for(const d of DAYS){
    const L=[];
    courses.forEach(c=>(c.slots||[]).forEach(s=>{if(s.day===d)L.push({s,a:mins(s.start),b:mins(s.end)})}));
    L.sort((x,y)=>x.a-y.a);
    let cl=[],end=-1;
    const flush=()=>{const n=Math.max(...cl.map(x=>x.l))+1;cl.forEach(x=>M.set(x.s,{l:x.l,n}))};
    for(const e of L){
      if(cl.length&&e.a>=end){flush();cl=[];end=-1}
      const used=new Set(cl.filter(x=>x.b>e.a).map(x=>x.l));
      let l=0;while(used.has(l))l++;
      cl.push({...e,l});end=Math.max(end,e.b);
    }
    if(cl.length)flush();
  }
  return M;
}

/* ================= Storage & schedules ================= */
function loadStore(){
  try{
    const v=JSON.parse(localStorage.getItem(STORE_KEY));
    if(v&&Array.isArray(v.list)&&v.list.length&&v.list.some(x=>x.id===v.cur))return v;
  }catch(e){}
  return {cur:"a",list:[{id:"a",name:"My schedule",courses:[]}]};
}
function persist(){
  if(!store)return;
  const e=store.list.find(x=>x.id===store.cur);
  if(e)e.courses=courses;
  try{localStorage.setItem(STORE_KEY,JSON.stringify(store))}catch(_){}
}
const curName=()=>{const e=store&&store.list.find(x=>x.id===store.cur);return e?e.name:"Schedule"};
const slug=()=>slugOf(curName());
function fillSel(){
  $("sch").innerHTML=store.list.map(x=>`<option value="${x.id}"${x.id===store.cur?" selected":""}>${esc(x.name)}</option>`).join("");
  $("ptitle").textContent=curName();
}
function useSched(id){
  persist();store.cur=id;
  courses=store.list.find(x=>x.id===id).courses||[];
  fillSel();$("thumb").style.display="none";render();persist();
}
function getTerm(x){if(!x.term||!x.term.s||!x.term.e)x.term=termDates();return x.term}
const term=()=>getTerm(store.list.find(x=>x.id===store.cur));

/* ================= Rendering ================= */
function render(c){
  if(c)courses=c;
  persist();
  const all=courses.flatMap(c=>c.slots||[]).filter(s=>DAYS.includes(s.day));
  if(!all.length){
    msg(courses.length?"No class times found.":"No blocks yet. Add one or upload a screenshot.");
    $("out").innerHTML="";return;
  }
  const start=Math.floor(Math.min(...all.map(s=>mins(s.start)))/60)*60,
        end=Math.ceil(Math.max(...all.map(s=>mins(s.end)))/60)*60,
        days=DAYS.filter(d=>d!=="SAT"||all.some(s=>s.day==="SAT"));
  view={start,end,days};
  const LM=lanes();
  let h=banner()+`<div class="wrap"><div class="grid" style="--n:${days.length}"><div class="hd"></div>`
    +days.map(d=>`<div class="hd">${NAMES[d]}</div>`).join("");
  h+=`<div class="times">`+Array.from({length:(end-start)/60},(_,i)=>`<div>${fmt(start+i*60)}</div>`).join("")+`</div>`;
  for(const d of days){
    h+=`<div class="col" style="height:${(end-start)*PXM}px">`;
    courses.forEach((c,i)=>(c.slots||[]).forEach((s,si)=>{
      if(s.day!==d)return;
      const LN=LM.get(s)||{l:0,n:1},top=(mins(s.start)-start)*PXM,ht=(mins(s.end)-mins(s.start))*PXM-2;
      h+=`<div class="blk${bad.has(i+":"+si)?" bad":""}" data-c="${i}" data-s="${si}" title="Drag to move, click to edit" style="left:calc(${LN.l/LN.n*100}% + 3px);width:calc(${100/LN.n}% - 6px);right:auto;top:${top}px;height:${ht}px;background:${col(c,i)}"><b>${esc(c.code||c.name)}</b>${esc(c.code?c.name:tName(c.type))}<br>${fmt(mins(s.start))}\u2013${fmt(mins(s.end))}${s.room?" \u00b7 "+esc(s.room):""}${c.link?` <a href="${esc(safeUrl(c.link))}" target="_blank" rel="noopener" title="Open meeting link">\ud83d\udd17</a>`:""}<div class="rz"></div></div>`;
    }));
    h+=`</div>`;
  }
  h+=`</div></div><table><tr><th>Type</th><th>Title</th><th>Details</th></tr>`
    +courses.map(c=>`<tr><td>${esc(tName(c.type))}</td><td>${esc(c.code?c.code+" - "+c.name:c.name)}</td><td>${detailHtml(c)}</td></tr>`).join("")
    +`</table>`;
  $("out").innerHTML=h;
  msg(`${courses.length} item(s). Drag a block to move it (drag its bottom edge to resize), or click it to edit.`);
}

/* ================= Screenshot import ================= */
async function parse(blob){
  $("thumb").src=URL.createObjectURL(blob);$("thumb").style.display="inline-block";
  msg("Reading your screenshot\u2026");
  try{render(await readScheduleImage(blob))}
  catch(e){msg("Screenshot reading isn't set up on this site ("+(e&&e.message||e)+"). You can still use Load example or + Add block.")}
}

/* ================= Block dialog ================= */
const dlg=$("dlg");
function openDlg(ci,si){
  cur=ci==null?null:{ci,si};
  const c=cur?courses[ci]:{},s=cur?c.slots[si]:{day:"MON",start:"08:00",end:"09:30",room:""};
  $("dtitle").textContent=cur?"Edit block":"Add block";
  $("del").style.display=cur?"":"none";
  F("code").value=c.code||"";F("name").value=c.name||"";F("inst").value=c.instructor||"";
  F("day").value=s.day;F("start").value=pad(s.start);F("end").value=pad(s.end);F("room").value=s.room||"";
  $("note").style.display=cur&&c.slots.length>1?"":"none";
  $("derr").textContent="";warnedKey=null;$("save").textContent="Save";
  F("type").innerHTML=Object.keys(TYPES).map(k=>`<option value="${k}">${esc(tName(k))}</option>`).join("");
  F("type").value=c.type||(cur?"class":lastType);
  F("link").value=c.link||"";F("notes").value=c.notes||"";F("ol").value=oLabel();
  applyType();dlg.showModal();
}
function saveBlock(){
  const ty=F("type").value,code=ty==="class"?F("code").value.trim():"",name=F("name").value.trim(),
        start=F("start").value,end=F("end").value;
  if(!code&&!name){$("derr").textContent="Enter a course code or name.";return}
  if(!start||!end||mins(end)<=mins(start)){$("derr").textContent="End time must be after start time.";return}
  const hits=conflictsWith(F("day").value,mins(start),mins(end),cur?cur.ci:-1,cur?cur.si:-1),
        key=[F("day").value,start,end].join();
  if(hits.length&&warnedKey!==key){
    warnedKey=key;
    $("derr").textContent="\u26a0 This overlaps with "+hits.join(", ")+". Press Save anyway to keep it, or change the time.";
    $("save").textContent="Save anyway";return;
  }
  const slot={day:F("day").value,start,end,room:F("room").value.trim()},
        info={type:ty,code,name,instructor:ty==="class"?F("inst").value.trim():"",link:F("link").value.trim(),notes:ty==="class"?"":F("notes").value.trim()};
  lastType=ty;
  if(ty==="other"&&store)store.otherLabel=F("ol").value.trim()||"Other";
  if(cur){Object.assign(courses[cur.ci],info);courses[cur.ci].slots[cur.si]=slot}
  else{
    const kf=c=>(c.type||"class")===ty&&(ty==="class"?c.code:c.name),kv=ty==="class"?code:name;
    const ex=kv?courses.find(c=>kf(c)&&String(kf(c)).toLowerCase()===kv.toLowerCase()):null;
    if(ex){ex.link=info.link||ex.link;ex.notes=info.notes||ex.notes;ex.name=name||ex.name;ex.instructor=info.instructor||ex.instructor;ex.slots.push(slot)}
    else courses.push({...info,slots:[slot]});
  }
  dlg.close();render();
}
function deleteBlock(){
  const c=courses[cur.ci];c.slots.splice(cur.si,1);
  if(!c.slots.length)courses.splice(cur.ci,1);
  dlg.close();render();
}

/* ================= Drag to move / resize ================= */
const cols=()=>[...$("out").querySelectorAll(".col")];
function dayAt(x){
  const r=cols().map(c=>c.getBoundingClientRect());
  let i=r.findIndex(b=>x>=b.left&&x<b.right);
  if(i<0)i=x<r[0].left?0:r.length-1;
  return {i,day:view.days[i],left:r[i].left};
}
function liveCheck(day,st,en){
  const hits=conflictsWith(day,st,en,drag.ci,drag.si);
  drag.b.classList.toggle("bad",hits.length>0);
  msg(`${NAMES[day]} ${fmt(st)}\u2013${fmt(en)}`+(hits.length?` \u26a0 conflicts with ${hits.join(", ")}`:""));
}
function onPointerDown(e){
  const b=e.target.closest(".blk");if(!b||e.button>0||e.target.closest("a"))return;
  drag={b,ci:+b.dataset.c,si:+b.dataset.s,x0:e.clientX,y0:e.clientY,rs:e.target.classList.contains("rz"),moved:false,res:null};
  try{b.setPointerCapture(e.pointerId)}catch(_){}
}
function onPointerMove(e){
  if(!drag)return;
  const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
  if(!drag.moved&&Math.hypot(dx,dy)<5)return;
  drag.moved=true;drag.b.classList.add("drg");
  const s=courses[drag.ci].slots[drag.si],a=mins(s.start),z=mins(s.end),dm=snap(dy/PXM);
  if(drag.rs){
    const ne=clamp(z+dm,a+15,view.end);
    drag.res={start:a,end:ne};
    drag.b.style.height=((ne-a)*PXM-2)+"px";
    liveCheck(s.day,a,ne);
  }else{
    const st=clamp(a+dm,view.start,view.end-(z-a)),t=dayAt(e.clientX);
    drag.res={start:st,end:st+(z-a),day:t.day};
    const homeLeft=cols()[Math.max(0,view.days.indexOf(s.day))].getBoundingClientRect().left;
    drag.b.style.transform=`translate(${t.left-homeLeft}px,${(st-a)*PXM}px)`;
    liveCheck(t.day,st,st+(z-a));
  }
}
function endDrag(e){
  if(!drag)return;
  const d=drag;drag=null;
  if(!d.moved){if(e.type==="pointerup")openDlg(d.ci,d.si);return}
  if(e.type==="pointercancel"||!d.res){render();return}
  const s=courses[d.ci].slots[d.si];
  s.start=hm(d.res.start);s.end=hm(d.res.end);if(d.res.day)s.day=d.res.day;
  render();
}

/* ================= Export: image ================= */
function wrapText(g,t,mw){
  const out=[];let line="";
  for(const w of t.split(" ")){
    const n=line?line+" "+w:w;
    if(g.measureText(n).width>mw&&line){out.push(line);line=w}else line=n;
  }
  if(line)out.push(line);return out;
}
function drawPNG(){
  const items=[];
  courses.forEach((c,i)=>(c.slots||[]).forEach(s=>{if(DAYS.includes(s.day))items.push({c,i,s})}));
  if(!items.length)return Promise.resolve(null);
  const start=Math.floor(Math.min(...items.map(x=>mins(x.s.start)))/60)*60,
        end=Math.ceil(Math.max(...items.map(x=>mins(x.s.end)))/60)*60,
        days=DAYS.filter(d=>d!=="SAT"||items.some(x=>x.s.day==="SAT"));
  const badSlots=new Set(),LM=lanes();
  findConflicts().forEach(([a,b])=>{badSlots.add(a.s);badSlots.add(b.s)});
  const L=70,CW=170,T=60,HH=36,PH=1.1,W=L+CW*days.length+20,Ht=T+HH+(end-start)*PH+20,K=2,FF="system-ui,Segoe UI,sans-serif";
  const cv=document.createElement("canvas");cv.width=W*K;cv.height=Ht*K;
  const g=cv.getContext("2d");g.scale(K,K);
  g.fillStyle="#fff";g.fillRect(0,0,W,Ht);
  g.fillStyle="#1f2430";g.textAlign="left";g.font="bold 22px "+FF;g.fillText(curName(),20,38);
  g.textAlign="center";g.font="600 14px "+FF;
  days.forEach((d,i)=>g.fillText(NAMES[d],L+CW*i+CW/2,T+HH-12));
  g.strokeStyle="#e3e1d9";g.lineWidth=1;
  for(let i=0;i<=days.length;i++){g.beginPath();g.moveTo(L+CW*i,T+HH);g.lineTo(L+CW*i,Ht-20);g.stroke()}
  g.textAlign="right";g.font="12px "+FF;g.fillStyle="#6b7080";
  for(let m=start;m<=end;m+=60){
    const y=T+HH+(m-start)*PH;
    g.fillText(fmt(m),L-8,y+4);g.beginPath();g.moveTo(L,y);g.lineTo(W-20,y);g.stroke();
  }
  items.forEach(({c,i,s})=>{
    const LN=LM.get(s)||{l:0,n:1},
          x=L+CW*days.indexOf(s.day)+4+LN.l*(CW-8)/LN.n,
          y=T+HH+(mins(s.start)-start)*PH+1,
          w=(CW-8)/LN.n-(LN.n>1?2:0),
          h=(mins(s.end)-mins(s.start))*PH-2;
    g.fillStyle=col(c,i);g.fillRect(x,y,w,h);
    g.fillStyle="rgba(0,0,0,.35)";g.fillRect(x,y,4,h);
    if(badSlots.has(s)){g.strokeStyle="#e03131";g.lineWidth=2;g.strokeRect(x+1,y+1,w-2,h-2);g.lineWidth=1}
    g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
    g.textAlign="left";g.fillStyle="#1f2430";let ty=y+17;
    g.font="bold 13px "+FF;g.fillText(c.code||c.name||"",x+10,ty);
    g.font="12px "+FF;
    wrapText(g,c.code?c.name||"":tName(c.type),w-16)
      .concat([fmt(mins(s.start))+"\u2013"+fmt(mins(s.end))+(s.room?" \u00b7 "+s.room:"")])
      .forEach(l=>{ty+=15;g.fillText(l,x+10,ty)});
    g.restore();
  });
  return new Promise(r=>cv.toBlob(r,"image/png"));
}

/* ================= Export: JSON ================= */
function exportJson(){
  if(!courses.length){msg("Nothing to export yet.");return}
  saveFile(slug()+".json",JSON.stringify({app:"schedule-maker",version:2,name:curName(),term:term(),otherLabel:oLabel(),courses},null,2));
}
async function importJson(e){
  const f=e.target.files[0];e.target.value="";if(!f)return;
  try{
    const d=JSON.parse(await f.text());
    const list=Array.isArray(d)?d:d&&d.courses;
    if(!Array.isArray(list)||!list.every(c=>c&&Array.isArray(c.slots)))throw 0;
    const meta=Array.isArray(d)?{}:d,id=Date.now().toString(36),
          ent={id,name:String(meta.name||f.name.replace(/\.json$/i,"")||"Imported schedule").slice(0,60),courses:list};
    if(meta.term&&meta.term.s&&meta.term.e)ent.term={s:String(meta.term.s),e:String(meta.term.e)};
    if(meta.otherLabel&&meta.otherLabel!=="Other")store.otherLabel=String(meta.otherLabel).slice(0,24);
    persist();store.list.push(ent);
    useSched(id);
    msg("Imported \u201c"+ent.name+"\u201d as a new schedule ("+list.length+" item(s))"+(ent.term?" with its term dates.":"."));
  }catch(err){msg("That file isn't a schedule exported from this page.")}
}

/* ================= Export: calendar ================= */
function gcal(c,s,t){
  const d=firstDate(s.day,pd(t.s)),e=pd(t.e);
  const until=new Date(e.getFullYear(),e.getMonth(),e.getDate(),23,59,59).toISOString().replace(/[-:]|\.\d{3}/g,"");
  const q=new URLSearchParams({
    action:"TEMPLATE",text:(c.code?c.code+" - ":"")+(c.name||""),
    dates:ymd(d)+"T"+hm6(mins(s.start))+"/"+ymd(d)+"T"+hm6(mins(s.end)),
    ctz:Intl.DateTimeFormat().resolvedOptions().timeZone,
    recur:"RRULE:FREQ=WEEKLY;UNTIL="+until,details:detail(c),location:s.room||""});
  return "https://calendar.google.com/calendar/render?"+q;
}
function calLinks(){
  const t=term();
  if(!termOk(t)){$("calLinks").textContent="Set a valid term start and end for this schedule above.";return}
  let h="";
  courses.forEach(c=>(c.slots||[]).forEach(s=>{
    if(DN[s.day])h+=`<a target="_blank" rel="noopener" href="${esc(gcal(c,s,t))}">${esc(c.code||c.name)} \u00b7 ${NAMES[s.day]} ${t12(mins(s.start))}</a>`;
  }));
  $("calLinks").innerHTML=h||"No blocks to add yet.";
}
function csvFor(cs,t){
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"',end=pd(t.e);
  const rows=["Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private"];
  cs.forEach(c=>(c.slots||[]).forEach(s=>{
    if(!DN[s.day])return;
    for(let d=firstDate(s.day,pd(t.s));d<=end;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7)){
      const ds=z2(d.getMonth()+1)+"/"+z2(d.getDate())+"/"+d.getFullYear();
      rows.push([(c.code?c.code+" - ":"")+(c.name||""),ds,t12(mins(s.start)),ds,t12(mins(s.end)),"False",detail(c),s.room||"","False"].map(q).join(","));
    }
  }));
  return rows.length>1?rows.join("\r\n"):null;
}
function fillPick(){
  $("cerr").textContent="";
  $("schPick").innerHTML=store.list.map(x=>{
    const n=(x.courses||[]).reduce((a,c)=>a+(c.slots||[]).length,0),t=getTerm(x);
    return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-id="${x.id}"${pickSel.has(x.id)?" checked":""}> ${esc(x.name)} <span style="color:var(--mut)">(${n} blocks)</span></label><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0 0 26px;font-size:12px;color:var(--mut)">Term <input type="date" data-id="${x.id}" data-k="s" value="${esc(t.s)}"> to <input type="date" data-id="${x.id}" data-k="e" value="${esc(t.e)}"></div></div>`;
  }).join("");
  $("ccsv").textContent=pickSel.size>1?"Download ZIP":"Download CSV";
}
async function downloadCalendar(){
  const sel=store.list.filter(x=>pickSel.has(x.id));
  if(!sel.length){$("cerr").textContent="Tick at least one schedule to export.";return}
  const badTerm=sel.filter(x=>!termOk(getTerm(x)));
  if(badTerm.length){$("cerr").textContent="Set a valid term start and end (end on or after start) for: "+badTerm.map(x=>x.name).join(", ");return}
  const files=sel.map(x=>({name:slugOf(x.name)+"-calendar.csv",csv:csvFor(x.courses||[],getTerm(x))})).filter(f=>f.csv);
  if(!files.length){$("cerr").textContent="The selected schedules have no blocks to export yet.";return}
  $("cal").close();
  if(files.length===1){saveFile(files[0].name,files[0].csv);return}
  if(typeof JSZip==="undefined"){msg("ZIP export isn't available. Export one schedule at a time.");return}
  const z=new JSZip(),used=new Set();
  files.forEach(f=>{
    let n=f.name,k=2;
    while(used.has(n))n=f.name.replace(".csv","-"+(k++)+".csv");
    used.add(n);z.file(n,f.csv);
  });
  saveFile("schedules-calendar.zip",await z.generateAsync({type:"blob"}));
}

/* ================= Schedule management ================= */
function askName(m){
  nmMode=m;
  $("nmt").textContent=m==="new"?"New schedule":"Rename schedule";
  $("nmv").value=m==="new"?"":curName();
  $("nm").showModal();$("nmv").focus();
}
function nmSave(){
  const n=$("nmv").value.trim();if(!n)return;
  if(nmMode==="new"){
    persist();const id=Date.now().toString(36);
    store.list.push({id,name:n,courses:[]});$("nm").close();useSched(id);
  }else{
    store.list.find(x=>x.id===store.cur).name=n;persist();fillSel();$("nm").close();
  }
}

const normCode=s=>String(s||"").toLowerCase().replace(/\s+/g,"");
function applyLinks(text){
  const ok=[],miss=[];
  text.split(/\r?\n/).forEach(line=>{
    const m=line.match(/^\s*(.+?)\s*[:\-\u2013]\s*(https?:\/\/\S+)\s*$/i);
    if(!m)return;
    const c=courses.find(x=>(x.type||"class")==="class"&&normCode(x.code)===normCode(m[1]));
    if(c){c.link=m[2];ok.push(c.code)}else miss.push(m[1].trim());
  });
  return {ok,miss};
}

/* ================= Wiring ================= */
let clrT,sdT;

// screenshot input
$("pick").onclick=e=>{e.stopPropagation();$("file").click()};
$("file").onchange=e=>e.target.files[0]&&parse(e.target.files[0]);
$("demo").onclick=e=>{e.stopPropagation();render(structuredClone(EXAMPLE))};
const dz=$("drop");
dz.ondragover=e=>{e.preventDefault();dz.classList.add("on")};
dz.ondragleave=()=>dz.classList.remove("on");
dz.ondrop=e=>{e.preventDefault();dz.classList.remove("on");const f=e.dataTransfer.files[0];f&&f.type.startsWith("image/")&&parse(f)};
addEventListener("paste",e=>{const it=[...e.clipboardData.items].find(i=>i.type.startsWith("image/"));it&&parse(it.getAsFile())});

// timetable interactions
$("out").addEventListener("pointerdown",onPointerDown);
$("out").addEventListener("pointermove",onPointerMove);
$("out").addEventListener("pointerup",endDrag);
$("out").addEventListener("pointercancel",endDrag);
$("out").addEventListener("click",e=>{const b=e.target.closest(".cfb");if(b)openDlg(+b.dataset.c,+b.dataset.s)});

// block dialog
$("add").onclick=()=>openDlg();
F("type").onchange=applyType;
$("cancel").onclick=()=>dlg.close();
$("save").onclick=saveBlock;
$("del").onclick=deleteBlock;

// schedules
$("sch").onchange=e=>useSched(e.target.value);
$("snew").onclick=()=>askName("new");
$("sren").onclick=()=>askName("ren");
$("nmc").onclick=()=>$("nm").close();
$("nms").onclick=nmSave;
$("nmv").onkeydown=e=>{if(e.key==="Enter")nmSave()};
$("sdel").onclick=()=>{
  if(store.list.length<2){msg("Keep at least one schedule. Use Clear to empty it.");return}
  if($("sdel").textContent==="Delete"){
    $("sdel").textContent="Really delete?";sdT=setTimeout(()=>$("sdel").textContent="Delete",3000);return;
  }
  clearTimeout(sdT);$("sdel").textContent="Delete";
  const i=store.list.findIndex(x=>x.id===store.cur);store.list.splice(i,1);
  const nx=store.list[Math.min(i,store.list.length-1)];
  store.cur=nx.id;courses=nx.courses||[];fillSel();$("thumb").style.display="none";render();persist();
};
$("clr").onclick=()=>{
  if($("clr").textContent==="Clear"){
    $("clr").textContent="Really clear?";clrT=setTimeout(()=>$("clr").textContent="Clear",3000);return;
  }
  clearTimeout(clrT);$("clr").textContent="Clear";$("thumb").style.display="none";render([]);
};

// exports
$("xpng").onclick=async()=>{const b=await drawPNG();if(!b){msg("Nothing to export yet.");return}saveFile(slug()+".png",b)};
$("xjson").onclick=exportJson;
$("ijson").onclick=()=>$("jfile").click();
$("jfile").onchange=importJson;
$("xprint").onclick=()=>{try{window.print()}catch(e){}};

// calendar dialog
$("xcal").onclick=()=>{persist();pickSel=new Set([store.cur]);fillPick();calLinks();$("cal").showModal()};
$("cclose").onclick=()=>$("cal").close();
$("ccsv").onclick=downloadCalendar;
$("schPick").onchange=e=>{
  const el=e.target,id=el.dataset.id;if(!id)return;
  if(el.type==="date"){
    const x=store.list.find(y=>y.id===id);
    x.term=Object.assign({},getTerm(x),{[el.dataset.k]:el.value});
    persist();$("cerr").textContent="";if(id===store.cur)calLinks();return;
  }
  if(el.checked)pickSel.add(id);else pickSel.delete(id);
  fillPick();
};

$("xlinks").onclick=()=>{$("lkv").value="";$("lkr").textContent="";$("lk").showModal()};
$("lkc").onclick=()=>$("lk").close();
$("lks").onclick=()=>{
  const {ok,miss}=applyLinks($("lkv").value);
  if(ok.length)render();
  $("lkr").textContent=(ok.length?"Added links to: "+ok.join(", ")+". ":"No links were added. ")
    +(miss.length?"No matching class for: "+miss.join(", ")+".":"");
};

/* ================= Init ================= */
store=loadStore();
courses=store.list.find(x=>x.id===store.cur).courses||[];
fillSel();
if(courses.length){render();msg("Restored \u201c"+curName()+"\u201d.")}