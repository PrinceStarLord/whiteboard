(function () {
  const modal = document.getElementById('newBoardModal');
  const openBtns = [document.getElementById('newBoardBtn'), document.getElementById('newBoardBtnEmpty')].filter(Boolean);
  const cancelBtn = document.getElementById('cancelNewBoard');

  function openModal() {
    modal.hidden = false;
    const input = modal.querySelector('input[name="title"]');
    if (input) setTimeout(() => input.focus(), 0);
  }

  function closeModal() {
    modal.hidden = true;
  }

  openBtns.forEach((btn) => btn.addEventListener('click', openModal));
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
})();
