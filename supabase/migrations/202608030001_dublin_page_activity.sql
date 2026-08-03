-- Privacy-conscious, aggregate-friendly activity tracking for the Dublin guide.
create table if not exists public.page_activity_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  page_path text not null check (page_path = '/dublin.html'),
  event_type text not null check (event_type = 'page_open'),
  visitor_id uuid not null,
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null
);
create index if not exists page_activity_events_page_time_idx on public.page_activity_events (page_path, occurred_at desc);
create index if not exists page_activity_events_visitor_idx on public.page_activity_events (visitor_id, occurred_at desc);
alter table public.page_activity_events enable row level security;
drop policy if exists "record Dublin page opens" on public.page_activity_events;
create policy "record Dublin page opens" on public.page_activity_events for insert to anon, authenticated with check (
  page_path = '/dublin.html' and event_type = 'page_open' and visitor_id is not null and session_id is not null and (user_id is null or user_id = auth.uid())
);
create or replace function public.get_dublin_activity_summary()
returns table (page_opens bigint, unique_visitors bigint, opens_last_24_hours bigint, latest_open_at timestamptz)
language sql security definer set search_path = public as $$
  select count(*)::bigint, count(distinct visitor_id)::bigint, count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint, max(occurred_at)
  from public.page_activity_events
  where page_path = '/dublin.html' and auth.jwt() ->> 'email' = 'mybuddyjonathan@gmail.com';
$$;
revoke all on function public.get_dublin_activity_summary() from public;
grant execute on function public.get_dublin_activity_summary() to authenticated;
