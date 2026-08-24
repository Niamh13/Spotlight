/* =====================================================================
   Spotlight — single-page front end for the Star Award platform.

   Two things to know before reading:

   1. There is no authentication in the backend yet. The profile switcher
      is therefore a VIEW switch, not a login: it changes which screens and
      actions this browser shows you, and which email is stamped on
      coordinator decisions. It does not, and cannot, stop anyone calling
      the service directly. Every screen that depends on it says so.

   2. LIVE screens read and write real data. SHELL screens (Praises,
      Moments that Matter, Reports, the dashboard charts) are layout only —
      the backend has no entity behind them — and each is labelled on the
      screen itself so nobody mistakes sample content for real data.
   ===================================================================== */
(function () {
  "use strict";

  var API = "/api/nominations";
  var CATEGORY_API = "/api/categories";
  var CORE_VALUE_API = "/api/core-values";
  var QUARTER_API = "/api/quarters";
  var QUARTER_SEEN_KEY = "v1r.lastQuarter";
  var ACTIVITY_API = "/api/activity";
  var STORE_KEY = "v1r.persona";

  /* -------------------------------------------------------------------
     Who you can be. Two employees rather than one because the interesting
     employee cases differ: Calvin has a single clean nomination in flight,
     Jamie has a rejection and a resubmission, which is what you want to
     look at when checking how bad news reads to the person who gets it.
     ------------------------------------------------------------------- */
  var PERSONAS = [
    { id: "calvin", name: "Calvin Ho", email: "calvin.ho@version1.com",
      role: "EMPLOYEE", title: "Consultant · Data & AI" },
    { id: "jamie", name: "Jamie Doyle", email: "jamie.doyle@version1.com",
      role: "EMPLOYEE", title: "Engineer · Cloud Engineering" },
    // Deliberately has no nomination of her own this quarter, so the submission
    // flow is testable: the other three have all used their slot, and with only
    // them you can never see the form itself, just the "already nominated"
    // panel. She is a nominee in the seed data, so her My Recognition screen
    // also shows the receiving side rather than being empty.
    { id: "sarah", name: "Sarah Murphy", email: "sarah.murphy@version1.com",
      role: "EMPLOYEE", title: "Lead Consultant · Data & AI" },
    { id: "colette", name: "Colette Lynch", email: "colette.lynch@version1.com",
      role: "COORDINATOR", title: "HR · Recognition coordinator" }
  ];

  var ROLE_LABEL = { EMPLOYEE: "Employee", COORDINATOR: "Admin / HR" };

  var ROUTES = [
    { id: "home",      label: "Home",                ic: "⌂", group: "Recognition",  roles: ["EMPLOYEE", "COORDINATOR"] },
    { id: "submit",    label: "Submit Recognition",  ic: "✎", group: "Recognition",  roles: ["EMPLOYEE", "COORDINATOR"] },
    { id: "mine",      label: "My Recognition",      ic: "★", group: "Recognition",  roles: ["EMPLOYEE"] },
    { id: "praises",   label: "Praises Wall",        ic: "♡", group: "Recognition",  roles: ["EMPLOYEE", "COORDINATOR"] },
    { id: "stars",     label: "Star Awards",         ic: "✦", group: "Recognition",  roles: ["EMPLOYEE", "COORDINATOR"] },
    { id: "mtm",       label: "Moments that Matter", ic: "🎁", group: "Recognition", roles: ["EMPLOYEE", "COORDINATOR"] },
    { id: "queue",     label: "Review Queue",        ic: "☑", group: "Coordinator",  roles: ["COORDINATOR"], badge: "pending" },
    { id: "ai",        label: "AI Summary",          ic: "◎", group: "Coordinator",  roles: ["COORDINATOR"] },
    { id: "quarters",  label: "Quarters",            ic: "◷", group: "Coordinator",  roles: ["COORDINATOR"] },
    { id: "activity",  label: "Activity Log",        ic: "≡", group: "Coordinator",  roles: ["COORDINATOR"] },
    { id: "dashboard", label: "Dashboard",           ic: "▦", group: "Coordinator",  roles: ["COORDINATOR"] },
    { id: "reports",   label: "Reports",             ic: "▤", group: "Coordinator",  roles: ["COORDINATOR"] },
    { id: "help",      label: "Help & Guidelines",   ic: "?", group: "Recognition",  roles: ["EMPLOYEE", "COORDINATOR"] }
  ];

  // Version 1's actual six. The earlier prototype carried a made-up set
  // (Customer Success, Innovation, Collaboration, Community); these are the real
  // ones and match what the submission form offers.
  var VALUES = ["Honesty & Integrity", "Personal Commitment", "No Ego",
                "Customer First", "Excellence", "Drive"];

  var STATUS = {
    PENDING_REVIEW:     { cls: "pending",  g: "◔", label: "Pending review" },
    NEEDS_RESUBMISSION: { cls: "progress", g: "↩", label: "Needs resubmission" },
    APPROVED:           { cls: "approved", g: "✓", label: "Approved" },
    REJECTED:           { cls: "rejected", g: "✕", label: "Rejected" }
  };

  var AI_STATUS = {
    COMPLETED:           "Completed",
    FAILED:              "AI review unavailable — the evaluator call failed",
    SKIPPED_NO_API_KEY:  "AI review skipped — no API key was configured"
  };

  var ACTION = {
    APPROVED:               { cls: "approved", g: "✓", label: "Approved" },
    REJECTED:               { cls: "rejected", g: "✕", label: "Rejected" },
    RESUBMISSION_REQUESTED: { cls: "progress", g: "↩", label: "Resubmission requested" }
  };

  var FIELDS = ["nominatorName", "nominatorEmail", "nomineeName", "nomineeEmail",
                "practice", "location", "category", "whatText", "howText",
                "originalNominationId"];

  var AV_COLORS = ["#6C4BD8", "#0F9E8E", "#C2410C", "#2a78d6", "#B0448F", "#0f766e"];

  /* ================= utilities ================= */

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(s));
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initials(name) {
    var p = String(name || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }

  function avColor(name) {
    var h = 0, s = String(name || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
  }

  function avatar(name, cls) {
    return '<span class="av ' + (cls || "") + '" style="background:' + avColor(name) + '">' +
           esc(initials(name)) + "</span>";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) +
           " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function ago(iso) {
    if (!iso) return "";
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (isNaN(s)) return "";
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  function pill(status) {
    var s = STATUS[status] || { cls: "pending", g: "○", label: status || "—" };
    return '<span class="pill ' + s.cls + '"><span class="g">' + s.g + "</span>" +
           esc(s.label) + "</span>";
  }

  function tagLive() { return '<span class="tag live"><span class="dot"></span>Live data</span>'; }

  /* ---------------------------------------------------------------------
     Star Award logo. A six-point star rather than the usual five: five-point
     stars read as rating widgets, and this is an award, not a score out of
     five. The inner facet gives it a struck-medal look at large sizes and
     disappears harmlessly at 18px in the nav.

     currentColor throughout, so one definition serves the purple lockup on
     the Star Awards page, the muted nav glyph, and anything on a dark
     surface, without a second copy or a fill override.
     --------------------------------------------------------------------- */
  function starLogo(size, cls) {
    var s = size || 24;
    return '<svg class="starlogo ' + (cls || "") + '" width="' + s + '" height="' + s + '" ' +
      'viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">' +
        '<path d="M24 2.5l5.9 13.4 14.6 1.4-11 9.8 3.2 14.3L24 34.1 11.3 41.4l3.2-14.3-11-9.8 14.6-1.4z" ' +
          'fill="currentColor"/>' +
        '<path d="M24 11.8l3.2 7.3 7.9.8-6 5.3 1.8 7.8L24 28.9l-6.9 4.1 1.8-7.8-6-5.3 7.9-.8z" ' +
          'fill="#fff" fill-opacity="0.22"/>' +
      "</svg>";
  }

  /** The full lockup: mark plus wordmark, for the top of the Star Awards page. */
  function starLockup(subtitle) {
    return '<div class="star-lockup">' +
      '<span class="star-lockup__mark">' + starLogo(30) + "</span>" +
      '<span class="star-lockup__words"><span class="star-lockup__name">Star Award</span>' +
      (subtitle ? '<span class="star-lockup__sub">' + esc(subtitle) + "</span>" : "") +
      "</span></div>";
  }
  function tagShell()  { return '<span class="tag shell"><span class="dot"></span>UI only</span>'; }
  function tagSample() { return '<span class="tag sample">sample</span>'; }

  function shellNotice(what) {
    return '<div class="notice"><span class="glyph">▲</span><div>' +
      "<b>This screen isn't wired up.</b> " + esc(what) +
      " Everything below is sample content for layout review — it is not read from " +
      "or written to the database.</div></div>";
  }

  function roleChip(role) {
    return '<span class="rolechip ' + (role === "COORDINATOR" ? "coordinator" : "employee") + '">' +
      (role === "COORDINATOR" ? "◈" : "◆") + " " + esc(ROLE_LABEL[role]) + "</span>";
  }

  /* ================= persona ================= */

  var personaId = null;

  function persona() {
    var found = PERSONAS.filter(function (p) { return p.id === personaId; })[0];
    return found || PERSONAS[0];
  }

  function isCoordinator() { return persona().role === "COORDINATOR"; }

  /** Every nomination where the current persona is either side of it. */
  function involvesMe(n) {
    var me = persona().email.toLowerCase();
    return String(n.nominatorEmail || "").toLowerCase() === me ||
           String(n.nomineeEmail || "").toLowerCase() === me;
  }

  function loadPersona() {
    var saved = null;
    try { saved = window.localStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    personaId = PERSONAS.filter(function (p) { return p.id === saved; }).length ? saved : PERSONAS[0].id;
  }

  /* Switches profile. Reloads the quarter status first - "have you used your
     nomination?" is per person - then re-renders, landing on Home if the new
     role can't see the current screen. */
  function setPersona(id, announce) {
    var before = persona();
    personaId = id;
    try { window.localStorage.setItem(STORE_KEY, id); } catch (e) { /* private mode */ }

    var p = persona();
    closePersonaMenu();

    // The quarter answer ("have you used your nomination?") is per person, so
    // it has to be re-fetched before the new profile's screens are drawn.
    loadQuarter().then(function () { render(); });

    // Switching role can strip the screen you are standing on out of the nav
    // (an employee has no Review Queue). Land on Home rather than leave the
    // main pane showing a view this account isn't supposed to have.
    if (!routeAllowed(route())) {
      location.hash = "#/home";   // triggers hashchange -> render
    } else {
      render();
    }

    if (announce !== false && before.id !== p.id) {
      toast({
        kind: p.role === "COORDINATOR" ? "coordinator" : "employee",
        title: "Now viewing as " + p.name,
        msg: p.role === "COORDINATOR"
          ? "Admin / HR view — you can approve, reject and request resubmissions on the Review Queue."
          : "Employee view — you can submit recognition and track your own. Coordinator screens are hidden."
      });
    }
  }

  function renderPersona() {
    var p = persona();
    $("#personaAvatar").innerHTML = avatar(p.name, "sm");
    $("#personaName").textContent = p.name;
    $("#personaRole").textContent = ROLE_LABEL[p.role] + " · " + p.title;

    $("#personaMenu").innerHTML =
      '<div class="persona-menu__label">Switch profile</div>' +
      PERSONAS.map(function (o) {
        return '<button type="button" role="menuitem" class="persona-opt' +
          (o.id === p.id ? " on" : "") + '" data-persona="' + esc(o.id) + '">' +
          avatar(o.name, "sm") +
          '<span class="persona-opt__text"><span class="n">' + esc(o.name) + "</span>" +
          '<span class="r">' + esc(ROLE_LABEL[o.role]) + " · " + esc(o.title) + "</span></span>" +
          (o.id === p.id ? '<span class="tick" aria-label="current">✓</span>' : "") +
          "</button>";
      }).join("") +
      '<div class="persona-menu__label" style="text-transform:none;letter-spacing:0;' +
      'font-size:11.5px;padding:8px 9px 4px;border-top:1px solid var(--border);margin-top:4px">' +
      "No sign-in yet — this switches the view, not your access.</div>";
  }

  function openPersonaMenu() {
    $("#personaMenu").hidden = false;
    $("#personaBtn").setAttribute("aria-expanded", "true");
  }
  function closePersonaMenu() {
    var m = $("#personaMenu");
    if (m) m.hidden = true;
    var b = $("#personaBtn");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  function wirePersonaSwitcher() {
    $("#personaBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      if ($("#personaMenu").hidden) openPersonaMenu(); else closePersonaMenu();
    });

    $("#personaMenu").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-persona]") : null;
      if (btn) setPersona(btn.getAttribute("data-persona"));
    });

    document.addEventListener("click", function (e) {
      if (!$("#whoami").contains(e.target)) closePersonaMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePersonaMenu();
    });
  }

  /* ================= appearance =================
     Three states, because two is a trap: a Light/Dark toggle has to pick a
     starting side, and whichever it picks is wrong for half the people opening
     the page. Auto (the default) follows the OS; choosing Light or Dark pins it
     and survives a reload.

     The stylesheet mirrors this: bare :root is light, a prefers-color-scheme
     block covers auto, and [data-theme="dark"] wins over both.
     ============================================== */

  var THEME_KEY = "v1r.theme";
  var GREY_KEY = "v1r.greyscale";

  function loadTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
    applyTheme(saved === "light" || saved === "dark" ? saved : "auto", false);
  }

  function applyTheme(choice, announce) {
    if (choice === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", choice);
    }
    try { window.localStorage.setItem(THEME_KEY, choice); } catch (e) { /* private mode */ }

    $$("#themeControl [data-theme-choice]").forEach(function (b) {
      var on = b.getAttribute("data-theme-choice") === choice;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (announce) {
      var names = { light: "Light", dark: "Dark", auto: "Matching your system" };
      toast({ title: names[choice] + " appearance", msg: choice === "auto"
        ? "Following your operating system's light or dark setting."
        : "Pinned to " + names[choice].toLowerCase() + " on this browser." });
    }
  }

  /* Greyscale strips the accent hues while keeping the chosen light/dark
     background. It is a genuine accessibility check as much as a preference:
     with the colour gone, anything that was relying on hue alone to carry
     meaning stops working, and you can see it immediately. Every status here
     also carries a glyph and a word, so it should all still read. */
  function loadGreyscale() {
    var on = false;
    try { on = window.localStorage.getItem(GREY_KEY) === "1"; } catch (e) { /* private mode */ }
    applyGreyscale(on, false);
  }

  function applyGreyscale(on, announce) {
    if (on) {
      document.documentElement.setAttribute("data-palette", "grey");
    } else {
      document.documentElement.removeAttribute("data-palette");
    }
    try { window.localStorage.setItem(GREY_KEY, on ? "1" : "0"); } catch (e) { /* private mode */ }

    var box = $("#greyscaleToggle");
    if (box) box.checked = on;

    if (announce) {
      toast({
        title: on ? "Greyscale on" : "Greyscale off",
        msg: on
          ? "Accent colours removed. Status and category still read through their labels and glyphs."
          : "Accent colours restored."
      });
    }
  }

  function wireGreyscale() {
    var box = $("#greyscaleToggle");
    if (box) box.addEventListener("change", function () { applyGreyscale(box.checked, true); });
  }

  function wireTheme() {
    $("#themeControl").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-theme-choice]") : null;
      if (btn) applyTheme(btn.getAttribute("data-theme-choice"), true);
    });
  }

  /* ================= toast ================= */

  function toast(opts) {
    var host = $("#toastHost");
    var el = document.createElement("div");
    el.className = "toast " + (opts.kind || "");
    el.innerHTML =
      '<div class="toast__body"><div class="toast__title">' + esc(opts.title) + "</div>" +
      (opts.msg ? '<div class="toast__msg">' + esc(opts.msg) + "</div>" : "") + "</div>" +
      '<button type="button" class="toast__close" aria-label="Dismiss">×</button>';

    function dismiss() {
      if (!el.parentNode) return;
      el.className += " leaving";
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }

    $(".toast__close", el).addEventListener("click", dismiss);
    host.appendChild(el);
    window.setTimeout(dismiss, opts.sticky ? 12000 : 6000);
  }


  /* ================= data ================= */

  var store = { nominations: [], categories: [], coreValues: [], quarter: null, quarterHistory: [], activity: [], error: null, loaded: false };

  /* Current quarter, and whether the active profile has used its nomination.
     Reloaded whenever the profile changes, since the answer is per person. */
  function loadQuarter() {
    return fetch(QUARTER_API + "/current?email=" + encodeURIComponent(persona().email))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (q) { store.quarter = q; })
      .catch(function () { store.quarter = null; });
  }

  function loadActivity() {
    return fetch(ACTIVITY_API)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { store.activity = list || []; })
      .catch(function () { store.activity = []; });
  }

  function loadQuarterHistory() {
    return fetch(QUARTER_API)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { store.quarterHistory = list || []; })
      .catch(function () { store.quarterHistory = []; });
  }

  /* Tells someone the quarter rolled over since they last had the page open,
     which is the moment their nomination becomes available again. Compares
     against what was stored, so it fires once rather than on every load. */
  function announceNewQuarterIfChanged() {
    var q = store.quarter;
    if (!q) return;
    var seen = null;
    try { seen = window.localStorage.getItem(QUARTER_SEEN_KEY); } catch (e) { /* private mode */ }
    try { window.localStorage.setItem(QUARTER_SEEN_KEY, q.code); } catch (e) { /* private mode */ }

    if (seen && seen !== q.code) {
      toast({
        kind: "employee",
        sticky: true,
        title: "New quarter — " + q.label,
        msg: "Nominations have reset. You can submit one nomination for " + q.label +
             ", up to " + fmtDay(q.deadline) + "."
      });
    }
  }

  function fmtDay(iso) {
    if (!iso) return "—";
    var d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  function loadCoreValues() {
    return fetch(CORE_VALUE_API)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { store.coreValues = list || []; })
      .catch(function () { store.coreValues = []; });
  }

  function loadCategories() {
    return fetch(CATEGORY_API)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { store.categories = list || []; })
      .catch(function () { store.categories = []; });
  }

  /** Display name for a category code, falling back for pre-category rows. */
  function categoryLabel(n) {
    if (n.categoryLabel) return n.categoryLabel;
    if (!n.category) return null;
    var found = store.categories.filter(function (c) { return c.value === n.category; })[0];
    return found ? found.label : n.category;
  }
  var currentFilter = null;
  var currentCategory = "";
  var currentPractice = "";
  var currentLocation = "";
  var currentName = "";
  var queueFilter = null;
  var openDetailId = null;

  function loadNominations() {
    return fetch(API)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (list) {
        list.sort(function (a, b) {
          return String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
        });
        store.nominations = list; store.error = null; store.loaded = true;
      })
      .catch(function (e) { store.error = e.message; store.loaded = true; });
  }

  function counts(list) {
    var src = list || store.nominations;
    var c = { total: src.length, PENDING_REVIEW: 0, NEEDS_RESUBMISSION: 0, APPROVED: 0, REJECTED: 0 };
    src.forEach(function (n) { if (c[n.status] !== undefined) c[n.status]++; });
    return c;
  }

  /* ================= views ================= */

  var views = {};

  /* ---------- Home ---------- */
  views.home = function () {
    var p = persona();
    var mine = store.nominations.filter(involvesMe);
    var recent = (isCoordinator() ? store.nominations : mine).slice(0, 5);

    var feed = recent.length
      ? recent.map(function (n) {
          return '<div class="feed-item">' +
            '<div class="ico" style="background:var(--star-soft);color:var(--star)">★</div>' +
            '<div class="txt"><div class="l1"><b>' + esc(n.nomineeName) +
              "</b> was nominated for a Star Award by " + esc(n.nominatorName) + "</div>" +
            '<div class="l2">' + esc(n.whatText).slice(0, 150) +
              (n.whatText && n.whatText.length > 150 ? "…" : "") + "</div></div>" +
            '<div class="ago">' + esc(ago(n.submittedAt)) + "</div></div>";
        }).join("")
      : '<div class="empty">' + (isCoordinator()
          ? "No recognition recorded yet."
          : "Nothing involving you yet — submit the first Star Award.") + "</div>";

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>What would you like to recognise today?</h1>" +
        "<p>Celebrate the impact and contributions of your colleagues.</p></div>" +
        '<div class="spacer"></div>' + roleChip(p.role) + tagLive() +
        "</div></div>" +

      '<div class="chooser">' +
        '<div class="choice star"><div class="badge">★</div><h3>Star Award</h3>' +
          "<p>Recognise outstanding contributions that go above and beyond.</p>" +
          '<a class="btn btn-star" href="#/submit">Submit Star Award</a></div>' +
        '<div class="choice praise"><div class="badge">♡</div><h3>Praise</h3>' +
          "<p>Send a thank you and recognition for everyday wins and great work.</p>" +
          '<a class="btn btn-praise" href="#/praises/new">Send a Praise</a></div>' +
        '<div class="choice mtm"><div class="badge">🎁</div><h3>Moments that Matter</h3>' +
          "<p>Request a gift or support for life events and special moments.</p>" +
          '<a class="btn btn-mtm" href="#/mtm/new">Request MtM</a></div>' +
      "</div>" +

      (isCoordinator() ? coordinatorHomeStrip() : "") +

      '<div class="card"><header><h2>' +
        (isCoordinator() ? "Recent Recognition" : "Recognition involving you") + "</h2>" +
        '<span class="ep">Star Awards only</span>' +
        '<div class="spacer"></div>' +
        (isCoordinator() ? '<a class="linkish" href="#/queue">Open review queue</a>'
                         : '<a class="linkish" href="#/mine">View all</a>') + "</header>" +
        '<div class="body" style="padding-top:4px;padding-bottom:4px">' + feed + "</div></div>" +
      "";
  };

  function coordinatorHomeStrip() {
    var c = counts();
    return '<div class="kpis">' +
      kpi("k-star", "Pending review", c.PENDING_REVIEW, '<a class="linkish" href="#/queue">Review now</a>', true) +
      kpi("k-praise", "Approved", c.APPROVED, "", true) +
      kpi("k-mtm", "Needs resubmission", c.NEEDS_RESUBMISSION, "", true) +
      kpi("k-total", "Total nominations", c.total, "", true) +
      "</div>";
  }

  /* ---------- Submit ---------- */
  views.submit = function () {
    var q = store.quarter;

    // Already used this quarter's nomination: show what they submitted and how
    // it is doing, rather than a form that will only be refused on submit.
    // A nomination that was rejected or sent back is not finished business: the
    // brief requires the nominator be able to try again, and the server already
    // exempts resubmissions from the quarter limit. Blocking the form here would
    // have made that impossible from the interface.
    var openForRevision = q && q.hasSubmitted && q.submission &&
      (q.submission.status === "REJECTED" || q.submission.status === "NEEDS_RESUBMISSION");

    if (q && q.hasSubmitted && !openForRevision) {
      return '<div class="page-head"><div class="head-row"><div>' +
          "<h1>Submit a Star Award</h1>" +
          "<p>One nomination per person, per quarter.</p></div>" +
          '<div class="spacer"></div>' + quarterChip() + "</div></div>" +
        quarterUsedPanel(q) +
        '<div class="helper" style="margin-top:18px"><h4>Why only one?</h4>' +
        '<p style="margin:0;font-size:12.5px;color:var(--ink-2)">The Star Award is a ' +
        "vote: everyone gets one nomination each quarter, so no single person can " +
        "weight the outcome by submitting several. Your nomination stands whether it " +
        "is approved or not — a decision doesn't return the slot.</p></div>";
    }

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Submit a Star Award</h1>" +
        "<p>Recognise outstanding contributions that go above and beyond.</p></div>" +
        '<div class="spacer"></div>' + quarterChip() + tagLive() + "</div></div>" +
        quarterBanner() +

      '<div class="grid-main"><div class="card"><div class="body">' +
        '<div class="banner ok" id="okBanner"><span class="glyph">✓</span><span id="okText"></span></div>' +
        '<div class="banner bad" id="badBanner"><span class="glyph">●</span><span id="badText"></span></div>' +

        '<form id="form" novalidate autocomplete="off">' +
          lockedNominatorFields() +
          '<div class="row2">' +
            field("nomineeName", "Nominee name", "text") +
            field("nomineeEmail", "Nominee email", "email") +
          '</div><div class="row2">' +
            field("practice", "Practice", "text", "practices") +
            field("location", "Location", "text", "locations") +
          "</div>" +
          categoryField() +
          '<datalist id="practices"><option value="Cloud Engineering"></option>' +
            '<option value="Data &amp; AI"></option><option value="Digital"></option>' +
            '<option value="ERP"></option><option value="Managed Services"></option>' +
            '<option value="Consulting"></option></datalist>' +
          '<datalist id="locations"><option value="Dublin"></option><option value="Belfast"></option>' +
            '<option value="Cork"></option><option value="London"></option>' +
            '<option value="Birmingham"></option><option value="Bengaluru"></option>' +
            '<option value="Pune"></option></datalist>' +

          areaField("whatText", "WHAT — the achievement, contribution or action") +
          areaField("howText", "HOW — which core value they showed, and how") +
          coreValueGuide() +

          (openForRevision
            ? '<div class="notice" style="border-style:solid;border-color:' +
              "color-mix(in srgb, var(--info) 35%, var(--border));background:" +
              'color-mix(in srgb, var(--info) 7%, var(--surface))"><span class="glyph" ' +
              'style="color:var(--info)">↩</span><div><b>Revising your ' +
              esc(q.label) + ' nomination.</b> A coordinator has asked for more ' +
              "detail on your entry for " + esc(q.submission.nomineeName) +
              ". This replaces it and doesn't use another nomination.</div></div>"
            : "") +
          '<div class="field" data-field="originalNominationId" id="resubWrap"' +
          (openForRevision ? "" : " hidden") + ">" +
            "<label>Original nomination id (resubmission)</label>" +
            '<input type="text" id="originalNominationId" placeholder="UUID of the nomination this replaces"' +
            (openForRevision ? ' value="' + esc(q.submission.id) + '" readonly' : "") + ">" +
            '<div class="err"></div></div>' +

          '<div class="form-actions">' +
            '<button type="submit" class="btn-star" id="submitBtn">Submit Star Award</button>' +
            '<button type="button" class="linkish" id="sampleBtn">Fill sample</button>' +
            '<button type="button" class="linkish" id="selfBtn">Try self-nomination</button>' +
            '<button type="button" class="linkish" id="resubBtn">Resubmission…</button>' +
            '<button type="button" class="linkish" id="clearBtn">Clear</button>' +
          "</div>" +
        "</form>" +
      "</div></div>" +

      '<div class="helper"><h4>What makes a strong nomination</h4>' +
        "<ul><li>Name the specific contribution, not a general quality.</li>" +
        "<li>Say what the impact was — who benefited and how.</li>" +
        "<li>Tie the HOW to a core value.</li>" +
        "<li>You can't nominate yourself.</li></ul>" +
        '<h4 style="margin-top:14px">Validation</h4>' +
        '<p style="margin:0;font-size:12.5px;color:var(--ink-2)">Every field is required, both ' +
        "email addresses must be valid, and you can't nominate yourself. Anything missed is " +
        "flagged against the field when you submit.</p>" +
        '<h4 style="margin-top:14px">Your details</h4>' +
        '<p style="margin:0;font-size:12.5px;color:var(--ink-2)">Pre-filled from the profile ' +
        "you're viewing as (" + esc(persona().name) + "). Change the profile in the bottom-left " +
        "corner to submit as someone else.</p></div></div>" +
      "";
  };

  /* The five business categories. The examples sit under the picker and swap
     as you change it: a nominator who has just read "process time reduced,
     tasks automated" is far likelier to put a number in the WHAT than one
     looking at an empty box. That is the main reason this field exists at all,
     beyond making the reporting possible. */
  /* Nominator identity, rendered as fixed facts rather than inputs.
     Two reasons. It removes the "nominate under a colleague's name to get a
     second entry" route, and it stops honest typos putting a nomination under
     an address that never receives the outcome email.

     Server-side note: there is no authentication yet, so a determined person
     can still POST any nominator they like. This closes the path through the
     interface, not the API - and the quarter limit is re-checked on the server
     against whatever email arrives, so the block still holds for the identity
     actually submitted. */
  function lockedNominatorFields() {
    var p = persona();
    return '<div class="lockedfields">' +
      '<div class="lockedfields__head"><span class="lockedfields__icon" aria-hidden="true">🔒</span>' +
      "<span>Submitting as — taken from your signed-in profile</span></div>" +
      '<div class="row2">' +
        '<div class="lockedfield"><span class="lockedfield__label">Your name</span>' +
          '<span class="lockedfield__value">' + esc(p.name) + "</span></div>" +
        '<div class="lockedfield"><span class="lockedfield__label">Your email</span>' +
          '<span class="lockedfield__value">' + esc(p.email) + "</span></div>" +
      "</div>" +
      '<input type="hidden" id="nominatorName" value="' + esc(p.name) + '">' +
      '<input type="hidden" id="nominatorEmail" value="' + esc(p.email) + '">' +
      '<p class="lockedfields__note">' +
      "You can't nominate on someone else's behalf. " +
      "To submit as a different person, switch profile in the bottom-left corner.</p>" +
      "</div>";
  }

  /* Countdown chip. Turns urgent inside a fortnight and says so in words as
     well as colour, because the whole point is that it is noticed. */
  function quarterChip() {
    var q = store.quarter;
    if (!q) return "";
    var days = q.daysUntilDeadline;
    var cls = days < 0 ? "closed" : (days <= 14 ? "urgent" : "");
    var text = days < 0
      ? q.label + " deadline passed"
      : (days === 0 ? q.label + " — closes today"
        : q.label + " — " + days + " day" + (days === 1 ? "" : "s") + " left");
    return '<span class="quarterchip ' + cls + '"><span aria-hidden="true">◷</span>' +
      esc(text) + "</span>";
  }

  function quarterBanner() {
    var q = store.quarter;
    if (!q) return "";
    var days = q.daysUntilDeadline;
    if (days < 0) {
      return '<div class="notice"><span class="glyph">▲</span><div>' +
        "<b>" + esc(q.label) + " has closed.</b> Its deadline was " + esc(fmtDay(q.deadline)) +
        ". Anything submitted now still counts toward " + esc(q.label) +
        " until the quarter itself ends.</div></div>";
    }
    return '<div class="notice" style="border-style:solid;border-color:' +
      "color-mix(in srgb, var(--brand) 30%, var(--border));background:" +
      'color-mix(in srgb, var(--brand) 6%, var(--surface))">' +
      '<span class="glyph" style="color:var(--brand)">◷</span><div>' +
      "<b>" + esc(q.label) + " is open.</b> You have one nomination this quarter, and " +
      esc(String(days)) + " day" + (days === 1 ? "" : "s") + " until the deadline on " +
      esc(fmtDay(q.deadline)) + ".</div></div>";
  }

  /* Shown in place of the form once the quarter's nomination is used. */
  function quarterUsedPanel(q) {
    var sub = q.submission || {};
    return '<div class="card"><header><h2>' +
      "You've nominated for " + esc(q.label) + "</h2>" +
      "</header><div class=\"body\">" +
      '<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">' +
        avatar(sub.nomineeName) +
        '<div style="min-width:0;flex:1 1 220px">' +
          '<div style="font-size:16px;font-weight:600">' + esc(sub.nomineeName || "—") + "</div>" +
          '<div class="muted" style="font-size:12.5px;margin-top:2px">' +
            (sub.categoryLabel ? esc(sub.categoryLabel) + " · " : "") +
            "submitted " + esc(fmtDate(sub.submittedAt)) + "</div>" +
        "</div>" +
      "</div>" +
      '<p class="sub" style="margin:16px 0 0">Your next nomination opens in <b>' +
      esc(q.nextQuarterLabel) + "</b>. You'll see a notice here when it does.</p>" +
      '<div style="margin-top:16px"><a class="btn" href="#/mine">Track this nomination</a></div>' +
      "</div></div>";
  }

  function categoryField() {
    var opts = store.categories.map(function (c) {
      return '<option value="' + esc(c.value) + '">' + esc(c.label) + "</option>";
    }).join("");

    return '<div class="field" data-field="category">' +
      '<label for="category">Business category <span class="req">*</span></label>' +
      '<select id="category"><option value="">Select a category…</option>' + opts + "</select>" +
      '<p class="field__hint" id="categoryHint">Pick the kind of impact this nomination ' +
      "evidences — the examples will show what that category expects.</p>" +
      '<div class="err"></div></div>';
  }

  /* The six core values, listed under the HOW box for reference rather than
     offered as a dropdown.

     A picker asks people to categorise before they have written anything, which
     tends to produce a selection that the HOW then never argues for. Listing
     them here keeps the value in the nominator's own words, where a coordinator
     can see the reasoning. The value is still recorded - the service reads it
     back out of the text - so per-value reporting is unaffected. */
  function coreValueGuide() {
    var items = store.coreValues.map(function (v) {
      return '<li class="valueguide__item"><b>' + esc(v.label) + "</b>" +
        '<span class="valueguide__hint">' + esc(v.prompt) + "</span></li>";
    }).join("");

    return '<div class="valueguide">' +
      '<div class="valueguide__head">Name one of these in your HOW, and say how they showed it</div>' +
      '<ul class="valueguide__list">' + items + "</ul>" +
      "</div>";
  }

  function field(id, label, type, list) {
    return '<div class="field" data-field="' + id + '">' +
      '<label for="' + id + '">' + esc(label) + ' <span class="req">*</span></label>' +
      '<input type="' + type + '" id="' + id + '"' + (list ? ' list="' + list + '"' : "") + ">" +
      '<div class="err"></div></div>';
  }
  function areaField(id, label) {
    return '<div class="field" data-field="' + id + '">' +
      '<label for="' + id + '">' + esc(label) + ' <span class="req">*</span></label>' +
      '<textarea id="' + id + '"></textarea><div class="err"></div></div>';
  }

  /* ---------- shared nomination table ---------- */
  function nominationTable(list) {
    if (store.error) {
      return '<div class="empty">Couldn\'t load nominations — is the app still running?</div>';
    }
    if (!list.length) return '<div class="empty">Nothing here yet.</div>';

    var showAi = canSeeAi();
    var showCompare = isCoordinator() && route() === "queue";

    return '<div class="tablewrap"><table><thead><tr>' +
      (showCompare ? '<th class="tickcol"><span class="sr-only">Select</span></th>' : "") +
      "<th>Nominee</th><th>Nominated by</th><th>Category</th><th>Practice</th><th>Location</th>" +
      (showAi ? "<th>AI</th>" : "") +
      // Review status is a coordinator's working state. Employees are told the
      // outcome by email; showing a live "pending review" here just invites
      // people to watch the queue.
      (isCoordinator() ? "<th>Status</th>" : "") +
      "<th>Submitted</th></tr></thead><tbody>" +
      list.map(function (n) {
        return '<tr class="clickable" data-id="' + esc(n.id) + '">' +
          (showCompare
            ? '<td class="tickcol"><input type="checkbox" class="rowtick" ' +
              'data-tick="' + esc(n.id) + '"' + (compareIds.indexOf(n.id) !== -1 ? " checked" : "") +
              ' aria-label="Select ' + esc(n.nomineeName) + ' to compare"></td>'
            : "") +
          '<td class="nowrap"><span style="display:inline-flex;align-items:center;gap:10px">' +
            avatar(n.nomineeName, "sm") + "<b>" + esc(n.nomineeName) + "</b></span></td>" +
          "<td>" + esc(n.nominatorName) + "</td>" +
          "<td>" + categoryChip(n) + "</td>" +
          "<td>" + esc(n.practice) + "</td>" +
          "<td>" + esc(n.location) + "</td>" +
          (showAi ? '<td class="nowrap">' + aiCell(n) + "</td>" : "") +
          (isCoordinator() ? "<td>" + pill(n.status) + "</td>" : "") +
          '<td class="when">' + esc(fmtDate(n.submittedAt)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* Score plus the flag count, because a high score with two flags on it is a
     different thing to a high score with none, and the queue should show that
     without needing the row opened. */
  function aiCell(n) {
    var flags = (n.aiFlags || []).length;
    if (n.aiScore == null) {
      return '<span class="muted" style="font-size:12px">n/a</span>' +
        (flags ? ' <span class="valchip flag">▲ ' + flags + "</span>" : "");
    }
    return '<b style="font-variant-numeric:tabular-nums">' + esc(String(n.aiScore)) + "</b>" +
      '<span class="muted" style="font-size:11.5px">/100</span>' +
      (flags ? ' <span class="valchip flag">▲ ' + flags + "</span>" : "");
  }

  /* ---------- My Recognition (employee) ---------- */
  views.mine = function () {
    var p = persona();
    var mine = store.nominations.filter(involvesMe);
    var submitted = mine.filter(function (n) {
      return String(n.nominatorEmail || "").toLowerCase() === p.email.toLowerCase();
    });
    var received = mine.filter(function (n) {
      return String(n.nomineeEmail || "").toLowerCase() === p.email.toLowerCase();
    });
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>My Recognition</h1><p>Nominations you submitted, and nominations you received.</p></div>" +
        '<div class="spacer"></div>' + roleChip(p.role) + tagLive() + "</div></div>" +

      '<div class="notice"><span class="glyph">▲</span><div><b>No sign-in yet.</b> ' +
        "Everyone's nominations are loaded; this page filters to <b>" + esc(p.email) +
        "</b> in the browser. It is a demonstration of the employee view, not access control." +
        "</div></div>" +

      '<div class="kpis">' +
        kpi("k-star", "Submitted by you", submitted.length, "", true) +
        kpi("k-praise", "Received by you", received.length, "", true) +
      "</div>" +

      '<div class="card" style="margin-bottom:18px"><header><h2>Submitted by you</h2>' +
        '<div class="spacer"></div><button class="btn-sm" id="refreshBtn">Refresh</button></header>' +
        nominationTable(submitted) + "</div>" +

      '<div class="card"><header><h2>Received by you</h2></header>' +
        nominationTable(received) + '<div id="detail"></div></div>' +
      "";
  };

  /* ---------- Star Awards ---------- */
  /* Star Awards is the same page for everyone: the approved awards, as a wall
     of winners. The coordinator's working view - every status, filters, the
     decision buttons - lives on the Review Queue, which is where the work
     actually happens. Two screens showing the same rows differently was mostly
     a way to end up looking at the wrong one. */
  views.stars = function () {
    var approved = store.nominations.filter(function (n) { return n.status === "APPROVED"; });

    return '<div class="star-hero">' + starLockup("Spotlight") +
        "<h1>Colleagues recognised for going above and beyond</h1>" +
        "<p>The Star Award is for outstanding contribution — not for doing the job well, " +
        "but for the thing nobody expected and everybody felt.</p></div>" +
        '<div class="head-row" style="margin-bottom:18px">' + roleChip(persona().role) +
        tagLive() + "</div>" +
      '<div class="notice"><span class="glyph">▲</span><div><b>Approved awards only.</b> ' +
        (isCoordinator()
          ? 'Everything still in flight is on the <a href="#/queue">Review Queue</a>.'
          : "Nominations still under review are visible to recognition coordinators, " +
            "not to everyone.") +
        "</div></div>" +
      '<div class="card"><header><h2>Approved Star Awards</h2>' +
        '<div class="spacer"></div><span class="ep">' + approved.length + " approved</span></header>" +
        nominationTable(approved) + '<div id="detail"></div></div>' +
      "";
  };

  /* ---------- Review Queue (coordinator only) ---------- */
  views.queue = function () {
    var c = counts();
    var total = store.nominations.length;
    var decided = c.APPROVED + c.REJECTED + c.NEEDS_RESUBMISSION;
    var pct = total ? Math.round(decided / total * 100) : 0;

    var showing = queueFilter || "ALL";
    var list = showing === "ALL"
      ? store.nominations.slice()
      : store.nominations.filter(function (n) { return n.status === showing; });
    var title = showing === "ALL" ? "All nominations" : ((STATUS[showing] || {}).label || showing);

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Review Queue</h1><p>Nominations waiting on a decision from you, " +
        esc(persona().name) + ".</p></div>" +
        '<div class="spacer"></div>' + roleChip("COORDINATOR") + quarterChip() + "</div></div>" +

      '<div class="progress"><div class="progress__head">' +
        "<b>" + decided + " of " + total + " reviewed</b>" +
        '<span class="muted">' + c.PENDING_REVIEW + " still awaiting a decision</span></div>" +
        '<div class="progress__track"><div class="progress__fill" style="width:' + pct + '%"></div></div>' +
        '<div class="progress__legend muted">' + pct + "% complete</div></div>" +

      '<div class="kpis">' +
        kpi("k-star", "Awaiting review", c.PENDING_REVIEW, "", true, "PENDING_REVIEW") +
        kpi("k-praise", "Approved", c.APPROVED, "", true, "APPROVED") +
        kpi("k-total", "Rejected", c.REJECTED, "", true, "REJECTED") +
        kpi("k-mtm", "Sent back for detail", c.NEEDS_RESUBMISSION, "", true, "NEEDS_RESUBMISSION") +
      "</div>" +

      '<div class="notice"><span class="glyph">▲</span><div>' +
        "<b>The AI score is advisory.</b> It flags language patterns for your attention — " +
        "it never approves or rejects anything. Every decision below is recorded against " +
        "<b>" + esc(persona().email) + "</b> in the activity log. " +
        'See all assessments weakest-first on <a href="#/ai">AI Summary</a>.</div></div>' +

      '<div class="card"><header><h2>' + esc(title) + "</h2>" +
        '<div class="spacer"></div>' +
        '<button class="btn-sm" id="compareBtn" disabled>Compare selected</button>' +
        '<button class="btn-sm" id="refreshBtn">Refresh</button></header>' +
        filterBar() +
        '<div id="starTable">' + nominationTable(list) + "</div>" +
        '<div id="compareBox"></div>' +
        '<div id="detail"></div></div>' +
      "";
  };

  /* ---------- AI Summary (coordinator only) -----------------------------
     The AI assessment exists on every nomination, but buried one click deep
     in a detail pane it may as well not be there. This screen is the AI as a
     first-class view: what it scored, why, what it flagged, and — just as
     importantly — which nominations it could not judge at all.
     -------------------------------------------------------------------- */
  views.ai = function () {
    var all = store.nominations;
    var scored = all.filter(function (n) { return n.aiScore != null; });
    var unavailable = all.filter(function (n) { return n.aiScore == null; });
    var flagged = all.filter(function (n) { return (n.aiFlags || []).length > 0; });

    var avg = scored.length
      ? Math.round(scored.reduce(function (a, n) { return a + Number(n.aiScore); }, 0) / scored.length)
      : 0;

    // Triage bands. The point of the score is to order a coordinator's
    // attention, so the screen sorts weakest-first: the nominations most
    // likely to need sending back are the ones you want at the top.
    var needsAttention = scored.filter(function (n) { return n.aiScore < 45; });
    var borderline = scored.filter(function (n) { return n.aiScore >= 45 && n.aiScore < 70; });
    var strong = scored.filter(function (n) { return n.aiScore >= 70; });

    var byScore = scored.slice().sort(function (a, b) { return a.aiScore - b.aiScore; });

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>AI Summary</h1><p>Language assessment across every nomination, weakest first.</p></div>" +
        '<div class="spacer"></div>' + roleChip("COORDINATOR") +
        tagLive() + "</div></div>" +

      '<div class="notice"><span class="glyph">▲</span><div>' +
        "<b>Advisory only — the AI never decides anything.</b> It reads the WHAT and HOW and " +
        "scores how reviewable the nomination is, so weak submissions surface before a human " +
        "reads all " + all.length + ". Approve, reject and send-back remain entirely yours, on the " +
        '<a href="#/queue">Review Queue</a>.</div></div>' +

      '<div class="kpis">' +
        kpi("k-star", "Evaluated", scored.length + " of " + all.length, "", true) +
        kpi("k-praise", "Average score", avg + " / 100", "", true) +
        kpi("k-mtm", "Carrying flags", flagged.length, "", true) +
        kpi("k-total", "Couldn't be scored", unavailable.length, "", true) +
      "</div>" +

      '<div class="card" style="margin-bottom:18px"><header><h2>Triage</h2>' +
        '<div class="spacer"></div><span class="ep">score bands</span></header>' +
        '<div class="body">' + triageBands(needsAttention, borderline, strong) + "</div></div>" +

      '<div class="card" style="margin-bottom:18px"><header><h2>Assessments</h2>' +
        '<div class="spacer"></div><span class="ep">' + byScore.length +
        " scored · weakest first</span></header>" +
        (byScore.length
          ? '<div class="body" style="display:flex;flex-direction:column;gap:12px">' +
            byScore.map(aiReviewRow).join("") + "</div>"
          : '<div class="empty">Nothing has been scored yet.</div>') +
      "</div>" +

      '<div class="card"><header><h2>Not scored</h2><div class="spacer"></div>' +
        '<span class="ep">' + unavailable.length + " nomination" +
        (unavailable.length === 1 ? "" : "s") + "</span></header>" +
        (unavailable.length
          ? '<div class="body" style="display:flex;flex-direction:column;gap:10px">' +
            unavailable.map(function (n) {
              return '<div style="display:flex;gap:11px;align-items:flex-start">' +
                avatar(n.nomineeName, "sm") +
                '<div style="min-width:0;flex:1 1 auto"><div style="font-size:13.5px"><b>' +
                esc(n.nomineeName) + "</b> — nominated by " + esc(n.nominatorName) + "</div>" +
                '<div class="muted" style="font-size:12.5px;margin-top:2px">' +
                esc(AI_STATUS[n.aiEvaluationStatus] || "No evaluation recorded.") +
                " Review this one by hand.</div></div>" + pill(n.status) + "</div>";
            }).join("") + "</div>"
          : '<div class="empty">Every nomination has an assessment.</div>') +
      "</div>";
  };

  /* Score distribution as a single stacked bar. Every band carries its count
     and label, so the reading never depends on telling the colours apart. */
  function triageBands(low, mid, high) {
    var total = low.length + mid.length + high.length;
    if (!total) return '<p class="muted">Nothing scored yet.</p>';

    var bands = [
      { label: "Needs attention", sub: "below 45", list: low, color: "var(--critical)" },
      { label: "Worth a closer read", sub: "45 to 69", list: mid, color: "var(--warning)" },
      { label: "Reads as strong", sub: "70 and above", list: high, color: "var(--good)" }
    ];

    var bar = '<div style="display:flex;gap:2px;height:30px;margin-bottom:16px">' +
      bands.filter(function (b) { return b.list.length; }).map(function (b, i, arr) {
        var r = arr.length === 1 ? "6px" :
                (i === 0 ? "6px 0 0 6px" : (i === arr.length - 1 ? "0 6px 6px 0" : "0"));
        return '<div style="flex:' + b.list.length + ";background:" + b.color +
          ";border-radius:" + r + '"></div>';
      }).join("") + "</div>";

    // Count and label on every band — the bar alone would put the whole reading
    // on colour, and these three are a severity scale a reader shouldn't have to
    // decode from hue.
    return bar + bands.map(function (b) {
      return '<div class="share-row"><span style="width:10px;height:10px;border-radius:3px;' +
        "background:" + b.color + ';display:inline-block"></span>' +
        '<span class="nm">' + esc(b.label) +
        ' <span class="muted" style="font-size:12px">(' + b.sub + ")</span></span>" +
        '<span class="vl">' + b.list.length + "</span>" +
        '<span class="muted" style="width:44px;text-align:right">' +
        Math.round(b.list.length / total * 100) + "%</span></div>";
    }).join("");
  }

  function aiReviewRow(n) {
    var score = Number(n.aiScore);
    var color = score >= 70 ? "var(--good)" : (score >= 45 ? "var(--warning)" : "var(--critical)");
    var flags = (n.aiFlags || []).length ? flagList(n.aiFlags) : "";

    return '<div style="border:1px solid var(--border);border-radius:11px;padding:14px 15px">' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:9px">' +
        '<span class="ai-score__num" style="color:' + color + ';font-size:22px">' +
          esc(String(score)) + "</span>" +
        '<span class="ai-score__den">/100</span>' +
        '<span class="ai-score__bar" style="max-width:120px"><span class="ai-score__fill" ' +
          'style="width:' + Math.max(0, Math.min(100, score)) + "%;background:" + color +
          '"></span></span>' +
        "<b>" + esc(n.nomineeName) + "</b>" +
        '<span class="muted" style="font-size:12.5px">by ' + esc(n.nominatorName) + "</span>" +
        '<div class="spacer"></div>' + pill(n.status) +
      "</div>" +
      (n.aiRationale
        ? '<p class="ai-rationale" style="margin:0 0 9px">' + esc(n.aiRationale) + "</p>"
        : '<p class="muted" style="font-size:12.5px;margin:0 0 9px">No rationale returned.</p>') +
      flags +
      '<div style="margin-top:10px"><a class="linkish" href="#/queue?id=' + esc(n.id) + '">Open in review queue →</a></div>' +
    "</div>";
  }

  /* ---------- Quarters (coordinator only) ------------------------------
     Who has taken part, quarter by quarter. The current quarter is first and
     stays open; older ones collapse, because the question a coordinator asks
     about a past quarter ("who nominated, and did it land?") is answered by
     the summary line until they specifically want the names.
     -------------------------------------------------------------------- */
  views.quarters = function () {
    var history = store.quarterHistory || [];
    var current = history.filter(function (q) { return q.isCurrent; })[0];

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Quarters</h1><p>Participation by quarter — who has nominated, and what happened to it.</p></div>" +
        '<div class="spacer"></div>' + roleChip("COORDINATOR") + quarterChip() + "</div></div>" +

      (current
        ? '<div class="kpis">' +
            kpi("k-star", "Nominated so far", current.participants,
                "in " + esc(current.label), true) +
            kpi("k-total", "Nominations", current.totalNominations, "", true) +
            kpi("k-mtm", "Awaiting review", current.pending, "", true) +
            kpi("k-praise", "Approved", current.approved, "", true) +
          "</div>"
        : "") +

      '<div class="notice"><span class="glyph">▲</span><div>' +
        "<b>One nomination per person, per quarter.</b> Someone appearing once here has " +
        "used their entry for that quarter; a resubmission is marked as such and doesn't " +
        "count as a second. Quarters are calendar quarters in UTC." +
      "</div></div>" +

      (history.length
        ? history.map(quarterCard).join("")
        : '<div class="card"><div class="empty">No nominations on record yet.</div></div>');
  };

  /* One quarter, collapsed unless it's the current one. Past quarters are
     usually answered by the summary line; the names only matter when you go
     looking. */
  function quarterCard(q) {
    var open = q.isCurrent ? " open" : "";
    var people = (q.nominators || []).slice().sort(function (a, b) {
      return String(a.nominatorName || "").localeCompare(String(b.nominatorName || ""));
    });

    var rows = people.length
      ? '<div class="tablewrap"><table><thead><tr><th>Nominator</th><th>Nominated</th>' +
        "<th>Category</th><th>Status</th></tr></thead><tbody>" +
        people.map(function (p) {
          return (p.nominations || []).map(function (n, i) {
            return "<tr>" +
              (i === 0
                ? '<td class="nowrap"><span style="display:inline-flex;align-items:center;gap:10px">' +
                  avatar(p.nominatorName, "sm") + "<span><b>" + esc(p.nominatorName) + "</b><br>" +
                  '<span class="muted" style="font-size:11.5px">' + esc(p.nominatorEmail) +
                  "</span></span></span></td>"
                : "<td></td>") +
              "<td>" + esc(n.nomineeName) +
              (n.isResubmission ? ' <span class="valchip">resubmission</span>' : "") + "</td>" +
              "<td>" + (n.categoryLabel ? esc(n.categoryLabel) :
                '<span class="muted" style="font-size:12px">—</span>') + "</td>" +
              "<td>" + pill(n.status) + "</td></tr>";
          }).join("");
        }).join("") + "</tbody></table></div>"
      : '<div class="empty">Nobody has nominated in ' + esc(q.label) + " yet.</div>";

    return '<details class="quartercard"' + open + '><summary>' +
      '<span class="quartercard__label">' + esc(q.label) +
        (q.isCurrent ? ' <span class="tag live"><span class="dot"></span>current</span>' : "") +
      "</span>" +
      '<span class="quartercard__stats">' +
        esc(String(q.participants)) + " nominated · " +
        esc(String(q.totalNominations)) + " nomination" + (q.totalNominations === 1 ? "" : "s") +
        " · " + esc(String(q.approved)) + " approved" +
      "</span>" +
      '<span class="quartercard__deadline muted">deadline ' + esc(fmtDay(q.deadline)) + "</span>" +
      "</summary>" + rows + "</details>";
  }

  /* `filter` turns the tile into a button that filters the list below it.
     A count you can see but not act on makes you go and find the rows yourself,
     which is the whole job the tile was supposed to save you. */
  /* ---------- Activity Log (coordinator only) --------------------------
     Every recorded action, newest first. The per-nomination history answers
     "what happened to this one"; this answers "what has the team been doing",
     which is the question you have when reviewing how decisions get made
     rather than checking a single one.
     -------------------------------------------------------------------- */
  views.activity = function () {
    var rows = store.activity || [];
    var withEmail = rows.reduce(function (a, r) { return a + (r.comms || []).length; }, 0);
    var withNote = rows.filter(function (r) { return r.comment; }).length;

    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Activity Log</h1><p>Every decision, note and generated message — newest first.</p></div>" +
        '<div class="spacer"></div>' + roleChip("COORDINATOR") + tagLive() + "</div></div>" +

      '<div class="kpis">' +
        kpi("k-star", "Recorded actions", rows.length, "", true) +
        kpi("k-praise", "Messages composed", withEmail, "", true) +
        kpi("k-mtm", "With an internal note", withNote, "", true) +
      "</div>" +

      '<div class="notice"><span class="glyph">▲</span><div>' +
        "<b>Messages are generated here, not sent from here.</b> No mail server is " +
        "configured — <b>Open in Outlook</b> hands you the message as a draft, and you " +
        "send it. Each one is stored as written at the time, so editing a template later " +
        "doesn't rewrite past records." +
      "</div></div>" +

      (rows.length
        ? '<div class="card"><div class="body" style="padding-top:6px">' +
          '<ul class="timeline">' + rows.map(activityRow).join("") + "</ul></div></div>"
        : '<div class="card"><div class="empty">Nothing recorded yet — no decisions have been made.</div></div>');
  };

  function activityRow(e) {
    var a = ACTION[e.action] || { cls: "", g: "•", label: e.action };
    return '<li><span class="tl-dot ' + a.cls + '">' + a.g + "</span>" +
      '<span class="tl-body">' +
        '<span class="tl-what"><b>' + esc(a.label) + "</b> — " + esc(e.nomineeName) +
        (e.nominatorName ? ' <span class="muted">nominated by ' + esc(e.nominatorName) + "</span>" : "") +
        "</span>" +
        '<span class="tl-why muted">by ' + esc(e.coordinatorEmail) +
        (e.categoryLabel ? " · " + esc(e.categoryLabel) : "") + "</span>" +
        (e.reason ? '<span class="tl-why">' + esc(e.reason) + "</span>" : "") +
        (e.comment ? '<span class="tl-note"><b>Note:</b> ' + esc(e.comment) + "</span>" : "") +
        emailBlock(e) +
      "</span>" +
      '<span class="tl-when">' + esc(fmtDate(e.occurredAt)) + "</span></li>";
  }

  function kpi(cls, label, value, foot, live, filter) {
    var inner = '<div class="lab">' + esc(label) + (live ? "" : " " + tagSample()) + "</div>" +
      '<div class="val">' + esc(String(value)) + "</div>" +
      (foot ? '<div class="foot sub">' + foot + "</div>" : "");

    if (!filter) {
      return '<div class="kpi ' + cls + '">' + inner + "</div>";
    }
    return '<button type="button" class="kpi kpi--clickable ' + cls +
      '" data-status-filter="' + esc(filter) + '">' + inner +
      '<span class="kpi__cue">View →</span></button>';
  }

  /* ---------- Praises (shell) ---------- */
  var SAMPLE_PRAISES = [
    { from: "Aisling Kelly", to: "Sarah Murphy", ago: "2h ago", value: "Collaboration",
      msg: "Thanks for your amazing support on the client proposal. You went above and beyond!", likes: 24, comments: 6 },
    { from: "Mark Dalton", to: "Ravi Patel", ago: "5h ago", value: "Excellence",
      msg: "Great work on the Azure migration. Your expertise and calm approach made it a success!", likes: 18, comments: 3 },
    { from: "Laura Gomez", to: "James Reed", ago: "1d ago", value: "Integrity",
      msg: "Appreciate your support in preparing for the audit. Super thorough and proactive!", likes: 15, comments: 2 },
    { from: "Emma Doyle", to: "Niamh O'Connor", ago: "1d ago", value: "Community",
      msg: "Thank you for mentoring me through the project. I learned so much!", likes: 21, comments: 4 },
    { from: "Conor Byrne", to: "Data Platform Team", ago: "1d ago", value: "Collaboration",
      msg: "Brilliant teamwork on the data platform rollout. Couldn't have done it without you all!", likes: 30, comments: 7 },
    { from: "Sophie Martin", to: "Client Success Team", ago: "2d ago", value: "Customer Success",
      msg: "Huge thank you for the incredible support during the Go-Live. You were amazing!", likes: 27, comments: 5 }
  ];

  views.praises = function () {
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Praises Wall</h1><p>See the recognitions shared across the business.</p></div>" +
        '<div class="spacer"></div>' + tagShell() +
        '<a class="btn btn-praise" href="#/praises/new">Give a Praise</a></div></div>' +
      shellNotice("Praises, likes and comments aren't built yet.") +
      '<div class="card" style="margin-bottom:16px"><div class="body" ' +
        'style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div class="tabs"><button class="tab on">All</button><button class="tab">From my team</button>' +
        '<button class="tab">Practice</button><button class="tab">Location</button></div>' +
        '<div class="spacer"></div>' +
        '<input type="text" placeholder="Search praises…" style="max-width:240px" disabled>' +
      "</div></div>" +
      '<div class="wall">' + SAMPLE_PRAISES.map(function (p) {
        return '<div class="praise-card"><div class="top">' + avatar(p.from, "sm") +
          '<div style="min-width:0"><div class="from">' + esc(p.from) + "</div>" +
          '<div class="to">To ' + esc(p.to) + "</div></div>" +
          '<div class="spacer"></div><div class="muted" style="font-size:12px">' + esc(p.ago) + "</div></div>" +
          '<div class="msg">' + esc(p.msg) + "</div>" +
          '<div><span class="valchip">◎ ' + esc(p.value) + "</span></div>" +
          '<div class="foot"><span>👍 ' + p.likes + "</span><span>💬 " + p.comments + "</span>" +
          '<div class="spacer"></div><span>🔖</span></div></div>';
      }).join("") + "</div>";
  };

  views["praises/new"] = function () {
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Send a Praise</h1><p>A simple thank you can make someone's day.</p></div>" +
        '<div class="spacer"></div>' + tagShell() + "</div></div>" +
      shellNotice("Sending a praise isn't built yet.") +
      '<div class="grid-main"><div class="card"><div class="body">' +
        '<div class="field"><label for="prTo">To (recipient) <span class="req">*</span></label>' +
          '<input type="text" placeholder="Search employee…" id="prTo"></div>' +
        '<div class="field"><label for="prMsg">What are they being recognised for? ' +
          '<span class="req">*</span></label>' +
          '<textarea id="prMsg" maxlength="500" placeholder="Share what they did and the impact it had."></textarea>' +
          '<div class="counter"><span id="prCount">0</span> / 500</div></div>' +
        '<div class="field"><label>Which value(s) did they demonstrate?</label>' +
          '<div class="chips" id="prValues">' + VALUES.map(function (v) {
            return '<button type="button" class="chip" data-v="' + esc(v) + '">' + esc(v) + "</button>";
          }).join("") + "</div></div>" +
        '<div class="field"><label style="display:flex;gap:9px;align-items:flex-start;font-weight:400">' +
          '<input type="checkbox" id="prPublic" style="width:auto;margin-top:2px" checked>' +
          '<span><b style="font-weight:600">Make this praise visible on the Praise Wall</b><br>' +
          '<span class="muted" style="font-size:12.5px">Colleagues will see this praise.</span>' +
          "</span></label></div>" +
        '<div class="form-actions"><button class="btn-praise" disabled>Send Praise</button>' +
          "<button disabled>Save draft</button>" +
          '<span class="muted" style="font-size:12.5px">Not built yet</span></div>' +
      "</div></div>" +
      '<div class="helper"><h4>Preview</h4>' +
        '<div class="praise-card" style="box-shadow:none">' +
          '<div class="top">' + avatar(persona().name, "sm") +
          '<div><div class="from">' + esc(persona().name) + "</div>" +
          '<div class="to" id="prPrevTo">To …</div></div></div>' +
          '<div class="msg" id="prPrevMsg" style="min-height:40px">Your message will appear here.</div>' +
          '<div id="prPrevVals"></div></div></div></div>';
  };

  /* ---------- Moments that Matter (shell) ---------- */
  var MTM_TYPES = [
    { k: "Baby", ic: "👶" }, { k: "Wedding", ic: "💍" }, { k: "Bereavement", ic: "🕊" },
    { k: "Health", ic: "♥" }, { k: "Other", ic: "…" }
  ];
  var SAMPLE_MTM = [
    { id: "MTM-00124", type: "Baby", who: "Emma Doyle", date: "15 Sep 2026", st: "approved", lab: "Approved" },
    { id: "MTM-00123", type: "Bereavement", who: "John Walsh", date: "10 Sep 2026", st: "progress", lab: "In progress" },
    { id: "MTM-00122", type: "Wedding", who: "Sarah Murphy", date: "5 Sep 2026", st: "delivered", lab: "Delivered" },
    { id: "MTM-00121", type: "Baby", who: "Conor Byrne", date: "28 Aug 2026", st: "pending", lab: "Pending" },
    { id: "MTM-00120", type: "Health", who: "Laura Gomez", date: "20 Aug 2026", st: "declined", lab: "Declined" }
  ];

  views.mtm = function () {
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Moments that Matter</h1><p>" +
        (isCoordinator()
          ? "Requests from across the business, and where each one has got to."
          : "Track the status of your requests.") + "</p></div>" +
        '<div class="spacer"></div>' + tagShell() +
        '<a class="btn btn-mtm" href="#/mtm/new">Request MtM</a></div></div>' +
      shellNotice("Moments that Matter isn't built yet, so none of these requests are real.") +
      '<div class="card"><header><h2>' +
        (isCoordinator() ? "Moments that Matter requests" : "My Moments that Matter") + "</h2>" +
        '<div class="spacer"></div>' +
        // Filtering by outcome is a reviewer's job. An employee is looking at
        // their own handful of requests and can see the status on each row -
        // giving them a queue filter implies there is a queue to work through.
        (isCoordinator()
          ? '<div class="tabs"><button class="tab on">All</button><button class="tab">Pending</button>' +
            '<button class="tab">Approved</button><button class="tab">In progress</button>' +
            '<button class="tab">Delivered</button><button class="tab">Declined</button></div>'
          : '<span class="ep">' + SAMPLE_MTM.length + " request" +
            (SAMPLE_MTM.length === 1 ? "" : "s") + "</span>") +
        "</header>" +
        '<div class="tablewrap"><table><thead><tr><th>Request id</th><th>Type</th><th>Recipient</th>' +
        "<th>Submitted</th>" + (isCoordinator() ? "<th>Status</th>" : "") +
        "</tr></thead><tbody>" +
        SAMPLE_MTM.map(function (r) {
          var t = MTM_TYPES.filter(function (x) { return x.k === r.type; })[0] || { ic: "•" };
          return '<tr><td class="mono">' + esc(r.id) + "</td>" +
            "<td>" + t.ic + " " + esc(r.type) + "</td><td>" + esc(r.who) + "</td>" +
            '<td class="when">' + esc(r.date) + "</td>" +
            (isCoordinator()
              ? '<td><span class="pill ' + r.st + '"><span class="g">●</span>' +
                esc(r.lab) + "</span></td>"
              : "") + "</tr>";
        }).join("") + "</tbody></table></div></div>";
  };

  views["mtm/new"] = function () {
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Request a Moment that Matters</h1><p>We're here for life's special moments.</p></div>" +
        '<div class="spacer"></div>' + tagShell() + "</div></div>" +
      shellNotice("Submitting a request isn't built yet.") +
      '<div class="grid-main"><div class="card"><div class="body">' +
        '<div class="field"><label>Select type <span class="req">*</span></label>' +
          '<div class="chips" id="mtmTypes">' + MTM_TYPES.map(function (t, i) {
            return '<button type="button" class="chip' + (i === 0 ? " on" : "") + '">' +
              t.ic + " " + esc(t.k) + "</button>";
          }).join("") + "</div></div>" +
        '<div class="row2"><div class="field"><label>Recipient <span class="req">*</span></label>' +
          '<input type="text" placeholder="Search employee…"></div>' +
          '<div class="field"><label>Relationship</label>' +
          "<select><option>Select relationship…</option><option>Colleague</option>" +
          "<option>Team member</option><option>Manager</option></select></div></div>" +
        '<div class="field"><label>Request details <span class="req">*</span></label>' +
          '<textarea maxlength="500" placeholder="Tell us a bit more…"></textarea>' +
          '<div class="counter">0 / 500</div></div>' +
        '<div class="field"><label>Preferred delivery address <span class="req">*</span></label>' +
          '<textarea placeholder="Enter delivery address…"></textarea></div>' +
        '<div class="form-actions"><button class="btn-mtm" disabled>Submit request</button>' +
          "<button disabled>Save draft</button>" +
          '<span class="muted" style="font-size:12.5px">Not built yet</span></div>' +
      "</div></div>" +
      '<div class="helper"><h4>What\'s included — Baby hamper</h4>' +
        "<ul><li>Soft toy</li><li>Baby blanket</li><li>Essentials pack</li><li>Gift card</li></ul>" +
        "<h4>Guidelines</h4><ul><li>Requests are reviewed within 2 business days.</li>" +
        "<li>Delivery within 5–7 business days.</li><li>One request per occasion.</li></ul></div></div>";
  };

  /* ---------- Coordinator dashboard ---------- */
  var TREND = {
    months: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    star:   [42, 51, 47, 63, 71, 80],
    praise: [180, 240, 265, 310, 420, 524],
    mtm:    [8, 11, 9, 14, 18, 22]
  };

  views.dashboard = function () {
    var c = counts();
    return '<div class="page-head"><div class="head-row"><div>' +
        "<h1>Recognition Overview</h1><p>Monitor all types of recognition across the organisation.</p></div>" +
        '<div class="spacer"></div>' + roleChip("COORDINATOR") + tagShell() + "</div></div>" +
      shellNotice("Only the Star Award tiles below are real — they count rows in the database. " +
                  "Praises, MtM and both charts have no backing data.") +

      '<div class="kpis">' +
        kpi("k-star", "Star Awards pending review", c.PENDING_REVIEW,
            '<a class="linkish" href="#/queue">View queue</a>', true) +
        kpi("k-total", "Flagged by AI", store.nominations.filter(function (n) {
              return (n.aiFlags || []).length > 0;
            }).length, '<a class="linkish" href="#/ai">AI Summary</a>', true) +
        kpi("k-praise", "Praises this month", 524, "", false) +
        kpi("k-mtm", "MtM pending requests", 22, "", false) +
      "</div>" +

      '<div class="charts">' +
        '<div class="card"><header><h2>Recognition trends</h2>' +
          '<div class="spacer"></div>' + tagSample() + "</header>" +
          '<div class="body">' + trendChart() +
          '<div class="legend" style="margin-top:12px">' +
            legendKey("line", "var(--star)", "Star Awards") +
            legendKey("line", "var(--praise)", "Praises") +
            legendKey("line", "var(--mtm)", "Moments that Matter") +
          "</div>" +
          '<details style="margin-top:12px"><summary class="muted" ' +
            'style="cursor:pointer;font-size:12.5px">Table view</summary>' +
            trendTable() + "</details></div></div>" +

        '<div class="card"><header><h2>Recognition by type</h2>' +
          '<div class="spacer"></div>' + tagSample() + "</header>" +
          '<div class="body">' +
            '<div style="font-size:38px;font-weight:600;letter-spacing:-0.025em">626</div>' +
            '<div class="muted" style="margin-bottom:16px">recognitions this quarter</div>' +
            shareBar() +
          "</div></div>" +
      "</div>" +

      '<div class="grid2"><div class="card"><header><h2>Recent activity</h2>' +
        '<div class="spacer"></div>' + tagLive() + "</header>" +
        '<div class="body" style="padding-top:4px;padding-bottom:4px">' +
        (store.nominations.length
          ? store.nominations.slice(0, 4).map(function (n) {
              return '<div class="feed-item"><div class="ico" ' +
                'style="background:var(--star-soft);color:var(--star)">★</div>' +
                '<div class="txt"><div class="l1">Star Award nomination from <b>' +
                esc(n.nominatorName) + "</b> for <b>" + esc(n.nomineeName) + "</b></div></div>" +
                '<div class="ago">' + esc(ago(n.submittedAt)) + "</div></div>";
            }).join("")
          : '<div class="empty">No nominations yet.</div>') +
        "</div></div>" +
        '<div class="card"><header><h2>Quick actions</h2></header><div class="body">' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
          '<a class="btn" href="#/queue">Review Star Awards</a>' +
          '<a class="btn" href="#/ai">Open AI Summary</a>' +
          '<a class="btn" href="#/praises">View Praises Wall</a>' +
          '<a class="btn" href="#/mtm">Review MtM requests</a></div></div></div>' +
      "</div>";
  };

  function legendKey(kind, color, label) {
    return '<span class="key"><span class="' + (kind === "line" ? "line" : "sw") +
      '" style="background:' + color + '"></span>' + esc(label) + "</span>";
  }

  /* Multi-line trend: 3 series is categorical (identity), so each keeps its own
     validated hue. Direct end-labels only — no number on every point. */
  /* Hand-drawn SVG line chart. Three series, each with its own hue and a
     label at the line end rather than a separate legend to cross-reference.
     Sample data - there's no praise or MtM backend to chart. */
  function trendChart() {
    var W = 560, H = 220, PL = 38, PR = 96, PT = 14, PB = 30;
    var max = 560;
    var xs = TREND.months.map(function (_, i) {
      return PL + i * (W - PL - PR) / (TREND.months.length - 1);
    });
    var y = function (v) { return PT + (1 - v / max) * (H - PT - PB); };

    var grid = "", ticks = [0, 140, 280, 420, 560];
    ticks.forEach(function (t) {
      grid += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(t) + '" y2="' + y(t) +
        '" stroke="var(--grid)" stroke-width="1"/>' +
        '<text x="' + (PL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="10.5" ' +
        'fill="var(--muted)" style="font-variant-numeric:tabular-nums">' + t + "</text>";
    });

    var xlab = TREND.months.map(function (m, i) {
      return '<text x="' + xs[i] + '" y="' + (H - PB + 18) + '" text-anchor="middle" ' +
        'font-size="10.5" fill="var(--muted)">' + m + "</text>";
    }).join("");

    function series(vals, color, label) {
      var d = vals.map(function (v, i) { return (i ? "L" : "M") + xs[i] + " " + y(v); }).join(" ");
      var dots = vals.map(function (v, i) {
        return '<circle cx="' + xs[i] + '" cy="' + y(v) + '" r="3.2" fill="' + color +
          '" stroke="var(--surface)" stroke-width="2"><title>' + label + " · " +
          TREND.months[i] + ": " + v + "</title></circle>";
      }).join("");
      var last = vals[vals.length - 1];
      return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>' + dots +
        '<text x="' + (xs[xs.length - 1] + 10) + '" y="' + (y(last) + 4) + '" font-size="11" ' +
        'fill="var(--ink-2)">' + label + " " + last + "</text>";
    }

    return '<svg class="chart-svg" viewBox="0 0 ' + W + " " + H + '" role="img" ' +
      'aria-label="Recognition volume by type over six months (sample data)">' +
      grid + xlab +
      '<line x1="' + PL + '" x2="' + PL + '" y1="' + PT + '" y2="' + (H - PB) +
        '" stroke="var(--border)" stroke-width="1"/>' +
      series(TREND.praise, "var(--praise)", "Praises") +
      series(TREND.star, "var(--star)", "Star") +
      series(TREND.mtm, "var(--mtm)", "MtM") +
      "</svg>";
  }

  function trendTable() {
    return '<div class="tablewrap"><table class="tablemini" style="min-width:0"><thead><tr>' +
      "<th>Month</th><th>Star Awards</th><th>Praises</th><th>MtM</th></tr></thead><tbody>" +
      TREND.months.map(function (m, i) {
        return "<tr><td>" + m + "</td><td>" + TREND.star[i] + "</td><td>" +
          TREND.praise[i] + "</td><td>" + TREND.mtm[i] + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* Part-to-whole. The mockup used a donut, but its two largest slices are
     45% and 40% — close values a ring makes you squint at. A single stacked
     bar with the numbers written out reads at a glance and gives the
     light-mode orange the visible label its contrast needs. */
  function shareBar() {
    var parts = [
      { label: "Praises", value: 250, pct: 40, color: "var(--praise)" },
      { label: "Star Awards", value: 282, pct: 45, color: "var(--star)" },
      { label: "Moments that Matter", value: 94, pct: 15, color: "var(--mtm)" }
    ];
    var bar = '<div style="display:flex;gap:2px;height:34px;margin-bottom:16px">' +
      parts.map(function (p, i) {
        var r = i === 0 ? "6px 0 0 6px" : (i === parts.length - 1 ? "0 6px 6px 0" : "0");
        return '<div style="flex:' + p.pct + ';background:' + p.color + ';border-radius:' + r + '"></div>';
      }).join("") + "</div>";
    var rows = parts.map(function (p) {
      return '<div class="share-row"><span style="width:10px;height:10px;border-radius:3px;' +
        "background:" + p.color + ';display:inline-block"></span>' +
        '<span class="nm">' + esc(p.label) + "</span>" +
        '<span class="vl">' + p.value + "</span>" +
        '<span class="muted" style="width:38px;text-align:right">' + p.pct + "%</span></div>";
    }).join("");
    return bar + rows;
  }

  /* ---------- Reports / Help ---------- */
  views.reports = function () {
    return '<div class="page-head"><div class="head-row"><div><h1>Reports</h1>' +
      "<p>Exports and scheduled reporting.</p></div>" +
      '<div class="spacer"></div>' + tagShell() + "</div></div>" +
      shellNotice("Reporting isn't built yet.") +
      '<div class="card"><div class="empty">Nothing to show — this screen is a placeholder ' +
      "in the navigation only.</div></div>";
  };

  views.help = function () {
    return '<div class="page-head"><div class="head-row"><div><h1>Help &amp; Guidelines</h1>' +
      "<p>How recognition works in Spotlight.</p></div>" +
      '<div class="spacer"></div><span class="tag live"><span class="dot"></span>static content</span>' +
      "</div></div>" +
      '<div class="grid-main"><div class="card"><div class="body">' +
        '<h3 style="font-size:15px;margin-bottom:8px">Star Award</h3>' +
        '<p class="sub">For outstanding contributions that go above and beyond. Every nomination ' +
        "records a WHAT (the contribution) and a HOW (the value it demonstrated), and is reviewed " +
        "by a recognition coordinator before a decision is made.</p>" +
        '<h3 style="font-size:15px;margin:18px 0 8px">Praise</h3>' +
        '<p class="sub">Everyday thanks. Lighter weight than a Star Award and optionally shared ' +
        "on the Praises Wall.</p>" +
        '<h3 style="font-size:15px;margin:18px 0 8px">Moments that Matter</h3>' +
        '<p class="sub">Gifts and support for life events — new babies, weddings, bereavement ' +
        "and health.</p>" +
        '<h3 style="font-size:15px;margin:18px 0 8px">The six core values</h3>' +
        '<p class="sub">Every Star Award nomination names one of these, and the HOW ' +
        "explains how it was shown:</p>" +
        '<ul class="sub" style="padding-left:18px;margin:0 0 4px">' +
        VALUES.map(function (v) { return "<li>" + esc(v) + "</li>"; }).join("") +
        "</ul>" +
        '<h3 style="font-size:15px;margin:18px 0 8px">Profiles and roles</h3>' +
        '<p class="sub">The switcher in the bottom-left corner changes which view you are ' +
        "looking at. <b>Employee</b> can submit recognition and track their own. " +
        "<b>Admin / HR</b> adds the Review Queue, where nominations are approved, rejected " +
        "or sent back for more detail, plus the organisation-wide dashboard. There is no " +
        "sign-in behind this yet — it changes the view, not your access.</p>" +
        '<h3 style="font-size:15px;margin:18px 0 8px">Rules enforced today</h3>' +
        '<ul class="sub" style="padding-left:18px;margin:0">' +
        "<li>Every field is required.</li>" +
        "<li>Both email addresses must be valid.</li>" +
        "<li>You can't nominate yourself — checked on the email address, case-insensitively.</li>" +
        "<li>Every nomination names one of the six core values, picked from a list.</li>" +
        "<li>New nominations are always created as PENDING_REVIEW.</li>" +
        "<li>A nomination can only be decided once — approve, reject and resubmission " +
        "requests all require it to still be pending.</li>" +
        "<li>Every decision is written to an audit log with the coordinator's email.</li></ul>" +
      "</div></div>" +
      '<div class="helper"><h4>Build status</h4>' +
        '<p style="margin:0 0 10px;font-size:12.5px;color:var(--ink-2)">Star Awards are ' +
        "implemented end to end, including AI-assisted review and the full decision workflow. " +
        "Praises and Moments that Matter exist as screens only.</p>" +
        '<div style="display:flex;flex-direction:column;gap:7px">' +
        '<div><span class="tag live"><span class="dot"></span>Live</span> ' +
        '<span class="muted" style="font-size:12px">Home, Submit, My Recognition, ' +
        "Star Awards, Review Queue</span></div>" +
        '<div><span class="tag shell"><span class="dot"></span>UI only</span> ' +
        '<span class="muted" style="font-size:12px">Praises, MtM, Dashboard charts, Reports</span>' +
        "</div></div></div></div>";
  };

  /* =================================================================
     Detail pane
     ================================================================= */

  function showDetail(id) {
    openDetailId = id;
    $$("tbody tr.clickable").forEach(function (tr) {
      tr.classList.toggle("selected", tr.getAttribute("data-id") === id);
    });

    var d = $("#detail");
    if (!d) return;
    d.className = "show";
    d.innerHTML = '<p class="muted">Loading…</p>';

    fetch(API + "/" + id)
      .then(function (res) {
        return res.json().then(function (b) { return { ok: res.ok, body: b }; });
      })
      .then(function (res) {
        if (!res.ok) {
          d.innerHTML = '<p style="color:var(--critical)">' +
            esc(res.body.error || "Not found") + "</p>";
          return;
        }
        renderDetail(res.body);
      })
      .catch(function (e) {
        d.innerHTML = '<p style="color:var(--critical)">Couldn\'t load — ' + esc(e.message) + "</p>";
      });
  }

  /* ---------- compare ------------------------------------------------
     Reading two nominations by opening one, remembering it, and opening the
     other is how inconsistent decisions happen. Putting them side by side
     makes "is this one really weaker than that one?" answerable by looking.
     -------------------------------------------------------------------- */
  var compareIds = [];

  function updateCompareButton() {
    var btn = $("#compareBtn");
    if (!btn) return;
    btn.disabled = compareIds.length < 2;
    btn.textContent = compareIds.length
      ? "Compare " + compareIds.length + " selected"
      : "Compare selected";
  }

  function wireCompare() {
    var table = $("#starTable");
    if (table) {
      table.addEventListener("change", function (ev) {
        var box = ev.target.closest ? ev.target.closest("[data-tick]") : null;
        if (!box) return;
        var id = box.getAttribute("data-tick");
        var at = compareIds.indexOf(id);
        if (box.checked && at === -1) { compareIds.push(id); }
        if (!box.checked && at !== -1) { compareIds.splice(at, 1); }
        updateCompareButton();
      });
      // A tick is not a row click - without this, selecting also opens the
      // detail pane underneath.
      table.addEventListener("click", function (ev) {
        if (ev.target.closest && ev.target.closest("[data-tick]")) { ev.stopPropagation(); }
      });
    }

    var btn = $("#compareBtn");
    if (btn) btn.addEventListener("click", renderCompare);
  }

  function renderCompare() {
    var box = $("#compareBox");
    if (!box) return;

    var picked = compareIds
      .map(function (id) {
        return store.nominations.filter(function (n) { return n.id === id; })[0];
      })
      .filter(Boolean);

    if (picked.length < 2) { box.innerHTML = ""; return; }

    box.innerHTML =
      '<div class="compare"><div class="compare__head">' +
        "<b>Comparing " + picked.length + " nominations</b>" +
        '<span class="muted">Same fields, side by side.</span>' +
        '<div class="spacer"></div>' +
        '<button type="button" class="linkish" id="clearCompare">Clear selection</button>' +
      "</div>" +
      '<div class="compare__grid" style="grid-template-columns:repeat(' + picked.length +
        ',minmax(260px,1fr))">' +
        picked.map(compareColumn).join("") +
      "</div></div>";

    $("#clearCompare").addEventListener("click", function () {
      compareIds = [];
      $$(".rowtick").forEach(function (t) { t.checked = false; });
      updateCompareButton();
      box.innerHTML = "";
    });

    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function compareColumn(n) {
    var flags = (n.aiFlags || []).map(function (f) {
      return '<span class="valchip flag">▲ ' + esc(f.label || f.flag) + "</span>";
    }).join(" ");

    return '<div class="compare__col">' +
      '<div class="compare__who">' + avatar(n.nomineeName, "sm") +
        "<span><b>" + esc(n.nomineeName) + "</b><br>" +
        '<span class="muted" style="font-size:11.5px">by ' + esc(n.nominatorName) + "</span></span>" +
      "</div>" +
      compareRow("Score", n.aiScore == null
        ? '<span class="muted">not scored</span>'
        : "<b>" + esc(String(n.aiScore)) + "</b>/100") +
      compareRow("Category", n.categoryLabel || "—") +
      compareRow("Core value", n.coreValueLabel || "not identified") +
      compareRow("Practice", esc(n.practice) + " · " + esc(n.location)) +
      compareRow("What", esc(n.whatText)) +
      compareRow("How", esc(n.howText)) +
      compareRow("Flags", flags || '<span class="muted">none</span>') +
      "</div>";
  }

  function compareRow(label, value) {
    return '<div class="compare__field"><div class="k">' + esc(label) + "</div>" +
      '<div class="compare__val">' + value + "</div></div>";
  }

  /* The expanded record under a table row. What a coordinator sees here is
     quite different from what an employee sees - AI assessment, decision
     buttons and history are all coordinator-only. */
  function renderDetail(n) {
    var d = $("#detail");
    if (!d) return;

    d.innerHTML =
      '<div style="display:flex;align-items:center;gap:11px;margin-bottom:14px;flex-wrap:wrap">' +
        avatar(n.nomineeName, "sm") +
        '<h3 style="font-size:15px">' + esc(n.nomineeName) + "</h3>" +
        (isCoordinator() ? pill(n.status) : "") +
        '<div class="spacer"></div><button class="linkish" id="closeDetail">Close</button></div>' +

      // You see the assessment of words you wrote yourself, because it tells you
      // how to improve them. You do not see the model's read on a nomination
      // somebody else wrote about you - that is a different thing, and not
      // obviously a kind one. Coordinators see everything; it is their review aid.
      (canSeeAi() ? aiPanel(n) : "") +
      (isCoordinator() ? actionBar(n) : "") +

      '<div class="prose"><div class="k">What</div><div class="v">' + esc(n.whatText) + "</div></div>" +
      '<div class="prose"><div class="k">How' +
        (n.coreValueLabel ? " — " + esc(n.coreValueLabel) : "") +
        '</div><div class="v">' + esc(n.howText) + "</div></div>" +

      (n.rejectionReason
        ? '<div class="prose"><div class="k">' +
          (n.status === "NEEDS_RESUBMISSION" ? "What to add before resubmitting" : "Reason given") +
          '</div><div class="v">' + esc(n.rejectionReason) + "</div></div>"
        : "") +

      '<div class="meta">' +
        metaCell("Id", n.id) +
        metaCell("Nominated by", n.nominatorName + " · " + (n.nominatorEmail || "—")) +
        metaCell("Nominee", n.nomineeName + " · " + (n.nomineeEmail || "—")) +
        metaCell("Category", categoryLabel(n) || "Uncategorised") +
        metaCell("Core value", n.coreValueLabel || "not identified") +
        metaCell("Practice", n.practice) + metaCell("Location", n.location) +
        metaCell("Submitted", fmtDate(n.submittedAt)) +
        metaCell("Decision date", fmtDate(n.decisionDate)) +
        // Who reviewed it is internal. An employee learning which named
        // coordinator turned their nomination down invites them to go and argue
        // with that person, which helps nobody and discourages honest reviewing.
        (isCoordinator() && n.coordinatorEmail
          ? metaCell("Decided by", n.coordinatorEmail) : "") +
        metaCell("Comms sent", fmtDate(n.commsSentDate)) +
        metaCell("Resubmission of", n.originalNominationId || "—") +
      "</div>" +

      (isCoordinator()
        ? '<div style="margin-top:16px"><div class="k" style="margin-bottom:8px">Activity history</div>' +
          '<div id="auditBox"><p class="muted" style="font-size:12.5px">Loading…</p></div></div>'
        : "");

    $("#closeDetail").addEventListener("click", closeDetail);
    if (isCoordinator()) {
      wireActions(n);
      loadAudit(n.id);
    }
  }

  function closeDetail() {
    var d = $("#detail");
    openDetailId = null;
    if (d) { d.className = ""; d.innerHTML = ""; }
    $$("tbody tr.clickable").forEach(function (tr) { tr.classList.remove("selected"); });
  }

  /* Flags arrive as {flag, label, source, reason}. The reason is the whole
     value of a flag to a reviewer, so it is rendered inline rather than hidden
     behind a tooltip, and the source is shown because "a rule matched this
     string" and "a model thought so" warrant different amounts of trust. */
  function flagList(flags) {
    if (!flags || !flags.length) {
      return '<span class="muted" style="font-size:12.5px">No flags raised.</span>';
    }
    return '<ul class="flagdetail">' + flags.map(function (f) {
      var isRule = f.source === "RULE";
      return '<li class="flagdetail__item">' +
        '<div class="flagdetail__head">' +
          '<span class="valchip flag">▲ ' + esc(f.label || f.flag) + "</span>" +
          '<span class="flagdetail__src ' + (isRule ? "rule" : "ai") + '">' +
          (isRule ? "rule" : "AI") + "</span></div>" +
        (f.reason ? '<p class="flagdetail__why">' + esc(f.reason) + "</p>" : "") +
      "</li>";
    }).join("") + "</ul>";
  }

  /* Five categories is past the point where colour alone is readable, so the
     chip always carries its full label and the tint is only a secondary cue. */
  var CATEGORY_TINT = {
    COLLABORATION_AND_ENGAGEMENT: "var(--praise)",
    CUSTOMER_IMPACT: "var(--info)",
    INNOVATION_AND_GROWTH: "var(--star)",
    PERFORMANCE_AND_EFFICIENCY: "var(--mtm)",
    QUALITY_AND_COMPLIANCE: "var(--good)"
  };

  /* Category, practice and location together. The brief calls for practice and
     location filtering specifically - those are how the programme is reported on
     internally, by division. */
  function filterBar() {
    return '<div class="filterbar">' +
      '<label for="nameSearch">Name</label>' +
      '<input type="text" id="nameSearch" placeholder="Nominee or nominator…" ' +
      'autocomplete="off" style="max-width:190px">' +
      '<label for="catFilter">Category</label>' +
      '<select id="catFilter"><option value="">All categories</option>' +
        store.categories.map(function (c) {
          return '<option value="' + esc(c.value) + '">' + esc(c.label) + "</option>";
        }).join("") +
        '<option value="__none">Uncategorised</option></select>' +
      '<label for="practiceFilter">Practice</label>' +
      '<select id="practiceFilter"><option value="">All practices</option>' +
        distinct("practice").map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        }).join("") + "</select>" +
      '<label for="locationFilter">Location</label>' +
      '<select id="locationFilter"><option value="">All locations</option>' +
        distinct("location").map(function (v) {
          return '<option value="' + esc(v) + '">' + esc(v) + "</option>";
        }).join("") + "</select>" +
      '<span class="spacer"></span>' +
      '<button type="button" class="linkish" id="clearFilters">Clear</button>' +
      '<span class="muted" id="filterCount"></span></div>';
  }

  /* Options come from the data rather than a fixed list, so a practice nobody
     has used yet doesn't appear and a new one shows up without a code change. */
  function distinct(field) {
    var seen = {};
    store.nominations.forEach(function (n) {
      if (n[field]) seen[n[field]] = true;
    });
    return Object.keys(seen).sort();
  }

  function categoryChip(n) {
    var label = categoryLabel(n);
    if (!label) {
      return '<span class="muted" style="font-size:12px">Uncategorised</span>';
    }
    var tint = CATEGORY_TINT[n.category] || "var(--muted)";
    return '<span class="catchip"><span class="catchip__dot" style="background:' + tint +
      '"></span>' + esc(label) + "</span>";
  }

  /* The AI assessment is a reviewer's tool and nothing else. Employees see no
     score, no rationale and no flags - not even on their own nomination. A
     nominator reading "41/100, weak justification" about words they wrote is
     being given a machine's opinion dressed as a verdict, which is the opposite
     of what an advisory signal is for. */
  function canSeeAi() {
    return isCoordinator();
  }

  /* The AI assessment. Handles three cases: a real score, no score because
     the call failed, and no score on an older row saved before empty
     responses were treated as failures. */
  function aiPanel(n) {
    var flags = flagList(n.aiFlags);

    // No score means the evaluator never produced one. Say which of the two
    // reasons it was rather than showing an empty gauge.
    if (n.aiScore == null) {
      // COMPLETED with no score is a record written before empty model responses
      // were treated as failures. Say that plainly rather than printing
      // "Completed" over a blank assessment, which reads as "no concerns found".
      var why = n.aiEvaluationStatus === "COMPLETED"
        ? "The evaluator returned no score for this one — an older record, saved before empty " +
          "responses were classified as failures."
        : (AI_STATUS[n.aiEvaluationStatus] || "No AI evaluation was recorded.");

      return '<div class="ai-panel"><div class="ai-panel__head">' +
        "<h4>AI assessment</h4>" +
        '<span class="tag shell"><span class="dot"></span>unavailable</span></div>' +
        '<p class="ai-rationale" style="margin:0 0 10px">' + esc(why) +
        " Rule-based flags below still apply, and this nomination can be reviewed normally.</p>" +
        flags + "</div>";
    }

    var score = Number(n.aiScore);
    var color = score >= 70 ? "var(--good)" : (score >= 45 ? "var(--warning)" : "var(--critical)");

    return '<div class="ai-panel"><div class="ai-panel__head">' +
      "<h4>AI assessment</h4>" +
      (n.aiPromptVersion ? '<span class="muted" style="font-size:11.5px">prompt ' +
        esc(n.aiPromptVersion) + "</span>" : "") +
      '<div class="spacer"></div>' +
      '<span class="muted" style="font-size:11.5px">advisory — does not decide anything</span></div>' +

      '<div class="ai-score">' +
        '<span class="ai-score__num" style="color:' + color + '">' + esc(String(score)) + "</span>" +
        '<span class="ai-score__den">/ 100</span>' +
        '<span class="ai-score__bar"><span class="ai-score__fill" style="width:' +
          Math.max(0, Math.min(100, score)) + "%;background:" + color + '"></span></span>' +
      "</div>" +

      (n.aiRationale ? '<p class="ai-rationale" style="margin:0 0 10px">' +
        esc(n.aiRationale) + "</p>" : "") +
      flags + "</div>";
  }

  /* Decision buttons, or an explanation of why there aren't any. A nomination
     can only be decided once - the API enforces it, and this says so rather
     than offering buttons that would 409. */
  function actionBar(n) {
    if (n.status !== "PENDING_REVIEW") {
      return '<div class="actionbar"><span class="actionbar__label">' +
        "This nomination was already decided — " + esc((STATUS[n.status] || {}).label || n.status) +
        (n.decisionDate ? " on " + esc(fmtDate(n.decisionDate)) : "") +
        (n.coordinatorEmail ? " by " + esc(n.coordinatorEmail) : "") +
        ". A nomination can only be decided once.</span></div>";
    }

    return '<div class="actionbar">' +
        '<span class="actionbar__label">Deciding as <b>' + esc(persona().email) + "</b></span>" +
        '<div class="spacer"></div>' +
        '<button type="button" class="btn-sm" id="checkCompleteness">☑ Check completeness</button>' +
        '<button type="button" class="btn-approve btn-sm" data-act="approve">✓ Approve</button>' +
        '<button type="button" class="btn-reject btn-sm" data-act="reject">✕ Reject</button>' +
        '<button type="button" class="btn-sm" data-act="request-resubmission">↩ Request resubmission</button>' +
      "</div>" +
      '<div id="completenessBox"></div>' +
      '<form class="reason-form" id="reasonForm" hidden>' +
        '<div class="field" style="margin-bottom:10px">' +
          '<label for="reasonText" id="reasonLabel"></label>' +
          '<textarea id="reasonText" rows="3"></textarea>' +
          '<div class="err" id="reasonErr"></div></div>' +
        '<div class="field" style="margin-bottom:10px">' +
          '<label for="commentText">Internal note (optional)</label>' +
          '<textarea id="commentText" rows="2" placeholder="Context for whoever reads this record later."></textarea>' +
          '<p class="field__hint">Included in the message to the nominator and kept in the log.</p></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button type="submit" class="btn-star btn-sm" id="reasonConfirm">Confirm</button>' +
          '<button type="button" class="btn-sm" id="reasonCancel">Cancel</button></div>' +
      "</form>";
  }

  /* Attaches the decision buttons. Approve opens the same form as the other
     two but with the reason box hidden, so a note can still be attached
     without one being demanded. */
  function wireActions(n) {
    var pendingAct = null;

    var completenessBtn = $("#checkCompleteness");
    if (completenessBtn) completenessBtn.addEventListener("click", function () {
      completenessBtn.disabled = true;
      completenessBtn.textContent = "Checking…";
      fetch(API + "/" + n.id + "/completeness")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (result) {
          completenessBtn.disabled = false;
          completenessBtn.textContent = "☑ Check completeness";
          if (!result) {
            $("#completenessBox").innerHTML =
              '<p style="color:var(--critical);font-size:12.5px">' +
              "Couldn't run the check.</p>";
            return;
          }
          renderCompleteness(result);
        })
        .catch(function () {
          completenessBtn.disabled = false;
          completenessBtn.textContent = "☑ Check completeness";
        });
    });

    $$("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var act = btn.getAttribute("data-act");
        pendingAct = act;
        var form = $("#reasonForm");
        var reasonField = $("#reasonText").closest(".field");

        if (act === "approve") {
          // Approving needs no justification, but a note is often worth having,
          // so the form still opens - with the reason box hidden.
          reasonField.hidden = true;
          $("#reasonConfirm").textContent = "Confirm approval";
          $("#reasonErr").textContent = "";
          form.hidden = false;
          $("#commentText").focus();
          return;
        }
        reasonField.hidden = false;

        // Reject and request-resubmission both require a reason: the person on
        // the other end gets told why, so an empty one is not acceptable.
        $("#reasonLabel").textContent = act === "reject"
          ? "Why is this being rejected? The nominator will be sent this."
          : "What does the nominator need to add? Be specific — they'll build on their original wording.";
        $("#reasonConfirm").textContent = act === "reject" ? "Confirm rejection" : "Send back for detail";
        $("#reasonErr").textContent = "";
        form.hidden = false;
        $("#reasonText").focus();
      });
    });

    var cancel = $("#reasonCancel");
    if (cancel) cancel.addEventListener("click", function () {
      $("#reasonForm").hidden = true;
      $("#reasonText").value = "";
    });

    var form = $("#reasonForm");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var reason = $("#reasonText").value.trim();
      var comment = $("#commentText").value.trim();
      // The completeness shortcut opens this form directly, without going
      // through a data-act button, so take the action from the form itself.
      if (!pendingAct) { pendingAct = form.getAttribute("data-act"); }
      if (pendingAct !== "approve" && !reason) {
        $("#reasonErr").textContent = "A reason is required.";
        $("#reasonErr").style.display = "block";
        return;
      }
      submitDecision(n, pendingAct, pendingAct === "approve" ? null : reason, comment);
    });
  }

  /* The completeness result: a checklist, plus the send-back text it produces.
     The "use this" button is the point of the feature - it turns "this is thin"
     into a specific, consistent request without the coordinator writing a
     paragraph, and it stays editable because it is a starting point. */
  function renderCompleteness(result) {
    var box = $("#completenessBox");
    if (!box) return;

    var rows = result.criteria.map(function (c) {
      return '<li class="checkitem ' + (c.passed ? "pass" : "fail") + '">' +
        '<span class="checkitem__mark" aria-hidden="true">' + (c.passed ? "✓" : "✕") + "</span>" +
        '<span class="checkitem__body"><span class="checkitem__label">' + esc(c.label) + "</span>" +
        (c.passed ? "" : '<span class="checkitem__remedy">' + esc(c.remedy) + "</span>") +
        "</span></li>";
    }).join("");

    box.innerHTML =
      '<div class="completeness ' + (result.complete ? "complete" : "incomplete") + '">' +
        '<div class="completeness__head">' +
          "<b>" + (result.complete
            ? "Complete — nothing missing"
            : (result.totalCount - result.passedCount) + " of " + result.totalCount + " checks not met") +
          "</b>" +
          '<span class="muted">' + result.passedCount + "/" + result.totalCount + " passed</span>" +
          '<div class="spacer"></div>' +
          '<button type="button" class="linkish" id="closeCompleteness">Hide</button>' +
        "</div>" +
        '<ul class="checklist">' + rows + "</ul>" +
        (result.complete
          ? '<p class="completeness__note muted">This is about reviewability, not merit — ' +
            "it says the nomination can be judged, not that it should be approved.</p>"
          : '<div class="completeness__action">' +
            '<button type="button" class="btn-sm" id="useCompleteness">Use as send-back message</button>' +
            '<span class="muted">Fills the resubmission box with what is missing. You can edit it.</span>' +
            "</div>") +
      "</div>";

    $("#closeCompleteness").addEventListener("click", function () { box.innerHTML = ""; });

    var use = $("#useCompleteness");
    if (use) use.addEventListener("click", function () {
      var form = $("#reasonForm");
      var reasonField = $("#reasonText").closest(".field");
      reasonField.hidden = false;
      $("#reasonLabel").textContent =
        "What does the nominator need to add? Be specific — they'll build on their original wording.";
      $("#reasonConfirm").textContent = "Send back for detail";
      $("#reasonText").value = result.suggestedMessage;
      $("#reasonErr").textContent = "";
      form.hidden = false;
      form.setAttribute("data-act", "request-resubmission");
      $("#reasonText").focus();
    });
  }

  /* Sends the decision, then reloads and reopens the same record so the
     coordinator sees it land. Without the reopen you get dropped back to an
     unchanged-looking table and can't tell whether it worked. */
  function submitDecision(n, action, reason, comment) {
    var body = { coordinatorEmail: persona().email };
    if (reason) body.reason = reason;
    if (comment) body.comment = comment;

    $$("[data-act]").forEach(function (b) { b.disabled = true; });
    var confirmBtn = $("#reasonConfirm");
    if (confirmBtn) confirmBtn.disabled = true;

    fetch(API + "/" + n.id + "/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, body: b }; })
                       .catch(function () { return { ok: r.ok, body: {} }; });
      })
      .then(function (res) {
        if (!res.ok) {
          var msg = res.body.error ||
                    (res.body.reason ? "Reason: " + res.body.reason : "") ||
                    "That decision couldn't be saved.";
          toast({ kind: "coordinator", title: "Decision not recorded", msg: msg, sticky: true });
          $$("[data-act]").forEach(function (b) { b.disabled = false; });
          if (confirmBtn) confirmBtn.disabled = false;
          return;
        }

        var labels = {
          "approve": "Approved",
          "reject": "Rejected",
          "request-resubmission": "Sent back for more detail"
        };
        toast({
          kind: "coordinator",
          title: labels[action] + " — " + n.nomineeName,
          msg: "Recorded against " + persona().email + " in the audit log, and comms were sent."
        });

        // Re-read the list so counts and pills are right, then reopen the same
        // record so the coordinator sees the decision landed rather than being
        // dropped back to an unchanged-looking table.
        return Promise.all([loadNominations(), loadActivity(), loadQuarterHistory()])
          .then(function () {
            render();
            showDetail(n.id);
          });
      })
      .catch(function (e) {
        toast({ kind: "coordinator", title: "Couldn't save that decision", msg: "The app didn't respond. Check it's still running and try again.", sticky: true });
        $$("[data-act]").forEach(function (b) { b.disabled = false; });
        if (confirmBtn) confirmBtn.disabled = false;
      });
  }

  /* Decision history for one nomination, including the messages each decision
     generated. Coordinator-only - it names who did what. */
  function loadAudit(id) {
    fetch(API + "/" + id + "/audit-log")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (entries) {
        var box = $("#auditBox");
        if (!box) return;
        if (!entries.length) {
          box.innerHTML = '<p class="muted" style="font-size:12.5px">' +
            "No decisions recorded yet — this nomination hasn't been reviewed.</p>";
          return;
        }
        box.innerHTML = '<ul class="timeline">' + entries.map(function (e) {
          var a = ACTION[e.action] || { cls: "", g: "•", label: e.action };
          return '<li><span class="tl-dot ' + a.cls + '">' + a.g + "</span>" +
            '<span class="tl-body"><span class="tl-what"><b>' + esc(a.label) + "</b> by " +
            esc(e.coordinatorEmail) + "</span>" +
            (e.reason ? '<span class="tl-why">' + esc(e.reason) + "</span>" : "") +
            (e.comment
              ? '<span class="tl-note"><b>Note:</b> ' + esc(e.comment) + "</span>"
              : "") +
            emailBlock(e) +
            "</span>" +
            '<span class="tl-when">' + esc(fmtDate(e.occurredAt)) + "</span></li>";
        }).join("") + "</ul>";
      })
      .catch(function (e) {
        var box = $("#auditBox");
        if (box) box.innerHTML = '<p class="muted" style="font-size:12.5px">' +
          "Couldn't load history — " + esc(e.message) + "</p>";
      });
  }

  /* Composed messages waiting to be opened in Outlook, keyed by the id on their
     button. The bodies are long and the buttons are rendered as HTML strings, so
     the text is held here rather than round-tripped through a data- attribute. */
  var commsSeq = 0;
  var commsById = {};

  /* A mailto: URL Outlook will accept. Line breaks have to be CRLF before
     encoding - encodeURIComponent turns a bare \n into %0A, which Outlook is
     inconsistent about honouring, while %0D%0A it always respects. */
  function mailtoUrl(to, cc, subject, body) {
    var url = "mailto:" + encodeURIComponent(to || "") +
      "?subject=" + encodeURIComponent(subject || "");
    if (cc && cc !== to) url += "&cc=" + encodeURIComponent(cc);
    if (body) url += "&body=" + encodeURIComponent(body.replace(/\r?\n/g, "\r\n"));
    return url;
  }

  /* Windows passes a mailto: to the shell, which truncates somewhere around
     2083 characters. Staying under that decides whether the body travels in the
     link or via the clipboard. */
  var MAILTO_MAX = 1900;

  /* Best-effort clipboard write. The async API needs a secure context, which
     localhost is but a plain-http LAN address is not, so the old execCommand
     path stays as a fallback. Resolves false when neither worked. */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /* Hands one composed message to Outlook as a draft. Nothing is sent - the
     admin still reads it and presses send themselves.

     Long messages don't survive the shell's URL limit, so those open addressed
     but empty with the body on the clipboard instead. Losing the body silently
     would be worse than asking for one paste. */
  function openInOutlook(c) {
    if (!c) return;
    var full = mailtoUrl(c.to, c.cc, c.subject, c.body);

    if (full.length <= MAILTO_MAX) {
      window.location.href = full;
      toast({
        kind: "coordinator",
        title: "Draft opened in Outlook",
        msg: "Addressed to " + (c.to || "—") + ". Nothing has been sent — read it over and send it yourself."
      });
      return;
    }

    // Open the draft now, while the click that triggered this is still counted
    // as user activation. Waiting for the clipboard promise to settle first
    // risks the browser refusing to hand off to the mail handler at all.
    window.location.href = mailtoUrl(c.to, c.cc, c.subject, "");

    copyText(c.body || "").then(function (copied) {
      toast({
        kind: "coordinator",
        sticky: true,
        title: copied ? "Draft opened — paste the message in" : "Draft opened — copy the message in",
        msg: copied
          ? "This one is too long to travel in the link, so the full text is on your clipboard. Press Ctrl+V in the Outlook draft."
          : "This one is too long to travel in the link, and the clipboard wasn't available. Copy the text from the message below into the draft."
      });
    });
  }

  /* One delegated listener for every Open in Outlook button. The blocks are
     injected by two independent paths that re-render on their own schedule
     (the audit box and the activity log), so there is no shared moment at
     which per-button listeners could be attached. */
  function wireOutlookButtons() {
    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest ? ev.target.closest("[data-comm]") : null;
      if (!btn) return;
      // The button sits inside a <summary>: without this, using it would also
      // toggle the block open or shut.
      ev.preventDefault();
      ev.stopPropagation();
      openInOutlook(commsById[btn.getAttribute("data-comm")]);
    });
  }

  /* The message the decision generated, verbatim. Collapsed by default: a
     coordinator scanning history wants the actions, and only occasionally the
     exact wording someone received. The button is in the summary so it can be
     used without expanding anything. */
  function emailBlock(e) {
    var comms = e.comms || [];
    if (!comms.length) return "";
    return comms.map(function (c) {
      var who = c.recipientRole === "NOMINEE" ? "nominee" : "nominator";
      var id = "comm" + (++commsSeq);
      commsById[id] = {
        to: c.recipientEmail, cc: e.coordinatorEmail,
        subject: c.subject, body: c.body
      };
      return '<details class="emaillog"><summary>' +
        '<span class="emaillog__tag">to ' + who + "</span> " +
        '<span class="emaillog__subj">' + esc(c.subject || "") +
        '<span class="muted"> — ' + esc(c.recipientEmail || "—") + "</span></span>" +
        '<button type="button" class="btn-sm emaillog__send" data-comm="' + id + '"' +
        ' title="Opens a pre-filled draft in Outlook. Nothing is sent until you send it.">' +
        "✉ Open in Outlook</button></summary>" +
        '<div class="emaillog__meta muted">Composed ' + esc(fmtDate(c.sentAt)) +
        " · not sent automatically — use Open in Outlook to send it yourself</div>" +
        '<pre class="emaillog__body">' + esc(c.body || "") + "</pre></details>";
    }).join("");
  }

  function metaCell(k, v) {
    return '<div><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + "</div></div>";
  }

  /* =================================================================
     Wiring
     ================================================================= */

  function allowedRoutes() {
    var role = persona().role;
    return ROUTES.filter(function (r) { return r.roles.indexOf(role) !== -1; });
  }

  function routeAllowed(r) {
    var base = r.split("/")[0];
    // Sub-routes like praises/new inherit their parent's permission.
    return allowedRoutes().some(function (x) { return x.id === base; });
  }

  function renderNav(current) {
    var allowed = allowedRoutes();
    var pending = store.nominations.filter(function (n) {
      return n.status === "PENDING_REVIEW";
    }).length;

    var groups = [];
    allowed.forEach(function (r) {
      if (groups.indexOf(r.group) === -1) groups.push(r.group);
    });

    $("#nav").innerHTML = groups.map(function (g) {
      return '<div class="navgroup">' + esc(g) + "</div>" +
        allowed.filter(function (r) { return r.group === g; }).map(function (r) {
          var active = current === r.id;
          return '<a href="#/' + r.id + '"' + (active ? ' class="active"' : "") + ">" +
            '<span class="ic">' + r.ic + "</span>" + esc(r.label) +
            (r.badge === "pending" && pending ? '<span class="badge-count">' + pending + "</span>" : "") +
            "</a>";
        }).join("");
    }).join("");
  }

  function routeQuery() {
    var raw = location.hash || "#/home";
    var query = raw.split("?")[1] || "";
    var params = {};
    query.split("&").forEach(function (part) {
      if (!part) return;
      var idx = part.indexOf("=");
      var key = idx === -1 ? decodeURIComponent(part) : decodeURIComponent(part.slice(0, idx));
      var value = idx === -1 ? "" : decodeURIComponent(part.slice(idx + 1));
      params[key] = value;
    });
    return params;
  }

  function route() {
    var raw = location.hash || "#/home";
    return raw.split("?")[0].replace(/^#\/?/, "") || "home";
  }

  var lastRoute = null;

  function render() {
    var r = route();
    if (r !== lastRoute) {
      if (lastRoute === "queue") { queueFilter = null; compareIds = []; }
      lastRoute = r;
    }

    if (!routeAllowed(r)) {
      // Reached by URL, or by switching to a role that can't see this screen.
      var p = persona();
      $("#view").innerHTML =
        '<div class="page-head"><h1>Not available on this profile</h1>' +
        "<p>You're viewing as <b>" + esc(p.name) + "</b> (" + esc(ROLE_LABEL[p.role]) +
        "). That screen belongs to the " +
        (p.role === "EMPLOYEE" ? "Admin / HR" : "Employee") + " view.</p></div>" +
        '<div class="card"><div class="empty">Switch profile in the bottom-left corner, ' +
        'or <a href="#/home">go back home</a>.</div></div>';
      renderNav("");
      renderPersona();
      return;
    }

    var view = views[r] || views.home;
    renderNav(r.split("/")[0]);
    renderPersona();
    $("#view").innerHTML = view();
    window.scrollTo(0, 0);
    wire(r);
  }

  function wire(r) {
    if (r === "submit") {
      wireForm();
      // The form is drawn from cached quarter state. Refresh it on arrival in
      // case it moved elsewhere - another tab, or a coordinator sending this
      // nomination back - and re-render only if the answer actually changed,
      // which keeps this from looping.
      var wasSubmitted = !!(store.quarter && store.quarter.hasSubmitted);
      loadQuarter().then(function () {
        var nowSubmitted = !!(store.quarter && store.quarter.hasSubmitted);
        if (route() === "submit" && wasSubmitted !== nowSubmitted) {
          render();
        }
      });
    }
    if (r === "mine" || r === "stars" || r === "queue") wireList();
    if (r === "activity") {
      loadActivity().then(function () {
        if (route() === "activity") { $("#view").innerHTML = views.activity(); }
      });
    }
    if (r === "quarters") {
      // Cheap, and stops a coordinator reading a stale participation list after
      // approving something in another tab.
      loadQuarterHistory().then(function () {
        if (route() === "quarters") { $("#view").innerHTML = views.quarters(); }
      });
    }
    if (r === "praises/new") wirePraisePreview();
    if (r === "mtm/new") wireChips("#mtmTypes", true);
  }

  function applyFilters() {
    // The review queue is already showing one status, chosen by its KPI tiles.
    // Filtering has to narrow that, not reach past it back to the whole table.
    var base = store.nominations;
    if (route() === "queue") {
      var showing = queueFilter || "ALL";
      if (showing !== "ALL") {
        base = base.filter(function (n) { return n.status === showing; });
      }
    }

    var list = base;
    if (currentFilter) {
      list = list.filter(function (n) { return n.status === currentFilter; });
    }
    if (currentCategory === "__none") {
      list = list.filter(function (n) { return !n.category; });
    } else if (currentCategory) {
      list = list.filter(function (n) { return n.category === currentCategory; });
    }
    if (currentPractice) {
      list = list.filter(function (n) { return n.practice === currentPractice; });
    }
    if (currentLocation) {
      list = list.filter(function (n) { return n.location === currentLocation; });
    }
    if (currentName) {
      // Matches either side. A coordinator searching a name is usually asking
      // "what is going on with this person", which covers both what they wrote
      // and what was written about them.
      var needle = currentName.toLowerCase();
      list = list.filter(function (n) {
        return String(n.nomineeName || "").toLowerCase().indexOf(needle) !== -1 ||
               String(n.nominatorName || "").toLowerCase().indexOf(needle) !== -1;
      });
    }
    var table = $("#starTable");
    if (table) {
      table.innerHTML = nominationTable(list);
      bindRows();
    }
    var count = $("#filterCount");
    if (count) {
      count.textContent = list.length + " of " + base.length + " shown";
    }
    updateCompareButton();
    closeDetail();
  }

  /* Table wiring: row clicks, the status tabs, the category/practice/location
     filters, and the clickable KPI tiles on the review queue. */
  function wireList() {
    currentFilter = currentFilter || null;
    currentCategory = currentCategory || "";

    $$("[data-status-filter]").forEach(function (tile) {
      tile.addEventListener("click", function () {
        var nextFilter = tile.getAttribute("data-status-filter");
        queueFilter = (queueFilter === nextFilter) ? null : nextFilter;
        render();
      });
    });

    currentPractice = currentPractice || "";
    currentLocation = currentLocation || "";
    currentName = currentName || "";

    var nameBox = $("#nameSearch");
    if (nameBox) {
      nameBox.value = currentName;
      nameBox.addEventListener("input", function () {
        currentName = nameBox.value.trim();
        applyFilters();
      });
    }

    bindFilter("#catFilter", function (v) { currentCategory = v; });
    bindFilter("#practiceFilter", function (v) { currentPractice = v; });
    bindFilter("#locationFilter", function (v) { currentLocation = v; });

    var clear = $("#clearFilters");
    if (clear) clear.addEventListener("click", function () {
      currentCategory = currentPractice = currentLocation = currentName = "";
      ["#catFilter", "#practiceFilter", "#locationFilter", "#nameSearch"].forEach(function (sel) {
        var el = $(sel); if (el) el.value = "";
      });
      applyFilters();
    });
    var refresh = $("#refreshBtn");
    if (refresh) refresh.addEventListener("click", function () {
      loadNominations().then(render);
    });

    var tabs = $("#statusTabs");
    if (tabs) {
      $$(".tab", tabs).forEach(function (t) {
        t.addEventListener("click", function () {
          $$(".tab", tabs).forEach(function (x) { x.classList.remove("on"); });
          t.classList.add("on");
          currentFilter = t.getAttribute("data-f") || null;
          applyFilters();
        });
      });
    }
    bindRows();
    wireCompare();
    updateCompareButton();

    // Put the surviving filters back on screen and re-apply them.
    //
    // Switching status tile re-renders, which rebuilds filterBar() with every
    // select blank. The values were kept in memory but neither shown nor
    // applied, so the state said "Digital" while the dropdown said "All
    // practices" and the table showed everything - worse than resetting,
    // because the two disagreed silently.
    [["#catFilter", currentCategory],
     ["#practiceFilter", currentPractice],
     ["#locationFilter", currentLocation]].forEach(function (pair) {
      var el = $(pair[0]);
      if (el) { el.value = pair[1]; }
    });

    if (currentCategory || currentPractice || currentLocation || currentName) {
      applyFilters();
    }

    if (route() === "queue") {
      var focusId = routeQuery().id;
      if (focusId) {
        window.setTimeout(function () {
          if (route() === "queue" && routeQuery().id === focusId) {
            showDetail(focusId);
          }
        }, 0);
      }
    }
  }

  function bindFilter(selector, set) {
    var el = $(selector);
    if (!el) return;
    el.addEventListener("change", function () { set(el.value); applyFilters(); });
  }

  function bindRows() {
    $$("tbody tr.clickable").forEach(function (tr) {
      tr.addEventListener("click", function () { showDetail(tr.getAttribute("data-id")); });
    });
  }

  /* ---- submit form ---- */
  function wireForm() {
    var form = $("#form");
    var p = persona();

    // Pre-fill who you are from the active profile — it is the whole point of
    // having one — but leave it editable so the self-nomination demo works.
    $("#nominatorName").value = p.name;
    $("#nominatorEmail").value = p.email;

    var catSelect = $("#category");
    if (catSelect) {
      catSelect.addEventListener("change", function () {
        var chosen = store.categories.filter(function (c) {
          return c.value === catSelect.value;
        })[0];
        $("#categoryHint").textContent = chosen
          ? "Evidence this category expects: " + chosen.examples
          : "Pick the kind of impact this nomination evidences — the examples will "
            + "show what that category expects.";
      });
    }

    function hideBanners() {
      $("#okBanner").className = "banner ok";
      $("#badBanner").className = "banner bad";
    }
    function clearErrors() {
      $$("[data-field]").forEach(function (w) {
        w.classList.remove("invalid");
        var e = $(".err", w); if (e) e.textContent = "";
      });
    }
    function fill(v) {
      Object.keys(v).forEach(function (k) { if ($("#" + k)) $("#" + k).value = v[k]; });
      if (catSelect) catSelect.dispatchEvent(new Event("change"));
    }

    $("#sampleBtn").addEventListener("click", function () {
      hideBanners(); clearErrors();
      fill({ nominatorName: p.name, nominatorEmail: p.email,
             nomineeName: "Alex Rivera", nomineeEmail: "alex.rivera@version1.com",
             practice: "Cloud Engineering", location: "Dublin",
             category: "CUSTOMER_IMPACT",
             whatText: "Led the release rollout over a tight weekend window and saved the client " +
                       "two full days of downtime, coordinating four teams across two time zones.",
             howText: "Collaboration and Excellence. Rather than working the weekend alone, Alex " +
                      "built a rota so nobody did more than one night shift, and ran the bridge " +
                      "call himself so the client always had one point of contact." });
    });

    $("#selfBtn").addEventListener("click", function () {
      hideBanners(); clearErrors();
      fill({ nominatorName: p.name, nominatorEmail: p.email,
             nomineeName: p.name, nomineeEmail: p.email,
             practice: "Cloud Engineering", location: "Dublin",
             category: "PERFORMANCE_AND_EFFICIENCY",
             whatText: "Kept the release on track.", howText: "Showed ownership throughout." });
    });

    $("#clearBtn").addEventListener("click", function () {
      form.reset(); hideBanners(); clearErrors();
      $("#nominatorName").value = p.name;
      $("#nominatorEmail").value = p.email;
    });

    $("#resubBtn").addEventListener("click", function () {
      var w = $("#resubWrap"); w.hidden = !w.hidden;
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      hideBanners(); clearErrors();
      $("#submitBtn").disabled = true;

      var payload = {};
      FIELDS.forEach(function (f) {
        var el = $("#" + f);
        if (!el) return;
        if (f === "originalNominationId") { if (el.value.trim()) payload[f] = el.value.trim(); }
        else payload[f] = el.value;   // blanks included, so the API decides
      });

      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().then(function (b) { return { status: r.status, ok: r.ok, body: b }; })
                         .catch(function () { return { status: r.status, ok: r.ok, body: {} }; });
        })
        .then(function (res) {
          if (res.ok) {
            $("#okText").innerHTML = "Star Award submitted — <code>" + esc(res.body.id) + "</code>";
            $("#okBanner").className = "banner ok show";

            // Deliberately no AI result here. The score exists to order a
            // coordinator's attention, not to give the nominator a mark out of
            // 100 for words they just wrote about a colleague.

            toast({
              kind: "employee",
              title: "Nomination submitted",
              msg: res.body.nomineeName + " is now in the coordinator's review queue."
            });
            // Re-render, don't just refresh the nav. The quarter's nomination
            // is now used, so this screen has to become the "you've nominated"
            // panel - leaving the form up invites a second attempt the server
            // will only reject.
            return Promise.all([loadNominations(), loadQuarter(), loadQuarterHistory()])
              .then(function () { render(); });
          }
          if (res.body && res.body.reason === "QUARTER_LIMIT") {
            // Re-read and re-render so the form is replaced by the "already
            // nominated" panel, rather than sitting there inviting a retry.
            $("#badText").textContent = res.body.error;
            $("#badBanner").className = "banner bad show";
            Promise.all([loadNominations(), loadQuarter()]).then(render);
            return;
          }
          if (res.body && res.body.error) {
            $("#badText").textContent = res.body.error;
          } else if (res.body && typeof res.body === "object") {
            var keys = Object.keys(res.body);
            keys.forEach(function (k) {
              var w = $('[data-field="' + k + '"]');
              if (w) { w.classList.add("invalid"); $(".err", w).textContent = res.body[k]; }
            });
            $("#badText").textContent = keys.length +
              (keys.length === 1 ? " field needs" : " fields need") + " fixing before this can be submitted.";
          } else {
            $("#badText").textContent = "That didn't go through. Please try again.";
          }
          $("#badBanner").className = "banner bad show";
        })
        .catch(function (e) {
          $("#badText").textContent = "Couldn't submit — the app didn't respond. Check it's still running.";
          $("#badBanner").className = "banner bad show";
        })
        .finally(function () { $("#submitBtn").disabled = false; });
    });
  }

  /* ---- praise preview (shell) ---- */
  function wirePraisePreview() {
    var to = $("#prTo"), msg = $("#prMsg");
    if (to) to.addEventListener("input", function () {
      $("#prPrevTo").textContent = "To " + (to.value || "…");
    });
    if (msg) msg.addEventListener("input", function () {
      $("#prCount").textContent = msg.value.length;
      $("#prPrevMsg").textContent = msg.value || "Your message will appear here.";
    });
    wireChips("#prValues", false, function (on) {
      $("#prPrevVals").innerHTML = on.map(function (v) {
        return '<span class="valchip">◎ ' + esc(v) + "</span> ";
      }).join("");
    });
  }

  function wireChips(sel, single, onChange) {
    var root = $(sel);
    if (!root) return;
    $$(".chip", root).forEach(function (c) {
      c.addEventListener("click", function () {
        if (single) $$(".chip", root).forEach(function (x) { x.classList.remove("on"); });
        c.classList.toggle("on");
        if (onChange) {
          onChange($$(".chip.on", root).map(function (x) {
            return x.getAttribute("data-v") || x.textContent.trim();
          }));
        }
      });
    });
  }

  /* ---------------- boot ---------------- */
  loadTheme();
  wireTheme();
  loadGreyscale();
  wireGreyscale();
  loadPersona();
  wirePersonaSwitcher();
  wireOutlookButtons();
  window.addEventListener("hashchange", render);
  Promise.all([loadNominations(), loadCategories(), loadQuarter(), loadQuarterHistory(), loadActivity(), loadCoreValues()])
    .then(function () {
    announceNewQuarterIfChanged();
    render();
    // Say which account the session resumed on. Someone coming back to a tab
    // left in Admin / HR view should not have to work that out from the nav.
    var p = persona();
    toast({
      kind: p.role === "COORDINATOR" ? "coordinator" : "employee",
      title: "Viewing as " + p.name,
      msg: ROLE_LABEL[p.role] + " view · " + p.title +
           ". Switch profile in the bottom-left corner."
    });
  });
})();
