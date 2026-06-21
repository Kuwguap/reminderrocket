alter table public.reminders
  add column if not exists whatsapp text;

create index if not exists reminders_whatsapp_idx on public.reminders (whatsapp);
