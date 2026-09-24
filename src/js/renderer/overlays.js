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
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`ΔX: ${dx.toFixed(0)}, ΔY: ${dy.toFixed(0)} mm`, s2.x + 12, s2.y - 12);
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

