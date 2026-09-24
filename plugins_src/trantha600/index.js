// ===============================================================================
//     VINACAD PLUGIN: CHIA TRẦN THẠCH CAO 600x600 & BÓC TÁCH VẬT TƯ (TT600)
//     Tiêu chuẩn thi công TCVN / Vĩnh Tường / Lê Trần • Chuẩn Mốc Cạnh Công Trình
//     Tích hợp: Mặt Bằng 2D Chi Tiết, Phối Cảnh Góc Nghiêng 3D & Mặt Cắt Kỹ Thuật 2D
//     Tệp Plugin nạp ngoài độc lập qua APPLOAD
// ===============================================================================

(function() {
  // 1. Khởi tạo trạng thái TT600
  if (!window.tt600State) {
    window.tt600State = {
      active: false,
      step: 1,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: null,
      allResults: [],
      viewMode: '2D',
      facadeMode: 'bottom_left',
      forceMainOrientation: null
    };
  }

  // 2. Khởi tạo Tool TT600
  window.initTT600Tool = function() {
    let prevAll = (window.tt600State && Array.isArray(window.tt600State.allResults)) ? window.tt600State.allResults : [];
    let prevLast = window.tt600State ? window.tt600State.lastResult : null;

    window.tt600State = {
      active: true,
      step: 1,
      facadePickCount: 0,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: prevLast,
      allResults: prevAll,
      viewMode: '2D',
      facadeMode: 'bottom_left',
      forceMainOrientation: null
    };
    if (typeof setTaskContext === 'function') setTaskContext('TT600', 1, 'SELECT_ROOM_ENTITIES');

    // Kiểm tra nếu người dùng ĐÃ quét chọn nét phòng từ trước (chuẩn Noun-Verb)
    if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_'));
      let detected = findEnclosingPolygonFromEntities(selEnts, null);
      if (detected && detected.length >= 3) {
        window.tt600State.polyPts = detected;
        window.executeTT600FromSelectionOrCanvas();
        return;
      }
    }

    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
    if (typeof setInfo === 'function') {
      setInfo("👉 [TT600] BƯỚC 1: Quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER (hoặc Phím cách / Chuột phải):");
    }
  };

  // 3. Thực thi chuyển bước và tính toán trần
  window.executeTT600FromSelectionOrCanvas = function() {
    if (!window.tt600State) return;

    // A. NẾU ĐANG Ở BƯỚC 2: Người dùng nhấn Enter ➔ BẮT ĐẦU TÍNH TOÁN & VẼ TRẦN
    if (window.tt600State.step === 2 && window.tt600State.polyPts && window.tt600State.polyPts.length >= 3) {
      if (typeof executeTT600Algorithm === 'function') {
        executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
      }
      window.tt600State.step = 3; // Chuyển sang Bước 3: Hoàn tất & Tinh chỉnh / Xem 3D
      if (typeof setTaskContext === 'function') setTaskContext('TT600', 3, 'CEILING_COMPLETED');
      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo("✅ [TT600] Đã tính toán & vẽ hệ trần thành công! Bạn có thể xem 3D, Mặt cắt, hoặc nhấn ENTER để chốt hoàn tất.");
      }
      if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
      if (typeof render === 'function') render();
      return;
    }

    // B. NẾU ĐANG Ở BƯỚC 3: Người dùng nhấn Enter ➔ HOÀN TẤT CHỐT PHƯƠNG ÁN
    if (window.tt600State.step === 3) {
      window.finishTT600Workflow();
      return;
    }

    // C. NẾU ĐANG Ở BƯỚC 1: Tìm đa giác phòng từ nét quét chọn hoặc vị trí chuột
    let poly = null;
    if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_'));
      if (selEnts.length > 0) {
        poly = findEnclosingPolygonFromEntities(selEnts, null);
      }
    }

    if (!poly && window.tt600State.polyPts && window.tt600State.polyPts.length >= 3) {
      poly = window.tt600State.polyPts;
    }

    if (!poly && typeof mouseWorld !== 'undefined' && mouseWorld) {
      poly = findEnclosingPolygon(mouseWorld);
    }

    if (poly && poly.length >= 3) {
      window.tt600State.polyPts = poly;
      window.tt600State.step = 2; // Chuyển sang Bước 2: Chọn 2 Cạnh Mặt Tiền
      window.tt600State.facadePickCount = 0;
      if (typeof setTaskContext === 'function') setTaskContext('TT600', 2, 'SELECT_2_FACADE_EDGES', { vertexCount: poly.length });

      // Tự động tìm Cạnh Đáy và Cạnh Trái làm mốc mặc định ban đầu
      let pts = poly;
      let edges = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        let p1 = pts[j], p2 = pts[i];
        let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        let len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
        let isHoriz = dx >= dy;
        edges.push({ p1, p2, mid, len, isHoriz });
      }
      let horizEdges = edges.filter(e => e.isHoriz);
      let vertEdges = edges.filter(e => !e.isHoriz);
      let bottomEdge = horizEdges.reduce((prev, curr) => (!prev || curr.mid.y < prev.mid.y) ? curr : prev, horizEdges[0] || edges[0]);
      let leftEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x < prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);

      window.tt600State.edge1 = bottomEdge;
      window.tt600State.edge2 = leftEdge;

      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo(`👉 [TT600] BƯỚC 2: Nhấp chọn 2 CẠNH MẶT TIỀN (Góc mốc chính) trên bản vẽ, sau đó nhấn ENTER để BẮT ĐẦU TÍNH TOÁN & VẼ:`);
      }
      if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
      if (typeof render === 'function') render();
    } else {
      if (typeof setInfo === 'function') {
        setInfo("👉 [TT600] Hãy quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER để tiếp tục.", "prompt");
      }
    }
  };

  // 4. Xử lý click chuột trong chế độ TT600
  window.handleTT600Click = function(pt) {
    if (!window.tt600State) return;

    if (window.tt600State.step === 1) {
      let detected = findEnclosingPolygon(pt);
      if (detected && detected.length >= 3) {
        window.tt600State.polyPts = detected;
        window.executeTT600FromSelectionOrCanvas();
        return;
      }
      if (typeof setInfo === 'function') {
        setInfo("💡 Hãy quét chọn các nét của căn phòng rồi nhấn ENTER để tiếp tục.");
      }
      return;
    }

    if (window.tt600State.step === 2 || window.tt600State.step === 3) {
      let closestEdge = getClosestEdge(pt, window.tt600State.polyPts);
      if (closestEdge) {
        let len = Math.hypot(closestEdge.p2.x - closestEdge.p1.x, closestEdge.p2.y - closestEdge.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        if (window.tt600State.facadePickCount === 0 || !window.tt600State.edge1) {
          window.tt600State.edge1 = closestEdge;
          window.tt600State.facadePickCount = 1;
          if (typeof setInfo === 'function') {
            setInfo(`🏷️ Đã chọn CẠNH 1 (Mặt tiền chính: ${lenMm.toFixed(0)}mm). Hãy nhấp tiếp CẠNH 2 (Mặt tiền phụ) hoặc nhấn ENTER để tính toán.`);
          }
        } else {
          window.tt600State.edge2 = closestEdge;
          window.tt600State.facadePickCount = 2;
          if (typeof setInfo === 'function') {
            setInfo(`🏷️ Đã chọn CẠNH 2 (Mặt tiền phụ: ${lenMm.toFixed(0)}mm). Nhấn ENTER (hoặc Space / Chuột phải) để BẮT ĐẦU TÍNH TOÁN & VẼ TRẦN.`);
          }
        }

        // Nếu đang ở Bước 3 (đã tính trước đó), tự động cập nhật lại thuật toán
        if (window.tt600State.step === 3 && typeof executeTT600Algorithm === 'function') {
          executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
        }

        if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
        if (typeof render === 'function') render();
      }
      return;
    }
  };

  // 5. Tự vẽ Overlay hướng dẫn & viền mốc Mặt Tiền
  function drawTT600Overlay(ctx) {
    if (typeof currentTool !== 'undefined' && currentTool !== 'TT600') return;
    if (typeof tt600State !== 'undefined' && tt600State && tt600State.polyPts && tt600State.polyPts.length >= 3) {
      ctx.save();
      let pts = tt600State.polyPts;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.0;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      let s0 = worldToScreen(pts[0].x !== undefined ? pts[0].x : pts[0][0], pts[0].y !== undefined ? pts[0].y : pts[0][1]);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        let x = pts[i].x !== undefined ? pts[i].x : pts[i][0];
        let y = pts[i].y !== undefined ? pts[i].y : pts[i][1];
        let si = worldToScreen(x, y);
        ctx.lineTo(si.x, si.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight Edge 1 (Mặt Tiền Chính)
      if (tt600State.edge1) {
        let p1 = worldToScreen(tt600State.edge1.p1.x, tt600State.edge1.p1.y);
        let p2 = worldToScreen(tt600State.edge1.p2.x, tt600State.edge1.p2.y);
        let len = Math.hypot(tt600State.edge1.p2.x - tt600State.edge1.p1.x, tt600State.edge1.p2.y - tt600State.edge1.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#f59e0b';
        let mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        ctx.fillText(`🏷️ MẶT TIỀN 1 (${lenMm.toFixed(0)}mm - TẤM NGUYÊN)`, mx + 10, my - 8);
      }

      // Highlight Edge 2 (Mặt Tiền Phụ)
      if (tt600State.edge2) {
        let p1 = worldToScreen(tt600State.edge2.p1.x, tt600State.edge2.p1.y);
        let p2 = worldToScreen(tt600State.edge2.p2.x, tt600State.edge2.p2.y);
        let len = Math.hypot(tt600State.edge2.p2.x - tt600State.edge2.p1.x, tt600State.edge2.p2.y - tt600State.edge2.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#10b981';
        let mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        ctx.fillText(`🏷️ MẶT TIỀN 2 (${lenMm.toFixed(0)}mm - TẤM NGUYÊN)`, mx + 10, my + 16);
      }
      ctx.restore();
    }
  }

  window.drawTT600Overlay = drawTT600Overlay;
  if (typeof registerPluginOverlay === 'function') {
    registerPluginOverlay(drawTT600Overlay);
  }

  // 6. Đăng ký Hook Escape để dọn dẹp khi người dùng nhấn ESC
  if (typeof registerPluginEscapeHandler === 'function') {
    registerPluginEscapeHandler(function() {
      const modal3d = document.getElementById('tt600-3d-modal');
      if (modal3d) modal3d.remove();
      const modalSec = document.getElementById('tt600-sec-modal');
      if (modalSec) modalSec.remove();
      const bar = document.getElementById('tt600-floating-bar');
      if (bar) bar.remove();
      if (window.tt600State) {
        window.tt600State.active = false;
        window.tt600State.step = 1;
        window.tt600State.edge1 = null;
        window.tt600State.edge2 = null;
      }
    });
  }

  // 7. Đăng ký Tool TT600 với Lõi CAD Engine qua Generic Hook Interface
  if (typeof registerPluginTool === 'function') {
    registerPluginTool('TT600', {
      allowSelection: function() {
        return !window.tt600State || window.tt600State.step === 1;
      },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.initTT600Tool();
      },
      onDeactivate: function() {
        let bar = document.getElementById('tt600-floating-bar');
        if (bar) bar.remove();
        if (window.tt600State) {
          window.tt600State.active = false;
          window.tt600State.step = 1;
        }
      },
      onMouseDown: function(downWorld, e) {
        if (window.tt600State && window.tt600State.step === 1) {
          window.tt600State.scanStartWorld = { x: downWorld.x, y: downWorld.y };
          return false;
        }
        if (window.tt600State && window.tt600State.step === 2) {
          window.handleTT600Click(downWorld);
          return true;
        }
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.tt600State || window.tt600State.step !== 1 || !window.tt600State.scanStartWorld) return false;

        let start = window.tt600State.scanStartWorld;
        window.tt600State.scanStartWorld = null;
        let dragDistance = Math.hypot(upWorld.x - start.x, upWorld.y - start.y);
        if (dragDistance < 6) return false;

        let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
        let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);
        if (!e.shiftKey) selectedIds.clear();

        entities.forEach(entity => {
          if (entity.layer === 'BOM_TABLE' || (entity.id || '').startsWith('tt_')) return;
          let bounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(entity) : null;
          if (!bounds) return;
          let overlaps = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          if (overlaps) selectedIds.add(entity.id);
        });

        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') {
          setInfo(`👉 [TT600] Đã quét ${selectedIds.size} nét phòng. Nhấn ENTER để tiếp tục bước chọn mốc cạnh.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds, isCrossing) {
        if (window.tt600State && window.tt600State.step === 1) {
          if (selectedIds && selectedIds.size > 0) {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [TT600] Đã chọn ${selectedIds.size} nét phòng. Nhấn ENTER (hoặc Space / Chuột phải) để TIẾP TỤC BƯỚC 2.`);
            }
          } else {
            if (typeof setInfo === 'function') {
              setInfo("👉 [TT600] BƯỚC 1: Quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER:");
            }
          }
        }
      },
      onClick: function(pt) {
        window.handleTT600Click(pt);
      },
      onContextMenu: function(e) {
        window.executeTT600FromSelectionOrCanvas();
      },
      onEnter: function() {
        window.executeTT600FromSelectionOrCanvas();
      }
    });

    registerPluginTool('TTCOPY', {
      allowSelection: function() {
        return true;
      },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        if (typeof selectedIds !== 'undefined') selectedIds.clear();
        if (typeof setInfo === 'function') setInfo('👉 [TTCOPY] Quét chọn các nét của bản vẽ đã chia trần, sau đó nhấn ENTER.');
      },
      onSelectionChange: function(copySelectedIds) {
        if (typeof setInfo !== 'function') return;
        if (copySelectedIds && copySelectedIds.size > 0) {
          setInfo(`👉 [TTCOPY] Đã chọn ${copySelectedIds.size} nét. Nhấn ENTER để lấy kích thước và mở 3D.`);
        } else {
          setInfo('👉 [TTCOPY] Quét chọn các nét của bản vẽ đã chia trần, sau đó nhấn ENTER.');
        }
      },
      onEnter: function() {
        window.copyTT600Dimensions();
      },
      onContextMenu: function() {
        window.copyTT600Dimensions();
      }
    });
  }

  // 8. Đăng ký các lệnh CLI của plugin
  window.c_TT600 = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.c_TRANTHA = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.c_TRANTHA600 = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.c_TT3D = function() {
    if (typeof window.openTT6003DModal === 'function') window.openTT6003DModal();
  };
  window.c_TTSEC = function() {
    if (typeof window.openTT600SectionModal === 'function') window.openTT600SectionModal();
  };
  window.c_TTFIT = function() {
    if (typeof window.zoomFitTT600 === 'function') window.zoomFitTT600();
  };
  window.c_TTCOPY = function() {
    if (typeof window.startTT600CopyWorkflow === 'function') window.startTT600CopyWorkflow();
  };

  if (typeof registerPluginCommand === 'function') {
    registerPluginCommand('TT600', window.c_TT600, 'Chia Trần Thả 600x600');
    registerPluginCommand('TRANTHA', window.c_TRANTHA, 'Chia Trần Thả 600x600');
    registerPluginCommand('TRANTHA600', window.c_TRANTHA600, 'Chia Trần Thả 600x600');
    registerPluginCommand('TT3D', window.c_TT3D, 'Xem 3D Phối Cảnh Hệ Trần Thả');
    registerPluginCommand('TTSEC', window.c_TTSEC, 'Xem Mặt Cắt Kỹ Thuật Chi Tiết 2D');
    registerPluginCommand('TTFIT', window.c_TTFIT, 'Căn Giữa Trần & Bảng Dự Toán');
    registerPluginCommand('TTCOPY', window.c_TTCOPY, 'Quét bản vẽ, COPY kích thước và mở 3D');
  } else if (typeof registerCommand === 'function') {
    registerCommand('TT600', window.c_TT600, 'Chia Trần Thả 600x600');
    registerCommand('TRANTHA', window.c_TRANTHA, 'Chia Trần Thả 600x600');
    registerCommand('TRANTHA600', window.c_TRANTHA600, 'Chia Trần Thả 600x600');
    registerCommand('TT3D', window.c_TT3D, 'Xem 3D Phối Cảnh Hệ Trần Thả');
    registerCommand('TTSEC', window.c_TTSEC, 'Xem Mặt Cắt Kỹ Thuật Chi Tiết 2D');
    registerCommand('TTFIT', window.c_TTFIT, 'Căn Giữa Trần & Bảng Dự Toán');
    registerCommand('TTCOPY', window.c_TTCOPY, 'Quét bản vẽ, COPY kích thước và mở 3D');
  }

  if (typeof selectTool === 'function') {
    selectTool('TT600');
  }
})();
