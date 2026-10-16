import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { Attempt, SrsCard, SrsRating } from '../lib/types';
import { CONCEPT_BY_ID, INDICATORS, LR_QUESTIONS, getQuestion, typeLabel } from '../lib/content';
import { previewIntervals, fmtInterval, DAY } from '../lib/srs';
import { mentions } from '../lib/util';
import { CasebookHeader, MethodNote, Empty, Progress } from '../components/common';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { ArgumentDiagram } from '../visuals/ArgumentDiagram';
import { BuildAMap } from '../visuals/MindMap';
import { idTree } from '../visuals/mindLayout';
import { Icon } from '../visuals/Icon';

const RATINGS: SrsRating[] = ['again', 'hard', 'good', 'easy'];

function RateBar({ card, onRate, suggest }: { card: SrsCard; onRate: (r: SrsRating) => void; suggest?: SrsRating }) {
  const p = previewIntervals(card);
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <span className="label">rate your recall</span>
      {RATINGS.map((r) => (
        <button key={r} className={`small ${suggest === r ? 'selected' : ''} ${r === 'again' ? 'danger' : ''}`} onClick={() => onRate(r)}>
          {r[0].toUpperCase() + r.slice(1)} · {fmtInterval(p[r])}
        </button>
      ))}
    </div>
  );
}

/** Visual front for a concept card: emblem plus, for flaws and types, a diagram fragment. */
function VisualFront({ conceptId }: { conceptId: string }) {
  const c = CONCEPT_BY_ID[conceptId];
  if (!c) return null;
  const sample = c.kind === 'flaw' ? LR_QUESTIONS.find((q) => q.flaw === c.id.replace('flaw-', '') && q.stimulus.some((s) => s.r === 'C')) : undefined;
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <Icon name={c.icon} size={64} stroke={1.2} style={{ color: 'var(--primary)' }} />
      {sample && (
        <div style={{ width: '100%', maxWidth: 560 }}>
          <ArgumentDiagram q={sample} overlay="flaw" step={5} compact overlayText="?" />
        </div>
      )}
    </div>
  );
}

