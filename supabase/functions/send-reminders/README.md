# send-reminders Edge Function

## Deploy
```bash
supabase functions deploy send-reminders
```

## Set secrets
```bash
supabase secrets set --env-file .env
```

## Schedule (Cron)
- In the Supabase dashboard, create a scheduled trigger to call:
  `https://<project-ref>.supabase.co/functions/v1/send-reminders`
- Use cron: `*/1 * * * *`
- Add an `Authorization` header with your service role key:
  `Bearer <SUPABASE_SERVICE_ROLE_KEY>`
