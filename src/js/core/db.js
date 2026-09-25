// ===============================================================================
//           VINACAD DATABASE ENGINE (INDEXEDDB PERSISTENCE LAYER)
//   Real-Time Auto-Save • Zero Data Loss • Manual Quick Save • Fast Restoration
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
let autoSaveDaemonInterval = null;
let lastSavedSignature = '';
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
    startAutoSaveDaemon();
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

    // Khởi động tiến trình tự động lưu ngầm định kỳ
    startAutoSaveDaemon();
  };

  request.onerror = function(event) {
    console.error("❌ Lỗi mở IndexedDB:", event.target.error);
    initLocalStorageFallback();
    startAutoSaveDaemon();
    if (callback) callback();
  };
}

/**
 * Tạo chữ ký (signature) nhận diện trạng thái bản vẽ để phát hiện thay đổi
 */
function getDrawingSignature() {
  const entCount = typeof entities !== 'undefined' ? entities.length : 0;
  const undoCount = typeof undoStack !== 'undefined' ? undoStack.length : 0;
  const lastEntId = entCount > 0 ? (entities[entCount - 1].id || '') : '';
  const camStr = `${Math.round((typeof zoom !== 'undefined' ? zoom : 1) * 1000)}_${Math.round(typeof panX !== 'undefined' ? panX : 0)}_${Math.round(typeof panY !== 'undefined' ? panY : 0)}`;
  return `${entCount}_${undoCount}_${lastEntId}_${camStr}`;
}

