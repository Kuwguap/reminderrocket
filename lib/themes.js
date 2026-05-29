/**
 * Theme catalogue. Each theme drives the `[data-theme="<id>"]` selector
 * defined in app/globals.css. The `aurora` theme is the original look and
 * acts as the default when no override is set.
 *
 * Picking primary vs secondary intentionally avoids same-family colors
 * so the two read as a real pair instead of two shades of the same hue.
 */
export const THEMES = [
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Bright daylight rocket",
    description: "The original light look — warm orange on soft cream.",
    primary: "#f97316",
    secondary: "#0f172a",
    accent: "#fb923c",
    surface: "#ffffff",
    surfaceTint: "#fff7ed",
    isDark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    tagline: "Dark mode, cyan rocket trails",
    description: "Inky slate canvas with electric cyan and amethyst accents.",
    primary: "#38bdf8",
    secondary: "#a78bfa",
    accent: "#0ea5e9",
    surface: "#0f172a",
    surfaceTint: "#020617",
    isDark: true,
  },
  {
    id: "sunset",
    name: "Sunset",
    tagline: "Bold magenta + golden amber",
    description: "Hot magenta primary on warm cream, amber for emphasis.",
    primary: "#ec4899",
    secondary: "#f59e0b",
    accent: "#db2777",
    surface: "#fff8f1",
    surfaceTint: "#ffe4e6",
    isDark: false,
  },
  {
    id: "oceanic",
    name: "Oceanic",
    tagline: "Bold emerald + coral",
    description: "Tropical emerald paired with a warm coral counter-accent.",
    primary: "#10b981",
    secondary: "#fb7185",
    accent: "#059669",
    surface: "#f0fdf4",
    surfaceTint: "#ccfbf1",
    isDark: false,
  },
  {
    id: "arcade",
    name: "Retro Arcade",
    tagline: "8-bit pixels + neon CRT",
    description:
      "Pixel grid wallpaper, scanlines, hot pink primary with electric cyan.",
    primary: "#ff006e",
    secondary: "#00f5ff",
    accent: "#ffd60a",
    surface: "#1a0033",
    surfaceTint: "#0d001a",
    isDark: true,
  },
];

export const DEFAULT_THEME_ID = "aurora";
export const THEME_STORAGE_KEY = "rr:theme";

/**
 * Lookup helper — falls back to the default if id is unknown.
 * @param {string | null | undefined} id
 */
export function getTheme(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/**
 * Inline script body used in app/layout.js to apply the persisted theme
 * synchronously before hydration. Prevents flash of un-themed content.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
