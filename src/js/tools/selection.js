// SELECTION & CANVAS UTILITIES
function selectTool(tool) {
  let prevTool = currentTool;
  currentTool = tool;
  isDrawing = false;
  startPoint = null;
  midPoint = null;
  polyPoints = [];
  if (dynBox) dynBox.style.display = 'none';

  const TRANSFORM_TOOLS = ['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'];

  // Cập nhật State Machine cho lệnh AutoCAD
  if (tool === 'SELECT' || tool === 'PAN') {
    activeCommandContext = { cmd: null, phase: 'IDLE' };
  } else if (TRANSFORM_TOOLS.includes(tool)) {
    if (selectedIds.size > 0) {
      activeCommandContext = { cmd: tool, phase: 'PICK_BASE_POINT' };
    } else {
      activeCommandContext = { cmd: tool, phase: 'SELECT_OBJECTS' };
    }
  } else if (tool === 'ERASE') {
    if (selectedIds.size > 0) {
      deleteSelection();
      return;
    } else {
      activeCommandContext = { cmd: 'ERASE', phase: 'SELECT_OBJECTS' };
    }
  } else {
    activeCommandContext = { cmd: tool, phase: 'IDLE' };
  }

  if (tool && tool !== 'SELECT' && tool !== 'PAN') {
    if (typeof lastExecutedCommand !== 'undefined') lastExecutedCommand = tool;
    window.lastExecutedCommand = tool;
  }

  // Trigger onDeactivate on previous custom tool handler
  if (prevTool && prevTool !== tool && window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[prevTool]) {
    let prevHandler = window.cadPluginHooks.toolHandlers[prevTool];
    if (typeof prevHandler.onDeactivate === 'function') {
      try { prevHandler.onDeactivate(); } catch (err) { console.error(err); }
    }
  }

  // Highlight active button in ribbon
  document.querySelectorAll('.btn').forEach(b => {
    if (b.id && b.id.startsWith('btn-') && b.id !== 'btn-ORTHO' && b.id !== 'btn-PROPERTIES') {
      b.classList.remove('active');
    }
  });

  const activeBtn = document.getElementById('btn-' + tool);
  if (activeBtn) activeBtn.classList.add('active');

  // Trigger onActivate on new custom tool handler if registered
  if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[tool]) {
    let handler = window.cadPluginHooks.toolHandlers[tool];
    if (typeof handler.onActivate === 'function') {
      try { handler.onActivate(); } catch (err) { console.error(err); }
    }
  } else if (typeof window['init' + tool + 'Tool'] === 'function') {
    try { window['init' + tool + 'Tool'](); } catch (err) { console.error(err); }
  } else if (tool === 'SELECT') {
    setInfo("👆 Chế độ Chọn (SELECT): Nhấp hoặc quét khung để chọn đối tượng.");
  } else if (TRANSFORM_TOOLS.includes(tool)) {
    if (activeCommandContext.phase === 'PICK_BASE_POINT') {
      setInfo(`👉 [${tool}] Bước 2/2: Đang chọn ${selectedIds.size} đối tượng. Hãy nhấp Điểm Gốc (Base Point)...`);
    } else {
      setInfo(`👉 [${tool}] Bước 1/2: Quét hoặc nhấp chọn các đối tượng. Bấm ENTER / SPACE khi chọn xong.`);
    }
  } else if (tool === 'ERASE') {
    setInfo("❌ [ERASE] Quét hoặc nhấp chọn các đối tượng cần xóa. Bấm ENTER / SPACE để xóa.");
  } else {
    setInfo(`🛠️ Đang kích hoạt lệnh [${tool}]. Nhấp chuột trên bản vẽ để bắt đầu.`);
  }

  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
}

function deleteSelection() {
  if (selectedIds.size === 0) {
    selectTool('ERASE');
    setInfo("❌ Chế độ Xóa: Nhấp trực tiếp vào bất kỳ nét nào trên bản vẽ để xóa.");
    return;
  }
  saveState();
  entities = entities.filter(e => !selectedIds.has(e.id));
  selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  setInfo("❌ Đã xóa các đối tượng được chọn.");
}

function clearCanvas() {
  saveState();
  entities = [];
  selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  setInfo("🧹 Đã làm sạch toàn bộ bản vẽ.");
}

function zoomAll() {
  if (entities.length === 0) {
    zoom = 0.08;
    panX = 0;
    panY = 0;
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let e of entities) {
    let bb = getEntityBoundingBox(e);
    if (bb) {
      minX = Math.min(minX, bb.minX);
      maxX = Math.max(maxX, bb.maxX);
      minY = Math.min(minY, bb.minY);
      maxY = Math.max(maxY, bb.maxY);
    }
  }
  if (!isFinite(minX) || !isFinite(maxX)) return;
  let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let w = Math.max(maxX - minX, 1000), h = Math.max(maxY - minY, 1000);
  zoom = Math.min((canvas.width - 120) / w, (canvas.height - 120) / h, 0.5);
  const angle = viewRotation * Math.PI / 180;
  const rotatedCx = cx * Math.cos(angle) - cy * Math.sin(angle);
  const rotatedCy = cx * Math.sin(angle) + cy * Math.cos(angle);
  panX = -rotatedCx * zoom;
  panY = rotatedCy * zoom;
  setInfo("🔍 Đã phóng to toàn bộ bản vẽ (Zoom Extents).");
}
