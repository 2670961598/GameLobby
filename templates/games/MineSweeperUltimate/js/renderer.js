// Minesweeper Ultimate – Canvas Renderer
// Renders large boards onto a single <canvas> with basic zoom & pan.
export class CanvasRenderer {
  constructor(board, container, onLeft, onRight) {
    console.log(`CanvasRenderer constructor: Starting for ${board.rows}×${board.cols} board`);
    const startTime = performance.now();
    
    this.board = board;
    this.container = container;
    this.onLeft = onLeft;
    this.onRight = onRight;

    console.log('Creating canvas element...');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    const canvasCreated = performance.now();
    console.log(`Canvas creation took: ${(canvasCreated - startTime).toFixed(2)}ms`);

    this.cellSize = 32; // base size (before scale)
    this.scale = 1;
    this.minScale = 0.1; // Allow more zoom out for large boards
    this.maxScale = 3;
    this.offsetX = 0;
    this.offsetY = 0;

    // Auto-adjust initial scale for very large boards
    const totalCells = board.rows * board.cols;
    if (totalCells > 40000) { // 200x200
      this.scale = 0.2;
    } else if (totalCells > 10000) { // 100x100
      this.scale = 0.5;
    }

    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startOffsetX = 0;
    this.startOffsetY = 0;

    console.log('Setting up ResizeObserver...');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    const observerSetup = performance.now();
    console.log(`ResizeObserver setup took: ${(observerSetup - canvasCreated).toFixed(2)}ms`);

    console.log('Attaching events...');
    this.attachEvents();
    const eventsAttached = performance.now();
    console.log(`Event attachment took: ${(eventsAttached - observerSetup).toFixed(2)}ms`);
    
    console.log('Initial resize and draw...');
    this.resize();
    this.draw();
    const totalTime = performance.now();
    console.log(`CanvasRenderer constructor completed in: ${(totalTime - startTime).toFixed(2)}ms`);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  attachEvents() {
    this.canvas.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      const [r, c] = this.coordToCell(e.clientX, e.clientY);
      if (r === null) return;
      this.onLeft(r, c);
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [r, c] = this.coordToCell(e.clientX, e.clientY);
      if (r === null) return;
      this.onRight(r, c);
    });

