// INTERACTIVE OVERLAYS & PREVIEW GUIDES

function drawRubberband() {
  ctx.save();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 5]);

  let activeEnd = applyOrthoPoint(startPoint, mouseWorld);
  let s1 = worldToScreen(startPoint.x, startPoint.y);
  let s2 = worldToScreen(activeEnd.x, activeEnd.y);

  if (currentTool === 'LINE' || currentTool === 'POLYLINE' || currentTool === 'DIMENSION' || currentTool === 'DIST') {
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    let d = Math.hypot(activeEnd.x - startPoint.x, activeEnd.y - startPoint.y);
    let deg = (Math.atan2(activeEnd.y - startPoint.y, activeEnd.x - startPoint.x) * 180 / Math.PI + 360) % 360;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`L: ${d.toFixed(0)} mm < ${deg.toFixed(0)}°`, (s1.x + s2.x) / 2 + 12, (s1.y + s2.y) / 2 - 12);
  } else if (currentTool === 'MOVE' || currentTool === 'COPY') {
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    let dx = activeEnd.x - startPoint.x, dy = activeEnd.y - startPoint.y;
    let d = Math.hypot(dx, dy);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`ΔX: ${dx.toFixed(0)}, ΔY: ${dy.toFixed(0)} mm | L: ${d.toFixed(0)} mm`, s2.x + 12, s2.y - 12);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        let ghost = translateEntity(e, dx, dy);
        drawEntity(ghost, false);
      }
    }
    ctx.restore();
  } else if (currentTool === 'ROTATE') {
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    let angRad = Math.atan2(activeEnd.y - startPoint.y, activeEnd.x - startPoint.x);
    let deg = (angRad * 180 / Math.PI + 360) % 360;
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Góc xoay: ${deg.toFixed(1)}°`, s2.x + 12, s2.y - 12);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        let ghost = rotateEntity(e, startPoint, angRad);
        drawEntity(ghost, false);
      }
    }
    ctx.restore();
  } else if (currentTool === 'SCALE') {
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    let d = Math.hypot(activeEnd.x - startPoint.x, activeEnd.y - startPoint.y);
    let factor = Math.max(d / 100, 0.01);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Tỉ lệ: ${factor.toFixed(2)}x`, s2.x + 12, s2.y - 12);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        let ghost = scaleEntity(e, startPoint, factor);
        drawEntity(ghost, false);
      }
    }
    ctx.restore();
  } else if (currentTool === 'RECTANGLE') {
    let minX = Math.min(startPoint.x, activeEnd.x), maxY = Math.max(startPoint.y, activeEnd.y);
    let s = worldToScreen(minX, maxY);
    let w = Math.abs(activeEnd.x - startPoint.x) * zoom, h = Math.abs(activeEnd.y - startPoint.y) * zoom;
    ctx.strokeRect(s.x, s.y, w, h);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`${Math.abs(activeEnd.x - startPoint.x).toFixed(0)} x ${Math.abs(activeEnd.y - startPoint.y).toFixed(0)} mm`, s2.x + 12, s2.y - 12);
  } else if (currentTool === 'CIRCLE') {
    let r = Math.hypot(activeEnd.x - startPoint.x, activeEnd.y - startPoint.y);
    ctx.beginPath();
    ctx.arc(s1.x, s1.y, r * zoom, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`R: ${r.toFixed(0)} mm`, s2.x + 12, s2.y - 12);
  } else if (currentTool === 'ELLIPSE') {
    let rx = Math.abs(activeEnd.x - startPoint.x), ry = Math.abs(activeEnd.y - startPoint.y) || rx / 2;
    ctx.beginPath();
    ctx.ellipse(s1.x, s1.y, rx * zoom, ry * zoom, 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`RX: ${rx.toFixed(0)}, RY: ${ry.toFixed(0)} mm`, s2.x + 12, s2.y - 12);
  } else if (currentTool === 'POLYGON') {
    let r = Math.hypot(activeEnd.x - startPoint.x, activeEnd.y - startPoint.y) * zoom;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      let a = (i * 2 * Math.PI) / 6;
      let px = s1.x + r * Math.cos(a), py = s1.y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (currentTool === 'MIRROR') {
    ctx.strokeStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('TRỤC ĐỐI XỨNG', (s1.x + s2.x) / 2 + 10, (s1.y + s2.y) / 2);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        let ghost = mirrorEntity(e, startPoint, activeEnd);
        drawEntity(ghost, false);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// AutoCAD Window Selection (Blue) & Crossing Selection (Green) Box
function drawSelectionBox() {
  if (!isBoxSelecting) return;
  ctx.save();
  let sx1 = boxStartScreen.x, sy1 = boxStartScreen.y;
  let sx2 = mouseScreen.x, sy2 = mouseScreen.y;
  let x = Math.min(sx1, sx2), y = Math.min(sy1, sy2);
  let w = Math.abs(sx2 - sx1), h = Math.abs(sy2 - sy1);

  if (w < 2 && h < 2) {
    ctx.restore();
    return;
  }

  if (sx2 >= sx1) {
    // Kéo từ Trái sang Phải: Window Selection (Chỉ chọn đối tượng NẰM TRỌN bên trong)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else {
    // Kéo từ Phải sang Trái: Crossing Selection (Chọn đối tượng NẰM TRONG HOẶC CẮT QUA)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

// ===============================================================================
//     LIVE COORDINATE, OBJECT & GRID CELL INSPECTOR OVERLAY (LỆNH ID / CHECK)
// ===============================================================================
function drawInspectorOverlay() {
  if (currentTool !== 'ID' && currentTool !== 'CHECK') return;

  const wx = mouseWorld.x;
  const wy = mouseWorld.y;

  // Tính ô trần 600x600 chuẩn
  const cellSize = 600;
  const col = Math.floor(wx / cellSize);
  const row = Math.floor(wy / cellSize);
  const cellMinX = col * cellSize;
  const cellMinY = row * cellSize;
  const cellMaxX = cellMinX + cellSize;
  const cellMaxY = cellMinY + cellSize;
  const centerX = cellMinX + cellSize / 2;
  const centerY = cellMinY + cellSize / 2;

  // 1. Vẽ khung viền ô trần 600x600 đang soi
  ctx.save();
  const sTL = worldToScreen(cellMinX, cellMaxY);
  const sBR = worldToScreen(cellMaxX, cellMinY);
  const sWidth = sBR.x - sTL.x;
  const sHeight = sBR.y - sTL.y;

  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.fillRect(sTL.x, sTL.y, sWidth, sHeight);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(sTL.x, sTL.y, sWidth, sHeight);

  // 2. Vẽ tâm ô trần
  const sCenter = worldToScreen(centerX, centerY);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#facc15';
  ctx.fillStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sCenter.x, sCenter.y, 4, 0, 2 * Math.PI);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(sCenter.x - 8, sCenter.y); ctx.lineTo(sCenter.x + 8, sCenter.y);
  ctx.moveTo(sCenter.x, sCenter.y - 8); ctx.lineTo(sCenter.x, sCenter.y + 8);
  ctx.stroke();

  // 3. Tìm vật thể dưới trỏ chuột
  let found = typeof findClosestEntity === 'function' ? findClosestEntity(mouseWorld) : null;
  let targetDesc = found ? `Vật thể: #${found.id} (${found.type}, Layer: ${found.layer || '0'})` : 'Vật thể: (Khoảng trống)';

  // 4. Vẽ bảng thông số Head-Up Display ngay cạnh con trỏ
  const sx = Math.min(mouseScreen.x + 18, canvas.width - 260);
  const sy = Math.max(mouseScreen.y - 80, 10);
  const boxW = 250;
  const boxH = 75;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(sx, sy, boxW, boxH, 6);
  else ctx.rect(sx, sy, boxW, boxH);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 11.5px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`📍 X: ${wx.toFixed(1)} | Y: ${wy.toFixed(1)} mm`, sx + 8, sy + 18);

  ctx.fillStyle = '#facc15';
  ctx.fillText(`📐 Ô [Cột: ${col}, Hàng: ${row}] (600x600)`, sx + 8, sy + 36);

  ctx.fillStyle = '#4ade80';
  ctx.fillText(`🎯 Tâm ô: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`, sx + 8, sy + 54);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px monospace';
  ctx.fillText(`${targetDesc}`, sx + 8, sy + 69);

  ctx.restore();
}

// ===============================================================================
//     AUTOCAD OSNAP VISUAL GLYPH & TOOLTIP MARKER RENDERER
// ===============================================================================
function drawOsnapGlyph() {
  if (!activeSnapPoint || !activeSnapPoint.type) return;

  const s = worldToScreen(activeSnapPoint.x, activeSnapPoint.y);
  if (s.x < -30 || s.x > canvas.width + 30 || s.y < -30 || s.y > canvas.height + 30) return;

  ctx.save();
  ctx.strokeStyle = '#22c55e'; // AutoCAD Snap Green
  ctx.fillStyle = '#22c55e';
  ctx.lineWidth = 2.0;

  const type = activeSnapPoint.type;
  if (type === 'ENDPOINT') {
    ctx.strokeRect(s.x - 5.5, s.y - 5.5, 11, 11);
  } else if (type === 'MIDPOINT') {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6.5);
    ctx.lineTo(s.x + 6.5, s.y + 5.5);
    ctx.lineTo(s.x - 6.5, s.y + 5.5);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'CENTER') {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  } else if (type === 'INTERSECTION') {
    ctx.beginPath();
    ctx.moveTo(s.x - 6, s.y - 6);
    ctx.lineTo(s.x + 6, s.y + 6);
    ctx.moveTo(s.x + 6, s.y - 6);
    ctx.lineTo(s.x - 6, s.y + 6);
    ctx.stroke();
  } else if (type === 'QUADRANT') {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6.5);
    ctx.lineTo(s.x + 6.5, s.y);
    ctx.lineTo(s.x, s.y + 6.5);
    ctx.lineTo(s.x - 6.5, s.y);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'PERPENDICULAR') {
    ctx.beginPath();
    ctx.moveTo(s.x - 6, s.y - 6);
    ctx.lineTo(s.x - 6, s.y + 6);
    ctx.lineTo(s.x + 6, s.y + 6);
    ctx.stroke();
  } else if (type === 'NEAREST') {
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y - 5);
    ctx.lineTo(s.x + 5, s.y + 5);
    ctx.lineTo(s.x - 5, s.y + 5);
    ctx.lineTo(s.x + 5, s.y - 5);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
  }

  // OSNAP Badge Tooltip
  const text = activeSnapPoint.desc || type;
  ctx.font = 'bold 10.5px sans-serif';
  const textMetrics = ctx.measureText(text);
  const tagW = textMetrics.width + 12;
  const tagH = 18;
  const tagX = Math.min(s.x + 12, canvas.width - tagW - 8);
  const tagY = Math.max(s.y - 20, 10);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(tagX, tagY, tagW, tagH, 4);
  else ctx.rect(tagX, tagY, tagW, tagH);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4ade80';
  ctx.fillText(text, tagX + 6, tagY + 13);

  ctx.restore();
}

