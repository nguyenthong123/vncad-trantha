// JSON FILE MANAGEMENT (NEW / OPEN / SAVE / DRAG & DROP)
const fileInput = document.getElementById('cad-file-input');

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
  if (typeof autoSaveToDB === 'function') autoSaveToDB();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof selectTool === 'function') selectTool('SELECT');
  if (typeof setInfo === 'function') setInfo("📄 Đã tạo bản vẽ mới sạch sẽ (Ctrl+N / Lệnh NEW). Nhập L, PL, REC hoặc APPLOAD để bắt đầu vẽ.");
  if (typeof logToCliHistory === 'function') logToCliHistory("Tạo bản vẽ mới: NEW (Ctrl+N)", "cmd");
}

function openFilePicker() {
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleFileInput(e) {
  let file = e.target.files[0];
  if (file) loadCadFile(file);
}

function loadCadFile(file) {
  let reader = new FileReader();
  reader.onload = function(evt) {
    let content = evt.target.result;
    let name = file.name.toLowerCase();

    if (name.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
      try {
        let parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          saveState();
          entities = parsed;
          selectedIds.clear();
          if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
          zoomAll();
          setInfo(`📂 Đã nạp thành công bản vẽ từ file JSON: "${file.name}" (${entities.length} đối tượng).`);
          return;
        } else if (parsed.entities && Array.isArray(parsed.entities)) {
          saveState();
          entities = parsed.entities;
          if (parsed.camera) {
            zoom = parsed.camera.zoom || zoom;
            panX = parsed.camera.panX || panX;
            panY = parsed.camera.panY || panY;
            if (Number.isFinite(parsed.camera.viewRotation)) viewRotation = parsed.camera.viewRotation;
          }
          selectedIds.clear();
          if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
          zoomAll();
          setInfo(`📂 Đã nạp thành công bản vẽ từ file JSON: "${file.name}" (${entities.length} đối tượng).`);
          return;
        }
      } catch (err) {
        alert("Lỗi đọc file JSON: " + err.message);
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
            zoomAll();
            setInfo(`📂 Đã nhập thành công file DXF AutoCAD: "${file.name}" (${dxfEnts.length} đối tượng).`);
            return;
          } else {
            alert("Không tìm thấy đối tượng 2D (Line, Polyline, Circle, Text) nào trong file DXF.");
          }
        }
      } catch (err) {
        alert("Lỗi đọc file DXF: " + err.message);
      }
    }
  };
  reader.readAsText(file);
}

if (viewport) {
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    let file = e.dataTransfer.files[0];
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
