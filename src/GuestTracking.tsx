import React,{useEffect,useState} from 'react';
import {CheckCircle2,Clock3,HandPlatter,Send,RefreshCw,AlertCircle} from 'lucide-react';
import {rpc} from './db';
import './preview_portals.css';
import './guest-tracking.css';

const categories=[
 {id:'extra_towels',en:'Extra towels',es:'Toallas adicionales',dept:'Housekeeping',icon:'🛁'},
 {id:'broken_ac',en:'Broken AC',es:'Aire acondicionado averiado',dept:'Maintenance',icon:'❄️'},
 {id:'plumbing',en:'Plumbing problem',es:'Problema de plomería',dept:'Maintenance',icon:'🔧'},
 {id:'missing_supplies',en:'Missing supplies',es:'Faltan suministros',dept:'Housekeeping',icon:'🧴'},
 {id:'other',en:'Other request',es:'Otra solicitud',dept:'Reception',icon:'💬'},
] as const;
type Ticket={stage:string,work_status:string,title:string,category:string,room:string,hotel:string,priority:string,events:{type:string,time:string,note:string}[]};

export default function GuestTracking({lang,setLang,theme,setTheme}:{lang:'en'|'es',setLang:(v:'en'|'es')=>void,theme:string,setTheme:(v:string)=>void}){
 const params=new URLSearchParams(location.search),trackingToken=params.get('ticket')||'',qrToken=params.get('token')||'';
 const[selection,setSelection]=useState<(typeof categories)[number]['id']>('extra_towels'),[detail,setDetail]=useState(''),[urgent,setUrgent]=useState(false),[working,setWorking]=useState(false);
 const[room,setRoom]=useState<{hotel:string,room:string}|null>(null),[ticket,setTicket]=useState<Ticket|null>(null),[trackToken,setTrackToken]=useState(trackingToken),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const en=lang==='en',category=categories.find(c=>c.id===selection)!;
 useEffect(()=>{
  let alive=true;
  if(trackingToken)return;
  if(!qrToken){setError(en?'This guest link is missing its room token.':'Falta el código QR de habitación.');return}
  rpc<{hotel:string,room:string}>('guest_room_info',{p_token:qrToken}).then(v=>{if(alive)setRoom(v)}).catch(e=>{if(alive)setError(e?.message||'Invalid QR code.')});
  return()=>{alive=false};
 },[qrToken,trackingToken,en]);
 useEffect(()=>{
  if(!trackToken)return;let alive=true;
  const refresh=async()=>{try{const next=await rpc<Ticket>('guest_ticket_status',{p_tracking_token:trackToken});if(alive){setTicket(next);setError('')}}catch(e:any){if(alive)setError(e?.message||'Ticket unavailable.')}};
  void refresh();const timer=window.setInterval(()=>void refresh(),10000);
  return()=>{alive=false;window.clearInterval(timer)};
 },[trackToken]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setWorking(true);setError('');
  try{
   const created=await rpc<{task_id:string,tracking_token:string}>('submit_guest_request_tracked',{p_token:qrToken,p_category:selection,p_detail:detail,p_urgent:urgent});
   setTrackToken(created.tracking_token);history.replaceState(null,'','/guest?ticket='+encodeURIComponent(created.tracking_token));
  }catch(e:any){setError(e?.message||'Request could not be submitted.')}finally{setWorking(false)}
 }
 async function respond(resolved:boolean){
  if(!trackToken||working)return;setWorking(true);setError('');
  try{const next=await rpc<Ticket>('guest_ticket_feedback',{p_tracking_token:trackToken,p_resolved:resolved,p_comment:feedback});setTicket(next);setFeedback('')}
  catch(e:any){setError(e?.message||'Feedback could not be submitted.')}finally{setWorking(false)}
 }
 const stageLabel=(stage:string)=>({
  open:en?'Request received':'Solicitud recibida',
  working:en?'Staff is working on it':'El personal está trabajando',
  awaiting_guest:en?'Please confirm the resolution':'Confirme la resolución',
  confirmed:en?'Resolved by guest':'Resuelto por el huésped',
  reopened:en?'Reopened for follow-up':'Reabierto para seguimiento',
  cancelled:en?'Cancelled':'Cancelado',
 } as Record<string,string>)[stage]||stage;
 return <div className="authpage"><div className="authcard guest guest-categories">
  <div className="authheader"><div className="logo large"><HandPlatter/></div><button className="headerbtn" onClick={()=>setLang(en?'es':'en')}>{en?'ES':'EN'}</button><button className="headerbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'Light':'Dark'}</button></div>
  {!trackToken?<><h1>{en?'How can we help?':'¿En qué podemos ayudar?'}</h1><p>{room?room.hotel+' · '+(en?'Room':'Habitación')+' '+room.room:(en?'Checking room QR…':'Verificando QR…')}</p>
   {room&&!error&&<form className="form" onSubmit={submit}>
    <div className="guest-choice-list" role="radiogroup">{categories.map(c=><label className={'guest-choice '+(selection===c.id?'chosen':'')} key={c.id}><input type="radio" name="guest-category" checked={selection===c.id} onChange={()=>{setSelection(c.id);setUrgent(false)}}/><span>{c.icon}</span><strong>{en?c.en:c.es}</strong><CheckCircle2 size={19}/></label>)}</div>
    <div className="guest-routed"><small>{en?'Automatically routed to':'Enviado automáticamente a'}</small><b>{category.dept}</b></div>
    <label>{en?'Extra details (optional)':'Detalles adicionales (opcional)'}<textarea maxLength={1200} rows={3} value={detail} onChange={e=>setDetail(e.target.value)} placeholder={en?'Tell us what happened…':'Describa lo que sucedió…'}/></label>
    {!['extra_towels','missing_supplies'].includes(selection)&&<label className="checkline"><input type="checkbox" checked={urgent} onChange={e=>setUrgent(e.target.checked)}/>{en?'Urgent: serious issue needing immediate attention':'Urgente: problema grave que requiere atención inmediata'}</label>}
    <button disabled={working} className="button primary full">{working?(en?'Sending…':'Enviando…'):(en?'Send request':'Enviar solicitud')}<Send size={16}/></button>
   </form>}
  </>:<><h1>{en?'Track your request':'Seguimiento de su solicitud'}</h1><p>{ticket?ticket.hotel+' · '+(en?'Room':'Habitación')+' '+ticket.room:(en?'Loading ticket…':'Cargando solicitud…')}</p>
    {ticket&&<div className="guest-tracking-panel"><div className="guest-ticket-status"><span><Clock3 size={16}/>{stageLabel(ticket.stage)}</span><b>{ticket.title}</b><small>{en?'Work status':'Estado de trabajo'}: {ticket.work_status}</small></div>
    <div className="guest-ticket-timeline">{(ticket.events||[]).slice().reverse().map((ev,i)=><div key={i}><i/><span><b>{ev.type.replaceAll('_',' ')}</b><small>{new Date(ev.time).toLocaleString()} {ev.note?' · '+ev.note:''}</small></span></div>)}</div>
    {ticket.stage==='awaiting_guest'&&<div className="guest-ticket-feedback"><h3>{en?'Was your request resolved?':'¿Se resolvió su solicitud?'}</h3><textarea maxLength={600} rows={2} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder={en?'Optional feedback…':'Comentarios opcionales…'}/><div><button className="button primary" disabled={working} onClick={()=>void respond(true)}><CheckCircle2 size={16}/>{en?'Yes, resolved':'Sí, resuelto'}</button><button className="button outline" disabled={working} onClick={()=>void respond(false)}><AlertCircle size={16}/>{en?'No, still unresolved':'No, sigue sin resolverse'}</button></div></div>}
    {ticket.stage==='confirmed'&&<p className="success"><CheckCircle2 size={18}/>{en?'Thank you for confirming.':'Gracias por confirmar.'}</p>}
    <button className="button outline full" onClick={()=>location.reload()}><RefreshCw size={15}/>{en?'Refresh status':'Actualizar estado'}</button></div>}
   </>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="tiny">{en?'This secure tracking link is private to your request. Do not share it with other guests.':'Este enlace es privado para su solicitud. No lo comparta.'}</p>
 </div></div>;
}
