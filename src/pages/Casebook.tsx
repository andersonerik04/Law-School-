import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CasebookHeader, MethodNote, RankBadge, Section } from '../components/common';
import { useStore } from '../lib/store';
import { CONCEPT_BY_ID, TERMS, WEEKS } from '../lib/content';
import { currentWeek, masteryFor } from '../lib/mastery';
import { Icon } from '../visuals/Icon';
import type { Branch } from '../lib/types';

const BRANCH_LABEL: Record<Branch, string> = { LR: 'Logical Reasoning', RC: 'Reading Comprehension', CL: 'Conditional Logic', AW: 'Writing', TS: 'Strategy' };

export default function Casebook() {
  const lessons = useStore((s) => s.lessons);
  const attempts = useStore((s) => s.attempts);
  const srs = useStore((s) => s.srs);
  const profile = useStore((s) => s.profile);
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const [filter, setFilter] = useState<Branch | 'all'>('all');
  const [q, setQ] = useState('');
  const done = Object.values(lessons).filter((l) => l.completed).length;
  const total = WEEKS.reduce((n, w) => n + w.concepts.filter((c) => CONCEPT_BY_ID[c]?.lesson).length, 0);
  const nextUp = useMemo(() => {
    for (const w of WEEKS) for (const c of w.concepts) if (CONCEPT_BY_ID[c]?.lesson && !lessons[c]?.completed) return CONCEPT_BY_ID[c];
    return null;
  }, [lessons]);

  return (
    <div>
      <CasebookHeader chapter="THE CASEBOOK" title="Lessons in the Law of Reasoning" subtitle={`${done} of ${total} sections briefed · Week ${week}`} />
      <MethodNote id="load">Each § runs about 10–12 minutes: Cold Call → Objective & Map → Examples → I Do → We Do → You Do → Rebuild the Map → Brain Dump → Exit Ticket.</MethodNote>
      {nextUp && (
        <div className="card gilt row between" style={{ marginBottom: 18 }}>
          <div className="row">
            <Icon name={nextUp.icon} size={30} style={{ color: 'var(--primary)' }} />
            <div>
              <div className="label">next on the syllabus</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>§ {nextUp.label}</div>
              <div className="muted">{nextUp.oneLiner}</div>
            </div>
          </div>
          <Link className="btn primary" to={`/casebook/${nextUp.id}`}>
            {lessons[nextUp.id] ? 'Resume' : 'Begin'} →
          </Link>
        </div>
      )}
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Search the Casebook…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        {(['all', 'LR', 'CL', 'RC', 'AW', 'TS'] as const).map((b) => (
          <button key={b} className={`small ${filter === b ? 'selected' : ''}`} onClick={() => setFilter(b)}>
            {b === 'all' ? 'All' : BRANCH_LABEL[b]}
          </button>
        ))}
      </div>
      {TERMS.map((t) => (
        <Section key={t.n} numeral={`Term ${t.numeral}`} title={`${t.name} — “${t.motto}”`} right={<span className="chip">Weeks {t.weeks[0]}–{t.weeks[1]}</span>}>
          <p className="muted book" style={{ marginTop: -4 }}>
            {t.focus}
          </p>
          <div className="grid auto">
            {WEEKS.filter((w) => w.term === t.n)
              .flatMap((w) => w.concepts.map((cid) => ({ w, c: CONCEPT_BY_ID[cid] })))
              .filter(({ c }) => c?.lesson && (filter === 'all' || c.branch === filter) && (!q || c.label.toLowerCase().includes(q.toLowerCase())))
              .map(({ w, c }) => {
                const l = lessons[c.id];
                const m = masteryFor(c, attempts, lessons, srs);
                const upcoming = w.week > week;
                return (
                  <Link key={c.id} to={`/casebook/${c.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit', opacity: upcoming && !l ? 0.75 : 1 }}>
                    <div className="row between">
                      <span className="label">week {w.week}</span>
                      {l?.completed ? <span className="chip success">✓ Briefed</span> : l ? <span className="chip gold">In progress</span> : upcoming ? <span className="chip">Upcoming</span> : <span className="chip primary">Due now</span>}
                    </div>
                    <div className="row" style={{ marginTop: 6, flexWrap: 'nowrap' }}>
                      <Icon name={c.icon} size={24} style={{ color: 'var(--primary)' }} />
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>§ {c.label}</div>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {c.oneLiner}
                    </div>
                    <div className="row between" style={{ marginTop: 8 }}>
                      <RankBadge level={m.level} small />
                      <span className="muted" style={{ fontSize: 12 }}>
                        {BRANCH_LABEL[c.branch]}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </Section>
      ))}
    </div>
  );
}
