// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing Leaflet icons
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

// Movement controls container (used by button movement controller)
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

// Starting position (near UCSC)
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Global grid anchor
const NULL_ISLAND_LATLNG = leaflet.latLng(0, 0);

// Map rendering
const GAMEPLAY_ZOOM_LEVEL = 19;

// Grid geometry
const TILE_DEGREES = 1e-4;

// Crafting + interaction
const INTERACTION_RADIUS_CELLS = 3;
const TARGET_TOKEN_VALUE = 32;

//
// ────────────────────────────────────────────────────────────────────────────────
//   TYPES & STATE
// ────────────────────────────────────────────────────────────────────────────────
//

type GridCell = { i: number; j: number };

type GameState = {
  heldTokenValue: number | null;
  cellOverrides: Map<string, number | null>;
  hasWon: boolean;
  playerCell: GridCell;
};

// Facade for movement – game code does not care how the player moves
interface MovementController {
  start(): void;
  stop(): void;
  getName(): string;
}

//
// Initial game state
//
const initialPlayerCell = latLngToCell(CLASSROOM_LATLNG);

const gameState: GameState = {
  heldTokenValue: null,
  cellOverrides: new Map(),
  hasWon: false,
  playerCell: initialPlayerCell,
};

// Active rectangles for visible cells
const cellRectangles = new Map<string, leaflet.Rectangle>();

// Active movement controller (buttons for now, geolocation later)
let activeMovement: MovementController | null = null;

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
  const lat = NULL_ISLAND_LATLNG.lat + cell.i * TILE_DEGREES;
  const lng = NULL_ISLAND_LATLNG.lng + cell.j * TILE_DEGREES;
  return leaflet.latLngBounds([lat, lng], [
    lat + TILE_DEGREES,
    lng + TILE_DEGREES,
  ]);
}

function cellToCenter(cell: GridCell): leaflet.LatLng {
  return cellToBounds(cell).getCenter();
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   TOKEN LOGIC (MEMENTO + FLYWEIGHT LOGIC)
// ────────────────────────────────────────────────────────────────────────────────
//

// Base layout (memoryless deterministic world)
function getBaseTokenValue(i: number, j: number): number | null {
  return luck(`${i},${j},token`) < 0.3 ? 1 : null;
}

// Persistent override value for modified cells
function getEffectiveTokenValue(i: number, j: number): number | null {
  const key = cellKey(i, j);
  return gameState.cellOverrides.has(key)
    ? gameState.cellOverrides.get(key)!
    : getBaseTokenValue(i, j);
}

// Player-range check
function canInteractWithCell(i: number, j: number): boolean {
  const pi = gameState.playerCell.i;
  const pj = gameState.playerCell.j;
  return Math.max(Math.abs(i - pi), Math.abs(j - pj)) <=
    INTERACTION_RADIUS_CELLS;
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   UI HELPERS
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

  const val = getEffectiveTokenValue(i, j);
  if (val === null) rect.unbindTooltip();
  else {
    rect.bindTooltip(`${val}`, {
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
//   CELL INTERACTION (CRAFTING LOGIC)
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
    if (cellValue === null) return updateStatusPanel("No token there.");
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
    return updateStatusPanel("Token values do not match.");
  }

  gameState.heldTokenValue = held * 2;
  gameState.cellOverrides.set(key, null);
  updateCellDisplay(i, j);
  updateStatusPanel("Crafted!");
  checkWinCondition();
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   MAP & GRID MANAGEMENT (FLYWEIGHT)
// ────────────────────────────────────────────────────────────────────────────────
//

const map = leaflet.map(mapDiv, {
  center: cellToCenter(initialPlayerCell),
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
});

// Background
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Player marker
const playerMarker = leaflet.marker(cellToCenter(initialPlayerCell))
  .bindTooltip("You are here")
  .addTo(map);

// Spawn/despawn rectangles; logical cell state persists in cellOverrides
function updateVisibleCells() {
  const bounds = map.getBounds();

  // Clear all old rectangles
  for (const rect of cellRectangles.values()) map.removeLayer(rect);
  cellRectangles.clear();

  // Compute visible grid
  const minRow = Math.floor(
    (bounds.getSouth() - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES,
  );
  const maxRow = Math.ceil(
    (bounds.getNorth() - NULL_ISLAND_LATLNG.lat) / TILE_DEGREES,
  );
  const minCol = Math.floor(
    (bounds.getWest() - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES,
  );
  const maxCol = Math.ceil(
    (bounds.getEast() - NULL_ISLAND_LATLNG.lng) / TILE_DEGREES,
  );

  // Create fresh rectangles
  for (let i = minRow; i <= maxRow; i++) {
    for (let j = minCol; j <= maxCol; j++) {
      const rect = leaflet.rectangle(cellToBounds({ i, j }), {
        color: "#3388ff",
        weight: 1,
      });
      rect.addTo(map);

      const key = cellKey(i, j);
      cellRectangles.set(key, rect);

      updateCellDisplay(i, j);

      rect.on("click", () => handleCellClick(i, j));
    }
  }
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   PLAYER MOVEMENT (FACADE ENTRY POINT)
// ────────────────────────────────────────────────────────────────────────────────
//

// Central helper for changing player position
function setPlayerCell(newCell: GridCell) {
  gameState.playerCell = newCell;
  updatePlayerPosition();
}

function updatePlayerPosition() {
  const pos = cellToCenter(gameState.playerCell);
  playerMarker.setLatLng(pos);
  map.panTo(pos);
}

function movePlayerBy(di: number, dj: number) {
  if (gameState.hasWon) return;

  const current = gameState.playerCell;
  const next: GridCell = { i: current.i + di, j: current.j + dj };
  setPlayerCell(next);
  updateStatusPanel("Moved.");
}

// Button-based movement controller (one concrete MovementController)
class ButtonMovementController implements MovementController {
  private buttons: HTMLButtonElement[] = [];

  start(): void {
    const configs = [
      { label: "North", di: 1, dj: 0 },
      { label: "South", di: -1, dj: 0 },
      { label: "West", di: 0, dj: -1 },
      { label: "East", di: 0, dj: 1 },
    ];

    configs.forEach(({ label, di, dj }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.onclick = () => movePlayerBy(di, dj);
      controlPanel.append(btn);
      this.buttons.push(btn);
    });
  }

  stop(): void {
    this.buttons.forEach((btn) => {
      btn.onclick = null;
      btn.remove();
    });
    this.buttons = [];
  }

  getName(): string {
    return "Buttons";
  }
}

//
// ────────────────────────────────────────────────────────────────────────────────
//   INIT
// ────────────────────────────────────────────────────────────────────────────────
//

map.whenReady(() => {
  // For now, default to button-based movement.
  activeMovement = new ButtonMovementController();
  activeMovement.start();

  updateVisibleCells();
  updateStatusPanel();
});

map.on("moveend", updateVisibleCells);
