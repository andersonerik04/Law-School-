import { useEffect, useState, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useStore } from './lib/store';
import { Layout } from './components/Layout';
import { Toasts } from './components/common';
import { useHonors } from './lib/honors';
import Docket from './pages/Docket';

const MapOfLaw = lazy(() => import('./pages/MapOfLaw'));
const Matriculation = lazy(() => import('./pages/Matriculation'));
const Casebook = lazy(() => import('./pages/Casebook'));
const Lesson = lazy(() => import('./pages/Lesson'));
const Chambers = lazy(() => import('./pages/Chambers'));
const Reviews = lazy(() => import('./pages/Reviews'));
const ExamRoom = lazy(() => import('./pages/ExamRoom'));
const ExamTake = lazy(() => import('./pages/ExamTake'));
const BlindReview = lazy(() => import('./pages/BlindReview'));
const Opinion = lazy(() => import('./pages/Opinion'));
const Ledger = lazy(() => import('./pages/Ledger'));
const LawReview = lazy(() => import('./pages/LawReview'));
const BenchCards = lazy(() => import('./pages/BenchCards'));
const Notebook = lazy(() => import('./pages/Notebook'));
const OfficeHours = lazy(() => import('./pages/OfficeHours'));
const Seminar = lazy(() => import('./pages/Seminar'));
const MootCourt = lazy(() => import('./pages/MootCourt'));
const LogicTrainer = lazy(() => import('./pages/LogicTrainer'));
const Writing = lazy(() => import('./pages/Writing'));
const Planner = lazy(() => import('./pages/Planner'));
const Admissions = lazy(() => import('./pages/Admissions'));
const Handbook = lazy(() => import('./pages/Handbook'));
const Settings = lazy(() => import('./pages/Settings'));
const QuestionView = lazy(() => import('./pages/QuestionView'));

function useHydrated() {
  const [h, setH] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setH(true));
    setH(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return h;
}

function ThemeSync() {
  const { theme, mode, passageSize, reduceMotion } = useStore((s) => s.settings);
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = theme;
    r.dataset.mode = mode;
    r.style.setProperty('--passage-size', `${passageSize}px`);
    r.classList.toggle('reduce-motion', reduceMotion);
  }, [theme, mode, passageSize, reduceMotion]);
  return null;
}

/** Logs study minutes while the learner is active (visible tab + recent interaction). */
function Heartbeat() {
  const logMinutes = useStore((s) => s.logMinutes);
  useEffect(() => {
    let last = Date.now();
    const mark = () => (last = Date.now());
    ['keydown', 'pointerdown', 'scroll', 'pointermove'].forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last < 120_000) logMinutes(0.5);
    }, 30_000);
    return () => {
      clearInterval(t);
      ['keydown', 'pointerdown', 'scroll', 'pointermove'].forEach((e) => window.removeEventListener(e, mark));
    };
  }, [logMinutes]);
  return null;
}

function GlobalKeys() {
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (loc.pathname.startsWith('/exam/')) return; // no mind map during an exam
      if (e.key === 'm' || e.key === 'M') {
        if (loc.pathname.startsWith('/chambers') || loc.pathname.startsWith('/casebook/') || loc.pathname.startsWith('/moot')) return; // handled locally
        nav('/map');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [nav, loc.pathname]);
  return null;
}

function HonorsWatcher() {
  useHonors();
  return null;
}

function Home() {
  const homeView = useStore((s) => s.settings.homeView);
  const matriculated = useStore((s) => s.profile.matriculated);
  if (!matriculated) return <Navigate to="/matriculation" replace />;
  return homeView === 'map' ? <MapOfLaw /> : <Docket />;
}

function Loading() {
  return (
    <div className="empty" style={{ marginTop: '20vh' }}>
      Opening the reading room…
    </div>
  );
}

export default function App() {
  const hydrated = useHydrated();
  return (
    <HashRouter>
      <ThemeSync />
      {!hydrated ? (
        <Loading />
      ) : (
        <>
          <Heartbeat />
          <GlobalKeys />
          <HonorsWatcher />
          <Layout>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/docket" element={<Docket />} />
                <Route path="/matriculation" element={<Matriculation />} />
                <Route path="/map" element={<MapOfLaw />} />
                <Route path="/casebook" element={<Casebook />} />
                <Route path="/casebook/:id" element={<Lesson />} />
                <Route path="/chambers" element={<Chambers />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/exam" element={<ExamRoom />} />
                <Route path="/exam/:id" element={<ExamTake />} />
                <Route path="/blind/:id" element={<BlindReview />} />
                <Route path="/opinion/:id" element={<Opinion />} />
                <Route path="/ledger" element={<Ledger />} />
                <Route path="/law-review" element={<LawReview />} />
                <Route path="/bench-cards" element={<BenchCards />} />
                <Route path="/notebook" element={<Notebook />} />
                <Route path="/office-hours" element={<OfficeHours />} />
                <Route path="/seminar" element={<Seminar />} />
                <Route path="/moot" element={<MootCourt />} />
                <Route path="/logic" element={<LogicTrainer />} />
                <Route path="/writing" element={<Writing />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/admissions" element={<Admissions />} />
                <Route path="/handbook" element={<Handbook />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/q/:id" element={<QuestionView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
          <Toasts />
        </>
      )}
    </HashRouter>
  );
}
