// DRAWING TOOLS & MOUSE EVENT DISPATCHER
viewport.addEventListener('mousemove', (e) => {
  const rect = viewport.getBoundingClientRect();
  mouseScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  if (isPanning) {
    panX += e.clientX - panStart.x;
    panY += e.clientY - panStart.y;
    panStart = { x: e.clientX, y: e.clientY };
    return;
  }

  let raw = screenToWorld(mouseScreen.x, mouseScreen.y);
  let snap = findSnapPoint(raw);

  if (snap) {
    mouseWorld = snap;
    let sSnap = worldToScreen(snap.x, snap.y);
    osnapBox.style.display = 'block';
    osnapBox.style.left = `${sSnap.x}px`;
    osnapBox.style.top = `${sSnap.y}px`;
  } else {
    mouseWorld = raw;
    osnapBox.style.display = 'none';
  }

  if (isDrawing && startPoint) {
    dynBox.style.display = 'block';
    dynBox.style.left = `${mouseScreen.x + 15}px`;
    dynBox.style.top = `${mouseScreen.y + 15}px`;
    if (document.activeElement !== dynInput && !dynInput.value) {
      let curTarget = applyOrthoPoint(startPoint, mouseWorld);
      let dist = Math.hypot(curTarget.x - startPoint.x, curTarget.y - startPoint.y);
      dynInput.placeholder = `${dist.toFixed(0)} mm`;
    }
  } else {
    dynBox.style.display = 'none';
  }

  if (hudCoords) hudCoords.innerText = `X: ${mouseWorld.x.toFixed(1)} | Y: ${mouseWorld.y.toFixed(1)} mm`;
});

viewport.addEventListener('mousedown', (e) => {
  if (e.button === 1 || e.button === 2 || (currentTool === 'PAN' && e.button === 0)) {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    return;
  }

  if (e.button === 0) {
    const rect = viewport.getBoundingClientRect();
    mouseDownScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mouseDownWorld = screenToWorld(mouseDownScreen.x, mouseDownScreen.y);

    // Kiểm tra nếu tool hiện tại là Plugin Tool
    if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
      let th = window.cadPluginHooks.toolHandlers[currentTool];
      if (typeof th.onMouseDown === 'function') {
        let handled = th.onMouseDown(mouseDownWorld, e);
        if (handled === true) return;
      }
    }

    // 1. Kiểm tra xem có đang ở chế độ Chọn (SELECT) hoặc Plugin Tool cho phép Selection không
    let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;
    const isSelectionMode = (currentTool === 'SELECT' || (pluginTool && (typeof pluginTool.allowSelection === 'function' ? pluginTool.allowSelection() : !!pluginTool.allowSelection)));

    if (isSelectionMode) {
      // Tìm đối tượng có khoảng cách GẦN NHẤT với điểm click chuột
      let found = null;
      let minD = 24 / zoom; // Tolerance
      for (let i = entities.length - 1; i >= 0; i--) {
        let ent = entities[i];
        let d = typeof getHitDistance === 'function' ? getHitDistance(mouseDownWorld, ent) : (checkHit(mouseDownWorld, ent) ? 0 : Infinity);
        if (d < minD) {
          minD = d;
          found = ent;
        }
      }

      if (found) {
        if (e.shiftKey) {
          if (selectedIds.has(found.id)) selectedIds.delete(found.id);
          else selectedIds.add(found.id);
        } else {
          if (pluginTool && (pluginTool.multiSelect || typeof pluginTool.allowSelection === 'function')) {
            selectedIds.add(found.id);
          } else {
            selectedIds.clear();
            selectedIds.add(found.id);
          }
        }
        renderPropertiesPanel();
        if (pluginTool && typeof pluginTool.onSelectionChange === 'function') {
          pluginTool.onSelectionChange(selectedIds, false);
        } else {
          setInfo(`✅ Đã chọn #${found.id} (${found.type}). Mở Bảng Thuộc Tính đổi màu/độ dày nét hoặc dùng DEL, M, CO, RO...`);
        }
        isBoxSelecting = false;
      } else {
        // Không click trúng đối tượng -> Bắt đầu quét vùng chọn (AutoCAD Window/Crossing Box)
        isBoxSelecting = true;
        boxStartScreen = { ...mouseDownScreen };
        boxStartWorld = { ...mouseDownWorld };
      }
      return;
    }

    // Các công cụ vẽ khác
    handleCanvasClick();
  }
});

