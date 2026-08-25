import React from "react";
import { useStore } from "../store.jsx";
import { fmtDate } from "../format.js";
import { Avatar, Pill, CategoryChip, Empty } from "./ui.jsx";

/* Score plus the flag count, because a high score carrying two flags is a
   different thing to a high score with none, and the queue should show that
   without the row being opened. */
function AiCell({ n }) {
  const flags = (n.aiFlags || []).length;
  if (n.aiScore == null) {
    return (
      <>
        <span className="muted" style={{ fontSize: "12px" }}>n/a</span>
        {flags ? <> <span className="valchip flag">▲ {flags}</span></> : null}
      </>
    );
  }
  return (
    <>
      <b style={{ fontVariantNumeric: "tabular-nums" }}>{n.aiScore}</b>
      <span className="muted" style={{ fontSize: "11.5px" }}>/100</span>
      {flags ? <> <span className="valchip flag">▲ {flags}</span></> : null}
    </>
  );
}

export default function NominationTable({
  list, onOpen, selectedId,
  compareIds, onToggleCompare, showCompare = false,
}) {
  const { isCoordinator, loadError } = useStore();

  if (loadError) {
    return <Empty>Couldn't load nominations — is the app still running?</Empty>;
  }
  if (!list.length) return <Empty>Nothing here yet.</Empty>;

  // Review status is a coordinator's working state. Employees are told the
  // outcome by email; showing a live "pending review" here invites people to
  // watch the queue instead.
  const showStatus = isCoordinator;
  const showAi = isCoordinator;

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {showCompare ? <th className="tickcol"><span className="sr-only">Select</span></th> : null}
            <th>Nominee</th><th>Nominated by</th><th>Category</th>
            <th>Practice</th><th>Location</th>
            {showAi ? <th>AI</th> : null}
            {showStatus ? <th>Status</th> : null}
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {list.map((n) => (
            <tr key={n.id}
                className={"clickable" + (selectedId === n.id ? " selected" : "")}
                onClick={() => onOpen(n.id)}>
              {showCompare ? (
                <td className="tickcol" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="rowtick"
                         checked={compareIds.includes(n.id)}
                         onChange={() => onToggleCompare(n.id)}
                         aria-label={"Select " + n.nomineeName + " to compare"} />
                </td>
              ) : null}
              <td className="nowrap">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                  <Avatar name={n.nomineeName} sm /><b>{n.nomineeName}</b>
                </span>
              </td>
              <td>{n.nominatorName}</td>
              <td><CategoryChip nomination={n} /></td>
              <td>{n.practice}</td>
              <td>{n.location}</td>
              {showAi ? <td className="nowrap"><AiCell n={n} /></td> : null}
              {showStatus ? <td><Pill status={n.status} /></td> : null}
              <td className="when">{fmtDate(n.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
