# A* Pathfinding Visualizer — detailed project report

## 1. Project summary

This mini-project demonstrates how the A* search algorithm finds a shortest route across a two-dimensional grid containing obstacles. The application is written in HTML, CSS and vanilla JavaScript and runs locally in a browser. It uses a real search implementation; the displayed exploration comes from changes to the actual algorithm state.

The board contains 25 rows and 25 columns, giving 625 cells. The green S cell is the start and the red D cell is the destination. A user can draw obstacles, move endpoints, inspect calculated scores and watch the search automatically or advance it one iteration at a time.

The project has two purposes: demonstrate a working pathfinding algorithm and make its internal decisions understandable. Keeping the algorithm separate from the interface allows the student to explain, test and modify the search without having to understand all DOM code first.

## 2. Problem statement and objectives

Given a start cell, a destination cell and a set of blocked cells, find a route with the fewest valid moves, or report that no such route exists.

The objectives are to:

1. Implement A* from scratch with explicit scores, parents and a frontier.
2. Use Manhattan distance with four-directional, unit-cost movement.
3. Show the difference between discovered/frontier cells, explored cells and the final path.
4. Make Step and Run operate on the same state.
5. Support safe resets, repeated runs, obstacle editing and unreachable destinations.
6. Explain the algorithm through on-page teaching material and this report.

This is an educational grid model. It does not model real-world road distances, traffic, robot dimensions, dynamic obstacles or weighted terrain.

## 3. Technologies and responsibilities

| Technology | Responsibility |
| --- | --- |
| HTML | Declares buttons, selectors, statistics, inspector, legend and learning panels |
| CSS | Defines the layout, responsive behavior, typography and cell states |
| JavaScript | Implements search, handles events, schedules animation and updates the DOM |
| Browser APIs | DOM operations, pointer/keyboard events, `setTimeout()` and `performance.now()` |
| Node.js, optional | Runs development tests using built-in test/assert/VM modules |

There are no third-party runtime libraries or APIs. All application assets are local. Node and Python are optional development conveniences; neither is required for opening `index.html` directly.

## 4. User interface and workflow

The main workflow is: prepare a board, start or step the search, examine exploration and scores, observe the path or no-path result, then reset or change the board.

Cells are shown using these colors:

| State | Color | Meaning |
| --- | --- | --- |
| Start | Green, S | Initial vertex |
| Destination | Red, D | Target vertex |
| Obstacle | Dark gray | Cannot be traversed |
| Explored | Pale blue | Removed from frontier and processed |
| Frontier | Teal | Discovered and waiting for processing |
| Final path | Yellow | Belongs to the reconstructed route |
| Unvisited | White | Not yet discovered |

S and D keep their colors when they belong to the path. An outline marks the current algorithm node; another marks the selected inspector cell. Colors display state but do not determine search decisions.

The speed slider affects only the interval between tasks. It does not change g, h, f or the returned route. The random-maze button creates a random obstacle field with a 28% probability for each non-endpoint cell. This can produce disconnected boards; solvability is intentionally not guaranteed.

For inspecting a completed search, choose **Inspect only** before clicking cells. The wall tool changes the board and invalidates its previous search. During an unfinished search, editing is locked and clicking automatically inspects.

## 5. Modeling the grid as a graph

In graph terminology, a vertex is a walkable cell. An edge connects two walkable cells that share an upper, lower, left or right side. Each edge has weight 1. Diagonal movement is excluded.

The implementation uses a one-dimensional ID rather than a nested array:

```js
id = row * columns + column;
row = Math.floor(id / columns);
column = id % columns;
```

For example, on this 25-column board, `(2, 2)` is ID 52. `(22, 22)` is ID 572. IDs simplify arrays, parent links and obstacle lookup. `walls[id]` is true if that cell is blocked.

Boundary checks are essential. A numeric `id + 1` is a right neighbor only when the current column is less than 24. Otherwise it would incorrectly wrap to the next row. `neighbors()` checks row and column bounds before producing neighbors.

