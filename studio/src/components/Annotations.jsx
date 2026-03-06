import React from "react";

export default function Annotations({ annotations, onAnswer, onSubmit }) {
  if (!annotations || annotations.length === 0) return null;

  const allAnswered = annotations.every((a) => a.answer && a.answer.trim());

  return (
    <div className="annotations-panel">
      <div className="annotations-header">{annotations[0]?.section}</div>
      {annotations.map((ann, idx) => (
        <div key={idx} className="annotation-item">
          <div className="annotation-question">{ann.question}</div>
          {ann.context && (
            <div className="annotation-context">{ann.context}</div>
          )}
          <input
            className="annotation-input"
            type="text"
            placeholder="..."
            value={ann.answer || ""}
            onChange={(e) => onAnswer(idx, e.target.value)}
          />
        </div>
      ))}
      <button
        className="annotation-submit"
        onClick={onSubmit}
        disabled={!allAnswered}
      >
        generate
      </button>
    </div>
  );
}
