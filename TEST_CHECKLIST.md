# Test checklist

## Automated checks

Run from the project directory with Node.js installed:

```powershell
node --check algorithm.js
node --check app.js
node --test tests/algorithm.test.js tests/controller.test.js
```

At creation, syntax checks succeeded and all 16 tests passed. These include five known examples, independent BFS comparison on 250 deterministic random boards, path validity, score relationships, termination, single-step behavior, repeated runs and controller lifecycle checks. The controller harness replaces the DOM and timers; it does not verify CSS, actual pointer routing or a particular browser engine.

## Browser verification performed

The in-app browser, served the actual local files, confirmed:

- Empty board: 40 moves; gap board: 40 moves.
- Blocked destination: No path exists, Run enabled afterward.
- Close endpoints: first Step explored 1 node; second Step returned a 1-move path.
- Long detour: 60 moves; Reset Path preserved all 22 walls; repeating returned 60 again.
- Clicking an empty cell created a wall; clicking it again erased it.
- Clicking the start after Step displayed g = 0.
- At slow speed: Step, Run, Pause, Step increased explored count from 1 to 2; Resume completed with length 40.
- Desktop layout was visually inspected; the browser console returned no warning/error entries during these checks.

## Manual browser rehearsal

Open `index.html`. Each example below is available in the Example selector. Select it and click **Load example** before running. Default start is `(2, 2)`, destination `(22, 22)`, except where stated.

| Test | Procedure | Expected outcome |
| --- | --- | --- |
| Empty board | Load Empty board; Run A* | Shortest path found; length 40; no diagonal moves |
| Wall with a gap | Load Wall with a gap; Run A* | Length 40; path crosses column 12 at row 12 |
| Blocked destination | Load Blocked destination; use maximum speed; Run A* | No path exists; length is a dash; frontier empties; controls remain usable |
| Close endpoints | Load Close endpoints; press Step twice | Start `(12, 12)` and goal `(12, 13)`; first step explores start, second selects goal; length 1 |
| Longer detour | Load Long detour; Run A* | Start `(2, 2)`, goal `(2, 22)`; path goes below the wall in column 8, through row 22 or below; shortest length 60 |
| Reset and repeat | Finish the detour, Reset Path, Run A* again | Same length and deterministic route; walls/endpoints remain after reset |

## Controls and regression checks

- [ ] **Same state:** load Empty board, Step once (explored = 1), Run, Pause, note explored count, Step once. Count increases by exactly 1. Resume and confirm length 40.
- [ ] **Pause:** while searching, pause and wait. Explored count does not change. Resume continues from the existing frontier.
- [ ] **Reset while running:** start a slow search, Reset Path, wait. Status stays Ready, explored stays 0 and no old cells recolor.
- [ ] **Reset while tracing:** reset after the goal is found but while yellow cells are being revealed. No remaining path animation runs.
- [ ] **Repeated Run:** finish a search, click Run Again. Old path and scores clear, and a new search begins.
- [ ] **Paint/erase:** drag across several empty cells, then begin a new drag on a wall. Walls draw and erase consistently; S and D stay visible and walkable.
- [ ] **Editing lock:** run or step once; try painting and moving endpoints. Clicks inspect without modifying the active board. Reset restores editing.
- [ ] **Endpoint placement:** put start on a wall. The wall is removed. Try placing it on the destination; endpoints remain distinct.
- [ ] **Inspector:** choose Inspect only, click an explored node, a frontier node, and an unseen node. Calculated scores satisfy f = g + h; unseen scores are dashes. Coordinates start at zero.
- [ ] **No wraparound:** draw obstacles near grid edges. Paths never jump from column 24 to column 0 of the next row.
- [ ] **Random board:** generate several random mazes. Endpoints remain walkable; both reachable and unreachable outcomes are allowed.
- [ ] **Clear:** clear a completed/paused/running board. All obstacles and search colors disappear; endpoints return to defaults.
- [ ] **Speed:** change speed during a run. Delay changes, route and cost do not.
- [ ] **Keyboard:** Tab into grid, move with arrow keys, apply the selected tool with Enter/Space.
- [ ] **Layout:** check a desktop window and a narrow window; controls and statistics stay readable, and the narrow grid can scroll.
- [ ] **Offline:** disconnect the internet and refresh the file. Application still runs without network requests.
- [ ] **Browser console:** run the examples and controls; verify there are no JavaScript errors.

Checkboxes are supplied for your own rehearsal in the browser you will present with. They are not all marked as passed; the observed checks above have a narrower scope than the complete checklist, particularly for native dragging, touch, offline use and assistive technology.
