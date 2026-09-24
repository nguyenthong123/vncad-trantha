// ===============================================================================
//     TT600 GEOMETRY & POLYGON DETECTION ENGINE
//     Nhận diện phòng khép kín, nối chuỗi đường thẳng, cắt góc, điểm trong đa giác
// ===============================================================================

function findEnclosingPolygon(clickPt) {
  return findEnclosingPolygonFromEntities(entities, clickPt);
}

function findEnclosingPolygonFromEntities(entList, clickPt) {
  let contours = [];

  for (let e of entList) {
    if (e.type === 'RECTANGLE' && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_')) {
      contours.push([
        { x: e.x, y: e.y },
        { x: e.x + e.w, y: e.y },
        { x: e.x + e.w, y: e.y + e.h },
        { x: e.x, y: e.y + e.h }
      ]);
    } else if ((e.type === 'POLYGON' || e.type === 'POLYLINE') && (e.points || e.pts) && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_')) {
      let pts = (e.points || e.pts).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      if (pts.length >= 3) contours.push(pts);
    }
  }

  let lines = entList.filter(e => e.type === 'LINE' && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_'));
  if (lines.length >= 3) {
    let chainedLoops = chainAllLinesToLoops(lines);
    contours.push(...chainedLoops);
  }

  if (contours.length === 0) return null;

  if (clickPt) {
    for (let c of contours) {
      if (isPointInPoly(clickPt, c)) return c;
    }
    for (let c of contours) {
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
        if (distToSegment(clickPt, c[j], c[i]) < 300) return c;
      }
    }
  }

  contours.sort((a, b) => polyArea(b) - polyArea(a));
  return contours[0];
}

function chainAllLinesToLoops(lines) {
  if (!lines || lines.length < 3) return [];

  let segs = lines.map((l, idx) => ({
    id: idx,
    p1: { x: l.p1[0], y: l.p1[1] },
    p2: { x: l.p2[0], y: l.p2[1] },
    used: false
  }));

  let loops = [];

  for (let sIdx = 0; sIdx < segs.length; sIdx++) {
    if (segs[sIdx].used) continue;

    let orderedPts = [{ ...segs[sIdx].p1 }, { ...segs[sIdx].p2 }];
    segs[sIdx].used = true;
    let curEnd = orderedPts[orderedPts.length - 1];
    let foundNext = true;

    while (foundNext) {
      foundNext = false;
      let bestDist = Infinity;
      let bestIdx = -1;
      let bestReverse = false;

      for (let i = 0; i < segs.length; i++) {
        if (segs[i].used) continue;
        let d1 = Math.hypot(segs[i].p1.x - curEnd.x, segs[i].p1.y - curEnd.y);
        let d2 = Math.hypot(segs[i].p2.x - curEnd.x, segs[i].p2.y - curEnd.y);
        if (d1 < bestDist) {
          bestDist = d1;
          bestIdx = i;
          bestReverse = false;
        }
        if (d2 < bestDist) {
          bestDist = d2;
          bestIdx = i;
          bestReverse = true;
        }
      }

      if (bestIdx !== -1) {
        let nextSeg = segs[bestIdx];
        let nextFar = bestReverse ? nextSeg.p1 : nextSeg.p2;

        orderedPts.push({ ...nextFar });
        curEnd = nextFar;
        nextSeg.used = true;
        foundNext = true;
      }
    }

    if (orderedPts.length >= 3) {
      let pFirst = orderedPts[0];
      let pLast = orderedPts[orderedPts.length - 1];
      let closeDist = Math.hypot(pLast.x - pFirst.x, pLast.y - pFirst.y);

      if (closeDist < 5000) {
        orderedPts.pop();
      }

      let cleanLoop = [];
      for (let i = 0; i < orderedPts.length; i++) {
        let p = orderedPts[i];
        if (cleanLoop.length === 0 || Math.hypot(p.x - cleanLoop[cleanLoop.length - 1].x, p.y - cleanLoop[cleanLoop.length - 1].y) > 5) {
          cleanLoop.push(p);
        }
      }

      if (cleanLoop.length >= 3) {
        if (Math.hypot(cleanLoop[0].x - cleanLoop[cleanLoop.length - 1].x, cleanLoop[0].y - cleanLoop[cleanLoop.length - 1].y) <= 10) {
          cleanLoop.pop();
        }
        if (cleanLoop.length >= 3 && polyArea(cleanLoop) > 0.01) {
          loops.push(cleanLoop);
        }
      }
    }
  }

  return loops;
}

