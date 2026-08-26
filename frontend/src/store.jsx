import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "./api.js";
import { PERSONAS, ROLE_LABEL, ROUTES } from "./constants.js";

const STORE_KEY = "v1r.persona";
const THEME_KEY = "v1r.theme";
const GREY_KEY = "v1r.greyscale";
const QUARTER_SEEN_KEY = "v1r.lastQuarter";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

/* localStorage throws outright in some privacy modes, so every access is
   guarded rather than assumed. */
function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
}

/* Hash routing, unchanged from the previous build so existing links still work:
   "#/queue?id=..." gives route "queue" and query { id: "..." }. */
function readHash() {
  const raw = window.location.hash || "#/home";
  const parts = raw.split("?");
  const path = parts[0];
  const query = parts[1] || "";
  const params = {};
  query.split("&").filter(Boolean).forEach((pair) => {
    const kv = pair.split("=");
    params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
  });
  return { route: path.replace(/^#\/?/, "") || "home", query: params };
}

export function StoreProvider({ children }) {
  const [personaId, setPersonaId] = useState(() => {
    const saved = read(STORE_KEY);
    return PERSONAS.some((p) => p.id === saved) ? saved : PERSONAS[0].id;
  });
  const persona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
  const isCoordinator = persona.role === "COORDINATOR";

  const [nominations, setNominations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [coreValues, setCoreValues] = useState([]);
  const [quarter, setQuarter] = useState(null);
  const [quarterHistory, setQuarterHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [ready, setReady] = useState(false);

  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const [location, setLocation] = useState(readHash);
  const route = location.route;
  const query = location.query;

  useEffect(() => {
    const onHash = () => setLocation(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toast = useCallback((opts) => {
    const id = ++toastSeq.current;
    setToasts((t) => t.concat([Object.assign({ id: id }, opts)]));
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      opts.sticky ? 12000 : 6000
    );
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const loadNominations = useCallback(
    () => api.nominations()
      .then((list) => {
        list.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
        setNominations(list);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e.message)),
    []
  );

  const loadQuarter = useCallback(
    (email) => api.currentQuarter(email)
      .then(setQuarter)
      .catch(() => setQuarter(null)),
    []
  );

  const loadActivity = useCallback(
    () => api.activity().then(setActivity).catch(() => setActivity([])), []
  );
  const loadQuarterHistory = useCallback(
    () => api.quarterHistory().then(setQuarterHistory).catch(() => setQuarterHistory([])), []
  );

  /* Boot. Everything the first render needs, fetched together. The reference
     data - categories and core values - never changes during a session. */
  useEffect(() => {
    const p = PERSONAS.find((x) => x.id === personaId) || PERSONAS[0];
    Promise.all([
      loadNominations(),
      api.categories().then(setCategories).catch(() => setCategories([])),
      api.coreValues().then(setCoreValues).catch(() => setCoreValues([])),
      loadQuarter(p.email),
      loadQuarterHistory(),
      loadActivity(),
    ]).then(() => {
      setReady(true);
      toast({
        kind: p.role === "COORDINATOR" ? "coordinator" : "employee",
        title: "Viewing as " + p.name,
        msg: ROLE_LABEL[p.role] + " view · " + p.title +
             ". Switch profile in the bottom-left corner.",
      });
    });
    // Mount only.
  }, []);

  /* Says the quarter rolled over since this browser last had the page open,
     which is the moment a nomination becomes available again. Fires once per
     change rather than on every load. */
  useEffect(() => {
    if (!quarter) return;
    const seen = read(QUARTER_SEEN_KEY);
    write(QUARTER_SEEN_KEY, quarter.code);
    if (seen && seen !== quarter.code) {
      toast({
        kind: "employee",
        sticky: true,
        title: "New quarter — " + quarter.label,
        msg: "Nominations have reset. You can submit one nomination for " + quarter.label + ".",
      });
    }
  }, [quarter, toast]);

  const allowedRoutes = ROUTES.filter((r) => r.roles.includes(persona.role));
  const routeAllowed = (r) =>
    allowedRoutes.some((x) => x.id === String(r).split("/")[0]);

  const switchPersona = useCallback((id) => {
    const next = PERSONAS.find((p) => p.id === id);
    if (!next || next.id === personaId) return;

    setPersonaId(id);
    write(STORE_KEY, id);

    // The quarter answer is per person, so refetch before the new profile's
    // screens are drawn.
    loadQuarter(next.email);

    // Switching role can strip the current screen out of the nav. Land on Home
    // rather than leaving a view this account is not supposed to have.
    const stillAllowed = ROUTES
      .filter((r) => r.roles.includes(next.role))
      .some((r) => r.id === String(readHash().route).split("/")[0]);
    if (!stillAllowed) window.location.hash = "#/home";

    toast({
      kind: next.role === "COORDINATOR" ? "coordinator" : "employee",
      title: "Now viewing as " + next.name,
      msg: next.role === "COORDINATOR"
        ? "Admin / HR view — you can approve, reject and request resubmissions on the Review Queue."
        : "Employee view — you can submit recognition and track your own. Coordinator screens are hidden.",
    });
  }, [personaId, loadQuarter, toast]);

  const value = {
    persona, isCoordinator, switchPersona,
    nominations, categories, coreValues, quarter, quarterHistory, activity,
    loadError, ready,
    loadNominations, loadQuarter, loadActivity, loadQuarterHistory,
    route, query, allowedRoutes, routeAllowed,
    toasts, toast, dismissToast,
  };

  return React.createElement(Ctx.Provider, { value: value }, children);
}

/* Appearance. Three states, not two: a Light/Dark toggle has to pick a starting
   side, and whichever it picks is wrong for half the people opening the page.
   Auto follows the OS. Greyscale is independent - it strips the accent hues
   while keeping whichever background you chose, which doubles as a check that
   nothing relies on colour alone. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = read(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "auto";
  });
  const [grey, setGrey] = useState(() => read(GREY_KEY) === "1");

  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    write(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (grey) document.documentElement.setAttribute("data-palette", "grey");
    else document.documentElement.removeAttribute("data-palette");
    write(GREY_KEY, grey ? "1" : "0");
  }, [grey]);

  return { theme, setTheme, grey, setGrey };
}
