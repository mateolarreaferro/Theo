import React, { useEffect, useRef, useMemo, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from "d3-force";
import { select } from "d3-selection";
import { drag } from "d3-drag";
import { zoom, zoomIdentity } from "d3-zoom";

const RHETORIC_COLORS = {
  dialectic: "#7a7a9e",
  compressed: "#6a8a7a",
  polemic: "#9e6a6a",
  expository: "#8a8a6a",
};

const NODE_COLORS = {
  section: null, // uses rhetoric color
  claim: "#555",
  argument: "#6a6a6a",
  tag: "#8888bb",
  ref: "#7a6a5a",
};

const TRAJECTORY_COLORS = ["#bb8844", "#44aa88", "#8866bb"];

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function extractRefs(text) {
  if (!text) return [];
  const matches = text.match(/\[([^\]]+)\]/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function buildGraph(parsed) {
  if (!parsed || !parsed.sections) return { nodes: [], links: [] };

  const nodes = [];
  const links = [];
  const nodeSet = new Set();
  const tagMap = {}; // tag -> [nodeId, ...]

  const addNode = (node) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  const addRefNode = (key, sectionId) => {
    const refId = `ref-${key}`;
    addNode({
      id: refId,
      label: key,
      type: "ref",
      color: NODE_COLORS.ref,
      radius: 10,
    });
    links.push({ source: sectionId, target: refId, type: "cites" });
  };

  // Add reference nodes from parsed.references
  if (parsed.references) {
    parsed.references.forEach((r) => {
      addNode({
        id: `ref-${r.key}`,
        label: r.key,
        type: "ref",
        color: NODE_COLORS.ref,
        radius: 10,
      });
    });
  }

  parsed.sections.forEach((sec, si) => {
    const sectionId = `sec-${si}`;
    addNode({
      id: sectionId,
      label: sec.name,
      type: "section",
      color: RHETORIC_COLORS[sec.rhetoric] || "#666",
      radius: 28,
    });

    // Sequential flow edges
    if (si > 0) {
      links.push({ source: `sec-${si - 1}`, target: sectionId, type: "flow" });
    }

    (sec.elements || []).forEach((elem, ei) => {
      if (elem.type === "claim") {
        const claimId = `claim-${si}-${ei}`;

        // Tagged claims get a tag node
        if (elem.tag) {
          const tagId = `tag-${elem.tag}`;
          addNode({
            id: tagId,
            label: `#${elem.tag}`,
            type: "tag",
            color: NODE_COLORS.tag,
            radius: 14,
          });
          links.push({ source: sectionId, target: tagId, type: "has-tag" });
          if (!tagMap[elem.tag]) tagMap[elem.tag] = [];
          tagMap[elem.tag].push({ tagId, sectionId });
        }

        // All claims become small nodes
        addNode({
          id: claimId,
          label: truncate(elem.text, 28),
          type: "claim",
          color: NODE_COLORS.claim,
          radius: elem.tag ? 10 : 8,
        });
        links.push({ source: sectionId, target: claimId, type: "contains" });

        // Extract refs from claim text
        extractRefs(elem.text).forEach((key) => addRefNode(key, sectionId));

      } else if (elem.type === "argument") {
        const argId = `arg-${si}-${ei}`;
        addNode({
          id: argId,
          label: truncate(elem.thesis, 24),
          type: "argument",
          color: NODE_COLORS.argument,
          radius: 14,
        });
        links.push({ source: sectionId, target: argId, type: "argues" });

        // Extract refs from thesis, evidence, counter, synthesis
        extractRefs(elem.thesis).forEach((key) => addRefNode(key, sectionId));
        if (elem.counter) extractRefs(elem.counter).forEach((key) => addRefNode(key, sectionId));
        if (elem.synthesis) extractRefs(elem.synthesis).forEach((key) => addRefNode(key, sectionId));
        if (elem.evidence) {
          elem.evidence.forEach((ev) => {
            const text = typeof ev === "string" ? ev : "";
            extractRefs(text).forEach((key) => addRefNode(key, sectionId));
          });
        }
      }
    });
  });

  // Cross-section edges for shared tags
  Object.values(tagMap).forEach((entries) => {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        // Connect the tag nodes (they're the same node if same tag, so connect sections)
        if (entries[i].sectionId !== entries[j].sectionId) {
          links.push({
            source: entries[i].sectionId,
            target: entries[j].sectionId,
            type: "shared-tag",
          });
        }
      }
    }
  });

  // Keyword overlap: find sections that share significant words in their claims
  const sectionKeywords = {};
  parsed.sections.forEach((sec, si) => {
    const words = new Set();
    (sec.elements || []).forEach((elem) => {
      const text = elem.type === "claim" ? elem.text : elem.type === "argument" ? elem.thesis : "";
      if (text) {
        text.toLowerCase().split(/\W+/).forEach((w) => {
          if (w.length > 5) words.add(w); // only meaningful words
        });
      }
    });
    sectionKeywords[si] = words;
  });

  // Create "thematic" edges between sections with significant overlap
  const sectionCount = parsed.sections.length;
  for (let i = 0; i < sectionCount; i++) {
    for (let j = i + 2; j < sectionCount; j++) { // skip adjacent (already have flow)
      const shared = [...sectionKeywords[i]].filter((w) => sectionKeywords[j].has(w));
      if (shared.length >= 2) {
        links.push({
          source: `sec-${i}`,
          target: `sec-${j}`,
          type: "thematic",
          label: shared.slice(0, 2).join(", "),
        });
      }
    }
  }

  return { nodes, links };
}

