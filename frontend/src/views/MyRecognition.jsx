import { involvesMe } from "../selectors.js";
import { useState } from "react";
import { useStore } from "../store.jsx";
import { Kpi, PageHead, RoleChip, TagLive } from "../components/ui.jsx";
import NominationTable from "../components/NominationTable.jsx";
import DetailPane from "../components/DetailPane.jsx";

export default function MyRecognition() {
  const { persona, nominations } = useStore();
  const [openId, setOpenId] = useState(null);

  const mine = nominations.filter((n) => involvesMe(n, persona.email));
  const submitted = mine.filter(
    (n) => String(n.nominatorEmail || "").toLowerCase() === persona.email.toLowerCase());
  const received = mine.filter(
    (n) => String(n.nomineeEmail || "").toLowerCase() === persona.email.toLowerCase());

  return (
    <>
      <PageHead title="My Recognition"
                sub="Nominations you submitted, and nominations you received."
                right={<><RoleChip role={persona.role} /><TagLive /></>} />

      <div className="notice"><span className="glyph">▲</span><div>
        <b>No sign-in yet.</b> Everyone's nominations are loaded; this page filters
        to <b>{persona.email}</b> in the browser. It is a demonstration of the employee
        view, not access control.
      </div></div>

      <div className="kpis">
        <Kpi cls="k-star" label="Submitted by you" value={submitted.length} />
        <Kpi cls="k-praise" label="Received by you" value={received.length} />
      </div>

      <div className="card" style={{ marginBottom: "18px" }}>
        <header><h2>Submitted by you</h2></header>
        <NominationTable list={submitted} onOpen={setOpenId} selectedId={openId} />
      </div>

      <div className="card">
        <header><h2>Received by you</h2></header>
        <NominationTable list={received} onOpen={setOpenId} selectedId={openId} />
        {openId ? <DetailPane id={openId} onClose={() => setOpenId(null)} onDecided={() => {}} /> : null}
      </div>
    </>
  );
}
