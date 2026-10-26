# A* Pathfinding Visualizer

A college mini-project that implements and animates real A* search using HTML, CSS and vanilla JavaScript. No libraries, installation, internet connection or build step are needed to run the application.

## Run locally

1. Keep `index.html`, `styles.css`, `algorithm.js` and `app.js` in the same folder.
2. Double-click **index.html** to open it in a modern browser such as Chrome, Edge or Firefox.
3. Load an example and select **Run A*** or **Step**.

The scripts are ordinary deferred scripts, so the application works through a `file://` URL. No module server is required. Refreshing the browser restores the empty board; boards are not saved.

Optional HTTP server, if Python is already installed:

```powershell
cd 'D:\A star_algo'
python -m http.server 8000 --bind 127.0.0.1
```

Then visit <http://127.0.0.1:8000>. Stop the server with Ctrl+C. Python is optional, not an application dependency.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Controls, board container, statistics, legend, explanation and test checklist |
| `styles.css` | Responsive layout and cell colors |
| `algorithm.js` | Pure A* implementation, Manhattan distance and demonstration boards |
| `app.js` | Board input, animation, rendering, inspection and control lifecycle |
| `tests/algorithm.test.js` | Algorithm and optimality checks with independent BFS |
| `tests/controller.test.js` | Actual UI controller tested with a small DOM and timer harness |
| `PROJECT_REPORT.md` | Detailed project explanation, function guide, demonstration script and viva answers |
| `TEST_CHECKLIST.md` | Reproducible manual tests and verification boundaries |

## Controls and usage

- **Draw / erase walls:** click or drag on empty cells to paint walls. Begin a drag on an existing wall to erase. Start and destination are protected.
- **Place start / Place destination:** select the tool, then click a cell. The other endpoint cannot be overwritten. A wall at the new position is removed.
- **Inspect only:** click any cell to see its zero-based row/column and available g, h, f scores without editing the board. During an unfinished search, all cell clicks inspect automatically.
- **Run A*:** starts the search or continues the existing paused/stepped search. After completion, **Run Again** starts a fresh search on the same board.
- **Step:** performs exactly one A* iteration on the existing search. It is disabled while Run is active. Pause first to step manually. The goal iteration reconstructs and displays the full path. Pressing Step after completion starts a fresh search.
- **Pause / Resume:** stops or restarts scheduling without losing scores, parents, frontier or path progress. It works during path tracing too.
- **Reset Path:** cancels pending work and clears search scores, colors and statistics. Obstacles and endpoints stay in place.
- **Clear Board:** cancels the search, removes obstacles and restores default endpoints `(2, 2)` and `(22, 22)`.
- **Generate Random Maze:** replaces obstacles using an independent 28% wall probability per non-endpoint cell. This is a random obstacle field; it is not a perfect-maze generator and may be unsolvable.
- **Load example:** loads the selected board and resets the search. The five example lengths appear in the checklist.
- **Speed:** larger values reduce the delay between iterations. It changes visualization speed, not edge costs or algorithm decisions. Execution time excludes these delays.

Editing is locked while a search or path tracing is unfinished, including when paused. Use Reset Path to edit. Clear Board, loading an example and random generation deliberately replace/reset the current search. Editing a completed board invalidates its old results and resets the search.

Keyboard: Tab to the grid, use arrow keys to move the selected cell, and Enter/Space to apply the selected tool. Select Inspect only to examine completed scores without changing obstacles. A narrow screen can horizontally scroll the board.

## Algorithm overview

The grid is an unweighted graph: each walkable cell is a vertex and each up/right/down/left connection costs 1. A cell ID is `row * 25 + column`.

Each node stores `g`, `h`, `f`, `parent` and `state`. Undiscovered nodes use `g = Infinity`, `h = null`, `f = Infinity`, `parent = null`, and `state = 'unseen'`. A* starts with only the start in its frontier.

`AStarSearch.step()` removes the node with minimum f, breaking ties with lower h and then insertion order. If it is the destination, it reconstructs the path through parents. Otherwise it closes the node, examines valid neighbors and updates each neighbor only when `current.g + 1` improves its g score. Open nodes have their existing entry updated rather than duplicated. An empty frontier means no path.

The frontier is a clearly implemented array-based priority queue: minimum selection and removal take O(V) time in the worst case. This favors understandable code on a 625-cell board. Overall search is O(V² + E), or O(V²) on this grid, with O(V) memory. A binary heap would improve large-grid performance but is not used here.

The heuristic is `|row - goalRow| + |column - goalColumn|`. For unit-cost four-direction movement it is admissible and consistent; closed nodes do not need reopening. A* stops when it **removes** the goal from the frontier and therefore returns a shortest path. Do not add diagonals, weights or a heuristic multiplier without reviewing these assumptions.

`app.js` never computes a substitute path. Both its manual and timed controls call `advanceSearch()`, which calls the same object's `step()`. Timed rendering reveals the reconstructed path after the goal iteration; this final visual reveal is separate from searching.

## Statistics

- **Explored nodes:** nodes removed from the frontier, including the destination when found.
- **Path length:** number of moves, `path.length - 1`; endpoints count as path cells but not extra moves. A missing result is shown as a dash.
- **Execution time:** accumulated `performance.now()` differences around `search.step()`, including reconstruction. It excludes rendering, search construction, waiting and animation. Small values may round to zero and vary across machines; this is an illustrative timer, not a benchmark.
- **Status:** Ready, Searching, Paused, Tracing shortest path, Shortest path found or No path exists.

## Verification

Optional development tests require Node.js (built-in modules only):

```powershell
node --check algorithm.js
node --check app.js
node --test tests/algorithm.test.js tests/controller.test.js
```

The delivered version passed these syntax checks and all **16 tests**, including optimal distances on **250 seeded random boards** compared with an independent BFS implementation. The controller tests execute the real `app.js` in a DOM/timer harness, checking shared Step/Run state, pause/resume, resets, editing locks, unreachable completion and repeated runs.

Browser checks also confirmed all five example outcomes, repeated detour runs after reset, actual cell painting/erasing, start-score inspection, and pause → Step → Resume. The blocked board completed and re-enabled Run; the browser reported no warning/error console entries during these checks. Desktop layout was visually inspected. See `TEST_CHECKLIST.md` for details and remaining rehearsal checks, including touch and your own presentation browser.

For presentation preparation, read **PROJECT_REPORT.md**, especially “Functions to study” and “Five-minute demonstration.”
