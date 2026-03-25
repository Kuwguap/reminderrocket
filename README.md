# 🚀 Reminder Rocket

**Reminder Rocket** is your all-in-one task completion tool designed to ensure you (or your loved ones) never miss a beat. By leveraging SMS and Email, it blasts reminders straight to your devices until the mission is accomplished.

---

## 🔗 Live

https://reminderrocket.vercel.app

## ✨ Features

* **Dual-Channel Alerts:** Integration with **Klaviyo** (SMS) and **Resend** (Email).
* **Flexible Recipients:** Send reminders to yourself or "Someone Special."
* **Smart Stop Conditions:** End reminders at a specific time or require **Picture Proof** to stop the notifications.
* **Custom Frequency:** Set your own orbit—remind every hour, day, or custom interval.
* **Clean Aesthetic:** White-first interface with orange accents.

## 🛠 Tech Stack

* **Frontend:** Next.js / React
* **Database & Auth:** [Supabase](https://supabase.com/)
* **Email Service:** [Resend](https://resend.com/)
* **SMS Service:** [Klaviyo](https://www.klaviyo.com/)
* **Styling:** Tailwind CSS

## ⚙️ Environment Variables

Copy `.env.example` to `.env`, then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=Reminder Rocket <noreply@reminderrocket.com>
KLAVIYO_API_KEY=your_klaviyo_private_api_key
KLAVIYO_LIST_ID=optional_single_opt_in_list_id
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

## 📲 Klaviyo SMS Setup

Reminder Rocket sends SMS by creating a Klaviyo event named **Reminder Rocket SMS**.
Create a Klaviyo flow that is triggered by this event and send an SMS using the
event property `message` for the body. Klaviyo SMS must be enabled in your account,
and any phone numbers must be consented to receive SMS.

## 🧩 Supabase Notes

- SQL setup: see `supabase/schema.sql` and `supabase/README.md`.
- Edge Function: see `supabase/functions/send-reminders/README.md`.