// ===============================================================================
//           VINACAD DATABASE ENGINE (INDEXEDDB PERSISTENCE LAYER)
//   Real-Time Auto-Save • Zero Data Loss • Project Storage • Fast Restoration
//   Persistent Command Transaction Logging & Priority State Journal
// ===============================================================================

const DB_NAME = 'VinaCAD_Database';
const DB_VERSION = 3;
const STORE_ACTIVE = 'active_canvas';
const STORE_PROJECTS = 'projects';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_COMMAND_LOGS = 'command_logs';
const STORE_PLUGINS = 'custom_plugins';

let dbInstance = null;
let isDbReady = false;
let autoSaveTimer = null;
let currentProject = {
  id: 'default_project',
  name: 'Bản vẽ Hiện tại',
  createdAt: Date.now()
};

// Global Command Journal & Task Context
window.commandJournal = [];
window.activeTaskContext = null;

/**
 * Ghi nhận một giao dịch lệnh (Command Transaction) vào CSDL và Journal
 */
function logCommandTransaction(cmd, status = 'EXECUTED', meta = {}) {
  const entry = {
    id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString('vi-VN'),
    cmd: (cmd || 'UNKNOWN').toUpperCase(),
    status: status, // STARTED, WAITING_INPUT, EXECUTED, COMPLETED, CANCELLED, ERROR
    activeTool: typeof currentTool !== 'undefined' ? currentTool : 'SELECT',
    meta: meta || {}
  };

  window.commandJournal.push(entry);
  if (window.commandJournal.length > 100) window.commandJournal.shift();

  // Lưu vào IndexedDB
  if (isDbReady && dbInstance) {
    try {
      const tx = dbInstance.transaction([STORE_COMMAND_LOGS], 'readwrite');
      tx.objectStore(STORE_COMMAND_LOGS).put(entry);
    } catch (e) {}
  }

  // Backup sang localStorage
  try {
    localStorage.setItem('vinacad_last_command', JSON.stringify(entry));
  } catch (e) {}

  return entry;
}

/**
 * Thiết lập ngữ cảnh tác vụ đang xử lý ưu tiên (Active Task Context)
 */
function setTaskContext(cmd, step = 1, stepName = '', meta = {}) {
  window.activeTaskContext = {
    cmd: (cmd || '').toUpperCase(),
    step: step,
    stepName: stepName,
    timestamp: Date.now(),
    meta: meta || {}
  };
  logCommandTransaction(cmd, 'WAITING_INPUT', { step, stepName, ...meta });
}

/**
 * Xóa/Hoàn tất ngữ cảnh tác vụ
 */
function clearTaskContext() {
  if (window.activeTaskContext) {
    logCommandTransaction(window.activeTaskContext.cmd, 'COMPLETED', { step: window.activeTaskContext.step });
  }
  window.activeTaskContext = null;
}

/**
 * Lấy lệnh gần nhất đã thực thi
 */
function getMostRecentCommand() {
  if (window.activeTaskContext) return window.activeTaskContext.cmd;
  if (window.commandJournal && window.commandJournal.length > 0) {
    return window.commandJournal[window.commandJournal.length - 1].cmd;
  }
  try {
    let saved = localStorage.getItem('vinacad_last_command');
    if (saved) return JSON.parse(saved).cmd;
  } catch (e) {}
  return null;
}

