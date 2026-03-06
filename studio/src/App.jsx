import React, { useState, useCallback, useRef, useEffect } from "react";
import FreeformInput from "./components/FreeformInput";
import Editor from "./components/Editor";
import ProseView from "./components/ProseView";
import { api } from "./api";

const EXAMPLE = `# Building Agency-Preserving Generative Systems
@ Mateo Larrea

ref Hud96: P. Hudak, "Building Domain-Specific Embedded Languages", ACM Computing Surveys, 1996
ref Wei91: M. Weiser, "The Computer for the 21st Century", Scientific American, 1991
ref Eno75: B. Eno, P. Schmidt, "Oblique Strategies", Apollo, 1975
ref Csik90: M. Csikszentmihalyi, "Flow: The Psychology of Optimal Experience", Harper & Row, 1990

== abstract [compressed, tone=compressed]

> Friction is the most important factor in creating meaningful art
> The ideal abstraction amplifies design space while mitigating technical burden
> Total automation is a catastrophic categorization error (assert) #core-thesis
> A scaffolded generative system is the ultimate abstraction (suggest)
> The one-shot generation model promises democratization but delivers alienation
> We can inherit the power of large models by tailoring them to the domain of interest, yielding a Domain-Specific Generative Language (DSGL)

== domain_specific_semantics [dialectic]

>> thesis: Treat generative models as producers of intermediate representations, not final artifacts
   evidence: SuperCollider, Processing, Haskell DSLs [Hud96]
   counter: The black-box paradigm is simpler and more accessible
   synthesis: Domain semantics enable user intervention — the notation is easy to generate AND easy to correct

> One can reason directly within domain semantics when the AI serves as translator from intent to structure, not intent to finished product

== modular_cognitive_architectures [expository]

> A DSGL can be thought of as a higher-order algebraic structure for co-creation

>> thesis: Generative Agents should function as distinct instruments for thought, defined by constraints rather than capabilities
   evidence: The Facilitator: optimizes for consensus and flow, The Oblique Strategist: introduces randomness and constraints [Eno75], The Critic: analyzes output against formal rules
   counter: If an agent simply executes commands, it is a tool
   synthesis: If it pushes back, it is a partner — personality is a functional component

> A modular architecture allows swapping the reasoning engine without changing the rendering engine, like swapping a guitar pedal without changing the guitar

== the_question_of_meaning [polemic, tone=urgent]

> As AI automates creative labor, we face a second nihilism #philosophical-stakes

>> thesis: The answer lies in the design of our tools
   evidence: Nietzsche's warning about the erosion of metaphysical frameworks, The Protestant Work Ethic as meaning-substitute, DSGL as agency-preserving alternative
   counter: If we design for efficiency (one-shot prompting), we succumb to the void
   synthesis: If we design for agency — building DSGLs that demand steerability and cognitive architectures that invite dialectic — we preserve the dignity of the maker

> The goal must not be to solve the problem of content creation — the world has enough content
> The goal must be to solve the problem of human relevance in a synthetic age (assert) #final-thesis`;

