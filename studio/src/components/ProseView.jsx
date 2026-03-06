import React, { useState, useRef } from "react";
import SectionCard from "./SectionCard";

export default function ProseView({
  parsed,
  rendered,
  loading,
  onRenderSection,
  onReorderSections,
  onProseEdit,
  onRenderAll,
  onExportFile,
  onSendToFreeform,
  renderingAll,
}) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const dragNode = useRef(null);

  if (!parsed) {
    return (
      <div className="prose-view">
        <div className="prose-title">prose</div>
      </div>
    );
  }

  const handleDragStart = (e, idx) => {
    dragNode.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      setDragIdx(idx);
    });
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== overIdx) setOverIdx(idx);
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragNode.current;
    if (fromIdx !== null && fromIdx !== dropIdx) {
      onReorderSections(fromIdx, dropIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragNode.current = null;
  };

  const allRendered = parsed.sections.every((s) => rendered[s.name]);
  const anyRendered = parsed.sections.some((s) => rendered[s.name]);

  return (
    <div className="prose-view">
      <div className="prose-header">
        <div className="prose-title">{parsed.title}</div>
        <div className="prose-actions">
          <button onClick={onRenderAll} disabled={renderingAll}>
            {renderingAll ? (
              <><span className="spinner" />rendering…</>
            ) : (
              "render all"
            )}
          </button>
          <button onClick={onExportFile} disabled={!anyRendered}>
            export .txt
          </button>
          <button onClick={onSendToFreeform} disabled={!anyRendered}>
            → panel 1
          </button>
        </div>
      </div>
      {parsed.sections.map((section, idx) => (
        <div
          key={section.name}
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={
            "section-drag-wrapper" +
            (dragIdx === idx ? " dragging" : "") +
            (overIdx === idx && dragIdx !== idx ? " drag-over" : "")
          }
        >
          <SectionCard
            section={section}
            prose={rendered[section.name]}
            isLoading={loading[section.name]}
            onRender={() => onRenderSection(section.name)}
            onProseEdit={onProseEdit}
          />
        </div>
      ))}
    </div>
  );
}
