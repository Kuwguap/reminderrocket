# 🚀 Reminder Rocket

**Reminder Rocket** is your all-in-one task completion tool designed to ensure you (or your loved ones) never miss a beat. By leveraging SMS and Email, it blasts reminders straight to your devices until the mission is accomplished.

---

## 🔗 Live

https://reminderrocket.vercel.app

## ✨ Features

* **Dual-Channel Alerts:** Integration with **Vonage** (SMS) and **Resend** (Email).
* **Flexible Recipients:** Send reminders to yourself or "Someone Special."
* **Smart Stop Conditions:** End reminders at a specific time or require **Picture Proof** to stop the notifications.
* **Custom Frequency:** Set your own orbit—remind every hour, day, or custom interval.
* **Clean Aesthetic:** White-first interface with orange accents.

## 🛠 Tech Stack

* **Frontend:** Next.js / React
* **Database & Auth:** [Supabase](https://supabase.com/)
* **Email Service:** [Resend](https://resend.com/)
* **SMS Service:** [Vonage](https://www.vonage.com/communications-apis/)
* **Styling:** Tailwind CSS

## ⚙️ Environment Variables

Copy `.env.example` to `.env`, then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=Reminder Rocket <noreply@reminderrocket.com>
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
VONAGE_SMS_FROM=12025550123
APP_BASE_URL=http://localhost:3000
```

`VONAGE_SMS_FROM` can be your Vonage virtual number (digits, optional `+`) or an approved alphanumeric sender (where supported). You can also use `VONAGE_FROM_NUMBER` or `NEXMO_*` key names as documented in `lib/vonageSms.js`.

## 🚀 Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in values.
3. Run the Supabase SQL in `supabase/schema.sql`.
4. Deploy the Edge Function in `supabase/functions/send-reminders` (set the same Vonage secrets there if you use Supabase cron).
5. Start the app:
   ```bash
   npm run dev
   ```

## 📲 Vonage SMS Setup

1. Create a [Vonage](https://www.vonage.com/communications-apis/) account and note your **API key** and **API secret** from the dashboard.
2. Rent or attach an SMS-capable **virtual number** (or configure an allowed alphanumeric sender for your use case and region).
3. Set `VONAGE_API_KEY`, `VONAGE_API_SECRET`, and `VONAGE_SMS_FROM` to match that sender.
4. Reminder SMS are sent with the [SMS API](https://developer.vonage.com/en/messaging/sms/overview) (`POST https://rest.nexmo.com/sms/json`) when cron runs.

## 🧩 Supabase Notes

- SQL setup: see `supabase/schema.sql` and `supabase/README.md`.
- Edge Function: see `supabase/functions/send-reminders/README.md`.
