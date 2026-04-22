# Beyblade X Tournament Manager

A web-based tournament management application built with Vue 3 for Beyblade X events.  
It supports the full event flow from participant setup to match progression, history tracking, and data portability.

## Live Demo

After GitHub Pages is enabled, the application is available at:

`https://tomsin9.github.io/beybladex_tournament_manager/`

## Core Features

- **Tournament setup**: Configure event parameters and initialize tournament sessions.
- **Player management**: Add, edit, and organize participants before and during an event.
- **Match flow control**: Manage match progression and lobby states in a structured workflow.
- **Match history**: Review completed matches and event records.
- **Localization**: Built-in internationalization support for English and Chinese (`en` / `zh`).
- **Data export/import**: Back up and restore tournament data for portability and continuity.

## Technology Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Vue I18n
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm 9+ (recommended)

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build locally

```bash
npm run preview
```

## Deployment (GitHub Pages)

This repository includes a CI workflow at `.github/workflows/deploy.yml` for automated deployment.

### One-time repository setup

1. Push this project to a GitHub repository named `beybladex_tournament_manager`.
2. Go to `Settings -> Pages`.
3. Set `Source` to **GitHub Actions**.

### Deployment behavior

Each push to `main` triggers:

1. Dependency installation
2. Production build
3. Deployment of `dist/` to GitHub Pages

## Configuration Notes

- `vite.config.ts` uses `base: '/beybladex_tournament_manager/'` for GitHub Pages hosting.
- The router uses `createWebHashHistory(...)` to prevent refresh-related 404 issues on GitHub Pages.
- If the repository name changes, update the `base` path in `vite.config.ts` accordingly.

## Available Scripts

- `npm run dev` - Start the local development server
- `npm run build` - Run type checks and create a production build
- `npm run preview` - Preview the production build locally
- `npm run test` - Run test suite

## License

This project is licensed under the MIT License. See `LICENSE.md` for details.