-- Retro Board schema. Written to be idempotent (safe to re-run on every deploy).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boards (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  template    TEXT NOT NULL DEFAULT 'custom',
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  archived    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS board_columns (
  id        SERIAL PRIMARY KEY,
  board_id  INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  color     TEXT NOT NULL DEFAULT '#6366f1',
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards (
  id          SERIAL PRIMARY KEY,
  column_id   INTEGER NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#fef08a',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_votes (
  card_id  INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_boards_created_by ON boards(created_by);
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON board_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
