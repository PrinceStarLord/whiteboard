// Predefined retro board templates. Each template's `columns` become the
// board's initial board_columns rows when a new board is created.
const TEMPLATES = {
  'went-well': {
    label: 'What Went Well',
    description: 'The classic format: Went Well, Didn’t Go Well, Action Items.',
    columns: [
      { title: 'Went Well', color: '#bbf7d0' },
      { title: "Didn't Go Well", color: '#fecaca' },
      { title: 'Action Items', color: '#bfdbfe' },
    ],
  },
  'start-stop-continue': {
    label: 'Start / Stop / Continue',
    description: 'What should we start, stop, and continue doing?',
    columns: [
      { title: 'Start', color: '#bbf7d0' },
      { title: 'Stop', color: '#fecaca' },
      { title: 'Continue', color: '#bfdbfe' },
    ],
  },
  'mad-sad-glad': {
    label: 'Mad / Sad / Glad',
    description: 'A quick pulse on team sentiment.',
    columns: [
      { title: 'Mad', color: '#fecaca' },
      { title: 'Sad', color: '#fde68a' },
      { title: 'Glad', color: '#bbf7d0' },
    ],
  },
  '4ls': {
    label: '4Ls',
    description: 'Liked, Learned, Lacked, Longed For.',
    columns: [
      { title: 'Liked', color: '#bbf7d0' },
      { title: 'Learned', color: '#bfdbfe' },
      { title: 'Lacked', color: '#fecaca' },
      { title: 'Longed For', color: '#e9d5ff' },
    ],
  },
  blank: {
    label: 'Blank Board',
    description: 'Start from scratch with three editable columns.',
    columns: [
      { title: 'Column 1', color: '#e2e8f0' },
      { title: 'Column 2', color: '#e2e8f0' },
      { title: 'Column 3', color: '#e2e8f0' },
    ],
  },
};

module.exports = TEMPLATES;
