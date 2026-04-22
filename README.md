# Beyblade X Tournament Manager

A lightweight Vue 3 web app for managing Beyblade X tournaments, including player setup, match flow, and history tracking.

## Live Demo

After GitHub Pages deployment is enabled, the site will be available at:

`https://tomsin9.github.io/bbx-tournament/`

## Features

- Tournament setup and player management
- Match progression and lobby flow
- Match history view
- Localization support (`en` / `zh`)
- Export and import tournament data

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Vue I18n
- Tailwind CSS

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Start development server

```bash
npm run dev
```

### 3) Build for production

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

## Deploy to GitHub Pages

This repository includes `.github/workflows/deploy.yml` for automatic deployment.

### One-time setup

1. Push this project to a GitHub repository named `beybladex_tournament_manager`.
2. Go to `Settings -> Pages`.
3. Set `Source` to **GitHub Actions**.

### Deployment flow

- Every push to `main` triggers:
  - dependency installation
  - production build
  - deployment of `dist/` to GitHub Pages

## Important Notes

- `vite.config.ts` is configured with:
  - `base: '/beybladex_tournament_manager/'`
- Router is configured with `createWebHashHistory(...)` to avoid 404 issues on page refresh in GitHub Pages.
- If you rename the repository, update the `base` path in `vite.config.ts` accordingly.

## Scripts

- `npm run dev` - run development server
- `npm run build` - type-check and build
- `npm run preview` - preview production output
- `npm run test` - run tests

## License
This project is licensed under the MIT License. See `LICENSE.md` for details.