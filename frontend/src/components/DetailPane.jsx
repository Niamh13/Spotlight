import React, { useEffect, useState } from "react";
import { useStore } from "../store.jsx";
import { api } from "../api.js";
import { AI_STATUS, ACTION } from "../constants.js";
import { fmtDate } from "../format.js";
import { Avatar, Pill, FlagList } from "./ui.jsx";

/* The AI assessment. Advisory, coordinator-only, and it handles three cases: a
   real score, no score because the call failed, and no score on an older row
   saved before empty responses were treated as failures. */
function AiPanel({ n }) {
  const flags = <FlagList flags={n.aiFlags} />;

  if (n.aiScore == null) {
    const why = n.aiEvaluationStatus === "COMPLETED"
      ? "The evaluator returned no score for this one — an older record, saved before empty responses were classified as failures."
      : (AI_STATUS[n.aiEvaluationStatus] || "No AI evaluation was recorded.");
    return (
      <div className="ai-panel">
        <div className="ai-panel__head">
          <h4>AI assessment</h4>
          <span className="tag shell"><span className="dot" />unavailable</span>
        </div>
        <p className="ai-rationale" style={{ margin: "0 0 10px" }}>
          {why} Rule-based flags below still apply, and this nomination can be reviewed normally.
        </p>
        {flags}
      </div>
    );
  }

  const score = Number(n.aiScore);
  const color = score >= 70 ? "var(--good)" : score >= 45 ? "var(--warning)" : "var(--critical)";

  return (
    <div className="ai-panel">
      <div className="ai-panel__head">
        <h4>AI assessment</h4>
        {n.aiPromptVersion
          ? <span className="muted" style={{ fontSize: "11.5px" }}>prompt {n.aiPromptVersion}</span>
          : null}
        <div className="spacer" />
        <span className="muted" style={{ fontSize: "11.5px" }}>
          advisory — does not decide anything
        </span>
      </div>
      <div className="ai-score">
        <span className="ai-score__num" style={{ color }}>{score}</span>
        <span className="ai-score__den">/ 100</span>
        <span className="ai-score__bar">
          <span className="ai-score__fill"
                style={{ width: Math.max(0, Math.min(100, score)) + "%", background: color }} />
        </span>
      </div>
      {n.aiRationale ? <p className="ai-rationale" style={{ margin: "0 0 10px" }}>{n.aiRationale}</p> : null}
      {flags}
    </div>
  );
}

/* Every message a decision generated, verbatim. Collapsed by default - a
   coordinator scanning history wants the actions, and only occasionally the
   exact wording. The Outlook button is in the summary so it can be used without
   expanding anything. */
export function EmailBlock({ entry }) {
  const comms = entry.comms || [];
  if (!comms.length) return null;

  const openInOutlook = (c) => {
    const to = encodeURIComponent(c.recipientEmail || "");
    const subject = encodeURIComponent(c.subject || "");
    // Line breaks must be CRLF before encoding: Outlook is inconsistent about
    // honouring a bare %0A but always respects %0D%0A.
    const body = (c.body || "").replace(/\r?\n/g, "\r\n");
    const full = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
    // Windows hands mailto: to the shell, which truncates around 2083 chars.
    if (full.length <= 2000) { window.location.href = full; return; }
    window.location.href = `mailto:${to}?subject=${subject}`;
    if (navigator.clipboard) navigator.clipboard.writeText(c.body || "").catch(() => {});
  };

  return (
    <>
      {comms.map((c, i) => (
        <details className="emaillog" key={i}>
          <summary>
            <span className="emaillog__tag">
              to {c.recipientRole === "NOMINEE" ? "nominee" : "nominator"}
            </span>{" "}
            <span className="emaillog__subj">
              {c.subject} <span className="muted">— {c.recipientEmail || "—"}</span>
            </span>
            <button type="button" className="btn-sm emaillog__send"
                    title="Opens a pre-filled draft in Outlook. Nothing is sent until you send it."
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInOutlook(c); }}>
              ✉ Open in Outlook
            </button>
          </summary>
          <div className="emaillog__meta muted">
            Composed {fmtDate(c.sentAt)} · not sent automatically — use Open in Outlook to send it yourself
          </div>
          <pre className="emaillog__body">{c.body}</pre>
        </details>
      ))}
    </>
  );
}