// 1. Khởi tạo Cơ sở Dữ liệu IndexedDB
function initVinaCAD_DB(callback) {
  if (!window.indexedDB) {
    console.warn("⚠️ Trình duyệt không hỗ trợ IndexedDB. Sử dụng LocalStorage dự phòng.");
    initLocalStorageFallback();
    if (callback) callback();
    return;
  }

  const request = window.indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = function(event) {
    const db = event.target.result;

    if (!db.objectStoreNames.contains(STORE_ACTIVE)) {
      db.createObjectStore(STORE_ACTIVE, { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
      const projStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      projStore.createIndex('name', 'name', { unique: false });
      projStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
      const snapStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id', autoIncrement: true });
      snapStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORE_COMMAND_LOGS)) {
      const logStore = db.createObjectStore(STORE_COMMAND_LOGS, { keyPath: 'id' });
      logStore.createIndex('timestamp', 'timestamp', { unique: false });
      logStore.createIndex('cmd', 'cmd', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORE_PLUGINS)) {
      const pluginStore = db.createObjectStore(STORE_PLUGINS, { keyPath: 'id' });
      pluginStore.createIndex('name', 'name', { unique: false });
      pluginStore.createIndex('cmd', 'cmd', { unique: false });
    }
  };

  request.onsuccess = function(event) {
    dbInstance = event.target.result;
    isDbReady = true;
    console.log("✅ VinaCAD IndexedDB Engine đã sẵn sàng.");
    updateDbStatusUI('saved', '🟢 CSDL: Đã kết nối');

    // Tự động nạp bản vẽ từ CSDL khi khởi động
    restoreActiveCanvasFromDB(callback);

    // Tự động khôi phục các Plugin đã lưu trong CSDL
    if (typeof restorePluginsFromDB === 'function') {
      restorePluginsFromDB();
    }
  };

  request.onerror = function(event) {
    console.error("❌ Lỗi mở IndexedDB:", event.target.error);
    initLocalStorageFallback();
    if (callback) callback();
  };
}

// 2. Tự Động Lưu (Real-Time Debounced Auto-Save)
function autoSaveToDB(immediate = false) {
  updateDbStatusUI('saving', '⏳ CSDL: Đang lưu...');

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  const performSave = () => {
    const drawingPayload = {
      id: 'current_active_canvas',
      projectId: currentProject.id,
      projectName: currentProject.name,
      entities: entities,
      activeProperties: activeProperties,
      activeTaskContext: window.activeTaskContext,
      camera: {
        zoom: zoom,
        panX: panX,
        panY: panY,
        viewRotation: viewRotation
      },
      entityCount: entities.length,
      updatedAt: Date.now()
    };

    if (isDbReady && dbInstance) {
      try {
        const tx = dbInstance.transaction([STORE_ACTIVE], 'readwrite');
        const store = tx.objectStore(STORE_ACTIVE);
        const req = store.put(drawingPayload);

        req.onsuccess = function() {
          updateDbStatusUI('saved', `🟢 CSDL: Đã lưu (${entities.length} nét)`);
        };

        req.onerror = function(e) {
          console.warn("⚠️ Lỗi ghi IndexedDB, lưu sang LocalStorage:", e);
          saveToLocalStorageFallback(drawingPayload);
        };
      } catch (err) {
        saveToLocalStorageFallback(drawingPayload);
      }
    } else {
      saveToLocalStorageFallback(drawingPayload);
    }
  };

  if (immediate) {
    performSave();
  } else {
    autoSaveTimer = setTimeout(performSave, 250); // Debounce 250ms
  }
}

// 3. Phục Hồi Bản Vẽ Từ Cơ Sở Dữ Liệu
function restoreActiveCanvasFromDB(callback) {
  if (isDbReady && dbInstance) {
    try {
      const tx = dbInstance.transaction([STORE_ACTIVE], 'readonly');
      const store = tx.objectStore(STORE_ACTIVE);
      const req = store.get('current_active_canvas');

      req.onsuccess = function() {
        if (req.result && req.result.entities && req.result.entities.length > 0) {
          entities = req.result.entities;
          if (req.result.activeProperties) activeProperties = { ...activeProperties, ...req.result.activeProperties };
          if (req.result.activeTaskContext) window.activeTaskContext = req.result.activeTaskContext;
          if (req.result.camera) {
            zoom = req.result.camera.zoom || zoom;
            panX = req.result.camera.panX || panX;
            panY = req.result.camera.panY || panY;
            if (Number.isFinite(req.result.camera.viewRotation)) viewRotation = req.result.camera.viewRotation;
          }
          if (req.result.projectName) currentProject.name = req.result.projectName;

          console.log(`✨ Đã phục hồi ${entities.length} đối tượng từ CSDL.`);
          updateDbStatusUI('saved', `🟢 CSDL: Đã nạp (${entities.length} nét)`);
          setInfo(`✨ CSDL: Đã tự động phục hồi bản vẽ "${currentProject.name}" (${entities.length} đối tượng).`);
        } else {
          // Thử nạp từ LocalStorage fallback
          restoreFromLocalStorageFallback();
        }
        if (callback) callback();
      };

      req.onerror = function() {
        restoreFromLocalStorageFallback();
        if (callback) callback();
      };
      return;
    } catch (e) {
      restoreFromLocalStorageFallback();
    }
  } else {
    restoreFromLocalStorageFallback();
  }
  if (callback) callback();
}

// 4. Quản Lý Dự Án Trong Cơ Sở Dữ Liệu
function saveProjectAsNewToDB(projectName) {
  if (!projectName) projectName = prompt("Nhập tên dự án/tầng cần lưu vào CSDL:", "Mặt Bằng Tầng 1");
  if (!projectName) return;

  const projectId = 'proj_' + Date.now();
  currentProject = {
    id: projectId,
    name: projectName,
    createdAt: Date.now()
  };

  const projectPayload = {
    id: projectId,
    name: projectName,
    entities: entities,
    activeProperties: activeProperties,
    camera: { zoom, panX, panY, viewRotation },
    entityCount: entities.length,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (isDbReady && dbInstance) {
    const tx = dbInstance.transaction([STORE_PROJECTS, STORE_ACTIVE], 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(projectPayload);
    tx.objectStore(STORE_ACTIVE).put({
      id: 'current_active_canvas',
      ...projectPayload
    });

    tx.oncomplete = function() {
      updateDbStatusUI('saved', `🟢 Đã lưu dự án: ${projectName}`);
      setInfo(`💾 Đã lưu dự án "${projectName}" vào CSDL (${entities.length} đối tượng).`);
      alert(`Đã lưu dự án [${projectName}] thành công vào CSDL!`);
    };
  }
}

function listProjectsFromDB(callback) {
  if (!isDbReady || !dbInstance) {
    if (callback) callback([]);
    return;
  }

  const tx = dbInstance.transaction([STORE_PROJECTS], 'readonly');
  const store = tx.objectStore(STORE_PROJECTS);
  const req = store.getAll();

  req.onsuccess = function() {
    if (callback) callback(req.result || []);
  };
  req.onerror = function() {
    if (callback) callback([]);
  };
}

function loadProjectByIdFromDB(projectId) {
  if (!isDbReady || !dbInstance) return;

  const tx = dbInstance.transaction([STORE_PROJECTS], 'readonly');
  const store = tx.objectStore(STORE_PROJECTS);
  const req = store.get(projectId);

  req.onsuccess = function() {
    const p = req.result;
    if (p && p.entities) {
      saveState();
      entities = p.entities;
      if (p.activeProperties) activeProperties = { ...activeProperties, ...p.activeProperties };
      if (p.camera) {
        zoom = p.camera.zoom || zoom;
        panX = p.camera.panX || panX;
        panY = p.camera.panY || panY;
        if (Number.isFinite(p.camera.viewRotation)) viewRotation = p.camera.viewRotation;
      }
      currentProject = { id: p.id, name: p.name, createdAt: p.createdAt };
      selectedIds.clear();
      autoSaveToDB(true);
      if (typeof zoomAll === 'function') zoomAll();
      setInfo(`📂 Đã mở dự án "${p.name}" từ CSDL (${p.entities.length} đối tượng).`);
    }
  };
}

// 5. LocalStorage Fallback
function initLocalStorageFallback() {
  restoreFromLocalStorageFallback();
}

function saveToLocalStorageFallback(payload) {
  try {
    localStorage.setItem('vinacad_active_canvas', JSON.stringify(payload));
    updateDbStatusUI('saved', `🟢 CSDL Local: Đã lưu (${entities.length} nét)`);
  } catch (e) {
    updateDbStatusUI('error', '⚠️ Bộ nhớ đầy');
  }
}

function restoreFromLocalStorageFallback() {
  try {
    const raw = localStorage.getItem('vinacad_active_canvas');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.entities && data.entities.length > 0) {
        entities = data.entities;
        if (data.activeProperties) activeProperties = { ...activeProperties, ...data.activeProperties };
        if (data.camera) {
          zoom = data.camera.zoom || zoom;
          panX = data.camera.panX || panX;
          panY = data.camera.panY || panY;
          if (Number.isFinite(data.camera.viewRotation)) viewRotation = data.camera.viewRotation;
        }
        if (data.projectName) currentProject.name = data.projectName;
        updateDbStatusUI('saved', `🟢 CSDL Local: Đã nạp (${entities.length} nét)`);
      }
    }
  } catch (e) {}
}

// 6. In Nhật Ký Giao Dịch Lệnh (Command Execution Journal)
function printCommandHistory() {
  if (!window.commandJournal || window.commandJournal.length === 0) {
    setInfo("📜 Chưa có nhật ký lệnh nào được ghi nhận.", 'prompt');
    return;
  }
  let lines = ["📜 NHẬT KÝ GIAO DỊCH LỆNH GẦN NHẤT (COMMAND JOURNAL):"];
  window.commandJournal.slice(-10).forEach((tx, idx) => {
    lines.push(`  #${idx + 1} [${tx.timeStr}] Lệnh: ${tx.cmd} | Trạng thái: ${tx.status} | Tool: ${tx.activeTool}`);
  });
  if (window.activeTaskContext) {
    lines.push(`🔥 TÁC VỤ ĐANG HOẠT ĐỘNG ƯU TIÊN: [${window.activeTaskContext.cmd}] (Bước ${window.activeTaskContext.step}: ${window.activeTaskContext.stepName})`);
  }
  lines.forEach(l => {
    if (typeof logToCliHistory === 'function') logToCliHistory(l, 'info');
  });
}

// 7. UI HUD Status Indicator
function updateDbStatusUI(status, message) {
  const el = document.getElementById('hud-db-status');
  if (!el) return;

  el.innerText = message;
  el.className = 'hud-db-' + status;
}
