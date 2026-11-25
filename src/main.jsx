import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '../index.css';
import App from '../App.js';
import Auth from '../Auth.jsx';
import { supabase, configured } from '../lib/supabase.js';

const AGENT = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/agent`;

function Recover({ onDone }) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventEvent?.();
    event.preventDefault();
    if (password.length < 8) return setMessage('Password must be at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : 'Password updated.');
    if (!error) onDone();
  };

  return <div className="min-h-screen grid place-items-center p-6">
    <form onSubmit={submit} className="glass w-full max-w-sm rounded-3xl p-7 space-y-3">
      <h1 className="text-xl font-bold">Set a new password</h1>
      <input className="inp" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <button className="w-full h-12 rounded-xl text-white" style={{ background: '#7950F2' }}>Update password</button>
      {message && <p className="text-sm text-amber-300">{message}</p>}
    </form>
  </div>;
}

function Root() {
  const [session, setSession] = useState(undefined);
  const [initial, setInitial] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const saveTimer = useRef();

  useEffect(() => {
    if (!configured) {
      setSession(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured) return;
    const token = () => supabase.auth.getSession().then(({ data }) => data.session?.access_token || '');

    window.__award = async (amount) => {
      const { data, error } = await supabase.rpc('award_xp', { p_amount: amount, p_reason: 'app' });
      return error ? null : data;
    };

    window.claude = {
      use: async () => async (input, options = {}) => {
        const accessToken = await token();
        const response = await fetch(AGENT, {
          method: 'POST',
          signal: options.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ messages: input }),
        });
        const result = await response.json();
        return { text: result.text || result.error || '' };
      },
    };
  }, []);

  useEffect(() => {
    setInitial(null);
    if (!session?.user) return;

    let cancelled = false;
    (async () => {
      const userId = session.user.id;
      const [profile, state] = await Promise.all([
        supabase.from('profiles').select('xp').eq('id', userId).maybeSingle(),
        supabase.from('user_state').select('data').eq('user_id', userId).maybeSingle(),
      ]);
      if (!cancelled) {
        const fallback = state.data?.data || null;
        setInitial(fallback ? { ...fallback, xp: profile.data?.xp ?? fallback.xp ?? 0 } : null);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const save = (database) => {
    if (!session?.user) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('user_state').upsert({
        user_id: session.user.id,
        data: database,
        updated_at: new Date().toISOString(),
      });
    }, 1500);
  };

  if (!configured) {
    return <div className="min-h-screen grid place-items-center p-6 text-center" dir="rtl">
      <p>إعداد Supabase غير مكتمل: انسخ <code>.env.example</code> إلى <code>.env</code> ثم ضع عنوان المشروع ومفتاحه العام.</p>
    </div>;
  }

  if (session === undefined || (session && initial === null)) {
    return <div className="min-h-screen grid place-items-center text-zinc-400">Loading…</div>;
  }
  if (!session) return <Auth />;
  if (recovering) return <Recover onDone={() => setRecovering(false)} />;

  return <App
    key={session.user.id}
    initial={initial}
    onSave={save}
    user={session.user}
    onSignOut={() => supabase.auth.signOut()}
  />;
}

createRoot(document.getElementById('root')).render(<Root />);
