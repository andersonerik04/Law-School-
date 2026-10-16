import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type {
  Attempt,
  Essay,
  ExamRecord,
  LedgerEntry,
  LessonProgress,
  LRQuestion,
  NotebookEntry,
  Profile,
  Reflection,
  School,
  Settings,
  SrsCard,
  SrsRating,
  RootCause,
} from './types';
import { newCard, schedule } from './srs';
import { uid, dateKey } from './util';
import { setCustomQuestions } from './content';
import { updateTheta } from './adaptive';

/** IndexedDB-backed storage (falls back to localStorage if IndexedDB is unavailable). */
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await idbGet(name)) ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value);
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    try {
      await idbDel(name);
    } catch {
      localStorage.removeItem(name);
    }
  },
};

export interface MootRecord {
  ts: number;
  kind: 'sprint' | 'identify';
  correct: number;
  total: number;
  ms: number;
}

export interface SeminarDraft {
  id: string;
  ts: number;
  stimulus: string;
  stem: string;
  choices: string[];
  answer: number;
  trapLabels: string[];
  critique?: string;
}

export interface ChatThread {
  id: string;
  kind: 'office-hours' | 'feynman' | 'cross-exam';
  title: string;
  ts: number;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface DrillRecord {
  ts: number;
  conceptOrType: string;
  mode: string;
  correct: number;
  total: number;
}

export interface AppState {
  settings: Settings;
  profile: Profile;
  attempts: Attempt[];
  srs: Record<string, SrsCard>;
  ledger: LedgerEntry[];
  lessons: Record<string, LessonProgress>;
  exams: ExamRecord[];
  theta: Record<string, number>;
  notebook: NotebookEntry[];
  schools: School[];
  reflections: Reflection[];
  plannerChecks: Record<string, boolean>;
  essays: Essay[];
  moot: MootRecord[];
  drills: DrillRecord[];
  customQuestions: LRQuestion[];
  drafts: SeminarDraft[];
  threads: ChatThread[];
  honors: { id: string; ts: number }[];
  studyLog: Record<string, number>; // dateKey → minutes
  cardsReviewedLog: Record<string, number>;
  version: number;

  // actions
  setSettings: (s: Partial<Settings>) => void;
  setProfile: (p: Partial<Profile>) => void;
  recordAttempt: (a: Omit<Attempt, 'id' | 'ts'> & { ts?: number }) => Attempt;
  setWhyGrade: (attemptId: string, grade: Attempt['whyGrade'], lucky?: boolean) => void;
  ensureCard: (id: string, kind: SrsCard['kind'], ref: string) => void;
  reviewCard: (id: string, rating: SrsRating) => void;
  removeCard: (id: string) => void;
  updateLedger: (id: string, patch: Partial<LedgerEntry>) => void;
  deleteLedger: (id: string) => void;
  setLesson: (conceptId: string, patch: Partial<LessonProgress>) => void;
  saveExam: (e: ExamRecord) => void;
  deleteExam: (id: string) => void;
  upsertNote: (n: NotebookEntry) => void;
  deleteNote: (id: string) => void;
  upsertSchool: (s: School) => void;
  deleteSchool: (id: string) => void;
  addReflection: (r: Omit<Reflection, 'id' | 'ts'>) => void;
  togglePlanner: (taskId: string) => void;
  saveEssay: (e: Essay) => void;
  addMoot: (m: MootRecord) => void;
  addDrill: (d: DrillRecord) => void;
  addCustomQuestion: (q: LRQuestion) => void;
  removeCustomQuestion: (id: string) => void;
  saveDraft: (d: SeminarDraft) => void;
  saveThread: (t: ChatThread) => void;
  deleteThread: (id: string) => void;
  award: (id: string) => boolean;
  logMinutes: (m: number) => void;
  importData: (json: string) => void;
  resetAll: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'crimson',
  mode: 'light',
  passageSize: 18,
  apiKey: '',
  model: 'claude-opus-5-5',
  homeView: 'docket',
  ttsRate: 1,
  ttsVoice: '',
  reduceMotion: false,
  requireWhy: 'often',
  serverFallback: true,
};

const DEFAULT_PROFILE: Profile = {
  matriculated: false,
  name: '',
  startDate: dateKey(),
  testDate: '2027-04-10',
  hoursPerWeek: 15,
  preferredTimes: ['Morning'],
};

function initial() {
  return {
    settings: DEFAULT_SETTINGS,
    profile: DEFAULT_PROFILE,
    attempts: [] as Attempt[],
    srs: {} as Record<string, SrsCard>,
    ledger: [] as LedgerEntry[],
    lessons: {} as Record<string, LessonProgress>,
    exams: [] as ExamRecord[],
    theta: {} as Record<string, number>,
    notebook: [] as NotebookEntry[],
    schools: [] as School[],
    reflections: [] as Reflection[],
    plannerChecks: {} as Record<string, boolean>,
    essays: [] as Essay[],
    moot: [] as MootRecord[],
    drills: [] as DrillRecord[],
    customQuestions: [] as LRQuestion[],
    drafts: [] as SeminarDraft[],
    threads: [] as ChatThread[],
    honors: [] as { id: string; ts: number }[],
    studyLog: {} as Record<string, number>,
    cardsReviewedLog: {} as Record<string, number>,
    version: 1,
  };
}

function suggestRootCause(a: Attempt): RootCause {
  if (a.timeMs > 0 && a.timeMs < 30_000 && a.context !== 'review') return 'Timing';
  if (a.confidence === 'Certain') return 'Trap';
  return 'Unclassified';
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),

