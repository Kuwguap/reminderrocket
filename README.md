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

To run this project, you will need to add the following variables to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
RESEND_API_KEY=your_resend_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number