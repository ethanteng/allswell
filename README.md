# Allswell — session feedback for clinicians

Paste a therapy session transcript, get the kind of feedback a senior clinician
gives a colleague after sitting in: what worked, what to try differently, every
point tied to the moment in the session it came from.

> **Status: UI/UX pass.** The interface, data model, and API are complete and
> working end to end. The Anthropic call is **not wired up yet** — analysis is
> produced by a placeholder analyser that parses the transcript and cites real
> lines from it. Every screen that shows generated feedback says so. See
> [What's stubbed](#whats-stubbed).

---

## Contents

- [Running it locally](#running-it-locally)
- [What's stubbed](#whats-stubbed)
- [How it's organised](#how-its-organised)
- [API](#api)
- [Deployment](#deployment)
- [Direction and decisions](#direction-and-decisions)
- [AI tools used](#ai-tools-used)

---

## Running it locally

**Prerequisites:** Node 22+, npm 10+, and a PostgreSQL 14+ you can connect to.

```bash
git clone <this repo>
cd allswell
npm run install:all
```

### 1. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `JWT_SECRET` | Signs session tokens. `openssl rand -base64 32`. |
| `ADMIN_EMAILS` | Comma-separated. These emails get admin rights on registration, which is what unlocks `/admin`. **Put your own email here** or you won't be able to open the admin page. |
| `CORS_ORIGINS` | Comma-separated browser origins. `http://localhost:3001` for local dev. |
| `CORS_ORIGIN_REGEX` | Optional. Regex for origins that can't be listed ahead of time — see [below](#a-note-on-cors-and-preview-deployments). Unset means exact allowlist only. |

No Postgres handy? This works:

```bash
docker run --name allswell-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# then use: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
```

### 2. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

The default (`NEXT_PUBLIC_API_URL="http://localhost:3000"`) is correct for local dev.

### 3. Create the schema and start

```bash
npm run db:migrate     # creates the tables
npm run db:seed        # seeds the default prompt config (idempotent)
npm run dev            # backend on :3000, frontend on :3001
```

Open **http://localhost:3001**, register with the email you put in
`ADMIN_EMAILS`, and click **Use sample transcript** to see it work.

### Other commands

```bash
npm run build          # production build, both apps
npm run type-check     # tsc --noEmit, both apps
npm run db:studio      # Prisma Studio against your local database
```

---

## What's stubbed

Everything below the feedback text is real: real Postgres rows, real auth, real
CRUD, real prompt configuration. The **content** of the feedback is not from a
model yet.

**`backend/src/analysis/heuristic-analyser.ts`** parses the transcript into
speaker turns and runs keyword detectors over the clinician's lines. Each
detector that fires produces a feedback card citing the lines that matched. So
the citations are genuine quotes at genuine timestamps, and the response UI is
exercised with real data — but the reasoning behind which cards appear is
pattern matching, not clinical judgement. Output is stamped
`generatedBy: "heuristic-stub"` and the UI renders a warning wherever it appears.

This was deliberate: a plausible-sounding fake about a clinical session is worse
than an obviously fake one, especially in a demo.

**To wire up the real call**, replace the two blocks marked `TODO(llm)` in
`backend/src/analysis/analysis.service.ts`. Both already read the live prompt
configuration — the configured model and prompt version are recorded on every
turn today — so the surrounding plumbing doesn't change. The analysis call
should be constrained to emit the `SessionFeedback` shape in
`backend/src/analysis/feedback.types.ts`, which is what the response pane renders.

Two things to change at the same time:

- Analysis currently runs **inline** on the request. With a real model call it
  should move to a queue; the `ANALYZING` status already exists in the schema
  for the UI to poll on.
- `maxTokens` defaults to 8000 and a 45-minute transcript is a large input —
  stream the response rather than waiting on one long request.

---

## How it's organised

```
backend/     NestJS + Prisma + Postgres          -> Render
frontend/    Next.js (App Router) + Tailwind     -> Vercel
             + Zustand
render.yaml  Blueprint for the API and database
```

### Data model

```
User ─┬─ Client ── Session ── Turn
      └─ Session
```

- **Client** — a person the clinician sees. Just a name; sessions group under it.
- **Session** — one transcript plus its feedback. Moving a session between
  clients is a write to `clientId` and nothing else, which is why turns hang off
  the session rather than the client.
- **Turn** — one exchange. The `ANALYSIS` turn holds structured feedback as
  JSON; `FOLLOW_UP` turns hold a question and a markdown answer. Both live in
  one table so the response pane renders them as a single ordered thread.
- **PromptConfig** — a singleton row holding the admin-editable prompts and
  model. Its `version` increments on every save and is stamped onto each turn,
  so you can always tell which prompt produced which feedback.

### Notable behaviour

- **Sessions are titled from the transcript.** The literal opening line is always
  a greeting or an audio check, so `deriveTitle` skips the first 90 seconds and
  prefers the agenda-setting turn ("last time we ended with…"). Clinicians can
  rename anything.
- **Re-running an analysis clears the follow-up thread.** Those answers were
  written against feedback that no longer exists.
- **Every query is scoped by `userId`**, so "not yours" and "does not exist"
  are indistinguishable — both return 404.

---

## API

All routes except `/health`, `/auth/register`, and `/auth/login` require
`Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `POST` | `/auth/register` · `/auth/login` | Returns `{ token, user }`. |
| `GET` | `/auth/me` | Current user; re-read so a revoked admin flag takes effect. |
| `GET` | `/clients` | The sidebar tree: clients with their sessions. |
| `POST` · `PATCH` · `DELETE` | `/clients` · `/clients/:id` | Create, rename, delete. Deleting cascades to sessions and turns. |
| `GET` | `/sessions/:id` | One session with its transcript and turns. |
| `POST` | `/sessions` | Create from a transcript and run the first analysis. |
| `POST` | `/sessions/:id/analyze` | Re-run. Replaces the analysis, clears follow-ups. |
| `POST` | `/sessions/:id/turns` | Ask a follow-up. |
| `PATCH` | `/sessions/:id` | Rename, **move to another client**, or set the date. |
| `DELETE` | `/sessions/:id` | Delete. |
| `GET` · `PUT` | `/admin/config` | Prompts and model. Admin only (403 otherwise). |

---

## Deployment

Two services. Deploy the API first — the frontend needs its URL.

### Backend → Render

The repo includes `render.yaml`. In Render: **New → Blueprint**, point it at
this repo. It provisions the web service and a Postgres instance, wires
`DATABASE_URL`, and generates `JWT_SECRET`.

Set these in the dashboard afterwards:

- `ADMIN_EMAILS` — your email, so you can open `/admin`.
- `CORS_ORIGINS` — your Vercel production URL (no trailing slash). The browser
  cannot reach the API until this is right.
- `CORS_ORIGIN_REGEX` — optional but recommended; see below.

Migrations run on boot via `npm run start:render`, so a schema change ships with
the deploy that needs it.

To set up by hand instead: root directory `backend`, build
`npm run build:render`, start `npm run start:render`, health check `/health`.

### Frontend → Vercel

Import the repo and set **Root Directory** to `frontend`. Framework preset
(Next.js), build command, and output directory are all detected.

Set one environment variable:

- `NEXT_PUBLIC_API_URL` — your Render service URL, e.g.
  `https://allswell-api.onrender.com`, no trailing slash.

It's baked in at build time, so changing it needs a redeploy.

### A note on CORS and preview deployments

Vercel gives every deployment its own hashed hostname — `allswell-a1b2c3d4-your-team.vercel.app`
for a production build's immutable URL, `allswell-git-branch-your-team.vercel.app`
for a branch preview. Only the stable production alias is predictable, so an
exact allowlist covers that one and nothing else.

Open the app on any other deployment URL and the preflight fails. The UI shows
a bare "NetworkError when attempting to fetch resource", which reads like the
API is down rather than a policy answer — it took a browser console to see the
real cause the first time.

`CORS_ORIGIN_REGEX` covers the rest. Scope it to your own team, not all of
`vercel.app`:

```
CORS_ORIGIN_REGEX=^https://allswell-[a-z0-9-]+-your-team\.vercel\.app$
```

The anchors matter. Without `^` and `$` this would also match
`https://allswell-x-your-team.vercel.app.attacker.com`.

### After first deploy

Register with an email in `ADMIN_EMAILS`. The prompt config row is created
automatically on first admin page load, so no seed step is required in
production.

---

## Direction and decisions

The brief left scope open and capped effort at two hours. I spent it on **the
workflow around the feedback rather than the feedback itself**, on the
assumption that prompt quality is the part that iterates fastest once the
surface it plugs into is real.

**Feedback is a thread, not a report.** The largest call. A one-shot
transcript-in-critique-out tool is a smaller build, but a supervisor
conversation doesn't end at the writeup — the useful part is "say more about the
camera thing." So a session holds an analysis turn plus any number of follow-up
turns, and the model gets the transcript and its own prior feedback on each one.

**Every point cites the moment it came from.** The sample transcript makes the
case: its most interesting material is a rupture-and-repair arc spread across
the whole session — the clinician arrives off-camera unannounced `[0:14]`, the
client names it as odd `[0:07]`, it resurfaces when he cries and can't see her
face `[27:07]`, and she repairs it with an explicit process commitment
`[34:52]`, `[42:34]`. A "Strengths / Areas to improve" bullet list flattens
that into nothing. So feedback points carry quoted moments with timestamps, and
clicking one jumps to the transcript tab and highlights the line. That
constraint runs all the way down: it's in the default prompt ("a point you
cannot evidence is a point you should drop"), in the `SessionFeedback` type, and
in the placeholder analyser, which only emits a card when it has lines to cite.

**Clients are a grouping, not a record.** Sessions need somewhere to live, but
this is a supervision tool, not an EHR. A client is a name, and the whole model
is "sessions group under one." Filing is deferred: paste a transcript with no
client selected and one is created named "New client" — decide later, rename
whenever, move sessions between clients from a menu.

**The prompt is configuration, not code.** Prompt quality is where the next
hours go, and a deploy per iteration is the wrong loop. The admin page edits
both prompts and the model live; saving bumps a version that's stamped on every
turn, so "which prompt produced this?" is always answerable, and **Re-run** on
a session re-analyses it under the new one. Admin is gated by `isAdmin`, set
from an env allowlist rather than self-service, so nobody can register their way
into editing the prompt behind everyone's feedback.

**Auth, which the brief said wasn't required.** Even with synthetic transcripts
the shape of the thing is clinical records, and a tool holding them with no
login models the wrong thing. It's the minimum that works — email, password,
JWT, every query scoped by `userId` — and it makes the privacy conversation
concrete rather than hypothetical.

### What I'd do next, in order

1. **Wire the Anthropic call** (the two `TODO(llm)` blocks), with structured
   outputs constraining the response to `SessionFeedback` so the UI contract
   holds.
2. **Move analysis to a queue** and stream, per [What's stubbed](#whats-stubbed).
3. **Prompt iteration** against several of the ten transcripts, using the admin
   page and Re-run to compare versions on the same session.
4. **Evaluation**, which the current design is set up for: the same transcript
   re-run under two prompt versions is a comparison you can look at. A rubric
   over a handful of transcripts would tell you whether a prompt change actually
   helped rather than just reading differently.

### On privacy and scale

Not built here, but the shape it's built in:

- Transcripts cross exactly one service boundary, so encryption at rest for
  `Session.transcript`, an access audit log, and a retention policy all have one
  obvious place to live.
- Scoping is already per-clinician. Supervisor access across clinicians is the
  first real authorisation problem, and it's a genuine one.
- The current schema stores transcripts indefinitely. Real deployment needs a
  retention window and a hard delete that reaches turns and any provider-side
  logs.
- Zero-data-retention on the model provider is table stakes for real PHI; so is
  a BAA.

---

## AI tools used

Built with **Claude Code** (Opus), working from the assignment PDF and the
sample transcript in a single session.

How it was used:

- **Design decisions were made in conversation before any code.** I chose the
  architecture, the session/turn model, the auth posture, and the stub-first
  approach; Claude argued for some of them and against others. It pushed back on
  using Express over NestJS given the stack the brief named, and flagged that
  the scope I'd chosen exceeded the two-hour cap, which is why that's stated
  plainly above rather than left implicit.
- **The UI direction came from an existing product of mine** —
  [Ask Linc](https://github.com/ethanteng/finsight) — which Claude read directly
  to pull the left-nav grouping pattern and the composer/response layout, then
  adapted: decisions became clients, turns became sessions.
- **Implementation was largely Claude-written**, reviewed by me. The
  rupture-and-repair reading of the sample transcript, and the argument that
  citation-linked feedback was the thing worth building the response pane
  around, came from Claude reading the transcript.
- **Verified by running it, not by assertion.** The API was exercised end to end
  against a real Postgres (auth, CRUD, move, re-run, admin config), the
  authorisation boundaries were probed with a second non-admin account, and the
  UI was driven with Playwright. That surfaced three real bugs: the auto-title
  picked the greeting instead of the agenda-setting turn, the placeholder
  analyser had false-positive citations that didn't support their claims, and
  the mobile layout rendered the logo twice.
