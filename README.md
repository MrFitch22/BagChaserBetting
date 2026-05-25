# BagChaser Betting — Sharp Edge Platform

An AI-driven sports analytics engine and prediction pipeline. The platform aggregates multi-book odds, analyzes market sentiment and sharp movements, runs autonomous evaluation agents, and dynamically tunes its scoring model based on prediction performance.

---

## ─── Architecture Overview ───

The platform is designed as a modular monorepo consisting of a real-time web client, a high-throughput REST/WebSocket API, and an autonomous pipeline execution engine.

```
                  ┌──────────────────────────────────────────┐
                  │            Next.js Frontend              │
                  │   (Optimal Parlay Builder, Dashboard)   │
                  └────────────────────┬─────────────────────┘
                                       │ (REST / WebSockets)
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │            Fastify HTTP/WS API           │
                  │     (Drizzle ORM + Upstash Redis)        │
                  └────────────────────┬─────────────────────┘
                                       │ (PostgreSQL / TimescaleDB)
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │        Pipeline & Background Worker       │
                  │   (LangGraph Orchestration + node-cron)  │
                  └────────────────────┬─────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
 ┌──────────────┐               ┌──────────────┐               ┌──────────────┐
 │ Odds Ingest  │               │ Edge Scorer  │               │ Self-Tuner   │
 │ (OddsPapi /  │               │ (9-Signal    │               │ (Attribution │
 │ The Odds API)│               │ Scorer V3)   │               │ & Grading)   │
 └──────────────┘               └──────────────┘               └──────────────┘
```

### 1. Ingestion & Scoring Graph (LangGraph)
The pipeline utilizes a deterministic **LangGraph StateGraph** to run data collection and analysis tasks in parallel, eliminating token overhead from generic LLM routing:
- **Odds Ingest**: Pulls live market prices and point spreads.
- **Social & Verification Agents**: Track, verify, and grade capper pick performance.
- **Sentiment & Injury Checks**: Run contextual scrapes to evaluate motivation and player health.

### 2. Multi-Signal Scorer (v3)
Evaluates upcoming games using a composite scoring algorithm across multiple distinct dimensions (including sharp money divergence, rest advantages, and local weather factors). It dynamically distributes signal weights so missing data points do not dilute the confidence rating.

### 3. Automated Ingestion & Feedback Loops
Runs a continuous background process inside the pipeline daemon via node-cron:
- **Every 10 mins**: Runs the ingestion graph to catch real-time odds movements.
- **Hourly**: Resolves recently finished games using sports API feeds, marks results, and grades previous system predictions.
- **Daily**: Runs the **Recursive Self-Improvement Engine**. It analyzes the grading history of the past 90 days, attributes success to correct signals, scales signal weights accordingly per sport, and writes the calibrated weights back to the database.

---

## ─── Tech Stack ───

### Frontend
- **Framework**: Next.js 14 (App Router, Server Components, ISR) & React 18
- **State & Query**: TanStack React Query & Zustand
- **Styling**: Tailwind CSS
- **Visualization**: Recharts
- **Authentication**: Clerk (Next.js)
- **Payments**: Stripe

### API & Service Layer
- **HTTP Server**: Fastify 4 & `@fastify/rate-limit`
- **Real-Time**: Socket.io (WebSocket events for live sharp alerts)
- **Database Access**: Drizzle ORM (Type-safe query builder)
- **Caching**: Upstash Redis (Response caching & rate-limiting states)

### Intelligence Pipeline & Agents
- **Orchestration**: LangGraph (`@langchain/langgraph` & `@langchain/core`)
- **Observability**: LangSmith (Execution traces & agent evaluation logs)
- **Agent Models**: Claude Haiku & Sonnet (via Anthropic SDK)
- **Scrapers**: Playwright & Cheerio
- **Task Runner**: tsx (TypeScript execute engine)
- **Scheduling**: node-cron

### Database & Infrastructure
- **Primary Database**: PostgreSQL 16
- **Time-Series Data**: TimescaleDB (Efficient historical odds history storage)
- **Cache & Message Broker**: Redis 7
- **Deployment**: Railway

---

## ─── Project Structure ───

```
BagChaserBetting/
├── apps/
│   └── web/                 # Next.js web application
├── services/
│   ├── api/                 # Fastify REST & WS backend
│   └── pipeline/            # LangGraph pipeline, scorer, & cron daemon
├── packages/
│   ├── shared/              # Shared TypeScript interfaces & schemas
│   └── ui/                  # Shared React components
└── infrastructure/
    └── docker-compose.yml   # Local Postgres & Redis instances
```

---

## ─── Getting Started ───

### 1. Set Up Environment
Copy `.env.example` to `.env.local` in the project root and populate your credentials (API keys, database URLs, auth configurations).

### 2. Launch Local Database & Cache
```bash
cd infrastructure
docker compose up -d
```

### 3. Initialize Schema & Migrations
```bash
cd ..
pnpm --filter @sharp-edge/api db:push
```

### 4. Run Scripts Manually (Optional)
```bash
# Seed initial baseline weights & run weight optimizer
pnpm --filter @sharp-edge/pipeline improve

# Run hourly score updater & grader
pnpm --filter @sharp-edge/pipeline update-scores

# Perform a single edge confidence scoring run
pnpm --filter @sharp-edge/pipeline score
```

### 5. Start Development Servers
Run the full local stack (Web, API, and Pipeline Daemon with background crons):
```bash
pnpm dev
```
*(Alternatively, target specific packages: `pnpm --filter @sharp-edge/pipeline dev`, `pnpm --filter @sharp-edge/api dev`, or `pnpm --filter @sharp-edge/web dev`)*
