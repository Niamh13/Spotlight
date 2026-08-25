# Spotlight — Technical Guide

Everything in this project: what each technology does, where it lives, and
which file to open when you want to change something.

Read this top to bottom once, then use it as a lookup table.

---

## Contents

1. [The one-paragraph version](#1-the-one-paragraph-version)
2. [Technologies used, and why](#2-technologies-used-and-why)
3. [Project structure — where everything is](#3-project-structure--where-everything-is)
4. [How a nomination flows through the system](#4-how-a-nomination-flows-through-the-system)
5. [The back end, layer by layer](#5-the-back-end-layer-by-layer)
6. [The front end, layer by layer](#6-the-front-end-layer-by-layer)
7. [The database](#7-the-database)
8. [The AI](#8-the-ai)
9. [The rules engine (six checks)](#9-the-rules-engine-six-checks)
10. [The API reference](#10-the-api-reference)
11. [Running, building and testing](#11-running-building-and-testing)
12. [Common tasks — "I want to change X"](#12-common-tasks--i-want-to-change-x)
13. [What is not built](#13-what-is-not-built)

---

## 1. The one-paragraph version

Spotlight is a **Spring Boot** web application with a **React** front end.
An employee submits a Star Award nomination; the server validates it, runs six
deterministic rules over it, asks a language model how *reviewable* it is, and
stores the result. An HR coordinator reads the queue, approves, rejects or
sends it back, and every decision is written to an audit log along with the
full text of the emails it generated. Data lives in **MySQL** with the schema
managed by **Liquibase**, so every machine ends up with identical tables from
the same migrations.

---

## 2. Technologies used, and why

| Technology | Version | What it does here | Where to look |
|---|---|---|---|
| **Java** | 17 | Language for the whole back end | `src/main/java/` |
| **Spring Boot** | 3.3.0 | Wires everything together: HTTP server, dependency injection, configuration | `pom.xml`, `RecognitionApplication.java` |
| **Spring Web (MVC)** | starter | Turns Java classes into a REST API with annotations | `nomination/web/` |
| **Spring Data JPA** | starter | Database access without writing SQL — you declare an interface, Spring writes the query | `nomination/repository/` |
| **Hibernate** | via JPA | The engine underneath JPA that maps Java objects to database rows | `nomination/model/Nomination.java` |
| **Bean Validation** | starter | `@NotBlank`, `@Email` etc. on incoming requests, checked before your code runs | `nomination/web/NominationRequest.java` |
| **MySQL** | 8 | The database. A shared server the team points at, rather than a file on one laptop | `application.properties` |
| **mysql-connector-j** | runtime | The JDBC driver. Runtime scope because no code imports it — only the connection string names it | `pom.xml` |
| **Liquibase** | core | Version control for the database schema — 11 numbered migrations | `src/main/resources/db/changelog/` |
| **spring-dotenv** | 4.0.0 | Reads a gitignored `.env` file at startup so the API key never enters the repo | `pom.xml`, `.env.example` |
| **Spring Actuator** | starter | Health endpoint (`/actuator/health`) | configured by default |
| **Groq API** | `openai/gpt-oss-20b` | The language model that scores nominations | `nomination/evaluation/GroqNominationEvaluator.java` |
| **React** | 18.3.1 | The entire user interface | `frontend/src/` |
| **Vite** | 5.4 | Builds the React source into plain JS/CSS the server can serve | `frontend/vite.config.js` |
| **JUnit 5 + Mockito** | starter-test | Unit tests for the submission rules | `src/test/java/` |
| **jsdom** | dev only | Runs the built front end headlessly so every screen can be checked without a browser | `frontend/scripts/` |
| **Maven** | wrapper 3.9.11 | Builds and runs the Java side. `mvnw` means nobody needs Maven installed | `pom.xml`, `mvnw` |

### Two version pins worth knowing

**`byte-buddy.version` = 1.17.5** in `pom.xml`. Spring Boot 3.3.0 pins an older
Byte Buddy that cannot instrument classes on JDK 26, so every Mockito test
fails before a single assertion. The override changes nothing about the code —
it just lets the tests run on a modern JDK.

**`spring-dotenv`** is a third-party library (`me.paulschwarz`), not part of
Spring. Spring Boot has no native `.env` support because it isn't a Node app.
This adds it, so a secret can sit in a gitignored file beside the project
rather than in a machine-level environment variable.

---

## 3. Project structure — where everything is

```
recognition-platform/
│
├── README.md                    Setup, what's built, known gaps
├── pom.xml                      Java dependencies and build config
├── mvnw / mvnw.cmd / .mvn/      Maven wrapper — run without installing Maven
├── .env                         YOUR Groq key. Gitignored, never committed
├── .env.example                 Template showing what goes in .env
├── .gitignore
│
├── data/                        Leftover H2 files from before MySQL. Safe to delete
├── docs/
│   ├── technical-guide.md       ← you are here
│   └── ai-bias-fairness-oversight.md
│
├── .github/workflows/           CI
│
├── src/main/java/com/version1/recognition/
│   ├── RecognitionApplication.java      Entry point (main method)
│   ├── common/
│   │   └── GlobalExceptionHandler.java  Turns exceptions into HTTP responses
│   └── nomination/                      Everything about nominations
│       ├── model/          The data: entity, enums, value types      (11 files)
│       ├── repository/     Database access interfaces                 (2 files)
│       ├── service/        Business rules and orchestration            (5 files)
│       ├── exception/      Domain exceptions                           (3 files)
│       ├── check/          The six rules, one class each               (7 files)
│       ├── evaluation/     AI: Groq, mock, and the selector            (8 files)
│       ├── comms/          Email composition                           (2 files)
│       └── web/            Controllers and request/response shapes    (11 files)
│
├── src/main/resources/
│   ├── application.properties           All configuration
│   ├── db/changelog/                    11 Liquibase migrations
│   ├── prompts/
│   │   └── nomination-evaluation-v1.txt The AI prompt — edit and reload live
│   └── static/                          BUILT front end (committed)
│       ├── index.html
│       ├── assets/app-<hash>.js         The React bundle
│       ├── assets/app-<hash>.css
│       └── spotlight-logo.png
│
├── src/test/java/.../nomination/service/
│   └── NominationServiceTest.java
│
└── frontend/                    React SOURCE (needs Node only to rebuild)
    ├── package.json             npm scripts and dependencies
    ├── vite.config.js           Build config — output goes into static/
    ├── index.html               Page template — Vite injects the bundle tags
    ├── public/spotlight-logo.png
    ├── scripts/
    │   ├── smoke.mjs            Renders every screen, fails on any error
    │   └── assert.mjs           Asserts specific behaviour
    └── src/
        ├── main.jsx             Mounts React onto the page
        ├── App.jsx              Route table, role gating, toasts
        ├── store.jsx            THE state — persona, data, routing, theme
        ├── api.js               Every fetch call
        ├── constants.js         Personas, routes, statuses, colours
        ├── format.js            Date and name formatting
        ├── app.css              All styling
        ├── components/          Reusable pieces
        └── views/               One file per group of screens
```

### The two `static/` folders — don't get confused

- `frontend/` is the **source**. You edit here.
- `src/main/resources/static/` is the **build output**. Vite writes it. Never
  edit it by hand — the next build overwrites it.

The build output is **committed on purpose**, so anyone can clone this and run
`mvn spring-boot:run` with no Node installed.

---

## 4. How a nomination flows through the system

Follow one nomination from click to database. Each step names the file.

```
 1. Employee fills the form            frontend/src/views/employee.jsx  (Submit)
 2. POST /api/nominations              frontend/src/api.js
 3. Field validation (@NotBlank etc.)  nomination/web/NominationRequest.java
 4. Controller receives it             nomination/web/NominationController.java
 5. Business rules run:                nomination/service/NominationService.java
       · can't nominate yourself                      → 400
       · one nomination per person per quarter        → 409
       · a revision must attach to a real original    → 409
       · core value detected from the HOW text        model/CoreValue.detectIn()
 6. Saved as PENDING_REVIEW            nomination/repository/NominationRepository
 7. Six rules tag it                   nomination/service/TaggingService.java
 8. AI scores it                       nomination/evaluation/EvaluatorSelector
 9. Coordinator opens the queue        frontend/src/views/coordinator.jsx
10. Approve / reject / send back       nomination/service/NominationService.java
11. Emails composed (not sent)         nomination/comms/NotificationService.java
12. Audit entry written                model/AuditLogEntry.java
13. Front end refetches and redraws    frontend/src/store.jsx
```

**Step 5 is where the interesting logic lives.** If something about submission
behaves unexpectedly, open `NominationService.submit()` — it is about 100 lines
and reads top to bottom.

---

## 5. The back end, layer by layer

The `nomination` package is split into layers. Each layer only knows about the
ones below it: **web → service → repository → model**.

### `model/` — the data

| File | What it is |
|---|---|
| `Nomination.java` | The entity. One row in the `nominations` table. Every field on a nomination |
| `NominationStatus.java` | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `NEEDS_RESUBMISSION` |
| `AwardCategory.java` | The five business categories, each with a label and the evidence it expects |
| `CoreValue.java` | Version 1's six values, each with keywords. `detectIn(text)` reads the value back out of what someone wrote |
| `Quarter.java` | One definition of "which quarter", used by five different features. Also computes the submission deadline |
| `NominationFlag.java` | A single flag on a nomination — which flag, why, and whether a rule or the AI raised it |
| `AiFlag.java` | The flag types |
| `FlagSource.java` | `RULE` or `AI` — a string match and a model's opinion deserve different trust |
| `AuditLogEntry.java` | One recorded action: who, what, when, why |
| `AuditAction.java` | `APPROVED`, `REJECTED`, `RESUBMISSION_REQUESTED` |
| `SentComm.java` | The full text of one generated message, stored verbatim |

**Why `Quarter` is its own class:** the quarter question is asked by the
submission limit, the deadline countdown, the quarters view, the repeat check
and the notification. One class means one answer.

**Why `SentComm` stores full text:** templates get reworded. A record that
changes to match today's wording is not a record.

### `repository/` — database access

| File | What it does |
|---|---|
| `NominationRepository.java` | Spring Data JPA interface. You declare method names, Spring writes the SQL |
| `AuditLogRepository.java` | Same, for the audit log |

There is no SQL in this project outside the Liquibase migrations. A method
named `findByNominatorEmailIgnoreCase` becomes a query automatically.

### `service/` — the rules

| File | Lines | What it does |
|---|---|---|
| `NominationService.java` | 410 | **The core.** Submission rules, approve/reject/send-back, the quarter limit |
| `TaggingService.java` | 108 | Runs every check bean over a nomination and stores the flags |
| `CompletenessService.java` | 138 | Scores a nomination against six criteria and drafts a send-back message |
| `CompletenessCriterion.java` | 62 | The six criteria as an enum |
| `TaggingStartupRunner.java` | 51 | Re-tags everything once at startup so seed data has flags |

### `exception/` — what can go wrong

`SelfNominationException` (→ 400), `QuarterLimitReachedException` (→ 409),
`InvalidReviewStateException` (→ 409). They become HTTP responses in
`common/GlobalExceptionHandler.java`.

### `web/` — the HTTP layer

Controllers are deliberately thin: receive, delegate to a service, return.

| File | Serves |
|---|---|
| `NominationController.java` | `/api/nominations/**` — submit, list, get, approve, reject, send back |
| `QuarterController.java` | `/api/quarters/**` — current quarter and history |
| `ActivityController.java` | `/api/activity` — the audit log |
| `CategoryController.java` | `/api/categories` |
| `CoreValueController.java` | `/api/core-values` |
| `NominationRequest.java` | What comes **in** on a submission, with validation annotations |
| `NominationResponse.java` | What goes **out** — the entity reshaped for the browser |
| `ApproveRequest` | Approve payload: coordinator email + optional comment |
| `ReviewDecisionRequest` | Reject / send-back payload: coordinator email + **required reason** + optional comment |
| `AuditLogEntryResponse` / `NominationFlagResponse` | Nested response shapes |

**Why separate request/response classes rather than returning the entity:**
the entity has fields the browser has no business seeing, and changing a
database column shouldn't silently change the API.

---

## 6. The front end, layer by layer

React with no router library and no state library — the app is small enough
that hash routing and one context are simpler than the alternatives.

### The four files that matter most

**`main.jsx`** — three lines of real work. Finds `<div id="root">`, wraps the
app in the store, renders.

**`store.jsx`** — **the single source of truth.** Everything shared lives here:

| What it holds | Notes |
|---|---|
| `persona`, `isCoordinator`, `switchPersona` | Who you are viewing as. Saved to `localStorage` |
| `nominations`, `categories`, `coreValues`, `quarter`, `quarterHistory`, `activity` | All server data, fetched once at boot |
| `loadNominations()` etc. | Refetch after anything changes |
| `route`, `query`, `allowedRoutes`, `routeAllowed()` | Hash routing. `#/queue?id=123` → route `queue`, query `{id: "123"}` |
| `toasts`, `toast()`, `dismissToast()` | The notification popups |
| `useTheme()` | Light / dark / auto plus independent greyscale |

**`App.jsx`** — maps a route string to a view component, blocks routes the
current role isn't allowed, renders the toast host.

**`api.js`** — every network call in one place. Errors carry `err.body`, because
the server puts the useful part there (which field failed, or why the quarter
limit fired).

### `components/` — reusable pieces

| File | What it is |
|---|---|
| `Sidebar.jsx` | Logo, navigation, theme controls, profile switcher |
| `NominationTable.jsx` | The table. Status and AI columns render **only for coordinators** |
| `DetailPane.jsx` | The expanded nomination: AI panel, email blocks, audit history, completeness, decision buttons |
| `FilterBar.jsx` | Filters by name/category/practice/location, plus the side-by-side comparison box |
| `ui.jsx` | Small shared pieces — Avatar, Pill, Kpi, PageHead, FlagList, tags, Empty |

### `views/` — the screens

| File | Screens |
|---|---|
| `employee.jsx` | Home, Submit, My Recognition, Star Awards |
| `coordinator.jsx` | Review Queue, AI Summary, Quarters, Activity Log, Dashboard |
| `shell.jsx` | Praises, Send a Praise, Moments that Matter, Request MtM, Reports, Help |

Everything in `shell.jsx` is **screen only** — no backend behind it. Each of
those screens says so on the page rather than pretending the buttons work.

### The 15 routes and who sees them

| Route | Screen | Employee | Coordinator |
|---|---|:---:|:---:|
| `#/home` | Home | ✓ | ✓ |
| `#/submit` | Submit Recognition | ✓ | ✓ |
| `#/mine` | My Recognition | ✓ | — |
| `#/stars` | Star Awards | ✓ | ✓ |
| `#/praises`, `#/praises/new` | Praises Wall | ✓ | ✓ |
| `#/mtm`, `#/mtm/new` | Moments that Matter | ✓ | ✓ |
| `#/help` | Help & Guidelines | ✓ | ✓ |
| `#/queue` | Review Queue | — | ✓ |
| `#/ai` | AI Summary | — | ✓ |
| `#/quarters` | Quarters | — | ✓ |
| `#/activity` | Activity Log | — | ✓ |
| `#/dashboard` | Dashboard | — | ✓ |
| `#/reports` | Reports | — | ✓ |

An employee who types a coordinator URL is redirected to Home — see the
`useEffect` in `App.jsx`.

### Employees never see review status

Status pills and AI scores are hidden from employees on **every** screen. That
is enforced in one place — `NominationTable.jsx` checks `isCoordinator` before
rendering those columns. Employees are told the outcome by email; showing a
live "pending review" invites people to watch the queue.

### Why the bundle filename has a hash

`assets/app-C68192t3.js`. Change any source file and the hash changes, so the
URL changes, so no browser can serve a stale copy. The previous front end used
a hand-edited `?v=` token that had to be remembered on every change — and when
it was missed, people saw an old page and concluded the change hadn't worked.

---

## 7. The database

### MySQL

A MySQL 8 server, schema `recognitiondb`. It replaced an H2 file database —
which worked, but the data only ever existed on whichever laptop ran it, so
"it works on mine" was unanswerable and there was nothing to point a shared
environment at.

**You do not create the database.** The connection string carries
`createDatabaseIfNotExist=true`, so the server makes an empty schema on first
connection and Liquibase builds the tables inside it, seed data included.

Credentials come from `.env` (gitignored), read at startup by `spring-dotenv`:

```
MYSQL_USERNAME=root
MYSQL_PASSWORD=your_password
```

The committed defaults in `application.properties` are deliberately useless, so
a real password cannot reach the repository by accident. This repository is
public.

Browse the data with **MySQL Workbench** — connect to `localhost:3306`, schema
`recognitiondb`.

**To reset:** `DROP DATABASE recognitiondb;` then restart. Liquibase rebuilds
everything from the migrations.

### Why the migrations did not need changing

All 11 changelogs moved from H2 to MySQL untouched. They are declarative
Liquibase changeSets — `type="UUID"`, `type="CLOB"`, `type="VARCHAR(255)"` —
and Liquibase maps each to whatever the target database calls it (`UUID`
becomes `CHAR(36)` on MySQL). The one raw `<sql>` block, in `010`, is a plain
`INSERT … SELECT` that both databases understand.

That portability is the whole argument for having used Liquibase rather than
`ddl-auto=update` from the start.

### Liquibase

The schema is defined by 11 numbered XML files, applied in order, each recorded
so it never runs twice.

| # | File | What it does |
|---|---|---|
| 001 | create-nominations-table | The main table |
| 002 | create-nomination-ai-flags-table | Flags |
| 003 | create-nomination-audit-log-table | Audit log |
| 004 | add-ai-evaluation-columns | Score, rationale, status |
| 005 | **seed-demo-nominations** | The demo data |
| 006 | add-flag-source-and-reason | `RULE` vs `AI`, plus the reason text |
| 007 | add-award-category | The five categories |
| 008 | add-audit-comment-and-email | Internal notes and coordinator identity |
| 009 | rebalance-demo-quarters | Spread demo data across two quarters |
| 010 | audit-comms-table | Stored message text |
| 011 | add-core-value | The six core values |

Master list: `db/changelog/db.changelog-master.xml`.

**Seed data is tagged `context="demo"`** and loaded because
`application.properties` sets `spring.liquibase.contexts=demo`. Remove that
line and you get the same schema with an empty database.

**`spring.jpa.hibernate.ddl-auto=validate`** means Hibernate will *check* that
the Java entity matches the tables and refuse to start if it doesn't — but it
will never alter the schema itself. Liquibase owns the schema; Hibernate only
verifies. If you add a field to `Nomination.java` and skip the migration, the
app fails to start, loudly, which is the point.

### The demo data

13 nominations across two quarters covering every status, all six core values,
the five categories, and each AI outcome. Deliberate: an empty dashboard looks
identical to a broken one.

Four profiles in the switcher (bottom-left):

| Profile | Role | State |
|---|---|---|
| Sarah Murphy | Employee | Has **not** nominated this quarter — use this to test the form |
| Calvin Ho | Employee | Already nominated (pending) |
| Jamie Doyle | Employee | Sent back for more detail |
| Colette Lynch | Admin / HR | Coordinator |

Defined in `frontend/src/constants.js`.

---

## 8. The AI

### What it actually does

It scores how **reviewable** a nomination is, out of 100, with a rationale
written for the coordinator. It is **advisory only** — it never approves or
rejects anything, and it is never shown to employees.

### The three-class design

```
NominationEvaluator            (interface — the contract)
├── GroqNominationEvaluator    calls the real model over HTTP
└── MockNominationEvaluator    rule-of-thumb scoring, no network

EvaluatorSelector              picks one at startup and says which in the log
```

`ai.evaluator=auto` in `application.properties` means: use Groq if a key is
present, otherwise the mock. **A fresh clone runs end to end with no key** and
still produces scores, rationales and flags. The startup log tells you which:

```
AI evaluator: mock (rule-of-thumb, no network) - no GROQ_API_KEY set [ai.evaluator=auto]
AI evaluator: Groq (live model) [ai.evaluator=auto]
```

### The prompt is hot-reloaded

`src/main/resources/prompts/nomination-evaluation-v1.txt` is **re-read on every
evaluation**. Edit it, submit a nomination, see the change — no rebuild, no
restart. Controlled by `ai.prompt.file`. If that path isn't readable the
packaged copy on the classpath is used, so a real deployment works untouched.

### Two settings that matter

In `GroqNominationEvaluator.java`:

- **`max_tokens = 1500`.** The model spends reasoning tokens before writing
  anything. At 300 it burned the whole budget thinking and returned empty
  content with `finish_reason: "length"`.
- **`reasoning_effort = "low"`.** Same problem from the other direction.

### When the AI can't answer

If the model returns prose instead of a score — which it does when it objects
to the content of a nomination — `AiEvaluationException` is thrown and the
nomination is stored as **unavailable**, not as a completed evaluation with a
null score. Those appear in the "Not scored" section of the AI Summary screen
so a human knows to read them by hand.

### Getting a key

The key is **not in the repository and never will be** — `.env` is gitignored.
Sign up at console.groq.com (free, no card), create a key, and put it in a
`.env` file beside `pom.xml`:

```
GROQ_API_KEY=gsk_your_key_here
```

`.env.example` shows the format. Without it, the mock runs and everything works.

---

## 9. The rules engine (six checks)

### The pattern

```java
public interface NominationCheck {
    AiFlag flag();                                    // which flag this raises
    Optional<String> evaluate(Nomination n,           // why it was raised,
                              List<Nomination> all);  // or empty if it passes
}
```

Two methods and nothing else. A check knows nothing about the other checks or
about how it gets run — it answers one question and explains itself.

Six classes implement it, each annotated `@Component` with an `@Order`.
`TaggingService` collects **every** `NominationCheck` bean Spring finds and runs
them all. Adding a seventh rule means adding one class — and editing nothing
else. That is the point of the pattern.

The `allNominations` argument is there for the rules that need context ("did
these two nominate each other?"). Implementations skip the nomination itself.

| Check | Catches |
|---|---|
| `SelfNominationCheck` | Nominator and nominee are the same person |
| `ReciprocalNominationCheck` | The two have nominated each other |
| `RepeatNominationCheck` | Same nominee was also nominated last quarter |
| `WeakJustificationCheck` | Thin on 2 of 3 signals: too short, no figures, HOW doesn't connect to the value |
| `RoutineLanguageCheck` | Describes routine duties or generic praise |
| `EmployeeStatusCheck` | **Placeholder — always passes.** Needs an HR feed that doesn't exist |

**None of these use AI.** String matching, email comparison and date
arithmetic — cheap, deterministic, and still working when the model is
unavailable.

### Why a submission re-tags everything

Reciprocal and repeat depend on the *other* rows on record. If B nominates A
back, only B's record would be flagged and A's would stay clean. So a
submission re-tags the whole table. Re-tagging replaces rule flags and
preserves AI ones, which cannot be regenerated.

**Known issue:** `retagAll()` is O(n²) — every nomination is compared against
every other. Fine at 13 rows, not fine at 10,000. It is documented in the code.

### Completeness vs flags — two different questions

- **Flags** say *something looks off about this*.
- **Completeness** (`CompletenessService`) says *can this be judged at all?*

Completeness scores six criteria — `WHAT_HAS_DETAIL`, `WHAT_HAS_IMPACT`,
`HOW_HAS_DETAIL`, `HOW_NAMES_VALUE`, `CATEGORY_SELECTED`, `NOT_ROUTINE_LANGUAGE` —
and drafts a send-back message naming exactly what is missing. The coordinator
can use it as written or edit it.

It is about **reviewability, not merit**: passing means the nomination can be
judged, not that it should be approved.

---

## 10. The API reference

Everything returns JSON. There is **no authentication** — see [What is not
built](#13-what-is-not-built).

### Nominations

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/nominations` | List all. Optional `?status=PENDING_REVIEW` |
| `GET` | `/api/nominations/{id}` | One nomination |
| `POST` | `/api/nominations` | Submit. Body: `NominationRequest` |
| `POST` | `/api/nominations/{id}/approve` | Approve. No reason needed; optional internal comment |
| `POST` | `/api/nominations/{id}/reject` | Reject. **Reason required** |
| `POST` | `/api/nominations/{id}/request-resubmission` | Send back. **Reason required** |
| `GET` | `/api/nominations/{id}/audit-log` | Decision history with message text |
| `GET` | `/api/nominations/{id}/completeness` | Six criteria + a drafted send-back message |
| `POST` | `/api/nominations/retag` | Re-run every rule over every nomination |

### Reference data and views

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/categories` | The five business categories |
| `GET` | `/api/core-values` | The six core values |
| `GET` | `/api/activity` | Full audit log, newest first |
| `GET` | `/api/quarters` | Participation per quarter |
| `GET` | `/api/quarters/current?email=` | Whether **this person** can still nominate |
| `GET` | `/api/quarters/now` | The current quarter |

### Error responses

Handled centrally in `common/GlobalExceptionHandler.java`.

| Status | When | Body |
|---|---|---|
| `400` | A field failed validation | `{"fieldName": "message", ...}` |
| `400` | Self-nomination | `{"error": "..."}` |
| `404` | Unknown id | `{"error": "..."}` |
| `409` | Already nominated this quarter | `{"error": "...", "reason": "QUARTER_LIMIT", "quarter": "Q3 2026"}` |
| `409` | Already decided | `{"error": "..."}` |

The `reason: "QUARTER_LIMIT"` marker is why the front end can show a specific
"you've used your nomination" panel instead of a generic error — see the
`.catch` in `views/employee.jsx`.

---

## 11. Running, building and testing

### Just run it

```bash
mvn spring-boot:run
```

Needs a JDK 17+ and a **MySQL 8 server**. Copy `.env.example` to `.env` and
put your MySQL credentials in it first — the app will not start without a
reachable server. No Node, no API key. Then open **http://localhost:8080**.

### Java tests

```bash
mvn test
```

`NominationServiceTest` covers the submission rules with mocked repositories.

### Changing the front end

Only this needs Node.

```bash
cd frontend
npm install

npm run build      # writes index.html + assets/ into src/main/resources/static
npm run dev        # dev server on :5173 with hot reload, proxies /api to :8080
```

`npm run dev` is the fast loop while designing. `npm run build` is what you
must run — and **commit** — before pushing, or teammates get the old interface.

### Front-end checks

Both need the app running on :8080.

```bash
npm run smoke      # mounts all 15 routes × 4 profiles, fails on any render error
npm run check      # 26 assertions: role gating, hidden status, quarter limit, deep links
```

These run the **real built bundle** in jsdom, not the source — so they test
what actually ships.

### If a change doesn't appear in the browser

Check you ran `npm run build`. The server serves `src/main/resources/static/`,
not `frontend/`.

---

## 12. Common tasks — "I want to change X"

| I want to… | Open |
|---|---|
| Change the submission form | `frontend/src/views/employee.jsx` |
| Change the review queue | `frontend/src/views/coordinator.jsx` |
| Change colours, spacing, anything visual | `frontend/src/app.css` |
| Add or rename a screen | `frontend/src/constants.js` (ROUTES) + `App.jsx` |
| Change who sees what | `ROUTES[].roles` in `constants.js` |
| Add a profile to the switcher | `PERSONAS` in `constants.js` |
| Change what the AI is asked | `src/main/resources/prompts/nomination-evaluation-v1.txt` |
| Change the AI model or token limits | `evaluation/GroqNominationEvaluator.java` |
| Force the mock AI on | `ai.evaluator=mock` in `application.properties` |
| Add a seventh rule | New class in `check/` implementing `NominationCheck` — nothing else |
| Change the submission rules | `service/NominationService.java`, method `submit()` |
| Change the quarter definition or deadline | `model/Quarter.java` |
| Change the email wording | `comms/NotificationService.java` |
| Add a database column | New file in `db/changelog/` + register it in the master + add the field to `Nomination.java` |
| Reset the database | Delete `data/` and restart |
| Add or change a category | `model/AwardCategory.java` (+ a migration if stored values change) |
| Add or change a core value | `model/CoreValue.java` |
| Change an API response shape | `web/NominationResponse.java` |

---

## 13. What is not built

Being straight about this matters more than the feature list.

1. **No authentication.** The profile switcher changes the view, not access.
   Anyone can call the API as anyone. The quarter limit is re-checked
   server-side against whatever email arrives, so it holds for the identity
   submitted — but that identity is unverified.
2. **No email delivery.** Messages are composed and stored; no mail server is
   configured. "Open in Outlook" hands you a draft. Every screen showing a
   message says so.
3. **No Reachdesk integration.** Gift card fulfilment is manual.
4. **No exports.** Reachdesk / Bamboo lists and CSV by category are still to do.
5. **`EmployeeStatusCheck` always passes.** It needs an HR feed to know whether
   someone is a current employee. The class exists so the rule has somewhere
   to go.
6. **Praises and Moments that Matter are screens only.** No backend at all.
   They are in the navigation because the brief covers the whole recognition
   platform.
7. **`retagAll()` is O(n²).** Fine at demo scale, not at real scale.
8. **Thin test coverage.** The submission rules and the front-end render are
   tested. The six checks, the decision workflow and the comms templates are
   not — and that is where silent breakage would land.

---

## Appendix — configuration reference

Everything in `src/main/resources/application.properties`.

| Setting | Value | Meaning |
|---|---|---|
| `server.port` | `8080` | Where the app listens |
| `spring.datasource.url` | `${MYSQL_URL:jdbc:mysql://localhost:3306/recognitiondb?createDatabaseIfNotExist=true&…}` | `createDatabaseIfNotExist` means nobody has to run `CREATE DATABASE` by hand |
| `spring.datasource.username` | `${MYSQL_USERNAME:root}` | From `.env`. The committed default is deliberately useless |
| `spring.datasource.password` | `${MYSQL_PASSWORD:}` | **Never hardcode.** This repository is public |
| `spring.jpa.hibernate.ddl-auto` | `validate` | Check the schema, never change it |
| `spring.jpa.show-sql` | `true` | Log every query — useful while learning, noisy in production |
| `spring.liquibase.contexts` | `demo` | Load the seed data. Remove for an empty database |

| `ai.evaluator` | `auto` | `auto` \| `groq` \| `mock` |
| `groq.api.key` | `${GROQ_API_KEY:...}` | Read from the environment or `.env`. **Never hardcode** |
| `groq.api.model` | `openai/gpt-oss-20b` | Which model to call |
| `ai.prompt.file` | `src/main/resources/prompts/...` | Hot-reloaded prompt path |
| `spring.web.resources.cache.period` | `0` | `index.html` must never be cached — it is the only file that knows the current bundle's name |
