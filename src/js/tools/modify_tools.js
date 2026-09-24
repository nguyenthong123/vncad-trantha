// AUTOCAD GEOMETRY TRANSFORMATIONS & MODIFY ENGINES
function translateEntity(e, dx, dy) {
  let c = JSON.parse(JSON.stringify(e));
  if (c.p1) { c.p1[0] += dx; c.p1[1] += dy; c.p2[0] += dx; c.p2[1] += dy; }
  if (c.x !== undefined) { c.x += dx; c.y += dy; }
  if (c.cx !== undefined) { c.cx += dx; c.cy += dy; }
  if (c.points) c.points = c.points.map(p => [p[0] + dx, p[1] + dy]);
  if (c.pts) c.pts = c.pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
  return c;
}

function cloneEntity(e, dx, dy) {
  let c = translateEntity(e, dx, dy);
  c.id = 'ent_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  return c;
}

function rotateEntity(e, origin, angRad) {
  let c = JSON.parse(JSON.stringify(e));
  function rotPt(x, y) {
    let rx = x - origin.x, ry = y - origin.y;
    return [
      origin.x + rx * Math.cos(angRad) - ry * Math.sin(angRad),
      origin.y + rx * Math.sin(angRad) + ry * Math.cos(angRad)
    ];
  }
  if (c.p1) {
    let r1 = rotPt(c.p1[0], c.p1[1]), r2 = rotPt(c.p2[0], c.p2[1]);
    c.p1 = r1; c.p2 = r2;
  }
  if (c.cx !== undefined) {
    let rc = rotPt(c.cx, c.cy);
    c.cx = rc[0]; c.cy = rc[1];
  }
  if (c.x !== undefined) {
    let rc = rotPt(c.x, c.y);
    c.x = rc[0]; c.y = rc[1];
  }
  if (c.points) c.points = c.points.map(p => rotPt(p[0], p[1]));
  return c;
}

function scaleEntity(e, origin, factor) {
  let c = JSON.parse(JSON.stringify(e));
  function scPt(x, y) {
    return [origin.x + (x - origin.x) * factor, origin.y + (y - origin.y) * factor];
  }
  if (c.p1) {
    let s1 = scPt(c.p1[0], c.p1[1]), s2 = scPt(c.p2[0], c.p2[1]);
    c.p1 = s1; c.p2 = s2;
  }
  if (c.x !== undefined && c.w !== undefined) {
    let s = scPt(c.x, c.y);
    c.x = s[0]; c.y = s[1]; c.w *= factor; c.h *= factor;
  }
  if (c.cx !== undefined) {
    let sc = scPt(c.cx, c.cy);
    c.cx = sc[0]; c.cy = sc[1];
    if (c.r) c.r *= factor;
    if (c.rx) { c.rx *= factor; c.ry *= factor; }
  }
  if (c.points) c.points = c.points.map(p => scPt(p[0], p[1]));
  return c;
}

function mirrorEntity(e, p1, p2) {
  let c = JSON.parse(JSON.stringify(e));
  let dx = p2.x - p1.x, dy = p2.y - p1.y;
  let len2 = dx * dx + dy * dy;
  if (len2 === 0) return c;
  function mirPt(x, y) {
    let u = ((x - p1.x) * dx + (y - p1.y) * dy) / len2;
    let px = p1.x + u * dx, py = p1.y + u * dy;
    return [2 * px - x, 2 * py - y];
  }
  if (c.p1) {
    let m1 = mirPt(c.p1[0], c.p1[1]), m2 = mirPt(c.p2[0], c.p2[1]);
    c.p1 = m1; c.p2 = m2;
  }
  if (c.cx !== undefined) {
    let mc = mirPt(c.cx, c.cy);
    c.cx = mc[0]; c.cy = mc[1];
  }
  if (c.points) c.points = c.points.map(p => mirPt(p[0], p[1]));
  return c;
}

function explodeEntity(e) {
  let lines = [];
  if (e.type === 'RECTANGLE') {
    lines.push(
      { id: 'l_' + Date.now() + '_1', type: 'LINE', p1: [e.x, e.y], p2: [e.x + e.w, e.y], color: e.color, layer: e.layer, width: e.width, lineType: e.lineType },
      { id: 'l_' + Date.now() + '_2', type: 'LINE', p1: [e.x + e.w, e.y], p2: [e.x + e.w, e.y + e.h], color: e.color, layer: e.layer, width: e.width, lineType: e.lineType },
      { id: 'l_' + Date.now() + '_3', type: 'LINE', p1: [e.x + e.w, e.y + e.h], p2: [e.x, e.y + e.h], color: e.color, layer: e.layer, width: e.width, lineType: e.lineType },
      { id: 'l_' + Date.now() + '_4', type: 'LINE', p1: [e.x, e.y + e.h], p2: [e.x, e.y], color: e.color, layer: e.layer, width: e.width, lineType: e.lineType }
    );
  } else if (e.type === 'POLYLINE' && e.points) {
    for (let i = 0; i < e.points.length - 1; i++) {
      lines.push({ id: 'l_' + Date.now() + '_' + i, type: 'LINE', p1: e.points[i], p2: e.points[i + 1], color: e.color, layer: e.layer, width: e.width, lineType: e.lineType });
    }
  }
  return lines;
}

function offsetEntity(e, dist, clickPt) {
  if (e.type === 'LINE') {
    let dx = e.p2[0] - e.p1[0], dy = e.p2[1] - e.p1[1];
    let len = Math.hypot(dx, dy);
    if (len === 0) return null;
    let nx = -dy / len, ny = dx / len;
    let midX = (e.p1[0] + e.p2[0]) / 2, midY = (e.p1[1] + e.p2[1]) / 2;
    let side = (clickPt.x - midX) * nx + (clickPt.y - midY) * ny > 0 ? 1 : -1;
    let offX = nx * dist * side, offY = ny * dist * side;
    return {
      id: 'off_' + Date.now(),
      type: 'LINE',
      p1: [e.p1[0] + offX, e.p1[1] + offY],
      p2: [e.p2[0] + offX, e.p2[1] + offY],
      color: e.color,
      layer: e.layer,
      width: e.width,
      lineType: e.lineType
    };
  } else if (e.type === 'RECTANGLE') {
    let inside = clickPt.x >= e.x && clickPt.x <= e.x + e.w && clickPt.y >= e.y && clickPt.y <= e.y + e.h;
    let sign = inside ? 1 : -1;
    return {
      id: 'off_' + Date.now(),
      type: 'RECTANGLE',
      x: e.x + dist * sign,
      y: e.y + dist * sign,
      w: Math.max(e.w - 2 * dist * sign, 10),
      h: Math.max(e.h - 2 * dist * sign, 10),
      color: e.color,
      layer: e.layer,
      width: e.width,
      lineType: e.lineType
    };
  }
  return null;
}
