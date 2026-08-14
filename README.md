# Retro Board

A flexible, self-hosted sprint retrospective board — pick a template (Went Well / Start-Stop-Continue / Mad-Sad-Glad / 4Ls / blank), add sticky notes in real time with your team, vote, drag cards between columns, and revisit every past retro whenever you need to. Built as a replacement for Microsoft Whiteboard retros, deployable to Heroku with a Postgres database.

## Stack

- **Node.js + Express** — server and REST API
- **PostgreSQL** — stores users, boards, columns, cards, votes (Heroku Postgres add-on in production)
- **Socket.io** — real-time sync so everyone sees cards, moves, and votes live
- **EJS + vanilla JS/CSS** — no frontend build step, keeps the app simple to deploy and maintain
- **express-session + connect-pg-simple** — sessions stored in Postgres (safe across dyno restarts)
- **bcryptjs** — password hashing

## Features

- Email/password accounts (no third-party login needed)
- Dashboard listing every retro ever created, newest first, with card counts and creation dates
- 5 retro templates to start from (or a blank board)
- Drag-and-drop sticky notes between columns, inline add/edit, emoji vote button
- Live collaboration: everyone viewing a board sees changes as they happen
- Permissions: **only the board's creator can delete the board**; a card can be deleted or edited by its author or the board creator
- Old retros are never deleted automatically — they stay in the dashboard as a permanent history

## Running locally

Prerequisites: Node 20+, a PostgreSQL server.

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, and SESSION_SECRET to any random string
npm run migrate   # creates tables (safe to re-run any time)
npm start
```

Visit `http://localhost:3000`.

## Deploying to Heroku

```bash
heroku create your-retro-board
heroku addons:create heroku-postgresql:essential-0
heroku config:set SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
git push heroku main
```

That's it. A few notes on why this works out of the box:

- `DATABASE_URL` is set automatically by the Heroku Postgres add-on.
- The `Procfile` declares a `release: node db/migrate.js` phase, so the database schema is created/updated automatically on every deploy — no manual migration step needed.
- `PORT` is set automatically by the Heroku dyno; `server.js` reads `process.env.PORT`.
- Sessions are stored in Postgres (not memory), so logins survive dyno restarts and scale past a single dyno.
- `app.set('trust proxy', 1)` is set so secure cookies work correctly behind Heroku's router.

To open the deployed app: `heroku open`. To watch logs: `heroku logs --tail`.

## Project structure

```
server.js            Express + Socket.io app entrypoint
db/
  index.js           Postgres connection pool
  schema.sql          Table definitions (idempotent)
  migrate.js          Runs schema.sql — invoked by Heroku's release phase
  templates.js         Retro board template definitions
middleware/auth.js     requireAuth / attachUser middleware
routes/
  auth.js             Register / login / logout
  boards.js            Dashboard, create board, view board, delete board
  api.js               Card CRUD, voting, drag-and-drop reorder (JSON API)
sockets/boardSocket.js Socket.io room join/leave
views/                EJS templates (login, register, dashboard, board)
public/               CSS and client-side JS (no build step)
```

## Data model

- `users` — accounts
- `boards` — one retro; `created_by` determines who can delete it
- `board_columns` — a board's columns (from its chosen template)
- `cards` — sticky notes; `author_id` determines who (besides the board creator) can edit/delete it
- `card_votes` — one row per user per upvoted card
