"use client";

/**
 * The Project Builder client root. Owns the brief state (the prototype's
 * flat state object, validated by `parseBriefState`), the pasted text, the
 * status lines per helper, the one level Undo, the contact, the save record
 * (id, token, times, counters), the save sheet, the dock and the phase
 * (building, loading, submitting, done, locked).
 *
 * Every step renders from local state; only Save, the helpers and Submit
 * touch the server, so the page keeps working while the API is down.
 * Before the first save nothing leaves the browser except text sent to the
 * read helper; progress goes to localStorage on every change so a refresh
 * loses nothing. After the first save the token from the response rides on
 * every call, and every step change PUTs the state (one request in flight,
 * the latest state queued behind it, last write wins).
 *
 * The helpers return the whole new state rather than a patch so "fills
 * blanks and adds, never overwrites" has one implementation on the server;
 * the page snapshots the state and source before each call so Undo is a
 * local restore. A 409 from any call means the brief was submitted
 * elsewhere (another tab, or Anthony has it): the page switches to the
 * read only view from the state it has, rather than looping on errors.
 *
 * Every JSON body carries `website: ""`: that top level field is the
 * honeypot on every builder route, which is why the real website inputs
 * are named `businessWebsite` and `companyWebsite`.
 */
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/app/lib/brand";
import {
  BRIEF_ID_PATTERN,
  SOURCE_MAX_CHARS,
  blank,
  isFreeMailAddress,
  normaliseDomain,
  normaliseSourceTag,
  parseBriefState,
  validateContact,
  type BriefState,
  type BriefStatus,
  type SuggestStep,
} from "@/app/lib/project-builder/brief";
import { STEPS, type Priority } from "@/app/lib/project-builder/catalogue";
import {
  AUTOSAVE_FAILED_LINE,
  CHANGE_SENT_LINE,
  DETAILS_UPDATED_LINE,
  FREE_MAIL_PROMPT,
  LINK_INVALID_LINE,
  LINK_REQUEST_ANSWER,
  OFFLINE_LINE,
  SAVE,
  SAVED_LINE,
  SAVED_LOCAL_ONLY_LINE,
  SAVE_FAILED_LINE,
  START,
  SUBMIT,
  UNDONE_LINE,
  WORKING_LINE,
} from "@/app/lib/project-builder/copy";
import { buildReplacementRequirements, type Requirement } from "@/app/lib/project-builder/requirements";
import { devAnswer, type DevAnswer } from "@/app/lib/project-builder/suggestions";
import { page as pageStyle, wrap } from "./builder-styles";
import Stepper from "./Stepper";
import SaveButton from "./SaveButton";
import StepStart from "./StepStart";
import StepGoal from "./StepGoal";
import StepWhat from "./StepWhat";
import StepRules from "./StepRules";
import StepSmart from "./StepSmart";
import StepSubmit from "./StepSubmit";
import SaveSheet from "./SaveSheet";
import BlueprintDock from "./BlueprintDock";
import ReadOnlyView from "./ReadOnlyView";
import DonePanel from "./DonePanel";
import LinkRequest from "./LinkRequest";
import { EMPTY_CONTACT, type ContactDraft } from "./ContactFields";

// Versioned so a future change to the stored shape can start clean rather than
// coerce an old entry; `parseBriefState` already tolerates missing fields.
const STORAGE_KEY = "summit-project-builder-v3";
// sessionStorage, so `builder_started` fires once per browser session and the
// top of the funnel is close to a session count.
const STARTED_KEY = "summit-project-builder-started";

type Phase = "building" | "loading" | "submitting" | "done" | "locked";

interface SavedInfo {
  id: string;
  token: string | null;
  savedAt: string;
  status: BriefStatus;
  submittedAt: string | null;
  suggestCount: number;
  ideasCount: number;
  readCount: number;
}

interface Stored {
  state: unknown;
  source?: unknown;
  contact?: unknown;
  saved?: unknown;
  srcTag?: unknown;
}

interface Snapshot {
  key: string;
  state: BriefState;
  source: string;
}

type HelperResponse = { ok: true; state: unknown; message: string; fallback?: boolean; runs?: number; found?: number } | { error: string; locked?: boolean };

