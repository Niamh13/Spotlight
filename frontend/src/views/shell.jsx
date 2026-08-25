import React, { useState } from "react";
import { useStore } from "../store.jsx";
import { VALUES } from "../constants.js";
import { Avatar, TagShell, ShellNotice, PageHead, Empty } from "../components/ui.jsx";

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

const MTM_TYPES = [
  { k: "Baby", ic: "👶" }, { k: "Wedding", ic: "💍" }, { k: "Bereavement", ic: "🕊" },
  { k: "Health", ic: "♥" }, { k: "Other", ic: "…" },
];

const SAMPLE_MTM = [
  { id: "MTM-00124", type: "Baby", who: "Emma Doyle", date: "15 Sep 2026", st: "approved", lab: "Approved" },
  { id: "MTM-00123", type: "Bereavement", who: "John Walsh", date: "10 Sep 2026", st: "progress", lab: "In progress" },
  { id: "MTM-00122", type: "Wedding", who: "Sarah Murphy", date: "5 Sep 2026", st: "delivered", lab: "Delivered" },
  { id: "MTM-00121", type: "Baby", who: "Conor Byrne", date: "28 Aug 2026", st: "pending", lab: "Pending" },
  { id: "MTM-00120", type: "Health", who: "Laura Gomez", date: "20 Aug 2026", st: "declined", lab: "Declined" },
];

