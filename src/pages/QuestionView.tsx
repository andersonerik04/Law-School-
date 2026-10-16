import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getQuestion } from '../lib/content';
import { QuestionPlayer } from '../components/QuestionPlayer';
import { CaseBrief } from '../components/CaseBrief';
import { CasebookHeader, Empty } from '../components/common';

/** A single question: re-attempt it, or read its brief directly. */
export default function QuestionView() {
  const { id = '' } = useParams();
  const q = getQuestion(id);
  const nav = useNavigate();
  const [briefOnly, setBriefOnly] = useState(false);
  if (!q) return <Empty>Question not found.</Empty>;
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <CasebookHeader chapter="THE RECORD" title={`Question ${q.id}`} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={`small ${!briefOnly ? 'selected' : ''}`} onClick={() => setBriefOnly(false)}>
          Re-attempt
        </button>
        <button className={`small ${briefOnly ? 'selected' : ''}`} onClick={() => setBriefOnly(true)}>
          Read the brief
        </button>
        <button className="ghost small" onClick={() => nav(-1)}>
          ← Back
        </button>
      </div>
      {briefOnly ? (
        <div className="card">
          <CaseBrief q={q} />
        </div>
      ) : (
        <QuestionPlayer q={q} context="review" requireWhy onNext={() => nav(-1)} nextLabel="Done" />
      )}
    </div>
  );
}
