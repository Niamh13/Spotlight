import { useEffect } from "react";
import { useStore } from "../store.jsx";
import { ACTION } from "../constants.js";
import { fmtDate } from "../format.js";
import { Empty, Kpi, PageHead, RoleChip, TagLive } from "../components/ui.jsx";
import { EmailBlock } from "../components/DetailPane.jsx";

/* Every recorded action, newest first. The per-nomination history answers "what
   happened to this one"; this answers "what has the team been doing". */
export default function ActivityLog() {
  const { activity, loadActivity } = useStore();
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const withEmail = activity.reduce((a, r) => a + (r.comms || []).length, 0);
  const withNote = activity.filter((r) => r.comment).length;

  return (
    <>
      <PageHead title="ActivityLog Log"
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
