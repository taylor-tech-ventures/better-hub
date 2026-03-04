# Better Hub — Documentation

Welcome to the Better Hub documentation. This directory contains guides covering the application architecture, tooling, data flows, and extension patterns.

## Contents

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | High-level system architecture, component layout, and monorepo structure |
| [Tooling](./tooling.md) | Tech stack reference — frameworks, libraries, and dev tools |
| [Data Flow](./data-flow.md) | End-to-end data flow from browser client to database and back |
| [Data Ingestion](./data-ingestion.md) | GitHub data sync strategy, caching layers, and ETags |
| [AI Chat (Ghost)](./ai-chat.md) | Ghost AI assistant — model routing, tools, streaming, and billing |
| [Adding New Tooling](./adding-tooling.md) | Step-by-step guide for adding an AI tool or integration |
| [Hooks & Action Chaining](./hooks-and-chaining.md) | Plan for chaining GitHub actions via hooks (e.g. post-repo-creation prompts) |

## Quick Start

See [CONTRIBUTING.md](../CONTRIBUTING.md) for local development setup.

## Overview

Better Hub is a Next.js SaaS application that reimagines the GitHub collaboration experience. It is structured as a Bun monorepo:

```
better-hub/
├── apps/
│   └── web/                  # Next.js application (frontend + backend API)
├── packages/
│   ├── chrome-extension/     # GitHub → Better Hub redirect (Manifest v3)
│   └── firefox-extension/    # Same for Firefox
└── docs/                     # ← You are here
```

The web application exposes:
- **React pages** (App Router) for repos, PRs, issues, settings, etc.
- **API routes** (`/api/*`) for auth, AI, billing, GitHub proxy, and uploads
- **Ghost** — an AI assistant accessible via `⌘I` with streaming responses and GitHub tooling
