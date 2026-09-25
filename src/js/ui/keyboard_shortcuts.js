// ===============================================================================
//     AUTOCAD GLOBAL KEYBOARD SHORTCUTS & EVENT DISPATCHER
//     Hỗ trợ F8 (Ortho), ESC (Thoát lệnh/Hủy chọn), Ctrl+A, Delete, Enter, Space, Auto-typing
// ===============================================================================

window.addEventListener('keydown', (e) => {
  if (e.key === 'F8') {
    e.preventDefault();
    if (typeof toggleOrtho === 'function') toggleOrtho();
    return;
  }

  // Phím ESC: Thoát lệnh, hủy toàn bộ lựa chọn (Deselect All), đóng popup/modal & reset trạng thái
  if (e.key === 'Escape') {
    e.preventDefault();

    // 1. Kích hoạt tất cả escape handlers từ plugin
    if (window.cadPluginHooks && Array.isArray(window.cadPluginHooks.escapeHandlers)) {
      window.cadPluginHooks.escapeHandlers.forEach(fn => {
        try { if (typeof fn === 'function') fn(); } catch (err) { console.error(err); }
      });
    }

    // 2. Đóng hộp thoại Appload nếu đang mở
    if (typeof closeApploadModal === 'function') closeApploadModal();

    // 3. Hủy trạng thái vẽ & thao tác đang dở dang
    isDrawing = false;
    startPoint = null;
    midPoint = null;
    polyPoints = [];
    isPanning = false;
    isBoxSelecting = false;
    if (typeof dynBox !== 'undefined' && dynBox) dynBox.style.display = 'none';
    if (typeof dynInput !== 'undefined' && dynInput) dynInput.value = '';

    // 4. Bỏ chọn toàn bộ đối tượng (Deselect All) & Xóa Grip
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

    // 5. Đưa về công cụ chọn chuẩn SELECT
    if (typeof selectTool === 'function') selectTool('SELECT');

    // 6. Xóa dòng lệnh CLI & hiển thị thông báo hủy
    if (typeof cliInput !== 'undefined' && cliInput) cliInput.value = '';
    if (typeof logToCliHistory === 'function') logToCliHistory('*Cancel*', 'prompt');
    if (typeof setInfo === 'function') setInfo("👆 Chế độ Chọn (SELECT): Nhấp vào đối tượng để chọn (hoặc gõ lệnh để thao tác).");
    return;
  }

  // Ctrl+A / Cmd+A : Chọn tất cả đối tượng (Select All)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
    if (document.activeElement !== cliInput && document.activeElement !== dynInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
      e.preventDefault();
      if (typeof selectedIds !== 'undefined') {
        selectedIds.clear();
        for (let ent of entities) {
          selectedIds.add(ent.id);
        }
      }
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      if (typeof setInfo === 'function') setInfo(`✅ Đã chọn tất cả (${selectedIds.size} đối tượng). Bạn có thể đổi màu trên Ribbon hoặc Bảng thuộc tính.`);
      return;
    }
  }

  // Ctrl+S / Cmd+S : Lưu nhanh bản vẽ và tiến trình vào CSDL (Quick Save)
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (typeof quickSaveProject === 'function') {
      quickSaveProject(true);
    } else if (typeof autoSaveToDB === 'function') {
      autoSaveToDB(true, true);
    }
    return;
  }

  // Ctrl+O / Cmd+O : Mở file bản vẽ hoặc nạp Tool từ máy tính (Open File)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault();
    if (typeof openFilePicker === 'function') {
      openFilePicker();
    }
    return;
  }

  // Ctrl+N / Cmd+N : Tạo bản vẽ mới sạch sẽ (New Drawing Sheet)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    if (typeof createNewDrawing === 'function') {
      createNewDrawing(true);
    }
    return;
  }

  // Ctrl+K / Cmd+K : Tìm nhanh nút công cụ / lệnh (Quick Button Finder)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    const searchInput = document.getElementById('ribbon-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    return;
  }

  // Ctrl+Z / Cmd+Z : Hoàn tác (Undo)
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    if (document.activeElement !== cliInput && document.activeElement !== dynInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
      e.preventDefault();
      if (typeof undoAction === 'function') undoAction();
      return;
    }
  }

  // Ctrl+Y / Cmd+Y hoặc Ctrl+Shift+Z : Làm lại (Redo)
  if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
    if (document.activeElement !== cliInput && document.activeElement !== dynInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
      e.preventDefault();
      if (typeof redoAction === 'function') redoAction();
      return;
    }
  }

  // Phím Delete / Backspace: Xóa các đối tượng đang chọn
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement !== cliInput && document.activeElement !== dynInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
      if (typeof selectedIds !== 'undefined' && selectedIds.size > 0) {
        e.preventDefault();
        if (typeof deleteSelection === 'function') deleteSelection();
        return;
      }
    }
  }

  // Hàm xử lý Enter / Space toàn cục cho AutoCAD
  function handleGlobalConfirm(e) {
    if (document.activeElement === cliInput || document.activeElement === dynInput || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))) {
      return;
    }

    // 1. Generic Enter Key Handler cho plugin hoặc custom tool
    if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
      let th = window.cadPluginHooks.toolHandlers[currentTool];
      if (typeof th.onEnter === 'function') {
        if (e) e.preventDefault();
        th.onEnter();
        return;
      }
    }

    // 2. Các handler Enter từ Plugin nạp ngoài
    if (window.cadPluginHooks && Array.isArray(window.cadPluginHooks.enterHandlers)) {
      for (let fn of window.cadPluginHooks.enterHandlers) {
        try {
          let handled = fn();
          if (handled === true) {
            if (e) e.preventDefault();
            return;
          }
        } catch (err) { console.error(err); }
      }
    }

    // 3. Kết thúc vẽ Polyline nếu đang vẽ dở
    if (currentTool === 'POLYLINE' && typeof isDrawing !== 'undefined' && isDrawing && typeof finishPolyline === 'function') {
      if (e) e.preventDefault();
      finishPolyline();
      return;
    }

    // 4. Nếu đang ở Transform Tool (MOVE, COPY, ROTATE, SCALE, MIRROR)
    const TRANSFORM_TOOLS = ['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'];
    if (TRANSFORM_TOOLS.includes(currentTool)) {
      if (e) e.preventDefault();
      if (typeof selectedIds !== 'undefined' && selectedIds.size > 0 && !isDrawing) {
        setInfo(`✅ [${currentTool}] Đã tự động bắt nhóm ${selectedIds.size} đối tượng. Nhấp giữ chuột vào vùng chọn để kéo sang vị trí mới (thả chuột để hoàn tất)!`);
      } else if (typeof selectedIds !== 'undefined' && selectedIds.size === 0) {
        setInfo(`💡 [Lệnh ${currentTool}] Chưa chọn đối tượng. Hãy quét vùng chọn đối tượng trước.`);
      }
      return;
    }

    // 5. Nếu đang ở một công cụ / plugin cụ thể, chạy handler của lệnh đó
    if (currentTool && currentTool !== 'SELECT' && currentTool !== 'PAN') {
      if (typeof dynamicCommands !== 'undefined' && dynamicCommands[currentTool]) {
        if (e) e.preventDefault();
        dynamicCommands[currentTool].handler();
        return;
      }
      if (typeof window['c_' + currentTool] === 'function') {
        if (e) e.preventDefault();
        window['c_' + currentTool]();
        return;
      }
    }

    // 5. Lặp lại lệnh gần nhất (Repeat Last Command)
    let lastCmd = window.lastExecutedCommand || (typeof lastExecutedCommand !== 'undefined' ? lastExecutedCommand : null);
    if (lastCmd && !['APPLOAD', 'OPEN', 'SAVE', 'DXF', 'CLEAR'].includes(lastCmd.toUpperCase())) {
      if (e) e.preventDefault();
      if (typeof logToCliHistory === 'function') logToCliHistory(`Lặp lại lệnh: ${lastCmd}`, 'prompt');
      if (typeof runCommand === 'function') runCommand(lastCmd);
      return;
    }
  }

  // Phím Enter
  if (e.key === 'Enter') {
    handleGlobalConfirm(e);
  }

  // Phím Space (Phím cách): Tương tự phím ENTER trong AutoCAD chuẩn
  if (e.key === ' ') {
    handleGlobalConfirm(e);
  }

  // Tự động nhận diện gõ phím từ bàn phím (Auto-focus to Command Line hoặc Dynamic Input)
  if (document.activeElement !== cliInput && 
      document.activeElement !== dynInput && 
      (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
    
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (typeof isDrawing !== 'undefined' && isDrawing && typeof startPoint !== 'undefined' && startPoint) {
        if (typeof dynInput !== 'undefined' && dynInput && ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',')) {
          dynInput.focus();
          dynInput.value = e.key === ',' ? '.' : e.key;
          e.preventDefault();
        }
      } else {
        if (typeof cliInput !== 'undefined' && cliInput) {
          cliInput.focus();
          cliInput.value = e.key;
          e.preventDefault();
        }
      }
    }
  }
});
