import { useStore } from "../store.jsx";
import { Avatar, Empty, FlagList, Kpi, PageHead, Pill, RoleChip, TagLive } from "../components/ui.jsx";

/* The AI assessment exists on every nomination, but buried a click deep in a
   detail pane it may as well not be there. This is the AI as a first-class
   view: what it scored, why, what it flagged, and which it could not judge. */
export default function AiSummary() {
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