window.addEventListener('mouseup', (e) => {
  isPanning = false;

  let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;

  // Kiểm tra nếu tool hiện tại là Plugin Tool
  if (pluginTool && typeof pluginTool.onMouseUp === 'function') {
    const rect = viewport.getBoundingClientRect();
    const upScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const upWorld = screenToWorld(upScreen.x, upScreen.y);
    let handled = pluginTool.onMouseUp(upWorld, e);
    if (handled === true) return;
  }

  if (isBoxSelecting) {
    const rect = viewport.getBoundingClientRect();
    const upScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const upWorld = screenToWorld(upScreen.x, upScreen.y);
    const dragDist = Math.hypot(upScreen.x - boxStartScreen.x, upScreen.y - boxStartScreen.y);

    if (dragDist >= 6) {
      const minX = Math.min(boxStartWorld.x, upWorld.x);
      const maxX = Math.max(boxStartWorld.x, upWorld.x);
      const minY = Math.min(boxStartWorld.y, upWorld.y);
      const maxY = Math.max(boxStartWorld.y, upWorld.y);
      const isCrossing = (upScreen.x < boxStartScreen.x);

      if (!e.shiftKey) {
        selectedIds.clear();
      }

      for (let ent of entities) {
        if (typeof isEntityInBox === 'function' && isEntityInBox(ent, minX, maxX, minY, maxY, isCrossing)) {
          selectedIds.add(ent.id);
        }
      }

      renderPropertiesPanel();

      if (pluginTool && typeof pluginTool.onSelectionChange === 'function') {
        pluginTool.onSelectionChange(selectedIds, isCrossing);
      } else if (selectedIds.size > 0) {
        if (['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'].includes(currentTool)) {
          setInfo(`👉 [${currentTool}] Đã chọn ${selectedIds.size} đối tượng. Nhấp Điểm Gốc (Base Point)...`);
        } else if (currentTool === 'ERASE') {
          setInfo(`👉 [ERASE] Đã chọn ${selectedIds.size} đối tượng. Nhấn ENTER hoặc DEL để xóa.`);
        } else {
          const modeName = isCrossing ? '🟩 Crossing Selection' : '🟦 Window Selection';
          setInfo(`${modeName}: Đã chọn ${selectedIds.size} đối tượng. Bạn có thể đổi màu, chỉnh nét hoặc gọi lệnh M, CO, RO...`);
        }
      } else {
        setInfo("💡 Không có đối tượng nào trong vùng quét.");
      }
    } else {
      // Click nhẹ vào khoảng trống mà không kéo
      if (!e.shiftKey) {
        selectedIds.clear();
        renderPropertiesPanel();
        if (pluginTool && typeof pluginTool.onSelectionChange === 'function') {
          pluginTool.onSelectionChange(selectedIds, false);
        } else {
          setInfo("Đã bỏ chọn.");
        }
      }
    }

    isBoxSelecting = false;
  }
});

viewport.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;
  if (pluginTool && typeof pluginTool.onContextMenu === 'function') {
    pluginTool.onContextMenu(e);
    return;
  }
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wBefore = screenToWorld(mx, my);
  const factor = e.deltaY < 0 ? 1.15 : 0.85;
  zoom *= factor;
  zoom = Math.min(Math.max(zoom, 0.005), 5.0);
  const wAfter = screenToWorld(mx, my);
  panX += (wAfter.x - wBefore.x) * zoom;
  panY -= (wAfter.y - wBefore.y) * zoom;
}, { passive: false });

function findClosestEntity(pt, filterFn = null) {
  let bestEnt = null;
  let minD = 24 / zoom;
  for (let i = entities.length - 1; i >= 0; i--) {
    let ent = entities[i];
    if (filterFn && !filterFn(ent)) continue;
    let d = typeof getHitDistance === 'function' ? getHitDistance(pt, ent) : (checkHit(pt, ent) ? 0 : Infinity);
    if (d < minD) {
      minD = d;
      bestEnt = ent;
    }
  }
  return bestEnt;
}

