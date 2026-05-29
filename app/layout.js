import "./globals.css";
import { THEME_BOOTSTRAP_SCRIPT } from "../lib/themes";

export const metadata = {
  title: "Reminder Rocket",
  description: "Launch reminders the moment you need them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
