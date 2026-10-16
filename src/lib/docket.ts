import type { Attempt, Concept, LessonProgress, SrsCard, Profile } from './types';
import { CONCEPT_BY_ID, WEEKS } from './content';
import { currentWeek, weekInfo } from './mastery';

export interface DocketItem {
  kind: 'lesson' | 'review' | 'practice' | 'exam' | 'writing' | 'reflection';
  title: string;
  detail: string;
  minutes: number;
  to: string;
  done?: boolean;
}

/** Today's Docket: new learning + due spaced reviews + interleaved practice, sized to the learner's hours. */
export function buildDocket(profile: Profile, lessons: Record<string, LessonProgress>, srs: Record<string, SrsCard>, attempts: Attempt[], now = Date.now()) {
  const week = currentWeek(profile.startDate, profile.planWeeks, now);
  const info = weekInfo(week);
  const minutesPerDay = Math.round((profile.hoursPerWeek * 60) / 6);
  const items: DocketItem[] = [];

  // 1. New learning: earliest incomplete lessons up to the current week
  const pending: Concept[] = [];
  for (const w of WEEKS) {
    if (w.week > week) break;
    for (const id of w.concepts) {
      const c = CONCEPT_BY_ID[id];
      if (c?.lesson && !lessons[id]?.completed) pending.push(c);
    }
  }
  const lessonSlots = minutesPerDay >= 100 ? 2 : 1;
  pending.slice(0, lessonSlots).forEach((c) =>
    items.push({ kind: 'lesson', title: `§ ${c.label}`, detail: lessons[c.id] ? 'Resume where you left off' : 'New lesson', minutes: 12, to: `/casebook/${c.id}` }),
  );

  // 2. Spaced reviews
  const due = Object.values(srs).filter((c) => c.due <= now);
  if (due.length)
    items.push({ kind: 'review', title: `${due.length} spaced review${due.length > 1 ? 's' : ''} due`, detail: `${due.filter((d) => d.kind === 'question').length} missed questions · ${due.filter((d) => d.kind !== 'question').length} doctrines & maps`, minutes: Math.max(3, Math.round(due.length * 0.75)), to: '/reviews' });

  // 3. Interleaved / adaptive practice with the remaining time
  const used = items.reduce((s, i) => s + i.minutes, 0);
  const practiceMin = Math.max(10, minutesPerDay - used);
  const n = Math.max(5, Math.min(30, Math.round(practiceMin / 1.6)));
  const modeLabel = info.blockedRatio >= 0.5 ? 'mostly blocked' : info.blockedRatio > 0 ? 'mixed' : week >= 25 ? 'adaptive' : 'interleaved';
  items.push({ kind: 'practice', title: `Chambers: ${n}-question set`, detail: `${modeLabel} practice (${Math.round(info.blockedRatio * 100)}% blocked this week)`, minutes: Math.round(n * 1.5), to: `/chambers?auto=1&n=${n}` });

  // 4. Weekly items
  const dow = new Date(now).getDay();
  if (info.exams > 0 && (dow === 6 || dow === 0)) items.push({ kind: 'exam', title: 'Full practice examination', detail: 'Four sections, 35 minutes each, with intermission', minutes: 155, to: '/exam' });
  if (week >= 23 && dow === 3) items.push({ kind: 'writing', title: 'Argumentative Writing', detail: 'One timed essay with visual prewriting', minutes: 50, to: '/writing' });
  if (dow === 0) items.push({ kind: 'reflection', title: 'Weekly reflection', detail: 'What worked? What didn’t? What will change?', minutes: 5, to: '/planner#reflection' });

  const today = new Date(now).toDateString();
  const doneToday = attempts.filter((a) => new Date(a.ts).toDateString() === today).length;
  return { week, info, items, minutes: items.reduce((s, i) => s + i.minutes, 0), minutesPerDay, dueCount: due.length, doneToday };
}