export function Mtm() {
  const { isCoordinator } = useStore();

  return (
    <>
      <PageHead title="Moments that Matter"
                sub={isCoordinator
                  ? "Requests from across the business, and where each one has got to."
                  : "Track the status of your requests."}
                right={<><TagShell /><a className="btn btn-mtm" href="#/mtm/new">Request MtM</a></>} />
      <ShellNotice>
        Moments that Matter isn't built yet, so none of these requests are real.
      </ShellNotice>

      <div className="card">
        <header>
          <h2>{isCoordinator ? "Moments that Matter requests" : "My Moments that Matter"}</h2>
          <div className="spacer" />
          {/* Filtering by outcome is a reviewer's job. An employee is looking at
              their own handful of requests and can see the status on each row -
              giving them a queue filter implies there is a queue to work through. */}
          {isCoordinator ? (
            <div className="tabs">
              <button className="tab on">All</button><button className="tab">Pending</button>
              <button className="tab">Approved</button><button className="tab">In progress</button>
              <button className="tab">Delivered</button><button className="tab">Declined</button>
            </div>
          ) : (
            <span className="ep">
              {SAMPLE_MTM.length} request{SAMPLE_MTM.length === 1 ? "" : "s"}
            </span>
          )}
        </header>
        <div className="tablewrap">
          <table>
            <thead><tr>
              <th>Request id</th><th>Type</th><th>Recipient</th><th>Submitted</th>
              {isCoordinator ? <th>Status</th> : null}
            </tr></thead>
            <tbody>
              {SAMPLE_MTM.map((r) => {
                const t = MTM_TYPES.find((x) => x.k === r.type) || { ic: "•" };
                return (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{t.ic} {r.type}</td>
                    <td>{r.who}</td>
                    <td className="when">{r.date}</td>
                    {isCoordinator ? (
                      <td><span className={"pill " + r.st}><span className="g">●</span>{r.lab}</span></td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function MtmNew() {
  const [type, setType] = useState(MTM_TYPES[0].k);

  return (
    <>
      <PageHead title="Request a Moment that Matters"
                sub="We're here for life's special moments." right={<TagShell />} />
      <ShellNotice>Submitting a request isn't built yet.</ShellNotice>

      <div className="grid-main">
        <div className="card"><div className="body">
          <div className="field">
            <label>Select type <span className="req">*</span></label>
            <div className="chips">
              {MTM_TYPES.map((t) => (
                <button type="button" key={t.k} onClick={() => setType(t.k)}
                        className={"chip" + (type === t.k ? " on" : "")}>{t.ic} {t.k}</button>
              ))}
            </div>
          </div>

          <div className="row2">
            <div className="field">
              <label>Recipient <span className="req">*</span></label>
              <input type="text" placeholder="Search employee…" />
            </div>
            <div className="field">
              <label>Relationship</label>
              <select defaultValue="">
                <option value="">Select relationship…</option>
                <option>Colleague</option><option>Team member</option><option>Manager</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Request details <span className="req">*</span></label>
            <textarea maxLength={500} placeholder="Tell us a bit more…" />
            <div className="counter">0 / 500</div>
          </div>

          <div className="field">
            <label>Preferred delivery address <span className="req">*</span></label>
            <textarea placeholder="Enter delivery address…" />
          </div>

          <div className="form-actions">
            <button className="btn-mtm" disabled>Submit request</button>
            <button disabled>Save draft</button>
            <span className="muted" style={{ fontSize: "12.5px" }}>Not built yet</span>
          </div>
        </div></div>

        <div className="helper">
          <h4>What's included — Baby hamper</h4>
          <ul><li>Soft toy</li><li>Baby blanket</li><li>Essentials pack</li><li>Gift card</li></ul>
          <h4>Guidelines</h4>
          <ul><li>Requests are reviewed within 2 business days.</li>
            <li>Delivery within 5–7 business days.</li><li>One request per occasion.</li></ul>
        </div>
      </div>
    </>
  );
}

export function Reports() {
  return (
    <>
      <PageHead title="Reports" sub="Exports and scheduled reporting." right={<TagShell />} />
      <ShellNotice>Reporting isn't built yet.</ShellNotice>
      <div className="card">
        <Empty>Nothing to show — this screen is a placeholder in the navigation only.</Empty>
      </div>
    </>
  );
}

export function Help() {
  return (
    <>
      <PageHead title="Help & Guidelines" sub="How recognition works in Spotlight."
                right={<span className="tag live"><span className="dot" />static content</span>} />

      <div className="grid-main">
        <div className="card"><div className="body">
          <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>Star Award</h3>
          <p className="sub">For outstanding contributions that go above and beyond. Every
            nomination records a WHAT (the contribution) and a HOW (the value it demonstrated),
            and is reviewed by a recognition coordinator before a decision is made.</p>

          <h3 style={{ fontSize: "15px", margin: "18px 0 8px" }}>Praise</h3>
          <p className="sub">Everyday thanks. Lighter weight than a Star Award and optionally
            shared on the Praises Wall.</p>

          <h3 style={{ fontSize: "15px", margin: "18px 0 8px" }}>Moments that Matter</h3>
          <p className="sub">Gifts and support for life events — new babies, weddings,
            bereavement and health.</p>

          <h3 style={{ fontSize: "15px", margin: "18px 0 8px" }}>The six core values</h3>
          <p className="sub">Every Star Award nomination names one of these, and the HOW
            explains how it was shown:</p>
          <ul className="sub" style={{ paddingLeft: "18px", margin: "0 0 4px" }}>
            {VALUES.map((v) => <li key={v}>{v}</li>)}
          </ul>

          <h3 style={{ fontSize: "15px", margin: "18px 0 8px" }}>Profiles and roles</h3>
          <p className="sub">The switcher in the bottom-left corner changes which view you are
            looking at. <b>Employee</b> can submit recognition and track their own.{" "}
            <b>Admin / HR</b> adds the Review Queue, where nominations are approved, rejected
            or sent back for more detail, plus the organisation-wide dashboard. There is no
            sign-in behind this yet — it changes the view, not your access.</p>

          <h3 style={{ fontSize: "15px", margin: "18px 0 8px" }}>Rules enforced today</h3>
          <ul className="sub" style={{ paddingLeft: "18px", margin: 0 }}>
            <li>Every field is required.</li>
            <li>Both email addresses must be valid.</li>
            <li>You can't nominate yourself — checked on the email address, case-insensitively.</li>
            <li>Every nomination names one of the six core values, picked from a list.</li>
            <li>New nominations are always created as PENDING_REVIEW.</li>
            <li>A nomination can only be decided once — approve, reject and resubmission
              requests all require it to still be pending.</li>
            <li>Every decision is written to an audit log with the coordinator's email.</li>
          </ul>
        </div></div>

        <div className="helper">
          <h4>Build status</h4>
          <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "var(--ink-2)" }}>
            Star Awards are implemented end to end, including AI-assisted review and the full
            decision workflow. Praises and Moments that Matter exist as screens only.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            <div><span className="tag live"><span className="dot" />Live</span>{" "}
              <span className="muted" style={{ fontSize: "12px" }}>
                Home, Submit, My Recognition, Star Awards, Review Queue</span></div>
            <div><span className="tag shell"><span className="dot" />UI only</span>{" "}
              <span className="muted" style={{ fontSize: "12px" }}>
                Praises, MtM, Dashboard charts, Reports</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
