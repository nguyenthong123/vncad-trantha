// ===============================================================================
//     DRAWING TOOLS & UNIFIED MOUSE / TOUCH EVENT DISPATCHER (DESKTOP & MOBILE)
//     Hỗ trợ vẽ chuột, cảm ứng 1 ngón (chọn/quét/vẽ) & 2 ngón (Pinch Zoom & Pan)
// ===============================================================================

// Trạng thái Touch / Multi-touch
let touchState = {
  active: false,
  mode: 'NONE', // 'NONE', 'SINGLE', 'PINCH_PAN'
  startX: 0,
  startY: 0,
  hasMoved: false,
  pinchDist: 0,
  pinchCenter: { x: 0, y: 0 }
};

// 1. Unified Pointer Move Action
function handlePointerMove(clientX, clientY) {
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  mouseScreen = { x: clientX - rect.left, y: clientY - rect.top };

  if (isPanning) {
    panX += clientX - panStart.x;
    panY += clientY - panStart.y;
    panStart = { x: clientX, y: clientY };
    return;
  }

  let raw = screenToWorld(mouseScreen.x, mouseScreen.y);
  let snap = typeof findSnapPoint === 'function' ? findSnapPoint(raw) : null;

  if (snap) {
    mouseWorld = snap;
    let sSnap = worldToScreen(snap.x, snap.y);
    if (osnapBox) {
      osnapBox.style.display = 'block';
      osnapBox.style.left = `${sSnap.x}px`;
      osnapBox.style.top = `${sSnap.y}px`;
    }
  } else {
    mouseWorld = raw;
    if (osnapBox) osnapBox.style.display = 'none';
  }

  if (isDrawing && startPoint) {
    if (dynBox) {
      dynBox.style.display = 'block';
      dynBox.style.left = `${mouseScreen.x + 15}px`;
      dynBox.style.top = `${mouseScreen.y + 15}px`;
    }
    if (dynInput && document.activeElement !== dynInput && !dynInput.value) {
      let curTarget = applyOrthoPoint(startPoint, mouseWorld);
      let dist = Math.hypot(curTarget.x - startPoint.x, curTarget.y - startPoint.y);
      dynInput.placeholder = `${dist.toFixed(0)} mm`;
    }
  } else {
    if (dynBox) dynBox.style.display = 'none';
  }

  if (hudCoords) {
    hudCoords.innerText = `X: ${mouseWorld.x.toFixed(1)} | Y: ${mouseWorld.y.toFixed(1)} mm`;
  }
}

