(function () {
  const BOARD = window.__BOARD__;
  const socket = io();
  socket.emit('join-board', BOARD.id);

  const template = document.getElementById('cardTemplate');
  const columnsEl = document.getElementById('columns');

  function canManage(authorId) {
    return BOARD.isCreator || authorId === BOARD.currentUserId;
  }

  function updateColumnCounts() {
    document.querySelectorAll('.column').forEach((col) => {
      const count = col.querySelectorAll('.sticky-card').length;
      col.querySelector('.column-count').textContent = count;
    });
  }

  function buildCardEl(card) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.cardId = card.id;
    node.style.background = card.color || '#fef08a';
    node.querySelector('.sticky-card-content').textContent = card.content;
    node.querySelector('.sticky-card-author').textContent = card.author_name;

    const voteBtn = node.querySelector('.vote-btn');
    voteBtn.dataset.cardId = card.id;
    voteBtn.querySelector('.vote-count').textContent = card.vote_count || 0;
    if (card.voted_by_me) voteBtn.classList.add('voted');

    const deleteBtn = node.querySelector('.delete-card-btn');
    deleteBtn.dataset.cardId = card.id;
    deleteBtn.dataset.authorId = card.author_id == null ? '' : card.author_id;
    if (!canManage(card.author_id)) deleteBtn.style.display = 'none';

    return node;
  }

  function getCardList(columnId) {
    return columnsEl.querySelector(`.card-list[data-column-id="${columnId}"]`);
  }

  // ---- Add card ----
  columnsEl.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-card-btn');
    if (addBtn) return startAddCard(addBtn);

    const voteBtn = e.target.closest('.vote-btn');
    if (voteBtn) return handleVote(voteBtn);

    const deleteBtn = e.target.closest('.delete-card-btn');
    if (deleteBtn) return handleDelete(deleteBtn);
  });

  function startAddCard(addBtn) {
    if (addBtn.dataset.open) return;
    addBtn.dataset.open = '1';
    const columnId = addBtn.dataset.columnId;

    const form = document.createElement('form');
    form.className = 'add-card-form';
    form.innerHTML = `
      <textarea placeholder="Write something..." required></textarea>
      <div class="add-card-form-actions">
        <button type="submit" class="btn btn-primary btn-small">Add</button>
        <button type="button" class="btn btn-ghost btn-small cancel-add">Cancel</button>
      </div>
    `;
    addBtn.insertAdjacentElement('beforebegin', form);
    addBtn.style.display = 'none';
    const textarea = form.querySelector('textarea');
    textarea.focus();

    function close() {
      form.remove();
      delete addBtn.dataset.open;
      addBtn.style.display = '';
    }

    form.querySelector('.cancel-add').addEventListener('click', close);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = textarea.value.trim();
      if (!content) return;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      const color = BOARD.cardColors[Math.floor(Math.random() * BOARD.cardColors.length)];
      try {
        const res = await fetch(`/api/boards/${BOARD.id}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: columnId, content, color }),
        });
        if (!res.ok) throw new Error('Failed to add card');
        close();
      } catch (err) {
        alert('Could not add card. Please try again.');
        submitBtn.disabled = false;
      }
    });
  }

  async function handleVote(voteBtn) {
    voteBtn.disabled = true;
    try {
      await fetch(`/api/cards/${voteBtn.dataset.cardId}/vote`, { method: 'POST' });
    } catch (err) {
      // ignore; UI will simply not update
    } finally {
      voteBtn.disabled = false;
    }
  }

  async function handleDelete(deleteBtn) {
    if (!confirm('Delete this card?')) return;
    deleteBtn.disabled = true;
    try {
      const res = await fetch(`/api/cards/${deleteBtn.dataset.cardId}`, { method: 'DELETE' });
      if (!res.ok && res.status === 403) {
        alert('Only the card author or board creator can delete this card.');
      }
    } catch (err) {
      alert('Could not delete card. Please try again.');
    } finally {
      deleteBtn.disabled = false;
    }
  }

  // ---- Drag & drop reordering ----
  let dragged = null;

  columnsEl.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.sticky-card');
    if (!card) return;
    dragged = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  columnsEl.addEventListener('dragend', (e) => {
    const card = e.target.closest('.sticky-card');
    if (!card) return;
    card.classList.remove('dragging');
    dragged = null;
    updateColumnCounts();
    persistOrder();
  });

  columnsEl.querySelectorAll('.card-list').forEach(attachDropTarget);

  function attachDropTarget(list) {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragged) return;
      const afterEl = getDragAfterElement(list, e.clientY);
      if (afterEl == null) {
        list.appendChild(dragged);
      } else {
        list.insertBefore(dragged, afterEl);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.sticky-card:not(.dragging)')];
    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  let persistTimer = null;
  function persistOrder() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      const lists = columnsEl.querySelectorAll('.card-list');
      for (const list of lists) {
        const columnId = list.dataset.columnId;
        const cardIds = [...list.querySelectorAll('.sticky-card')].map((c) => Number(c.dataset.cardId));
        try {
          await fetch(`/api/columns/${columnId}/order`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardIds }),
          });
        } catch (err) {
          // best-effort; board will re-sync via socket events from other clients
        }
      }
    }, 50);
  }

  // ---- Realtime events ----
  socket.on('card:created', (card) => {
    if (document.querySelector(`.sticky-card[data-card-id="${card.id}"]`)) return;
    const list = getCardList(card.column_id);
    if (list) list.appendChild(buildCardEl(card));
    updateColumnCounts();
  });

  socket.on('card:updated', ({ id, content }) => {
    const el = document.querySelector(`.sticky-card[data-card-id="${id}"] .sticky-card-content`);
    if (el) el.textContent = content;
  });

  socket.on('card:deleted', ({ id }) => {
    const el = document.querySelector(`.sticky-card[data-card-id="${id}"]`);
    if (el) el.remove();
    updateColumnCounts();
  });

  socket.on('card:voted', ({ id, vote_count, actorId, voted }) => {
    const btn = document.querySelector(`.vote-btn[data-card-id="${id}"]`);
    if (!btn) return;
    btn.querySelector('.vote-count').textContent = vote_count;
    if (actorId === BOARD.currentUserId) {
      btn.classList.toggle('voted', voted);
    }
  });

  socket.on('cards:reordered', ({ columnId, cardIds }) => {
    const list = getCardList(columnId);
    if (!list) return;
    cardIds.forEach((id) => {
      const el = document.querySelector(`.sticky-card[data-card-id="${id}"]`);
      if (el) list.appendChild(el);
    });
    updateColumnCounts();
  });

  // ---- Inline edit (double-click) ----
  columnsEl.addEventListener('dblclick', (e) => {
    const contentEl = e.target.closest('.sticky-card-content');
    if (!contentEl) return;
    const cardEl = contentEl.closest('.sticky-card');
    const deleteBtn = cardEl.querySelector('.delete-card-btn');
    const authorId = deleteBtn.dataset.authorId ? Number(deleteBtn.dataset.authorId) : null;
    if (!canManage(authorId)) return;

    const original = contentEl.textContent;
    const textarea = document.createElement('textarea');
    textarea.className = 'sticky-card-edit';
    textarea.value = original;
    contentEl.replaceWith(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    async function save() {
      const value = textarea.value.trim();
      textarea.replaceWith(contentEl);
      if (!value || value === original) {
        contentEl.textContent = original;
        return;
      }
      contentEl.textContent = value;
      try {
        await fetch(`/api/cards/${cardEl.dataset.cardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: value }),
        });
      } catch (err) {
        contentEl.textContent = original;
      }
    }

    textarea.addEventListener('blur', save);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      }
      if (e.key === 'Escape') {
        textarea.value = original;
        textarea.blur();
      }
    });
  });
})();
