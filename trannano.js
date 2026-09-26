// === MODULE: trannano/1_geometry.js ===
// ===============================================================================
//     VINACAD PLUGIN: KHUNG TRẦN THI CÔNG TẤM NANO & LAM SÓNG (TRANNANO / NAN1 / KNN1)
//     Hệ Khung Hộp Giật Cấp Chuẩn Công Trình Thực Tế (Kosmos):
//     - Khung xương cấp 2 (Hệ trần thấp viền ngoài): Khung viền tường + Khung viền mép giật cấp
//       + Các thanh sườn giằng vuông góc @450mm (<=500mm) + Ty ren M8 treo từng thanh
//     - Khung xương cấp 1 (Hệ trần cao lõi trong): Các thanh xương song song @450mm (<=500mm)
//       gióng thẳng hàng với sườn viền ngoài + Thanh giằng ngang @1000mm + Ty ren M8 neo bê tông
//     - Thành đứng giật cấp: Thanh xương chống đứng H=150mm @600mm + Khe hắt LED
//     - Tích hợp: Trần Phẳng (NAN0), Giật 1 Cấp (NAN1), Giật 2 Cấp (NAN2), Giật 3 Cấp (NAN3)
// ===============================================================================

function findEnclosingPolygon(clickPt) {
  if (typeof entities === 'undefined') return null;
  return findEnclosingPolygonFromEntities(entities, clickPt);
}

function findEnclosingPolygonFromEntities(entList, clickPt) {
  let contours = [];

  for (let e of entList) {
    if (e.type === 'RECTANGLE' && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('knn_') && !(e.id || '').startsWith('tt_')) {
      contours.push([
        { x: e.x, y: e.y },
        { x: e.x + e.w, y: e.y },
        { x: e.x + e.w, y: e.y + e.h },
        { x: e.x, y: e.y + e.h }
      ]);
    } else if ((e.type === 'POLYGON' || e.type === 'POLYLINE') && (e.points || e.pts) && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('knn_') && !(e.id || '').startsWith('tt_')) {
      let pts = (e.points || e.pts).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      if (pts.length >= 3) contours.push(pts);
    }
  }

  let lines = entList.filter(e => e.type === 'LINE' && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('knn_') && !(e.id || '').startsWith('tt_'));
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
  const SNAP_TOL = 500;

  for (let sIdx = 0; sIdx < segs.length; sIdx++) {
    if (segs[sIdx].used) continue;

    let orderedPts = [{ ...segs[sIdx].p1 }, { ...segs[sIdx].p2 }];
    segs[sIdx].used = true;
    let keepGrowing = true;

    while (keepGrowing) {
      keepGrowing = false;
      let curEnd = orderedPts[orderedPts.length - 1];

      let bestDist = SNAP_TOL;
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
        segs[bestIdx].used = true;
        if (!bestReverse) {
          orderedPts.push({ ...segs[bestIdx].p2 });
        } else {
          orderedPts.push({ ...segs[bestIdx].p1 });
        }
        keepGrowing = true;
      }
    }

    if (orderedPts.length >= 3) {
      let first = orderedPts[0];
      let last = orderedPts[orderedPts.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) < SNAP_TOL) {
        orderedPts.pop();
      }
      if (orderedPts.length >= 3) {
        loops.push(orderedPts);
      }
    }
  }

  return loops;
}

function getClosestEdge(pt, polyPts) {
  if (!polyPts || polyPts.length < 2) return null;
  let minDist = Infinity;
  let bestEdge = null;
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let d = distToSegment(pt, p1, p2);
    if (d < minDist) {
      minDist = d;
      bestEdge = { p1: { ...p1 }, p2: { ...p2 } };
    }
  }
  return bestEdge;
}

function isPointInPoly(pt, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  let x = pt.x, y = pt.y;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i].x !== undefined ? poly[i].x : poly[i][0];
    let yi = poly[i].y !== undefined ? poly[i].y : poly[i][1];
    let xj = poly[j].x !== undefined ? poly[j].x : poly[j][0];
    let yj = poly[j].y !== undefined ? poly[j].y : poly[j][1];
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(p, v, w) {
  let l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function polyArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2.0);
}

function polyPeri(pts) {
  if (!pts || pts.length < 2) return 0;
  let p = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    p += Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
  }
  return p;
}

function getBounds(polyPts) {
  return {
    minX: Math.min(...polyPts.map(point => point.x)),
    maxX: Math.max(...polyPts.map(point => point.x)),
    minY: Math.min(...polyPts.map(point => point.y)),
    maxY: Math.max(...polyPts.map(point => point.y))
  };
}

function offsetPolygonInward(polyPts, distance) {
  if (!polyPts || polyPts.length < 3) return null;
  let n = polyPts.length;

  let xs = polyPts.map(p => p.x), ys = polyPts.map(p => p.y);
  let w = Math.max(...xs) - Math.min(...xs);
  let h = Math.max(...ys) - Math.min(...ys);
  let minDim = Math.min(w, h);

  if (distance * 2 >= minDim) {
    distance = minDim * 0.25;
  }

  let insetPts = [];
  for (let i = 0; i < n; i++) {
    let pPrev = polyPts[(i - 1 + n) % n];
    let pCurr = polyPts[i];
    let pNext = polyPts[(i + 1) % n];

    let dx1 = pCurr.x - pPrev.x, dy1 = pCurr.y - pPrev.y;
    let l1 = Math.hypot(dx1, dy1) || 1;
    let nx1 = -dy1 / l1, ny1 = dx1 / l1;

    let dx2 = pNext.x - pCurr.x, dy2 = pNext.y - pCurr.y;
    let l2 = Math.hypot(dx2, dy2) || 1;
    let nx2 = -dy2 / l2, ny2 = dx2 / l2;

    let midPrevX = (pPrev.x + pCurr.x) / 2 + nx1 * 5;
    let midPrevY = (pPrev.y + pCurr.y) / 2 + ny1 * 5;
    if (!isPointInPoly({ x: midPrevX, y: midPrevY }, polyPts)) {
      nx1 = -nx1;
      ny1 = -ny1;
    }
    let midNextX = (pCurr.x + pNext.x) / 2 + nx2 * 5;
    let midNextY = (pCurr.y + pNext.y) / 2 + ny2 * 5;
    if (!isPointInPoly({ x: midNextX, y: midNextY }, polyPts)) {
      nx2 = -nx2;
      ny2 = -ny2;
    }

    let avgNx = (nx1 + nx2) / 2;
    let avgNy = (ny1 + ny2) / 2;
    let avgL = Math.hypot(avgNx, avgNy) || 1;
    let factor = 1 / Math.max(0.5, avgL);

    insetPts.push({
      x: pCurr.x + (avgNx / avgL) * distance * factor,
      y: pCurr.y + (avgNy / avgL) * distance * factor
    });
  }

  return insetPts;
}

function getHSegments(polyPts, y0, isMeter = false) {
  let xs = [];
  let probeOffset = isMeter ? 0.002 : 2;
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
    if (deduped.length === 0 || Math.abs(x - deduped[deduped.length - 1]) > (isMeter ? 0.001 : 1.0)) {
      deduped.push(x);
    }
  }
  let pairs = [];
  let minSpan = isMeter ? 0.02 : 20;
  for (let k = 0; k < deduped.length - 1; k++) {
    let s0 = deduped[k], s1 = deduped[k + 1];
    if (s1 - s0 < minSpan) continue;

    let midX = (s0 + s1) / 2;
    let inMid = isPointInPoly({ x: midX, y: y0 }, polyPts);
    let inAbove = isPointInPoly({ x: midX, y: y0 + (isMeter ? 0.005 : 5) }, polyPts);
    let inBelow = isPointInPoly({ x: midX, y: y0 - (isMeter ? 0.005 : 5) }, polyPts);

    if (inMid || (inAbove && inBelow) || inAbove || inBelow) {
      let testPoints = [
        { x: s0 * 0.75 + s1 * 0.25, y: y0 },
        { x: midX, y: y0 },
        { x: s0 * 0.25 + s1 * 0.75, y: y0 }
      ];
      let insideCount = testPoints.filter(p => isPointInPoly(p, polyPts) || isPointInPoly({ x: p.x, y: y0 + probeOffset }, polyPts) || isPointInPoly({ x: p.x, y: y0 - probeOffset }, polyPts)).length;
      if (insideCount >= 2) {
        pairs.push([s0, s1]);
      }
    }
  }
  return pairs;
}

function getVSegments(polyPts, x0, isMeter = false) {
  let ys = [];
  let probeOffset = isMeter ? 0.002 : 2;
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
    if (deduped.length === 0 || Math.abs(y - deduped[deduped.length - 1]) > (isMeter ? 0.001 : 1.0)) {
      deduped.push(y);
    }
  }
  let pairs = [];
  let minSpan = isMeter ? 0.02 : 20;
  for (let k = 0; k < deduped.length - 1; k++) {
    let s0 = deduped[k], s1 = deduped[k + 1];
    if (s1 - s0 < minSpan) continue;

    let midY = (s0 + s1) / 2;
    let inMid = isPointInPoly({ x: x0, y: midY }, polyPts);
    let inLeft = isPointInPoly({ x: x0 - (isMeter ? 0.005 : 5), y: midY }, polyPts);
    let inRight = isPointInPoly({ x: x0 + (isMeter ? 0.005 : 5), y: midY }, polyPts);

    if (inMid || (inLeft && inRight) || inLeft || inRight) {
      let testPoints = [
        { x: x0, y: s0 * 0.75 + s1 * 0.25 },
        { x: x0, y: midY },
        { x: x0, y: s0 * 0.25 + s1 * 0.75 }
      ];
      let insideCount = testPoints.filter(p => isPointInPoly(p, polyPts) || isPointInPoly({ x: x0 + probeOffset, y: p.y }, polyPts) || isPointInPoly({ x: x0 - probeOffset, y: p.y }, polyPts)).length;
      if (insideCount >= 2) {
        pairs.push([s0, s1]);
      }
    }
  }
  return pairs;
}

function getRingSegments(outerPoly, innerPoly, coordinate, horizontal, isMeter = false) {
  let outerSegments = horizontal ? getHSegments(outerPoly, coordinate, isMeter) : getVSegments(outerPoly, coordinate, isMeter);
  if (!innerPoly) return outerSegments;
  let innerSegments = horizontal ? getHSegments(innerPoly, coordinate, isMeter) : getVSegments(innerPoly, coordinate, isMeter);
  let minSpan = isMeter ? 0.02 : 20;
  let ringSegments = [];

  outerSegments.forEach(([outerStart, outerEnd]) => {
    let pieces = [[outerStart, outerEnd]];
    innerSegments.forEach(([innerStart, innerEnd]) => {
      let nextPieces = [];
      pieces.forEach(([pieceStart, pieceEnd]) => {
        if (innerEnd <= pieceStart || innerStart >= pieceEnd) {
          nextPieces.push([pieceStart, pieceEnd]);
          return;
        }
        if (innerStart > pieceStart) nextPieces.push([pieceStart, Math.min(innerStart, pieceEnd)]);
        if (innerEnd < pieceEnd) nextPieces.push([Math.max(innerEnd, pieceStart), pieceEnd]);
      });
      pieces = nextPieces;
    });
    pieces.filter(([start, end]) => end - start >= minSpan).forEach(piece => ringSegments.push(piece));
  });
  return ringSegments;
}


// === MODULE: trannano/2_algorithm.js ===
// ===============================================================================
//     KOSMOS STEPPED BOX FRAMING ENGINE (NAN1 / NAN0 / NAN2 / NAN3)
//     Cấu tạo chuẩn công trình thực tế (Kosmos):
//     - Cấp 2 (Vành trần thấp viền ngoài):
//       + Khung xương viền tường (nẹp V 3.0m)
//       + Khung xương viền mép giật cấp
//       + Các thanh sườn giằng vuông góc @450mm (<=500mm)
//       + Hàn / Bắt ty ren M8 đỡ khung xương cấp 2 neo trần bê tông
//     - Cấp 1 (Lõi trần cao ở giữa):
//       + Các thanh xương trần cao @450mm (<=500mm) gióng thẳng hàng với sườn viền
//       + Các thanh giằng ngang @1000mm
//       + Ty ren M8 neo sàn bê tông @900-1000mm
//     - Thành đứng giật cấp: Xương đứng H=150mm @600mm + Khe LED hắt
// ===============================================================================

