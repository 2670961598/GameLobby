// Minesweeper Ultimate – Model Layer
// ----------------------------------
// Provides the fundamental board & cell data structures and game logic.

export class Cell {
  constructor() {
    this.mine = false;
    this.revealed = false;
    this.mark = 0; // 0 = none, 1 = question, 2 = flag
    this.adj = 0;  // adjacent mine count
  }
}

export class Board {
  constructor(rows, cols, mines) {
    console.log(`Board constructor: Creating ${rows}×${cols} board with ${mines} mines`);
    const startTime = performance.now();
    
    this.rows = rows;
    this.cols = cols;
    this.totalMines = mines;

    // Flat array of Cell
    console.log(`Creating array of ${rows * cols} cells...`);
    this.cells = Array.from({ length: rows * cols }, () => new Cell());
    const cellsCreated = performance.now();
    console.log(`Cell array creation took: ${(cellsCreated - startTime).toFixed(2)}ms`);

    this.minesPlaced = false; // delay placement until first click (safety)
    this.revealedCount = 0;
    
    const totalTime = performance.now();
    console.log(`Board constructor completed in: ${(totalTime - startTime).toFixed(2)}ms`);
  }

  idx(r, c) { return r * this.cols + c; }
  rc(index) { return [Math.floor(index / this.cols), index % this.cols]; }

  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }

  neighbours(r, c) {
    const res = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (this.inBounds(nr, nc)) res.push([nr, nc]);
      }
    }
    return res;
  }

  placeMines(safeSet) {
    // Randomly place mines excluding indices in safeSet
    const totalCells = this.rows * this.cols;
    let minesToPlace = this.totalMines;
    while (minesToPlace > 0) {
      const i = Math.floor(Math.random() * totalCells);
      if (safeSet.has(i)) continue;
      const cell = this.cells[i];
      if (!cell.mine) {
        cell.mine = true;
        minesToPlace--;
      }
    }
    // After mines placed, compute adjacents
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[this.idx(r, c)];
        if (cell.mine) continue;
        cell.adj = this.neighbours(r, c).reduce((acc, [nr, nc]) => acc + (this.cells[this.idx(nr, nc)].mine ? 1 : 0), 0);
      }
    }
    this.minesPlaced = true;
  }

  toggleMark(r, c) {
    const cell = this.cells[this.idx(r, c)];
    if (cell.revealed) return;
    // Change order: 0 -> 2 -> 1 -> 0 (none -> flag -> question -> none)
    if (cell.mark === 0) {
      cell.mark = 2; // none -> flag
    } else if (cell.mark === 2) {
      cell.mark = 1; // flag -> question
    } else {
      cell.mark = 0; // question -> none
    }
  }

  /**
   * Reveal logic for a cell; returns an object describing changes.
   * { revealed: Set<number>, exploded: boolean }
   */
  reveal(r, c) {
    const index = this.idx(r, c);
    const firstClick = !this.minesPlaced;

    if (firstClick) {
      // Build safe-area (clicked cell + neighbours)
      const safe = new Set([index]);
      for (const [nr, nc] of this.neighbours(r, c)) safe.add(this.idx(nr, nc));
      this.placeMines(safe);
    }

    const target = this.cells[index];
    if (target.revealed || target.mark === 2) return { revealed: new Set(), exploded: false };

    const changed = new Set();

    const flood = (rr, cc) => {
      const i = this.idx(rr, cc);
      const cell = this.cells[i];
      if (cell.revealed || cell.mark === 2) return;
      cell.revealed = true;
      changed.add(i);
      this.revealedCount++;
      if (cell.adj === 0 && !cell.mine) {
        for (const [nnr, nnc] of this.neighbours(rr, cc)) flood(nnr, nnc);
      }
    };

    if (target.mine) {
      target.revealed = true;
      changed.add(index);
      return { revealed: changed, exploded: true };
    }

    // Normal reveal / flood
    flood(r, c);
    return { revealed: changed, exploded: false };
  }

  /** Returns true if player has won */
  isComplete() {
    const totalCells = this.rows * this.cols;
    return this.revealedCount === totalCells - this.totalMines;
  }
} 