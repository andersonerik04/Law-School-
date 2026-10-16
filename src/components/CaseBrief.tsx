import { useState } from 'react';
import type { Question } from '../lib/types';
import { isLR, PASSAGE_BY_ID, TRAP_LABEL, typeLabel, FLAW_LABEL } from '../lib/content';
import { ArgumentDiagram, overlayForType } from '../visuals/ArgumentDiagram';
import { ArrowChain } from '../visuals/LogicGraphics';
import { PassageMap } from '../visuals/RCVisuals';
import { Icon } from '../visuals/Icon';
import { LETTERS } from '../lib/util';
import { lit } from '../lib/logic';
import { ReadAloud } from './common';

/** The explanation, written as a mini case brief: Facts · Issue · Rule · Analysis · Holding · Diagram. */
export function CaseBrief({ q, chosen, compact }: { q: Question; chosen?: number | null; compact?: boolean }) {
  const [step, setStep] = useState(99);
  const b = q.brief;
  const animate = () => {
    setStep(0);
    [1, 2, 3, 4, 5].forEach((s) => setTimeout(() => setStep(s), s * 750));
  };
  const narration = `Facts. ${b.facts} Issue. ${b.issue} Rule. ${b.rule} Analysis. ${b.analysis.correct} Holding. ${b.holding}`;
  return (
    <div className="brief fade-in">
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          <span className="chip gold">
            <Icon name={isLR(q) ? q.type : 'rc'} size={13} /> {typeLabel(q.type)}
          </span>
          <span className="chip">Difficulty {q.difficulty}</span>
          {isLR(q) && q.flaw && <span className="chip primary">{FLAW_LABEL[q.flaw]}</span>}
          <span className="chip">{q.bloom}</span>
        </div>
        <ReadAloud text={narration} label="Narrate brief" />
      </div>
      <div className="brief-h">Facts</div>
      <div>{b.facts}</div>
      <div className="brief-h">Issue</div>
      <div>{b.issue}</div>
      <div className="brief-h">Rule</div>
      <div>{b.rule}</div>
      <div className="brief-h">Analysis</div>
      <div style={{ borderLeft: '3px solid var(--success)', paddingLeft: 10, margin: '4px 0 8px' }}>{b.analysis.correct}</div>
      <div className="stack tight">
        {b.analysis.wrong.map((w) => (
          <div key={w.choice} style={{ display: 'grid', gridTemplateColumns: '28px 170px 1fr', gap: 8, alignItems: 'baseline', background: chosen === w.choice ? 'var(--danger-soft)' : undefined, padding: '3px 4px', borderRadius: 4 }}>
            <b style={{ fontFamily: 'var(--font-display)' }}>({LETTERS[w.choice]})</b>
            <span className="chip danger" style={{ justifySelf: 'start' }}>
              <Icon name={w.label} size={12} /> {TRAP_LABEL[w.label]}
            </span>
            <span>{w.why}</span>
          </div>
        ))}
      </div>
      <div className="brief-h">Holding</div>
      <div className="holding">{b.holding}</div>
      {!compact && (
        <>
          <div className="row between" style={{ marginTop: 12 }}>
            <div className="brief-h" style={{ margin: 0 }}>
              Diagram
            </div>
            <button className="small gold" onClick={animate}>
              ▶ Build the diagram
            </button>
          </div>
          <div className="card flat" style={{ marginTop: 6, background: 'var(--paper)' }}>
            {isLR(q) ? (
              <>
                <ArgumentDiagram q={q} step={step} overlay={overlayForType(q.type)} overlayText={q.choices[q.answer]} />
                {q.diagram.chain && q.stimulus.some((s) => s.r === 'C') && (
                  <div style={{ marginTop: 10 }}>
                    <div className="label" style={{ textAlign: 'center' }}>
                      the conditional chain
                    </div>
                    <ArrowChain chain={q.diagram.chain.map((c) => lit(c))} />
                  </div>
                )}
              </>
            ) : (
              <PassageMap paragraphs={PASSAGE_BY_ID[q.passageId]?.passages.flatMap((p) => p.paragraphs) ?? []} step={step === 99 ? 99 : step * 2} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
