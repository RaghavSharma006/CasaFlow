import {createClient, type SupabaseClient} from '@supabase/supabase-js';

export type Role='owner'|'manager'|'frontdesk'|'supervisor'|'housekeeping'|'maintenance';
export type RoomStatus='occupied'|'dirty'|'cleaning'|'inspection'|'ready'|'blocked';
export type TaskStatus='open'|'doing'|'inspection'|'done'|'cancelled';
export type TaskKind='cleaning'|'maintenance'|'guest'|'supply'|'damage';
export type Hotel={id:string,name:string,city:string,preferred_language:string};
export type Member={hotel_id:string,user_id:string,display_name:string,role:Role,active:boolean};
export type Room={id:string,hotel_id:string,number:string,floor:string,kind:string,status:RoomStatus,version:number,updated_at:string};
export type Task={id:string,hotel_id:string,room_id:string,kind:TaskKind,title:string,detail:string,priority:'normal'|'high'|'urgent',status:TaskStatus,assigned_to:string|null,created_by:string|null,version:number,created_at:string,updated_at:string,completed_at:string|null};
export type Event={id:number,hotel_id:string,room_id:string|null,task_id:string|null,actor_id:string|null,message:string,at:string};
export type Message={id:number,hotel_id:string,room_id:string|null,sender_id:string|null,body:string,created_at:string};
export type PrivateMessage={id:number,hotel_id:string,recipient_kind:'owner'|'frontdesk',thread_user_id:string,sender_id:string,body:string,created_at:string};
export type Dispatch={hotel_id:string,user_id:string,on_shift:boolean,max_open_tasks:number,verified_skills:string[],shift_started_at:string|null,shift_ends_at:string|null,shift_duration_minutes:number,updated_at:string};
export type GuestMeta={task_id:string,hotel_id:string,category:string,department:string,urgent:boolean,accepted_at:string|null,escalated_at:string|null,ack_deadline:string|null,assigned_at:string|null};
export type OpsAlert={id:number,hotel_id:string,task_id:string,reason:'urgent'|'no_worker'|'unaccepted',target:'management'|'frontdesk'|'both',body:string,created_at:string,acknowledged_at:string|null};
export type Data={staffDispatch:Dispatch[],guestMeta:GuestMeta[],alerts:OpsAlert[],hotels:Hotel[],memberships:Member[],rooms:Room[],tasks:Task[],activity:Event[],messages:Message[],privateMessages:PrivateMessage[]};
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=Boolean(url&&key);
// Test-mode sessions are isolated per browser tab. Ordinary CasaFlow sessions
// continue to use the default persistent Supabase storage unchanged.
const PARALLEL_FLAG='casaflow-parallel-active';
export const parallelMode=typeof window!=='undefined'&&(
 new URLSearchParams(window.location.search).get('parallel')==='1'||
 window.sessionStorage.getItem(PARALLEL_FLAG)==='1'
);
let parallelAuthKey: string | undefined;
if(parallelMode){
 window.sessionStorage.setItem(PARALLEL_FLAG,'1');
 let tabId=window.sessionStorage.getItem('casaflow-parallel-tab-id');
 if(!tabId){
  tabId=window.crypto.randomUUID();
  window.sessionStorage.setItem('casaflow-parallel-tab-id',tabId);
 }
 parallelAuthKey=`casaflow-parallel-${tabId}-auth-token`;
}
// A distinct storageKey also prevents Supabase auth BroadcastChannel events
// from overwriting sessions in the other parallel-test tabs.
export const hotelStorage:Storage=parallelMode?window.sessionStorage:window.localStorage;
export const db:SupabaseClient|null=configured?createClient(url,key,{
 auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,
 ...(parallelMode?{storage:window.sessionStorage,storageKey:parallelAuthKey}:{})}
}):null;
// Supabase's default query cap is 1,000 rows. Fetch room pages in batches and
// fail explicitly past the supported client-scale limit rather than silently hiding rooms.
export async function fetchHotelRooms(hotelId:string):Promise<Room[]>{
 if(!db)throw Error('Backend not configured');
 const PAGE=1000, MAX=5000;const result:Room[]=[];
 for(let offset=0;offset<=MAX;offset+=PAGE){
  const {data,error}=await db.from('rooms')
   .select('id,hotel_id,number,floor,kind,status,version,updated_at')
   .eq('hotel_id',hotelId).order('number').range(offset,offset+PAGE-1);
  if(error)throw error;
  const page=(data||[]) as Room[];
  if(offset===MAX && page.length)throw Error('Room limit exceeded: contact support to enable server-side pagination.');
  result.push(...page);
  if(page.length<PAGE)break;
 }
 return result;
}
export async function queryData(hotelId:string):Promise<Data>{
 if(!db)throw Error('Backend not configured');
 const [a,b,rooms,d,e,f,g,h,i,j]=await Promise.all([
 db.from('hotels').select('id,name,city,preferred_language').eq('id',hotelId),
 db.from('memberships').select('hotel_id,user_id,display_name,role,active').eq('hotel_id',hotelId),
 fetchHotelRooms(hotelId),
 db.from('tasks').select('id,hotel_id,room_id,kind,title,detail,priority,status,assigned_to,created_by,version,created_at,updated_at,completed_at').eq('hotel_id',hotelId).order('created_at',{ascending:false}).limit(300),
 db.from('activity').select('id,hotel_id,room_id,task_id,actor_id,message,at').eq('hotel_id',hotelId).order('at',{ascending:false}).limit(80),
 db.from('messages').select('id,hotel_id,room_id,sender_id,body,created_at').eq('hotel_id',hotelId).is('room_id',null).order('created_at',{ascending:false}).limit(100),
 db.from('private_messages').select('id,hotel_id,recipient_kind,thread_user_id,sender_id,body,created_at').eq('hotel_id',hotelId).order('created_at',{ascending:false}).limit(200),
 db.from('staff_dispatch').select('hotel_id,user_id,on_shift,max_open_tasks,verified_skills,shift_started_at,shift_ends_at,shift_duration_minutes,updated_at').eq('hotel_id',hotelId),
 db.from('guest_request_meta').select('task_id,hotel_id,category,department,urgent,accepted_at,escalated_at,ack_deadline,assigned_at').eq('hotel_id',hotelId).order('created_at',{ascending:false}).limit(300),
 db.from('ops_alerts').select('id,hotel_id,task_id,reason,target,body,created_at,acknowledged_at').eq('hotel_id',hotelId).is('acknowledged_at',null).order('created_at',{ascending:false}).limit(100)
 ]);
 for(const result of [a,b,d,e,f,g,h,i,j])if(result.error)throw result.error;
 return {hotels:a.data as Hotel[],memberships:b.data as Member[],rooms,tasks:d.data as Task[],activity:e.data as Event[],messages:f.data as Message[],privateMessages:g.data as PrivateMessage[],staffDispatch:h.data as Dispatch[],guestMeta:i.data as GuestMeta[],alerts:j.data as OpsAlert[]};
}
export async function rpc<T=unknown>(name:string,params:Record<string,unknown>):Promise<T>{
 if(!db)throw Error('Backend not configured');
 const {data,error}=await db.rpc(name,params);if(error)throw error;return data as T;
}
export const isStale=(msg:string)=>/conflict|40001|serialization|version/i.test(msg);
export const roleLabel:Record<Role,string>={owner:'Owner',manager:'Manager',frontdesk:'Front Desk',supervisor:'Supervisor',housekeeping:'Housekeeping',maintenance:'Maintenance'};
export const roomLabel:Record<RoomStatus,string>={occupied:'Occupied',dirty:'Dirty',cleaning:'Cleaning',inspection:'Inspection',ready:'Ready',blocked:'Blocked'};
