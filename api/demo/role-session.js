import { activeSession, adminClient, assertSameOrigin, DEMO_ROLES, json, readCookie } from './_shared.js';

export default async function handler(req,res) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  if(!assertSameOrigin(req)) return json(res,403,{error:'Origin check failed.'});
  const roleKey=String(req.body?.role||'');
  if(!Object.prototype.hasOwnProperty.call(DEMO_ROLES,roleKey)) return json(res,400,{error:'Unknown demo role.'});
  try {
    const admin=adminClient();
    const session=await activeSession(admin,readCookie(req));
    if(!session) return json(res,401,{error:'Your demo session expired. Start a new demo.'});
    const {data:mapping,error:mappingError}=await admin.from('demo_session_users').select('user_id').eq('session_id',session.id).eq('role_key',roleKey).maybeSingle();
    if(mappingError) throw mappingError;
    if(!mapping) return json(res,404,{error:'That demo role is unavailable.'});
    const {data:userData,error:userError}=await admin.auth.admin.getUserById(mapping.user_id);
    if(userError||!userData?.user?.email) throw userError||new Error('Demo user is missing.');
    const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email:userData.user.email});
    if(error) throw error;
    const tokenHash=data?.properties?.hashed_token;
    if(!tokenHash) throw new Error('Supabase did not return a one-time sign-in token.');
    return json(res,200,{tokenHash,role:roleKey,expiresAt:session.expires_at});
  } catch(error) {
    console.error('Demo role launch failed:',error?.message||'unknown');
    return json(res,503,{error:'Could not launch this role. Please retry.'});
  }
}
