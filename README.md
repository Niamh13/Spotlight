# Star Awards — Recognition Platform (Java / Spring Boot)

Prototype build for the Star Awards case study, targeting an Aug 29 delivery.
Built incrementally, epic by epic.

## What's built so far

**Epic 1 — Submission**
- `POST /api/nominations` — WHAT/HOW fields, practice, location, nominee/
  nominator identity. Self-nomination blocked (`400` if nominator email ==
  nominee email).
- Resubmission support: pass `originalNominationId` to link a new submission
  back to a rejected/needs-resubmission one.
- `GET /api/nominations/{id}`, `GET /api/nominations?status=PENDING_REVIEW`
  (status filter is optional — omit it to get everything).

**Epic 3 — Review actions**
- `POST /api/nominations/{id}/approve` — `{ "coordinatorEmail": "..." }`
- `POST /api/nominations/{id}/reject` — `{ "coordinatorEmail": "...", "reason": "..." }`
- `POST /api/nominations/{id}/request-resubmission` — same shape as reject
- All three only work on a `PENDING_REVIEW` nomination — acting on one
  already decided returns `409 Conflict`.
- Each action writes an audit log entry and fires a comms stub.

**Audit and activity history**
- `GET /api/nominations/{id}/audit-log` — one entry per coordinator
  decision (who, what, why, when), immutable once written.

**Automated decline acknowledgement**
- Rejecting a nomination logs a message to the nominator with the reason
  included, and stamps `commsSentDate`. Approval and resubmission-requested
  comms are stubbed the same way in `NotificationService` — no real mail
  server is wired up, every `sendXComms` method just logs what would be
  sent (visible in the `mvn spring-boot:run` console).

**Epic 2 — AI Tagging**
- Runs automatically on every submission, right after it's saved.
- **Deterministic checks** (`DeterministicFlagChecker`) — repeat nomination
  in the previous quarter, reciprocal nomination between the same pair.
  Plain SQL queries, no AI involved, can't fail.
- **AI-judged checks** — routine-task language and weak justification, plus
  a 0-100 score and a rationale for the coordinator. Two implementations,
  swapped via the `ai.evaluator` property:
  - `mock` (default, zero setup) — keyword heuristics, no network call.
  - `groq` — real call to Groq's free-tier API. See "Using the real Groq
    evaluator" below to turn this on.
- **Fallback handling**: if the evaluator is unavailable (no key) or the
  call fails, the nomination still reaches the coordinator with whatever
  deterministic flags apply and an `aiEvaluationStatus` of
  `SKIPPED_NO_API_KEY` or `FAILED` — submission is never blocked.
- Prompt is versioned: `prompts/nomination-evaluation-v1.txt`, with the
  version string persisted on every evaluated nomination (`aiPromptVersion`).
- See `docs/ai-bias-fairness-oversight.md` for what the AI is and isn't
  allowed to influence, and known limitations (notably: no employment-status
  check yet — see that doc for why).

**Reviewer dashboard**
- `src/main/resources/static/reviewer-dashboard.html` — a real page.
  Filter by practice/location/status, see AI flags and score/rationale (or
  an "AI review unavailable" note if the evaluation was skipped/failed),
  approve/reject/request resubmission inline, expand a per-nomination
  activity history.
- Responsive down to mobile; built with keyboard/screen-reader access from
  the start — semantic landmarks, visible focus states,
  `prefers-reduced-motion` respected, status shown with text + color (never
  color alone).
- No login yet — actions prompt once for "your" email and remember it in
  the browser, as a stand-in for real coordinator auth.

## Using the real Groq evaluator

**Clone and run — no setup required.** `ai.evaluator=auto` means the app
uses Groq when a key is available and falls back to the built-in mock
evaluator when it isn't. Either way nominations get a score, a rationale
and flags, so a fresh clone is fully demonstrable straight away. The
startup log says which one is live:

