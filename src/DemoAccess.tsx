import React,{useEffect,useState,useRef} from 'react';
import QRCode from 'qrcode';
import {Building2,CheckCircle2,Clock3,ExternalLink,LogOut,RefreshCw,ShieldCheck,Users} from 'lucide-react';
import {db,parallelMode} from './db';
import './demo-access.css';

type TurnstileOptions={sitekey:string,callback:(token:string)=>void,'expired-callback'?:()=>void,'error-callback'?:()=>void};
declare global { interface Window { turnstile?: { render:(target:HTMLElement,options:TurnstileOptions)=>string, reset:(id?:string)=>void, remove?:(id:string)=>void } } }
const turnstileSiteKey=(import.meta as any).env?.VITE_DEMO_TURNSTILE_SITE_KEY as string|undefined;


const roles=[
 ['owner','Owner','Hotel-wide operations'],['manager','Manager','Staff, dispatch and escalations'],
 ['reception','Reception','Guest intake and room requests'],['supervisor','Supervisor','Inspections and approvals'],
 ['cleaner1','Cleaner 1','Housekeeping tasks'],['cleaner2','Cleaner 2','Housekeeping tasks'],
 ['ac','AC Technician','Air-conditioning maintenance'],['plumbing','Plumbing Technician','Plumbing maintenance'],
] as const;
const roleRoute:Record<string,string>={owner:'/owner',manager:'/manager',reception:'/desk',supervisor:'/supervisor',cleaner1:'/cleaner',cleaner2:'/cleaner',ac:'/technician',plumbing:'/technician'};

