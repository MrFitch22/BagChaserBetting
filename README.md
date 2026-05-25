# BagChaser Betting — Sharp Edge Platform

AI-powered sports betting intelligence. Tracks sharp money movement, scores confidence on upcoming edges, and surfaces the best bets across NBA, NHL, and MLB.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org) | React framework — App Router, ISR, server components |
| [React 18](https://react.dev) | UI rendering |
| [TanStack React Query](https://tanstack.com/query) | Client-side data fetching and caching |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [Recharts](https://recharts.org) | Data visualizations |
| [Zustand](https://zustand-demo.pmnd.rs) | Client-side state management |
| [Socket.io Client](https://socket.io) | Real-time sharp move alerts |
| [Clerk (Next.js)](https://clerk.com) | Authentication and user management |
| [Stripe](https://stripe.com) | Subscription billing (Pro / Sharp tiers) |
| [Zod](https://zod.dev) | Runtime schema validation |
| [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Conditional class merging |

### API
| Technology | Purpose |
|---|---|
| [Fastify 4](https://fastify.dev) | HTTP server |
| [@fastify/cors](https://github.com/fastify/fastify-cors) | Cross-origin request handling |
| [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) | Per-user rate limiting |
| [Socket.io](https://socket.io) | WebSocket server for live alerts |
| [Drizzle ORM](https://orm.drizzle.team) | Type-safe database access |
| [Clerk (Fastify)](https://clerk.com) | JWT verification and auth middleware |
| [@upstash/redis](https://upstash.com) | Response caching and rate-limit state |
| [pg](https://node-postgres.com) | PostgreSQL client |
| [Zod](https://zod.dev) | Request validation |

### Pipeline
| Technology | Purpose |
|---|---|
| [The Odds API](https://the-odds-api.com) | Live odds from DraftKings, FanDuel, BetMGM, Caesars, Pinnacle |
| [Anthropic SDK](https://docs.anthropic.com) | Claude-powered analysis agents |
| [Drizzle ORM](https://orm.drizzle.team) | Direct DB writes for ingest and scoring |
| [tsx](https://github.com/privatenumber/tsx) | TypeScript script runner (no build step) |
| [pg](https://node-postgres.com) | PostgreSQL client |

### Database & Infrastructure
| Technology | Purpose |
|---|---|
| [PostgreSQL 16](https://www.postgresql.org) | Primary database |
| [TimescaleDB](https://www.timescale.com) | Time-series extension for odds history |
| [Redis 7](https://redis.io) | Cache and pub/sub |
| [Docker Compose](https://docs.docker.com/compose) | Local infrastructure (Postgres + Redis) |
| [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) | Schema migrations and DB studio |

### Monorepo & Tooling
| Technology | Purpose |
|---|---|
| [pnpm Workspaces](https://pnpm.io/workspaces) | Monorepo package management |
| [Turborepo](https://turbo.build) | Build orchestration and caching |
| [TypeScript 5](https://www.typescriptlang.org) | End-to-end type safety |
| [ESLint](https://eslint.org) | Linting |
| [Prettier](https://prettier.io) | Code formatting |

### Shared Packages
| Package | Contents |
|---|---|
| `@sharp-edge/shared` | Shared TypeScript types (`EdgeCard`, `ConfidenceScore`, `Sport`, etc.) |
| `@sharp-edge/ui` | Shared React components (`ConfidenceBar`, etc.) |

---

## Services

```
BagChaserBetting/
├── apps/
│   └── web/              # Next.js frontend (port 3000)
├── services/
│   ├── api/              # Fastify REST + WebSocket API (port 3001)
│   └── pipeline/         # Odds ingest + confidence scoring scripts
├── packages/
│   ├── shared/           # Shared types
│   └── ui/               # Shared UI components
└── infrastructure/
    └── docker-compose.yml  # Postgres + Redis
```

---

## Getting Started

```powershell
# 1. Start infrastructure
cd infrastructure
docker compose up -d

# 2. Push database schema
cd ..
pnpm --filter @sharp-edge/api db:push

# 3. Ingest live odds
pnpm --filter @sharp-edge/pipeline exec tsx src/ingest-odds.ts

# 4. Score confidence
pnpm --filter @sharp-edge/pipeline exec tsx src/score-confidence.ts

# 5. Start everything
pnpm --filter @sharp-edge/api dev
pnpm --filter @sharp-edge/web dev
```

Copy `.env.example` to `.env.local` at the project root and fill in your keys before running.
