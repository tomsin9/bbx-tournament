# BBX Tournament System

A web-based tournament management application built with Vue 3 for Beyblade X events.  
It supports the full event flow from participant setup to match progression, history tracking, and data portability.

## Live Demo

[https://bbxbattle.win](https://bbxbattle.win)

## Core Features

- **Tournament setup**: Configure event parameters and initialize tournament sessions.
- **Multiple tournament formats**: Supports **Round Robin** and **Single Elimination** formats (v1.5).
- **Player management**: Add, edit, and organize participants before and during an event.
- **Quick match**: Start instant matches with minimal setup for faster casual battles.
- **Match flow control**: Manage match progression and lobby states in a structured workflow.
- **Match history**: Review completed matches and event records.
- **Localization**: Built-in internationalization support for English and Chinese (`en` / `zh`).
- **Data export/import**: Back up and restore tournament data for portability and continuity.

## What's New in v1.5

- Release date: **2026-04-29**
- Added **Round Robin** and **Single Elimination** tournament format.
- Updated **PlayersView** and **MatchView** UI layout and interactions.

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

### Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## License

This project is licensed under the MIT License. See `LICENSE.md` for details.