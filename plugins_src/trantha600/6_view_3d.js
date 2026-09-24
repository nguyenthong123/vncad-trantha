// ===============================================================================
//     TT600 3D ISOMETRIC VIEWER - MULTI-ROOM / ĐA BẢN VẼ HỖ TRỢ BACK & NEXT
//     Cửa sổ phối cảnh 3D góc nghiêng, xoay 360°, chuyển đổi giữa nhiều phòng
// ===============================================================================

window.openTT6003DModal = function(targetIndex) {
  let allRooms = [];
  if (window.tt600State && Array.isArray(window.tt600State.allResults) && window.tt600State.allResults.length > 0) {
    allRooms = window.tt600State.allResults;
  } else if (window.tt600State && window.tt600State.lastResult) {
    allRooms = [window.tt600State.lastResult];
  }

  if (allRooms.length === 0) {
    alert("Vui lòng chạy chia trần (Lệnh TT600) trước khi xem phối cảnh 3D.");
    return;
  }

  let currentRoomIndex = (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < allRooms.length)
    ? targetIndex
    : (allRooms.length - 1);

  let res = allRooms[currentRoomIndex];

  let oldModal = document.getElementById('tt600-3d-modal');
  if (oldModal) oldModal.remove();

  let modal = document.createElement('div');
  modal.id = 'tt600-3d-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.88)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  let roomOptions = allRooms.map((rm, idx) => `
    <option value="${idx}" ${idx === currentRoomIndex ? 'selected' : ''}>
      🏛️ ${rm.roomName || ('Phòng #' + (idx + 1) + ' (' + (rm.realAreaM2 ? rm.realAreaM2.toFixed(1) : '0') + 'm²)')}
    </option>
  `).join('');

  modal.innerHTML = `
    <div style="width:92vw; height:90vh; background:#0f172a; border:2px solid #38bdf8; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
      <!-- TOP MODAL HEADER BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; background:#1e293b; border-bottom:1.5px solid #334155; flex-shrink:0; flex-wrap:wrap; gap:8px;">
        <div style="font-weight:bold; font-size:13.5px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          <span>📦 PHỐI CẢNH 3D HỆ TRẦN THẢ 600x600</span>
        </div>

        <!-- MULTI-ROOM BACK & NEXT NAVIGATION -->
        <div style="display:flex; align-items:center; gap:6px; background:#090d16; padding:3px 8px; border-radius:8px; border:1px solid #38bdf8;">
          <button id="btn-3d-prev" onclick="window.navigate3DRoom(-1)" class="btn btn-accent" style="padding:3px 9px; font-size:11px; font-weight:bold; cursor:pointer;" title="Xem phòng trước (Phím ◀ hoặc [)">
            ◀️ Back
          </button>
          <select id="select-3d-room" onchange="window.switch3DRoom(parseInt(this.value))" style="font-size:11.5px; font-weight:bold; color:#facc15; background:#1e293b; border:1px solid #475569; padding:3px 8px; border-radius:4px; outline:none; cursor:pointer;">
            ${roomOptions}
          </select>
          <button id="btn-3d-next" onclick="window.navigate3DRoom(1)" class="btn btn-accent" style="padding:3px 9px; font-size:11px; font-weight:bold; cursor:pointer;" title="Xem phòng tiếp theo (Phím ▶ hoặc ])">
            Next ▶️
          </button>
          <span id="room-counter-3d" style="font-size:11px; color:#38bdf8; font-weight:bold; margin-left:4px; white-space:nowrap;">
            ${currentRoomIndex + 1} / ${allRooms.length}
          </span>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <span style="color:#94a3b8; font-size:11px; display:none; @media(min-width:900px){display:inline;}">💡 Kéo chuột để xoay 360° • Cuộn để Zoom</span>
          <button onclick="document.getElementById('tt600-3d-modal').remove()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold;">✕ Đóng</button>
        </div>
      </div>

      <!-- MAIN 3D VIEWPORT & SIDE PANEL -->
      <div style="flex:1; position:relative; display:flex; min-width:0; min-height:0; overflow:hidden;">
        <div style="flex:1; position:relative; min-width:0; min-height:0; height:100%;">
          <canvas id="tt600-3d-canvas" style="width:100%; height:100%; background:#020617; display:block;"></canvas>
        </div>

        <div style="width:280px; min-width:280px; flex-shrink:0; background:#0f172a; border-left:1.5px solid #334155; padding:12px; display:flex; flex-direction:column; gap:10px; font-size:11.5px; color:#cbd5e1; overflow-y:auto;">
          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px;">🎮 GÓC NHÌN NHANH:</div>
          <button onclick="setIsoAngle(45, 30)" class="btn btn-accent" style="padding:6px; font-size:11px;">📦 Góc Nghiêng Tây Nam 45°</button>
          <button onclick="setIsoAngle(135, 30)" class="btn btn-accent" style="padding:6px; font-size:11px;">📦 Góc Nghiêng Đông Nam 45°</button>
          <button onclick="setIsoAngle(0, 89.9)" class="btn btn-accent" style="padding:6px; font-size:11px;">📐 Nhìn Mặt Bằng 2D Từ Trên Xuống</button>
          <button onclick="setIsoAngle(0, -60)" class="btn btn-accent" style="padding:6px; font-size:11px;">👀 Nhìn Ngước Dưới Lên (Ceiling View)</button>
          <button onclick="setIsoAngle(0, 0)" class="btn btn-accent" style="padding:6px; font-size:11px;">🏢 Nhìn Ngang Mặt Cắt (Side View)</button>
          <button onclick="zoomFit3D()" class="btn btn-highlight" style="padding:6px; font-size:11px; background:#0284c7;">🔍 Căn Giữa Tự Động (Fit Center)</button>

          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px; margin-top:6px;">🎬 DẠNG PHỐI CẢNH:</div>
          <div style="display:flex; gap:6px;">
            <button id="btn-scene-technical" onclick="set3DSceneMode('technical')" class="btn btn-accent" style="flex:1; padding:6px; font-size:11px;">📐 Kỹ thuật</button>
            <button id="btn-scene-construction" onclick="set3DSceneMode('construction')" class="btn btn-highlight" style="flex:1; padding:6px; font-size:11px; background:#b45309;">👷 Thi công</button>
          </div>

          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px; margin-top:6px;">👁️ BẬT / TẮT LỚP 3D:</div>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-wallv" checked> 🔷 Thanh Viền Tường Shadow-V (@Vách)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-hangers" checked> 🔴 Ty Treo M8 + Sàn Bê Tông</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-maint" checked> 🟥 Thanh Chính Main-T (@1200)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-crosst" checked> 🟨 Thanh Phụ Cross-T 1.2m (@600)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-cross6" checked> 🟩 Thanh Phụ Cross-T 0.6m</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-tiles" checked> 🟦 Tấm Trần Thả 600x600</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-walls" checked> 🧱 Khối Tường Phòng 3D</label>

          <div id="stats-panel-3d" style="margin-top:auto; background:#1e293b; padding:8px; border-radius:6px; font-size:11px; border:1px solid #334155;">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">📊 Thông số Dự toán:</div>
            <div id="stat-area">• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b></div>
            <div id="stat-full">• Tấm nguyên: <b>${res.n_full_tiles} tấm</b></div>
            <div id="stat-cut">• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b></div>
            <div id="stat-dir">• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  init3DIsoViewer(allRooms, currentRoomIndex);
};

