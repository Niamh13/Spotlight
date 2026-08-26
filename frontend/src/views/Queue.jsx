import { useState, useEffect } from "react";
import { useStore } from "../store.jsx";
import { Kpi, PageHead, QuarterChip, RoleChip } from "../components/ui.jsx";
import NominationTable from "../components/NominationTable.jsx";
import DetailPane from "../components/DetailPane.jsx";
import FilterBar, { applyFilters, CompareBox } from "../components/FilterBar.jsx";

const EMPTY_FILTERS = { name: "", category: "", practice: "", location: "" };

export default function Queue() {
  const { persona, nominations, quarter, query, loadNominations, loadActivity,
          loadQuarterHistory } = useStore();

  // The tiles pick a status; "ALL" is the default so everything sits together
  // until a section is chosen. Filters narrow within that, rather than reaching
  // past it back to the whole table.
  const [statusFilter, setStatusFilter] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openId, setOpenId] = useState(query.id || null);
  const [compareIds, setCompareIds] = useState([]);

  // A deep link from AI Summary lands here with ?id=, so open that record.
  useEffect(() => { if (query.id) setOpenId(query.id); }, [query.id]);

  const counts = {
    PENDING_REVIEW: nominations.filter((n) => n.status === "PENDING_REVIEW").length,
    APPROVED: nominations.filter((n) => n.status === "APPROVED").length,
    REJECTED: nominations.filter((n) => n.status === "REJECTED").length,
    NEEDS_RESUBMISSION: nominations.filter((n) => n.status === "NEEDS_RESUBMISSION").length,
  };
  const total = nominations.length;
  const decided = counts.APPROVED + counts.REJECTED + counts.NEEDS_RESUBMISSION;
  const pct = total ? Math.round((decided / total) * 100) : 0;

  const base = statusFilter
    ? nominations.filter((n) => n.status === statusFilter)
    : nominations;
  const list = applyFilters(base, filters);

  const toggleCompare = (id) =>
    setCompareIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : ids.concat([id]));

  const onDecided = (id) => {
    Promise.all([loadNominations(), loadActivity(), loadQuarterHistory()])
      .then(() => setOpenId(id));
  };

  return (
    <>
      <PageHead title="Review Queue"
                sub={"Nominations waiting on a decision from you, " + persona.name + "."}
                right={<><RoleChip role="COORDINATOR" /><QuarterChip quarter={quarter} /></>} />

      {/* Reads off the same counts as the tiles and recomputes on every render,
          so a decision moves the bar immediately. */}
      <div className="progress">
        <div className="progress__head">
          <b>{decided} of {total} reviewed</b>
          <span className="muted">{counts.PENDING_REVIEW} still awaiting a decision</span>
        </div>
        <div className="progress__track"><div className="progress__fill" style={{ width: pct + "%" }} /></div>
        <div className="progress__legend muted">{pct}% complete</div>
      </div>

      <div className="kpis">
        <Kpi cls="k-star" label="Awaiting review" value={counts.PENDING_REVIEW}
             filter="PENDING_REVIEW" active={statusFilter === "PENDING_REVIEW"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-praise" label="Approved" value={counts.APPROVED}
             filter="APPROVED" active={statusFilter === "APPROVED"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-total" label="Rejected" value={counts.REJECTED}
             filter="REJECTED" active={statusFilter === "REJECTED"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
        <Kpi cls="k-mtm" label="Sent back for detail" value={counts.NEEDS_RESUBMISSION}
             filter="NEEDS_RESUBMISSION" active={statusFilter === "NEEDS_RESUBMISSION"}
             onFilter={(f) => setStatusFilter(statusFilter === f ? null : f)} />
      </div>

      <div className="notice"><span className="glyph">▲</span><div>
        <b>The AI score is advisory.</b> It flags language patterns for your attention —
        it never approves or rejects anything. Every decision below is recorded against{" "}
        <b>{persona.email}</b> in the activity log. See all assessments weakest-first
        on <a href="#/ai">AI Summary</a>.
      </div></div>

      <div className="card">
        <header>
          <h2>{statusFilter
            ? (statusFilter === "PENDING_REVIEW" ? "Awaiting review"
               : statusFilter === "APPROVED" ? "Approved"
               : statusFilter === "REJECTED" ? "Rejected" : "Sent back for detail")
            : "All nominations"}</h2>
          <div className="spacer" />
          {/* The comparison panel opens on its own once two rows are ticked,
              so this reports the selection rather than being a button that has
              to be found and pressed. */}
          <span className="ep">
            {compareIds.length
              ? compareIds.length + " selected to compare"
              : "Tick two or more rows to compare"}
          </span>
          <button className="btn-sm" onClick={() => loadNominations()}>Refresh</button>
        </header>

        <FilterBar filters={filters} setFilters={setFilters}
                   shown={list.length} total={base.length} />

        <NominationTable list={list} onOpen={setOpenId} selectedId={openId}
                         compareIds={compareIds} onToggleCompare={toggleCompare} showCompare />

        {compareIds.length >= 2
          ? <CompareBox ids={compareIds} nominations={nominations}
                        onClear={() => setCompareIds([])} />
          : null}

        {openId ? <DetailPane id={openId} onClose={() => setOpenId(null)} onDecided={onDecided} /> : null}
      </div>
    </>
  );
}
