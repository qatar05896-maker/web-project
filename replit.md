# Cipher

A Telegram-inspired full-stack chat app with phone OTP auth, real-time messaging via Socket.IO, group voice/video rooms, and a pure black glassmorphism UI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api` and `/socket.io`)
- `pnpm --filter @workspace/chat-app run dev` — run the frontend (port auto, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-spec`)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + TanStack Query + Framer Motion
- Real-time: Socket.IO (auth via JWT token in `auth` handshake)

## Where things live

- `lib/db/src/schema/` — all Drizzle ORM table definitions (source of truth for DB schema)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/index.ts` — HTTP server + Socket.IO setup
- `artifacts/chat-app/src/pages/` — all frontend page components
- `artifacts/chat-app/src/lib/auth-context.tsx` — JWT token storage/auth state

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives Zod validation on server and React Query hooks on client via Orval codegen
- **JWT in localStorage**: token stored as `localStorage.getItem("token")`, sent as `Authorization: Bearer` and as Socket.IO `auth.token`
- **OTP dev mode**: OTP code printed to server logs in development; GramJS Telegram delivery is a documented future step
- **Socket.IO rooms**: each chat uses `chat:{chatId}` room; user-specific events use `user:{userId}` room
- **StrictMode double-emit fix**: Socket.IO `join:chat` / `leave:chat` called in a single `useEffect` with cleanup, preventing double-emit in React StrictMode

## Product

- Phone number OTP authentication with profile setup (username + password)
- Direct messages and group chats (unlimited members)
- Real-time messaging with Socket.IO (instant delivery, auto-scroll)
- Message deletion (sender only, hover to reveal)
- Group voice chat room (join/leave, mic/camera toggle, participant list)
- User search by username or phone (silent fail if no results)
- Settings page: edit username, bio, phone, password; sign out
- Pure black (#000000) dark mode with glassmorphism cards
- Bottom nav bar with blur + floating pencil FAB
- Group management: rename, add/remove members (admin only)

## User preferences

- Pure black background (`#000000`, not dark gray)
- Glassmorphism cards: `rgba(255,255,255,0.04)` background, `blur(20px)`, thin white border
- Bottom nav bar with `backdropFilter: blur(24px)`
- Floating FAB button for new chat (centered, above nav bar)
- Silent search failure (no error toast when no users found)
- OTP dev mode: code logged to server console, not shown in UI

## Gotchas

- Do NOT run `pnpm dev` at workspace root — use `restart_workflow` instead
- After schema changes: run `pnpm --filter @workspace/db run push` then restart the API server
- After OpenAPI changes: run `pnpm --filter @workspace/api-spec run codegen` — this regenerates both hooks and Zod schemas
- The `/socket.io` path must be in the artifact.toml paths list alongside `/api`
- Mutation hook call signatures are flat (no `params` wrapper): e.g. `useSendMessage().mutateAsync({ chatId, data })`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
