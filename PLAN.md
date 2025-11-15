# D3: World of Bits

## Game Design Vision

World of Bits is a location-based crafting game played on a grid laid over the real world. The player interacts with nearby cells on a Leaflet map to collect, place, and combine matching tokens into higher-value ones. The goal is to eventually craft a single high-value token by moving intelligently around the map and managing space within the grid.

## Technologies

- TypeScript for main game logic
- Leaflet for interactive map rendering
- Vite and Deno for building
- GitHub Actions and GitHub Pages for deployment

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Assemble a map-based user interface using Leaflet.\
Key gameplay challenge: Let players collect, place, and craft nearby tokens into a sufficiently high-value token.

---

## Steps

### Initial setup and understanding

- [✅] Create this `PLAN.md` file and commit it
- [✅] Skim the starter code to understand how Leaflet and the luck helper are used
- [✅] Run the dev server and confirm the starter project builds and runs

### Cleaning and starting fresh

- [✅] Clear out `src/main.ts` so it only contains a minimal TypeScript entry point
- [✅] Commit a cleanup-focused change that removes unused starter logic

### Basic Leaflet map and player location

- [✅] Initialize a basic Leaflet map in `main.ts`
- [✅] Center the map on the fixed classroom coordinates
- [✅] Render a simple marker that represents the player’s location

### First grid sketch

- [✅] Define a grid cell size in degrees (e.g. 0.0001)
- [✅] Draw at least one test rectangle on the map
- [✅] Use loops to generate a full grid around the player
- [✅] Ensure the grid extends to the edges of the viewport

---

## Next 3 commits for finishing D3.a

### ✔ Commit 1 Complete: Grid of cells + deterministic token spawning (visual only)

- [✅] Compute grid bounds based on map viewport
- [✅] Add helpers to compute cell bounds and centers
- [✅] Draw grid rectangles covering the visible map
- [✅] Import and use `luck` for deterministic token spawning
- [✅] Implement `getBaseTokenValue()` that:
  - [✅] Uses `luck` to decide token presence
  - [✅] Spawns **only value-1 tokens**
- [✅] Display token values directly at each cell center
- [✅] Confirm that token layout is consistent across reloads

---

## **Commit 2: Interaction radius, inventory, crafting, and placement** (WORKING ON NOW)

### Interaction rules + state

- [✅] Implement interaction radius so only nearby cells are usable
- [✅] Add a `GameState` structure that tracks:
  - [✅] `heldTokenValue: number | null`
  - [✅] Per-cell overrides for token changes
- [✅] Visual UI to show held token in a status panel

### Click handling

- [✅] If **hand is empty** and **cell has a token** → Pick it up
  - [✅] Remove token from that cell
  - [✅] Record removal in overrides
  - [✅] Set `heldTokenValue`

- [✅] If **hand is not empty** and **cell is empty** → Place token
  - [✅] Move `heldTokenValue` into that cell
  - [✅] Clear the hand
  - [✅] Update labels

- [✅] If **hand is not empty** and **cell has SAME value** → Craft
  - [✅] Remove the cell’s token
  - [✅] Combine: new value = held * 2
  - [✅] New value stays **in hand**
  - [✅] Cell becomes empty
  - [✅] Update label

### Win condition

- [✅] Detect when held token reaches target value (e.g. 16)
- [✅] Display a clear “You win!” message

---

## ✔ Commit 3: Final polish + cleanup + D3.a completion

(Will do after Commit 2)

- [✅] Verify gameplay rules:
  - [✅] Only one token can be held at a time
  - [✅] Only nearby cells are interactable
  - [✅] Initial token layout is deterministic
- [✅] Perform a cleanup-only refactor:
  - [✅] Remove leftover `console.log` calls
  - [✅] Ensure helper functions are clean and readable
- [✅] Update any UI wording (status text, win message)
- [✅] Deploy to GitHub Pages and verify the game loads
- [✅] Commit with no new features (refactor-only)
- [✅] Make the final commit: `D3.a complete`

## D3.b: Globe-spanning gameplay

Key technical challenge: Support gameplay anywhere on Earth using a grid anchored at Null Island, with dynamic spawning/despawning of cells as the player moves.\
Key gameplay challenge: Let players move their character around the world, farm tokens from memoryless cells, and craft a higher-value token than in D3.a.

### Initial prep

- [✅] Copy the final D3.a code into a `D3b` starting commit (baseline)
- [✅] Add a new `D3.b` section to this PLAN (this file) and commit it
- [✅] Raise the win threshold so D3.b requires a higher value token (e.g. 32 instead of 16)

#### Grid + coordinate system changes

- [✅] Introduce a `GridCell` type (e.g. `{ i: number; j: number }`) decoupled from Leaflet rectangles
- [✅] Add a `NULL_ISLAND_LATLNG` constant at (0, 0)
- [✅] Add functions to convert between:
  - [✅] `lat/lng -> GridCell` indices
  - [✅] `GridCell -> Leaflet LatLngBounds` (top-left + bottom-right)
- [✅] Update grid-drawing code to use the Null Island–anchored grid instead of classroom-anchored math

#### Player movement UI (to do after grid switch)

- [✅] Add simple UI buttons (N / S / E / W) for moving the player by one grid step
- [✅] Track player position as a `GridCell` plus a derived `LatLng`
- [✅] As the player moves, keep cells visible to the edge of the map and restrict interaction to nearby cells

## D3.c: Object persistence

Key technical challenge: Use a lightweight global grid plus a persistent store for modified cells so off-screen cells do not require full objects in memory, but remembered changes come back when the map scrolls.

### Next steps

- [✅] Add a `D3.c` section to PLAN.md and commit it
- [ ] Treat `cellOverrides` as the persistent state map for modified cells (Memento-like)
- [ ] Stop deleting `cellOverrides` entries when cells leave the viewport
- [ ] Refactor `updateVisibleCells` to clear and rebuild all visible rectangles from scratch based on:
  - [ ] Current viewport bounds
  - [ ] `getEffectiveTokenValue` (using `cellOverrides` + `luck`)
- [ ] Manually test:
  - [ ] Modify a cell, scroll it fully off-screen, then scroll back
  - [ ] Confirm the modified state is restored, not reset
- [ ] Do a cleanup-only commit for D3.c code changes
- [ ] Make a commit marking “D3.c complete”