## 6. A* scores

The evaluation formula is:

```text
f(n) = g(n) + h(n)
```

**g(n)** is the best known cost of reaching node n from the start. Since every move costs 1, it is a move count. Before discovery, g is Infinity. This lets the first real route improve it without special-case comparison logic.

**h(n)** estimates the remaining cost to the goal. This project uses Manhattan distance:

```text
h(n) = |row(n) - row(goal)| + |column(n) - column(goal)|
```

**f(n)** is the estimated total cost of a route through n. A* prioritizes the frontier node with the smallest f. This combines the route already paid for and the estimate of what remains.

Example: the default start `(2, 2)` has g = 0, h = 40, f = 40. Its right neighbor `(2, 3)` has g = 1, h = 39, f = 40 after the start is expanded. Many cells may have the same f; this is normal.

These values are best-known search information. A node that has not been discovered has no calculated heuristic in this implementation, so the inspector shows dashes instead of displaying Infinity or making up scores.

## 7. Why Manhattan distance gives an optimal result here

Each valid move changes exactly one coordinate by 1. Without obstacles, reaching the goal requires exactly the absolute row difference plus the absolute column difference. Obstacles can force additional moves, but cannot reduce that distance.

This means Manhattan distance is **admissible**: it never overestimates the true shortest remaining cost.

It is also **consistent**. For neighboring cells n and m with unit edge cost, `h(n) <= 1 + h(m)`. Once a node with minimum f is removed from the frontier, its g is final under these assumptions. Therefore this implementation can skip already-closed neighbors without reopening them.

A* declares success when the goal is removed as the lowest-priority node, not as soon as it is discovered. At that point the reconstructed route has optimal cost. More than one shortest path can exist, so a valid implementation does not need to return the same route as another implementation with different tie-breaking.

Changing the movement rules requires revisiting this argument. Allowing a diagonal of cost 1 makes Manhattan distance overestimate in some cases. Adding weighted terrain requires replacing `current.g + 1` with the actual edge cost and checking the heuristic against those costs.

## 8. Data structures

Every entry in `search.nodes` is a plain object:

```js
{
  id,                 // Unique grid cell ID
  g: Infinity,        // Best known start-to-node cost
  h: null,            // Heuristic, calculated on discovery
  f: Infinity,        // g + h
  parent: null,       // Previous node on the current best route
  state: 'unseen'     // unseen, open or closed
}
```

`frontier` stores IDs of open nodes. It is an array-based priority queue with explicit minimum selection. `popLowestF()` scans the array and removes its best entry using `splice()`.

The ordering is lowest f, then lowest h, then original insertion order. Lower h is a deterministic tie-breaker toward the destination. It does not replace the primary minimum-f rule and does not harm optimality.

Every open node occurs exactly once. If a better route to an open node is discovered, its node object is updated. The next scan automatically sees the new score; there is no stale queue entry and no separate decrease-key operation.

`path` stores the ordered IDs from start to destination after success. `current` stores the last node selected. `status` is `searching`, `found` or `no-path`. `explored` counts selected nodes, including the goal. The algorithm copies the obstacle array when constructed so it owns a stable board snapshot.

## 9. A complete algorithm iteration

`AStarSearch.step()` is the core of the project. Read it carefully before presenting.

1. If the search is already finished, return without modifying it.
2. If the frontier is empty, set the status to `no-path`.
3. Remove the frontier entry with the lowest f score.
4. Record it as current, mark it closed and increment explored count.
5. If it is the destination, reconstruct the path and set status to `found`.
6. Otherwise, obtain its in-bounds four-directional neighbors.
7. Ignore obstacle cells and closed nodes.
8. Calculate `tentative = current.g + 1`.
9. If tentative improves the neighbor's g, update its parent, g, h and f.
10. If it is newly discovered, mark it open and append it to the frontier.
11. If no frontier remains, report `no-path`; otherwise wait for the next iteration.

