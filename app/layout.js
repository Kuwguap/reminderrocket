import "./globals.css";

export const metadata = {
  title: "Reminder Rocket",
  description: "Launch reminders the moment you need them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
