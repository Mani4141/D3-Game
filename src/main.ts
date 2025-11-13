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

// Status panel (for held token + messages)
const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
document.body.append(statusPanel);

// --- Fixed classroom coordinates (player position) ---

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Initial zoom level for gameplay
const GAMEPLAY_ZOOM_LEVEL = 19;

// Grid cell size in degrees
const TILE_DEGREES = 1e-4;

// How far from the player (in cell steps) the player can interact
const INTERACTION_RADIUS_CELLS = 3;

// Win condition: held token must reach at least this value
const TARGET_TOKEN_VALUE = 16;

// --- Game state ---

type GameState = {
  heldTokenValue: number | null;
  cellOverrides: Map<string, number | null>; // key -> overridden token value (null = empty)
  hasWon: boolean;
};

const gameState: GameState = {
  heldTokenValue: null,
  cellOverrides: new Map(),
  hasWon: false,
};

// Keep references to rectangles so we can update them later
const cellRectangles = new Map<string, leaflet.Rectangle>();

// --- Helpers for grid geometry and keys ---

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function getCellBounds(row: number, col: number): leaflet.LatLngBounds {
  const origin = CLASSROOM_LATLNG;

  return leaflet.latLngBounds([
    [origin.lat + row * TILE_DEGREES, origin.lng + col * TILE_DEGREES],
    [
      origin.lat + (row + 1) * TILE_DEGREES,
      origin.lng + (col + 1) * TILE_DEGREES,
    ],
  ]);
}

// Deterministic base token spawning: same row/col -> same result every time
// For D3.a: world initially only has value-1 tokens (or empty)
function getBaseTokenValue(row: number, col: number): number | null {
  const seed = `${row},${col},token`;
  const roll = luck(seed);

  // e.g. 30% chance of a 1, otherwise empty
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

// Chebyshev distance in cell space: max(|row|, |col|)
function canInteractWithCell(row: number, col: number): boolean {
  const distance = Math.max(Math.abs(row), Math.abs(col));
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

// --- Initialize map ---

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
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
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

// --- Draw grid that covers the initial viewport and wire up clicks ---

map.whenReady(() => {
  const origin = CLASSROOM_LATLNG;
  const bounds = map.getBounds();

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const minRow = Math.floor((south - origin.lat) / TILE_DEGREES);
  const maxRow = Math.ceil((north - origin.lat) / TILE_DEGREES);
  const minCol = Math.floor((west - origin.lng) / TILE_DEGREES);
  const maxCol = Math.ceil((east - origin.lng) / TILE_DEGREES);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const cellBounds = getCellBounds(row, col);
      const rect = leaflet.rectangle(cellBounds, {
        color: "#3388ff",
        weight: 1,
      });

      const key = cellKey(row, col);
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

  // Initialize UI
  updateStatusPanel();
});
