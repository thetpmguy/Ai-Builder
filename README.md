# The Forge — deployable web app

A work-sample simulator that evaluates AI Builder candidates by how they reason under
ambiguity, not by their résumé. This folder is a complete, ready-to-deploy React app.

Built with React + Vite. It compiles to a plain static site (HTML + JS), so it can be hosted
free on GitHub Pages, Netlify, or Vercel. There is no server and no database to run.

---

## Run it on your own computer first (optional, 2 minutes)

You need Node.js installed (https://nodejs.org — the "LTS" version). Then, in a terminal,
inside this folder:

```bash
npm install      # downloads the building blocks (one time)
npm run dev      # starts a local preview
```

It will print a local address like `http://localhost:5173`. Open it in your browser. That's
the app running on your machine. Press `Ctrl + C` in the terminal to stop it.

---

## Put it on GitHub

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**. Name it something like `the-forge`. Keep it **Public** (required
   for free GitHub Pages hosting). Click **Create repository**.
3. Upload this folder's contents. Two ways:
   - **Easiest (no command line):** on the new repo page, click **uploading an existing file**,
     then drag in everything in this folder *except* the `node_modules` and `dist` folders if
     they exist. Commit.
   - **Command line:** in a terminal inside this folder:
     ```bash
     git init
     git add .
     git commit -m "The Forge — initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR-USERNAME/the-forge.git
     git push -u origin main
     ```

---

## Host it (pick ONE)

### Option A — GitHub Pages (free, automatic)
This repo already includes the automation. After your code is on GitHub:
1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. That's it. Every time you push to `main`, it rebuilds and redeploys. Your live link appears
   in **Settings → Pages** (looks like `https://YOUR-USERNAME.github.io/the-forge/`). The first
   build takes ~1 minute — watch progress under the repo's **Actions** tab.

### Option B — Netlify (free, drag-and-drop)
1. Go to https://app.netlify.com → **Add new site → Import an existing project**.
2. Connect GitHub and pick your `the-forge` repo.
3. Netlify auto-detects Vite. If asked: **Build command** `npm run build`, **Publish directory**
   `dist`. Click **Deploy**. You get a live link in under a minute.

### Option C — Vercel (free)
1. Go to https://vercel.com → **Add New → Project** → import your `the-forge` repo.
2. It auto-detects the settings. Click **Deploy**. Live link follows.

---

## Live AI vs. scripted demo

The app works two ways, no configuration needed:

- **Scripted demo (default):** with no API key, the interviewer and scorecard use built-in
  scripted content. The full flow works end to end. This is what a reviewer sees when they open
  your link cold — it never breaks.
- **Live AI:** paste an Anthropic API key into the bar at the top of the app. The interviewer and
  the evaluator then respond live via the Anthropic API. The key stays in the browser for that
  session only and is sent nowhere except the API. Get a key at https://console.anthropic.com.

> Note: the live mode calls the Anthropic API directly from the browser. That's perfect for a
> demo. For real production use you'd route the call through a small backend so the key is never
> in the browser — that's listed in the project notes as a next step.

---

## What's in this folder

```
the-forge/
├── index.html              # page shell
├── package.json            # dependency list + scripts
├── vite.config.js          # build config (relative paths, works on any host)
├── src/
│   ├── main.jsx            # mounts the app
│   └── App.jsx             # THE FORGE — the whole app lives here
├── .github/workflows/
│   └── deploy.yml          # auto-deploy to GitHub Pages
└── .gitignore
```

To change the scenario, the curveball, or the rubric, edit the constants near the top of
`src/App.jsx` (`SCENARIO`, `RUBRIC`). No other changes needed.

---

## How it works (one paragraph)

A candidate opens the link and lands in the **Candidate session**: an interviewer presents a
deliberately ambiguous problem, probes how they scope it, and throws an unexpected governance
constraint at them mid-conversation. When the session ends, the app generates a **Reviewer
scorecard** — an evidence-backed read against six competencies drawn from the job description —
which is for the hiring panel and is never shown to the candidate. The Forge scores *reasoning
under ambiguity*, not credentials, and the scorecard is always a signal for a human decision,
never an automated verdict.
