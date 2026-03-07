import React, { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import theoLanguage from "../theo-lang";
import Annotations from "./Annotations";
import GraphView from "./GraphView";

// Custom minimal theme that matches our black/gray aesthetic
const theoTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#111",
    color: "#999",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  ".cm-content": {
    padding: "16px 0",
    caretColor: "#666",
  },
  ".cm-cursor": {
    borderLeftColor: "#666",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "#ffffff12",
  },
  ".cm-activeLine": {
    backgroundColor: "#ffffff06",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "#444",
  },
  ".cm-gutters": {
    backgroundColor: "#111",
    color: "#2a2a2a",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "32px",
    padding: "0 4px 0 0",
    textAlign: "right",
  },
  "&.cm-focused": {
    outline: "none",
  },
}, { dark: true });

// Syntax highlighting: all grays, just varying brightness
const theoHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#bbb" },
  { tag: tags.keyword, color: "#777" },
  { tag: tags.link, color: "#555" },
  { tag: tags.atom, color: "#999" },
  { tag: tags.variableName, color: "#888" },
  { tag: tags.tagName, color: "#666" },
  { tag: tags.propertyName, color: "#666" },
  { tag: tags.string, color: "#555" },
  { tag: tags.meta, color: "#444" },
  { tag: tags.processingInstruction, color: "#333" },
]);

export default function Editor({
  source,
  onChange,
  annotations,
  onAnnotationAnswer,
  onAnnotationSubmit,
  panel2Mode,
  onPanel2ModeChange,
  parsed,
  onClickSection,
  trajectories,
  onRequestTrajectories,
  trajectoriesLoading,
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const sourceRef = useRef(source);
  onChangeRef.current = onChange;
  sourceRef.current = source;

  const initEditor = useCallback((el) => {
    // Destroy old editor if any
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
    if (!el) {
      containerRef.current = null;
      return;
    }
    containerRef.current = el;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: sourceRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theoLanguage,
        syntaxHighlighting(theoHighlight),
        theoTheme,
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: el });
    viewRef.current = view;
  }, []);

  // Sync source into editor when source changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== source) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: source },
      });
    }
  }, [source]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);

  const annotationSection =
    annotations.length > 0 ? annotations[0].section : null;

  return (
    <>
      <div className="panel2-toggle">
        <button
          className={panel2Mode === "code" ? "active" : ""}
          onClick={() => onPanel2ModeChange("code")}
        >
          code
        </button>
        <button
          className={panel2Mode === "graph" ? "active" : ""}
          onClick={() => onPanel2ModeChange("graph")}
        >
          graph
        </button>
      </div>
      {panel2Mode === "code" ? (
        <>
          <div className="editor-container" ref={initEditor} />
          {annotations.length > 0 && (
            <Annotations
              annotations={annotations}
              onAnswer={onAnnotationAnswer}
              onSubmit={() => onAnnotationSubmit(annotationSection)}
            />
          )}
        </>
      ) : (
        <GraphView
          parsed={parsed}
          onClickSection={onClickSection}
          trajectories={trajectories}
          onRequestTrajectories={onRequestTrajectories}
          trajectoriesLoading={trajectoriesLoading}
        />
      )}
    </>
  );
}
