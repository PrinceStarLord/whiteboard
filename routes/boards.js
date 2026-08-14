const express = require('express');
const db = require('../db');
const TEMPLATES = require('../db/templates');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows: boards } = await db.query(
      `SELECT b.id, b.title, b.template, b.archived, b.created_at, u.name AS creator_name,
              b.created_by,
              (SELECT COUNT(*) FROM cards c WHERE c.board_id = b.id) AS card_count
       FROM boards b
       JOIN users u ON u.id = b.created_by
       ORDER BY b.created_at DESC`
    );
    res.render('dashboard', {
      boards,
      templates: TEMPLATES,
      currentUserId: req.session.userId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/boards', async (req, res, next) => {
  const title = String(req.body.title || '').trim() || 'Untitled Retro';
  const templateKey = TEMPLATES[req.body.template] ? req.body.template : 'went-well';
  const template = TEMPLATES[templateKey];

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO boards (title, template, created_by) VALUES ($1, $2, $3) RETURNING id',
      [title, templateKey, req.session.userId]
    );
    const boardId = rows[0].id;

    for (let i = 0; i < template.columns.length; i++) {
      const col = template.columns[i];
      await client.query(
        'INSERT INTO board_columns (board_id, title, color, position) VALUES ($1, $2, $3, $4)',
        [boardId, col.title, col.color, i]
      );
    }

    await client.query('COMMIT');
    res.redirect(`/boards/${boardId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/boards/:id', async (req, res, next) => {
  const boardId = Number(req.params.id);
  if (!Number.isInteger(boardId)) return res.status(404).send('Board not found');

  try {
    const { rows: boardRows } = await db.query(
      `SELECT b.*, u.name AS creator_name
       FROM boards b JOIN users u ON u.id = b.created_by
       WHERE b.id = $1`,
      [boardId]
    );
    const board = boardRows[0];
    if (!board) return res.status(404).send('Board not found');

    const { rows: columns } = await db.query(
      'SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position ASC, id ASC',
      [boardId]
    );

    const { rows: cards } = await db.query(
      `SELECT c.*,
              COALESCE(v.vote_count, 0) AS vote_count,
              EXISTS(SELECT 1 FROM card_votes cv WHERE cv.card_id = c.id AND cv.user_id = $2) AS voted_by_me
       FROM cards c
       LEFT JOIN (
         SELECT card_id, COUNT(*) AS vote_count FROM card_votes GROUP BY card_id
       ) v ON v.card_id = c.id
       WHERE c.board_id = $1
       ORDER BY c.position ASC, c.id ASC`,
      [boardId, req.session.userId]
    );

    res.render('board', {
      board,
      columns,
      cards,
      isCreator: board.created_by === req.session.userId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/boards/:id/delete', async (req, res, next) => {
  const boardId = Number(req.params.id);
  try {
    const { rows } = await db.query('SELECT created_by FROM boards WHERE id = $1', [boardId]);
    const board = rows[0];
    if (!board) return res.status(404).send('Board not found');
    if (board.created_by !== req.session.userId) {
      return res.status(403).send('Only the board creator can delete this board.');
    }
    await db.query('DELETE FROM boards WHERE id = $1', [boardId]);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
