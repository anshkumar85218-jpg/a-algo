/* Pure algorithm module: no DOM, timers, or rendering. Also loadable by Node tests. */
(function (root) {
  'use strict';

  function manhattan(a, b, columns) {
    return Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) +
      Math.abs(a % columns - b % columns);
  }

  class AStarSearch {
    constructor(rows, columns, walls, start, goal) {
      const size = rows * columns;
      if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 ||
          walls.length !== size || !Number.isInteger(start) || !Number.isInteger(goal) ||
          start < 0 || start >= size || goal < 0 || goal >= size || walls[start] || walls[goal]) {
        throw new Error('Provide valid grid dimensions and walkable endpoints.');
      }
      this.rows = rows;
      this.columns = columns;
      this.walls = Array.from(walls, Boolean); // Snapshot protects an active search from edits.
      this.start = start;
      this.goal = goal;
      this.nodes = Array.from({ length: size }, (_, id) => ({
        id, g: Infinity, h: null, f: Infinity, parent: null, state: 'unseen'
      }));
      // A small grid benefits from a readable array-based priority queue.
      // The frontier contains each open node exactly once; step() scans for minimum f.
      this.frontier = [start];
      Object.assign(this.nodes[start], { g: 0, h: manhattan(start, goal, columns),
        f: manhattan(start, goal, columns), state: 'open' });
      this.status = 'searching';
      this.explored = 0;
      this.path = [];
      this.current = null;
    }

    neighbors(id) {
      const row = Math.floor(id / this.columns);
      const column = id % this.columns;
      const result = [];
      if (row > 0) result.push(id - this.columns);
      if (column < this.columns - 1) result.push(id + 1);
      if (row < this.rows - 1) result.push(id + this.columns);
      if (column > 0) result.push(id - 1);
      return result;
    }

    popLowestF() {
      let best = 0;
      for (let i = 1; i < this.frontier.length; i++) {
        const candidate = this.nodes[this.frontier[i]];
        const incumbent = this.nodes[this.frontier[best]];
        // Lower h breaks f ties toward the goal; insertion order resolves full ties.
        if (candidate.f < incumbent.f ||
            (candidate.f === incumbent.f && candidate.h < incumbent.h)) best = i;
      }
      return this.frontier.splice(best, 1)[0];
    }

    reconstructPath(end) {
      const path = [];
      for (let id = end; id !== null; id = this.nodes[id].parent) path.push(id);
      return path.reverse();
    }

    // Exactly one real A* iteration; both UI Step and animated Run call this method.
    step() {
      if (this.status !== 'searching') return { status: this.status, current: this.current };
      if (this.frontier.length === 0) {
        this.status = 'no-path';
        return { status: this.status, current: this.current };
      }
      const id = this.popLowestF();
      const current = this.nodes[id];
      this.current = id;
      current.state = 'closed';
      this.explored++;

      // Stop when the goal is selected, not merely when it is first discovered.
      if (id === this.goal) {
        this.path = this.reconstructPath(id);
        this.status = 'found';
        return { status: this.status, current: id };
      }
      for (const neighborId of this.neighbors(id)) {
        const neighbor = this.nodes[neighborId];
        // Consistent Manhattan heuristic + unit costs make closed nodes final.
        if (this.walls[neighborId] || neighbor.state === 'closed') continue;
        const tentative = current.g + 1;
        if (tentative < neighbor.g) {
          neighbor.parent = id;
          neighbor.g = tentative;
          neighbor.h = manhattan(neighborId, this.goal, this.columns);
          neighbor.f = neighbor.g + neighbor.h;
          if (neighbor.state !== 'open') {
            neighbor.state = 'open';
            this.frontier.push(neighborId);
          }
          // Already-open entries use the changed score on the next minimum scan.
        }
      }
      if (this.frontier.length === 0) this.status = 'no-path';
      return { status: this.status, current: id };
    }
  }

  function createScenario(name, rows = 25, columns = 25) {
    if (rows !== 25 || columns !== 25) throw new Error('Examples use a 25 × 25 board.');
    const walls = Array(rows * columns).fill(false);
    const at = (r, c) => r * columns + c;
    let start = at(2, 2);
    let goal = at(22, 22);
    if (name === 'gap') {
      for (let r = 0; r < rows; r++) if (r !== 12) walls[at(r, 12)] = true;
    } else if (name === 'blocked') {
      for (const [r, c] of [[21, 22], [23, 22], [22, 21], [22, 23]]) walls[at(r, c)] = true;
    } else if (name === 'close') {
      start = at(12, 12); goal = at(12, 13);
    } else if (name === 'detour') {
      start = at(2, 2); goal = at(2, 22);
      for (let r = 0; r < 22; r++) walls[at(r, 8)] = true;
    } else if (name !== 'empty') throw new Error('Unknown example.');
    return { walls, start, goal };
  }

  const api = { AStarSearch, manhattan, createScenario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pathfinding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
