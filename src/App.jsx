import React, { useState, useRef, useEffect } from "react";

// ============================================================================
// THE FORGE — AI Builder evaluation harness (web version)
// Candidate runs a solo work-sample session; the reviewer scorecard is
// generated behind the scenes and is NOT shown to the candidate.
// Live AI via Anthropic API when a key is provided; scripted fallback otherwise
// so a cold reviewer link always completes.
// ============================================================================

const RUBRIC = [
  { key: "framing", label: "Problem framing", jd: "decide what the real problem even is" },
  { key: "cuts", label: "Scoping & cut decisions", jd: "the choices you make, and the ones you do not" },
  { key: "workflow", label: "Workflow & systems thinking", jd: "think in workflows, not just models" },
  { key: "rai", label: "Responsible-AI-by-design", jd: "risk, governance, trust as core constraints" },
  { key: "action", label: "Builder bias-to-action", jd: "make something real, not only describe an idea" },
  { key: "comms", label: "Communication of tradeoffs", jd: "communicate assumptions, tradeoffs, risks" },
];

const SCENARIO = {
  name: "Accounts-payable invoice automation",
  framing:
    "Here's the situation. Our finance team processes a few thousand supplier invoices a month. They arrive by email in every format you can imagine — PDFs, scanned paper, phone photos, and every vendor's layout is different. A clerk opens each one, keys the line items into our ERP, matches it against the right purchase order, and routes anything that doesn't line up for follow-up. It's slow and tedious, the backlog spikes at month-end, and two clerks will key the same invoice slightly differently.\n\nYou've been asked to look at where agentic AI could help here. There's no fixed spec — I want to hear how you'd think about it, out loud, as you go. Where would you start?",
  curveball:
    "One thing to factor in before you go further: our ERP is an old on-prem system with no API. The only way to get an invoice into it is the exact same screen a clerk uses — point, click, type. IT has said they won't build an integration layer this year. How does that change your plan?",
};

const INTRO =
  "Thanks for doing this. This is a short reasoning exercise — about 15 minutes. There's no single right answer, and I'm not looking for a polished solution. I just want to hear how you think, so please think out loud. Ready when you are.";

// Hard caps so a session always terminates — no endless loop, no wasted tokens.
const MAX_TURNS = 5; // hard cap on candidate responses → auto-score
const SOFT_TURNS = 4; // after this, end early if answers aren't progressing
const TIME_LIMIT_MS = 10 * 60 * 1000; // 10 min wall-clock from the first response → auto-score
const CLOSING_LINE =
  "That's a good place to stop — thank you for walking me through your thinking. I have what I need from here. Generating the panel's scorecard now.";

// Scripted fallback turns — used when no API key is present, so the link always works.
const FALLBACK_INTERVIEWER = [
  "Good instinct. Before we go further — what do you think the *real* problem is here? Is it the keying, the PO matching, or something underneath that?",
  "Say you only had a few days. What would you deliberately NOT try to automate first?",
  "Walk me through the flow you're imagining. Where does a human stay in the loop, and where would you let an agent act on its own?",
  "Concretely — what's the very first slice you'd stand up to learn the most, fastest?",
];

const SYSTEM_INTERVIEWER = `You are the Interviewer in "The Forge", a work-sample exercise that evaluates an AI Builder candidate by how they reason under ambiguity. You are talking to the candidate.

Your job: surface how they frame a vague problem and what they choose to build and not build. Be warm, curious, peer-to-peer. Ask ONE question at a time, keep your messages short (2-3 sentences max). Probe, never lead — do not hint at the answer you want. Do not score, do not praise excessively, do not lecture.

Cover, over a few exchanges, adapting to their answers: (1) what the real problem is / do they narrow scope; (2) what they would deliberately NOT build; (3) the workflow, human-in-the-loop, and autonomy boundaries; (4) a concrete first step to learn fast.

The scenario the candidate is working on:
${SCENARIO.framing}

Respond ONLY with your next short message to the candidate. No preamble, no markdown headers.`;