function readStored(): { state: BriefState; source: string; contact: ContactDraft; saved: SavedInfo | null; srcTag: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    const state = parseBriefState(parsed.state);
    const source = typeof parsed.source === "string" ? parsed.source.slice(0, SOURCE_MAX_CHARS) : "";
    const c = (parsed.contact && typeof parsed.contact === "object" ? parsed.contact : {}) as Partial<ContactDraft>;
    const contact: ContactDraft = {
      name: typeof c.name === "string" ? c.name : "",
      email: typeof c.email === "string" ? c.email : "",
      company: typeof c.company === "string" ? c.company : "",
      website: typeof c.website === "string" ? c.website : "",
      marketing: c.marketing === true,
    };
    const s = (parsed.saved && typeof parsed.saved === "object" ? parsed.saved : null) as Partial<SavedInfo> | null;
    const saved: SavedInfo | null =
      s && typeof s.id === "string" && BRIEF_ID_PATTERN.test(s.id)
        ? {
            id: s.id,
            token: typeof s.token === "string" ? s.token : null,
            savedAt: typeof s.savedAt === "string" ? s.savedAt : new Date().toISOString(),
            status: typeof s.status === "string" ? (s.status as BriefStatus) : "draft",
            submittedAt: typeof s.submittedAt === "string" ? s.submittedAt : null,
            suggestCount: Number(s.suggestCount) || 0,
            ideasCount: Number(s.ideasCount) || 0,
            readCount: Number(s.readCount) || 0,
          }
        : null;
    return { state, source, contact, saved, srcTag: normaliseSourceTag(parsed.srcTag) };
  } catch {
    return null;
  }
}

/** True when the step has an answer worth counting as completed. */
function stepHasContent(state: BriefState, step: number): boolean {
  switch (step) {
    case 0:
      return Boolean(state.path || state.name.trim() || state.idea.trim() || state.biz.notes.trim() || state.biz.website.trim());
    case 1:
      return Boolean(state.problem.trim() || state.success.trim() || state.signoff.trim() || state.roles.length);
    case 2:
      return Object.keys(state.features).length > 0 || state.custom.length > 0 || state.integrations.length > 0 || state.intOther.trim().length > 0;
    case 3:
      return Boolean(state.sso || state.perms || state.audit || state.personal || state.compliance.length || state.run || state.handover.length);
    case 4:
      return Object.keys(state.ideaPick).length > 0;
    default:
      return false;
  }
}

function sendEvent(name: "builder_started" | "builder_step_completed", step?: number): void {
  try {
    void fetch("/api/project-builder/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, step, website: "" }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // never breaks the page
  }
}

/** Reads `b`, `t` and `src` under Suspense so the page stays static. State is handed back only in the async continuation. */
function ResumeLoader({ onResume, onSrc }: { onResume: (id: string, token: string) => void; onSrc: (tag: string) => void }) {
  const searchParams = useSearchParams();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const b = searchParams.get("b") ?? "";
    const t = searchParams.get("t") ?? "";
    const src = normaliseSourceTag(searchParams.get("src"));
    Promise.resolve().then(() => {
      if (src) onSrc(src);
      if (BRIEF_ID_PATTERN.test(b) && t) onResume(b, t);
    });
  }, [searchParams, onResume, onSrc]);
  return null;
}

