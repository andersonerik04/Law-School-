import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { buildExam } from '../lib/exam';
import { currentWeek, termForWeek } from '../lib/mastery';
import { CasebookHeader, MethodNote, Section, Empty } from '../components/common';
import { Icon } from '../visuals/Icon';
import { percentile } from '../lib/scoring';
import { examRaw } from '../lib/analytics';

export default function ExamRoom() {
  const nav = useNavigate();
  const exams = useStore((s) => s.exams);
  const saveExam = useStore((s) => s.saveExam);
  const deleteExam = useStore((s) => s.deleteExam);
  const profile = useStore((s) => s.profile);
  const week = currentWeek(profile.startDate, profile.planWeeks);
  const term = termForWeek(week);
  const inProgress = exams.filter((e) => !e.completed);
  const done = exams.filter((e) => e.completed).sort((a, b) => b.ts - a.ts);

  const start = (kind: 'full' | 'term') => {
    const n = exams.length + 1;
    const title = kind === 'term' ? `Term ${term.numeral} Examination` : `Practice Examination No. ${n}`;
    const e = buildExam(title, kind, exams);
    saveExam(e);
    nav(`/exam/${e.id}`);
  };

  return (
    <div>
      <CasebookHeader chapter="THE EXAMINATION ROOM" title="Under Test Conditions" subtitle="Four sections · 35 minutes each · a 10-minute intermission after Section 2 · no feedback until the end" />
      <MethodNote id="formative">Term examinations are the summative assessments; each closes a Term.</MethodNote>
      <div className="grid cols-2">
        <div className="card gilt stack">
          <div className="row">
            <Icon name="exam" size={30} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>Begin an examination</h3>
          </div>
          <ul className="book" style={{ fontSize: 16, margin: 0 }}>
            <li>Two scored Logical Reasoning sections and one scored Reading Comprehension section (four passage sets, one comparative).</li>
            <li>One unscored experimental section, LR or RC, placed at random. Treat every section as scored.</li>
            <li>Sections lock when you leave them. Highlighter (H, three colors), strikethrough (Shift + letter), flag (F), navigator grid, five-minute warning.</li>
            <li>No diagrams, hints, or feedback until you finish. Then: Blind Review, then the Opinion of the Examiner.</li>
          </ul>
          <div className="row">
            <button className="primary" onClick={() => start('full')}>
              Sit a full practice exam
            </button>
            <button onClick={() => start('term')}>Sit the Term {term.numeral} Examination</button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            The starter bank fills two LR sections and one RC section; add question files (or generate questions in Office Hours) to lengthen forms. Scores are curve-normalized to any length.
          </div>
        </div>
        <div className="card">
          <h3>In progress</h3>
          {inProgress.length ? (
            inProgress.map((e) => (
              <div key={e.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
                <div>
                  <b>{e.title}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {new Date(e.ts).toLocaleString()} · {e.phase === 'blind' ? 'awaiting blind review' : `section ${(e.current ?? 0) + 1} of ${e.sections.length}`}
                  </div>
                </div>
                <div className="row">
                  <button className="small primary" onClick={() => nav(e.phase === 'blind' ? `/blind/${e.id}` : `/exam/${e.id}`)}>
                    Resume
                  </button>
                  <button className="small danger" onClick={() => confirm('Abandon this examination?') && deleteExam(e.id)}>
                    Abandon
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty>No examination in progress.</Empty>
          )}
        </div>
      </div>
      <Section numeral="I" title="The Record of Examinations">
        {done.length ? (
          <table className="ledger">
            <thead>
              <tr>
                <th>Examination</th>
                <th>Date</th>
                <th>Raw</th>
                <th>Scaled</th>
                <th>Blind review</th>
                <th>Percentile</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {done.map((e) => {
                const r = examRaw(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <b>{e.title}</b>
                    </td>
                    <td>{new Date(e.ts).toLocaleDateString()}</td>
                    <td>
                      {r.raw}/{r.max}
                    </td>
                    <td style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{e.scaled ?? r.scaled}</td>
                    <td>{e.blindScaled ?? '—'}</td>
                    <td>{percentile(e.scaled ?? r.scaled)}</td>
                    <td>
                      <Link to={`/opinion/${e.id}`}>Opinion →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>No examinations on the record yet.</Empty>
        )}
      </Section>
    </div>
  );
}