export function DemoLauncher(){
 const[active,setActive]=useState(false),[expiresAt,setExpiresAt]=useState(''),[guestUrl,setGuestUrl]=useState(''),[qr,setQr]=useState('');
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const[turnstileToken,setTurnstileToken]=useState('');const turnstileRef=useRef<HTMLDivElement>(null);const widgetId=useRef<string|undefined>(undefined);
 useEffect(()=>{
  const cached=sessionStorage.getItem('casaflow-demo-guest-url')||'';if(cached)setGuestUrl(cached);
  fetch('/api/demo/status',{cache:'no-store',credentials:'same-origin'}).then(r=>r.json()).then(v=>{if(v.active){setActive(true);setExpiresAt(v.expiresAt||'')}}).catch(()=>{});
 },[]);
 useEffect(()=>{
  if(!turnstileSiteKey)return;
  let cancelled=false;
  const renderWidget=()=>{
   if(cancelled||!window.turnstile||!turnstileRef.current||widgetId.current)return;
   widgetId.current=window.turnstile.render(turnstileRef.current,{
    sitekey:turnstileSiteKey,
    callback:(token)=>setTurnstileToken(token),
    'expired-callback':()=>setTurnstileToken(''),
    'error-callback':()=>setTurnstileToken(''),
   });
  };
  let script=document.querySelector<HTMLScriptElement>('script[data-cf-turnstile]');
  if(window.turnstile)renderWidget();
  else if(script){script.addEventListener('load',renderWidget);script.addEventListener('error',()=>setError('Security check could not load. Refresh and try again.'),{once:true});}
  else {
   script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.cfTurnstile='true';script.addEventListener('load',renderWidget,{once:true});script.addEventListener('error',()=>setError('Security check could not load. Refresh and try again.'),{once:true});document.head.appendChild(script);
  }
  return()=>{cancelled=true;if(widgetId.current&&window.turnstile?.remove)window.turnstile.remove(widgetId.current);widgetId.current=undefined};
 },[]);
 useEffect(()=>{
  if(!guestUrl){setQr('');return}
  QRCode.toDataURL(new URL(guestUrl,window.location.origin).toString(),{width:220,margin:2,errorCorrectionLevel:'H'}).then(setQr).catch(()=>setQr(''));
 },[guestUrl]);
 async function startDemo(){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/demo/start',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({turnstileToken})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to start the demo.');
   setActive(true);setExpiresAt(body.expiresAt||'');
   if(body.sampleGuestUrl){setGuestUrl(body.sampleGuestUrl);sessionStorage.setItem('casaflow-demo-guest-url',body.sampleGuestUrl)}
   setNotice('Your private demo hotel is ready. Every role has its own login and permissions.');
  }catch(e:any){setError(e?.message||'Unable to start the demo.')}finally{setBusy(false)}
 }
 function launch(role:string){if(active)window.open('/demo-role?parallel=1&role='+encodeURIComponent(role),'_blank','noopener,noreferrer')}
 function launchAll(){
  if(!active)return;
  for(const [role] of roles)window.open('/demo-role?parallel=1&role='+encodeURIComponent(role),'_blank','noopener,noreferrer');
  setNotice('Eight role tabs requested. If pop-ups are blocked, open each role separately.');
 }
 async function endDemo(){
  if(busy)return;setBusy(true);setError('');
  try{
   const response=await fetch('/api/demo/logout',{method:'POST',credentials:'same-origin'}),body=await response.json();
   if(!response.ok)throw new Error(body.error||'Unable to end this demo.');
   sessionStorage.removeItem('casaflow-demo-guest-url');setActive(false);setExpiresAt('');setGuestUrl('');
   setNotice('All role sessions for this demo workspace have been disabled.');
  }catch(e:any){setError(e?.message||'Unable to end the demo.')}finally{setBusy(false)}
 }
 return <main className="demo-access-page">
  <header className="demo-access-header"><div className="demo-access-brand"><span><Building2 size={19}/></span><b>CasaFlow</b></div><span className="demo-access-pill"><ShieldCheck size={14}/> Isolated interactive demo</span></header>
  <section className="demo-access-hero">
   <p className="demo-access-eyebrow">TRY THE REAL PRODUCT</p>
   <h1>One hotel. Eight roles. Your own private workspace.</h1>
   <p>Explore the live CasaFlow application using a temporary hotel workspace created just for this browser. Every role has its own real account and permissions. Other visitors cannot see your demo data.</p>
   {!active?{turnstileSiteKey&&<div className="demo-access-turnstile" ref={turnstileRef} aria-label="Complete the security check"/>}
   <button className="demo-access-primary" disabled={busy||(!!turnstileSiteKey&&!turnstileToken)} onClick={()=>void startDemo()}>{busy?<RefreshCw className="demo-access-spin" size={17}/>:<Users size={17}/>} {busy?'Preparing your hotel…':'Start my interactive demo'}</button>
   :<div className="demo-access-active"><CheckCircle2 size={18}/><div><b>Your demo hotel is ready</b><small>{expiresAt?'Automatically expires '+new Date(expiresAt).toLocaleTimeString():'Temporary session active'}</small></div></div>}
   {error&&<p className="demo-access-error" role="alert">{error}</p>}{notice&&<p className="demo-access-notice" role="status">{notice}</p>}
  </section>
  {active&&<>
   <div className="demo-access-toolbar"><div><h2>Choose a role</h2><p>Each role opens in a new tab with an independent session.</p></div><button className="demo-access-secondary" onClick={launchAll}><Users size={16}/> Launch all eight roles</button></div>
   <section className="demo-access-roles">{roles.map(([key,name,desc])=><article className="demo-access-role" key={key}><div className="demo-access-role-icon">{name.slice(0,1)}</div><div className="demo-access-role-copy"><b>{name}</b><small>{desc}</small></div><button onClick={()=>launch(key)}>Open <ExternalLink size={14}/></button></article>)}</section>
   {guestUrl&&<section className="demo-access-guest"><div><p className="demo-access-eyebrow">GUEST EXPERIENCE</p><h2>Try the room QR yourself</h2><p>Scan this sample room QR with your phone to submit a real request to this temporary hotel. Open the Owner or Reception tab to watch it arrive.</p><a href={guestUrl} target="_blank" rel="noopener noreferrer">Open guest portal <ExternalLink size={14}/></a></div>{qr&&<img src={qr} alt="Sample room guest request QR code"/>}</section>}
   <div className="demo-access-end"><span><Clock3 size={15}/> This workspace expires automatically after 45 minutes.</span><button onClick={()=>void endDemo()} disabled={busy}><LogOut size={15}/> End all demo sessions</button></div>
  </>}
 </main>;
}

export function DemoRoleBootstrap(){
 const[error,setError]=useState(''),[status,setStatus]=useState('Preparing secure role session…');
 useEffect(()=>{
  let cancelled=false;
  async function run(){
   const params=new URLSearchParams(window.location.search),role=params.get('role')||'';
   if(!Object.prototype.hasOwnProperty.call(roleRoute,role)){window.location.replace('/demo-launch');return}
   if(!parallelMode||!db){setError('This demo tab was not initialized correctly. Return to the demo launcher.');return}
   try{
    const response=await fetch('/api/demo/role-session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({role})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to create role session.');
    const {error:authError}=await db.auth.verifyOtp({token_hash:body.tokenHash,type:'magiclink'});
    if(authError)throw authError;
    if(cancelled)return;
    setStatus('Opening your '+role+' workspace…');
    window.location.replace(roleRoute[role]+'?parallel=1&demo=1');
   }catch(e:any){if(!cancelled)setError(e?.message||'Unable to sign in to this demo role.')}
  }
  void run();return()=>{cancelled=true};
 },[]);
 return <main className="demo-role-loading"><div className="demo-role-card"><div className="demo-access-role-icon"><Building2/></div><h1>CasaFlow Demo</h1><p>{error||status}</p>{error&&<a href="/demo-launch">Return to demo launcher</a>}</div></main>;
}