```
AI evaluator: mock (rule-of-thumb, no network) - no GROQ_API_KEY set [ai.evaluator=auto]
AI evaluator: Groq (live model) [ai.evaluator=auto]
```

To use real AI judgment, set a key. Groq was picked over the paid
providers because it has a genuinely free, no-credit-card developer tier.

1. Get a key at console.groq.com (free, no card required).
2. Set it as an environment variable — **never put it in a properties file
   or commit it anywhere.** This repository is public; a key committed here
   is public the moment it is pushed, and stays in the history afterwards.
   ```bash
   export GROQ_API_KEY=gsk_...          # Mac/Linux
   $env:GROQ_API_KEY = "gsk_..."        # Windows PowerShell
   ```
   `application.properties` reads it via `groq.api.key=${GROQ_API_KEY:}` —
   the trailing colon defaults it to empty rather than failing startup.
3. Restart. New submissions now call Groq (model defaults to
   `openai/gpt-oss-20b`; override with `groq.api.model`, e.g.
   `openai/gpt-oss-120b`, for more reasoning depth at the cost of speed).

Force one or the other with `ai.evaluator=groq` or `ai.evaluator=mock`.
If a Groq call fails, nominations still submit normally — see Epic 2 above.

## What's NOT built yet, in build order

1. **Epic 4 — Reachdesk gift card**: the seam is marked with a comment in
   `NominationService.approve()`. Stub the trigger first, swap in the real
   API call once credentials exist.
2. **Auth**: the dashboard's email prompt is a placeholder for real login.

## Data model

`Nomination`: id, nominator (name/email), nominee (name/email), practice,
location, WHAT, HOW, status (`PENDING_REVIEW` / `APPROVED` / `REJECTED` /
`NEEDS_RESUBMISSION`), AI flags, rejection reason, original nomination ID
(resubmission thread), coordinator email, submitted/decision/comms-sent
dates. `AuditLogEntry`: nomination ID, coordinator email, action, reason,
timestamp — separate table, append-only.

## Database migrations (Liquibase)

Schema is managed by Liquibase, not Hibernate auto-DDL — migrations live in
`src/main/resources/db/changelog/`. Four changesets: `001` nominations,
`002` AI flags, `003` audit log, `004` AI score/rationale/prompt-version/
evaluation-status columns. Each has an explicit `<rollback>` block.

**Deploy from scratch, one command:**

```bash
rm -rf data/               # wipe the local H2 file to simulate "from scratch"
mvn liquibase:update
```

Check it worked: `mvn liquibase:status` should show no pending changesets.

**Test rollback:**

```bash
mvn liquibase:rollback -Dliquibase.rollbackCount=1   # drops the ai columns added in 004
mvn liquibase:rollback -Dliquibase.rollbackCount=1   # drops nomination_audit_log
mvn liquibase:rollback -Dliquibase.rollbackCount=1   # drops nomination_ai_flags
mvn liquibase:rollback -Dliquibase.rollbackCount=1   # drops nominations
mvn liquibase:status                                  # all four now show as pending again
mvn liquibase:update                                  # re-apply all four - confirms the forward path still works
```

**Note:** the app also runs Liquibase automatically on startup via
`spring.liquibase.change-log` in `application.properties` — the CLI
commands above test migrations independently of the running app.

## Running it locally

No internet access in the environment this was written in, so it hasn't
been dependency-resolved or compiled here — do that locally:

```bash
mvn spring-boot:run
```

API on `http://localhost:8080`. Dashboard at
`http://localhost:8080/reviewer-dashboard.html`. H2 console at
`http://localhost:8080/h2-console` (JDBC URL
`jdbc:h2:file:./data/recognitiondb;AUTO_SERVER=TRUE`, user `sa`, no
password).

## Try it