    // Prevent middle-click from triggering browser autoscroll
    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const prevScale = this.scale;
      this.scale *= e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
      // adjust offset so that zoom is centered on cursor
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = this.scale / prevScale;
      this.offsetX = mx - (mx - this.offsetX) * factor;
      this.offsetY = my - (my - this.offsetY) * factor;
      this.draw();
    }, { passive: false });

    // Pan (middle button)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.startOffsetX = this.offsetX;
      this.startOffsetY = this.offsetY;
      this.canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.offsetX = this.startOffsetX + dx;
      this.offsetY = this.startOffsetY + dy;
      this.draw();
    });
    window.addEventListener('mouseup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.canvas.style.cursor = 'crosshair';
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.container.getBoundingClientRect();
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    // Reset transform before applying DPR to avoid accumulating scales
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  coordToCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / (this.cellSize * this.scale);
    const y = (clientY - rect.top - this.offsetY) / (this.cellSize * this.scale);
    const r = Math.floor(y);
    const c = Math.floor(x);
    if (r < 0 || c < 0 || r >= this.board.rows || c >= this.board.cols) return [null, null];
    return [r, c];
  }

  updateCells(_indices) {
    // For simplicity redraw everything.
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const { rows, cols } = this.board;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Clear using device pixel dimensions to fully wipe the canvas on high-DPI
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Calculate board dimensions for border
    const cellSize = this.cellSize;
    const boardWidth = cols * cellSize;
    const boardHeight = rows * cellSize;

    // Improved visible cell range calculation with padding for smoother scrolling
    const padding = 2; // cells of padding for smoother scrolling
    const startCol = Math.max(0, Math.floor(-this.offsetX / (cellSize * this.scale)) - padding);
    const endCol = Math.min(cols - 1, Math.ceil((w - this.offsetX) / (cellSize * this.scale)) + padding);
    const startRow = Math.max(0, Math.floor(-this.offsetY / (cellSize * this.scale)) - padding);
    const endRow = Math.min(rows - 1, Math.ceil((h - this.offsetY) / (cellSize * this.scale)) + padding);

    // Skip drawing if the board is too zoomed out (performance optimization)
    if (this.scale < 0.05) {
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);
      
      // Draw border even when zoomed out
      ctx.strokeStyle = '#d63031';
      ctx.lineWidth = Math.max(2, 4 / this.scale);
      ctx.strokeRect(-2, -2, boardWidth + 4, boardHeight + 4);
      
      ctx.restore();
      return;
    }

    ctx.font = `bold ${Math.max(8, 16 * this.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numberColors = ['#000000', '#0066ff', '#2ecc71', '#e74c3c', '#4834d4', '#b71540', '#17a589', '#000000', '#7f8c8d'];

    // Batch drawing operations for better performance
    const revealedCells = [];
    const unrevealedCells = [];
    const mineCells = [];
    const flaggedCells = [];
    const questionCells = [];
    const numberCells = {};

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = this.board.cells[this.board.idx(r, c)];
        const x = c * cellSize;
        const y = r * cellSize;
        
        if (cell.revealed) {
          if (cell.mine) {
            mineCells.push({ x, y, cellSize });
          } else if (cell.adj > 0) {
            if (!numberCells[cell.adj]) numberCells[cell.adj] = [];
            numberCells[cell.adj].push({ x, y, cellSize, adj: cell.adj });
          }
          revealedCells.push({ x, y, cellSize });
        } else {
          unrevealedCells.push({ x, y, cellSize });
          if (cell.mark === 2) {
            flaggedCells.push({ x, y, cellSize });
          } else if (cell.mark === 1) {
            questionCells.push({ x, y, cellSize });
          }
        }
      }
    }

    // Draw revealed cells
    ctx.fillStyle = '#e0e0e0';
    revealedCells.forEach(({ x, y, cellSize }) => {
      ctx.fillRect(x, y, cellSize, cellSize);
    });

    // Draw unrevealed cells
    ctx.fillStyle = '#c0c0c0';
    unrevealedCells.forEach(({ x, y, cellSize }) => {
      ctx.fillRect(x, y, cellSize, cellSize);
    });

    // Draw all borders at once
    ctx.strokeStyle = '#7b7b7b';
    ctx.lineWidth = 1;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }

    // Only draw text/symbols if zoomed in enough to be readable
    if (this.scale >= 0.2) {
      // Draw mines
      ctx.fillStyle = 'red';
      mineCells.forEach(({ x, y, cellSize }) => {
        ctx.fillText('💣', x + cellSize / 2, y + cellSize / 2);
      });

      // Draw numbers
      for (let num = 1; num <= 8; num++) {
        if (numberCells[num]) {
          ctx.fillStyle = numberColors[num];
          numberCells[num].forEach(({ x, y, cellSize }) => {
            ctx.fillText(num, x + cellSize / 2, y + cellSize / 2);
          });
        }
      }

      // Draw flags
      ctx.fillStyle = 'black';
      flaggedCells.forEach(({ x, y, cellSize }) => {
        ctx.fillText('🚩', x + cellSize / 2, y + cellSize / 2);
      });

      // Draw question marks
      ctx.fillStyle = '#555';
      questionCells.forEach(({ x, y, cellSize }) => {
        ctx.fillText('?', x + cellSize / 2, y + cellSize / 2);
      });
    }

    // Draw board boundary - prominent border around the entire game board
    ctx.strokeStyle = '#d63031'; // Red border for clear visibility
    ctx.lineWidth = Math.max(3, 6 / this.scale); // Adaptive line width based on zoom
    ctx.strokeRect(-2, -2, boardWidth + 4, boardHeight + 4);
    
    // Add inner shadow effect for better depth perception
    ctx.strokeStyle = '#2d3436'; // Dark inner border
    ctx.lineWidth = Math.max(1, 2 / this.scale);
    ctx.strokeRect(-1, -1, boardWidth + 2, boardHeight + 2);

    ctx.restore();
  }
} 