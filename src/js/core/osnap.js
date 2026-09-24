// AUTOCAD OSNAP ENGINE & HIT TESTING
function findSnapPoint(wPt) {
  const snapThresholdWorld = 24 / zoom;
  let nearest = null;
  let minD = snapThresholdWorld;

  for (let e of entities) {
    if (e.layer === 'BOM_TABLE') continue;
    let points = [];
    if (e.type === 'LINE' || e.type === 'DIMENSION') {
      if (e.p1 && e.p2) points.push(e.p1, e.p2, [(e.p1[0] + e.p2[0]) / 2, (e.p1[1] + e.p2[1]) / 2]);
    } else if (e.type === 'RECTANGLE') {
      points.push([e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h], [e.x + e.w / 2, e.y + e.h / 2]);
    } else if (e.type === 'CIRCLE' || e.type === 'ELLIPSE' || e.type === 'POLYGON') {
      points.push([e.cx, e.cy]);
    } else if (e.type === 'POLYLINE' && e.points) {
      e.points.forEach(p => points.push(p));
    }

    for (let pt of points) {
      if (pt && isFinite(pt[0]) && isFinite(pt[1])) {
        let d = Math.hypot(pt[0] - wPt.x, pt[1] - wPt.y);
        if (d < minD) {
          minD = d;
          nearest = { x: pt[0], y: pt[1] };
        }
      }
    }
  }
  return nearest;
}

function applyOrthoPoint(start, target) {
  if (!orthoMode || !start) return target;
  let dx = Math.abs(target.x - start.x);
  let dy = Math.abs(target.y - start.y);
  if (dx >= dy) return { x: target.x, y: start.y };
  else return { x: start.x, y: target.y };
}

function getHitDistance(pt, e) {
  if (!e || e.layer === 'BOM_TABLE') return Infinity;
  if (e.type === 'LINE' || e.type === 'DIMENSION') {
    if (!e.p1 || !e.p2) return Infinity;
    return distToSegment(pt, { x: e.p1[0], y: e.p1[1] }, { x: e.p2[0], y: e.p2[1] });
  } else if (e.type === 'RECTANGLE') {
    let p1 = { x: e.x, y: e.y }, p2 = { x: e.x + e.w, y: e.y };
    let p3 = { x: e.x + e.w, y: e.y + e.h }, p4 = { x: e.x, y: e.y + e.h };
    let d1 = distToSegment(pt, p1, p2);
    let d2 = distToSegment(pt, p2, p3);
    let d3 = distToSegment(pt, p3, p4);
    let d4 = distToSegment(pt, p4, p1);
    let edgeDist = Math.min(d1, d2, d3, d4);
    if ((e.fillColor && e.fillColor !== 'transparent' || e.isHatched) && pt.x >= e.x && pt.x <= e.x + e.w && pt.y >= e.y && pt.y <= e.y + e.h) {
      return 0;
    }
    return edgeDist;
  } else if (e.type === 'CIRCLE') {
    let d = Math.hypot(pt.x - e.cx, pt.y - e.cy);
    if (e.fillColor && e.fillColor !== 'transparent' && d <= e.r) return 0;
    return Math.abs(d - e.r);
  } else if (e.type === 'ELLIPSE') {
    let d = Math.hypot(pt.x - e.cx, pt.y - e.cy);
    return Math.abs(d - (e.rx || 100));
  } else if (e.type === 'POLYGON' || e.type === 'POLYLINE') {
    let pts = (e.points || e.pts || []).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
    if (pts.length < 2) return Infinity;
    let minEdgeD = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      let ed = distToSegment(pt, pts[j], pts[i]);
      if (ed < minEdgeD) minEdgeD = ed;
    }
    if ((e.closed || e.type === 'POLYGON') && isPointInPoly(pt, pts)) {
      return 0;
    }
    return minEdgeD;
  } else if (e.type === 'TEXT') {
    return Math.hypot(pt.x - e.x, pt.y - e.y);
  }
  return Infinity;
}

