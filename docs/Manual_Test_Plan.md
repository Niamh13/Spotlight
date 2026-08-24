# Spotlight — Manual QA Test Plan

Source: `Manual_Tests.xlsx`, imported for tracking. This is a manual/exploratory checklist
distinct from the automated scenario catalog in `Spotlight_Test_Scenarios.docx` (E2E-\*,
UI-\*, BB-\*, UAT-\* — see Part 4 of that document). IDs here use the `T-XX` prefix and do not
overlap with that catalog.

Fill in **Actual Result** and **Status** (Pass / Fail / Blocked) as each case is run.

## Automated coverage

Cross-referenced against the actual Java/Playwright test code (not just the docx) on 2026-08-24.

**Already covered by the existing suite, no changes needed:** T-02, T-07, T-11, T-14, T-20, T-21,
T-23, T-24, T-28, T-29, T-30, T-31, T-42.

**Newly automated in this pass** (test class/spec → method):
- T-01 → `ReciprocalNominationCheckTest`
- T-03 → `RepeatNominationCheckTest`
- T-05 / T-27 → `NominationServiceTest.EvaluateFallback#multipleFlags_neverChangeStatusFromPendingReview`
- T-06 → `02-e2e-flows.spec.js` E2E-6 (extended to also approve a flagged nomination)
- T-12 → `NominationServiceTest.QuarterLimit#existingNominationFromPreviousQuarter_doesNotBlockNewSubmission`
- T-13 → `NominationApiBlackBoxTest.QuotaScopeAndFieldGaps#sameNomineeThreeDifferentNominators_allSucceed`
- T-15 / T-16 / T-17 → `NominationApiBlackBoxTest.QuotaScopeAndFieldGaps` (blank whatText/howText/nomineeEmail)
- T-18 → `NominationApiBlackBoxTest.QuotaScopeAndFieldGaps#nominatorIdentity_reflectsSubmittedValuesExactly`
- T-19 → `NominationServiceTest.Approve#approve_sendsBothComms_recordsAudit` (extended)
- T-25 → `NominationApiBlackBoxTest.AuditLogImmutability`
- T-26 → `01-ui-gui.spec.js` T-26
- T-33 → `NominationServiceTest.RejectAndResubmission` (both tests, extended)
- T-39 → `NominationApiBlackBoxTest.ConcurrentDecisions`, **BUG pinned as regression** (see below)
- T-41 → `01-ui-gui.spec.js` T-41, **BUG pinned as regression** (see below)
- T-43 → `NominationApiBlackBoxTest.TextContentFidelity` (storage) + `01-ui-gui.spec.js` T-43 (rendering)
- T-44 → `NominationApiBlackBoxTest.TextContentFidelity#emojiAndNonLatinText_roundTripsExactly`
- T-45 → `NominationApiBlackBoxTest.QuotaScopeAndFieldGaps#whitespaceOnlyWhatText_returns400SameAsBlank`

**Known gap, not just a test gap — pinned as a regression test, matching the `UI-1a` convention:**
- T-41: there is no draft-persistence for the submission form (`localStorage` is only used for
  persona/theme/greyscale/quarter-seen) and the app's only "Save draft" buttons are disabled stubs.
  A mid-form reload silently produces a blank form with no warning. `01-ui-gui.spec.js` pins this
  current behavior so a real fix shows up as a welcome test failure.

**Not automated — the underlying feature doesn't exist yet, so a test would just assert against a
gap rather than guard a regression. Flagged for the app owner, not silently skipped:**
- T-09 / T-10 (contractor/apprentice blocked at entry): no employment-type gate exists anywhere in
  the codebase — `EmployeeStatusCheck` is an explicit no-op placeholder (see UAT-11).
- T-08 (part-time can submit): trivially true today since nothing gates by employment type at all —
  not meaningfully distinct from T-07 until T-09/T-10 exist.
- T-34 (email send failure surfaced): `NotificationService` only composes/logs, there's no real SMTP
  call and therefore no failure path to test.
- T-35 / T-36 / T-37 / T-38 (access control): there is no authentication or authorization anywhere
  in the app — this is a documented, deliberate known gap (see the UAT `known-gaps.feature`,
  scenario UAT-9), not an oversight.
