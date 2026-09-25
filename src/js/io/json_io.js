// ===============================================================================
//         VINACAD FILE MANAGEMENT ENGINE (NEW / OPEN / SAVE / DRAG & DROP)
//   Instant 1-Click File Loader • Zero Duplicate Dialogs • Solid Debounce Guard
// ===============================================================================

let lastFilePickerOpenTime = 0;
let isFileLoading = false;

function createNewDrawing(confirmPrompt = true) {
  if (confirmPrompt && typeof entities !== 'undefined' && entities.length > 0) {
    let ok = confirm("Bạn có chắc chắn muốn tạo bản vẽ mới? Bản vẽ hiện tại sẽ được lưu vào cơ sở dữ liệu ngầm.");
    if (!ok) return;
  }
  if (typeof saveState === 'function') saveState();
  entities = [];
  selectedIds.clear();
  undoStack = [];
  redoStack = [];
  zoom = 0.08;
  panX = 0;
  panY = 0;
  viewRotation = 0;
  if (typeof autoSaveToDB === 'function') autoSaveToDB(true);
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof selectTool === 'function') selectTool('SELECT');
  if (typeof setInfo === 'function') setInfo("📄 Đã tạo bản vẽ mới sạch sẽ (Ctrl+N / Lệnh NEW). Nhập L, PL, REC hoặc APPLOAD để bắt đầu vẽ.");
  if (typeof logToCliHistory === 'function') logToCliHistory("Tạo bản vẽ mới: NEW (Ctrl+N)", "cmd");
}

/**
 * Mở hộp thoại chọn tệp với cơ chế khóa chống mở lặp lại (Debounce 1000ms)
 */
function openFilePicker() {
  const now = Date.now();
  if (now - lastFilePickerOpenTime < 1000) {
    return; // Chặn đúp click hoặc sự kiện nổi bọt gây mở 2 lần
  }
  lastFilePickerOpenTime = now;

  const fileInput = document.getElementById('cad-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

/**
 * Xử lý khi người dùng chọn xong file từ máy tính
 */
function handleFileInput(e) {
  if (isFileLoading) return;
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  isFileLoading = true;

  try {
    loadCadFile(file);
  } finally {
    setTimeout(() => {
      if (e.target) e.target.value = '';
      isFileLoading = false;
    }, 400);
  }
}

/**
 * Đọc nội dung file và nạp thẳng lên Canvas hoặc nạp Plugin ngầm
 */
function loadCadFile(file) {
  if (!file) return;
  let name = file.name.toLowerCase();

  // 1. Nếu là file Tool / AutoLISP / Plugin JavaScript -> Nạp thẳng chạy luôn mà không mở popup thừa
  if (name.endsWith('.lsp') || name.endsWith('.js') || name.endsWith('.py')) {
    if (typeof processFileList === 'function') {
      processFileList([file], false);
      return;
    }
  }

  // 2. Nếu là file Bản vẽ (JSON / DXF) -> Đọc và đưa thẳng lên màn hình vẽ ngay lập tức
  let reader = new FileReader();
  reader.onload = function(evt) {
    let content = evt.target.result;

    if (name.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
      try {
        let parsed = JSON.parse(content);
        let loadedEnts = [];
        if (Array.isArray(parsed)) {
          loadedEnts = parsed;
        } else if (parsed && parsed.entities && Array.isArray(parsed.entities)) {
          loadedEnts = parsed.entities;
          if (parsed.camera) {
            zoom = parsed.camera.zoom || zoom;
            panX = parsed.camera.panX || panX;
            panY = parsed.camera.panY || panY;
            if (Number.isFinite(parsed.camera.viewRotation)) viewRotation = parsed.camera.viewRotation;
          }
        }

        if (loadedEnts.length >= 0) {
          saveState();
          entities = loadedEnts;
          selectedIds.clear();
          if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
          if (typeof zoomAll === 'function') zoomAll();
          if (typeof autoSaveToDB === 'function') autoSaveToDB(true);
          
          let msg = `📂 Đã mở bản vẽ "${file.name}" (${entities.length} đối tượng) lên màn hình.`;
          setInfo(msg, 'success');
          if (typeof logToCliHistory === 'function') logToCliHistory(msg, 'success');
          return;
        }
      } catch (err) {
        alert("Lỗi đọc file JSON: " + err.message);
        return;
      }
    }

    if (name.endsWith('.dxf') || content.includes('SECTION') || content.includes('ENTITIES')) {
      try {
        if (typeof parseDXF === 'function') {
          let dxfEnts = parseDXF(content);
          if (dxfEnts.length > 0) {
            saveState();
            entities = dxfEnts;
            selectedIds.clear();
            if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
            if (typeof zoomAll === 'function') zoomAll();
            if (typeof autoSaveToDB === 'function') autoSaveToDB(true);
            
            let msg = `📂 Đã nạp thành công file DXF AutoCAD "${file.name}" (${dxfEnts.length} đối tượng).`;
            setInfo(msg, 'success');
            if (typeof logToCliHistory === 'function') logToCliHistory(msg, 'success');
            return;
          } else {
            alert("Không tìm thấy đối tượng 2D nào trong file DXF.");
            return;
          }
        }
      } catch (err) {
        alert("Lỗi đọc file DXF: " + err.message);
        return;
      }
    }

    alert("Định dạng file không được hỗ trợ. Hãy chọn file .json, .dxf, .lsp hoặc .js.");
  };
  reader.readAsText(file);
}

// Thiết lập Drag & Drop vào Canvas
if (typeof viewport !== 'undefined' && viewport) {
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    let file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadCadFile(file);
  });
}

function saveJSON() {
  if (entities.length === 0) {
    setInfo("⚠️ Bản vẽ trống, không có đối tượng để lưu.");
    return;
  }
  const drawing = {
    version: 2,
    entities: entities,
    camera: { zoom, panX, panY, viewRotation }
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(drawing, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = "ban_ve_cad.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setInfo("💾 Đã lưu toàn bộ bản vẽ thành file JSON (ban_ve_cad.json).");
}
