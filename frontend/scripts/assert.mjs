/* Behaviour assertions on the built bundle: role gating, hidden status for
   employees, the quarter limit, and that each screen actually shows its own
   content rather than a blank frame. */
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

const code = fs.readFileSync(findBundle(process.argv[2]), "utf8");
const ORIGIN = "http://localhost:8080";
let failed = 0;

async function render(persona, route) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`,
    { url: ORIGIN + "/#/" + route, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem("v1r.persona", persona);
  w.fetch = (u, o) => fetch(String(u).startsWith("http") ? u : ORIGIN + u, o);
  w.console.error = () => {};
  w.eval(code);
  await new Promise((r) => setTimeout(r, 1200));
  const out = { html: w.document.body.innerHTML, text: w.document.body.textContent,
                hash: w.location.hash };
  dom.window.close();
  return out;
}

function check(name, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + name);
  if (!cond) failed++;
}

const empQueue = await render("sarah", "queue");
check("employee on #/queue is redirected home", empQueue.hash === "#/home");
check("employee never sees the Review Queue nav link", !empQueue.html.includes('href="#/queue"'));

const empStars = await render("sarah", "stars");
check("Star Awards renders for an employee", empStars.text.includes("Star Awards"));
check("employee sees no status pills on Star Awards", !/class="pill /.test(empStars.html));
check("employee sees no AI score column", !empStars.text.includes("/100"));

const empMine = await render("calvin", "mine");
check("My Recognition renders", empMine.text.includes("My Recognition") ||
                                empMine.text.includes("Recognition"));
check("employee sees no status pills on My Recognition", !/class="pill /.test(empMine.html));

const empSubmit = await render("calvin", "submit");
check("Calvin has used his quarter slot and is blocked from submitting",
      /already|used|one nomination/i.test(empSubmit.text));
const freeSubmit = await render("sarah", "submit");
check("Sarah still has her slot and gets the form", freeSubmit.html.includes("<textarea"));
// Stronger than a readonly input: the nominator is rendered as text, so there
// is no field to edit in the first place.
check("nominator identity is shown as locked text", freeSubmit.html.includes("lockedfields"));
check("nominator name is not an editable input",
      !new RegExp('<input[^>]*value="Sarah Murphy"').test(freeSubmit.html));
check("nominator email is not an editable input",
      !new RegExp('<input[^>]*value="sarah.murphy@version1.com"').test(freeSubmit.html));

const coQueue = await render("colette", "queue");
check("coordinator gets the Review Queue", coQueue.text.includes("Review Queue"));
check("coordinator sees status pills", /class="pill /.test(coQueue.html));
check("queue defaults to every item, not just pending", coQueue.text.includes("All nominations"));
check("queue has the filter bar", coQueue.html.includes("filterbar"));
check("queue has the compare tick column", coQueue.html.includes("rowtick"));

const coAi = await render("colette", "ai");
check("AI screen is titled AI Summary", coAi.text.includes("AI Summary"));
check("AI screen deep-links into the queue", coAi.html.includes('href="#/queue?id='));

const coQuarters = await render("colette", "quarters");
check("Quarters lists past quarters", coQuarters.html.includes("quartercard"));

const coActivity = await render("colette", "activity");
check("Activity log renders entries", coActivity.html.includes("timeline"));

const coDash = await render("colette", "dashboard");
check("Dashboard draws the trend chart", coDash.html.includes("chart-svg"));

const deep = await render("colette", "queue?id=a1000001-0000-4000-8000-000000000001");
check("deep link opens that nomination's detail pane", deep.html.includes("actionbar"));

const help = await render("calvin", "help");
check("Help renders its guidelines", help.text.includes("core values"));
check("Help ampersand is not double-escaped", !help.text.includes("&amp;"));

const logo = await render("calvin", "home");
check("logo image is present", logo.html.includes("spotlight-logo.png"));

console.log(failed ? "\n" + failed + " FAILED" : "\nall assertions passed");
process.exit(failed ? 1 : 0);
