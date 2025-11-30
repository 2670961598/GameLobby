import { Board } from './model.js';
import { postScore, fetchScores } from './api.js';
import { CanvasRenderer } from './renderer.js';

// ---- Constants ----
const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 }
};

// ---- DOM References ----
const diffSelect   = document.getElementById('difficulty');
const timerEl      = document.getElementById('timer');
const restartBtn   = document.getElementById('restart');
const boardEl      = document.getElementById('board');
const modalEl      = document.getElementById('modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl  = document.getElementById('modal-body');
const modalActEl   = document.getElementById('modal-actions');
const tabsEl       = document.getElementById('tabs');
const scoreListEl  = document.getElementById('score-list');

// ---- State ----
let board = null;
let running = false;
let startTs = null;
let rafId = null;
let currentDiffKey = 'easy';
let renderer = null; // active renderer (DOM or Canvas)

// ---- Timer Helpers ----
function fmt(ms) {
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = (totalSec - minutes * 60).toFixed(2);
  return `${String(minutes).padStart(2, '0')}:${seconds.padStart(5, '0')}`;
}
function startTimer() {
  startTs = performance.now();
  running = true;
  tick();
}
function stopTimer() {
  running = false;
  cancelAnimationFrame(rafId);
  return performance.now() - startTs;
}
function tick() {
  if (!running) return;
  const ms = performance.now() - startTs;
  timerEl.textContent = fmt(ms);
  rafId = requestAnimationFrame(tick);
}

// ---- Modal Helpers ----
function showModal(title, bodyHtml, actions = []) {
  modalTitleEl.textContent = title;
  modalBodyEl.innerHTML = bodyHtml;
  modalActEl.innerHTML = '';
  actions.forEach(({ text, handler }) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.addEventListener('click', () => {
      handler();
      hideModal();
    });
    modalActEl.appendChild(btn);
  });
  modalEl.classList.remove('hidden');
}
function hideModal() { modalEl.classList.add('hidden'); }

// ---- Board Rendering ----
function renderBoardGrid() {
  const { rows, cols } = board;
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const btn = document.createElement('button');
      btn.dataset.r = r;
      btn.dataset.c = c;
      boardEl.appendChild(btn);
    }
  }
}

// --- DOM-specific update helpers (used when small board) ---
function domUpdateCells(indices) {
  indices.forEach(i => {
    const [r, c] = board.rc(i);
    const sel = `button[data-r="${r}"][data-c="${c}"]`;
    const btn = boardEl.querySelector(sel);
    if (!btn) return;
    const cell = board.cells[i];
    btn.className = '';
    btn.textContent = '';
    if (cell.revealed) {
      btn.classList.add('revealed');
      if (cell.mine) {
        btn.classList.add('mine');
      } else if (cell.adj > 0) {
        btn.textContent = cell.adj;
        btn.classList.add('n' + cell.adj);
      }
    } else {
      if (cell.mark === 2) btn.classList.add('flagged');
      else if (cell.mark === 1) btn.classList.add('question');
    }
  });
}

function domRevealAllMines() {
  const mines = new Set();
  board.cells.forEach((cell, i) => { if (cell.mine) mines.add(i); });
  domUpdateCells(mines);
}

// Unified wrappers used by game logic
function updateCells(indices) {
  renderer.updateCells(indices);
}

function revealAllMines() {
  if (renderer.revealAllMines) renderer.revealAllMines();
  else {
    const mines = new Set();
    board.cells.forEach((cell, i) => { if (cell.mine) mines.add(i); });
    renderer.updateCells(mines);
  }
}

// --- Generic cell action handlers (shared by DOM & Canvas) ---
function handleLeftClick(r, c) {
  const { revealed, exploded } = board.reveal(r, c);
  if (revealed.size) {
    if (!running) startTimer();
    updateCells(revealed);
  }
  if (exploded) {
    revealAllMines();
    stopTimer();
    updateCells(new Set([board.idx(r, c)]));
    showModal('Game Over', '<p>💥 You hit a mine!</p>', [
      { text: 'Restart', handler: () => newGame(currentDiffKey) }
    ]);
  } else if (board.isComplete()) {
    const time = stopTimer();
    updateCells(revealed);
    askNicknameAndSubmit(time);
  }
}

function handleRightClick(r, c) {
  board.toggleMark(r, c);
  updateCells(new Set([board.idx(r, c)]));
}

// DOM grid event listeners (only active in DOM mode)
boardEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  handleLeftClick(+btn.dataset.r, +btn.dataset.c);
});

boardEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const btn = e.target.closest('button');
  if (!btn) return;
  handleRightClick(+btn.dataset.r, +btn.dataset.c);
});

restartBtn.addEventListener('click', () => newGame(currentDiffKey));
window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') newGame(currentDiffKey);
});

diffSelect.addEventListener('change', () => {
  const key = diffSelect.value;
  if (key === 'custom') {
    askCustom();
  } else {
    newGame(key);
  }
});

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const diff = btn.dataset.tab;
  tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
  loadLeaderboard(diff);
});

