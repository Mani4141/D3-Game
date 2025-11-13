// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing Leaflet marker icons
import "./_leafletWorkaround.ts";

// --- Basic UI elements ---

// Map container
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Status panel (simple placeholder for now)
const statusPanel = document.createElement("div");
statusPanel.id = "statusPanel";
statusPanel.textContent = "World of Bits – Core map prototype";
document.body.append(statusPanel);

// --- Fixed classroom coordinates (player position) ---

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Initial zoom level for gameplay
const GAMEPLAY_ZOOM_LEVEL = 19;

// Grid cell size in degrees (about house-sized)
const TILE_DEGREES = 1e-4;

// Helper to convert grid indices (i, j) to cell bounds
function getCellBounds(i: number, j: number): leaflet.LatLngBounds {
  const origin = CLASSROOM_LATLNG;

  return leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);
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

// --- First test grid cell near the player ---

// For now, treat classroom as the origin corner of cell (0, 0)
const testCellBounds = getCellBounds(0, 0);

const testCellRectangle = leaflet.rectangle(testCellBounds, {
  color: "#3388ff",
  weight: 1,
});

testCellRectangle.addTo(map);
testCellRectangle.bindTooltip("Test cell (0, 0)");
