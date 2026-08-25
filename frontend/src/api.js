/* Every call the interface makes, in one place.
   Errors carry the parsed body, because the server puts the useful part there -
   the quarter-limit reason, or a map of which fields failed validation. */

const API = "/api/nominations";

async function json(res) {
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const err = new Error("HTTP " + res.status);
    err.status = res.status;
    err.body = body || {};
    throw err;
  }
  return body;
}

export const api = {
  nominations: () => fetch(API).then(json),
  nomination: (id) => fetch(`${API}/${id}`).then(json),
  categories: () => fetch("/api/categories").then(json),
  coreValues: () => fetch("/api/core-values").then(json),
  activity: () => fetch("/api/activity").then(json),
  quarterHistory: () => fetch("/api/quarters").then(json),
  currentQuarter: (email) =>
    fetch(`/api/quarters/current?email=${encodeURIComponent(email)}`).then(json),
  auditLog: (id) => fetch(`${API}/${id}/audit-log`).then(json),
  completeness: (id) => fetch(`${API}/${id}/completeness`).then(json),

  submit: (payload) =>
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(json),

  decide: (id, action, body) =>
    fetch(`${API}/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(json),
};