The strict comparison `tentative < neighbor.g` matters: a longer or equal route must not overwrite an existing better route. Each accepted parent link points to a node with a g score exactly one lower, preventing a parent cycle.

The implementation has no loop that runs the whole search inside a single UI callback. A button press or animation task calls one iteration. This exposes real intermediate state to the user.

## 10. Reconstructing the path

When the goal is selected, the algorithm follows its parent backward:

```text
goal -> parent(goal) -> ... -> start -> null
```

`reconstructPath()` pushes each ID into an array, then reverses the array. The resulting order is start to goal. It includes both endpoints.

For a route containing 41 cells there are 40 moves, so the statistics use `path.length - 1`. A trivial same-start-and-goal input, supported by the algorithm tests though the UI keeps endpoints distinct, has one path cell and zero moves.

Reconstruction uses actual parents created during relaxation. No route is hardcoded in the visualizer. Only the example obstacle layouts are predetermined.

## 11. Separation of algorithm and rendering

`algorithm.js` has no references to `document`, CSS, buttons or timers. It can be loaded by the browser or imported by Node tests. This is the module to explain when discussing A* correctness.

`app.js` creates the 625 button cells and controls interaction. It holds a `search` variable referring to the current `AStarSearch` object.

```text
Step button ───────────> step() ─────────> advanceSearch()
Run button -> timer -> animationTick() ──> advanceSearch()
                                              |
                                              v
                                        search.step()
                                              |
                                              v
                                         render()
```

`ensureSearch()` constructs a search only if none exists. Consequently, stepping once and then running continues the same object, including all scores and parent links. Pausing only cancels the pending timer; it does not throw away that object.

Once automatic search finds a path, timed tasks reveal the IDs already in `search.path`. This is a presentation of reconstruction output, not a second search. A manual Step that selects the goal reveals the full reconstructed route immediately, preserving the rule that Step advances one algorithm iteration rather than an animation frame.

`render()` maps node states to classes and updates labels. Endpoint colors take priority, followed by obstacles and path colors. The `pathVisible` set controls which part of the reconstructed path is yellow during automatic tracing.

## 12. Responsiveness, pause and reset

`setTimeout()` schedules one iteration at a time and gives control back to the browser between iterations. The delay is approximately `5 + (100 - speed) * 3` milliseconds, before browser/rendering overhead. This keeps controls available, even when hundreds of cells must be explored.

The algorithm itself is finite. Every walkable cell is closed at most once and only finitely many cells exist. If the goal is unreachable, the frontier eventually empties. The UI then stops scheduling and displays No path exists.

`stopTimer()` calls `clearTimeout()`, clears the stored handle and sets running to false. `resetSearch()` also discards scores by setting search to null, clears visible path progress and resets timing. Reset Path preserves the board. Clear Board additionally restores the default empty board.

Edits are locked while search or tracing remains unfinished, including when paused. Otherwise a wall could be drawn through a path whose scores were computed on a different board. Deliberate board replacement controls reset the search before applying the new board. Editing a completed board also clears old results.

These state transitions are tested, including reset during path tracing and repeated completed runs. JavaScript event handlers run to completion; a reset cannot interrupt halfway through `step()`, but it cancels future scheduled callbacks.

## 13. Input handling and inspection

On pointer down, the controller identifies the cell using its `data-id`. The wall tool decides whether the gesture paints or erases based on the first eligible cell's existing wall state. Pointer movement uses hit-testing to find the cell under the pointer. Pointer up, cancellation and window blur stop painting.

Endpoint tools remove a wall at the selected location and prevent overlapping start and destination. The inspector calculates displayed coordinates from the ID, then reads scores directly from `search.nodes[id]`. It does not calculate an alternative search result.

For keyboard use, the grid has one active tab stop. Arrow keys move selection without changing the board; Enter or Space applies the chosen tool. Cells have accessible row/column descriptions and status changes use a live region. These provisions are implemented, but native accessibility behavior still deserves checking in the student's browser.

## 14. Statistics and their interpretation

