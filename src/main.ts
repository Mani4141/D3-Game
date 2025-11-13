// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing Leaflet marker icons
import "./_leafletWorkaround.ts";

// Deterministic random source
import luck from "./_luck.ts";

//
// ────────────────────────────────────────────────────────────────────────────────
//   UI SETUP
// ────────────────────────────────────────────────────────────────────────────────
//

// Map container
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Movement button panel
const controlPanel = document.createElement("div");
controlPanel.id = "controlPanel";
document.body.append(controlPanel);

// Status panel (held token + messages)
const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
document.body.append(statusPanel);

//
// ────────────────────────────────────────────────────────────────────────────────
//   CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────
//

// Starting physical position (near UCSC classroom)
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Global grid anchor (Null Island)
const NULL_ISLAND_LATLNG = leaflet.latLng(0, 0);

// Map settings
const GAMEPLAY_ZOOM_LEVEL = 19;

// Grid settings
const TILE_DEGREES = 1e-4;

// Interaction radius (Chebyshev distance in grid cells)
const INTERACTION_RADIUS_CELLS = 3;

// Higher win threshold for D3.b
const TARGET_TOKEN_VALUE = 32;

//
// ────────────────────────────────────────────────────────────────────────────────
//   TYPES & GAME STATE
// ────────────────────────────────────────────────────────────────────────────────
//

type GridCell = { i: number; j: number };

type GameState = {
  heldTokenValue: number | null;
  cellOverrides: Map<string, number | null>;
  hasWon: boolean;
  playerCell: GridCell;
};

const initialPlayerCell = latLngToCell(CLASSROOM_LATLNG);

const gameState: GameState = {
  heldTokenValue: null,
  cellOverrides: new Map(),
  hasWon: false,
  playerCell: initialPlayerCell,
};

// Active rectangles on the map
const cellRectangles = new Map<string, leaflet.Rectangle>();

//
// ────────────────────────────────────────────────────────────────────────────────
//   GRID HELPERS
// ────────────────────────────────────────────────────────────────────────────────
//

function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

