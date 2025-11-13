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

// Status panel (simple placeholder for now)
const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
statusPanel.textContent = "World of Bits – Grid and tokens prototype";
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

// --- Helpers for grid geometry ---

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

function getCellCenter(row: number, col: number): leaflet.LatLng {
  return getCellBounds(row, col).getCenter();
}

// Deterministic token spawning: same row/col -> same result every time
function getBaseTokenValue(row: number, col: number): number | null {
  const seed = `${row},${col},token`;
  const roll = luck(seed);

  // 30% chance of a token with value 1
  if (roll < 0.3) {
    return 1;
  }

  return null;
}

// --- Initialize the Leaflet map centered on classroom ---

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

// --- Player marker ---

const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

// --- Draw a grid that covers the entire initial viewport ---

map.whenReady(() => {
  const origin = CLASSROOM_LATLNG;
  const bounds = map.getBounds();

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  // Convert lat/lng bounds to row/col ranges relative to the origin
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

      rect.addTo(map);

      const tokenValue = getBaseTokenValue(row, col);

      // If this cell has a token, show its value without clicking
      if (tokenValue !== null) {
        const center = getCellCenter(row, col);
        leaflet
          .tooltip({
            permanent: true,
            direction: "center",
            className: "token-label",
          })
          .setLatLng(center)
          .setContent(`${tokenValue}`)
          .addTo(map);
      }
    }
  }
});
