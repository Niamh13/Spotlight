import React, { useEffect, useRef, useState } from "react";
import { useStore, useTheme } from "../store.jsx";
import { PERSONAS, ROLE_LABEL } from "../constants.js";
import { Avatar } from "./ui.jsx";

const BUILD = "react-1";

/* Supplied artwork, used unmodified. It is a wide 3:2 emblem with its own
   internal margins, so it sits above the wordmark rather than beside it - at
   the ~38px a horizontal lockup allows it would read as a smudge. */
function Logo() {
  return (
    <a className="logo" href="#/home" aria-label="Spotlight — home">
      <img className="logo__img" src="/spotlight-logo.png" alt="" width="612" height="408" />
      <span className="logo__words">
        <span className="logo__name">Spotlight</span>
        <span className="logo__tagline">Recognising impact</span>
      </span>
    </a>
  );
}

function ThemeControl() {
  const { theme, setTheme, grey, setGrey } = useTheme();
  const { toast } = useStore();

  const choose = (next) => {
    setTheme(next);
    const names = { light: "Light", dark: "Dark", auto: "Matching your system" };
    toast({
      title: names[next] + " appearance",
      msg: next === "auto"
        ? "Following your operating system's light or dark setting."
        : "Pinned to " + names[next].toLowerCase() + " on this browser.",
    });
  };

  return (
    <>
      <div className="themebar">
        <span className="themebar__label" id="themeLabel">Appearance</span>
        <div className="segmented" role="group" aria-labelledby="themeLabel">
          {[["light", "☀", "Light"], ["dark", "☾", "Dark"], ["auto", "◐", "Match system"]]
            .map(([id, glyph, label]) => (
              <button key={id} type="button" title={label}
                      className={"segmented__btn" + (theme === id ? " on" : "")}
                      aria-pressed={theme === id}
                      onClick={() => choose(id)}>
                <span aria-hidden="true">{glyph}</span>
                <span className="sr-only">{label}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="themebar themebar--sub">
        <label className="greyscale">
          <input type="checkbox" checked={grey}
                 onChange={(e) => {
                   setGrey(e.target.checked);
                   toast({
                     title: e.target.checked ? "Greyscale on" : "Greyscale off",
                     msg: e.target.checked
                       ? "Accent colours removed. Status and category still read through their labels and glyphs."
                       : "Accent colours restored.",
                   });
                 }} />
          <span>Greyscale</span>
        </label>
      </div>
    </>
  );
}

/* Sits in the bottom corner of the sidebar, where the signed-in user normally
   lives, so switching account is where you would reach for it. It changes the
   view, not your access - there is no authentication behind it. */
function PersonaSwitcher() {
  const { persona, switchPersona } = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="whoami" ref={box}>
      <button type="button" className="whoami__btn" aria-haspopup="true" aria-expanded={open}
              onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <Avatar name={persona.name} sm />
        <span className="whoami__text">
          <span className="name">{persona.name}</span>
          <span className="role">{ROLE_LABEL[persona.role]} · {persona.title}</span>
        </span>
        <span className="whoami__chev" aria-hidden="true">⌃</span>
      </button>

      {open ? (
        <div className="persona-menu" role="menu">
          <div className="persona-menu__label">Switch profile</div>
          {PERSONAS.map((o) => (
            <button key={o.id} type="button" role="menuitem"
                    className={"persona-opt" + (o.id === persona.id ? " on" : "")}
                    onClick={() => { switchPersona(o.id); setOpen(false); }}>
              <Avatar name={o.name} sm />
              <span className="persona-opt__text">
                <span className="n">{o.name}</span>
                <span className="r">{ROLE_LABEL[o.role]} · {o.title}</span>
              </span>
              {o.id === persona.id ? <span className="tick" aria-label="current">✓</span> : null}
            </button>
          ))}
          <div className="persona-menu__label"
               style={{ textTransform: "none", letterSpacing: 0, fontSize: "11.5px",
                        padding: "8px 9px 4px", borderTop: "1px solid var(--border)",
                        marginTop: "4px" }}>
            No sign-in yet — this switches the view, not your access.
          </div>
        </div>
      ) : null}

      <div className="buildstamp" title="Front-end build currently loaded">build {BUILD}</div>
    </div>
  );
}

export default function Sidebar() {
  const { allowedRoutes, route, nominations } = useStore();
  const pending = nominations.filter((n) => n.status === "PENDING_REVIEW").length;
  const current = String(route).split("/")[0];

  const groups = [];
  allowedRoutes.forEach((r) => { if (!groups.includes(r.group)) groups.push(r.group); });

  return (
    <aside>
      <Logo />
      <nav>
        {groups.map((g) => (
          <React.Fragment key={g}>
            <div className="navgroup">{g}</div>
            {allowedRoutes.filter((r) => r.group === g).map((r) => (
              <a key={r.id} href={"#/" + r.id} className={current === r.id ? "active" : undefined}>
                <span className="ic">{r.ic}</span>{r.label}
                {r.badge === "pending" && pending
                  ? <span className="badge-count">{pending}</span> : null}
              </a>
            ))}
          </React.Fragment>
        ))}
      </nav>
      <ThemeControl />
      <PersonaSwitcher />
    </aside>
  );
}