const SYSTEM_CURVEBALL = `You are the Interviewer in "The Forge". The candidate now has a working approach on the table. Deliver this governance constraint as a calm, realistic mid-project update (not a gotcha), then ask what changes about their plan. Keep it to 2-4 sentences. Use this constraint:
"${SCENARIO.curveball}"
Respond ONLY with the message to the candidate.`;

const SYSTEM_EVALUATOR = `You are the Evaluator in "The Forge". You are now OFF-CAMERA — the candidate will never see this. Score the candidate's REASONING from the transcript against six competencies, on a 1-5 scale (or "N/S" if the session gave not enough signal).

Fairness rules: score reasoning, not prose polish; ignore verbosity and eloquence; be identity-blind; every score must cite a short quote or close paraphrase of what the candidate actually said; if something wasn't probed, mark N/S rather than guessing. Never output a hire/no-hire verdict.

The six competencies (key: label):
- framing: Problem framing
- cuts: Scoping & cut decisions
- workflow: Workflow & systems thinking
- rai: Responsible-AI-by-design
- action: Builder bias-to-action
- comms: Communication of tradeoffs

1-5 anchors: 5 proactive & well-reasoned unprompted; 4 strong when reached; 3 adequate but shallow/only when pushed; 2 weak or missed the point; 1 absent even when given the opening.

Respond ONLY with valid JSON, no markdown fences, in exactly this shape:
{"scores":[{"key":"framing","score":"x/5 or N/S","evidence":"short quote"}, ... all six ...],
"curveball":"2-3 sentences on how they handled the thrown constraint",
"strengths":["..."],"watchouts":["..."],"fairness":"1-2 sentences","focus":["...","..."]}`;