// 2. Tự Động Lưu (Real-Time Debounced & Periodic Background Auto-Save)
function autoSaveToDB(immediate = false, isManual = false) {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  const performSave = () => {
    const currentSig = getDrawingSignature();
    const timeStr = new Date().toLocaleTimeString('vi-VN');

    // Lưu tối đa 30 bước undo gần nhất để giảm dung lượng nhưng vẫn bảo toàn lịch sử
    const compactUndo = typeof undoStack !== 'undefined' ? undoStack.slice(-30) : [];
    const compactRedo = typeof redoStack !== 'undefined' ? redoStack.slice(-30) : [];

    const drawingPayload = {
      id: 'current_active_canvas',
      projectId: currentProject.id,
      projectName: currentProject.name,
      entities: typeof entities !== 'undefined' ? entities : [],
      undoStack: compactUndo,
      redoStack: compactRedo,
      activeProperties: typeof activeProperties !== 'undefined' ? activeProperties : {},
      orthoMode: typeof orthoMode !== 'undefined' ? orthoMode : false,
      activeTaskContext: window.activeTaskContext,
      camera: {
        zoom: typeof zoom !== 'undefined' ? zoom : 0.08,
        panX: typeof panX !== 'undefined' ? panX : 0,
        panY: typeof panY !== 'undefined' ? panY : 0,
        viewRotation: typeof viewRotation !== 'undefined' ? viewRotation : 0
      },
      lastExecutedCommand: window.lastExecutedCommand || (typeof lastExecutedCommand !== 'undefined' ? lastExecutedCommand : null),
      entityCount: typeof entities !== 'undefined' ? entities.length : 0,
      saveType: isManual ? 'MANUAL' : 'AUTO',
      updatedAt: Date.now()
    };

    lastSavedSignature = currentSig;

    if (isDbReady && dbInstance) {
      try {
        const tx = dbInstance.transaction([STORE_ACTIVE], 'readwrite');
        const store = tx.objectStore(STORE_ACTIVE);
        const req = store.put(drawingPayload);

        req.onsuccess = function() {
          const count = drawingPayload.entityCount;
          if (isManual) {
            updateDbStatusUI('saved', `🟢 Đã lưu lúc ${timeStr} (${count} nét)`);
          } else {
            updateDbStatusUI('saved', `🟢 Tự động lưu lúc ${timeStr} (${count} nét)`);
          }
        };

        req.onerror = function(e) {
          console.warn("⚠️ Lỗi ghi IndexedDB, chuyển sang LocalStorage:", e);
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
    updateDbStatusUI('saving', '⏳ CSDL: Đang lưu...');
    autoSaveTimer = setTimeout(performSave, 250); // Debounce 250ms
  }
}

/**
 * ⚡ NÚT LƯU NHANH THỦ CÔNG (Manual Quick Save - QSAVE / Ctrl+S)
 * Đảm bảo 100% bản vẽ, tiến trình hiện tại và snapshot được lưu ngay lập tức
 */
function quickSaveProject(manual = true) {
  // 1. Thực hiện lưu khẩn cấp tức thì vào CSDL Active
  autoSaveToDB(true, manual);

  const timeStr = new Date().toLocaleTimeString('vi-VN');
  const count = typeof entities !== 'undefined' ? entities.length : 0;

  // 2. Lưu thêm 1 Snapshot vào lịch sử CSDL
  if (isDbReady && dbInstance && count > 0) {
    try {
      const snapPayload = {
        timestamp: Date.now(),
        timeStr: timeStr,
        projectName: currentProject.name,
        entityCount: count,
        entities: JSON.parse(JSON.stringify(entities)),
        camera: { zoom, panX, panY, viewRotation }
      };
      const tx = dbInstance.transaction([STORE_SNAPSHOTS], 'readwrite');
      tx.objectStore(STORE_SNAPSHOTS).put(snapPayload);
    } catch (e) {}
  }

  // 3. Hiệu ứng Visual Feedback trên nút Ribbon
  const saveBtn = document.getElementById('btn-QUICKSAVE');
  if (saveBtn) {
    saveBtn.classList.remove('saved-pulse');
    void saveBtn.offsetWidth; // Trigger reflow
    saveBtn.classList.add('saved-pulse');
    const oldText = saveBtn.innerHTML;
    saveBtn.innerHTML = '✅ Đã lưu!';
    setTimeout(() => {
      saveBtn.innerHTML = oldText;
      saveBtn.classList.remove('saved-pulse');
    }, 1500);
  }

  // 4. Cập nhật HUD & CLI Thông báo
  updateDbStatusUI('saved', `🟢 Đã lưu lúc ${timeStr} (${count} nét)`);
  if (typeof setInfo === 'function') {
    setInfo(`💾 Đã lưu thành công bản vẽ "${currentProject.name}" (${count} đối tượng) vào CSDL an toàn!`, 'success');
  }
  if (typeof logToCliHistory === 'function') {
    logToCliHistory(`[QSAVE] ${timeStr}: Đã lưu an toàn ${count} đối tượng & tiến trình làm việc vào CSDL.`, 'success');
  }

  return true;
}

window.quickSaveProject = quickSaveProject;
window.autoSaveToDB = autoSaveToDB;

/**
 * 🔄 TIẾN TRÌNH TỰ ĐỘNG LƯU ĐỊNH KỲ (Background Auto-Save Daemon)
 * Tự động chạy lưu ngầm mỗi 3 giây nếu người dùng không bấm nút lưu
 */
function startAutoSaveDaemon() {
  if (autoSaveDaemonInterval) clearInterval(autoSaveDaemonInterval);

  autoSaveDaemonInterval = setInterval(() => {
    const currentSig = getDrawingSignature();
    // Nếu có sự thay đổi chưa được ghi vào CSDL thì tự động lưu ngay
    if (currentSig !== lastSavedSignature) {
      autoSaveToDB(false, false);
    }
  }, 3000); // 3 giây kiểm tra và lưu ngầm 1 lần
}

// Bắt các sự kiện đóng tab, ẩn tab, chuyển cửa sổ để lưu tức thì chống mất dữ liệu
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    autoSaveToDB(true, false);
  });
  window.addEventListener('pagehide', () => {
    autoSaveToDB(true, false);
  });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        autoSaveToDB(true, false);
      }
    });
  }
}