function latLngToCell(pos: leaflet.LatLng): GridCell {
  return {
    i: Math.floor((pos.lat - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES),
    j: Math.floor((pos.lng - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES),
  };
}

function cellToBounds(cell: GridCell): leaflet.LatLngBounds {
  const lat0 = NULL_ISLAND_LATLNG.lat + cell.i * TILE_DEGREES;
  const lng0 = NULL_ISLAND_LATLNG.lng + cell.j * TILE_DEGREES;
  return leaflet.latLngBounds([lat0, lng0], [
    lat0 + TILE_DEGREES,
    lng0 + TILE_DEGREES,
  ]);
}

function cellToCenter(cell: GridCell): leaflet.LatLng {
  return cellToBounds(cell).getCenter();
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   TOKEN LOGIC
// ────────────────────────────────────────────────────────────────────────────────
//

// Base token layout (memoryless, deterministic)
function getBaseTokenValue(i: number, j: number): number | null {
  const roll = luck(`${i},${j},token`);
  return roll < 0.3 ? 1 : null;
}

// Effective value = override if exists, else base value
function getEffectiveTokenValue(i: number, j: number): number | null {
  const key = cellKey(i, j);
  return gameState.cellOverrides.has(key)
    ? gameState.cellOverrides.get(key) ?? null
    : getBaseTokenValue(i, j);
}

// Nearby = Chebyshev distance from player cell
function canInteractWithCell(i: number, j: number): boolean {
  const pi = gameState.playerCell.i;
  const pj = gameState.playerCell.j;
  return Math.max(Math.abs(i - pi), Math.abs(j - pj)) <=
    INTERACTION_RADIUS_CELLS;
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   UI UPDATE HELPERS
// ────────────────────────────────────────────────────────────────────────────────
//

function updateStatusPanel(message?: string) {
  if (gameState.hasWon) {
    statusPanel.textContent =
      `You win! Final token: ${gameState.heldTokenValue}`;
    return;
  }
  const held = gameState.heldTokenValue;
  const heldText = held === null ? "Held token: none" : `Held token: ${held}`;
  statusPanel.textContent = message ? `${heldText} | ${message}` : heldText;
}

function updateCellDisplay(i: number, j: number) {
  const rect = cellRectangles.get(cellKey(i, j));
  if (!rect) return;

  const value = getEffectiveTokenValue(i, j);
  if (value === null) rect.unbindTooltip();
  else {
    rect.bindTooltip(`${value}`, {
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

//
// ────────────────────────────────────────────────────────────────────────────────
//   CELL INTERACTION (PICKUP / PLACE / CRAFT)
// ────────────────────────────────────────────────────────────────────────────────
//

function handleCellClick(i: number, j: number) {
  if (!canInteractWithCell(i, j)) {
    updateStatusPanel("That cell is too far away.");
    return;
  }

  const key = cellKey(i, j);
  const cellValue = getEffectiveTokenValue(i, j);
  const held = gameState.heldTokenValue;

  // Pick up
  if (held === null) {
    if (cellValue === null) {
      updateStatusPanel("No token there.");
      return;
    }
    gameState.heldTokenValue = cellValue;
    gameState.cellOverrides.set(key, null);
    updateCellDisplay(i, j);
    updateStatusPanel("Picked up a token.");
    checkWinCondition();
    return;
  }

  // Place
  if (cellValue === null) {
    gameState.cellOverrides.set(key, held);
    gameState.heldTokenValue = null;
    updateCellDisplay(i, j);
    updateStatusPanel("Placed token.");
    return;
  }

  // Craft
  if (cellValue !== held) {
    updateStatusPanel("Token values do not match.");
    return;
  }

  const newVal = held * 2;
  gameState.heldTokenValue = newVal;
  gameState.cellOverrides.set(key, null);
  updateCellDisplay(i, j);
  updateStatusPanel("Crafted!");
  checkWinCondition();
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   MAP & GRID MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────────
//

const map = leaflet.map(mapDiv, {
  center: cellToCenter(initialPlayerCell),
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
});

// Background tiles
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  })
  .addTo(map);

// Player marker
const playerMarker = leaflet.marker(cellToCenter(initialPlayerCell))
  .bindTooltip("You are here")
  .addTo(map);

// Spawn/despawn memoryless cells based on viewport
function updateVisibleCells() {
  const b = map.getBounds();

  const minRow = Math.floor((b.getSouth() - 0) / TILE_DEGREES);
  const maxRow = Math.ceil((b.getNorth() - 0) / TILE_DEGREES);
  const minCol = Math.floor((b.getWest() - 0) / TILE_DEGREES);
  const maxCol = Math.ceil((b.getEast() - 0) / TILE_DEGREES);

  const needed = new Set<string>();

  // Add missing cells
  for (let i = minRow; i <= maxRow; i++) {
    for (let j = minCol; j <= maxCol; j++) {
      const key = cellKey(i, j);
      needed.add(key);

      if (!cellRectangles.has(key)) {
        const rect = leaflet.rectangle(cellToBounds({ i, j }), {
          color: "#3388ff",
          weight: 1,
        })
          .addTo(map)
          .on("click", () => handleCellClick(i, j));

        cellRectangles.set(key, rect);
        updateCellDisplay(i, j);
      }
    }
  }

  // Remove offscreen cells (memoryless behavior)
  for (const [key, rect] of cellRectangles.entries()) {
    if (!needed.has(key)) {
      map.removeLayer(rect);
      cellRectangles.delete(key);
      gameState.cellOverrides.delete(key); // forget its state
    }
  }
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   PLAYER MOVEMENT
// ────────────────────────────────────────────────────────────────────────────────
//

function updatePlayerPosition() {
  const pos = cellToCenter(gameState.playerCell);
  playerMarker.setLatLng(pos);
  map.panTo(pos);
}

function movePlayerBy(di: number, dj: number) {
  if (gameState.hasWon) return;
  gameState.playerCell = {
    i: gameState.playerCell.i + di,
    j: gameState.playerCell.j + dj,
  };
  updatePlayerPosition();
  updateStatusPanel("Moved.");
}

function setupMovementButtons() {
  const dirs = [
    { label: "North", di: 1, dj: 0 },
    { label: "South", di: -1, dj: 0 },
    { label: "West", di: 0, dj: -1 },
    { label: "East", di: 0, dj: 1 },
  ];

  for (const d of dirs) {
    const btn = document.createElement("button");
    btn.textContent = d.label;
    btn.onclick = () => movePlayerBy(d.di, d.dj);
    controlPanel.append(btn);
  }
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   INIT
// ────────────────────────────────────────────────────────────────────────────────
//

map.whenReady(() => {
  setupMovementButtons();
  updateVisibleCells();
  updateStatusPanel();
});

map.on("moveend", updateVisibleCells);
