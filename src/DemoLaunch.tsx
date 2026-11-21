import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {db} from './db';
import './styles.css';
const roles=[
 {id:'owner',name:'Owner',detail:'Hotel-wide overview and controls',path:'/owner'},
 {id:'manager',name:'Manager',detail:'Operations, staffing and oversight',path:'/manager'},
 {id:'reception',name:'Front Desk',detail:'Guest requests and reception workflow',path:'/desk'},
 {id:'supervisor',name:'Supervisor',detail:'Inspections and shift oversight',path:'/supervisor'},
 {id:'cleaner1',name:'Housekeeping · 1',detail:'Room cleaning tasks',path:'/cleaner'},
 {id:'cleaner2',name:'Housekeeping · 2',detail:'Room cleaning tasks',path:'/cleaner'},
 {id:'ac-technician',name:'AC Technician',detail:'Air-conditioning maintenance',path:'/technician'},
 {id:'plumbing-technician',name:'Plumbing Technician',detail:'Plumbing maintenance',path:'/technician'}
];
export default function DemoLaunch(){
 const params=new URLSearchParams(location.search);
 const [role]=useState(params.get('role')||'owner');
 const [ticket]=useState(params.get('ticket')||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const started=useRef(false);
 const launch=async()=>{
  if(!db){setError('The demo backend is not configured.');return}
  if(!ticket){setError('Please open this demo from casaflow.tech.');return}
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/demo/launch',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({role,ticket})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Unable to launch demo');
   sessionStorage.setItem('casaflow-demo-session','1');
   const {error:sessionError}=await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
   if(sessionError)throw sessionError;
   const destination=roles.find(r=>r.id===role)?.path||'/owner';
   location.replace(destination);
  }catch(e:any){
   sessionStorage.removeItem('casaflow-demo-session');
   setError(e?.message||'Unable to launch demo. Please retry.');
  }finally{setBusy(false)}
 };
 useEffect(()=>{
  if(params.has('ticket')){params.delete('ticket');const clean=params.toString();history.replaceState({},'',location.pathname+(clean?'?'+clean:''))}
  if(ticket&&!started.current){started.current=true;void launch()}
 },[]);
 const selected=roles.find(r=>r.id===role)||roles[0];
 return <main className="authpage"><section className="authcard" style={{maxWidth:620,width:'100%'}}>
  <div className="authheader"><div className="logo large">C</div><span className="tiny">CASAFLOW · INTERACTIVE DEMO</span></div>
  <h1>{busy?'Opening CasaFlow…':'Preparing your workspace'}</h1>
  <p>{busy?'Validating your secure demo access and opening the selected role.':'Selected role: '+selected.name+'.'}</p>
  <div className="form">
   {!ticket&&<p className="tiny">Launch this demo from casaflow.tech to receive secure access.</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   {busy&&<p className="tiny" role="status">Please wait. You will be taken directly to the workspace.</p>}
   {!busy&&error&&<a className="button primary full" href="https://casaflow.tech">Return to CasaFlow and try again</a>}
   <a className="button outline full" href="https://casaflow.tech">Back to CasaFlow</a>
   <p className="tiny">This is a shared demonstration workspace. Do not enter real guest or payment information. Demo access is limited to the demonstration hotel.</p>
  </div>
 </section></main>
}
