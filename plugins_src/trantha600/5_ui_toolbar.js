// ===============================================================================
//     TT600 FLOATING TOOLBAR & FACADE SELECTION UI
//     Thanh công cụ nổi điều khiển chọn mốc mặt tiền và đổi hướng thanh chính
// ===============================================================================

function ensurePluginFloatingUI() {
  let oldBar = document.getElementById('tt600-floating-bar');
  if (oldBar) oldBar.remove();

  let bar = document.createElement('div');
  bar.id = 'tt600-floating-bar';
  bar.style.position = 'absolute';
  bar.style.top = '52px';
  bar.style.left = '50%';
  bar.style.transform = 'translateX(-50%)';
  bar.style.zIndex = '999';
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  bar.style.gap = '5px';
  bar.style.background = 'rgba(15, 23, 42, 0.96)';
  bar.style.padding = '5px 12px';
  bar.style.borderRadius = '20px';
  bar.style.border = '1.5px solid #38bdf8';
  bar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
  bar.style.backdropFilter = 'blur(10px)';
  bar.style.maxWidth = '96vw';
  bar.style.flexWrap = 'nowrap';
  bar.style.whiteSpace = 'nowrap';

  let edge1Len = window.tt600State && window.tt600State.edge1 ? Math.round(window.tt600State.edge1.len < 60 ? window.tt600State.edge1.len * 1000 : window.tt600State.edge1.len) : '';
  let edge2Len = window.tt600State && window.tt600State.edge2 ? Math.round(window.tt600State.edge2.len < 60 ? window.tt600State.edge2.len * 1000 : window.tt600State.edge2.len) : '';
  let dimText = (edge1Len && edge2Len) ? ` (${edge1Len}x${edge2Len}mm)` : '';

  const isStep2 = (!window.tt600State || window.tt600State.step === 2);

  if (isStep2) {
    bar.innerHTML = `
      <span style="color:#facc15; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:4px;">
        🏛️ BƯỚC 2: CHỌN MỐC MẶT TIỀN:
      </span>
      <button onclick="window.setTT600Facade('bottom_left')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1.5px solid #eab308; color:#facc15; border-radius:12px; cursor:pointer; font-weight:bold;" title="Đặt Mốc Mặt tiền tại Cạnh Đáy & Cạnh Trái của phòng">
        ⬇️⬅️ Đáy & Trái${dimText}
      </button>
      <button onclick="window.setTT600Facade('bottom_right')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Đáy & Cạnh Phải của phòng">
        ⬇️➡️ Đáy & Phải
      </button>
      <button onclick="window.setTT600Facade('top_left')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Trên & Cạnh Trái của phòng">
        ⬆️⬅️ Trên & Trái
      </button>
      <button onclick="window.setTT600Facade('top_right')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Trên & Cạnh Phải của phòng">
        ⬆️➡️ Trên & Phải
      </button>
      <button onclick="window.toggleTT600MainDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Chuyển đổi hướng chạy của Thanh Chính Main-T Đỏ @1200mm">
        🔄 Hướng Cây Đỏ
      </button>
      <button onclick="window.executeTT600FromSelectionOrCanvas()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Bắt đầu tính toán & vẽ hệ trần (Phím Enter)">
        🚀 TÍNH TOÁN & VẼ (Enter)
      </button>
      <button onclick="document.getElementById('tt600-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;" title="Đóng thanh này">
        ✕
      </button>
    `;
  } else {
    bar.innerHTML = `
      <span style="color:#4ade80; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:4px;">
        ✅ ĐÃ CHIA TRẦN THÀNH CÔNG:
      </span>
      <button onclick="window.openTT6003DModal()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0369a1; font-weight:bold; border-radius:12px; cursor:pointer;">
        📦 3D Phối Cảnh
      </button>
      <button onclick="window.startTT600CopyWorkflow()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0f766e; font-weight:bold; border-radius:12px; cursor:pointer;" title="Quét lại bản vẽ, nhấn Enter để COPY kích thước và mở 3D">
        📋 TTCOPY: Quét + Enter
      </button>
      <button onclick="window.openTT600SectionModal()" class="btn btn-highlight" style="font-size:11px; padding:3px 8px; background:#7c3aed; font-weight:bold; border-radius:12px; cursor:pointer;">
        🔍 Mặt Cắt Kỹ Thuật
      </button>
      <button onclick="window.zoomFitTT600()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0284c7; font-weight:bold; border-radius:12px; cursor:pointer;" title="Căn giữa toàn bộ hệ trần & bảng dự toán vào giữa màn hình">
        🎯 Căn Giữa
      </button>
      <button onclick="window.toggleTT600MainDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Chuyển đổi hướng chạy của Thanh Chính Main-T Đỏ @1200mm">
        🔄 Đổi Hướng Cây Đỏ
      </button>
      <button onclick="window.finishTT600Workflow()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Chốt xong phương án & Hoàn tất (Phím Enter)">
        ✅ Chốt Xong (Enter)
      </button>
      <button onclick="document.getElementById('tt600-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;" title="Đóng thanh này">
        ✕
      </button>
    `;
  }

  document.body.appendChild(bar);
}

