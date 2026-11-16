import React,{useMemo,useState} from 'react';
import type {RoomStatus} from './db';
import type {AtelierProps} from './AtelierOverview';

const states:Record<RoomStatus,{en:string;es:string}>={
 ready:{en:'Ready',es:'Lista'},occupied:{en:'Occupied',es:'Ocupada'},dirty:{en:'Dirty',es:'Sucia'},
 cleaning:{en:'Cleaning',es:'Limpieza'},inspection:{en:'Inspect',es:'Revisión'},blocked:{en:'Blocked',es:'Bloqueada'}
};
const pad=(str:string)=>/^[0-9]+$/.test(str)?str.padStart(2,'0'):str;
export default function ExactAtelierOverview({lang,hotelName,rooms,tasks,alerts,members,dispatch,events,onRoom,onRooms,onTasks,onChat,preview=false}:AtelierProps){
 const [floor,setFloor]=useState('all');
 const [expand,setExpand]=useState(false);
 const isEn=lang==='en';
 const ready=rooms.filter(r=>r.status==='ready').length;
 const cleaning=rooms.filter(r=>r.status==='cleaning').length;
 const waiting=rooms.filter(r=>r.status==='dirty'||r.status==='cleaning').length;
 const active=members.filter(m=>m.active);
 const onDuty=dispatch.filter(d=>d.on_shift&&active.some(m=>m.user_id===d.user_id)).length;
 const incomplete=tasks.filter(t=>!['done','cancelled'].includes(t.status));
 const elevated=incomplete.filter(t=>t.priority==='urgent'||t.priority==='high');
 const attention=alerts.length?alerts.slice(0,3).map(a=>({key:String(a.id),label:a.reason==='urgent'?'URGENT':a.reason==='no_worker'?'NEEDS ASSIGNMENT':'AWAITING ACCEPTANCE',title:a.body,detail:preview?'Sample alert':'Hotel alert',tone:a.reason==='urgent'?'urgent':''})):elevated.slice(0,3).map(t=>({key:t.id,label:t.priority==='urgent'?'URGENT':'PRIORITY',title:t.title,detail:'Room '+(rooms.find(r=>r.id===t.room_id)?.number||''),tone:t.priority==='urgent'?'urgent':''}));
 const attentionCount=alerts.length||elevated.length;
 const floors=useMemo(()=>[...new Set(rooms.map(r=>r.floor))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[rooms]);
 const floorsShown=floor==='all'?floors.slice(0,3):floors.filter(f=>f===floor);
 const percent=rooms.length?100*ready/rooms.length:0;
 return <div className="a7-design-layout">
 <section className="hero" aria-label={isEn?'Hotel readiness overview':'Resumen del hotel'}>
  <div className="hero-left"><div className="eyebrow">{isEn?'THE MORNING BRIEF   /   SHIFT 01':'INFORME DEL TURNO   /   TURNO 01'}</div>
   <h1>{isEn?'The hotel,':'El hotel,'}<br/><em>{isEn?'in motion.':'en movimiento.'}</em></h1>
   <p>{isEn?<>What's ready. What needs attention. Who's already on it.<br/>All in one beautifully quiet view.</>:<>Qué está listo. Qué necesita atención. Quién está encargado.<br/>Todo en una vista clara y sencilla.</>}</p>
   <div className="hero-tail"><span className="tiny-rule"/><span className="note">{isEn?'LESS CHASING. MORE HOSTING.':'MENOS LLAMADAS. MÁS HOSPITALIDAD.'}</span></div>
  </div>
  <div className="pulse" aria-label={isEn?'Ready rooms':'Habitaciones listas'}><div className="pulse-title">{isEn?'THE READINESS PULSE':'HABITACIONES LISTAS'} &nbsp; ↗</div>
   <div className="pulse-value">{ready}<sup>/ {rooms.length}</sup></div><div className="pulse-bottom"><div><strong>{isEn?'Rooms ready to welcome':'Habitaciones listas para recibir'}</strong><br/><small>{percent.toFixed(1)}% {isEn?'of hotel inventory':'del hotel'}</small></div><span aria-hidden="true" className="mini-flow"/></div>
  </div>
 </section>
 <section className="kpis" aria-label="Hotel operations metrics">
  <div className="kpi"><div className="kpi-title">{isEn?'Ready for arrival':'Listas para llegadas'}</div><div className="kpi-n">{ready}<span> / {rooms.length}</span></div><div className="kpi-desc">{isEn?'Rooms available for guests':'Disponibles para huéspedes'}</div></div>
  <div className="kpi"><div className="kpi-title">{isEn?'Awaiting cleaning':'Esperando limpieza'}</div><div className="kpi-n">{waiting}</div><div className="kpi-desc">{cleaning} {isEn?'currently in progress':'en limpieza ahora'}</div></div>
  <div className="kpi"><div className="kpi-title">{isEn?'Needs your eyes':'Necesita atención'}</div><div className="kpi-n alert">{String(attentionCount).padStart(2,'0')}</div><div className="kpi-desc">{isEn?'Requires management attention':'Requiere supervisión'}</div></div>
  <div className="kpi"><div className="kpi-title">{isEn?'Team on duty':'Equipo de turno'}</div><div className="kpi-n">{String(onDuty).padStart(2,'0')}<span> / {active.length}</span></div><div className="kpi-desc">{isEn?'Available across departments':'Disponibles en los departamentos'}</div></div>
 </section>
 <div className="workspace">
  <section className="panel floor-panel" aria-label="Room readiness by floor">
   <div className="panel-head"><div><div className="overline">01 / {isEn?'ROOM INTELLIGENCE':'HABITACIONES'}</div><h2>{isEn?'Every room, accounted for.':'Cada habitación, controlada.'}</h2><p>{isEn?'Browse by floor. Select a room to see its current state.':'Seleccione un piso y una habitación para ver su estado.'}</p></div>
    <div className="floor-toggles" role="group" aria-label={isEn?'Select floor':'Seleccione piso'}><button className={floor==='all'?'active':''} onClick={()=>setFloor('all')} aria-pressed={floor==='all'}>{isEn?'All':'Todos'}</button>{floors.slice(0,3).map(f=><button key={f} className={floor===f?'active':''} aria-pressed={floor===f} onClick={()=>{setFloor(f);setExpand(false)}}>{pad(f)}</button>)}</div>
   </div>
   <div className="room-map">{floorsShown.length?floorsShown.map(f=>{const group=rooms.filter(r=>r.floor===f).sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true}));const shown=expand?group.slice(0,32):group.slice(0,8);return <div className="floor-row" key={f}><div className="floor-meta"><strong>{isEn?'FLOOR':'PISO'} {pad(f)}</strong><span>{pad(String(group.length))} {isEn?'rooms':'hab.'}</span></div><div className="rooms">{shown.map(r=><button key={r.id} type="button" className={'room '+r.status} onClick={()=>onRoom(r.id)} aria-label={`${isEn?'Room':'Habitación'} ${r.number} — ${states[r.status][lang]}`}><span className="room-number">{r.number}</span><span className="room-sub">{states[r.status][lang]}</span></button>)}{group.length>shown.length&&<button className="room more-rooms" type="button" onClick={onRooms} aria-label="Open full room board">+{group.length-shown.length}</button>}</div></div>}):<div className="room-empty">{isEn?'No rooms yet. Open Room Board to add some.':'Aún no hay habitaciones.'}</div>}</div>
   <div className="floor-panel-bottom"><div className="legend" aria-label="Room status legend">{(['ready','occupied','dirty','cleaning','inspection','blocked'] as RoomStatus[]).map(s=><span key={s}><b className={s}/>{states[s][lang]}</span>)}</div><button type="button" className="text-btn" onClick={()=>{if(floor!=='all'){setFloor('all');setExpand(false)}else if(!expand){setExpand(true)}else{onRooms()}}}>{isEn?'Show more rooms':'Ver más habitaciones'} ↗</button></div>
  </section>
  <aside className="alerts" aria-label="Needs attention"><div className="overline">02 / {isEn?'THE ATTENTION DESK':'ATENCIÓN PRIORITARIA'}</div><div className="alerts-title"><h2>{isEn?'Eyes here.':'Atención aquí.'}</h2><span className="count">{String(attentionCount).padStart(2,'0')}</span></div>
   <div className="alert-items">{attention.length?attention.map((a,i)=><button className={'alert-item '+(a.tone==='urgent'?'':'warn')} key={a.key} type="button" onClick={onTasks}><span className="alert-idx">{String(i+1).padStart(2,'0')}</span><span><span className="alert-tag">{a.label}</span><strong>{a.title}</strong><small>{a.detail}</small></span><span className="alert-arrow">↗</span></button>):<div className="a7-clear"><span>✓</span><strong>{isEn?'All caught up.':'Todo al día.'}</strong><small>{isEn?'No urgent items need attention.':'No hay tareas urgentes.'}</small></div>}</div>
   <div className="alerts-bottom"><div className="staff-micro"><div className="staff-dots">{active.slice(0,3).map(m=><i key={m.user_id}>{m.display_name.slice(0,2).toUpperCase()}</i>)}</div><span>{String(onDuty).padStart(2,'0')} {isEn?'on duty':'de turno'}<br/>{Math.max(0,active.length-onDuty)} {isEn?'off shift':'fuera de turno'}</span></div><button type="button" className="chat-button" onClick={onChat}>{isEn?'Team radio':'Chat del equipo'} &nbsp; ↗</button></div>
  </aside>
 </div>
 <section className="handover" aria-label="Recent shift activity"><div><div className="overline">03 / {isEn?'THE SHIFT THREAD':'ACTIVIDAD DEL TURNO'}</div><h3>{isEn?'Nothing falls through.':'Nada se pierde.'}</h3></div><div className="hand-over-flow">{events.slice(0,3).map(e=><div className="hand-segment" key={e.id}><strong>{new Date(e.at).toLocaleTimeString(isEn?'en':'es',{hour:'2-digit',minute:'2-digit'})}</strong><span>{e.message}</span></div>)}{!events.length&&<div className="hand-segment"><strong>{isEn?'No recent activity':'Sin actividad reciente'}</strong><span>{isEn?'Updates appear here as staff work.':'Las actualizaciones aparecerán aquí.'}</span></div>}</div><button type="button" className="handover-link" onClick={onRooms}>{isEn?'Follow the rooms':'Ver habitaciones'} &nbsp; ↗</button></section>
 <div className="footnote"><span>CASAFLOW &nbsp; / &nbsp; SIGNAL ATELIER</span><span>{preview?'DESIGN PREVIEW · SAMPLE DATA':'LIVE HOTEL OPERATIONS · STAFF ACCESS'}</span></div>
 </div>
}
