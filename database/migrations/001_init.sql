-- Signal Match — initial schema
-- Requires: pgvector extension (Supabase: enable via Database > Extensions)
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============ USERS ============
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text not null,
  email_verified boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_users_email on users (lower(email));
create index if not exists idx_users_clerk_id on users (clerk_user_id);

-- ============ SIGNALS ============
create table if not exists signals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  looking_for text not null,
  can_offer text not null,
  location text default 'Global',
  normalized_looking_for text,
  normalized_can_offer text,
  looking_embedding vector(1536),
  offer_embedding vector(1536),
  status text not null default 'pending_moderation'
    check (status in ('pending_moderation','active','paused','flagged','deleted')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','flagged','rejected')),
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_signals_status on signals(status);
create index if not exists idx_signals_user_id on signals(user_id);
create index if not exists idx_signals_created_at on signals(created_at);

-- Only one active signal per user (MVP keeps it simple — "my signal", singular)
create unique index if not exists idx_signals_one_active_per_user
  on signals(user_id) where status in ('pending_moderation','active','paused');

-- ============ MATCHES ============
create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  signal_a_id uuid not null references signals(id) on delete cascade,
  signal_b_id uuid not null references signals(id) on delete cascade,
  pair_key text generated always as (
    least(signal_a_id::text, signal_b_id::text) || ':' || greatest(signal_a_id::text, signal_b_id::text)
  ) stored,
  forward_score numeric(5,2) not null,
  reverse_score numeric(5,2),
  location_score numeric(5,2) default 0,
  overall_score numeric(5,2) not null,
  match_type text not null check (match_type in ('direct','reciprocal','one_way')),
  confidence text not null check (confidence in ('strong','good','potential')),
  explanation text not null,
  token text unique not null,
  status text not null default 'pending'
    check (status in ('pending','viewed','interested_a','interested_b','mutual','rejected','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_matches_pair_key on matches(pair_key);
create index if not exists idx_matches_signal_a on matches(signal_a_id);
create index if not exists idx_matches_signal_b on matches(signal_b_id);
create index if not exists idx_matches_status on matches(status);

-- ============ INTERESTS ============
create table if not exists interests (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  interested boolean not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);
create index if not exists idx_interests_match_id on interests(match_id);

-- ============ REFERRALS ============
create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  source text not null default 'signal_match',
  referral_code text not null,
  rightsignal_clicked boolean not null default false,
  rightsignal_signup boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_referrals_code on referrals(referral_code);

-- ============ EMAIL EVENTS ============
create table if not exists email_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  provider_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','bounced')),
  created_at timestamptz not null default now()
);

-- ============ REPORTS ============
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references users(id) on delete set null,
  target_id uuid references signals(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

-- ============ ADMIN USERS ============
create table if not exists admin_users (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text not null,
  role text not null default 'admin' check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

-- ============ REQUESTS (pass-it-on / forwarding) ============
create table if not exists requests (
  id uuid primary key default uuid_generate_v4(),
  signal_id uuid not null references signals(id) on delete cascade,
  token text unique not null,
  forwarded_by_user_id uuid references users(id) on delete set null,
  response text check (response in ('know_someone','might_know','not_me')),
  responder_email text,
  responder_can_offer text,
  created_at timestamptz not null default now()
);
create index if not exists idx_requests_token on requests(token);

-- ============ ANALYTICS EVENTS ============
create table if not exists analytics_events (
  id uuid primary key default uuid_generate_v4(),
  event_name text not null,
  user_id uuid references users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_analytics_event_name on analytics_events(event_name);
create index if not exists idx_analytics_created_at on analytics_events(created_at);

-- ============ CONFIG (admin-configurable thresholds) ============
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_config (key, value) values
  ('match_thresholds', '{"strong": 85, "good": 70, "potential": 55}'::jsonb)
on conflict (key) do nothing;

-- ============ pgvector index (create once dataset is non-trivial) ============
-- create index on signals using ivfflat (looking_embedding vector_cosine_ops) with (lists = 100);
-- create index on signals using ivfflat (offer_embedding vector_cosine_ops) with (lists = 100);

-- ============ updated_at triggers ============
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute procedure set_updated_at();

drop trigger if exists trg_signals_updated_at on signals;
create trigger trg_signals_updated_at before update on signals
  for each row execute procedure set_updated_at();

drop trigger if exists trg_matches_updated_at on matches;
create trigger trg_matches_updated_at before update on matches
  for each row execute procedure set_updated_at();

-- ============ Row Level Security ============
alter table users enable row level security;
alter table signals enable row level security;
alter table matches enable row level security;
alter table interests enable row level security;

-- The backend uses the Supabase service role key (bypasses RLS) for all writes.
-- RLS below is a defense-in-depth backstop in case the anon key is ever used directly.
create policy "service role full access users" on users
  for all using (auth.role() = 'service_role');
create policy "service role full access signals" on signals
  for all using (auth.role() = 'service_role');
create policy "service role full access matches" on matches
  for all using (auth.role() = 'service_role');
create policy "service role full access interests" on interests
  for all using (auth.role() = 'service_role');