function checkHit(pt, e) {
  const tol = 24 / zoom;
  return getHitDistance(pt, e) < tol;
}

function distToSegment(p, v, w) {
  let l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function getEntityBoundingBox(e) {
  if (e.p1 && e.p2) {
    return { minX: Math.min(e.p1[0], e.p2[0]), maxX: Math.max(e.p1[0], e.p2[0]), minY: Math.min(e.p1[1], e.p2[1]), maxY: Math.max(e.p1[1], e.p2[1]) };
  }
  if (e.x !== undefined && e.w !== undefined) {
    return { minX: e.x, maxX: e.x + e.w, minY: e.y, maxY: e.y + e.h };
  }
  if (e.cx !== undefined && e.r !== undefined) {
    return { minX: e.cx - e.r, maxX: e.cx + e.r, minY: e.cy - e.r, maxY: e.cy + e.r };
  }
  if (e.points || e.pts) {
    let pts = e.points || e.pts;
    let xs = pts.map(p => p[0] !== undefined ? p[0] : p.x);
    let ys = pts.map(p => p[1] !== undefined ? p[1] : p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  return null;
}

function isPointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i].x !== undefined ? poly[i].x : poly[i][0];
    let yi = poly[i].y !== undefined ? poly[i].y : poly[i][1];
    let xj = poly[j].x !== undefined ? poly[j].x : poly[j][0];
    let yj = poly[j].y !== undefined ? poly[j].y : poly[j][1];
    let intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// AutoCAD Box Selection Test (Window: Completely Inside | Crossing: Inside or Intersecting)
function lineSegmentsIntersect(p1, p2, p3, p4) {
  function ccw(A, B, C) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

function lineIntersectsBox(p1, p2, minX, maxX, minY, maxY) {
  // Check if either end is inside
  if ((p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) ||
      (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY)) {
    return true;
  }
  // Check intersection with all 4 box edges
  const b1 = { x: minX, y: minY }, b2 = { x: maxX, y: minY };
  const b3 = { x: maxX, y: maxY }, b4 = { x: minX, y: maxY };
  return lineSegmentsIntersect(p1, p2, b1, b2) ||
         lineSegmentsIntersect(p1, p2, b2, b3) ||
         lineSegmentsIntersect(p1, p2, b3, b4) ||
         lineSegmentsIntersect(p1, p2, b4, b1);
}

function isEntityInBox(e, minX, maxX, minY, maxY, isCrossing) {
  if (e.layer === 'BOM_TABLE') return false;
  let bb = getEntityBoundingBox(e);
  if (!bb) return false;

  if (!isCrossing) {
    // Window Mode: Entity must be completely inside the box
    return bb.minX >= minX && bb.maxX <= maxX && bb.minY >= minY && bb.maxY <= maxY;
  } else {
    // Crossing Mode: Box overlaps bounding box OR entity intersects box
    if (bb.maxX < minX || bb.minX > maxX || bb.maxY < minY || bb.minY > maxY) {
      return false;
    }
    // Specific geometry tests
    if (e.type === 'LINE' || e.type === 'DIMENSION') {
      let p1 = { x: e.p1[0], y: e.p1[1] }, p2 = { x: e.p2[0], y: e.p2[1] };
      return lineIntersectsBox(p1, p2, minX, maxX, minY, maxY);
    } else if (e.type === 'RECTANGLE') {
      return true; // Bounding box already overlapped
    } else if (e.type === 'CIRCLE') {
      return true;
    } else if (e.type === 'POLYGON' || e.type === 'POLYLINE') {
      let pts = (e.points || e.pts || []).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      for (let pt of pts) {
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return true;
      }
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (lineIntersectsBox(pts[j], pts[i], minX, maxX, minY, maxY)) return true;
      }
      return false;
    } else {
      return true;
    }
  }
}

