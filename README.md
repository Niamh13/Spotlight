# Spotlight — Star Awards Recognition Platform

Team **Star Girls** · Version 1 case study · Java / Spring Boot prototype.

A recognition platform for Version 1's Star Awards: colleagues nominate each
other, a coordinator reviews the nominations, and incomplete ones get sent back
with the specific gaps listed.

Built incrementally, epic by epic. This README covers everything that exists
today, what it does, and how to run it.

---

## Contents

- [What works today](#what-works-today)
- [Quick start](#quick-start)
- [How the pieces fit together](#how-the-pieces-fit-together)
- [The web interface](#the-web-interface)
- [The API](#the-api)
- [How submission works](#how-submission-works)
- [How resubmission requests work](#how-resubmission-requests-work)
- [Database and migrations](#database-and-migrations)
- [Tests](#tests)
- [Project layout](#project-layout)
- [What's not built yet](#whats-not-built-yet)

---

## What works today

| Area | State |
|---|---|
| Submit a Star Award nomination | **Working** — full validation, self-nomination blocked |
| Completeness evaluation | **Working** — runs on submission, never blocks it |
| Resubmission requests | **Working** — sends a message listing each failing criterion |
| Browse / filter / inspect nominations | **Working** |
| Web interface | **Working** for the above; other screens are layout only |
| Approve & reject | Not built (Epic 3) |
| AI tagging | Not built (Epic 2) |
| Praises, Moments that Matter | Screens only — no backend at all |
| Real email delivery | Stubbed — logs instead of sending |

Anything not wired to the API is labelled as such **on the screen itself**, so
a demo can't accidentally imply more is built than actually is.

---

## Quick start

Needs **Java 17+** and **Maven**. No internet access required after the first
dependency resolve, and no database to install — H2 runs from a local file.

```bash
# 1. Create the database schema from scratch
rm -rf data/
mvn liquibase:update

# 2. Run the app
mvn spring-boot:run
```

Wait for `Started RecognitionApplication` in the console, then open:

| | |
|---|---|
| Web interface | http://localhost:8080 |
| API | http://localhost:8080/api/nominations |
| H2 console | http://localhost:8080/h2-console |

H2 console login — JDBC URL `jdbc:h2:file:./data/recognitiondb;AUTO_SERVER=TRUE`,
user `sa`, password blank.

> Run the Liquibase step **before** starting the app. Hibernate is set to
> `validate`, so it checks the entity mappings against the schema Liquibase
> built and refuses to start if they disagree. It never creates or alters
> tables itself.

To wipe everything and start over: stop the app, then `rm -rf data/ && mvn liquibase:update`.

---

## How the pieces fit together

```
Browser  ──►  index.html            single-page UI, no build step, no dependencies
                  │  fetch()
                  ▼
              NominationController   REST endpoints
                  │
      ┌───────────┴────────────┐
      ▼                        ▼
 NominationService      ResubmissionService
   submit / find          evaluate + send
      │                    │      │      │
      │                    │      │      └──► ResubmissionNotifier  (stub: logs)
      │                    │      └─────────► ResubmissionMessageFactory
      │                    └────────────────► NominationEvaluator
      ▼                                             │
 NominationRepository ◄──────────────────────────────┘
      │
      ▼
   H2 (file)  ◄──  schema owned by Liquibase, not Hibernate
```

Everything lives in one package, `com.version1.recognition.nomination`, plus a
`common` package holding the global exception handler.

---

## The web interface

A single self-contained `index.html` in `src/main/resources/static/`. Spring
Boot serves it at `/` automatically. No build step, no npm, no CDN — it works
offline and there is nothing to compile.

Nine screens in the sidebar. Each is labelled with what's actually behind it:

**Live** (real API calls)
- **Home** — pick a recognition type, see recent activity
- **Submit Recognition** — the Star Award nomination form
- **My Recognition** — all nominations with counts by status
- **Star Awards** — filter by status, inspect any record, request resubmissions
- **Help & Guidelines** — static reference content

**UI only** (sample content, marked with a banner on every screen)
- Praises Wall, Send a Praise, Moments that Matter, Dashboard, Reports

Two details worth knowing:

- **The browser validates nothing.** The form is `novalidate` and sends blank
  fields as typed, so every rule you see enforced is genuinely the API's. The
  inline errors under each field are the actual Bean Validation messages.
- **"My Recognition" shows everyone's nominations.** There's no auth yet, so it
  can't filter to you. The screen says so rather than pretending.

There's also a collapsible **API activity** panel at the bottom of live screens
showing every request the page makes with its status code — useful for demos.

---

## The API

Base path `/api/nominations`.

| Method | Path | Does |
|---|---|---|
| `POST` | `/api/nominations` | Submit a nomination → `201` |
| `GET` | `/api/nominations` | List all (backs the dashboard) |
| `GET` | `/api/nominations/{id}` | One nomination, including its evaluation |
| `GET` | `/api/nominations/{id}/evaluation` | Completeness check. Read-only, sends nothing |
| `POST` | `/api/nominations/{id}/request-resubmission` | Send the nominator the gap list → `201` |
| `GET` | `/api/nominations/{id}/resubmission-requests` | Audit trail of what was sent |

**Status codes**

| Code | When |
|---|---|
| `400` | Validation failed, or self-nomination |
| `404` | No nomination with that id |
| `409` | Resubmission doesn't apply — already decided, already requested, or nothing wrong with it |

---

## How submission works

```bash
curl -X POST http://localhost:8080/api/nominations \
  -H "Content-Type: application/json" \
  -d '{
    "nominatorName": "Jamie Doyle",
    "nominatorEmail": "jamie.doyle@version1.com",
    "nomineeName": "Alex Rivera",
    "nomineeEmail": "alex.rivera@version1.com",
    "practice": "Cloud Engineering",
    "location": "Dublin",
    "whatText": "Led the release rollout over a tight weekend and saved the client two days of downtime.",
    "howText": "Demonstrated Excellence by keeping the whole team calm and coordinated under pressure."
  }'
```

Rules the API enforces:

- All eight fields are required and non-blank.
- Both email addresses must be valid.
- **You can't nominate yourself** — compared on email, case-insensitively.
  Returns `400 {"error": "You can't nominate yourself."}`
- Every new nomination saves as `PENDING_REVIEW`.

Pass `originalNominationId` to link a resubmission back to the nomination it
replaces.

---

## How resubmission requests work

This is the flow for nominations that arrive too thin to review.

### 1. Every nomination is evaluated on the way in

`NominationEvaluator` checks it against seven criteria:

| Criterion | Fires when |
|---|---|
| `WHAT_MISSING` / `HOW_MISSING` | The section is empty |
| `WHAT_TOO_BRIEF` / `HOW_TOO_BRIEF` | Under 40 characters |
| `WHAT_MISSING_IMPACT` | No outcome word and no quantified amount |
| `HOW_NO_CORE_VALUE` | Doesn't name a Version 1 core value |
| `PLACEHOLDER_TEXT` | The whole field is `...`, `n/a`, `TBC` and friends |

**Evaluation never blocks a submission.** An incomplete nomination is still
accepted and still saved as `PENDING_REVIEW` — the gaps are just recorded on
the response so a coordinator can see them.

### 2. A coordinator looks at the gaps

```bash
curl http://localhost:8080/api/nominations/<id>/evaluation
```

```json
{
  "complete": false,
  "failingCriteria": [
    {
      "code": "WHAT_TOO_BRIEF",
      "gap": "The WHAT is too brief to review.",
      "remedy": "Give enough detail for a coordinator to understand what actually happened."
    }
  ]
}
```

### 3. A coordinator sends the request

```bash
curl -X POST http://localhost:8080/api/nominations/<id>/request-resubmission \
  -H "Content-Type: application/json" \
  -d '{"coordinatorEmail": "colette.lynch@version1.com"}'
```

The nominator gets a message listing **every** failing criterion, with what to
do about each one:

```
Hi Jamie Doyle,

Thanks for nominating Alex Rivera for a Star Award. Before it can go to
review we need a little more detail.

There are 4 things to address:

  1. The WHAT is too brief to review.
     What to do: Give enough detail for a coordinator to understand what
     actually happened.

  2. The WHAT doesn't say what the impact was.
     What to do: Say who benefited, or what changed as a result.
  ...

Your original wording is below so you can build on it rather than start again.

WHAT: Did stuff.
HOW:  Was good.

Reference: 8ed8ffff-3620-4b73-982e-33635125c949
```

The nomination moves to `RESUBMISSION_REQUESTED`, `commsSentDate` is stamped,
and a row is written to `resubmission_requests` with the message verbatim.

### Three design decisions worth knowing

**A human sends it, not the machine.** The criteria are simple length and
keyword checks, and they *will* produce false positives — a good nomination
that doesn't happen to use an impact word gets flagged. That's survivable only
because a coordinator reviews the gaps before deciding. **Do not wire the
evaluator straight to an automatic send.** Epic 2's AI tagging is the intended
replacement, and `NominationEvaluator` is the single place it plugs into.

**`RESUBMISSION_REQUESTED` is not `REJECTED`.** "We need more detail" and "this
didn't meet the bar" mean different things to the person who wrote it, and
report differently on the dashboard.

**Delivery is stubbed.** `LoggingResubmissionNotifier` writes the message to
the log instead of emailing it. The `ResubmissionNotifier` interface is the
seam for Epic 5's real mail sender. The database row and the `commsSentDate`
stamp are written either way, so *was a request sent* is answerable from SQL
rather than from the log.

---

## Database and migrations

Schema is owned by **Liquibase**, not Hibernate auto-DDL. `spring.jpa.hibernate.ddl-auto`
is `validate` — Hibernate checks the mappings and never changes the schema.

Migrations live in `src/main/resources/db/changelog/`, one table per changeset,
each with an explicit `<rollback>` block:

| Changeset | Creates |
|---|---|
| `001` | `nominations` |
| `002` | `nomination_ai_flags` |
| `003` | `resubmission_requests` |
| `004` | `resubmission_request_criteria` |

Adding the `RESUBMISSION_REQUESTED` status needed no migration — `status` is a
plain `VARCHAR(50)` with no check constraint.

**Deploy from scratch**

```bash
rm -rf data/
mvn liquibase:update
mvn liquibase:status     # should report "up to date"
```

**Test the rollback** — this is the real test, not just "rollback didn't error".
It proves the schema can be torn down *and built back up again*:

```bash
mvn liquibase:rollback -Dliquibase.rollbackCount=2   # drop the two resubmission tables
mvn liquibase:status                                  # both show as pending again
mvn liquibase:update                                  # re-apply — forward path still works
mvn liquibase:rollback -Dliquibase.rollbackCount=4   # tear the whole schema down
mvn liquibase:update                                  # and build it back from nothing
```

Running the app also applies migrations automatically on startup
(`spring.liquibase.change-log`). The Maven commands above test the migrations
independently of the app.

---

## Tests

```bash
mvn test
```

22 tests, no Spring context needed, so they run in seconds.

| Class | Covers |
|---|---|
| `NominationEvaluatorTest` | Each criterion fires when it should, and doesn't when it shouldn't |
| `ResubmissionMessageFactoryTest` | The message lists every failing criterion |
| `ResubmissionServiceTest` | A request is sent, status transitions, and every guard |

The service tests cover the failure paths too: refusing when already decided,
refusing to send twice, refusing when the nomination passes evaluation, and
writing nothing at all if delivery fails.

---

## Project layout

```
pom.xml
src/main/java/com/version1/recognition/
├── RecognitionApplication.java
├── common/
│   └── GlobalExceptionHandler.java     400 / 404 / 409 responses
└── nomination/
    ├── Nomination.java                 JPA entity
    ├── NominationStatus.java           PENDING_REVIEW / RESUBMISSION_REQUESTED / APPROVED / REJECTED
    ├── AiFlag.java                     Epic 2 advisory flags — not wired up yet
    ├── NominationRequest.java          inbound DTO + validation
    ├── NominationResponse.java         outbound DTO
    ├── NominationRepository.java
    ├── NominationService.java          submit, self-nomination block
    ├── NominationController.java       all six endpoints
    ├── SelfNominationException.java
    │
    ├── EvaluationCriterion.java        the seven criteria + their wording
    ├── NominationEvaluation.java       result of evaluating one nomination
    ├── NominationEvaluator.java        the checks themselves
    ├── EvaluationResponse.java
    │
    ├── ResubmissionRequest.java        persisted record of what was sent
    ├── ResubmissionRequestRepository.java
    ├── ResubmissionService.java        evaluate + send + transition
    ├── ResubmissionMessageFactory.java renders the message
    ├── ResubmissionNotifier.java       delivery seam
    ├── LoggingResubmissionNotifier.java stub: logs instead of sending
    ├── RequestResubmissionRequest.java
    ├── ResubmissionRequestResponse.java
    └── ResubmissionNotApplicableException.java

src/main/resources/
├── application.properties
├── static/index.html                   the entire web interface
└── db/changelog/                       001–004 + master

src/test/java/...                       22 tests
```

---

## What's not built yet

In intended build order:

1. **Epic 3 — Review.** Coordinator approve/reject endpoints, mandatory
   rejection reason, audit log. The critical path everything else hangs off.
2. **Epic 2 — AI tagging.** Populates `AiFlag` for the coordinator to see.
   Advisory only — it never blocks submission or decides an outcome. This is
   what should replace the keyword heuristics in `NominationEvaluator`.
3. **Epic 4 — Reachdesk gift card.** Stub the trigger first, swap in the real
   API call once credentials exist.
4. **Epic 5 — Comms.** Notify nominee and nominator, log every send. The
   `ResubmissionNotifier` interface is already the seam for this.
5. **Epic 6 — Dashboard.** `GET /api/nominations` is the data source; still
   needs practice and location filtering.

Also missing across the board: **authentication**. There are no user accounts,
so there's no "my" nominations and no real coordinator identity — coordinator
email is passed explicitly as a stand-in.

Praises and Moments that Matter exist as screens only. Making them real means
new entities, migrations `005`+, and endpoints — and it invents domain
decisions (values list, MtM types, teams, coordinator roles) the team hasn't
agreed yet.
