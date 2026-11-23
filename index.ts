import { createClient } from 'jsr:@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '', { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return out({ error: 'Please sign in.' }, 401);
  let body: any; try { body = await req.json(); } catch { return out({ error: 'Bad request' }, 400); }
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12).map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '').slice(0, 8000) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) return out({ error: 'Empty message' }, 400);
  const { data: ok } = await sb.rpc('agent_quota_ok');
  if (!ok) return out({ error: 'Daily Agent limit reached (30). Try tomorrow.' }, 429);
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5', max_tokens: 1000, messages: msgs }) });
  if (!r.ok) return out({ error: 'Agent unavailable' }, 502);
  const j = await r.json();
  return out({ text: (j.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') });
});
