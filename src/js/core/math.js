// COORDINATE TRANSFORMATIONS & GEOMETRIC MATH
function worldToScreen(wx, wy) {
  const angle = viewRotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rotatedX = wx * cos - wy * sin;
  const rotatedY = wx * sin + wy * cos;
  return {
    x: canvas.width / 2 + (rotatedX * zoom) + panX,
    y: canvas.height / 2 - (rotatedY * zoom) + panY
  };
}

function screenToWorld(sx, sy) {
  const angle = viewRotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rotatedX = (sx - canvas.width / 2 - panX) / zoom;
  const rotatedY = -(sy - canvas.height / 2 - panY) / zoom;
  return {
    x: rotatedX * cos + rotatedY * sin,
    y: -rotatedX * sin + rotatedY * cos
  };
}

function setViewRotation(degrees) {
  if (typeof saveState === 'function') saveState();
  viewRotation = Number.isFinite(degrees) ? degrees : 0;
  while (viewRotation > 180) viewRotation -= 360;
  while (viewRotation <= -180) viewRotation += 360;
  if (typeof zoomAll === 'function' && entities.length > 0) zoomAll();
  if (typeof autoSaveToDB === 'function') autoSaveToDB();
  if (typeof logCommandTransaction === 'function') {
    logCommandTransaction('SETVIEW', 'EXECUTED', { degrees: viewRotation });
  }
  setInfo(viewRotation === 0
    ? '👁️ Đã đưa góc nhìn về TOP (0°).'
    : `👁️ Góc nhìn 2D: ${viewRotation.toFixed(1)}°.`);
}

function rotateView(delta) {
  let step = Number.isFinite(delta) ? delta : 15;
  if (typeof logCommandTransaction === 'function') {
    logCommandTransaction('ROTATEVIEW', 'STARTED', { delta: step });
  }
  setViewRotation(viewRotation + step);
}

function dist(p1, p2) {
  let x1 = p1.x !== undefined ? p1.x : p1[0];
  let y1 = p1.y !== undefined ? p1.y : p1[1];
  let x2 = p2.x !== undefined ? p2.x : p2[0];
  let y2 = p2.y !== undefined ? p2.y : p2[1];
  return Math.hypot(x2 - x1, y2 - y1);
}

function rotatePointAround(pt, center, rad) {
  let cos = Math.cos(rad), sin = Math.sin(rad);
  let dx = pt.x - center.x, dy = pt.y - center.y;
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  };
}

function mirrorPointOverLine(pt, lp1, lp2) {
  let dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
  let lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: pt.x, y: pt.y };
  let t = ((pt.x - lp1.x) * dx + (pt.y - lp1.y) * dy) / lenSq;
  let projX = lp1.x + t * dx, projY = lp1.y + t * dy;
  return {
    x: 2 * projX - pt.x,
    y: 2 * projY - pt.y
  };
}
