# The Forge — an AI Builder evaluation harness

**Live demo:** https://thetpmguy.github.io/Ai-Builder/

The Forge is a small web app that helps a hiring panel see **how a candidate thinks**, instead
of grading a polished résumé or a finished take-home. It drops the candidate into a realistic,
deliberately vague work problem, has a short back-and-forth conversation about how they'd
approach it, throws an unexpected curveball at them halfway through, and then produces a
one-page **scorecard** for the panel.

It runs entirely in the browser — there is no server and no database. You can open it from the
link above, or run it on your own computer in a couple of minutes (instructions below).

---

## Why it exists (the idea in one minute)

The skill this hiring round is testing — *builder judgment under ambiguity* — is a **behaviour**,
not a document. It only shows up while someone is scoping a fuzzy problem and deciding what to
build and what to skip. A résumé lists claims; a finished take-home shows a tidy result. And
because everyone now uses AI on take-homes, a clean output no longer tells you who actually
understands the problem.

So The Forge stops grading the *output* and instruments the *reasoning*. It watches the candidate
narrow the problem, make trade-offs, and react to a constraint they didn't see coming.

---

## What the candidate experiences

1. **The challenge.** They're shown a realistic, under-specified business problem (the built-in
   one is about automating accounts-payable invoice processing). It's vague on purpose.
2. **The conversation.** An "interviewer" asks short questions that push them to define the real
   problem, decide what *not* to build, and say where a human stays in control.
3. **The curveball.** A couple of turns in, the interviewer throws a realistic constraint that
   changes the picture (for the invoice scenario: *the legacy system has no API — the only way in
   is the same screen a clerk uses*). This tests how they adapt, which is much harder to fake than
   saying the right buzzwords.
4. **The wrap-up.** The session ends after a few turns (more on the limits below), and the app
   quietly generates the scorecard.

The candidate only ever sees the conversation. The **scorecard is for the panel** and is never
shown to the candidate.

---

## What the panel gets: the scorecard

A one-page read that scores the candidate's **reasoning** against six competencies taken from the
AI Builder job description:

| Competency | What it rewards |
|---|---|
| Problem framing | Narrowing a vague prompt to the real problem |
| Scoping & cut decisions | Choosing what **not** to build |
| Workflow & systems thinking | Multi-step design, human-in-the-loop, autonomy boundaries |
| Responsible-AI-by-design | Treating risk/governance/trust as a design input |
| Builder bias-to-action | Proposing something concrete and testable |
| Communication of trade-offs | Naming assumptions, risks, and next steps clearly |

Each score comes with a short **quote** as evidence, plus a fairness note and a suggested focus
for the next interview. It's a **signal for a human decision — never an automated hire/no-hire.**

---

## How it works under the hood (the "agents" and the logic)

The app has **two background roles** ("agents"). Each one is just a *system prompt* (a set of
instructions) plus the code that calls the AI model. They are not separate programs — both live in
one file, `src/App.jsx`.

### 1. The Interviewer agent
- **Job:** ask one short, probing question at a time, react to the candidate's last answer, and
  never give away the "right" answer.
- **Logic:** after the candidate's ~2nd answer, the app injects the scenario's **curveball** once.
  Otherwise the interviewer just asks the next question.

### 2. The Evaluator agent
- **Job:** read the whole transcript and score the reasoning against the six competencies, in a
  fixed JSON format, with an evidence quote for each score.
- **Fairness rules baked into its instructions:** it is **identity-blind** (sees only the
  reasoning, not a name or background), it's told to **reward decision quality, not writing polish
  or fluency**, and it must back every score with a quote. It never outputs a hire/no-hire verdict.

### Live mode vs. the "dummy" scripted mode
The app works in two modes, with **no setup required**:

- **Scripted demo (default, no API key).** The two agents are replaced by **built-in canned
  content** — a fixed list of interviewer questions and a pre-written sample scorecard. This is
  the "dummy" logic: it lets anyone open the link cold and walk the full flow end-to-end without a
  key and without it ever breaking. The stall/limit logic (below) still runs.
- **Live AI (you paste a key).** If an Anthropic API key is entered, the interviewer and evaluator
  call a real Claude model (currently **`claude-haiku-4-5`**, the cheapest tier) directly from the
  browser. The key stays in that browser tab only and is sent nowhere except Anthropic's API.

If a live call ever fails (bad key, no credit, rate limit), the app **falls back to the scripted
mode mid-session** instead of erroring out — so a session always completes.

### Session limits (so it can't loop or waste tokens)
The interview automatically ends and jumps to the scorecard when **any** of these happens:
- **Turn cap:** the candidate has given **5** responses.
- **Stall check:** after **4** responses, if answers aren't progressing — a quick heuristic that
  flags very short / low-effort answers or someone repeating themselves.
- **Time cap:** **10 minutes** have passed since the first answer (this fires even if the candidate
  goes idle).

When a limit hits, the interviewer posts a short closing line **with no extra AI call**, so hitting
a limit costs **zero tokens**, and the panel scorecard is generated automatically.

> Note on the stall check: truly judging "is this person on the right track?" would need an AI
> call. To keep things cheap, this is a lightweight rule-of-thumb (answer length + repetition). It
> catches the obvious "going in circles" case, which is the main token-waste risk.

---

## How consistent are the scores?

