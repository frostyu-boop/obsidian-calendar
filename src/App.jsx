import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const CATS = {
  Work:        { color: "#4F8EF7", dim: "rgba(79,142,247,0.13)" },
  Personal:    { color: "#B57BF7", dim: "rgba(181,123,247,0.13)" },
  "Gym/Sport": { color: "#3DBA7E", dim: "rgba(61,186,126,0.13)" },
  Social:      { color: "#F7A45A", dim: "rgba(247,164,90,0.13)" },
  Travel:      { color: "#4DBCD4", dim: "rgba(77,188,212,0.13)" },
  Other:       { color: "#8B8B8B", dim: "rgba(139,139,139,0.13)" },
};

const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOWS      = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const DOWS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const REPEAT_OPTS = [
  { v:"none",l:"Never" },{ v:"daily",l:"Daily" },{ v:"weekly",l:"Weekly" },
  { v:"monthly",l:"Monthly" },{ v:"yearly",l:"Yearly" },
];
const NOTIF_OPTS = [
  { v:-1,l:"None" },{ v:0,l:"At event time" },{ v:5,l:"5 min before" },
  { v:15,l:"15 min before" },{ v:30,l:"30 min before" },
  { v:60,l:"1 hour before" },{ v:1440,l:"1 day before" },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const pad       = n => String(n).padStart(2,"0");
const genId     = () => `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const todayStr  = () => fmtDate(new Date());
const fmtDate   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const sameDay   = (a,b) => a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const isToday   = d => sameDay(d,new Date());
const fmtTime   = t => { if(!t)return""; const [h,m]=t.split(":").map(Number); return `${h%12||12}:${pad(m)} ${h>=12?"PM":"AM"}`; };
const dispDate  = s => { const d=parseDate(s); return `${MONTHS_S[d.getMonth()]} ${d.getDate()}`; };

const expandEvents = (events,from,to) => {
  const fromS=fmtDate(from),toS=fmtDate(to),result=[];
  for (const evt of events) {
    if (!evt.repeat||evt.repeat==="none") {
      if (evt.endDate>=fromS&&evt.startDate<=toS) result.push(evt);
      continue;
    }
    let cur=parseDate(evt.startDate),itr=0;
    while (fmtDate(cur)<=toS&&itr<500) {
      const cs=fmtDate(cur);
      if (cs>=fromS) result.push({...evt,startDate:cs,endDate:cs,_rec:true,id:`${evt.id}_${cs}`,_pid:evt.id});
      switch(evt.repeat){
        case"daily":  cur.setDate(cur.getDate()+1);break;
        case"weekly": cur.setDate(cur.getDate()+7);break;
        case"monthly":cur.setMonth(cur.getMonth()+1);break;
        case"yearly": cur.setFullYear(cur.getFullYear()+1);break;
        default:itr=999;
      }
      itr++;
    }
  }
  return result;
};

// ─────────────────────────────────────────────
// UID  (user's unique cloud key)
// ─────────────────────────────────────────────
const UID_KEY = "obsidian_uid";
const genUID  = () => "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, c => {
  const r=Math.random()*16|0; return (c==="x"?r:(r&0x3|0x8)).toString(16);
});
const getUID = () => {
  let u = localStorage.getItem(UID_KEY);
  if (!u) { u=genUID(); localStorage.setItem(UID_KEY,u); }
  return u;
};

// ─────────────────────────────────────────────
// STORAGE  (localStorage = offline cache)
// ─────────────────────────────────────────────
const SK = "obsidian_cal_v2";
const loadLocal  = () => { try { const d=localStorage.getItem(SK); return d?JSON.parse(d):[]; } catch{return[];} };
const saveLocal  = e  => { try { localStorage.setItem(SK,JSON.stringify(e)); } catch{} };
const saveWorkoutData = events => {
  try {
    localStorage.setItem("workout_calendar_data_v1", JSON.stringify({
      gymEvents: events.filter(e=>e.category==="Gym/Sport"),
      lastUpdated: new Date().toISOString(),
      weeklyTarget: { sessionsPerWeek:3, durationMinutes:45 },
    }));
  } catch {}
};

// ─────────────────────────────────────────────
// API  (Vercel KV via serverless function)
// ─────────────────────────────────────────────
const apiFetch = async uid => {
  const r = await fetch(`/api/events?uid=${uid}`);
  if (!r.ok) throw new Error(await r.text());
  const d = await r.json();
  return d.events || [];
};
const apiPush = async (uid,events) => {
  const r = await fetch(`/api/events?uid=${uid}`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({events}),
  });
  if (!r.ok) throw new Error(await r.text());
};

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
const reqNotif = () => { if("Notification"in window&&Notification.permission==="default") Notification.requestPermission(); };
const fireNotif = evt => { if("Notification"in window&&Notification.permission==="granted") new Notification(`📅 ${evt.title}`,{body:evt.allDay?"All day":`At ${fmtTime(evt.startTime)}`}); };

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;background:#080808;}
::-webkit-scrollbar{width:0;height:0;}
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer;}
input[type="date"],input[type="time"]{color-scheme:dark;}
select option{background:#181818;color:#F0F0F0;}
textarea{resize:none;}
@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.sheet{animation:slideUp 0.28s cubic-bezier(0.32,0.72,0,1);}
.fade{animation:fadeIn 0.2s ease;}
.tap:active{opacity:0.55;transform:scale(0.95);}
.day-cell:active{background:rgba(124,106,247,0.1)!important;}
.spin{animation:spin 1s linear infinite;}
`;

// ─────────────────────────────────────────────
// STYLE FRAGMENTS
// ─────────────────────────────────────────────
const S = {
  label: {color:"#484848",fontSize:10,letterSpacing:0.8,textTransform:"uppercase",fontFamily:"Syne,sans-serif",fontWeight:700,marginBottom:6},
  input: {background:"#181818",border:"1px solid #242424",borderRadius:12,padding:"11px 14px",color:"#E8E8E8",fontSize:14,fontFamily:"DM Sans,sans-serif",outline:"none",width:"100%"},
  tag:   cat=>({fontSize:10,padding:"2px 9px",borderRadius:10,fontWeight:700,background:CATS[cat]?.dim||CATS.Other.dim,color:CATS[cat]?.color||CATS.Other.color,fontFamily:"Syne,sans-serif",letterSpacing:0.3,flexShrink:0}),
};

// ─────────────────────────────────────────────
// TOGGLE
// ─────────────────────────────────────────────
function Toggle({on,onChange}){
  return(
    <div onClick={()=>onChange(!on)} style={{width:46,height:27,borderRadius:14,cursor:"pointer",background:on?"#7C6AF7":"#282828",transition:"background 0.22s",position:"relative",flexShrink:0}}>
      <div style={{width:23,height:23,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?21:2,transition:"left 0.22s cubic-bezier(0.4,0,0.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.5)"}}/>
    </div>
  );
}

// ─────────────────────────────────────────────
// SYNC DOT
// ─────────────────────────────────────────────
function SyncDot({status}){
  const colors={synced:"#3DBA7E",syncing:"#F7A45A",error:"#FF6060",idle:"#2A2A2A"};
  return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:colors[status]||colors.idle,transition:"background 0.4s"}}/>
      <span style={{fontSize:9,color:colors[status]||colors.idle,fontFamily:"Syne,sans-serif",fontWeight:700,letterSpacing:0.5,textTransform:"uppercase"}}>
        {status==="syncing"?"SYNC…":status==="synced"?"SAVED":status==="error"?"OFFLINE":""}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// MONTH VIEW