// ---- Custom Dialog ----
function askCustom() {
  showModal('Custom Board', `
    <label>Rows <input id="rows" type="number" min="1" max="1000" value="16" /></label><br/>
    <label>Cols <input id="cols" type="number" min="1" max="1000" value="30" /></label><br/>
    <label>Mines <input id="mines" type="number" min="1" value="99" /></label>
  `, [
    { text: 'Start', handler: () => {
        const rows = +modalEl.querySelector('#rows').value;
        const cols = +modalEl.querySelector('#cols').value;
        const mines = +modalEl.querySelector('#mines').value;
        const maxMines = Math.floor(rows * cols / 5);
        if (rows < 1 || cols < 1 || mines < 1 || rows > 1000 || cols > 1000 || mines > maxMines) {
          showModal('Invalid Parameters', `
            <p>Please check your inputs:</p>
            <ul>
              <li>Rows: 1-1000 (current: ${rows})</li>
              <li>Cols: 1-1000 (current: ${cols})</li>
              <li>Mines: 1-${maxMines} (current: ${mines})</li>
            </ul>
            <p><strong>Note:</strong> Large boards (>100×100) may take time to load and use significant memory.</p>
          `, [
            { text: 'OK', handler: () => askCustom() }
          ]);
          return;
        }
        DIFFICULTIES.custom = { rows, cols, mines };
        newGame('custom');
      } }
  ]);
}

// ---- Leaderboard ----
async function loadLeaderboard(diff) {
  scoreListEl.innerHTML = '<li>Loading…</li>';
  try {
    const data = await fetchScores(diff);
    // seconds asc
    data.sort((a, b) => a.score - b.score);
    scoreListEl.innerHTML = '';
    data.slice(0, 50).forEach(({ name, score }) => {
      const li = document.createElement('li');
      li.textContent = `${name} — ${fmt(score * 1000)}`;
      scoreListEl.appendChild(li);
    });
  } catch (err) {
    scoreListEl.innerHTML = '<li>Error loading leaderboard</li>';
  }
}

function askNicknameAndSubmit(timeMs) {
  showModal('You Win!', `<p>🎉 Congratulations! Time: ${fmt(timeMs)}</p><input id="nick" placeholder="Your name" maxlength="20" />`, [
    { text: 'Submit', handler: async () => {
        const name = modalEl.querySelector('#nick').value.trim() || 'Anonymous';
        const timeSec = parseFloat((timeMs / 1000).toFixed(2));
        await postScore(currentDiffKey, name, timeSec);
        loadLeaderboard(currentDiffKey);
        newGame(currentDiffKey);
      } }
  ]);
}

// ---- Game Lifecycle ----
function newGame(diffKey) {
  currentDiffKey = diffKey;
  const cfg = DIFFICULTIES[diffKey];
  if (!cfg) return;
  
  const totalCells = cfg.rows * cfg.cols;
  const isLargeBoard = totalCells > 10000; // 100x100 threshold
  
  // Show loading indicator for large boards
  if (isLargeBoard) {
    showModal('Creating Large Board', `
      <p>Creating ${cfg.rows}×${cfg.cols} board with ${cfg.mines} mines...</p>
      <p>This may take a moment. Please wait.</p>
    `);
    
    // Use timeout to allow UI to update before heavy computation
    setTimeout(() => {
      createGameBoard(cfg, isLargeBoard);
    }, 100);
  } else {
    createGameBoard(cfg, isLargeBoard);
  }
}

function createGameBoard(cfg, isLargeBoard) {
  console.log(`Creating new game: ${cfg.rows}×${cfg.cols} with ${cfg.mines} mines (${cfg.rows * cfg.cols} total cells)`);
  const startTime = performance.now();
  
  board = new Board(cfg.rows, cfg.cols, cfg.mines);
  const boardCreationTime = performance.now();
  console.log(`Board creation took: ${(boardCreationTime - startTime).toFixed(2)}ms`);
  
  timerEl.textContent = '00:00.00';
  running = false;
  cancelAnimationFrame(rafId);

  // dispose previous renderer
  if (renderer && renderer.dispose) renderer.dispose();

  // clear container content before creating new renderer
  boardEl.innerHTML = '';

  // Always use Canvas renderer for unlimited board sizes
  boardEl.className = 'canvas';
  console.log('Creating Canvas renderer...');
  renderer = new CanvasRenderer(board, boardEl, handleLeftClick, handleRightClick);
  const renderCreationTime = performance.now();
  console.log(`Canvas renderer creation took: ${(renderCreationTime - boardCreationTime).toFixed(2)}ms`);
  console.log(`Total game creation took: ${(renderCreationTime - startTime).toFixed(2)}ms`);

  // sync leaderboard tab selection
  tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === currentDiffKey));
  loadLeaderboard(currentDiffKey);
  diffSelect.value = currentDiffKey;
  
  // Hide loading modal for large boards
  if (isLargeBoard) {
    hideModal();
  }
}

// ---- Bootstrap ----
// Debug: Check if DOM elements exist
console.log('DOM elements check:');
console.log('diffSelect:', diffSelect);
console.log('boardEl:', boardEl);
console.log('timerEl:', timerEl);
console.log('restartBtn:', restartBtn);
console.log('tabsEl:', tabsEl);
console.log('scoreListEl:', scoreListEl);

// Bootstrap the game
try {
  newGame('easy');
  console.log('Game initialized successfully');
} catch (error) {
  console.error('Error initializing game:', error);
} 