import { activeSession, adminClient, DEMO_ROLES, json, readCookie } from './_shared.js';

export default async function handler(req,res) {
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
  try {
    const session=await activeSession(adminClient(),readCookie(req));
    if(!session) return json(res,200,{active:false});
    return json(res,200,{active:true,expiresAt:session.expires_at,roles:Object.keys(DEMO_ROLES)});
  } catch(error) {
    console.error('Demo status check failed:',error?.message||'unknown');
    return json(res,503,{active:false,error:'Unable to verify demo session.'});
  }
}