/** The client root; see the header comment for what it owns and why. */
export default function ProjectBuilderPage() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<BriefState>(blank);
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Snapshot | null>(null);
  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT);
  const [contactError, setContactError] = useState("");
  const [saved, setSaved] = useState<SavedInfo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("building");
  const [srcTag, setSrcTag] = useState("");
  const [linkAnswer, setLinkAnswer] = useState("");
  const [localIdeasRuns, setLocalIdeasRuns] = useState(0);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [toast, setToast] = useState("");
  const startedRef = useRef(false);
  const saveInFlight = useRef(false);
  const saveQueued = useRef<BriefState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount: read localStorage in an async continuation (never a synchronous setState in the effect body).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const stored = readStored();
      if (stored) {
        setState(stored.state);
        setSource(stored.source);
        setContact(stored.contact);
        setSaved(stored.saved);
        setSrcTag(stored.srcTag);
        if (stored.saved && stored.saved.status !== "draft") setPhase("locked");
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, source, contact, saved, srcTag }));
    } catch {
      // storage unavailable: the page still works for this visit
    }
  }, [ready, state, source, contact, saved, srcTag]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const note = (key: string, text: string) => setNotes((n) => ({ ...n, [key]: text }));

  const markStarted = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      if (window.sessionStorage.getItem(STARTED_KEY)) return;
      window.sessionStorage.setItem(STARTED_KEY, "1");
    } catch {
      // no session storage: send once per mount
    }
    sendEvent("builder_started");
  }, []);

  const update = useCallback(
    (patch: Partial<BriefState>) => {
      markStarted();
      setState((s) => ({ ...s, ...patch }));
    },
    [markStarted],
  );

  const authBody = (): Record<string, unknown> => (saved ? { briefId: saved.id, token: saved.token } : {});

  const lock = () => {
    setPhase("locked");
    setSaved((s) => (s ? { ...s, status: "submitted" } : s));
  };

  /** Autosave after the first save: one PUT in flight, the latest state queued behind it. */
  const autosave = async (next: BriefState) => {
    if (!saved || !saved.token || phase !== "building") return;
    if (saveInFlight.current) {
      saveQueued.current = next;
      return;
    }
    saveInFlight.current = true;
    try {
      const res = await fetch(`/api/project-builder/briefs/${encodeURIComponent(saved.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: saved.token, state: next, source, website: "" }),
      });
      if (res.status === 409) {
        lock();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { savedAt?: string };
      if (data.savedAt) setSaved((s) => (s ? { ...s, savedAt: data.savedAt as string } : s));
    } catch {
      note("save", AUTOSAVE_FAILED_LINE);
    } finally {
      saveInFlight.current = false;
      const queued = saveQueued.current;
      saveQueued.current = null;
      if (queued) void autosave(queued);
    }
  };

  const go = (to: number) => {
    const from = state.step;
    if (to === from) return;
    const target = Math.max(0, Math.min(STEPS.length - 1, to));
    if (target > from && stepHasContent(state, from)) sendEvent("builder_step_completed", from + 1);
    const next = { ...state, step: target };
    setState(next);
    setSelectedKey(null);
    window.scrollTo({ top: 0 });
    void autosave(next);
  };

  /** One helper call: snapshot for Undo, busy, the status line, the whole new state back. */
  const callHelper = async (path: string, payload: Record<string, unknown>, key: string, onOk?: (data: Extract<HelperResponse, { ok: true }>) => void) => {
    if (busy) return;
    setUndo({ key, state, source });
    setBusy(true);
    note(key, WORKING_LINE);
    try {
      const res = await fetch(`/api/project-builder/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...authBody(), state, source: source || undefined, website: "" }),
      });
      const data = (await res.json().catch(() => ({ error: OFFLINE_LINE }))) as HelperResponse;
      if (res.status === 409) {
        lock();
        return;
      }
      if (!res.ok || !("ok" in data)) {
        note(key, "error" in data && data.error ? data.error : OFFLINE_LINE);
        setUndo(null);
        return;
      }
      const nextState = parseBriefState(data.state);
      setState(nextState);
      note(key, data.message);
      onOk?.(data);
    } catch {
      note(key, OFFLINE_LINE);
      setUndo(null);
    } finally {
      setBusy(false);
    }
  };

  const doUndo = () => {
    if (!undo) return;
    setState(undo.state);
    setSource(undo.source);
    note(undo.key, UNDONE_LINE);
    setUndo(null);
  };

  const suggest = (step: SuggestStep) => callHelper("suggest", { step }, step);

  const runIdeas = async () => {
    setIdeasLoading(true);
    await callHelper("ideas", {}, "smart", (data) => {
      if (typeof data.runs === "number") setSaved((s) => (s ? { ...s, ideasCount: data.runs as number } : s));
      else setLocalIdeasRuns((n) => n + 1);
    });
    setIdeasLoading(false);
  };

  const readDoc = async () => {
    if (!source.trim()) {
      note("read", START.readEmpty);
      return;
    }
    note("read", START.reading);
    await callHelper("read", { path: state.path }, "read");
  };

  const lookup = (name: string) => callHelper("lookup", { name }, "rep");

  const buildReplacement = () => {
    const r = buildReplacementRequirements(state);
    if (r.state !== state) update(r.state);
    note("rep", r.note);
  };

  const onFile = async (file: File) => {
    if (!/\.(txt|md|markdown|csv)$/i.test(file.name) && !/^text\//.test(file.type)) {
      note("read", START.fileRejected);
      return;
    }
    const text = await file.text();
    const joined = (source.trim() ? `${source.trim()}\n\n` : "") + text;
    setSource(joined.slice(0, SOURCE_MAX_CHARS));
    note("read", joined.length > SOURCE_MAX_CHARS ? START.fileCut : "");
    markStarted();
  };

  const onDev = (answer: DevAnswer) => {
    const r = devAnswer(state, answer);
    update({ run: r.state.run, handover: r.state.handover });
    note("running", r.message);
  };

  const openSave = () => {
    if (!contact.website.trim() && state.biz.website.trim()) {
      const d = normaliseDomain(state.biz.website);
      if (d) setContact((c) => ({ ...c, website: d }));
    }
    setContactError("");
    setSheetOpen(true);
  };

  /** The first save (POST) or a details update (PUT with the contact). Returns the saved info, or null on failure. */
  const doSave = async (): Promise<SavedInfo | null> => {
    const validated = validateContact(contact);
    if (!validated.ok) {
      setContactError(validated.error);
      return null;
    }
    setContactError("");
    setBusy(true);
    try {
      if (saved && saved.token) {
        const res = await fetch(`/api/project-builder/briefs/${encodeURIComponent(saved.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: saved.token, state, source, contact: validated.contact, website: "" }),
        });
        if (res.status === 409) {
          lock();
          return null;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setContactError(data.error ?? SAVE_FAILED_LINE);
          return null;
        }
        setContact((c) => ({ ...c, website: validated.contact.website }));
        setSheetOpen(false);
        showToast(DETAILS_UPDATED_LINE);
        return saved;
      }
      const res = await fetch("/api/project-builder/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, source, contact: validated.contact, src: srcTag, website: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; token?: string | null; savedAt?: string; emailed?: boolean; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        setContactError(data.error ?? SAVE_FAILED_LINE);
        return null;
      }
      const info: SavedInfo = {
        id: data.id,
        token: data.token ?? null,
        savedAt: data.savedAt ?? new Date().toISOString(),
        status: "draft",
        submittedAt: null,
        suggestCount: 0,
        ideasCount: localIdeasRuns,
        readCount: 0,
      };
      setSaved(info);
      setContact((c) => ({ ...c, website: validated.contact.website }));
      setSheetOpen(false);
      showToast(data.emailed ? (isFreeMailAddress(validated.contact.email) ? `${SAVED_LINE} ${FREE_MAIL_PROMPT}` : SAVED_LINE) : SAVED_LOCAL_ONLY_LINE);
      return info;
    } catch {
      setContactError(SAVE_FAILED_LINE);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    let info = saved;
    if (!info) {
      info = await doSave();
      if (!info) return;
    }
    if (!info.token) {
      note("submit", SAVED_LOCAL_ONLY_LINE);
      return;
    }
    setBusy(true);
    setPhase("submitting");
    note("submit", SUBMIT.submitting);
    try {
      const res = await fetch(`/api/project-builder/briefs/${encodeURIComponent(info.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: info.token, state, source, website: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; submittedAt?: string; error?: string };
      if (res.status === 409) {
        lock();
        return;
      }
      if (!res.ok || !data.ok) {
        setPhase("building");
        note("submit", data.error ?? OFFLINE_LINE);
        return;
      }
      setSaved({ ...info, status: "submitted", submittedAt: data.submittedAt ?? new Date().toISOString() });
      setUndo(null);
      setDockOpen(false);
      setPhase("done");
      window.scrollTo({ top: 0 });
    } catch {
      setPhase("building");
      note("submit", OFFLINE_LINE);
    } finally {
      setBusy(false);
    }
  };

  const resume = useCallback(async (id: string, token: string) => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/project-builder/briefs/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!res.ok) {
        setPhase("building");
        note("link", LINK_INVALID_LINE);
        return;
      }
      const data = (await res.json()) as {
        state: unknown;
        source?: string;
        contact?: Partial<ContactDraft>;
        status?: BriefStatus;
        savedAt?: string;
        submittedAt?: string | null;
        suggestCount?: number;
        ideasCount?: number;
        readCount?: number;
      };
      const loaded = parseBriefState(data.state);
      setState(loaded);
      setSource(typeof data.source === "string" ? data.source : "");
      setContact({
        name: data.contact?.name ?? "",
        email: data.contact?.email ?? "",
        company: data.contact?.company ?? "",
        website: data.contact?.website ?? "",
        marketing: data.contact?.marketing === true,
      });
      const status = data.status ?? "draft";
      setSaved({
        id,
        token,
        savedAt: data.savedAt ?? new Date().toISOString(),
        status,
        submittedAt: data.submittedAt ?? null,
        suggestCount: data.suggestCount ?? 0,
        ideasCount: data.ideasCount ?? 0,
        readCount: data.readCount ?? 0,
      });
      setNotes({});
      setUndo(null);
      setPhase(status === "draft" ? "building" : "locked");
    } catch {
      setPhase("building");
      note("link", LINK_INVALID_LINE);
    }
  }, []);

  // The first `?src=` seen wins and is kept until the first save; a tag on a
  // later resume link is ignored, so the stored source is where they started.
  const onSrc = useCallback((tag: string) => {
    setSrcTag((current) => current || tag);
  }, []);

  // The route answers the same way whatever the address, and so does the
  // page: the fixed line never says whether a brief exists.
  const requestLink = async (email: string) => {
    try {
      await fetch("/api/project-builder/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, website: "" }) });
    } catch {
      // the answer is the same whatever happened
    }
    setLinkAnswer(LINK_REQUEST_ANSWER);
  };

  const changeRequest = async (message: string) => {
    if (!saved || !saved.token) return;
    try {
      const res = await fetch(`/api/project-builder/briefs/${encodeURIComponent(saved.id)}/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: saved.token, message, website: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      note("change", res.ok ? CHANGE_SENT_LINE : data.error ?? OFFLINE_LINE);
    } catch {
      note("change", OFFLINE_LINE);
    }
  };

  const reset = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to clear
    }
    setState(blank());
    setSource("");
    setNotes({});
    setUndo(null);
    setContact(EMPTY_CONTACT);
    setContactError("");
    setSaved(null);
    setSheetOpen(false);
    setDockOpen(false);
    setSelectedKey(null);
    setLocalIdeasRuns(0);
    setPhase("building");
    window.history.replaceState(null, "", "/tools/project-builder");
    window.scrollTo({ top: 0 });
  };

  // Dock actions through the requirement's ref.
  const setPriority = (req: Requirement, pri: Priority) => {
    const r = req.ref;
    if (r.kind === "feature") update({ features: { ...state.features, [r.key]: pri } });
    if (r.kind === "custom") update({ custom: state.custom.map((c, i) => (i === r.index ? { ...c, pri } : c)) });
    if (r.kind === "idea") update({ ideaPick: { ...state.ideaPick, [r.id]: pri } });
    setSelectedKey(`${req.cat}|${req.text}`);
  };
  const removeReq = (req: Requirement) => {
    const r = req.ref;
    if (r.kind === "feature") {
      const features = { ...state.features };
      const featSrc = { ...state.featSrc };
      delete features[r.key];
      delete featSrc[r.key];
      update({ features, featSrc });
    }
    if (r.kind === "custom") update({ custom: state.custom.filter((_, i) => i !== r.index) });
    if (r.kind === "idea") update({ ideaPick: { ...state.ideaPick, [r.id]: "no" } });
    if (r.kind === "integration") update({ integrations: state.integrations.filter((x) => x !== r.label) });
    setSelectedKey(null);
  };

  const assistFor = (key: SuggestStep) => ({
    busy,
    note: notes[key] ?? "",
    canUndo: undo?.key === key,
    onUndo: doUndo,
    onRun: () => void suggest(key),
  });
  const hasContext = Boolean(state.idea.trim() || source.trim() || state.problem.trim() || state.name.trim());
  const firstName = contact.name.trim().split(/\s+/)[0] ?? "";
  const ideasRuns = saved ? saved.ideasCount : localIdeasRuns;

  const resumeLoader = (
    <Suspense fallback={null}>
      <ResumeLoader onResume={resume} onSrc={onSrc} />
    </Suspense>
  );

  if (!ready || phase === "loading") {
    return (
      <div className="pb-page" style={{ ...pageStyle, minHeight: 480 }}>
        {resumeLoader}
        <div style={wrap}>
          <p style={{ padding: "48px 0", color: BRAND.teal }}>{phase === "loading" ? "Loading your brief." : ""}</p>
        </div>
      </div>
    );
  }

  if ((phase === "locked" || phase === "done") && saved) {
    return (
      <div className="pb-page" style={pageStyle}>
        {resumeLoader}
        <div style={wrap}>
          <SaveButton savedAt={null} onSave={() => undefined} onReset={reset} resetLabel={SAVE.startNew} busy />
          {phase === "done" && <DonePanel firstName={firstName} />}
          <ReadOnlyView state={state} status={saved.status} submittedAt={saved.submittedAt} onChangeRequest={changeRequest} changeNote={notes.change ?? ""} onReset={reset} />
        </div>
      </div>
    );
  }

  const step = state.step;
  return (
    <div className="pb-page" style={pageStyle}>
      {resumeLoader}
      <div style={wrap}>
        <SaveButton savedAt={saved?.savedAt ?? null} onSave={openSave} onReset={reset} busy={busy} />
        {notes.link && <p style={{ color: BRAND.red, fontSize: 15, margin: "8px 0 0" }}>{notes.link}</p>}
        {notes.save && <p style={{ color: BRAND.teal, fontSize: 14, margin: "8px 0 0" }}>{notes.save}</p>}
        <Stepper step={step} onGo={go} />
        <main>
          {step === 0 && (
            <>
              <StepStart
                state={state}
                source={source}
                busy={busy}
                readNote={notes.read ?? ""}
                repNote={notes.rep ?? ""}
                update={update}
                setSource={(t) => {
                  markStarted();
                  setSource(t.slice(0, SOURCE_MAX_CHARS));
                }}
                onFile={(f) => void onFile(f)}
                onRead={() => void readDoc()}
                onLookup={(n) => void lookup(n)}
                onBuild={buildReplacement}
                canUndo={undo?.key === "read"}
                lookupCanUndo={undo?.key === "rep"}
                onUndo={doUndo}
              />
              <LinkRequest onSubmit={requestLink} answer={linkAnswer} />
            </>
          )}
          {step === 1 && <StepGoal state={state} hasContext={hasContext} update={update} assist={assistFor("goal")} />}
          {step === 2 && <StepWhat state={state} update={update} features={assistFor("features")} connections={assistFor("connections")} />}
          {step === 3 && <StepRules state={state} update={update} guardrails={assistFor("guardrails")} running={assistFor("running")} onDevAnswer={onDev} />}
          {step === 4 && (
            <StepSmart
              state={state}
              busy={busy}
              loading={ideasLoading}
              note={notes.smart ?? ""}
              runs={ideasRuns}
              update={update}
              onRun={() => void runIdeas()}
              canUndo={undo?.key === "smart"}
              onUndo={doUndo}
            />
          )}
          {step === 5 && (
            <StepSubmit
              state={state}
              saved={Boolean(saved)}
              contact={contact}
              onContact={(patch) => setContact((c) => ({ ...c, ...patch }))}
              contactError={contactError}
              busy={busy || phase === "submitting"}
              note={notes.submit ?? ""}
              onGoto={go}
              onOpenSave={openSave}
              onSubmit={() => void submit()}
            />
          )}
        </main>
      </div>
      <SaveSheet open={sheetOpen} saved={Boolean(saved)} contact={contact} onChange={(patch) => setContact((c) => ({ ...c, ...patch }))} error={contactError} busy={busy} onCancel={() => setSheetOpen(false)} onSave={() => void doSave()} />
      <BlueprintDock state={state} open={dockOpen} onToggle={() => setDockOpen((o) => !o)} selectedKey={selectedKey} onSelect={setSelectedKey} onPriority={setPriority} onRemove={removeReq} onGoto={(s) => { setDockOpen(false); go(s); }} />
      {toast && (
        <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(80px + env(safe-area-inset-bottom, 0px))", background: BRAND.darkGreen, color: BRAND.white, padding: "10px 18px", zIndex: 60, fontWeight: 700, fontSize: 15, maxWidth: "90vw" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