async function callClaude(apiKey, system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      // temperature 0 = the model picks its most-likely answer every time, so the
      // same transcript yields near-identical scores (consistency, not creativity).
      // NOTE: supported on Haiku/Sonnet/Opus-4.6; the Opus 4.7/4.8 and Fable 5
      // models REMOVE temperature and will 400 if you switch to them — drop this line then.
      temperature: 0,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error("API " + res.status);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

// ----------------------------------------------------------------------------

export default function App() {
  const [view, setView] = useState("candidate"); // candidate | reviewer
  const [apiKey, setApiKey] = useState("");
  const [keyShown, setKeyShown] = useState(true);
  const live = apiKey.trim().length > 20;

  const [msgs, setMsgs] = useState([{ role: "assistant", text: INTRO + "\n\n" + SCENARIO.framing }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0); // candidate turns taken
  const [curveballFired, setCurveballFired] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [ended, setEnded] = useState(false); // interview has hit a cap and is closed
  const [startedAt, setStartedAt] = useState(null); // ms timestamp of the first response
  const scrollRef = useRef(null);
  const endedRef = useRef(false); // guards against double-finish (timer + send race)
  const msgsRef = useRef(msgs); // latest transcript, readable from async callbacks

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  // Heuristic stall check: after SOFT_TURNS, are the candidate's answers failing to
  // move toward real problem-solving? (very short / low-effort, or repeating themselves)
  function notProgressing(list) {
    const ans = list.filter((m) => m.role === "user").map((m) => m.text.trim());
    if (ans.length < SOFT_TURNS) return false;
    const recent = ans.slice(-2);
    const avgWords = recent.reduce((s, a) => s + a.split(/\s+/).filter(Boolean).length, 0) / recent.length;
    const repeated = ans.length >= 2 && ans[ans.length - 1].toLowerCase() === ans[ans.length - 2].toLowerCase();
    return avgWords < 12 || repeated;
  }

  // Score a transcript and show the scorecard.
  async function runScore(list) {
    setScoring(true);
    setView("reviewer");
    const transcript = list
      .map((m) => (m.role === "assistant" ? "INTERVIEWER: " : "CANDIDATE: ") + m.text)
      .join("\n\n");
    try {
      if (live) {
        const raw = await callClaude(apiKey, SYSTEM_EVALUATOR, [
          { role: "user", content: "Transcript of the session:\n\n" + transcript },
        ]);
        setScorecard(JSON.parse(raw.replace(/```json|```/g, "").trim()));
      } else {
        await new Promise((r) => setTimeout(r, 900));
        setScorecard(FALLBACK_SCORECARD);
      }
    } catch (e) {
      setScorecard(FALLBACK_SCORECARD);
    } finally {
      setScoring(false);
    }
  }

  // End the interview once, append the closing line, and auto-jump to the scorecard.
  function finishSession(list) {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    setBusy(false);
    const closed = [...list, { role: "assistant", text: CLOSING_LINE }];
    setMsgs(closed);
    runScore(closed);
  }

  // Time cap: auto-score TIME_LIMIT_MS after the first response, even if idle.
  useEffect(() => {
    if (startedAt === null || ended) return;
    const remaining = TIME_LIMIT_MS - (Date.now() - startedAt);
    const t = setTimeout(() => finishSession(msgsRef.current), Math.max(0, remaining));
    return () => clearTimeout(t);
  }, [startedAt, ended]);

  const apiMessages = (arr) =>
    arr
      .filter((_, i) => i !== 0) // drop the intro framing from the API history; it's in the system prompt
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));

  async function send() {
    if (!input.trim() || busy || ended || endedRef.current) return;
    const startedNow = startedAt === null ? Date.now() : startedAt;
    if (startedAt === null) setStartedAt(startedNow);

    const next = [...msgs, { role: "user", text: input.trim() }];
    setMsgs(next);
    setInput("");
    const newTurns = turns + 1;
    setTurns(newTurns);

    // Auto-jump to the scorecard — no further API call, so a candidate can't loop
    // the interviewer and burn tokens — when any of these hit:
    //  • hard turn cap, • 10-minute time cap, • a stall after SOFT_TURNS turns.
    const timeUp = Date.now() - startedNow >= TIME_LIMIT_MS;
    const stalling = newTurns >= SOFT_TURNS && notProgressing(next);
    if (newTurns >= MAX_TURNS || timeUp || stalling) {
      finishSession(next);
      return;
    }

    setBusy(true);

    // After the candidate has ~2 substantive turns, fire the curveball once.
    const shouldCurveball = newTurns >= 2 && !curveballFired;

    try {
      let reply;
      if (live) {
        reply = await callClaude(
          apiKey,
          shouldCurveball ? SYSTEM_CURVEBALL : SYSTEM_INTERVIEWER,
          apiMessages(next)
        );
      } else {
        await new Promise((r) => setTimeout(r, 600));
        reply = shouldCurveball
          ? SCENARIO.curveball
          : FALLBACK_INTERVIEWER[Math.min(newTurns - 1, FALLBACK_INTERVIEWER.length - 1)];
      }
      if (shouldCurveball) setCurveballFired(true);
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: "(Live AI unavailable — continuing in scripted mode.) " + (FALLBACK_INTERVIEWER[Math.min(newTurns - 1, FALLBACK_INTERVIEWER.length - 1)] || "What would you do differently?") },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Manual "End & score" — same path as an auto-jump, scoring the current transcript.
  function generateScorecard() {
    finishSession(msgsRef.current);
  }

  return (
    <div style={S.shell}>
      <style>{CSS}</style>

      {/* Top bar */}
      <header style={S.top}>
        <div style={S.brand}>
          <span style={S.anvil}>◢◣</span>
          <div>
            <div style={S.title}>THE FORGE</div>
            <div style={S.sub}>AI Builder evaluation harness</div>
          </div>
        </div>
        <div style={S.toggle}>
          <button
            onClick={() => setView("candidate")}
            style={{ ...S.tab, ...(view === "candidate" ? S.tabOn : {}) }}
          >
            Candidate session
          </button>
          <button
            onClick={() => setView("reviewer")}
            style={{ ...S.tab, ...(view === "reviewer" ? S.tabOn : {}) }}
          >
            Reviewer scorecard <span style={S.lock}>🔒</span>
          </button>
        </div>
      </header>

      {/* Key bar */}
      {keyShown && (
        <div style={S.keybar}>
          <span style={S.keylabel}>{live ? "● Live AI" : "○ Scripted demo"}</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste an Anthropic API key for live AI (optional — leave blank to use the scripted demo)"
            style={S.keyinput}
          />
          <button style={S.keyhide} onClick={() => setKeyShown(false)}>hide</button>
        </div>
      )}

      {view === "candidate" ? (
        <main style={S.main}>
          <div style={S.scenarioTag}>SCENARIO · {SCENARIO.name}</div>
          <div ref={scrollRef} style={S.chat}>
            {msgs.map((m, i) => (
              <div key={i} style={m.role === "assistant" ? S.rowL : S.rowR}>
                <div style={m.role === "assistant" ? S.bubbleAI : S.bubbleMe}>
                  {m.role === "assistant" && <div style={S.who}>Interviewer</div>}
                  <div style={S.bubbleText}>{m.text}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div style={S.rowL}>
                <div style={S.bubbleAI}>
                  <div style={S.who}>Interviewer</div>
                  <div style={S.dots}><i className="forge-dot"/><i className="forge-dot" style={{animationDelay:'0.2s'}}/><i className="forge-dot" style={{animationDelay:'0.4s'}}/></div>
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#8a93a6", padding: "2px 2px 6px" }}>
            {ended
              ? "Session ended — generating the panel scorecard…"
              : `Turn ${turns} of ${MAX_TURNS} · auto-scores at the turn limit, after 10 minutes, or if answers stall.`}
          </div>
          <div style={S.composer}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={ended ? "The session has ended." : "Think out loud…"}
              style={S.textarea}
              rows={2}
              disabled={ended}
            />
            <div style={S.composerRight}>
              <button style={S.sendBtn} onClick={send} disabled={busy || ended}>Send</button>
              <button
                style={{ ...S.endBtn, ...(turns < 2 && !ended ? S.endDim : {}) }}
                onClick={generateScorecard}
                disabled={turns < 2 && !ended}
                title={turns < 2 && !ended ? "Answer a couple of questions first" : "End the session and generate the reviewer scorecard"}
              >
                End & score
              </button>
            </div>
          </div>
          <div style={S.note}>
            The candidate sees only this conversation. The scorecard is generated for the hiring panel and is never shown here.
          </div>
        </main>
      ) : (
        <main style={S.mainReview}>
          {scoring ? (
            <div style={S.empty}>
              <div style={S.spinner} />
              <div>Evaluating reasoning from the transcript…</div>
            </div>
          ) : scorecard ? (
            <Scorecard data={scorecard} />
          ) : (
            <div style={S.empty}>
              <div style={S.lockBig}>🔒</div>
              <h3 style={{ margin: "4px 0" }}>No scorecard yet</h3>
              <p style={S.emptyP}>
                Run a candidate session, then click <b>End &amp; score</b>. The panel's
                evidence-backed read appears here. This view is for the hiring team only — a
                real candidate would never see it.
              </p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function scoreNum(s) {
  const m = String(s).match(/(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}

function Scorecard({ data }) {
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <div>
          <div style={S.cardTitle}>Candidate Scorecard</div>
          <div style={S.cardScn}>Scenario · {SCENARIO.name}</div>
        </div>
        <div style={S.signal}>Signal for the panel · not a hiring decision</div>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Competency</th>
            <th style={{ ...S.th, width: 64, textAlign: "center" }}>Score</th>
            <th style={S.th}>Evidence — what they actually said</th>
          </tr>
        </thead>
        <tbody>
          {data.scores.map((row) => {
            const label = (RUBRIC.find((r) => r.key === row.key) || {}).label || row.key;
            const n = scoreNum(row.score);
            return (
              <tr key={row.key}>
                <td style={S.td}><b>{label}</b></td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  <span style={{ ...S.pill, ...(n >= 4 ? S.pillHi : n === 3 ? S.pillMid : n === 0 ? S.pillNs : S.pillLo) }}>
                    {row.score}
                  </span>
                </td>
                <td style={{ ...S.td, color: "#3a3a42", fontStyle: "italic" }}>"{row.evidence}"</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Section title="The curveball moment" accent>
        <p style={S.p}>{data.curveball}</p>
      </Section>

      <div style={S.twocol}>
        <Section title="Strengths">
          <ul style={S.ul}>{data.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
        <Section title="Watch-outs">
          <ul style={S.ul}>{data.watchouts.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Section>
      </div>

      <Section title="Fairness note">
        <p style={S.p}>{data.fairness}</p>
      </Section>

      <Section title="Recommended focus for the next interview">
        <ul style={S.ul}>{data.focus.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </Section>
    </div>
  );
}

function Section({ title, children, accent }) {
  return (
    <div style={{ ...S.section, ...(accent ? S.sectionAccent : {}) }}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

const FALLBACK_SCORECARD = {
  scores: [
    { key: "framing", score: "4/5", evidence: "The real problem isn't three systems, it's that a human reconciles them by hand and the decision is inconsistent." },
    { key: "cuts", score: "4/5", evidence: "I would not build a dashboard first — that's a nice-to-have, not the bottleneck." },
    { key: "workflow", score: "3/5", evidence: "The agent gathers and reconciles, then a human signs the go/no-go." },
    { key: "rai", score: "5/5", evidence: "A wrong 'go' has real downside, so a human has to own the decision before we automate anything." },
    { key: "action", score: "4/5", evidence: "First I'd stand up the read-and-reconcile step on sample data to see if it's even reliable." },
    { key: "comms", score: "3/5", evidence: "Named the accuracy risk but didn't fully spell out assumptions about data quality." },
  ],
  curveball:
    "Handled it well. When the in-tenant constraint landed, the candidate moved to a self-hosted model keeping data inside the boundary, and reasoned about why the rule exists (confidentiality and regulatory exposure) rather than just routing around it. They kept the original goal intact.",
  strengths: [
    "Reframed away from 'automate the decision' toward 'compress reconciliation, human signs off' — unprompted.",
    "Treated a wrong approval as a real cost and put a human gate in before being pushed.",
  ],
  watchouts: [
    "Workflow was a little thin on how exceptions/edge cases get escalated.",
    "Assumptions about data quality across the three systems were left implicit.",
  ],
  fairness:
    "Session ran short (a few exchanges) and the candidate was fairly terse, so scores reflect limited evidence rather than ceiling ability — weight accordingly.",
  focus: [
    "Push on exception handling: what happens when the three systems disagree?",
    "Probe how they'd evaluate whether the reconciliation is accurate enough to trust.",
  ],
};

// ---------------- styles ----------------
const ink = "#16161a";
const ember = "#E8552B";
const emberDim = "#c9421d";
const steel = "#6b7280";
const paper = "#fbfaf8";

const S = {
  shell: { minHeight: "100vh", background: paper, color: ink, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #ececec", background: "#fff", flexWrap: "wrap", gap: 12 },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  anvil: { color: ember, fontSize: 22, letterSpacing: -2 },
  title: { fontWeight: 800, letterSpacing: 3, fontSize: 18, fontFamily: "'Space Grotesk', 'Inter', sans-serif" },
  sub: { fontSize: 12, color: steel, letterSpacing: 0.3 },
  toggle: { display: "flex", background: "#f1f0ee", borderRadius: 10, padding: 3 },
  tab: { border: "none", background: "transparent", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: steel, cursor: "pointer" },
  tabOn: { background: "#fff", color: ink, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  lock: { fontSize: 11, opacity: 0.7 },

  keybar: { display: "flex", alignItems: "center", gap: 10, padding: "8px 24px", background: "#fff7f4", borderBottom: "1px solid #fbe3da" },
  keylabel: { fontSize: 12, fontWeight: 700, color: emberDim, whiteSpace: "nowrap" },
  keyinput: { flex: 1, border: "1px solid #f0d4c9", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, outline: "none", background: "#fff" },
  keyhide: { border: "none", background: "transparent", color: steel, fontSize: 12, cursor: "pointer", textDecoration: "underline" },

  main: { flex: 1, display: "flex", flexDirection: "column", maxWidth: 820, width: "100%", margin: "0 auto", padding: "20px 20px 12px" },
  mainReview: { flex: 1, maxWidth: 880, width: "100%", margin: "0 auto", padding: "24px 20px" },
  scenarioTag: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ember, marginBottom: 10 },

  chat: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, padding: "6px 2px", minHeight: 300 },
  rowL: { display: "flex", justifyContent: "flex-start" },
  rowR: { display: "flex", justifyContent: "flex-end" },
  bubbleAI: { maxWidth: "78%", background: "#fff", border: "1px solid #ececec", borderRadius: "4px 16px 16px 16px", padding: "12px 15px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" },
  bubbleMe: { maxWidth: "78%", background: ink, color: "#fff", borderRadius: "16px 4px 16px 16px", padding: "12px 15px" },
  who: { fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: ember, marginBottom: 5, textTransform: "uppercase" },
  bubbleText: { fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap" },

  composer: { display: "flex", gap: 10, marginTop: 14, alignItems: "flex-end" },
  textarea: { flex: 1, border: "1px solid #e2e2e2", borderRadius: 12, padding: "12px 14px", fontSize: 14.5, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 },
  composerRight: { display: "flex", flexDirection: "column", gap: 6 },
  sendBtn: { background: ink, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  endBtn: { background: ember, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", letterSpacing: 0.3 },
  endDim: { background: "#f0c3b6", cursor: "not-allowed" },
  note: { fontSize: 11.5, color: steel, marginTop: 10, textAlign: "center", fontStyle: "italic" },

  dots: { display: "flex", gap: 4, padding: "4px 0" },

  empty: { textAlign: "center", color: steel, marginTop: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  emptyP: { maxWidth: 420, fontSize: 14, lineHeight: 1.6 },
  lockBig: { fontSize: 40 },
  spinner: { width: 34, height: 34, border: "3px solid #eee", borderTopColor: ember, borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  card: { background: "#fff", border: "1px solid #ececec", borderRadius: 16, padding: 26, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid " + ink, paddingBottom: 14, marginBottom: 18, flexWrap: "wrap", gap: 8 },
  cardTitle: { fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', 'Inter', sans-serif" },
  cardScn: { fontSize: 12.5, color: steel, marginTop: 2 },
  signal: { fontSize: 11, fontWeight: 700, color: emberDim, background: "#fff1ec", border: "1px solid #fbd9cc", borderRadius: 20, padding: "5px 12px" },

  table: { width: "100%", borderCollapse: "collapse", marginBottom: 6 },
  th: { textAlign: "left", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: steel, padding: "8px 8px", borderBottom: "1px solid #eee" },
  td: { padding: "11px 8px", fontSize: 13.5, borderBottom: "1px solid #f3f3f3", verticalAlign: "top", lineHeight: 1.5 },
  pill: { display: "inline-block", minWidth: 38, padding: "3px 8px", borderRadius: 20, fontSize: 12.5, fontWeight: 800, color: "#fff" },
  pillHi: { background: "#1f9d63" },
  pillMid: { background: "#d9a300" },
  pillLo: { background: "#d4453a" },
  pillNs: { background: "#9aa0a6" },

  section: { marginTop: 18 },
  sectionAccent: { background: "#fff7f4", border: "1px solid #fbe3da", borderRadius: 12, padding: "14px 16px" },
  sectionTitle: { fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ember, marginBottom: 8 },
  twocol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 18 },
  p: { fontSize: 14, lineHeight: 1.6, margin: 0, color: "#2a2a30" },
  ul: { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#2a2a30" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
.forge-dot{ width:7px; height:7px; border-radius:50%; background:#E8552B; display:inline-block; animation:blink 1.2s infinite; }
`;
