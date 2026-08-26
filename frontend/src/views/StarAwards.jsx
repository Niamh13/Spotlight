import DetailPane from "../components/DetailPane.jsx";
import NominationTable from "../components/NominationTable.jsx";
import { RoleChip, StarLockup, TagLive } from "../components/ui.jsx";
import { useState } from "react";
import { useStore } from "../store.jsx";

/* Star Awards is the same page for everyone: the approved awards, as a wall of
   winners. The coordinator's working view - every status, filters, decision
   buttons - lives on the Review Queue, which is where the work happens. */
export default function StarAwards() {
  const { persona, isCoordinator, nominations } = useStore();
  const [openId, setOpenId] = useState(null);
  const approved = nominations.filter((n) => n.status === "APPROVED");

  return (
    <>
      <div className="star-hero">
        <StarLockup subtitle="Spotlight" />
        <h1>Colleagues recognised for going above and beyond</h1>
        <p>The Star Award is for outstanding contribution — not for doing the job well,
          but for the thing nobody expected and everybody felt.</p>
      </div>
      <div className="head-row" style={{ marginBottom: "18px" }}>
        <RoleChip role={persona.role} /><TagLive />
      </div>

      <div className="notice"><span className="glyph">▲</span><div>
        <b>Approved awards only.</b>{" "}
        {isCoordinator
          ? <>Everything still in flight is on the <a href="#/queue">Review Queue</a>.</>
          : "Nominations still under review are visible to recognition coordinators, not to everyone."}
      </div></div>

      <div className="card">
        <header>
          <h2>Approved Star Awards</h2>
          <div className="spacer" />
          <span className="ep">{approved.length} approved</span>
        </header>
        <NominationTable list={approved} onOpen={setOpenId} selectedId={openId} />
        {openId ? <DetailPane id={openId} onClose={() => setOpenId(null)} onDecided={() => {}} /> : null}
      </div>
    </>
  );
}
