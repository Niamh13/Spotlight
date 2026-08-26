import { useState } from "react";
import { useStore } from "../store.jsx";
import { PageHead, ShellNotice, TagShell } from "../components/ui.jsx";

/* Everything in this file is screen-only. None of it talks to the backend —
   Praises and Moments that Matter were in the brief as part of the wider
   platform, so the navigation shows them, but only Star Awards is built.
   Each screen says so rather than pretending the buttons work. */

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