- T-46 (performance under load): needs load-testing tooling outside this suite's scope, and ties to
  the same missing-concurrency-guard gap as T-39.
- T-47 (cross-browser): would need `webkit`/`firefox` added to `playwright.config.js` projects plus
  `npx playwright install` for those engines on every machine that runs the suite — left as a
  deliberate choice for the team rather than silently changing what `npm test` requires to run.

## AI Flagging System

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-01 | Reciprocal pair flagged | Person A nominated Person B, then Person B nominates Person A same/adjacent quarter | Both nominations carry a "possible reciprocal" flag, filtered to possible rejection | | |
| T-02 | Weak/routine language flagged | WHAT text describes routine duties ("did their job as expected") | Nomination carries a "weak language" flag, filtered to possible rejection | | |
| T-03 | Repeat nominee flagged | Nominee was also nominated last quarter | Nomination carries a "repeat nomination" flag, filtered to unclear | | |
| T-04 | Clean nomination, possible approve flag | First-time submission in the quarter, reasoning aligns with core value | Nomination carries a "clear" flag, filtered to possible approve | | |
| T-05 | Flags never change the status | Any nomination that trips one or more flags | Nomination remains pending review, never auto-approves or auto-rejects | | |
| T-06 | Legitimate flagged nomination can still be approved | Coordinator reviews a flagged nomination and approves it | Approval succeeds, the flag doesn't block the action | | |

## Eligibility

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-07 | Eligible employee can submit | Log in as a full-time employee who hasn't nominated this quarter; complete WHAT + HOW; submit | Nomination is accepted and recorded with status "Submitted" | | |
| T-08 | Part-Time employee can submit | Same as T-07, logged in as a part-time employee | Nomination accepted (part-time is explicitly eligible per brief) | | |
| T-09 | Contractor cannot submit | Log in as a contractor; attempt to open/submit the nomination form | Form is blocked or submission is rejected at entry — contractor should not be able to submit at all, not just be flagged afterwards | | |
| T-10 | Apprentice cannot submit | Same as T-09, logged in as an apprentice | Submission blocked at entry | | |
| T-11 | Second nomination in same quarter is blocked | Submit one nomination as an employee this quarter; attempt a second | Second submission is rejected when trying to access submission area or at submission time with a clear "already nominated this quarter" message | | |
| T-12 | New quarter resets the limit | Employee nominated in Q2; quarter rolls to Q3 | Employee can submit again in Q3 | | |
| T-13 | No limit on nominations received | Nominate the same employee from three different nominators in one quarter | All three nominations are accepted for that nominee | | |
| T-14 | Self-nomination is blocked | Submit a nomination for yourself | Nomination is blocked from submission | | |

## Submission

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-15 | Missing WHAT rejected | WHAT field is blank, HOW is completed | Rejected with validation error | | |
| T-16 | Missing HOW rejected | HOW field is blank | Rejected with validation error | | |
| T-17 | Missing Nominee details | Nominee email is blank, WHAT and HOW are completed | Rejected with validation error | | |
| T-18 | Nominator captured automatically | Any valid submission | Nominator ID stored without manual entry | | |

## Admin Review

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-19 | Approve | Coordinator selects Approve on a pending nomination | Status changes to "Approved"; coordinator ID + timestamp recorded | | |
| T-20 | Rejected with reason | Coordinator selects Reject, enters a reason; submits | Status changes to "Rejected"; reason is stored (email populated and sent?) | | |
| T-21 | Rejected without reason | Coordinator selects Reject, leaves reason blank, tries to submit | Submission blocked; status unchanged | | |
| T-22 | Resubmission | Coordinator selects resubmission, details the needed information | Email is sent to the nominator with the instructions and resubmits to nomination | | |
| T-23 | Resubmission doesn't double-count quota | Original + resubmission both in same quarter, same nominator | Counts as one nomination against the quarter limit, not two | | |
| T-24 | Audit log entry on every decision | Approve one nomination, reject another | Two audit entries, each with who/what/when | | |
| T-25 | Audit log immutable | Attempt to edit or delete an existing audit entry | Not permitted | | |
| T-26 | Full context visible before deciding | Coordinator opens a pending nomination | Full WHAT/HOW text and all flags visible before Approve/Reject become actionable | | |
| T-27 | No auto-decision under any flag combination | Leave heavily-flagged nominations untouched | They remain "Pending review" indefinitely — no timeout or flag threshold auto-decides them | | |

