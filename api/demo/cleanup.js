import { adminClient, constantTimeEqual, json } from '../../server/demo-shared.js';

export default async function handler(req,res) {
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
  const expected=process.env.CRON_SECRET||'';
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\\s+/i,'');
  if(!expected||!constantTimeEqual(expected,supplied)) return json(res,401,{error:'Unauthorized.'});
  try {
    const admin=adminClient();
    const {data:expired,error}=await admin.from('demo_sessions').select('id,hotel_id').or('revoked_at.not.is.null,expires_at.lte.'+new Date().toISOString()).limit(100);
    if(error) throw error;
    let removedUsers=0,removedWorkspaces=0;
    for(const session of expired||[]) {
      const {data:mappings,error:mapError}=await admin.from('demo_session_users').select('user_id').eq('session_id',session.id);
      if(mapError) throw mapError;
      for(const mapping of mappings||[]) {
        const {error:deleteError}=await admin.auth.admin.deleteUser(mapping.user_id);
        if(deleteError&&deleteError.status!==404) throw deleteError;
        removedUsers++;
      }
      if(session.hotel_id) {
        const {error:hotelError}=await admin.from('hotels').delete().eq('id',session.hotel_id);
        if(hotelError) throw hotelError;
        removedWorkspaces++;
      }
      const {error:sessionError}=await admin.from('demo_sessions').delete().eq('id',session.id);
      if(sessionError) throw sessionError;
    }
    await admin.from('demo_rate_limits').delete().lt('window_started_at',new Date(Date.now()-86400000).toISOString());
    return json(res,200,{cleanedSessions:(expired||[]).length,removedUsers,removedWorkspaces});
  } catch(error) {
    console.error('Demo cleanup failed:',error?.message||'unknown');
    return json(res,500,{error:'Demo cleanup failed.'});
  }
}
