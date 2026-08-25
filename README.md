# Spotlight — Star Awards Recognition Platform

Java / Spring Boot build of the Star Awards case study: employees submit
nominations through a guided form, an AI pass and a set of rules flag the weak
ones, and a coordinator reviews, decides and has the outcome communications
written for them.

Built incrementally, epic by epic. This is a working prototype, not a
production deployment — see [Known gaps](#known-gaps) before drawing
conclusions from it.

---

## Running it

Needs a JDK (17+), Maven, and a **MySQL 8 server**. No Node, no API key.

**1. Point the app at your MySQL.** Copy the template and fill in your
credentials:

```bash
cp .env.example .env        # copy .env.example .env  on Windows
```

```
MYSQL_USERNAME=root
MYSQL_PASSWORD=your_password
```

You do **not** need to create the database by hand — the connection string
carries `createDatabaseIfNotExist`, and Liquibase builds the tables inside it
on first run, seed data included.

**2. Run it.**

```bash
mvn spring-boot:run
```

Then open **http://localhost:8080**.

**You do not need an API key to run or test this** — see
[AI evaluation](#using-the-real-groq-evaluator) for what happens without one.

Browse the data with **MySQL Workbench**: connect to `localhost:3306`, schema
`recognitiondb`.

### Resetting the database

```sql
DROP DATABASE recognitiondb;
```

Restart the app and Liquibase rebuilds it from the migrations, seed data
included.

> **Moving from the H2 version?** Older checkouts kept the database in a
> `data/` folder. Nothing writes there any more — the folder is safe to
> delete.

### Demo data

A fresh start comes with 13 nominations across two quarters, covering every
status, all six core values, the five categories, and each AI evaluation
outcome. This is deliberate: an empty dashboard looks identical to a broken
one, and the first ten minutes of every handover was being spent working out
which it was.

Four profiles are available from the switcher in the bottom-left corner:

| Profile | Role | State |
|---|---|---|
| Sarah Murphy | Employee | Has not nominated this quarter — use this to test the form |
| Calvin Ho | Employee | Already nominated (pending) |
| Jamie Doyle | Employee | Nomination was sent back for more detail |
| Colette Lynch | Admin / HR | Coordinator — review queue, dashboard, activity log |

The switcher changes **which screens and actions you see**, not what you are
allowed to do. There is no authentication yet; every screen that depends on
the distinction says so on the screen.

---

## What's built

### Submission

- Guided form: WHAT, HOW, nominee, practice, location.
- **Business category** — one of five, required. Picking one shows the kind of
  evidence it expects, which is most of why it exists.
- **Core value** — no longer a dropdown. The six values are listed under the
  HOW box as prompts, and the value is read back out of what was written. A
  dropdown let someone pick a value and then describe something else entirely;
  detecting it from the text means the recorded value and the words behind it
  cannot disagree.
- Nominator identity is fixed from the signed-in profile and cannot be edited,
  so a nomination cannot be filed under someone else's name.
- Self-nomination blocked outright (`400`).
- **One nomination per person, per quarter.** A second attempt returns `409`.
  A resubmission is exempt — it continues the existing entry rather than
  starting a new one.

### Tagging

Six independent checks, each answering one yes/no question and returning the
reason it fired. `TaggingService` collects every `NominationCheck` bean Spring
finds, so adding a seventh rule means adding one class and editing nothing
else.

| Check | Catches |
|---|---|
| `SelfNominationCheck` | Nominator and nominee are the same person |
| `ReciprocalNominationCheck` | The two have nominated each other |
| `RepeatNominationCheck` | Same nominee also nominated last quarter |
| `WeakJustificationCheck` | Thin on 2 of 3 signals: short, no figures, HOW doesn't connect to the value chosen |
| `RoutineLanguageCheck` | Describes routine duties or generic praise |
| `EmployeeStatusCheck` | **Placeholder — always passes.** Needs an HR feed that doesn't exist yet |

None of these use AI. They are string matching, email comparison and date
arithmetic — cheap, deterministic, and still working when the model is
unavailable. `WeakJustificationCheck` and `RoutineLanguageCheck` are the two
that could reasonably be swapped for a model-backed version later; because they
sit behind `NominationCheck`, that swap touches one file each.

Flags carry a **reason** and a **source** (`RULE` or `AI`). Reciprocal and
repeat depend on the other rows on record, so a submission retags everything —
otherwise B nominating A back would flag only B's record and leave A's clean.
Retagging replaces rule flags and preserves AI ones, which cannot be
regenerated.

### AI evaluation

Scores how *reviewable* a nomination is out of 100, with a rationale written
for the coordinator. Advisory only — it never approves or rejects anything, and
it is not shown to employees at all.

The prompt lives in
[`src/main/resources/prompts/nomination-evaluation-v1.txt`](src/main/resources/prompts/nomination-evaluation-v1.txt)
and is **re-read on every evaluation**. Edit it, submit a nomination, see the
change — no rebuild, no restart. Controlled by `ai.prompt.file`; if that path
isn't readable the packaged copy on the classpath is used instead, so a real
deployment works untouched.

### Review

- Queue with clickable status tiles and a live progress bar.
- Full nomination, AI assessment and flags with their reasons.
- Approve, reject, or request resubmission. Reject and resubmission require a
  reason; all three accept an optional internal note.
- A nomination can only be decided once (`409` on a second attempt).
- Filters by category, practice, location and name, which persist as you move
  between the status tiles rather than resetting.
- Tick two or more rows to read them side by side.

### Communications and logging

Every decision records who did it, when, the reason, the internal note, and
**the full text of every message it generated**. Approving produces two: a
confirmation to the nominator and the award itself to the nominee, with the
nomination quoted in full.

Messages are stored verbatim rather than re-rendered on demand — templates get
reworded, and a record that changes to match today's wording is not a record.

**Nothing is delivered.** No mail server is configured. Every screen showing a
message says so.

### Coordinator views

- **Review Queue** — decisions, with progress.
- **AI Summary** — every assessment weakest-first, triage bands, which
  nominations could *not* be scored, and a link straight into the one you are
  reading.
- **Quarters** — participation per quarter, who nominated whom.
- **Activity Log** — every recorded action newest-first, with the messages.

### Interface

Light / dark / auto, plus an independent greyscale mode — useful as an
accessibility check, since anything relying on colour alone stops working and
becomes obvious.

---

## Core values

Version 1's six, confirmed from published sources:

Honesty & Integrity · Personal Commitment · No Ego · Customer First ·
Excellence · Drive

An earlier prototype carried an invented set (Customer Success, Innovation,
Collaboration, Community); only Excellence overlapped. **Worth confirming the
wording against the internal DNA booklet before this goes live** — the names
here come from public sources, not an official internal document.

---

## Using the real Groq evaluator

`ai.evaluator=auto` uses Groq when a key is available and a built-in mock
evaluator when it isn't, so a fresh clone runs end to end with no setup and
still produces scores, rationales and flags. The startup log says which:

```
AI evaluator: mock (rule-of-thumb, no network) - no GROQ_API_KEY set [ai.evaluator=auto]
AI evaluator: Groq (live model) [ai.evaluator=auto]
```

### If you cloned this and want the real model

**The key is not in the repository and never will be** — `.env` is gitignored,
so it does not travel with a clone. You need your own. It takes about a minute:

1. Sign up at console.groq.com — free tier, no card required.
2. Create an API key.
3. In the project root:
   ```bash
   cp .env.example .env     # copy .env.example .env   on Windows
   ```
   Open `.env` and paste your key after `GROQ_API_KEY=`.
4. `mvn spring-boot:run`. The startup log should now say `Groq (live model)`.

An environment variable works too and takes precedence over the file, which is
how CI and deployed environments override it:

```bash
export GROQ_API_KEY=gsk_...          # Mac/Linux
$env:GROQ_API_KEY = "gsk_..."        # Windows PowerShell
```

`application.properties` resolves `groq.api.key` from the environment variable
first, then `.env`, then falls back to empty.

**Never put a key in `application.properties`.** This repository is public; a
key committed there is public the moment it is pushed, and remains in the
history after it is deleted.

Force either side with `ai.evaluator=groq` or `ai.evaluator=mock`. Model
defaults to `openai/gpt-oss-20b`; override with `groq.api.model`.

> `gpt-oss` is a reasoning model that spends completion tokens thinking before
> it answers. `max_tokens` is 1500 with `reasoning_effort=low` — at 300 it used
> 298 on reasoning and returned an empty answer, which looks like a refusal but
> is simply running out of room.

---

## Database migrations (Liquibase)

Schema is managed by Liquibase, not Hibernate auto-DDL. Migrations live in
`src/main/resources/db/changelog/`. **Twelve changesets** as of this writing:

| | |
|---|---|
| `001`–`003` | nominations, AI flags, audit log |
| `004` | AI score / rationale / prompt version / evaluation status |
| `005` | demo nominations (`context="demo"`) |
| `006` | flag reason and source |
| `007` | award category |
| `008` | audit comment |
| `009` | demo data rebalanced across quarters |
| `010` | messages moved to their own table |
| `011` | core value |

Each has an explicit `<rollback>` block. The app runs Liquibase automatically
on startup; the CLI commands below test migrations independently of it.

```bash
mvn liquibase:status                     # what's pending
mvn liquibase:update                     # apply without starting the app
mvn liquibase:rollback -Dliquibase.rollbackCount=1   # undo the most recent changeset
```

**Rolling back is by count, newest first.** Check `liquibase:status` to see
what you are actually undoing rather than assuming a number — the list above
changes as migrations are added.

To rebuild from scratch, `DROP DATABASE recognitiondb;` and restart the app.

Seed data is tagged `context="demo"` and switched on by
`spring.liquibase.contexts=demo` in `application.properties`. Remove that line
for a schema-only database.

---

## Try it from the command line

```bash
# Submit — note category and coreValue are both required
curl -X POST http://localhost:8080/api/nominations \
  -H "Content-Type: application/json" \
  -d '{
    "nominatorName": "Sarah Murphy",
    "nominatorEmail": "sarah.murphy@version1.com",
    "nomineeName": "Alex Rivera",
    "nomineeEmail": "alex.rivera@version1.com",
    "practice": "Cloud Engineering",
    "location": "Dublin",
    "category": "PERFORMANCE_AND_EFFICIENCY",
    "coreValue": "NO_EGO",
    "whatText": "Rebuilt the release pipeline over a weekend, cutting a five-day manual process to under four hours.",
    "howText": "No Ego - he gave the credit to the two engineers who tested it, and owned the rollback publicly when an early version broke."
  }'
# Save the "id" from the response.

curl -X POST http://localhost:8080/api/nominations/<id>/approve \
  -H "Content-Type: application/json" \
  -d '{ "coordinatorEmail": "colette.lynch@version1.com", "comment": "Confirmed the figures with the delivery lead." }'

curl http://localhost:8080/api/nominations/<id>/audit-log   # decision, note and both messages
curl http://localhost:8080/api/activity                     # everything, newest first
curl "http://localhost:8080/api/quarters/current?email=sarah.murphy@version1.com"
```

Rules worth poking at:

```bash
# Self-nomination           -> 400 "You can't nominate yourself."
# Second decision           -> 409 "already APPROVED and can't be reviewed again"
# Second nomination, same quarter
#                           -> 409 "You've already submitted your nomination for Q3 2026..."
# Missing category or value -> 400 with the field named
```

### Endpoints

| Method | Path | |
|---|---|---|
| `POST` | `/api/nominations` | Submit |
| `GET` | `/api/nominations` | List (optional `?status=`) |
| `GET` | `/api/nominations/{id}` | One |
| `POST` | `/api/nominations/{id}/approve` | Approve |
| `POST` | `/api/nominations/{id}/reject` | Reject — reason required |
| `POST` | `/api/nominations/{id}/request-resubmission` | Send back — reason required |
| `GET` | `/api/nominations/{id}/audit-log` | History for one nomination |
| `POST` | `/api/nominations/retag` | Force a rule-flag pass |
| `GET` | `/api/activity` | All recorded actions |
| `GET` | `/api/quarters` | Participation per quarter |
| `GET` | `/api/quarters/current?email=` | Quarter status for a person |
| `GET` | `/api/categories` | The five business categories |
| `GET` | `/api/core-values` | The six core values |

---

## Project layout

> For a full walkthrough — every technology, where it is implemented, how it
> works and which file to open for any given change — see
> **[docs/technical-guide.md](docs/technical-guide.md)**.


```
src/main/java/com/version1/recognition/
├── RecognitionApplication.java
├── common/
│   └── GlobalExceptionHandler.java
└── nomination/                       # everything about nominations, in layers
    ├── model/                        # entity, enums, value types (Nomination, Quarter, CoreValue...)
    ├── repository/                   # Spring Data interfaces
    ├── service/                      # submission rules, tagging, completeness
    ├── exception/                    # domain exceptions -> HTTP statuses
    ├── check/                        # the six rules, one class each
    ├── evaluation/                   # AI path: Groq, mock, and the selector between them
    ├── comms/                        # message composition
    └── web/                          # controllers and request/response shapes

src/main/resources/
├── db/changelog/                     # Liquibase migrations
├── prompts/                          # AI prompt, hot-reloaded
└── static/                           # built front end, committed so Maven alone runs it

frontend/                             # React source (Vite)
├── src/
│   ├── main.jsx  App.jsx             # mount point and route dispatch
│   ├── store.jsx                     # one context: persona, data, routing, toasts
│   ├── api.js  constants.js  format.js
│   ├── components/                   # Sidebar, NominationTable, DetailPane, FilterBar, ui
│   └── views/                        # employee, coordinator, and the UI-only screens
└── scripts/                          # headless render checks
```

The front end is **React 18, built with Vite**. It replaced a hand-written
string-rendering front end that had grown to ~2,800 lines in one file, where
every screen re-rendered itself by rebuilding HTML and re-attaching its own
event handlers. The behaviour is identical; the difference is that state now
lives in one place and the screens read it.

**You do not need Node to run this project.** `frontend/` builds into
`src/main/resources/static/`, and that output is committed — so `mvn
spring-boot:run` serves the built front end exactly as before. Node is only
needed to change the front end:

```bash
cd frontend
npm install
npm run build      # writes index.html + assets/ into src/main/resources/static
npm run dev        # optional: Vite dev server on :5173, proxies /api to :8080
```

Two checks run the built bundle headlessly against a running server, which is
how the React conversion was verified screen by screen:

```bash
npm run smoke      # mounts every route as every profile, fails on any render error
npm run check      # asserts role gating, hidden status, the quarter limit, deep links
```

---

## Known gaps

Ordered by how much they matter.

1. **Thin test coverage.** `NominationServiceTest` covers the submission
   rules, and `frontend/scripts/` renders every screen headlessly and asserts
   role gating and the quarter limit. The six checks, the decision workflow and
   the comms templates have no tests at all, and that is where silent breakage
   would land.
2. **No authentication.** The profile switcher changes the view, not access.
   Anyone can call the API as anyone. The quarter limit is re-checked
   server-side against whatever email arrives, so it holds for the identity
   submitted — but that identity is unverified.
3. **No exports.** Reachdesk / Bamboo lists, CSV by category or division, and
   top-N per category are all still to do.
4. **No mail delivery.** Messages are composed, stored and displayed, never
   sent.
5. **Email templates are hardcoded** in `NotificationService`. HR will want to
   reword them without a developer, the way the AI prompt already works.
6. **Reachdesk gift card** on approval — the seam is commented in
   `NominationService.approve()`.
7. **`EmployeeStatusCheck` always passes** — needs an HR source of truth.
8. **No guidelines panel** on the review page, so consistency between
   coordinators rests on habit.
