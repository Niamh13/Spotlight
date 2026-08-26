import { useEffect } from "react";
import { useStore } from "../store.jsx";
import { fmtDay } from "../format.js";
import { Avatar, Empty, Kpi, PageHead, Pill, QuarterChip, RoleChip } from "../components/ui.jsx";

/* Who has taken part, quarter by quarter. The current quarter is open; older
   ones collapse, because the question about a past quarter is answered by the
   summary line until you specifically want the names. */
export default function Quarters() {
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
