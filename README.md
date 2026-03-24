# 🚀 Reminder Rocket

**Reminder Rocket** is your all-in-one task completion tool designed to ensure you (or your loved ones) never miss a beat. By leveraging SMS and Email, it blasts reminders straight to your devices until the mission is accomplished.

---

## 🔗 Live

https://reminderrocket.vercel.app

## ✨ Features

* **Dual-Channel Alerts:** Integration with **Twilio** (SMS) and **Resend** (Email).
* **Flexible Recipients:** Send reminders to yourself or "Someone Special."
* **Smart Stop Conditions:** End reminders at a specific time or require **Picture Proof** to stop the notifications.
* **Custom Frequency:** Set your own orbit—remind every hour, day, or custom interval.
* **Clean Aesthetic:** White-first interface with orange accents.

## 🛠 Tech Stack

* **Frontend:** Next.js / React
* **Database & Auth:** [Supabase](https://supabase.com/)
* **Email Service:** [Resend](https://resend.com/)
* **SMS Service:** [Twilio](https://www.twilio.com/)
* **Styling:** Tailwind CSS

## ⚙️ Environment Variables

Copy `.env.example` to `.env`, then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=noreply@reminderrocket.com
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
APP_BASE_URL=http://localhost:3000
```

## 🚀 Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in values.
3. Run the Supabase SQL in `supabase/schema.sql`.
4. Deploy the Edge Function in `supabase/functions/send-reminders`.
5. Start the app:
   ```bash
   npm run dev
   ```

## 🧩 Supabase Notes

- SQL setup: see `supabase/schema.sql` and `supabase/README.md`.
- Edge Function: see `supabase/functions/send-reminders/README.md`.