// 2. Unified Pointer Down Action
function handlePointerDown(clientX, clientY, isPanBtn = false, shiftKey = false, originalEvent = null) {
  if (!viewport) return;
  if (isPanBtn || currentTool === 'PAN') {
    isPanning = true;
    panStart = { x: clientX, y: clientY };
    return;
  }

  const rect = viewport.getBoundingClientRect();
  mouseDownScreen = { x: clientX - rect.left, y: clientY - rect.top };
  mouseDownWorld = screenToWorld(mouseDownScreen.x, mouseDownScreen.y);

  // Khóa bắt điểm tức thì (Instant Snap Lock) ngay khi chạm/nhấp
  let snap = typeof findSnapPoint === 'function' ? findSnapPoint(mouseDownWorld) : null;
  if (snap) {
    mouseDownWorld = { ...snap };
  }
  mouseScreen = { ...mouseDownScreen };
  mouseWorld = { ...mouseDownWorld };

  // Kiểm tra nếu tool hiện tại là Plugin Tool
  if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
    let th = window.cadPluginHooks.toolHandlers[currentTool];
    if (typeof th.onMouseDown === 'function') {
      let handled = th.onMouseDown(mouseDownWorld, originalEvent || { shiftKey });
      if (handled === true) return;
    }
  }

  // Chế độ Chọn (SELECT), Modify Tool hoặc Plugin Tool
  const TRANSFORM_TOOLS = ['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'];
  let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;
  const isTransformTool = TRANSFORM_TOOLS.includes(currentTool);
  const isPluginSelection = pluginTool && (typeof pluginTool.allowSelection === 'function' ? pluginTool.allowSelection() : !!pluginTool.allowSelection);

  // Điều kiện vào chế độ quét/chọn: Tool SELECT, ERASE, hoặc Transform tool đang ở bước 1/2 (SELECT_OBJECTS)
  const isCommandSelecting = typeof activeCommandContext !== 'undefined' && (activeCommandContext.phase === 'SELECT_OBJECTS');
  const isSelectionMode = (currentTool === 'SELECT') || (currentTool === 'ERASE') || isCommandSelecting || Boolean(isPluginSelection);

  if (isSelectionMode) {
    let found = typeof findClosestEntity === 'function' ? findClosestEntity(mouseDownWorld) : null;

    if (found) {
      if (shiftKey) {
        if (selectedIds.has(found.id)) selectedIds.delete(found.id);
        else selectedIds.add(found.id);
      } else {
        if (pluginTool && (pluginTool.multiSelect || typeof pluginTool.allowSelection === 'function')) {
          selectedIds.add(found.id);
        } else if (isTransformTool || currentTool === 'ERASE') {
          // Trong lệnh Move/Copy/Erase, nhấp từng đối tượng để gom nhóm
          if (selectedIds.has(found.id)) selectedIds.delete(found.id);
          else selectedIds.add(found.id);
        } else {
          selectedIds.clear();
          selectedIds.add(found.id);
        }
      }
      renderPropertiesPanel();
      if (pluginTool && typeof pluginTool.onSelectionChange === 'function') {
        pluginTool.onSelectionChange(selectedIds, false);
      } else if (isTransformTool) {
        setInfo(`👉 [${currentTool}] Đã chọn ${selectedIds.size} đối tượng. Tiếp tục chọn thêm hoặc bấm ENTER / SPACE để chốt chọn.`);
      } else if (currentTool === 'ERASE') {
        setInfo(`👉 [ERASE] Đã chọn ${selectedIds.size} đối tượng. Tiếp tục chọn thêm hoặc bấm ENTER / SPACE để xóa.`);
      } else {
        let lastCmd = window.lastExecutedCommand || (typeof lastExecutedCommand !== 'undefined' ? lastExecutedCommand : null);
        if (lastCmd && !['APPLOAD', 'OPEN', 'SAVE', 'DXF', 'CLEAR'].includes(lastCmd.toUpperCase())) {
          setInfo(`✅ Đã chọn #${found.id} (${found.type}). Nhấn ENTER / SPACE để chạy lệnh [${lastCmd}] hoặc mở PR / M, CO, RO...`);
        } else {
          setInfo(`✅ Đã chọn #${found.id} (${found.type}). Mở Bảng Thuộc Tính đổi màu/độ dày nét hoặc dùng DEL, M, CO, RO...`);
        }
      }
      isBoxSelecting = false;
    } else {
      // Bắt đầu quét vùng chọn (AutoCAD Window / Crossing Box)
      isBoxSelecting = true;
      boxStartScreen = { ...mouseDownScreen };
      boxStartWorld = { ...mouseDownWorld };
    }
    return;
  }

  // Các công cụ vẽ & Modify / Transform (khi đã có đối tượng được chọn)
  handleCanvasClick();
}

