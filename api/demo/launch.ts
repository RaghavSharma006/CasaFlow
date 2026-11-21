import { createClient } from '@supabase/supabase-js';

type Req={method?:string,headers:Record<string,string|string[]|undefined>,body?:unknown};
type Res={status:(n:number)=>Res,json:(v:unknown)=>void,setHeader:(k:string,v:string)=>void};
const roles:Record<string,{email:string,password:string,expectedRole:string}>={
 owner:{email:'DEMO_OWNER_EMAIL',password:'DEMO_OWNER_PASSWORD',expectedRole:'owner'},
 manager:{email:'DEMO_MANAGER_EMAIL',password:'DEMO_MANAGER_PASSWORD',expectedRole:'manager'},
 reception:{email:'DEMO_RECEPTION_EMAIL',password:'DEMO_RECEPTION_PASSWORD',expectedRole:'frontdesk'},
 supervisor:{email:'DEMO_SUPERVISOR_EMAIL',password:'DEMO_SUPERVISOR_PASSWORD',expectedRole:'supervisor'},
 cleaner1:{email:'DEMO_CLEANER1_EMAIL',password:'DEMO_CLEANER1_PASSWORD',expectedRole:'housekeeping'},
 cleaner2:{email:'DEMO_CLEANER2_EMAIL',password:'DEMO_CLEANER2_PASSWORD',expectedRole:'housekeeping'},
 'ac-technician':{email:'DEMO_AC_TECH_EMAIL',password:'DEMO_AC_TECH_PASSWORD',expectedRole:'maintenance'},
 'plumbing-technician':{email:'DEMO_PLUMBING_TECH_EMAIL',password:'DEMO_PLUMBING_TECH_PASSWORD',expectedRole:'maintenance'}
};
const attempts=new Map<string,{count:number,reset:number}>();
function ipOf(req:Req){const value=req.headers['x-forwarded-for'];return (Array.isArray(value)?value[0]:value||'unknown').split(',')[0].trim()}
function allowedOrigin(req:Req){const origin=req.headers.origin;const allow=(process.env.DEMO_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);return typeof origin==='string'&&allow.includes(origin)}
async function verifyTurnstile(token:string,ip:string){const secret=process.env.TURNSTILE_SECRET_KEY;if(!secret||!token)return false;const body=new URLSearchParams({secret,response:token,remoteip:ip});const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});if(!response.ok)return false;const result=await response.json() as {success?:boolean,hostname?:string};const hosts=(process.env.DEMO_ALLOWED_HOSTNAMES||'').split(',').map(x=>x.trim()).filter(Boolean);return result.success===true&&(!hosts.length||!!result.hostname&&hosts.includes(result.hostname))}
export default async function handler(req:Req,res:Res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(!allowedOrigin(req))return res.status(403).json({error:'Origin not allowed'});
 const ip=ipOf(req),now=Date.now(),entry=attempts.get(ip);
 if(entry&&entry.reset>now&&entry.count>=8)return res.status(429).json({error:'Too many demo launch attempts. Try again later.'});
 if(!entry||entry.reset<=now)attempts.set(ip,{count:1,reset:now+60*60*1000});else entry.count++;
 const body=(req.body&&typeof req.body==='object'?req.body:{}) as {role?:unknown,turnstileToken?:unknown};
 if(typeof body.role!=='string'||!Object.prototype.hasOwnProperty.call(roles,body.role)||typeof body.turnstileToken!=='string')return res.status(400).json({error:'Invalid demo launch request'});
 if(!await verifyTurnstile(body.turnstileToken,ip))return res.status(403).json({error:'Security verification failed. Refresh and try again.'});
 if(process.env.DEMO_PUBLIC_ENABLED!=='true'||process.env.DEMO_DATA_ISOLATED!=='true')return res.status(503).json({error:'The public demo is not enabled yet.'});
 const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,tenant=process.env.DEMO_TENANT_ID;
 if(!url||!key||!tenant)return res.status(503).json({error:'Demo backend is not configured.'});
 const selected=roles[body.role],email=process.env[selected.email],password=process.env[selected.password];
 if(!email||!password)return res.status(503).json({error:'This demo role is not configured yet.'});
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error||!data.session||!data.user)return res.status(401).json({error:'Unable to start this demo role.'});
 const {data:members,error:memberError}=await supabase.from('memberships').select('hotel_id,role,active').eq('user_id',data.user.id).eq('hotel_id',tenant).eq('active',true);
 const match=members?.some(m=>m.role===selected.expectedRole);
 if(memberError||!match){await supabase.auth.signOut({scope:'local'});return res.status(403).json({error:'Demo account is not assigned to the isolated demo workspace with the required role.'})}
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Pragma','no-cache');
 return res.status(200).json({access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
}
