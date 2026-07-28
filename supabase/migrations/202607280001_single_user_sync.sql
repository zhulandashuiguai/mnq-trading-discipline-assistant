create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.strategies (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  entry_rules jsonb not null,
  exit_rules jsonb not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.trades (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  status text not null check (status in ('open', 'closed')),
  trading_date date not null,
  entered_at timestamptz not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create unique index trades_one_open_per_user on public.trades (user_id) where status = 'open';

create table public.daily_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  trading_date date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, trading_date)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create trigger strategies_updated_at before update on public.strategies for each row execute function public.set_updated_at();
create trigger trades_updated_at before update on public.trades for each row execute function public.set_updated_at();
create trigger daily_notes_updated_at before update on public.daily_notes for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.strategies enable row level security;
alter table public.trades enable row level security;
alter table public.daily_notes enable row level security;

create policy "Users manage their own settings" on public.app_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own strategies" on public.strategies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own trades" on public.trades for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own notes" on public.daily_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_settings, public.strategies, public.trades, public.daily_notes to authenticated;

alter publication supabase_realtime add table public.app_settings;
alter publication supabase_realtime add table public.strategies;
alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.daily_notes;
