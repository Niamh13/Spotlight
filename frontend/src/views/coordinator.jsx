import React, { useEffect, useState } from "react";
import { useStore } from "../store.jsx";
import { api } from "../api.js";
import { ACTION } from "../constants.js";
import { fmtDate, fmtDay, ago } from "../format.js";
import {
  Avatar, Pill, Kpi, RoleChip, TagLive, TagSample, TagShell, PageHead, Empty,
  QuarterChip, FlagList,
} from "../components/ui.jsx";
import NominationTable from "../components/NominationTable.jsx";
import DetailPane, { EmailBlock } from "../components/DetailPane.jsx";
import FilterBar, { applyFilters, CompareBox } from "../components/FilterBar.jsx";

const EMPTY_FILTERS = { name: "", category: "", practice: "", location: "" };

export function Queue() {
  const { persona, nominations, quarter, query, loadNominations, loadActivity,
          loadQuarterHistory } = useStore();

  // The tiles pick a status; "ALL" is the default so everything sits together
  // until a section is chosen. Filters narrow within that, rather than reaching
  // past it back to the whole table.
  const [statusFilter, setStatusFilter] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openId, setOpenId] = useState(query.id || null);
  const [compareIds, setCompareIds] = useState([]);

  // A deep link from AI Summary lands here with ?id=, so open that record.
  useEffect(() => { if (query.id) setOpenId(query.id); }, [query.id]);

  const counts = {
    PENDING_REVIEW: nominations.filter((n) => n.status === "PENDING_REVIEW").length,
    APPROVED: nominations.filter((n) => n.status === "APPROVED").length,
    REJECTED: nominations.filter((n) => n.status === "REJECTED").length,
    NEEDS_RESUBMISSION: nominations.filter((n) => n.status === "NEEDS_RESUBMISSION").length,
  };
  const total = nominations.length;
  const decided = counts.APPROVED + counts.REJECTED + counts.NEEDS_RESUBMISSION;
  const pct = total ? Math.round((decided / total) * 100) : 0;

  const base = statusFilter
    ? nominations.filter((n) => n.status === statusFilter)
    : nominations;
  const list = applyFilters(base, filters);

  const toggleCompare = (id) =>
    setCompareIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat([id]));

  const onDecided = (id) => {
    Promise.all([loadNominations(), loadActivity(), loadQuarterHistory()])
      .then(() => setOpenId(id));
  };

  return (
    <>
      <PageHead title="Review Queue"
                sub={"Nominations waiting on a decision from you, " + persona.name + "."}
                right={<><RoleChip role="COORDINATOR" /><QuarterChip quarter={quarter} /></>} />

      {/* Reads off the same counts as the tiles and recomputes on every render,
          so a decision moves the bar immediately. */}
      <div className="progress">
        <div className="progress__head">
          <b>{decided} of {total} reviewed</b>
          <span className="muted">{counts.PENDING_REVIEW} still awaiting a decision</span>
        </div>
        <div className="progress__track"><div className="progress__fill" style={{ width: pct + "%" }} /></div>
        <div className="progress__legend muted">{pct}% complete</div>
      </div>

      <div className="kpis">
        <Kpi cls="k-star" label="Awaiting review" value={counts.PENDING_REVIEW}
             filter="PENDING_REVIEW" active={statusFilter === "PENDING_REVIEW"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-praise" label="Approved" value={counts.APPROVED}
             filter="APPROVED" active={statusFilter === "APPROVED"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-total" label="Rejected" value={counts.REJECTED}
             filter="REJECTED" active={statusFilter === "REJECTED"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-mtm" label="Sent back for detail" value={counts.NEEDS_RESUBMISSION}
             filter="NEEDS_RESUBMISSION" active={statusFilter === "NEEDS_RESUBMISSION"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
      </div>

      <div className="notice"><span className="glyph">▲</span><div>
        <b>The AI score is advisory.</b> It flags language patterns for your attention —
        it never approves or rejects anything. Every decision below is recorded against{" "}
        <b>{persona.email}</b> in the activity log. See all assessments weakest-first
        on <a href="#/ai">AI Summary</a>.
      </div></div>

      <div className="card">
        <header>
          <h2>{statusFilter
            ? (statusFilter === "PENDING_REVIEW" ? "Awaiting review"
               : statusFilter === "APPROVED" ? "Approved"
               : statusFilter === "REJECTED" ? "Rejected" : "Sent back for detail")
            : "All nominations"}</h2>
          <div className="spacer" />
          {/* The comparison panel opens on its own once two rows are ticked,
              so this reports the selection rather than being a button that has
              to be found and pressed. */}
          <span className="ep">
            {compareIds.length
              ? compareIds.length + " selected to compare"
              : "Tick two or more rows to compare"}
          </span>
          <button className="btn-sm" onClick={() => loadNominations()}>Refresh</button>
        </header>

        <FilterBar filters={filters} setFilters={setFilters}
                   shown={list.length} total={base.length} />

        <NominationTable list={list} onOpen={setOpenId} selectedId={openId}
                         compareIds={compareIds} onToggleCompare={toggleCompare} showCompare />

        {compareIds.length >= 2
          ? <CompareBox ids={compareIds} nominations={nominations}
                        onClear={() => setCompareIds([])} />
          : null}

        {openId ? <DetailPane id={openId} onClose={() => setOpenId(null)} onDecided={onDecided} /> : null}
      </div>
    </>
  );
}

/* The AI assessment exists on every nomination, but buried a click deep in a
   detail pane it may as well not be there. This is the AI as a first-class
   view: what it scored, why, what it flagged, and which it could not judge. */
export function AiSummary() {
  const { nominations } = useStore();
  const scored = nominations.filter((n) => n.aiScore != null);
  const unavailable = nominations.filter((n) => n.aiScore == null);
  const flagged = nominations.filter((n) => (n.aiFlags || []).length > 0);
  const avg = scored.length
    ? Math.round(scored.reduce((a, n) => a + Number(n.aiScore), 0) / scored.length) : 0;

  const low = scored.filter((n) => n.aiScore < 45);
  const mid = scored.filter((n) => n.aiScore >= 45 && n.aiScore < 70);
  const high = scored.filter((n) => n.aiScore >= 70);
  const byScore = scored.slice().sort((a, b) => a.aiScore - b.aiScore);

  const bands = [
    { label: "Needs attention", sub: "below 45", list: low, color: "var(--critical)" },
    { label: "Worth a closer read", sub: "45 to 69", list: mid, color: "var(--warning)" },
    { label: "Reads as strong", sub: "70 and above", list: high, color: "var(--good)" },
  ];
  const bandTotal = low.length + mid.length + high.length;

  return (
    <>
      <PageHead title="AI Summary"
                sub="Language assessment across every nomination, weakest first."
                right={<><RoleChip role="COORDINATOR" /><TagLive /></>} />

      <div className="notice"><span className="glyph">▲</span><div>
        <b>Advisory only — the AI never decides anything.</b> It reads the WHAT and HOW
        and scores how reviewable the nomination is, so weak submissions surface before
        a human reads all {nominations.length}. Approve, reject and send-back remain
        entirely yours, on the <a href="#/queue">Review Queue</a>.
      </div></div>

      <div className="kpis">
        <Kpi cls="k-star" label="Evaluated" value={scored.length + " of " + nominations.length} />
        <Kpi cls="k-praise" label="Average score" value={avg + " / 100"} />
        <Kpi cls="k-mtm" label="Carrying flags" value={flagged.length} />
        <Kpi cls="k-total" label="Couldn't be scored" value={unavailable.length} />
      </div>

      <div className="card" style={{ marginBottom: "18px" }}>
        <header><h2>Triage</h2><div className="spacer" /><span className="ep">score bands</span></header>
        <div className="body">
          {bandTotal ? (
            <>
              <div style={{ display: "flex", gap: "2px", height: "30px", marginBottom: "16px" }}>
                {bands.filter((b) => b.list.length).map((b, i, arr) => (
                  <div key={b.label} style={{
                    flex: b.list.length, background: b.color,
                    borderRadius: arr.length === 1 ? "6px"
                      : i === 0 ? "6px 0 0 6px" : i === arr.length - 1 ? "0 6px 6px 0" : "0",
                  }} />
                ))}
              </div>
              {/* Count and label on every band - the bar alone would put the
                  whole reading on colour, and these are a severity scale. */}
              {bands.map((b) => (
                <div className="share-row" key={b.label}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px",
                                 background: b.color, display: "inline-block" }} />
                  <span className="nm">{b.label}{" "}
                    <span className="muted" style={{ fontSize: "12px" }}>({b.sub})</span></span>
                  <span className="vl">{b.list.length}</span>
                  <span className="muted" style={{ width: "44px", textAlign: "right" }}>
                    {Math.round((b.list.length / bandTotal) * 100)}%
                  </span>
                </div>
              ))}
            </>
          ) : <p className="muted">Nothing scored yet.</p>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "18px" }}>
        <header>
          <h2>Assessments</h2><div className="spacer" />
          <span className="ep">{byScore.length} scored · weakest first</span>
        </header>
        {byScore.length ? (
          <div className="body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {byScore.map((n) => {
              const score = Number(n.aiScore);
              const color = score >= 70 ? "var(--good)" : score >= 45 ? "var(--warning)" : "var(--critical)";
              return (
                <div key={n.id} style={{ border: "1px solid var(--border)", borderRadius: "11px",
                                         padding: "14px 15px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center",
                                flexWrap: "wrap", marginBottom: "9px" }}>
                    <span className="ai-score__num" style={{ color, fontSize: "22px" }}>{score}</span>
                    <span className="ai-score__den">/100</span>
                    <span className="ai-score__bar" style={{ maxWidth: "120px" }}>
                      <span className="ai-score__fill"
                            style={{ width: Math.max(0, Math.min(100, score)) + "%", background: color }} />
                    </span>
                    <b>{n.nomineeName}</b>
                    <span className="muted" style={{ fontSize: "12.5px" }}>by {n.nominatorName}</span>
                    <div className="spacer" /><Pill status={n.status} />
                  </div>
                  {n.aiRationale
                    ? <p className="ai-rationale" style={{ margin: "0 0 9px" }}>{n.aiRationale}</p>
                    : <p className="muted" style={{ fontSize: "12.5px", margin: "0 0 9px" }}>
                        No rationale returned.</p>}
                  {(n.aiFlags || []).length ? <FlagList flags={n.aiFlags} /> : null}
                  {/* Opens that specific nomination rather than the queue in general. */}
                  <div style={{ marginTop: "10px" }}>
                    <a className="linkish" href={"#/queue?id=" + n.id}>Open in review queue →</a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty>Nothing has been scored yet.</Empty>}
      </div>

      <div className="card">
        <header>
          <h2>Not scored</h2><div className="spacer" />
          <span className="ep">{unavailable.length} nomination{unavailable.length === 1 ? "" : "s"}</span>
        </header>
        {unavailable.length ? (
          <div className="body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {unavailable.map((n) => (
              <div key={n.id} style={{ display: "flex", gap: "11px", alignItems: "flex-start" }}>
                <Avatar name={n.nomineeName} sm />
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: "13.5px" }}>
                    <b>{n.nomineeName}</b> — nominated by {n.nominatorName}
                  </div>
                  <div className="muted" style={{ fontSize: "12.5px", marginTop: "2px" }}>
                    Review this one by hand.
                  </div>
                </div>
                <Pill status={n.status} />
              </div>
            ))}
          </div>
        ) : <Empty>Every nomination has an assessment.</Empty>}
      </div>
    </>
  );
}

