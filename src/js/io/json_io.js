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
 * Tự động chặn và báo tên cụ thể của tệp nếu tệp bị lỗi hoặc sai cấu trúc
 */
function loadCadFile(file) {
  if (!file) return;
  let name = file.name.toLowerCase();

  // 1. Nếu là file Tool / AutoLISP / Plugin JavaScript -> Nạp qua bộ nạp Tool (có chặn lỗi tự động)
  if (name.endsWith('.lsp') || name.endsWith('.js') || name.endsWith('.py')) {
    if (typeof processFileList === 'function') {
      processFileList([file], true);
      return;
    }
  }

  // 2. Nếu là file Bản vẽ (JSON / DXF) -> Đọc và kiểm tra tính toàn vẹn
  let reader = new FileReader();

  reader.onerror = function() {
    if (typeof showCadAlert === 'function') {
      showCadAlert({
        title: "Lỗi Đọc Tệp Bản Vẽ",
        message: `Không thể đọc tệp <b>${file.name}</b> từ thiết bị. Tệp có thể đang bị ứng dụng khác khóa hoặc bị hỏng.`,
        type: "error"
      });
    }
  };

  reader.onload = function(evt) {
    let content = evt.target.result;

    if (!content || !content.trim()) {
      if (typeof showCadAlert === 'function') {
        showCadAlert({
          title: "Tệp Bản Vẽ Rỗng",
          message: `Tệp <b>${file.name}</b> rỗng (0 KB), không chứa dữ liệu hình học để hiển thị.`,
          type: "warning"
        });
      }
      return;
    }

    // A. XỬ LÝ FILE JSON
    if (name.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
      try {
        let parsed = JSON.parse(content);
        let loadedEnts = null;

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

        if (loadedEnts !== null && Array.isArray(loadedEnts)) {
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
        } else {
          throw new Error("Cấu trúc JSON không chứa mảng 'entities' hợp lệ của bản vẽ CAD.");
        }
      } catch (err) {
        if (typeof showCadAlert === 'function') {
          showCadAlert({
            title: "Đã Chặn Tệp Bản Vẽ Lỗi!",
            message: `Hệ thống đã chặn tệp <b>${file.name}</b> để bảo vệ bản vẽ hiện tại:<br><br>
            <div style="background:#1e1e2e; border-left:3px solid #ef4444; padding:8px 12px; border-radius:4px; text-align:left;">
              <div style="font-weight:700; color:#ef4444; font-size:13px;">📄 ${file.name}</div>
              <div style="color:#fca5a5; font-size:12px; margin-top:2px;">⚠️ <b>Chi tiết:</b> ${err.message}</div>
            </div>`,
            type: "error"
          });
        }
        return;
      }
    }

    // B. XỬ LÝ FILE DXF AUTOCAD
    if (name.endsWith('.dxf') || content.includes('SECTION') || content.includes('ENTITIES')) {
      try {
        if (typeof parseDXF === 'function') {
          let dxfEnts = parseDXF(content);
          if (dxfEnts && dxfEnts.length > 0) {
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
            throw new Error("Không tìm thấy đối tượng hình học 2D nào tương thích trong file DXF.");
          }
        } else {
          throw new Error("Bộ phân tích DXF chưa được khởi tạo.");
        }
      } catch (err) {
        if (typeof showCadAlert === 'function') {
          showCadAlert({
            title: "Lỗi Đọc File DXF",
            message: `Hệ thống đã chặn tệp DXF bị lỗi <b>${file.name}</b>:<br><br>
            <div style="background:#1e1e2e; border-left:3px solid #ef4444; padding:8px 12px; border-radius:4px; text-align:left;">
              <div style="font-weight:700; color:#ef4444; font-size:13px;">📄 ${file.name}</div>
              <div style="color:#fca5a5; font-size:12px; margin-top:2px;">⚠️ <b>Chi tiết:</b> ${err.message}</div>
            </div>`,
            type: "error"
          });
        }
        return;
      }
    }

    // C. ĐỊNH DẠNG KHÔNG HỢP LỆ
    if (typeof showCadAlert === 'function') {
      showCadAlert({
        title: "Định Dạng Không Hỗ Trợ",
        message: `Tệp <b>${file.name}</b> không thuộc định dạng được hỗ trợ.<br><br>Vui lòng chọn tệp bản vẽ (<b>.json</b>, <b>.dxf</b>) hoặc tệp Tool mở rộng (<b>.lsp</b>, <b>.js</b>, <b>.py</b>).`,
        type: "warning"
      });
    }
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
