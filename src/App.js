import { useState } from 'react';
import './App.css';
import { useRepeatableIntersect } from './hooks/useRepeatableIntersect';

const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'experience', label: 'Experience' },
  { id: 'work', label: 'Work' },
  { id: 'projects', label: 'Projects' },
  { id: 'about', label: 'About' },
];

const EXPERIENCE = [
  { label: 'Gaming Experience', value: 97, years: '15+ years' },
  { label: 'Driving Experience', value: 95, years: '9+ years' },
  { label: 'Tech Experience', value: 92, years: '10+ years' },
  { label: 'Shooting Range Sniper Experience', value: 80, years: '3+ years' },
  { label: 'Camera Experience', value: 90, years: '10+ years' },
  { label: 'Editing Experience', value: 86, years: '5+ years' },
  { label: 'Swimming Experience', value: 60, years: '4+ years' },  
  { label: 'Cricket Experience', value: 80, years: '14+ years' },
  { label: 'Badminton Experience', value: 63, years: '5+ years' },
  { label: 'Chess Experience', value: 42, years: '2+ years' },
  { label: 'Coding Experience', value: 28, years: '2+ years' },
  { label: 'Table Tennis Experience', value: 70, years: '3+ years' },
  { label: 'Basket + Throw + Foot  Ball Experience', value: 78, years: '2+ years' },
  { label: 'Cooking Experience', value: 60, years: '6+ years' },
  { label: 'Calisthenics Experience', value: 30, years: '4+ months' },
  { label: 'Near Death Experience', value: 99, years: 'Avg 4 times per day' },
  


  


];

const WORK_ITEMS = [
  { title: 'Product engineering', detail: 'I forward your messege to my AI , rest is the fate.' },
  { title: 'Design systems', detail: 'Ask my AI.' },
  { title: 'Collaboration', detail: 'Dont even think.'},
];

const PROJECTS = [
  {
    name: 'MIZU',
    tag: 'Skincare · Landing',
    blurb: 'Glow from within — shop, journal, and everyday magic.',
    href: 'https://zeeshankashif.github.io/mizu/',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'Clock',
    tag: 'Live Clock · UI',
    blurb: 'Analogue and Digital time with smooth transitions.',
    href: 'https://zeeshankashif.github.io/clocked/',
    image:
      'https://images.unsplash.com/photo-1495364141860-b0d03eccd065?auto=format&fit=crop&w=1200&q=80',
  },
];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function LiquidBackdrop() {
  return (
    <div className="liquid-backdrop" aria-hidden="true">
      <div className="liquid-streak liquid-streak--a liquid-streak--on" />
      <div className="liquid-streak liquid-streak--b liquid-streak--on" />
      <div className="liquid-veil" />
    </div>
  );
}

