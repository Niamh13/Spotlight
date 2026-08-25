import React from "react";
import { STATUS, ROLE_LABEL, CATEGORY_TINT } from "../constants.js";
import { initials, avColor, flagLabel } from "../format.js";

export function Avatar({ name, sm }) {
  return (
    <span className={"av" + (sm ? " sm" : "")} style={{ background: avColor(name) }}>
      {initials(name)}
    </span>
  );
}

/* Status is colour plus a glyph plus a word, never colour alone - which is what
   makes greyscale mode still readable. */
export function Pill({ status }) {
  const s = STATUS[status] || { cls: "pending", g: "○", label: status || "—" };
  return (
    <span className={"pill " + s.cls}>
      <span className="g">{s.g}</span>{s.label}
    </span>
  );
}

export function RoleChip({ role }) {
  const coordinator = role === "COORDINATOR";
  return (
    <span className={"rolechip " + (coordinator ? "coordinator" : "employee")}>
      {coordinator ? "◈" : "◆"} {ROLE_LABEL[role]}
    </span>
  );
}

export const TagLive = () => (
  <span className="tag live"><span className="dot" />Live data</span>
);
export const TagShell = () => (
  <span className="tag shell"><span className="dot" />UI only</span>
);
export const TagSample = () => <span className="tag sample">sample</span>;

export function ShellNotice({ children }) {
  return (
    <div className="notice">
      <span className="glyph">▲</span>
      <div>
        <b>This screen isn't wired up.</b> {children} Everything below is sample
        content for layout review — it is not read from or written to the database.
      </div>
    </div>
  );
}

/* `filter` turns the tile into a button that narrows the list below it. A count
   you can see but not act on makes you go and find the rows yourself, which is
   the job the tile was supposed to save. */
export function Kpi({ cls, label, value, foot, live = true, filter, active, onFilter }) {
  const inner = (
    <>
      <div className="lab">{label}{live ? null : <> <TagSample /></>}</div>
      <div className="val">{value}</div>
      {foot ? <div className="foot sub">{foot}</div> : null}
    </>
  );

  if (!filter) return <div className={"kpi " + cls}>{inner}</div>;

  return (
    <button
      type="button"
      className={"kpi kpi--clickable " + cls + (active ? " on" : "")}
      onClick={() => onFilter(filter)}
    >
      {inner}
      <span className="kpi__cue">{active ? "Showing" : "View →"}</span>
    </button>
  );
}

/* Five categories is past the point where colour alone is readable, so the chip
   always carries its label and the tint is only a secondary cue. */
export function CategoryChip({ nomination }) {
  const label = nomination.categoryLabel;
  if (!label) return <span className="muted" style={{ fontSize: "12px" }}>Uncategorised</span>;
  return (
    <span className="catchip">
      <span className="catchip__dot"
            style={{ background: CATEGORY_TINT[nomination.category] || "var(--muted)" }} />
      {label}
    </span>
  );
}

/* Flags arrive as {flag, label, source, reason}. The reason is the whole value
   of a flag to a reviewer, so it is rendered inline rather than hidden behind a
   tooltip, and the source is shown because "a rule matched this string" and "a
   model thought so" warrant different amounts of trust. */
export function FlagList({ flags }) {
  if (!flags || !flags.length) {
    return <span className="muted" style={{ fontSize: "12.5px" }}>No flags raised.</span>;
  }
  return (
    <ul className="flagdetail">
      {flags.map((f, i) => {
        const isRule = f.source === "RULE";
        return (
          <li className="flagdetail__item" key={i}>
            <div className="flagdetail__head">
              <span className="valchip flag">▲ {flagLabel(f)}</span>
              <span className={"flagdetail__src " + (isRule ? "rule" : "ai")}>
                {isRule ? "rule" : "AI"}
              </span>
            </div>
            {f.reason ? <p className="flagdetail__why">{f.reason}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* Star Award mark. Six points rather than five: five-point stars read as rating
   widgets, and this is an award, not a score out of five. currentColor
   throughout, so one definition serves every size and both themes. */
export function StarLogo({ size = 24 }) {
  return (
    <svg className="starlogo" width={size} height={size} viewBox="0 0 48 48"
         fill="none" aria-hidden="true" focusable="false">
      <path d="M24 2.5l5.9 13.4 14.6 1.4-11 9.8 3.2 14.3L24 34.1 11.3 41.4l3.2-14.3-11-9.8 14.6-1.4z"
            fill="currentColor" />
      <path d="M24 11.8l3.2 7.3 7.9.8-6 5.3 1.8 7.8L24 28.9l-6.9 4.1 1.8-7.8-6-5.3 7.9-.8z"
            fill="#fff" fillOpacity="0.22" />
    </svg>
  );
}

export function StarLockup({ subtitle }) {
  return (
    <div className="star-lockup">
      <span className="star-lockup__mark"><StarLogo size={30} /></span>
      <span className="star-lockup__words">
        <span className="star-lockup__name">Star Award</span>
        {subtitle ? <span className="star-lockup__sub">{subtitle}</span> : null}
      </span>
    </div>
  );
}

/* Countdown chip. Turns urgent inside a fortnight and says so in words as well
   as colour, because the whole point is that it gets noticed. */
export function QuarterChip({ quarter }) {
  if (!quarter) return null;
  const days = quarter.daysUntilDeadline;
  const cls = days < 0 ? "closed" : days <= 14 ? "urgent" : "";
  const text =
    days < 0 ? quarter.label + " deadline passed"
    : days === 0 ? quarter.label + " — closes today"
    : quarter.label + " — " + days + " day" + (days === 1 ? "" : "s") + " left";
  return <span className={"quarterchip " + cls}><span aria-hidden="true">◷</span>{text}</span>;
}

export function PageHead({ title, sub, right }) {
  return (
    <div className="page-head">
      <div className="head-row">
        <div>
          <h1>{title}</h1>
          {sub ? <p>{sub}</p> : null}
        </div>
        <div className="spacer" />
        {right}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
