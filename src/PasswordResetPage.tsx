import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{db}from'./db';
import './styles.css';

function PasswordResetPage(){
 const[ready,setReady]=useState(false),[session,setSession]=useState(false);
 const[recovery,setRecovery]=useState(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery');
 const[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!db){setReady(true);return}
  const auth=db;
  const{data:{subscription}}=auth.auth.onAuthStateChange((event,s)=>{
   if(event==='PASSWORD_RECOVERY')setRecovery(true);
   setSession(Boolean(s));
  });
  auth.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(Boolean(data.session))}).catch(e=>setError(String(e))).finally(()=>setReady(true));
  return()=>subscription.unsubscribe();
 },[]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');
  if(!db||!recovery||!session){setError('This recovery link is invalid or expired. Request a new email.');return}
  if(password.length<8){setError('Use a password with at least 8 characters.');return}
  if(password!==confirm){setError('Passwords do not match.');return}
  setBusy(true);
  try{
   const{error:changeError}=await db.auth.updateUser({password});
   if(changeError)throw changeError;
   await db.auth.signOut();
   window.history.replaceState(null,'','/reset-password');
   setDone(true);
  }catch(e:any){setError(e?.message||'Password update failed. Request a new reset link.')}
  finally{setBusy(false)}
 };
 return <div className="authpage"><div className="authcard">
  <div className="authheader"><div className="logo large">C</div></div>
  <h1>CasaFlow</h1><h2>{done?'Password updated':'Set a new password'}</h2>
  {!ready?<p role="status">Checking your recovery link...</p>:done?<><p className="auth-notice success" role="status">Password updated. Sign in with your new password.</p><a className="button primary full" href="/">Go to sign in</a></>:session&&recovery?<form className="form" onSubmit={e=>void submit(e)}>
    <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" required/></label>
    <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required/></label>
    <button type="submit" className="button primary full" disabled={busy}>{busy?'Updating...':'Update password'}</button>
   </form>:<p className="auth-notice error" role="alert">This password-reset link is invalid or expired. Request another email from CasaFlow.</p>}
  {error&&<p className="auth-notice error" role="alert">{error}</p>}
  {!done&&<div className="auth-links"><a href="/">Back to sign in</a></div>}
 </div></div>
}
createRoot(document.getElementById('root')!).render(<PasswordResetPage/>);