      recordAttempt: (input) => {
        const a: Attempt = { ...input, id: uid('a_'), ts: input.ts ?? Date.now() };
        const st = get();
        const theta = updateTheta(st.theta, a);
        const ledger = st.ledger.slice();
        const srs = { ...st.srs };
        const guessCorrect = a.correct && a.confidence === 'Guess';
        if (a.context !== 'tutor' && (!a.correct || guessCorrect || a.lucky)) {
          const kind: LedgerEntry['kind'] = !a.correct ? 'miss' : a.lucky ? 'lucky' : 'guess';
          const existing = ledger.findIndex((l) => l.qid === a.qid && !l.resolved);
          if (existing >= 0) {
            ledger[existing] = { ...ledger[existing], ts: a.ts, attemptId: a.id, kind, chosen: a.choice };
          } else {
            ledger.unshift({
              id: uid('l_'),
              qid: a.qid,
              attemptId: a.id,
              ts: a.ts,
              kind,
              chosen: a.choice,
              whyWrong: '',
              shouldHaveSeen: '',
              rule: '',
              rootCause: suggestRootCause(a),
            });
          }
          const cid = `q:${a.qid}`;
          srs[cid] = srs[cid] ? schedule(srs[cid], 'again', a.ts) : { ...newCard(cid, 'question', a.qid, a.ts) };
        }
        // study time is logged separately by the activity heartbeat in App
        set({ attempts: [...st.attempts, a], theta, ledger, srs });
        return a;
      },

      setWhyGrade: (attemptId, grade, lucky) => {
        const st = get();
        const attempts = st.attempts.map((a) => (a.id === attemptId ? { ...a, whyGrade: grade, lucky: lucky ?? a.lucky } : a));
        set({ attempts });
        const a = attempts.find((x) => x.id === attemptId);
        if (a && lucky && a.correct) {
          // a "lucky win" — log it and send it back into review
          const ledger = st.ledger.slice();
          if (!ledger.some((l) => l.qid === a.qid && !l.resolved)) {
            ledger.unshift({
              id: uid('l_'),
              qid: a.qid,
              attemptId: a.id,
              ts: a.ts,
              kind: 'lucky',
              chosen: a.choice,
              whyWrong: '',
              shouldHaveSeen: '',
              rule: '',
              rootCause: 'Process',
            });
          }
          const cid = `q:${a.qid}`;
          const srs = { ...get().srs, [cid]: get().srs[cid] ?? newCard(cid, 'question', a.qid) };
          set({ ledger, srs });
        }
      },

