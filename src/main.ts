// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing Leaflet marker icons
import "./_leafletWorkaround.ts";

// Luck helper for deterministic randomness
import luck from "./_luck.ts";

// --- Basic UI elements ---

// Map container
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Control panel for movement buttons
const controlPanel = document.createElement("div");
controlPanel.id = "controlPanel";
document.body.append(controlPanel);

// Status panel (for held token + messages)
const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
document.body.append(statusPanel);

// --- Gameplay constants ---

// Fixed classroom coordinates (starting physical location)
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Global grid anchor at Null Island (0, 0)
const NULL_ISLAND_LATLNG = leaflet.latLng(0, 0);

// Map zoom level used for gameplay
const GAMEPLAY_ZOOM_LEVEL = 19;

// Grid cell size in degrees
const TILE_DEGREES = 1e-4;

// How far from the player (in cell steps) the player can interact
const INTERACTION_RADIUS_CELLS = 3;

// Win condition: held token must reach at least this value (higher than D3.a)
const TARGET_TOKEN_VALUE = 32;

// --- Types ---

type GridCell = {
  i: number; // row index
  j: number; // column index
};

type GameState = {
  heldTokenValue: number | null;
  cellOverrides: Map<string, number | null>; // key -> overridden token value (null = empty)
  hasWon: boolean;
  playerCell: GridCell;
};

// --- Grid helpers for coordinates ---

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

