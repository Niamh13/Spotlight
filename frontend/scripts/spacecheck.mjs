/* Finds text that visually collides: two inline siblings with no whitespace
   between them, inside a parent that is NOT a flex/grid container (where a gap
   would separate them anyway). The real stylesheet is injected so
   getComputedStyle reflects what the browser would actually do. */
import { JSDOM } from "jsdom";
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../../src/main/resources/static/assets/", import.meta.url));
const code = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith(".js"))), "utf8");
const css  = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith(".css"))), "utf8");
const ORIGIN = "http://localhost:8080";

const ROUTES = ["home","submit","mine","stars","praises","praises/new","mtm","mtm/new",
                "queue","ai","quarters","activity","dashboard","reports","help"];
const INLINE = new Set(["SPAN","B","I","EM","STRONG","A","CODE","SMALL"]);

let hits = 0;
async function check(persona, route) {
  const dom = new JSDOM(
    `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div></body></html>`,
    { url: ORIGIN + "/#/" + route, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.localStorage.setItem("v1r.persona", persona);
  w.fetch = (u,o) => fetch(String(u).startsWith("http") ? u : ORIGIN + u, o);
  w.console.error = () => {};
  w.eval(code);
  await new Promise(r => setTimeout(r, 1400));

  // jsdom's getComputedStyle ignores combinator selectors (".a > b"), so fall
  // back to matching the element against every flex/grid rule in the sheet.
  const flexSelectors = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (/display\s*:\s*(flex|grid|inline-flex|inline-grid)/.test(m[2])) {
      for (const sel of m[1].split(",")) {
        const t = sel.trim();
        if (t && !t.includes("@") && !t.includes("::")) flexSelectors.push(t);
      }
    }
  }
  const isFlex = n => {
    try { if (/flex|grid/.test(w.getComputedStyle(n).display || "")) return true; } catch {}
    try { if (/flex|grid/.test(n.style?.display || "")) return true; } catch {}
    return flexSelectors.some(sel => { try { return n.matches(sel); } catch { return false; } });
  };
  const disp = n => { try { return w.getComputedStyle(n).display || ""; } catch { return ""; } };

  for (const el of w.document.querySelectorAll("*")) {
    const pd = disp(el);
    if (isFlex(el)) continue;                          // a gap separates the children
    const kids = [...el.childNodes];
    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i], b = kids[i+1];
      if (a.nodeType !== 1 || b.nodeType !== 1) continue;
      if (!INLINE.has(a.tagName) || !INLINE.has(b.tagName)) continue;
      if (/block|flex|grid|list-item/.test(disp(a)) || /block|flex|grid|list-item/.test(disp(b))) continue;
      const ta = a.textContent || "", tb = b.textContent || "";
      if (!ta.trim() || !tb.trim()) continue;
      if (/\s$/.test(ta) || /^\s/.test(tb)) continue;   // whitespace already present
      const join = ta.trim().slice(-1) + tb.trim().slice(0,1);
      if (/[a-z0-9),.][A-Za-z0-9(]/.test(join)) {
        hits++;
        console.log(`FAIL ${persona} #/${route}  parent<${el.tagName} display:${pd||"?"}>`);
        console.log(`      ...${ta.trim().slice(-30)}|${tb.trim().slice(0,30)}...`);
      }
    }
  }
  dom.window.close();
}

for (const p of ["colette","calvin"]) for (const r of ROUTES) await check(p, r);
console.log(hits ? `\n${hits} real collision(s)` : "\nPASS - no colliding text on any page, for either role");
