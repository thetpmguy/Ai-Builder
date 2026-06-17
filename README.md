# The Forge — an AI Builder evaluation harness

*KPMG AI Builder case study · Rahi Kumar*

A work-sample simulator that evaluates AI Builder candidates by watching **how they think
under ambiguity and constraint**, instead of scoring their résumé or their finished work.

---

## Why I reframed the problem

The brief asks for a tool that helps identify strong AI Builder candidates, and invites a
redefinition of "evaluate well" if there's a reason. There is, and the reframe is the core
of this submission.

The trait the job needs — **builder judgment under ambiguity** — is a *behaviour*, not an
artifact. It only shows up while someone is scoping an underspecified problem and deciding
what to cut. A résumé captures claims; a finished take-home captures a polished result.
Neither shows the reasoning. And because this is a role for people who use AI all day, every
candidate will use AI on the take-home — so a clean artifact no longer separates the strong
builder from the strong prompter. Scoring the output scores the one layer AI just made
unreliable.

So I changed the question from *"score the candidate's work"* to:

> **How does a hiring panel reliably observe builder judgment — at the moment AI makes
> outputs untrustworthy — in a way that is fair, auditable, and runs at scale without the
> builder in the room?**

The Forge is my answer. It stops grading outputs and starts instrumenting reasoning.

---

## What it is

The Forge drops a candidate into a deliberately ambiguous, KPMG-flavoured internal problem,
holds a short structured conversation about how they'd approach it, throws an unexpected
governance constraint at them mid-session, and produces a fair, evidence-backed scorecard
for the panel.

Three parts:

1. **The Challenge** — an under-specified internal problem (partners spend hours reconciling
   client-acceptance risk checks across three systems). Vague on purpose — a strong builder
   narrows it before building.
2. **The Conversation** — an interviewer agent probes the candidate's scoping, then injects
   a **curveball** mid-session ("Legal says client data can't leave the firm's tenant — what
   changes?") to test adaptation, which is far harder to fake than vocabulary.
3. **The Reviewer Scorecard** — a second agent scores the *reasoning* against competencies
   drawn from the job description: a score per competency, a supporting quote as evidence, a
   fairness note, and a recommended focus for the next interview.

---

## How to run it

**Option A — just click (recommended for review).** Open `the-forge.html` in any browser.
It works with no install and no key — the AI parts use a built-in **scripted fallback** so a
cold reviewer link always completes.

**Option B — run it live with your own key.** Open the file, paste an Anthropic API key when
prompted, and run a session. The interviewer and scorer now respond live (model:
`claude-opus-4-8`). The key is kept in the browser tab for the session only — never stored,
sent only to `api.anthropic.com`.

No backend, no database, no build step. One file.

---

## The rubric (drawn from the JD)

The scorecard scores reasoning, not prose polish. Each competency maps to a line in the AI
Builder job description.

| Competency | What it rewards | JD source |
|---|---|---|
| Problem framing | Narrowing a vague prompt to the real problem | *"decide what the real problem even is"* |
| Scoping & cut decisions | Choosing what **not** to build under a time cap | *"the choices you make, and the ones you do not"* |
| Workflow & systems thinking | Multi-step design, human-AI handoffs, autonomy boundaries | *"think in workflows, not just models"* |
| Responsible-AI-by-design | Treating risk/governance/trust as a design input, unprompted | *"risk, governance, ethics, trust as core constraints"* |
| Builder bias-to-action | Proposing something concrete and testable | *"make something real, not only describe an idea"* |
| Communication of tradeoffs | Naming assumptions, risks, next steps clearly | *"communicate assumptions, tradeoffs, risks"* |

The rubric, scenarios, weights, and the thrown constraint all live in editable plain-text
objects (`RUBRIC`, `SCENARIOS`, `CONFIG`) at the top of the `<script>` in `the-forge.html`.
A panel can tune weights or add a new challenge without touching the harness logic — it's a
reusable kit, not a one-off.

---

## Responsible-AI design (built in, not bolted on)

- **Human stays the decision-maker.** The Forge is a signal amplifier for a panel, never an
  autonomous gate. No hire/no-hire decision is automated.
- **Scores reasoning, not polish.** The evaluator is prompted to reward decision quality and
  ignore verbosity and writing flair — reducing bias toward fluent or native-English candidates.
- **Identity-blind.** The evaluator sees only the candidate's reasoning, not their name,
  background, or résumé.
- **Auditable.** Every score carries the evidence quote that produced it, so a human can
  inspect and overturn it.
- **Tests adaptation, not keywords.** The curveball checks whether a candidate responds to a
  governance constraint — harder to game than saying the right words.

---

## Architecture notes

- **Hybrid AI over fully-live** — a cold reviewer link must never break, so live AI is the
  upgrade and the scripted path is the floor. Both the interviewer and the scorer degrade
  gracefully to the scripted path if an API call fails mid-session.
- The **curveball is deterministic in both modes** — it's the controlled stimulus, so it's
  always the scenario's governance constraint rather than something the model invents.
- The scorer requests JSON and the harness parses it defensively (direct parse → largest
  brace span) so a stray token never breaks the scorecard.
- The scripted scorer is a transparent, deterministic cue-coverage estimate, clearly labelled
  as illustrative — not dressed up as a model score.

## What I'd build next

A scenario pack with a calibration mode (anchor the scale on a known-strong employee); a
real-repo telemetry track (hand the candidate a small broken agent and read how they debug
and cut scope); grounded context via governed MCP tools in production; and inter-rater
calibration against human reviewers over a cohort.
