/**
 * The Faculty Handbook — each evidence-based method, explained in one sentence:
 * what it is and why the Academy uses it. Rendered via <MethodNote id="…"/>.
 */
export interface Method {
  id: string;
  letter: string;
  name: string;
  what: string;
}

export const METHODS: Method[] = [
  { id: 'retrieval', letter: 'A', name: 'Retrieval Practice', what: 'You recall before you review, because pulling knowledge out of memory strengthens it far more than re-reading it.' },
  { id: 'spacing', letter: 'B', name: 'Spaced Repetition', what: 'Reviews are scheduled at expanding intervals (1, 3, 7, 14, 30, 60 days) because revisiting material just as you begin to forget it produces durable memory.' },
  { id: 'interleaving', letter: 'C', name: 'Interleaving', what: 'Question types are mixed rather than blocked, because the real exam never tells you the type and mixing trains you to recognize it.' },
  { id: 'release', letter: 'D', name: 'Gradual Release (I Do / We Do / You Do)', what: 'You watch a worked solution, then solve with scaffolding, then solve alone, because expertise transfers best when support is withdrawn step by step.' },
  { id: 'faded', letter: 'D', name: 'Faded Worked Examples', what: 'Each successive example removes one more step of guidance, so you take over the reasoning one move at a time without being overloaded.' },
  { id: 'mastery', letter: 'E', name: 'Mastery Learning', what: 'You certify a skill only at 85% accuracy on 20 interleaved, on-pace questions at difficulty 3+, because advancing on a shaky foundation compounds errors.' },
  { id: 'bloom', letter: 'F', name: "Bloom's Taxonomy", what: 'Tasks climb from remembering to creating, because explaining, analyzing, judging, and writing questions build deeper understanding than solving alone.' },
  { id: 'dual', letter: 'G', name: 'Dual Coding', what: 'Every idea arrives as both words and a diagram, because two linked memory traces are easier to retrieve than one.' },
  { id: 'elaboration', letter: 'H', name: 'Elaborative Interrogation', what: 'You must say WHY before seeing the result, because justifying an answer exposes lucky guesses and cements the rule behind it.' },
  { id: 'feynman', letter: 'I', name: 'The Feynman Technique', what: 'You teach the concept to a confused clerk, because gaps in understanding surface the moment you try to explain plainly.' },
  { id: 'examples', letter: 'J', name: 'Concrete Examples', what: 'Each rule comes with varied examples from life, law, and finance, because seeing one principle in many costumes is how you learn to generalize it.' },
  { id: 'metacognition', letter: 'K', name: 'Confidence Calibration', what: 'You rate your confidence before submitting, because knowing what you know (and what you only think you know) directs your study time.' },
  { id: 'deliberate', letter: 'L', name: 'Deliberate Practice', what: 'The adaptive engine serves questions you have a 60–75% chance of answering, because growth happens at the edge of your ability, not in your comfort zone.' },
  { id: 'load', letter: 'M', name: 'Cognitive Load Management', what: 'Lessons introduce one idea at a time in 5–12 minutes with clear objectives, because working memory is small and clutter crowds out learning.' },
  { id: 'formative', letter: 'N', name: 'Formative & Summative Assessment', what: 'Low-stakes checkpoints guide learning along the way, and term examinations measure it, because feedback is most useful while there is still time to act on it.' },
  { id: 'errors', letter: 'O', name: 'Error Analysis & Productive Failure', what: 'You sometimes attempt a question before being taught, and every miss is classified by root cause, because struggle primes learning and diagnosis prevents repeats.' },
  { id: 'socratic', letter: 'P', name: 'The Socratic Method', what: 'The professor asks sequenced questions instead of giving answers, because reasoning you construct yourself is reasoning you keep.' },
  { id: 'visual', letter: 'Q', name: 'Visuals-First, Multimodal', what: 'Concepts lead with a map or diagram that you later rebuild from memory, because visuals organize knowledge and rebuilding them is retrieval practice.' },
  { id: 'habit', letter: 'R', name: 'Habit & Motivation Design', what: 'Daily dockets, streaks with a grace day, and understated honors keep momentum, because consistency over 40 weeks matters more than any single session.' },
];

export const METHOD_BY_ID: Record<string, Method> = Object.fromEntries(METHODS.map((m) => [m.id, m]));
