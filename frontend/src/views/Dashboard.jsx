import { useStore } from "../store.jsx";
import { ago } from "../format.js";
import { Empty, Kpi, PageHead, RoleChip, TagLive, TagSample, TagShell } from "../components/ui.jsx";

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

export default function Dashboard() {
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
