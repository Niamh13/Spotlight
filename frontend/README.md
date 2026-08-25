# Spotlight front end

React source for the Spotlight interface. Builds into
`../src/main/resources/static/`, which is committed — so **you only need Node if
you are changing the interface**. Everyone else runs `mvn spring-boot:run` and
gets the built version.

For how the whole system fits together, see
[../docs/technical-guide.md](../docs/technical-guide.md).

---

## Commands

```bash
npm install        # once

npm run dev        # dev server on :5173, hot reload, proxies /api to :8080
npm run build      # writes index.html + assets/ into ../src/main/resources/static
npm run preview    # serve the built output locally, to check it before committing

npm run smoke      # renders all 15 routes as all 4 profiles, fails on any error
npm run check      # 26 assertions: role gating, hidden status, quarter limit, deep links
npm run spacing    # finds text that visually collides on any page
```

`spacing` catches a specific bug that is easy to miss by eye: two inline
elements rendered side by side with no whitespace between them, so their text
runs together. It injects the real stylesheet and checks computed styles, and
it ignores anything inside a flex or grid parent where a `gap` already
separates them. That is how `.tl-what` / `.tl-why` on the Activity Log were
found — both were `<span>`s with no `display: block`, so the action, the
attribution and the reason all ran onto one line.

All three need the Spring app running on `:8080` — they run the **real
built bundle** in a headless browser, so they test what actually ships rather
than the source.

**Always run `npm run build` and commit the output before pushing**, or
teammates pull source changes with the old interface still attached.

---

## Dependencies, and why each one is here

We kept this list deliberately short. No router library, no state library, no
component library, no CSS framework — the app is small enough that hash routing
and one React context are less code than the libraries that would replace them.

### Runtime — ships in the bundle

| Package | Why it's here |
|---|---|
| `react` | The UI library itself. Replaced ~2,800 lines of hand-written string-rendering, where every screen rebuilt its own HTML and re-attached its own event handlers |
| `react-dom` | Renders React to the browser. Separate package because React itself is renderer-agnostic; `createRoot` in `src/main.jsx` comes from here |

That is the entire runtime dependency list. Two packages.

### Build — never ships

| Package | Why it's here |
|---|---|
| `vite` | Turns JSX into browser JavaScript and bundles it. Also gives the dev server its hot reload. Configured in `vite.config.js` to write straight into Spring's static folder |
| `@vitejs/plugin-react` | Teaches Vite to read JSX and enables fast refresh. Vite doesn't handle React syntax on its own |
| `jsdom` | A browser DOM implemented in Node, so `scripts/smoke.mjs` and `scripts/assert.mjs` can mount the real app and inspect the result without opening a browser. This is what makes "did I break any screen?" answerable in about a minute |

### What we deliberately did *not* add

| Not used | Instead |
|---|---|
| React Router | Hash routing in `src/store.jsx` (~20 lines). Also keeps existing `#/queue?id=…` links working |
| Redux / Zustand | One React context in `src/store.jsx` |
| Tailwind / Bootstrap | `src/app.css`, carried over unchanged from the previous interface |
| A component library | `src/components/ui.jsx` — Avatar, Pill, Kpi and friends, about 180 lines total |
| Axios | The browser's own `fetch`, wrapped once in `src/api.js` |

---

## Layout

```
src/
├── main.jsx          Mounts React onto <div id="root">
├── App.jsx           Route table, role gating, toast host
├── store.jsx         THE state: persona, server data, routing, theme, toasts
├── api.js            Every fetch call, in one place
├── constants.js      Personas, routes, statuses, colours
├── format.js         Dates, initials, labels
├── app.css           All styling
├── components/       Sidebar, NominationTable, DetailPane, FilterBar, ui
└── views/
    ├── employee.jsx     Home, Submit, My Recognition, Star Awards
    ├── coordinator.jsx  Review Queue, AI Summary, Quarters, Activity, Dashboard
    └── shell.jsx        Praises, MtM, Reports, Help — screens with no backend
```

`public/spotlight-logo.png` is copied to the output untouched.
`index.html` is the page template — Vite injects the bundle tags into it.