## Email Template System

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-28 | Approval -> nominee notified | Nomination approved | Nominee receives an approval email containing the nomination text | | |
| T-29 | Approval -> nominator notified | Nomination approved | Nominator receives a successful nomination email | | |
| T-30 | Rejection -> nominator notified with reason | Nomination rejected with reason | Nominator's email includes reason for rejection | | |
| T-31 | Rejection -> nominee not notified | Nomination rejected with reason | No email sent to nominee | | |
| T-32 | No manual trigger needed | Several approvals/rejections processed in sequence | All emails sent automatically, no email-merge step by the coordinator | | |
| T-33 | Comms-sent date logged | Any email sent | Record shows a comms-sent timestamp | | |
| T-34 | Send failure is visible | Email provider fails to send | Failure is surfaced on the record, not silently dropped | | |

## Access Control

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-35 | Employee cannot view another employee's nomination via direct ID/URL access | Logged in as Employee A, manually navigate to or request nomination record belonging to Employee B | Access denied — not returned, even read-only | | |
| T-36 | Employee cannot reach the review/approve UI or API | Logged in as a non-coordinator employee, attempt to load the review screen or call the approve/reject action directly | Blocked — action unavailable regardless of UI hiding | | |
| T-37 | Contractor is blocked at the API, not just the form | Attempt a submission as a contractor via a direct request, bypassing the form UI | Rejected server-side — confirms the block isn't purely a UI-level convenience (ties to the brief's known self-nomination UI gap) | | |
| T-38 | Logged-out/unauthenticated request is rejected everywhere | Call submission, review, and record query actions with no valid session | All rejected with an authentication error, not partial data or a crash | | |

## Data Integrity & Concurrency

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-39 | Simultaneous decisions on the same nomination | Two coordinators open the same pending nomination and both submit a decision within seconds of each other | Only one decision is accepted; the second either fails clearly or is told the record has already been decided — never silently overwritten | | |
| T-40 | Stale-data review | Coordinator A opens a nomination; coordinator A (still on the old screen) attempts to reject it | Coordinator A's action is rejected or the screen is refreshed to show it's already decided — not applied on top of stale state | | |

## Session & Error Recovery

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-41 | Submission form recovers from a page reload | User accidentally reloads the page mid-form | Either the draft is preserved, or the user is clearly told the draft was lost — no ambiguous blank form that looks like nothing happened | | |

## Input Boundaries / Negative Testing

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-42 | Very long text in WHAT/HOW | Submit text far exceeding any expected length (e.g. several thousand characters) | Either gracefully truncated/rejected with a clear message, or stored and displayed correctly — never a crash or silent cutoff mid-word | | |
| T-43 | Script/HTML tags in text fields | Submit WHAT text containing `<script>` or HTML markup | Stored and later displayed as plain text — never executed or rendered as live HTML (XSS check) | | |
| T-44 | Emoji and non-Latin characters | Submit WHAT/HOW containing emoji, accented characters, or non-Latin scripts | Stored and displayed correctly in the record, review screen, and outgoing emails | | |
| T-45 | Whitespace-only submission | WHAT/HOW filled with only spaces or line breaks | Treated as blank — rejected by the same validation as an empty field | | |

## Performance Under Load

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-46 | Submission spike near quarterly deadline | Simulate many employees submitting concurrently in the final hour of a quarter | All valid submissions succeed; quota/eligibility checks remain accurate under concurrent load (no two people both getting accepted for what should be a blocked second nomination) | | |

## Cross-Browser

| ID | Test | Steps | Expected Result | Actual Result | Status |
|----|------|-------|------------------|----------------|--------|
| T-47 | Submission works on the organisation's standard browsers | Complete a submission on each browser staff actually use (e.g. Chrome, Edge, Safari) | Consistent behaviour across all of them | | |
