# AI Bias, Fairness, and Human Oversight — Star Awards Nomination Review

This document covers how the AI tagging step (Epic 2) is scoped, what it
is and isn't allowed to influence, and the known limitations that anyone
extending it should understand before doing so.

## The core control: AI never decides

The AI evaluator (`GroqNominationEvaluator` / `MockNominationEvaluator`)
produces a **score, a rationale, and advisory flags**. That's all it does.
Nothing in the codebase lets an AI output change a nomination's status.
Status only ever changes through the three coordinator-initiated actions in
`NominationService` (`approve`, `reject`, `requestResubmission`), each of
which requires a human `coordinatorEmail` and is written to an immutable
audit log entry. There is no code path from "AI evaluation completes" to
"nomination status changes" — a coordinator is required every time.

This is enforced structurally, not just by convention: the evaluation step
runs once, at submission time, before any coordinator ever sees the
nomination. It has no way to call `approve()` or `reject()` even if someone
wanted it to — those methods aren't exposed to it.

## What the AI is asked to judge, and what it isn't

Per the brief, the AI evaluation is scoped to exactly two things:

- **Routine-task language** — does the WHAT read as normal day-to-day
  duties rather than something above and beyond them?
- **Weak justification** — does the HOW section give a specific example
  tied to a value, or is it generic praise?

It is explicitly instructed (see `prompts/nomination-evaluation-v1.txt`)
**not** to judge whether the achievement itself is "good enough" — that
qualitative call belongs to the coordinator, not the model.

Four of the six checks are deliberately **not** sent to the AI at all:
self-nomination, reciprocal nomination, repeat nomination in consecutive
quarters, and employment status. These are matters of fact — has this pair
appeared before, was this person nominated last quarter — so they're
answered by rule classes (`SelfNominationCheck`, `ReciprocalNominationCheck`,
`RepeatNominationCheck`, `EmployeeStatusCheck`) comparing dates and email
addresses.

This is a fairness choice as much as an engineering one: a factual question
shouldn't be subject to a model's judgement, or to the variance that comes
with it. Two people with identical nomination histories get identical flags,
every time.

The remaining two — routine language and weak justification — are judgement
calls about wording, and both a rule and the AI can raise them. Where they
agree, the rule's version is kept, because it can say precisely what tripped
("under 150 characters, no figures given") rather than simply asserting it.

## Known limitation: employment status

The brief also lists "not an active employee" as something the AI should
flag. `EmployeeStatusCheck` exists but **always passes**. Employment status isn't something a
language model should infer from nomination text — it needs a real lookup
against an HR/employee directory, which isn't available yet (see the open
"employee data source" dependency from the wider platform architecture).
Flagging this from text alone risks false positives/negatives with no
factual basis. Leave this flag unimplemented until a real data source
exists, rather than approximating it.

## Bias considerations

- **Prompt versioning**: every evaluation records which prompt version
  produced it (`aiPromptVersion` on the nomination). If the prompt is
  found to behave unevenly across teams, locations, or writing styles,
  that's traceable and reproducible, not anecdotal.
- **No demographic or identity signal is ever sent to the model.** The
  prompt template only includes the WHAT and HOW text — never nominee/
  nominator name, practice, location, or any other field. A person's name
  or team shouldn't influence a language-quality judgment, so it's
  structurally excluded rather than left to the model to ignore.
- **Score and rationale are shown to the coordinator, never to the
  nominator or nominee.** This is a working assessment for the human
  decision-maker, not a verdict delivered to the person being evaluated.
- **The flag set is small and specific on purpose.** A model asked to
  freely assess "nomination quality" is far more exposed to bias than one
  asked two narrow, checkable questions. If the flag set grows later,
  each new flag should be similarly narrow and ideally auditable against
  ground truth (like the deterministic ones already are).

## Fallback and oversight when AI is unavailable

If the API key isn't configured, or the call fails for any reason (see
`GroqNominationEvaluator` / `NominationService.evaluate()`), the
nomination is **never blocked**. It reaches the coordinator queue with:
- Whatever deterministic flags apply (unaffected by AI availability)
- An `aiEvaluationStatus` of `SKIPPED_NO_API_KEY` or `FAILED`
- A visible "AI review unavailable" note on the reviewer dashboard

The coordinator's job doesn't change either way — they're reviewing the
full nomination text regardless of whether AI flags are present. AI
availability affects how much advisory context they get, never whether
review can happen at all.

## Recommended before wider rollout

- Spot-check a sample of AI scores/rationale against coordinator decisions
  once real usage data exists, to check for systematic disagreement
  patterns (e.g., consistently under/over-scoring certain practices or
  locations) — this is the audit the earlier user stories flagged before
  trusting the system unsupervised.
- Revisit this document whenever the prompt version changes.