function init3DIsoViewer(allRooms, initialIndex) {
  const cvs = document.getElementById('tt600-3d-canvas');
  if (!cvs) return;
  const c3d = cvs.getContext('2d');

  function resize3D() {
    cvs.width = cvs.clientWidth;
    cvs.height = cvs.clientHeight;
  }
  resize3D();

  let currentIdx = initialIndex;
  let res = allRooms[currentIdx];

  let yaw = 45 * Math.PI / 180;
  let pitch = 30 * Math.PI / 180;
  let cx = 0, cy = 0, ceilZ = 0, slabZ = 0, midZ = 0;
  let roomW = 0, roomH = 0, maxDim = 1000, scale = 1.0;
  let pan3dX = 0, pan3dY = 0;
  let sceneMode = 'technical';

  function recalculateBounds() {
    res = allRooms[currentIdx];
    if (!res) return;
    cx = (res.xmin + res.xmax) / 2;
    cy = (res.ymin + res.ymax) / 2;
    ceilZ = 2600 * (res.isMeter ? 0.001 : 1);
    slabZ = 3200 * (res.isMeter ? 0.001 : 1);
    midZ = (ceilZ + slabZ) / 2;

    roomW = res.xmax - res.xmin;
    roomH = res.ymax - res.ymin;
    maxDim = Math.max(roomW, roomH, res.isMeter ? 5 : 5000);
    scale = (Math.min(cvs.width || 800, cvs.height || 600) * 0.45) / maxDim;
    pan3dX = 0;
    pan3dY = 0;

    // Cập nhật thông số bảng thống kê bên phải
    const statArea = document.getElementById('stat-area');
    if (statArea) statArea.innerHTML = `• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b>`;
    const statFull = document.getElementById('stat-full');
    if (statFull) statFull.innerHTML = `• Tấm nguyên: <b>${res.n_full_tiles} tấm</b>`;
    const statCut = document.getElementById('stat-cut');
    if (statCut) statCut.innerHTML = `• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b>`;
    const statDir = document.getElementById('stat-dir');
    if (statDir) statDir.innerHTML = `• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b>`;

    // Cập nhật selector và counter
    const sel = document.getElementById('select-3d-room');
    if (sel) sel.value = currentIdx;
    const cnt = document.getElementById('room-counter-3d');
    if (cnt) cnt.innerText = `${currentIdx + 1} / ${allRooms.length}`;
  }

  recalculateBounds();

  window.navigate3DRoom = function(delta) {
    if (allRooms.length <= 1) return;
    currentIdx = (currentIdx + delta + allRooms.length) % allRooms.length;
    recalculateBounds();
  };

  window.switch3DRoom = function(idx) {
    if (idx >= 0 && idx < allRooms.length) {
      currentIdx = idx;
      recalculateBounds();
    }
  };

  window.zoomFit3D = function() {
    pan3dX = 0;
    pan3dY = 0;
    scale = (Math.min(cvs.width || 800, cvs.height || 600) * 0.45) / maxDim;
  };

  window.setIsoAngle = function(yDeg, pDeg) {
    yaw = yDeg * Math.PI / 180;
    pitch = pDeg * Math.PI / 180;
    pan3dX = 0;
    pan3dY = 0;
  };

  window.set3DSceneMode = function(mode) {
    sceneMode = mode === 'construction' ? 'construction' : 'technical';
    let technicalButton = document.getElementById('btn-scene-technical');
    let constructionButton = document.getElementById('btn-scene-construction');
    if (technicalButton) technicalButton.style.outline = sceneMode === 'technical' ? '2px solid #38bdf8' : 'none';
    if (constructionButton) constructionButton.style.outline = sceneMode === 'construction' ? '2px solid #facc15' : 'none';
    if (typeof setInfo === 'function') {
      setInfo(sceneMode === 'construction'
        ? '🧱 [3D KHUNG] Đã bật phối cảnh khối T 3D của hệ khung trần.'
        : '📐 [3D KỸ THUẬT] Đã bật phối cảnh khung trần và các lớp kết cấu.');
    }
  };

  function drawConstructionScene() {
    let unit = res.isMeter ? 0.001 : 1;

    function drawGuideLine(p1, p2, color = 'rgba(71, 85, 105, 0.58)', width = 1) {
      let a = project3D(p1.x, p1.y, p1.z);
      let b = project3D(p2.x, p2.y, p2.z);
      c3d.strokeStyle = color;
      c3d.lineWidth = width;
      c3d.beginPath();
      c3d.moveTo(a.x, a.y);
      c3d.lineTo(b.x, b.y);
      c3d.stroke();
    }

    function drawRoomGuides() {
      let guideColor = 'rgba(71, 85, 105, 0.58)';
      let topColor = 'rgba(100, 116, 139, 0.42)';
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        drawGuideLine({ x: p1.x, y: p1.y, z: 0 }, { x: p2.x, y: p2.y, z: 0 }, guideColor, 1.2);
        drawGuideLine({ x: p1.x, y: p1.y, z: slabZ }, { x: p2.x, y: p2.y, z: slabZ }, topColor, 1);
        drawGuideLine({ x: p1.x, y: p1.y, z: 0 }, { x: p1.x, y: p1.y, z: slabZ }, guideColor, 0.8);
      }

      // Một đường sàn chéo rất nhạt giúp đọc chiều sâu mà không cạnh tranh với khung.
      let floorCenter = {
        x: (res.xmin + res.xmax) / 2,
        y: (res.ymin + res.ymax) / 2,
        z: 0
      };
      let floorSpan = Math.min(res.xmax - res.xmin, res.ymax - res.ymin) * 0.18;
      drawGuideLine(
        { x: floorCenter.x - floorSpan, y: floorCenter.y, z: 0 },
        { x: floorCenter.x + floorSpan, y: floorCenter.y, z: 0 },
        'rgba(51, 65, 85, 0.32)', 0.7
      );
    }

    function solidBeam3D(p1, p2, z0, z1, beamWidth, color) {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      let len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len * beamWidth / 2;
      let ny = dx / len * beamWidth / 2;
      let corners = [
        { x: p1.x + nx, y: p1.y + ny, z: z0 },
        { x: p2.x + nx, y: p2.y + ny, z: z0 },
        { x: p2.x - nx, y: p2.y - ny, z: z0 },
        { x: p1.x - nx, y: p1.y - ny, z: z0 },
        { x: p1.x + nx, y: p1.y + ny, z: z1 },
        { x: p2.x + nx, y: p2.y + ny, z: z1 },
        { x: p2.x - nx, y: p2.y - ny, z: z1 },
        { x: p1.x - nx, y: p1.y - ny, z: z1 }
      ];
      let faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
      faces.forEach((face, index) => {
        let projected = face.map(i => project3D(corners[i].x, corners[i].y, corners[i].z));
        c3d.beginPath();
        c3d.moveTo(projected[0].x, projected[0].y);
        projected.slice(1).forEach(point => c3d.lineTo(point.x, point.y));
        c3d.closePath();
        c3d.fillStyle = index === 1 ? color : (index === 2 || index === 5 ? 'rgba(148, 163, 184, 0.82)' : 'rgba(30, 41, 59, 0.95)');
        c3d.strokeStyle = color;
        c3d.lineWidth = 1;
        c3d.fill();
        c3d.stroke();
      });
    }

    function solidTBeam3D(p1, p2, baseZ, unit, color) {
      // Tiết diện chữ T: bụng đứng + cánh ngang ở cao độ tấm.
      solidBeam3D(p1, p2, baseZ, baseZ + 42 * unit, 34 * unit, color);
      solidBeam3D(p1, p2, baseZ + 42 * unit, baseZ + 62 * unit, 58 * unit, color);
    }

    function drawLockTab3D(point, horizontal, direction, baseZ, unit, color) {
      let tabLength = 64 * unit;
      let tabWidth = 20 * unit;
      let p1 = { x: point.x, y: point.y };
      let p2 = horizontal
        ? { x: point.x + direction * tabLength, y: point.y }
        : { x: point.x, y: point.y + direction * tabLength };
      solidBeam3D(p1, p2, baseZ + 62 * unit, baseZ + 78 * unit, tabWidth, color);
    }

    function trimBeamEnds(p1, p2, trim) {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      let length = Math.hypot(dx, dy) || 1;
      let ux = dx / length;
      let uy = dy / length;
      return [
        { x: p1.x + ux * trim, y: p1.y + uy * trim },
        { x: p2.x - ux * trim, y: p2.y - uy * trim }
      ];
    }

    function drawMainPieces(segment, horizontal, baseZ, color) {
      let maxPiece = 3600 * unit;
      let dx = segment[1] - segment[0];
      let dy = segment[3] - segment[2];
      let length = Math.hypot(dx, dy);
      let distance = 0;
      let part = 0;
      while (distance < length - 1e-6) {
        let nextDistance = Math.min(distance + maxPiece, length);
        let t0 = distance / length;
        let t1 = nextDistance / length;
        let p1 = { x: segment[0] + dx * t0, y: segment[2] + dy * t0 };
        let p2 = { x: segment[0] + dx * t1, y: segment[2] + dy * t1 };
        solidTBeam3D(p1, p2, baseZ, unit, color);
        if (part > 0) drawLockTab3D(p1, horizontal, -1, baseZ, unit, '#991b1b');
        distance = nextDistance;
        part++;
      }
      drawLockTab3D({ x: segment[0], y: segment[2] }, horizontal, -1, baseZ, unit, '#991b1b');
      drawLockTab3D({ x: segment[1], y: segment[3] }, horizontal, 1, baseZ, unit, '#991b1b');
    }

    function drawSolidCeilingFrame() {
      let frameBaseZ = ceilZ - 58 * unit;
      let roomStructuralLines = typeof entities !== 'undefined'
        ? entities.filter(entity => entity.roomId === res.roomId && entity.type === 'LINE' && /^0[2-5]_/.test(entity.layer || ''))
        : [];
      let linesForLayer = layerPrefix => roomStructuralLines.filter(entity => (entity.layer || '').startsWith(layerPrefix));
      let drawMain = (positions, horizontal, color) => {
        let mainLines = linesForLayer('03_');
        if (mainLines.length > 0) {
          mainLines.forEach(line => {
            let p1 = { x: line.p1[0], y: line.p1[1] }, p2 = { x: line.p2[0], y: line.p2[1] };
            drawMainPieces([p1.x, p2.x, p1.y, p2.y], horizontal, frameBaseZ, color);
          });
          return;
        }
        (positions || []).forEach(position => {
          let segments = horizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
          segments.forEach(segment => drawMainPieces(horizontal ? [segment[0], segment[1], position, position] : [position, position, segment[0], segment[1]], horizontal, frameBaseZ, color));
        });
      };

      let drawBoundedGrid = (positions, horizontal, boundaries, color, layerPrefix) => {
        let jointClearance = 32 * unit;
        let sourceLines = linesForLayer(layerPrefix);
        let sourceSegments = sourceLines.length > 0
          ? sourceLines.map(line => [line.p1[0], line.p2[0], line.p1[1], line.p2[1]])
          : null;
        let positionsOrSegments = sourceSegments || (positions || []).flatMap(position => {
          let segments = horizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
          return segments.map(segment => horizontal ? [segment[0], segment[1], position, position] : [position, position, segment[0], segment[1]]);
        });
        positionsOrSegments.forEach(data => {
          let position = horizontal ? data[2] : data[0];
          for (let i = 0; i < boundaries.length - 1; i++) {
            let a = boundaries[i], b = boundaries[i + 1];
            if (horizontal) {
              let x0 = Math.max(data[0], a), x1 = Math.min(data[1], b);
              if (x1 - x0 > jointClearance * 2) {
                let trimmed = trimBeamEnds({ x: x0, y: position }, { x: x1, y: position }, jointClearance);
                solidTBeam3D(trimmed[0], trimmed[1], frameBaseZ, unit, color);
                drawLockTab3D(trimmed[0], true, -1, frameBaseZ, unit, '#854d0e');
                drawLockTab3D(trimmed[1], true, 1, frameBaseZ, unit, '#854d0e');
              }
            } else {
              let y0 = Math.max(data[2], a), y1 = Math.min(data[3], b);
              if (y1 - y0 > jointClearance * 2) {
                let trimmed = trimBeamEnds({ x: position, y: y0 }, { x: position, y: y1 }, jointClearance);
                solidTBeam3D(trimmed[0], trimmed[1], frameBaseZ, unit, color);
                drawLockTab3D(trimmed[0], false, -1, frameBaseZ, unit, '#854d0e');
                drawLockTab3D(trimmed[1], false, 1, frameBaseZ, unit, '#854d0e');
              }
            }
          }
        });
      };

      drawMain(res.main_lines, res.isMainHorizontal, '#dc2626');
      // Cross-T 0.6 m chạy song song Main-T, kết thúc tại các trục Cross-T 1.2 m.
      let crossAxes = (res.isMainHorizontal ? res.all_x : res.all_y).slice().sort((a, b) => a - b);
      let expectedCross6 = (res.isMainHorizontal ? res.all_y : res.all_x)
        .slice(1, -1)
        .filter((position, index) => index % 2 === 1);
      let cross6Positions = [...(res.cross6_lines || []), ...expectedCross6]
        .sort((a, b) => a - b)
        .filter((position, index, values) => index === 0 || Math.abs(position - values[index - 1]) > 1e-6);
      drawBoundedGrid(cross6Positions, res.isMainHorizontal, crossAxes, '#16a34a', '05_');
      // Cross-T 1.2 m vuông góc Main-T, chỉ chạy giữa hai trục Main-T kế tiếp.
      let mainAxes = res.isMainHorizontal
        ? [res.ymin, ...(res.main_lines || []), res.ymax]
        : [res.xmin, ...(res.main_lines || []), res.xmax];
      mainAxes = mainAxes.slice().sort((a, b) => a - b).filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 1e-6);
      drawBoundedGrid(res.cross_lines, !res.isMainHorizontal, mainAxes, '#ca8a04', '04_');

      // V viền tường: thanh biên liên tục cùng cao độ với cánh T.
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        solidBeam3D(p1, p2, frameBaseZ + 24 * unit, frameBaseZ + 72 * unit, 42 * unit, '#0ea5e9');
      }
      linesForLayer('02_').forEach(line => {
        solidBeam3D(
          { x: line.p1[0], y: line.p1[1] },
          { x: line.p2[0], y: line.p2[1] },
          frameBaseZ + 24 * unit,
          frameBaseZ + 72 * unit,
          42 * unit,
          '#0ea5e9'
        );
      });

      // Ty treo chỉ đặt trên Main-T, không đặt trên thanh phụ.
      let hangerStep = res.isMeter ? 1.2 : 1200;
      let hangerOffset = res.isMeter ? 0.35 : 350;
      let hangerTopZ = slabZ - 25 * unit;
      res.main_lines.forEach(position => {
        let segments = res.isMainHorizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
        segments.forEach(segment => {
          for (let hanger = segment[0] + hangerOffset; hanger < segment[1] - hangerOffset; hanger += hangerStep) {
            let point = res.isMainHorizontal ? { x: hanger, y: position } : { x: position, y: hanger };
            let rodSize = 14 * unit;
            solidBeam3D(
              { x: point.x, y: point.y },
              { x: point.x, y: point.y },
              ceilZ + 55 * unit,
              hangerTopZ,
              rodSize,
              '#b91c1c'
            );
          }
        });
      });
    }

    // Chế độ rút gọn: chỉ hiển thị hệ khung T 3D.
    drawRoomGuides();
    drawSolidCeilingFrame();
  }

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  cvs.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let dx = e.clientX - dragStart.x;
    let dy = e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };

    if (e.buttons === 1) {
      yaw += dx * 0.008;
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch - dy * 0.008));
    } else if (e.buttons === 2) {
      pan3dX += dx;
      pan3dY += dy;
    }
  });

  window.addEventListener('mouseup', () => isDragging = false);

  cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    let factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.max(0.01, Math.min(2.0, scale * factor));
  }, { passive: false });

  // Phím tắt bàn phím: Mũi tên Trái / Phải để chuyển phòng nhanh
  function handle3DKeyDown(e) {
    if (!document.getElementById('tt600-3d-modal')) {
      window.removeEventListener('keydown', handle3DKeyDown);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === '[') {
      e.preventDefault();
      window.navigate3DRoom(-1);
    } else if (e.key === 'ArrowRight' || e.key === ']') {
      e.preventDefault();
      window.navigate3DRoom(1);
    } else if (e.key === 'Escape') {
      const m = document.getElementById('tt600-3d-modal');
      if (m) m.remove();
    }
  }
  window.addEventListener('keydown', handle3DKeyDown);

  function project3D(x, y, z) {
    let dx = (x - cx);
    let dy = (y - cy);
    let dz = (z - midZ);

    let x_rot = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    let y_rot = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    let z_iso = -y_rot * Math.sin(pitch) - dz * Math.cos(pitch);

    return {
      x: cvs.width / 2 + x_rot * scale + pan3dX,
      y: cvs.height / 2 + z_iso * scale + pan3dY
    };
  }

  function renderLoop() {
    if (!document.getElementById('tt600-3d-modal')) return;

    c3d.clearRect(0, 0, cvs.width, cvs.height);

    let showWallV = document.getElementById('iso-chk-wallv')?.checked;
    let showHangers = document.getElementById('iso-chk-hangers')?.checked;
    let showMain = document.getElementById('iso-chk-maint')?.checked;
    let showCross = document.getElementById('iso-chk-crosst')?.checked;
    let showCross6 = document.getElementById('iso-chk-cross6')?.checked;
    let showTiles = document.getElementById('iso-chk-tiles')?.checked;
    let showWalls = document.getElementById('iso-chk-walls')?.checked;

    if (!res || !res.polyPts) {
      requestAnimationFrame(renderLoop);
      return;
    }

    let ceilZ = 2600 * (res.isMeter ? 0.001 : 1);
    let slabZ = 3200 * (res.isMeter ? 0.001 : 1);

    if (sceneMode === 'technical') {
    // Thanh Viền Tường Shadow-V
    if (showWallV && res.polyPts.length >= 3) {
      c3d.strokeStyle = '#38bdf8';
      c3d.lineWidth = 3.5;
      c3d.beginPath();
      let p0 = project3D(res.polyPts[0].x, res.polyPts[0].y, ceilZ);
      c3d.moveTo(p0.x, p0.y);
      for (let i = 1; i < res.polyPts.length; i++) {
        let pi = project3D(res.polyPts[i].x, res.polyPts[i].y, ceilZ);
        c3d.lineTo(pi.x, pi.y);
      }
      c3d.closePath();
      c3d.stroke();
    }

    // Sàn Bê tông
    if (showHangers && res.polyPts.length >= 3) {
      c3d.fillStyle = 'rgba(51, 65, 85, 0.4)';
      c3d.strokeStyle = '#64748b';
      c3d.lineWidth = 1;
      c3d.beginPath();
      let p0 = project3D(res.polyPts[0].x, res.polyPts[0].y, slabZ);
      c3d.moveTo(p0.x, p0.y);
      for (let i = 1; i < res.polyPts.length; i++) {
        let pi = project3D(res.polyPts[i].x, res.polyPts[i].y, slabZ);
        c3d.lineTo(pi.x, pi.y);
      }
      c3d.closePath();
      c3d.fill();
      c3d.stroke();
    }

    // Tường bao
    if (showWalls && res.polyPts.length >= 3) {
      c3d.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      c3d.lineWidth = 1.2;
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        let b1 = project3D(p1.x, p1.y, 0), b2 = project3D(p2.x, p2.y, 0);
        let t1 = project3D(p1.x, p1.y, slabZ), t2 = project3D(p2.x, p2.y, slabZ);

        c3d.fillStyle = 'rgba(15, 23, 42, 0.25)';
        c3d.beginPath();
        c3d.moveTo(b1.x, b1.y); c3d.lineTo(b2.x, b2.y);
        c3d.lineTo(t2.x, t2.y); c3d.lineTo(t1.x, t1.y);
        c3d.closePath();
        c3d.fill();
        c3d.stroke();
      }
    }

    // Tấm trần 3D
    if (showTiles && res.tiles3d) {
      res.tiles3d.forEach(tile => {
        if (tile.pts && tile.pts.length >= 3) {
          c3d.fillStyle = tile.isFull ? 'rgba(6, 182, 212, 0.25)' : 'rgba(217, 70, 239, 0.35)';
          c3d.strokeStyle = tile.isFull ? '#06b6d4' : '#d946ef';
          c3d.lineWidth = tile.isFull ? 1 : 1.4;

          c3d.beginPath();
          let p0 = project3D(tile.pts[0].x, tile.pts[0].y, ceilZ);
          c3d.moveTo(p0.x, p0.y);
          for (let k = 1; k < tile.pts.length; k++) {
            let pk = project3D(tile.pts[k].x, tile.pts[k].y, ceilZ);
            c3d.lineTo(pk.x, pk.y);
          }
          c3d.closePath();
          c3d.fill();
          c3d.stroke();
        }
      });
    }

    // Thanh Phụ Cross-T 0.6m (XANH LÁ)
    if (showCross6 && res.cross6_lines) {
      c3d.strokeStyle = '#22c55e';
      c3d.lineWidth = 1.5;
      res.cross6_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getHSegments(res.polyPts, pos, res.isMeter) : getVSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          let p1 = res.isMainHorizontal ? project3D(s[0], pos, ceilZ) : project3D(pos, s[0], ceilZ);
          let p2 = res.isMainHorizontal ? project3D(s[1], pos, ceilZ) : project3D(pos, s[1], ceilZ);
          c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
        });
      });
    }

    // Thanh Phụ Cross-T 1.2m (VÀNG)
    if (showCross && res.cross_lines) {
      c3d.strokeStyle = '#eab308';
      c3d.lineWidth = 2.2;
      res.cross_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getVSegments(res.polyPts, pos, res.isMeter) : getHSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          let p1 = res.isMainHorizontal ? project3D(pos, s[0], ceilZ) : project3D(s[0], pos, ceilZ);
          let p2 = res.isMainHorizontal ? project3D(pos, s[1], ceilZ) : project3D(s[1], pos, ceilZ);
          c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
        });
      });
    }

    // Thanh Chính Main-T 3.6m (ĐỎ) & Ty Treo M8
    if ((showMain || showHangers) && res.main_lines) {
      res.main_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getHSegments(res.polyPts, pos, res.isMeter) : getVSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          if (showMain) {
            c3d.strokeStyle = '#ef4444';
            c3d.lineWidth = 3.2;
            let p1 = res.isMainHorizontal ? project3D(s[0], pos, ceilZ) : project3D(pos, s[0], ceilZ);
            let p2 = res.isMainHorizontal ? project3D(s[1], pos, ceilZ) : project3D(pos, s[1], ceilZ);
            c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
          }

          if (showHangers) {
            let firstOffset = res.isMeter ? 0.35 : 350;
            for (let hp = s[0] + firstOffset; hp < s[1] - (res.isMeter ? 0.2 : 200); hp += res.mainCad) {
              let checkPt = res.isMainHorizontal ? { x: hp, y: pos } : { x: pos, y: hp };
              if (isPointInPoly(checkPt, res.polyPts)) {
                let bot = project3D(checkPt.x, checkPt.y, ceilZ);
                let top = project3D(checkPt.x, checkPt.y, slabZ);

                c3d.strokeStyle = '#ef4444';
                c3d.lineWidth = 1.6;
                c3d.beginPath(); c3d.moveTo(bot.x, bot.y); c3d.lineTo(top.x, top.y); c3d.stroke();

                c3d.fillStyle = '#ef4444';
                c3d.beginPath(); c3d.arc(bot.x, bot.y, 4, 0, Math.PI * 2); c3d.fill();
                c3d.beginPath(); c3d.arc(top.x, top.y, 3, 0, Math.PI * 2); c3d.fill();
              }
            }
          }
        });
      });
    }

    }

    if (sceneMode === 'construction') drawConstructionScene();

    requestAnimationFrame(renderLoop);
  }

  renderLoop();
}
