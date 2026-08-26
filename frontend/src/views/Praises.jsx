import { useState } from "react";
import { useStore } from "../store.jsx";
import { VALUES } from "../constants.js";
import { Avatar, PageHead, ShellNotice, TagShell } from "../components/ui.jsx";

/* Everything in this file is screen-only. None of it talks to the backend —
   Praises and Moments that Matter were in the brief as part of the wider
   platform, so the navigation shows them, but only Star Awards is built.
   Each screen says so rather than pretending the buttons work. */

const SAMPLE_PRAISES = [
  { from: "Aisling Kelly", to: "Sarah Murphy", ago: "2h ago", value: "Collaboration",
    msg: "Thanks for your amazing support on the client proposal. You went above and beyond!",
    likes: 24, comments: 6 },
  { from: "Mark Dalton", to: "Ravi Patel", ago: "5h ago", value: "Excellence",
    msg: "Great work on the Azure migration. Your expertise and calm approach made it a success!",
    likes: 18, comments: 3 },
  { from: "Laura Gomez", to: "James Reed", ago: "1d ago", value: "Integrity",
    msg: "Appreciate your support in preparing for the audit. Super thorough and proactive!",
    likes: 15, comments: 2 },
  { from: "Emma Doyle", to: "Niamh O'Connor", ago: "1d ago", value: "Community",
    msg: "Thank you for mentoring me through the project. I learned so much!",
    likes: 21, comments: 4 },
  { from: "Conor Byrne", to: "Data Platform Team", ago: "1d ago", value: "Collaboration",
    msg: "Brilliant teamwork on the data platform rollout. Couldn't have done it without you all!",
    likes: 30, comments: 7 },
  { from: "Sophie Martin", to: "Client Success Team", ago: "2d ago", value: "Customer Success",
    msg: "Huge thank you for the incredible support during the Go-Live. You were amazing!",
    likes: 27, comments: 5 },
];

export function Praises() {
  return (
    <>
      <PageHead title="Praises Wall" sub="See the recognitions shared across the business."
                right={<><TagShell /><a className="btn btn-praise" href="#/praises/new">Give a Praise</a></>} />
      <ShellNotice>Praises, likes and comments aren't built yet.</ShellNotice>

      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="body" style={{ display: "flex", gap: "12px", alignItems: "center",
                                       flexWrap: "wrap" }}>
          <div className="tabs">
            <button className="tab on">All</button>
            <button className="tab">From my team</button>
            <button className="tab">Practice</button>
            <button className="tab">Location</button>
          </div>
          <div className="spacer" />
          <input type="text" placeholder="Search praises…" style={{ maxWidth: "240px" }} disabled />
        </div>
      </div>

      <div className="wall">
        {SAMPLE_PRAISES.map((p, i) => (
          <div className="praise-card" key={i}>
            <div className="top">
              <Avatar name={p.from} sm />
              <div style={{ minWidth: 0 }}>
                <div className="from">{p.from}</div>
                <div className="to">To {p.to}</div>
              </div>
              <div className="spacer" />
              <div className="muted" style={{ fontSize: "12px" }}>{p.ago}</div>
            </div>
            <div className="msg">{p.msg}</div>
            <div><span className="valchip">◎ {p.value}</span></div>
            <div className="foot">
              <span>👍 {p.likes}</span><span>💬 {p.comments}</span>
              <div className="spacer" /><span>🔖</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* The preview is the one thing on this screen that actually does something —
   it mirrors what has been typed so the shape of a praise is visible. */
export function PraiseNew() {
  const { persona } = useStore();
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState([]);

  const toggle = (v) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : p.concat([v])));

  return (
    <>
      <PageHead title="Send a Praise" sub="A simple thank you can make someone's day."
                right={<TagShell />} />
      <ShellNotice>Sending a praise isn't built yet.</ShellNotice>

      <div className="grid-main">
        <div className="card"><div className="body">
          <div className="field">
            <label htmlFor="prTo">To (recipient) <span className="req">*</span></label>
            <input type="text" id="prTo" placeholder="Search employee…"
                   value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="prMsg">What are they being recognised for? <span className="req">*</span></label>
            <textarea id="prMsg" maxLength={500}
                      placeholder="Share what they did and the impact it had."
                      value={msg} onChange={(e) => setMsg(e.target.value)} />
            <div className="counter"><span>{msg.length}</span> / 500</div>
          </div>

          <div className="field">
            <label>Which value(s) did they demonstrate?</label>
            <div className="chips">
              {VALUES.map((v) => (
                <button type="button" key={v} onClick={() => toggle(v)}
                        className={"chip" + (picked.includes(v) ? " on" : "")}>{v}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <label style={{ display: "flex", gap: "9px", alignItems: "flex-start", fontWeight: 400 }}>
              <input type="checkbox" defaultChecked style={{ width: "auto", marginTop: "2px" }} />
              <span><b style={{ fontWeight: 600 }}>Make this praise visible on the Praise Wall</b><br />
                <span className="muted" style={{ fontSize: "12.5px" }}>
                  Colleagues will see this praise.</span></span>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn-praise" disabled>Send Praise</button>
            <button disabled>Save draft</button>
            <span className="muted" style={{ fontSize: "12.5px" }}>Not built yet</span>
          </div>
        </div></div>

        <div className="helper">
          <h4>Preview</h4>
          <div className="praise-card" style={{ boxShadow: "none" }}>
            <div className="top">
              <Avatar name={persona.name} sm />
              <div>
                <div className="from">{persona.name}</div>
                <div className="to">{to ? "To " + to : "To …"}</div>
              </div>
            </div>
            <div className="msg" style={{ minHeight: "40px" }}>
              {msg || "Your message will appear here."}
            </div>
            <div>{picked.map((v) => <span className="valchip" key={v}>◎ {v}</span>)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
