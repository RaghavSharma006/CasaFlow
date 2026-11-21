import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';

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
const consumedTickets=new Map<string,number>();
function ipOf(req:Req){const value=req.headers['x-forwarded-for'];return (Array.isArray(value)?value[0]:value||'unknown').split(',')[0].trim()}
function allowedOrigin(req:Req){const origin=req.headers.origin;const allow=(process.env.DEMO_ALLOWED_ORIGINS||'https://hotel-ops-pilot.vercel.app').split(',').map(x=>x.trim()).filter(Boolean);return typeof origin==='string'&&allow.includes(origin)}
function decodePart(value:string){return Buffer.from(value,'base64url').toString('utf8')}
function verifyCasaFlowTicket(ticket:string,role:string){
 const secret=process.env.CASAFLOW_DEMO_SHARED_SECRET;
 if(!secret||ticket.length>4096)return null;
 const parts=ticket.split('.');
 if(parts.length!==2)return null;
 const [payload,signature]=parts;
 const expected=createHmac('sha256',secret).update(payload).digest();
 let supplied:Buffer;
 try{supplied=Buffer.from(signature,'base64url')}catch{return null}
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
 try{
  const claims=JSON.parse(decodePart(payload)) as {iss?:string,aud?:string,role?:string,iat?:number,exp?:number,jti?:string};
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!=='https://casaflow.tech'||claims.aud!=='hotel-ops-pilot'||claims.role!==role||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||!claims.jti)return null;
  if(claims.iat!>now+10||claims.exp!<=now||claims.exp!-claims.iat!>120||now-claims.iat!>120)return null;
  for(const [id,expiry] of consumedTickets)if(expiry<=now)consumedTickets.delete(id);
  if(consumedTickets.has(claims.jti))return null;
  return claims;
 }catch{return null}
}
export default async function handler(req:Req,res:Res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Pragma','no-cache');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(!allowedOrigin(req))return res.status(403).json({error:'Origin not allowed'});
 const ip=ipOf(req),now=Date.now(),entry=attempts.get(ip);
 if(entry&&entry.reset>now&&entry.count>=8)return res.status(429).json({error:'Too many demo launch attempts. Try again later.'});
 if(!entry||entry.reset<=now)attempts.set(ip,{count:1,reset:now+60*60*1000});else entry.count++;
 const body=(req.body&&typeof req.body==='object'?req.body:{}) as {role?:unknown,ticket?:unknown};
 if(typeof body.role!=='string'||!Object.prototype.hasOwnProperty.call(roles,body.role)||typeof body.ticket!=='string')return res.status(400).json({error:'Open the demo from casaflow.tech to continue.'});
 const claims=verifyCasaFlowTicket(body.ticket,body.role);
 if(!claims)return res.status(403).json({error:'This CasaFlow demo link is invalid or expired. Return to casaflow.tech and launch it again.'});
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
 consumedTickets.set(claims.jti!,claims.exp!*1000);
 return res.status(200).json({access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at});
}
