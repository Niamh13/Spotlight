import { useEffect } from "react";
import { useStore } from "./store.jsx";
import Sidebar from "./components/Sidebar.jsx";
// One file per screen, named after what you would look for.
import Home           from "./views/Home.jsx";
import Submit         from "./views/Submit.jsx";
import MyRecognition  from "./views/MyRecognition.jsx";
import StarAwards     from "./views/StarAwards.jsx";
import Queue          from "./views/Queue.jsx";
import AiSummary      from "./views/AiSummary.jsx";
import Quarters       from "./views/Quarters.jsx";
import ActivityLog    from "./views/ActivityLog.jsx";
import Dashboard      from "./views/Dashboard.jsx";
import Reports        from "./views/Reports.jsx";
import Help           from "./views/Help.jsx";
import { Praises, PraiseNew } from "./views/Praises.jsx";
import { Mtm, MtmNew } from "./views/MomentsThatMatter.jsx";

const VIEWS = {
  home: Home,
  submit: Submit,
  mine: MyRecognition,
  stars: StarAwards,
  praises: Praises,
  "praises/new": PraiseNew,
  mtm: Mtm,
  "mtm/new": MtmNew,
  queue: Queue,
  ai: AiSummary,
  quarters: Quarters,
  activity: ActivityLog,
  dashboard: Dashboard,
  reports: Reports,
  help: Help,
};

/* Announcements are polite so a screen reader finishes the current sentence
   before reading the account change rather than interrupting. */
function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={"toast " + (t.kind || "")} key={t.id}>
          <div className="toast__body">
            <div className="toast__title">{t.title}</div>
            {t.msg ? <div className="toast__msg">{t.msg}</div> : null}
          </div>
          <button type="button" className="toast__close" aria-label="Dismiss"
                  onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { route, routeAllowed, ready } = useStore();

  // Sub-routes like praises/new inherit their parent's permission, which
  // routeAllowed handles by checking the segment before the slash.
  const allowed = routeAllowed(route);
  const View = allowed ? VIEWS[route] : null;

  // An unknown or forbidden hash should not leave a blank page - send it home
  // and let the normal render happen from there.
  useEffect(() => {
    if (!View) window.location.hash = "#/home";
  }, [View]);

  // Every screen reads from the same loaded lists, so drawing before the first
  // fetch settles would flash empty tables and "0" tiles on all of them.
  return (
    <>
      <div className="app">
        <Sidebar />
        <main>{ready && View ? <View /> : null}</main>
      </div>
      <ToastHost />
    </>
  );
}
