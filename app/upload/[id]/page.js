"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function UploadProofPage({ params }) {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Please choose a photo to upload.");
      return;
    }

    setStatus("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const url = new URL(
      `/api/reminders/${params.id}/proof`,
      window.location.origin
    );
    if (clientId) {
      url.searchParams.set("client_id", clientId);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let message = "Upload failed. Please try again.";
      try {
        const data = await response.json();
        if (data?.error) {
          message = data.error;
        }
      } catch {
        // ignore parse errors
      }
      setError(message);
      setStatus("error");
      return;
    }

    setStatus("success");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
                Reminder Rocket
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                Upload receipt proof
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Attach a photo to mark this reminder complete.
              </p>
            </div>
            <Link href="/" className="text-sm font-semibold text-orange-500">
              Home
            </Link>
          </div>

          {status === "success" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Proof uploaded successfully. Your reminder is now complete.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Receipt photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={status === "uploading"}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "uploading" ? "Uploading..." : "Upload proof"}
              </button>
            </form>
          )}

          <p className="mt-6 text-xs text-slate-400">
            Need help? Ask the person who set this reminder to confirm the
            correct link.
          </p>
        </div>
      </div>
    </main>
  );
}
