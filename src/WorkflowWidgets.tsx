import React,{useState} from 'react';
import{AlertTriangle,ClipboardCheck,Clock,CheckCircle2,UserRound,Users,RefreshCw,Plus,ArrowRight,ShieldCheck}from'lucide-react';
import type{Role,Member,Dispatch,Task,Room,OpsAlert,GuestMeta}from'./db';
import{roleLabel}from'./db';
import'./workflow.css';

const openTask=(t:Task)=>t.status!=='done'&&t.status!=='cancelled';
const caption=(status:Task['status'])=>({open:'Waiting',doing:'In progress',inspection:'For inspection',done:'Done',cancelled:'Cancelled'})[status];
const num=(n:number)=>String(n).padStart(2,'0');

export function StaffWorkload({members,dispatch,tasks,rooms,onInvite,onEdit,viewerRole}:
 {members:Member[],dispatch:Dispatch[],tasks:Task[],rooms:Room[],onInvite:()=>void,onEdit:(id:string)=>void,viewerRole:Role}){
 const[filter,setFilter]=useState<'all'|'working'|'available'|'off'>('all');
 const staff=members.filter(m=>m.active);
 const summary=staff.map(m=>{const profile=dispatch.find(d=>d.user_id===m.user_id);const assigned=tasks.filter(t=>t.assigned_to===m.user_id);const active=assigned.filter(openTask);return {m,profile,assigned,active,working:active.some(t=>t.status==='doing'),available:profile?.on_shift===true&&!!profile?.shift_ends_at&&Date.parse(profile.shift_ends_at)>Date.now(),shiftTracked:true}});
 const filtered=summary.filter(s=>filter==='all'||(filter==='working'&&s.working)||(filter==='available'&&s.available)||(filter==='off'&&s.shiftTracked&&!s.available));
 const unassigned=tasks.filter(t=>openTask(t)&&!t.assigned_to);
 return <div className="wf-stack">
  <div className="wf-summary"><div><span>ACTIVE EMPLOYEES</span><strong>{num(staff.length)}</strong></div><div><span>ON SHIFT</span><strong>{num(summary.filter(s=>s.available).length)}</strong></div><div><span>ACTIVE ASSIGNMENTS</span><strong>{num(tasks.filter(t=>openTask(t)&&!!t.assigned_to).length)}</strong></div><div><span>NEEDS ASSIGNMENT</span><strong className={unassigned.length?'wf-attention':''}>{num(unassigned.length)}</strong></div></div>
  <section className="wf-panel"><div className="wf-panel-header"><div><span className="wf-kicker">PEOPLE / LIVE WORKLOAD</span><h2>Employee workload & responsibilities</h2><p>Who owns each job, what they're doing, and whether they're available.</p></div><button className="wf-button" onClick={onInvite}><Plus size={15}/> Invite employee</button></div>
   <div className="wf-filters">{([['all','Everyone'],['working','Working'],['available','On shift'],['off','Off shift']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
   <div className="wf-employee-list">{filtered.map(({m,profile,assigned,active,working,available,shiftTracked})=><article className="wf-employee" key={m.user_id}>
    <div className="wf-avatar">{m.display_name.slice(0,2).toUpperCase()}</div><div className="wf-person"><div className="wf-person-head"><strong>{m.display_name}</strong><span className="wf-role">{roleLabel[m.role]}</span>{shiftTracked?<span className={'wf-shift '+(available?'on':'off')}>{available?'On shift':'Off shift'}</span>:<span className="wf-shift">Shift not started</span>}</div>
    <p className="wf-job-numbers">{active.length} active · {active.filter(t=>t.status==='doing').length} in progress · {assigned.filter(t=>t.status==='done').length} completed{profile?.verified_skills?.length?' · Skills: '+profile.verified_skills.join(', '):''}</p>
    <div className="wf-current">{active.length?active.slice(0,3).map(t=><div className="wf-current-job" key={t.id}><span className={'wf-status-icon '+t.status}>{t.status==='doing'?<RefreshCw size={13}/>:<ClipboardCheck size={13}/>}</span><span>{t.title} · Room {rooms.find(r=>r.id===t.room_id)?.number||'—'}</span><em>{caption(t.status)}</em></div>):<span className="wf-no-work">{working?'Work being updated':'No assigned active work'}</span>}</div>
    </div>{shiftTracked&&viewerRole!=='frontdesk'&&<button className="wf-outline" onClick={()=>onEdit(m.user_id)}>Skills & shift length</button>}
   </article>)}{!filtered.length&&<p className="wf-empty">No employees match this filter.</p>}</div>
  </section>
  {unassigned.length>0&&<div className="wf-warning"><AlertTriangle size={18}/><div><strong>{unassigned.length} unassigned job{unassigned.length>1?'s':''}</strong><p>Automatic dispatch is waiting for an on-shift employee with the correct skills and capacity. No manual assignment is required.</p></div></div>}
 </div>
}

export function GuestIncidentDesk({alerts,tasks,rooms,members,guestMeta,role,onAck,busy}:
 {alerts:OpsAlert[],tasks:Task[],rooms:Room[],members:Member[],guestMeta:GuestMeta[],role:Role,onAck:(id:number)=>void,busy:boolean}){
 const guest=tasks.filter(t=>t.kind==='guest');const active=guest.filter(openTask);
 const unassigned=active.filter(t=>!t.assigned_to);
 const urgent=active.filter(t=>t.priority==='urgent');
 return <section className="wf-panel wf-guestdesk" aria-label="Guest complaint dispatch overview">
  <div className="wf-panel-header"><div><span className="wf-kicker">LIVE GUEST SERVICE DESK</span><h2>Complaints & dispatch</h2><p>Every received complaint stays tracked until a worker accepts and completes it.</p></div><div className="wf-guest-total"><strong>{active.length}</strong><span>Active</span></div></div>
  <div className="wf-summary"><div><span>RECEIVED</span><strong>{num(guest.length)}</strong></div><div><span>URGENT</span><strong className={urgent.length?'wf-attention':''}>{num(urgent.length)}</strong></div><div><span>UNASSIGNED</span><strong className={unassigned.length?'wf-attention':''}>{num(unassigned.length)}</strong></div><div><span>IN PROGRESS</span><strong>{num(active.filter(t=>t.status==='doing').length)}</strong></div></div>
  {alerts.length>0&&<div className="wf-alerts"><h3><AlertTriangle size={16}/> Requires attention</h3>{alerts.map(a=>{
   const t=tasks.find(t=>t.id===a.task_id);const rm=rooms.find(r=>r.id===t?.room_id);const employee=members.find(m=>m.user_id===t?.assigned_to);
   const allowAck=['owner','manager'].includes(role)||(role==='frontdesk'&&['frontdesk','both'].includes(a.target));
   return <div className="wf-alert" key={a.id}><span className="wf-alert-icon"><AlertTriangle size={18}/></span><div><strong>{a.body}</strong><small>{rm?'Room '+rm.number+' · ':''}{t?.assigned_to?'Assigned: '+(employee?.display_name||'Employee'):'Awaiting assignment'} · {t?.status==='doing'?'Worker accepted':'Not yet accepted'}</small></div>{allowAck&&<button className="wf-outline" disabled={busy} onClick={()=>onAck(a.id)}>Acknowledge</button>}</div>})}</div>}
  {unassigned.length>0&&<div className="wf-warning"><AlertTriangle size={17}/><p>{unassigned.length} guest request{unassigned.length>1?'s need':' needs'} a qualified employee. They will be assigned automatically when a qualified employee signs in or a current worker becomes available.</p></div>}
  <div className="wf-guest-instructions"><ShieldCheck size={17}/><span>Assignment and acceptance are separate steps. A complaint is not marked complete until the worker reports completion.</span></div>
 </section>
}

export function SyncFeedback({busy,lastSync,error}:{busy:boolean,lastSync:number|null,error:string}){
 return <div className="wf-sync-wrap" aria-live="polite"><span className="wf-sync-status">{busy?<><RefreshCw size={14} className="wf-spin"/> Updating live data…</>:lastSync?<> <CheckCircle2 size={14}/> Synced {new Date(lastSync).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</>:'Awaiting first sync'}</span>{error&&<div className="wf-error" role="alert"><AlertTriangle size={16}/>{error}</div>}</div>
}
