"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function UploadProofPage() {
  const routeParams = useParams();
  const reminderId =
    typeof routeParams?.id === "string"
      ? routeParams.id
      : Array.isArray(routeParams?.id)
        ? routeParams.id[0]
        : "";
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

    if (!reminderId) {
      setError("Missing reminder in this link. Open the upload page from your reminder email.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const url = new URL(
      `/api/reminders/${reminderId}/proof`,
      window.location.origin
    );
    if (clientId) {
      url.searchParams.set("client_id", clientId);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      credentials: "include",
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
                <span className="block text-sm font-medium text-slate-700">
                  Receipt photo
                </span>
                <input
                  id="upload-proof-file"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="upload-proof-file"
                  className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-orange-400 bg-gradient-to-b from-orange-50 to-white px-4 py-5 text-center text-sm font-bold text-orange-700 shadow-md transition hover:border-orange-500 hover:from-orange-100 hover:to-orange-50"
                >
                  {file ? file.name : "Choose file — tap to pick a photo"}
                </label>
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
