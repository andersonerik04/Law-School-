import { useEffect, useRef, useState } from 'react';
import { CasebookHeader, Section, toast } from '../components/common';
import { useStore, exportData } from '../lib/store';
import { AI_MODELS, ask } from '../lib/ai';
import { download, dateKey } from '../lib/util';
import { speak, speechAvailable } from '../lib/tts';
import { Icon } from '../visuals/Icon';

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.setSettings);
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const importData = useStore((s) => s.importData);
  const resetAll = useStore((s) => s.resetAll);
  const [key, setKey] = useState(settings.apiKey);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!speechAvailable()) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en')));
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const test = async () => {
    set({ apiKey: key.trim() });
    setTesting('Contacting the Anthropic API…');
    try {
      const r = await ask({ system: 'Reply with exactly: Court is in session.', messages: [{ role: 'user', content: 'Test.' }], maxTokens: 200, effort: 'low' });
      setTesting('✓ Connected — ' + r.trim().slice(0, 80));
    } catch (e) {
      setTesting('✗ ' + (e as Error).message);
    }
  };

  return (
    <div>
      <CasebookHeader chapter="THE CHANCERY" title="Settings" subtitle="Your chambers, your rules. Everything here is stored only in this browser." />

      <Section numeral="I" title="Appearance & Reading">
        <div className="grid cols-2">
          <div className="card">
            <div className="stack">
              <label className="field">
                House style
                <select value={settings.theme} onChange={(e) => set({ theme: e.target.value as 'crimson' | 'federal' })}>
                  <option value="crimson">Crimson Hall — crimson, ivory, antique gold</option>
                  <option value="federal">Federal Green — forest green, cream, navy ink</option>
                </select>
              </label>
              <label className="field">
                Lighting
                <select value={settings.mode} onChange={(e) => set({ mode: e.target.value as 'light' | 'dark' })}>
                  <option value="light">Day — parchment</option>
                  <option value="dark">Evening — mahogany &amp; ink</option>
                </select>
              </label>
              <label className="field">
                Home screen
                <select value={settings.homeView} onChange={(e) => set({ homeView: e.target.value as 'docket' | 'map' })}>
                  <option value="docket">The Docket (dashboard)</option>
                  <option value="map">The Map of the Law (mind map)</option>
                </select>
              </label>
              <label className="row">
                <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} /> Reduce motion (no page-turn or drawing animations)
              </label>
            </div>
          </div>
          <div className="card">
            <label className="field">
              Passage &amp; stimulus font size: {settings.passageSize}px
              <input type="range" min={14} max={26} value={settings.passageSize} onChange={(e) => set({ passageSize: +e.target.value })} />
            </label>
            <p className="stimulus" style={{ marginTop: 10 }}>
              The tribunal held that the clause, though ambiguous, must be read in light of the parties' prior course of dealing.
            </p>
            <hr />
            <label className="field">
              Narration speed: {settings.ttsRate.toFixed(2)}×
              <input type="range" min={0.6} max={1.6} step={0.05} value={settings.ttsRate} onChange={(e) => set({ ttsRate: +e.target.value })} />
            </label>
            {voices.length > 0 && (
              <label className="field" style={{ marginTop: 8 }}>
                Narrator voice
                <select value={settings.ttsVoice} onChange={(e) => set({ ttsVoice: e.target.value })}>
                  <option value="">Default</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="small" style={{ marginTop: 8 }} onClick={() => speak('The court will now hear argument in the matter before it.')}>
              <Icon name="speaker" size={14} /> Test narration
            </button>
          </div>
        </div>
      </Section>

      <Section numeral="II" title="Practice Rules">
        <div className="card">
          <div className="grid cols-3">
            <label className="field">
              "Why?" justification before results
              <select value={settings.requireWhy} onChange={(e) => set({ requireWhy: e.target.value as 'always' | 'often' | 'never' })}>
                <option value="always">Always</option>
                <option value="often">Often (about half of questions)</option>
                <option value="never">Never (not recommended)</option>
              </select>
            </label>
            <label className="field">
              Test date
              <input type="date" value={profile.testDate} onChange={(e) => setProfile({ testDate: e.target.value })} />
            </label>
            <label className="field">
              Plan start date (week 1)
              <input type="date" value={profile.startDate} onChange={(e) => setProfile({ startDate: e.target.value })} />
            </label>
            <label className="field">
              Hours available per week
              <input type="number" min={2} max={60} value={profile.hoursPerWeek} onChange={(e) => setProfile({ hoursPerWeek: +e.target.value })} />
            </label>
          </div>
        </div>
      </Section>

      <Section numeral="III" title="The Faculty (AI features)">
        <div className="card">
          <p className="book" style={{ fontSize: 16 }}>
            Office Hours, The Seminar, "Why?" grading, Teach the Clerk, question generation, and writing feedback use the Anthropic API with your own key. The key is stored only in this browser (IndexedDB) and sent only to <span className="mono">api.anthropic.com</span>. Everything else in the Academy works without it.
          </p>
          <div className="grid cols-2">
            <label className="field">
              Anthropic API key
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} />
                <button className="small" onClick={() => setShow((s) => !s)}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label className="field">
              Model
              <select value={settings.model} onChange={(e) => set({ model: e.target.value })}>
                {AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="row" style={{ marginTop: 10, fontSize: 14 }}>
            <input type="checkbox" checked={settings.serverFallback} onChange={(e) => set({ serverFallback: e.target.checked })} /> If the model declines a request, let the API retry it on a fallback model (server-side fallback)
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="primary"
              onClick={() => {
                set({ apiKey: key.trim() });
                toast('Key saved', 'Stored locally in this browser.');
              }}
            >
              Save key
            </button>
            <button onClick={test} disabled={!key.trim()}>
              Test connection
            </button>
            <button
              className="danger"
              onClick={() => {
                setKey('');
                set({ apiKey: '' });
              }}
            >
              Remove key
            </button>
            {testing && <span className="muted">{testing}</span>}
          </div>
        </div>
      </Section>

      <Section numeral="IV" title="Records & Backup">
        <div className="card">
          <p className="book" style={{ fontSize: 16 }}>
            All progress — attempts, spaced-repetition schedules, ledger entries, mind maps, essays, and settings — is saved automatically in this browser. Export a backup file regularly; import it to restore or move to another device.
          </p>
          <div className="row">
            <button className="primary" onClick={() => download(`bar-bench-backup-${dateKey()}.json`, exportData())}>
              <Icon name="download" size={15} /> Export my data
            </button>
            <button onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> Import backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  importData(await f.text());
                  toast('Backup restored', f.name);
                } catch (err) {
                  toast('Import failed', (err as Error).message);
                }
                e.target.value = '';
              }}
            />
            <button
              className="danger"
              onClick={() => {
                if (confirm('Erase ALL progress in this browser? Export a backup first. This cannot be undone.')) resetAll();
              }}
            >
              Erase all progress
            </button>
          </div>
        </div>
      </Section>

      <Section numeral="V" title="Keyboard Shortcuts">
        <div className="card">
          <table className="ledger">
            <tbody>
              {[
                ['A – E', 'Select an answer choice'],
                ['Shift + A – E', 'Strike out a choice'],
                ['F', 'Flag the question'],
                ['← / →', 'Previous / next question'],
                ['H', 'Highlight selected text (cycles colors in the Examination Room)'],
                ['C', 'Cycle confidence: Certain → Likely → Guess'],
                ['M', 'Open the mind map (Map of the Law, or the question’s diagram in drills)'],
                ['Enter', 'Submit / continue'],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ width: 160 }}>
                    <span className="kbd">{k}</span>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