window.setTT600Facade = function(mode) {
  if (!window.tt600State || !window.tt600State.polyPts || window.tt600State.polyPts.length < 3) return;
  let pts = window.tt600State.polyPts;

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
  let topEdge = horizEdges.reduce((prev, curr) => (!prev || curr.mid.y > prev.mid.y) ? curr : prev, horizEdges[0] || edges[0]);
  let leftEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x < prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);
  let rightEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x > prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);

  if (mode === 'bottom_left' || mode === 'bottom') {
    window.tt600State.edge1 = bottomEdge;
    window.tt600State.edge2 = leftEdge;
    window.tt600State.facadeMode = 'bottom_left';
  } else if (mode === 'bottom_right') {
    window.tt600State.edge1 = bottomEdge;
    window.tt600State.edge2 = rightEdge;
    window.tt600State.facadeMode = 'bottom_right';
  } else if (mode === 'top_left' || mode === 'top') {
    window.tt600State.edge1 = topEdge;
    window.tt600State.edge2 = leftEdge;
    window.tt600State.facadeMode = 'top_left';
  } else if (mode === 'top_right') {
    window.tt600State.edge1 = topEdge;
    window.tt600State.edge2 = rightEdge;
    window.tt600State.facadeMode = 'top_right';
  }

  if (typeof executeTT600Algorithm === 'function') {
    executeTT600Algorithm(pts, window.tt600State.edge1, window.tt600State.edge2);
  }
  if (typeof render === 'function') render();
  let l1 = Math.round(window.tt600State.edge1 ? window.tt600State.edge1.len : 0);
  let l2 = Math.round(window.tt600State.edge2 ? window.tt600State.edge2.len : 0);
  setInfo(`🏛️ Đã chuyển Mốc Mặt Tiền sang [${mode.toUpperCase()} - Cạnh ${l1}mm & ${l2}mm]. Hệ trần đã dồn tấm nguyên về đây.`);
};

window.toggleTT600MainDirection = function() {
  if (!window.tt600State || !window.tt600State.polyPts) return;
  window.tt600State.forceMainOrientation = window.tt600State.forceMainOrientation === 'vertical' ? 'horizontal' : 'vertical';
  if (typeof executeTT600Algorithm === 'function') {
    executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
  }
  if (typeof render === 'function') render();
  setInfo(`🔄 Đã chuyển hướng Thanh Chính Main-T (Đỏ @1200mm) sang: ${window.tt600State.forceMainOrientation === 'vertical' ? 'DỌC (↕️)' : 'NGANG (↔️)'}`);
};

window.finishTT600Workflow = function() {
  if (window.tt600State) {
    window.tt600State.active = false;
    window.tt600State.step = 1;
  }
  if (typeof clearTaskContext === 'function') clearTaskContext();
  if (typeof selectTool === 'function') selectTool('SELECT');
  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  let bar = document.getElementById('tt600-floating-bar');
  if (bar) bar.remove();
  setInfo("✅ [TT600] Đã chốt phương án mặt tiền & hoàn thành tính toán trần thả thành công!");
};

window.zoomFitTT600 = function() {
  if (!window.tt600State || !window.tt600State.lastResult) {
    if (typeof zoomAll === 'function') zoomAll();
    return;
  }
  let res = window.tt600State.lastResult;
  let minX = res.xmin;
  let maxX = (res.tabX && res.tabW) ? (res.tabX + res.tabW) : res.xmax;
  let minY = res.ymin;
  let maxY = res.ymax;

  let cx = (minX + maxX) / 2;
  let cy = (minY + maxY) / 2;
  let w = Math.max(maxX - minX + (res.isMeter ? 1.5 : 1500), 1000);
  let h = Math.max(maxY - minY + (res.isMeter ? 1.5 : 1500), 1000);

  let cvsW = (typeof canvas !== 'undefined' && canvas && canvas.width) ? canvas.width : window.innerWidth;
  let cvsH = (typeof canvas !== 'undefined' && canvas && canvas.height) ? canvas.height : window.innerHeight;

  let targetZoom = Math.min((cvsW - 120) / w, (cvsH - 120) / h);
  if (typeof zoom !== 'undefined') zoom = targetZoom;

  let angle = (typeof viewRotation !== 'undefined' ? viewRotation : 0) * Math.PI / 180;
  let rotatedCx = cx * Math.cos(angle) - cy * Math.sin(angle);
  let rotatedCy = cx * Math.sin(angle) + cy * Math.cos(angle);

  if (typeof panX !== 'undefined') panX = -rotatedCx * targetZoom;
  if (typeof panY !== 'undefined') panY = rotatedCy * targetZoom;

  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') setInfo("🎯 Đã căn toàn bộ hệ trần & bảng dự toán ra chính giữa màn hình.");
};