/* Who has taken part, quarter by quarter. The current quarter is open; older
   ones collapse, because the question about a past quarter is answered by the
   summary line until you specifically want the names. */
export function Quarters() {
  const { quarterHistory, quarter, loadQuarterHistory } = useStore();
  useEffect(() => { loadQuarterHistory(); }, [loadQuarterHistory]);

  const current = quarterHistory.find((q) => q.isCurrent);

  return (
    <>
      <PageHead title="Quarters"
                sub="Participation by quarter — who has nominated, and what happened to it."
                right={<><RoleChip role="COORDINATOR" /><QuarterChip quarter={quarter} /></>} />

      {current ? (
        <div className="kpis">
          <Kpi cls="k-star" label="Nominated so far" value={current.participants}
               foot={"in " + current.label} />
          <Kpi cls="k-total" label="Nominations" value={current.totalNominations} />
          <Kpi cls="k-mtm" label="Awaiting review" value={current.pending} />
          <Kpi cls="k-praise" label="Approved" value={current.approved} />
        </div>
      ) : null}

      <div className="notice"><span className="glyph">▲</span><div>
        <b>One nomination per person, per quarter.</b> Someone appearing once here has
        used their entry for that quarter; a resubmission is marked as such and doesn't
        count as a second. Quarters are calendar quarters in UTC.
      </div></div>

      {quarterHistory.length ? quarterHistory.map((q) => {
        const people = (q.nominators || []).slice()
          .sort((a, b) => String(a.nominatorName || "").localeCompare(String(b.nominatorName || "")));
        return (
          <details className="quartercard" key={q.code} open={q.isCurrent}>
            <summary>
              <span className="quartercard__label">
                {q.label}
                {q.isCurrent ? <span className="tag live"><span className="dot" />current</span> : null}
              </span>
              <span className="quartercard__stats">
                {q.participants} nominated · {q.totalNominations} nomination
                {q.totalNominations === 1 ? "" : "s"} · {q.approved} approved
              </span>
              <span className="quartercard__deadline muted">deadline {fmtDay(q.deadline)}</span>
            </summary>
            {people.length ? (
              <div className="tablewrap">
                <table>
                  <thead><tr>
                    <th>Nominator</th><th>Nominated</th><th>Category</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {people.map((p) => (p.nominations || []).map((n, i) => (
                      <tr key={n.id}>
                        {i === 0 ? (
                          <td className="nowrap">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                              <Avatar name={p.nominatorName} sm />
                              <span><b>{p.nominatorName}</b><br />
                                <span className="muted" style={{ fontSize: "11.5px" }}>
                                  {p.nominatorEmail}</span></span>
                            </span>
                          </td>
                        ) : <td />}
                        <td>{n.nomineeName}
                          {n.isResubmission ? <span className="valchip">resubmission</span> : null}</td>
                        <td>{n.categoryLabel || <span className="muted" style={{ fontSize: "12px" }}>—</span>}</td>
                        <td><Pill status={n.status} /></td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>Nobody has nominated in {q.label} yet.</Empty>}
          </details>
        );
      }) : <div className="card"><Empty>No nominations on record yet.</Empty></div>}
    </>
  );
}

/* Every recorded action, newest first. The per-nomination history answers "what
   happened to this one"; this answers "what has the team been doing". */
export function Activity() {
  const { activity, loadActivity } = useStore();
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const withEmail = activity.reduce((a, r) => a + (r.comms || []).length, 0);
  const withNote = activity.filter((r) => r.comment).length;

  return (
    <>
      <PageHead title="Activity Log"
                sub="Every decision, note and generated message — newest first."
                right={<><RoleChip role="COORDINATOR" /><TagLive /></>} />

      <div className="kpis">
        <Kpi cls="k-star" label="Recorded actions" value={activity.length} />
        <Kpi cls="k-praise" label="Messages composed" value={withEmail} />
        <Kpi cls="k-mtm" label="With an internal note" value={withNote} />
      </div>

      <div className="notice"><span className="glyph">▲</span><div>
        <b>Messages are generated here, not sent from here.</b> No mail server is
        configured — <b>Open in Outlook</b> hands you the message as a draft, and you
        send it. Each one is stored as written at the time, so editing a template later
        doesn't rewrite past records.
      </div></div>

      {activity.length ? (
        <div className="card"><div className="body" style={{ paddingTop: "6px" }}>
          <ul className="timeline">
            {activity.map((e) => {
              const a = ACTION[e.action] || { cls: "", g: "•", label: e.action };
              return (
                <li key={e.id}>
                  <span className={"tl-dot " + a.cls}>{a.g}</span>
                  <span className="tl-body">
                    <span className="tl-what">
                      <b>{a.label}</b> — {e.nomineeName}
                      {e.nominatorName
                        ? <span className="muted"> nominated by {e.nominatorName}</span> : null}
                    </span>
                    <span className="tl-why muted">
                      by {e.coordinatorEmail}{e.categoryLabel ? " · " + e.categoryLabel : ""}
                    </span>
                    {e.reason ? <span className="tl-why">{e.reason}</span> : null}
                    {e.comment ? <span className="tl-note"><b>Note:</b> {e.comment}</span> : null}
                    <EmailBlock entry={e} />
                  </span>
                  <span className="tl-when">{fmtDate(e.occurredAt)}</span>
                </li>
              );
            })}
          </ul>
        </div></div>
      ) : <div className="card"><Empty>Nothing recorded yet — no decisions have been made.</Empty></div>}
    </>
  );
}

const TREND = {
  months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  star: [42, 51, 47, 63, 71, 80],
  praise: [180, 240, 265, 310, 420, 524],
  mtm: [8, 11, 9, 14, 18, 22],
};

/* Hand-drawn SVG line chart. Three series, each with its own hue and a label at
   the line end rather than a legend to cross-reference. Sample data - there is
   no praise or MtM backend to chart. */
function TrendChart() {
  const W = 560, H = 220, PL = 38, PR = 96, PT = 14, PB = 30, max = 560;
  const xs = TREND.months.map((_, i) => PL + (i * (W - PL - PR)) / (TREND.months.length - 1));
  const y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const ticks = [0, 140, 280, 420, 560];

  const series = (vals, color, label) => {
    const d = vals.map((v, i) => (i ? "L" : "M") + xs[i] + " " + y(v)).join(" ");
    const last = vals[vals.length - 1];
    return (
      <g key={label}>
        <path d={d} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) => (
          <circle key={i} cx={xs[i]} cy={y(v)} r="3.2" fill={color}
                  stroke="var(--surface)" strokeWidth="2">
            <title>{label} · {TREND.months[i]}: {v}</title>
          </circle>
        ))}
        <text x={xs[xs.length - 1] + 10} y={y(last) + 4} fontSize="11" fill="var(--ink-2)">
          {label} {last}
        </text>
      </g>
    );
  };

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label="Recognition volume by type over six months (sample data)">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
          <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--muted)"
                style={{ fontVariantNumeric: "tabular-nums" }}>{t}</text>
        </g>
      ))}
      {TREND.months.map((m, i) => (
        <text key={m} x={xs[i]} y={H - PB + 18} textAnchor="middle" fontSize="10.5"
              fill="var(--muted)">{m}</text>
      ))}
      <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="var(--border)" strokeWidth="1" />
      {series(TREND.praise, "var(--praise)", "Praises")}
      {series(TREND.star, "var(--star)", "Star")}
      {series(TREND.mtm, "var(--mtm)", "MtM")}
    </svg>
  );
}

