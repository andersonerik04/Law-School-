import { useState } from 'react';
import { CasebookHeader, Section, MethodNote, MasteryLegend } from '../components/common';
import { METHODS } from '../lib/pedagogy';
import { ArgumentDiagram, type Overlay } from '../visuals/ArgumentDiagram';
import { ArrowChain, QuantVenn, LogicCircuit } from '../visuals/LogicGraphics';
import { ConceptMindMap } from '../visuals/MindMap';
import { idTree } from '../visuals/mindLayout';
import { Icon, ICON_NAMES } from '../visuals/Icon';
import { ToneMeter } from '../visuals/RCVisuals';
import { lit } from '../lib/logic';
import type { LRQuestion } from '../lib/types';
import { RANK_BLURB, RANKS } from '../lib/mastery';
import { curveTable, percentile } from '../lib/scoring';

const SAMPLE: Pick<LRQuestion, 'stimulus' | 'diagram' | 'type'> = {
  type: 'necessary-assumption',
  stimulus: [
    { t: 'Since the tribunal adopted written pleadings, its average case duration has fallen by a third.', r: 'P' },
    { t: 'Other tribunals that adopted written pleadings saw similar declines.', r: 'P' },
    { t: 'So the reform, not changes in caseload, caused the faster resolutions.', r: 'C' },
    { t: 'Some observers credit a new docketing system instead.', r: 'K' },
  ],
  diagram: { gap: 'The caseload did not shrink over the same period.', overlay: 'na' },
};

export default function Handbook() {
  const [ov, setOv] = useState<Overlay>('na');
  const [step, setStep] = useState(99);
  return (
    <div>
      <CasebookHeader chapter="THE FACULTY HANDBOOK" title="How the Academy Teaches" subtitle="Every feature is built on a method from cognitive science. Here is each one, in a sentence." />

      <Section numeral="I" title="The Methods">
        <div className="grid cols-2">
          {METHODS.map((m) => (
            <div key={m.id} className="card flat">
              <div className="label">
                {m.letter} · {m.name}
              </div>
              <p className="book" style={{ fontSize: 16, margin: '4px 0 0' }}>
                {m.what}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section numeral="II" title="Ranks of Mastery">
        <MasteryLegend />
        <table className="ledger" style={{ marginTop: 12 }}>
          <tbody>
            {RANKS.map((r) => (
              <tr key={r}>
                <td style={{ width: 130 }}>
                  <b>{r}</b>
                </td>
                <td>{RANK_BLURB[r]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <MethodNote id="mastery" />
      </Section>

      <Section numeral="III" title="The Visual Engine">
        <MethodNote id="dual" />
        <div className="card">
          <div className="card-title">
            <h3>Argument Diagram — question-type overlays</h3>
            <div className="row">
              {(['none', 'strengthen', 'weaken', 'flaw', 'sa', 'na'] as Overlay[]).map((o) => (
                <button key={o} className={`small ${ov === o ? 'selected' : ''}`} onClick={() => setOv(o)}>
                  {o === 'sa' ? 'Sufficient' : o === 'na' ? 'Necessary' : o[0].toUpperCase() + o.slice(1)}
                </button>
              ))}
              <button className="small gold" onClick={() => { setStep(0); [1, 2, 3, 4, 5].forEach((s) => setTimeout(() => setStep(s), s * 700)); }}>
                ▶ Build it
              </button>
            </div>
          </div>
          <ArgumentDiagram q={SAMPLE} overlay={ov} step={step} />
        </div>
        <div className="grid cols-2" style={{ marginTop: 18 }}>
          <div className="card">
            <h3>Arrow Chain &amp; Contrapositive</h3>
            <ArrowChain chain={[lit('Ratified'), lit('Binding'), lit('Enforceable')]} labels />
          </div>
          <div className="card">
            <h3>Quantifier Venn</h3>
            <QuantVenn sets={['Treaties', 'Ratified', 'Enforced']} statements={[{ q: 'all', a: 'Treaties', b: 'Ratified' }, { q: 'some', a: 'Ratified', b: 'Enforced' }]} size={300} />
          </div>
          <div className="card">
            <h3>Logic Circuit</h3>
            <LogicCircuit
              conds={[
                { a: lit('Audit'), b: lit('Disclosure') },
                { a: lit('Disclosure'), b: lit('Review') },
                { a: lit('Review'), b: lit('Approval') },
              ]}
              query={{ a: lit('Audit'), b: lit('Approval') }}
            />
          </div>
          <div className="card">
            <h3>Tone Meter</h3>
            <ToneMeter value={-0.8} word="Measured skepticism" note="The author doubts the theory but concedes its explanatory value." />
          </div>
        </div>
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Concept Mind Map</h3>
          <ConceptMindMap
            height={380}
            tree={idTree({
              label: 'Necessary Assumption',
              children: [
                { label: 'Definition', children: [{ label: 'Required for conclusion' }, { label: 'Not enough alone' }] },
                { label: 'Negation Test', children: [{ label: 'Negate the answer' }, { label: 'Argument collapses?' }] },
                { label: 'Traps', children: [{ label: 'Too Strong' }, { label: 'Sufficient but not necessary' }] },
                { label: 'Relatives', children: [{ label: 'Weaken' }, { label: 'Flaw' }] },
              ],
            })}
          />
        </div>
        <div className="card" style={{ marginTop: 18 }}>
          <h3>The Emblem Library</h3>
          <div className="row" style={{ gap: 14 }}>
            {ICON_NAMES.map((n) => (
              <div key={n} title={n} style={{ textAlign: 'center', width: 74, fontSize: 10, color: 'var(--muted)' }}>
                <Icon name={n} size={26} style={{ color: 'var(--primary)' }} />
                <div>{n}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section numeral="IV" title="The Scoring Curve">
        <p className="book" style={{ fontSize: 16 }}>
          Practice scores convert raw results to the 120–180 scale with a curve modeled on recent post-2024 forms (two scored LR sections and one scored RC section, roughly 76 scored questions). Forms of any length are converted by proportion. Values are approximate.
        </p>
        <table className="ledger" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>Scaled</th>
              <th>Max misses (of 76)</th>
              <th>≈ Percentile</th>
            </tr>
          </thead>
          <tbody>
            {curveTable()
              .filter((r) => r.scaled >= 165)
              .map((r) => (
                <tr key={r.scaled} style={r.scaled === 179 ? { background: 'var(--gold-soft)' } : undefined}>
                  <td>
                    <b>{r.scaled}</b>
                  </td>
                  <td>{r.maxMisses < 0 ? '—' : `−${r.maxMisses}`}</td>
                  <td>{percentile(r.scaled)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
