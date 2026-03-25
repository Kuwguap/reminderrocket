"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabaseBrowser";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (err) {
      return null;
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!supabase) {
      setError("Supabase auth is not configured.");
      return;
    }

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.push("/");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data?.session) {
        router.push("/");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setStatus(
          "Account created. Disable email confirmations in Supabase to sign in instantly."
        );
        return;
      }

      router.push("/");
    } catch (err) {
      setError("Unable to authenticate.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
              Reminder Rocket
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "sign-in"
                ? "Access your reminders instantly."
                : "Create an account without email verification."}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-orange-500 transition hover:text-orange-600"
          >
            Home
          </Link>
        </div>

        <div className="mt-4 flex gap-2 rounded-full border border-orange-200 bg-orange-50 p-1">
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "sign-in"
                ? "bg-orange-500 text-white"
                : "text-orange-600 hover:text-orange-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === "sign-up"
                ? "bg-orange-500 text-white"
                : "text-orange-600 hover:text-orange-700"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-orange-200 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="rocket@launch.com"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-orange-200 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="password"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          ) : null}
          {status ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-600">
              {status}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading
              ? "Working..."
              : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          If sign up does not sign you in instantly, disable email confirmations
          in Supabase Auth settings.
        </p>
      </div>
    </main>
  );
}
