-- Tiered retention: a "looking for" request stays live for 30 days,
-- a "can offer" listing stays live for 90 days (offers are more evergreen
-- than asks). Either half can independently lapse; the signal is only
-- fully retired once BOTH have lapsed. Updating/renewing via the
-- "My Signal" login flow resets both timers.

alter table signals add column if not exists looking_for_expires_at timestamptz;
alter table signals add column if not exists can_offer_expires_at timestamptz;
alter table signals add column if not exists looking_for_active boolean not null default true;
alter table signals add column if not exists can_offer_active boolean not null default true;

-- Backfill existing rows so the column is never null going forward.
update signals
set
  looking_for_expires_at = coalesce(looking_for_expires_at, created_at + interval '30 days'),
  can_offer_expires_at   = coalesce(can_offer_expires_at, created_at + interval '90 days')
where looking_for_expires_at is null or can_offer_expires_at is null;

create index if not exists idx_signals_looking_expires on signals(looking_for_expires_at) where looking_for_active;
create index if not exists idx_signals_offer_expires on signals(can_offer_expires_at) where can_offer_active;

-- Add "expired" as a valid status (set once both halves have lapsed).
alter table signals drop constraint if exists signals_status_check;
alter table signals add constraint signals_status_check
  check (status in ('pending_moderation','active','paused','flagged','deleted','expired'));
