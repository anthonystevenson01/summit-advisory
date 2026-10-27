"use client";

import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { PUBLIC_TOOLS, ROUTING_TASKS } from "@/app/lib/tools/registry";

type RoutingTask = (typeof ROUTING_TASKS)[number];
type Reasoning = "low" | "medium" | "high";

type RouteConfig = {
  model: string;
  reasoning?: Reasoning;
  maxTokens?: number;
  fallback?: string;
};

type CatalogModel = {
  id: string;
  promptPrice: number;
  completionPrice: number;
  context: number;
  available: boolean;
};

type CalibrationEntry = {
  model: string;
  passedAt?: string;
  rubricHashes?: Record<string, string>;
  uncalibratedSince?: string;
};

type ModelsData = {
  config: Record<string, RouteConfig>;
  defaults: Record<RoutingTask, RouteConfig>;
  labels: Record<RoutingTask, string>;
  descriptions: Record<RoutingTask, string>;
  catalog: CatalogModel[];
  calibration: Record<string, CalibrationEntry>;
  usage: Record<string, { calls: number; cost: number }>;
  spend: { month: string; cost: number; threshold: number | null; alertedAt: string | null };
};

const GATED_TASKS: RoutingTask[] = ["scoring", "synthesis"];

const REASONING_OPTIONS: { value: "" | Reasoning; label: string }[] = [
  { value: "", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const th = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600 as const,
  color: BRAND.darkGreen,
  textAlign: "left" as const,
  borderBottom: `2px solid ${BRAND.border}`,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const td = {
  padding: "10px 12px",
  fontSize: 13,
  color: BRAND.dark,
  borderBottom: "1px solid #E8ECE9",
  verticalAlign: "top" as const,
};

const controlStyle = {
  fontFamily: "var(--font-dm-sans), sans-serif",
  fontSize: 13,
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${BRAND.border}`,
  background: BRAND.white,
  color: BRAND.dark,
  maxWidth: 240,
};

const buttonStyle = {
  fontFamily: "var(--font-dm-sans), sans-serif",
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${BRAND.teal}`,
  background: BRAND.white,
  color: BRAND.teal,
  cursor: "pointer",
};

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Mirrors app/lib/tools/routing.ts for display: specific, then task, then default. */
function resolveForDisplay(data: ModelsData, key: string): { cfg: RouteConfig; source: string } {
  const [task, tool] = key.split(":") as [RoutingTask, string | undefined];
  if (tool && data.config[key]) return { cfg: data.config[key], source: "Per-tool override" };
  if (data.config[task]) return { cfg: data.config[task], source: tool ? "Task override" : "Override" };
  return { cfg: data.defaults[task], source: "Default" };
}

function usageFor(data: ModelsData, key: string, task: RoutingTask, isTaskRow: boolean): { calls: number; cost: number } {
  let calls = 0;
  let cost = 0;
  for (const [k, u] of Object.entries(data.usage)) {
    const match = isTaskRow ? k === task || k.startsWith(`${task}:`) : k === key;
    if (!match) continue;
    calls += u.calls;
    cost += u.cost;
  }
  return { calls, cost };
}

export default function ModelsClient() {
  const [data, setData] = useState<ModelsData | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [overrideTask, setOverrideTask] = useState<RoutingTask>("scoring");
  const [overrideTool, setOverrideTool] = useState<string>(PUBLIC_TOOLS[0]?.slug ?? "icp");
  const [maxTokensDraft, setMaxTokensDraft] = useState<Record<string, string>>({});
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/models");
    if (res.ok) {
      setData((await res.json()) as ModelsData);
    } else {
      setError("Could not load the routing table.");
    }
  }, []);

  // Initial fetch on mount: state is set in the async continuation after the
  // network responds, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    const key = String(body.key);
    setSaving(key);
    setError("");
    const res = await fetch("/api/admin/models", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const next = (await res.json()) as { config: ModelsData["config"]; calibration: ModelsData["calibration"] };
      setData((prev) => (prev ? { ...prev, config: next.config, calibration: next.calibration } : prev));
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "Save failed");
    }
    setSaving(null);
  }

  function save(key: string, cfg: RouteConfig, changes: Omit<Partial<RouteConfig>, "reasoning"> & { reasoning?: Reasoning | "" }) {
    const merged = { ...cfg, ...changes };
    void patch({
      key,
      model: merged.model,
      reasoning: merged.reasoning ?? "",
      maxTokens: merged.maxTokens ?? "",
      fallback: merged.fallback ?? "",
    });
  }

  async function saveThreshold() {
    if (!data) return;
    setSavingThreshold(true);
    setError("");
    const value = thresholdDraft ?? (data.spend.threshold === null ? "" : String(data.spend.threshold));
    const res = await fetch("/api/admin/ask-summit/spend-threshold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: value }),
    });
    if (res.ok) {
      const next = (await res.json()) as { threshold: number | null };
      setData((prev) => (prev ? { ...prev, spend: { ...prev.spend, threshold: next.threshold } } : prev));
      setThresholdDraft(null);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(err.error ?? "Save failed");
    }
    setSavingThreshold(false);
  }

  if (!data) {
    return error ? <p style={{ color: BRAND.red, fontSize: 13 }}>{error}</p> : <p style={{ color: BRAND.mid, fontSize: 13 }}>Loading</p>;
  }

  const thresholdValue = thresholdDraft ?? (data.spend.threshold === null ? "" : String(data.spend.threshold));

  const renderRow = (key: string, task: RoutingTask, isTaskRow: boolean) => {
    const { cfg, source } = resolveForDisplay(data, key);
    const cat = data.catalog.find((c) => c.id === cfg.model);
    const hasOverride = !!data.config[key];
    const gated = GATED_TASKS.includes(task);
    const calibration = data.calibration[key];
    const usage = usageFor(data, key, task, isTaskRow);
    const busy = saving === key;
    const tokensValue = maxTokensDraft[key] ?? (cfg.maxTokens !== undefined ? String(cfg.maxTokens) : "");

    let calibrationText = "Not gated";
    let calibrationColour: string = BRAND.mid;
    if (gated) {
      if (calibration?.passedAt && calibration.model === cfg.model) {
        calibrationText = `Passed with ${calibration.model} on ${formatDate(calibration.passedAt)}`;
        calibrationColour = BRAND.brandGreen;
      } else if (calibration?.uncalibratedSince) {
        calibrationText = `Uncalibrated since ${formatDate(calibration.uncalibratedSince)}`;
        calibrationColour = BRAND.red;
      } else if (calibration?.passedAt) {
        calibrationText = `Passed with ${calibration.model} on ${formatDate(calibration.passedAt)}; current model differs`;
        calibrationColour = BRAND.amber;
      } else {
        calibrationText = "Not yet calibrated";
        calibrationColour = BRAND.amber;
      }
    }

    return (
      <tr key={key} style={{ background: isTaskRow ? BRAND.white : "#F5F7F6" }}>
        <td style={{ ...td, maxWidth: 320 }}>
          <div style={{ fontWeight: 600, color: BRAND.darkGreen, paddingLeft: isTaskRow ? 0 : 16 }}>
            {isTaskRow ? data.labels[task] : key}
          </div>
          <div style={{ fontSize: 11, color: BRAND.mid, lineHeight: 1.5, marginTop: 2, paddingLeft: isTaskRow ? 0 : 16 }}>
            {isTaskRow ? data.descriptions[task] : `Override for ${PUBLIC_TOOLS.find((t) => t.slug === key.split(":")[1])?.name ?? key.split(":")[1]}`}
          </div>
          <div style={{ fontSize: 11, color: BRAND.teal, marginTop: 4, paddingLeft: isTaskRow ? 0 : 16 }}>{source}</div>
        </td>
        <td style={td}>
          <select
            value={cfg.model}
            disabled={busy}
            onChange={(e) => save(key, cfg, { model: e.target.value })}
            style={controlStyle}
          >
            {!data.catalog.some((c) => c.id === cfg.model) && (
              <option value={cfg.model} disabled>{cfg.model} (retired)</option>
            )}
            {data.catalog.map((c) => (
              <option key={c.id} value={c.id} disabled={!c.available}>
                {c.id}{c.available ? "" : " (retired)"}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: BRAND.mid, marginTop: 4 }}>
            {cat && (cat.promptPrice > 0 || cat.completionPrice > 0)
              ? `$${cat.promptPrice.toFixed(2)} in / $${cat.completionPrice.toFixed(2)} out per M`
              : "Price unavailable"}
          </div>
        </td>
        <td style={td}>
          <select
            value={cfg.reasoning ?? ""}
            disabled={busy}
            onChange={(e) => save(key, cfg, { reasoning: e.target.value as Reasoning | "" })}
            style={controlStyle}
          >
            {REASONING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </td>
        <td style={td}>
          <input
            type="number"
            min={100}
            max={16000}
            step={100}
            value={tokensValue}
            disabled={busy}
            onChange={(e) => setMaxTokensDraft((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n !== cfg.maxTokens) save(key, cfg, { maxTokens: n });
            }}
            style={{ ...controlStyle, width: 90 }}
          />
        </td>
        <td style={td}>
          {task === "synthesis" || task === "builder-read" ? (
            <select
              value={cfg.fallback ?? ""}
              disabled={busy}
              onChange={(e) => save(key, cfg, { fallback: e.target.value || undefined })}
              style={controlStyle}
            >
              <option value="">None</option>
              {data.catalog.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.available}>{c.id}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, color: BRAND.mid }}>Never</span>
          )}
        </td>
        <td style={{ ...td, fontSize: 12, color: calibrationColour, maxWidth: 220 }}>{calibrationText}</td>
        <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>
          {usage.calls.toLocaleString()} calls
          <div style={{ color: BRAND.mid }}>${usage.cost.toFixed(4)}</div>
        </td>
        <td style={td}>
          <button
            type="button"
            disabled={busy || !hasOverride}
            onClick={() => void patch({ key, reset: true })}
            style={{ ...buttonStyle, opacity: hasOverride ? 1 : 0.4, cursor: hasOverride ? "pointer" : "not-allowed" }}
          >
            {isTaskRow ? "Reset to default" : "Remove"}
          </button>
        </td>
      </tr>
    );
  };

  const overrideKeys = Object.keys(data.config).filter((k) => k.includes(":"));

  return (
    <div>
      <div style={{ marginBottom: 16, background: BRAND.white, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen }}>
          Spend this month ({data.spend.month}): ${data.spend.cost.toFixed(2)}
        </span>
        <label style={{ fontSize: 13, color: BRAND.dark, display: "inline-flex", alignItems: "center", gap: 6 }}>
          Alert threshold: $
          <input
            type="number"
            min={0}
            step="0.01"
            value={thresholdValue}
            disabled={savingThreshold}
            onChange={(e) => setThresholdDraft(e.target.value)}
            style={{ ...controlStyle, width: 110 }}
          />
        </label>
        <button type="button" disabled={savingThreshold} onClick={() => void saveThreshold()} style={buttonStyle}>
          Save
        </button>
        <span style={{ fontSize: 11, color: BRAND.mid }}>
          {data.spend.alertedAt
            ? `Alert sent on ${formatDate(data.spend.alertedAt)}. The daily report emails once a month when the spend passes the threshold; pause Ask Summit if it is unexpected.`
            : "The daily report emails once a month when the spend passes the threshold; blank means no alert. Pause Ask Summit on its queue page if spend is unexpected."}
        </span>
      </div>

      <div style={{ background: BRAND.white, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Model</th>
                <th style={th}>Reasoning</th>
                <th style={th}>Max tokens</th>
                <th style={th}>Fallback</th>
                <th style={th}>Calibration</th>
                <th style={th}>Last 30 days</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {ROUTING_TASKS.map((task) => [
                renderRow(task, task, true),
                ...overrideKeys
                  .filter((k) => k.startsWith(`${task}:`))
                  .sort()
                  .map((k) => renderRow(k, task, false)),
              ])}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p style={{ color: BRAND.red, fontSize: 13, marginTop: 10 }}>{error}</p>}

      <div style={{ marginTop: 20, background: BRAND.white, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen }}>Add per-tool override</span>
        <select value={overrideTask} onChange={(e) => setOverrideTask(e.target.value as RoutingTask)} style={controlStyle}>
          {ROUTING_TASKS.filter((t) => t === "scoring" || t === "details").map((t) => (
            <option key={t} value={t}>{data.labels[t]}</option>
          ))}
        </select>
        <select value={overrideTool} onChange={(e) => setOverrideTool(e.target.value)} style={controlStyle}>
          {PUBLIC_TOOLS.map((t) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving !== null || !!data.config[`${overrideTask}:${overrideTool}`]}
          onClick={() => {
            const key = `${overrideTask}:${overrideTool}`;
            const { cfg } = resolveForDisplay(data, key);
            save(key, cfg, {});
          }}
          style={buttonStyle}
        >
          Add
        </button>
        <span style={{ fontSize: 11, color: BRAND.mid }}>
          Starts from the task&apos;s current model. Synthesis and extraction are not per tool.
        </span>
      </div>
    </div>
  );
}
