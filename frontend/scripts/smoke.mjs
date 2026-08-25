/* Mounts the real built bundle in jsdom, once per route and once per persona,
   with fetch pointed at the running server. Any React render error, unhandled
   rejection or console error fails the run. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* The bundle name carries a content hash, so find it rather than hard-coding it. */
function findBundle(explicit) {
  if (explicit) return explicit;
  const dir = fileURLToPath(new URL("../../src/main/resources/static/assets/", import.meta.url));
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".js"));
  if (!file) throw new Error("No built bundle found - run `npm run build` first.");
  return path.join(dir, file);
}

const BUNDLE = findBundle(process.argv[2]);
const ORIGIN = "http://localhost:8080";
const ROUTES = ["home", "submit", "mine", "stars", "praises", "praises/new",
  "mtm", "mtm/new", "queue", "ai", "quarters", "activity", "dashboard",
  "reports", "help"];
const PERSONAS = ["calvin", "jamie", "sarah", "colette"];

const code = fs.readFileSync(BUNDLE, "utf8");
const problems = [];

async function run(persona, route) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="root"></div></body></html>`,
    { url: ORIGIN + "/#/" + route, runScripts: "outside-only", pretendToBeVisual: true }
  );
  const w = dom.window;
  const tag = persona + " #/" + route;

  w.localStorage.setItem("v1r.persona", persona);

  // Relative URLs have no base in jsdom's fetch, so point them at the server.
  w.fetch = (u, o) => fetch(String(u).startsWith("http") ? u : ORIGIN + u, o);
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {} }));

  w.console.error = (...a) => problems.push(tag + " :: console.error :: " + a.join(" "));
  w.addEventListener("error", (e) => problems.push(tag + " :: " + e.message));
  w.addEventListener("unhandledrejection", (e) =>
    problems.push(tag + " :: unhandled :: " + (e.reason && e.reason.message)));

  try {
    w.eval(code);
  } catch (e) {
    problems.push(tag + " :: threw on load :: " + e.message);
    dom.window.close();
    return "";
  }

  // Let the boot fetches settle and the post-load render run.
  await new Promise((r) => setTimeout(r, 1200));
  const text = w.document.getElementById("root").textContent || "";
  if (text.trim().length < 40) problems.push(tag + " :: rendered almost nothing");
  const html = w.document.body.innerHTML;
  dom.window.close();
  return html;
}

for (const p of PERSONAS) {
  for (const r of ROUTES) {
    const html = await run(p, r);
    const ok = html.length > 500;
    console.log((ok ? "ok   " : "FAIL ") + p.padEnd(8) + " #/" + r);
  }
}

if (problems.length) {
  console.log("\n--- problems ---");
  [...new Set(problems)].forEach((p) => console.log(p));
  process.exit(1);
}
console.log("\nno errors");
