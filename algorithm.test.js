'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AStarSearch, manhattan, createScenario } = require('../algorithm.js');

function finish(search) {
  let iterations = 0;
  while (search.status === 'searching') {
    search.step();
    assert.ok(++iterations <= search.nodes.length, 'Finite grid must terminate');
  }
  return search;
}

// Independent breadth-first search is the optimal-distance oracle for unit costs.
function bfs(rows, columns, walls, start, goal) {
  const queue = [start], distances = Array(rows * columns).fill(-1);
  distances[start] = 0;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head], r = Math.floor(id / columns), c = id % columns;
    if (id === goal) return distances[id];
    for (const [nr, nc] of [[r - 1, c], [r, c + 1], [r + 1, c], [r, c - 1]]) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= columns) continue;
      const next = nr * columns + nc;
      if (walls[next] || distances[next] !== -1) continue;
      distances[next] = distances[id] + 1;
      queue.push(next);
    }
  }
  return -1;
}

function validatePath(search) {
  assert.equal(search.path[0], search.start);
  assert.equal(search.path.at(-1), search.goal);
  assert.equal(search.nodes[search.goal].g, search.path.length - 1);
  search.path.forEach((id, i) => {
    assert.equal(search.walls[id], false);
    if (i) {
      assert.equal(manhattan(search.path[i - 1], id, search.columns), 1);
      assert.equal(search.nodes[id].parent, search.path[i - 1]);
    }
  });
}

for (const [name, length] of [['empty', 40], ['gap', 40], ['blocked', -1], ['close', 1], ['detour', 60]]) {
  test(`Example: ${name}`, () => {
    const board = createScenario(name);
    const search = finish(new AStarSearch(25, 25, board.walls, board.start, board.goal));
    assert.equal(bfs(25, 25, board.walls, board.start, board.goal), length);
    assert.equal(search.status, length < 0 ? 'no-path' : 'found');
    if (length >= 0) { assert.equal(search.path.length - 1, length); validatePath(search); }
    else assert.deepEqual(search.path, []);
    const explored = search.explored;
    search.step();
    assert.equal(search.explored, explored, 'Completed step is a no-op');
  });
}

test('One step expands one node, calculates scores and maintains unique frontier entries', () => {
  const board = createScenario('empty');
  const search = new AStarSearch(25, 25, board.walls, board.start, board.goal);
  search.step();
  assert.equal(search.explored, 1);
  assert.equal(search.nodes[board.start].state, 'closed');
  assert.equal(search.frontier.length, 4);
  while (search.status === 'searching') {
    assert.equal(new Set(search.frontier).size, search.frontier.length);
    for (const id of search.frontier) {
      const n = search.nodes[id];
      assert.equal(n.state, 'open');
      assert.equal(n.f, n.g + n.h);
      assert.equal(n.h, manhattan(id, board.goal, 25));
    }
    search.step();
  }
});

test('Start equals goal and isolated start terminate correctly', () => {
  const trivial = finish(new AStarSearch(1, 1, [false], 0, 0));
  assert.deepEqual(trivial.path, [0]);
  const isolated = finish(new AStarSearch(2, 2, [false, true, true, false], 0, 3));
  assert.equal(isolated.status, 'no-path');
  assert.equal(isolated.explored, 1);
});

test('Neighbor boundaries cannot wrap between rows; walls are copied', () => {
  const walls = Array(6).fill(false);
  const search = new AStarSearch(2, 3, walls, 0, 5);
  assert.deepEqual(search.neighbors(2), [5, 1]);
  walls[1] = true;
  assert.equal(search.walls[1], false);
});

test('250 seeded boards match independent BFS optimal distances', () => {
  let seed = 123456;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 250; i++) {
    const walls = Array.from({ length: 625 }, () => random() < 0.3);
    const start = Math.floor(random() * 625), goal = Math.floor(random() * 625);
    walls[start] = walls[goal] = false;
    const expected = bfs(25, 25, walls, start, goal);
    const search = finish(new AStarSearch(25, 25, walls, start, goal));
    assert.equal(search.status, expected < 0 ? 'no-path' : 'found', `Board ${i}`);
    if (expected >= 0) { assert.equal(search.path.length - 1, expected, `Board ${i}`); validatePath(search); }
  }
});

test('Fresh runs do not reuse previous scores or parents', () => {
  const board = createScenario('detour');
  const a = finish(new AStarSearch(25, 25, board.walls, board.start, board.goal));
  const b = finish(new AStarSearch(25, 25, board.walls, board.start, board.goal));
  assert.deepEqual(a.path, b.path);
  assert.equal(a.explored, b.explored);
});