function getClosestEdge(pt, polyPts) {
  let bestD = Infinity;
  let bestEdge = null;
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let d = Math.hypot(pt.x - mid.x, pt.y - mid.y);
    if (d < bestD) {
      bestD = d;
      bestEdge = { p1, p2 };
    }
  }
  return bestEdge;
}

function isPointInPoly(pt, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i].x, yi = poly[i].y;
    let xj = poly[j].x, yj = poly[j].y;
    let intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(p, v, w) {
  let l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2.0);
}

function polyPeri(pts) {
  let p = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    p += Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
  }
  return p;
}

function getHSegments(polyPts, y0, isMeter = false) {
  let xs = [];
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let ya = polyPts[i].y, yb = polyPts[j].y;
    let xa = polyPts[i].x, xb = polyPts[j].x;
    if (ya !== yb && Math.min(ya, yb) <= y0 && y0 <= Math.max(ya, yb)) {
      let x_int = xa + ((y0 - ya) * (xb - xa)) / (yb - ya);
      xs.push(x_int);
    }
  }
  xs.sort((a, b) => a - b);
  let deduped = [];
  for (let x of xs) {
    if (deduped.length === 0 || Math.abs(x - deduped[deduped.length - 1]) > 1) {
      deduped.push(x);
    }
  }
  let pairs = [];
  let eps = isMeter ? 0.025 : 25;
  for (let k = 0; k < deduped.length - 1; k += 2) {
    let s0 = deduped[k], s1 = deduped[k + 1];
    if (s1 - s0 < (isMeter ? 0.05 : 50)) continue;

    // Phải thực sự nằm bên trong phòng
    let midX = (s0 + s1) / 2;
    let inAbove = isPointInPoly({ x: midX, y: y0 + eps }, polyPts);
    let inBelow = isPointInPoly({ x: midX, y: y0 - eps }, polyPts);

    if (inAbove && inBelow) {
      pairs.push([s0, s1]);
    }
  }
  return pairs;
}

function getVSegments(polyPts, x0, isMeter = false) {
  let ys = [];
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let xa = polyPts[i].x, xb = polyPts[j].x;
    let ya = polyPts[i].y, yb = polyPts[j].y;
    if (xa !== xb && Math.min(xa, xb) <= x0 && x0 <= Math.max(xa, xb)) {
      let y_int = ya + ((x0 - xa) * (yb - ya)) / (xb - xa);
      ys.push(y_int);
    }
  }
  ys.sort((a, b) => a - b);
  let deduped = [];
  for (let y of ys) {
    if (deduped.length === 0 || Math.abs(y - deduped[deduped.length - 1]) > 1) {
      deduped.push(y);
    }
  }
  let pairs = [];
  let eps = isMeter ? 0.025 : 25;
  for (let k = 0; k < deduped.length - 1; k += 2) {
    let s0 = deduped[k], s1 = deduped[k + 1];
    if (s1 - s0 < (isMeter ? 0.05 : 50)) continue;

    // Phải thực sự nằm bên trong phòng
    let midY = (s0 + s1) / 2;
    let inLeft = isPointInPoly({ x: x0 - eps, y: midY }, polyPts);
    let inRight = isPointInPoly({ x: x0 + eps, y: midY }, polyPts);

    if (inLeft && inRight) {
      pairs.push([s0, s1]);
    }
  }
  return pairs;
}

function clipPolygonWithBox(poly, xl, xr, yb, yt) {
  function clipEdge(inPts, isInside, intersect) {
    let out = [];
    if (inPts.length === 0) return out;
    let s = inPts[inPts.length - 1];
    for (let e of inPts) {
      if (isInside(e)) {
        if (isInside(s)) out.push(e);
        else { out.push(intersect(s, e)); out.push(e); }
      } else if (isInside(s)) {
        out.push(intersect(s, e));
      }
      s = e;
    }
    return out;
  }

  let p = poly;
  p = clipEdge(p, pt => pt.x >= xl, (s, e) => ({ x: xl, y: s.y + (e.y - s.y) * (xl - s.x) / (e.x - s.x + 1e-12) }));
  p = clipEdge(p, pt => pt.x <= xr, (s, e) => ({ x: xr, y: s.y + (e.y - s.y) * (xr - s.x) / (e.x - s.x + 1e-12) }));
  p = clipEdge(p, pt => pt.y >= yb, (s, e) => ({ x: s.x + (e.x - s.x) * (yb - s.y) / (e.y - s.y + 1e-12), y: yb }));
  p = clipEdge(p, pt => pt.y <= yt, (s, e) => ({ x: s.x + (e.x - s.x) * (yt - s.y) / (e.y - s.y + 1e-12), y: yt }));
  return p;
}
