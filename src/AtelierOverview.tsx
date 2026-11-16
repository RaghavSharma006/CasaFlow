import React,{useMemo,useState} from 'react';
import {ArrowUpRight,ArrowRight,MessageCircle,ChevronRight,CheckCircle2,AlertTriangle,Clock,Radio,Hotel,SlidersHorizontal} from 'lucide-react';
import type {Room,Task,OpsAlert,Member,Dispatch,Event,RoomStatus} from './db';

export type AtelierRoom=Pick<Room,'id'|'number'|'floor'|'status'>;
export type AtelierTask=Pick<Task,'id'|'room_id'|'priority'|'title'|'status'|'kind'|'created_at'>;
export type AtelierAlert=Pick<OpsAlert,'id'|'reason'|'body'|'created_at'>;
export type AtelierMember=Pick<Member,'user_id'|'display_name'|'active'>;
export type AtelierDispatch=Pick<Dispatch,'user_id'|'on_shift'>;
export type AtelierEvent=Pick<Event,'id'|'message'|'at'>;
export type AtelierProps={
 lang:'en'|'es';hotelName:string;rooms:AtelierRoom[];tasks:AtelierTask[];alerts:AtelierAlert[];
 members:AtelierMember[];dispatch:AtelierDispatch[];events:AtelierEvent[];
 onRoom:(id:string)=>void;onRooms:()=>void;onTasks:()=>void;onChat:()=>void;
 preview?:boolean;
};
const statuses:Record<RoomStatus,{en:string;es:string}>={occupied:{en:'Occupied',es:'Ocupada'},dirty:{en:'Dirty',es:'Sucia'},cleaning:{en:'Cleaning',es:'Limpieza'},inspection:{en:'Inspect',es:'Inspección'},ready:{en:'Ready',es:'Lista'},blocked:{en:'Blocked',es:'Bloqueada'}};
function formatFloor(s:string){return /^\d+$/.test(s)?s.padStart(2,'0'):s;}
export default function AtelierOverview({lang,hotelName,rooms,tasks,alerts,members,dispatch,events,onRoom,onRooms,onTasks,onChat,preview=false}:AtelierProps){
 const [floor,setFloor]=useState('all');
 const words=lang==='en'?{
 eyebrow:'THE OPERATIONS BRIEF / LIVE',first:'The hotel,',second:'in motion.',desc:'What’s ready. What needs attention. Who’s already on it.',line:'LESS CHASING. MORE HOSTING.',pulse:'THE READINESS PULSE',pulseLabel:'Rooms ready to welcome',total:'of hotel inventory',ready:'READY FOR ARRIVAL',waiting:'AWAITING CLEANING',eyes:'NEEDS YOUR EYES',onShift:'TEAM ON DUTY',roomTitle:'Every room, accounted for.',roomEyebrow:'01 / ROOM INTELLIGENCE',roomDesc:'Browse by floor. Select any room for its latest status.',all:'All floors',roomBoard:'OPEN ROOM BOARD',attention:'02 / THE ATTENTION DESK',eyesHere:'Eyes here.',urgent:'Urgent',unassigned:'Needs assignment',overdue:'Awaiting acceptance',recent:'03 / THE SHIFT THREAD',nothing:'Nothing falls through.',noAlerts:'All caught up.',noAlertsDesc:'No pending management alerts. Keep the good work going.',chat:'TEAM RADIO',work:'OPEN WORK QUEUE',roomsLabel:'rooms',empty:'No rooms have been added.',preview:'DESIGN PREVIEW · SAMPLE DATA'
 }:{
 eyebrow:'INFORME OPERATIVO / EN VIVO',first:'El hotel,',second:'en movimiento.',desc:'Lo que está listo. Lo que necesita atención. Quién ya se encarga.',line:'MENOS LLAMADAS. MÁS HOSPITALIDAD.',pulse:'ESTADO DE HABITACIONES',pulseLabel:'Habitaciones listas',total:'del inventario',ready:'LISTAS PARA LLEGADAS',waiting:'ESPERANDO LIMPIEZA',eyes:'REQUIERE ATENCIÓN',onShift:'EQUIPO DE TURNO',roomTitle:'Cada habitación, controlada.',roomEyebrow:'01 / HABITACIONES',roomDesc:'Filtre por piso. Abra una habitación para ver sus detalles.',all:'Todos los pisos',roomBoard:'VER HABITACIONES',attention:'02 / ATENCIÓN',eyesHere:'Revisar ahora.',urgent:'Urgente',unassigned:'Sin asignar',overdue:'Pendiente de aceptación',recent:'03 / CAMBIO DE TURNO',nothing:'Nada se pierde.',noAlerts:'Todo al día.',noAlertsDesc:'No hay alertas pendientes para gerencia.',chat:'CHAT DEL EQUIPO',work:'VER TAREAS',roomsLabel:'habitaciones',empty:'Aún no hay habitaciones.',preview:'VISTA PREVIA · DATOS DE EJEMPLO'
 };
 const ready=rooms.filter(r=>r.status==='ready').length;
 const waiting=rooms.filter(r=>r.status==='dirty'||r.status==='cleaning').length;
 const activeMembers=members.filter(m=>m.active);
 const onShift=dispatch.filter(d=>d.on_shift&&activeMembers.some(m=>m.user_id===d.user_id)).length;
 const unfinished=tasks.filter(t=>t.status!=='done'&&t.status!=='cancelled');
 const urgent=unfinished.filter(t=>t.priority==='urgent'||t.priority==='high');
 const attentionCount=alerts.length||urgent.length;
 const floorList=useMemo(()=>[...new Set(rooms.map(r=>r.floor))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[rooms]);
 const visibleFloors=floor==='all'?floorList.slice(0,4):floorList.filter(f=>f===floor);
 const roomById=useMemo(()=>new Map(rooms.map(r=>[r.id,r.number])),[rooms]);
 const attention=alerts.length?alerts.slice(0,3).map(a=>({id:String(a.id),type:a.reason==='urgent'?words.urgent:a.reason==='no_worker'?words.unassigned:words.overdue,summary:a.body,priority:a.reason==='urgent'?'urgent':'medium'})):
 urgent.slice(0,3).map(t=>({id:t.id,type:t.priority==='urgent'?words.urgent:words.eyes,summary:`${t.title} · ${roomById.get(t.room_id)||''}`,priority:t.priority==='urgent'?'urgent':'medium'}));
 const titleCase=(label:string)=>label.toUpperCase();
 const pct=rooms.length?Math.round(ready/rooms.length*100):0;
 return <div className="atelier-overview">
  <section className="atelier-hero" aria-label={words.eyebrow}>
   <div className="atelier-hero-copy"><div className="atelier-overline">{words.eyebrow}</div><h1>{words.first}<br/><em>{words.second}</em></h1><p>{words.desc}</p><div className="atelier-maxim"><span/> {words.line}</div></div>
   <div className="atelier-pulse" role="group" aria-label={words.pulse}><div className="atelier-pulse-lines"/><span className="atelier-overline">{words.pulse}</span><div className="atelier-pulse-numbers"><strong>{ready}</strong><span>/ {rooms.length}</span></div><div className="atelier-pulse-rule"/><b>{words.pulseLabel}</b><small>{pct}% {words.total}</small></div>
  </section>
  <section className="atelier-kpis" aria-label="Hotel operational metrics">
   <div><span>{words.ready}</span><strong>{ready}<small>/{rooms.length}</small></strong><p>{words.pulseLabel}</p></div>
   <div><span>{words.waiting}</span><strong>{waiting}</strong><p>{lang==='en'?'Dirty or being cleaned':'Sucias o en limpieza'}</p></div>
   <div><span>{words.eyes}</span><strong className={attentionCount?'warn':''}>{attentionCount.toString().padStart(2,'0')}</strong><p>{lang==='en'?'Items needing a response':'Elementos que necesitan respuesta'}</p></div>
   <div><span>{words.onShift}</span><strong>{onShift.toString().padStart(2,'0')}<small>/{activeMembers.length}</small></strong><p>{lang==='en'?'Currently available staff':'Personal actualmente disponible'}</p></div>
  </section>
  <div className="atelier-dashboard-columns">
   <section className="atelier-map-card" aria-labelledby="atelier-room-title"><div className="atelier-map-top"><div className="atelier-overline">{words.roomEyebrow}</div><h2 id="atelier-room-title">{words.roomTitle}</h2><p>{words.roomDesc}</p></div>
    <div className="atelier-floor-filter" role="group" aria-label={words.all}><button type="button" className={floor==='all'?'selected':''} onClick={()=>setFloor('all')}>{words.all}</button>{floorList.slice(0,5).map(f=><button type="button" className={floor===f?'selected':''} key={f} onClick={()=>setFloor(f)}>{formatFloor(f)}</button>)}</div>
    <div className="atelier-floor-rows">{visibleFloors.map(f=>{const list=rooms.filter(r=>r.floor===f).sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true}));return <div className="atelier-floor-row" key={f}><div className="atelier-floor-label"><b>{lang==='en'?'FLOOR':'PISO'} {formatFloor(f)}</b><small>{list.length.toLocaleString()} {words.roomsLabel}</small></div><div className="atelier-floor-rooms">{list.slice(0,8).map(r=><button type="button" className={'atelier-room-tile status-'+r.status} key={r.id} onClick={()=>onRoom(r.id)} aria-label={(lang==='en'?'Room ':'Habitación ')+r.number+' · '+statuses[r.status][lang]}><b>{r.number}</b><span>{statuses[r.status][lang]}</span></button>)}{list.length>8&&<button type="button" className="atelier-room-more" onClick={onRooms}>+{list.length-8}</button>}</div></div>})}{!rooms.length&&<div className="atelier-empty"><Hotel size={26}/>{words.empty}</div>}</div>
    <div className="atelier-floor-bottom"><div className="atelier-room-legend">{(['ready','occupied','dirty','cleaning','inspection','blocked'] as RoomStatus[]).map(s=><span key={s}><i className={'status-'+s}/>{statuses[s][lang]}</span>)}</div><button type="button" className="atelier-inline-link" onClick={onRooms}>{words.roomBoard} <ArrowUpRight size={15}/></button></div>
   </section>
   <section className="atelier-attention" aria-labelledby="atelier-attention-title"><span className="atelier-overline">{words.attention}</span><div className="atelier-attention-head"><h2 id="atelier-attention-title">{words.eyesHere}</h2><strong>{attentionCount.toString().padStart(2,'0')}</strong></div>
    <div className="atelier-attention-list">{attention.length?attention.map((item,i)=><button type="button" onClick={onTasks} key={item.id} className="atelier-attention-item"><span className="atelier-attention-idx">{String(i+1).padStart(2,'0')}</span><span><small className={item.priority==='urgent'?'urgent':''}>{item.type}</small><b>{item.summary}</b></span><ChevronRight size={19}/></button>):<div className="atelier-attention-clear"><CheckCircle2 size={28}/><b>{words.noAlerts}</b><p>{words.noAlertsDesc}</p></div>}</div>
    <div className="atelier-attention-footer"><div className="atelier-team-avatars">{activeMembers.slice(0,3).map(m=><span key={m.user_id} title={m.display_name}>{m.display_name.slice(0,2).toUpperCase()}</span>)}</div><span>{onShift} {lang==='en'?'on duty':'de turno'}</span><button type="button" onClick={onChat}>{words.chat}<MessageCircle size={15}/></button></div>
   </section>
  </div>
  <section className="atelier-handover" aria-label="Recent hotel activity"><div><span className="atelier-overline">{words.recent}</span><h2>{words.nothing}</h2></div><div className="atelier-handover-stream">{events.length?events.slice(0,3).map(e=><div key={e.id}><b>{new Date(e.at).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}</b><span>{e.message}</span></div>):<div><CheckCircle2 size={18}/><span>{words.noAlertsDesc}</span></div>}</div></section>
  {preview&&<div className="atelier-preview-label">{words.preview}</div>}
 </div>
}
