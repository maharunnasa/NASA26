import { useState } from "react";
import { EXPERIENCES, Experience } from "./App.jsx";
import "./Shell.css";

const BRAND = "EARTHPULSE"; // mockup says EARTHSENSE: change here if you rename
const NAV = [["home", "Home"], ["explore", "Explore"], ["about", "About"], ["learn", "Learn"]];
const CARDS = [
  { n: "01", title: "Earth's Pulse", sub: "Temperature through time", exp: 0 },
  { n: "02", title: "Ocean Chlorophyll", sub: "Life through ocean depth", exp: 1 },
  { n: "03", title: "Another World", sub: "Light through an exoplanet", exp: 2 },
  { n: "04", title: "How it works", sub: "Data, sound and sources", go: "about" },
];

function Logo() {
  const [ok, setOk] = useState(true);
  return (
    <span className="brand">
      {ok && <img src="/images/logo.png" alt="" className="brand-img" onError={() => setOk(false)} />}
      <span className="brand-name">{BRAND}</span>
    </span>
  );
}

function Home({ open }) {
  return (
    <main className="home">
      <div className="home-copy">
        <p className="eyebrow">Listen to the evidence</p>
        <h1>The Earth has signals. Let’s <span>hear them.</span></h1>
        <p className="lede">Explore ocean chlorophyll, Earth’s changing pulse and light from a distant world: real data transformed into sound, colour and 3D.</p>
        <button className="cta" onClick={() => open("explore", 0)}>
          <span className="play" aria-hidden="true">▶</span> Start exploring
        </button>
      </div>
      <svg className="wave" viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 60 C 60 0, 120 120, 180 60 S 300 0, 360 60 S 480 120, 540 60 S 660 0, 720 60 S 780 100, 800 60" />
      </svg>
      <ul className="cards" aria-label="Experiences">
        {CARDS.map((c) => (
          <li key={c.n}>
            <button className="card" onClick={() => (c.go ? open(c.go) : open("explore", c.exp))}>
              <span className="tile">{c.n}</span>
              <span><strong>{c.title}</strong><small>{c.sub}</small></span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

const About = () => (
  <main className="doc">
    <h1>About {BRAND}</h1>
    <p>{BRAND} turns real measurements into sound, colour and 3D so more people can explore them. Every note maps to one data point, and every mapping rule is shown next to the chart.</p>
    <p>Sound alone does not explain data. Use the chart, the numbers and the sources on each page. Our aim is to widen who can explore the data and start asking questions, not to replace scientific analysis.</p>
    <p>The sounds and colours are designed representations, not recordings or photographs of Earth or other worlds. Source credits are listed on each experience page.</p>
  </main>
);

const Learn = () => (
  <main className="doc">
    <h1>How to read a sonification</h1>
    <ol>
      <li><strong>Pick a data series</strong> with a clear unit and time or position axis.</li>
      <li><strong>Choose a rule</strong>: a higher value gives a higher pitch, within a fixed range shown on the page.</li>
      <li><strong>Play and watch</strong>: the marker on the chart moves with each note.</li>
      <li><strong>Check the evidence</strong>: click any point to see the exact value, its unit and its source.</li>
    </ol>
    <p>The same rule is used for every period you compare, so a difference you hear comes from the data, not from the mapping.</p>
  </main>
);

export default function Shell() {
  const [view, setView] = useState("home");
  const [exp, setExp] = useState(0);
  const [menu, setMenu] = useState(false);
  const open = (v, i) => { setView(v); if (i != null) setExp(i); setMenu(false); window.scrollTo(0, 0); };

  return (
    <div className={`shell ${view === "home" ? "is-home" : ""}`}>
      <header className="top">
        <button className="brand-btn" onClick={() => open("home")} aria-label={`${BRAND} home`}><Logo /></button>
        <button className="burger" aria-expanded={menu} aria-controls="menu" aria-label="Menu" onClick={() => setMenu(!menu)}>
          <i /><i /><i />
        </button>
        <nav id="menu" className={menu ? "open" : ""} aria-label="Main">
          {NAV.map(([k, label]) => (
            <button key={k} aria-current={view === k ? "page" : undefined} onClick={() => open(k)}>{label}</button>
          ))}
          <button className="ghost" onClick={() => open("explore", exp)}>Start exploring →</button>
        </nav>
      </header>

      {view === "home" && <Home open={open} />}
      {view === "explore" && (
        <main className="dash">
          <div className="pills" role="tablist" aria-label="Choose an experience">
            {EXPERIENCES.map((e, i) => (
              <button key={e.id} role="tab" aria-selected={exp === i} onClick={() => setExp(i)}>{e.tab}</button>
            ))}
          </div>
          <Experience cfg={EXPERIENCES[exp]} />
        </main>
      )}
      {view === "about" && <About />}
      {view === "learn" && <Learn />}
      <footer className="foot">Sounds are generated in your browser. Data sources are listed on each page. Not an official NASA product.</footer>
    </div>
  );
}