// ─────────────────────────────────────────────
function MonthView({date,events,onDayClick}){
  const yr=date.getFullYear(),mo=date.getMonth();
  const firstDow=new Date(yr,mo,1).getDay();
  const dim=new Date(yr,mo+1,0).getDate();
  const expanded=useMemo(()=>expandEvents(events,new Date(yr,mo,1),new Date(yr,mo+1,0)),[events,yr,mo]);

  const getEvts=day=>{
    const ds=`${yr}-${pad(mo+1)}-${pad(day)}`;
    return expanded.filter(e=>e.startDate<=ds&&e.endDate>=ds).slice(0,4);
  };

  const cells=[...Array(firstDow).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);

  return(
    <div style={{padding:"0 10px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:10,color:"#383838",fontFamily:"Syne,sans-serif",fontWeight:700,letterSpacing:0.8,padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px"}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={i}/>;
          const d=new Date(yr,mo,day),tod=isToday(d),evts=getEvts(day);
          return(
            <div key={i} className="day-cell" onClick={()=>onDayClick(d)} style={{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 2px 3px",borderRadius:11,cursor:"pointer",transition:"background 0.13s",background:tod?"#7C6AF7":"transparent"}}>
              <span style={{fontSize:13,lineHeight:1.45,fontWeight:tod?800:400,color:tod?"#fff":"#C8C8C8",fontFamily:tod?"Syne,sans-serif":"DM Sans,sans-serif"}}>{day}</span>
              <div style={{display:"flex",gap:2,marginTop:3}}>
                {evts.slice(0,3).map((e,ei)=>(<div key={ei} style={{width:4,height:4,borderRadius:"50%",background:CATS[e.category]?.color||"#555"}}/>))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WEEK VIEW
// ─────────────────────────────────────────────
function WeekView({date,events,onEventClick,onSlotClick}){
  const scrollRef=useRef(null);
  const HH=54;
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=7*HH;},[]);

  const wkS=new Date(date); wkS.setDate(date.getDate()-date.getDay());
  const wkE=new Date(wkS); wkE.setDate(wkS.getDate()+6);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(wkS);d.setDate(wkS.getDate()+i);return d;});
  const expanded=useMemo(()=>expandEvents(events,wkS,wkE),[events,wkS.toDateString()]);

  const tEvts=d=>{const ds=fmtDate(d);return expanded.filter(e=>e.startDate<=ds&&e.endDate>=ds&&!e.allDay&&e.startTime);};
  const adEvts=d=>{const ds=fmtDate(d);return expanded.filter(e=>e.startDate<=ds&&e.endDate>=ds&&e.allDay);};
  const eStyle=evt=>{
    const[sh,sm]=(evt.startTime||"00:00").split(":").map(Number);
    const[eh,em]=(evt.endTime||`${sh+1}:00`).split(":").map(Number);
    return{top:(sh*60+sm)*(HH/60),height:Math.max(((eh*60+em)-(sh*60+sm))*(HH/60),20)};
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <div style={{display:"flex",paddingLeft:30,borderBottom:"1px solid #181818",flexShrink:0}}>
        {days.map((d,di)=>{
          const tod=isToday(d),ade=adEvts(d);
          return(
            <div key={di} style={{flex:1,padding:"4px 1px"}}>
              <div style={{fontSize:9,textAlign:"center",color:tod?"#7C6AF7":"#444",fontFamily:"Syne,sans-serif",fontWeight:700,letterSpacing:0.5}}>{DOWS[di].slice(0,2)}</div>
              <div style={{fontSize:14,textAlign:"center",fontWeight:tod?800:400,color:tod?"#fff":"#888",background:tod?"#7C6AF7":"transparent",borderRadius:20,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"2px auto",fontFamily:"Syne,sans-serif"}}>{d.getDate()}</div>
              {ade.map((e,ei)=>(<div key={ei} onClick={()=>onEventClick(e)} style={{fontSize:8,padding:"1px 3px",borderRadius:3,marginTop:1,background:CATS[e.category]?.color+"30",color:CATS[e.category]?.color,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",cursor:"pointer",fontWeight:700}}>{e.title}</div>))}
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",display:"flex"}}>
        <div style={{width:30,flexShrink:0}}>
          {Array.from({length:24},(_,h)=>(
            <div key={h} style={{height:HH,position:"relative"}}>
              <span style={{fontSize:8,color:"#383838",position:"absolute",top:-7,right:4,fontFamily:"Syne,sans-serif",fontWeight:600}}>
                {h===0?"":h<12?`${h}A`:h===12?"12P":`${h-12}P`}
              </span>
            </div>
          ))}
        </div>
        <div style={{flex:1,display:"flex"}}>
          {days.map((day,di)=>{
            const de=tEvts(day);
            return(
              <div key={di} style={{flex:1,position:"relative",borderLeft:"1px solid #141414",cursor:"pointer"}}
                onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();const y=e.clientY-rect.top+scrollRef.current.scrollTop;onSlotClick(day,Math.floor(y/HH));}}>
                {Array.from({length:24},(_,h)=>(<div key={h} style={{height:HH,borderBottom:"1px solid #0F0F0F"}}/>))}
                {de.map(evt=>{
                  const{top,height}=eStyle(evt);
                  return(
                    <div key={evt.id} onClick={e=>{e.stopPropagation();onEventClick(evt);}} style={{position:"absolute",top,left:2,right:2,height,background:CATS[evt.category]?.dim,borderLeft:`2px solid ${CATS[evt.category]?.color}`,borderRadius:"0 4px 4px 0",padding:"2px 4px",overflow:"hidden",cursor:"pointer",zIndex:1}}>
                      <div style={{fontSize:9,fontWeight:700,color:CATS[evt.category]?.color,lineHeight:1.3,fontFamily:"Syne,sans-serif"}}>{evt.title}</div>
                      {height>30&&<div style={{fontSize:8,color:"#555"}}>{fmtTime(evt.startTime)}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EVENT MODAL
// ─────────────────────────────────────────────
function EventModal({event,defDate,defHour,onSave,onDelete,onClose}){
  const[f,setF]=useState(()=>event||{
    id:genId(),title:"",category:"Personal",
    startDate:defDate||todayStr(),endDate:defDate||todayStr(),
    startTime:defHour!=null?`${pad(defHour)}:00`:"09:00",
    endTime:defHour!=null?`${pad(Math.min(defHour+1,23))}:00`:"10:00",
    allDay:false,notes:"",location:"",repeat:"none",notification:15,
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  return(
    <div className="fade" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:300,display:"flex",alignItems:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" style={{width:"100%",maxHeight:"93vh",background:"#0F0F0F",borderRadius:"22px 22px 0 0",overflowY:"auto",padding:"14px 18px",paddingBottom:"max(48px,env(safe-area-inset-bottom,48px))"}}>
        <div style={{width:34,height:4,borderRadius:2,background:"#282828",margin:"0 auto 14px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button className="tap" onClick={onClose} style={{background:"none",border:"none",color:"#7C6AF7",fontSize:15,cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:500}}>Cancel</button>
          <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:16,color:"#F0F0F0"}}>{event?"Edit Event":"New Event"}</span>
          <button className="tap" onClick={()=>{if(!f.title.trim())return;onSave({...f,id:f.id||genId()});}} style={{background:"none",border:"none",color:"#7C6AF7",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}>Save</button>
        </div>

        <input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Event title" autoFocus style={{...S.input,fontSize:17,fontWeight:500,marginBottom:12}}/>

        <div style={{marginBottom:12}}>
          <div style={S.label}>Category</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {Object.entries(CATS).map(([c,{color}])=>(
              <button key={c} className="tap" onClick={()=>set("category",c)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${color}`,background:f.category===c?color:"transparent",color:f.category===c?"#fff":color,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",transition:"all 0.15s"}}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",background:"#181818",border:"1px solid #242424",borderRadius:12,marginBottom:10}}>
          <span style={{color:"#C0C0C0",fontSize:14,fontFamily:"DM Sans,sans-serif"}}>All Day</span>
          <Toggle on={f.allDay} onChange={v=>set("allDay",v)}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          {[["Start Date","startDate"],["End Date","endDate"]].map(([l,k])=>(
            <div key={k} style={{background:"#181818",border:"1px solid #242424",borderRadius:12,padding:"10px 12px"}}>
              <div style={{...S.label,marginBottom:4}}>{l}</div>
              <input type="date" value={f[k]} onChange={e=>set(k,e.target.value)} style={{background:"none",border:"none",color:"#DDD",fontSize:13,fontFamily:"DM Sans,sans-serif",width:"100%",outline:"none",cursor:"pointer"}}/>
            </div>
          ))}
        </div>

        {!f.allDay&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {[["Start Time","startTime"],["End Time","endTime"]].map(([l,k])=>(
              <div key={k} style={{background:"#181818",border:"1px solid #242424",borderRadius:12,padding:"10px 12px"}}>
                <div style={{...S.label,marginBottom:4}}>{l}</div>
                <input type="time" value={f[k]||""} onChange={e=>set(k,e.target.value)} style={{background:"none",border:"none",color:"#DDD",fontSize:13,fontFamily:"DM Sans,sans-serif",width:"100%",outline:"none",cursor:"pointer"}}/>
              </div>
            ))}
          </div>
        )}

        <input value={f.location||""} onChange={e=>set("location",e.target.value)} placeholder="📍 Location" style={{...S.input,marginBottom:10,color:"#A0A0A0"}}/>
        <textarea value={f.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="📝 Notes" rows={2} style={{...S.input,marginBottom:10,color:"#A0A0A0"}}/>

        <div style={{marginBottom:10}}>
          <div style={S.label}>Repeat</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {REPEAT_OPTS.map(({v,l})=>(
              <button key={v} className="tap" onClick={()=>set("repeat",v)} style={{padding:"6px 13px",borderRadius:20,border:`1.5px solid ${f.repeat===v?"#7C6AF7":"#282828"}`,background:f.repeat===v?"rgba(124,106,247,0.14)":"transparent",color:f.repeat===v?"#A898FF":"#555",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",transition:"all 0.15s"}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={S.label}>Notification</div>
          <select value={f.notification??15} onChange={e=>set("notification",Number(e.target.value))} style={{...S.input,cursor:"pointer",appearance:"none"}}>
            {NOTIF_OPTS.map(({v,l})=><option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {event&&(
          <div style={{display:"flex",gap:8}}>
            <button className="tap" onClick={()=>onSave({...f,id:genId(),title:`${f.title} (copy)`})} style={{flex:1,padding:"12px",background:"#181818",border:"1px solid #282828",borderRadius:12,color:"#888",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}>Duplicate</button>
            <button className="tap" onClick={()=>{onDelete(event._pid||event.id);onClose();}} style={{flex:1,padding:"12px",background:"rgba(255,60,60,0.06)",border:"1px solid rgba(255,60,60,0.22)",borderRadius:12,color:"#FF6060",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DAY MODAL
// ─────────────────────────────────────────────
function DayModal({date,events,onClose,onEventClick,onAddNew}){
  const expanded=useMemo(()=>
    expandEvents(events,date,date).sort((a,b)=>(a.allDay?-1:b.allDay?1:0)||((a.startTime||"")>(b.startTime||"")?1:-1))
  ,[events,date]);

  return(
    <div className="fade" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:300,display:"flex",alignItems:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" style={{width:"100%",maxHeight:"74vh",background:"#0F0F0F",borderRadius:"22px 22px 0 0",overflowY:"auto",padding:"14px 18px",paddingBottom:"max(48px,env(safe-area-inset-bottom,48px))"}}>
        <div style={{width:34,height:4,borderRadius:2,background:"#282828",margin:"0 auto 14px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:22,color:"#F0F0F0"}}>{MONTHS[date.getMonth()]} {date.getDate()}</div>
            <div style={{color:"#484848",fontSize:12,fontFamily:"DM Sans,sans-serif",marginTop:2}}>{DOWS_FULL[date.getDay()]}{isToday(date)&&<span style={{color:"#7C6AF7",marginLeft:8,fontWeight:700}}>· Today</span>}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button className="tap" onClick={onAddNew} style={{padding:"8px 18px",background:"#7C6AF7",border:"none",borderRadius:20,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Syne,sans-serif"}}>+ Add</button>
            <button className="tap" onClick={onClose} style={{background:"none",border:"none",color:"#484848",fontSize:26,cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>
        {expanded.length===0?(
          <div style={{textAlign:"center",padding:"28px 0",color:"#303030",fontSize:14,fontFamily:"DM Sans,sans-serif"}}>No events · tap + Add to create one</div>
        ):expanded.map(evt=>(
          <div key={evt.id} onClick={()=>{onEventClick(evt);onClose();}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#161616",border:"1px solid #1F1F1F",borderRadius:14,marginBottom:8,cursor:"pointer",borderLeft:`3px solid ${CATS[evt.category]?.color||CATS.Other.color}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#EBEBEB",fontSize:14,fontWeight:600,fontFamily:"DM Sans,sans-serif"}}>{evt.title}</div>
              <div style={{color:"#484848",fontSize:11,marginTop:2,fontFamily:"DM Sans,sans-serif"}}>
                {evt.allDay?"All day":`${fmtTime(evt.startTime)} – ${fmtTime(evt.endTime)}`}
                {evt.location?` · 📍 ${evt.location}`:""}
                {evt._rec?" · 🔄":""}
              </div>
            </div>
            <span style={S.tag(evt.category)}>{evt.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// UPCOMING LIST
// ─────────────────────────────────────────────
function UpcomingList({events,onEventClick}){
  const tod=todayStr(),tom=fmtDate(new Date(Date.now()+86400000));
  const end30=new Date(); end30.setDate(end30.getDate()+30);
  const list=useMemo(()=>
    expandEvents(events,new Date(),end30).filter(e=>e.endDate>=tod)
      .sort((a,b)=>a.startDate>b.startDate?1:a.startDate<b.startDate?-1:(a.startTime||"")>(b.startTime||"")?1:-1)
      .slice(0,8)
  ,[events]);

  if(!list.length) return(<div style={{padding:"24px 14px",textAlign:"center",color:"#282828",fontSize:13,fontFamily:"DM Sans,sans-serif"}}>Nothing coming up · tap + to add events</div>);

  return(
    <div style={{padding:"18px 12px 8px"}}>
      <div style={{...S.label,paddingLeft:2,marginBottom:10}}>Upcoming</div>
      {list.map(evt=>(
        <div key={evt.id} onClick={()=>onEventClick(evt)} style={{display:"flex",alignItems:"center",gap:11,marginBottom:7,padding:"10px 12px",background:"#111",border:"1px solid #181818",borderRadius:13,cursor:"pointer"}}>
          <div style={{width:3,height:32,borderRadius:2,background:CATS[evt.category]?.color,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"#D8D8D8",fontSize:13,fontWeight:600,fontFamily:"DM Sans,sans-serif",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{evt.title}</div>
            <div style={{color:"#424242",fontSize:11,marginTop:1,fontFamily:"DM Sans,sans-serif"}}>
              {evt.startDate===tod?"Today":evt.startDate===tom?"Tomorrow":dispDate(evt.startDate)}
              {!evt.allDay&&evt.startTime?` · ${fmtTime(evt.startTime)}`:""}
            </div>
          </div>
          <span style={S.tag(evt.category)}>{evt.category}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// SETTINGS MODAL
// ─────────────────────────────────────────────
function SettingsModal({uid,syncStatus,events,onImport,onClose}){
  const[copiedUID,  setCopiedUID]  = useState(false);
  const[copiedEvts, setCopiedEvts] = useState(false);
  const[importText, setImportText] = useState("");
  const[importMsg,  setImportMsg]  = useState(null); // {ok,text}
  const[showImport, setShowImport] = useState(false);

  const SYNC_MSG={
    synced:  {c:"#3DBA7E", t:"Synced to cloud — your events are safe."},
    syncing: {c:"#F7A45A", t:"Syncing…"},
    error:   {c:"#FF6060", t:"Sync failed — changes saved locally."},
    idle:    {c:"#484848", t:"Not synced yet."},
  };
  const sm=SYNC_MSG[syncStatus]||SYNC_MSG.idle;

  const copyUID=()=>{
    navigator.clipboard?.writeText(uid);
    setCopiedUID(true); setTimeout(()=>setCopiedUID(false),2500);
  };

  const copyForClaude=()=>{
    const now=new Date();
    const text=
      `OBSIDIAN CALENDAR — ${now.toDateString()}\n`+
      `──────────────────────────────\n`+
      `EVENTS_START\n`+
      JSON.stringify(events,null,2)+
      `\nEVENTS_END`;
    navigator.clipboard?.writeText(text);
    setCopiedEvts(true); setTimeout(()=>setCopiedEvts(false),3000);
  };

  const applyImport=()=>{
    try {
      const text=importText.trim();
      // Try marked block first
      const marked=text.match(/EVENTS_START\s*([\s\S]*?)\s*EVENTS_END/);
      // Fall back to any JSON array
      const arr=text.match(/\[[\s\S]*\]/);
      const raw=marked?marked[1]:arr?arr[0]:null;
      if (!raw) throw new Error("no data");
      const parsed=JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("not array");
      onImport(parsed);
      setImportText("");
      setShowImport(false);
      setImportMsg({ok:true, text:`✓ ${parsed.length} events imported and synced.`});
      setTimeout(()=>setImportMsg(null),4000);
    } catch {
      setImportMsg({ok:false, text:"Couldn't read the data. Paste Claude's full reply including the EVENTS_START / EVENTS_END markers."});
      setTimeout(()=>setImportMsg(null),5000);
    }
  };

  return(
    <div className="fade" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:300,display:"flex",alignItems:"flex-end"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="sheet" style={{width:"100%",maxHeight:"92vh",background:"#0F0F0F",borderRadius:"22px 22px 0 0",overflowY:"auto",padding:"14px 20px",paddingBottom:"max(48px,env(safe-area-inset-bottom,48px))"}}>
        <div style={{width:34,height:4,borderRadius:2,background:"#282828",margin:"0 auto 14px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#F0F0F0"}}>Settings</span>
          <button className="tap" onClick={onClose} style={{background:"none",border:"none",color:"#484848",fontSize:26,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* ── Cloud Sync ── */}
        <div style={S.label}>Cloud Sync</div>
        <div style={{background:"#141414",border:"1px solid #1F1F1F",borderRadius:14,padding:"12px 16px",marginBottom:18,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:sm.c,flexShrink:0}}/>
          <span style={{color:"#888",fontSize:13,fontFamily:"DM Sans,sans-serif"}}>{sm.t}</span>
        </div>

        {/* ── Talk to Claude ── */}
        <div style={S.label}>Talk to Claude</div>
        <div style={{background:"#141414",border:"1px solid #1F1F1F",borderRadius:14,padding:"14px 16px",marginBottom:10}}>
          {/* Step 1 */}
          <div style={{color:"#555",fontSize:11,fontFamily:"DM Sans,sans-serif",marginBottom:10,lineHeight:1.6}}>
            <span style={{color:"#7C6AF7",fontWeight:700}}>Step 1 —</span> Copy your events and paste them in Claude.
          </div>
          <button className="tap" onClick={copyForClaude} style={{
            width:"100%",padding:"12px",borderRadius:12,border:"none",cursor:"pointer",
            background:copiedEvts?"rgba(61,186,126,0.15)":"rgba(124,106,247,0.18)",
            color:copiedEvts?"#3DBA7E":"#A898FF",
            fontSize:13,fontWeight:700,fontFamily:"Syne,sans-serif",letterSpacing:0.3,
            transition:"all 0.2s",marginBottom:14,
          }}>
            {copiedEvts?"✓ Copied — paste in Claude":"Copy events for Claude"}
          </button>

          {/* Step 2 */}
          <div style={{color:"#555",fontSize:11,fontFamily:"DM Sans,sans-serif",marginBottom:10,lineHeight:1.6}}>
            <span style={{color:"#7C6AF7",fontWeight:700}}>Step 2 —</span> Ask Claude anything. When it makes changes it will give you updated data to paste back.
          </div>

          {/* Step 3 */}
          <div style={{color:"#555",fontSize:11,fontFamily:"DM Sans,sans-serif",marginBottom:10,lineHeight:1.6}}>
            <span style={{color:"#7C6AF7",fontWeight:700}}>Step 3 —</span> Paste Claude's response here.
          </div>
          <button className="tap" onClick={()=>setShowImport(p=>!p)} style={{
            width:"100%",padding:"11px",borderRadius:12,
            border:"1px solid #2A2A2A",background:"transparent",
            color:"#555",fontSize:13,fontWeight:700,fontFamily:"Syne,sans-serif",
            cursor:"pointer",letterSpacing:0.3,
          }}>
            {showImport?"▲ Close":"▼ Import Claude's changes"}
          </button>

          {showImport&&(
            <div style={{marginTop:10}}>
              <textarea
                value={importText}
                onChange={e=>setImportText(e.target.value)}
                placeholder="Paste Claude's full reply here…"
                rows={5}
                style={{...S.input,marginBottom:8,fontSize:12,color:"#A0A0A0",lineHeight:1.5}}
              />
              <button className="tap" onClick={applyImport} disabled={!importText.trim()} style={{
                width:"100%",padding:"12px",borderRadius:12,border:"none",cursor:"pointer",
                background:importText.trim()?"#7C6AF7":"#1A1A1A",
                color:importText.trim()?"#fff":"#333",
                fontSize:13,fontWeight:700,fontFamily:"Syne,sans-serif",transition:"all 0.2s",
              }}>Apply changes</button>
            </div>
          )}
        </div>

        {/* Feedback message */}
        {importMsg&&(
          <div style={{padding:"10px 14px",borderRadius:10,marginBottom:10,background:importMsg.ok?"rgba(61,186,126,0.1)":"rgba(255,96,96,0.1)",border:`1px solid ${importMsg.ok?"#3DBA7E44":"#FF606044"}`}}>
            <span style={{color:importMsg.ok?"#3DBA7E":"#FF6060",fontSize:12,fontFamily:"DM Sans,sans-serif"}}>{importMsg.text}</span>
          </div>
        )}

        {/* ── Scriptable UID ── */}
        <div style={{...S.label,marginTop:8}}>Scriptable Widget ID</div>
        <div style={{background:"#141414",border:"1px solid #1F1F1F",borderRadius:14,padding:"12px 14px",marginBottom:18}}>
          <div style={{color:"#555",fontSize:11,fontFamily:"DM Sans,sans-serif",marginBottom:8}}>Paste this in the Scriptable widget script.</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <code style={{flex:1,fontSize:10,color:"#7C6AF7",fontFamily:"monospace",wordBreak:"break-all",background:"#0A0A0A",padding:"7px 10px",borderRadius:8,border:"1px solid #242424"}}>{uid}</code>
            <button className="tap" onClick={copyUID} style={{padding:"7px 12px",background:copiedUID?"rgba(61,186,126,0.15)":"rgba(124,106,247,0.12)",border:`1px solid ${copiedUID?"#3DBA7E":"#7C6AF7"}`,borderRadius:10,color:copiedUID?"#3DBA7E":"#7C6AF7",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Syne,sans-serif",flexShrink:0}}>
              {copiedUID?"✓":"Copy"}
            </button>
          </div>
        </div>

        {/* ── Categories ── */}
        <div style={S.label}>Categories</div>
        <div style={{background:"#141414",border:"1px solid #1F1F1F",borderRadius:14,padding:"12px 16px"}}>
          {Object.entries(CATS).map(([cat,{color}])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
              <span style={{color:"#CECECE",fontSize:13,fontFamily:"DM Sans,sans-serif",flex:1}}>{cat}</span>
              <div style={{width:40,height:3,borderRadius:2,background:color+"44"}}/>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App(){
  const[events,   setEvents]   = useState([]);
  const[loaded,   setLoaded]   = useState(false);
  const[date,     setDate]     = useState(new Date());
  const[view,     setView]     = useState("month");
  const[dayModal, setDayModal] = useState(null);
  const[evtModal, setEvtModal] = useState(null);
  const[showSett, setShowSett] = useState(false);
  const[syncSt,   setSyncSt]   = useState("idle");
  const uid    = useMemo(()=>getUID(),[]);
  const syncTm = useRef(null);

  // Mount: load local immediately, then fetch cloud
  useEffect(()=>{
    const local = loadLocal();
    setEvents(local);
    setLoaded(true);
    reqNotif();

    setSyncSt("syncing");
    apiFetch(uid)
      .then(apiEvts=>{
        const localEvts = loadLocal();
        if (apiEvts.length === 0 && localEvts.length > 0) {
          // Cloud is empty but local has events — push local up, keep local
          apiPush(uid, localEvts).catch(()=>{});
          setSyncSt("synced");
        } else {
          // Merge: API is source of truth, but keep any local-only events
          const apiIds = new Set(apiEvts.map(e=>e.id));
          const onlyLocal = localEvts.filter(e=>!apiIds.has(e.id));
          const merged = onlyLocal.length > 0 ? [...apiEvts, ...onlyLocal] : apiEvts;
          if (onlyLocal.length > 0) apiPush(uid, merged).catch(()=>{});
          setEvents(merged);
          saveLocal(merged);
          setSyncSt("synced");
        }
      })
      .catch(()=>setSyncSt("error"));
  },[]);

  // Save: local immediately + debounced cloud push
  useEffect(()=>{
    if(!loaded) return;
    saveLocal(events);
    saveWorkoutData(events);
    clearTimeout(syncTm.current);
    setSyncSt("syncing");
    syncTm.current = setTimeout(()=>{
      apiPush(uid,events)
        .then(()=>setSyncSt("synced"))
        .catch(()=>setSyncSt("error"));
    },800);
  },[events,loaded]);

  // Notification poller
  useEffect(()=>{
    const tick=setInterval(()=>{
      const n=new Date(),nMin=n.getHours()*60+n.getMinutes(),tod=fmtDate(n);
      events.forEach(e=>{
        if(e.startDate===tod&&e.notification!=null&&e.notification>=0&&e.startTime){
          const[eh,em]=e.startTime.split(":").map(Number);
          if(eh*60+em-nMin===e.notification) fireNotif(e);
        }
      });
    },60000);
    return()=>clearInterval(tick);
  },[events]);

  const save=useCallback(evt=>{
    setEvents(p=>{const x=p.find(e=>e.id===evt.id);return x?p.map(e=>e.id===evt.id?evt:e):[...p,evt];});
    setEvtModal(null);
  },[]);

  const del=useCallback(id=>{ setEvents(p=>p.filter(e=>e.id!==id)); setEvtModal(null); },[]);

  const handleImport=useCallback(imported=>{ setEvents(imported); },[]);

  const nav=dir=>{
    const d=new Date(date);
    if(view==="month") d.setMonth(d.getMonth()+dir);
    else d.setDate(d.getDate()+dir*7);
    setDate(d);
  };

  const title=()=>{
    if(view==="month") return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    const s=new Date(date); s.setDate(date.getDate()-date.getDay());
    const e=new Date(s); e.setDate(s.getDate()+6);
    return s.getMonth()===e.getMonth()
      ?`${MONTHS_S[s.getMonth()]} ${s.getDate()}–${e.getDate()}`
      :`${MONTHS_S[s.getMonth()]} ${s.getDate()} – ${MONTHS_S[e.getMonth()]} ${e.getDate()}`;
  };

  return(
    <div style={{maxWidth:430,margin:"0 auto",height:"100vh",background:"#080808",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"DM Sans,sans-serif",paddingTop:"env(safe-area-inset-top,0px)"}}>
      <style>{CSS}</style>

      {/* Brand + sync indicator */}
      <div style={{height:36,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
        <span style={{fontSize:11,color:"#2A2A2A",fontFamily:"Syne,sans-serif",fontWeight:800,letterSpacing:1.8}}>OBSIDIAN</span>
        <div style={{position:"absolute",right:18,top:"50%",transform:"translateY(-50%)"}}>
          <SyncDot status={syncSt}/>
        </div>
      </div>

      {/* Nav header */}
      <div style={{padding:"0 18px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button className="tap" onClick={()=>nav(-1)} style={{background:"none",border:"none",color:"#7C6AF7",fontSize:26,cursor:"pointer",lineHeight:1,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <span style={{fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:18,color:"#F0F0F0",letterSpacing:-0.4}}>{title()}</span>
        <button className="tap" onClick={()=>nav(1)} style={{background:"none",border:"none",color:"#7C6AF7",fontSize:26,cursor:"pointer",lineHeight:1,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",margin:"0 18px 12px",background:"#111",borderRadius:13,padding:3,border:"1px solid #1A1A1A",flexShrink:0}}>
        {["month","week"].map(v=>(
          <button key={v} className="tap" onClick={()=>setView(v)} style={{flex:1,padding:"8px 0",borderRadius:11,border:"none",cursor:"pointer",background:view===v?"#7C6AF7":"transparent",color:view===v?"#fff":"#404040",fontSize:12,fontWeight:800,transition:"all 0.2s",fontFamily:"Syne,sans-serif",letterSpacing:0.8,textTransform:"uppercase"}}>{v}</button>
        ))}
      </div>

      {/* Calendar body */}
      <div style={{flex:1,overflow:"hidden",minHeight:0}}>
        {view==="month"?(
          <div style={{height:"100%",overflowY:"auto",paddingBottom:8}}>
            <MonthView date={date} events={events} onDayClick={d=>setDayModal(d)}/>
            <UpcomingList events={events} onEventClick={e=>setEvtModal({event:e})}/>
            <div style={{height:16}}/>
          </div>
        ):(
          <WeekView date={date} events={events}
            onEventClick={e=>setEvtModal({event:e})}
            onSlotClick={(d,h)=>setEvtModal({defDate:fmtDate(d),defHour:h})}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",padding:"10px 28px",paddingBottom:"max(24px,env(safe-area-inset-bottom,24px))",background:"rgba(8,8,8,0.97)",backdropFilter:"blur(12px)",borderTop:"1px solid #161616",flexShrink:0}}>
        <button className="tap" onClick={()=>setDate(new Date())} style={{background:"none",border:"none",color:"#505050",fontSize:11,cursor:"pointer",fontFamily:"Syne,sans-serif",fontWeight:800,letterSpacing:0.8,textTransform:"uppercase",padding:"8px 10px"}}>Today</button>

        <button className="tap" onClick={()=>setEvtModal({defDate:todayStr()})} style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#7C6AF7,#B57BF7)",border:"none",color:"#fff",fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 28px rgba(124,106,247,0.5)"}}>+</button>

        <button className="tap" onClick={()=>setShowSett(true)} style={{background:"none",border:"none",color:"#505050",fontSize:18,cursor:"pointer",padding:"8px 10px",lineHeight:1}}>⚙</button>
      </div>

      {/* Modals */}
      {dayModal&&(<DayModal date={dayModal} events={events} onClose={()=>setDayModal(null)} onEventClick={e=>setEvtModal({event:e})} onAddNew={()=>{setEvtModal({defDate:fmtDate(dayModal)});setDayModal(null);}}/>)}
      {evtModal&&(<EventModal event={evtModal.event} defDate={evtModal.defDate} defHour={evtModal.defHour} onSave={save} onDelete={del} onClose={()=>setEvtModal(null)}/>)}
      {showSett&&(<SettingsModal uid={uid} syncStatus={syncSt} events={events} onImport={handleImport} onClose={()=>setShowSett(false)}/>)}
    </div>
  );
}
