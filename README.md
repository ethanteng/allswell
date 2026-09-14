# Allswell — session feedback for clinicians

Paste or upload a therapy session transcript to get supervisor-style feedback:
what the clinician did well, what they could improve, and specific transcript
moments behind each observation. Click a citation to jump to the transcript, or
ask a follow-up question about the session.

Built for the Allswell engineering take-home using synthetic session transcripts.
This is a prototype; production considerations are covered in the write-up.

**[Live app](https://allswell-ethan-teng-consulting-llc.vercel.app/app)** ·
**[Project write-up](https://app.notion.com/p/3dbbb8ed8da2805d9263d1687f24c192)** ·
**[Sample transcript](frontend/public/samples/session-01-thanksgiving-boundaries.md)**

This README covers setup and technical reference. The write-up explains where I
focused, the model evaluation, and how I used AI. To try the deployed app,
register an account and paste or upload the sample transcript.

## Contents

- [Running it locally](#running-it-locally)
- [Development commands](#development-commands)
- [How it's organized](#how-its-organized)
- [Key behavior](#key-behavior)
- [API](#api)
- [Deployment](#deployment)
- [AI tools used](#ai-tools-used)

## Running it locally

**Prerequisites:** Node 22+, npm 10+, and PostgreSQL 14+.

```bash
git clone https://github.com/ethanteng/allswell.git
cd allswell
npm run install:all
```

### 1. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

| Variable | Local configuration |
| --- | --- |
| `DATABASE_URL` | Connection string for your Postgres database. |
| `JWT_SECRET` | Secret for signing session tokens. Generate one with `openssl rand -base64 32`. |
| `CORS_ORIGINS` | `http://localhost:3001`, the frontend's browser origin. |
| `ANTHROPIC_API_KEY` | Enables Claude-generated feedback. Leave empty to exercise the app with clearly labeled heuristic placeholder output. |
| `ADMIN_EMAILS` | Optional, comma-separated emails granted admin access on registration. Add your email before registering if you want to edit prompts and model settings at `/admin`. |

If you need a local database and have Docker installed:

```bash
docker run --name allswell-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

Then set this in `backend/.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
```

The [backend environment example](backend/.env.example) also documents optional
workspace and CORS settings. Preview deployment configuration is covered below.

### 2. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

The default `NEXT_PUBLIC_API_URL="http://localhost:3000"` points to the local API.

### 3. Create the schema and start

```bash
npm run db:migrate      # applies the database migrations
npm run db:seed         # creates default prompt config; safe to re-run
npm run dev            # backend on :3000, frontend on :3001
```

Open [http://localhost:3001](http://localhost:3001), register, and paste or upload
the [sample transcript](frontend/public/samples/session-01-thanksgiving-boundaries.md).
With an API key configured, generate feedback, click a cited moment, and ask a
follow-up to explore the main flow. Without a key, the app displays placeholder
output for local development.

Admin access is optional for this flow. If you add an existing account to
`ADMIN_EMAILS` later, re-run `npm run db:seed` to grant it admin access.

## Development commands

Run these from the repository root:

```bash
npm run build               # builds both apps
npm run type-check          # checks TypeScript in both apps
npm test --prefix backend   # citation verification and model guard checks
npm run db:studio           # Prisma Studio for your local database
```

## How it's organized

```text
backend/     NestJS + Prisma + Postgres       -> Render
frontend/    Next.js + Tailwind + Zustand     -> Vercel
render.yaml  Render Blueprint for the API and database
```

The backend owns authentication, transcript access, and model calls. The
frontend provides the client/session workspace, feedback, and transcript views.

The [Prisma schema](backend/prisma/schema.prisma) defines the core entities:

- **User:** the clinician account that owns clients and sessions.
- **Client:** a named grouping for sessions.
- **Session:** a transcript, its title and date, and analysis status.
- **Turn:** either structured analysis feedback or a follow-up question and answer.
- **PromptConfig:** shared, admin-editable analysis and follow-up prompts and model
  settings. Each save increments a version number recorded on generated turns;
  historical prompt text is not retained.

The [default prompts](backend/src/analysis/default-prompts.ts),
[output schema](backend/src/analysis/llm-schema.ts), and
[analysis service](backend/src/analysis/analysis.service.ts) are the main entry
points for understanding how a transcript becomes feedback.

## Key behavior

- **Citation checks:** structured feedback citations are resolved against the
  transcript by timestamp, with quoted-text matching as a fallback. Unresolved
  citations are dropped, as are feedback points with no remaining citations.
  Displayed quotation text and speakers come from the transcript. Follow-up
  prose has a narrower check: unresolved timestamps are flagged in an appended
  note. These checks establish transcript references; they do not validate the
  clinical interpretation. See [citation verification](backend/src/analysis/citations.ts).
- **Computed statistics:** turn counts, questions asked, talk share, and duration
  are derived from the parsed transcript and merged into the model's feedback.
  See [statistics computation](backend/src/analysis/heuristic-analyzer.ts).
- **Placeholder mode:** without an API key, a heuristic analyzer supplies labeled
  placeholder output. It supports local development; use the model path to
  assess feedback quality.
- **Access:** client and session access is scoped to the signed-in user. An
  inaccessible session returns 404. The admin page controls shared prompts and
  model settings for the deployment.
- **Re-analysis:** analysis runs inline with the HTTP request. An explicit re-run
  replaces the analysis and clears its follow-up thread while preserving a
  clinician's custom title. Saving prompt settings affects subsequent model
  calls; it does not automatically re-analyze existing sessions.

## API

All routes except `/health`, `/auth/register`, and `/auth/login` require
`Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `POST` | `/auth/register` · `/auth/login` | Returns `{ token, user }`. |
| `GET` | `/auth/me` | Current user and admin status. |
| `GET` | `/clients` | Clients with their sessions. |
| `POST` · `PATCH` · `DELETE` | `/clients` · `/clients/:id` | Create, rename, delete. Deleting cascades to sessions and turns. |
| `PATCH` | `/clients/:id/session-order` | Reorder sessions using their IDs in the desired order. |
| `GET` | `/sessions/:id` | Session with its transcript and turns. |
| `POST` | `/sessions` | Create from a transcript and run analysis. |
| `POST` | `/sessions/:id/analyze` | Re-run analysis and clear follow-ups. |
| `POST` | `/sessions/:id/turns` | Ask a follow-up question. |
| `PATCH` | `/sessions/:id` | Rename, move to another client, or set the date. |
| `DELETE` | `/sessions/:id` | Delete the session. |
| `GET` · `PUT` | `/admin/config` | Read or update prompts and model settings. Admin only. |

## Deployment

Deploy the API first so its URL is available when configuring the frontend.

### Backend → Render

In Render, choose **New → Blueprint** and select this repository. The
[Blueprint](render.yaml) provisions the API and Postgres, connects `DATABASE_URL`,
and generates `JWT_SECRET`.

Configure these environment variables for the API:

- `ANTHROPIC_API_KEY`: required for model-generated feedback; leaving it empty
  enables the heuristic placeholder.
- `ADMIN_EMAILS`: emails that should receive admin access on registration.
- `CORS_ORIGINS`: the frontend's production origin, with no trailing slash.
- Optional workspace settings are documented in [`.env.example`](backend/.env.example).

For manual setup, use root directory `backend`, build command
`npm run build:render`, start command `npm run start:render`, and health check
`/health`. Database migrations run as part of the start command.

### Frontend → Vercel

Import the repository with **Root Directory** set to `frontend` and the Next.js
framework preset. Only create the frontend project; the API runs on Render.

Set `NEXT_PUBLIC_API_URL` to the Render service URL, without a trailing slash.
This value is embedded at build time, so changing it requires a new deployment.
Once the frontend URL is assigned, add it to the API's `CORS_ORIGINS` setting.

### Preview URLs and first use

The exact CORS allowlist covers only the origins you list. If you use Vercel
preview URLs, optionally set `CORS_ORIGIN_REGEX` on the API, replacing
`your-team` with your own hostname suffix:

```dotenv
CORS_ORIGIN_REGEX=^https://allswell-[a-z0-9-]+-your-team\.vercel\.app$
```

Keep the anchors and scope the expression to your own deployment hostnames.
If browser requests fail on a preview URL, check whether its origin is allowed.

Register with an email in `ADMIN_EMAILS` to access `/admin`. The prompt
configuration is created automatically on first admin page load, so a separate
seed step is not required for a fresh deployment.

## AI tools used

- **ChatGPT:** read the supplied transcripts and drafted a fixed prompt for the
  cross-model evaluation.
- **Claude Code:** implemented most of the application, with architecture and
  product decisions discussed with me and the resulting code reviewed by me.
- **Codex:** independently reviewed each pull request. Separating implementation
  from review provided a fresh assessment; I verified substantive findings and
  decided what to change.
- **Runtime:** Claude generates structured analysis and follow-up answers. The
  application applies the citation checks and computes transcript statistics.

The [project write-up](https://app.notion.com/p/3dbbb8ed8da2805d9263d1687f24c192)
contains the workflow, model-selection rationale, and evaluation artifacts.