// 3. Unified Pointer Up Action
function handlePointerUp(clientX, clientY, shiftKey = false, originalEvent = null) {
  if (!viewport) return;
  isPanning = false;

  let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;
  const TRANSFORM_TOOLS = ['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR'];
  const isTransformTool = TRANSFORM_TOOLS.includes(currentTool);

  // Kiểm tra nếu tool hiện tại là Plugin Tool
  if (pluginTool && typeof pluginTool.onMouseUp === 'function') {
    const rect = viewport.getBoundingClientRect();
    const upScreen = { x: clientX - rect.left, y: clientY - rect.top };
    const upWorld = screenToWorld(upScreen.x, upScreen.y);
    let handled = pluginTool.onMouseUp(upWorld, originalEvent || { shiftKey });
    if (handled === true) return;
  }

  // Xử lý kéo thả trực tiếp (Drag & Drop Move/Copy) khi thả tay/chuột
  if (isDragMoving && isDrawing && startPoint && isTransformTool) {
    const rect = viewport.getBoundingClientRect();
    const upScreen = { x: clientX - rect.left, y: clientY - rect.top };
    const dragDist = Math.hypot(upScreen.x - dragStartScreen.x, upScreen.y - dragStartScreen.y);
    if (dragDist >= 6) {
      let rawUp = screenToWorld(upScreen.x, upScreen.y);
      let snap = typeof findSnapPoint === 'function' ? findSnapPoint(rawUp) : null;
      let finalTarget = snap || rawUp;
      const upWorld = applyOrthoPoint(startPoint, finalTarget);
      finishDrawingWithPoint(upWorld);
      isDragMoving = false;
      return;
    } else {
      isDragMoving = false;
    }
  }

  if (isBoxSelecting) {
    const rect = viewport.getBoundingClientRect();
    const upScreen = { x: clientX - rect.left, y: clientY - rect.top };
    const upWorld = screenToWorld(upScreen.x, upScreen.y);
    const dragDist = Math.hypot(upScreen.x - boxStartScreen.x, upScreen.y - boxStartScreen.y);

    if (dragDist >= 6) {
      const minX = Math.min(boxStartWorld.x, upWorld.x);
      const maxX = Math.max(boxStartWorld.x, upWorld.x);
      const minY = Math.min(boxStartWorld.y, upWorld.y);
      const maxY = Math.max(boxStartWorld.y, upWorld.y);
      const isCrossing = (upScreen.x < boxStartScreen.x);

      if (!shiftKey && currentTool === 'SELECT') {
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
        if (isTransformTool) {
          setInfo(`👉 [${currentTool}] Đã chọn ${selectedIds.size} đối tượng. Nhấn ENTER để chốt nhóm điểm (hoặc nhấp giữ kéo thả sang vị trí mới)...`);
        } else if (currentTool === 'ERASE') {
          setInfo(`👉 [ERASE] Đã chọn ${selectedIds.size} đối tượng. Nhấn ENTER hoặc DEL để xóa.`);
        } else {
          const modeName = isCrossing ? '🟩 Crossing Selection' : '🟦 Window Selection';
          let lastCmd = window.lastExecutedCommand || (typeof lastExecutedCommand !== 'undefined' ? lastExecutedCommand : null);
          if (lastCmd && !['APPLOAD', 'OPEN', 'SAVE', 'DXF', 'CLEAR'].includes(lastCmd.toUpperCase())) {
            setInfo(`${modeName}: Đã chọn ${selectedIds.size} đối tượng. Nhấn ENTER / SPACE để chạy lệnh [${lastCmd}] hoặc gọi M, CO, RO...`);
          } else {
            setInfo(`${modeName}: Đã chọn ${selectedIds.size} đối tượng. Bạn có thể đổi màu, chỉnh nét hoặc gọi lệnh M, CO, RO...`);
          }
        }
      } else {
        setInfo("💡 Không có đối tượng nào trong vùng quét.");
      }
    } else {
      // Click / chạm nhẹ vào khoảng trống mà không kéo
      if (currentTool === 'SELECT' && !shiftKey) {
        selectedIds.clear();
        renderPropertiesPanel();
        if (pluginTool && typeof pluginTool.onSelectionChange === 'function') {
          pluginTool.onSelectionChange(selectedIds, false);
        } else {
          setInfo("Đã bỏ chọn.");
        }
      } else if (isTransformTool && selectedIds.size === 0) {
        setInfo(`💡 [Lệnh ${currentTool}] Chưa chọn đối tượng. Hãy quét vùng chọn đối tượng trước khi kéo thả.`);
      }
    }

    isBoxSelecting = false;
  }
}

