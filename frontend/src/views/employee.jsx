import React, { useState } from "react";
import { useStore } from "../store.jsx";
import { api } from "../api.js";
import { fmtDate, fmtDay, ago } from "../format.js";
import {
  Avatar, Kpi, RoleChip, TagLive, PageHead, Empty, StarLockup, QuarterChip,
} from "../components/ui.jsx";
import NominationTable from "../components/NominationTable.jsx";
import DetailPane from "../components/DetailPane.jsx";

/** Every nomination where the current profile is on either side. */
function involvesMe(n, email) {
  const me = email.toLowerCase();
  return String(n.nominatorEmail || "").toLowerCase() === me ||
         String(n.nomineeEmail || "").toLowerCase() === me;
}

export function Home() {
  const { persona, isCoordinator, nominations, quarter } = useStore();
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

/* Nominator identity is rendered as fixed facts rather than inputs. It removes
   the "nominate under a colleague's name for a second entry" route, and stops
   typos putting a nomination under an address that never receives the outcome.
   Not access control: there is no auth, so the API still trusts what it is
   sent - but the quarter limit is re-checked server-side against whatever email
   arrives, so the block holds for the identity actually submitted. */
function LockedNominator({ persona }) {
  return (
    <div className="lockedfields">
      <div className="lockedfields__head">
        <span className="lockedfields__icon" aria-hidden="true">🔒</span>
        <span>Submitting as — taken from your signed-in profile</span>
      </div>
      <div className="row2">
        <div className="lockedfield">
          <span className="lockedfield__label">Your name</span>
          <span className="lockedfield__value">{persona.name}</span>
        </div>
        <div className="lockedfield">
          <span className="lockedfield__label">Your email</span>
          <span className="lockedfield__value">{persona.email}</span>
        </div>
      </div>
      <p className="lockedfields__note">
        You can't nominate on someone else's behalf. To submit as a different person,
        switch profile in the bottom-left corner.
      </p>
    </div>
  );
}

export function Submit() {
  const { persona, quarter, categories, coreValues, toast,
          loadNominations, loadQuarter, loadQuarterHistory } = useStore();

  const [form, setForm] = useState({
    nomineeName: "", nomineeEmail: "", practice: "", location: "",
    category: "", whatText: "", howText: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  // A nomination that was rejected or sent back is not finished business: the
  // nominator must be able to try again, and the server exempts a revision from
  // the quarter limit. Blocking the form here would make that impossible.
  const openForRevision = quarter && quarter.hasSubmitted && quarter.submission &&
    (quarter.submission.status === "REJECTED" || quarter.submission.status === "NEEDS_RESUBMISSION");

  if (quarter && quarter.hasSubmitted && !openForRevision) {
    const sub = quarter.submission || {};
    return (
      <>
        <PageHead title="Submit a Star Award" sub="One nomination per person, per quarter."
                  right={<QuarterChip quarter={quarter} />} />
        <div className="card">
          <header><h2>You've nominated for {quarter.label}</h2></header>
          <div className="body">
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <Avatar name={sub.nomineeName} />
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ fontSize: "16px", fontWeight: 600 }}>{sub.nomineeName || "—"}</div>
                <div className="muted" style={{ fontSize: "12.5px", marginTop: "2px" }}>
                  {sub.categoryLabel ? sub.categoryLabel + " · " : ""}
                  submitted {fmtDate(sub.submittedAt)}
                </div>
              </div>
            </div>
            <p className="sub" style={{ margin: "16px 0 0" }}>
              Your next nomination opens in <b>{quarter.nextQuarterLabel}</b>.
            </p>
            <div style={{ marginTop: "16px" }}>
              <a className="btn" href="#/mine">Track this nomination</a>
            </div>
          </div>
        </div>
        <div className="helper" style={{ marginTop: "18px" }}>
          <h4>Why only one?</h4>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink-2)" }}>
            The Star Award is a vote: everyone gets one nomination each quarter, so no single
            person can weight the outcome by submitting several.
          </p>
        </div>
      </>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const fillSample = () => {
    setForm({
      nomineeName: "Alex Rivera", nomineeEmail: "alex.rivera@version1.com",
      practice: "Cloud Engineering", location: "Dublin", category: "CUSTOMER_IMPACT",
      whatText: "Led the release rollout over a tight weekend window and saved the client two full days of downtime, coordinating four teams across two time zones.",
      howText: "No Ego — rather than working the weekend alone, Alex built a rota so nobody did more than one night shift, ran the bridge call himself, and gave the credit to the team in the debrief.",
    });
    setFieldErrors({}); setBanner(null);
  };

  const fillSelf = () => {
    setForm({
      nomineeName: persona.name, nomineeEmail: persona.email,
      practice: "Cloud Engineering", location: "Dublin",
      category: "PERFORMANCE_AND_EFFICIENCY",
      whatText: "Kept the release on track.", howText: "Showed ownership throughout.",
    });
    setFieldErrors({}); setBanner(null);
  };

  const submit = (e) => {
    e.preventDefault();
    setBusy(true); setFieldErrors({}); setBanner(null);

    const payload = {
      nominatorName: persona.name,
      nominatorEmail: persona.email,
      ...form,
    };
    if (openForRevision) payload.originalNominationId = quarter.submission.id;

    api.submit(payload)
      .then((created) => {
        toast({
          kind: "employee",
          title: "Nomination submitted",
          msg: created.nomineeName + " is now in the coordinator's review queue.",
        });
        // Re-render into the "you've nominated" panel. Leaving the form up
        // invites a second attempt the server will only reject.
        return Promise.all([loadNominations(), loadQuarter(persona.email), loadQuarterHistory()]);
      })
      .catch((err) => {
        const body = err.body || {};
        if (body.reason === "QUARTER_LIMIT") {
          setBanner(body.error);
          loadQuarter(persona.email);
          return;
        }
        if (body.error) { setBanner(body.error); return; }
        const keys = Object.keys(body);
        if (keys.length) {
          setFieldErrors(body);
          setBanner(keys.length + (keys.length === 1 ? " field needs" : " fields need") +
                    " fixing before this can be submitted.");
          return;
        }
        setBanner("That didn't go through. Please try again.");
      })
      .finally(() => setBusy(false));
  };

  const field = (id, label, type = "text", list) => (
    <div className={"field" + (fieldErrors[id] ? " invalid" : "")}>
      <label htmlFor={id}>{label} <span className="req">*</span></label>
      <input type={type} id={id} list={list} value={form[id]} onChange={set(id)} />
      <div className="err">{fieldErrors[id]}</div>
    </div>
  );

  return (
    <>
      <PageHead title="Submit a Star Award"
                sub="Recognise outstanding contributions that go above and beyond."
                right={<><QuarterChip quarter={quarter} /><TagLive /></>} />

      {quarter && !openForRevision ? (
        <div className="notice" style={{
          borderStyle: "solid",
          borderColor: "color-mix(in srgb, var(--brand) 30%, var(--border))",
          background: "color-mix(in srgb, var(--brand) 6%, var(--surface))",
        }}>
          <span className="glyph" style={{ color: "var(--brand)" }}>◷</span>
          <div>
            <b>{quarter.label} is open.</b> You have one nomination this quarter, and{" "}
            {quarter.daysUntilDeadline} day{quarter.daysUntilDeadline === 1 ? "" : "s"} until
            the deadline on {fmtDay(quarter.deadline)}.
          </div>
        </div>
      ) : null}

      {openForRevision ? (
        <div className="notice" style={{
          borderStyle: "solid",
          borderColor: "color-mix(in srgb, var(--info) 35%, var(--border))",
          background: "color-mix(in srgb, var(--info) 7%, var(--surface))",
        }}>
          <span className="glyph" style={{ color: "var(--info)" }}>↩</span>
          <div>
            <b>Revising your {quarter.label} nomination.</b> A coordinator has asked for more
            detail on your entry for {quarter.submission.nomineeName}. This replaces it and
            doesn't use another nomination.
          </div>
        </div>
      ) : null}

      <div className="grid-main">
        <div className="card"><div className="body">
          {banner ? (
            <div className="banner bad show"><span className="glyph">●</span><span>{banner}</span></div>
          ) : null}

          <form onSubmit={submit} noValidate autoComplete="off">
            <LockedNominator persona={persona} />

            <div className="row2">
              {field("nomineeName", "Nominee name")}
              {field("nomineeEmail", "Nominee email", "email")}
            </div>
            <div className="row2">
              {field("practice", "Practice", "text", "practices")}
              {field("location", "Location", "text", "locations")}
            </div>
            <datalist id="practices">
              {["Cloud Engineering", "Data & AI", "Digital", "ERP", "Managed Services", "Consulting"]
                .map((v) => <option key={v} value={v} />)}
            </datalist>
            <datalist id="locations">
              {["Dublin", "Belfast", "Cork", "London", "Birmingham", "Bengaluru", "Pune"]
                .map((v) => <option key={v} value={v} />)}
            </datalist>

            <div className={"field" + (fieldErrors.category ? " invalid" : "")}>
              <label htmlFor="category">Business category <span className="req">*</span></label>
              <select id="category" value={form.category} onChange={set("category")}>
                <option value="">Select a category…</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p className="field__hint">
                {categories.find((c) => c.value === form.category)?.examples ||
                 "Pick the kind of impact this nomination evidences — the examples will show what that category expects."}
              </p>
              <div className="err">{fieldErrors.category}</div>
            </div>

            <div className={"field" + (fieldErrors.whatText ? " invalid" : "")}>
              <label htmlFor="whatText">WHAT — the achievement, contribution or action <span className="req">*</span></label>
              <textarea id="whatText" value={form.whatText} onChange={set("whatText")} />
              <div className="err">{fieldErrors.whatText}</div>
            </div>

            <div className={"field" + (fieldErrors.howText ? " invalid" : "")}>
              <label htmlFor="howText">HOW — which core value they showed, and how <span className="req">*</span></label>
              <textarea id="howText" value={form.howText} onChange={set("howText")} />
              <div className="err">{fieldErrors.howText}</div>
            </div>

            {/* The six values, listed for reference rather than offered as a
                dropdown. A picker asks people to categorise before they have
                written anything, which tends to produce a selection the HOW then
                never argues for. The value is still recorded — the server reads
                it back out of the text. */}
            <div className="valueguide">
              <div className="valueguide__head">
                Name one of these in your HOW, and say how they showed it
              </div>
              <ul className="valueguide__list">
                {coreValues.map((v) => (
                  <li className="valueguide__item" key={v.value}>
                    <b>{v.label}</b><span className="valueguide__hint">{v.prompt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-star" disabled={busy}>
                {busy ? "Submitting…" : openForRevision ? "Resubmit Star Award" : "Submit Star Award"}
              </button>
              <button type="button" className="linkish" onClick={fillSample}>Fill sample</button>
              <button type="button" className="linkish" onClick={fillSelf}>Try self-nomination</button>
              <button type="button" className="linkish"
                      onClick={() => { setForm({ nomineeName: "", nomineeEmail: "", practice: "",
                                                 location: "", category: "", whatText: "", howText: "" });
                                       setFieldErrors({}); setBanner(null); }}>Clear</button>
            </div>
          </form>
        </div></div>

        <div className="helper">
          <h4>What makes a strong nomination</h4>
          <ul>
            <li>Name the specific contribution, not a general quality.</li>
            <li>Say what the impact was — who benefited and how.</li>
            <li>Name a core value in the HOW and give an example of it.</li>
            <li>You can't nominate yourself.</li>
          </ul>
          <h4 style={{ marginTop: "14px" }}>Validation</h4>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink-2)" }}>
            Every field is required, both email addresses must be valid, and you can't
            nominate yourself. Anything missed is flagged against the field when you submit.
          </p>
          <h4 style={{ marginTop: "14px" }}>Your details</h4>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink-2)" }}>
            Taken from the profile you're viewing as ({persona.name}). Change the profile
            in the bottom-left corner to submit as someone else.
          </p>
        </div>
      </div>
    </>
  );
}

export function Mine() {
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

/* Star Awards is the same page for everyone: the approved awards, as a wall of
   winners. The coordinator's working view - every status, filters, decision
   buttons - lives on the Review Queue, which is where the work happens. */
export function Stars() {
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
