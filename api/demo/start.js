import { adminClient, activeSession, assertSameOrigin, clientIp, cookieHeader, DEMO_ROLES, DEMO_TTL_SECONDS, hashSecret, json, randomSecret, readCookie, verifyTurnstile } from '../../server/demo-shared.js';

function userSpecs(sessionId) {
  return Object.entries(DEMO_ROLES).map(([roleKey,meta]) => ({
    roleKey, staffRole:meta.staffRole, displayName:meta.displayName,
    email:'casaflow-demo+'+sessionId+'-'+roleKey+'@example.com',
    password:randomSecret(),
  }));
}

export default async function handler(req,res) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  if(!assertSameOrigin(req)) return json(res,403,{error:'Origin check failed.'});
  let admin;
  try {
    admin=adminClient();
    const existing=await activeSession(admin,readCookie(req));
    if(existing) {
      const raw=readCookie(req);
      const remaining=Math.max(0,Math.floor((Date.parse(existing.expires_at)-Date.now())/1000));
      res.setHeader('Set-Cookie',cookieHeader(raw,remaining));
      return json(res,200,{active:true,expiresAt:existing.expires_at,roles:Object.keys(DEMO_ROLES)});
    }

    const ip=clientIp(req);
    if(!(await verifyTurnstile(req.body?.turnstileToken,ip))) return json(res,400,{error:'Please complete the security check and try again.'});
    const ipHash=hashSecret(ip);
    const rate=await admin.rpc('demo_rate_limit_allow',{p_key:ipHash,p_limit:5,p_window_seconds:900});
    if(rate.error) throw rate.error;
    if(rate.data!==true) return json(res,429,{error:'Too many demo launches. Please try again in 15 minutes.'});

    const sessionId=crypto.randomUUID();
    const cookieValue=randomSecret();
    const expiresAt=new Date(Date.now()+DEMO_TTL_SECONDS*1000).toISOString();
    const inserted=await admin.from('demo_sessions').insert({id:sessionId,cookie_hash:hashSecret(cookieValue),expires_at:expiresAt,ip_hash:ipHash});
    if(inserted.error) throw inserted.error;

    const created=[];
    try {
      for(const spec of userSpecs(sessionId)) {
        const {data,error}=await admin.auth.admin.createUser({
          email:spec.email,password:spec.password,email_confirm:true,
          app_metadata:{casaflow_demo:true,casaflow_demo_session_id:sessionId,casaflow_demo_role:spec.roleKey},
        });
        if(error) throw error;
        created.push({userId:data.user.id,...spec});
      }
      const provision=await admin.rpc('provision_demo_workspace',{
        p_session_id:sessionId,
        p_users:created.map(u=>({user_id:u.userId,role_key:u.roleKey,staff_role:u.staffRole,display_name:u.displayName})),
      });
      if(provision.error) throw provision.error;
      const payload=typeof provision.data==='string'?JSON.parse(provision.data):provision.data;
      res.setHeader('Set-Cookie',cookieHeader(cookieValue));
      return json(res,201,{
        active:true,expiresAt,roles:Object.keys(DEMO_ROLES),
        sampleGuestUrl:payload?.sample_guest_token?'/guest?token='+encodeURIComponent(payload.sample_guest_token):null,
      });
    } catch(error) {
      await Promise.allSettled(created.map(u=>admin.auth.admin.deleteUser(u.userId)));
      await admin.from('demo_sessions').delete().eq('id',sessionId);
      throw error;
    }
  } catch(error) {
    console.error('Demo workspace creation failed:',error?.message||'unknown');
    return json(res,503,{error:'The interactive demo is temporarily unavailable. Please try again later.'});
  }
}