// Convert a LatLng to a global GridCell anchored at Null Island
function latLngToCell(position: leaflet.LatLng): GridCell {
  const i = Math.floor(
    (position.lat - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES,
  );
  const j = Math.floor(
    (position.lng - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES,
  );
  return { i, j };
}

// Convert a GridCell to Leaflet bounds, anchored at Null Island
function cellToBounds(cell: GridCell): leaflet.LatLngBounds {
  const lat0 = NULL_ISLAND_LATLNG.lat + cell.i * TILE_DEGREES;
  const lng0 = NULL_ISLAND_LATLNG.lng + cell.j * TILE_DEGREES;

  return leaflet.latLngBounds(
    [lat0, lng0],
    [lat0 + TILE_DEGREES, lng0 + TILE_DEGREES],
  );
}

function cellToCenter(cell: GridCell): leaflet.LatLng {
  return cellToBounds(cell).getCenter();
}

// --- Game state ---

const initialPlayerCell = latLngToCell(CLASSROOM_LATLNG);

const gameState: GameState = {
  heldTokenValue: null,
  cellOverrides: new Map(),
  hasWon: false,
  playerCell: initialPlayerCell,
};

// Keep references to rectangles so we can update them later
const cellRectangles = new Map<string, leaflet.Rectangle>();

// Deterministic base token spawning: same row/col -> same result every time
// For D3: world initially only has value-1 tokens (or empty)
function getBaseTokenValue(row: number, col: number): number | null {
  const seed = `${row},${col},token`;
  const roll = luck(seed);

  // 30% chance of a 1, otherwise empty
  if (roll < 0.3) {
    return 1;
  }

  return null;
}

// Effective token value: overrides beat base layout
function getEffectiveTokenValue(row: number, col: number): number | null {
  const key = cellKey(row, col);
  if (gameState.cellOverrides.has(key)) {
    return gameState.cellOverrides.get(key) ?? null;
  }
  return getBaseTokenValue(row, col);
}

// Chebyshev distance in cell space from the PLAYER'S cell
function canInteractWithCell(row: number, col: number): boolean {
  const pi = gameState.playerCell.i;
  const pj = gameState.playerCell.j;
  const distance = Math.max(Math.abs(row - pi), Math.abs(col - pj));
  return distance <= INTERACTION_RADIUS_CELLS;
}

// --- UI helpers ---

function updateStatusPanel(message?: string) {
  if (gameState.hasWon) {
    statusPanel.textContent =
      `You win! Held token value: ${gameState.heldTokenValue}`;
    return;
  }

  const heldText = gameState.heldTokenValue === null
    ? "Held token: none"
    : `Held token: ${gameState.heldTokenValue}`;

  statusPanel.textContent = message ? `${heldText} | ${message}` : heldText;
}

function updateCellDisplay(row: number, col: number) {
  const key = cellKey(row, col);
  const rect = cellRectangles.get(key);
  if (!rect) return;

  const tokenValue = getEffectiveTokenValue(row, col);

  if (tokenValue === null) {
    rect.unbindTooltip();
  } else {
    rect.bindTooltip(`${tokenValue}`, {
      permanent: true,
      direction: "center",
      className: "token-label",
    });
  }
}

function checkWinCondition() {
  if (
    gameState.heldTokenValue !== null &&
    gameState.heldTokenValue >= TARGET_TOKEN_VALUE
  ) {
    gameState.hasWon = true;
    updateStatusPanel("Goal reached!");
  }
}

// --- Interaction logic ---

function handleCellClick(row: number, col: number) {
  if (!canInteractWithCell(row, col)) {
    updateStatusPanel("That cell is too far away.");
    return;
  }

  const key = cellKey(row, col);
  const cellValue = getEffectiveTokenValue(row, col);
  const held = gameState.heldTokenValue;

  // Case 1: nothing in hand → try to pick up
  if (held === null) {
    if (cellValue === null) {
      updateStatusPanel("No token in that cell to pick up.");
      return;
    }

    gameState.heldTokenValue = cellValue;
    gameState.cellOverrides.set(key, null); // cell becomes empty
    updateCellDisplay(row, col);
    updateStatusPanel("Picked up a token.");
    checkWinCondition();
    return;
  }

  // From here on: held !== null

  // Case 2: holding a token and clicking an empty cell → place token there
  if (cellValue === null) {
    gameState.cellOverrides.set(key, held); // place token in the cell
    gameState.heldTokenValue = null; // hand is now free

    updateCellDisplay(row, col);
    updateStatusPanel("Placed token on an empty cell.");
    // Win condition is based on held token, so no need to check here
    return;
  }

  // Case 3: holding a token and clicking a non-empty cell → try to craft
  if (cellValue !== held) {
    updateStatusPanel("Token values do not match, cannot craft.");
    return;
  }

  // Values match → craft double
  const newValue = held * 2;

  // Result: one new token, in the player's hand; cell becomes empty
  gameState.heldTokenValue = newValue;
  gameState.cellOverrides.set(key, null); // consumed the cell token

  updateCellDisplay(row, col);
  updateStatusPanel("Crafted a higher-value token!");
  checkWinCondition();
}

// --- Map setup ---

// Start the player marker at the center of their starting grid cell
const startingPlayerLatLng = cellToCenter(initialPlayerCell);

const map = leaflet.map(mapDiv, {
  center: startingPlayerLatLng,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
});

// Background tiles
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player marker
const playerMarker = leaflet.marker(startingPlayerLatLng);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

// --- Dynamic grid management (spawn/despawn + memoryless cells) ---

function updateVisibleCells() {
  const bounds = map.getBounds();

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // Compute rows/cols relative to Null Island (global grid)
  const minRow = Math.floor(
    (south - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES,
  );
  const maxRow = Math.ceil(
    (north - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES,
  );
  const minCol = Math.floor(
    (west - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES,
  );
  const maxCol = Math.ceil(
    (east - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES,
  );

  const neededKeys = new Set<string>();

  // Create or keep cells that should be visible
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = cellKey(row, col);
      neededKeys.add(key);

      if (!cellRectangles.has(key)) {
        const bounds = cellToBounds({ i: row, j: col });
        const rect = leaflet.rectangle(bounds, {
          color: "#3388ff",
          weight: 1,
        });

        cellRectangles.set(key, rect);
        rect.addTo(map);

        // Initial label based on base or overridden token
        updateCellDisplay(row, col);

        // Click handler for pickup / placement / crafting
        rect.on("click", () => {
          handleCellClick(row, col);
        });
      }
    }
  }

  // Remove cells that are no longer needed (memoryless behavior)
  for (const [key, rect] of cellRectangles.entries()) {
    if (!neededKeys.has(key)) {
      map.removeLayer(rect);
      cellRectangles.delete(key);

      // Forget any overrides for this cell so it "resets" next time it appears
      gameState.cellOverrides.delete(key);
    }
  }
}

// --- Player movement controls ---

function updatePlayerMarkerAndView() {
  const newLatLng = cellToCenter(gameState.playerCell);
  playerMarker.setLatLng(newLatLng);
  map.panTo(newLatLng);
}

function movePlayerBy(di: number, dj: number) {
  if (gameState.hasWon) return;

  gameState.playerCell = {
    i: gameState.playerCell.i + di,
    j: gameState.playerCell.j + dj,
  };

  updatePlayerMarkerAndView();
  updateStatusPanel("Moved.");
}

// Create movement buttons
function setupMovementButtons() {
  const directions: { label: string; di: number; dj: number }[] = [
    { label: "North", di: 1, dj: 0 },
    { label: "South", di: -1, dj: 0 },
    { label: "West", di: 0, dj: -1 },
    { label: "East", di: 0, dj: 1 },
  ];

  directions.forEach((dir) => {
    const button = document.createElement("button");
    button.textContent = dir.label;
    button.addEventListener("click", () => {
      movePlayerBy(dir.di, dir.dj);
    });
    controlPanel.append(button);
  });
}

// --- Initialization ---

map.whenReady(() => {
  setupMovementButtons();
  updateVisibleCells();
  updateStatusPanel();
});

// When the player pans/zooms the map, update visible cells
map.on("moveend", () => {
  updateVisibleCells();
});