export function Dashboard() {
  const { nominations } = useStore();
  const pending = nominations.filter((n) => n.status === "PENDING_REVIEW").length;
  const flagged = nominations.filter((n) => (n.aiFlags || []).length > 0).length;

  /* Part-to-whole. The mockup used a donut, but its two largest slices are 45%
     and 40% - close values a ring makes you squint at. A stacked bar with the
     numbers written out reads at a glance. */
  const parts = [
    { label: "Praises", value: 250, pct: 40, color: "var(--praise)" },
    { label: "Star Awards", value: 282, pct: 45, color: "var(--star)" },
    { label: "Moments that Matter", value: 94, pct: 15, color: "var(--mtm)" },
  ];

  return (
    <>
      <PageHead title="Recognition Overview"
                sub="Monitor all types of recognition across the organisation."
                right={<><RoleChip role="COORDINATOR" /><TagShell /></>} />

      <div className="notice"><span className="glyph">▲</span><div>
        <b>Only the Star Award tiles below are real</b> — they count rows in the database.
        Praises, MtM and both charts have no backing data.
      </div></div>

      <div className="kpis">
        <Kpi cls="k-star" label="Star Awards pending review" value={pending}
             foot={<a className="linkish" href="#/queue">View queue</a>} />
        <Kpi cls="k-total" label="Flagged by AI" value={flagged}
             foot={<a className="linkish" href="#/ai">AI Summary</a>} />
        <Kpi cls="k-praise" label="Praises this month" value={524} live={false} />
        <Kpi cls="k-mtm" label="MtM pending requests" value={22} live={false} />
      </div>

      <div className="charts">
        <div className="card">
          <header><h2>Recognition trends</h2><div className="spacer" /><TagSample /></header>
          <div className="body">
            <TrendChart />
            <div className="legend" style={{ marginTop: "12px" }}>
              {[["var(--star)", "Star Awards"], ["var(--praise)", "Praises"],
                ["var(--mtm)", "Moments that Matter"]].map(([c, l]) => (
                <span className="key" key={l}>
                  <span className="line" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
            <details style={{ marginTop: "12px" }}>
              <summary className="muted" style={{ cursor: "pointer", fontSize: "12.5px" }}>
                Table view
              </summary>
              <div className="tablewrap">
                <table className="tablemini" style={{ minWidth: 0 }}>
                  <thead><tr><th>Month</th><th>Star Awards</th><th>Praises</th><th>MtM</th></tr></thead>
                  <tbody>
                    {TREND.months.map((m, i) => (
                      <tr key={m}><td>{m}</td><td>{TREND.star[i]}</td>
                        <td>{TREND.praise[i]}</td><td>{TREND.mtm[i]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>

        <div className="card">
          <header><h2>Recognition by type</h2><div className="spacer" /><TagSample /></header>
          <div className="body">
            <div style={{ fontSize: "38px", fontWeight: 600, letterSpacing: "-0.025em" }}>626</div>
            <div className="muted" style={{ marginBottom: "16px" }}>recognitions this quarter</div>
            <div style={{ display: "flex", gap: "2px", height: "34px", marginBottom: "16px" }}>
              {parts.map((p, i) => (
                <div key={p.label} style={{
                  flex: p.pct, background: p.color,
                  borderRadius: i === 0 ? "6px 0 0 6px"
                    : i === parts.length - 1 ? "0 6px 6px 0" : "0",
                }} />
              ))}
            </div>
            {parts.map((p) => (
              <div className="share-row" key={p.label}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px",
                               background: p.color, display: "inline-block" }} />
                <span className="nm">{p.label}</span>
                <span className="vl">{p.value}</span>
                <span className="muted" style={{ width: "38px", textAlign: "right" }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <header><h2>Recent activity</h2><div className="spacer" /><TagLive /></header>
          <div className="body" style={{ paddingTop: "4px", paddingBottom: "4px" }}>
            {nominations.length ? nominations.slice(0, 4).map((n) => (
              <div className="feed-item" key={n.id}>
                <div className="ico" style={{ background: "var(--star-soft)", color: "var(--star)" }}>★</div>
                <div className="txt"><div className="l1">
                  Star Award nomination from <b>{n.nominatorName}</b> for <b>{n.nomineeName}</b>
                </div></div>
                <div className="ago">{ago(n.submittedAt)}</div>
              </div>
            )) : <Empty>No nominations yet.</Empty>}
          </div>
        </div>
        <div className="card">
          <header><h2>Quick actions</h2></header>
          <div className="body">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a className="btn" href="#/queue">Review Star Awards</a>
              <a className="btn" href="#/ai">Open AI Summary</a>
              <a className="btn" href="#/praises">View Praises Wall</a>
              <a className="btn" href="#/mtm">Review MtM requests</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
