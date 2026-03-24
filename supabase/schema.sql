create extension if not exists "pgcrypto";

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  recipient_name text,
  phone text,
  email text,
  frequency_type text not null,
  frequency_value integer,
  frequency_unit text,
  start_time timestamptz not null,
  next_run_at timestamptz not null,
  stop_condition text not null,
  stop_at timestamptz,
  proof_url text,
  status text not null default 'active',
  last_sent_at timestamptz,
  completed_at timestamptz
);

create index if not exists reminders_next_run_idx on public.reminders (next_run_at);
create index if not exists reminders_status_idx on public.reminders (status);

create table if not exists public.reminder_attempts (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  channel text not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists reminder_attempts_reminder_id_idx on public.reminder_attempts (reminder_id);

insert into storage.buckets (id, name, public)
values ('reminder-proofs', 'reminder-proofs', false)
on conflict (id) do nothing;
