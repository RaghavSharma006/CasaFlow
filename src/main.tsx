import React,{useState,useEffect,useCallback,useRef,useMemo} from 'react';
import DemoLaunch from './DemoLaunch';
import{createRoot}from'react-dom/client';
import{Building2,LayoutDashboard,BedDouble,Brush,Wrench,HandPlatter,Users,MessageSquare,Activity,Settings,Plus,Search,Sun,Moon,Languages,ArrowRight,CheckCircle2,Clock,AlertTriangle,RefreshCw,LogOut,Menu,X,ChevronDown,KeyRound,Copy,ShieldCheck,Columns3,ClipboardCheck,DoorOpen,PackageMinus,ChartNoAxesColumnIncreasing,MapPin,Loader2,Lock,Mail,Send,Link,UserRound,Calendar,Info}from'lucide-react';
import QRCode from 'qrcode';
import DevSandbox from './demo';
import CasaOverview from './CasaOverview';
import CasaRoomBoard from './CasaRoomBoard';
import{StaffWorkload,GuestIncidentDesk,SyncFeedback}from './WorkflowWidgets';
import AtelierPreview from './AtelierPreview';
import{db,configured,parallelMode,hotelStorage,queryData,rpc,isStale,roomLabel,roleLabel,type Role,type Room,type RoomStatus,type Task,type TaskKind,type Member,type Data}from'./db';
import'./styles.css';
import'./atelier.css';
import'./atelier_exact.css';
import'./casa_v8.css';
import'./preview_portals.css';

