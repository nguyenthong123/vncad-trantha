// ENTITY RENDERING & AUTOCAD BLUE GRIPS
function drawEntity(e, isSelected) {
  ctx.save();
  ctx.strokeStyle = e.color || '#38bdf8';
  ctx.fillStyle = e.fillColor || 'transparent';
  ctx.lineWidth = isSelected ? Math.max(2.5, (e.width || 2) + 0.5) : (e.width || 2);

  // Line Type Dashing
  if (e.lineType === 'DASHED') {
    ctx.setLineDash([8, 5]);
  } else if (e.lineType === 'CENTER') {
    ctx.setLineDash([14, 4, 3, 4]);
  } else if (e.lineType === 'DOTTED') {
    ctx.setLineDash([2, 4]);
  } else {
    ctx.setLineDash([]);
  }

  if (e.type === 'LINE') {
    let s1 = worldToScreen(e.p1[0], e.p1[1]), s2 = worldToScreen(e.p2[0], e.p2[1]);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  } else if (e.type === 'RECTANGLE') {
    let s = worldToScreen(e.x, e.y + e.h);
    let sw = e.w * zoom, sh = e.h * zoom;
    if (e.fillColor && e.fillColor !== 'transparent') ctx.fillRect(s.x, s.y, sw, sh);
    ctx.strokeRect(s.x, s.y, sw, sh);
    if (e.isHatched) drawHatchPattern(s.x, s.y, sw, sh);
  } else if (e.type === 'CIRCLE') {
    let s = worldToScreen(e.cx, e.cy);
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.abs(e.r * zoom), 0, 2 * Math.PI);
    if (e.fillColor && e.fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
    if (e.layer === '07_DIEM_TY_TREO' || e.layer === 'HANGERS') {
      let r = Math.abs(e.r * zoom);
      ctx.beginPath();
      ctx.moveTo(s.x - r * 1.5, s.y); ctx.lineTo(s.x + r * 1.5, s.y);
      ctx.moveTo(s.x, s.y - r * 1.5); ctx.lineTo(s.x + r * 1.5, s.y);
      ctx.stroke();
    }
  } else if (e.type === 'ARC') {
    let s = worldToScreen(e.cx, e.cy);
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.abs(e.r * zoom), e.startAngle, e.endAngle); ctx.stroke();
  } else if (e.type === 'ELLIPSE') {
    let s = worldToScreen(e.cx, e.cy);
    ctx.beginPath(); ctx.ellipse(s.x, s.y, Math.abs(e.rx * zoom), Math.abs(e.ry * zoom), 0, 0, 2 * Math.PI);
    if (e.fillColor && e.fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (e.type === 'POLYGON' || e.type === 'POLYLINE') {
    let pts = e.points || e.pts;
    if (pts && pts.length > 0) {
      ctx.beginPath();
      let s0 = worldToScreen(pts[0][0] !== undefined ? pts[0][0] : pts[0].x, pts[0][1] !== undefined ? pts[0][1] : pts[0].y);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        let si = worldToScreen(pts[i][0] !== undefined ? pts[i][0] : pts[i].x, pts[i][1] !== undefined ? pts[i][1] : pts[i].y);
        ctx.lineTo(si.x, si.y);
      }
      if (e.closed || e.type === 'POLYGON') ctx.closePath();
      if (e.fillColor && e.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();
    }
  } else if (e.type === 'TEXT') {
    let s = worldToScreen(e.x, e.y);
    let worldSize = e.size || 140;
    let px = worldSize * zoom;
    if (worldSize < 40 && zoom < 0.1) {
      px = worldSize * 15 * zoom;
    }
    ctx.font = `bold ${Math.max(px, 1.5)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
    ctx.fillStyle = e.color || '#f8fafc';
    ctx.textAlign = e.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.text, s.x, s.y);
  } else if (e.type === 'DIMENSION') {
    drawDimensionEntity(e, isSelected);
  }
  ctx.restore();

  if (isSelected) {
    drawEntityGrips(e);
  }
}

function drawDimensionEntity(e, isSelected) {
  let s1 = worldToScreen(e.p1[0], e.p1[1]), s2 = worldToScreen(e.p2[0], e.p2[1]);
  let off = (e.offset || 300) * zoom;
  let dx = s2.x - s1.x, dy = s2.y - s1.y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-3) return;
  let nx = -dy / len, ny = dx / len;

  let d1 = { x: s1.x + nx * off, y: s1.y + ny * off };
  let d2 = { x: s2.x + nx * off, y: s2.y + ny * off };

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = e.color || '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y); ctx.lineTo(d1.x + nx * 5, d1.y + ny * 5);
  ctx.moveTo(s2.x, s2.y); ctx.lineTo(d2.x + nx * 5, d2.y + ny * 5);
  ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y);
  ctx.stroke();

  let tick = 5;
  ctx.beginPath();
  ctx.moveTo(d1.x - tick, d1.y + tick); ctx.lineTo(d1.x + tick, d1.y - tick);
  ctx.moveTo(d2.x - tick, d2.y + tick); ctx.lineTo(d2.x + tick, d2.y - tick);
  ctx.stroke();

  let realDist = Math.hypot(e.p2[0] - e.p1[0], e.p2[1] - e.p1[1]);
  let mid = { x: (d1.x + d2.x) / 2 + nx * 10, y: (d1.y + d2.y) / 2 + ny * 10 };
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = e.color || '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${realDist.toFixed(0)}`, mid.x, mid.y);
}

function drawHatchPattern(x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  let step = 16;
  for (let i = -h; i <= w + h; i += step) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
  }
  ctx.restore();
}

function drawGrip(worldX, worldY) {
  let s = worldToScreen(worldX, worldY);
  let size = 6;
  ctx.save();
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
  ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
  ctx.restore();
}

function drawEntityGrips(e) {
  if (e.type === 'LINE' && e.p1 && e.p2) {
    drawGrip(e.p1[0], e.p1[1]);
    drawGrip((e.p1[0] + e.p2[0]) / 2, (e.p1[1] + e.p2[1]) / 2);
    drawGrip(e.p2[0], e.p2[1]);
  } else if (e.type === 'RECTANGLE') {
    drawGrip(e.x, e.y);
    drawGrip(e.x + e.w, e.y);
    drawGrip(e.x + e.w, e.y + e.h);
    drawGrip(e.x, e.y + e.h);
    drawGrip(e.x + e.w / 2, e.y);
    drawGrip(e.x + e.w / 2, e.y + e.h);
    drawGrip(e.x, e.y + e.h / 2);
    drawGrip(e.x + e.w, e.y + e.h / 2);
  } else if (e.type === 'CIRCLE') {
    drawGrip(e.cx, e.cy);
    drawGrip(e.cx + e.r, e.cy);
    drawGrip(e.cx - e.r, e.cy);
    drawGrip(e.cx, e.cy + e.r);
    drawGrip(e.cx, e.cy - e.r);
  } else if ((e.type === 'POLYGON' || e.type === 'POLYLINE') && (e.points || e.pts)) {
    let pts = e.points || e.pts;
    pts.forEach(p => {
      let x = p[0] !== undefined ? p[0] : p.x;
      let y = p[1] !== undefined ? p[1] : p.y;
      drawGrip(x, y);
    });
  } else if (e.type === 'TEXT') {
    drawGrip(e.x, e.y);
  } else if (e.type === 'DIMENSION' && e.p1 && e.p2) {
    drawGrip(e.p1[0], e.p1[1]);
    drawGrip(e.p2[0], e.p2[1]);
  }
}
