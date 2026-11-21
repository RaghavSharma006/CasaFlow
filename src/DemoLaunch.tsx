import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {db} from './db';
import './styles.css';
declare global{interface Window{turnstile?:{render:(el:HTMLElement,options:{sitekey:string,callback:(token:string)=>void,'expired-callback'?:()=>void,'error-callback'?:()=>void})=>string};}}
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
 const [role,setRole]=useState(new URLSearchParams(location.search).get('role')||'owner');
 const [challenge,setChallenge]=useState(''),[widget,setWidget]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const siteKey=import.meta.env.VITE_DEMO_TURNSTILE_SITE_KEY as string|undefined;
 useEffect(()=>{
  if(!siteKey)return;
  const render=()=>{const node=document.getElementById('demo-turnstile');if(node&&window.turnstile&&!widget){const id=window.turnstile.render(node,{sitekey:siteKey,callback:setChallenge,'expired-callback':()=>setChallenge(''),'error-callback':()=>setChallenge('')});setWidget(id)}};
  let script=document.querySelector<HTMLScriptElement>('script[data-cf-turnstile]');
  if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.cfTurnstile='1';script.onload=render;document.head.appendChild(script)}else render();
 },[siteKey,widget]);
 const launch=async()=>{if(!db){setError('The demo backend is not configured.');return}if(!challenge){setError('Complete the security check first.');return}setBusy(true);setError('');
  try{const response=await fetch('/api/demo/launch',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({role,turnstileToken:challenge})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to launch demo');
   sessionStorage.setItem('casaflow-demo-session','1');
   const {error:sessionError}=await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
   if(sessionError)throw sessionError;
   const destination=roles.find(r=>r.id===role)?.path||'/owner';
   location.replace(destination);
  }catch(e:any){sessionStorage.removeItem('casaflow-demo-session');setError(e?.message||'Unable to launch demo. Please retry.');setChallenge('')}
  finally{setBusy(false)}
 };
 return <main className="authpage"><section className="authcard" style={{maxWidth:620,width:'100%'}}>
  <div className="authheader"><div className="logo large">C</div><span className="tiny">CASAFLOW · INTERACTIVE DEMO</span></div>
  <h1>Explore CasaFlow</h1><p>Choose a hotel team role to open its real operations workspace.</p>
  <div className="form"><label>Choose a role<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r.id} value={r.id}>{r.name} — {r.detail}</option>)}</select></label>
   <div id="demo-turnstile" aria-label="Security verification" />
   {!siteKey&&<p className="tiny">Demo security verification is not configured yet.</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   <button className="button primary full" disabled={busy||!challenge||!siteKey} onClick={()=>void launch()}>{busy?'Opening secure demo…':'Open '+(roles.find(r=>r.id===role)?.name||'role')+' workspace'}</button>
   <a className="button outline full" href="/">Back to CasaFlow sign in</a>
   <p className="tiny">This is a shared demonstration workspace. Do not enter real guest or payment information. Demo access is limited to the demonstration hotel.</p>
  </div>
 </section></main>
}