function executeKNNAlgorithm(polyPts, edge1, edge2, options = {}) {
  if (!polyPts || polyPts.length < 3) {
    if (typeof setInfo === 'function') setInfo("❌ Không tìm thấy hình phòng khép kín.");
    return;
  }

  let opt = Object.assign({
    levelMode: (window.knnState && window.knnState.levelMode) || 'cap1',
    materialType: (window.knnState && window.knnState.materialType) || 'nano400',
    dropDepth: (window.knnState && window.knnState.dropDepth) || 150,
    tierWidth: (window.knnState && window.knnState.tierWidth) || 700, // Bề rộng vành hộp viền (600 - 800mm)
    boneSpacing: (window.knnState && window.knnState.boneSpacing) || 450, // Khoảng cách sườn <= 500mm
    hasLedSlot: (window.knnState && window.knnState.hasLedSlot) || false
  }, options);

  let xs = polyPts.map(p => p.x), ys = polyPts.map(p => p.y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  let len_raw = xmax - xmin, wid_raw = ymax - ymin;
  let isMeter = (len_raw < 60 && wid_raw < 60);
  let scaleUnit = isMeter ? 1000.0 : 1.0;
  let roomId = 'rm_knn_' + [xmin, ymin, xmax, ymax].map(value => Math.round(value / 100)).join('_');

  if (typeof entities !== 'undefined') {
    entities = entities.filter(e => !(e.id && e.id.startsWith('knn_') && e.roomId === roomId));
  }

  let realAreaM2 = isMeter ? polyArea(polyPts) : polyArea(polyPts) / 1e6;
  let realPeriM = isMeter ? polyPeri(polyPts) : polyPeri(polyPts) / 1e3;

  let boneStepCad = isMeter ? (opt.boneSpacing / 1000.0) : opt.boneSpacing;
  let tierWidthCad = isMeter ? (opt.tierWidth / 1000.0) : opt.tierWidth;

  // Hướng xương chính (theo chiều dài phòng hoặc theo cạnh mốc)
  let isVerticalMain = true; // Chạy dọc theo Y
  if (window.knnState && window.knnState.forceTopOrientation) {
    isVerticalMain = (window.knnState.forceTopOrientation === 'vertical');
  } else if (edge1) {
    let dx1 = Math.abs(edge1.p2.x - edge1.p1.x);
    let dy1 = Math.abs(edge1.p2.y - edge1.p1.y);
    isVerticalMain = (dy1 >= dx1);
  } else {
    isVerticalMain = (wid_raw >= len_raw);
  }

  // Khởi tạo các cấp giật trần
  let tiers = [];
  tiers.push({ level: 0, name: 'Cấp 2: Vành trần thấp viền ngoài', pts: polyPts, hOffset: 0 });
  let minTierArea = isMeter ? 0.01 : 100;

  if (opt.levelMode === 'cap1') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    if (inner1 && polyArea(inner1) > minTierArea) {
      tiers.push({ level: 1, name: 'Cấp 1: Lõi trần cao ở giữa (Cao hơn +150mm)', pts: inner1, hOffset: opt.dropDepth });
    }
  } else if (opt.levelMode === 'cap2') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    let inner2 = inner1 ? offsetPolygonInward(inner1, tierWidthCad * 0.8) : null;
    if (inner1 && polyArea(inner1) > minTierArea) tiers.push({ level: 1, name: 'Cấp trung gian 1', pts: inner1, hOffset: opt.dropDepth });
    if (inner2 && polyArea(inner2) > minTierArea) tiers.push({ level: 2, name: 'Cấp 2: Lõi tâm trần cao', pts: inner2, hOffset: opt.dropDepth * 2 });
  } else if (opt.levelMode === 'cap3') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    let inner2 = inner1 ? offsetPolygonInward(inner1, tierWidthCad * 0.7) : null;
    let inner3 = inner2 ? offsetPolygonInward(inner2, tierWidthCad * 0.6) : null;
    if (inner1 && polyArea(inner1) > minTierArea) tiers.push({ level: 1, name: 'Cấp 1', pts: inner1, hOffset: opt.dropDepth });
    if (inner2 && polyArea(inner2) > minTierArea) tiers.push({ level: 2, name: 'Cấp 2', pts: inner2, hOffset: opt.dropDepth * 2 });
    if (inner3 && polyArea(inner3) > minTierArea) tiers.push({ level: 3, name: 'Cấp 3: Lõi tâm trần cao', pts: inner3, hOffset: opt.dropDepth * 3 });
  }

  let newEntities = [];
  let totalCap1LengthMm = 0;
  let totalCap2RibLengthMm = 0;
  let totalVWallLengthMm = 0;
  let totalVStepLengthMm = 0;
  let totalVerticalStrutsLengthMm = 0;
  let hangerCount = 0;
  let strutCount = 0;
  let ledLengthM = 0;

  // 1. THANH VIỀN TƯỜNG ÁP TƯỜNG (4 cạnh tường ngoài - Nẹp V 3.0m)
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let segLenMm = Math.hypot(p2.x - p1.x, p2.y - p1.y) * scaleUnit;
    totalVWallLengthMm += segLenMm;

    newEntities.push({
      id: `knn_v_wall_${i}`,
      roomId: roomId,
      type: 'LINE',
      p1: [p1.x, p1.y],
      p2: [p2.x, p2.y],
      color: '#38bdf8',
      lineWidth: 3.5,
      layer: '02_NANO_NEP_V_3M',
      info: `Nẹp V viền tường 3m (${segLenMm.toFixed(0)}mm)`
    });
  }

  // 2. KHUNG VIỀN MÉP GIẬT CẤP & XƯƠNG ĐỨNG CHỐNG THÀNH HỘP
  let innerPoly = (tiers.length > 1) ? tiers[1].pts : null;
  if (innerPoly) {
    let innerPeriMm = polyPeri(innerPoly) * scaleUnit;
    totalVStepLengthMm += innerPeriMm;
    if (opt.hasLedSlot) ledLengthM += innerPeriMm / 1000.0;

    for (let i = 0, j = innerPoly.length - 1; i < innerPoly.length; j = i++) {
      let p1 = innerPoly[j], p2 = innerPoly[i];
      let edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) * scaleUnit;

      newEntities.push({
        id: `knn_drop_edge_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#0ea5e9',
        lineWidth: 3.0,
        layer: '03_NANO_VIEN_GIAT_CAP',
        info: `Khung viền mép giật cấp (${edgeLen.toFixed(0)}mm)`
      });

      if (opt.hasLedSlot) {
        newEntities.push({
          id: `knn_led_strip_${i}`,
          roomId: roomId,
          type: 'LINE',
          p1: [p1.x, p1.y],
          p2: [p2.x, p2.y],
          color: '#fde047',
          lineWidth: 1.5,
          lineDash: [6, 4],
          layer: '07_NANO_LED_STRIP',
          info: `Dải đèn LED khe hắt giật cấp`
        });
      }

      // Xương đứng chống thành hộp giật cấp @600mm
      let nStruts = Math.max(1, Math.round(edgeLen / 500.0));
      for (let s = 1; s <= nStruts; s++) {
        let sx = p1.x + (p2.x - p1.x) * (s / (nStruts + 1));
        let sy = p1.y + (p2.y - p1.y) * (s / (nStruts + 1));
        strutCount++;
        totalVerticalStrutsLengthMm += opt.dropDepth;

        let rS = isMeter ? 0.03 : 30.0;
        newEntities.push({
          id: `knn_strut_${i}_${s}`,
          roomId: roomId,
          type: 'RECTANGLE',
          x: sx - rS / 2,
          y: sy - rS / 2,
          w: rS,
          h: rS,
          color: '#e879f9',
          fillColor: 'rgba(232, 121, 249, 0.85)',
          layer: '04_NANO_XUONG_THANH_DUNG',
          info: `Thanh xương đứng chống giật cấp H=${opt.dropDepth}mm`
        });
      }
    }
  }

  // 3. TÍNH TOÁN LƯỚI TỌA ĐỘ GIÓNG THẲNG HÀNG
  // Nếu có trần giật cấp (NAN1): Giới hạn lõi trần cao innerPoly
  let coreBounds = innerPoly ? getBounds(innerPoly) : { minX: xmin, maxX: xmax, minY: ymin, maxY: ymax };
  let coreW = coreBounds.maxX - coreBounds.minX;
  let coreH = coreBounds.maxY - coreBounds.minY;

  let xGridCoords = [];
  let yGridCoords = [];

  if (isVerticalMain) {
    // Xương chính chạy dọc theo Y -> Chia lưới theo trục X
    let nCols = Math.max(1, Math.ceil(coreW / boneStepCad));
    let actualStepX = coreW / nCols;
    for (let i = 0; i <= nCols; i++) {
      xGridCoords.push(coreBounds.minX + i * actualStepX);
    }
    // Chia lưới giằng sườn ngang ở vành 2 bên
    let nRows = Math.max(1, Math.ceil(coreH / boneStepCad));
    let actualStepY = coreH / nRows;
    for (let i = 0; i <= nRows; i++) {
      yGridCoords.push(coreBounds.minY + i * actualStepY);
    }
  } else {
    // Xương chính chạy ngang theo X -> Chia lưới theo trục Y
    let nRows = Math.max(1, Math.ceil(coreH / boneStepCad));
    let actualStepY = coreH / nRows;
    for (let i = 0; i <= nRows; i++) {
      yGridCoords.push(coreBounds.minY + i * actualStepY);
    }
    let nCols = Math.max(1, Math.ceil(coreW / boneStepCad));
    let actualStepX = coreW / nCols;
    for (let i = 0; i <= nCols; i++) {
      xGridCoords.push(coreBounds.minX + i * actualStepX);
    }
  }

  // 4. KHUNG XƯƠNG CẤP 2 (VÀNH TRẦN THẤP VIỀN NGOÀI - KOSMOS RIB BARS)
  let cap2RibSegments = [];
  if (innerPoly) {
    // Sườn giằng dọc ở vành Top & Bottom
    for (let xCoord of xGridCoords) {
      let segs = getRingSegments(polyPts, innerPoly, xCoord, false, isMeter);
      for (let s of segs) {
        cap2RibSegments.push({ p1: { x: xCoord, y: s[0] }, p2: { x: xCoord, y: s[1] }, isHor: false, coord: xCoord });
      }
    }
    // Sườn giằng ngang ở vành Left & Right
    for (let yCoord of yGridCoords) {
      let segs = getRingSegments(polyPts, innerPoly, yCoord, true, isMeter);
      for (let s of segs) {
        cap2RibSegments.push({ p1: { x: s[0], y: yCoord }, p2: { x: s[1], y: yCoord }, isHor: true, coord: yCoord });
      }
    }
  }

  cap2RibSegments.forEach((seg, idx) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalCap2RibLengthMm += segLenMm;

    newEntities.push({
      id: `knn_cap2_rib_${idx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#f97316',
      lineWidth: 2.5,
      layer: '04_NANO_XUONG_SUON_CAP2',
      info: `Khung xương sườn cấp 2 (trần thấp <=500mm) - Dài: ${segLenMm.toFixed(0)}mm`
    });

    // Hàn/Bắt ty ren M8 đỡ khung xương cấp 2 (trần thấp)
    let midX = (seg.p1.x + seg.p2.x) / 2;
    let midY = (seg.p1.y + seg.p2.y) / 2;
    if (isPointInPoly({ x: midX, y: midY }, polyPts)) {
      hangerCount++;
      let rHanger = isMeter ? 0.045 : 45.0;
      newEntities.push({
        id: `knn_hanger_cap2_${idx}`,
        roomId: roomId,
        type: 'CIRCLE',
        cx: midX,
        cy: midY,
        r: rHanger,
        color: '#facc15',
        fillColor: 'rgba(250, 204, 21, 0.65)',
        layer: '06_NANO_TY_TREO',
        info: `Ty ren M8 neo sàn bê tông đỡ khung xương cấp 2 (trần thấp)`
      });
    }
  });

  // 5. KHUNG XƯƠNG CẤP 1 (LÕI TRẦN CAO Ở GIỮA - KOSMOS MAIN BEAMS)
  let cap1MainSegments = [];
  let cap1CrossSegments = [];
  let targetPolyForCap1 = innerPoly ? innerPoly : polyPts;

  if (isVerticalMain) {
    // Các thanh xương chính chạy dọc song song
    for (let xCoord of xGridCoords) {
      let segs = getVSegments(targetPolyForCap1, xCoord, isMeter);
      for (let s of segs) {
        cap1MainSegments.push({ p1: { x: xCoord, y: s[0] }, p2: { x: xCoord, y: s[1] }, isHor: false, coord: xCoord });
      }
    }
    // Các thanh giằng ngang định vị @1000mm
    let crossStepCad = isMeter ? 1.0 : 1000.0;
    let curY = coreBounds.minY + crossStepCad * 0.5;
    while (curY < coreBounds.maxY - (isMeter ? 0.05 : 50)) {
      let segs = getHSegments(targetPolyForCap1, curY, isMeter);
      for (let s of segs) {
        cap1CrossSegments.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY }, isHor: true, coord: curY });
      }
      curY += crossStepCad;
    }
  } else {
    // Các thanh xương chính chạy ngang song song
    for (let yCoord of yGridCoords) {
      let segs = getHSegments(targetPolyForCap1, yCoord, isMeter);
      for (let s of segs) {
        cap1MainSegments.push({ p1: { x: s[0], y: yCoord }, p2: { x: s[1], y: yCoord }, isHor: true, coord: yCoord });
      }
    }
    // Các thanh giằng dọc định vị @1000mm
    let crossStepCad = isMeter ? 1.0 : 1000.0;
    let curX = coreBounds.minX + crossStepCad * 0.5;
    while (curX < coreBounds.maxX - (isMeter ? 0.05 : 50)) {
      let segs = getVSegments(targetPolyForCap1, curX, isMeter);
      for (let s of segs) {
        cap1CrossSegments.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] }, isHor: false, coord: curX });
      }
      curX += crossStepCad;
    }
  }

  // Vẽ thanh xương chính trần cao
  cap1MainSegments.forEach((seg, idx) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalCap1LengthMm += segLenMm;

    newEntities.push({
      id: `knn_cap1_main_${idx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#2563eb',
      lineWidth: 3.0,
      layer: '03_NANO_XUONG_TRAN_CAO_3M6',
      info: `Khung xương cấp 1: hệ trần cao (@450 gióng sườn) - Dài: ${segLenMm.toFixed(0)}mm`
    });

    // Bố trí ty ren M8 neo sàn bê tông trên thanh xương trần cao @900-1000mm
    let nHangers = Math.max(1, Math.round(segLenMm / 900.0));
    let dx = (seg.p2.x - seg.p1.x) / (nHangers + 1);
    let dy = (seg.p2.y - seg.p1.y) / (nHangers + 1);

    for (let h = 1; h <= nHangers; h++) {
      let hx = seg.p1.x + dx * h;
      let hy = seg.p1.y + dy * h;
      if (isPointInPoly({ x: hx, y: hy }, targetPolyForCap1)) {
        hangerCount++;
        let rHanger = isMeter ? 0.045 : 45.0;
        newEntities.push({
          id: `knn_hanger_cap1_${idx}_${h}`,
          roomId: roomId,
          type: 'CIRCLE',
          cx: hx,
          cy: hy,
          r: rHanger,
          color: '#facc15',
          fillColor: 'rgba(250, 204, 21, 0.65)',
          layer: '06_NANO_TY_TREO',
          info: `Ty ren M8 neo sàn bê tông đỡ khung xương cấp 1 (trần cao)`
        });
      }
    }
  });

  // Vẽ thanh giằng ngang trần cao
  cap1CrossSegments.forEach((seg, idx) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalCap1LengthMm += segLenMm;

    newEntities.push({
      id: `knn_cap1_cross_${idx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#3b82f6',
      lineWidth: 2.0,
      layer: '03_NANO_XUONG_GIANG_NGANG',
      info: `Thanh giằng định vị trần cao (@1000mm) - Dài: ${segLenMm.toFixed(0)}mm`
    });
  });

  // 6. MÔ PHỎNG ĐƯỜNG GHÉP MẠCH TẤM NANO / LAM SÓNG
  let panelWidthMm = opt.materialType === 'lamsong' ? 210 : (opt.materialType === 'nano300' ? 300 : 400);
  let panelStepCad = isMeter ? (panelWidthMm / 1000.0) : panelWidthMm;
  let panelLines = [];

  if (isVerticalMain) {
    let curY = ymin + panelStepCad;
    while (curY < ymax) {
      let segs = getHSegments(polyPts, curY, isMeter);
      for (let s of segs) {
        panelLines.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY } });
      }
      curY += panelStepCad;
    }
  } else {
    let curX = xmin + panelStepCad;
    while (curX < xmax) {
      let segs = getVSegments(polyPts, curX, isMeter);
      for (let s of segs) {
        panelLines.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] } });
      }
      curX += panelStepCad;
    }
  }

  panelLines.forEach((pl, pIdx) => {
    newEntities.push({
      id: `knn_nano_joint_${pIdx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [pl.p1.x, pl.p1.y],
      p2: [pl.p2.x, pl.p2.y],
      color: 'rgba(6, 182, 212, 0.35)',
      lineWidth: 1,
      layer: '07_NANO_TAM_OP',
      info: `Mạch hèm khóa tấm ${opt.materialType === 'lamsong' ? 'Lam Sóng' : 'Nano'}`
    });
  });

  // 7. BẢNG DỰ TOÁN BẬT TƯ VÀ CHÚ DẪN BOM
  let bomResult = generateKNNBOMEntities({
    realAreaM2,
    realPeriM,
    totalCap1LengthMm,
    totalCap2RibLengthMm,
    totalVWallLengthMm,
    totalVStepLengthMm,
    totalVerticalStrutsLengthMm,
    hangerCount,
    strutCount,
    ledLengthM,
    opt,
    tiers,
    xmax,
    ymax,
    isMeter
  });

  bomResult.bomEntities.forEach(entity => {
    entity.roomId = roomId;
    newEntities.push(entity);
  });

  newEntities.forEach(entity => {
    if (entity.id && entity.id.startsWith('knn_')) entity.id = `${entity.id}_${roomId}`;
  });

  if (typeof entities !== 'undefined') {
    entities.push(...newEntities);
  }

  let resultSummary = {
    roomId,
    polyPts,
    innerPoly,
    edge1,
    edge2,
    tiers,
    opt,
    realAreaM2,
    realPeriM,
    isVerticalMain,
    cap1MainSegments,
    cap1CrossSegments,
    cap2RibSegments,
    xGridCoords,
    yGridCoords,
    totalCap1LengthM: totalCap1LengthMm / 1000.0,
    totalCap2RibLengthM: totalCap2RibLengthMm / 1000.0,
    totalVWallLengthM: totalVWallLengthMm / 1000.0,
    totalVStepLengthM: totalVStepLengthMm / 1000.0,
    cap1BarOrder: Math.ceil((totalCap1LengthMm / 3600.0) * 1.05),
    cap2RibBarOrder: Math.ceil((totalCap2RibLengthMm / 3600.0) * 1.05),
    vBarOrder: Math.ceil(((totalVWallLengthMm + totalVStepLengthMm) / 3000.0) * 1.05),
    strutBarOrder: Math.ceil(((totalVerticalStrutsLengthMm || 0) / 3600.0) * 1.05),
    hangerOrder: Math.ceil(hangerCount * 1.05),
    totalActualAreaM2: bomResult.totalActualAreaM2,
    totalPanelOrderM2: bomResult.totalPanelOrderM2,
    laborFactor: bomResult.laborFactor,
    laborAreaM2: bomResult.laborAreaM2,
    nanoAreaM2: Math.ceil(bomResult.totalPanelOrderM2),
    ledLengthM: Math.ceil(ledLengthM),
    timestamp: Date.now()
  };

  if (!window.knnState) window.knnState = {};
  window.knnState.lastResult = resultSummary;
  if (!Array.isArray(window.knnState.allResults)) window.knnState.allResults = [];
  window.knnState.allResults = window.knnState.allResults.filter(r => r.roomId !== roomId);
  window.knnState.allResults.push(resultSummary);

  if (typeof render === 'function') render();
  return resultSummary;
}


// === MODULE: trannano/3_bom.js ===
// ===============================================================================
//     KNN BILL OF MATERIALS (BOM) & AREA ESTIMATION ENGINE (KOSMOS)
//     Báo cáo tổng thể m2 công trình & Quy đổi diện tích tính công thợ theo hệ số sàn
// ===============================================================================

function generateKNNBOMEntities(data) {
  const {
    realAreaM2, realPeriM, totalCap1LengthMm, totalCap2RibLengthMm,
    totalVWallLengthMm, totalVStepLengthMm, totalVerticalStrutsLengthMm,
    hangerCount, strutCount, ledLengthM, opt, tiers, xmax, ymax, isMeter
  } = data;

  const bomEntities = [];

  let cap1Bars = Math.ceil((totalCap1LengthMm / 3600.0) * 1.05);
  let cap2RibBars = Math.ceil((totalCap2RibLengthMm / 3600.0) * 1.05);
  let totalVBars = Math.ceil(((totalVWallLengthMm + totalVStepLengthMm) / 3000.0) * 1.05);
  let strutBars = Math.ceil(((totalVerticalStrutsLengthMm || 0) / 3600.0) * 1.05);
  let hangers = Math.ceil(hangerCount * 1.05);

  // 1. TÍNH TOÁN CÁC DIỆN TÍCH CÔNG TRÌNH
  let verticalPanelAreaM2 = 0;
  for (let tierIndex = 1; tierIndex < tiers.length; tierIndex++) {
    let heightDeltaMm = tiers[tierIndex].hOffset - tiers[tierIndex - 1].hOffset;
    let perimeterMm = polyPeri(tiers[tierIndex].pts) * (isMeter ? 1000 : 1);
    verticalPanelAreaM2 += perimeterMm * Math.max(0, heightDeltaMm) / 1e6;
  }
  let totalActualAreaM2 = realAreaM2 + verticalPanelAreaM2; // Tổng m2 bề mặt thực tế
  let totalPanelOrderM2 = totalActualAreaM2 * 1.07; // Tổng m2 mua tấm (+7% hao hụt)

  // Hệ số tính công thợ theo mét sàn (K)
  let laborFactor = 1.00;
  if (opt.levelMode === 'cap1') laborFactor = 1.25;
  else if (opt.levelMode === 'cap2') laborFactor = 1.40;
  else if (opt.levelMode === 'cap3') laborFactor = 1.55;

  let laborAreaM2 = realAreaM2 * laborFactor; // Diện tích quy đổi tính công thợ

  let phaoChiM = (realPeriM * 1.05).toFixed(1);
  let keInoxHop = Math.max(1, Math.ceil(realAreaM2 * 4 / 100));
  let panelWidthMm = opt.materialType === 'lamsong' ? 210 : (opt.materialType === 'nano300' ? 300 : 400);
  let panelLengthMm = 3000;
  let panelAreaM2 = panelWidthMm * panelLengthMm / 1e6;
  let panelCount = Math.max(1, Math.ceil(totalPanelOrderM2 / panelAreaM2));

  let tabX = xmax + (isMeter ? 1.5 : 1500);
  let tabY = ymax;
  let tabW = isMeter ? 9.2 : 9200; // Mở rộng bảng để không bị đè chữ
  let rh = isMeter ? 0.48 : 480;
  let th = isMeter ? 0.85 : 850; // Header 2 tầng

  let levelName = opt.levelMode === 'cap0' ? 'Trần Phẳng' : (opt.levelMode === 'cap1' ? 'Giật 1 Cấp' : (opt.levelMode === 'cap2' ? 'Giật 2 Cấp' : 'Giật 3 Cấp'));
  let matName = opt.materialType === 'lamsong' ? 'Tấm Lam Sóng 210mm x 3m' : (opt.materialType === 'nano300' ? 'Tấm Nano 300mm x 3m' : 'Tấm Nano 400mm x 3m');

  const bomRows = [
    { stt: "1", name: `${matName} (${levelName})`, unit: "tấm", qty: `${panelCount}`, note: `${panelAreaM2.toFixed(2)}m²/tấm | Tổng ${totalPanelOrderM2.toFixed(1)}m² tấm (gồm +7% hao hụt)`, color: '#06b6d4', icon: '■' },
    { stt: "2", name: "Khung xương CẤP 1: Hệ trần cao (Cây U 3.6m)", unit: "cây", qty: `${cap1Bars}`, note: `Xương trần cao @450mm + giằng @1000mm (${(totalCap1LengthMm / 1000).toFixed(1)}m)`, color: '#2563eb', icon: '━' },
    { stt: "3", name: "Khung xương CẤP 2: Hệ trần thấp (Cây U 3.6m)", unit: "cây", qty: `${cap2RibBars || 1}`, note: `Sườn giằng vành hộp viền @450mm (${(totalCap2RibLengthMm / 1000).toFixed(1)}m)`, color: '#f97316', icon: '━' },
    { stt: "4", name: "Thanh viền tường & viền giật cấp (Nẹp V 3.0m)", unit: "cây", qty: `${totalVBars}`, note: `Viền 4 bức tường và mép giật cấp (${((totalVWallLengthMm + totalVStepLengthMm) / 1000).toFixed(1)}m)`, color: '#38bdf8', icon: '━' },
    { stt: "5", name: "Thanh xương ĐỨNG chống giật cấp H=150mm", unit: "cây", qty: `${strutBars || 1}`, note: `${strutCount} vị trí chống thành đứng giật cấp @500mm`, color: '#e879f9', icon: '┃' },
    { stt: "6", name: "Bộ Ty treo ren M8 + Tăng đơ (Cấp 1 & Cấp 2)", unit: "bộ", qty: `${hangers}`, note: "Neo trực tiếp từ trần bê tông vào khung xương cấp 1 & cấp 2", color: '#facc15', icon: '◎' },
    { stt: "7", name: "Ke Inox khóa hèm + Vít tự khoan bắn tấm", unit: "hộp", qty: `${keInoxHop}`, note: "Ke giấu vít bắn vào xương gánh đáy", color: '#a855f7', icon: '◆' },
    { stt: "8", name: "Phào cổ trần viền chân tường (Cây 3.0m)", unit: "mét", qty: `${phaoChiM}`, note: `Che góc tiếp giáp giữa trần và tường (Chu vi ${realPeriM.toFixed(1)}m)`, color: '#f59e0b', icon: '━' }
  ];

  if (opt.hasLedSlot && ledLengthM > 0) {
    bomRows.push({
      stt: "9",
      name: "Dải đèn LED dây hắt sáng 3000K/4000K",
      unit: "mét",
      qty: `${Math.ceil(ledLengthM)}`,
      note: `Khe hắt LED âm viền mép giật cấp (${ledLengthM.toFixed(1)}m)`,
      color: '#fde047',
      icon: '💡'
    });
  }

  // 2 HÀNG TỔNG HỢP DIỆN TÍCH CÔNG TRÌNH & TÍNH CÔNG THỢ
  bomRows.push({
    stt: "★",
    name: "TỔNG DIỆN TÍCH BỀ MẶT THỰC TẾ (Sàn + Mặt đứng)",
    unit: "m²",
    qty: `${totalActualAreaM2.toFixed(1)}`,
    note: `Mặt bằng sàn: ${realAreaM2.toFixed(1)}m² + Mặt đứng giật cấp: ${verticalPanelAreaM2.toFixed(1)}m²`,
    color: '#38bdf8',
    icon: '📐'
  });

  bomRows.push({
    stt: "⭐",
    name: `DIỆN TÍCH TÍNH TIỀN CÔNG THỢ (Hệ số K=${laborFactor} x Sàn)`,
    unit: "m²",
    qty: `${laborAreaM2.toFixed(1)}`,
    note: `Quy đổi chuẩn thợ thi công: Sàn ${realAreaM2.toFixed(1)}m² x Hệ số giật cấp ${laborFactor}`,
    color: '#facc15',
    icon: '💰'
  });

  let totH = th + bomRows.length * rh;
  let fTitle = isMeter ? 0.21 : 210;
  let fSubTitle = isMeter ? 0.125 : 125;
  let fBody = isMeter ? 0.135 : 135;
  let fSub = isMeter ? 0.11 : 110;
  let fIcon = isMeter ? 0.16 : 160;

  // Header và bảng
  bomEntities.push({ id: 'knn_tb_1', type: 'RECTANGLE', x: tabX, y: tabY - totH, w: tabW, h: totH, color: '#38bdf8', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_tb_2', type: 'RECTANGLE', x: tabX, y: tabY - th, w: tabW, h: th, color: '#38bdf8', fillColor: 'rgba(56, 189, 248, 0.25)', layer: 'BOM_TABLE' });
  
  // Dòng 1 Header: Tên bảng
  bomEntities.push({
    id: 'knn_tb_tt',
    type: 'TEXT',
    x: tabX + tabW / 2,
    y: tabY - (isMeter ? 0.32 : 320),
    text: `BẢNG DỰ TOÁN & TỔNG THỂ KHỐI LƯỢNG TRẦN NANO (${levelName.toUpperCase()})`,
    size: fTitle,
    color: '#38bdf8',
    align: 'center',
    layer: 'BOM_TABLE'
  });

  // Dòng 2 Header: Tóm tắt 4 chỉ số diện tích công trình
  bomEntities.push({
    id: 'knn_tb_sub_tt',
    type: 'TEXT',
    x: tabX + tabW / 2,
    y: tabY - (isMeter ? 0.65 : 650),
    text: `📐 SÀN: ${realAreaM2.toFixed(1)}m²  |  MẶT ĐỨNG: ${verticalPanelAreaM2.toFixed(1)}m²  |  TỔNG TẤM (+7%): ${totalPanelOrderM2.toFixed(1)}m² (${panelCount} tấm)  |  CÔNG THỢ (K=${laborFactor}): ${laborAreaM2.toFixed(1)}m²`,
    size: fSubTitle,
    color: '#facc15',
    align: 'center',
    layer: 'BOM_TABLE'
  });

  // Các cột tọa độ chuẩn không đè chữ:
  // Cột STT: tabX + 250 (center)
  // Cột Icon: tabX + 550 (center)
  // Cột Tên: tabX + 800 (left)
  // Cột ĐVT: tabX + 4700 (center)
  // Cột Số lượng: tabX + 5400 (center)
  // Cột Ghi chú: tabX + 6000 (left)
  for (let i = 0; i < bomRows.length; i++) {
    let ry = tabY - th - (i + 1) * rh;
    let item = bomRows[i];

    // Nền highlight cho 2 dòng tổng kết diện tích
    if (item.stt === '★' || item.stt === '⭐') {
      bomEntities.push({
        id: `knn_tb_bg_${i}`,
        type: 'RECTANGLE',
        x: tabX,
        y: ry,
        w: tabW,
        h: rh,
        color: item.color,
        fillColor: item.stt === '⭐' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(56, 189, 248, 0.15)',
        layer: 'BOM_TABLE'
      });
    }

    bomEntities.push({ id: `knn_tb_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_s_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.25 : 250), y: ry + rh / 2, text: item.stt, size: fSub, color: item.color || '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.55 : 550), y: ry + rh / 2, text: item.icon, size: fIcon, color: item.color, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_n_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.80 : 800), y: ry + rh / 2, text: item.name, size: fBody, color: item.color, align: 'left', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_u_${i}`, type: 'TEXT', x: tabX + (isMeter ? 4.70 : 4700), y: ry + rh / 2, text: item.unit, size: fBody, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_q_${i}`, type: 'TEXT', x: tabX + (isMeter ? 5.40 : 5400), y: ry + rh / 2, text: item.qty, size: fBody, color: '#4ade80', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_g_${i}`, type: 'TEXT', x: tabX + (isMeter ? 6.00 : 6000), y: ry + rh / 2, text: item.note, size: fSub, color: item.stt === '⭐' ? '#fde047' : '#cbd5e1', align: 'left', layer: 'BOM_TABLE' });
  }

  // BẢNG CHÚ DẪN CẤU TẠO & HỆ SỐ CÔNG THỢ
  let legY = tabY - totH - (isMeter ? 0.4 : 400);
  let legRows = 6;
  let legH = th + legRows * rh;
  bomEntities.push({ id: 'knn_leg_1', type: 'RECTANGLE', x: tabX, y: legY - legH, w: tabW, h: legH, color: '#facc15', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_leg_2', type: 'RECTANGLE', x: tabX, y: legY - th, w: tabW, h: th, color: '#facc15', fillColor: 'rgba(250, 204, 21, 0.22)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_leg_tt', type: 'TEXT', x: tabX + tabW / 2, y: legY - th / 2, text: `CHÚ DẪN CẤU TẠO KHUNG HỘP TRẦN NANO KOSMOS & HỆ SỐ CÔNG THỢ`, size: fTitle, color: '#facc15', align: 'center', layer: 'BOM_TABLE' });

  const legends = [
    { ic: "━", col: "#2563eb", t: "Khung xương CẤP 1 (Xanh dương): Hệ trần cao @450mm gióng thẳng hàng sườn viền" },
    { ic: "━", col: "#f97316", t: "Khung xương CẤP 2 (Cam): Hệ trần thấp viền ngoài, sườn giằng vuông góc @450mm" },
    { ic: "━", col: "#38bdf8", t: "Thanh viền tường & viền mép giật cấp (Cyan): Nẹp V 3.0m chạy bao quanh" },
    { ic: "┃", col: "#e879f9", t: "Thanh xương ĐỨNG (Tím): Giằng chống thành đứng giật cấp H=150mm @500mm" },
    { ic: "◎", col: "#facc15", t: "Bộ Ty treo ren M8 (Vàng): Hàn/bắt neo từ trần bê tông vào khung cấp 1 & cấp 2" },
    { ic: "⭐", col: "#facc15", t: `Hệ số công thợ: Trần phẳng K=1.0 | Giật 1 cấp K=1.25 | Giật 2 cấp K=1.40 | Giật 3 cấp K=1.55 x Sàn` }
  ];

  for (let i = 0; i < legends.length; i++) {
    let ry = legY - th - (i + 1) * rh;
    let item = legends[i];
    bomEntities.push({ id: `knn_leg_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_leg_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.35 : 350), y: ry + rh / 2, text: item.ic, size: fIcon, color: item.col, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_leg_tx_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.75 : 750), y: ry + rh / 2, text: item.t, size: fSub, color: '#e2e8f0', align: 'left', layer: 'BOM_TABLE' });
  }

  return {
    bomEntities, tabX, tabY, tabW,
    totalActualAreaM2, totalPanelOrderM2, laborFactor, laborAreaM2
  };
}

// === MODULE: trannano/4_ui_toolbar.js ===
// ===============================================================================
//     KNN FLOATING CONTROLLER TOOLBAR
// ===============================================================================

function ensureKNNFloatingUI() {
  let oldBar = document.getElementById('knn-floating-bar');
  if (oldBar) oldBar.remove();

  let bar = document.createElement('div');
  bar.id = 'knn-floating-bar';
  bar.style.position = 'absolute';
  bar.style.top = '52px';
  bar.style.left = '50%';
  bar.style.transform = 'translateX(-50%)';
  bar.style.zIndex = '999';
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  bar.style.gap = '6px';
  bar.style.background = 'rgba(15, 23, 42, 0.96)';
  bar.style.padding = '6px 14px';
  bar.style.borderRadius = '22px';
  bar.style.border = '1.5px solid #06b6d4';
  bar.style.boxShadow = '0 8px 28px rgba(0,0,0,0.65)';
  bar.style.backdropFilter = 'blur(12px)';
  bar.style.maxWidth = '96vw';
  bar.style.flexWrap = 'nowrap';
  bar.style.whiteSpace = 'nowrap';

  const isStep2 = (!window.knnState || window.knnState.step === 2);
  let curLevel = (window.knnState && window.knnState.levelMode) || 'cap1';
  let curMat = (window.knnState && window.knnState.materialType) || 'nano400';
  let curTierWidth = (window.knnState && window.knnState.tierWidth) || 700;

  if (isStep2) {
    bar.innerHTML = `
      <span style="color:#06b6d4; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:2px;">
        🏛️ KHUNG HỘP NANO:
      </span>

      <select id="knn-sel-level" onchange="window.setKNNLevelMode(this.value)" style="font-size:11px; font-weight:bold; color:#facc15; background:#1e293b; border:1px solid #06b6d4; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="cap0" ${curLevel === 'cap0' ? 'selected' : ''}>Trần Phẳng (NAN0)</option>
        <option value="cap1" ${curLevel === 'cap1' ? 'selected' : ''}>Giật 1 Cấp (NAN1)</option>
        <option value="cap2" ${curLevel === 'cap2' ? 'selected' : ''}>Giật 2 Cấp (NAN2)</option>
        <option value="cap3" ${curLevel === 'cap3' ? 'selected' : ''}>Giật 3 Cấp (NAN3)</option>
      </select>

      <select id="knn-sel-mat" onchange="window.setKNNMaterial(this.value)" style="font-size:11px; font-weight:bold; color:#38bdf8; background:#1e293b; border:1px solid #475569; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="nano400" ${curMat === 'nano400' ? 'selected' : ''}>Tấm Nano 400 (Sườn @450)</option>
        <option value="nano300" ${curMat === 'nano300' ? 'selected' : ''}>Tấm Nano 300 (Sườn @400)</option>
        <option value="lamsong" ${curMat === 'lamsong' ? 'selected' : ''}>Tấm Lam Sóng (Sườn @350)</option>
      </select>

      <select id="knn-sel-tier" onchange="window.setKNNTierWidth(this.value)" title="Bề rộng vành hộp viền" style="font-size:11px; font-weight:bold; color:#f97316; background:#1e293b; border:1px solid #f97316; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="600" ${curTierWidth === 600 ? 'selected' : ''}>Hộp 600mm</option>
        <option value="700" ${curTierWidth === 700 ? 'selected' : ''}>Hộp 700mm</option>
        <option value="800" ${curTierWidth === 800 ? 'selected' : ''}>Hộp 800mm</option>
        <option value="1000" ${curTierWidth === 1000 ? 'selected' : ''}>Hộp 1000mm</option>
      </select>

      <button onclick="window.toggleKNNUDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Đổi hướng xương chính (Dọc / Ngang)">
        🔄 Đổi Hướng Xương
      </button>

      <button onclick="window.executeKNNFromSelectionOrCanvas()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Bắt đầu tính toán và tạo khung (Phím Enter)">
        🚀 TÍNH KHUNG & VẼ (Enter)
      </button>

      <button onclick="document.getElementById('knn-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;">
        ✕
      </button>
    `;
  } else {
    bar.innerHTML = `
      <span style="color:#4ade80; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:2px;">
        ✅ ĐÃ TẠO KHUNG TRẦN NANO:
      </span>
      <button onclick="window.c_RAPTAM()" class="btn btn-highlight" style="font-size:11px; padding:3px 11px; background:#f59e0b; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Copy ra bản vẽ mới và ráp tấm Nano 400x3000mm hoàn thiện kèm đèn trang trí">
        🎨 Ráp Tấm Hoàn Thiện (RAPTAM)
      </button>
      <button onclick="window.c_PHUKIENNN()" class="btn" style="font-size:11px; padding:3px 9px; background:#8b5cf6; color:#fff; font-weight:bold; border-radius:12px; cursor:pointer;" title="Mở thư viện gắn / xóa phụ kiện đèn, mâm trần, hoa góc">
        🛍️ Phụ Kiện (phukiennn)
      </button>
      <button onclick="window.openKNN3DModal()" class="btn btn-accent" style="font-size:11px; padding:3px 9px; background:#0284c7; color:#fff; font-weight:bold; border-radius:12px; cursor:pointer;">
        📦 3D Phối Cảnh
      </button>
      <button onclick="window.openKNNSectionModal()" class="btn btn-accent" style="font-size:11px; padding:3px 9px; background:#7c3aed; color:#fff; font-weight:bold; border-radius:12px; cursor:pointer;">
        🔍 Mặt Cắt 2D
      </button>
      <button onclick="window.initKNNTool()" class="btn" style="font-size:11px; padding:3px 8px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;">
        🔄 Chọn Phòng Khác
      </button>
      <button onclick="document.getElementById('knn-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;">
        ✕
      </button>
    `;
  }

  document.body.appendChild(bar);
}

window.setKNNLevelMode = function(val) {
  if (!window.knnState) window.knnState = {};
  window.knnState.levelMode = val;
  if (window.knnState.step === 3 && window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
  }
};

window.setKNNMaterial = function(val) {
  if (!window.knnState) window.knnState = {};
  window.knnState.materialType = val;
  window.knnState.boneSpacing = (val === 'lamsong' ? 350 : (val === 'nano300' ? 400 : 450));
  if (window.knnState.step === 3 && window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
  }
};

window.setKNNTierWidth = function(val) {
  if (!window.knnState) window.knnState = {};
  window.knnState.tierWidth = parseFloat(val) || 700;
  if (window.knnState.step === 3 && window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
  }
};

window.toggleKNNUDirection = function() {
  if (!window.knnState) window.knnState = {};
  let current = window.knnState.forceTopOrientation || (window.knnState.lastResult && window.knnState.lastResult.isVerticalMain ? 'vertical' : 'horizontal');
  window.knnState.forceTopOrientation = (current === 'vertical' ? 'horizontal' : 'vertical');
  if (window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
    ensureKNNFloatingUI();
  }
};


// ===============================================================================
//     GLOBAL ACCESSORY QUICK-EDIT INSPECTOR (TỰ ĐỘNG HIỆN KHI CHỌN PHỤ KIỆN)
// ===============================================================================

function ensureAccessoryQuickInspector() {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('knn-acc-quick-inspector')) return;

  let widget = document.createElement('div');
  widget.id = 'knn-acc-quick-inspector';
  widget.style.position = 'fixed';
  widget.style.top = '60px';
  widget.style.right = '20px';
  widget.style.width = '380px';
  widget.style.zIndex = '99999';
  widget.style.background = 'rgba(15, 23, 42, 0.98)';
  widget.style.border = '2px solid #38bdf8';
  widget.style.borderRadius = '14px';
  widget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.85)';
  widget.style.backdropFilter = 'blur(12px)';
  widget.style.fontFamily = 'Arial, sans-serif';
  widget.style.color = '#e2e8f0';
  widget.style.padding = '0';
  widget.style.overflow = 'hidden';
  widget.style.display = 'none'; // Chỉ hiện khi có phụ kiện được chọn

  widget.innerHTML = `
    <div id="knn-acc-qi-header" style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:#1e293b; border-bottom:1.5px solid #0284c7; cursor:move; user-select:none;">
      <div style="font-weight:bold; font-size:12px; color:#38bdf8; display:flex; align-items:center; gap:6px;">
        🎛️ ĐIỀU CHỈNH KÍCH THƯỚC PHỤ KIỆN
      </div>
      <button onclick="document.getElementById('knn-acc-quick-inspector').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer; font-weight:bold;">✕</button>
    </div>

    <div style="padding:10px 12px; background:#0f172a;">
      <div style="font-size:11px; color:#fde047; font-weight:bold; margin-bottom:8px; display:flex; justify-content:space-between;" id="knn-qi-acc-name">
        <span>Đang chọn: Hộp Đèn Downlight</span>
        <span id="knn-qi-acc-count" style="color:#38bdf8;">1 chi tiết</span>
      </div>

      <!-- KÍCH THƯỚC RỘNG x DÀI -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <!-- Rộng (W) -->
        <div style="background:#1e293b; padding:6px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:3px;">
            <span>Rộng (W):</span>
            <span id="knn-qi-w-val" style="color:#38bdf8; font-weight:bold;">180 mm</span>
          </div>
          <div style="display:flex; align-items:center; gap:3px;">
            <input type="number" id="knn-qi-input-w" value="180" step="10" min="10" max="6000" oninput="window.onInspectorDimensionChange('W', this.value)" style="flex:1; width:50px; background:#0f172a; border:1px solid #475569; color:#fff; padding:3px 5px; border-radius:4px; font-size:11px; font-weight:bold;" />
            <button onclick="window.onInspectorAdjust('W', -20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:10px;">-20</button>
            <button onclick="window.onInspectorAdjust('W', +20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:10px;">+20</button>
            <button onclick="window.onInspectorAdjust('W', +50)" style="padding:2px 5px; background:#334155; color:#38bdf8; border:none; border-radius:3px; cursor:pointer; font-size:10px;">+50</button>
          </div>
        </div>

        <!-- Dài (H) -->
        <div style="background:#1e293b; padding:6px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:3px;">
            <span>Dài (H):</span>
            <span id="knn-qi-h-val" style="color:#38bdf8; font-weight:bold;">180 mm</span>
          </div>
          <div style="display:flex; align-items:center; gap:3px;">
            <input type="number" id="knn-qi-input-h" value="180" step="10" min="10" max="6000" oninput="window.onInspectorDimensionChange('H', this.value)" style="flex:1; width:50px; background:#0f172a; border:1px solid #475569; color:#fff; padding:3px 5px; border-radius:4px; font-size:11px; font-weight:bold;" />
            <button onclick="window.onInspectorAdjust('H', -20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:10px;">-20</button>
            <button onclick="window.onInspectorAdjust('H', +20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:10px;">+20</button>
            <button onclick="window.onInspectorAdjust('H', +50)" style="padding:2px 5px; background:#334155; color:#38bdf8; border:none; border-radius:3px; cursor:pointer; font-size:10px;">+50</button>
          </div>
        </div>
      </div>

      <!-- XOAY GÓC & TỈ LỆ SCALE -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <div style="background:#1e293b; padding:5px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:2px;">
            <span>Góc Xoay:</span>
            <span id="knn-qi-rot-val" style="color:#facc15; font-weight:bold;">0°</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="range" id="knn-qi-slider-rot" min="0" max="360" step="15" value="0" oninput="window.onInspectorRotate(this.value)" style="flex:1; cursor:pointer;" />
            <button onclick="window.onInspectorRotateBy(45)" style="padding:2px 5px; background:#334155; color:#38bdf8; border:none; border-radius:3px; cursor:pointer; font-size:10px;">🔄45°</button>
          </div>
        </div>

        <div style="background:#1e293b; padding:5px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:2px;">
            <span>Tỉ Lệ:</span>
            <span id="knn-qi-scale-val" style="color:#38bdf8; font-weight:bold;">100%</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="range" id="knn-qi-slider-scale" min="30" max="300" step="5" value="100" oninput="window.onInspectorScale(this.value)" style="flex:1; cursor:pointer;" />
            <button onclick="window.onInspectorScale(100)" style="padding:2px 5px; background:#334155; color:#cbd5e1; border:none; border-radius:3px; cursor:pointer; font-size:10px;">100%</button>
          </div>
        </div>
      </div>

      <!-- KÍCH THƯỚC NHANH PRESETS -->
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px; align-items:center;">
        <span style="color:#64748b; font-size:10px;">Đặt nhanh:</span>
        <button onclick="window.onInspectorSetQuick(150, 150)" style="padding:2px 5px; font-size:10px; background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:3px; cursor:pointer;">150x150</button>
        <button onclick="window.onInspectorSetQuick(180, 180)" style="padding:2px 5px; font-size:10px; background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:3px; cursor:pointer;">180x180</button>
        <button onclick="window.onInspectorSetQuick(320, 180)" style="padding:2px 5px; font-size:10px; background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:3px; cursor:pointer;">320x180 (Đôi)</button>
        <button onclick="window.onInspectorSetQuick(600, 600)" style="padding:2px 5px; font-size:10px; background:#1e293b; color:#cbd5e1; border:1px solid #334155; border-radius:3px; cursor:pointer;">600x600 (Mâm)</button>
      </div>

      <!-- NÚT THAO TÁC DI CHUYỂN, NHÂN BẢN, XÓA -->
      <div style="display:flex; gap:4px; flex-wrap:wrap; padding-top:6px; border-top:1px solid #334155;">
        <button onclick="window.groupAndLockSelectedAccessories()" style="flex:1; padding:4px 6px; font-size:10px; font-weight:bold; background:#7c3aed; color:#fff; border:none; border-radius:4px; cursor:pointer;">🔒 Khóa Nhóm</button>
        <button onclick="window.startMoveSelectedAccessories()" style="flex:1; padding:4px 6px; font-size:10px; font-weight:bold; background:#059669; color:#fff; border:none; border-radius:4px; cursor:pointer;">🚚 Dời Vị Trí</button>
        <button onclick="window.duplicateSelectedAccessories()" style="padding:4px 6px; font-size:10px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer;">📋 Nhân Bản</button>
        <button onclick="window.deleteSelectedAccessories()" style="padding:4px 6px; font-size:10px; font-weight:bold; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;">🗑️ Xóa</button>
        <button onclick="window.openPhuKienPalette()" style="padding:4px 6px; font-size:10px; background:#334155; color:#38bdf8; border:none; border-radius:4px; cursor:pointer;">🛍️ Thư Viện</button>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
  makeDraggable(widget, document.getElementById('knn-acc-qi-header'));
}

// Global selection polling & monitoring
setInterval(function() {
  if (typeof selectedIds === 'undefined' || !selectedIds || typeof entities === 'undefined') return;

  // Lấy danh sách các accessory được chọn
  let accEnts = [];
  selectedIds.forEach(id => {
    let e = entities.find(ent => ent.id === id);
    if (e && (id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_'))) {
      accEnts.push(e);
    }
  });

  let inspector = document.getElementById('knn-acc-quick-inspector');
  if (!inspector) {
    ensureAccessoryQuickInspector();
    inspector = document.getElementById('knn-acc-quick-inspector');
  }
  if (!inspector) return;

  if (accEnts.length > 0) {
    inspector.style.display = 'block';

    // Cập nhật selectedIds vào knnPhuKienState
    if (!window.knnPhuKienState) window.knnPhuKienState = {};
    if (!window.knnPhuKienState.selectedIds) window.knnPhuKienState.selectedIds = new Set();
    accEnts.forEach(e => window.knnPhuKienState.selectedIds.add(e.id));

    let mainEnt = accEnts[0];
    let nameSpan = document.getElementById('knn-qi-acc-name');
    let countSpan = document.getElementById('knn-qi-acc-count');
    if (nameSpan) nameSpan.firstElementChild.innerText = `Đang chọn: ${mainEnt.accName || mainEnt.info || 'Phụ kiện trần'}`;
    if (countSpan) countSpan.innerText = `${accEnts.length} chi tiết`;

    let unitInfo = detectDrawingUnitInfo();
    let scaleUnit = unitInfo.scale;

    // Load W, H vào input nếu chưa được user focus
    let inW = document.getElementById('knn-qi-input-w');
    let inH = document.getElementById('knn-qi-input-h');
    let lblW = document.getElementById('knn-qi-w-val');
    let lblH = document.getElementById('knn-qi-h-val');
    let slRot = document.getElementById('knn-qi-slider-rot');
    let valRot = document.getElementById('knn-qi-rot-val');

    let curW = mainEnt.rawW || (mainEnt.w ? mainEnt.w / scaleUnit : 180);
    let curH = mainEnt.rawH || (mainEnt.h ? mainEnt.h / scaleUnit : 180);
    let curRot = mainEnt.rotDeg || 0;

    if (inW && document.activeElement !== inW) inW.value = Math.round(curW);
    if (inH && document.activeElement !== inH) inH.value = Math.round(curH);
    if (lblW) lblW.innerText = `${Math.round(curW)} mm`;
    if (lblH) lblH.innerText = `${Math.round(curH)} mm`;
    if (slRot && document.activeElement !== slRot) slRot.value = curRot;
    if (valRot) valRot.innerText = `${curRot}°`;

    window.knnPhuKienState.selectedGroupPrefix = mainEnt.groupId || (mainEnt.id ? (mainEnt.id.match(/^(pk_[^_]+_\d+_\d+)/) || [mainEnt.id])[0] : mainEnt.id);
  } else {
    // Nếu không có accessory nào được chọn và không mở bảng chính thì ẩn
    if (!window.knnPhuKienState || !window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) {
      if (inspector.style.display !== 'none' && !document.getElementById('knn-phukien-palette')) {
        inspector.style.display = 'none';
      }
    }
  }
}, 300);

// Xử lý thay đổi kích thước từ Quick Inspector
window.onInspectorDimensionChange = function(dim, val) {
  let num = Math.max(10, parseFloat(val) || 180);
  if (dim === 'W') {
    window.knnPhuKienState.customW = num;
    let lbl = document.getElementById('knn-qi-w-val');
    if (lbl) lbl.innerText = `${Math.round(num)} mm`;
  } else {
    window.knnPhuKienState.customH = num;
    let lbl = document.getElementById('knn-qi-h-val');
    if (lbl) lbl.innerText = `${Math.round(num)} mm`;
  }
  applyTransformToSelectedCeilingAccessory();
};

window.onInspectorAdjust = function(dim, delta) {
  if (dim === 'W') {
    let inW = document.getElementById('knn-qi-input-w');
    let newW = Math.max(10, Math.round((window.knnPhuKienState.customW || 180) + delta));
    window.knnPhuKienState.customW = newW;
    if (inW) inW.value = newW;
    window.onInspectorDimensionChange('W', newW);
  } else {
    let inH = document.getElementById('knn-qi-input-h');
    let newH = Math.max(10, Math.round((window.knnPhuKienState.customH || 180) + delta));
    window.knnPhuKienState.customH = newH;
    if (inH) inH.value = newH;
    window.onInspectorDimensionChange('H', newH);
  }
};

window.onInspectorRotate = function(deg) {
  let val = ((parseInt(deg) || 0) % 360 + 360) % 360;
  window.knnPhuKienState.rotationDeg = val;
  let lbl = document.getElementById('knn-qi-rot-val');
  if (lbl) lbl.innerText = `${val}°`;
  applyTransformToSelectedCeilingAccessory();
};

window.onInspectorRotateBy = function(deltaDeg) {
  let newDeg = ((window.knnPhuKienState.rotationDeg || 0) + deltaDeg) % 360;
  let sl = document.getElementById('knn-qi-slider-rot');
  if (sl) sl.value = newDeg;
  window.onInspectorRotate(newDeg);
};

window.onInspectorScale = function(percent) {
  window.knnPhuKienState.scalePercent = Math.max(20, Math.min(500, parseInt(percent) || 100));
  let lbl = document.getElementById('knn-qi-scale-val');
  if (lbl) lbl.innerText = `${window.knnPhuKienState.scalePercent}%`;
  applyTransformToSelectedCeilingAccessory();
};

window.onInspectorSetQuick = function(w, h) {
  window.knnPhuKienState.customW = w;
  window.knnPhuKienState.customH = h;
  window.knnPhuKienState.scalePercent = 100;
  let inW = document.getElementById('knn-qi-input-w');
  let inH = document.getElementById('knn-qi-input-h');
  let slScale = document.getElementById('knn-qi-slider-scale');
  if (inW) inW.value = w;
  if (inH) inH.value = h;
  if (slScale) slScale.value = 100;
  let lblW = document.getElementById('knn-qi-w-val');
  let lblH = document.getElementById('knn-qi-h-val');
  let lblScale = document.getElementById('knn-qi-scale-val');
  if (lblW) lblW.innerText = `${w} mm`;
  if (lblH) lblH.innerText = `${h} mm`;
  if (lblScale) lblScale.innerText = '100%';
  applyTransformToSelectedCeilingAccessory();
  if (typeof setInfo === 'function') {
    setInfo(`📏 Đã đặt kích thước: ${w} x ${h} mm.`);
  }
};

function ensureKNNCommandGuide() {
  if (typeof document === 'undefined' || !document.body) return;
  let oldGuide = document.getElementById('knn-command-guide');
  if (oldGuide) oldGuide.remove();
  let oldTab = document.getElementById('knn-command-guide-tab');
  if (oldTab) oldTab.remove();

  let commandGuide = document.createElement('div');
  commandGuide.id = 'knn-command-guide';
  commandGuide.style.cssText = 'position:fixed;left:12px;top:110px;z-index:3000;width:320px;max-width:calc(100vw - 24px);font-family:Arial,sans-serif;color:#e2e8f0;background:rgba(15,23,42,.98);border:1px solid #06b6d4;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:12px;overflow:hidden;';

  let commandHelp = {
    phukiennn: ['Mở bảng phụ kiện trần Nano.', 'Chọn hoặc kéo thả đèn, mâm hoa, hoa góc vào trần.', 'Bật gôm xóa để xóa phụ kiện trên trần.'],
    RAPTAM: ['Ráp tấm Nano hoàn thiện 400x3000mm.', 'Quét chọn khung trần vừa vẽ rồi nhấn Enter.', 'Tự động copy sang vị trí mới và ráp tấm, đèn Downlight, phào chỉ.'],
    NAN1: ['Dựng trần giật 1 cấp chuẩn Kosmos.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN0: ['Dựng trần phẳng.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN2: ['Dựng trần giật 2 cấp.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN3: ['Dựng trần giật 3 cấp.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    KNN1: ['Lệnh tổng quát khung trần Nano.', 'Quét chọn phòng, nhấn Enter chọn thông số và hoàn tất.'],
    TRANLAMSONG: ['Dựng khung trần bắn tấm Lam Sóng.'],
    N3D: ['Mở phối cảnh 3D khung trần Nano.', 'Quét chọn khung trần cần xem rồi nhấn Enter.'],
    NSEC: ['Mở mặt cắt kỹ thuật 2D cấu tạo giật cấp.']
  };
  let commandNames = Object.keys(commandHelp);

  commandGuide.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:rgba(14,116,144,.32);">
      <strong style="color:#facc15;white-space:nowrap;">🏛️ LỆNH KHUNG NANO</strong>
      <button id="knn-command-guide-hide" style="margin-left:auto;background:#334155;border:1px solid #64748b;color:#e2e8f0;border-radius:3px;cursor:pointer;font-size:11px;padding:2px 5px;" title="Ẩn bảng lệnh">Ẩn</button>
      <button id="knn-command-guide-toggle" style="background:none;border:0;color:#cbd5e1;cursor:pointer;font-size:14px;" title="Thu gọn">−</button>
    </div>
    <div id="knn-command-guide-help" style="padding:8px 9px;color:#cbd5e1;line-height:1.45;border-bottom:1px solid #334155;">Nhập một lệnh Nano trong COMMAND để xem hướng dẫn từng bước.</div>
    <div id="knn-command-guide-body" style="display:grid;grid-template-columns:minmax(88px,105px) 1fr;align-items:center;gap:5px 8px;padding:8px;">
      ${commandNames.map(name => `<button data-knn-command="${name}" title="Chạy lệnh ${name}" style="background:#0e7490;color:#fff;border:1px solid #22d3ee;border-radius:4px;padding:5px 4px;cursor:pointer;font-weight:bold;font-size:11px;">${name}</button><span style="color:#cbd5e1;line-height:1.3;">${commandHelp[name][0]}</span>`).join('')}
    </div>`;
  document.body.appendChild(commandGuide);

  let tab = document.createElement('button');
  tab.id = 'knn-command-guide-tab';
  tab.textContent = '🏛️ Lệnh Nano';
  tab.title = 'Hiện bảng lệnh Nano';
  tab.style.cssText = 'display:none;position:fixed;left:8px;top:110px;z-index:3000;background:#0e7490;color:white;border:1px solid #22d3ee;border-radius:0 6px 6px 0;padding:7px 9px;cursor:pointer;font-weight:bold;box-shadow:0 6px 16px rgba(0,0,0,.35);';
  document.body.appendChild(tab);

  commandGuide.querySelectorAll('[data-knn-command]').forEach(button => {
    button.addEventListener('click', () => {
      let command = button.dataset.knnCommand;
      if (typeof window[`c_${command}`] === 'function') window[`c_${command}`]();
    });
  });

  let hideBtn = commandGuide.querySelector('#knn-command-guide-hide');
  if (hideBtn) hideBtn.addEventListener('click', () => {
    commandGuide.style.display = 'none';
    tab.style.display = 'block';
  });
  if (tab) tab.addEventListener('click', () => {
    commandGuide.style.display = 'block';
    tab.style.display = 'none';
  });
  let toggleBtn = commandGuide.querySelector('#knn-command-guide-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', event => {
      let body = commandGuide.querySelector('#knn-command-guide-body');
      if (body) {
        body.style.display = body.style.display === 'none' ? 'grid' : 'none';
        event.currentTarget.textContent = body.style.display === 'none' ? '+' : '−';
      }
    });
  }
}

function ensureKNN3DToolbarBridge() {
  if (typeof document === 'undefined' || !document.body) return;
  if (window.knn3dToolbarClickHandler) document.removeEventListener('click', window.knn3dToolbarClickHandler, true);
  window.knn3dToolbarClickHandler = event => {
    let button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || button.id === 'knn-command-guide-tab') return;
    let label = (button.textContent || button.innerText || '').replace(/\s+/g, ' ').trim();
    if (!/Xem\s+3D/i.test(label)) return;
    let hasNano = window.knnState && window.knnState.lastResult;
    let hasTT = window.tt600State && window.tt600State.lastResult;
    if (hasNano && (!hasTT || (window.knnState.lastResult.createdAt || 0) >= (window.tt600State.lastResult.createdAt || 0))) {
      if (typeof window.openKNN3DModal === 'function') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.openKNN3DModal();
      }
    }
  };
  document.addEventListener('click', window.knn3dToolbarClickHandler, true);
}

function ensureKNNEnterFallback() {
  if (typeof document === 'undefined' || !document.body) return;
  if (window.knnEnterFallbackHandler) document.removeEventListener('keydown', window.knnEnterFallbackHandler, true);

  window.knnEnterFallbackHandler = event => {
    if (event.key !== 'Enter') return;
    if (typeof currentTool === 'undefined' || currentTool !== 'KNN1') return;
    if (!window.knnState || !window.knnState.active) return;

    let target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    window.knnState.enterHandledAt = Date.now();
    window.executeKNNFromSelectionOrCanvas();
  };

  document.addEventListener('keydown', window.knnEnterFallbackHandler, true);
}


// === MODULE: trannano/5_view_3d.js ===
// ===============================================================================
//     KNN 3D PERSPECTIVE VIEWER (KOSMOS REALISTIC FINISH & FRAMING)
//     Hỗ trợ 2 chế độ:
//     1. Xem Khung Xương Kết Cấu (Framing Mode)
//     2. Xem Ráp Tấm Hoàn Thiện Vân Gỗ + Tấm Trắng + Đèn Downlight + Đèn Mâm (Finish Mode)
// ===============================================================================

let knn3dState = {
  rotX: 35,
  rotZ: -45,
  panX: 0,
  panY: 0,
  zoom: 1.0,
  isDragging: false,
  dragMode: 'rotate',
  renderMode: 'finish', // 'finish' | 'frame'
  lastMouseX: 0,
  lastMouseY: 0
};

window.openKNN3DModal = function(targetRes) {
  let oldModal = document.getElementById('knn-3d-modal');
  if (oldModal) oldModal.remove();

  let res = targetRes || (window.knnState && window.knnState.lastResult);
  if (!res || !res.polyPts) {
    if (typeof setInfo === 'function') setInfo("⚠️ Bạn cần tạo hệ khung trần hoặc ráp tấm Nano trước khi xem 3D.");
    return;
  }
  if (window.knnState) {
    window.knnState.lastResult = res;
  }

  let modal = document.createElement('div');
  modal.id = 'knn-3d-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.92)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  modal.innerHTML = `
    <div style="width:92vw; height:88vh; background:#0f172a; border:2px solid #06b6d4; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.85);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#1e293b; border-bottom:1.5px solid #334155; flex-wrap:wrap; gap:8px;">
        <div style="font-weight:bold; font-size:14px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          📦 MÔ HÌNH 3D PHỐI CẢNH THỰC TẾ TRẦN NANO KOSMOS
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="display:flex; background:#0f172a; padding:2px; border-radius:8px; border:1px solid #334155;">
            <button id="knn-3d-btn-finish" onclick="window.setKNN3DRenderMode('finish')" style="padding:4px 10px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer; border:none; background:${knn3dState.renderMode === 'finish' ? '#0ea5e9' : 'transparent'}; color:${knn3dState.renderMode === 'finish' ? '#fff' : '#94a3b8'};">
              🎨 Phối Cảnh Hoàn Thiện (RAPTAM)
            </button>
            <button id="knn-3d-btn-frame" onclick="window.setKNN3DRenderMode('frame')" style="padding:4px 10px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer; border:none; background:${knn3dState.renderMode === 'frame' ? '#0ea5e9' : 'transparent'}; color:${knn3dState.renderMode === 'frame' ? '#fff' : '#94a3b8'};">
              🏗️ Khung Xương Kết Cấu
            </button>
          </div>

          <button onclick="window.resetKNN3DView()" class="btn" style="padding:4px 8px; font-size:11px; background:#334155; color:#cbd5e1; border-radius:6px; cursor:pointer;">↺ Reset Góc</button>
          <button onclick="window.closeKNN3DModal()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold; background:#ef4444; color:#fff; border-radius:6px; cursor:pointer;">✕ Đóng</button>
        </div>
      </div>

      <div style="flex:1; position:relative; min-width:0; min-height:0; height:100%;">
        <canvas id="knn-3d-canvas" style="width:100%; height:100%; background:#020617; display:block; cursor:grab;"></canvas>
        <div style="position:absolute; bottom:12px; left:16px; font-size:11px; color:#94a3b8; background:rgba(15,23,42,0.85); padding:6px 12px; border-radius:8px; border:1px solid #334155;">
          🖱️ <b>Kéo chuột trái</b>: Xoay 3D | <b>Cuộn chuột</b>: Zoom In/Out | <b>Phím P</b>: Chế độ Pan | <b>Phím R</b>: Chế độ Rotate
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  initKNN3DCanvas(res);
};

window.setKNN3DRenderMode = function(mode) {
  knn3dState.renderMode = mode;
  let btnFinish = document.getElementById('knn-3d-btn-finish');
  let btnFrame = document.getElementById('knn-3d-btn-frame');
  if (btnFinish) {
    btnFinish.style.background = mode === 'finish' ? '#0ea5e9' : 'transparent';
    btnFinish.style.color = mode === 'finish' ? '#fff' : '#94a3b8';
  }
  if (btnFrame) {
    btnFrame.style.background = mode === 'frame' ? '#0ea5e9' : 'transparent';
    btnFrame.style.color = mode === 'frame' ? '#fff' : '#94a3b8';
  }
  drawKNN3D();
};

window.closeKNN3DModal = function() {
  let modal = document.getElementById('knn-3d-modal');
  if (modal) modal.remove();
  if (window.knn3dKeyHandler) document.removeEventListener('keydown', window.knn3dKeyHandler);
  if (window.knn3dResizeHandler) window.removeEventListener('resize', window.knn3dResizeHandler);
};

window.resetKNN3DView = function() {
  knn3dState.rotX = 35;
  knn3dState.rotZ = -45;
  knn3dState.panX = 0;
  knn3dState.panY = 0;
  knn3dState.zoom = 1.0;
  drawKNN3D();
};

window.setKNN3DMode = function(mode) {
  knn3dState.dragMode = mode;
  const cvs = document.getElementById('knn-3d-canvas');
  if (cvs) cvs.style.cursor = mode === 'pan' ? 'move' : 'grab';
};

function initKNN3DCanvas(res) {
  const cvs = document.getElementById('knn-3d-canvas');
  if (!cvs) return;

  let resizeCanvas = () => {
    let rect = cvs.getBoundingClientRect();
    cvs.width = Math.max(1, Math.floor(rect.width));
    cvs.height = Math.max(1, Math.floor(rect.height));
    drawKNN3D();
  };

  cvs.onmousedown = function(e) {
    knn3dState.isDragging = true;
    knn3dState.lastMouseX = e.clientX;
    knn3dState.lastMouseY = e.clientY;
    cvs.style.cursor = 'grabbing';
  };

  window.onmousemove = function(e) {
    if (!knn3dState.isDragging) return;
    let dx = e.clientX - knn3dState.lastMouseX;
    let dy = e.clientY - knn3dState.lastMouseY;
    knn3dState.lastMouseX = e.clientX;
    knn3dState.lastMouseY = e.clientY;

    if (knn3dState.dragMode === 'pan') {
      knn3dState.panX += dx;
      knn3dState.panY += dy;
    } else {
      knn3dState.rotZ += dx * 0.5;
      knn3dState.rotX += dy * 0.5;
      knn3dState.rotX = Math.max(-85, Math.min(85, knn3dState.rotX));
    }
    drawKNN3D();
  };

  window.onmouseup = function() {
    knn3dState.isDragging = false;
    cvs.style.cursor = knn3dState.dragMode === 'pan' ? 'move' : 'grab';
  };

  if (window.knn3dKeyHandler) document.removeEventListener('keydown', window.knn3dKeyHandler);
  window.knn3dKeyHandler = function(event) {
    if (event.key === 'p' || event.key === 'P') {
      window.setKNN3DMode('pan');
      event.preventDefault();
    } else if (event.key === 'r' || event.key === 'R') {
      window.setKNN3DMode('rotate');
      event.preventDefault();
    }
  };
  document.addEventListener('keydown', window.knn3dKeyHandler);
  cvs.onwheel = function(e) {
    e.preventDefault();
    knn3dState.zoom *= (e.deltaY > 0 ? 0.9 : 1.1);
    knn3dState.zoom = Math.max(0.2, Math.min(5.0, knn3dState.zoom));
    drawKNN3D();
  };

  if (window.knn3dResizeHandler) window.removeEventListener('resize', window.knn3dResizeHandler);
  window.knn3dResizeHandler = resizeCanvas;
  window.addEventListener('resize', window.knn3dResizeHandler);
  requestAnimationFrame(resizeCanvas);
}

function drawKNN3D() {
  const cvs = document.getElementById('knn-3d-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');
  const w = cvs.width, h = cvs.height;
  ctx.clearRect(0, 0, w, h);

  let res = window.knnState && window.knnState.lastResult;
  if (!res || !res.polyPts) return;

  let xs = res.polyPts.map(p => p.x), ys = res.polyPts.map(p => p.y);
  let cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  let cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let maxDim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1000;
  let baseScale = (Math.min(w, h) * 0.6 / maxDim) * knn3dState.zoom;
  let isMeter = (maxDim < 60);

  let radZ = knn3dState.rotZ * Math.PI / 180;
  let radX = knn3dState.rotX * Math.PI / 180;
  let cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
  let cosX = Math.cos(radX), sinX = Math.sin(radX);

  function project3D(x, y, z) {
    let rx = x - cx;
    let ry = y - cy;
    let rz = z;

    let x1 = rx * cosZ - ry * sinZ;
    let y1 = rx * sinZ + ry * cosZ;
    let z1 = rz;

    let x2 = x1;
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;

    return {
      x: w / 2 + x2 * baseScale + knn3dState.panX,
      y: h / 2 - y2 * baseScale + knn3dState.panY,
      depth: z2
    };
  }

  function drawBeam3D(p1, p2, z, beamWidth, beamDepth, color) {
    let dx = p2.x - p1.x, dy = p2.y - p1.y;
    let length = Math.hypot(dx, dy) || 1;
    let nx = -dy / length * beamWidth / 2;
    let ny = dx / length * beamWidth / 2;
    let top = [
      project3D(p1.x + nx, p1.y + ny, z),
      project3D(p2.x + nx, p2.y + ny, z),
      project3D(p2.x - nx, p2.y - ny, z),
      project3D(p1.x - nx, p1.y - ny, z)
    ];
    let bottom = top.map((point, index) => {
      let source = index < 2 ? (index === 0 ? p1 : p2) : (index === 2 ? p2 : p1);
      return project3D(source.x + (index === 0 || index === 3 ? nx : -nx),
        source.y + (index === 0 || index === 3 ? ny : -ny), z - beamDepth);
    });
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.beginPath();
    ctx.moveTo(bottom[0].x, bottom[0].y);
    ctx.lineTo(bottom[1].x, bottom[1].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[0].x, top[0].y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    top.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawPost3D(x, y, zTop, zBottom, postWidth, color) {
    let half = postWidth / 2;
    let top = [
      project3D(x - half, y - half, zTop),
      project3D(x + half, y - half, zTop),
      project3D(x + half, y + half, zTop),
      project3D(x - half, y + half, zTop)
    ];
    let bottom = [
      project3D(x - half, y - half, zBottom),
      project3D(x + half, y - half, zBottom),
      project3D(x + half, y + half, zBottom),
      project3D(x - half, y + half, zBottom)
    ];
    ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([first, second]) => {
      ctx.beginPath();
      ctx.moveTo(top[first].x, top[first].y);
      ctx.lineTo(top[second].x, top[second].y);
      ctx.lineTo(bottom[second].x, bottom[second].y);
      ctx.lineTo(bottom[first].x, bottom[first].y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = color;
    ctx.beginPath();
    top.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
  }

  let slabH = maxDim * 0.20;
  let zCap1 = 0; // Cấp 1 (Trần cao)
  let dropDepthCad = isMeter ? ((res.opt && res.opt.dropDepth || 150) / 1000.0) : (res.opt && res.opt.dropDepth || 150);
  let zCap2 = -dropDepthCad * (maxDim / (isMeter ? 5 : 5000)); // Cấp 2 (Trần thấp)
  let zPanel = zCap2 - maxDim * 0.02;

  let innerPoly = res.innerPoly || (res.tiers && res.tiers.length > 1 ? res.tiers[1].pts : null);

  // 1. SÀN BÊ TÔNG CỐT THÉP (Z = +slabH)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < res.polyPts.length; i++) {
    let p = project3D(res.polyPts[i].x, res.polyPts[i].y, slabH);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // =========================================================================
  // CHẾ ĐỘ 1: PHỐI CẢNH 3D RÁP TẤM HOÀN THIỆN (RAPTAM FINISHED 3D)
  // =========================================================================
  if (knn3dState.renderMode === 'finish') {
    // 1. VÀNH NGOÀI: TẤM NANO VÂN GỖ SỒI
    ctx.fillStyle = '#854d0e';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < res.polyPts.length; i++) {
      let p = project3D(res.polyPts[i].x, res.polyPts[i].y, zCap2);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Mạch tấm Nano vân gỗ trên vành ngoài
    let panelWidthCad = isMeter ? 0.4 : 400.0;
    let xs = res.polyPts.map(p => p.x), ys = res.polyPts.map(p => p.y);
    let curY = Math.min(...ys) + panelWidthCad;
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    ctx.lineWidth = 1.2;
    while (curY < Math.max(...ys)) {
      let segs = innerPoly ? getRingSegments(res.polyPts, innerPoly, curY, true, isMeter) : getHSegments(res.polyPts, curY, isMeter);
      for (let s of segs) {
        let p1 = project3D(s[0], curY, zCap2 + 1);
        let p2 = project3D(s[1], curY, zCap2 + 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      curY += panelWidthCad;
    }

    // 2. THÀNH ĐỨNG GIẬT CẤP (VÂN GỖ)
    if (innerPoly) {
      ctx.fillStyle = '#78350f';
      for (let i = 0; i < innerPoly.length; i++) {
        let p1 = innerPoly[i];
        let p2 = innerPoly[(i + 1) % innerPoly.length];
        let p1_low = project3D(p1.x, p1.y, zCap2);
        let p2_low = project3D(p2.x, p2.y, zCap2);
        let p2_high = project3D(p2.x, p2.y, zCap1);
        let p1_high = project3D(p1.x, p1.y, zCap1);

        ctx.beginPath();
        ctx.moveTo(p1_low.x, p1_low.y);
        ctx.lineTo(p2_low.x, p2_low.y);
        ctx.lineTo(p2_high.x, p2_high.y);
        ctx.lineTo(p1_high.x, p1_high.y);
        ctx.closePath();
        ctx.fill();
      }

      // 3. LÕI TRẦN CAO: TẤM NANO TRẮNG SÁNG
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < innerPoly.length; i++) {
        let p = project3D(innerPoly[i].x, innerPoly[i].y, zCap1);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mạch tấm Nano trắng trên lõi trần
      let inXs = innerPoly.map(p => p.x), inYs = innerPoly.map(p => p.y);
      let cY = Math.min(...inYs) + panelWidthCad;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.8)';
      ctx.lineWidth = 1.0;
      while (cY < Math.max(...inYs)) {
        let segs = getHSegments(innerPoly, cY, isMeter);
        for (let s of segs) {
          let p1 = project3D(s[0], cY, zCap1 + 1);
          let p2 = project3D(s[1], cY, zCap1 + 1);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        cY += panelWidthCad;
      }

      // 4. KHUNG PHÀO CHỈ TRANG TRÍ VÀNG KIM & 4 GÓC CHỮ VẠN 3D
      let cornicePoly = offsetPolygonInward(innerPoly, isMeter ? 0.28 : 280.0);
      if (cornicePoly) {
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < cornicePoly.length; i++) {
          let p = project3D(cornicePoly[i].x, cornicePoly[i].y, zCap1 + 2);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();

        let innerCornice = offsetPolygonInward(cornicePoly, isMeter ? 0.08 : 80.0);
        if (innerCornice) {
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let i = 0; i < innerCornice.length; i++) {
            let p = project3D(innerCornice[i].x, innerCornice[i].y, zCap1 + 2);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // 5. ĐÈN CHÙM MÂM HOA LED 5 CÁNH TRUNG TÂM (3D)
      let coreCenter = {
        x: (Math.min(...inXs) + Math.max(...inXs)) / 2,
        y: (Math.min(...inYs) + Math.max(...inYs)) / 2
      };
      let pLamp = project3D(coreCenter.x, coreCenter.y, zCap1 - (isMeter ? 0.05 : 50.0));

      // Quầng sáng đèn mâm
      ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
      ctx.beginPath();
      ctx.arc(pLamp.x, pLamp.y, isMeter ? 25 : 30, 0, Math.PI * 2);
      ctx.fill();

      // Mâm đèn tròn
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pLamp.x, pLamp.y, isMeter ? 14 : 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 5 Cánh hoa led 3D
      for (let petal = 0; petal < 5; petal++) {
        let angle = (petal * 72) * Math.PI / 180;
        let pPetal = project3D(
          coreCenter.x + Math.cos(angle) * (isMeter ? 0.22 : 220.0),
          coreCenter.y + Math.sin(angle) * (isMeter ? 0.22 : 220.0),
          zCap1 - (isMeter ? 0.04 : 40.0)
        );
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pPetal.x, pPetal.y, isMeter ? 8 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 6. DẢI ĐÈN LED KHE HẮT ÂM 3D (Ánh sáng vàng ấm tỏa rạng)
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < innerPoly.length; i++) {
        let p = project3D(innerPoly[i].x, innerPoly[i].y, zCap1 + 1);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 7. HỆ THỐNG ĐÈN DOWNLIGHT ÂM TRẦN 3D TRÊN VÀNH GỖ
      let tierWidthCad = isMeter ? ((res.opt && res.opt.tierWidth || 700) / 1000.0) : (res.opt && res.opt.tierWidth || 700);
      let midDropDist = tierWidthCad / 2;
      let minX = Math.min(...xs), maxX = Math.max(...xs);
      let minY = Math.min(...ys), maxY = Math.max(...ys);

      let downlights3D = [];
      let nHoriz = Math.max(2, Math.round((maxX - minX) / (isMeter ? 1.2 : 1200)));
      for (let k = 1; k < nHoriz; k++) {
        let lx = minX + k * ((maxX - minX) / nHoriz);
        downlights3D.push({ x: lx, y: minY + midDropDist });
        downlights3D.push({ x: lx, y: maxY - midDropDist });
      }
      let nVert = Math.max(2, Math.round((maxY - minY) / (isMeter ? 1.2 : 1200)));
      for (let k = 1; k < nVert; k++) {
        let ly = minY + k * ((maxY - minY) / nVert);
        downlights3D.push({ x: minX + midDropDist, y: ly });
        downlights3D.push({ x: maxX - midDropDist, y: ly });
      }

      downlights3D.forEach(dl => {
        let pDl = project3D(dl.x, dl.y, zCap2 + 1);
        // Quầng sáng mờ
        ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
        ctx.beginPath();
        ctx.arc(pDl.x, pDl.y, 8, 0, Math.PI * 2);
        ctx.fill();
        // Bóng đèn Downlight phát sáng
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(pDl.x, pDl.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    return;
  }

  // =========================================================================
  // CHẾ ĐỘ 2: KẾT CẤU KHUNG XƯƠNG (FRAMING 3D)
  // =========================================================================

  // 1. TẤM NANO MỜ
  ctx.fillStyle = 'rgba(226, 232, 240, 0.15)';
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < res.polyPts.length; i++) {
    let p = project3D(res.polyPts[i].x, res.polyPts[i].y, zPanel);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (innerPoly) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    for (let i = 0; i < innerPoly.length; i++) {
      let p = project3D(innerPoly[i].x, innerPoly[i].y, zCap1 - maxDim * 0.02);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 2. KHUNG VIỀN TƯỜNG (CẤP 2 - TRẦN THẤP)
  for (let i = 0; i < res.polyPts.length; i++) {
    let p1 = res.polyPts[i];
    let p2 = res.polyPts[(i + 1) % res.polyPts.length];
    drawBeam3D(p1, p2, zCap2, isMeter ? 0.06 : 60, isMeter ? 0.04 : 40, '#38bdf8');
  }

  // 3. KHUNG VIỀN MÉP GIẬT CẤP & XƯƠNG ĐỨNG (THÀNH HỘP)
  if (innerPoly) {
    for (let i = 0; i < innerPoly.length; i++) {
      let p1 = innerPoly[i];
      let p2 = innerPoly[(i + 1) % innerPoly.length];
      drawBeam3D(p1, p2, zCap2, isMeter ? 0.06 : 60, isMeter ? 0.04 : 40, '#0ea5e9');
      drawBeam3D(p1, p2, zCap1, isMeter ? 0.06 : 60, isMeter ? 0.04 : 40, '#0ea5e9');

      drawPost3D(p1.x, p1.y, zCap1, zCap2, isMeter ? 0.05 : 50, '#e879f9');
      let midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
      drawPost3D(midX, midY, zCap1, zCap2, isMeter ? 0.05 : 50, '#e879f9');
    }
  }

  // 4. CÁC THANH SƯỜN GIẰNG CẤP 2 (VÀNH TRẦN THẤP) + TY REN TREO CẤP 2
  if (res.cap2RibSegments) {
    res.cap2RibSegments.forEach(seg => {
      drawBeam3D(seg.p1, seg.p2, zCap2, isMeter ? 0.05 : 50, isMeter ? 0.035 : 35, '#f97316');

      let midX = (seg.p1.x + seg.p2.x) / 2;
      let midY = (seg.p1.y + seg.p2.y) / 2;
      drawPost3D(midX, midY, slabH, zCap2, isMeter ? 0.025 : 25, '#facc15');

      let ptBot = project3D(midX, midY, zCap2);
      let ptTop = project3D(midX, midY, slabH);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ptBot.x, ptBot.y);
      ctx.lineTo(ptTop.x, ptTop.y);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(ptBot.x, ptBot.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 5. KHUNG XƯƠNG CẤP 1 (LÕI TRẦN CAO) + TY REN TREO CẤP 1
  if (res.cap1MainSegments) {
    res.cap1MainSegments.forEach(seg => {
      drawBeam3D(seg.p1, seg.p2, zCap1, isMeter ? 0.06 : 60, isMeter ? 0.04 : 40, '#2563eb');

      let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * (isMeter ? 1000 : 1);
      let nH = Math.max(1, Math.round(segLenMm / 900.0));
      let dx = (seg.p2.x - seg.p1.x) / (nH + 1);
      let dy = (seg.p2.y - seg.p1.y) / (nH + 1);

      for (let k = 1; k <= nH; k++) {
        let hx = seg.p1.x + dx * k;
        let hy = seg.p1.y + dy * k;
        drawPost3D(hx, hy, slabH, zCap1, isMeter ? 0.025 : 25, '#facc15');

        let ptBot = project3D(hx, hy, zCap1);
        let ptTop = project3D(hx, hy, slabH);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ptBot.x, ptBot.y);
        ctx.lineTo(ptTop.x, ptTop.y);
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(ptBot.x, ptBot.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Các thanh giằng ngang trần cao
  if (res.cap1CrossSegments) {
    res.cap1CrossSegments.forEach(seg => {
      drawBeam3D(seg.p1, seg.p2, zCap1, isMeter ? 0.05 : 50, isMeter ? 0.035 : 35, '#3b82f6');
    });
  }
}


// === MODULE: trannano/6_view_section.js ===
// ===============================================================================
//     KNN 2D TECHNICAL CROSS-SECTION VIEWER (KOSMOS)
// ===============================================================================

window.openKNNSectionModal = function() {
  let oldModal = document.getElementById('knn-sec-modal');
  if (oldModal) oldModal.remove();

  let modal = document.createElement('div');
  modal.id = 'knn-sec-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.92)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  modal.innerHTML = `
    <div style="width:90vw; height:86vh; background:#0f172a; border:2px solid #06b6d4; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.85);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#1e293b; border-bottom:1.5px solid #334155;">
        <div style="font-weight:bold; font-size:14px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          🔍 BẢN VẼ MẶT CẮT KỸ THUẬT CẤU TẠO KHUNG HỘP GIẬT CẤP TRẦN NANO KOSMOS
        </div>
        <button onclick="document.getElementById('knn-sec-modal').remove()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold; background:#ef4444; color:#fff; border-radius:6px; cursor:pointer;">✕ Đóng</button>
      </div>

      <div style="flex:1; position:relative; min-width:0; min-height:0; height:100%;">
        <canvas id="knn-sec-canvas" style="width:100%; height:100%; background:#020617; display:block;"></canvas>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cvs = document.getElementById('knn-sec-canvas');
  if (!cvs) return;
  let resizeSectionCanvas = () => {
    let rect = cvs.getBoundingClientRect();
    cvs.width = Math.max(1, Math.floor(rect.width));
    cvs.height = Math.max(1, Math.floor(rect.height));
    drawKNNCrossSection(cvs.getContext('2d'), cvs.width, cvs.height);
  };
  requestAnimationFrame(resizeSectionCanvas);
};

function drawKNNCrossSection(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  let startX = 70, endX = w - 70;
  let slabY = 80;
  let ceilHighY = slabY + 120; // Khung xương cấp 1 (Trần cao +2.800)
  let ceilLowY = ceilHighY + 90; // Khung xương cấp 2 (Trần thấp +2.650, hạ H=150mm)
  let dropX1 = startX + (endX - startX) * 0.25;
  let dropX2 = endX - (endX - startX) * 0.25;

  // 1. SÀN BÊ TÔNG CỐT THÉP (+3.300)
  ctx.fillStyle = '#334155';
  ctx.fillRect(startX, slabY - 25, endX - startX, 25);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, slabY - 25, endX - startX, 25);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SÀN BÊ TÔNG CỐT THÉP (+3.300)', startX + 20, slabY - 8);

  // 2. TƯỜNG 2 BÊN
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(startX - 35, slabY - 25, 35, ceilLowY - slabY + 140);
  ctx.fillRect(endX, slabY - 25, 35, ceilLowY - slabY + 140);
  ctx.strokeRect(startX - 35, slabY - 25, 35, ceilLowY - slabY + 140);
  ctx.strokeRect(endX, slabY - 25, 35, ceilLowY - slabY + 140);

  // 3. NẸP V VIỀN TƯỜNG (CẤP 2)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(startX, ceilLowY - 25); ctx.lineTo(startX, ceilLowY); ctx.lineTo(startX + 25, ceilLowY);
  ctx.moveTo(endX, ceilLowY - 25); ctx.lineTo(endX, ceilLowY); ctx.lineTo(endX - 25, ceilLowY);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Nẹp V viền tường 3.0m', startX + 10, ceilLowY - 32);

  // 4. KHUNG XƯƠNG CẤP 2 (VÀNH TRẦN THẤP)
  let cap2XPositions = [
    startX + 60, startX + 160, dropX1 - 40,
    dropX2 + 40, endX - 160, endX - 60
  ];

  cap2XPositions.forEach((bx, idx) => {
    // Ty ren M8 trần thấp (dài hơn)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, slabY);
    ctx.lineTo(bx, ceilLowY - 10);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(bx - 4, slabY - 2, 8, 6);
    ctx.strokeRect(bx - 5, (slabY + ceilLowY) / 2 - 10, 10, 20);

    // Thanh xương sườn cấp 2
    ctx.strokeStyle = '#f97316';
    ctx.fillStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx - 12, ceilLowY - 18, 24, 12);

    if (idx === 1) {
      ctx.fillStyle = '#f97316';
      ctx.font = '10px sans-serif';
      ctx.fillText('Khung xương cấp 2: hệ trần thấp (@450)', bx - 35, ceilLowY + 32);
      ctx.fillStyle = '#facc15';
      ctx.fillText('Ty ren M8 (hàn vào cấp 2)', bx - 30, (slabY + ceilLowY) / 2 + 30);
    }
  });

  // 5. KHUNG THÀNH ĐỨNG GIẬT CẤP & XƯƠNG ĐỨNG
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dropX1, ceilLowY); ctx.lineTo(dropX1, ceilHighY); ctx.lineTo(dropX1 - 35, ceilHighY);
  ctx.moveTo(dropX2, ceilLowY); ctx.lineTo(dropX2, ceilHighY); ctx.lineTo(dropX2 + 35, ceilHighY);
  ctx.stroke();

  ctx.fillStyle = '#e879f9';
  ctx.font = '10px sans-serif';
  ctx.fillText('Thành đứng giật cấp H=150mm', dropX1 - 90, (ceilHighY + ceilLowY) / 2 - 5);

  // 6. KHUNG XƯƠNG CẤP 1 (LÕI TRẦN CAO)
  let cap1XPositions = [
    dropX1 + 60, (dropX1 + dropX2) / 2 - 100, (dropX1 + dropX2) / 2 + 100, dropX2 - 60
  ];

  cap1XPositions.forEach((tx, idx) => {
    // Ty ren M8 trần cao
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, slabY);
    ctx.lineTo(tx, ceilHighY - 10);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(tx - 4, slabY - 2, 8, 6);
    ctx.strokeRect(tx - 5, (slabY + ceilHighY) / 2 - 10, 10, 20);

    // Thanh xương trần cao
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tx - 15, ceilHighY - 18, 30, 12);

    if (idx === 1) {
      ctx.fillStyle = '#2563eb';
      ctx.font = '10px sans-serif';
      ctx.fillText('Khung xương cấp 1: hệ trần cao (@450)', tx - 40, ceilHighY - 26);
    }
  });

  // 7. TẤM NANO LÕI & VÀNH
  ctx.fillStyle = '#cbd5e1';
  // Vành thấp
  ctx.fillRect(startX + 5, ceilLowY - 4, dropX1 - startX - 5, 6);
  ctx.fillRect(dropX2, ceilLowY - 4, endX - dropX2 - 5, 6);
  // Lõi cao
  ctx.fillRect(dropX1 + 10, ceilHighY - 4, dropX2 - dropX1 - 20, 6);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('CAO ĐỘ HỆ TRẦN THẤP (+2.650)', startX + 40, ceilLowY + 48);
  ctx.fillText('CAO ĐỘ HỆ TRẦN CAO (+2.800)', (dropX1 + dropX2) / 2 - 70, ceilHighY - 35);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dropX1 - 50, ceilHighY);
  ctx.lineTo(dropX1 - 50, ceilLowY);
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.fillText('H = 150mm', dropX1 - 115, (ceilHighY + ceilLowY) / 2 + 4);
}



// === MODULE: trannano/7_finish_panel.js ===
// ===============================================================================
//     VINACAD PLUGIN: RÁP TẤM NANO HOÀN THIỆN (RAPTAM / OPNANO / RAPNANO)
//     Quy cách tấm: Rộng 400mm x Dài 3.0 mét
//     - Tự động COPY bản vẽ ra vị trí bên cạnh để in ấn / photo riêng biệt
//     - Vành viền ngoài: Ốp tấm Nano vân gỗ + Phào cổ trần + Hệ thống đèn Downlight
//     - Lõi trần giữa: Ốp tấm Nano trắng 400x3000mm + Chỉ phào 4 góc chữ Vạn + Đèn chùm mâm hoa
//     - Khe hắt LED viền giật cấp + Bảng thống kê vật tư & thiết bị hoàn thiện
// ===============================================================================

function executeRAPTAMAlgorithm(polyPts, options = {}) {
  if (!polyPts || polyPts.length < 3) {
    if (typeof setInfo === 'function') setInfo("❌ Không tìm thấy hình phòng để ráp tấm.");
    return;
  }

  let opt = Object.assign({
    levelMode: (window.knnState && window.knnState.levelMode) || 'cap1',
    materialType: 'nano400',
    panelWidthMm: 400,
    panelLengthMm: 3000,
    tierWidth: (window.knnState && window.knnState.tierWidth) || 700,
    dropDepth: (window.knnState && window.knnState.dropDepth) || 150,
    hasLedSlot: true
  }, options);

  let xs = polyPts.map(p => p.x), ys = polyPts.map(p => p.y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  let w_raw = xmax - xmin, h_raw = ymax - ymin;
  let isMeter = (w_raw < 60 && h_raw < 60);
  let scaleUnit = isMeter ? 1000.0 : 1.0;

  // 1. TÍNH TOÁN VỊ TRÍ OFFSET ĐỂ COPY BẢN VẼ RA BÊN CẠNH (ĐỂ PHOTO/IN ẤN)
  // Bản vẽ gốc có thể có bảng BOM rộng ~9.2m ở bên phải (xmax + 1500 + 9200 = xmax + 10700)
  let bomSpanMm = 12000;
  let offsetX = (xmax - xmin) + (isMeter ? (bomSpanMm / 1000 + 3.0) : (bomSpanMm + 3000));
  let offsetY = 0;

  let roomId = 'rm_rap_' + [Math.round(xmin + offsetX), Math.round(ymin + offsetY)].map(v => Math.round(v / 100)).join('_');

  if (typeof entities !== 'undefined') {
    entities = entities.filter(e => !(e.id && e.id.startsWith('rap_') && e.roomId === roomId));
  }

  let tierWidthCad = isMeter ? (opt.tierWidth / 1000.0) : opt.tierWidth;
  let panelStepCad = isMeter ? (opt.panelWidthMm / 1000.0) : opt.panelWidthMm;

  // Bản vẽ copy dịch chuyển sang vị trí mới
  let polyNew = polyPts.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
  let innerPolyNew = (opt.levelMode !== 'cap0') ? offsetPolygonInward(polyNew, tierWidthCad) : null;

  let newEnts = [];

  let realAreaM2 = isMeter ? polyArea(polyPts) : polyArea(polyPts) / 1e6;
  let realPeriM = isMeter ? polyPeri(polyPts) : polyPeri(polyPts) / 1e3;
  let verticalPanelAreaM2 = 0;
  if (innerPolyNew) {
    let innerPeriM = isMeter ? polyPeri(innerPolyNew) : polyPeri(innerPolyNew) / 1e3;
    verticalPanelAreaM2 = innerPeriM * (opt.dropDepth / 1000.0);
  }
  let totalActualAreaM2 = realAreaM2 + verticalPanelAreaM2;
  let totalPanelOrderM2 = totalActualAreaM2 * 1.07;
  let laborFactor = opt.levelMode === 'cap0' ? 1.00 : 1.25;
  let laborAreaM2 = realAreaM2 * laborFactor;

  let woodPanelAreaM2 = 0;
  let whitePanelAreaM2 = 0;

  if (innerPolyNew) {
    let innerAreaM2 = isMeter ? polyArea(innerPolyNew) : polyArea(innerPolyNew) / 1e6;
    whitePanelAreaM2 = innerAreaM2;
    woodPanelAreaM2 = (realAreaM2 - innerAreaM2) + verticalPanelAreaM2;
  } else {
    whitePanelAreaM2 = realAreaM2;
  }

  let singlePanelM2 = (opt.panelWidthMm * opt.panelLengthMm) / 1e6; // 1.2 m2
  let woodPanelCount = Math.max(1, Math.ceil((woodPanelAreaM2 * 1.07) / singlePanelM2));
  let whitePanelCount = Math.max(1, Math.ceil((whitePanelAreaM2 * 1.07) / singlePanelM2));
  let totalPanelCount = woodPanelCount + whitePanelCount;

  let newXs = polyNew.map(p => p.x), newYs = polyNew.map(p => p.y);
  let newXmin = Math.min(...newXs), newXmax = Math.max(...newXs);
  let newYmin = Math.min(...newYs), newYmax = Math.max(...newYs);

  // 2. NHÃN TIÊU ĐỀ BẢN VẼ PHỐI CẢNH 2D
  let fTitle = isMeter ? 0.24 : 240;
  let fSub = isMeter ? 0.12 : 120;
  newEnts.push({
    id: 'rap_title_1',
    roomId: roomId,
    type: 'TEXT',
    x: (newXmin + newXmax) / 2,
    y: newYmax + (isMeter ? 0.7 : 700),
    text: 'BẢN VẼ PHỐI CẢNH 2D TRẦN NANO HOÀN THIỆN (ỐP TẤM 400x3000mm)',
    size: fTitle,
    color: '#38bdf8',
    align: 'center',
    layer: '07_NANO_HOAN_THIEN'
  });
  newEnts.push({
    id: 'rap_title_2',
    roomId: roomId,
    type: 'TEXT',
    x: (newXmin + newXmax) / 2,
    y: newYmax + (isMeter ? 0.35 : 350),
    text: '(Bản vẽ phối cảnh hoàn thiện tách riêng từ kết cấu khung xương để phục vụ in ấn / thi công / nghiệm thu)',
    size: fSub,
    color: '#94a3b8',
    align: 'center',
    layer: '07_NANO_HOAN_THIEN'
  });

  // 3. VÀNH GIẬT CẤP VIỀN NGOÀI (CẤP 2 - ỐP TẤM NANO VÂN GỖ SỒI)
  if (innerPolyNew) {
    // Nền vân gỗ cho vành viền ngoài
    newEnts.push({
      id: 'rap_wood_band_bg',
      roomId: roomId,
      type: 'POLYGON',
      points: polyNew.map(p => [p.x, p.y]),
      color: '#78350f',
      fillColor: 'rgba(180, 83, 9, 0.35)',
      lineWidth: 2,
      layer: '07_NANO_TAM_OP',
      info: 'Vành giật cấp ốp tấm Nano vân gỗ sồi'
    });

    // Mạch ghép tấm Nano vân gỗ 400mm trên vành ngoài
    let curY = newYmin + panelStepCad;
    let jointIdx = 0;
    while (curY < newYmax) {
      let segs = getRingSegments(polyNew, innerPolyNew, curY, true, isMeter);
      for (let s of segs) {
        newEnts.push({
          id: `rap_wood_joint_${jointIdx++}`,
          roomId: roomId,
          type: 'LINE',
          p1: [s[0], curY],
          p2: [s[1], curY],
          color: 'rgba(146, 64, 14, 0.55)',
          lineWidth: 1.2,
          layer: '07_NANO_TAM_OP',
          info: 'Mạch ghép tấm Nano vân gỗ 400mm'
        });
      }
      curY += panelStepCad;
    }

    // Phào cổ trần viền chân tường (4 cạnh ngoài)
    for (let i = 0, j = polyNew.length - 1; i < polyNew.length; j = i++) {
      let p1 = polyNew[j], p2 = polyNew[i];
      newEnts.push({
        id: `rap_cornice_wall_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#b45309',
        lineWidth: 4.0,
        layer: '08_NANO_PHAO_CHI',
        info: 'Phào cổ trần viền chân tường vân gỗ'
      });
    }

    // Nẹp V viền mép giật cấp
    for (let i = 0, j = innerPolyNew.length - 1; i < innerPolyNew.length; j = i++) {
      let p1 = innerPolyNew[j], p2 = innerPolyNew[i];
      newEnts.push({
        id: `rap_step_v_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#f59e0b',
        lineWidth: 3.0,
        layer: '08_NANO_PHAO_CHI',
        info: 'Nẹp V bo viền mép giật cấp chỉ vàng'
      });

      // Dải LED khe hắt viền giật cấp
      newEnts.push({
        id: `rap_led_finish_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#fde047',
        lineWidth: 1.5,
        lineDash: [8, 4],
        layer: '07_NANO_LED_STRIP',
        info: 'Dải đèn LED khe hắt ánh sáng vàng ấm 3000K'
      });
    }

    // BỐ TRÍ HỆ THỐNG ĐÈN DOWNLIGHT ÂM TRẦN (PHI 90) TRÊN VÀNH GỖ
    let downlights = [];
    let rLamp = isMeter ? 0.08 : 80.0;
    let rGlow = isMeter ? 0.16 : 160.0;
    let midDropDist = tierWidthCad / 2;

    // Cạnh đáy & Cạnh đỉnh
    let nHoriz = Math.max(2, Math.round((newXmax - newXmin) / (isMeter ? 1.2 : 1200)));
    for (let k = 1; k < nHoriz; k++) {
      let lx = newXmin + k * ((newXmax - newXmin) / nHoriz);
      downlights.push({ x: lx, y: newYmin + midDropDist });
      downlights.push({ x: lx, y: newYmax - midDropDist });
    }
    // Cạnh trái & Cạnh phải
    let nVert = Math.max(2, Math.round((newYmax - newYmin) / (isMeter ? 1.2 : 1200)));
    for (let k = 1; k < nVert; k++) {
      let ly = newYmin + k * ((newYmax - newYmin) / nVert);
      downlights.push({ x: newXmin + midDropDist, y: ly });
      downlights.push({ x: newXmax - midDropDist, y: ly });
    }

    downlights.forEach((dl, dlIdx) => {
      let szBox = isMeter ? 0.18 : 180.0;
      let szLed = isMeter ? 0.10 : 100.0;

      // Quầng sáng phát quang
      newEnts.push({
        id: `rap_dl_glow_${dlIdx}`,
        roomId: roomId,
        type: 'CIRCLE',
        cx: dl.x,
        cy: dl.y,
        r: rGlow,
        color: 'rgba(254, 240, 138, 0.22)',
        fillColor: 'rgba(254, 240, 138, 0.10)',
        layer: '09_NANO_DEN_TRANG_TRI'
      });

      // Khung hộp đèn vuông ngoài viền kim loại vàng
      newEnts.push({
        id: `rap_dl_box_${dlIdx}`,
        roomId: roomId,
        type: 'RECTANGLE',
        x: dl.x - szBox / 2,
        y: dl.y - szBox / 2,
        w: szBox,
        h: szBox,
        color: '#facc15',
        fillColor: 'rgba(30, 41, 59, 0.95)',
        lineWidth: 1.8,
        layer: '09_NANO_DEN_TRANG_TRI',
        info: 'Hộp đèn Downlight vuông 180x180mm'
      });

      // Mắt đèn LED vuông phát sáng trung tâm
      newEnts.push({
        id: `rap_dl_led_${dlIdx}`,
        roomId: roomId,
        type: 'RECTANGLE',
        x: dl.x - szLed / 2,
        y: dl.y - szLed / 2,
        w: szLed,
        h: szLed,
        color: '#fde047',
        fillColor: '#fef08a',
        lineWidth: 1.2,
        layer: '09_NANO_DEN_TRANG_TRI',
        info: 'Mắt LED phát sáng 4000K'
      });
    });
  }

  // 4. LÕI TRẦN TRUNG TÂM (CẤP 1 - ỐP TẤM NANO TRẮNG SÁNG + PHÀO CHỈ VÀNG)
  let corePoly = innerPolyNew ? innerPolyNew : polyNew;
  let coreBounds = getBounds(corePoly);
  let coreCenter = { x: (coreBounds.minX + coreBounds.maxX) / 2, y: (coreBounds.minY + coreBounds.maxY) / 2 };

  // Nền tấm Nano trắng
  newEnts.push({
    id: 'rap_white_core_bg',
    roomId: roomId,
    type: 'POLYGON',
    points: corePoly.map(p => [p.x, p.y]),
    color: '#94a3b8',
    fillColor: 'rgba(248, 250, 252, 0.96)',
    lineWidth: 1.5,
    layer: '07_NANO_TAM_OP',
    info: 'Lõi trần ốp tấm Nano màu trắng sáng ngọc trai'
  });

  // Mạch ghép tấm Nano trắng 400mm
  let cY = coreBounds.minY + panelStepCad;
  let cJointIdx = 0;
  while (cY < coreBounds.maxY) {
    let segs = getHSegments(corePoly, cY, isMeter);
    for (let s of segs) {
      newEnts.push({
        id: `rap_white_joint_${cJointIdx++}`,
        roomId: roomId,
        type: 'LINE',
        p1: [s[0], cY],
        p2: [s[1], cY],
        color: 'rgba(203, 213, 225, 0.7)',
        lineWidth: 1.0,
        layer: '07_NANO_TAM_OP',
        info: 'Mạch ghép tấm Nano trắng 400mm x 3m'
      });
    }
    cY += panelStepCad;
  }

  // KHUNG PHÀO CHỈ TRANG TRÍ ĐÔI & HOA VĂN 4 GÓC CHỮ VẠN
  let corniceInset = isMeter ? 0.28 : 280.0;
  let cornicePoly = offsetPolygonInward(corePoly, corniceInset);
  if (cornicePoly) {
    // Khung chỉ ngoài
    for (let i = 0, j = cornicePoly.length - 1; i < cornicePoly.length; j = i++) {
      let p1 = cornicePoly[j], p2 = cornicePoly[i];
      newEnts.push({
        id: `rap_cornice_line_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#d97706',
        lineWidth: 2.8,
        layer: '08_NANO_PHAO_CHI',
        info: 'Phào chỉ trang trí khung tranh chỉ vàng'
      });
    }

    // Khung chỉ trong cách 80mm
    let innerCornicePoly = offsetPolygonInward(cornicePoly, isMeter ? 0.08 : 80.0);
    if (innerCornicePoly) {
      for (let i = 0, j = innerCornicePoly.length - 1; i < innerCornicePoly.length; j = i++) {
        let p1 = innerCornicePoly[j], p2 = innerCornicePoly[i];
        newEnts.push({
          id: `rap_cornice_inner_${i}`,
          roomId: roomId,
          type: 'LINE',
          p1: [p1.x, p1.y],
          p2: [p2.x, p2.y],
          color: '#d97706',
          lineWidth: 1.5,
          layer: '08_NANO_PHAO_CHI'
        });
      }
    }

    // HOA VĂN 4 GÓC CHỮ VẠN / TRIỆN CỔ ĐIỂN
    let cSz = isMeter ? 0.18 : 180.0;
    for (let k = 0; k < cornicePoly.length; k++) {
      let cp = cornicePoly[k];
      let sgnX = cp.x < coreCenter.x ? 1 : -1;
      let sgnY = cp.y < coreCenter.y ? 1 : -1;

      // Họa tiết góc chữ Vạn
      newEnts.push({
        id: `rap_corner_pat_${k}_1`,
        roomId: roomId,
        type: 'LINE',
        p1: [cp.x, cp.y + sgnY * cSz],
        p2: [cp.x + sgnX * cSz, cp.y + sgnY * cSz],
        color: '#d97706',
        lineWidth: 2.0,
        layer: '08_NANO_PHAO_CHI'
      });
      newEnts.push({
        id: `rap_corner_pat_${k}_2`,
        roomId: roomId,
        type: 'LINE',
        p1: [cp.x + sgnX * cSz, cp.y],
        p2: [cp.x + sgnX * cSz, cp.y + sgnY * cSz],
        color: '#d97706',
        lineWidth: 2.0,
        layer: '08_NANO_PHAO_CHI'
      });
      newEnts.push({
        id: `rap_corner_box_${k}`,
        roomId: roomId,
        type: 'RECTANGLE',
        x: cp.x + sgnX * (cSz * 0.3) - (isMeter ? 0.03 : 30),
        y: cp.y + sgnY * (cSz * 0.3) - (isMeter ? 0.03 : 30),
        w: isMeter ? 0.06 : 60,
        h: isMeter ? 0.06 : 60,
        color: '#d97706',
        fillColor: 'rgba(217, 119, 6, 0.4)',
        layer: '08_NANO_PHAO_CHI'
      });
    }
  }

  // ĐÈN MÂM HOA LED 5 CÁNH TRUNG TÂM
  let rLampCenter = isMeter ? 0.28 : 280.0;
  newEnts.push({
    id: 'rap_center_glow',
    roomId: roomId,
    type: 'CIRCLE',
    cx: coreCenter.x,
    cy: coreCenter.y,
    r: isMeter ? 0.55 : 550.0,
    color: 'rgba(254, 240, 138, 0.3)',
    fillColor: 'rgba(254, 240, 138, 0.15)',
    layer: '09_NANO_DEN_TRANG_TRI'
  });
  newEnts.push({
    id: 'rap_center_lamp_base',
    roomId: roomId,
    type: 'CIRCLE',
    cx: coreCenter.x,
    cy: coreCenter.y,
    r: rLampCenter,
    color: '#facc15',
    fillColor: '#fef08a',
    lineWidth: 2,
    layer: '09_NANO_DEN_TRANG_TRI',
    info: 'Đèn chùm mâm hoa LED 5 cánh hiện đại'
  });

  // 5 Cánh hoa đèn mâm
  for (let petal = 0; petal < 5; petal++) {
    let angle = (petal * 72) * Math.PI / 180;
    let petalDist = isMeter ? 0.22 : 220.0;
    let px = coreCenter.x + Math.cos(angle) * petalDist;
    let py = coreCenter.y + Math.sin(angle) * petalDist;
    newEnts.push({
      id: `rap_center_petal_${petal}`,
      roomId: roomId,
      type: 'CIRCLE',
      cx: px,
      cy: py,
      r: isMeter ? 0.11 : 110.0,
      color: '#eab308',
      fillColor: '#ffffff',
      lineWidth: 1.5,
      layer: '09_NANO_DEN_TRANG_TRI'
    });
  }

  // 5. BẢNG DỰ TOÁN VẬT TƯ & PHỤ KIỆN HOÀN THIỆN
  let tabX = newXmax + (isMeter ? 1.5 : 1500);
  let tabY = newYmax;
  let tabW = isMeter ? 9.2 : 9200;
  let rh = isMeter ? 0.48 : 480;
  let th = isMeter ? 0.85 : 850;

  let downlightCount = (innerPolyNew ? ((Math.max(2, Math.round((newXmax - newXmin) / (isMeter ? 1.2 : 1200))) - 1) * 2 + (Math.max(2, Math.round((newYmax - newYmin) / (isMeter ? 1.2 : 1200))) - 1) * 2) : 0);
  let ledLengthFinishM = innerPolyNew ? (isMeter ? polyPeri(innerPolyNew) : polyPeri(innerPolyNew) / 1e3) : 0;
  let phaoChiPhaoM = realPeriM.toFixed(1);
  let phaoChiTranhM = innerPolyNew ? ((isMeter ? polyPeri(innerPolyNew) : polyPeri(innerPolyNew) / 1e3) * 0.9).toFixed(1) : 0;

  const finishRows = [
    { stt: "1", name: "Tấm Nano 400mm x 3m VÂN GỖ SỒI (Vành ngoài)", unit: "tấm", qty: `${woodPanelCount}`, note: `Ốp vành trần thấp + mặt đứng giật cấp (${woodPanelAreaM2.toFixed(1)}m²)`, color: '#b45309', icon: '■' },
    { stt: "2", name: "Tấm Nano 400mm x 3m TRẮNG SÁNG (Lõi trần)", unit: "tấm", qty: `${whitePanelCount}`, note: `Ốp diện tích lõi trần cao (${whitePanelAreaM2.toFixed(1)}m²)`, color: '#38bdf8', icon: '■' },
    { stt: "3", name: "Phào cổ trần viền tường 3.0m (Vân gỗ)", unit: "mét", qty: `${phaoChiPhaoM}`, note: `Che góc tiếp giáp giữa trần và tường (Chu vi ${realPeriM.toFixed(1)}m)`, color: '#f59e0b', icon: '━' },
    { stt: "4", name: "Phào chỉ khung tranh & Hoa văn 4 góc chữ Vạn", unit: "bộ", qty: "1 bộ", note: `Khung phào chỉ vàng kim đôi (${phaoChiTranhM}m) + 4 góc hoa văn`, color: '#d97706', icon: '❖' },
    { stt: "5", name: "Đèn Downlight LED âm trần phi 90mm (4000K)", unit: "bộ", qty: `${downlightCount}`, note: "Bố trí cách đều @1.0m - 1.2m trên vành gỗ sồi", color: '#facc15', icon: '💡' },
    { stt: "6", name: "Đèn chùm mâm hoa LED 5 cánh trung tâm", unit: "bộ", qty: "1", note: "Đèn trang trí hiện đại điều khiển 3 chế độ sáng", color: '#fde047', icon: '🌟' },
    { stt: "7", name: "Dải đèn LED dây hắt khe giật cấp 3000K", unit: "mét", qty: `${Math.ceil(ledLengthFinishM)}`, note: `Khe hắt LED âm viền mép giật cấp (${ledLengthFinishM.toFixed(1)}m)`, color: '#fde047', icon: '💡' },
    { stt: "★", name: "TỔNG DIỆN TÍCH BỀ MẶT THỰC TẾ (Sàn + Đứng)", unit: "m²", qty: `${totalActualAreaM2.toFixed(1)}`, note: `Sàn: ${realAreaM2.toFixed(1)}m² + Mặt đứng: ${verticalPanelAreaM2.toFixed(1)}m² (Tổng ${totalPanelCount} tấm)`, color: '#38bdf8', icon: '📐' },
    { stt: "⭐", name: `DIỆN TÍCH TÍNH TIỀN CÔNG THỢ (K=${laborFactor} x Sàn)`, unit: "m²", qty: `${laborAreaM2.toFixed(1)}`, note: `Quy đổi chuẩn thợ: Sàn ${realAreaM2.toFixed(1)}m² x Hệ số K=${laborFactor}`, color: '#facc15', icon: '💰' }
  ];

  let totH = th + finishRows.length * rh;
  newEnts.push({ id: 'rap_tb_1', type: 'RECTANGLE', x: tabX, y: tabY - totH, w: tabW, h: totH, color: '#f59e0b', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  newEnts.push({ id: 'rap_tb_2', type: 'RECTANGLE', x: tabX, y: tabY - th, w: tabW, h: th, color: '#f59e0b', fillColor: 'rgba(245, 158, 11, 0.25)', layer: 'BOM_TABLE' });

  newEnts.push({
    id: 'rap_tb_tt',
    type: 'TEXT',
    x: tabX + tabW / 2,
    y: tabY - (isMeter ? 0.32 : 320),
    text: 'BẢNG DỰ TOÁN TẤM NANO & PHỤ KIỆN HOÀN THIỆN',
    size: fTitle,
    color: '#facc15',
    align: 'center',
    layer: 'BOM_TABLE'
  });

  newEnts.push({
    id: 'rap_tb_sub_tt',
    type: 'TEXT',
    x: tabX + tabW / 2,
    y: tabY - (isMeter ? 0.65 : 650),
    text: `📐 SÀN: ${realAreaM2.toFixed(1)}m²  |  TẤM GỖ: ${woodPanelCount} tấm  |  TẤM TRẮNG: ${whitePanelCount} tấm  |  CÔNG THỢ (K=${laborFactor}): ${laborAreaM2.toFixed(1)}m²`,
    size: fSub,
    color: '#38bdf8',
    align: 'center',
    layer: 'BOM_TABLE'
  });

  for (let i = 0; i < finishRows.length; i++) {
    let ry = tabY - th - (i + 1) * rh;
    let item = finishRows[i];

    if (item.stt === '★' || item.stt === '⭐') {
      newEnts.push({
        id: `rap_tb_bg_${i}`,
        type: 'RECTANGLE',
        x: tabX,
        y: ry,
        w: tabW,
        h: rh,
        color: item.color,
        fillColor: item.stt === '⭐' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(56, 189, 248, 0.15)',
        layer: 'BOM_TABLE'
      });
    }

    newEnts.push({ id: `rap_tb_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_s_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.25 : 250), y: ry + rh / 2, text: item.stt, size: fSub, color: item.color || '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.55 : 550), y: ry + rh / 2, text: item.icon, size: isMeter ? 0.16 : 160, color: item.color, align: 'center', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_n_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.80 : 800), y: ry + rh / 2, text: item.name, size: isMeter ? 0.135 : 135, color: item.color, align: 'left', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_u_${i}`, type: 'TEXT', x: tabX + (isMeter ? 4.70 : 4700), y: ry + rh / 2, text: item.unit, size: isMeter ? 0.135 : 135, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_q_${i}`, type: 'TEXT', x: tabX + (isMeter ? 5.40 : 5400), y: ry + rh / 2, text: item.qty, size: isMeter ? 0.135 : 135, color: '#4ade80', align: 'center', layer: 'BOM_TABLE' });
    newEnts.push({ id: `rap_tb_g_${i}`, type: 'TEXT', x: tabX + (isMeter ? 6.00 : 6000), y: ry + rh / 2, text: item.note, size: fSub, color: item.stt === '⭐' ? '#fde047' : '#cbd5e1', align: 'left', layer: 'BOM_TABLE' });
  }

  newEnts.forEach(entity => {
    entity.roomId = roomId;
    if (entity.id && entity.id.startsWith('rap_')) entity.id = `${entity.id}_${roomId}`;
  });

  if (typeof entities !== 'undefined') {
    entities.push(...newEnts);
  }

  if (typeof render === 'function') render();

  if (typeof setInfo === 'function') {
    setInfo(`🎉 [RAPTAM] Đã tạo bản vẽ phối cảnh 2D hoàn thiện thành công (đã copy ra vị trí bên cạnh để phục vụ in ấn)!`);
  }

  return {
    roomId,
    polyNew,
    innerPolyNew,
    woodPanelCount,
    whitePanelCount,
    totalActualAreaM2,
    laborAreaM2
  };
}

window.initRAPTAMTool = function() {
  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof setInfo === 'function') {
    setInfo("👉 [RAPTAM] BƯỚC 1: Quét chọn khung trần vừa vẽ cần ráp tấm, sau đó nhấn ENTER (hoặc Space / Chuột phải):");
  }
};

window.executeRAPTAMFromSelection = function() {
  let poly = null;
  if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
    let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE');
    if (selEnts.length > 0) {
      poly = findEnclosingPolygonFromEntities(selEnts, null);
      if (!poly) {
        let probeEntity = selEnts[0];
        let probeBounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(probeEntity) : null;
        let probePoint = probeBounds ? {
          x: (probeBounds.minX + probeBounds.maxX) / 2,
          y: (probeBounds.minY + probeBounds.maxY) / 2
        } : null;
        let roomEntities = entities.filter(e => e.layer !== 'BOM_TABLE');
        poly = findEnclosingPolygonFromEntities(roomEntities, probePoint);
      }
    }
  }

  if (!poly && window.knnState && window.knnState.lastResult && window.knnState.lastResult.polyPts) {
    poly = window.knnState.lastResult.polyPts;
  }

  if (poly && poly.length >= 3) {
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    executeRAPTAMAlgorithm(poly);
  } else {
    if (typeof setInfo === 'function') {
      setInfo("👉 [RAPTAM] Hãy quét chọn các nét của khung trần vừa vẽ, sau đó nhấn ENTER để thực hiện ráp tấm.", "prompt");
    }
  }
};


window.initN3DTool = function() {
  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof setInfo === 'function') {
    setInfo("👉 [N3D] Hãy quét chọn các nét của căn phòng / khung trần cần xem 3D, sau đó nhấn ENTER:");
  }
};

window.executeN3DFromSelection = function() {
  let targetRes = null;
  let isRaptamFinish = false;

  if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
    let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE');
    if (selEnts.length > 0) {
      // 1. Thu thập toàn bộ tọa độ hình học của các đối tượng được chọn
      let xs = [], ys = [];
      let foundPoly = null;

      selEnts.forEach(e => {
        if (e.id && e.id.includes('rap_')) isRaptamFinish = true;

        if (e.type === 'POLYGON' && Array.isArray(e.points) && e.points.length >= 3) {
          let pts = e.points.map(p => Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y });
          let pXs = pts.map(p => p.x), pYs = pts.map(p => p.y);
          let spanX = Math.max(...pXs) - Math.min(...pXs);
          let spanY = Math.max(...pYs) - Math.min(...pYs);
          if (spanX > 500 || spanY > 500 || (spanX > 0.5 && spanY > 0.5)) {
            if (!foundPoly || spanX * spanY > polyArea(foundPoly)) {
              foundPoly = pts;
            }
          }
        }
        if (e.p1 && e.p2) {
          xs.push(e.p1[0], e.p2[0]);
          ys.push(e.p1[1], e.p2[1]);
        }
        if (e.x !== undefined && e.w !== undefined) {
          xs.push(e.x, e.x + e.w);
          ys.push(e.y, e.y + (e.h || 0));
        }
        if (e.cx !== undefined && e.r !== undefined) {
          xs.push(e.cx - e.r, e.cx + e.r);
          ys.push(e.cy - e.r, e.cy + e.r);
        }
      });

      let minX = (xs.length > 0) ? Math.min(...xs) : 0;
      let maxX = (xs.length > 0) ? Math.max(...xs) : 0;
      let minY = (ys.length > 0) ? Math.min(...ys) : 0;
      let maxY = (ys.length > 0) ? Math.max(...ys) : 0;
      let selCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      let selSpan = Math.max(maxX - minX, maxY - minY);

      // 2. Tìm trong allResults xem có kết quả nào có tâm gần với vùng vừa quét chọn không
      if (window.knnState && Array.isArray(window.knnState.allResults) && window.knnState.allResults.length > 0) {
        let bestMatch = null;
        let bestDist = Infinity;
        for (let r of window.knnState.allResults) {
          if (r.polyPts && r.polyPts.length >= 3) {
            let rXs = r.polyPts.map(p => p.x), rYs = r.polyPts.map(p => p.y);
            let rCx = (Math.min(...rXs) + Math.max(...rXs)) / 2;
            let rCy = (Math.min(...rYs) + Math.max(...rYs)) / 2;
            let dist = Math.hypot(selCenter.x - rCx, selCenter.y - rCy);
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = r;
            }
          }
        }
        // Nếu khoảng cách tâm < 60% kích thước phòng thì chính là phòng đó
        if (bestMatch && bestDist < Math.max(selSpan * 0.6, 2000)) {
          targetRes = bestMatch;
        }
      }

      // 3. Nếu chưa có trong allResults (ví dụ: quét phòng mới hoàn toàn hoặc bản vẽ RAPTAM copy bên cạnh)
      if (!targetRes) {
        let polyToUse = foundPoly;
        if (!polyToUse && xs.length >= 4) {
          polyToUse = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY }
          ];
        }

        if (polyToUse && polyToUse.length >= 3) {
          let pArea = polyArea(polyToUse);
          if (pArea > 1.0) { // Hợp lệ
            let isMeter = (maxX - minX < 60 && maxY - minY < 60);
            let tierWidthCad = isMeter ? 0.7 : 700;
            let innerPoly = offsetPolygonInward(polyToUse, tierWidthCad);
            let realAreaM2 = isMeter ? pArea : pArea / 1e6;

            targetRes = {
              roomId: `rm_3d_${Date.now()}`,
              polyPts: polyToUse,
              innerPoly: innerPoly,
              realAreaM2: realAreaM2,
              isMeter: isMeter,
              opt: {
                levelMode: 'cap1',
                materialType: 'nano400',
                boneSpacing: 450,
                tierWidth: 700,
                dropDepth: 150
              }
            };

            // Lưu vào allResults
            if (!window.knnState) window.knnState = {};
            if (!Array.isArray(window.knnState.allResults)) window.knnState.allResults = [];
            window.knnState.allResults.push(targetRes);
          }
        }
      }
    }
  }

  // Nếu vẫn chưa tìm thấy thì mới dùng lastResult
  if (!targetRes && window.knnState && window.knnState.lastResult && window.knnState.lastResult.polyPts) {
    targetRes = window.knnState.lastResult;
  }

  if (targetRes && targetRes.polyPts) {
    window.knnState.lastResult = targetRes;
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

    if (isRaptamFinish) {
      knn3dState.renderMode = 'finish';
    }

    window.openKNN3DModal(targetRes);
    if (typeof setInfo === 'function') {
      let rX = (Math.min(...targetRes.polyPts.map(p => p.x)) + Math.max(...targetRes.polyPts.map(p => p.x))) / 2;
      let rY = (Math.min(...targetRes.polyPts.map(p => p.y)) + Math.max(...targetRes.polyPts.map(p => p.y))) / 2;
      setInfo(`📦 Đã mở 3D phối cảnh thực tế của phòng tại tọa độ (${rX.toFixed(0)}, ${rY.toFixed(0)})!`);
    }
  } else {
    if (typeof setInfo === 'function') {
      setInfo("👉 [N3D] Hãy quét chọn các nét của căn phòng cần xem 3D, sau đó nhấn ENTER.", "prompt");
    }
  }
};

// === MODULE: trannano/8_phukien.js ===
// ===============================================================================
//     VINACAD PLUGIN: THƯ VIỆN & QUẢN LÝ PHỤ KIỆN TRẦN NANO (PHUKIENNN)
//     - Quét chọn toàn bộ/nhiều phụ kiện bằng chuột
//     - Khóa & Nhóm (Group & Lock) giữ nguyên 100% chi tiết ghép (led, hộp, glow...)
//     - Kéo thả di chuyển (Live Drag / Move) hoặc Nhân bản (Copy) sang vị trí khác
//     - Xóa toàn bộ phụ kiện được chọn / theo nhóm 1 chạm (Phím Delete / Nút Xóa)
//     - Tự do điều chỉnh kích thước Rộng (W), Dài (H), Xoay Góc (0-360°), Scale
// ===============================================================================

const KNN_ACCESSORIES_DB = [
  { id: 'hopden-vuong', name: 'Hộp Đèn Downlight Vuông', cat: 'den', img: 'galery/hopden-vuong.webp', w: 180, h: 180, unit: 'bộ', color: '#facc15', icon: '■', type: 'RECTANGLE', desc: 'Hộp đèn downlight âm trần vuông 180x180mm' },
  { id: 'hopden-chunhat', name: 'Hộp Đèn Chữ Nhật (Đôi)', cat: 'den', img: 'galery/hopden-vuong.webp', w: 320, h: 180, unit: 'bộ', color: '#facc15', icon: '▬', type: 'RECTANGLE', desc: 'Hộp đèn đôi 2 mắt led 320x180mm' },
  { id: 'mam-trang-tri-phi90', name: 'Mâm Đèn Trang Trí Phi 90', cat: 'den', img: 'galery/mam-trang-tri-phi90.jpg', w: 200, h: 200, unit: 'bộ', color: '#fde047', icon: '🌟', type: 'CIRCLE', desc: 'Mâm viền đèn trang trí phi 90mm' },
  { id: 'den-downlight-tron', name: 'Đèn Downlight Tròn Phi 90', cat: 'den', img: 'galery/den-downlight-tron.png', w: 180, h: 180, unit: 'bộ', color: '#facc15', icon: '●', type: 'CIRCLE', desc: 'Đèn âm trần tròn phi 90mm 4000K' },
  { id: 'den-chum-5canh', name: 'Đèn Chùm Mâm Hoa LED 5 Cánh', cat: 'den', img: 'galery/den-chum-5canh.png', w: 600, h: 600, unit: 'bộ', color: '#fef08a', icon: '🌟', type: 'CIRCLE', desc: 'Đèn mâm hoa trung tâm 5 cánh 3 chế độ sáng' },
  { id: 'den-quat-tran', name: 'Quạt Trần Đèn Trang Trí', cat: 'den', img: 'galery/den-quat-tran.png', w: 1200, h: 1200, unit: 'bộ', color: '#f59e0b', icon: '🌀', type: 'CIRCLE', desc: 'Quạt trần 5 cánh kèm đèn trang trí' },
  { id: 'hoa-goc', name: 'Hoa Góc Trang Trí', cat: 'hoavan', img: 'galery/hoa-goc.webp', w: 280, h: 280, unit: 'bộ (4 cái)', color: '#d97706', icon: '❖', type: 'RECTANGLE', desc: 'Hoa văn góc khung tranh chỉ vàng' },
  { id: 'hoa-goc-la-tay', name: 'Hoa Góc Hoa Lá Tây Cổ Điển', cat: 'hoavan', img: 'galery/hoa-goc-la-tay.png', w: 320, h: 320, unit: 'bộ (4 cái)', color: '#d97706', icon: '❖', type: 'RECTANGLE', desc: 'Hoa văn góc hoa lá tây mạ vàng' },
  { id: 'mam-tran-pu', name: 'Mâm Trần PU Tân Cổ Điển', cat: 'hoavan', img: 'galery/mam-tran-pu.png', w: 600, h: 600, unit: 'cái', color: '#facc15', icon: '🏵️', type: 'CIRCLE', desc: 'Mâm trần PU tròn trang trí tâm trần phi 600' },
  { id: 'phao-co-tran-ps', name: 'Phào Cổ Trần PS (Vân Gỗ)', cat: 'phao', img: 'galery/phao-co-tran-ps.jpg', w: 120, h: 3000, unit: 'mét', color: '#b45309', icon: '━', type: 'LINE', desc: 'Phào viền chân tường PS vân gỗ sồi' },
  { id: 'phao-can-ps', name: 'Phào Chỉ Khung Tranh PS', cat: 'phao', img: 'galery/phao-can-ps.webp', w: 60, h: 3000, unit: 'mét', color: '#d97706', icon: '━', type: 'LINE', desc: 'Chỉ phào nẹp khung tranh màu vàng kim' },
  { id: 'nep-v', name: 'Nẹp V Viền Tường (3.0m)', cat: 'phao', img: 'galery/nep-v.jpg', w: 30, h: 3000, unit: 'cây', color: '#38bdf8', icon: '━', type: 'LINE', desc: 'Nẹp V nhôm/nhựa viền tường 3.0m' },
  { id: 'nep-goc-trong', name: 'Nẹp Góc Trong Giật Cấp', cat: 'phao', img: 'galery/nep-goc-trong.jpg', w: 30, h: 3000, unit: 'cây', color: '#f59e0b', icon: '━', type: 'LINE', desc: 'Nẹp góc trong bo mép thành giật cấp' }
];

window.knnPhuKienState = {
  mode: 'PLACE', // 'PLACE' | 'SELECT_GROUP' | 'MOVE_BASE' | 'EDIT' | 'ERASE'
  activeAccId: 'hopden-vuong',
  activeAcc: KNN_ACCESSORIES_DB[0],
  customW: 180,
  customH: 180,
  scalePercent: 100,
  rotationDeg: 0,
  eraserMode: false,
  filterCat: 'all',
  selectedIds: new Set(),
  selectedGroupPrefix: null,
  selectedEnt: null,
  dragStartPt: null,
  moveBasePt: null,
  isDraggingSelection: false,
  selectionBoxStart: null
};

// Hàm nhận diện chuẩn xác đơn vị vẽ (mm hay mét)
function detectDrawingUnitInfo() {
  if (window.knnState && window.knnState.lastResult && typeof window.knnState.lastResult.isMeter === 'boolean') {
    let isMeter = window.knnState.lastResult.isMeter;
    return { isMeter: isMeter, scale: isMeter ? 0.001 : 1.0 };
  }
  if (typeof entities !== 'undefined' && Array.isArray(entities) && entities.length > 0) {
    let maxDim = 0;
    let maxCoord = 0;
    entities.forEach(e => {
      if (e.layer === 'BOM_TABLE') return;
      if (e.w !== undefined) maxDim = Math.max(maxDim, Math.abs(e.w));
      if (e.h !== undefined) maxDim = Math.max(maxDim, Math.abs(e.h));
      if (e.r !== undefined) maxDim = Math.max(maxDim, Math.abs(e.r) * 2);
      if (e.x1 !== undefined && e.x2 !== undefined) {
        maxDim = Math.max(maxDim, Math.abs(e.x2 - e.x1), Math.abs(e.y2 - e.y1));
      }
      if (e.p1 && e.p2) {
        maxDim = Math.max(maxDim, Math.abs(e.p2[0] - e.p1[0]), Math.abs(e.p2[1] - e.p1[1]));
      }
      if (e.x !== undefined) maxCoord = Math.max(maxCoord, Math.abs(e.x));
      if (e.y !== undefined) maxCoord = Math.max(maxCoord, Math.abs(e.y));
    });
    let isMeter = (maxDim > 0 && maxDim < 70) && (maxCoord < 120);
    return { isMeter: isMeter, scale: isMeter ? 0.001 : 1.0 };
  }
  return { isMeter: false, scale: 1.0 };
}

// Hàm tính tọa độ 4 đỉnh hình chữ nhật xoay quanh tâm (cx, cy)
function getRotatedBoxPolygon(cx, cy, w, h, rotDeg) {
  let rad = (rotDeg * Math.PI) / 180.0;
  let cos = Math.cos(rad), sin = Math.sin(rad);
  let hw = w / 2.0, hh = h / 2.0;
  let localCorners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh }
  ];
  return localCorners.map(c => [
    cx + c.x * cos - c.y * sin,
    cy + c.x * sin + c.y * cos
  ]);
}

window.openPhuKienPalette = function() {
  let oldPanel = document.getElementById('knn-phukien-palette');
  if (oldPanel) oldPanel.remove();

  let panel = document.createElement('div');
  panel.id = 'knn-phukien-palette';
  panel.style.position = 'fixed';
  panel.style.top = '45px';
  panel.style.right = '16px';
  panel.style.width = '440px';
  panel.style.maxHeight = '92vh';
  panel.style.zIndex = '9999';
  panel.style.background = 'rgba(15, 23, 42, 0.98)';
  panel.style.border = '2px solid #06b6d4';
  panel.style.borderRadius = '14px';
  panel.style.boxShadow = '0 12px 40px rgba(0,0,0,0.85)';
  panel.style.backdropFilter = 'blur(12px)';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.color = '#e2e8f0';
  panel.style.overflow = 'hidden';

  panel.innerHTML = `
    <!-- HEADER -->
    <div id="knn-pk-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#1e293b; border-bottom:1.5px solid #334155; cursor:move; user-select:none;">
      <div style="font-weight:bold; font-size:13px; color:#38bdf8; display:flex; align-items:center; gap:6px;">
        🛍️ THƯ VIỆN & QUẢN LÝ PHỤ KIỆN TRẦN NANO
      </div>
      <button onclick="document.getElementById('knn-phukien-palette').remove()" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; font-weight:bold;">✕</button>
    </div>

    <!-- CÁC CHẾ ĐỘ THAO TÁC (TABS MODE) -->
    <div style="display:grid; grid-template-columns:1fr 1.1fr 0.9fr; gap:4px; padding:8px 10px; background:#0f172a; border-bottom:1.5px solid #334155;">
      <button id="knn-pk-mode-place-btn" onclick="window.setPhuKienMode('PLACE')" style="padding:6px 4px; font-size:11px; font-weight:bold; border-radius:6px; border:none; background:${window.knnPhuKienState.mode === 'PLACE' ? '#0284c7' : '#1e293b'}; color:${window.knnPhuKienState.mode === 'PLACE' ? '#fff' : '#94a3b8'}; cursor:pointer;">
        ➕ Gắn Mới
      </button>
      <button id="knn-pk-mode-select-btn" onclick="window.setPhuKienMode('SELECT_GROUP')" style="padding:6px 4px; font-size:11px; font-weight:bold; border-radius:6px; border:none; background:${window.knnPhuKienState.mode === 'SELECT_GROUP' ? '#8b5cf6' : '#1e293b'}; color:${window.knnPhuKienState.mode === 'SELECT_GROUP' ? '#fff' : '#94a3b8'}; cursor:pointer;">
        🔲 Quét Chọn / Nhóm
      </button>
      <button id="knn-pk-mode-erase-btn" onclick="window.setPhuKienMode('ERASE')" style="padding:6px 4px; font-size:11px; font-weight:bold; border-radius:6px; border:none; background:${window.knnPhuKienState.mode === 'ERASE' ? '#dc2626' : '#1e293b'}; color:${window.knnPhuKienState.mode === 'ERASE' ? '#fff' : '#94a3b8'}; cursor:pointer;">
        🗑️ Gôm Xóa
      </button>
    </div>

    <!-- BẢNG ĐIỀU KHIỂN NHÓM & DI CHUYỂN (HIỂN THỊ KHI Ở CHẾ ĐỘ SELECT_GROUP HOẶC CÓ ĐỐI TƯỢNG ĐƯỢC CHỌN) -->
    <div id="knn-pk-group-toolbar" style="padding:8px 10px; background:#1e1b4b; border-bottom:1.5px solid #8b5cf6; display:flex; flex-direction:column; gap:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:bold; color:#c084fc; font-size:11px;" id="knn-pk-group-status-lbl">
          📦 Đang chọn: ${window.knnPhuKienState.selectedIds.size} chi tiết phụ kiện
        </span>
        <button onclick="window.selectAllCeilingAccessories()" style="padding:2px 6px; font-size:10px; background:#4338ca; color:#fff; border:none; border-radius:4px; cursor:pointer;">
          ✨ Chọn Hết
        </button>
      </div>

      <div style="display:flex; gap:4px; flex-wrap:wrap;">
        <button onclick="window.groupAndLockSelectedAccessories()" style="flex:1; padding:5px 6px; font-size:11px; font-weight:bold; background:#7c3aed; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Khóa toàn bộ phụ kiện đã chọn thành 1 khối vững chắc">
          🔒 Khóa & Tạo Nhóm
        </button>
        <button onclick="window.ungroupSelectedAccessories()" style="padding:5px 6px; font-size:11px; background:#334155; color:#cbd5e1; border:none; border-radius:4px; cursor:pointer;" title="Rã khối nhóm để sửa từng món lẻ">
          🔓 Rã Nhóm
        </button>
        <button onclick="window.startMoveSelectedAccessories()" style="flex:1; padding:5px 6px; font-size:11px; font-weight:bold; background:#059669; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Kéo qua vị trí mới trên trần mà không mất nét ghép nào">
          🚚 Kéo Di Chuyển
        </button>
        <button onclick="window.duplicateSelectedAccessories()" style="padding:5px 6px; font-size:11px; background:#0284c7; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Nhân bản thêm 1 cụm y hệt">
          📋 Nhân Bản
        </button>
        <button onclick="window.deleteSelectedAccessories()" style="padding:5px 6px; font-size:11px; font-weight:bold; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Xóa toàn bộ phụ kiện đang chọn">
          🗑️ Xóa Đã Chọn
        </button>
      </div>
    </div>

    <!-- KHU VỰC HIỆU CHỈNH KÍCH THƯỚC & XOAY GÓC TRỰC TIẾP -->
    <div id="knn-pk-transform-box" style="padding:8px 12px; background:#1e293b; border-bottom:1.5px solid #0ea5e9; font-size:11px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-weight:bold; color:#38bdf8; font-size:11px;" id="knn-pk-transform-title">
          🎛️ THIẾT LẬP KÍCH THƯỚC PHỤ KIỆN
        </span>
        <button onclick="window.resetPhuKienTransform()" style="padding:2px 8px; font-size:10px; background:#334155; color:#cbd5e1; border:1px solid #475569; border-radius:4px; cursor:pointer;">↺ Reset chuẩn</button>
      </div>

      <!-- KÍCH THƯỚC RỘNG x DÀI (W x H) -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
        <!-- Rộng (W) -->
        <div style="background:#0f172a; padding:4px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:10px; margin-bottom:2px;">
            <span>Rộng (W):</span>
            <span style="color:#38bdf8; font-weight:bold;" id="knn-pk-val-w-label">${Math.round(window.knnPhuKienState.customW)} mm</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="number" id="knn-pk-input-w" value="${Math.round(window.knnPhuKienState.customW)}" step="10" min="10" max="6000" oninput="window.updatePhuKienDimensionW(this.value)" style="flex:1; width:55px; background:#1e293b; border:1px solid #475569; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;" />
            <button onclick="window.adjustWBy(-20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer;">-20</button>
            <button onclick="window.adjustWBy(+20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer;">+20</button>
          </div>
        </div>

        <!-- Dài / Cao (H) -->
        <div style="background:#0f172a; padding:4px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:10px; margin-bottom:2px;">
            <span>Dài (H):</span>
            <span style="color:#38bdf8; font-weight:bold;" id="knn-pk-val-h-label">${Math.round(window.knnPhuKienState.customH)} mm</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="number" id="knn-pk-input-h" value="${Math.round(window.knnPhuKienState.customH)}" step="10" min="10" max="6000" oninput="window.updatePhuKienDimensionH(this.value)" style="flex:1; width:55px; background:#1e293b; border:1px solid #475569; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;" />
            <button onclick="window.adjustHBy(-20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer;">-20</button>
            <button onclick="window.adjustHBy(+20)" style="padding:2px 5px; background:#334155; color:#fff; border:none; border-radius:3px; cursor:pointer;">+20</button>
          </div>
        </div>
      </div>

      <!-- XOAY GÓC & PHÓNG TO THU NHỎ SLIDERS -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:center;">
        <!-- Xoay góc -->
        <div style="background:#0f172a; padding:4px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:10px; margin-bottom:2px;">
            <span>Góc Xoay:</span>
            <span id="knn-pk-rot-val" style="font-weight:bold; color:#facc15;">${window.knnPhuKienState.rotationDeg}°</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="range" id="knn-pk-slider-rot" min="0" max="360" step="15" value="${window.knnPhuKienState.rotationDeg}" oninput="window.setPhuKienRotation(this.value)" style="flex:1; cursor:pointer;" />
            <button onclick="window.rotatePhuKienBy(45)" style="padding:2px 5px; background:#334155; color:#38bdf8; border:none; border-radius:3px; cursor:pointer; font-size:10px;">🔄+45°</button>
          </div>
        </div>

        <!-- Tỉ lệ Scale -->
        <div style="background:#0f172a; padding:4px 8px; border-radius:6px; border:1px solid #334155;">
          <div style="display:flex; justify-content:space-between; color:#94a3b8; font-size:10px; margin-bottom:2px;">
            <span>Phóng To/Thu Nhỏ:</span>
            <span id="knn-pk-scale-val" style="font-weight:bold; color:#38bdf8;">${window.knnPhuKienState.scalePercent}%</span>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="range" id="knn-pk-slider-scale" min="30" max="300" step="5" value="${window.knnPhuKienState.scalePercent}" oninput="window.setPhuKienScale(this.value)" style="flex:1; cursor:pointer;" />
            <button onclick="window.setPhuKienScale(100)" style="padding:2px 5px; background:#334155; color:#cbd5e1; border:none; border-radius:3px; cursor:pointer; font-size:10px;">100%</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TABS PHÂN LOẠI DANH MỤC -->
    <div style="display:flex; gap:4px; padding:6px 12px; background:#0f172a; border-bottom:1px solid #334155;">
      <button onclick="window.filterPhuKienCat('all')" id="knn-pk-tab-all" style="padding:3px 8px; font-size:11px; border-radius:4px; border:none; background:#0ea5e9; color:#fff; cursor:pointer; font-weight:bold;">Tất Cả</button>
      <button onclick="window.filterPhuKienCat('den')" id="knn-pk-tab-den" style="padding:3px 8px; font-size:11px; border-radius:4px; border:none; background:#1e293b; color:#94a3b8; cursor:pointer;">💡 Hộp Đèn</button>
      <button onclick="window.filterPhuKienCat('hoavan')" id="knn-pk-tab-hoavan" style="padding:3px 8px; font-size:11px; border-radius:4px; border:none; background:#1e293b; color:#94a3b8; cursor:pointer;">❖ Hoa Văn</button>
      <button onclick="window.filterPhuKienCat('phao')" id="knn-pk-tab-phao" style="padding:3px 8px; font-size:11px; border-radius:4px; border:none; background:#1e293b; color:#94a3b8; cursor:pointer;">━ Phào Nẹp</button>

      <button onclick="window.clearAllCeilingAccessories()" style="margin-left:auto; padding:2px 7px; font-size:10px; background:#1e293b; color:#f87171; border:1px solid #ef4444; border-radius:4px; cursor:pointer;">🧹 Xóa Hết</button>
    </div>

    <!-- DANH SÁCH PHỤ KIỆN GRID -->
    <div id="knn-pk-list-container" style="flex:1; overflow-y:auto; padding:10px; display:grid; grid-template-columns:1fr 1fr; gap:10px; max-height:36vh;">
    </div>

    <!-- FOOTER HƯỚNG DẪN -->
    <div style="padding:7px 12px; background:#1e293b; border-top:1px solid #334155; font-size:11px; color:#cbd5e1; line-height:1.35;">
      💡 <b>Hướng dẫn</b>: Quét chuột trên trần để chọn cụm phụ kiện ➜ Bấm <b>🔒 Khóa Nhóm</b> ➜ Kéo chuột để dời vị trí hoặc bấm <b>🗑️ Xóa</b>.
    </div>
  `;

  document.body.appendChild(panel);
  renderPhuKienList();
  makeDraggable(panel, document.getElementById('knn-pk-header'));
};

window.setPhuKienMode = function(mode) {
  window.knnPhuKienState.mode = mode;
  window.knnPhuKienState.eraserMode = (mode === 'ERASE');
  window.knnPhuKienState.moveBasePt = null;

  let pBtn = document.getElementById('knn-pk-mode-place-btn');
  let sBtn = document.getElementById('knn-pk-mode-select-btn');
  let erBtn = document.getElementById('knn-pk-mode-erase-btn');

  if (pBtn) {
    pBtn.style.background = (mode === 'PLACE') ? '#0284c7' : '#1e293b';
    pBtn.style.color = (mode === 'PLACE') ? '#fff' : '#94a3b8';
  }
  if (sBtn) {
    sBtn.style.background = (mode === 'SELECT_GROUP') ? '#8b5cf6' : '#1e293b';
    sBtn.style.color = (mode === 'SELECT_GROUP') ? '#fff' : '#94a3b8';
  }
  if (erBtn) {
    erBtn.style.background = (mode === 'ERASE') ? '#dc2626' : '#1e293b';
    erBtn.style.color = (mode === 'ERASE') ? '#fff' : '#94a3b8';
  }

  updateTransformInputsUI();
  updateGroupStatusUI();
  if (typeof selectTool === 'function') selectTool('PHUKIENNN');

  if (typeof setInfo === 'function') {
    if (mode === 'PLACE') {
      let accName = window.knnPhuKienState.activeAcc ? window.knnPhuKienState.activeAcc.name : 'Phụ kiện';
      setInfo(`👉 [GẮN MỚI] Đang chọn "${accName}". Nhấp chuột lên trần để đặt (R: xoay, +/-: to nhỏ).`);
    } else if (mode === 'SELECT_GROUP') {
      setInfo(`👉 [QUÉT CHỌN / NHÓM] Kéo chuột quét chọn các phụ kiện trên trần, sau đó bấm "🔒 Khóa & Tạo Nhóm" hoặc "🚚 Kéo Di Chuyển".`);
    } else if (mode === 'ERASE') {
      setInfo(`👉 [GÔM XÓA] Nhấp chuột vào bất kỳ phụ kiện nào trên trần để xóa.`);
    }
  }
  renderPhuKienList();
};

function updateGroupStatusUI() {
  let lbl = document.getElementById('knn-pk-group-status-lbl');
  if (lbl) {
    let count = window.knnPhuKienState.selectedIds ? window.knnPhuKienState.selectedIds.size : 0;
    lbl.innerText = `📦 Đang chọn: ${count} chi tiết phụ kiện`;
    lbl.style.color = count > 0 ? '#38bdf8' : '#c084fc';
  }
}

function renderPhuKienList() {
  const container = document.getElementById('knn-pk-list-container');
  if (!container) return;
  container.innerHTML = '';

  let curCat = window.knnPhuKienState.filterCat;
  let list = KNN_ACCESSORIES_DB.filter(item => curCat === 'all' || item.cat === curCat);

  list.forEach(item => {
    let isSelected = (window.knnPhuKienState.activeAccId === item.id);
    let card = document.createElement('div');
    card.style.background = isSelected ? '#1e3a8a' : '#1e293b';
    card.style.border = isSelected ? '2px solid #38bdf8' : '1px solid #334155';
    card.style.borderRadius = '8px';
    card.style.padding = '8px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.cursor = 'pointer';
    card.style.transition = 'all 0.2s';
    card.draggable = true;

    let svgIcon = '';
    if (item.id === 'hopden-vuong') {
      svgIcon = `<svg width="48" height="48" viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" rx="4" fill="#0f172a" stroke="#facc15" stroke-width="2.5"/><rect x="14" y="14" width="20" height="20" rx="2" fill="#fef08a" stroke="#eab308" stroke-width="1.5"/></svg>`;
    } else if (item.id === 'hopden-chunhat') {
      svgIcon = `<svg width="60" height="40" viewBox="0 0 60 40"><rect x="4" y="6" width="52" height="28" rx="4" fill="#0f172a" stroke="#facc15" stroke-width="2.5"/><rect x="10" y="11" width="16" height="18" rx="2" fill="#fef08a"/><rect x="34" y="11" width="16" height="18" rx="2" fill="#fef08a"/></svg>`;
    } else if (item.id.includes('tron') || item.id.includes('phi90')) {
      svgIcon = `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#0f172a" stroke="#facc15" stroke-width="2.5"/><circle cx="24" cy="24" r="10" fill="#fef08a"/></svg>`;
    } else {
      svgIcon = `<span style="font-size:32px; color:${item.color};">${item.icon}</span>`;
    }

    card.innerHTML = `
      <div style="width:100%; height:82px; background:#0f172a; border-radius:6px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; margin-bottom:4px;">
        <img src="${item.img}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="max-width:92%; max-height:92%; object-fit:contain; display:block;" />
        <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">
          ${svgIcon}
        </div>
      </div>
      <div style="font-size:11px; font-weight:bold; color:#f8fafc; text-align:center; line-height:1.25; margin-bottom:3px; height:26px; display:flex; align-items:center;">
        ${item.name}
      </div>
      <div style="font-size:10px; color:#94a3b8; margin-bottom:4px;">
        KT chuẩn: ${item.w} x ${item.h} mm
      </div>
      <button style="width:100%; padding:3px; font-size:10px; font-weight:bold; background:${isSelected ? '#22c55e' : '#0284c7'}; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="event.stopPropagation(); window.selectPhuKienToPlace('${item.id}');">
        ${isSelected ? '✓ ĐANG CHỌN' : '+ Chọn Đặt'}
      </button>
    `;

    card.onclick = () => window.selectPhuKienToPlace(item.id);

    card.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', item.id);
      window.selectPhuKienToPlace(item.id);
    };

    container.appendChild(card);
  });
}

window.filterPhuKienCat = function(cat) {
  window.knnPhuKienState.filterCat = cat;
  ['all', 'den', 'hoavan', 'phao'].forEach(c => {
    let btn = document.getElementById(`knn-pk-tab-${c}`);
    if (btn) {
      btn.style.background = (c === cat) ? '#0ea5e9' : '#1e293b';
      btn.style.color = (c === cat) ? '#fff' : '#94a3b8';
      btn.style.fontWeight = (c === cat) ? 'bold' : 'normal';
    }
  });
  renderPhuKienList();
};

window.selectPhuKienToPlace = function(accId) {
  let acc = KNN_ACCESSORIES_DB.find(a => a.id === accId);
  if (!acc) return;
  window.knnPhuKienState.activeAccId = accId;
  window.knnPhuKienState.activeAcc = acc;
  window.knnPhuKienState.customW = acc.w;
  window.knnPhuKienState.customH = acc.h;
  window.knnPhuKienState.selectedGroupPrefix = null;
  window.knnPhuKienState.mode = 'PLACE';
  window.knnPhuKienState.eraserMode = false;

  updateTransformInputsUI();

  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

  if (typeof selectTool === 'function') selectTool('PHUKIENNN');
  if (typeof setInfo === 'function') {
    setInfo(`👉 [PHUKIENNN] Đang chọn "${acc.name}" (${acc.w}x${acc.h}mm). Nhấp chuột lên trần để đặt ngay.`);
  }
  renderPhuKienList();
};

function updateTransformInputsUI() {
  let inW = document.getElementById('knn-pk-input-w');
  let inH = document.getElementById('knn-pk-input-h');
  let lblW = document.getElementById('knn-pk-val-w-label');
  let lblH = document.getElementById('knn-pk-val-h-label');
  let slRot = document.getElementById('knn-pk-slider-rot');
  let valRot = document.getElementById('knn-pk-rot-val');
  let slScale = document.getElementById('knn-pk-slider-scale');
  let valScale = document.getElementById('knn-pk-scale-val');
  let title = document.getElementById('knn-pk-transform-title');

  let curW = Math.round(window.knnPhuKienState.customW);
  let curH = Math.round(window.knnPhuKienState.customH);

  if (inW) inW.value = curW;
  if (inH) inH.value = curH;
  if (lblW) lblW.innerText = `${curW} mm`;
  if (lblH) lblH.innerText = `${curH} mm`;
  if (slRot) slRot.value = window.knnPhuKienState.rotationDeg;
  if (valRot) valRot.innerText = `${window.knnPhuKienState.rotationDeg}°`;
  if (slScale) slScale.value = window.knnPhuKienState.scalePercent;
  if (valScale) valScale.innerText = `${window.knnPhuKienState.scalePercent}%`;

  if (title) {
    if (window.knnPhuKienState.selectedIds && window.knnPhuKienState.selectedIds.size > 0) {
      title.innerHTML = `✏️ ĐIỀU CHỈNH CỤM PHỤ KIỆN ĐANG CHỌN (${window.knnPhuKienState.selectedIds.size} chi tiết)`;
      title.style.color = '#c084fc';
    } else if (window.knnPhuKienState.activeAcc) {
      title.innerHTML = `🎛️ THIẾT LẬP KÍCH THƯỚC: ${window.knnPhuKienState.activeAcc.name}`;
      title.style.color = '#38bdf8';
    } else {
      title.innerHTML = `🎛️ BỘ ĐIỀU CHỈNH KÍCH THƯỚC & XOAY GÓC`;
      title.style.color = '#94a3b8';
    }
  }
}

window.updatePhuKienDimensionW = function(val) {
  let num = Math.max(10, parseFloat(val) || 180);
  window.knnPhuKienState.customW = num;
  let lbl = document.getElementById('knn-pk-val-w-label');
  if (lbl) lbl.innerText = `${Math.round(num)} mm`;

  if (window.knnPhuKienState.selectedGroupPrefix) {
    applyTransformToSelectedCeilingAccessory();
  }
};

window.updatePhuKienDimensionH = function(val) {
  let num = Math.max(10, parseFloat(val) || 180);
  window.knnPhuKienState.customH = num;
  let lbl = document.getElementById('knn-pk-val-h-label');
  if (lbl) lbl.innerText = `${Math.round(num)} mm`;

  if (window.knnPhuKienState.selectedGroupPrefix) {
    applyTransformToSelectedCeilingAccessory();
  }
};

window.adjustWBy = function(delta) {
  let inW = document.getElementById('knn-pk-input-w');
  let newW = Math.max(10, Math.round(window.knnPhuKienState.customW + delta));
  window.knnPhuKienState.customW = newW;
  if (inW) inW.value = newW;
  window.updatePhuKienDimensionW(newW);
};

window.adjustHBy = function(delta) {
  let inH = document.getElementById('knn-pk-input-h');
  let newH = Math.max(10, Math.round(window.knnPhuKienState.customH + delta));
  window.knnPhuKienState.customH = newH;
  if (inH) inH.value = newH;
  window.updatePhuKienDimensionH(newH);
};

window.setPhuKienRotation = function(deg) {
  let val = ((parseInt(deg) || 0) % 360 + 360) % 360;
  window.knnPhuKienState.rotationDeg = val;
  updateTransformInputsUI();
  if (window.knnPhuKienState.selectedGroupPrefix) {
    applyTransformToSelectedCeilingAccessory();
  }
};

window.rotatePhuKienBy = function(deltaDeg) {
  window.setPhuKienRotation(window.knnPhuKienState.rotationDeg + deltaDeg);
};

window.setPhuKienScale = function(percent) {
  window.knnPhuKienState.scalePercent = Math.max(20, Math.min(500, parseInt(percent) || 100));
  updateTransformInputsUI();
  if (window.knnPhuKienState.selectedGroupPrefix) {
    applyTransformToSelectedCeilingAccessory();
  }
};

window.resetPhuKienTransform = function() {
  if (window.knnPhuKienState.activeAcc) {
    window.knnPhuKienState.customW = window.knnPhuKienState.activeAcc.w;
    window.knnPhuKienState.customH = window.knnPhuKienState.activeAcc.h;
  } else {
    window.knnPhuKienState.customW = 180;
    window.knnPhuKienState.customH = 180;
  }
  window.knnPhuKienState.scalePercent = 100;
  window.knnPhuKienState.rotationDeg = 0;
  updateTransformInputsUI();
  if (window.knnPhuKienState.selectedGroupPrefix) {
    applyTransformToSelectedCeilingAccessory();
  }
};

// ===============================================================================
//     TÍNH NĂNG QUÉT CHỌN, KHÓA NHÓM, DI CHUYỂN & NHÂN BẢN PHỤ KIỆN
// ===============================================================================

// 1. Chọn toàn bộ phụ kiện trên trần
window.selectAllCeilingAccessories = function() {
  if (typeof entities === 'undefined') return;
  window.knnPhuKienState.selectedIds.clear();

  entities.forEach(e => {
    let id = e.id || '';
    let isAcc = id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_');
    if (isAcc) {
      window.knnPhuKienState.selectedIds.add(id);
    }
  });

  window.knnPhuKienState.mode = 'SELECT_GROUP';
  updateGroupStatusUI();
  updateTransformInputsUI();
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`👉 Đã chọn toàn bộ ${window.knnPhuKienState.selectedIds.size} chi tiết phụ kiện trên trần. Bấm "🔒 Khóa & Tạo Nhóm" hoặc "🚚 Kéo Di Chuyển".`);
  }
};

// 2. Khóa & Nhóm toàn bộ phụ kiện được chọn thành 1 khối vững chắc
window.groupAndLockSelectedAccessories = function() {
  if (!window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) {
    if (typeof setInfo === 'function') setInfo("⚠️ Chưa chọn phụ kiện nào để nhóm. Hãy quét chọn trước!");
    return;
  }

  let groupId = `pk_group_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  let count = 0;

  entities.forEach(e => {
    if (window.knnPhuKienState.selectedIds.has(e.id)) {
      e.groupId = groupId;
      count++;
    }
  });

  window.knnPhuKienState.selectedGroupPrefix = groupId;
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`🔒 ĐÃ KHÓA & TẠO NHÓM ${count} CHI TIẾT THÀNH 1 KHỐI LIỀN. Giờ bạn có thể kéo di chuyển mà không lo mất nét ghép!`);
  }
};

// 3. Rã nhóm
window.ungroupSelectedAccessories = function() {
  if (!window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) return;
  let count = 0;
  entities.forEach(e => {
    if (window.knnPhuKienState.selectedIds.has(e.id) && e.groupId) {
      delete e.groupId;
      count++;
    }
  });
  window.knnPhuKienState.selectedGroupPrefix = null;
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`🔓 Đã rã nhóm ${count} chi tiết.`);
  }
};

// 4. Kích hoạt chế độ kéo di chuyển
window.startMoveSelectedAccessories = function() {
  if (!window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) {
    if (typeof setInfo === 'function') setInfo("⚠️ Hãy quét chọn các phụ kiện cần di chuyển trước!");
    return;
  }
  window.knnPhuKienState.mode = 'MOVE_BASE';
  window.knnPhuKienState.moveBasePt = null;
  if (typeof setInfo === 'function') {
    setInfo("👉 [DI CHUYỂN] BƯỚC 1: Nhấp chuột vào 1 ĐIỂM GỐC trên cụm phụ kiện cần dời:");
  }
};

// 5. Di chuyển các chi tiết theo độ dời (dx, dy) - Giữ nguyên 100% chi tiết hình học
function translateEntitiesByDelta(targetIds, dx, dy) {
  if (typeof entities === 'undefined' || !targetIds || targetIds.size === 0) return;

  entities.forEach(e => {
    if (!targetIds.has(e.id)) return;

    if (e.type === 'POLYGON' && e.points) {
      e.points = e.points.map(p => {
        if (Array.isArray(p)) return [p[0] + dx, p[1] + dy];
        return { x: p.x + dx, y: p.y + dy };
      });
    }
    if (e.x !== undefined) e.x += dx;
    if (e.y !== undefined) e.y += dy;
    if (e.cx !== undefined) e.cx += dx;
    if (e.cy !== undefined) e.cy += dy;
    if (e.p1 && e.p2) {
      e.p1[0] += dx; e.p1[1] += dy;
      e.p2[0] += dx; e.p2[1] += dy;
    }
  });

  if (typeof render === 'function') render();
}

// 6. Nhân bản cụm phụ kiện đã chọn
window.duplicateSelectedAccessories = function() {
  if (!window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) return;

  let unitInfo = detectDrawingUnitInfo();
  let offset = unitInfo.isMeter ? 0.6 : 600.0; // Offset sang phải một chút để dễ nhìn
  let newIds = new Set();
  let clones = [];

  entities.forEach(e => {
    if (!window.knnPhuKienState.selectedIds.has(e.id)) return;
    let clone = JSON.parse(JSON.stringify(e));
    let newUniqueId = `pk_clone_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    clone.id = newUniqueId;

    if (clone.type === 'POLYGON' && clone.points) {
      clone.points = clone.points.map(p => Array.isArray(p) ? [p[0] + offset, p[1] + offset] : { x: p.x + offset, y: p.y + offset });
    }
    if (clone.x !== undefined) clone.x += offset;
    if (clone.y !== undefined) clone.y += offset;
    if (clone.cx !== undefined) clone.cx += offset;
    if (clone.cy !== undefined) clone.cy += offset;
    if (clone.p1 && clone.p2) {
      clone.p1[0] += offset; clone.p1[1] += offset;
      clone.p2[0] += offset; clone.p2[1] += offset;
    }

    clones.push(clone);
    newIds.add(clone.id);
  });

  entities.push(...clones);
  window.knnPhuKienState.selectedIds = newIds;
  updateGroupStatusUI();
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`📋 Đã nhân bản ${clones.length} chi tiết phụ kiện sang vị trí mới (+600mm).`);
  }
};

// 7. Xóa toàn bộ phụ kiện được chọn
window.deleteSelectedAccessories = function() {
  if (!window.knnPhuKienState.selectedIds || window.knnPhuKienState.selectedIds.size === 0) return;
  let count = window.knnPhuKienState.selectedIds.size;

  entities = entities.filter(e => !window.knnPhuKienState.selectedIds.has(e.id));
  window.knnPhuKienState.selectedIds.clear();
  window.knnPhuKienState.selectedGroupPrefix = null;

  updateGroupStatusUI();
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`🗑️ Đã xóa thành công ${count} chi tiết phụ kiện.`);
  }
};

// Áp dụng thay đổi kích thước/góc xoay vào đối tượng đang được chọn trên trần
function applyTransformToSelectedCeilingAccessory() {
  let prefix = window.knnPhuKienState.selectedGroupPrefix;
  if (!prefix || typeof entities === 'undefined') return;

  let unitInfo = detectDrawingUnitInfo();
  let scaleUnit = unitInfo.scale;

  let groupEnts = entities.filter(e => e.id && (e.id.startsWith(prefix) || e.groupId === prefix));
  if (groupEnts.length === 0) return;

  let mainEnt = groupEnts.find(e => e.id === prefix) || groupEnts[0];
  let centerPt = { x: mainEnt.cx || 0, y: mainEnt.cy || 0 };
  if (mainEnt.cx === undefined && mainEnt.x !== undefined) {
    centerPt = { x: mainEnt.x + (mainEnt.w || 0) / 2, y: mainEnt.y + (mainEnt.h || 0) / 2 };
  }
  if (mainEnt.points && mainEnt.points.length > 0) {
    let xs = mainEnt.points.map(p => Array.isArray(p) ? p[0] : p.x);
    let ys = mainEnt.points.map(p => Array.isArray(p) ? p[1] : p.y);
    centerPt = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }

  let accId = mainEnt.accId || (window.knnPhuKienState.activeAcc ? window.knnPhuKienState.activeAcc.id : 'hopden-vuong');
  let accObj = KNN_ACCESSORIES_DB.find(a => a.id === accId) || window.knnPhuKienState.activeAcc || {
    id: accId, name: mainEnt.accName || 'Phụ kiện', color: mainEnt.color || '#facc15', type: mainEnt.type || 'RECTANGLE'
  };

  entities = entities.filter(e => !(e.id && (e.id.startsWith(prefix) || e.groupId === prefix)));

  let finalW = window.knnPhuKienState.customW * (window.knnPhuKienState.scalePercent / 100.0) * scaleUnit;
  let finalH = window.knnPhuKienState.customH * (window.knnPhuKienState.scalePercent / 100.0) * scaleUnit;
  let rotDeg = window.knnPhuKienState.rotationDeg;

  let regenerated = generateAccessoryEntities(prefix, centerPt, accObj, finalW, finalH, rotDeg, unitInfo.isMeter);
  entities.push(...regenerated);

  if (typeof render === 'function') render();
}

// Xử lý nhấp chuột trên màn hình Canvas khi đang ở chế độ PHUKIENNN
window.handlePhuKienCanvasClick = function(pt) {
  if (!pt) return;

  // 1. Chế độ GÔM XÓA:
  if (window.knnPhuKienState.mode === 'ERASE' || window.knnPhuKienState.eraserMode) {
    let deletedPrefix = null;
    let deletedName = '';
    if (typeof entities !== 'undefined') {
      for (let i = entities.length - 1; i >= 0; i--) {
        let e = entities[i];
        let id = e.id || '';
        let isAcc = id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_');
        if (isAcc) {
          let bounds = getEntityBoundsHelper(e);
          if (pt.x >= bounds.minX - 150 && pt.x <= bounds.maxX + 150 && pt.y >= bounds.minY - 150 && pt.y <= bounds.maxY + 150) {
            let m = id.match(/^(pk_[^_]+_\d+_\d+)/) || id.match(/^(rap_[^_]+_\d+)/) || [id, id];
            deletedPrefix = e.groupId || m[1];
            deletedName = e.info || e.accName || e.id;
            break;
          }
        }
      }
      if (deletedPrefix) {
        entities = entities.filter(e => !(e.id && (e.id.startsWith(deletedPrefix) || e.groupId === deletedPrefix)));
        if (typeof render === 'function') render();
        if (typeof setInfo === 'function') {
          setInfo(`🗑️ Đã xóa phụ kiện: ${deletedName}`);
        }
      }
    }
    return;
  }

  // 2. Chế độ DI CHUYỂN BẰNG ĐIỂM GỐC -> ĐIỂM ĐÍCH (MOVE_BASE):
  if (window.knnPhuKienState.mode === 'MOVE_BASE') {
    if (!window.knnPhuKienState.moveBasePt) {
      window.knnPhuKienState.moveBasePt = { x: pt.x, y: pt.y };
      if (typeof setInfo === 'function') {
        setInfo(`📍 Đã chọn điểm gốc (${pt.x.toFixed(0)}, ${pt.y.toFixed(0)}). Hãy NHẤP ĐIỂM ĐÍCH để dời toàn bộ cụm phụ kiện đến:`);
      }
    } else {
      let dx = pt.x - window.knnPhuKienState.moveBasePt.x;
      let dy = pt.y - window.knnPhuKienState.moveBasePt.y;
      translateEntitiesByDelta(window.knnPhuKienState.selectedIds, dx, dy);
      window.knnPhuKienState.moveBasePt = null;
      window.knnPhuKienState.mode = 'SELECT_GROUP';
      if (typeof setInfo === 'function') {
        setInfo(`✅ ĐÃ DỜI TOÀN BỘ CỤM PHỤ KIỆN ĐẾN VỊ TRÍ MỚI THÀNH CÔNG (Giữ nguyên toàn bộ chi tiết ghép)!`);
      }
    }
    return;
  }

  // 3. Chế độ QUÉT CHỌN / NHÓM (Click vào phụ kiện để thêm/bớt chọn):
  if (window.knnPhuKienState.mode === 'SELECT_GROUP') {
    let clickedAccId = null;
    let clickedGroup = null;
    if (typeof entities !== 'undefined') {
      for (let i = entities.length - 1; i >= 0; i--) {
        let e = entities[i];
        let id = e.id || '';
        let isAcc = id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_');
        if (isAcc) {
          let bounds = getEntityBoundsHelper(e);
          if (pt.x >= bounds.minX - 60 && pt.x <= bounds.maxX + 60 && pt.y >= bounds.minY - 60 && pt.y <= bounds.maxY + 60) {
            clickedAccId = id;
            clickedGroup = e.groupId || null;
            break;
          }
        }
      }
    }

    if (clickedAccId) {
      // Nếu thuộc 1 nhóm -> chọn/bỏ chọn cả nhóm
      if (clickedGroup) {
        let groupEnts = entities.filter(e => e.groupId === clickedGroup);
        let allIn = groupEnts.every(e => window.knnPhuKienState.selectedIds.has(e.id));
        groupEnts.forEach(e => {
          if (allIn) window.knnPhuKienState.selectedIds.delete(e.id);
          else window.knnPhuKienState.selectedIds.add(e.id);
        });
      } else {
        if (window.knnPhuKienState.selectedIds.has(clickedAccId)) {
          window.knnPhuKienState.selectedIds.delete(clickedAccId);
        } else {
          window.knnPhuKienState.selectedIds.add(clickedAccId);
        }
      }
      updateGroupStatusUI();
      updateTransformInputsUI();
      if (typeof render === 'function') render();
    }
    return;
  }

  // 4. Chế độ ĐẶT PHỤ KIỆN MỚI:
  if (window.knnPhuKienState.activeAcc) {
    window.placePhuKienAtWorld(pt, window.knnPhuKienState.activeAcc);
  }
};

function getEntityBoundsHelper(e) {
  if (e.points && e.points.length > 0) {
    let xs = e.points.map(p => Array.isArray(p) ? p[0] : p.x);
    let ys = e.points.map(p => Array.isArray(p) ? p[1] : p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  let cx = (e.cx !== undefined) ? e.cx : (e.x !== undefined ? e.x + (e.w || 0) / 2 : 0);
  let cy = (e.cy !== undefined) ? e.cy : (e.y !== undefined ? e.y + (e.h || 0) / 2 : 0);
  let rad = (e.r !== undefined) ? e.r : Math.max(e.w || 100, e.h || 100) / 2;
  return { minX: cx - rad, maxX: cx + rad, minY: cy - rad, maxY: cy + rad };
}

// Hàm sinh danh sách các entities hình học (hỗ trợ xoay mọi góc & chuẩn kích thước thực)
function generateAccessoryEntities(uniqueId, pt, accObj, finalW, finalH, rotDeg, isMeter) {
  let newEntsToAdd = [];
  let rad = (rotDeg * Math.PI) / 180.0;
  let cos = Math.cos(rad), sin = Math.sin(rad);

  let rawW = window.knnPhuKienState.customW;
  let rawH = window.knnPhuKienState.customH;

  // 1. HỘP ĐÈN DOWNLIGHT VUÔNG (Chuẩn 180x180mm hoặc tùy chỉnh)
  if (accObj.id === 'hopden-vuong') {
    let szGlow = finalW * 1.5;
    let szLed = finalW * 0.55;

    // Quầng sáng mờ tỏa ra
    newEntsToAdd.push({
      id: `${uniqueId}_glow`,
      type: 'CIRCLE',
      cx: pt.x,
      cy: pt.y,
      r: szGlow / 2,
      color: 'rgba(254, 240, 138, 0.22)',
      fillColor: 'rgba(254, 240, 138, 0.10)',
      layer: '09_NANO_DEN_TRANG_TRI'
    });

    // Khung hộp vuông (Hỗ trợ xoay góc tự do 0-360 độ qua POLYGON)
    let boxPoly = getRotatedBoxPolygon(pt.x, pt.y, finalW, finalH, rotDeg);
    newEntsToAdd.push({
      id: uniqueId,
      type: 'POLYGON',
      points: boxPoly,
      color: '#facc15',
      fillColor: 'rgba(30, 41, 59, 0.95)',
      lineWidth: 2.2,
      layer: '09_NANO_DEN_TRANG_TRI',
      accId: accObj.id,
      accName: accObj.name,
      rotDeg: rotDeg,
      w: finalW,
      h: finalH,
      rawW: rawW,
      rawH: rawH,
      cx: pt.x,
      cy: pt.y,
      info: `Hộp đèn Downlight vuông (${Math.round(rawW)}x${Math.round(rawH)}mm, ${rotDeg}°)`
    });

    // Tim mắt LED vuông bên trong xoay cùng góc
    let ledPoly = getRotatedBoxPolygon(pt.x, pt.y, szLed, szLed, rotDeg);
    newEntsToAdd.push({
      id: `${uniqueId}_led`,
      type: 'POLYGON',
      points: ledPoly,
      color: '#fde047',
      fillColor: '#fef08a',
      lineWidth: 1.2,
      layer: '09_NANO_DEN_TRANG_TRI'
    });
  }
  // 2. HỘP ĐÈN CHỮ NHẬT ĐÔI 2 MẮT LED (320x180mm hoặc tùy chỉnh)
  else if (accObj.id === 'hopden-chunhat') {
    let szLed = Math.min(finalW, finalH) * 0.55;
    let boxPoly = getRotatedBoxPolygon(pt.x, pt.y, finalW, finalH, rotDeg);

    newEntsToAdd.push({
      id: uniqueId,
      type: 'POLYGON',
      points: boxPoly,
      color: '#facc15',
      fillColor: 'rgba(30, 41, 59, 0.95)',
      lineWidth: 2.2,
      layer: '09_NANO_DEN_TRANG_TRI',
      accId: accObj.id,
      accName: accObj.name,
      rotDeg: rotDeg,
      w: finalW,
      h: finalH,
      rawW: rawW,
      rawH: rawH,
      cx: pt.x,
      cy: pt.y,
      info: `Hộp đèn chữ nhật đôi (${Math.round(rawW)}x${Math.round(rawH)}mm, ${rotDeg}°)`
    });

    let offsetDist = finalW / 4.0;
    let c1 = { x: pt.x - offsetDist * cos, y: pt.y - offsetDist * sin };
    let c2 = { x: pt.x + offsetDist * cos, y: pt.y + offsetDist * sin };

    let led1Poly = getRotatedBoxPolygon(c1.x, c1.y, szLed, szLed, rotDeg);
    let led2Poly = getRotatedBoxPolygon(c2.x, c2.y, szLed, szLed, rotDeg);

    newEntsToAdd.push({
      id: `${uniqueId}_led1`,
      type: 'POLYGON',
      points: led1Poly,
      color: '#fde047',
      fillColor: '#fef08a',
      lineWidth: 1.2,
      layer: '09_NANO_DEN_TRANG_TRI'
    });
    newEntsToAdd.push({
      id: `${uniqueId}_led2`,
      type: 'POLYGON',
      points: led2Poly,
      color: '#fde047',
      fillColor: '#fef08a',
      lineWidth: 1.2,
      layer: '09_NANO_DEN_TRANG_TRI'
    });
  }
  // 3. ĐÈN TRÒN / MÂM TRÒN PHI 90, QUẠT TRẦN, MÂM PU
  else if (accObj.type === 'CIRCLE' || accObj.id.includes('tron') || accObj.id.includes('phi90') || accObj.id.includes('mam') || accObj.id.includes('quat')) {
    let rMain = finalW / 2.0;
    newEntsToAdd.push({
      id: `${uniqueId}_glow`,
      type: 'CIRCLE',
      cx: pt.x,
      cy: pt.y,
      r: rMain * 1.4,
      color: 'rgba(254, 240, 138, 0.25)',
      fillColor: 'rgba(254, 240, 138, 0.12)',
      layer: '09_NANO_DEN_TRANG_TRI'
    });
    newEntsToAdd.push({
      id: uniqueId,
      type: 'CIRCLE',
      cx: pt.x,
      cy: pt.y,
      r: rMain,
      color: accObj.color || '#facc15',
      fillColor: (accObj.cat === 'den') ? '#fef08a' : 'rgba(250, 204, 21, 0.35)',
      lineWidth: 2.0,
      layer: (accObj.cat === 'den') ? '09_NANO_DEN_TRANG_TRI' : '08_NANO_PHAO_CHI',
      accId: accObj.id,
      accName: accObj.name,
      rotDeg: rotDeg,
      w: finalW,
      h: finalH,
      rawW: rawW,
      rawH: rawH,
      cx: pt.x,
      cy: pt.y,
      info: `${accObj.name} (Phi ${Math.round(rawW)}mm)`
    });
  }
  // 4. HOA GÓC, PHÀO CHỈ, NẸP V, NẸP GÓC
  else {
    let polyPts = getRotatedBoxPolygon(pt.x, pt.y, finalW, finalH, rotDeg);
    newEntsToAdd.push({
      id: uniqueId,
      type: 'POLYGON',
      points: polyPts,
      color: accObj.color || '#d97706',
      fillColor: 'rgba(217, 119, 6, 0.35)',
      lineWidth: 2.0,
      layer: (accObj.cat === 'den') ? '09_NANO_DEN_TRANG_TRI' : '08_NANO_PHAO_CHI',
      accId: accObj.id,
      accName: accObj.name,
      rotDeg: rotDeg,
      w: finalW,
      h: finalH,
      rawW: rawW,
      rawH: rawH,
      cx: pt.x,
      cy: pt.y,
      info: `${accObj.name} (${Math.round(rawW)}x${Math.round(rawH)}mm, ${rotDeg}°)`
    });
  }

  return newEntsToAdd;
}

window.placePhuKienAtWorld = function(pt, accObj) {
  if (!accObj || !pt) return;
  let unitInfo = detectDrawingUnitInfo();
  let scaleUnit = unitInfo.scale;

  let finalW = window.knnPhuKienState.customW * (window.knnPhuKienState.scalePercent / 100.0) * scaleUnit;
  let finalH = window.knnPhuKienState.customH * (window.knnPhuKienState.scalePercent / 100.0) * scaleUnit;
  let rotDeg = window.knnPhuKienState.rotationDeg;

  let uniqueId = `pk_${accObj.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  let newEntsToAdd = generateAccessoryEntities(uniqueId, pt, accObj, finalW, finalH, rotDeg, unitInfo.isMeter);

  if (typeof entities !== 'undefined') {
    entities.push(...newEntsToAdd);
  }
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`✅ Đã gắn "${accObj.name}" (${Math.round(window.knnPhuKienState.customW)}x${Math.round(window.knnPhuKienState.customH)}mm, ${rotDeg}°) tại (${pt.x.toFixed(0)}, ${pt.y.toFixed(0)}).`);
  }
};

window.clearAllCeilingAccessories = function() {
  if (typeof entities === 'undefined') return;
  let countBefore = entities.length;
  entities = entities.filter(e => {
    let id = e.id || '';
    let isAcc = id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_');
    return !isAcc;
  });
  window.knnPhuKienState.selectedIds.clear();
  window.knnPhuKienState.selectedGroupPrefix = null;
  updateGroupStatusUI();
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`🧹 Đã xóa sạch ${countBefore - entities.length} phụ kiện trên trần.`);
  }
};

function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (handle) handle.onmousedown = dragMouseDown;
  else element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = 'auto';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Bắt phím tắt R, +, -, Delete, Esc
if (!window.knnPhuKienKeyBound) {
  window.knnPhuKienKeyBound = true;
  window.addEventListener('keydown', function(e) {
    let panel = document.getElementById('knn-phukien-palette');
    if (!panel) return;

    // Phím Delete hoặc Backspace: Xóa các phụ kiện đang chọn
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      if (window.knnPhuKienState.selectedIds && window.knnPhuKienState.selectedIds.size > 0) {
        window.deleteSelectedAccessories();
        e.preventDefault();
      }
    }
    // Phím R: Xoay +45°
    else if (e.key === 'r' || e.key === 'R') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      window.rotatePhuKienBy(45);
      e.preventDefault();
    }
    // Phím + hoặc =: Phóng to +10%
    else if (e.key === '+' || e.key === '=') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      window.adjustPhuKienScale(1.10);
      e.preventDefault();
    }
    // Phím - hoặc _: Thu nhỏ -10%
    else if (e.key === '-' || e.key === '_') {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      window.adjustPhuKienScale(0.90);
      e.preventDefault();
    }
  });
}
// === MODULE: trannano/index.js ===
// ===============================================================================
//     VINACAD PLUGIN ENTRY POINT & CLI COMMAND REGISTRATION
// ===============================================================================

(function() {
  if (!window.knnState) {
    window.knnState = {
      active: false,
      step: 1,
      levelMode: 'cap1',
      materialType: 'nano400',
      boneSpacing: 450,
      dropDepth: 150,
      tierWidth: 700,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: null,
      allResults: [],
      presetLevel: null,
      presetCommand: null
    };
  }

  window.initKNNTool = function() {
    let prevAll = (window.knnState && Array.isArray(window.knnState.allResults)) ? window.knnState.allResults : [];
    let prevLast = window.knnState ? window.knnState.lastResult : null;
    let prevLvl = (window.knnState && window.knnState.levelMode) || 'cap1';
    let prevMat = (window.knnState && window.knnState.materialType) || 'nano400';
    let presetLevel = window.knnState && window.knnState.presetLevel;
    let presetCommand = window.knnState && window.knnState.presetCommand;

    window.knnState = {
      active: true,
      step: 1,
      facadePickCount: 0,
      levelMode: presetLevel || prevLvl,
      commandName: presetCommand || 'NAN1',
      materialType: prevMat,
      boneSpacing: (prevMat === 'lamsong' ? 350 : (prevMat === 'nano300' ? 400 : 450)),
      dropDepth: 150,
      tierWidth: 700,
      skipParameterStep: Boolean(presetLevel),
      suppressSelectionStatus: false,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: prevLast,
      allResults: prevAll
    };

    if (typeof setTaskContext === 'function') setTaskContext('KNN1', 1, 'SELECT_ROOM_ENTITIES');
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
    if (typeof setInfo === 'function') {
      setInfo(`👉 [${window.knnState.commandName}] BƯỚC 1: Quét chọn các nét của căn phòng cần tạo khung trần Nano, sau đó nhấn ENTER (hoặc Space / Chuột phải):`);
    }
  };

  window.executeKNNFromSelectionOrCanvas = function() {
    if (!window.knnState) return;

    if (window.knnState.step === 2 && window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
      executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
      window.knnState.step = 3;
      if (typeof setTaskContext === 'function') setTaskContext('KNN1', 3, 'COMPLETED');
      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo(`✅ [${window.knnState.commandName}] Đã tạo khung trần Nano giật cấp Kosmos thành công! Bạn có thể xem 3D, Mặt cắt kỹ thuật 2D hoặc nhấn ENTER để hoàn tất.`);
      }
      ensureKNNFloatingUI();
      if (typeof render === 'function') render();
      return;
    }

    if (window.knnState.step === 3) {
      let bar = document.getElementById('knn-floating-bar');
      if (bar) bar.remove();
      if (window.knnState) {
        window.knnState.active = false;
        window.knnState.step = 1;
      }
      if (typeof setInfo === 'function') setInfo("✅ Đã chốt phương án khung trần Nano.");
      if (typeof render === 'function') render();
      return;
    }

    let poly = null;
    if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('knn_') && !(e.id || '').startsWith('tt_'));
      if (selEnts.length > 0) {
        poly = findEnclosingPolygonFromEntities(selEnts, null);
        if (!poly) {
          let probeEntity = selEnts[0];
          let probeBounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(probeEntity) : null;
          let probePoint = probeBounds ? {
            x: (probeBounds.minX + probeBounds.maxX) / 2,
            y: (probeBounds.minY + probeBounds.maxY) / 2
          } : null;
          let roomEntities = entities.filter(e => e.layer !== 'BOM_TABLE' &&
            !(e.id || '').startsWith('knn_') && !(e.id || '').startsWith('tt_'));
          poly = findEnclosingPolygonFromEntities(roomEntities, probePoint);
        }
      }
    }

    if (!poly && window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
      poly = window.knnState.polyPts;
    }

    if (poly && poly.length >= 3) {
      window.knnState.polyPts = poly;
      window.knnState.facadePickCount = 0;

      window.knnState.edge1 = { p1: poly[0], p2: poly[1] };
      window.knnState.edge2 = { p1: poly[1], p2: poly[2] };

      if (window.knnState.skipParameterStep) {
        executeKNNAlgorithm(poly, window.knnState.edge1, window.knnState.edge2);
        window.knnState.step = 3;
        window.knnState.suppressSelectionStatus = true;
        if (typeof setTaskContext === 'function') setTaskContext('KNN1', 3, 'COMPLETED');
        if (typeof selectedIds !== 'undefined') selectedIds.clear();
        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') setInfo(`✅ [${window.knnState.levelMode.toUpperCase()}] Đã tạo khung trần Nano theo cấp đã chọn.`);
        ensureKNNFloatingUI();
        if (typeof render === 'function') render();
        window.knnState.suppressSelectionStatus = false;
        return;
      }

      window.knnState.step = 2;
      if (typeof setTaskContext === 'function') setTaskContext('KNN1', 2, 'SELECT_PARAMS');

      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo(`👉 [${window.knnState.commandName}] BƯỚC 2: Chọn cấp trần (Phẳng / Giật 1-2-3 Cấp), loại tấm Nano, sau đó nhấn ENTER để TÍNH KHUNG:`);
      }
      ensureKNNFloatingUI();
      if (typeof render === 'function') render();
    } else {
      if (typeof setInfo === 'function') {
        setInfo(`👉 [${window.knnState.commandName}] Hãy quét chọn các nét của căn phòng cần tạo khung trần Nano, sau đó nhấn ENTER để tiếp tục.`, "prompt");
      }
    }
  };

  window.handleKNNClick = function(pt) {
    if (!window.knnState) return;
    if (window.knnState.step === 2 || window.knnState.step === 3) {
      let closestEdge = getClosestEdge(pt, window.knnState.polyPts);
      if (closestEdge) {
        if (window.knnState.facadePickCount === 0 || !window.knnState.edge1) {
          window.knnState.edge1 = closestEdge;
          window.knnState.facadePickCount = 1;
          if (typeof setInfo === 'function') setInfo(`🏷️ Đã chọn CẠNH MỐC 1. Hãy nhấp tiếp CẠNH 2.`);
        } else {
          window.knnState.edge2 = closestEdge;
          window.knnState.facadePickCount = 2;
          if (typeof setInfo === 'function') setInfo(`🏷️ Đã chọn CẠNH MỐC 2. Nhấn ENTER để BẮT ĐẦU TÍNH KHUNG.`);
        }

        if (window.knnState.step === 3) {
          executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
        }
        ensureKNNFloatingUI();
        if (typeof render === 'function') render();
      }
    }
  };

  function drawKNNOverlay(ctx) {
    if (typeof currentTool !== 'undefined' && currentTool !== 'KNN1') return;
    if (typeof knnState !== 'undefined' && knnState && knnState.polyPts && knnState.polyPts.length >= 3) {
      ctx.save();
      let pts = knnState.polyPts;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3.0;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      let s0 = worldToScreen(pts[0].x !== undefined ? pts[0].x : pts[0][0], pts[0].y !== undefined ? pts[0].y : pts[0][1]);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        let x = pts[i].x !== undefined ? pts[i].x : pts[i][0];
        let y = pts[i].y !== undefined ? pts[i].y : pts[i][1];
        let si = worldToScreen(x, y);
        ctx.lineTo(si.x, si.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  if (typeof registerPluginOverlay === 'function') {
    registerPluginOverlay(drawKNNOverlay);
  }

  if (typeof registerPluginEscapeHandler === 'function') {
    registerPluginEscapeHandler(function() {
      if (typeof window.closeKNN3DModal === 'function') window.closeKNN3DModal();
      const modalSec = document.getElementById('knn-sec-modal');
      if (modalSec) modalSec.remove();
      const bar = document.getElementById('knn-floating-bar');
      if (bar) bar.remove();
      if (window.knnState) {
        window.knnState.active = false;
        window.knnState.step = 1;
      }
    });
  }

  if (typeof registerPluginTool === 'function') {
    registerPluginTool('KNN1', {
      allowSelection: function() {
        return !window.knnState || window.knnState.step === 1;
      },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.initKNNTool();
      },
      onDeactivate: function() {
        let bar = document.getElementById('knn-floating-bar');
        if (bar) bar.remove();
        if (window.knnState) {
          window.knnState.active = false;
          window.knnState.step = 1;
        }
      },
      onMouseDown: function(downWorld, e) {
        if (window.knnState && window.knnState.step === 1) {
          window.knnState.scanStartWorld = { x: downWorld.x, y: downWorld.y };
          return false;
        }
        if (window.knnState && (window.knnState.step === 2 || window.knnState.step === 3)) {
          window.handleKNNClick(downWorld);
          return true;
        }
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.knnState || window.knnState.step !== 1 || !window.knnState.scanStartWorld) return false;

        let start = window.knnState.scanStartWorld;
        window.knnState.scanStartWorld = null;
        let dragDistance = Math.hypot(upWorld.x - start.x, upWorld.y - start.y);
        if (dragDistance < 6) return false;

        let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
        let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);
        if (!e.shiftKey) selectedIds.clear();

        entities.forEach(entity => {
          if (entity.layer === 'BOM_TABLE' || (entity.id || '').startsWith('knn_') || (entity.id || '').startsWith('tt_')) return;
          let bounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(entity) : null;
          if (!bounds) return;
          let overlaps = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          if (overlaps) selectedIds.add(entity.id);
        });

        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') {
          setInfo(`👉 [${window.knnState.commandName || 'NAN1'}] Đã quét ${selectedIds.size} nét phòng. Nhấn ENTER để tiếp tục.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds) {
        if (window.knnState && window.knnState.suppressSelectionStatus) return;
        if (window.knnState && window.knnState.step === 1) {
          if (selectedIds && selectedIds.size > 0) {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [${window.knnState.commandName || 'NAN1'}] Đã chọn ${selectedIds.size} nét phòng. Nhấn ENTER để TIẾP TỤC.`);
            }
          } else {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [${window.knnState.commandName || 'NAN1'}] BƯỚC 1: Quét chọn các nét của căn phòng cần tạo khung trần Nano, sau đó nhấn ENTER:`);
            }
          }
        }
      },
      onClick: function(pt) {
        window.handleKNNClick(pt);
      },
      onContextMenu: function(e) {
        window.executeKNNFromSelectionOrCanvas();
      },
      onEnter: function() {
        if (window.knnState && window.knnState.enterHandledAt && Date.now() - window.knnState.enterHandledAt < 500) {
          window.knnState.enterHandledAt = 0;
          return;
        }
        window.executeKNNFromSelectionOrCanvas();
      }
    });
  }


  if (typeof registerPluginTool === 'function') {
    registerPluginTool('RAPTAM', {
      allowSelection: function() { return true; },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.initRAPTAMTool();
      },
      onDeactivate: function() {},
      onMouseDown: function(downWorld, e) {
        window.raptamScanStart = { x: downWorld.x, y: downWorld.y };
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.raptamScanStart) return false;
        let start = window.raptamScanStart;
        window.raptamScanStart = null;
        let dragDist = Math.hypot(upWorld.x - start.x, upWorld.y - start.y);
        if (dragDist < 6) return false;

        let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
        let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);
        if (!e.shiftKey && typeof selectedIds !== 'undefined') selectedIds.clear();

        entities.forEach(entity => {
          if (entity.layer === 'BOM_TABLE') return;
          let bounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(entity) : null;
          if (!bounds) return;
          let overlaps = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          if (overlaps && typeof selectedIds !== 'undefined') selectedIds.add(entity.id);
        });

        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') {
          setInfo(`👉 [RAPTAM] Đã quét chọn ${selectedIds ? selectedIds.size : 0} nét. Nhấn ENTER để TẠO BẢN VẼ RÁP TẤM HOÀN THIỆN.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds) {
        if (selectedIds && selectedIds.size > 0 && typeof setInfo === 'function') {
          setInfo(`👉 [RAPTAM] Đã chọn ${selectedIds.size} nét. Nhấn ENTER để TẠO BẢN VẼ RÁP TẤM HOÀN THIỆN.`);
        }
      },
      onClick: function(pt) {
        let clicked = entities.filter(e => e.layer !== 'BOM_TABLE' && isPointInPoly(pt, [
          { x: e.x || 0, y: e.y || 0 },
          { x: (e.x || 0) + (e.w || 0), y: e.y || 0 },
          { x: (e.x || 0) + (e.w || 0), y: (e.y || 0) + (e.h || 0) },
          { x: e.x || 0, y: (e.y || 0) + (e.h || 0) }
        ]));
        if (typeof selectedIds !== 'undefined') {
          clicked.forEach(c => selectedIds.add(c.id));
        }
        window.executeRAPTAMFromSelection();
      },
      onContextMenu: function(e) {
        window.executeRAPTAMFromSelection();
      },
      onEnter: function() {
        window.executeRAPTAMFromSelection();
      }
    });
  }

  window.c_RAPTAM = function() {
    if (typeof selectTool === 'function') selectTool('RAPTAM');
    else window.initRAPTAMTool();
  };
  window.c_RAPNANO = window.c_RAPTAM;
  window.c_OPNANO = window.c_RAPTAM;
  window.c_NANO_FINISH = window.c_RAPTAM;
  window.c_OPTAM = window.c_RAPTAM;


  if (typeof registerPluginTool === 'function') {
    registerPluginTool('N3D', {
      allowSelection: function() { return true; },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.initN3DTool();
      },
      onDeactivate: function() {},
      onMouseDown: function(downWorld, e) {
        window.n3dScanStart = { x: downWorld.x, y: downWorld.y };
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.n3dScanStart) return false;
        let start = window.n3dScanStart;
        window.n3dScanStart = null;
        let dragDist = Math.hypot(upWorld.x - start.x, upWorld.y - start.y);
        if (dragDist < 6) return false;

        let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
        let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);
        if (!e.shiftKey && typeof selectedIds !== 'undefined') selectedIds.clear();

        entities.forEach(entity => {
          if (entity.layer === 'BOM_TABLE') return;
          let bounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(entity) : null;
          if (!bounds) return;
          let overlaps = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          if (overlaps && typeof selectedIds !== 'undefined') selectedIds.add(entity.id);
        });

        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') {
          setInfo(`👉 [N3D] Đã quét chọn ${selectedIds ? selectedIds.size : 0} nét. Nhấn ENTER để MỞ 3D PHỐI CẢNH.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds) {
        if (selectedIds && selectedIds.size > 0 && typeof setInfo === 'function') {
          setInfo(`👉 [N3D] Đã chọn ${selectedIds.size} nét. Nhấn ENTER để MỞ 3D PHỐI CẢNH.`);
        }
      },
      onClick: function(pt) {
        let clicked = entities.filter(e => e.layer !== 'BOM_TABLE' && isPointInPoly(pt, [
          { x: e.x || 0, y: e.y || 0 },
          { x: (e.x || 0) + (e.w || 0), y: e.y || 0 },
          { x: (e.x || 0) + (e.w || 0), y: (e.y || 0) + (e.h || 0) },
          { x: e.x || 0, y: (e.y || 0) + (e.h || 0) }
        ]));
        if (typeof selectedIds !== 'undefined') {
          clicked.forEach(c => selectedIds.add(c.id));
        }
        window.executeN3DFromSelection();
      },
      onContextMenu: function(e) {
        window.executeN3DFromSelection();
      },
      onEnter: function() {
        window.executeN3DFromSelection();
      }
    });
  }


    if (typeof registerPluginTool === 'function') {
    registerPluginTool('PHUKIENNN', {
      allowSelection: function() { return false; },
      hidePropertiesPanel: true,
      onActivate: function() {
        if (typeof selectedIds !== 'undefined') selectedIds.clear();
        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (!document.getElementById('knn-phukien-palette')) {
          window.openPhuKienPalette();
        }
      },
      onDeactivate: function() {},
      onMouseDown: function(downWorld, e) {
        if (!window.knnPhuKienState) return false;
        window.knnPhuKienState.dragStartPt = { x: downWorld.x, y: downWorld.y };
        window.knnPhuKienState.isDraggingSelection = false;
        return false;
      },
      onMouseMove: function(currWorld, e) {
        if (window.knnPhuKienState && window.knnPhuKienState.dragStartPt && e.buttons === 1) {
          let dist = Math.hypot(currWorld.x - window.knnPhuKienState.dragStartPt.x, currWorld.y - window.knnPhuKienState.dragStartPt.y);
          if (dist > 8) {
            window.knnPhuKienState.isDraggingSelection = true;
          }
        }
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.knnPhuKienState) return false;
        let start = window.knnPhuKienState.dragStartPt;
        window.knnPhuKienState.dragStartPt = null;

        // Nếu người dùng vừa quét chuột (Drag-box selection):
        if (start && window.knnPhuKienState.isDraggingSelection) {
          window.knnPhuKienState.isDraggingSelection = false;
          let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
          let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);

          if (!e.shiftKey) window.knnPhuKienState.selectedIds.clear();

          if (typeof entities !== 'undefined') {
            entities.forEach(ent => {
              let id = ent.id || '';
              let isAcc = id.startsWith('pk_') || id.startsWith('rap_dl_') || id.startsWith('rap_center_') || id.startsWith('rap_corner_');
              if (!isAcc) return;

              let b = (typeof getEntityBoundsHelper === 'function') ? getEntityBoundsHelper(ent) : null;
              if (b && b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) {
                window.knnPhuKienState.selectedIds.add(ent.id);
              }
            });
          }

          window.knnPhuKienState.mode = 'SELECT_GROUP';
          if (typeof updateGroupStatusUI === 'function') updateGroupStatusUI();
          if (typeof updateTransformInputsUI === 'function') updateTransformInputsUI();
          if (typeof render === 'function') render();
          if (typeof setInfo === 'function') {
            setInfo(`👉 [QUÉT CHỌN] Đã quét chọn ${window.knnPhuKienState.selectedIds.size} chi tiết. Bấm "🔒 Khóa & Tạo Nhóm" hoặc "🚚 Kéo Di Chuyển".`);
          }
          return true;
        }

        // Nếu chỉ là 1 cú click chuột đơn thuần:
        window.handlePhuKienCanvasClick(upWorld);
        return true;
      },
      onClick: function(pt, e) {
        return true;
      }
    });
  }

  window.c_PHUKIENNN = function() {
    window.openPhuKienPalette();
    if (typeof selectTool === 'function') selectTool('PHUKIENNN');
  };
  window.c_phukiennn = window.c_PHUKIENNN;
  window.c_PKNANO = window.c_PHUKIENNN;
  window.c_PHUKIEN_NANO = window.c_PHUKIENNN;

  window.c_KNN1 = function() {
    if (typeof selectTool === 'function') selectTool('KNN1');
    else window.initKNNTool();
  };
  window.c_KNN = window.c_KNN1;
  window.c_TRANNANO = window.c_KNN1;
  window.c_TRANLAMSONG = window.c_KNN1;
  window.c_TRANLAMSOPNG = window.c_KNN1;

  function startKNNPreset(level, commandName) {
    if (!window.knnState) window.knnState = {};
    window.knnState.presetLevel = level;
    window.knnState.presetCommand = commandName;
    window.c_KNN1();
  }
  window.c_NAN0 = function() { startKNNPreset('cap0', 'NAN0'); };
  window.c_NAN1 = function() { startKNNPreset('cap1', 'NAN1'); };
  window.c_NAN2 = function() { startKNNPreset('cap2', 'NAN2'); };
  window.c_NAN3 = function() { startKNNPreset('cap3', 'NAN3'); };
  window.c_KNNCAP0 = window.c_NAN0;
  window.c_KNNCAP1 = window.c_NAN1;
  window.c_KNNCAP2 = window.c_NAN2;
  window.c_KNNCAP3 = window.c_NAN3;

  window.c_N3D = function() {
    if (typeof selectTool === 'function') selectTool('N3D');
    else window.initN3DTool();
  };
  window.c_NANO3D = window.c_N3D;
  window.c_KNN3D = window.c_N3D;
  if (typeof window.c_TT3D === 'undefined') {
    window.c_TT3D = window.c_KNN3D;
  }
  window.c_KNNSEC = function() {
    if (typeof window.openKNNSectionModal === 'function') window.openKNNSectionModal();
  };
  window.c_NSEC = window.c_KNNSEC;

  let regFn = (typeof registerPluginCommand === 'function') ? registerPluginCommand : ((typeof registerCommand === 'function') ? registerCommand : null);

  if (regFn) {
    regFn('PHUKIENNN', window.c_PHUKIENNN, 'Thư Viện Phụ Kiện Trần Nano (Đèn, Mâm, Hoa Góc, Phào Chỉ)');
    regFn('phukiennn', window.c_phukiennn, 'Lệnh mở bảng gắn/xóa phụ kiện trần');
    regFn('PKNANO', window.c_PKNANO, 'Alias phụ kiện trần nano');
    regFn('RAPTAM', window.c_RAPTAM, 'Ráp Tấm Nano 400x3000mm Hoàn Thiện Kèm Đèn Trang Trí');
    regFn('RAPNANO', window.c_RAPNANO, 'Alias ráp tấm hoàn thiện');
    regFn('OPNANO', window.c_OPNANO, 'Alias ốp tấm nano hoàn thiện');
    regFn('OPTAM', window.c_OPTAM, 'Alias ốp tấm nano');
    regFn('NAN1', window.c_NAN1, 'Khung Trần Nano Giật 1 Cấp Chuẩn Kosmos');
    regFn('NAN0', window.c_NAN0, 'Khung Trần Nano Phẳng');
    regFn('NAN2', window.c_NAN2, 'Khung Trần Nano Giật 2 Cấp');
    regFn('NAN3', window.c_NAN3, 'Khung Trần Nano Giật 3 Cấp');
    regFn('KNN1', window.c_KNN1, 'Tạo Khung Hộp Giật Cấp Bắn Tấm Nano (Nẹp V 3m, Xương U 3.6m)');
    regFn('KNN', window.c_KNN, 'Tạo Khung Trần Bắn Tấm Nano');
    regFn('TRANNANO', window.c_TRANNANO, 'Tạo Khung Trần Nhựa Nano');
    regFn('TRANLAMSONG', window.c_TRANLAMSONG, 'Tạo Khung Trần Lam Sóng');
    regFn('TRANLAMSOPNG', window.c_TRANLAMSOPNG, 'Tạo Khung Trần Lam Sóng');
    regFn('N3D', window.c_N3D, 'Xem 3D Khung Trần Nano');
    regFn('NANO3D', window.c_NANO3D, 'Alias xem 3D Khung Trần Nano');
    regFn('KNN3D', window.c_KNN3D, 'Alias xem 3D Khung Trần Nano');
    regFn('NSEC', window.c_NSEC, 'Xem Mặt Cắt Khung Trần Nano');
    regFn('KNNSEC', window.c_KNNSEC, 'Alias xem mặt cắt Nano');
    regFn('KNNCAP0', window.c_KNNCAP0, 'Alias trần phẳng');
    regFn('KNNCAP1', window.c_KNNCAP1, 'Alias trần giật 1 cấp');
    regFn('KNNCAP2', window.c_KNNCAP2, 'Alias trần giật 2 cấp');
    regFn('KNNCAP3', window.c_KNNCAP3, 'Alias trần giật 3 cấp');
  }
  ensureKNNCommandGuide();
  ensureKNN3DToolbarBridge();
  ensureKNNEnterFallback();
})();
