// 60FPS RENDER LOOP, GRID, UCS ICON & CROSSHAIR CURSOR
function resize() {
  if (!viewport || !canvas) return;
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
}

window.addEventListener('resize', resize);

function animate() {
  if (canvas.width === 0 || canvas.height === 0) resize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  for (let e of entities) {
    drawEntity(e, selectedIds.has(e.id));
  }

  // Draw Generic Plugin Overlays (if registered)
  if (window.cadPluginHooks && Array.isArray(window.cadPluginHooks.overlayRenderers)) {
    for (let fn of window.cadPluginHooks.overlayRenderers) {
      if (typeof fn === 'function') {
        try { fn(ctx); } catch (err) { console.error(err); }
      }
    }
  }

  if (isDrawing && startPoint && typeof drawRubberband === 'function') {
    drawRubberband();
  }

  // Draw Selection Box (AutoCAD Window / Crossing Box)
  if (typeof drawSelectionBox === 'function') {
    drawSelectionBox();
  }

  // Draw Coordinate & Cell Inspector Overlay (ID / CHECK tool)
  if (typeof drawInspectorOverlay === 'function') {
    drawInspectorOverlay();
  }

  // Draw High-Precision AutoCAD OSNAP Visual Marker & Glyph
  if (typeof drawOsnapGlyph === 'function') {
    drawOsnapGlyph();
  }

  if (typeof drawCrosshair === 'function') {
    drawCrosshair();
  }

  requestAnimationFrame(animate);
}

function drawGrid() {
  ctx.save();
  let step = 1000; // 1 meter grid
  if (zoom < 0.03) step = 2000;
  if (zoom < 0.01) step = 5000;
  if (zoom > 0.2) step = 500;
  if (zoom > 0.5) step = 100;

  let minW = screenToWorld(0, canvas.height);
  let maxW = screenToWorld(canvas.width, 0);

  const startX = Math.floor(minW.x / step) * step;
  const endX = Math.ceil(maxW.x / step) * step;
  const startY = Math.floor(minW.y / step) * step;
  const endY = Math.ceil(maxW.y / step) * step;

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#111827';
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    let p1 = worldToScreen(x, minW.y), p2 = worldToScreen(x, maxW.y);
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  }
  for (let y = startY; y <= endY; y += step) {
    let p1 = worldToScreen(minW.x, y), p2 = worldToScreen(maxW.x, y);
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke();

  drawUcsIcon();
  ctx.restore();
}

function drawUcsIcon() {
  ctx.save();
  let ucs = worldToScreen(0, 0);
  let originOnScreen = (ucs.x >= 50 && ucs.x <= canvas.width - 60 && ucs.y >= 60 && ucs.y <= canvas.height - 50);
  let ox = originOnScreen ? ucs.x : 45;
  let oy = originOnScreen ? ucs.y : canvas.height - 45;
  let len = 42;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ox - 3, oy - 3, 6, 6);

  // X Axis (Red)
  ctx.strokeStyle = '#ef4444';
  ctx.fillStyle = '#ef4444';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + len, oy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox + len, oy);
  ctx.lineTo(ox + len - 7, oy - 3.5);
  ctx.lineTo(ox + len - 7, oy + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('X', ox + len + 5, oy + 4);

  // Y Axis (Green)
  ctx.strokeStyle = '#22c55e';
  ctx.fillStyle = '#22c55e';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox, oy - len);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ox, oy - len);
  ctx.lineTo(ox - 3.5, oy - len + 7);
  ctx.lineTo(ox + 3.5, oy - len + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillText('Y', ox - 4, oy - len - 6);

  ctx.restore();
}

function drawCrosshair() {
  let sx = mouseScreen.x, sy = mouseScreen.y;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy);
  ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.strokeRect(sx - 5, sy - 5, 10, 10);
  ctx.restore();
}