**Explored count** increases once per selected frontier node. It does not count all neighbors inspected or all discovered nodes. The goal is counted when selected.

**Path length** is a move count, not the number of yellow cells. It becomes available when the goal is found, even while automatic path tracing is still revealing cells.

**Execution time** accumulates measurements around `search.step()` only. It includes parent reconstruction because that happens within the goal step. It excludes DOM rendering, timer waiting, search object construction and final path coloring. It is useful for explaining what was timed, but not for making claims about comparative algorithm performance. Timer precision and machine load affect small measurements.

**Status** combines algorithm state with scheduling state. The algorithm knows searching/found/no-path; the controller additionally knows running/paused and whether path tracing has finished.

## 15. Time and space complexity

Let V be the number of grid cells and E the number of valid graph edges. On a rectangular four-directional grid, E is O(V).

This implementation scans and splices the frontier in O(V) worst-case time for every expansion. There are at most V expansions, and neighbor examination totals O(E). Search time is therefore O(V² + E), simplified to O(V²) for this grid.

The node array, obstacle copy, frontier and reconstructed path each need O(V) space. Total algorithm space is O(V).

The renderer additionally visits all 625 cells per visual update. That overhead is separate from pure algorithm complexity. This project favors clear, teachable code for a small board. For a larger application, an indexed binary heap and incremental DOM updates would be reasonable improvements; they are not features of the delivered implementation.

## 16. Testing approach and evidence

The project contains 16 automated tests, run successfully during creation. JavaScript syntax checks also passed.

Algorithm tests cover all five examples, neighbor boundaries, a same-start/goal input, an isolated start, stable obstacle snapshots, unique frontier entries, calculated score relationships, parent reconstruction, fresh repeated runs and 250 seeded random boards. An independent breadth-first search supplies the reference shortest distance on those random boards. Matching BFS is strong evidence for these tested cases, alongside the consistency argument; it is not a claim that testing alone proves every possible input correct.

Controller tests execute the actual `app.js` against a minimal DOM and fake timer queue. They verify that Step and Run share one instance, pause cancels pending work, reset preserves walls, endpoint editing removes walls, inspection remains available, blocked searches terminate and repeated runs start fresh.

After an initial preview-server timeout, browser verification succeeded using a local Node HTTP server. It confirmed all five expected example outcomes, repeated detour results after reset, native cell click painting/erasing, start-score inspection, and pause → Step → Resume. In the latter check the explored count went from 1 to 2 on Step, then resumed to a 40-move route. The blocked board finished and re-enabled Run. Browser console inspection returned no warning/error entries during these checks, and desktop layout was visually inspected. The temporary server is a verification tool, not a project dependency.

Use the separate `TEST_CHECKLIST.md` to rehearse in your presentation browser. Remaining checks, such as touch dragging and offline use on that browser, are not claimed as verified.

Known example distances, independently checked by BFS:

| Example | Expected outcome |
| --- | --- |
| Empty | 40 moves |
| Wall with gap at `(12, 12)` | 40 moves |
| Destination enclosed on four sides | No path |
| Adjacent endpoints | 1 move |
| Vertical wall forcing a detour | 60 moves |

In the detour example, start is `(2, 2)`, goal is `(2, 22)`, and column 8 is blocked from row 0 through row 21. Going to row 22 adds 20 downward and 20 upward moves to the required 20 horizontal moves, giving 60.

## 17. Functions to study before presenting

Read in this order:

