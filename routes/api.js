const express = require('express');
const db = require('../db');
const { roomName } = require('../sockets/boardSocket');

const router = express.Router();

function broadcast(req, boardId, event, payload) {
  req.app.get('io').to(roomName(boardId)).emit(event, payload);
}

// Create a card
router.post('/boards/:boardId/cards', async (req, res, next) => {
  const boardId = Number(req.params.boardId);
  const columnId = Number(req.body.column_id);
  const content = String(req.body.content || '').trim();
  const color = String(req.body.color || '#fef08a');

  if (!content) return res.status(400).json({ error: 'Card text cannot be empty.' });

  try {
    const col = await db.query(
      'SELECT id FROM board_columns WHERE id = $1 AND board_id = $2',
      [columnId, boardId]
    );
    if (!col.rows.length) return res.status(404).json({ error: 'Column not found.' });

    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM cards WHERE column_id = $1',
      [columnId]
    );

    const { rows } = await db.query(
      `INSERT INTO cards (column_id, board_id, author_id, author_name, content, color, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [columnId, boardId, req.session.userId, req.session.userName, content, color, posResult.rows[0].next_position]
    );

    const card = { ...rows[0], vote_count: 0 };
    broadcast(req, boardId, 'card:created', card);
    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
});

// Edit a card's text (author or board creator only)
router.patch('/cards/:id', async (req, res, next) => {
  const cardId = Number(req.params.id);
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Card text cannot be empty.' });

  try {
    const { rows } = await db.query(
      `SELECT c.*, b.created_by AS board_creator_id
       FROM cards c JOIN boards b ON b.id = c.board_id
       WHERE c.id = $1`,
      [cardId]
    );
    const card = rows[0];
    if (!card) return res.status(404).json({ error: 'Card not found.' });

    const canEdit = card.author_id === req.session.userId || card.board_creator_id === req.session.userId;
    if (!canEdit) return res.status(403).json({ error: 'Only the author or board creator can edit this card.' });

    const updated = await db.query('UPDATE cards SET content = $1 WHERE id = $2 RETURNING *', [content, cardId]);
    broadcast(req, card.board_id, 'card:updated', { id: cardId, content });
    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete a card (author or board creator only)
router.delete('/cards/:id', async (req, res, next) => {
  const cardId = Number(req.params.id);
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.author_id, c.board_id, b.created_by AS board_creator_id
       FROM cards c JOIN boards b ON b.id = c.board_id
       WHERE c.id = $1`,
      [cardId]
    );
    const card = rows[0];
    if (!card) return res.status(404).json({ error: 'Card not found.' });

    const canDelete = card.author_id === req.session.userId || card.board_creator_id === req.session.userId;
    if (!canDelete) return res.status(403).json({ error: 'Only the author or board creator can delete this card.' });

    await db.query('DELETE FROM cards WHERE id = $1', [cardId]);
    broadcast(req, card.board_id, 'card:deleted', { id: cardId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Toggle a vote on a card
router.post('/cards/:id/vote', async (req, res, next) => {
  const cardId = Number(req.params.id);
  const userId = req.session.userId;
  try {
    const cardResult = await db.query('SELECT board_id FROM cards WHERE id = $1', [cardId]);
    const card = cardResult.rows[0];
    if (!card) return res.status(404).json({ error: 'Card not found.' });

    const existing = await db.query('SELECT 1 FROM card_votes WHERE card_id = $1 AND user_id = $2', [cardId, userId]);
    let voted;
    if (existing.rows.length) {
      await db.query('DELETE FROM card_votes WHERE card_id = $1 AND user_id = $2', [cardId, userId]);
      voted = false;
    } else {
      await db.query('INSERT INTO card_votes (card_id, user_id) VALUES ($1, $2)', [cardId, userId]);
      voted = true;
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM card_votes WHERE card_id = $1', [cardId]);
    const voteCount = countResult.rows[0].count;

    broadcast(req, card.board_id, 'card:voted', { id: cardId, vote_count: voteCount, actorId: userId, voted });
    res.json({ vote_count: voteCount, voted });
  } catch (err) {
    next(err);
  }
});

// Reorder / move cards within or across columns.
// Body: { cardIds: [1, 2, 3] } — the full, ordered list of card ids now in this column.
router.patch('/columns/:columnId/order', async (req, res, next) => {
  const columnId = Number(req.params.columnId);
  const cardIds = Array.isArray(req.body.cardIds) ? req.body.cardIds.map(Number) : [];

  const client = await db.pool.connect();
  try {
    const colResult = await client.query('SELECT board_id FROM board_columns WHERE id = $1', [columnId]);
    const column = colResult.rows[0];
    if (!column) return res.status(404).json({ error: 'Column not found.' });

    await client.query('BEGIN');
    for (let i = 0; i < cardIds.length; i++) {
      await client.query(
        'UPDATE cards SET column_id = $1, position = $2 WHERE id = $3 AND board_id = $4',
        [columnId, i, cardIds[i], column.board_id]
      );
    }
    await client.query('COMMIT');

    broadcast(req, column.board_id, 'cards:reordered', { columnId, cardIds });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