const labels={
 en:{overview:'Overview',rooms:'Room Board',cleaning:'Housekeeping',maintenance:'Maintenance',requests:'Guest Requests',team:'Staff & Roles',messages:'Chats & Inbox',activity:'Activity Log',settings:'Settings',management:'Management',reception:'Front Desk',work:'My Tasks',operations:'OPERATIONS',workspace:'WORKSPACE',online:'Connected',syncing:'Syncing',offline:'Disconnected',welcome:'Hotel operations, all in sync.',sub:'One live workspace for every department.',total:'Total Rooms',occupied:'Occupied',dirty:'Dirty',blocked:'Blocked',ready:'Ready to Sell',pending:'Pending Tasks',urgent:'High Priority',roomBoard:'Room status at a glance',activityTitle:'Recent Activity',allRooms:'All Rooms',newTask:'New Task',checkout:'Check Out',advance:'Advance',start:'Start Work',inspect:'Send to Inspection',approve:'Approve & Release',complete:'Complete',cleaningTask:'Cleaning',maintenanceTask:'Repair',guestTask:'Guest Request',supplyTask:'Supply Shortage',damageTask:'Damage Report',room:'Room',kind:'Type',priority:'Priority',title:'Title',detail:'Details',assignee:'Assign To',open:'Open',doing:'In Progress',inspection:'Inspection',done:'Completed',cancelled:'Cancelled',all:'All',search:'Search rooms or work...',noTasks:'Nothing to show here yet.',noMessages:'No messages yet. Start a conversation.',newMessage:'Message your team...',send:'Send',global:'All team',roomChat:'Room conversation',language:'Language',theme:'Appearance',dark:'Dark',light:'Light',logout:'Sign Out',hotel:'Hotel',addRoom:'Add Room',bulkRooms:'Bulk Add Rooms',bulkAdd:'Bulk create',oneRoom:'Single room',roomRange:'Room number range',firstRoom:'First room number',lastRoom:'Last room number',floorMode:'Floor assignment',autoFloor:'Automatic from number',fixedFloor:'One floor for all',digits:'Minimum digits (leading zeros)',duplicateNotice:'Existing room numbers are skipped',showMore:'Show 40 more',showing:'Showing',devMode:'Development sandbox',openDemo:'Open test environment',floor:'Floor',roomType:'Room Type',save:'Save',cancel:'Cancel',invite:'Invite Employee',inviteRole:'Employee Role',inviteLink:'Invitation Link',guestQR:'Guest QR',guestPortal:'Guest Request Form',guestTitle:'How can we help?',guestInfo:'Your request will be sent directly to the hotel team.',submit:'Send Request',success:'Your request has been received.',error:'Something went wrong',retry:'Retry',refresh:'Refresh',enterName:'Hotel Name',enterCity:'City',createHotel:'Create Your Hotel',joinHotel:'Join With Invitation',join:'Join Team',login:'Sign In',signup:'Create Account',email:'Email',password:'Password',name:'Your Name',noHotel:'Start with a hotel or accept a staff invitation.',demoDisabled:'Backend configuration required',demoExplain:'This release uses live Supabase data. Set up an isolated database and configure deployment environment variables to enable staff access.',status:'Status',assigned:'Assigned',unassigned:'Unassigned',turnover:'Checkout → Cleaning → Inspection → Ready',emptyRooms:'No rooms yet. Add your first room.',allDepartments:'Every department, one source of truth',time:'Time',people:'People',wait:'Please wait...',newHotel:'Hotel Setup',guestCodeInvalid:'Guest access is invalid or expired',guestRate:'Requests are rate-limited to protect staff from spam',overdue:'Needs attention',live:'Realtime',connection:'Connection',selectedRoom:'Selected room',roomTimeline:'Room history',roomRequests:'Room tasks',messageRoom:'Discuss this room',inviteCopy:'Copy token',guestLinkCopy:'Copy Guest Link',checkin:'Check In'},
 es:{overview:'Resumen',rooms:'Habitaciones',cleaning:'Limpieza',maintenance:'Mantenimiento',requests:'Solicitudes',team:'Equipo y Roles',messages:'Chat y mensajes privados',activity:'Actividad',settings:'Configuración',management:'Gerencia',reception:'Recepción',work:'Mis Tareas',operations:'OPERACIONES',workspace:'ESPACIO DE TRABAJO',online:'Conectado',syncing:'Sincronizando',offline:'Desconectado',welcome:'Operaciones del hotel, sincronizadas.',sub:'Un espacio en vivo para todos los departamentos.',total:'Habitaciones',occupied:'Ocupadas',dirty:'Sucia',blocked:'Bloqueada',ready:'Listas',pending:'Tareas pendientes',urgent:'Alta prioridad',roomBoard:'Estado de habitaciones',activityTitle:'Actividad reciente',allRooms:'Todas',newTask:'Nueva tarea',checkout:'Registrar salida',advance:'Avanzar',start:'Empezar',inspect:'Enviar a inspección',approve:'Aprobar habitación',complete:'Completar',cleaningTask:'Limpieza',maintenanceTask:'Reparación',guestTask:'Solicitud',supplyTask:'Faltan suministros',damageTask:'Daños',room:'Habitación',kind:'Tipo',priority:'Prioridad',title:'Título',detail:'Detalles',assignee:'Asignar a',open:'Pendiente',doing:'En progreso',inspection:'Inspección',done:'Terminado',cancelled:'Cancelado',all:'Todas',search:'Buscar habitaciones o tareas...',noTasks:'No hay tareas.',noMessages:'Sin mensajes. Inicia una conversación.',newMessage:'Mensaje para el equipo...',send:'Enviar',global:'Todo el equipo',roomChat:'Conversación de habitación',language:'Idioma',theme:'Apariencia',dark:'Oscuro',light:'Claro',logout:'Cerrar sesión',hotel:'Hotel',addRoom:'Añadir habitación',bulkRooms:'Añadir habitaciones por lote',bulkAdd:'Crear en lote',oneRoom:'Una habitación',roomRange:'Rango de números',firstRoom:'Primera habitación',lastRoom:'Última habitación',floorMode:'Asignar planta',autoFloor:'Automática desde el número',fixedFloor:'Una planta para todas',digits:'Dígitos mínimos (ceros iniciales)',duplicateNotice:'Los números existentes se omiten',showMore:'Mostrar 40 más',showing:'Mostrando',devMode:'Entorno de pruebas',openDemo:'Abrir demostración',floor:'Planta',roomType:'Tipo',save:'Guardar',cancel:'Cancelar',invite:'Invitar empleado',inviteRole:'Rol',inviteLink:'Enlace de invitación',guestQR:'QR del huésped',guestPortal:'Solicitud del huésped',guestTitle:'¿En qué podemos ayudar?',guestInfo:'Su solicitud se enviará al equipo del hotel.',submit:'Enviar solicitud',success:'Solicitud recibida.',error:'Ha ocurrido un error',retry:'Reintentar',refresh:'Actualizar',enterName:'Nombre del hotel',enterCity:'Ciudad',createHotel:'Crear hotel',joinHotel:'Unirse con invitación',join:'Unirse',login:'Iniciar sesión',signup:'Crear cuenta',email:'Correo',password:'Contraseña',name:'Tu nombre',noHotel:'Crea un hotel o acepta una invitación.',demoDisabled:'Configuración del servidor requerida',demoExplain:'Este sistema utiliza Supabase. Configure la base de datos aislada y las variables de entorno.',status:'Estado',assigned:'Asignado',unassigned:'Sin asignar',turnover:'Salida → Limpieza → Inspección → Lista',emptyRooms:'No hay habitaciones. Añade una.',allDepartments:'Todos los departamentos conectados',time:'Hora',people:'Personas',wait:'Espera...',newHotel:'Configurar hotel',guestCodeInvalid:'Acceso inválido o caducado',guestRate:'Las solicitudes tienen límites para evitar abusos',overdue:'Necesita atención',live:'Tiempo real',connection:'Conexión',selectedRoom:'Habitación',roomTimeline:'Historial',roomRequests:'Tareas de habitación',messageRoom:'Hablar de esta habitación',inviteCopy:'Copiar código',guestLinkCopy:'Copiar enlace',checkin:'Registrar entrada'}
} as const;
type L=Record<keyof typeof labels.en,string>;
type View='overview'|'rooms'|'cleaning'|'maintenance'|'requests'|'team'|'messages'|'activity'|'settings';
const rStatuses:RoomStatus[]=['occupied','dirty','cleaning','inspection','ready','blocked'];
const kindTitle=(kind:TaskKind,t:L)=>({cleaning:t.cleaningTask,maintenance:t.maintenanceTask,guest:t.guestTask,supply:t.supplyTask,damage:t.damageTask})[kind];
function useTheme(){const [theme,setTheme]=useState(localStorage.getItem('casaflow-theme')||'light');useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('casaflow-theme',theme)},[theme]);return[theme,setTheme]as const}
function useLang(){const [lang,setLang]=useState<'en'|'es'>(localStorage.getItem('casaflow-language')==='es'?'es':'en');useEffect(()=>{document.documentElement.lang=lang;localStorage.setItem('casaflow-language',lang)},[lang]);return[lang,setLang]as const}
function IconButton({children,onClick,title}:{children:React.ReactNode,onClick:()=>void,title?:string}){return <button className="iconbutton" type="button" onClick={onClick} title={title}>{children}</button>}
function Pill({children,tone='subtle'}:{children:React.ReactNode,tone?:string}){return <span className={'pill '+tone}>{children}</span>}
const statusTone=(s:string)=>'tone-'+s;
function Toast({value}:{value:string}){return value?<div className="toast"><Info size={17}/>{value}</div>:null}
function App(){
 const[lang,setLang]=useLang(),[theme,setTheme]=useTheme();const t=labels[lang];
 const [session,setSession]=useState<any>(null),[checking,setChecking]=useState(true);
 const[hotel,setHotel]=useState<string|null>(hotelStorage.getItem('casaflow-hotel'));
 const[data,setData]=useState<Data>({hotels:[],memberships:[],rooms:[],tasks:[],activity:[],messages:[],privateMessages:[],staffDispatch:[],guestMeta:[],alerts:[]});
 const[view,setView]=useState<View>('overview'),[roomId,setRoomId]=useState<string|null>(null);
 const[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[modal,setModal]=useState<'task'|'room'|'invite'|'qr'|'dispatch'|null>(null);
 const[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[sync,setSync]=useState<'connecting'|'live'|'offline'>('connecting'),[menu,setMenu]=useState(false),[moreOpen,setMoreOpen]=useState(false);
 const[refreshing,setRefreshing]=useState(false),[lastSync,setLastSync]=useState<number|null>(null),[lastError,setLastError]=useState(''),[workingId,setWorkingId]=useState<string|null>(null);
 const[chatMode,setChatMode]=useState<'common'|'owner'|'frontdesk'>('common'),[threadUser,setThreadUser]=useState(''),[message,setMessage]=useState('');
 const[editStaff,setEditStaff]=useState<string>(''),[qrRoomId,setQrRoomId]=useState<string>('');
 const[roomLimit,setRoomLimit]=useState<Partial<Record<RoomStatus,number>>>({});
 const inFlight=useRef<Promise<void>|null>(null),queued=useRef(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),chatTimer=useRef<ReturnType<typeof setTimeout>|null>(null),refreshRef=useRef<()=>void>(()=>{}),refreshChatRef=useRef<()=>void>(()=>{});
 const notify=(v:string)=>{setToast(v);setTimeout(()=>setToast(''),4000)};
 const [signingOut,setSigningOut]=useState(false);
 const signOut=async()=>{
  if(!db||signingOut)return;
  setSigningOut(true);
  try{
   if(hotel&&!parallelMode){try{await rpc('end_work_shift',{p_hotel:hotel})}catch{/* The scheduled expiry worker will finalize an offline sign-out. */}}
   const {error}=await db.auth.signOut(parallelMode?{scope:'local'}:undefined);
   if(error)throw error;
   setSession(null);setHotel(null);setMenu(false);setMoreOpen(false);
   hotelStorage.removeItem('casaflow-hotel');
   if(parallelMode){window.sessionStorage.removeItem('casaflow-parallel-active');window.sessionStorage.removeItem('casaflow-demo-session');}
   window.location.replace('/');
  }catch(err:any){notify(err?.message||'Unable to sign out. Try again.')}
  finally{setSigningOut(false)}
 };
 useEffect(()=>{if(!db){setChecking(false);return}db.auth.getSession().then(({data,error})=>{if(error)notify(error.message);setSession(data.session);}).catch(()=>notify('Unable to restore login. Check your connection and refresh.')).finally(()=>setChecking(false));const{subscription}=db.auth.onAuthStateChange((_evt,s)=>{setSession(s);if(!s){setHotel(null);hotelStorage.removeItem('casaflow-hotel')}}).data;return()=>subscription.unsubscribe()},[]);
 const load=useCallback(async()=>{
  if(!db||!session?.user)return;
  if(inFlight.current){queued.current=true;await inFlight.current;return;}
  const request=(async()=>{try{
    const{data:memberRows,error}=await db.from('memberships').select('hotel_id,user_id,display_name,role,active').eq('user_id',session.user.id).eq('active',true);
    if(error)throw error;
    const memberships=memberRows||[];
    if(!memberships.length){setHotel(null);setData(d=>({...d,memberships:[]}));setSync('live');return}
    const valid=memberships.some(m=>m.hotel_id===hotel)?hotel:memberships[0].hotel_id;
    if(valid!==hotel){setHotel(valid);hotelStorage.setItem('casaflow-hotel',valid!)}
    if(!parallelMode){
     const shift=await db.from('staff_dispatch').select('shift_started_at,shift_ends_at,on_shift').eq('hotel_id',valid!).eq('user_id',session.user.id).maybeSingle();
     if(shift.error)throw shift.error;
     if(shift.data?.shift_started_at&&(!shift.data.on_shift||!shift.data.shift_ends_at||Date.parse(shift.data.shift_ends_at)<=Date.now())){
       await db.auth.signOut();setSession(null);setHotel(null);hotelStorage.removeItem('casaflow-hotel');notify('Your shift has ended. Sign in to begin your next shift.');return;
     }
     const [next]=await Promise.all([queryData(valid!),!shift.data?.shift_started_at?rpc('begin_work_shift',{p_hotel:valid!}):Promise.resolve(null)]);
     setData(next);setLastSync(Date.now());setLastError('');setSync('live');
    }else{
     const next=await queryData(valid!);setData(next);setLastSync(Date.now());setLastError('');setSync('live');
    }
  }catch(err:any){setSync('offline');setLastError(err.message||String(err));notify(err.message||String(err))}})();
  inFlight.current=request;
  try{await request;}finally{
    inFlight.current=null;
    if(queued.current){queued.current=false;setTimeout(()=>refreshRef.current(),350)}
  }
 },[session?.user?.id,hotel]);
 useEffect(()=>{refreshRef.current=()=>{void load()}},[load]);useEffect(()=>{void load()},[load]);
 useEffect(()=>{const onShift=()=>void load();window.addEventListener('casaflow-shift-started',onShift);return()=>window.removeEventListener('casaflow-shift-started',onShift)},[load]);
 const refreshChats=useCallback(async()=>{
  if(!db||!hotel||!session?.user)return;
  const [c,p]=await Promise.all([
   db.from('messages').select('id,hotel_id,room_id,sender_id,body,created_at').eq('hotel_id',hotel).is('room_id',null).order('created_at',{ascending:false}).limit(100),
   db.from('private_messages').select('id,hotel_id,recipient_kind,thread_user_id,sender_id,body,created_at').eq('hotel_id',hotel).order('created_at',{ascending:false}).limit(200)
  ]);
  if(c.error||p.error){notify((c.error||p.error)?.message||'Chat could not refresh');return}
  setData(prev=>({...prev,messages:c.data as Data['messages'],privateMessages:p.data as Data['privateMessages']}));
 },[hotel,session?.user?.id]);
 useEffect(()=>{refreshChatRef.current=()=>{void refreshChats()}},[refreshChats]);
 useEffect(()=>{if(!db||!session||!hotel)return;
  const channel=db.channel('casaflow-'+hotel+'-'+Math.random().toString(36).slice(2))
  .on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'hotel_id=eq.'+hotel},()=>scheduleChat())
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:'hotel_id=eq.'+hotel},()=>scheduleChat())
  .on('postgres_changes',{event:'*',schema:'public',table:'activity',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'guest_request_meta',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'ops_alerts',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'staff_dispatch',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .on('postgres_changes',{event:'*',schema:'public',table:'memberships',filter:'hotel_id=eq.'+hotel},()=>schedule())
  .subscribe(s=>{if(s==='SUBSCRIBED'){setSync('live');refreshRef.current()}if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')setSync('offline')});
  function schedule(){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>refreshRef.current(),450)}
  function scheduleChat(){if(chatTimer.current)clearTimeout(chatTimer.current);chatTimer.current=setTimeout(()=>refreshChatRef.current(),180)}
  const onFocus=()=>refreshRef.current();const onOnline=()=>refreshRef.current();window.addEventListener('focus',onFocus);window.addEventListener('online',onOnline);
  const poll=setInterval(()=>{if(document.visibilityState==='visible')refreshRef.current()},15000);
  return()=>{if(timer.current)clearTimeout(timer.current);if(chatTimer.current)clearTimeout(chatTimer.current);clearInterval(poll);window.removeEventListener('focus',onFocus);window.removeEventListener('online',onOnline);void db?.removeChannel(channel)};
 },[hotel,session?.user?.id]);
 const action=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);try{const result=await fn();await load();setLastError('');if(result&&typeof result==='object'&&'added' in result){const r=result as {added:number,skipped:number};notify(lang==='en'?`Created ${r.added} rooms (${r.skipped} already existed).`:`Se crearon ${r.added} habitaciones (${r.skipped} ya existían).`)}else notify(lang==='en'?'Saved and synchronized':'Guardado y sincronizado')}catch(e:any){setLastError(e.message||t.error);notify(isStale(e.message)?(lang==='en'?'Another user changed this first. Refresh and retry.':'Otro usuario cambió esto. Actualiza.'):(e.message||t.error));await load()}finally{setBusy(false)}};
 const currentShift=data.staffDispatch.find(d=>d.user_id===session?.user?.id&&d.hotel_id===hotel);
 const shiftEnd=currentShift?.shift_ends_at||null;
 useEffect(()=>{
  if(!db||!session?.user||!hotel||!shiftEnd||parallelMode)return;
  let expired=false;
  const check=async()=>{
   if(expired||window.sessionStorage.getItem('casaflow-signin-pending')||Date.parse(shiftEnd)>Date.now())return;
   expired=true;
   try{await rpc('end_work_shift',{p_hotel:hotel})}catch{/* cron will handle reallocation if offline */}
   await db?.auth.signOut(parallelMode?{scope:'local'}:undefined).catch(()=>null);
   setSession(null);setHotel(null);hotelStorage.removeItem('casaflow-hotel');notify('Shift finished. You have been signed out automatically.');
  };
  const id=window.setInterval(()=>void check(),1000);
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  void check();
  return()=>{window.clearInterval(id);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check)};
 },[shiftEnd,session?.user?.id,hotel]);
 const myMember=data.memberships.find(m=>m.user_id===session?.user?.id&&m.hotel_id===hotel);const role=myMember?.role||'frontdesk';
 const canManage=['owner','manager'].includes(role),canDesk=['owner','manager','frontdesk'].includes(role),canApprove=['owner','manager','supervisor'].includes(role);
 const display=data.hotels.find(h=>h.id===hotel)?.name||'CasaFlow Hotel';
 const ownerViews:View[]=['overview','rooms','cleaning','maintenance','requests','team','messages','activity','settings'];
 // The DB also enforces role-scoped reads and writes; nav filtering is just presentation.
 const permitted:View[]=canManage?ownerViews:role==='frontdesk'?['overview','rooms','requests','messages','activity']:role==='supervisor'?['overview','rooms','cleaning','messages','activity']:role==='housekeeping'?['overview','cleaning','messages']:['overview','maintenance','messages'];
 const portalPaths:Record<Role,string>={owner:'/owner',manager:'/manager',frontdesk:'/desk',supervisor:'/supervisor',housekeeping:'/cleaner',maintenance:'/technician'};
 useEffect(()=>{
   if(!myMember || location.pathname==='/dev' || location.pathname==='/guest' || location.pathname==='/design')return;
   const home=portalPaths[myMember.role];
   if(location.pathname!==home)history.replaceState(null,'',home);
 },[myMember?.role]);
 useEffect(()=>{if(!permitted.includes(view))setView(permitted[0])},[role,view]);
 const occupied=data.rooms.filter(r=>r.status==='occupied').length,ready=data.rooms.filter(r=>r.status==='ready').length,pending=data.tasks.filter(k=>!['done','cancelled'].includes(k.status)),high=pending.filter(k=>k.priority!=='normal').length;
 const visibleTasks=useMemo(()=>{let all=data.tasks.filter(k=>view==='cleaning'?(['cleaning','supply'].includes(k.kind)||(k.kind==='guest'&&data.guestMeta.some(g=>g.task_id===k.id&&g.department==='housekeeping'))):view==='maintenance'?(['maintenance','damage'].includes(k.kind)||(k.kind==='guest'&&data.guestMeta.some(g=>g.task_id===k.id&&g.department==='maintenance'))):view==='requests'?k.kind==='guest':true);if(role==='housekeeping')all=all.filter(k=>['cleaning','supply','damage','guest'].includes(k.kind));if(role==='maintenance')all=all.filter(k=>['maintenance','damage','guest'].includes(k.kind));return all.filter(k=>(statusFilter==='all'||k.status===statusFilter)&&(k.title+' '+k.detail+' '+(data.rooms.find(r=>r.id===k.room_id)?.number||'')).toLowerCase().includes(search.toLowerCase()))},[data.tasks,data.rooms,data.guestMeta,view,role,statusFilter,search]);
 const room=data.rooms.find(r=>r.id===roomId);
 const isInboxAgent=(chatMode==='owner'&&role==='owner')||(chatMode==='frontdesk'&&role==='frontdesk');
 const peerCandidates=data.memberships.filter(m=>m.active&&m.user_id!==session?.user?.id);
 const currentThread=isInboxAgent?(peerCandidates.some(m=>m.user_id===threadUser)?threadUser:peerCandidates[0]?.user_id||session?.user?.id):session?.user?.id;
 const conversation=chatMode==='common'?data.messages:
   data.privateMessages.filter(m=>m.recipient_kind===chatMode&&m.thread_user_id===currentThread);
 const sendChat=async()=>{
  const body=message.trim();if(!body||busy||!hotel)return;
  setBusy(true);
  try{
   if(chatMode==='common')await rpc('send_message',{p_hotel:hotel,p_room:null,p_body:body});
   else await rpc('send_private_message',{p_hotel:hotel,p_recipient:chatMode,p_thread_user:currentThread,p_body:body});
   setMessage('');await refreshChats();
  }catch(e:any){notify(e.message||t.error)}finally{setBusy(false)}
 };
 const mutate=(name:string,params:Record<string,unknown>)=>action(()=>rpc(name,params));
 const manualRefresh=async()=>{if(refreshing)return;setRefreshing(true);setSync('connecting');setLastError('');try{await load()}finally{setRefreshing(false)}};
 const advance=async(task:Task)=>{setWorkingId(task.id);try{await mutate(task.kind==='guest'?(task.status==='open'?'accept_guest_request':'complete_guest_request'):'advance_task',{p_hotel:hotel,p_task:task.id,p_expected_version:task.version,...(task.kind==='guest'?{}:{p_assignee:null})})}finally{setWorkingId(null)}};
 const taskButton=(task:Task)=>task.kind==='guest'?(task.status==='open'?(lang==='en'?'Accept request':'Aceptar solicitud'):(lang==='en'?'Complete request':'Completar solicitud')):task.kind==='cleaning'?(task.status==='open'?t.start:task.status==='doing'?t.inspect:t.approve):(task.status==='open'?t.start:t.complete);
 const mayAdvance=(task:Task)=>{
  if(task.status==='done'||task.status==='cancelled')return false;
  if(task.kind==='guest')return task.status==='doing'?task.assigned_to===session?.user?.id||['owner','manager'].includes(role):task.assigned_to===session?.user?.id;
  if(['owner','manager','supervisor'].includes(role))return task.kind==='cleaning'&&task.status==='inspection';
  if(role==='frontdesk')return false;
  if(task.assigned_to!==session?.user?.id)return false;
  if(role==='housekeeping')return ['cleaning','supply','damage'].includes(task.kind)&&task.status!=='inspection';
  return ['maintenance','damage'].includes(task.kind);
 };
 const taskCards=(tasks:Task[])=>tasks.length?<div className="tasklist">{tasks.map(k=>{const rm=data.rooms.find(r=>r.id===k.room_id);const assignee=data.memberships.find(m=>m.user_id===k.assigned_to);const disabled=k.status==='done'||k.status==='cancelled';const guest=data.guestMeta.find(g=>g.task_id===k.id);const blockedStart=k.kind==='cleaning'&&k.status==='open'&&rm?.status==='blocked';return <div className="taskrow" key={k.id}><div className={'kindicon kind-'+k.kind}>{k.kind==='cleaning'?<Brush/>:k.kind==='guest'?<HandPlatter/>:k.kind==='supply'?<PackageMinus/>:<Wrench/>}</div><div className="taskbody"><div className="tasktitle">{k.title} <Pill tone={'priority-'+k.priority}>{k.priority}</Pill>{guest?.escalated_at&&k.status==='open'&&<Pill tone="priority-high">{lang==='en'?'Needs management':'Necesita gerencia'}</Pill>}</div><div className="taskmeta">{t.room} {rm?.number||'—'} <span>·</span> {kindTitle(k.kind,t)} <span>·</span> {assignee?.display_name||t.unassigned}</div>{k.detail&&<div className="taskdetail">{k.detail}</div>}</div><div className="taskright"><Pill tone={statusTone(k.status)}>{t[k.status]}</Pill>{!disabled&&mayAdvance(k)&&<><button className="smallbtn" disabled={busy||blockedStart} title={blockedStart?'Management must release this blocked room before cleaning can start':undefined} onClick={()=>void advance(k)}>{workingId===k.id?<RefreshCw size={14} className="wf-spin"/>:null}{taskButton(k)} <ArrowRight size={14}/></button>{blockedStart&&<small className="wf-blocked-reason">Room blocked. Ask management to release it for cleaning.</small>}</>}</div></div>})}</div>:<div className="empty"><CheckCircle2 size={24}/><p>{t.noTasks}</p></div>;
 const navItems:{id:View,icon:React.ElementType}[]=[{id:'overview',icon:LayoutDashboard},{id:'rooms',icon:Columns3},{id:'cleaning',icon:Brush},{id:'maintenance',icon:Wrench},{id:'requests',icon:HandPlatter},{id:'team',icon:Users},{id:'messages',icon:MessageSquare},{id:'activity',icon:Activity},{id:'settings',icon:Settings}];
 if(location.pathname==='/design')return <AtelierPreview lang={lang} setLang={setLang} theme={theme} setTheme={setTheme}/>;
 if(location.pathname==='/dev')return <DevSandbox lang={lang} theme={theme} setLang={setLang} setTheme={setTheme}/>;
 if(location.pathname==='/guest')return <Guest lang={lang} setLang={setLang} theme={theme} setTheme={setTheme}/>;
 if(!configured)return <div className="authpage"><div className="authcard"><div className="logo large"><Building2/></div><h1>CasaFlow</h1><p>{t.demoDisabled}</p><div className="notice">{t.demoExplain}</div><p className="tiny">See README.md for the isolated Supabase project setup. Existing live demo remains unchanged.</p></div></div>;
 if(checking)return <div className="authpage"><Loader2 className="spin" size={30}/></div>;
 if(!session)return <Auth lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} notify={notify} onAuthenticated={setSession}/>;
 if(!hotel||!myMember)return <Onboard t={t} lang={lang} theme={theme} setTheme={setTheme} setLang={setLang} onJoined={(id)=>{hotelStorage.setItem('casaflow-hotel',id);setHotel(id)}} notify={notify}/>;
 return <div className="app atelier-app a7 cf8" data-theme={theme==='dark'?'night':'light'}><aside className={'sidebar '+(menu?'open':'')}><div className="brand"><span className="atelier-brand-glyph" aria-hidden="true">C</span><div><strong>CasaFlow</strong><span>HOTEL OPERATIONS</span></div><IconButton onClick={()=>setMenu(false)}><X size={18}/></IconButton></div><div className="hotelcard"><div className="hotelavatar">{display.slice(0,2).toUpperCase()}</div><div><b>{display}</b><span>{roleLabel[role]} Workspace</span></div><ChevronDown size={16}/></div><p className="navlabel">{t.workspace} / 01</p><nav aria-label="Hotel workspaces">{navItems.filter(n=>permitted.includes(n.id)).map(({id,icon:Icon},i)=><button key={id} title={t[id]} className={'cf8-nav-item '+(view===id?'active':'')} aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setMenu(false);setMoreOpen(false);setSearch('');setStatusFilter('all')}}><span className="nav-index">{String(i+1).padStart(2,'0')}</span><Icon size={18}/><span>{t[id]}</span>{id==='requests'&&pending.filter(k=>k.kind==='guest').length>0&&<i>{pending.filter(k=>k.kind==='guest').length}</i>}</button>)}{permitted.length>4&&<button type="button" className="cf8-mobile-more-button" aria-label="More workspaces" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><Menu size={20}/><span>More</span></button>}</nav><div className="sidebarbottom"><a className="demo-foot" href="/dev">{t.devMode}</a><div className="livehint"><span className={'syncdot '+sync}/><div><b>{t.allDepartments}</b><small>{t[sync==='live'?'online':sync==='connecting'?'syncing':'offline']}</small></div></div><div className="profile"><div className="roundavatar">{myMember.display_name.slice(0,2).toUpperCase()}</div><div><b>{myMember.display_name}</b><small>{roleLabel[role]}</small></div><button type="button" className="cf8-signout-side" onClick={()=>void signOut()} disabled={signingOut} aria-label={t.logout} title={t.logout}><LogOut size={17}/><span>{t.logout}</span></button></div></div></aside>
 {moreOpen&&<div className="cf8-more-overlay" role="presentation" onClick={()=>setMoreOpen(false)}><div className="cf8-more-sheet" role="menu" aria-label="Hotel workspaces" onClick={e=>e.stopPropagation()}><div className="cf8-more-head"><strong>{lang==='en'?'All workspaces':'Todos los espacios'}</strong><button type="button" aria-label="Close menu" onClick={()=>setMoreOpen(false)}><X size={20}/></button></div>{navItems.filter(n=>permitted.includes(n.id)).map(({id,icon:Icon})=><button type="button" role="menuitem" key={id} className={id===view?'active':''} onClick={()=>{setView(id);setMoreOpen(false);setSearch('');setStatusFilter('all')}}><Icon size={18}/>{t[id]}</button>)}</div></div>}
 <div className="main"><header className="topbar"><div className="crumb"><IconButton onClick={()=>setMenu(true)}><Menu size={20}/></IconButton><span>{roleLabel[role].toUpperCase()} WORKSPACE</span><span className="slash">/</span><b>{display}</b></div><div className="topactions"><button className="headerbtn" disabled={refreshing} onClick={()=>void manualRefresh()} title="Refresh account data" aria-label="Refresh account data"><RefreshCw size={16} className={refreshing?'wf-spin':undefined}/></button>{canDesk&&view==='overview'&&<button type="button" className="button atelier-new-task" onClick={()=>setModal('task')}><Plus size={16}/>{t.newTask}</button>}<span className={'connect '+sync}><span className={'syncdot '+sync}/>{t[sync==='live'?'online':sync==='connecting'?'syncing':'offline']}</span><button className="headerbtn" onClick={()=>setLang(lang==='en'?'es':'en')}><Languages size={16}/>{lang==='en'?'ES':'EN'}</button><button className="headerbtn" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><button type="button" className="cf8-signout-header" onClick={()=>void signOut()} disabled={signingOut} aria-label={t.logout} title={t.logout}><LogOut size={16}/><span>{t.logout}</span></button><div className="roundavatar mini">{myMember.display_name.slice(0,2).toUpperCase()}</div></div></header>
 <main className="content"><SyncFeedback busy={refreshing} lastSync={lastSync} error={lastError}/>{!(view==='rooms'||(view==='overview'&&canDesk))&&<div className="pageintro"><div><div className="eyebrow">{roleLabel[role].toUpperCase()} / {t.operations}</div><h1>{t[view]}</h1><p>{view==='overview'?t.welcome:t.sub}</p></div><div className="mainbuttons"><button className="button outline" disabled={refreshing} onClick={()=>void manualRefresh()}><RefreshCw size={16} className={refreshing?'wf-spin':undefined}/>{refreshing?'Refreshing…':t.refresh}</button>{['overview','rooms','cleaning','maintenance','requests'].includes(view)&&<button className="button primary" onClick={()=>setModal('task')}><Plus size={17}/>{t.newTask}</button>}</div></div>}
 {view==='overview'&&role==='frontdesk'&&<div className="wf-view-banner"><strong>RECEPTION CONSOLE</strong> — Guest intake, room status and reception dispatch. Specialist repairs belong to management.</div>}
 {view==='overview'&&role==='manager'&&<div className="wf-view-banner"><strong>MANAGER OPERATIONS</strong> — Staff dispatch, escalations and team oversight.</div>}
 {view==='overview'&&role==='supervisor'&&<div className="wf-view-banner"><strong>HOUSEKEEPING SUPERVISOR</strong> — Cleaning approvals and inspections only.</div>}
 {view==='overview'&&<section className="card shift-card" aria-live="polite"><div><b>{lang==='en'?'My automatic work shift':'Mi turno automático'}</b><small>{shiftEnd?'Working since login · '+new Date(currentShift?.shift_started_at||'').toLocaleTimeString()+' · Shift ends '+new Date(shiftEnd).toLocaleTimeString():'Shift starts on sign-in and ends automatically.'}</small></div><ShiftCountdown until={shiftEnd}/></section>}
 {view==='overview'&&(['housekeeping','maintenance'].includes(role)?<>
  <div className="stats"><Stat icon={<ClipboardCheck/>} label={lang==='en'?'My assigned jobs':'Mis tareas asignadas'} value={data.tasks.filter(k=>k.assigned_to===session.user.id).length} detail={t.work}/><Stat icon={<Clock/>} label={t.open} value={data.tasks.filter(k=>k.status==='open').length} detail={t.pending}/><Stat icon={<Wrench/>} label={t.doing} value={data.tasks.filter(k=>k.status==='doing').length} detail={t.live}/><Stat icon={<CheckCircle2/>} label={t.done} value={data.tasks.filter(k=>k.status==='done').length} detail={t.roomBoard}/></div>
  <section className="card"><div className="cardhead"><div><small>{roleLabel[role]}</small><h2>{lang==='en'?'My work queue':'Mis tareas pendientes'}</h2></div><Pill>{pending.length}</Pill></div>{taskCards(pending.filter(k=>k.assigned_to===session.user.id||k.created_by===session.user.id))}</section>
  <section className="card private-help"><h2>{lang==='en'?'Need help or supplies?':'¿Necesitas ayuda o suministros?'}</h2><p>{lang==='en'?'Message the front desk or owner privately.':'Escribe a recepción o al propietario en privado.'}</p><button className="button outline" onClick={()=>{setChatMode('frontdesk');setView('messages')}}><MessageSquare size={16}/>{lang==='en'?'Message Front Desk':'Escribir a recepción'}</button></section>
  </>:<><CasaOverview lang={lang} hotelName={display} rooms={data.rooms} tasks={data.tasks} alerts={data.alerts} members={data.memberships} dispatch={data.staffDispatch} events={data.activity} onRoom={setRoomId} onRooms={()=>setView('rooms')} onTasks={()=>{setView(permitted.includes('requests')?'requests':'cleaning');setStatusFilter('open')}} onChat={()=>{setChatMode('common');setView('messages')}} onAdd={canManage?()=>setModal('room'):undefined} onQR={canDesk?()=>{setQrRoomId('');setModal('qr')}:undefined}/></>)}
 {view==='rooms'&&<CasaRoomBoard lang={lang} rooms={data.rooms} tasks={data.tasks} events={data.activity} canManage={canManage} canDesk={canDesk} onRoom={setRoomId} onAdd={canManage?()=>setModal('room'):undefined} onQR={canDesk?()=>{setQrRoomId('');setModal('qr')}:undefined}/>}
 {view==='requests'&&<GuestIncidentDesk role={role} alerts={data.alerts} tasks={data.tasks} rooms={data.rooms} members={data.memberships} guestMeta={data.guestMeta} busy={busy} onAck={id=>void mutate('ack_guest_alert',{p_hotel:hotel,p_alert:id})}/>}
 {['cleaning','maintenance','requests'].includes(view)&&<><div className="toolbar"><label className="search"><Search size={18}/><input placeholder={t.search} value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="pills">{['all','open','doing','inspection','done'].map(s=><button key={s} className={statusFilter===s?'selected':''} onClick={()=>setStatusFilter(s)}>{s==='all'?t.all:t[s as 'open']}</button>)}</div></div><section className="card"><div className="cardhead"><div><small>{t.work}</small><h2>{t[view]}</h2></div><Pill>{visibleTasks.length} {t.all}</Pill></div>{taskCards(visibleTasks)}</section></>}
 {view==='team'&&<StaffWorkload members={data.memberships} dispatch={data.staffDispatch} tasks={data.tasks} rooms={data.rooms} viewerRole={role} onInvite={()=>setModal('invite')} onEdit={id=>{setEditStaff(id);setModal('dispatch')}}/>}
 {view==='messages'&&<div className="twocol messageslayout"><section className="card"><div className="cardhead"><div><small>{t.live}</small><h2>{t.messages}</h2></div><Pill tone="tone-ready">{t.live}</Pill></div>
  <div className="chat-tabs" role="tablist" aria-label={lang==='en'?'Chat channels':'Canales de chat'}>
   {([['common',lang==='en'?'Common Chat':'Chat general'],['owner',lang==='en'?'Private · Owner':'Privado · Propietario'],['frontdesk',lang==='en'?'Private · Front Desk':'Privado · Recepción']] as const).map(([channel,label])=><button type="button" role="tab" aria-selected={chatMode===channel} key={channel} className={chatMode===channel?'selected':''} onClick={()=>{setChatMode(channel);setMessage('');setThreadUser('')}}>{label}</button>)}
  </div>
  {chatMode==='common'?<p className="chat-context">{lang==='en'?'All active hotel employees can read this chat.':'Todos los empleados activos del hotel pueden leer este chat.'}</p>:
    <><p className="chat-context">{chatMode==='owner'?(lang==='en'?'Only you and the hotel owner can see your conversation.':'Solo usted y el propietario ven esta conversación.'):(lang==='en'?'Only you and the front-desk team can see your conversation.':'Solo usted y el equipo de recepción ven esta conversación.')}</p>
    {isInboxAgent&&<label className="inbox-person">{lang==='en'?'Employee conversation':'Conversación del empleado'}<select value={currentThread||''} onChange={e=>setThreadUser(e.target.value)}>{peerCandidates.map(m=><option key={m.user_id} value={m.user_id}>{m.display_name} · {roleLabel[m.role]}</option>)}</select></label>}
    </>}
  <div className="chatbox" aria-live="polite">{conversation.slice().reverse().map(m=><div className={'bubble '+(m.sender_id===session.user.id?'mine':'')} key={m.id}><small>{data.memberships.find(p=>p.user_id===m.sender_id)?.display_name||'Staff'} · {new Date(m.created_at).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}</small><p>{m.body}</p></div>)}{!conversation.length&&<div className="empty">{t.noMessages}</div>}</div>
  <form className="compose" onSubmit={e=>{e.preventDefault();void sendChat()}}><input maxLength={chatMode==='common'?1000:1500} value={message} onChange={e=>setMessage(e.target.value)} placeholder={chatMode==='common'?t.newMessage:lang==='en'?'Write a private message…':'Escribe un mensaje privado…'}/><button className="button primary" disabled={busy||!message.trim()||(isInboxAgent&&!currentThread)}><Send size={17}/>{t.send}</button></form>
  </section><section className="card chat-assistance"><div className="cardhead"><h2>{lang==='en'?'Who can read messages?':'¿Quién puede leer los mensajes?'}</h2><ShieldCheck size={20}/></div><p><b>{lang==='en'?'Common chat':'Chat general'}</b> — {lang==='en'?'Every active employee in this hotel.':'Todos los empleados activos de este hotel.'}</p><p><b>{lang==='en'?'Owner private inbox':'Bandeja privada del propietario'}</b> — {lang==='en'?'The owner and the employee in that conversation.':'El propietario y el empleado de la conversación.'}</p><p><b>{lang==='en'?'Front desk private inbox':'Bandeja privada de recepción'}</b> — {lang==='en'?'All active reception staff and the employee in that conversation.':'Los recepcionistas activos y el empleado de la conversación.'}</p></section></div>}
 {view==='activity'&&<section className="card"><div className="cardhead"><h2>{t.activityTitle}</h2><Activity size={19}/></div>{data.activity.map(a=><div className="feed" key={a.id}><div className="feedicon"><Activity size={15}/></div><div><b>{a.message}</b><small>{new Date(a.at).toLocaleString(lang)} · {data.memberships.find(m=>m.user_id===a.actor_id)?.display_name||'System'}</small></div></div>)}</section>}
 {view==='settings'&&<section className="card settingscard"><div className="cardhead"><h2>{t.settings}</h2><Settings size={19}/></div><div className="settingrow"><div><b>{t.hotel}</b><small>{display}</small></div><MapPin size={19}/></div><div className="settingrow"><div><b>{t.language}</b><small>English / Español</small></div><button className="button outline" onClick={()=>setLang(lang==='en'?'es':'en')}>{lang==='en'?'English':'Español'}</button></div><div className="settingrow"><div><b>{t.theme}</b><small>{theme==='dark'?t.dark:t.light}</small></div><button className="button outline" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}</button></div></section>}
 </main></div>
 {room&&<div className="scrim" onClick={()=>setRoomId(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawerhead"><div><small>{t.selectedRoom}</small><h2>{t.room} {room.number}</h2></div><IconButton onClick={()=>setRoomId(null)}><X/></IconButton></div><div className="drawerbody"><div className="roomhero"><BedDouble size={28}/><Pill tone={statusTone(room.status)}>{t[room.status]}</Pill><small>{room.kind} · {t.floor} {room.floor}</small></div>{room.status==='blocked'&&canManage&&<button className="button outline full" disabled={busy} onClick={()=>void mutate('release_room_for_cleaning',{p_hotel:hotel,p_room:room.id,p_expected_version:room.version})}><AlertTriangle size={16}/>Release blocked room for cleaning</button>}{room.status==='ready'&&canDesk&&<button className="button primary full" disabled={busy} onClick={()=>mutate('checkin_room',{p_hotel:hotel,p_room:room.id,p_expected_version:room.version})}><DoorOpen size={17}/>{t.checkin}</button>}{room.status==='occupied'&&canDesk&&<button className="button primary full" disabled={busy} onClick={()=>mutate('checkout_room',{p_hotel:hotel,p_room:room.id,p_expected_version:room.version})}><DoorOpen size={17}/>{t.checkout}</button>}<div className="drawersection"><h3>{t.roomRequests}</h3>{taskCards(data.tasks.filter(k=>k.room_id===room.id))}</div><button className="button outline full" onClick={()=>{setChatMode('common');setMessage(`Room ${room.number}: `);setView('messages');setRoomId(null)}}><MessageSquare size={16}/>{t.messageRoom}</button>{canDesk&&<button className="button outline full" onClick={()=>{setQrRoomId(room.id);setRoomId(null);setModal('qr')}}><Link size={17}/>{t.guestQR}</button>}</div></aside></div>}
 {modal==='task'&&<TaskModal t={t} lang={lang} rooms={data.rooms} members={data.memberships} role={role} close={()=>setModal(null)} save={p=>action(async()=>{await rpc('create_task',{p_hotel:hotel,...p});setModal(null)})}/>}
 {modal==='room'&&<RoomModal t={t} lang={lang} close={()=>setModal(null)} save={(mode,p)=>action(async()=>{const result=await rpc<{added:number,skipped:number}>((mode==='bulk'?'bulk_add_rooms':'add_room'),{p_hotel:hotel,...p});setModal(null);return mode==='bulk'?result:null})}/> }
 {modal==='invite'&&<InviteModal t={t} hotel={hotel!} close={()=>setModal(null)} notify={notify}/>}
 {modal==='dispatch'&&<DispatchModal lang={lang} member={data.memberships.find(m=>m.user_id===editStaff)} profile={data.staffDispatch.find(d=>d.user_id===editStaff)} close={()=>setModal(null)} save={p=>action(async()=>{await rpc('set_staff_dispatch',{p_hotel:hotel,p_user:editStaff,p_shift:false,p_capacity:p.p_capacity,p_skills:p.p_skills});await rpc('set_shift_duration',{p_hotel:hotel,p_user:editStaff,p_minutes:p.p_minutes});setModal(null)})}/>}
 {modal==='qr'&&<QRModal t={t} rooms={data.rooms} hotel={hotel!} initialRoom={qrRoomId} close={()=>setModal(null)} notify={notify}/>}
 <Toast value={toast}/></div>;
}
function ShiftCountdown({until}:{until:string|null}){
 const[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
 if(!until)return <span className="wf-shift off">Not signed in to a work shift</span>;
 const remaining=Math.max(0,Date.parse(until)-now);
 const totalMinutes=Math.floor(remaining/60000),seconds=Math.floor((remaining%60000)/1000);
 return <span className={remaining?'wf-shift on':'wf-shift off'} role="timer">{remaining?`${Math.floor(totalMinutes/60)}h ${String(totalMinutes%60).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s left`:'Shift ended'}</span>;
}
function Stat({icon,label,value,detail}:{icon:React.ReactNode,label:string,value:number,detail:string}){return <section className="stat"><div className="stathead"><span>{label}</span><div>{icon}</div></div><strong>{value}</strong><small>{detail}</small></section>}
function Modal({title,close,children}:{title:string,close:()=>void,children:React.ReactNode}){return <div className="scrim" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalhead"><h2>{title}</h2><IconButton onClick={close}><X size={20}/></IconButton></div><div className="modalbody">{children}</div></div></div>}
function TaskModal({t,lang,rooms,members,role,close,save}:{t:L,lang:string,rooms:Room[],members:Member[],role:Role,close:()=>void,save:(p:Record<string,unknown>)=>Promise<void>}){const allowedKinds:TaskKind[]=role==='housekeeping'?['supply','damage']:role==='maintenance'?['maintenance','damage']:role==='supervisor'?['cleaning','supply','damage']:['cleaning','maintenance','guest','supply','damage'];const[room,setRoom]=useState(rooms[0]?.id||''),[kind,setKind]=useState<TaskKind>(allowedKinds[0]),[title,setTitle]=useState(''),[detail,setDetail]=useState(''),[priority,setPriority]=useState('normal');return <Modal title={t.newTask} close={close}><form className="form" onSubmit={e=>{e.preventDefault();void save({p_room:room,p_kind:kind,p_title:title,p_detail:detail,p_priority:priority,p_assignee:null})}}><label>{t.room}<select required value={room} onChange={e=>setRoom(e.target.value)}>{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></label><label>{t.kind}<select value={kind} onChange={e=>setKind(e.target.value as TaskKind)}>{allowedKinds.map(k=><option value={k} key={k}>{kindTitle(k,t)}</option>)}</select></label><label>{t.title}<input required minLength={2} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>{t.detail}<textarea value={detail} onChange={e=>setDetail(e.target.value)} maxLength={1200} rows={3}/></label><div className="formgrid"><label>{t.priority}<select value={priority} onChange={e=>setPriority(e.target.value)}><option>normal</option><option>high</option><option>urgent</option></select></label></div><button className="button primary full" disabled={!room||!title.trim()}>{t.save}</button></form></Modal>}
function RoomModal({t,lang,close,save}:{t:L,lang:'en'|'es',close:()=>void,save:(mode:'single'|'bulk',p:Record<string,unknown>)=>Promise<void>}){
 const[mode,setMode]=useState<'single'|'bulk'>('bulk');
 const[number,setNumber]=useState('101'),[floor,setFloor]=useState('1'),[kind,setKind]=useState('Standard');
 const[start,setStart]=useState('101'),[end,setEnd]=useState('150'),[floorMode,setFloorMode]=useState<'auto'|'fixed'>('auto'),[pad,setPad]=useState(0);
 const total=Number(end)-Number(start)+1;
 const validRange=Number.isInteger(Number(start))&&Number.isInteger(Number(end))&&Number(start)>=1&&Number(end)<=999999&&total>=1&&total<=2000;
 return <Modal title={t.addRoom} close={close}>
  <div className="authswitch roommode"><button type="button" className={mode==='bulk'?'selected':''} onClick={()=>setMode('bulk')}>{t.bulkAdd}</button><button type="button" className={mode==='single'?'selected':''} onClick={()=>setMode('single')}>{t.oneRoom}</button></div>
  <form className="form" onSubmit={e=>{e.preventDefault();if(mode==='single')void save('single',{p_number:number,p_floor:floor,p_kind:kind});else if(validRange)void save('bulk',{p_start:Number(start),p_end:Number(end),p_floor:floorMode==='auto'?null:floor,p_kind:kind,p_pad:pad})}}>
   {mode==='bulk'?<><div className="formgrid"><label>{t.firstRoom}<input type="number" required min={1} max={999999} value={start} onChange={e=>setStart(e.target.value)}/></label><label>{t.lastRoom}<input type="number" required min={1} max={999999} value={end} onChange={e=>setEnd(e.target.value)}/></label></div><label>{t.floorMode}<select value={floorMode} onChange={e=>setFloorMode(e.target.value as 'auto'|'fixed')}><option value="auto">{t.autoFloor}</option><option value="fixed">{t.fixedFloor}</option></select></label>{floorMode==='fixed'&&<label>{t.floor}<input required maxLength={30} value={floor} onChange={e=>setFloor(e.target.value)}/></label>}<label>{t.digits}<select value={pad} onChange={e=>setPad(Number(e.target.value))}>{[0,2,3,4,5,6].map(n=><option key={n} value={n}>{n===0?'No padding / Sin ceros':n}</option>)}</select></label><div className="bulkpreview" role="status"><b>{validRange?total.toLocaleString(lang==='es'?'es-ES':'en-US'):'—'} {t.rooms.toLowerCase()}</b><small>{validRange?`${Math.max(0,Number(start)).toString().padStart(pad,'0')} → ${Number(end).toString().padStart(pad,'0')}`:(lang==='en'?'Select up to 2,000 rooms per batch':'Máximo 2.000 habitaciones por lote')}</small><small>{t.duplicateNotice}</small></div></>:<><label>{t.room}<input required maxLength={12} value={number} onChange={e=>setNumber(e.target.value)}/></label><label>{t.floor}<input required value={floor} onChange={e=>setFloor(e.target.value)}/></label></>}
   <label>{t.roomType}<input required maxLength={60} value={kind} onChange={e=>setKind(e.target.value)}/></label><button className="button primary full" disabled={mode==='bulk'&&!validRange}>{mode==='bulk'?t.bulkAdd:t.addRoom}</button>
  </form>
 </Modal>
}
function InviteModal({t,hotel,close,notify}:{t:L,hotel:string,close:()=>void,notify:(v:string)=>void}){const[role,setRole]=useState<Role>('housekeeping'),[token,setToken]=useState(''),[working,setWorking]=useState(false);const url=token?new URL('/?invite='+token,location.origin).toString():'';return <Modal title={t.invite} close={close}><div className="form"><label>{t.inviteRole}<select value={role} onChange={e=>setRole(e.target.value as Role)}>{(['manager','frontdesk','supervisor','housekeeping','maintenance']as Role[]).map(r=><option key={r}>{r}</option>)}</select></label><button className="button primary full" disabled={working} onClick={async()=>{setWorking(true);try{setToken(await rpc<string>('create_staff_invite',{p_hotel:hotel,p_role:role}))}catch(e:any){notify(e.message)}finally{setWorking(false)}}}>{t.invite}</button>{url&&<><div className="inviteurl">{url}</div><button className="button outline full" onClick={()=>{void navigator.clipboard.writeText(url);notify('Copied')}}><Copy size={17}/>{t.inviteCopy}</button></>}</div></Modal>}
function QRModal({t,rooms,hotel,initialRoom,close,notify}:{t:L,rooms:Room[],hotel:string,initialRoom?:string,close:()=>void,notify:(v:string)=>void}){
 const [room,setRoom]=useState(initialRoom||rooms[0]?.id||''),[token,setToken]=useState(''),[qr,setQr]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState(''),[bulkLabels,setBulkLabels]=useState<Array<{room:string,qr:string}>>([]);
 const chosen=rooms.find(r=>r.id===room),url=token?new URL('/guest?token='+token,location.origin).toString():'';
 useEffect(()=>{if(!url)return;QRCode.toDataURL(url,{margin:2,width:300,errorCorrectionLevel:'H'}).then(setQr).catch(()=>setQr(''))},[url]);
 const issue=async(rotate:boolean)=>{setWorking(true);setError('');try{setToken(await rpc<string>('issue_room_qr',{p_hotel:hotel,p_room:room,p_rotate:rotate}))}catch(e:any){setError(e.message||'QR error')}finally{setWorking(false)}};
 const en=document.documentElement.lang!=='es';
 const bulkIssue=async()=>{setWorking(true);setError('');setBulkLabels([]);try{const items=await rpc<Array<{room:string,token:string}>>('issue_room_qrs_bulk',{p_hotel:hotel,p_limit:30});const images=await Promise.all(items.map(async x=>({room:x.room,qr:await QRCode.toDataURL(new URL('/guest?token='+x.token,location.origin).toString(),{margin:1,width:180,errorCorrectionLevel:'H'})})));setBulkLabels(images);if(!images.length)setError(en?'All rooms already have a QR. Rotate an individual QR to replace it.':'Todas las habitaciones ya tienen QR.')}catch(e:any){setError(e.message||'Unable to generate batch')}finally{setWorking(false)}};
 return <Modal title={en?'Permanent room QR labels':'Etiquetas QR permanentes'} close={close}>
  <div className="form"><p className="muted">{en?'Print one QR per room and place it near the desk. The link stays active until you rotate it.':'Imprima un QR por habitación. Permanece activo hasta que lo cambie.'}</p>
   <label>{t.room}<select value={room} onChange={e=>{setRoom(e.target.value);setToken('');setQr('');setError('')}}>{rooms.map(r=><option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
   <button className="button primary full" disabled={!room||working} onClick={()=>void issue(false)}>{en?'Generate room QR':'Generar QR'}</button>
   <button className="button outline full" disabled={working} onClick={()=>void bulkIssue()}>{en?'Generate next 30 unprinted room QR labels':'Generar próximos 30 QR sin imprimir'}</button>
   <button className="button outline full" disabled={!room||working} onClick={()=>{if(window.confirm(en?'This invalidates the old printed QR. Replace it in the room.':'Esto invalida el QR anterior. Reemplace la etiqueta.'))void issue(true)}}>{en?'Replace / rotate printed QR':'Reemplazar QR impreso'}</button>
   {error&&<p className="error" role="alert">{error}</p>}
   {bulkLabels.length>0&&<><div className="qr-bulk-print-area">{bulkLabels.map(label=><article key={label.room}><b>CasaFlow · {en?'Room':'Habitación'} {label.room}</b><img src={label.qr} alt={'QR room '+label.room}/><small>{en?'Scan for requests':'Escanear para solicitudes'}</small></article>)}</div><button className="button primary full" onClick={()=>window.print()}>{en?'Print all '+bulkLabels.length+' room labels':'Imprimir '+bulkLabels.length+' códigos QR'}</button><p className="tiny">{en?'Print these before closing: QR tokens are only returned once, and cannot be retrieved later.':'Imprima antes de cerrar: los enlaces solo se muestran una vez.'}</p></>}
   {qr&&<div className="qrdisplay qr-print-area"><strong>CasaFlow · {en?'Room':'Habitación'} {chosen?.number}</strong><img alt={'Guest request QR room '+chosen?.number} src={qr}/><p>{en?'Scan to request towels, repairs or supplies':'Escanee para solicitar toallas, reparaciones o suministros'}</p></div>}
   {url&&<><div className="inviteurl">{url}</div><div className="qr-actions"><button className="button outline" onClick={()=>{void navigator.clipboard.writeText(url);notify(en?'Link copied':'Enlace copiado')}}><Copy size={16}/>{t.guestLinkCopy}</button><button className="button primary" onClick={()=>window.print()}>{en?'Print QR label':'Imprimir QR'}</button></div><p className="tiny">{en?'Save or print this QR now. For security, the original secret cannot be retrieved after you close the window; use Rotate if you lose it.':'Guarde o imprima este QR. No se puede recuperar el enlace secreto después.'}</p></>}
  </div>
 </Modal>
}
function DispatchModal({lang,member,profile,close,save}:{lang:'en'|'es',member:Member|undefined,profile:Data['staffDispatch'][number]|undefined,close:()=>void,save:(p:Record<string,unknown>)=>Promise<void>}){
 const[shiftHours,setShiftHours]=useState(Math.round((profile?.shift_duration_minutes||480)/60)),[capacity,setCapacity]=useState(profile?.max_open_tasks||5),[skills,setSkills]=useState<string[]>(profile?.verified_skills||[]);
 const en=lang==='en';const choices=[['ac','AC / HVAC'],['plumbing',en?'Plumbing':'Plomería'],['electrical',en?'Electrical':'Electricidad'],['general_repair',en?'General repair':'Reparación general']];
 return <Modal title={(en?'Skills & automatic shift — ':'Habilidades y turno automático — ')+(member?.display_name||'')} close={close}>
 <form className="form" onSubmit={e=>{e.preventDefault();void save({p_capacity:capacity,p_skills:skills,p_minutes:shiftHours*60})}}>
 <p className="tiny">{en?'Signing in starts a shift automatically; only active, qualified workers receive jobs.':'Iniciar sesión comienza automáticamente el turno.'}</p>
 <label>{en?'Shift length (hours)':'Duración del turno (horas)'}<input type="number" min={1} max={12} step={1} value={shiftHours} onChange={e=>setShiftHours(Number(e.target.value))}/></label>
 <label>{en?'Maximum active jobs':'Máximo de tareas abiertas'}<input type="number" min={1} max={30} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label>
 {member?.role==='maintenance'&&<fieldset className="skills"><legend>{en?'Manager-verified qualifications':'Habilidades verificadas por gerente'}</legend>{choices.map(([id,label])=><label key={id} className="checkline"><input type="checkbox" checked={skills.includes(id)} onChange={e=>setSkills(v=>e.target.checked?[...v,id]:v.filter(x=>x!==id))}/>{label}</label>)}</fieldset>}
 <p className="tiny">{en?'Only mark a qualification after verifying it. The system never guesses certifications.':'Marque una cualificación solo después de verificarla.'}</p>
 <button className="button primary full">{en?'Save skills & shift duration':'Guardar habilidades y turno'}</button>
 </form>
 </Modal>
}
function Auth({lang,setLang,theme,setTheme,notify,onAuthenticated}:{lang:'en'|'es',setLang:(v:'en'|'es')=>void,theme:string,setTheme:(v:string)=>void,notify:(v:string)=>void,onAuthenticated:(session:any)=>void}){
 const t=labels[lang];
 const [signUp,setSignUp]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [working,setWorking]=useState(false),[notice,setNotice]=useState<{kind:'error'|'success'|'info',text:string}|null>(null),[pendingEmail,setPendingEmail]=useState('');
 const [resetMode,setResetMode]=useState(false);
 const confirmLink=()=>new URL('/',window.location.origin).toString();
 const feedback=(kind:'error'|'success'|'info',text:string)=>setNotice({kind,text});
 const resetView=()=>{setNotice(null);setPendingEmail('');setResetMode(false)};
 const sendConfirmation=async()=>{
  if(!db)return;
  setWorking(true);setNotice(null);
  try{
   const {error}=await db.auth.resend({type:'signup',email:pendingEmail||email.trim().toLowerCase(),options:{emailRedirectTo:confirmLink()}});
   if(error)throw error;
   feedback('success',lang==='en'?'Verification email requested. Check your inbox and spam folder. You may need to wait before requesting another.':'Correo de verificación solicitado. Revise su bandeja y correo no deseado. Espere antes de solicitar otro.');
  }catch(err:any){feedback('error',err?.status===429||err?.code==='over_email_send_rate_limit'?(lang==='en'?'Please wait before requesting another verification email.':'Espere antes de pedir otro correo de verificación.'):(err?.message||t.error));}
  finally{setWorking(false)}
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!db)return;
  setWorking(true);setNotice(null);
  const normalized=email.trim().toLowerCase();
  try{
   if(resetMode){
    const {error}=await db.auth.resetPasswordForEmail(normalized,{redirectTo:'https://hotel-ops-pilot.vercel.app/reset-password'});
    if(error)throw error;
    feedback('success',lang==='en'?'If this account exists, a password reset email has been requested.':'Si esta cuenta existe, se ha solicitado un correo para restablecer la contraseña.');
   }else if(signUp){
    const {data,error}=await db.auth.signUp({email:normalized,password,options:{emailRedirectTo:confirmLink()}});
    if(error)throw error;
    if(data.session){
     onAuthenticated(data.session);
     feedback('success',lang==='en'?'Account created and signed in.':'Cuenta creada y sesión iniciada.');
    }else{
     setPendingEmail(normalized);
     feedback('success',lang==='en'?'Account request received. Check your email for the verification link, click it, then return here to sign in. Your account cannot sign in until verified.':'Solicitud recibida. Revise su correo, abra el enlace de verificación y vuelva aquí para iniciar sesión. No podrá acceder hasta verificar su cuenta.');
    }
   }else{
    const {data:login,error}=await db.auth.signInWithPassword({email:normalized,password});
    if(error)throw error;
    onAuthenticated(login.session);
    feedback('success',lang==='en'?'Signed in — opening your workspace…':'Sesión iniciada; abriendo su espacio…');
   }
  }catch(err:any){
   const code=err?.code||'';
   if(code==='email_not_confirmed'||/email not confirmed/i.test(err?.message||'')){
    setPendingEmail(normalized);
    feedback('error',lang==='en'?'Email not verified. Open the confirmation email and click its link, then try signing in again.':'Correo sin verificar. Abra el mensaje de confirmación, pulse su enlace y vuelva a iniciar sesión.');
   }else if(err?.status===429||/rate limit/i.test(err?.message||'')){
    feedback('error',lang==='en'?'Too many attempts. Please wait before trying again.':'Demasiados intentos. Espere antes de intentarlo de nuevo.');
   }else{
    feedback('error',err?.message||t.error);
   }
  }finally{setWorking(false)}
 };
 return <div className="authpage"><div className="authcard">
  <div className="authheader"><div className="logo large"><Building2/></div>
   <button type="button" className="headerbtn" onClick={()=>setLang(lang==='en'?'es':'en')}>{lang==='en'?'ES':'EN'}</button>
   <button type="button" className="headerbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
  </div>
  <h1>CasaFlow</h1><p>{t.allDepartments}</p>
  {!resetMode?<div className="authswitch">
   <button type="button" className={!signUp?'selected':''} onClick={()=>{setSignUp(false);resetView()}}>{t.login}</button>
   <button type="button" className={signUp?'selected':''} onClick={()=>{setSignUp(true);resetView()}}>{t.signup}</button>
  </div>:<h2>{lang==='en'?'Reset your password':'Restablecer contraseña'}</h2>}
  <form className="form" onSubmit={submit}>
   <label>{t.email}<div className="inputicon"><Mail size={17}/><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="team@hotel.com"/></div></label>
   {!resetMode&&<label>{t.password}<div className="inputicon"><Lock size={17}/><input type="password" required minLength={8} autoComplete={signUp?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></div></label>}
   <button type="submit" className="button primary full" disabled={working}>{working?t.wait:resetMode?(lang==='en'?'Send reset email':'Enviar enlace'):signUp?t.signup:t.login}<ArrowRight size={17}/></button>
  </form>
  {notice&&<div className={'auth-notice '+notice.kind} role={notice.kind==='error'?'alert':'status'} aria-live="polite">{notice.text}</div>}
  {pendingEmail&&<button type="button" className="button outline full auth-action" disabled={working} onClick={()=>void sendConfirmation()}>{lang==='en'?'Resend verification email':'Reenviar correo de verificación'}</button>}
  <div className="auth-links">
   {resetMode?<button type="button" onClick={resetView}>{lang==='en'?'Back to sign in':'Volver a iniciar sesión'}</button>:<button type="button" onClick={()=>{setResetMode(true);setPendingEmail('');setNotice(null)}}>{lang==='en'?'Forgot password?':'¿Olvidó su contraseña?'}</button>}
  </div>
  <a className="button outline full dev-link" href="/dev"><Users size={17}/>{t.openDemo}</a><p className="tiny">{t.allDepartments}. {lang==='en'?'New accounts must verify their email before signing in.':'Las cuentas nuevas deben verificar el correo antes de iniciar sesión.'}</p>
 </div></div>
}
function Onboard({t,lang,theme,setTheme,setLang,onJoined,notify}:{t:L,lang:string,theme:string,setTheme:(v:string)=>void,setLang:(v:any)=>void,onJoined:(h:string)=>void,notify:(v:string)=>void}){const [name,setName]=useState(''),[city,setCity]=useState(''),[token,setToken]=useState(new URLSearchParams(location.search).get('invite')||''),[person,setPerson]=useState(''),[working,setWorking]=useState(false),[onboardError,setOnboardError]=useState('');const submit=async(method:'create'|'join')=>{setOnboardError('');setWorking(true);try{const h=method==='create'?await rpc<string>('create_hotel',{p_name:name,p_city:city}):await rpc<string>('accept_staff_invite',{p_token:token,p_display_name:person});await rpc('begin_work_shift',{p_hotel:h});onJoined(h);history.replaceState(null,'','/')}catch(e:any){setOnboardError(e.message||'Unable to complete setup')}finally{setWorking(false)}};return <div className="authpage"><div className="onboarding"><div className="authheader"><div className="logo large"><Building2/></div><button className="headerbtn" onClick={()=>setLang(lang==='en'?'es':'en')}>{lang==='en'?'ES':'EN'}</button><button className="headerbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button></div><h1>{t.newHotel}</h1><p>{t.noHotel}</p><div className="onboardgrid"><section className="card"><h2>{t.createHotel}</h2><form className="form" onSubmit={e=>{e.preventDefault();void submit('create')}}><label>{t.enterName}<input minLength={2} required value={name} onChange={e=>setName(e.target.value)}/></label><label>{t.enterCity}<input value={city} onChange={e=>setCity(e.target.value)}/></label><button className="button primary full" disabled={working}>{t.createHotel}</button></form></section><section className="card"><h2>{t.joinHotel}</h2><form className="form" onSubmit={e=>{e.preventDefault();void submit('join')}}><label>{t.name}<input required minLength={2} value={person} onChange={e=>setPerson(e.target.value)}/></label><label>{t.inviteLink}<input required value={token} onChange={e=>setToken(e.target.value)}/></label><button className="button outline full" disabled={working}>{t.join}</button></form></section></div>{onboardError&&<div className="auth-notice error" role="alert">{onboardError}</div>}</div></div>}
const guestCategories=[
 {id:'extra_towels',en:'Extra towels',es:'Toallas adicionales',dept:'housekeeping',icon:'🛁'},
 {id:'broken_ac',en:'Broken AC',es:'Aire acondicionado averiado',dept:'maintenance',icon:'❄️'},
 {id:'plumbing',en:'Plumbing problem',es:'Problema de plomería',dept:'maintenance',icon:'🔧'},
 {id:'missing_supplies',en:'Missing supplies',es:'Faltan suministros',dept:'housekeeping',icon:'🧴'},
 {id:'other',en:'Other request',es:'Otra solicitud',dept:'frontdesk',icon:'💬'}
] as const;
function Guest({lang,setLang,theme,setTheme}:{lang:'en'|'es',setLang:(v:'en'|'es')=>void,theme:string,setTheme:(v:string)=>void}){
 const token=new URLSearchParams(location.search).get('token')||'';
 const storageKey='casaflow-guest-track-'+token.slice(0,16);
 const[selection,setSelection]=useState<(typeof guestCategories)[number]['id']>('extra_towels'),[detail,setDetail]=useState(''),[urgent,setUrgent]=useState(false),[tracking,setTracking]=useState<string>(()=>{try{return sessionStorage.getItem(storageKey)||''}catch{return ''}}),[ticket,setTicket]=useState<any>(null),[feedback,setFeedback]=useState<boolean|null>(null),[comment,setComment]=useState(''),[working,setWorking]=useState(false),[err,setErr]=useState('');
 const[roomInfo,setRoomInfo]=useState<{hotel:string,room:string}|null>(null),[roomError,setRoomError]=useState(''),[loading,setLoading]=useState(true);
 const en=lang==='en';const category=guestCategories.find(c=>c.id===selection)!;
 const refreshTicket=async(key:string)=>{const value=await rpc<any>('guest_ticket_status',{p_tracking_token:key});setTicket(value)};
 useEffect(()=>{let alive=true;setLoading(true);rpc<{hotel:string,room:string}>('guest_room_info',{p_token:token}).then(r=>{if(alive){setRoomInfo(r);setRoomError('')}}).catch(e=>{if(alive){setRoomError(e.message||'Invalid QR')}}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[token]);
 useEffect(()=>{if(!tracking)return;let alive=true;const run=async()=>{try{const value=await rpc<any>('guest_ticket_status',{p_tracking_token:tracking});if(alive)setTicket(value)}catch(e:any){if(alive)setErr(e.message||'Ticket status unavailable')}};void run();const id=window.setInterval(()=>void run(),10000);return()=>{alive=false;window.clearInterval(id)}},[tracking]);
 const stageLabel=(stage:string)=>({submitted:en?'Received': 'Recibida',queued:en?'Queued':'En cola',accepted:en?'Accepted':'Aceptada',in_progress:en?'In progress':'En progreso',awaiting_guest:en?'Completed — awaiting your confirmation':'Completada — esperando su confirmación',confirmed:en?'Resolved':'Resuelta',reopened:en?'Reopened':'Reabierta'}[stage]||stage?.replaceAll('_',' ')||'');
 return <div className="authpage"><div className="authcard guest guest-categories">
  <div className="authheader"><div className="logo large"><HandPlatter/></div><button className="headerbtn" onClick={()=>setLang(en?'es':'en')}>{en?'ES':'EN'}</button><button className="headerbtn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button></div>
  <h1>{en?'How can we help?':'¿En qué podemos ayudar?'}</h1><p>{loading?(en?'Checking room QR…':'Verificando QR…'):roomInfo?roomInfo.hotel+' · '+(en?'Room ':'Habitación ')+roomInfo.room:roomError}</p>
  {!loading&&roomInfo&&!tracking&&<form className="form" onSubmit={async e=>{e.preventDefault();setErr('');setWorking(true);try{const result=await rpc<{task_id:string,tracking_token:string}>('submit_guest_request_tracked',{p_token:token,p_category:selection,p_detail:detail,p_urgent:urgent});sessionStorage.setItem(storageKey,result.tracking_token);setTracking(result.tracking_token)}catch(e:any){setErr(e.message||'Request could not be submitted')}finally{setWorking(false)}}}>
   <div className="guest-choice-list" role="radiogroup" aria-label={en?'Request category':'Tipo de solicitud'}>{guestCategories.map(c=><label className={'guest-choice '+(selection===c.id?'chosen':'')} key={c.id}><input type="radio" name="guest-category" checked={selection===c.id} onChange={()=>{setSelection(c.id);setUrgent(false)}}/><span aria-hidden>{c.icon}</span><strong>{en?c.en:c.es}</strong><CheckCircle2 size={19}/></label>)}</div>
   <div className="guest-routed"><small>{en?'Automatically routed to':'Enviado automáticamente a'}</small><b>{category.dept==='housekeeping'?(en?'Housekeeping':'Limpieza'):category.dept==='maintenance'?(en?'Maintenance':'Mantenimiento'):(en?'Front desk':'Recepción')}</b></div>
   <label>{en?'Extra details (optional)':'Detalles adicionales (opcional)'}<textarea maxLength={1200} rows={3} value={detail} onChange={e=>setDetail(e.target.value)} placeholder={en?'Tell us what happened…':'Describa lo que sucedió…'}/></label>
   {!['extra_towels','missing_supplies'].includes(selection)&&<label className="checkline"><input type="checkbox" checked={urgent} onChange={e=>setUrgent(e.target.checked)}/>{en?'Urgent: serious issue needing immediate attention':'Urgente: problema grave que requiere atención inmediata'}</label>}
   {urgent&&<div className="auth-notice info">{en?'Front desk and management will also be alerted.':'Recepción y gerencia recibirán una alerta adicional.'}</div>}
   <button disabled={working} className="button primary full">{working?(en?'Sending…':'Enviando…'):(en?'Send request':'Enviar solicitud')}<Send size={16}/></button>
   {err&&<p role="alert" className="error">{err}</p>}
  </form>}
  {tracking&&<section className="form" aria-live="polite"><div className="success"><CheckCircle2 size={36}/><h2>{en?'Request tracking':'Seguimiento de solicitud'}</h2><p>{ticket?stageLabel(ticket.stage):en?'Loading your request…':'Cargando su solicitud…'}</p></div>
   {ticket&&<><div className="guest-routed"><small>{en?'Request':'Solicitud'}</small><b>{ticket.title||ticket.category}</b><small>{en?'Room':'Habitación'} {ticket.room}</small></div>
    <p className="tiny">{en?'Status updates automatically. Keep this page open or return using this browser session.':'El estado se actualiza automáticamente. Mantenga esta página abierta.'}</p>
    {ticket.stage==='awaiting_guest'&&<><label>{en?'Optional feedback':'Comentario opcional'}<textarea rows={2} maxLength={600} value={comment} onChange={e=>setComment(e.target.value)}/></label><div className="qr-actions"><button className="button primary" disabled={working} onClick={async()=>{setWorking(true);try{const value=await rpc<any>('guest_ticket_feedback',{p_tracking_token:tracking,p_resolved:true,p_comment:comment});setTicket(value)}catch(e:any){setErr(e.message||'Feedback failed')}finally{setWorking(false)}}}>{en?'Yes, resolved':'Sí, resuelto'}</button><button className="button outline" disabled={working} onClick={async()=>{setWorking(true);try{const value=await rpc<any>('guest_ticket_feedback',{p_tracking_token:tracking,p_resolved:false,p_comment:comment});setTicket(value)}catch(e:any){setErr(e.message||'Feedback failed')}finally{setWorking(false)}}}>{en?'Not resolved':'No resuelto'}</button></div></>}
    {ticket.stage==='confirmed'&&<p className="success">{en?'Thank you for confirming. Your request is closed.':'Gracias por confirmar. Su solicitud está cerrada.'}</p>}
   </>}
   {err&&<p className="error" role="alert">{err}</p>}
  </section>}
  {roomError&&<p className="error">{en?'Ask the front desk for a replacement room QR.':'Solicite un nuevo QR en recepción.'}</p>}
  <p className="tiny">{en?'Requests are limited to prevent misuse. For medical emergencies, contact emergency services or the front desk directly.':'Las solicitudes tienen límites. En caso de emergencia médica contacte a emergencias o recepción.'}</p>
 </div></div>
}
createRoot(document.getElementById('root')!).render(location.pathname==='/demo-launch'?<DemoLaunch/>:<App/>);
