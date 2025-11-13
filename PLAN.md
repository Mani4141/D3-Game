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

- [ ] Clear out `src/main.ts` so it only contains a minimal TypeScript entry point
- [ ] Commit a cleanup-focused change that removes unused starter logic

#### Basic Leaflet map and player location

- [ ] Initialize a basic Leaflet map in `main.ts`
- [ ] Center the map on the fixed classroom coordinates with a reasonable zoom level
- [ ] Render a simple marker or circle that represents the player’s fixed location

#### First grid sketch

- [ ] Define a grid cell size in degrees (for example 0.0001 degrees per side)
- [ ] Draw at least a single test cell rectangle near the player’s location on the map
