alter table public.reminders
  add column if not exists image_path text;

alter table public.reminders
  add column if not exists voice_path text;
