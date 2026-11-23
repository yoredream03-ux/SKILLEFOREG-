-- BUILDMATIC schema. Run in Supabase SQL Editor.
create table profiles(id uuid primary key references auth.users on delete cascade, name text, xp int not null default 0 check(xp>=0), created_at timestamptz not null default now());
create table user_state(user_id uuid primary key references auth.users on delete cascade, data jsonb not null default '{}', updated_at timestamptz not null default now());
create table xp_events(id bigserial primary key, user_id uuid not null references auth.users on delete cascade, amount int not null, reason text, created_at timestamptz not null default now());
create table agent_usage(id bigserial primary key, user_id uuid not null references auth.users on delete cascade, created_at timestamptz not null default now());
create table elite_messages(id bigserial primary key, user_id uuid not null references auth.users on delete cascade, author text not null default 'member', body text not null check(char_length(body) between 1 and 500), created_at timestamptz not null default now());
alter table profiles enable row level security; alter table user_state enable row level security; alter table xp_events enable row level security; alter table agent_usage enable row level security; alter table elite_messages enable row level security;
-- profiles: read own, edit name only (xp is server-controlled)
create policy "profile read own" on profiles for select using (auth.uid()=id);
create policy "profile update own" on profiles for update using (auth.uid()=id);
revoke update on profiles from authenticated, anon; grant update(name) on profiles to authenticated;
create policy "state own" on user_state for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "xp events read own" on xp_events for select using (auth.uid()=user_id);
-- Elite chat: only members with >= 3000 XP can read or write
create policy "elite read" on elite_messages for select using ((select xp from profiles where id=auth.uid())>=3000);
create policy "elite write" on elite_messages for insert with check (user_id=auth.uid() and (select xp from profiles where id=auth.uid())>=3000);
-- new user -> profile
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),40)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
-- XP: max 50 per call, 500 per rolling 24h
create function award_xp(p_amount int, p_reason text) returns int language plpgsql security definer set search_path=public as $$
declare today int; n int; begin
 if auth.uid() is null then raise exception 'auth required'; end if;
 if p_amount<1 or p_amount>50 then raise exception 'bad amount'; end if;
 select coalesce(sum(amount),0) into today from xp_events where user_id=auth.uid() and created_at>now()-interval '24 hours';
 if today+p_amount>500 then select xp into n from profiles where id=auth.uid(); return n; end if;
 insert into xp_events(user_id,amount,reason) values(auth.uid(),p_amount,left(p_reason,40));
 update profiles set xp=xp+p_amount where id=auth.uid() returning xp into n; return n; end $$;
-- Agent quota: 30 requests per rolling 24h
create function agent_quota_ok() returns boolean language plpgsql security definer set search_path=public as $$
declare c int; begin
 select count(*) into c from agent_usage where user_id=auth.uid() and created_at>now()-interval '24 hours';
 if c>=30 then return false; end if; insert into agent_usage(user_id) values(auth.uid()); return true; end $$;
-- Chat: author comes from the profile (no spoofing) + 1 message / 2 seconds
create function elite_before_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from elite_messages where user_id=new.user_id and created_at>now()-interval '2 seconds') then raise exception 'slow down'; end if;
 new.author:=coalesce((select name from profiles where id=new.user_id),'member'); return new; end $$;
create trigger elite_guard before insert on elite_messages for each row execute function elite_before_insert();
alter publication supabase_realtime add table elite_messages;
-- Right to erasure: the user deletes their own account (cascades to all their rows)
create function delete_my_account() returns void language plpgsql security definer set search_path=public,auth as $$
begin if auth.uid() is null then raise exception 'auth required'; end if; delete from auth.users where id=auth.uid(); end $$;
revoke execute on function delete_my_account() from public, anon; grant execute on function delete_my_account() to authenticated;
revoke execute on function award_xp(int,text) from public, anon; grant execute on function award_xp(int,text) to authenticated;
revoke execute on function agent_quota_ok() from public, anon; grant execute on function agent_quota_ok() to authenticated;
