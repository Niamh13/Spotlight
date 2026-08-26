import { involvesMe } from "../selectors.js";
import { useStore } from "../store.jsx";
import { ago } from "../format.js";
import { Empty, Kpi, PageHead, RoleChip, TagLive } from "../components/ui.jsx";

export default function Home() {
  const { persona, isCoordinator, nominations} = useStore();
  const mine = nominations.filter((n) => involvesMe(n, persona.email));
  const recent = (isCoordinator ? nominations : mine).slice(0, 5);

  const counts = {
    PENDING_REVIEW: nominations.filter((n) => n.status === "PENDING_REVIEW").length,
    APPROVED: nominations.filter((n) => n.status === "APPROVED").length,
    NEEDS_RESUBMISSION: nominations.filter((n) => n.status === "NEEDS_RESUBMISSION").length,
  };

  return (
    <>
      <PageHead
        title="What would you like to recognise today?"
        sub="Celebrate the impact and contributions of your colleagues."
        right={<><RoleChip role={persona.role} /><TagLive /></>}
      />

      <div className="chooser">
        <div className="choice star">
          <div className="badge">★</div><h3>Star Award</h3>
          <p>Recognise outstanding contributions that go above and beyond.</p>
          <a className="btn btn-star" href="#/submit">Submit Star Award</a>
        </div>
        <div className="choice praise">
          <div className="badge">♡</div><h3>Praise</h3>
          <p>Send a thank you and recognition for everyday wins and great work.</p>
          <a className="btn btn-praise" href="#/praises/new">Send a Praise</a>
        </div>
        <div className="choice mtm">
          <div className="badge">🎁</div><h3>Moments that Matter</h3>
          <p>Request a gift or support for life events and special moments.</p>
          <a className="btn btn-mtm" href="#/mtm/new">Request MtM</a>
        </div>
      </div>

      {isCoordinator ? (
        <div className="kpis">
          <Kpi cls="k-star" label="Pending review" value={counts.PENDING_REVIEW}
               foot={<a className="linkish" href="#/queue">Review now</a>} />
          <Kpi cls="k-praise" label="Approved" value={counts.APPROVED} />
          <Kpi cls="k-mtm" label="Needs resubmission" value={counts.NEEDS_RESUBMISSION} />
          <Kpi cls="k-total" label="Total nominations" value={nominations.length} />
        </div>
      ) : null}

      <div className="card">
        <header>
          <h2>{isCoordinator ? "Recent Recognition" : "Recognition involving you"}</h2>
          <span className="ep">Star Awards only</span>
          <div className="spacer" />
          {isCoordinator
            ? <a className="linkish" href="#/queue">Open review queue</a>
            : <a className="linkish" href="#/mine">View all</a>}
        </header>
        <div className="body" style={{ paddingTop: "4px", paddingBottom: "4px" }}>
          {recent.length ? recent.map((n) => (
            <div className="feed-item" key={n.id}>
              <div className="ico" style={{ background: "var(--star-soft)", color: "var(--star)" }}>★</div>
              <div className="txt">
                <div className="l1"><b>{n.nomineeName}</b> was nominated for a Star Award by {n.nominatorName}</div>
                <div className="l2">{String(n.whatText || "").slice(0, 150)}
                  {(n.whatText || "").length > 150 ? "…" : ""}</div>
              </div>
              <div className="ago">{ago(n.submittedAt)}</div>
            </div>
          )) : (
            <Empty>{isCoordinator
              ? "No recognition recorded yet."
              : "Nothing involving you yet — submit the first Star Award."}</Empty>
          )}
        </div>
      </div>
    </>
  );
}
