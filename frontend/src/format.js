/* Display helpers. React escapes text for us, so unlike the previous build
   there is no esc() - anything interpolated into JSX is safe by default. */

import { AV_COLORS } from "./constants.js";

export function initials(name) {
  const p = String(name || "?").trim().split(/\s+/);
  return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function avColor(name) {
  let h = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return (
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

/** Date only, for deadlines - accepts a bare yyyy-mm-dd as well as an instant. */
export function fmtDay(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function ago(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export function flagLabel(f) {
  return f.label || String(f.flag || "").replace(/_/g, " ").toLowerCase();
}
