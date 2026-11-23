import {useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase.js';
const SK=import.meta.env.VITE_TURNSTILE_SITE_KEY;
export default function Auth(){
 const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',email:'',password:'',agree:false,hp:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[tok,setTok]=useState(''),box=useRef(),wid=useRef(null),t0=useRef(Date.now());
 useEffect(()=>{if(!SK)return;const draw=()=>{if(box.current&&window.turnstile&&wid.current==null)wid.current=window.turnstile.render(box.current,{sitekey:SK,theme:'dark',callback:setTok,'expired-callback':()=>setTok('')})};
  if(window.turnstile)draw();else{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=draw;document.head.appendChild(s)}},[]);
 const set=k=>e=>setF({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value});
 const reset=()=>{if(window.turnstile&&wid.current!=null){window.turnstile.reset(wid.current);setTok('')}};
 const submit=async e=>{e.preventDefault();setMsg('');
  if(f.hp||Date.now()-t0.current<2000)return;
  if(SK&&!tok)return setMsg('Please complete the human check.');
  if(f.password.length<8)return setMsg('Password must be at least 8 characters.');
  if(mode==='up'&&(!f.agree||f.name.trim().length<2))return setMsg('Enter your name and accept the terms.');
  setBusy(true);const o=SK?{captchaToken:tok}:{};
  const r=mode==='up'?await supabase.auth.signUp({email:f.email.trim(),password:f.password,options:{...o,data:{name:f.name.trim().slice(0,40)}}}):await supabase.auth.signInWithPassword({email:f.email.trim(),password:f.password,options:o});
  setBusy(false);reset();
  if(r.error)setMsg(r.error.message);else if(mode==='up'&&!r.data.session)setMsg('Check your email to confirm your account.')};
 const forgot=async()=>{if(!f.email)return setMsg('Enter your email first.');if(SK&&!tok)return setMsg('Complete the human check first.');const r=await supabase.auth.resetPasswordForEmail(f.email.trim(),{captchaToken:tok||undefined});reset();setMsg(r.error?r.error.message:'If the email exists, a reset link was sent.')};
 return <div className="min-h-screen grid place-items-center p-4"><form onSubmit={submit} className="glass w-full max-w-sm rounded-3xl p-7 space-y-3">
  <h1 className="text-3xl font-extrabold tracking-tight">BUILDMATIC</h1><p className="text-sm text-zinc-400">Level up your skills.</p>
  <div className="flex gap-2 text-sm">{[['in','Sign in'],['up','Sign up']].map(([k,l])=><button type="button" key={k} onClick={()=>{setMode(k);setMsg('')}} className="px-4 py-1.5 rounded-full border" style={{borderColor:mode===k?'#7950F2':'#232326',color:mode===k?'#fff':'#A1A1AA'}}>{l}</button>)}</div>
  {mode==='up'&&<input className="inp" placeholder="Name" value={f.name} onChange={set('name')} maxLength={40} autoComplete="name"/>}
  <input className="inp" type="email" placeholder="Email" value={f.email} onChange={set('email')} autoComplete="email" required/>
  <input className="inp" type="password" placeholder="Password (8+ characters)" value={f.password} onChange={set('password')} autoComplete={mode==='up'?'new-password':'current-password'} required/>
  <input tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" value={f.hp} onChange={set('hp')} style={{position:'absolute',left:'-9999px',opacity:0,height:0,width:0}}/>
  <div ref={box}/>
  {mode==='up'&&<label className="flex gap-2 text-xs text-zinc-400"><input type="checkbox" checked={f.agree} onChange={set('agree')}/>I agree to the <a className="underline" href="/terms.html" target="_blank" rel="noreferrer">Terms</a> and <a className="underline" href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a></label>}
  <button disabled={busy} className="w-full h-12 rounded-2xl font-semibold text-white disabled:opacity-60" style={{background:'linear-gradient(90deg,#4C6EF5,#7950F2)'}}>{busy?'…':mode==='up'?'Create account':'Sign in'}</button>
  {mode==='in'&&<button type="button" onClick={forgot} className="text-xs text-zinc-400 underline">Forgot password?</button>}
  {msg&&<p className="text-sm text-amber-300" role="alert">{msg}</p>}
 </form></div>}
