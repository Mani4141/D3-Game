# D3: World of Bits

## Game Design Vision

World of Bits is a location-based crafting game played on a grid laid over the real world. The player interacts with nearby cells on a Leaflet map to collect and combine matching tokens into higher-value ones, aiming to eventually craft a very high-value token.

## Technologies

- TypeScript for main game logic
- Leaflet for interactive map rendering
- Vite and Deno for building
- GitHub Actions and GitHub Pages for deployment

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Assemble a map-based user interface using Leaflet.\
Key gameplay challenge: Let players collect and craft nearby tokens into a sufficiently high-value token.

### Steps

#### Initial setup and understanding

- [✅] Create this `PLAN.md` file and commit it
- [✅] Skim the starter code to understand how Leaflet and the luck helper are used
- [✅] Run the dev server and confirm the starter project builds and runs

#### Cleaning and starting fresh

- [✅] Clear out `src/main.ts` so it only contains a minimal TypeScript entry point
- [✅] Commit a cleanup-focused change that removes unused starter logic

#### Basic Leaflet map and player location

- [✅] Initialize a basic Leaflet map in `main.ts`
- [✅] Center the map on the fixed classroom coordinates with a reasonable zoom level
- [✅] Render a simple marker or circle that represents the player’s fixed location

#### First grid sketch

- [✅] Define a grid cell size in degrees (for example 0.0001 degrees per side)
- [✅] Draw at least a single test cell rectangle near the player’s location on the map

## Next 3 commits for finishing D3.a

### Next commit: grid of cells + deterministic token spawning (visual only)

- [ ] Decide on a small neighborhood size around the player (e.g. rows/cols from -8 to 8)
- [ ] Add a helper to compute a cell’s center `LatLng` from its `(row, col)` indices
- [ ] Use nested loops over `(row, col)` to draw a full grid of rectangles around the player
- [ ] Ensure the grid extends to at least the edges of the initial map viewport
- [ ] Import the `luck` function into `main.ts`
- [ ] Implement a deterministic `getBaseTokenValue(row, col): number | null` that:
  - [ ] Uses `luck` to decide if a cell has a token
  - [ ] Returns a simple starting value (e.g. `1`) when a token exists
- [ ] For each cell, display its token (if any) directly on the map (e.g. a small text label or icon at the cell center)
- [ ] Reload the page to confirm that token presence and values are consistent across page loads

### Second commit: interaction radius, inventory, and crafting logic

- [ ] Define an interaction radius so only cells within a few cell-widths of the player are interactable
- [ ] Add a simple `GameState` structure in `main.ts` to track:
  - [ ] `heldTokenValue: number | null`
  - [ ] Cell overrides (changes to token values after pickup/crafting)
- [ ] Add click handlers to grid cells that:
  - [ ] Ignore clicks on cells outside the interaction radius
  - [ ] If `heldTokenValue === null` and the cell has a token, pick it up:
    - [ ] Remove the token from that cell (record in overrides)
    - [ ] Set `heldTokenValue` to the cell’s token value
- [ ] Display the current held token clearly in the UI (status panel or separate HUD)
- [ ] If `heldTokenValue !== null` and the clicked cell has a token of the same value:
  - [ ] Remove the cell’s token
  - [ ] Create a new token in that cell with double the value
  - [ ] Update `heldTokenValue` to the new doubled value (or decide if it stays in the cell instead)
- [ ] Detect when `heldTokenValue` reaches at least the target value (e.g. 8 or 16) and show a clear win message on screen

### Third commit: polish, cleanup-only refactor, and D3.a completion

- [ ] Double-check that:
  - [ ] The player can only hold at most one token at a time
  - [ ] The player can only interact with cells “nearby”
  - [ ] The initial token layout is consistent across reloads (thanks to `luck`)
- [ ] Do a cleanup-only pass:
  - [ ] Remove leftover debugging `console.log`s and unused variables
  - [ ] Extract any tiny helper functions needed for clarity
- [ ] Update any labels or UI text so the game feels coherent for playtesting
- [ ] Deploy the current build to GitHub Pages and verify the game is playable in the browser
- [ ] Make at least one commit with only refactors / small style changes (no new gameplay features)
- [ ] Make a final commit for this milestone with a message like: `D3.a complete`