export default function App() {
  const [freeform, setFreeform] = useState("");
  const [generating, setGenerating] = useState(false);
  const [source, setSource] = useState("");
  const [parsed, setParsed] = useState(null);
  const [rendered, setRendered] = useState({});
  const [annotations, setAnnotations] = useState([]);
  const [clarifyMode, setClarifyMode] = useState(false);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [panel2Mode, setPanel2Mode] = useState("code");
  const [renderingAll, setRenderingAll] = useState(false);
  const [temperature, setTemperature] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const parseTimer = useRef(null);
  const [panelWidths, setPanelWidths] = useState([25, 40, 35]); // percentages
  const dragging = useRef(null);
  const containerRef = useRef(null);

  const handleDividerDown = useCallback((index, e) => {
    e.preventDefault();
    dragging.current = { index, startX: e.clientX, startWidths: [...panelWidths] };
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const { index, startX, startWidths } = dragging.current;
      const containerW = containerRef.current.getBoundingClientRect().width;
      const deltaPct = ((e.clientX - startX) / containerW) * 100;
      const newWidths = [...startWidths];
      const minW = 10;
      newWidths[index] = Math.max(minW, startWidths[index] + deltaPct);
      newWidths[index + 1] = Math.max(minW, startWidths[index + 1] - deltaPct);
      // clamp both
      if (newWidths[index] < minW || newWidths[index + 1] < minW) return;
      setPanelWidths(newWidths);
    };
    const onUp = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidths]);

  const doParse = useCallback(async (text) => {
    if (!text.trim()) {
      setParsed(null);
      setError(null);
      return;
    }
    try {
      const result = await api.parse(text);
      setParsed(result);
      setError(null);
    } catch (e) {
      setParsed(null);
      setError(e.message);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      // Build context from full chat conversation (skip first user msg = original freeform)
      let context = "";
      if (chatMessages.length > 1) {
        const conversationParts = [];
        for (let i = 1; i < chatMessages.length; i++) {
          const msg = chatMessages[i];
          if (msg.role === "agent") {
            conversationParts.push(`Agent asked:\n${msg.text}`);
          } else {
            conversationParts.push(`Author answered:\n${msg.text}`);
          }
        }
        context = conversationParts.join("\n\n");
      }
      const res = await api.generate(freeform, source, temperature, context);
      setSource(res.theo);
      setRendered({});
      setAnnotations([]);
      setChatMessages([]);
      doParse(res.theo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [freeform, source, doParse, temperature, chatMessages]);

  const handleStartChat = useCallback(async () => {
    setChatLoading(true);
    setChatMessages([{ role: "user", text: freeform }]);
    try {
      const res = await api.preGenClarify(freeform, source);
      if (res.questions && res.questions.length > 0) {
        const agentText = res.questions
          .map((q, i) => `${i + 1}. ${q.question}${q.context ? `\n   (${q.context})` : ""}`)
          .join("\n\n");
        setChatMessages((msgs) => [...msgs, { role: "agent", text: agentText }]);
      } else {
        setChatMessages([]);
      }
    } catch (e) {
      setError(e.message);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, [freeform, source]);

  const handleChatReply = useCallback((text) => {
    setChatMessages((msgs) => [...msgs, { role: "user", text }]);
  }, []);

  const handleClearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  const handleSourceChange = useCallback(
    (text) => {
      setSource(text);
      clearTimeout(parseTimer.current);
      parseTimer.current = setTimeout(() => doParse(text), 500);
    },
    [doParse]
  );

  const handleRenderSection = useCallback(
    async (sectionName) => {
      setLoading((l) => ({ ...l, [sectionName]: true }));
      try {
        if (clarifyMode) {
          const res = await api.clarify(source, sectionName);
          setAnnotations(
            res.questions.map((q) => ({
              ...q,
              section: sectionName,
              answer: "",
            }))
          );
        } else {
          const res = await api.render(source, sectionName, rendered, temperature);
          setRendered((r) => ({ ...r, [sectionName]: res.prose }));
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading((l) => ({ ...l, [sectionName]: false }));
      }
    },
    [source, rendered, clarifyMode, temperature]
  );

  const handleClarifySubmit = useCallback(
    async (sectionName, answers) => {
      setLoading((l) => ({ ...l, [sectionName]: true }));
      try {
        const res = await api.clarifyAnswer(source, sectionName, answers, rendered);
        setRendered((r) => ({ ...r, [sectionName]: res.prose }));
        setAnnotations([]);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading((l) => ({ ...l, [sectionName]: false }));
      }
    },
    [source, rendered]
  );

  const handleOpen = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openFile();
    if (result) {
      setSource(result.content);
      setRendered({});
      setAnnotations([]);
      doParse(result.content);
    }
  }, [doParse]);

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.saveFile(source);
  }, [source]);

  const handleReorderSections = useCallback(
    (fromIdx, toIdx) => {
      if (!parsed) return;

      // Parse the source into section blocks
      const lines = source.split("\n");
      const sectionStarts = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^==\s+\w+\s*\[/.test(lines[i].trim())) {
          sectionStarts.push(i);
        }
      }

      // Build section blocks: [startLine, endLine)
      const blocks = sectionStarts.map((start, i) => {
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : lines.length;
        return { start, end, lines: lines.slice(start, end) };
      });

      // Everything before the first section
      const preamble = sectionStarts.length > 0 ? lines.slice(0, sectionStarts[0]) : lines;

      // Reorder blocks
      const reordered = [...blocks];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);

      // Rebuild source
      const newSource = [...preamble, ...reordered.flatMap((b) => b.lines)].join("\n");
      setSource(newSource);
      doParse(newSource);
    },
    [source, parsed, doParse]
  );

  const handleProseEdit = useCallback((sectionName, text) => {
    setRendered((r) => ({ ...r, [sectionName]: text }));
  }, []);

  const handleRenderAll = useCallback(async () => {
    if (!parsed) return;
    setRenderingAll(true);
    try {
      let priorSections = { ...rendered };
      for (const section of parsed.sections) {
        setLoading((l) => ({ ...l, [section.name]: true }));
        try {
          const res = await api.render(source, section.name, priorSections, temperature);
          priorSections[section.name] = res.prose;
          setRendered((r) => ({ ...r, [section.name]: res.prose }));
        } finally {
          setLoading((l) => ({ ...l, [section.name]: false }));
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRenderingAll(false);
    }
  }, [parsed, source, rendered]);

  const handleExportFile = useCallback(async () => {
    if (!parsed) return;
    const parts = [`${parsed.title}\n${"=".repeat(parsed.title.length)}\n`];
    for (const section of parsed.sections) {
      const prose = rendered[section.name];
      if (prose) {
        parts.push(`\n${section.name}\n${"-".repeat(section.name.length)}\n\n${prose}\n`);
      }
    }
    const text = parts.join("");
    if (window.electronAPI) {
      await window.electronAPI.saveFile(text);
    } else {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${parsed.title.replace(/\s+/g, "_").toLowerCase()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [parsed, rendered]);

  const handleSendToFreeform = useCallback(() => {
    if (!parsed) return;
    const parts = [];
    for (const section of parsed.sections) {
      const prose = rendered[section.name];
      if (prose) parts.push(prose);
    }
    setFreeform(parts.join("\n\n"));
  }, [parsed, rendered]);

  React.useEffect(() => {
    doParse(source);
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <span className="topbar-title">theo</span>
        <div className="topbar-actions">
          <button onClick={handleOpen}>open</button>
          <button onClick={handleSave}>save</button>
          <button
            className={clarifyMode ? "active" : ""}
            onClick={() => setClarifyMode((c) => !c)}
          >
            clarify
          </button>
          <div className="settings-wrapper">
            <button
              className={showSettings ? "active" : ""}
              onClick={() => setShowSettings((s) => !s)}
            >
              temp {temperature.toFixed(1)}
            </button>
            {showSettings && (
              <div className="settings-popover">
                <label className="settings-label">
                  temperature
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="settings-slider"
                  />
                  <span className="settings-value">{temperature.toFixed(1)}</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && (
        <div className="error-bar" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      <div className="main-panels" ref={containerRef}>
        <div style={{ width: `${panelWidths[0]}%` }} className="panel-slot">
          <FreeformInput
            value={freeform}
            onChange={setFreeform}
            onGenerate={handleGenerate}
            generating={generating}
            chatMessages={chatMessages}
            onChatReply={handleChatReply}
            chatLoading={chatLoading}
            onStartChat={handleStartChat}
            onClearChat={handleClearChat}
          />
        </div>
        <div className="divider" onMouseDown={(e) => handleDividerDown(0, e)} />
        <div style={{ width: `${panelWidths[1]}%` }} className="panel-slot">
          <div className="editor-panel">
            <Editor
              source={source}
              onChange={handleSourceChange}
              annotations={annotations}
              onAnnotationAnswer={(idx, answer) =>
                setAnnotations((a) =>
                  a.map((ann, i) => (i === idx ? { ...ann, answer } : ann))
                )
              }
              onAnnotationSubmit={(sectionName) =>
                handleClarifySubmit(sectionName, annotations)
              }
              panel2Mode={panel2Mode}
              onPanel2ModeChange={setPanel2Mode}
              parsed={parsed}
            />
          </div>
        </div>
        <div className="divider" onMouseDown={(e) => handleDividerDown(1, e)} />
        <div style={{ width: `${panelWidths[2]}%` }} className="panel-slot">
          <div className="prose-panel">
            <ProseView
              parsed={parsed}
              rendered={rendered}
              loading={loading}
              onRenderSection={handleRenderSection}
              onReorderSections={handleReorderSections}
              onProseEdit={handleProseEdit}
              onRenderAll={handleRenderAll}
              onExportFile={handleExportFile}
              onSendToFreeform={handleSendToFreeform}
              renderingAll={renderingAll}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