export default function GraphView({ parsed, onClickSection, trajectories, onRequestTrajectories, trajectoriesLoading }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const [activeTrajectory, setActiveTrajectory] = useState(null); // index or null

  const graph = useMemo(() => buildGraph(parsed), [parsed]);

  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0) return;

    const svg = select(svgRef.current);
    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 400;

    svg.selectAll("*").remove();

    // Defs for arrow markers
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 6")
      .attr("refX", 28)
      .attr("refY", 3)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L10,3 L0,6")
      .attr("fill", "#444");

    // Trajectory arrow markers
    TRAJECTORY_COLORS.forEach((color, i) => {
      defs.append("marker")
        .attr("id", `traj-arrow-${i}`)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 28)
        .attr("refY", 3)
        .attr("markerWidth", 8)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,3 L0,6")
        .attr("fill", color);
    });

    // Zoom behavior
    const g = svg.append("g");
    const zoomBehavior = zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoomBehavior);

    // Deep copy nodes/links for d3 mutation
    const nodes = graph.nodes.map((n) => ({ ...n }));
    const links = graph.links.map((l) => ({ ...l }));

    // Build trajectory links from active trajectory
    const trajectoryLinks = [];
    if (activeTrajectory !== null && trajectories && trajectories[activeTrajectory]) {
      const traj = trajectories[activeTrajectory];
      const sectionNames = parsed?.sections?.map((s) => s.name) || [];
      (traj.edges || []).forEach((edge) => {
        const fromIdx = sectionNames.indexOf(edge.from);
        const toIdx = sectionNames.indexOf(edge.to);
        if (fromIdx !== -1 && toIdx !== -1) {
          trajectoryLinks.push({
            source: `sec-${fromIdx}`,
            target: `sec-${toIdx}`,
            type: "trajectory",
            label: edge.reason || "",
            trajIndex: activeTrajectory,
          });
        }
      });
    }

    const allLinks = [...links, ...trajectoryLinks];

    const sim = forceSimulation(nodes)
      .force("link", forceLink(allLinks).id((d) => d.id).distance((d) => {
        if (d.type === "contains") return 40;
        if (d.type === "argues") return 50;
        if (d.type === "has-tag") return 60;
        if (d.type === "flow") return 90;
        if (d.type === "cites") return 70;
        if (d.type === "thematic") return 120;
        if (d.type === "trajectory") return 100;
        return 80;
      }).strength((d) => {
        if (d.type === "thematic") return 0.1;
        if (d.type === "shared-tag") return 0.3;
        if (d.type === "trajectory") return 0.2;
        return 0.5;
      }))
      .force("charge", forceManyBody().strength((d) => {
        if (d.type === "section") return -400;
        if (d.type === "tag" || d.type === "argument") return -150;
        return -60;
      }))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius((d) => d.radius + 6))
      .force("x", forceX(width / 2).strength(0.03))
      .force("y", forceY(height / 2).strength(0.03));

    simRef.current = sim;

    // Edge styling
    const edgeStyle = {
      "flow": { stroke: "#444", width: 1.5, dash: "none", arrow: true },
      "contains": { stroke: "#2a2a2a", width: 0.5, dash: "none", arrow: false },
      "argues": { stroke: "#3a3a3a", width: 0.8, dash: "none", arrow: false },
      "has-tag": { stroke: "#5555aa44", width: 1, dash: "none", arrow: false },
      "cites": { stroke: "#7a6a5a66", width: 1, dash: "3,3", arrow: false },
      "shared-tag": { stroke: "#8888cc", width: 2, dash: "6,3", arrow: false },
      "thematic": { stroke: "#666633", width: 1.5, dash: "8,4", arrow: false },
      "trajectory": { stroke: "#bb8844", width: 2.5, dash: "none", arrow: true },
    };

    // Dim base edges when a trajectory is active
    const hasActiveTrajectory = activeTrajectory !== null && trajectoryLinks.length > 0;

    const link = g.append("g")
      .selectAll("line")
      .data(allLinks)
      .join("line")
      .attr("stroke", (d) => {
        if (d.type === "trajectory") return TRAJECTORY_COLORS[d.trajIndex % TRAJECTORY_COLORS.length];
        return (edgeStyle[d.type] || edgeStyle.contains).stroke;
      })
      .attr("stroke-width", (d) => (edgeStyle[d.type] || edgeStyle.contains).width)
      .attr("stroke-dasharray", (d) => (edgeStyle[d.type] || edgeStyle.contains).dash)
      .attr("marker-end", (d) => {
        if (d.type === "trajectory") return `url(#traj-arrow-${d.trajIndex % TRAJECTORY_COLORS.length})`;
        return (edgeStyle[d.type] || {}).arrow ? "url(#arrow)" : "";
      })
      .attr("stroke-opacity", (d) => {
        if (d.type === "trajectory") return 0.9;
        return hasActiveTrajectory ? 0.15 : 0.8;
      });

    // Edge labels for thematic connections and trajectories
    const labeledLinks = allLinks.filter((l) => l.type === "thematic" || l.type === "shared-tag" || l.type === "trajectory");
    const edgeLabels = g.append("g")
      .selectAll("text")
      .data(labeledLinks)
      .join("text")
      .attr("fill", (d) => d.type === "trajectory" ? TRAJECTORY_COLORS[d.trajIndex % TRAJECTORY_COLORS.length] : "#555")
      .attr("font-size", (d) => d.type === "trajectory" ? "8px" : "7px")
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("text-anchor", "middle")
      .text((d) => d.label || "");

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", (d) => `graph-node graph-node--${d.type}`)
      .style("cursor", (d) => d.type === "section" ? "pointer" : "default");

    // Circle for each node
    node.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("opacity", (d) => d.type === "section" ? 0.8 : d.type === "claim" ? 0.4 : 0.6)
      .attr("stroke", (d) => d.type === "section" ? "#ffffff15" : "none")
      .attr("stroke-width", (d) => d.type === "section" ? 1.5 : 0);

    // Labels
    node.append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.type === "claim" ? d.radius + 10 : "0.35em")
      .attr("fill", (d) => {
        if (d.type === "section") return "#eee";
        if (d.type === "tag") return "#aaaadd";
        if (d.type === "ref") return "#aa9988";
        return "#888";
      })
      .attr("font-size", (d) => {
        if (d.type === "section") return "10px";
        if (d.type === "tag" || d.type === "argument") return "8px";
        return "7px";
      })
      .attr("font-family", "'JetBrains Mono', monospace")
      .attr("pointer-events", "none");

    // Hover: highlight connected edges and nodes
    node.on("mouseenter", (event, d) => {
      const connectedIds = new Set([d.id]);
      allLinks.forEach((l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        if (src === d.id || tgt === d.id) {
          connectedIds.add(src);
          connectedIds.add(tgt);
        }
      });
      link.attr("stroke-opacity", (l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return (connectedIds.has(src) && connectedIds.has(tgt)) ? 1 : 0.05;
      }).attr("stroke-width", (l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        const base = (edgeStyle[l.type] || edgeStyle.contains).width;
        return (connectedIds.has(src) && connectedIds.has(tgt)) ? base * 2 : base;
      });
      node.select("circle").attr("opacity", (n) =>
        connectedIds.has(n.id) ? 1 : 0.1
      );
      node.select("text").attr("opacity", (n) =>
        connectedIds.has(n.id) ? 1 : 0.15
      );
      edgeLabels.attr("opacity", (l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return (connectedIds.has(src) && connectedIds.has(tgt)) ? 1 : 0.1;
      });
    }).on("mouseleave", () => {
      link.attr("stroke-opacity", (d) => {
        if (d.type === "trajectory") return 0.9;
        return hasActiveTrajectory ? 0.15 : 0.8;
      }).attr("stroke-width", (l) => (edgeStyle[l.type] || edgeStyle.contains).width);
      node.select("circle").attr("opacity", (d) =>
        d.type === "section" ? 0.8 : d.type === "claim" ? 0.4 : 0.6
      );
      node.select("text").attr("opacity", 1);
      edgeLabels.attr("opacity", 1);
    });

    // Click section node
    node.on("click", (event, d) => {
      if (d.type === "section" && onClickSection) {
        onClickSection(d.label);
      }
    });

    // Drag
    const dragBehavior = drag()
      .on("start", (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      edgeLabels
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [graph, onClickSection, activeTrajectory, trajectories, parsed]);

  if (!parsed || graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <span>no structure to graph</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="trajectory-bar">
        <button
          className={`trajectory-btn ${trajectoriesLoading ? "loading" : ""}`}
          onClick={onRequestTrajectories}
          disabled={trajectoriesLoading}
        >
          {trajectoriesLoading ? "thinking..." : "show trajectories"}
        </button>
        {trajectories && trajectories.map((traj, i) => (
          <button
            key={i}
            className={`trajectory-chip ${activeTrajectory === i ? "active" : ""}`}
            style={{
              borderColor: TRAJECTORY_COLORS[i % TRAJECTORY_COLORS.length],
              color: activeTrajectory === i ? "#111" : TRAJECTORY_COLORS[i % TRAJECTORY_COLORS.length],
              backgroundColor: activeTrajectory === i ? TRAJECTORY_COLORS[i % TRAJECTORY_COLORS.length] : "transparent",
            }}
            onClick={() => setActiveTrajectory(activeTrajectory === i ? null : i)}
            title={traj.description}
          >
            {traj.name}
          </button>
        ))}
        {activeTrajectory !== null && trajectories && trajectories[activeTrajectory] && (
          <span className="trajectory-desc">
            {trajectories[activeTrajectory].description}
          </span>
        )}
      </div>
      <svg ref={svgRef} className="graph-svg" />
    </div>
  );
}
