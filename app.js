/* UI controller: owns board editing, scheduling, statistics and DOM rendering. */
(function () {
  'use strict';
  const { AStarSearch, createScenario } = window.Pathfinding;
  const ROWS = 25, COLUMNS = 25;
  const $ = id => document.getElementById(id);
  const grid = $('grid');
  const cells = [];
  let board = createScenario('empty');
  let search = null;
  let running = false;
  let timer = null;
  let algorithmMs = 0;
  let selected = null;
  let pathVisible = new Set();
  let pathIndex = 0;
  let painting = false;
  let paintValue = true;
  let lastPainted = null;

  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    for (let c = 0; c < COLUMNS; c++) {
      const id = r * COLUMNS + c;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.id = id;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', r + 1);
      cell.setAttribute('aria-colindex', c + 1);
      cell.tabIndex = id === 0 ? 0 : -1;
      row.appendChild(cell);
      cells.push(cell);
    }
    grid.appendChild(row);
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = null;
    running = false;
  }

  function isComplete() {
    return search && (search.status === 'no-path' ||
      (search.status === 'found' && pathIndex >= search.path.length));
  }

  function resetSearch() {
    stopTimer();
    search = null;
    algorithmMs = 0;
    pathVisible = new Set();
    pathIndex = 0;
  }

  function ensureSearch() {
    if (!search) search = new AStarSearch(ROWS, COLUMNS, board.walls, board.start, board.goal);
  }

  // Search timing includes only step(), which also reconstructs the path on success.
  function advanceSearch() {
    const before = performance.now();
    search.step();
    algorithmMs += performance.now() - before;
  }

  function revealEntirePath() {
    pathVisible = new Set(search.path);
    pathIndex = search.path.length;
  }

  function animationTick() {
    timer = null;
    if (!running) return;
    if (search.status === 'searching') advanceSearch();
    else if (search.status === 'found' && pathIndex < search.path.length) {
      pathVisible.add(search.path[pathIndex++]);
    }
    if (isComplete()) stopTimer();
    render();
    if (running) schedule();
  }

  function schedule() {
    // One iteration per task yields to the browser, even on unreachable boards.
    const delay = Math.round(5 + (100 - Number($('speed').value)) * 3);
    timer = setTimeout(animationTick, delay);
  }

  function run() {
    if (running) return;
    if (isComplete()) resetSearch();
    ensureSearch();
    running = true;
    render();
    schedule();
  }

  function step() {
    stopTimer(); // A step while paused continues the same instance.
    if (isComplete()) resetSearch();
    ensureSearch();
    if (search.status === 'searching') advanceSearch();
    // Reconstruction is part of the goal iteration, so Step never plays animation frames.
    if (search.status === 'found') revealEntirePath();
    render();
  }

  function statusText() {
    if (!search) return 'Ready';
    if (search.status === 'no-path') return 'No path exists';
    if (search.status === 'found') return isComplete() ? 'Shortest path found' : (running ? 'Tracing shortest path' : 'Path tracing paused');
    return running ? 'Searching' : 'Paused · ready to step';
  }

  function renderInspector() {
    if (selected === null) {
      $('coordinates').textContent = 'Select a cell to inspect it.';
      for (const key of ['g', 'h', 'f']) $(key).textContent = '—';
      $('cell-state').textContent = 'Coordinates use (row, column), starting at 0.';
      return;
    }
    $('coordinates').textContent = `Row ${Math.floor(selected / COLUMNS)}, column ${selected % COLUMNS}`;
    const node = search?.nodes[selected];
    for (const key of ['g', 'h', 'f']) {
      const value = node?.[key];
      $(key).textContent = value !== null && Number.isFinite(value) ? value : '—';
    }
    $('cell-state').textContent = `${cellDescription(selected)}. ${node && Number.isFinite(node.g) ? 'Scores calculated for this search.' : 'Scores have not been calculated.'}`;
  }

  function cellDescription(id) {
    if (id === board.start) return 'Start';
    if (id === board.goal) return 'Destination';
    if (board.walls[id]) return 'Obstacle';
    if (pathVisible.has(id)) return 'Final path';
    const state = search?.nodes[id].state;
    return state === 'closed' ? 'Explored' : state === 'open' ? 'Frontier' : 'Unvisited';
  }

  function render() {
    for (let id = 0; id < cells.length; id++) {
      const nodeState = search?.nodes[id].state;
      const type = id === board.start ? 'start' : id === board.goal ? 'goal' : board.walls[id] ? 'wall' : pathVisible.has(id) ? 'path' : nodeState || '';
      cells[id].className = `cell ${type}${id === selected ? ' selected' : ''}${search?.current === id ? ' current' : ''}`;
      cells[id].textContent = id === board.start ? 'S' : id === board.goal ? 'D' : '';
      const description = `${Math.floor(id / COLUMNS)}, ${id % COLUMNS}: ${cellDescription(id)}`;
      cells[id].setAttribute('aria-label', description);
      cells[id].setAttribute('aria-selected', String(id === selected));
      cells[id].title = description;
    }
    const text = statusText();
    // Only write live status when it changes, to avoid announcing every iteration.
    if ($('status').textContent !== text) $('status').textContent = text;
    $('status').dataset.kind = search?.status === 'no-path' ? 'failure' : isComplete() ? 'success' : '';
    $('explored').textContent = search?.explored ?? 0;
    $('length').textContent = search?.status === 'found' ? search.path.length - 1 : '—';
    $('time').textContent = algorithmMs.toFixed(3);
    $('run').disabled = running;
    $('run').textContent = isComplete() ? 'Run Again' : 'Run A*';
    $('step').disabled = running;
    $('pause').disabled = !search || isComplete();
    $('pause').textContent = running || !search ? 'Pause' : 'Resume';
    const locked = Boolean(search && !isComplete());
    $('tool').disabled = locked;
    $('edit-hint').textContent = locked ? 'Board editing is locked during a search. You can inspect cells, step, or reset the path.' : 'Drag to draw walls. Start on a wall to erase. Choose an endpoint tool to move S or D.';
    renderInspector();
  }

  function selectCell(id) {
    if (selected !== null) cells[selected].tabIndex = -1;
    selected = id;
    cells[id].tabIndex = 0;
  }

  function editCell(id, first) {
    selectCell(id);
    if (search && !isComplete()) { render(); return; }
    const tool = $('tool').value;
    if (tool === 'inspect') { render(); return; }
    if (tool === 'wall') {
      if (id === board.start || id === board.goal) { render(); return; }
      if (first) paintValue = !board.walls[id];
      if (board.walls[id] !== paintValue) {
        resetSearch();
        board.walls[id] = paintValue;
      }
    } else if (first) {
      const other = tool === 'start' ? board.goal : board.start;
      if (id !== other) {
        resetSearch();
        board.walls[id] = false;
        board[tool] = id;
      }
    }
    render();
  }

  grid.addEventListener('pointerdown', event => {
    const cell = event.target.closest('[data-id]');
    if (!cell || event.button !== 0) return;
    event.preventDefault();
    const id = Number(cell.dataset.id);
    painting = true;
    lastPainted = id;
    editCell(id, true);
    cell.focus({ preventScroll: true });
  });
  // Hit-testing permits mouse and touch dragging without moving the page.
  window.addEventListener('pointermove', event => {
    if (!painting || $('tool').value !== 'wall') return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('#grid [data-id]');
    if (!cell) return;
    const id = Number(cell.dataset.id);
    if (id !== lastPainted) { lastPainted = id; editCell(id, false); }
  });
  for (const eventName of ['pointerup', 'pointercancel', 'blur']) {
    window.addEventListener(eventName, () => { painting = false; lastPainted = null; });
  }
  grid.addEventListener('keydown', event => {
    const cell = event.target.closest('[data-id]');
    if (!cell) return;
    const id = Number(cell.dataset.id), r = Math.floor(id / COLUMNS), c = id % COLUMNS;
    let target = id;
    if (event.key === 'ArrowUp' && r > 0) target -= COLUMNS;
    if (event.key === 'ArrowDown' && r < ROWS - 1) target += COLUMNS;
    if (event.key === 'ArrowLeft' && c > 0) target--;
    if (event.key === 'ArrowRight' && c < COLUMNS - 1) target++;
    if (event.key.startsWith('Arrow')) {
      event.preventDefault(); selectCell(target); cells[target].focus(); render();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); editCell(id, true);
    }
  });

  $('run').addEventListener('click', run);
  $('step').addEventListener('click', step);
  $('pause').addEventListener('click', () => {
    if (running) { stopTimer(); render(); } else run();
  });
  $('reset').addEventListener('click', () => { resetSearch(); render(); });
  $('clear').addEventListener('click', () => {
    resetSearch(); board = createScenario('empty'); selected = null;
    $('scenario').value = 'empty';
    cells.forEach((cell, id) => { cell.tabIndex = id === 0 ? 0 : -1; });
    render();
  });
  $('load').addEventListener('click', () => {
    resetSearch(); board = createScenario($('scenario').value); render();
  });
  $('maze').addEventListener('click', () => {
    resetSearch();
    // Random obstacle field; deliberately no solvability guarantee.
    board.walls = board.walls.map((_, id) => id !== board.start && id !== board.goal && Math.random() < 0.28);
    render();
  });
  $('speed').addEventListener('input', () => {
    $('speed-value').value = $('speed').value;
    if (running) { clearTimeout(timer); schedule(); }
  });
  render();
})();