// ===============================================================================
//                       MOUSE EVENT LISTENERS (DESKTOP)
// ===============================================================================
if (viewport) {
  viewport.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  viewport.addEventListener('mousedown', (e) => {
    const isPanBtn = (e.button === 1 || e.button === 2);
    handlePointerDown(e.clientX, e.clientY, isPanBtn, e.shiftKey, e);
  });

  window.addEventListener('mouseup', (e) => {
    handlePointerUp(e.clientX, e.clientY, e.shiftKey, e);
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
}

// ===============================================================================
//            MOBILE TOUCH & GESTURE LISTENERS (1-FINGER & 2-FINGER)
// ===============================================================================
if (viewport) {
  viewport.addEventListener('touchstart', (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
      // 1 Finger: Chạm, Vẽ, Quét Chọn
      const t = e.touches[0];
      touchState.active = true;
      touchState.mode = 'SINGLE';
      touchState.startX = t.clientX;
      touchState.startY = t.clientY;
      touchState.hasMoved = false;

      handlePointerMove(t.clientX, t.clientY);
      handlePointerDown(t.clientX, t.clientY, false, false, e);
    } else if (e.touches.length >= 2) {
      // 2 Fingers: Pinch-to-Zoom & Pan (Hủy các thao tác vẽ dở của 1 ngón)
      touchState.mode = 'PINCH_PAN';
      isBoxSelecting = false;
      isDragMoving = false;

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchState.pinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchState.pinchCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && touchState.mode === 'SINGLE') {
      const t = e.touches[0];
      const moveDist = Math.hypot(t.clientX - touchState.startX, t.clientY - touchState.startY);
      if (moveDist > 6) touchState.hasMoved = true;

      handlePointerMove(t.clientX, t.clientY);
    } else if (e.touches.length >= 2) {
      // 2 Fingers Pinch Zoom & Pan mượt mà
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const newCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };

      if (touchState.pinchDist > 0) {
        const rect = viewport.getBoundingClientRect();
        const scale = newDist / touchState.pinchDist;

        // Zoom tâm là điểm chính giữa 2 ngón tay
        const cx = newCenter.x - rect.left;
        const cy = newCenter.y - rect.top;
        const wBefore = screenToWorld(cx, cy);

        zoom *= scale;
        zoom = Math.min(Math.max(zoom, 0.005), 5.0);

        const wAfter = screenToWorld(cx, cy);
        panX += (wAfter.x - wBefore.x) * zoom;
        panY -= (wAfter.y - wBefore.y) * zoom;

        // Pan di chuyển theo vị trí tay kéo
        panX += (newCenter.x - touchState.pinchCenter.x);
        panY += (newCenter.y - touchState.pinchCenter.y);
      }

      touchState.pinchDist = newDist;
      touchState.pinchCenter = newCenter;
    }
  }, { passive: false });

  viewport.addEventListener('touchend', (e) => {
    e.preventDefault();

    if (e.touches.length === 0) {
      if (touchState.mode === 'SINGLE') {
        const endX = mouseScreen.x + viewport.getBoundingClientRect().left;
        const endY = mouseScreen.y + viewport.getBoundingClientRect().top;
        handlePointerUp(endX, endY, false, e);
      }
      touchState.active = false;
      touchState.mode = 'NONE';
      touchState.pinchDist = 0;
      isPanning = false;
    } else if (e.touches.length === 1) {
      // Từ 2 ngón về 1 ngón -> Chuyển trạng thái nghỉ
      touchState.mode = 'NONE';
      touchState.pinchDist = 0;
      isPanning = false;
    }
  }, { passive: false });

  viewport.addEventListener('touchcancel', (e) => {
    touchState.active = false;
    touchState.mode = 'NONE';
    touchState.pinchDist = 0;
    isPanning = false;
    isBoxSelecting = false;
    isDragMoving = false;
  });
}

