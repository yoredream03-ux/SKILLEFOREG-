import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/inter/400.css';import '@fontsource/inter/500.css';import '@fontsource/inter/600.css';import '@fontsource/inter/700.css';import '@fontsource/inter/800.css';import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import App from './App.js';
import Auth from './Auth.jsx';
import {supabase,configured} from './lib/supabase.js';
const AGENT=(import.meta.env.VITE_SUPABASE_URL||'')+'/functions/v1/agent';
function Recover({onDone}){const [p,setP]=useState(''),[m,setM]=useState('');const go=async e=>{e.preventDefault();if(p.length<8)return setM('Password must be at least 8 characters.');const r=await supabase.auth.updateUser({password:p});if(r.error)setM(r.error.message);else onDone()};return <div className="min-h-screen grid place-items-center p-4"><form onSubmit={go} className="glass w-full max-w-sm rounded-3xl p-7 space-y-3"><h1 className="text-2xl font-extrabold">Set a new password</h1><input className="inp" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={p} onChange={e=>setP(e.target.value)}/><button className="w-full h-12 rounded-2xl font-semibold text-white" style={{background:'linear-gradient(90deg,#4C6EF5,#7950F2)'}}>Save password</button>{m&&<p className="text-sm text-amber-300">{m}</p>}</form></div>}
function Root(){
 const [s,setS]=useState(undefined),[init,setInit]=useState(null),[rec,setRec]=useState(false),t=useRef(),tok=useRef('');
 useEffect(()=>{if(!configured){setS(null);return}supabase.auth.getSession().then(({data})=>setS(data.session));const {data:l}=supabase.auth.onAuthStateChange((e,x)=>{if(e==='PASSWORD_RECOVERY')setRec(true);setS(x)});return()=>l.subscription.unsubscribe()},[]);
 tok.current=s?s.access_token:'';
 useEffect(()=>{window.__award=n=>supabase.rpc('award_xp',{p_amount:n,p_reason:'app'}).then(r=>r.error?null:r.data);
  window.claude={use:async()=>async(input,o={})=>{const r=await fetch(AGENT,{method:'POST',signal:o.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok.current,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY},body:JSON.stringify({messages:input})});const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'error');e.code=r.status===429?'rate_limited':'error';e.text=j.error;throw e}o.onText&&o.onText({text:j.text,delta:j.text});return{text:j.text}}}},[]);
 const uid=s&&s.user.id;
 useEffect(()=>{setInit(null);if(!uid)return;let off=false;(async()=>{const [a,b]=await Promise.all([supabase.from('profiles').select('xp').eq('id',uid).single(),supabase.from('user_state').select('data').eq('user_id',uid).maybeSingle()]);if(off)return;const d=(b.data&&b.data.data)||{};const u=s.user;setInit({...d,xp:a.data?a.data.xp:0,acct:{name:(u.user_metadata&&u.user_metadata.name)||'',email:u.email}})})();return()=>{off=true}},[uid]);
 const save=db=>{clearTimeout(t.current);t.current=setTimeout(()=>supabase.from('user_state').upsert({user_id:uid,data:db,updated_at:new Date().toISOString()}),1500)};
 if(!configured)return <div className="min-h-screen grid place-items-center p-6 text-center"><p>Missing config: copy <code>.env.example</code> to <code>.env</code> and fill in your Supabase keys.</p></div>;
 if(s===undefined||(s&&!init))return <div className="min-h-screen grid place-items-center text-zinc-400">Loading…</div>;
 if(!s)return <Auth/>;
 if(rec)return <Recover onDone={()=>setRec(false)}/>;
 return <App key={uid} initial={init} onSave={save} user={s.user} onSignOut={()=>supabase.auth.signOut()}/>}
createRoot(document.getElementById('root')).render(<Root/>);