A fair question — if you run the same transcript twice, do you get the same scores? Here's the
honest answer and what the app does about it.

**Perfect, identical-every-time scoring is not the right goal for a judgment task.** The more you
force an AI evaluator to produce byte-for-byte identical output, the more you turn its nuanced
reading into a rigid checklist — which is exactly the "résumé/keyword scorer" this whole project
moves away from. So the target isn't *identical*, it's **consistent enough to trust and
transparent enough to check.**

What the app does to stay consistent:

- **Temperature 0.** The evaluator runs at `temperature: 0`, which tells the model to pick its
  most-likely answer every time instead of varying. The same transcript then produces near-identical
  scores (think "same score 9 times out of 10," not "anywhere from 3 to 5"). *Note: even at 0,
  models aren't guaranteed perfectly identical — there's tiny unavoidable runtime variation — but
  it's dramatically more stable.*
- **Concrete rubric anchors.** The clearer the definition of what a "5" looks like versus a "3,"
  the less room the model has to wander. Sharper anchors = lower variance.
- **Evidence quotes + a human in the loop.** Every score ships with the quote that produced it. So
  even if a borderline answer scores a 3 on one run and a 4 on another, a human sees the exact
  reasoning and makes the call. **The human is the consistency guarantee, not the model.**

**What I'd add next (left out to keep the demo simple):** score each competency in its own call so
they don't bleed into each other; and run the evaluation a few times and take the median
("self-consistency"). Both improve reliability at the cost of more API calls.

---

## Run it on your own computer (for development)

You need **Node.js** installed first — get the "LTS" version from https://nodejs.org. Then open a
terminal and run:

```bash
# 1. Get the code
git clone https://github.com/thetpmguy/Ai-Builder.git
cd Ai-Builder

# 2. Install the dependencies (one time)
npm install

# 3. Start a local preview
npm run dev
```

The last command prints a local address like `http://localhost:5173`. Open it in your browser —
that's the app running on your machine. Press `Ctrl + C` in the terminal to stop it.

To create the optimized files you'd actually deploy:

```bash
npm run build      # outputs a static site into the dist/ folder
npm run preview    # serves that built site locally so you can check it
```

That's the whole setup. No server, no database, no API key required to run it.

---

## Use the app (either mode)

- **No key →** leave the key box empty and click **Begin / Send**. You get the scripted demo.
- **Live AI →** paste an Anthropic API key (`sk-ant-…`) into the bar at the top, then run a session.
  - Get a key at https://console.anthropic.com (this is a **separate, pay-as-you-go API account** —
    a Claude.ai Pro/Max chat subscription does **not** work here and cannot be used).
  - The key lives only in your browser tab and is sent only to Anthropic.

⚠️ **If you share a public link, do NOT hard-code your own API key into the app** — anyone could
read it and run up your bill. Public visitors should use the free scripted demo, or paste *their
own* key.

---

## Host it for free (so others can use it)

This repo already deploys to **GitHub Pages** automatically. After the code is on GitHub:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Done. Every push to `main` rebuilds and republishes. The live link looks like
   `https://YOUR-USERNAME.github.io/REPO-NAME/`.

Prefer no settings step? Import the repo into **Vercel** (https://vercel.com) or **Netlify**
(https://app.netlify.com) — both auto-detect Vite (build command `npm run build`, output folder
`dist`) and give you a public URL in about a minute.

---

## Project structure

```
Ai-Builder/
├── index.html                 # the page shell
├── package.json               # dependencies + npm scripts
├── vite.config.js             # build config (relative paths, works on any host)
├── src/
│   ├── main.jsx               # mounts the app into the page
│   └── App.jsx                # THE FORGE — the whole app lives here
├── .github/workflows/
│   └── deploy.yml             # auto-deploy to GitHub Pages on every push to main
└── .gitignore
```

---

## Make it your own (no deep coding needed)

Everything a panel would tune lives as plain-text constants near the top of **`src/App.jsx`**:

| You want to change… | Edit this constant |
|---|---|
| The problem scenario + the curveball | `SCENARIO` |
| The six competencies / their JD wording | `RUBRIC` |
| The scripted (dummy) interviewer questions | `FALLBACK_INTERVIEWER` |
| The sample scorecard shown in demo mode | `FALLBACK_SCORECARD` |
| The interviewer / evaluator instructions | `SYSTEM_INTERVIEWER`, `SYSTEM_EVALUATOR` |
| Turn limit / stall threshold / time limit | `MAX_TURNS`, `SOFT_TURNS`, `TIME_LIMIT_MS` |
| Which Claude model live mode uses | the `model` field in `callClaude` |

Save the file and the local preview (`npm run dev`) updates instantly.

---

## Responsible-AI notes

- **A human stays the decision-maker.** The output is a signal for a panel, not an automated gate.
- **Scores reasoning, not polish** — to reduce bias toward fluent or native-English candidates.
- **Identity-blind** — the evaluator sees only the reasoning.
- **Auditable** — every score carries the quote that produced it, so a human can overturn it.
- **Tests adaptation** (the curveball), which is harder to game than keywords.

---

## A note on production

Live mode calls the Anthropic API directly from the browser, which is perfect for a demo. For real
production use you'd put a small backend in front so the API key never lives in the browser, add
session storage, and ground the scenarios in real (sanitized) company context. Those are
deliberately left out here to keep the demo a single, zero-setup static site.
