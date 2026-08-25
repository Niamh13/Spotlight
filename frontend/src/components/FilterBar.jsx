import React from "react";
import { useStore } from "../store.jsx";
import { Avatar, Pill } from "./ui.jsx";

/* Options come from the data rather than a fixed list, so a practice nobody has
   used yet doesn't appear and a new one shows up without a code change. */
function distinct(nominations, field) {
  const seen = {};
  nominations.forEach((n) => { if (n[field]) seen[n[field]] = true; });
  return Object.keys(seen).sort();
}

/* Category, practice, location and a name search. The name search matches
   either side of a nomination: a coordinator typing a name is usually asking
   what is going on with that person, which covers both what they wrote and what
   was written about them. */
export function applyFilters(list, f) {
  let out = list;
  if (f.category === "__none") out = out.filter((n) => !n.category);
  else if (f.category) out = out.filter((n) => n.category === f.category);
  if (f.practice) out = out.filter((n) => n.practice === f.practice);
  if (f.location) out = out.filter((n) => n.location === f.location);
  if (f.name) {
    const needle = f.name.toLowerCase();
    out = out.filter(
      (n) =>
        String(n.nomineeName || "").toLowerCase().includes(needle) ||
        String(n.nominatorName || "").toLowerCase().includes(needle)
    );
  }
  return out;
}

export default function FilterBar({ filters, setFilters, shown, total }) {
  const { categories, nominations } = useStore();
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <div className="filterbar">
      <label htmlFor="nameSearch">Name</label>
      <input type="text" id="nameSearch" placeholder="Nominee or nominator…"
             autoComplete="off" style={{ maxWidth: "190px" }}
             value={filters.name} onChange={set("name")} />

      <label htmlFor="catFilter">Category</label>
      <select id="catFilter" value={filters.category} onChange={set("category")}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        <option value="__none">Uncategorised</option>
      </select>

      <label htmlFor="practiceFilter">Practice</label>
      <select id="practiceFilter" value={filters.practice} onChange={set("practice")}>
        <option value="">All practices</option>
        {distinct(nominations, "practice").map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      <label htmlFor="locationFilter">Location</label>
      <select id="locationFilter" value={filters.location} onChange={set("location")}>
        <option value="">All locations</option>
        {distinct(nominations, "location").map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      <span className="spacer" />
      <button type="button" className="linkish"
              onClick={() => setFilters({ name: "", category: "", practice: "", location: "" })}>
        Clear
      </button>
      <span className="muted">{shown} of {total} shown</span>
    </div>
  );
}

/* Reading two nominations by opening one, remembering it and opening the other
   is how inconsistent decisions happen. Side by side makes "is this really
   weaker than that?" answerable by looking. Scrolls sideways rather than
   squeezing prose past readability. */
export function CompareBox({ ids, nominations, onClear }) {
  const picked = ids.map((id) => nominations.find((n) => n.id === id)).filter(Boolean);
  if (picked.length < 2) return null;

  const field = (label, value) => (
    <div className="compare__field"><div className="k">{label}</div>
      <div className="compare__val">{value}</div></div>
  );

  return (
    <div className="compare">
      <div className="compare__head">
        <b>Comparing {picked.length} nominations</b>
        <span className="muted">Same fields, side by side.</span>
        <div className="spacer" />
        <button type="button" className="linkish" onClick={onClear}>Clear selection</button>
      </div>
      <div className="compare__grid"
           style={{ gridTemplateColumns: `repeat(${picked.length},minmax(260px,1fr))` }}>
        {picked.map((n) => (
          <div className="compare__col" key={n.id}>
            <div className="compare__who">
              <Avatar name={n.nomineeName} sm />
              <span><b>{n.nomineeName}</b><br />
                <span className="muted" style={{ fontSize: "11.5px" }}>by {n.nominatorName}</span>
              </span>
            </div>
            {field("Status", <Pill status={n.status} />)}
            {field("Score", n.aiScore == null
              ? <span className="muted">not scored</span>
              : <><b>{n.aiScore}</b>/100</>)}
            {field("Category", n.categoryLabel || "—")}
            {field("Core value", n.coreValueLabel || "not identified")}
            {field("Practice", n.practice + " · " + n.location)}
            {field("What", n.whatText)}
            {field("How", n.howText)}
            {field("Flags", (n.aiFlags || []).length
              ? (n.aiFlags || []).map((f, i) =>
                  <span className="valchip flag" key={i}>▲ {f.label || f.flag}</span>)
              : <span className="muted">none</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}