| Function or component | File | What to explain |
| --- | --- | --- |
| `manhattan()` | `algorithm.js` | How the heuristic is computed and why it is admissible |
| `AStarSearch.constructor()` | `algorithm.js` | Node initialization, frontier seeding and obstacle snapshot |
| `neighbors()` | `algorithm.js` | Four directions, boundary checks, no diagonal/wraparound |
| `popLowestF()` | `algorithm.js` | Explicit priority selection and tie-breaking |
| `step()` | `algorithm.js` | Core A*, relaxation, closed nodes, goal and failure conditions |
| `reconstructPath()` | `algorithm.js` | Parent chain and reversed route |
| `ensureSearch()` and `advanceSearch()` | `app.js` | Shared algorithm instance and timing boundary |
| `step()`, `run()`, `animationTick()` | `app.js` | Manual versus automatic scheduling, same algorithm operation |
| `stopTimer()` and `resetSearch()` | `app.js` | Preventing stale animation and repeated-run bugs |
| `editCell()` | `app.js` | Editing lock, walls, endpoint protection and result invalidation |
| `render()` and `renderInspector()` | `app.js` | Converting real state to colors and visible scores |
| `createScenario()` | `algorithm.js` | Reproducible example inputs, not hardcoded paths |

There are two functions named `step`: the class method performs A*; the UI function handles the button, timing state and rendering. The controller calls the class method through `advanceSearch()`.

## 18. Five-minute demonstration

1. **Introduce the model:** “This grid is an unweighted graph. Every move costs one, and movement is limited to four directions.” Show S, D and the legend.
2. **Explain scores:** point to `f = g + h`. Use `(2, 2)` to show g = 0, h = 40, f = 40 after starting.
3. **Show real stepping:** load Empty board and press Step. The start becomes processed and its neighbors join the frontier. Click cells to inspect their scores. Step again and explain priority selection.
4. **Continue the same search:** Run, Pause, Step once, Resume. Explain that these controls keep the same node objects and frontier.
5. **Show an obstacle case:** load Long detour. Run at high speed. Explain why the heuristic initially favors going toward the destination but walls force a 60-move route.
6. **Show failure:** load Blocked destination and run. Explain frontier exhaustion; there is no infinite loop. Reset Path and show that obstacles remain.
7. **Open the code:** show `step()`, `popLowestF()` and `reconstructPath()` in `algorithm.js`. Identify the exact relaxation condition and parent update.

Rehearse loading the examples and setting maximum speed before the live presentation. The unreachable example explores a large region, so allow time for the animation.

## 19. Common professor viva questions

**1. What is A*?**  
A* is an informed graph-search algorithm that selects the frontier node with the lowest estimated total cost, f = g + h, to find a least-cost route under suitable heuristic assumptions.

**2. What is the difference between g and h?**  
g is the best known actual cost from the start to the node. h is an estimate from the node to the goal. g changes when a better route is found; h depends only on position and goal in this project.

**3. Why Manhattan distance?**  
Only horizontal and vertical unit moves are allowed. The sum of coordinate differences is a lower bound on the required moves and satisfies consistency.

**4. Is A* always optimal?**  
Not with every heuristic or implementation. In this project Manhattan is consistent, costs are nonnegative and uniform, closed nodes are final and success is checked when the goal is selected. These conditions give an optimal result. An inconsistent heuristic can require reopening nodes.

**5. What is an admissible heuristic?**  
One that never overestimates the true remaining optimal cost: h(n) <= h*(n).

**6. What is consistency?**  
For every edge n to m, h(n) <= cost(n,m) + h(m), with h(goal) = 0. It makes f nondecreasing along a path and supports finalizing closed nodes.

**7. What if h is zero everywhere?**  
A* becomes Dijkstra's search. With unit edge costs, it expands by distance layers and has the same distance behavior as BFS, though its queue implementation is different.

**8. How is A* different from greedy best-first search?**  
Greedy best-first prioritizes h alone and ignores the cost already incurred. A* includes g. Greedy search does not generally guarantee a shortest path.

**9. What are open and closed sets?**  
Open/frontier nodes have been discovered and are waiting for selection. Closed/explored nodes have been selected and processed. This implementation stores the frontier as an array and closed membership in node state.

**10. Which priority queue did you use?**  
An array with explicit minimum scanning and removal. It is O(V) per selection, understandable for 625 cells, and supports updated scores without duplicate entries. It is not a binary heap.

**11. What happens when two nodes have the same f?**  
Lower h wins. If both f and h match, earlier insertion wins. This affects exploration order and which shortest path is returned, not the minimum path length.

