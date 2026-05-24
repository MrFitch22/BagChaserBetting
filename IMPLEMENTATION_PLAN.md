# Sharp Edge — Implementation Plan v2
> Updated to include: Position Matchup Analyzer · Parlay Intelligence Report · Pick Accountability Hub · VS Code workspace setup

---

## Table of Contents

1.  [VS Code Workspace Setup](#1-vs-code-workspace-setup)
2.  [POC Components — What We Built](#2-poc-components--what-we-built)
3.  [Tech Stack](#3-tech-stack)
4.  [Monorepo Structure](#4-monorepo-structure)
5.  [Environment Setup](#5-environment-setup)
6.  [Database Schema](#6-database-schema)
7.  [Phase 1 — Foundation](#7-phase-1--foundation-weeks-12)
8.  [Phase 2 — Data Pipeline](#8-phase-2--data-pipeline-weeks-34)
9.  [Phase 3 — Intelligence Engine](#9-phase-3--intelligence-engine-weeks-56)
10. [Phase 3.5 — Matchup & Position Intelligence](#10-phase-35--matchup--position-intelligence-weeks-67)
11. [Phase 4 — User Platform](#11-phase-4--user-platform-weeks-78)
12. [Phase 5 — Monetization Layer](#12-phase-5--monetization-layer-weeks-910)
13. [Phase 6 — Production Hardening](#13-phase-6--production-hardening-weeks-1112)
14. [API Endpoint Reference](#14-api-endpoint-reference)
15. [Third-Party Integrations](#15-third-party-integrations)
16. [Deployment Checklist](#16-deployment-checklist)
17. [Cost Estimates](#17-cost-estimates)
18. [Quick Reference Build Order](#18-quick-reference-build-order)

---

## 1. VS Code Workspace Setup

### Recommended Extensions

Create `.vscode/extensions.json` at repo root:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "ms-python.black-formatter",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens",
    "github.copilot",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "mikestead.dotenv",
    "mongodb.mongodb-vscode",
    "ckolkman.vscode-postgres",
    "redhat.vscode-yaml",
    "yoavbls.pretty-ts-errors",
    "biomejs.biome",
    "unifiedjs.vscode-mdx",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [100],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true
  },
  "[typescript]":  { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.workingDirectories": [
    "apps/web",
    "apps/mobile",
    "services/api",
    "services/social-scraper",
    "packages/shared",
    "packages/ui"
  ],
  "python.defaultInterpreterPath": "./services/scoring/.venv/bin/python",
  "files.exclude": {
    "**/node_modules": true,
    "**/.turbo": true,
    "**/.next": true,
    "**/dist": true,
    "**/__pycache__": true,
    "**/.pytest_cache": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "terminal.integrated.env.osx": {
    "PATH": "${workspaceFolder}/node_modules/.bin:${env:PATH}"
  }
}
```

### Debug Launch Configurations

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js — Web App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/web/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/apps/web",
      "env": { "NODE_ENV": "development" },
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "openExternally"
      }
    },
    {
      "name": "Fastify API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/services/api",
      "console": "integratedTerminal",
      "env": { "NODE_ENV": "development" }
    },
    {
      "name": "Python Scoring — FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8001"],
      "cwd": "${workspaceFolder}/services/scoring",
      "env": { "PYTHONPATH": "${workspaceFolder}/services/scoring" },
      "console": "integratedTerminal"
    },
    {
      "name": "Python Ingestion — Worker",
      "type": "debugpy",
      "request": "launch",
      "program": "${workspaceFolder}/services/ingestion/worker.py",
      "cwd": "${workspaceFolder}/services/ingestion",
      "console": "integratedTerminal"
    },
    {
      "name": "Social Scraper",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/services/social-scraper",
      "console": "integratedTerminal"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack — All Services",
      "configurations": [
        "Next.js — Web App",
        "Fastify API",
        "Python Scoring — FastAPI"
      ],
      "stopAll": true
    }
  ]
}
```

### Task Runner

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev — All",
      "type": "shell",
      "command": "pnpm dev",
      "group": { "kind": "build", "isDefault": true },
      "presentation": { "panel": "new" }
    },
    {
      "label": "DB — Run Migrations",
      "type": "shell",
      "command": "pnpm db:migrate",
      "group": "build"
    },
    {
      "label": "DB — Seed Dev Data",
      "type": "shell",
      "command": "pnpm db:seed",
      "group": "build"
    },
    {
      "label": "Docker — Start Infrastructure",
      "type": "shell",
      "command": "docker-compose up -d",
      "group": "build",
      "presentation": { "panel": "shared" }
    },
    {
      "label": "Docker — Stop Infrastructure",
      "type": "shell",
      "command": "docker-compose down",
      "group": "build"
    },
    {
      "label": "Test — All",
      "type": "shell",
      "command": "pnpm test",
      "group": { "kind": "test", "isDefault": true }
    },
    {
      "label": "Type Check — All",
      "type": "shell",
      "command": "pnpm typecheck",
      "group": "test"
    },
    {
      "label": "Lint — All",
      "type": "shell",
      "command": "pnpm lint",
      "group": "test"
    },
    {
      "label": "Python — Install Dependencies",
      "type": "shell",
      "command": "cd services/scoring && python -m venv .venv && .venv/bin/pip install -r requirements.txt",
      "group": "build"
    }
  ]
}
```

### Workspace File

Create `sharp-edge.code-workspace` at root for multi-root workspace support:

```json
{
  "folders": [
    { "name": "Root", "path": "." },
    { "name": "Web App", "path": "apps/web" },
    { "name": "Mobile", "path": "apps/mobile" },
    { "name": "API Service", "path": "services/api" },
    { "name": "Scoring Engine", "path": "services/scoring" },
    { "name": "Ingestion", "path": "services/ingestion" },
    { "name": "Social Scraper", "path": "services/social-scraper" },
    { "name": "Shared Types", "path": "packages/shared" },
    { "name": "UI Library", "path": "packages/ui" }
  ],
  "settings": {},
  "extensions": {
    "recommendations": []
  }
}
```

---

## 2. POC Components — What We Built

Three production-ready components live in `/poc` at the repo root. Drop them into the correct paths before starting Phase 4.

### Component Map

| File | Drop Into | Purpose |
|---|---|---|
| `pick-tracker.jsx` | `apps/web/components/accountability/AccountabilityHub.tsx` | Pick seller leaderboard, fraud detection, seller detail view |
| `matchup-analyzer.jsx` | `apps/web/components/matchup/MatchupAnalyzer.tsx` | Position-by-position matchup grades, transaction impact, radar view |
| `parlay-intelligence.jsx` | `apps/web/components/parlay/ParlayIntelligence.tsx` | Per-leg matchup evidence, signal breakdown, parlay narrative |

### Migration Checklist for Each Component

When moving from POC to production, replace the following in each file:

```
MOCK DATA ARRAYS  →  API calls via React Query (useQuery hooks)
useState for data →  server state from /api/* endpoints
Hardcoded odds    →  real-time odds from Redis via WebSocket
Mock sellers      →  PostgreSQL query via GET /api/sellers
Mock transactions →  PostgreSQL query via GET /api/transactions
Mock matchups     →  scoring service via GET /api/matchups/:gameId
```

### Shared POC Dependencies to Add

```json
// Add to apps/web/package.json
{
  "dependencies": {
    "recharts": "^2.12.0",
    "lucide-react": "^0.383.0",
    "@fontsource/syne": "^5.0.0",
    "@fontsource/dm-mono": "^5.0.0",
    "socket.io-client": "^4.7.0"
  }
}
```

---

## 3. Tech Stack

### Frontend
| Layer | Technology | Why |
|---|---|---|
| Web app | Next.js 14 (App Router) | SSR, SEO, API routes in one repo |
| Mobile | Expo (React Native) | iOS + Android from shared codebase |
| State | Zustand + React Query | Lightweight global state + server cache |
| Realtime UI | Socket.io client | Live odds and game updates |
| Charts | Recharts | Parlay probability, ROI curves, radar charts |
| Auth | Clerk | Drop-in auth, handles JWT and sessions |
| Payments | Stripe.js | Subscriptions and pick package checkout |
| Styling | Tailwind CSS | Utility-first, consistent design system |
| Animation | Framer Motion | Matchup reveal, intelligence panel transitions |

### Backend
| Layer | Technology | Why |
|---|---|---|
| Main API | Node.js + Fastify | Fast REST + WebSocket server |
| ML / Scoring | Python + FastAPI | Scoring engine, matchup grader, data pipeline |
| Job queue | BullMQ + Redis | Scheduled ingestion and matchup recalc jobs |
| Real-time | Socket.io | Live game events push to clients |
| Auth middleware | Clerk SDK | Shared auth across services |
| API gateway | Kong (production) | Rate limiting, key management, B2B licensing |

### Data
| Layer | Technology | Why |
|---|---|---|
| Primary DB | PostgreSQL (Supabase) | Relational data, Row Level Security |
| Time-series | TimescaleDB extension | Efficient odds history and grade history queries |
| Cache | Redis (Upstash) | Real-time odds, matchup grades, session data |
| Search | PostgreSQL full-text | Pick, seller, and player search |
| Object storage | Cloudflare R2 | Parlay intelligence exports, reports, assets |

### ML / Data Science
| Layer | Technology | Why |
|---|---|---|
| Models | scikit-learn + XGBoost | Confidence scoring, matchup grading, live prediction |
| NLP | Claude API | Sentiment analysis, pick extraction, transaction impact |
| Data transforms | dbt | Normalized stats and grade pipeline |
| Orchestration | Temporal.io | Reliable scheduled workflows |
| Experiment tracking | MLflow | Model versioning and matchup grade calibration |

---

## 4. Monorepo Structure

```
sharp-edge/
├── .vscode/
│   ├── extensions.json
│   ├── settings.json
│   ├── launch.json
│   └── tasks.json
│
├── poc/                                # POC components (migrate to apps/web in Phase 4)
│   ├── pick-tracker.jsx                # → accountability/AccountabilityHub.tsx
│   ├── matchup-analyzer.jsx            # → matchup/MatchupAnalyzer.tsx
│   └── parlay-intelligence.jsx         # → parlay/ParlayIntelligence.tsx
│
├── apps/
│   ├── web/                            # Next.js 14 web app
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx          # Sidebar + nav shell
│   │   │   │   ├── page.tsx            # Dashboard / top edges feed
│   │   │   │   ├── parlay/
│   │   │   │   │   ├── page.tsx        # Parlay builder
│   │   │   │   │   └── [id]/page.tsx   # Saved parlay + intelligence report
│   │   │   │   ├── matchup/
│   │   │   │   │   ├── page.tsx        # Game selector landing
│   │   │   │   │   └── [gameId]/page.tsx # Full matchup analyzer
│   │   │   │   ├── accountability/
│   │   │   │   │   ├── page.tsx        # Pick seller leaderboard
│   │   │   │   │   └── [handle]/page.tsx # Seller profile
│   │   │   │   ├── live/page.tsx       # Live games tracker
│   │   │   │   └── account/page.tsx    # Billing + settings
│   │   │   ├── api/
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── stripe/route.ts
│   │   │   │   │   └── clerk/route.ts
│   │   │   │   └── og/route.tsx        # Open Graph image generation
│   │   │   └── layout.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Base primitives (Button, Badge, Card, etc.)
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── index.ts
│   │   │   ├── accountability/
│   │   │   │   ├── AccountabilityHub.tsx     # ← FROM POC pick-tracker.jsx
│   │   │   │   ├── SellerDetail.tsx
│   │   │   │   ├── FraudBanner.tsx
│   │   │   │   ├── TierBadge.tsx
│   │   │   │   └── PickHistoryTable.tsx
│   │   │   ├── matchup/
│   │   │   │   ├── MatchupAnalyzer.tsx       # ← FROM POC matchup-analyzer.jsx
│   │   │   │   ├── PositionRow.tsx
│   │   │   │   ├── PlayerCard.tsx
│   │   │   │   ├── AdvantageMeter.tsx
│   │   │   │   ├── TransactionCard.tsx
│   │   │   │   └── MatchupRadar.tsx
│   │   │   ├── parlay/
│   │   │   │   ├── ParlayBuilder.tsx         # Parlay leg constructor
│   │   │   │   ├── ParlayIntelligence.tsx    # ← FROM POC parlay-intelligence.jsx
│   │   │   │   ├── LegIntelligenceCard.tsx
│   │   │   │   ├── SignalBreakdown.tsx
│   │   │   │   ├── MatchupEvidenceCard.tsx
│   │   │   │   ├── ProbabilityGauge.tsx
│   │   │   │   └── ParlayNarrative.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── EdgeFeed.tsx
│   │   │   │   ├── EdgeCard.tsx
│   │   │   │   └── SharpMoveAlert.tsx
│   │   │   └── live/
│   │   │       ├── LiveGameCard.tsx
│   │   │       └── LiveParlayTracker.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useParlay.ts             # Parlay leg state + probability
│   │   │   ├── useMatchup.ts            # Matchup data for a game
│   │   │   ├── useOdds.ts               # Real-time odds via WebSocket
│   │   │   ├── useSellers.ts            # Accountability hub data
│   │   │   └── useLiveGame.ts           # Live score + probability feed
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                   # Typed API client
│   │   │   ├── affiliate.ts             # Deep-link builder
│   │   │   ├── odds.ts                  # American odds helpers
│   │   │   └── matchup.ts               # Matchup score helpers
│   │   │
│   │   └── package.json
│   │
│   └── mobile/
│       ├── app/
│       │   ├── (tabs)/
│       │   │   ├── index.tsx            # Dashboard
│       │   │   ├── parlay.tsx           # Parlay builder (simplified)
│       │   │   ├── matchup.tsx          # Matchup analyzer (mobile layout)
│       │   │   ├── picks.tsx            # Accountability hub
│       │   │   └── live.tsx             # Live games
│       │   └── _layout.tsx
│       └── package.json
│
├── services/
│   ├── api/                             # Node.js + Fastify main API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── sellers.ts
│   │   │   │   ├── picks.ts
│   │   │   │   ├── odds.ts
│   │   │   │   ├── parlays.ts
│   │   │   │   ├── games.ts
│   │   │   │   ├── matchups.ts          # NEW — position matchup routes
│   │   │   │   ├── transactions.ts      # NEW — transaction impact routes
│   │   │   │   ├── intelligence.ts      # NEW — parlay intelligence routes
│   │   │   │   └── users.ts
│   │   │   ├── websocket/
│   │   │   │   ├── live-games.ts
│   │   │   │   ├── odds-stream.ts
│   │   │   │   └── matchup-stream.ts    # NEW — live matchup grade updates
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── tier.ts
│   │   │   └── db/
│   │   │       ├── client.ts
│   │   │       └── schema.ts
│   │   └── package.json
│   │
│   ├── scoring/                         # Python FastAPI scoring engine
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routers/
│   │   │   │   ├── confidence.py
│   │   │   │   ├── parlay.py
│   │   │   │   ├── live.py
│   │   │   │   ├── matchup.py           # NEW — position matchup grader
│   │   │   │   └── intelligence.py      # NEW — parlay intelligence builder
│   │   │   ├── models/
│   │   │   │   ├── player_trends.py
│   │   │   │   ├── sharp_money.py
│   │   │   │   ├── sentiment.py
│   │   │   │   ├── live_predictor.py
│   │   │   │   ├── position_matchup.py  # NEW — per-position advantage scorer
│   │   │   │   └── transaction_impact.py # NEW — grade delta calculator
│   │   │   └── data/
│   │   │       ├── fetchers.py
│   │   │       ├── cache.py
│   │   │       └── ngs_client.py        # NEW — NFL Next Gen Stats client
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── ingestion/
│   │   ├── pipelines/
│   │   │   ├── stats_pipeline.py
│   │   │   ├── odds_pipeline.py
│   │   │   ├── news_pipeline.py
│   │   │   ├── results_pipeline.py
│   │   │   ├── grades_pipeline.py       # NEW — player grade ingestion (NGS / PFF)
│   │   │   └── transactions_pipeline.py # NEW — offseason transaction ingestion
│   │   ├── workflows/
│   │   │   ├── stats_workflow.py
│   │   │   ├── odds_workflow.py
│   │   │   ├── verify_workflow.py
│   │   │   ├── grades_workflow.py       # NEW
│   │   │   └── matchup_workflow.py      # NEW — recompute matchups on roster changes
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── social-scraper/
│       ├── src/
│       │   ├── scrapers/
│       │   │   ├── twitter.ts
│       │   │   ├── instagram.ts
│       │   │   └── tiktok.ts
│       │   ├── extractors/
│       │   │   ├── pick-parser.ts
│       │   │   ├── transaction-parser.ts # NEW — extract trades/signings from news
│       │   │   └── account-profiler.ts
│       │   └── jobs/
│       │       ├── scan-job.ts
│       │       ├── verify-job.ts
│       │       └── transaction-job.ts   # NEW — scan for transaction announcements
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   └── src/
│   │       └── types/
│   │           ├── seller.ts
│   │           ├── pick.ts
│   │           ├── game.ts
│   │           ├── odds.ts
│   │           ├── parlay.ts
│   │           ├── matchup.ts           # NEW
│   │           ├── transaction.ts       # NEW
│   │           └── intelligence.ts      # NEW
│   │
│   └── ui/
│       └── src/
│           ├── TierBadge.tsx
│           ├── ResultPill.tsx
│           ├── ConfidenceBar.tsx
│           ├── ROIChart.tsx
│           ├── AdvantageMeter.tsx       # NEW — reusable matchup meter
│           ├── SignalBar.tsx            # NEW — signal contribution bar
│           └── index.ts
│
├── infrastructure/
│   ├── docker-compose.yml
│   └── .github/workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── sharp-edge.code-workspace
├── .env.example
├── turbo.json
└── package.json
```

---

## 5. Environment Setup

### Prerequisites
```bash
node >= 20.0.0
python >= 3.11
pnpm >= 9.0.0
docker + docker-compose
```

### First-time Setup
```bash
# 1. Clone and install all dependencies
git clone https://github.com/your-org/sharp-edge
cd sharp-edge
pnpm install

# 2. Open the workspace file in VS Code
code sharp-edge.code-workspace

# 3. Install recommended VS Code extensions when prompted
# (VS Code will show a notification — click "Install All")

# 4. Set up environment variables
cp .env.example .env.local

# 5. Start local infrastructure (Postgres + Redis)
docker-compose up -d

# 6. Set up Python virtual environment
cd services/scoring && python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..

# 7. Run database migrations
pnpm db:migrate

# 8. Seed development data (includes mock matchups + transactions)
pnpm db:seed

# 9. Start all services
pnpm dev
```

### Service Ports (local)

| Service | Port | URL |
|---|---|---|
| Next.js web | 3000 | http://localhost:3000 |
| Fastify API | 3001 | http://localhost:3001 |
| Python scoring | 8001 | http://localhost:8001/docs |
| Python ingestion | 8002 | http://localhost:8002/docs |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

### Required Environment Variables

```bash
# ─── Database ────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/sharpedge
REDIS_URL=redis://localhost:6379

# ─── Auth ────────────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# ─── Payments ────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SHARP=price_...

# ─── Sports Data ─────────────────────────────────────────────────
SPORTSRADAR_API_KEY=...
ODDS_API_KEY=...
MYSPORTSFEEDS_API_KEY=...
NFL_NGS_API_KEY=...                  # NFL Next Gen Stats (free via NFL developer program)
BASKETBALL_REFERENCE_KEY=...         # Sports Reference API (NBA stats)
BASEBALL_SAVANT_KEY=...              # Statcast / Baseball Savant
PFF_API_KEY=...                      # Pro Football Focus (optional premium grades)

# ─── Social Media ────────────────────────────────────────────────
TWITTER_BEARER_TOKEN=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
INSTAGRAM_ACCESS_TOKEN=...
TIKTOK_CLIENT_KEY=...

# ─── AI / NLP ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ─── News ────────────────────────────────────────────────────────
NEWS_API_KEY=...

# ─── Affiliate ───────────────────────────────────────────────────
DRAFTKINGS_AFFILIATE_ID=...
FANDUEL_AFFILIATE_ID=...
BETMGM_AFFILIATE_ID=...

# ─── Infrastructure ──────────────────────────────────────────────
SENTRY_DSN=https://...
POSTHOG_KEY=phc_...
AXIOM_TOKEN=...
CLOUDFLARE_R2_BUCKET=...
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
```

---

## 6. Database Schema

### Core Tables (from v1 — unchanged)

```sql
CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_id  VARCHAR(64) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  sport         VARCHAR(32) NOT NULL,
  team          VARCHAR(64),
  position      VARCHAR(32),
  status        VARCHAR(32) DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE games (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   VARCHAR(64) UNIQUE NOT NULL,
  sport         VARCHAR(32) NOT NULL,
  league        VARCHAR(32) NOT NULL,
  home_team     VARCHAR(64) NOT NULL,
  away_team     VARCHAR(64) NOT NULL,
  game_time     TIMESTAMPTZ NOT NULL,
  venue         VARCHAR(128),
  status        VARCHAR(32) DEFAULT 'scheduled',
  home_score    INT,
  away_score    INT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- TimescaleDB hypertable for odds history
CREATE TABLE odds_history (
  id            UUID DEFAULT gen_random_uuid(),
  game_id       UUID REFERENCES games(id),
  book          VARCHAR(64) NOT NULL,
  market        VARCHAR(64) NOT NULL,
  label         VARCHAR(128),
  price         INT NOT NULL,
  point         NUMERIC(5,1),
  is_opening    BOOLEAN DEFAULT FALSE,
  captured_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, captured_at)
);
SELECT create_hypertable('odds_history', 'captured_at');

CREATE TABLE confidence_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID REFERENCES games(id),
  market          VARCHAR(64) NOT NULL,
  label           VARCHAR(128) NOT NULL,
  score           NUMERIC(5,2) NOT NULL,
  player_trend    NUMERIC(5,2),
  sharp_money     NUMERIC(5,2),
  sentiment       NUMERIC(5,2),
  schedule_edge   NUMERIC(5,2),
  pick_tracker    NUMERIC(5,2),
  matchup_signal  NUMERIC(5,2),         -- NEW: position matchup contribution
  model_version   VARCHAR(32),
  computed_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### New Tables — Player Grades & Matchup Engine

```sql
-- ─── Player performance grades ───────────────────────────────────
CREATE TABLE player_grades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID REFERENCES players(id),
  sport           VARCHAR(32) NOT NULL,
  season          VARCHAR(16) NOT NULL,       -- "2024", "2024-25"
  week            INT,                         -- NULL for season totals
  source          VARCHAR(32) NOT NULL,        -- ngs | pff | bref | savant
  -- Universal grade fields
  overall_grade   NUMERIC(5,2),               -- 0-100 composite grade
  offense_grade   NUMERIC(5,2),
  defense_grade   NUMERIC(5,2),
  -- NFL-specific
  pff_grade       NUMERIC(5,2),
  epa_per_play    NUMERIC(6,4),
  cpoe            NUMERIC(6,4),               -- Completion% over expected
  pressure_rate   NUMERIC(5,3),
  separation_yds  NUMERIC(5,2),
  route_win_pct   NUMERIC(5,3),
  yac_per_rec     NUMERIC(5,2),
  pass_block_grade NUMERIC(5,2),
  run_block_grade  NUMERIC(5,2),
  run_stop_pct    NUMERIC(5,3),
  tackle_eff      NUMERIC(5,3),
  cover_grade     NUMERIC(5,2),
  yds_per_tgt_allowed NUMERIC(5,2),
  -- NBA-specific
  true_shooting   NUMERIC(5,3),
  ast_pct         NUMERIC(5,3),
  def_rating      NUMERIC(6,2),
  on_off_net      NUMERIC(6,2),
  -- MLB-specific
  era             NUMERIC(5,2),
  fip             NUMERIC(5,2),
  woba            NUMERIC(6,4),
  xwoba           NUMERIC(6,4),
  -- Metadata
  raw_data        JSONB,                      -- full source payload
  captured_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_grades_lookup
  ON player_grades(player_id, sport, season, source);

-- ─── Position matchup analysis ───────────────────────────────────
CREATE TABLE position_matchups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID REFERENCES games(id),
  position_group  VARCHAR(64) NOT NULL,      -- "QB", "WR vs Secondary", "RB vs LBs"
  category        VARCHAR(32) NOT NULL,      -- passing | rushing | protection | coverage
  offense_team    VARCHAR(8) NOT NULL,
  defense_team    VARCHAR(8) NOT NULL,
  -- Advantage score: positive = offense advantage, negative = defense advantage
  advantage_score NUMERIC(6,2) NOT NULL,
  -- Per-player breakdown stored as JSONB arrays
  offense_players JSONB NOT NULL,            -- [{player_id, name, pos, grade, metrics}]
  defense_players JSONB NOT NULL,
  -- Confidence contribution
  conf_delta      NUMERIC(5,2),             -- how much this group shifts confidence score
  -- Narrative
  key_battle      TEXT,
  model_version   VARCHAR(32),
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, position_group, offense_team)
);

CREATE INDEX idx_position_matchups_game ON position_matchups(game_id);

-- ─── Offseason transactions ──────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID REFERENCES players(id),
  player_name     VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(32) NOT NULL,     -- trade | signing | extension | cut | draft
  from_team       VARCHAR(64),
  to_team         VARCHAR(64) NOT NULL,
  position        VARCHAR(32),
  sport           VARCHAR(32) NOT NULL,
  contract_details VARCHAR(255),
  announced_at    TIMESTAMPTZ NOT NULL,
  -- Impact scoring
  impact_score    NUMERIC(6,2),             -- net effect on to_team grades (+/-)
  impact_team     VARCHAR(64),
  affected_position_groups JSONB,           -- ["WR vs Secondary", "OL vs DL"]
  -- Grade deltas: grade BEFORE and AFTER transaction
  grade_before    NUMERIC(5,2),
  grade_after     NUMERIC(5,2),
  -- AI-generated analysis
  analysis        TEXT,
  source_url      VARCHAR(512),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_sport_date ON transactions(sport, announced_at DESC);
CREATE INDEX idx_transactions_team ON transactions(to_team, sport);

-- ─── Parlay intelligence reports ─────────────────────────────────
CREATE TABLE parlay_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id       UUID REFERENCES user_parlays(id),
  -- Per-leg breakdown stored as JSONB
  legs            JSONB NOT NULL,           -- full intelligence per leg
  -- Aggregate scores
  total_matchup_delta  NUMERIC(6,2),       -- sum of all matchup contributions
  total_tx_delta       NUMERIC(6,2),       -- sum of all transaction impacts
  correlation_factor   NUMERIC(5,4),       -- parlay leg correlation adjustment
  -- Narratives
  parlay_narrative     TEXT,               -- full brief text
  risk_summary         TEXT,
  -- Metadata
  model_version        VARCHAR(32),
  generated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Users (unchanged) ───────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        VARCHAR(128) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  username        VARCHAR(64) UNIQUE,
  tier            VARCHAR(32) DEFAULT 'free',
  stripe_id       VARCHAR(128),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_parlays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  legs            JSONB NOT NULL,
  combined_prob   NUMERIC(5,2),
  book_implied    NUMERIC(5,2),
  edge_score      NUMERIC(5,2),
  payout_odds     INT,
  status          VARCHAR(32) DEFAULT 'saved',
  sportsbook      VARCHAR(64),
  placed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Pick tracker (unchanged) ────────────────────────────────────
CREATE TABLE social_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          VARCHAR(128) NOT NULL,
  platform        VARCHAR(32) NOT NULL,
  profile_url     VARCHAR(512),
  followers       INT DEFAULT 0,
  tier            VARCHAR(32) DEFAULT 'unverified',
  trust_score     NUMERIC(5,2) DEFAULT 0,
  verified_w      INT DEFAULT 0,
  verified_l      INT DEFAULT 0,
  verified_roi    NUMERIC(7,2),
  claimed_roi     NUMERIC(7,2),
  is_fraud        BOOLEAN DEFAULT FALSE,
  tracking_since  TIMESTAMPTZ DEFAULT NOW(),
  last_active     TIMESTAMPTZ,
  UNIQUE(handle, platform)
);

CREATE TABLE tracked_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID REFERENCES social_accounts(id),
  game_id         UUID REFERENCES games(id),
  post_url        VARCHAR(512),
  post_content    TEXT,
  sport           VARCHAR(32),
  bet_type        VARCHAR(64),
  bet_label       VARCHAR(256),
  odds_at_post    INT,
  closing_odds    INT,
  posted_at       TIMESTAMPTZ NOT NULL,
  result          VARCHAR(16),
  units_returned  NUMERIC(6,3),
  clv             NUMERIC(6,3),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracked_picks_account ON tracked_picks(account_id, posted_at DESC);
CREATE INDEX idx_tracked_picks_pending ON tracked_picks(result) WHERE result = 'pending';
```

---

## 7. Phase 1 — Foundation (Weeks 1–2)

**Goal:** Monorepo running in VS Code, auth working, database live, all services scaffolded.

- [ ] Run `pnpm dlx create-turbo@latest .` and configure workspace
- [ ] Create `.vscode/` folder with all four config files from Section 1
- [ ] Create `sharp-edge.code-workspace` and open it
- [ ] Install all recommended extensions from `extensions.json`
- [ ] Configure `docker-compose.yml` with Postgres + Redis + TimescaleDB
- [ ] Provision Supabase project, enable TimescaleDB extension
- [ ] Write all Drizzle migrations from the schema in Section 6
- [ ] Integrate Clerk into Next.js, protect `/dashboard` routes
- [ ] Sync Clerk user webhook → `users` table
- [ ] Fastify server with health check, auth middleware, error handling
- [ ] Redis client connected and tested
- [ ] Write seed script: 20 mock games, 50 players, 8 sellers, 5 transactions
- [ ] Confirm all five services start with `pnpm dev`
- [ ] Confirm all VS Code debug launch configs work (F5 for any service)

---

## 8. Phase 2 — Data Pipeline (Weeks 3–4)

**Goal:** Real odds, stats, grades, and transactions flowing into the database.

- [ ] The Odds API client with retry + delta detection
- [ ] `odds_history` hypertable writing on every line movement
- [ ] SportsRadar stats client — player logs, rosters, injuries
- [ ] Universal player ID mapping across all sources
- [ ] **NFL Next Gen Stats client** — separation yards, route win rate, EPA, pressure rate
- [ ] **Basketball Reference API** — true shooting, assist rate, on/off ratings
- [ ] **Baseball Savant** — xwOBA, exit velocity, spin rate, Statcast metrics
- [ ] `grades_pipeline.py` — normalize grades from all sources into `player_grades`
- [ ] `transactions_pipeline.py`:
  - Monitor Rotowire and ESPN transactions feed (hourly)
  - Claude API: extract structured transaction data from news text
  - Write to `transactions` table with impact score
  - Trigger matchup recompute job when transaction affects a game within 30 days
- [ ] Social scraper: pick extraction, timestamp lock, result verification
- [ ] News pipeline: sentiment scores per player/team

```python
# services/ingestion/pipelines/transactions_pipeline.py

TRANSACTION_EXTRACT_PROMPT = """
Extract transaction details from this sports news article.
Return JSON only:
{
  "has_transaction": boolean,
  "player_name": string,
  "transaction_type": "trade"|"signing"|"extension"|"cut"|"draft",
  "from_team": string | null,
  "to_team": string,
  "position": string,
  "sport": "NFL"|"NBA"|"MLB"|"NHL",
  "contract_details": string | null,
  "impact_analysis": string  // 2-3 sentences on betting impact
}

Article: {{ARTICLE_TEXT}}
"""
```

---

## 9. Phase 3 — Intelligence Engine (Weeks 5–6)

**Goal:** All six scoring signals computing. Confidence scores live for all active markets.

### Signal Weights (Updated — 6 signals)

```python
WEIGHTS = {
    "player_trend":    0.22,
    "sharp_money":     0.20,
    "matchup_signal":  0.18,   # NEW — position matchup advantage
    "sentiment":       0.15,
    "schedule_edge":   0.13,
    "pick_tracker":    0.12,
}
```

### Tasks

- [ ] Player trend model (10-game rolling, matchup grade, home/away, rest)
- [ ] Sharp money detector (reverse line movement, steam move detection, CLV)
- [ ] Sentiment AI (Claude API per player/team, -1 to +1 score)
- [ ] Schedule edge model (rest days, travel miles, back-to-backs, altitude)
- [ ] Pick tracker signal (verified sharp handicappers converging on a side)
- [ ] Parlay probability engine with correlation adjustment
- [ ] Edge finder (+EV detection, CLV benchmark, arbitrage scan)
- [ ] Trust tier assignment for pick sellers
- [ ] Fraud detection (claimed vs verified ROI delta >20pts → flag)

---

## 10. Phase 3.5 — Matchup & Position Intelligence (Weeks 6–7)

**Goal:** Position matchup grades computing for all games. Parlay intelligence reports generating. Transaction impacts linked to confidence scores.

### Position Matchup Grader

```python
# services/scoring/app/models/position_matchup.py

POSITION_GROUPS = {
    "NFL": [
        { "id": "qb",      "label": "Quarterback",          "category": "passing",    "off": ["QB"],     "def": ["EDGE","DT","LB"] },
        { "id": "wr_sec",  "label": "WR / TE vs Secondary", "category": "passing",    "off": ["WR","TE"],"def": ["CB","S"] },
        { "id": "rb_run",  "label": "RB vs Run Defense",    "category": "rushing",    "off": ["RB"],     "def": ["DT","LB"] },
        { "id": "ol_dl",   "label": "OL vs Pass Rush",      "category": "protection", "off": ["OL"],     "def": ["EDGE","DT"] },
    ],
    "NBA": [
        { "id": "pg",      "label": "Point Guard",          "category": "perimeter",  "off": ["PG"],     "def": ["PG"] },
        { "id": "wing",    "label": "Wing matchup",         "category": "perimeter",  "off": ["SG","SF"],"def": ["SG","SF"] },
        { "id": "big",     "label": "Frontcourt",           "category": "interior",   "off": ["PF","C"], "def": ["PF","C"] },
    ],
    "MLB": [
        { "id": "sp_off",  "label": "Starting pitcher",     "category": "pitching",   "off": ["SP"],     "def": ["lineup"] },
        { "id": "bull",    "label": "Bullpen",              "category": "pitching",   "off": ["RP"],     "def": ["lineup"] },
    ]
}

def compute_position_advantage(
    game_id: str,
    position_group: dict,
    offense_team: str,
    defense_team: str
) -> PositionMatchupResult:

    offense_players = get_starters(offense_team, position_group["off"])
    defense_players = get_starters(defense_team, position_group["def"])

    offense_grade = aggregate_grades(offense_players, mode="offense")
    defense_grade = aggregate_grades(defense_players, mode="defense")

    # Head-to-head matchup adjustment based on style compatibility
    scheme_factor = compute_scheme_compatibility(
        offense_team, defense_team, position_group["category"]
    )

    advantage = (offense_grade - defense_grade) * scheme_factor

    return PositionMatchupResult(
        position_group=position_group["id"],
        advantage_score=round(advantage, 2),
        offense_players=offense_players,
        defense_players=defense_players,
        conf_delta=advantage_to_confidence_delta(advantage),
        key_battle=generate_key_battle_text(offense_players, defense_players)
    )
```

### Transaction Impact Calculator

```python
# services/scoring/app/models/transaction_impact.py

def compute_transaction_impact(transaction_id: str) -> TransactionImpact:
    tx = db.get_transaction(transaction_id)
    player = db.get_player(tx.player_id)

    # Get grade BEFORE transaction (last known grade for from_team)
    grade_before = db.get_player_grade(tx.player_id, team=tx.from_team)

    # Project grade AFTER transaction (player grade in new system)
    scheme_fit = compute_scheme_fit(player, tx.to_team)
    grade_after = grade_before.overall_grade * scheme_fit

    # Find all upcoming games within 60 days where this affects a matchup
    affected_games = db.get_upcoming_games(
        teams=[tx.to_team, tx.from_team],
        within_days=60
    )

    # Queue matchup recompute jobs for affected games
    for game in affected_games:
        queue.add("recompute-matchup", {
            "game_id": game.id,
            "position_group": tx.affected_position_groups,
            "reason": f"transaction:{transaction_id}"
        })

    return TransactionImpact(
        impact_score=grade_after - grade_before.overall_grade,
        grade_before=grade_before.overall_grade,
        grade_after=grade_after,
        affected_games=len(affected_games)
    )
```

### Parlay Intelligence Builder

```python
# services/scoring/app/routers/intelligence.py

@router.get("/api/parlays/{parlay_id}/intelligence")
async def get_parlay_intelligence(parlay_id: str, user=Depends(auth)):
    parlay = db.get_parlay(parlay_id)

    leg_intelligence = []
    for leg in parlay.legs:
        matchups = db.get_position_matchups(leg.game_id)
        transactions = db.get_transactions_affecting_game(leg.game_id, days_back=90)

        # Compute which matchups support or contradict this bet
        supporting = filter_relevant_matchups(matchups, leg.market, leg.team)
        relevant_tx = filter_relevant_transactions(transactions, leg.team, leg.market)

        signals = compute_all_signals(leg)

        narrative = await generate_leg_narrative(leg, supporting, relevant_tx, signals)
        risk = await generate_risk_assessment(leg, supporting, relevant_tx)

        leg_intelligence.append(LegIntelligence(
            leg=leg,
            matchup_evidence=supporting,
            transactions=relevant_tx,
            signals=signals,
            narrative=narrative,
            key_risk=risk,
            net_matchup_delta=sum(m.conf_delta for m in supporting),
            net_tx_delta=sum(t.impact_score for t in relevant_tx),
        ))

    correlation = compute_parlay_correlation(parlay.legs)
    parlay_narrative = await generate_parlay_narrative(leg_intelligence, correlation)

    return ParlayIntelligenceReport(
        parlay_id=parlay_id,
        legs=leg_intelligence,
        correlation_factor=correlation,
        parlay_narrative=parlay_narrative,
        total_matchup_delta=sum(l.net_matchup_delta for l in leg_intelligence),
    )
```

### Phase 3.5 Task Checklist

- [ ] `position_matchup.py` model — grade aggregation per position group
- [ ] `ngs_client.py` — NFL Next Gen Stats API wrapper (separation, route win rate, EPA)
- [ ] Per-sport position group definitions (NFL, NBA, MLB configs)
- [ ] Scheme compatibility matrix (zone vs man coverage, power vs spread run game)
- [ ] `transaction_impact.py` — grade delta computation + game recompute trigger
- [ ] `intelligence.py` router — assembles full parlay intelligence report
- [ ] Claude API prompts for key battle text and leg narratives
- [ ] `position_matchups` table writing on every game compute
- [ ] Redis cache for matchup grades (1-hour TTL, invalidated on transaction)
- [ ] BullMQ job: recompute affected matchups within 5 minutes of transaction import
- [ ] `GET /api/matchups/:gameId` — full position matchup breakdown
- [ ] `GET /api/matchups/:gameId/transactions` — transactions affecting this game
- [ ] `GET /api/parlays/:id/intelligence` — full intelligence report
- [ ] Matchup signal feeds into confidence score (18% weight)

---

## 11. Phase 4 — User Platform (Weeks 7–8)

**Goal:** All three POC components live with real data. Full user flow working end-to-end.

### Migrate POC Components

```bash
# Copy POC files to component directories
cp poc/pick-tracker.jsx          apps/web/components/accountability/AccountabilityHub.tsx
cp poc/matchup-analyzer.jsx      apps/web/components/matchup/MatchupAnalyzer.tsx
cp poc/parlay-intelligence.jsx   apps/web/components/parlay/ParlayIntelligence.tsx
```

Then for each file, replace mock data with real API calls:

```typescript
// Before (POC — mock data)
const SELLERS = [ { id: 1, handle: "SharpEdge_Jay", ... } ];

// After (production — real API)
const { data: sellers, isLoading } = useQuery({
  queryKey: ["sellers", { tier: tierFilter, search }],
  queryFn: () => api.get(`/sellers?tier=${tierFilter}&q=${search}`),
});
```

### Hook Implementations

```typescript
// apps/web/hooks/useMatchup.ts
export function useMatchup(gameId: string) {
  return useQuery({
    queryKey: ["matchup", gameId],
    queryFn: () => api.get<PositionMatchup[]>(`/matchups/${gameId}`),
    staleTime: 5 * 60 * 1000,   // 5-min cache — matchups are stable
    enabled: !!gameId,
  });
}

// apps/web/hooks/useParlayIntelligence.ts
export function useParlayIntelligence(parlayId: string) {
  return useQuery({
    queryKey: ["parlay-intelligence", parlayId],
    queryFn: () => api.get<ParlayIntelligenceReport>(`/parlays/${parlayId}/intelligence`),
    enabled: !!parlayId,
    staleTime: 2 * 60 * 1000,
  });
}

// apps/web/hooks/useParlay.ts
export function useParlay() {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  const queryClient = useQueryClient();

  const probability = useQuery({
    queryKey: ["parlay-probability", legs],
    queryFn: () => api.post("/parlays/probability", { legs }),
    enabled: legs.length > 0,
    refetchInterval: 30_000,
  });

  const addLeg = (leg: ParlayLeg) => {
    setLegs(prev => [...prev, leg]);
    queryClient.invalidateQueries({ queryKey: ["parlay-probability"] });
  };

  return { legs, addLeg, removeLeg: (id) => setLegs(p => p.filter(l => l.id !== id)), probability };
}
```

### Page Routes to Build

```
/matchup                 → game selector, shows all upcoming games + matchup confidence
/matchup/[gameId]        → full MatchupAnalyzer for that game with all position groups
/parlay                  → ParlayBuilder + live probability sidebar
/parlay/[id]             → saved parlay + full ParlayIntelligence report
/accountability          → AccountabilityHub leaderboard
/accountability/[handle] → seller profile + pick history
```

### Task Checklist

- [ ] Migrate all three POC components and replace mock data with API hooks
- [ ] Build `useMatchup`, `useParlayIntelligence`, `useParlay`, `useSellers` hooks
- [ ] Dashboard edge feed with confidence scores and matchup highlights
- [ ] Parlay builder UI — add leg from edge feed, live probability meter
- [ ] Intelligence panel auto-opens when parlay has 2+ legs
- [ ] Matchup analyzer game selector page
- [ ] Accountability hub connected to real `social_accounts` table
- [ ] Seller profile page with chart (replace mock `genROICurve` with real picks data)
- [ ] Live games page with WebSocket connection
- [ ] Transaction impact feed showing recent moves + affected confidence scores
- [ ] `SharpMoveAlert` banner on dashboard when major line move detected
- [ ] Mobile app: simplified versions of all above screens

---

## 12. Phase 5 — Monetization Layer (Weeks 9–10)

**Goal:** Subscriptions, affiliate routing, and pick marketplace live.

### Feature Gating by Tier

| Feature | Free | Pro ($19/mo) | Sharp ($49/mo) |
|---|---|---|---|
| Edge feed | 3/day | Unlimited | Unlimited |
| Confidence scores | Hidden | Full | Full |
| Parlay builder | 2 legs | Unlimited | Unlimited |
| Intelligence report | Summary only | Full | Full |
| **Matchup analyzer** | Top-level only | Full breakdown | Full breakdown |
| **Transaction feed** | Headlines only | Full impact scores | Full impact scores |
| Pick tracker | View only | Full access | Full access |
| Sharp money alerts | — | — | Real-time |
| Live game model | — | — | Full |
| API access | — | — | 1,000 calls/mo |

### Tasks

- [ ] Stripe Pro + Sharp products with correct feature flags
- [ ] `requireTier` middleware gating matchup breakdown and intelligence reports
- [ ] Affiliate deep-link builder with sportsbook pre-filled parlay routing
- [ ] Click tracking → `affiliate_clicks` table
- [ ] Pick package marketplace (certified sellers only)
- [ ] Stripe Connect for seller payouts (platform takes 25%)

---

## 13. Phase 6 — Production Hardening (Weeks 11–12)

**Goal:** Secure, performant, legally compliant, ready for real users.

### Security
- [ ] Supabase Row Level Security on all user tables
- [ ] Rate limiting: 100/min free · 1000/min pro · 5000/min sharp
- [ ] Zod input validation on all endpoints
- [ ] CORS locked to production domains only
- [ ] Secrets rotation documented and scheduled

### Legal & Compliance
- [ ] Terms of Service — analytics platform, not a sportsbook
- [ ] Privacy Policy — CCPA + GDPR compliant
- [ ] "For informational purposes only" disclaimers on all scored content
- [ ] Age gate 21+ on signup with state geo-restrictions
- [ ] Review all upstream data licenses before B2B API launch
- [ ] Legal review of pick seller accountability feature (truth in advertising)
- [ ] Consult gambling attorney before production launch

### Performance
- [ ] Next.js ISR for edge feed (revalidate: 60s), static for seller profiles
- [ ] Redis caching for matchup grades (1hr TTL) and confidence scores (5min TTL)
- [ ] `EXPLAIN ANALYZE` on all slow queries, add missing indexes
- [ ] Load test with k6 — target 1,000 concurrent users
- [ ] CDN caching for static assets

### Monitoring
- [ ] Sentry in all services
- [ ] PostHog funnel: landing → signup → parlay build → affiliate click
- [ ] Uptime monitoring with PagerDuty alerts
- [ ] Matchup recompute job failure alerting

---

## 14. API Endpoint Reference

```
# ── Games & Odds ──────────────────────────────────────────────────
GET  /api/games                         → upcoming + live games with matchup preview
GET  /api/games/:id                     → single game with odds
GET  /api/games/:id/odds-history        → line movement history
GET  /api/odds/top-movements            → biggest moves in last 6h

# ── Confidence Scoring (Pro+) ─────────────────────────────────────
GET  /api/scores/:gameId/:market        → full confidence score with signal breakdown
GET  /api/scores/top-edges              → today's top edges, sorted by confidence
GET  /api/scores/:gameId/:market/signals → per-signal contribution breakdown

# ── Position Matchup Analyzer (Pro+) ─────────────────────────────
GET  /api/matchups/:gameId              → all position groups for a game
GET  /api/matchups/:gameId/:group       → single position group detail
GET  /api/matchups/:gameId/transactions → transactions affecting this game's matchups
GET  /api/matchups/:gameId/radar        → radar chart data (all group scores)

# ── Transaction Intelligence ──────────────────────────────────────
GET  /api/transactions                  → recent transactions (sport, team, date filters)
GET  /api/transactions/:id              → single transaction with full impact data
GET  /api/transactions/:id/affected-games → games affected by this transaction
GET  /api/transactions/team/:team       → all transactions for a team this offseason

# ── Parlay Builder & Intelligence ─────────────────────────────────
POST /api/parlays/probability           → compute adjusted probability for leg set
POST /api/parlays                       → save parlay
GET  /api/parlays                       → user's saved parlays
GET  /api/parlays/:id                   → single parlay
GET  /api/parlays/:id/intelligence      → full intelligence report (Pro+)
GET  /api/parlays/:id/live              → live probability for active parlay
PATCH /api/parlays/:id                  → update legs

# ── Accountability Hub ────────────────────────────────────────────
GET  /api/sellers                       → leaderboard (tier, sport, platform filters)
GET  /api/sellers/:handle               → seller profile + verified stats
GET  /api/sellers/:handle/picks         → pick history paginated
GET  /api/sellers/:handle/badge         → embeddable trust badge (public)
GET  /api/sellers/fraud-alerts          → recently exposed accounts

# ── Users ─────────────────────────────────────────────────────────
GET  /api/users/me                      → current user + tier
POST /api/subscriptions/create          → create Stripe subscription
POST /api/subscriptions/cancel          → cancel subscription
GET  /api/users/me/parlays              → parlay history

# ── Affiliate ─────────────────────────────────────────────────────
POST /api/affiliate/click               → log click + return deep-link URL

# ── WebSocket Events ──────────────────────────────────────────────
ws: odds:update                         → real-time odds movement
ws: game:score                          → score update during game
ws: sharp:alert                         → sharp money move detected
ws: matchup:update                      → matchup grade changed (transaction effect)
ws: parlay:probability                  → live probability for active slip
ws: transaction:new                     → new offseason transaction announced
```

---

## 15. Third-Party Integrations

| Service | Purpose | Est. Cost/mo | Sign-up |
|---|---|---|---|
| SportsRadar | Player stats, schedules, live scores | $500–$2,000 | sportsradar.com/marketplace |
| The Odds API | Odds across 40+ books | $0–$150 | the-odds-api.com |
| NFL Next Gen Stats | Separation yds, route win%, EPA, pressure | Free | nfl.com/developers |
| Basketball Reference | NBA advanced stats, on/off splits | $0–$50 | sports-reference.com/api |
| Baseball Savant | xwOBA, exit velo, spin rate, Statcast | Free | baseballsavant.mlb.com |
| PFF (optional) | Premium NFL player grades | $2,000–$5,000 | pff.com/subscriptions |
| Anthropic (Claude) | Sentiment, pick extraction, narratives | $50–$300 | console.anthropic.com |
| NewsAPI + Rotowire | Sports news, transaction feed | $0–$499 | newsapi.org |
| Twitter/X API | Social pick monitoring | $100 (Basic) | developer.x.com |
| Instagram Graph API | Public post monitoring | Free (rate limited) | developers.facebook.com |
| TikTok Research API | Public video + caption monitoring | Free | developers.tiktok.com |
| Clerk | Auth | $0–$25 | clerk.com |
| Supabase | PostgreSQL + realtime | $0–$25 | supabase.com |
| Upstash | Redis | $0–$30 | upstash.com |
| Stripe | Payments | 2.9% + 30¢/txn | stripe.com |
| Vercel | Frontend hosting | $0–$20 | vercel.com |
| Railway | API + Python hosting | $20–$100 | railway.app |
| Sentry | Error monitoring | $0–$26 | sentry.io |

**MVP total (without PFF): $100–$800/mo**
**With PFF grades: $2,100–$5,800/mo** — defer PFF until post-launch when revenue justifies it. NFL NGS covers most of the same metrics for free and is sufficient for a strong MVP.

---

## 16. Deployment Checklist

### Pre-deploy
- [ ] All env vars set in Vercel + Railway dashboards
- [ ] Database migrations run on production Supabase
- [ ] TimescaleDB extension enabled on production database
- [ ] Stripe + Clerk webhooks registered for production URLs
- [ ] CORS locked to production domains
- [ ] Sentry DSN in all services

### Deploy Order
```bash
1. pnpm db:migrate --env production
2. railway up --service api
3. railway up --service scoring
4. railway up --service ingestion
5. railway up --service social-scraper
6. vercel --prod
7. Smoke test: /api/health, /api/games, /api/sellers
8. Enable BullMQ jobs via Railway env var: JOBS_ENABLED=true
9. Monitor Sentry + Axiom for 30 minutes
```

### CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: railway up --service api --token=${{ secrets.RAILWAY_TOKEN }}
      - run: railway up --service scoring --token=${{ secrets.RAILWAY_TOKEN }}
```

---

## 17. Cost Estimates

### MVP (0–1,000 users)
| Item | Monthly |
|---|---|
| SportsRadar trial | $0–$500 |
| NFL NGS + BBRef + Savant | $0 |
| The Odds API (starter) | $0 |
| Claude API | ~$50 |
| Infrastructure (Vercel + Railway + Supabase + Upstash) | $65 |
| Clerk + Stripe | $0 (usage-based) |
| Social media APIs | $100 (Twitter Basic) |
| **Total** | **~$215–$715/mo** |

### Growth (1,000–10,000 users)
| Item | Monthly |
|---|---|
| SportsRadar standard | $1,000–$2,000 |
| NFL NGS + stats sources | $50 |
| The Odds API pro | $80 |
| Claude API | ~$300 |
| Infrastructure | $300 |
| Social APIs | $100 |
| **Total** | **~$1,830–$2,830/mo** |

### Revenue to break even at Growth tier
- 100 Pro subscribers × $19 = $1,900
- 15 Sharp subscribers × $49 = $735
- Affiliate revenue at 1,000 MAU typically $3,000–$8,000/mo (dominant revenue stream)

---

## 18. Quick Reference Build Order

```
Day 1:        Open sharp-edge.code-workspace in VS Code
              Install all recommended extensions
              Run: pnpm dlx create-turbo@latest .

Week 1–2:     Foundation — auth, database, all service scaffolds
Week 3–4:     Data pipeline — odds, stats, NGS grades, transactions
Week 5–6:     Intelligence engine — all 6 signals + matchup grader
Week 6–7:     Matchup & position intelligence — Phase 3.5
Week 7–8:     User platform — migrate POC components, wire real data
Week 9–10:    Monetization — Stripe, affiliates, pick marketplace
Week 11–12:   Production hardening — security, legal, load testing

POC → Production migration order:
  1. pick-tracker.jsx        (simplest — pure read queries)
  2. matchup-analyzer.jsx    (needs matchup grades + transactions API)
  3. parlay-intelligence.jsx (depends on both above + parlay service)
```

**The single most important first action:**

```bash
mkdir sharp-edge && cd sharp-edge
pnpm dlx create-turbo@latest .
code sharp-edge.code-workspace
```

Everything in this plan flows from that workspace being correctly configured.
