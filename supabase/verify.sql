-- BUILDMATIC OS V11 / Supabase verification checks
-- Read-only checks. Run after applying supabase/schema.sql in the SQL Editor.
-- Each row reports PASS or FAIL and identifies the table/function checked.

with expected_tables(table_name) as (
  values
    ('profiles'),
    ('user_state'),
    ('xp_events'),
    ('agent_usage'),
    ('marketplace_skills'),
    ('dev_news'),
    ('elite_messages')
), checks as (
  -- Check every expected project table has RLS enabled.
  select
    case when coalesce(t.rowsecurity, false) then 'PASS' else 'FAIL' end as status,
    format('RLS enabled: public.%s', e.table_name) as check_name,
    case when t.tablename is null then 'Table is missing.'
         when t.rowsecurity then 'Row-level security is enabled.'
         else 'RLS is disabled.' end as details
  from expected_tables e
  left join pg_tables t
    on t.schemaname = 'public' and t.tablename = e.table_name
  left join pg_class c
    on c.relnamespace = 'public'::regnamespace and c.relname = e.table_name
  -- pg_tables doesn't expose rowsecurity, so use pg_class for the actual flag.
  left join lateral (select c.relrowsecurity as rowsecurity) r on true
  where t.tablename is null or c.oid is not null

  union all

  -- Also flag any additional public table that has been added without RLS.
  select
    case when c.relrowsecurity then 'PASS' else 'FAIL' end,
    format('RLS enabled: public.%s', c.relname),
    case when c.relrowsecurity then 'RLS is enabled.' else 'RLS is disabled.' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname not in (select table_name from expected_tables)

  union all

  -- Verify there is at least one RLS policy on every public table.
  select
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
    ) then 'PASS' else 'FAIL' end,
    format('RLS policies present: public.%s', c.relname),
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname
    ) then 'At least one policy exists.' else 'No policy exists; access is denied but review table intent.' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')

  union all

  -- Private data must have owner-scoped policies; shared data retains shared reads
  -- and restricts writes to the authenticated owner/author.
  select
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = spec.table_name
        and p.policyname = spec.policy_name
        and p.cmd = spec.command_name
        and p.roles @> array['authenticated']::name[]
        and position(spec.required_predicate in lower(
          coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')
        )) > 0
    ) then 'PASS' else 'FAIL' end,
    format('Policy %s: public.%s', spec.policy_name, spec.table_name),
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = spec.table_name
        and p.policyname = spec.policy_name
        and p.cmd = spec.command_name
        and p.roles @> array['authenticated']::name[]
        and position(spec.required_predicate in lower(
          coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')
        )) > 0
    ) then 'Expected command, authenticated role, and owner/shared predicate found.'
    else format('Missing or incorrect policy. Expected %s policy for authenticated with predicate containing: %s', spec.command_name, spec.required_predicate) end
  from (values
    ('profiles', 'profiles own select', 'SELECT', 'id = auth.uid()'),
    ('profiles', 'profiles own update', 'UPDATE', 'id = auth.uid()'),
    ('user_state', 'user state own all', 'ALL', 'user_id = auth.uid()'),
    ('xp_events', 'xp events own select', 'SELECT', 'user_id = auth.uid()'),
    ('agent_usage', 'agent usage own select', 'SELECT', 'user_id = auth.uid()'),
    ('marketplace_skills', 'marketplace authenticated read', 'SELECT', 'true'),
    ('marketplace_skills', 'marketplace owner insert', 'INSERT', 'owner_id = auth.uid()'),
    ('marketplace_skills', 'marketplace owner update', 'UPDATE', 'owner_id = auth.uid()'),
    ('marketplace_skills', 'marketplace owner delete', 'DELETE', 'owner_id = auth.uid()'),
    ('dev_news', 'news authenticated read', 'SELECT', 'true'),
    ('dev_news', 'news owner insert', 'INSERT', 'author_id = auth.uid()'),
    ('dev_news', 'news owner update', 'UPDATE', 'author_id = auth.uid()'),
    ('dev_news', 'news owner delete', 'DELETE', 'author_id = auth.uid()'),
    ('elite_messages', 'elite qualifying read', 'SELECT', 'has_elite_xp()'),
    ('elite_messages', 'elite qualifying insert', 'INSERT', 'user_id = auth.uid()')
  ) as spec(table_name, policy_name, command_name, required_predicate)

  union all

  -- Sensitive RPCs must not be executable by PUBLIC or anon; authenticated can use them.
  select
    case when p.oid is not null
      and not exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      )
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      then 'PASS' else 'FAIL' end,
    format('Function grants: public.%s', spec.function_name),
    case when p.oid is null then 'Function is missing.'
      when exists (
        select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ) then 'EXECUTE is still granted to PUBLIC.'
      when has_function_privilege('anon', p.oid, 'EXECUTE') then 'anon can execute this function.'
      when not has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'authenticated cannot execute this function.'
      else 'PUBLIC and anon are denied; authenticated can execute.' end
  from (values
    ('award_xp', 'integer, text'),
    ('agent_quota_ok', ''),
    ('delete_my_account', '')
  ) as spec(function_name, argument_types)
  left join pg_proc p
    on p.pronamespace = 'public'::regnamespace
   and p.proname = spec.function_name
   and pg_get_function_identity_arguments(p.oid) = spec.argument_types

  union all

  -- The current schema publishes the shared Elite conversation for Realtime.
  select
    case when exists (
      select 1 from pg_publication_tables pt
      where pt.pubname = 'supabase_realtime'
        and pt.schemaname = 'public'
        and pt.tablename = 'elite_messages'
    ) then 'PASS' else 'FAIL' end,
    'Realtime publication: public.elite_messages',
    case when exists (
      select 1 from pg_publication_tables pt
      where pt.pubname = 'supabase_realtime'
        and pt.schemaname = 'public'
        and pt.tablename = 'elite_messages'
    ) then 'elite_messages is included in supabase_realtime.'
    else 'elite_messages is not included in supabase_realtime.' end
)
select status, check_name, details
from checks
order by case status when 'FAIL' then 0 else 1 end, check_name;