```bash
# Submit a nomination
curl -X POST http://localhost:8080/api/nominations \
  -H "Content-Type: application/json" \
  -d '{
    "nominatorName": "Jamie Doyle",
    "nominatorEmail": "jamie.doyle@version1.com",
    "nomineeName": "Alex Rivera",
    "nomineeEmail": "alex.rivera@version1.com",
    "practice": "Cloud Engineering",
    "location": "Dublin",
    "whatText": "Led the release rollout over a tight weekend.",
    "howText": "Demonstrated ownership by keeping the whole team calm and coordinated under pressure."
  }'
# Save the "id" from the response for the next commands

# Approve it
curl -X POST http://localhost:8080/api/nominations/<id>/approve \
  -H "Content-Type: application/json" \
  -d '{ "coordinatorEmail": "coordinator@version1.com" }'

# Or reject it instead
curl -X POST http://localhost:8080/api/nominations/<id>/reject \
  -H "Content-Type: application/json" \
  -d '{ "coordinatorEmail": "coordinator@version1.com", "reason": "Needs a more specific example of impact." }'

# Check the audit trail
curl http://localhost:8080/api/nominations/<id>/audit-log

# Try acting on it again - expect 409 Conflict
curl -X POST http://localhost:8080/api/nominations/<id>/approve \
  -H "Content-Type: application/json" \
  -d '{ "coordinatorEmail": "coordinator@version1.com" }'
```

Self-nomination check:

```bash
curl -X POST http://localhost:8080/api/nominations \
  -H "Content-Type: application/json" \
  -d '{
    "nominatorName": "Jamie Doyle",
    "nominatorEmail": "jamie.doyle@version1.com",
    "nomineeName": "Jamie Doyle",
    "nomineeEmail": "jamie.doyle@version1.com",
    "practice": "Cloud Engineering",
    "location": "Dublin",
    "whatText": "...",
    "howText": "..."
  }'
# -> 400 { "error": "You can't nominate yourself." }
```

## Project layout

```
src/main/java/com/version1/recognition/
├── RecognitionApplication.java
├── common/
│   └── GlobalExceptionHandler.java
└── nomination/
    ├── Nomination.java                  # JPA entity - full dashboard schema
    ├── NominationStatus.java            # PENDING_REVIEW / APPROVED / REJECTED / NEEDS_RESUBMISSION
    ├── AiFlag.java                      # advisory tag values
    ├── AiEvaluationStatus.java          # COMPLETED / FAILED / SKIPPED_NO_API_KEY
    ├── AiEvaluationResult.java          # score + rationale + flags + prompt version
    ├── AiEvaluationException.java       # thrown by evaluators, caught by the service
    ├── NominationEvaluator.java         # the pluggable AI contract
    ├── GroqNominationEvaluator.java     # real implementation - needs GROQ_API_KEY
    ├── MockNominationEvaluator.java     # default - no key needed
    ├── DeterministicFlagChecker.java    # repeat/reciprocal checks - no AI, can't fail
    ├── AuditAction.java                 # APPROVED / REJECTED / RESUBMISSION_REQUESTED
    ├── AuditLogEntry.java               # audit trail entity
    ├── AuditLogRepository.java
    ├── NominationRequest.java           # inbound DTO, validation, resubmission link
    ├── NominationResponse.java          # outbound DTO
    ├── ApproveRequest.java              # DTO for approve
    ├── ReviewDecisionRequest.java       # DTO for reject / request-resubmission
    ├── AuditLogEntryResponse.java       # outbound DTO for history
    ├── NominationRepository.java
    ├── NominationService.java           # self-nomination block + review actions + evaluation
    ├── NotificationService.java         # comms stub - logs instead of emailing
    ├── NominationController.java
    ├── SelfNominationException.java
    └── InvalidReviewStateException.java # 409 when re-deciding a nomination

src/main/resources/
├── application.properties
├── db/changelog/                        # Liquibase migrations
├── prompts/
│   └── nomination-evaluation-v1.txt     # versioned AI evaluation prompt
└── static/
    ├── reviewer-dashboard.html
    ├── reviewer-dashboard.css
    └── reviewer-dashboard.js

docs/
└── ai-bias-fairness-oversight.md        # what the AI can/can't influence, known limitations
```
