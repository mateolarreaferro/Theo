import React, { useRef } from "react";

function elementSummary(elements) {
  const counts = { claim: 0, argument: 0, figure: 0 };
  for (const e of elements) counts[e.type] = (counts[e.type] || 0) + 1;
  const parts = [];
  if (counts.claim) parts.push(`${counts.claim}c`);
  if (counts.argument) parts.push(`${counts.argument}a`);
  if (counts.figure) parts.push(`${counts.figure}f`);
  return parts.join(" ");
}

export default function SectionCard({ section, prose, isLoading, onRender, onProseEdit }) {
  const proseRef = useRef(null);

  const handleBlur = () => {
    if (proseRef.current && onProseEdit) {
      const text = proseRef.current.innerText;
      if (text !== prose) {
        onProseEdit(section.name, text);
      }
    }
  };

  return (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-name">{section.name}</span>
        <span className="section-card-badge">
          {section.rhetoric}
          {section.tone ? ` / ${section.tone}` : ""}
        </span>
      </div>
      <div className="section-card-body">
        {prose ? (
          <div
            ref={proseRef}
            className="section-card-prose"
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
          >
            {prose}
          </div>
        ) : (
          <div className="section-card-summary">
            {elementSummary(section.elements)}
          </div>
        )}
      </div>
      <div className="section-card-action">
        <button onClick={onRender} disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner" />rendering
            </>
          ) : prose ? (
            "re-render"
          ) : (
            "render"
          )}
        </button>
      </div>
    </div>
  );
}
