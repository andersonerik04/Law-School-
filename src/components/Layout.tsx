import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Icon, Monogram } from '../visuals/Icon';
import { currentWeek, termForWeek } from '../lib/mastery';
import { toRoman } from '../lib/util';

export const NAV: { group: string; items: { to: string; label: string; icon: string }[] }[] = [
  {
    group: 'The Academy',
    items: [
      { to: '/', label: 'The Docket', icon: 'docket' },
      { to: '/map', label: 'The Map of the Law', icon: 'map' },
      { to: '/planner', label: 'Term Planner', icon: 'calendar' },
    ],
  },
  {
    group: 'Study',
    items: [
      { to: '/casebook', label: 'The Casebook', icon: 'book' },
      { to: '/chambers', label: 'Chambers', icon: 'gavel' },
      { to: '/reviews', label: 'Daily Reviews', icon: 'cards' },
      { to: '/logic', label: 'Conditional Logic', icon: 'logic' },
      { to: '/moot', label: 'Moot Court', icon: 'sprint' },
      { to: '/exam', label: 'Examination Room', icon: 'exam' },
      { to: '/writing', label: 'Argumentative Writing', icon: 'quill' },
    ],
  },
  {
    group: 'Faculty',
    items: [
      { to: '/office-hours', label: 'Office Hours', icon: 'owl' },
      { to: '/seminar', label: 'The Seminar', icon: 'seminar' },
    ],
  },
  {
    group: 'Records',
    items: [
      { to: '/law-review', label: 'The Law Review', icon: 'chart' },
      { to: '/ledger', label: "The Clerk's Ledger", icon: 'ledger' },
      { to: '/bench-cards', label: 'Bench Cards', icon: 'cards' },
      { to: '/notebook', label: 'My Notebook', icon: 'notebook' },
      { to: '/admissions', label: 'Admissions Office', icon: 'admissions' },
    ],
  },
  {
    group: 'Chancery',
    items: [
      { to: '/handbook', label: 'Faculty Handbook', icon: 'handbook' },
      { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const LABEL_BY_PATH: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.to, i.label])));

export function Layout({ children }: { children: ReactNode }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const profile = useStore((s) => s.profile);
  const [expanded, setExpanded] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const term = termForWeek(week);
  const base = '/' + (loc.pathname.split('/')[1] ?? '');
  const crumb = LABEL_BY_PATH[base] ?? (base === '/matriculation' ? 'Matriculation' : '');
  const daysLeft = Math.max(0, Math.ceil((new Date(profile.testDate + 'T09:00:00').getTime() - Date.now()) / 86_400_000));
  const wide = ['/map', '/exam', '/notebook'].some((p) => loc.pathname.startsWith(p));

  useEffect(() => setExpanded(false), [loc.pathname]);

  // The Examination Room runs full-screen, like the real test interface.
  if (/^\/exam\/[^/]+/.test(loc.pathname)) {
    return <main className="exam-shell">{children}</main>;
  }

  let n = 0;
  return (
    <div className={`shell ${expanded ? 'expanded' : ''}`}>
      <nav className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <Monogram size={42} />
          <div className="titles">
            <div className="title">THE BAR &amp; BENCH</div>
            <div className="sub">lsat academy</div>
          </div>
        </div>
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((i) => {
              n++;
              return (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={i.label}>
                  <span className="numeral">{toRoman(n)}</span>
                  <Icon name={i.icon} size={17} />
                  <span className="txt">{i.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="nav-group-label" style={{ padding: '12px 18px', fontStyle: 'italic', textTransform: 'none', fontVariant: 'normal', letterSpacing: '0.05em' }}>
          Veritas in Ratione
        </div>
      </nav>
      <div className="main">
        <header className="topbar no-print">
          <button className="ghost" onClick={() => setExpanded((e) => !e)} aria-label="Toggle navigation">
            <Icon name="menu" size={18} />
          </button>
          <span className="crumb">{crumb}</span>
          <span className="spacer" />
          <span className="chip gold tb-week" title={term.focus}>
            <span className="tb-long">Term {term.numeral} · </span>Week {week}<span className="tb-long"> of 40</span>
          </span>
          <span className="chip tb-days" title="Days until your test date">
            <Icon name="timer" size={13} /> {daysLeft} days
          </span>
          <select
            aria-label="Theme"
            className="tb-theme"
            value={settings.theme}
            onChange={(e) => setSettings({ theme: e.target.value as 'crimson' | 'federal' })}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
          >
            <option value="crimson">Crimson Hall</option>
            <option value="federal">Federal Green</option>
          </select>
          <button className="ghost" onClick={() => setSettings({ mode: settings.mode === 'light' ? 'dark' : 'light' })} aria-label="Toggle dark mode" title="Toggle dark mode">
            <Icon name={settings.mode === 'light' ? 'moon' : 'sun'} size={17} />
          </button>
          <button className="ghost" onClick={() => nav('/settings')} aria-label="Settings">
            <Icon name="settings" size={17} />
          </button>
        </header>
        <main className={`content ${wide ? 'wide' : ''}`} key={loc.pathname}>
          <div className="page-turn">{children}</div>
        </main>
      </div>
    </div>
  );
}
