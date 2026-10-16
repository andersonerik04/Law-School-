import { useEffect, useRef } from 'react';
import { useStore, type AppState } from './store';
import { allMastery } from './mastery';
import { CONCEPTS, LR_TYPE_LABEL } from './content';
import { activeDays, streak } from './streak';
import { projectScore } from './scoring';
import { toast } from '../components/common';

export interface Honor {
  id: string;
  title: string;
  body: string;
}

/** Understated, law-themed honors. Feedback praises process and strategy, not talent. */
export const HONORS: Honor[] = [
  { id: 'matriculated', title: 'Matriculated', body: 'You sat the diagnostic and set your baseline. Every expert started exactly here.' },
  { id: 'first-brief', title: 'First Brief Filed', body: 'Your first Casebook lesson is complete — recall, map, and exit ticket.' },
  { id: 'streak-7', title: 'Seven Days in Chambers', body: 'A full week of consistent study. Consistency is the strategy.' },
  { id: 'streak-30', title: 'A Term of Diligence', body: 'Thirty days of steady work. The habit is now doing the heavy lifting.' },
  { id: 'hundred', title: 'Centurion of the Docket', body: '100 questions attempted, each one a deliberate repetition.' },
  { id: 'thousand', title: 'Keeper of the Docket', body: '1,000 questions. Volume plus reflection is how pattern recognition is built.' },
  { id: 'blind', title: 'Blind Justice', body: 'You completed your first blind review — the single most diagnostic habit in LSAT prep.' },
  { id: 'ledger-25', title: 'Clerk of the Ledger', body: 'Twenty-five mistakes fully briefed. Studying errors is how errors stop recurring.' },
  { id: 'law-review', title: 'Elected to the Law Review', body: 'Ten doctrines at Law Review rank or higher, earned through accurate, interleaved practice.' },
  { id: 'coif', title: 'Order of the Coif', body: 'A full examination at 175 or above. Your preparation methods are working.' },
  { id: 'summa', title: 'Summa Cum Laude', body: 'A full examination at 179 or above. Precisely the target you set.' },
  { id: 'moot-champion', title: 'Moot Court Champion', body: 'A perfect 10-question sprint on pace.' },
  { id: 'teaching-fellow', title: 'Teaching Fellow', body: 'You taught a concept to the Clerk until the explanation was airtight.' },
  { id: 'drafter', title: 'Drafter of the Bench', body: 'You wrote your own LSAT question — the top rung of the cognitive ladder.' },
  { id: 'essayist', title: 'Essayist of the Seminar', body: 'You completed a timed Argumentative Writing essay.' },
  ...Object.entries(LR_TYPE_LABEL).map(([k, v]) => ({ id: `bar-${k}`, title: `Admitted to the Bar of ${v} Questions`, body: `Certified at Clerk rank: 85%+ on 20 interleaved, on-pace ${v} questions at difficulty 3+.` })),
];
export const HONOR_BY_ID = Object.fromEntries(HONORS.map((h) => [h.id, h]));

function check(s: AppState): string[] {
  const earned: string[] = [];
  if (s.profile.matriculated) earned.push('matriculated');
  if (Object.values(s.lessons).some((l) => l.completed)) earned.push('first-brief');
  const st = streak(activeDays(s.studyLog, s.attempts, s.cardsReviewedLog));
  if (st.current >= 7) earned.push('streak-7');
  if (st.current >= 30) earned.push('streak-30');
  if (s.attempts.length >= 100) earned.push('hundred');
  if (s.attempts.length >= 1000) earned.push('thousand');
  if (s.exams.some((e) => e.blind && Object.keys(e.blind).length)) earned.push('blind');
  if (s.ledger.filter((l) => l.whyWrong && l.rule && l.rootCause !== 'Unclassified').length >= 25) earned.push('ledger-25');
  if (s.exams.some((e) => e.completed && (e.scaled ?? 0) >= 175)) earned.push('coif');
  if (s.exams.some((e) => e.completed && (e.scaled ?? 0) >= 179)) earned.push('summa');
  if (s.moot.some((m) => m.kind === 'sprint' && m.correct === 10 && m.total === 10)) earned.push('moot-champion');
  if (s.drafts.length) earned.push('drafter');
  if (s.essays.some((e) => e.text.split(/\s+/).length > 150)) earned.push('essayist');
  const m = allMastery(s.attempts, s.lessons, s.srs);
  if (Object.entries(m).filter(([id, x]) => x.level >= 4 && !id.startsWith('grp') && !id.startsWith('br-') && id !== 'lsat').length >= 10) earned.push('law-review');
  for (const c of CONCEPTS) if (c.kind === 'lr-type' && m[c.id]?.certified) earned.push(`bar-${c.id.replace(/^lr-/, '')}`);
  void projectScore;
  return earned;
}

export function useHonors() {
  const attempts = useStore((s) => s.attempts.length);
  const lessons = useStore((s) => s.lessons);
  const exams = useStore((s) => s.exams);
  const moot = useStore((s) => s.moot.length);
  const ledger = useStore((s) => s.ledger);
  const drafts = useStore((s) => s.drafts.length);
  const essays = useStore((s) => s.essays.length);
  const matric = useStore((s) => s.profile.matriculated);
  const first = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = useStore.getState();
      const ids = check(s);
      for (const id of ids) {
        if (s.award(id) && !first.current) {
          const h = HONOR_BY_ID[id];
          if (h) toast(h.title, h.body);
        }
      }
      first.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [attempts, lessons, exams, moot, ledger, drafts, essays, matric]);
}
