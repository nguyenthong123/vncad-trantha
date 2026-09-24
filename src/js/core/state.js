// CORE DOM ELEMENTS & GLOBAL APPLICATION STATE
const canvas = document.getElementById('cadCanvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');
const hudCoords = document.getElementById('hud-coords');
const hudInfo = document.getElementById('hud-info');
const dynBox = document.getElementById('dyn-box');
const dynInput = document.getElementById('dyn-input');
const osnapBox = document.getElementById('osnap-box');
const cliInput = document.getElementById('cli-input');
const cliMsg = document.getElementById('cli-msg');
const orthoStatus = document.getElementById('ortho-status');

// Drawing Entities & Undo/Redo Engine
let entities = [];
let undoStack = [];
let redoStack = [];
let selectedIds = new Set();

// Active Tool & Mode State
let currentTool = 'SELECT';
let orthoMode = false;
let isDrawing = false;
let startPoint = null;
let midPoint = null;
let polyPoints = [];
let offsetDist = 200; // mm

// Active Draw & Selection Properties (AutoCAD Quick Properties)
let activeProperties = {
  color: '#38bdf8',
  layer: '0',
  width: 2,
  lineType: 'CONTINUOUS', // CONTINUOUS, DASHED, CENTER, DOTTED
  fillColor: 'transparent'
};

const STANDARD_COLORS = [
  { name: 'Trắng (White)', value: '#ffffff' },
  { name: 'Cyan / ByLayer', value: '#38bdf8' },
  { name: 'Đỏ (Red)', value: '#ef4444' },
  { name: 'Vàng (Yellow)', value: '#eab308' },
  { name: 'Xanh Lá (Green)', value: '#22c55e' },
  { name: 'Xanh Dương (Blue)', value: '#3b82f6' },
  { name: 'Tím (Magenta)', value: '#d946ef' },
  { name: 'Cam (Orange)', value: '#f97316' }
];

let availableLayers = ['0', 'WALL', 'DIM', 'TEXT', 'HATCH', 'HIDDEN', 'DEFPOINTS'];

// Viewport Camera Transform
let zoom = 0.08;
let panX = 0;
let panY = 0;
let viewRotation = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let mouseWorld = { x: 0, y: 0 };
let mouseScreen = { x: 0, y: 0 };

// AutoCAD Box Sweeping Selection (Window & Crossing Selection)
let isBoxSelecting = false;
let boxStartScreen = { x: 0, y: 0 };
let boxStartWorld = { x: 0, y: 0 };
let isMouseDown = false;
let mouseDownScreen = { x: 0, y: 0 };
let mouseDownWorld = { x: 0, y: 0 };

// Basic State Functions
function setInfo(msg, type = 'info') {
  if (hudInfo) hudInfo.innerText = msg;
  if (typeof logToCliHistory === 'function') {
    logToCliHistory(msg, type);
  }
}

function saveState() {
  const snapshot = {
    entities: JSON.parse(JSON.stringify(entities)),
    camera: { zoom, panX, panY, viewRotation }
  };
  undoStack.push(JSON.stringify(snapshot));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];

  // Tự động lưu ngay lập tức vào Cơ Sở Dữ Liệu IndexedDB
  if (typeof autoSaveToDB === 'function') {
    autoSaveToDB();
  }
}

function undoAction() {
  if (undoStack.length === 0) {
    setInfo("⚠️ Không còn thao tác nào để Undo.");
    return;
  }
  const currentSnapshot = {
    entities: JSON.parse(JSON.stringify(entities)),
    camera: { zoom, panX, panY, viewRotation }
  };
  redoStack.push(JSON.stringify(currentSnapshot));

  let raw = undoStack.pop();
  try {
    let state = JSON.parse(raw);
    if (Array.isArray(state)) {
      entities = state;
    } else if (state && state.entities) {
      entities = state.entities;
      if (state.camera) {
        zoom = state.camera.zoom ?? zoom;
        panX = state.camera.panX ?? panX;
        panY = state.camera.panY ?? panY;
        if (Number.isFinite(state.camera.viewRotation)) {
          viewRotation = state.camera.viewRotation;
        }
      }
    }
  } catch (e) {
    console.error("Lỗi undo:", e);
  }

  selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof autoSaveToDB === 'function') autoSaveToDB();
  if (typeof logCommandTransaction === 'function') logCommandTransaction('UNDO', 'EXECUTED');
  setInfo("↩️ Đã hoàn tác (Undo) thao tác trước.");
}

function redoAction() {
  if (redoStack.length === 0) {
    setInfo("⚠️ Không còn thao tác nào để Redo.");
    return;
  }
  const currentSnapshot = {
    entities: JSON.parse(JSON.stringify(entities)),
    camera: { zoom, panX, panY, viewRotation }
  };
  undoStack.push(JSON.stringify(currentSnapshot));

  let raw = redoStack.pop();
  try {
    let state = JSON.parse(raw);
    if (Array.isArray(state)) {
      entities = state;
    } else if (state && state.entities) {
      entities = state.entities;
      if (state.camera) {
        zoom = state.camera.zoom ?? zoom;
        panX = state.camera.panX ?? panX;
        panY = state.camera.panY ?? panY;
        if (Number.isFinite(state.camera.viewRotation)) {
          viewRotation = state.camera.viewRotation;
        }
      }
    }
  } catch (e) {
    console.error("Lỗi redo:", e);
  }

  selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof autoSaveToDB === 'function') autoSaveToDB();
  if (typeof logCommandTransaction === 'function') logCommandTransaction('REDO', 'EXECUTED');
  setInfo("↪️ Đã làm lại (Redo) thao tác.");
}

function toggleOrtho() {
  orthoMode = !orthoMode;
  if (orthoStatus) orthoStatus.innerText = orthoMode ? 'ON' : 'OFF';
  const btn = document.getElementById('btn-ORTHO');
  if (btn) {
    if (orthoMode) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  if (cliMsg) cliMsg.innerText = `OSNAP: ON | GRID: ON | ORTHO: ${orthoMode ? 'ON' : 'OFF'} [F8]`;
  setInfo(`Chế độ ORTHO (F8): ${orthoMode ? 'BẬT (Khóa vuông góc 90°)' : 'TẮT'}`);
}
