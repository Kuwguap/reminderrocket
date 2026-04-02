# send-reminders Edge Function

## Deploy
```bash
supabase functions deploy send-reminders
```

## Set secrets
```bash
supabase secrets set --env-file .env
```

Required secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_BASE_URL`

For SMS, also set Twilio (same variables as the Next.js app):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` or `TWILIO_PHONE_NUMBER` **or** `TWILIO_MESSAGING_SERVICE_SID`

## Schedule (Cron)
- In the Supabase dashboard, create a scheduled trigger to call:
  `https://<project-ref>.supabase.co/functions/v1/send-reminders`
- Use cron: `*/1 * * * *`
- Add an `Authorization` header with your service role key:
  `Bearer <SUPABASE_SERVICE_ROLE_KEY>`