/* Decision history for one nomination. Coordinator-only: it names who did what. */
function AuditHistory({ id }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    api.auditLog(id)
      .then((e) => { if (live) setEntries(e); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id]);

  if (error) return <p className="muted" style={{ fontSize: "12.5px" }}>Couldn't load history.</p>;
  if (!entries) return <p className="muted" style={{ fontSize: "12.5px" }}>Loading…</p>;
  if (!entries.length) {
    return (
      <p className="muted" style={{ fontSize: "12.5px" }}>
        No decisions recorded yet — this nomination hasn't been reviewed.
      </p>
    );
  }

  return (
    <ul className="timeline">
      {entries.map((e) => {
        const a = ACTION[e.action] || { cls: "", g: "•", label: e.action };
        return (
          <li key={e.id}>
            <span className={"tl-dot " + a.cls}>{a.g}</span>
            <span className="tl-body">
              <span className="tl-what"><b>{a.label}</b> by {e.coordinatorEmail}</span>
              {e.reason ? <span className="tl-why">{e.reason}</span> : null}
              {e.comment ? <span className="tl-note"><b>Note:</b> {e.comment}</span> : null}
              <EmailBlock entry={e} />
            </span>
            <span className="tl-when">{fmtDate(e.occurredAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* The one-click completeness check. Mechanical, so two coordinators looking at
   the same nomination get the same answer - and it produces the text to send
   back, which is the actual value. */
function Completeness({ n, onUseMessage }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!result) {
    return (
      <button type="button" className="btn-sm" disabled={busy}
              onClick={() => {
                setBusy(true);
                api.completeness(n.id)
                  .then(setResult)
                  .catch(() => setResult({ error: true }))
                  .finally(() => setBusy(false));
              }}>
        {busy ? "Checking…" : "☑ Check completeness"}
      </button>
    );
  }

  if (result.error) {
    return <p style={{ color: "var(--critical)", fontSize: "12.5px" }}>Couldn't run the check.</p>;
  }

  return (
    <div className={"completeness " + (result.complete ? "complete" : "incomplete")}>
      <div className="completeness__head">
        <b>
          {result.complete
            ? "Complete — nothing missing"
            : (result.totalCount - result.passedCount) + " of " + result.totalCount + " checks not met"}
        </b>
        <span className="muted">{result.passedCount}/{result.totalCount} passed</span>
        <div className="spacer" />
        <button type="button" className="linkish" onClick={() => setResult(null)}>Hide</button>
      </div>
      <ul className="checklist">
        {result.criteria.map((c) => (
          <li className={"checkitem " + (c.passed ? "pass" : "fail")} key={c.criterion}>
            <span className="checkitem__mark" aria-hidden="true">{c.passed ? "✓" : "✕"}</span>
            <span className="checkitem__body">
              <span className="checkitem__label">{c.label}</span>
              {c.passed ? null : <span className="checkitem__remedy">{c.remedy}</span>}
            </span>
          </li>
        ))}
      </ul>
      {result.complete ? (
        <p className="completeness__note muted">
          This is about reviewability, not merit — it says the nomination can be judged,
          not that it should be approved.
        </p>
      ) : (
        <div className="completeness__action">
          <button type="button" className="btn-sm"
                  onClick={() => onUseMessage(result.suggestedMessage)}>
            Use as send-back message
          </button>
          <span className="muted">Fills the resubmission box with what is missing. You can edit it.</span>
        </div>
      )}
    </div>
  );
}

/* Decision buttons, or an explanation of why there aren't any. Approving needs
   no justification, but a note is often worth having, so the form still opens
   for it - with the reason box hidden. */
function ActionBar({ n, onDecided }) {
  const { persona, toast } = useStore();
  const [pending, setPending] = useState(null);   // "approve" | "reject" | "request-resubmission"
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (n.status !== "PENDING_REVIEW") {
    return (
      <div className="actionbar">
        <span className="actionbar__label">
          This nomination was already decided — {(n.status || "").toLowerCase().replace(/_/g, " ")}
          {n.decisionDate ? " on " + fmtDate(n.decisionDate) : ""}
          {n.coordinatorEmail ? " by " + n.coordinatorEmail : ""}.
          A nomination can only be decided once.
        </span>
      </div>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    if (pending !== "approve" && !reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    const body = { coordinatorEmail: persona.email };
    if (pending !== "approve") body.reason = reason.trim();
    if (comment.trim()) body.comment = comment.trim();

    api.decide(n.id, pending, body)
      .then(() => {
        const labels = {
          "approve": "Approved",
          "reject": "Rejected",
          "request-resubmission": "Sent back for more detail",
        };
        toast({
          kind: "coordinator",
          title: labels[pending] + " — " + n.nomineeName,
          msg: "Recorded against " + persona.email + " in the activity log, and comms were composed.",
        });
        onDecided(n.id);
      })
      .catch((err) => {
        toast({
          kind: "coordinator", sticky: true,
          title: "Decision not recorded",
          msg: err.body?.error || err.body?.reason || "That decision couldn't be saved.",
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <div className="actionbar">
        <span className="actionbar__label">Deciding as <b>{persona.email}</b></span>
        <div className="spacer" />
        <Completeness n={n} onUseMessage={(msg) => {
          setPending("request-resubmission");
          setReason(msg);
          setError("");
        }} />
        <button type="button" className="btn-approve btn-sm"
                onClick={() => { setPending("approve"); setError(""); }}>✓ Approve</button>
        <button type="button" className="btn-reject btn-sm"
                onClick={() => { setPending("reject"); setError(""); }}>✕ Reject</button>
        <button type="button" className="btn-sm"
                onClick={() => { setPending("request-resubmission"); setError(""); }}>
          ↩ Request resubmission
        </button>
      </div>

      {pending ? (
        <form className="reason-form" onSubmit={submit}>
          {pending === "approve" ? null : (
            <div className="field" style={{ marginBottom: "10px" }}>
              <label htmlFor="reasonText">
                {pending === "reject"
                  ? "Why is this being rejected? The nominator will be sent this."
                  : "What does the nominator need to add? Be specific — they'll build on their original wording."}
              </label>
              <textarea id="reasonText" rows="4" value={reason}
                        onChange={(e) => setReason(e.target.value)} />
              {error ? <div className="err" style={{ display: "block" }}>{error}</div> : null}
            </div>
          )}
          <div className="field" style={{ marginBottom: "10px" }}>
            <label htmlFor="commentText">Internal note (optional)</label>
            <textarea id="commentText" rows="2" value={comment}
                      placeholder="Context for whoever reads this record later."
                      onChange={(e) => setComment(e.target.value)} />
            <p className="field__hint">Included in the message to the nominator and kept in the log.</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="submit" className="btn-star btn-sm" disabled={busy}>
              {busy ? "Saving…" :
                pending === "approve" ? "Confirm approval"
                : pending === "reject" ? "Confirm rejection" : "Send back for detail"}
            </button>
            <button type="button" className="btn-sm" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function Meta({ k, v }) {
  return <div><div className="k">{k}</div><div className="v">{v}</div></div>;
}

/* The expanded record under a table row. What a coordinator sees here is quite
   different from what an employee sees - the AI assessment, the decision
   buttons and the history are all coordinator-only. */
export default function DetailPane({ id, onClose, onDecided }) {
  const { isCoordinator } = useStore();
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setN(null); setError(null);
    api.nomination(id)
      .then((data) => { if (live) setN(data); })
      .catch((e) => { if (live) setError(e.body?.error || "Not found"); });
    return () => { live = false; };
  }, [id]);

  if (error) return <div id="detail" className="show"><p style={{ color: "var(--critical)" }}>{error}</p></div>;
  if (!n) return <div id="detail" className="show"><p className="muted">Loading…</p></div>;

  return (
    <div id="detail" className="show">
      <div style={{ display: "flex", alignItems: "center", gap: "11px",
                    marginBottom: "14px", flexWrap: "wrap" }}>
        <Avatar name={n.nomineeName} sm />
        <h3 style={{ fontSize: "15px" }}>{n.nomineeName}</h3>
        {isCoordinator ? <Pill status={n.status} /> : null}
        <div className="spacer" />
        <button className="linkish" onClick={onClose}>Close</button>
      </div>

      {isCoordinator ? <AiPanel n={n} /> : null}
      {isCoordinator ? <ActionBar n={n} onDecided={onDecided} /> : null}

      <div className="prose"><div className="k">What</div><div className="v">{n.whatText}</div></div>
      <div className="prose">
        <div className="k">How{n.coreValueLabel ? " — " + n.coreValueLabel : ""}</div>
        <div className="v">{n.howText}</div>
      </div>

      {n.rejectionReason ? (
        <div className="prose">
          <div className="k">
            {n.status === "NEEDS_RESUBMISSION" ? "What to add before resubmitting" : "Reason given"}
          </div>
          <div className="v">{n.rejectionReason}</div>
        </div>
      ) : null}

      <div className="meta">
        <Meta k="Id" v={n.id} />
        <Meta k="Nominated by" v={n.nominatorName + " · " + (n.nominatorEmail || "—")} />
        <Meta k="Nominee" v={n.nomineeName + " · " + (n.nomineeEmail || "—")} />
        <Meta k="Category" v={n.categoryLabel || "Uncategorised"} />
        <Meta k="Core value" v={n.coreValueLabel || "not identified"} />
        <Meta k="Practice" v={n.practice} />
        <Meta k="Location" v={n.location} />
        <Meta k="Submitted" v={fmtDate(n.submittedAt)} />
        <Meta k="Decision date" v={fmtDate(n.decisionDate)} />
        {/* Who reviewed it is internal - an employee learning which coordinator
            turned their nomination down invites them to go and argue with that
            person, which helps nobody. */}
        {isCoordinator && n.coordinatorEmail ? <Meta k="Decided by" v={n.coordinatorEmail} /> : null}
        <Meta k="Comms sent" v={fmtDate(n.commsSentDate)} />
        <Meta k="Resubmission of" v={n.originalNominationId || "—"} />
      </div>

      {isCoordinator ? (
        <div style={{ marginTop: "16px" }}>
          <div className="k" style={{ marginBottom: "8px" }}>Activity history</div>
          <AuditHistory id={n.id} />
        </div>
      ) : null}
    </div>
  );
}
