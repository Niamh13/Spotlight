# User personas — Spotlight (Star Awards Recognition Platform)

Three personas, matching the three actors the acceptance criteria are already written
against in `src/test/resources/features/`: `nominator.feature`, `nominee.feature`, and
`coordinator.feature`. Each persona below links back to the scenario IDs (UAT-\*) that
actor's feature file covers, so the persona and the executable spec stay traceable to each
other. There is no authentication yet, so these are UX personas, not access-control roles —
every screen that depends on the distinction says so on the screen (see the profile
switcher in `README.md`).


---

## The Nominator

*"As a nominator, I want to recognise a colleague's contribution and understand the rules
around how often I can do that."* — `nominator.feature`

### Role: full-time or part-time employee submitting a nomination

**Goals:**

* Recognize a colleague's specific contribution before the quarter closes, tied to one of
  the six core values. (UAT-1)
* Fill in the form quickly without first needing to learn the eligibility and quota rules.
* Fix a nomination that was sent back, without losing the quota slot it already used.
  (UAT-3)

**Needs:**

* Clear, in-form guidance on what each business category expects as evidence, and the
  core value sitting directly above the HOW box so it asks a specific question rather than
  a generic one.
* Immediate, unambiguous feedback if they've already nominated someone this quarter — and
  when they'll be able to submit again. (UAT-2)
* The nominator field pre-filled from their signed-in profile, so they never have to think
  about whose name it's filed under.

**Pain points:**

* Unsure where the line sits between "above and beyond" and routine duties — a nomination
  that reads as generic praise gets flagged as weak justification or routine language.
* No draft persistence: an accidental reload mid-form silently loses everything typed, with
  no warning that it happened.
* No confirmation email is actually sent yet, so the only proof of receipt is the on-screen
  response at submit time.

**Experience level:**

* Comfortable with ordinary web forms; no prior familiarity with the recognition process,
  its quarterly limit, or what trips a flag.

**Use case:**

* In one sitting: pick the nominee, practice, location, category and core value, write the
  WHAT and HOW, and submit before the quarter ends. If sent back, revise and resubmit
  against the same record rather than starting over.

**Thinking pattern:**

* Wants to do right by a colleague with minimal friction — if a rule (one nomination per
  quarter, no self-nomination) isn't obvious up front, they'll hit it as a rejection at
  submit time rather than anticipate it.

---

## The Nominee

*"As a nominee, when I'm approved for a Star Award I want to see exactly what was said
about me, not just a bare notification."* — `nominee.feature`

### Role: employee who is the subject of someone else's nomination

**Goals:**

* Be recognized accurately, in the nominator's own words, not a generic "you won an award"
  notice. (UAT-4)
* Understand specifically what they did that stood out, so the recognition means something
  beyond the fact of winning.

**Needs:**

* The full WHAT and HOW text quoted verbatim in their comms record if approved, not a
  summary or a paraphrase. (UAT-4)
* No exposure to the AI score, rationale, or coordinator's internal notes — those are
  working material for the reviewer, not something written about them for their own reading.

**Pain points:**

* Has zero visibility into a nomination that doesn't get approved — rejections are recorded
  only against the nominator, by design, so a nominee never learns someone tried and it
  didn't go through. (UAT-6)
* Entirely dependent on someone else's write-up representing the contribution well; can't
  self-nominate to correct an inaccurate or thin account of their own work.
* "Nothing is delivered" is still a known gap — no mail server is configured, so even an
  approved nominee's comms record exists in the system today without actually being emailed
  to them.

**Role:**

* Any full-time or part-time employee. Unlike the nominator, there's no cap on how many
  times or how many different people can nominate the same nominee in one quarter.

**Use case:**

* Entirely passive: takes no action in the app. If approved, receives one message quoting
  the nomination in full. If rejected or sent back, receives nothing.

**Thinking pattern:**

* Cares about being represented fairly and specifically — would notice (and be bothered by)
  a mismatch between what's said in the award message and what actually happened, since
  it's quoted verbatim rather than reworded.

---

## The Coordinator

*"As a recognition coordinator, I want to review nominations efficiently, see automatic
flags without digging, and keep a clear audit trail."* — `coordinator.feature`

### Role: HR / people-operations coordinator running the quarterly review

**Goals:**

* Move the queue through accurately and quickly, especially in the volume spike near a
  quarter's deadline.
* See flags — rule-based and AI — without having to dig for them. (UAT-5)
* Make consistent, defensible decisions, each backed by an audit entry recording who
  decided, when, and why. (UAT-8)

**Needs:**

* The full WHAT/HOW text, category, core value, and every flag with its reason visible
  before Approve, Reject or Request resubmission become actionable.
* A one-click completeness check that flags thin WHAT/HOW text and hands back ready-to-send
  wording for what's missing, instead of drafting a rejection reason from scratch each time.
  (UAT-7)
* Assurance that rejecting a nomination notifies only the nominator, never the nominee — and
  that the decision is captured against their own email in the audit log. (UAT-6, UAT-8)

**Pain points:**

* No shared guidelines panel on the review screen, so consistency between coordinators
  currently rests on habit rather than a documented standard.
* AI evaluation is advisory-only and sometimes unavailable (no API key, or a failed call),
  so the depth of AI context varies from one nomination to the next even though the rule
  flags don't.
* No authentication yet — the profile switcher changes what they see, not what's actually
  permitted, so nothing at the API layer currently stops a non-coordinator from calling the
  same review actions directly.

**Experience level:**

* Deep familiarity with the organisation's recognition criteria and its six core values;
  comfortable interpreting subjective, free-text justifications.

**Technical expertise:**

* Uses the web dashboard only (Review Queue, AI Review, Quarters, Activity Log) — no need
  to touch the API, the database, or the code.

**Use case:**

* Filter the queue by category, practice or location; open a pending nomination; read the
  WHAT/HOW alongside its flags and AI rationale; run the completeness check if it looks
  thin; then approve, reject with a reason, or request resubmission with a reason.

**Thinking pattern:**

* Treats every flag as "look closer here," not a verdict — reads the full nomination
  regardless of what's flagged, and expects the record to reflect exactly what happened,
  since it's the audit trail if a decision is ever questioned.

---
