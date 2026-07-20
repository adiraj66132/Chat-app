# Chat App

A real-time chat application built with React, TypeScript, and Express.

## Features

- **End-to-End Encryption (E2EE)** — client-side encryption using XChaCha20-Poly1305 with X25519 key exchange
- **Real-time messaging** via Socket.IO
- **User authentication** with JWT + refresh token rotation + rate limiting
- **Profile management** — avatars, display names, bio
- **Server-based channels & conversations**
- **Typing indicators, read receipts, online presence**
- **File uploads** with multer
- **Nord theme** UI with Tailwind CSS v4

## Tech Stack

### Client
- React 19, TypeScript, Vite
- Tailwind CSS v4
- TanStack React Query
- Socket.IO Client
- Motion (animations)
- Web Crypto API (E2EE)

### Server
- Express + TypeScript
- Socket.IO
- Prisma ORM + PostgreSQL
- JWT (access + refresh tokens)
- Zod validation
- Helmet, CORS, rate limiting
- Multer file uploads

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- `pg_ctl` available on PATH (or configure your own Postgres)

### Setup

```bash
# 1. Install server dependencies
cd server && npm install

# 2. Set up env
cp .env.example .env   # edit DB_URL and JWT secrets

# 3. Start Postgres and push schema
npm run db:start
npm run db:push

# 4. Seed the database (optional)
npm run db:seed

# 5. Start the server
npm run dev

# 6. In another terminal — install & start the client
cd client && npm install && npm run dev
```

The client dev server runs on `http://localhost:5173` and proxies API/WS requests to the server at `http://localhost:3000`.

## Project Structure

```
├── client/              # React SPA (Vite)
│   ├── src/
│   │   ├── api/         # API client functions
│   │   ├── components/  # UI components
│   │   ├── contexts/    # React contexts (auth, crypto)
│   │   └── hooks/       # Custom hooks
│   └── ...
├── server/              # Express + Socket.IO backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   ├── prisma/          # Schema + migrations
│   └── uploads/         # User-uploaded files (gitignored)
└── README.md
```