      ensureCard: (id, kind, ref) => {
        if (get().srs[id]) return;
        set({ srs: { ...get().srs, [id]: newCard(id, kind, ref) } });
      },
      reviewCard: (id, rating) => {
        const c = get().srs[id];
        if (!c) return;
        const dk = dateKey();
        set({
          srs: { ...get().srs, [id]: schedule(c, rating) },
          cardsReviewedLog: { ...get().cardsReviewedLog, [dk]: (get().cardsReviewedLog[dk] ?? 0) + 1 },
        });
      },
      removeCard: (id) => {
        const srs = { ...get().srs };
        delete srs[id];
        set({ srs });
      },

      updateLedger: (id, patch) => set({ ledger: get().ledger.map((l) => (l.id === id ? { ...l, ...patch } : l)) }),
      deleteLedger: (id) => set({ ledger: get().ledger.filter((l) => l.id !== id) }),

      setLesson: (conceptId, patch) =>
        set({
          lessons: {
            ...get().lessons,
            [conceptId]: { ...{ completed: false, stage: 0 }, ...get().lessons[conceptId], ...patch, ts: Date.now() },
          },
        }),

      saveExam: (e) => {
        const exams = get().exams.filter((x) => x.id !== e.id);
        set({ exams: [...exams, e].sort((a, b) => a.ts - b.ts) });
      },
      deleteExam: (id) => set({ exams: get().exams.filter((x) => x.id !== id) }),

      upsertNote: (n) => set({ notebook: [n, ...get().notebook.filter((x) => x.id !== n.id)] }),
      deleteNote: (id) => set({ notebook: get().notebook.filter((x) => x.id !== id) }),

      upsertSchool: (s) => {
        const list = get().schools.slice();
        const i = list.findIndex((x) => x.id === s.id);
        if (i >= 0) list[i] = s;
        else list.push(s);
        set({ schools: list });
      },
      deleteSchool: (id) => set({ schools: get().schools.filter((x) => x.id !== id) }),

      addReflection: (r) => set({ reflections: [...get().reflections, { ...r, id: uid('r_'), ts: Date.now() }] }),
      togglePlanner: (taskId) => set({ plannerChecks: { ...get().plannerChecks, [taskId]: !get().plannerChecks[taskId] } }),
      saveEssay: (e) => set({ essays: [e, ...get().essays.filter((x) => x.id !== e.id)] }),
      addMoot: (m) => set({ moot: [...get().moot, m] }),
      addDrill: (d) => set({ drills: [...get().drills, d] }),

      addCustomQuestion: (q) => {
        const customQuestions = [...get().customQuestions.filter((x) => x.id !== q.id), { ...q, custom: true }];
        setCustomQuestions(customQuestions);
        set({ customQuestions });
      },
      removeCustomQuestion: (id) => {
        const customQuestions = get().customQuestions.filter((x) => x.id !== id);
        setCustomQuestions(customQuestions);
        set({ customQuestions });
      },

      saveDraft: (d) => set({ drafts: [d, ...get().drafts.filter((x) => x.id !== d.id)] }),
      saveThread: (t) => set({ threads: [t, ...get().threads.filter((x) => x.id !== t.id)] }),
      deleteThread: (id) => set({ threads: get().threads.filter((x) => x.id !== id) }),

      award: (id) => {
        if (get().honors.some((h) => h.id === id)) return false;
        set({ honors: [...get().honors, { id, ts: Date.now() }] });
        return true;
      },

      logMinutes: (m) => {
        const dk = dateKey();
        set({ studyLog: { ...get().studyLog, [dk]: +((get().studyLog[dk] ?? 0) + m).toFixed(2) } });
      },

      importData: (json) => {
        const data = JSON.parse(json);
        const base = initial();
        const merged = { ...base, ...data, settings: { ...base.settings, ...(data.settings ?? {}) }, profile: { ...base.profile, ...(data.profile ?? {}) } };
        setCustomQuestions(merged.customQuestions ?? []);
        set(merged);
      },
      resetAll: () => {
        setCustomQuestions([]);
        set(initial());
      },
    }),
    {
      name: 'bar-bench-lsat-v1',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) setCustomQuestions(state.customQuestions ?? []);
      },
    },
  ),
);

/** Serializable snapshot of all user data (for export). */
export function exportData(): string {
  const s = useStore.getState();
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v !== 'function') data[k] = v;
  }
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'bar-bench-lsat' }, null, 1);
}
