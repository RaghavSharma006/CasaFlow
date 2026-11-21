import { activeSession, adminClient, assertSameOrigin, clearCookieHeader, json, readCookie } from '../../server/demo-shared.js';

export default async function handler(req,res) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  if(!assertSameOrigin(req)) return json(res,403,{error:'Origin check failed.'});
  try {
    const admin=adminClient();
    const session=await activeSession(admin,readCookie(req));
    if(session) {
      const {error}=await admin.from('demo_sessions').update({revoked_at:new Date().toISOString()}).eq('id',session.id);
      if(error) throw error;
    }
    res.setHeader('Set-Cookie',clearCookieHeader());
    return json(res,200,{ended:true});
  } catch(error) {
    console.error('Demo logout failed:',error?.message||'unknown');
    res.setHeader('Set-Cookie',clearCookieHeader());
    return json(res,503,{error:'Could not end the demo session cleanly.'});
  }
}