export default function Reviews() {
  const srs = useStore((s) => s.srs);
  const reviewCard = useStore((s) => s.reviewCard);
  const ensureCard = useStore((s) => s.ensureCard);
  const [now] = useState(Date.now());
  const due = useMemo(() => Object.values(srs).filter((c) => c.due <= now).sort((a, b) => a.due - b.due), [srs, now]);
  const [queue] = useState(() => due.map((c) => c.id));
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [qAttempt, setQAttempt] = useState<Attempt | null>(null);
  const upcoming = Object.values(srs).filter((c) => c.due > now);
  const nextWeek = upcoming.filter((c) => c.due <= now + 7 * DAY).length;

  const id = queue[i];
  const card = id ? srs[id] : undefined;
  const advance = (r: SrsRating) => {
    if (card) reviewCard(card.id, r);
    setI(i + 1);
    setAnswer('');
    setRevealed(false);
    setQAttempt(null);
  };

  const header = (
    <CasebookHeader chapter="DAILY REVIEWS" title="The Review Calendar" subtitle={`${queue.length} due today · ${nextWeek} due within 7 days · ${Object.keys(srs).length} cards in your system`} />
  );

  if (!queue.length || i >= queue.length) {
    return (
      <div>
        {header}
        <MethodNote id="spacing" />
        <div className="card gilt" style={{ textAlign: 'center' }}>
          <Icon name="laurel" size={40} style={{ color: 'var(--gold)' }} />
          <h3>{queue.length ? 'The calendar is clear.' : 'Nothing is due today.'}</h3>
          <p className="book">{queue.length ? `You reviewed ${queue.length} card${queue.length > 1 ? 's' : ''}. Each one now waits until just before you would forget it.` : 'Complete lessons and drills; missed questions, doctrines, and maps enter the schedule automatically.'}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button
              onClick={() => {
                INDICATORS.forEach((x) => ensureCard(`ind:${x.id}`, 'indicator', x.id));
              }}
            >
              Add the conditional-indicator deck ({INDICATORS.length} cards)
            </button>
            <Link className="btn primary" to="/chambers">
              Go to Chambers
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (!card) {
    return (
      <div>
        {header}
        <div className="card">
          <p>This card was removed from your system.</p>
          <button onClick={() => setI(i + 1)}>Skip</button>
        </div>
      </div>
    );
  }

  let body: React.ReactNode = null;
  if (card.kind === 'question' || card.kind === 'ledger') {
    const q = getQuestion(card.ref);
    body = q ? (
      <div>
        <div className="label">re-argue a question from your ledger</div>
        <QuestionPlayer key={card.id + i} q={q} context="review" requireWhy onAttempt={(a) => setQAttempt(a)} nextLabel="Rate this review" onNext={() => setRevealed(true)} />
        {qAttempt && <RateBar card={card} onRate={advance} suggest={!qAttempt.correct ? 'again' : qAttempt.confidence === 'Guess' ? 'hard' : qAttempt.confidence === 'Certain' ? 'easy' : 'good'} />}
      </div>
    ) : (
      <Empty>Question no longer exists.</Empty>
    );
  } else if (card.kind === 'concept') {
    const c = CONCEPT_BY_ID[card.ref];
    body = c?.card ? (
      <div className="card gilt">
        <div className="row between">
          <div className="label">doctrine · {c.label}</div>
          <span className="chip">{c.kind === 'lr-type' ? typeLabel(c.id.replace('lr-', '') as never) : c.branch}</span>
        </div>
        <VisualFront conceptId={c.id} />
        <p className="book" style={{ fontSize: 20, textAlign: 'center' }}>
          {c.card.front}
        </p>
        <MethodNote id="retrieval">Type your answer—recall, not recognition.</MethodNote>
        <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={revealed} placeholder="From memory…" />
        {!revealed ? (
          <button className="primary" style={{ marginTop: 8 }} disabled={!answer.trim()} onClick={() => setRevealed(true)}>
            Reveal
          </button>
        ) : (
          <div className="fade-in">
            <div className="card sunk" style={{ marginTop: 8 }}>
              <b>Answer:</b> {c.card.back}
              <div className="muted" style={{ fontSize: 13 }}>
                Keywords you recalled: {c.card.keywords.filter((k) => mentions(answer, k)).length}/{c.card.keywords.length}
              </div>
            </div>
            <RateBar card={card} onRate={advance} suggest={c.card.keywords.filter((k) => mentions(answer, k)).length >= Math.ceil(c.card.keywords.length / 2) ? 'good' : 'again'} />
          </div>
        )}
      </div>
    ) : null;
  } else if (card.kind === 'map') {
    const c = CONCEPT_BY_ID[card.ref];
    body = c?.mindMap ? (
      <div className="card">
        <div className="label">rebuild the map · {c.label}</div>
        <BuildAMap tree={idTree(c.mindMap, c.id + '-rv-')} height={380} onGraded={() => setRevealed(true)} />
        {revealed && <RateBar card={card} onRate={advance} />}
      </div>
    ) : null;
  } else if (card.kind === 'indicator') {
    const ind = INDICATORS.find((x) => x.id === card.ref);
    body = ind ? (
      <div className="card gilt">
        <div className="label">conditional indicator · “{ind.phrase}”</div>
        <p className="book" style={{ fontSize: 20 }}>
          Translate into arrows: <i>{ind.example}</i>
        </p>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={revealed} placeholder="e.g., A → B" />
        {!revealed ? (
          <button className="primary" style={{ marginTop: 8 }} disabled={!answer.trim()} onClick={() => setRevealed(true)}>
            Reveal
          </button>
        ) : (
          <div className="fade-in">
            <div className="card sunk" style={{ marginTop: 8 }}>
              <div>
                <b>Translation:</b> <span className="mono">{ind.translation}</span>
              </div>
              <div>
                <b>Rule:</b> {ind.rule}
              </div>
            </div>
            <RateBar card={card} onRate={advance} />
          </div>
        )}
      </div>
    ) : null;
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {header}
      <Progress value={i} max={queue.length} />
      <div className="muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>
        Card {i + 1} of {queue.length} · step {Math.max(0, card.step) + 1} on the ladder · {card.reps} prior reviews · {card.lapses} lapses
      </div>
      <div className="page-turn" key={card.id + i}>
        {body ?? (
          <div className="card">
            <p>This card’s source is unavailable.</p>
            <button onClick={() => advance('good')}>Skip</button>
          </div>
        )}
      </div>
    </div>
  );
}
