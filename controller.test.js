'use strict';
// DOM/timer harness runs the actual app.js handlers without external dependencies.
// It verifies controller behavior, not browser layout or native pointer behavior.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const algorithm = require('../algorithm.js');

function setup() {
  class Element {
    constructor() { this.children = []; this.attributes = {}; this.dataset = {}; this.listeners = {}; this.value = ''; this.textContent = ''; this.disabled = false; }
    appendChild(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    closest() { return this; }
    focus() {}
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  get('speed').value = '100'; get('tool').value = 'wall'; get('scenario').value = 'empty';
  const timers = new Map(); let nextTimer = 0;
  const instances = [];
  class ObservedSearch extends algorithm.AStarSearch {
    constructor(...args) { super(...args); instances.push(this); }
  }
  const window = { Pathfinding: { ...algorithm, AStarSearch: ObservedSearch }, addEventListener() {} };
  const context = vm.createContext({ window, document: { getElementById: get, createElement: () => new Element() },
    performance, setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  const click = id => { assert.equal(get(id).disabled, false, `${id} must be enabled`); get(id).listeners.click(); };
  const tick = () => { const entry = timers.entries().next().value; if (entry) { timers.delete(entry[0]); entry[1](); } };
  const drain = () => { let count = 0; while (timers.size) { tick(); assert.ok(++count < 1300, 'Animation must terminate'); } };
  const cell = id => get('grid').children[Math.floor(id / 25)].children[id % 25];
  const pointer = id => get('grid').listeners.pointerdown({ target: cell(id), button: 0, preventDefault() {} });
  return { get, click, tick, drain, timers, instances, cell, pointer };
}

test('Step, Run, pause, another Step and Resume share one algorithm state', () => {
  const ui = setup();
  ui.click('step');
  const search = ui.instances[0];
  assert.equal(search.explored, 1);
  ui.click('run'); ui.tick(); ui.click('pause');
  assert.equal(search.explored, 2);
  assert.equal(ui.timers.size, 0);
  ui.click('step');
  assert.equal(search.explored, 3);
  ui.click('pause'); ui.drain();
  assert.equal(ui.instances.length, 1);
  assert.equal(search.status, 'found');
  assert.equal(ui.get('length').textContent, 40);
  assert.equal(ui.get('status').textContent, 'Shortest path found');
});

test('Reset cancels pending work, preserves walls, clears scores and supports repeated runs', () => {
  const ui = setup();
  ui.pointer(0);
  ui.click('run'); ui.tick(); ui.click('reset');
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.get('explored').textContent, 0);
  assert.match(ui.cell(0).className, /wall/);
  ui.click('run'); ui.drain();
  assert.equal(ui.instances.length, 2);
  const oldPath = ui.instances[1].path;
  ui.click('run'); ui.drain();
  assert.deepEqual(ui.instances[2].path, oldPath);
  assert.equal(ui.get('status').textContent, 'Shortest path found');
});

test('Board edits are locked in progress, inspection remains usable, endpoints stay walkable', () => {
  const ui = setup();
  ui.pointer(52); // Start cannot become a wall.
  assert.match(ui.cell(52).className, /start/);
  ui.click('step'); ui.pointer(0);
  assert.equal(ui.instances[0].walls[0], false);
  assert.doesNotMatch(ui.cell(0).className, /wall/);
  ui.pointer(52);
  assert.equal(ui.get('g').textContent, 0);
  ui.click('reset'); ui.pointer(0);
  assert.match(ui.cell(0).className, /wall/);
  ui.get('tool').value = 'start'; ui.pointer(0);
  assert.match(ui.cell(0).className, /start/);
  ui.click('step'); assert.equal(ui.instances.at(-1).start, 0);
  assert.equal(ui.instances.at(-1).walls[0], false);
});

test('Unreachable Run terminates, releases controls and can be cleared and run again', () => {
  const ui = setup();
  ui.get('scenario').value = 'blocked'; ui.click('load');
  ui.click('run'); ui.drain();
  assert.equal(ui.get('status').textContent, 'No path exists');
  assert.equal(ui.get('pause').disabled, true);
  assert.equal(ui.get('tool').disabled, false);
  assert.equal(ui.get('run').disabled, false);
  ui.click('clear'); ui.click('run'); ui.drain();
  assert.equal(ui.get('status').textContent, 'Shortest path found');
});

test('Step at goal reconstructs the real path; reset during path animation cancels it', () => {
  const ui = setup();
  ui.get('scenario').value = 'close'; ui.click('load');
  ui.click('step'); ui.click('step');
  assert.equal(ui.get('status').textContent, 'Shortest path found');
  assert.equal(ui.get('length').textContent, 1);
  ui.get('scenario').value = 'empty'; ui.click('load'); ui.click('run');
  while (ui.instances.at(-1).status === 'searching') ui.tick();
  assert.equal(ui.get('status').textContent, 'Tracing shortest path');
  ui.click('reset'); ui.drain();
  assert.equal(ui.get('status').textContent, 'Ready');
  assert.equal(ui.get('length').textContent, '—');
});

test('Random maze protects endpoints and clears an active search', () => {
  const ui = setup(); ui.click('run'); ui.tick(); ui.click('maze');
  assert.equal(ui.get('status').textContent, 'Ready');
  assert.equal(ui.timers.size, 0);
  ui.click('step');
  const search = ui.instances.at(-1);
  assert.equal(search.walls[search.start], false);
  assert.equal(search.walls[search.goal], false);
});
