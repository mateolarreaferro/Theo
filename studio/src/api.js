const BASE = "http://127.0.0.1:8420";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  parse: (text) => request("/parse", { method: "POST", body: JSON.stringify({ text }) }),
  render: (text, sectionName, priorRendered = {}, temperature = 1.0) =>
    request("/render", {
      method: "POST",
      body: JSON.stringify({ text, section_name: sectionName, prior_rendered: priorRendered, temperature }),
    }),
  generate: (freeform, existingTheo = "", temperature = 1.0, context = "") =>
    request("/generate", {
      method: "POST",
      body: JSON.stringify({ freeform, existing_theo: existingTheo, temperature, context }),
    }),
  preGenClarify: (freeform, existingTheo = "") =>
    request("/pre-generate/clarify", {
      method: "POST",
      body: JSON.stringify({ freeform, existing_theo: existingTheo }),
    }),
  clarify: (text, sectionName) =>
    request("/clarify", {
      method: "POST",
      body: JSON.stringify({ text, section_name: sectionName }),
    }),
  clarifyAnswer: (text, sectionName, answers, priorRendered = {}) =>
    request("/clarify/answer", {
      method: "POST",
      body: JSON.stringify({ text, section_name: sectionName, answers, prior_rendered: priorRendered }),
    }),
  trajectories: (text) =>
    request("/trajectories", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  listVersions: () => request("/versions"),
  saveVersion: (source, parsed, label = "") =>
    request("/versions", {
      method: "POST",
      body: JSON.stringify({ source, parsed, label }),
    }),
  getVersion: (id) => request(`/versions/${id}`),
};