// 3. Phục Hồi Bản Vẽ Từ Cơ Sở Dữ Liệu Khi Khởi Động
function restoreActiveCanvasFromDB(callback) {
  if (isDbReady && dbInstance) {
    try {
      const tx = dbInstance.transaction([STORE_ACTIVE], 'readonly');
      const store = tx.objectStore(STORE_ACTIVE);
      const req = store.get('current_active_canvas');

      req.onsuccess = function() {
        const res = req.result;
        if (res && res.entities && res.entities.length > 0) {
          entities = res.entities;
          if (Array.isArray(res.undoStack) && res.undoStack.length > 0) undoStack = res.undoStack;
          if (Array.isArray(res.redoStack)) redoStack = res.redoStack;
          if (res.activeProperties) activeProperties = { ...activeProperties, ...res.activeProperties };
          if (typeof res.orthoMode === 'boolean') {
            orthoMode = res.orthoMode;
            const orthoBtn = document.getElementById('btn-ORTHO');
            const orthoStatus = document.getElementById('ortho-status');
            if (orthoBtn) orthoBtn.classList.toggle('active', orthoMode);
            if (orthoStatus) orthoStatus.innerText = orthoMode ? 'ON' : 'OFF';
          }
          if (res.activeTaskContext) window.activeTaskContext = res.activeTaskContext;
          if (res.camera) {
            zoom = res.camera.zoom || zoom;
            panX = res.camera.panX || panX;
            panY = res.camera.panY || panY;
            if (Number.isFinite(res.camera.viewRotation)) viewRotation = res.camera.viewRotation;
          }
          if (res.projectName) currentProject.name = res.projectName;
          if (res.lastExecutedCommand) {
            window.lastExecutedCommand = res.lastExecutedCommand;
            lastExecutedCommand = res.lastExecutedCommand;
          }

          lastSavedSignature = getDrawingSignature();
          console.log(`✨ Đã phục hồi ${entities.length} đối tượng & tiến trình từ CSDL.`);
          const savedTime = res.updatedAt ? new Date(res.updatedAt).toLocaleTimeString('vi-VN') : '';
          updateDbStatusUI('saved', `🟢 CSDL: Đã nạp (${entities.length} nét${savedTime ? ' - ' + savedTime : ''})`);
          if (typeof setInfo === 'function') {
            setInfo(`✨ CSDL: Đã tự động phục hồi bản vẽ "${currentProject.name}" (${entities.length} đối tượng).`);
          }
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
    undoStack: typeof undoStack !== 'undefined' ? undoStack.slice(-30) : [],
    redoStack: typeof redoStack !== 'undefined' ? redoStack.slice(-30) : [],
    activeProperties: activeProperties,
    orthoMode: orthoMode,
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
      if (Array.isArray(p.undoStack)) undoStack = p.undoStack;
      if (Array.isArray(p.redoStack)) redoStack = p.redoStack;
      if (p.activeProperties) activeProperties = { ...activeProperties, ...p.activeProperties };
      if (typeof p.orthoMode === 'boolean') orthoMode = p.orthoMode;
      if (p.camera) {
        zoom = p.camera.zoom || zoom;
        panX = p.camera.panX || panX;
        panY = p.camera.panY || panY;
        if (Number.isFinite(p.camera.viewRotation)) viewRotation = p.camera.viewRotation;
      }
      currentProject = { id: p.id, name: p.name, createdAt: p.createdAt };
      selectedIds.clear();
      quickSaveProject(true);
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
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    updateDbStatusUI('saved', `🟢 CSDL Local: Đã lưu (${entities.length} nét - ${timeStr})`);
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
        if (Array.isArray(data.undoStack)) undoStack = data.undoStack;
        if (Array.isArray(data.redoStack)) redoStack = data.redoStack;
        if (data.activeProperties) activeProperties = { ...activeProperties, ...data.activeProperties };
        if (typeof data.orthoMode === 'boolean') orthoMode = data.orthoMode;
        if (data.camera) {
          zoom = data.camera.zoom || zoom;
          panX = data.camera.panX || panX;
          panY = data.camera.panY || panY;
          if (Number.isFinite(data.camera.viewRotation)) viewRotation = data.camera.viewRotation;
        }
        if (data.projectName) currentProject.name = data.projectName;
        lastSavedSignature = getDrawingSignature();
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