function Navbar({ theme, onToggleTheme }) {
  return (
      <header className="nav-shell">
      <nav className="nav glass-panel" aria-label="Primary">
        <a className="nav-brand" href="#home" onClick={(e) => { e.preventDefault(); scrollToId('home'); }}>
          ZK
        </a>
        <ul className="nav-links">
          {NAV.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        {/* <a className="nav-cta pill" href="#projects" onClick={(e) => { e.preventDefault(); scrollToId('projects'); }}>
          View work
        </a> */}
        <button
          type="button"
          className="nav-theme-toggle pill pill--ghost"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </nav>
    </header>
  );
}

function ExperienceSection() {
  const [ref, active] = useRepeatableIntersect(0.18, '0px 0px -8% 0px', true);

  return (
    <section id="experience" className="section section--tight" ref={ref}>
      <div className={`section-inner reveal ${active ? 'reveal--in' : ''}`}>
        <p className="eyebrow">Experience</p>
        <h2 className="section-title">Skills in Motion</h2>
        <p className="section-lead">
         Here I've showcased my experiences in the form of Graphics , because brainless people doesn't visualize simple numerics ( like you and me )
        </p>

        <div className="chart-card glass-panel">
          <div className="bar-chart" role="list">
            {EXPERIENCE.map((row) => (
              <div className="bar-row" key={row.label} role="listitem">
                <div className="bar-meta">
                  <span className="bar-label">{row.label}</span>
                  <span className="bar-years">{row.years}</span>
                </div>
                <div className="bar-track" aria-hidden="true">
                  <div
                    className={`bar-fill ${active ? 'bar-fill--grow' : ''}`}
                    style={{ '--target': `${row.value}%` }}
                  />
                </div>
                <span className="bar-value">{row.value}%</span>
              </div>
            ))}
          </div>

          <div className="mini-stats" aria-label="Highlights">
            <div className={`mini-stat ${active ? 'mini-stat--in' : ''}`} style={{ '--d': '0ms' }}>
              <span className="mini-stat__num">90+</span>
              <span className="mini-stat__cap">Years of Experience</span>
            </div>
            <div className={`mini-stat ${active ? 'mini-stat--in' : ''}`} style={{ '--d': '80ms' }}>
              <span className="mini-stat__num">20+</span>
              <span className="mini-stat__cap">Age</span>
            </div>
            <div className={`mini-stat ${active ? 'mini-stat--in' : ''}`} style={{ '--d': '160ms' }}>
              <span className="mini-stat__num">450%</span>
              <span className="mini-stat__cap">of Age Experience</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkSection() {
  const [ref, active] = useRepeatableIntersect(0.15, '0px 0px -8% 0px', true);
  return (
    <section id="work" className="section" ref={ref}>
      <div className={`section-inner reveal ${active ? 'reveal--in' : ''}`}>
        <p className="eyebrow">Work</p>
        <h2 className="section-title">How I build</h2>
        <div className="card-grid">
          {WORK_ITEMS.map((item, i) => (
            <article
              key={item.title}
              className={`work-card glass-panel lift ${active ? 'lift--in' : ''}`}
              style={{ '--i': `${i * 70}ms` }}
            >
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectsSection() {
  const [ref, active] = useRepeatableIntersect(0.12, '0px 0px -8% 0px', true);
  return (
    <section id="projects" className="section" ref={ref}>
      <div className={`section-inner reveal ${active ? 'reveal--in' : ''}`}>
        <p className="eyebrow">Projects</p>
        <h2 className="section-title">Selected work</h2>
        <div className="project-grid">
          {PROJECTS.map((p, i) => (
            <a
              key={p.name}
              className={`project-block lift ${active ? 'lift--in' : ''}`}
              style={{ '--i': `${i * 90}ms` }}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div
                className="project-block__media"
                style={{ backgroundImage: `url(${p.image})` }}
                aria-hidden="true"
              />
              <div className="project-block__scrim" aria-hidden="true" />
              <div className="project-block__body">
                <span className="project-block__tag">{p.tag}</span>
                <h3 className="project-block__title">{p.name}</h3>
                <p className="project-block__text">{p.blurb}</p>
                <span className="project-block__cta">Visit site →</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const [ref, active] = useRepeatableIntersect(0.2, '0px 0px -8% 0px', true);
  return (
    <section id="about" className="section section--footer" ref={ref}>
      <div className={`section-inner reveal ${active ? 'reveal--in' : ''}`}>
        <p className="eyebrow">About</p>
        <h2 className="section-title">Zeeshan Kashif</h2>
        <p className="about-text">
        I love everything that goes FAST & BOOM 
        </p>
        <div className="about-actions">
          <a className="pill pill--solid" href="mailto:hello@zeeshankashif.dev">zeeshankashif.100m@gmail.com</a>
          <a className="pill pill--ghost" href="mailto:hello@zeeshankashif.dev">Email me</a>

          <a className="pill pill--ghost" href="#home" onClick={(e) => { e.preventDefault(); scrollToId('home'); }}>Back to top</a>
        </div>
      </div>
      <footer className="site-footer">
        <span>©{new Date().getFullYear()} ZEXAN : Verified ✔</span>
      </footer>
    </section>
  );
}

function App() {
  const [theme, setTheme] = useState('light');
  const [heroRef, heroActive] = useRepeatableIntersect(0.08, '0px', true);

  return (
    <div className="page" data-theme={theme}>
      <LiquidBackdrop />
      <Navbar
        theme={theme}
        onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
      />

      <main>
        <section id="home" className="hero" ref={heroRef}>
          <div className={`hero-inner reveal ${heroActive ? 'reveal--in' : ''}`}>
            <div className="hero-visual">
              <div className="photo-wrap">
                <img
                  className="hero-photo"
                  src={`${process.env.PUBLIC_URL}/zeezee.jpg`}
                  alt="Zeeshan Kashif"
                  width={340}
                  height={340}
                />
              </div>
            </div>
            <div className="hero-copy">
              <p className="eyebrow hero-eyebrow">Portfolio</p>
              <h1 className="hero-title">
                Zeeshan Kashif
              </h1>
              <p className="hero-sub">
                  Liked by Cats 
              
              </p>
              <div className="hero-ctas">
                <button type="button" className="pill pill--solid" onClick={() => scrollToId('experience')}>
                  See experience
                </button>
                <button type="button" className="pill pill--ghost" onClick={() => scrollToId('projects')}>
                  Browse projects
                </button>
              </div>
            </div>
          </div>
        </section>

        <ExperienceSection />
        <WorkSection />
        <ProjectsSection />
        <AboutSection />
      </main>
    </div>
  );
}

export default App;
