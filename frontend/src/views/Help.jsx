import { VALUES } from "../constants.js";
import { PageHead } from "../components/ui.jsx";

export default function Help() {
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