function handleCanvasClick() {
  const pt = applyOrthoPoint(startPoint, mouseWorld);

  if (currentTool === 'PAN') return;

  if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
    let th = window.cadPluginHooks.toolHandlers[currentTool];
    if (typeof th.onClick === 'function') {
      th.onClick(pt);
      return;
    }
  }

  if (currentTool === 'ERASE') {
    let found = findClosestEntity(pt);
    if (found) {
      saveState();
      entities = entities.filter(e => e.id !== found.id);
      selectedIds.delete(found.id);
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      setInfo(`✅ Đã xóa đối tượng #${found.id}. Nhấp tiếp để xóa thêm, hoặc bấm ESC.`);
    } else {
      setInfo("💡 Hãy nhấp trực tiếp vào nét vẽ bạn muốn xóa.");
    }
    return;
  }

  if (currentTool === 'EXPLODE') {
    let found = findClosestEntity(pt, e => e.type === 'RECTANGLE' || e.type === 'POLYLINE' || e.type === 'POLYGON');
    if (found) {
      saveState();
      let parts = explodeEntity(found);
      entities = entities.filter(e => e.id !== found.id);
      entities.push(...parts);
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      setInfo(`💥 Đã phá vỡ đối tượng thành ${parts.length} đoạn thẳng LINE.`);
    } else {
      setInfo("💡 Hãy nhấp vào hình RECTANGLE hoặc POLYLINE để phá vỡ.");
    }
    return;
  }

  if (currentTool === 'OFFSET') {
    let found = findClosestEntity(pt);
    if (found) {
      saveState();
      let offObj = offsetEntity(found, offsetDist, pt);
      if (offObj) {
        entities.push(offObj);
        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        setInfo(`⚡ Đã Offset song song khoảng cách ${offsetDist}mm. Nhấp tiếp nét khác hoặc gõ khoảng cách mới.`);
      }
    } else {
      setInfo("💡 Hãy nhấp vào nét vẽ muốn Offset song song.");
    }
    return;
  }

  if (currentTool === 'HATCH') {
    let found = findClosestEntity(pt);
    if (found) {
      saveState();
      found.isHatched = true;
      found.fillColor = 'rgba(56, 189, 248, 0.15)';
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      setInfo("🎨 Đã tô Hatch mặt cắt cho đối tượng.");
    }
    return;
  }

  if (currentTool === 'SELECT') {
    return;
  }

  // Multi-step Transform tools (MOVE, COPY, ROTATE, SCALE, MIRROR)
  if (['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'].includes(currentTool)) {
    if (selectedIds.size === 0) {
      let found = findClosestEntity(pt);
      if (found) {
        selectedIds.add(found.id);
        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        setInfo(`✅ Đã chọn đối tượng #${found.id}. Hãy nhấp Điểm Gốc (Base Point)...`);
      } else {
        setInfo("💡 Hãy nhấp chọn đối tượng trước khi thực hiện lệnh.");
      }
      return;
    }

    if (!isDrawing) {
      isDrawing = true;
      startPoint = pt;
      dynInput.value = '';
      dynInput.focus();
      if (currentTool === 'ROTATE') setInfo("Nhấp Điểm Hướng Xoay (hoặc gõ độ xoay như 45, 90 + Enter)...");
      else if (currentTool === 'SCALE') setInfo("Nhấp Điểm Tỉ Lệ (hoặc gõ hệ số 1.5, 2.0 + Enter)...");
      else if (currentTool === 'MIRROR') setInfo("Đã chọn Điểm 1 của trục đối xứng. Nhấp Điểm 2...");
      else setInfo(`Đã chọn Điểm Gốc. Nhấp Điểm Đích (hoặc gõ khoảng cách + Enter)...`);
    } else {
      finishDrawingWithPoint(pt);
    }
    return;
  }

  if (currentTool === 'ARC') {
    if (!isDrawing) {
      isDrawing = true;
      startPoint = pt;
      setInfo("ARC: Đã chọn Điểm 1. Nhấp Điểm 2 (Đỉnh uốn cong)...");
    } else if (!midPoint) {
      midPoint = pt;
      setInfo("ARC: Đã chọn Điểm 2. Nhấp Điểm 3 kết thúc...");
    } else {
      finishDrawingWithPoint(pt);
    }
    return;
  }

  if (currentTool === 'POLYLINE') {
    if (!isDrawing) {
      isDrawing = true;
      startPoint = pt;
      polyPoints = [pt];
      setInfo("POLYLINE: Đã chấm Điểm 1. Nhấp tiếp các điểm, bấm ENTER để chốt.");
    } else {
      polyPoints.push(pt);
      startPoint = pt;
      setInfo(`POLYLINE: Đã thêm điểm (${polyPoints.length}). Bấm ENTER để kết thúc nét đa tuyến.`);
    }
    return;
  }

  if (currentTool === 'TEXT') {
    let txt = prompt("Nhập nội dung chữ kỹ thuật:", "PHÒNG HỌP");
    if (txt) {
      saveState();
      entities.push({ id: 'txt_' + Date.now(), type: 'TEXT', x: pt.x, y: pt.y, text: txt, size: 14, color: activeProperties.color || '#f8fafc', align: 'center', layer: activeProperties.layer || 'TEXT' });
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
      setInfo(`🔤 Đã thêm chữ: "${txt}"`);
    }
    return;
  }

  if (currentTool === 'DIMENSION' || currentTool === 'DIST') {
    if (!isDrawing) {
      isDrawing = true;
      startPoint = pt;
      setInfo(`${currentTool}: Đã chọn Điểm 1. Nhấp Điểm 2...`);
    } else {
      finishDrawingWithPoint(pt);
    }
    return;
  }

  // Two-point tools (LINE, RECTANGLE, CIRCLE, ELLIPSE, POLYGON)
  const TWO_POINT_TOOLS = ['LINE', 'RECTANGLE', 'CIRCLE', 'ELLIPSE', 'POLYGON'];
  if (TWO_POINT_TOOLS.includes(currentTool)) {
    if (!isDrawing) {
      isDrawing = true;
      startPoint = pt;
      dynInput.value = '';
      dynInput.focus();
      setInfo(`${currentTool}: Đã chọn Điểm 1. Kéo và nhấp Điểm 2 (hoặc gõ số + Enter)...`);
    } else {
      finishDrawingWithPoint(pt);
    }
    return;
  }
}

// Dynamic input key listener
if (dynInput) {
  dynInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof handleDynInputSubmit === 'function') handleDynInputSubmit();
    } else if (e.key === 'Escape') {
      selectTool('SELECT');
    }
  });
}

