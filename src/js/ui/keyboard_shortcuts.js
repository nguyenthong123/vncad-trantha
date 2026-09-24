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
          if (ent.layer !== 'BOM_TABLE') selectedIds.add(ent.id);
        }
      }
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      if (typeof setInfo === 'function') setInfo(`✅ Đã chọn tất cả (${selectedIds.size} đối tượng). Bạn có thể đổi màu trên Ribbon hoặc Bảng thuộc tính.`);
      return;
    }
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

  // Phím Enter
  if (e.key === 'Enter') {
    if (document.activeElement === cliInput || document.activeElement === dynInput || (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))) {
      return;
    }
    // Generic Enter Key Handler cho plugin hoặc custom tool
    if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
      let th = window.cadPluginHooks.toolHandlers[currentTool];
      if (typeof th.onEnter === 'function') {
        th.onEnter();
        return;
      }
    }
    if (window.cadPluginHooks && Array.isArray(window.cadPluginHooks.enterHandlers)) {
      for (let fn of window.cadPluginHooks.enterHandlers) {
        try {
          let handled = fn();
          if (handled === true) return;
        } catch (err) { console.error(err); }
      }
    }
  }

  // Phím Space (Phím cách): Tương tự phím ENTER trong AutoCAD chuẩn
  if (e.key === ' ' && document.activeElement !== cliInput && document.activeElement !== dynInput && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
    if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
      let th = window.cadPluginHooks.toolHandlers[currentTool];
      if (typeof th.onEnter === 'function') {
        e.preventDefault();
        th.onEnter();
        return;
      }
    }
    if (window.cadPluginHooks && Array.isArray(window.cadPluginHooks.enterHandlers)) {
      for (let fn of window.cadPluginHooks.enterHandlers) {
        try {
          let handled = fn();
          if (handled === true) {
            e.preventDefault();
            return;
          }
        } catch (err) { console.error(err); }
      }
    }
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
