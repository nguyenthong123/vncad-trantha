// ==========================================================================
// VINACAD - ENTITY CREATION & DYNAMIC INPUT SUBMISSION
// Handles creating concrete CAD geometric entities and finishing drawing
// ==========================================================================

function finishDrawingWithPoint(targetPt) {
  saveState();
  const id = 'ent_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  if (currentTool === 'LINE') {
    entities.push({ id, type: 'LINE', p1: [startPoint.x, startPoint.y], p2: [targetPt.x, targetPt.y], color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType });
    setInfo(`✅ Đã vẽ đoạn thẳng LINE.`);
    startPoint = targetPt; // Chaining lines
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
    return;
  } else if (currentTool === 'RECTANGLE') {
    let x = Math.min(startPoint.x, targetPt.x), y = Math.min(startPoint.y, targetPt.y);
    let w = Math.abs(targetPt.x - startPoint.x), h = Math.abs(targetPt.y - startPoint.y);
    entities.push({ id, type: 'RECTANGLE', x, y, w, h, color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType, fillColor: activeProperties.fillColor });
    setInfo(`✅ Đã vẽ hình chữ nhật [${w.toFixed(0)} x ${h.toFixed(0)} mm].`);
  } else if (currentTool === 'CIRCLE') {
    let r = Math.hypot(targetPt.x - startPoint.x, targetPt.y - startPoint.y);
    entities.push({ id, type: 'CIRCLE', cx: startPoint.x, cy: startPoint.y, r, color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType, fillColor: activeProperties.fillColor });
    setInfo(`✅ Đã vẽ hình tròn [R = ${r.toFixed(0)} mm].`);
  } else if (currentTool === 'ARC') {
    let r = Math.hypot(midPoint.x - startPoint.x, midPoint.y - startPoint.y);
    let a1 = Math.atan2(startPoint.y - midPoint.y, startPoint.x - midPoint.x);
    let a2 = Math.atan2(targetPt.y - midPoint.y, targetPt.x - midPoint.x);
    entities.push({ id, type: 'ARC', cx: midPoint.x, cy: midPoint.y, r, startAngle: a1, endAngle: a2, color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType });
    setInfo(`✅ Đã vẽ cung tròn ARC.`);
  } else if (currentTool === 'ELLIPSE') {
    let rx = Math.abs(targetPt.x - startPoint.x), ry = Math.abs(targetPt.y - startPoint.y) || rx / 2;
    entities.push({ id, type: 'ELLIPSE', cx: startPoint.x, cy: startPoint.y, rx, ry, color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType, fillColor: activeProperties.fillColor });
    setInfo(`✅ Đã vẽ hình Elip [RX=${rx.toFixed(0)}, RY=${ry.toFixed(0)}].`);
  } else if (currentTool === 'POLYGON') {
    let r = Math.hypot(targetPt.x - startPoint.x, targetPt.y - startPoint.y);
    let pts = [];
    for (let i = 0; i < 6; i++) {
      let a = (i * 2 * Math.PI) / 6;
      pts.push([startPoint.x + r * Math.cos(a), startPoint.y + r * Math.sin(a)]);
    }
    entities.push({ id, type: 'POLYGON', points: pts, color: activeProperties.color, layer: activeProperties.layer, width: activeProperties.width, lineType: activeProperties.lineType, fillColor: activeProperties.fillColor });
    setInfo(`✅ Đã vẽ đa giác đều 6 cạnh.`);
  } else if (currentTool === 'DIMENSION') {
    entities.push({ id, type: 'DIMENSION', p1: [startPoint.x, startPoint.y], p2: [targetPt.x, targetPt.y], offset: 350, color: activeProperties.color, layer: 'DIM' });
    setInfo(`📏 Đã ghi kích thước.`);
  } else if (currentTool === 'DIST') {
    let d = Math.hypot(targetPt.x - startPoint.x, targetPt.y - startPoint.y);
    let deg = (Math.atan2(targetPt.y - startPoint.y, targetPt.x - startPoint.x) * 180 / Math.PI + 360) % 360;
    setInfo(`📏 Khoảng cách: ${d.toFixed(1)} mm (${(d / 1000).toFixed(2)} m) | Góc: ${deg.toFixed(1)}°`);
  } else if (currentTool === 'MOVE') {
    let dx = targetPt.x - startPoint.x, dy = targetPt.y - startPoint.y;
    entities = entities.map(e => selectedIds.has(e.id) ? translateEntity(e, dx, dy) : e);
    setInfo(`✥ Đã dời đối tượng (ΔX: ${dx.toFixed(0)}, ΔY: ${dy.toFixed(0)} mm).`);
    selectTool('SELECT');
  } else if (currentTool === 'COPY') {
    let dx = targetPt.x - startPoint.x, dy = targetPt.y - startPoint.y;
    let newObjs = [];
    entities.forEach(e => {
      if (selectedIds.has(e.id)) {
        newObjs.push(cloneEntity(e, dx, dy));
      }
    });
    entities.push(...newObjs);
    setInfo(`📋 Đã sao chép ${newObjs.length} đối tượng.`);
    selectTool('SELECT');
  } else if (currentTool === 'ROTATE') {
    let angRad = Math.atan2(targetPt.y - startPoint.y, targetPt.x - startPoint.x);
    entities = entities.map(e => selectedIds.has(e.id) ? rotateEntity(e, startPoint, angRad) : e);
    setInfo(`🔄 Đã xoay đối tượng ${(angRad * 180 / Math.PI).toFixed(1)}° quanh điểm gốc.`);
    selectTool('SELECT');
  } else if (currentTool === 'SCALE') {
    let d = Math.hypot(targetPt.x - startPoint.x, targetPt.y - startPoint.y);
    let factor = Math.max(d / 500, 0.1);
    entities = entities.map(e => selectedIds.has(e.id) ? scaleEntity(e, startPoint, factor) : e);
    setInfo(`📐 Đã Scale đối tượng tỉ lệ ${factor.toFixed(2)}x.`);
    selectTool('SELECT');
  } else if (currentTool === 'MIRROR') {
    entities = entities.map(e => selectedIds.has(e.id) ? mirrorEntity(e, startPoint, targetPt) : e);
    setInfo(`🪞 Đã lấy đối xứng gương MIRROR.`);
    selectTool('SELECT');
  }

  isDrawing = false;
  startPoint = null;
  midPoint = null;
  if (dynBox) dynBox.style.display = 'none';
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
}

function handleDynInputSubmit() {
  let valStr = dynInput.value.trim() || dynInput.placeholder.replace(' mm', '').trim();
  let val = parseFloat(valStr);

  if (!isFinite(val) || val <= 0) {
    if (isDrawing && startPoint) finishDrawingWithPoint(mouseWorld);
    return;
  }

  if (currentTool === 'OFFSET') {
    offsetDist = val;
    setInfo(`⚡ Khoảng cách Offset mới: ${offsetDist} mm. Hãy nhấp nét để offset.`);
    dynBox.style.display = 'none';
    return;
  }

  if (!isDrawing || !startPoint) return;

  let activeEnd = applyOrthoPoint(startPoint, mouseWorld);
  let dx = activeEnd.x - startPoint.x, dy = activeEnd.y - startPoint.y;
  let len = Math.hypot(dx, dy);

  let targetPt;
  if (len < 1e-3) {
    targetPt = { x: startPoint.x + val, y: startPoint.y };
  } else {
    targetPt = { x: startPoint.x + (dx / len) * val, y: startPoint.y + (dy / len) * val };
  }

  finishDrawingWithPoint(targetPt);
}