**12. Why keep parent links?**  
They record the predecessor on the best known route. Following them backward from the goal and reversing the list yields the final path without copying entire routes during search.

**13. Why not stop as soon as the goal is discovered?**  
Discovery alone is not the general A* optimality condition. Selecting the goal as the minimum-f frontier entry establishes the safe stopping condition used here.

**14. What if there is no path?**  
The algorithm explores the reachable region and eventually empties its frontier. It returns no-path, and the controller stops scheduling tasks.

**15. Why does the browser remain responsive?**  
The controller schedules one bounded iteration per timer task. It yields to the event loop between tasks rather than running the entire search in a blocking while loop.

**16. Is Step just showing an animation frame?**  
No. It calls the same class method as Run and performs one actual node-selection/expansion iteration. At the goal iteration it reconstructs and reveals the result.

**17. What changes when Pause is pressed?**  
The timer is canceled and running becomes false. Frontier, scores, parents and search status stay intact for Resume or Step.

**18. What is the difference between Reset Path and Clear Board?**  
Reset Path discards search information and animation while preserving obstacles and endpoints. Clear Board also removes obstacles and restores default endpoints.

**19. Can the user draw walls during a search?**  
The UI locks board editing during unfinished searching or tracing so calculated results remain consistent with the board. Users can reset to edit, or replace the board with a clear/example/random action.

**20. What are the actual time and space complexities?**  
This array-frontier implementation takes O(V² + E) worst-case search time and O(V) memory. For a four-direction grid E is O(V), so time simplifies to O(V²). A heap-based A* has different queue costs.

**21. Why not use BFS instead?**  
BFS also finds shortest paths on this unit-cost board and is a useful independent test oracle. A* illustrates how a heuristic can guide exploration toward a goal. A* is not guaranteed to explore fewer nodes on every board.

**22. Can diagonal movement be added?**  
Yes, but neighbor generation, movement costs and heuristic must all be reviewed together. Manhattan is unsuitable for unit-cost diagonals; Chebyshev distance is a possible choice for that different model.

**23. Does the random maze always have a solution?**  
No. It is a randomly blocked board. The program correctly handles both solvable and unsolvable outcomes.

**24. What does execution time measure?**  
Only time spent inside the algorithm's individual step calls, including reconstruction. It excludes animation delays, initialization and rendering. It is not a controlled benchmark.

**25. How did you verify shortest paths?**  
The automated tests check known examples and compare 250 seeded random boards against independent BFS distances. Returned paths are also checked for endpoints, adjacency, obstacle avoidance and parent consistency.

**26. Why can an already-open node need an update?**  
A newly expanded neighbor might provide a cheaper route to that node. The strict g comparison updates its scores and parent. The array minimum scan sees the updated value next time.

**27. Why can closed nodes be skipped?**  
With this consistent heuristic, a node removed at minimum f already has its optimal g. This simplification would need review for an inconsistent heuristic.

**28. Are path length and explored count the same?**  
No. Path length counts moves on the returned route. Explored count includes processed cells that do not belong to the route and includes the goal when selected.

## 20. Limitations and possible future work

The delivered board is fixed at 25 × 25, uses uniform costs and four directions, stores no saved boards and has no route export. The random generator does not guarantee connected passages. Full-grid rendering and array priority scanning are appropriate for teaching on this board but would need improvement for very large grids.

Possible future work includes a binary heap frontier, incremental rendering, seeded maze generation with a solvability guarantee, saved board presets, and comparisons with BFS or Dijkstra. These are suggestions, not implemented features.

## 21. How to run and what to submit

Submit the whole project folder with the four application files, both test files and these documents. Open `index.html` locally to demonstrate. Keep `algorithm.js` ready in your editor and study the function guide before explaining the implementation.

Use `README.md` for quick setup, this report for detailed understanding, and `TEST_CHECKLIST.md` for your own browser rehearsal. The application requires no hosted service or internet connection.
