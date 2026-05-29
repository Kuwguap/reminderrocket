"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_STORAGE_KEY,
  getTheme,
} from "../lib/themes";

function applyTheme(id) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id && id !== DEFAULT_THEME_ID) {
    root.setAttribute("data-theme", id);
  } else {
    root.removeAttribute("data-theme");
  }
}

export default function ThemePicker() {
  const [activeId, setActiveId] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) setActiveId(stored);
  }, []);

  function selectTheme(id) {
    setActiveId(id);
    try {
      if (id === DEFAULT_THEME_ID) {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, id);
      }
    } catch {
      /* ignore quota / privacy errors */
    }
    applyTheme(id);
  }

  const active = getTheme(activeId);

  return (
    <section className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            Appearance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Pick a theme
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Four looks ready to go. Saved on this device — switch any time.
          </p>
        </div>
        <span className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
          Active: {active.name}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {THEMES.map((theme) => {
          const isActive = theme.id === activeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              aria-pressed={isActive}
              className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 ${
                isActive
                  ? "border-orange-500 shadow-md"
                  : "border-orange-200 hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-md"
              }`}
            >
              <div className={`rr-swatch rr-swatch-${theme.id}`}>
                <span
                  className="absolute bottom-2 right-2 flex h-7 items-center gap-1 rounded-full bg-white/80 px-2 text-[10px] font-semibold text-slate-900 shadow-sm backdrop-blur"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                    style={{ background: theme.primary }}
                    aria-hidden="true"
                  />
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                    style={{ background: theme.secondary }}
                    aria-hidden="true"
                  />
                </span>
              </div>

              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {theme.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {theme.tagline}
                  </p>
                </div>
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[12px] font-bold text-white shadow"
                  >
                    ✓
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-[11px] leading-snug text-slate-600">
                {theme.description}
              </p>

              {theme.isDark ? (
                <span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                  Dark
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-slate-500">
        Tip: themes apply across the whole app. Pick something bold for the
        launch screen, switch to Midnight late at night.
      </p>
    </section>
  );
}