// ===============================================================================
//                       ENTITY QUERY & DRAWING HANDLERS
// ===============================================================================
function findClosestEntity(pt, filterFn = null) {
  let bestEnt = null;
  const tolWorld = 28 / zoom;
  let minScore = tolWorld;

  for (let i = entities.length - 1; i >= 0; i--) {
    let ent = entities[i];
    if (filterFn && !filterFn(ent)) continue;

    // Lọc nhanh bằng Bounding Box trước khi tính toán chi tiết
    let bb = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(ent) : null;
    if (bb) {
      if (pt.x < bb.minX - tolWorld || pt.x > bb.maxX + tolWorld ||
          pt.y < bb.minY - tolWorld || pt.y > bb.maxY + tolWorld) {
        continue;
      }
    }

    let d = typeof getHitDistance === 'function' ? getHitDistance(pt, ent) : (checkHit(pt, ent) ? 0 : Infinity);
    if (d <= tolWorld) {
      // Ưu tiên vật thể nhỏ/đèn/chữ/đoạn thẳng trước các vùng Hatch/mặt bằng lớn
      let priorityBonus = 0;
      if (ent.type === 'TEXT') priorityBonus = -4 / zoom;
      else if (ent.type === 'CIRCLE' && (ent.r || 50) < 350) priorityBonus = -3 / zoom;
      else if (ent.type === 'LINE') priorityBonus = -1 / zoom;
      else if (ent.isHatched || (ent.fillColor && ent.fillColor !== 'transparent')) priorityBonus = 5 / zoom;

      let score = d + priorityBonus;
      if (score < minScore) {
        minScore = score;
        bestEnt = ent;
      }
    }
  }
  return bestEnt;
}

function handleCanvasClick() {
  const pt = applyOrthoPoint(startPoint, mouseWorld);

  if (currentTool === 'PAN') return;

  if (currentTool === 'ID' || currentTool === 'CHECK' || currentTool === 'INSPECT' || currentTool === 'TOADO') {
    const cellSize = 600;
    const col = Math.floor(pt.x / cellSize);
    const row = Math.floor(pt.y / cellSize);
    const centerX = col * cellSize + cellSize / 2;
    const centerY = row * cellSize + cellSize / 2;
    let found = typeof findClosestEntity === 'function' ? findClosestEntity(pt) : null;
    let entInfo = found ? `Vật thể #${found.id} (${found.type}, Layer: ${found.layer || '0'})` : 'Không có vật thể';
    let msg = `📍 [ID] X: ${pt.x.toFixed(2)} | Y: ${pt.y.toFixed(2)} mm | Ô [Cột ${col}, Hàng ${row}] | Tâm: (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) | ${entInfo}`;
    setInfo(msg, 'success');
    if (typeof logToCliHistory === 'function') {
      logToCliHistory(msg, 'success');
    }
    return;
  }

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
      isDragMoving = true;
      dragStartScreen = { ...(typeof mouseDownScreen !== 'undefined' ? mouseDownScreen : mouseScreen) };
      if (dynInput) {
        dynInput.value = '';
        dynInput.focus();
      }
      if (currentTool === 'ROTATE') setInfo("🔄 [ROTATE] Đã chọn Tâm Xoay. Nhấp Điểm Hướng Xoay (hoặc gõ độ xoay 45, 90 + Enter)...");
      else if (currentTool === 'SCALE') setInfo("📐 [SCALE] Đã chọn Tâm Tỉ Lệ. Nhấp Điểm Tỉ Lệ (hoặc gõ hệ số 1.5, 2.0 + Enter)...");
      else if (currentTool === 'MIRROR') setInfo("🪞 [MIRROR] Đã chọn Điểm 1 của trục đối xứng. Nhấp Điểm 2...");
      else setInfo(`✥ [${currentTool}] Đang kéo di chuyển. Thả chuột/tay tại vị trí mới để hoàn tất (hoặc gõ khoảng cách + Enter)...`);
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
      if (dynInput) {
        dynInput.value = '';
        dynInput.focus();
      }
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
