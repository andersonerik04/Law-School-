import { useStore } from './store';

/** Narrated audio via the browser Speech Synthesis API. */
export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, onEnd?: () => void) {
  if (!speechAvailable()) return;
  window.speechSynthesis.cancel();
  const { ttsRate, ttsVoice } = useStore.getState().settings;
  // speak in chunks (some engines stop after ~200 words)
  const chunks = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const groups: string[] = [];
  let cur = '';
  for (const c of chunks) {
    if ((cur + c).length > 220) {
      groups.push(cur);
      cur = c;
    } else cur += c;
  }
  if (cur) groups.push(cur);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.name === ttsVoice) ?? voices.find((v) => /en[-_](GB|US)/i.test(v.lang));
  groups.forEach((g, i) => {
    const u = new SpeechSynthesisUtterance(g);
    u.rate = ttsRate;
    if (voice) u.voice = voice;
    if (i === groups.length - 1 && onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
