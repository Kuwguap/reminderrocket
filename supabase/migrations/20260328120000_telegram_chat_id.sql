alter table public.reminders
  add column if not exists telegram_chat_id bigint;

create index if not exists reminders_telegram_chat_id_idx on public.reminders (telegram_chat_id);
