// === MODULE: trannano/1_geometry.js ===
// ===============================================================================
//     VINACAD PLUGIN: KHUNG TRẦN THI CÔNG TẤM NANO & LAM SÓNG (TRANNANO / KNN1)
//     Hệ Khung Hộp Giật Cấp Chuẩn Công Trình Thực Tế:
//     - Hộp giật cấp viền ngoài: Khung xương đáy gánh tấm @450mm + Xương đứng @600mm
//     - Lõi trần trung tâm: Hệ xương giàn chịu lực đan ô vuông / chữ nhật
//     - Nẹp V viền tường 3.0m + Thanh xương U 3.6m + Ty treo M8
//     - Khóa liên kết kẹp chặt thanh trên & thanh dưới tại mọi giao điểm
//     - Tích hợp: Trần Phẳng, Giật 1 Cấp, Giật 2 Cấp, Giật 3 Cấp & Khe Hắt LED
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
        let nextSeg = segs[bestIdx];
        let nextFar = bestReverse ? nextSeg.p1 : nextSeg.p2;
        orderedPts.push({ ...nextFar });
        nextSeg.used = true;
        keepGrowing = true;
      } else {
        let curStart = orderedPts[0];
        bestDist = SNAP_TOL;
        bestIdx = -1;
        bestReverse = false;

        for (let i = 0; i < segs.length; i++) {
          if (segs[i].used) continue;
          let d1 = Math.hypot(segs[i].p1.x - curStart.x, segs[i].p1.y - curStart.y);
          let d2 = Math.hypot(segs[i].p2.x - curStart.x, segs[i].p2.y - curStart.y);
          if (d1 < bestDist) {
            bestDist = d1;
            bestIdx = i;
            bestReverse = true;
          }
          if (d2 < bestDist) {
            bestDist = d2;
            bestIdx = i;
            bestReverse = false;
          }
        }

        if (bestIdx !== -1) {
          let nextSeg = segs[bestIdx];
          let nextFar = bestReverse ? nextSeg.p2 : nextSeg.p1;
          orderedPts.unshift({ ...nextFar });
          nextSeg.used = true;
          keepGrowing = true;
        }
      }
    }

    if (orderedPts.length >= 3) {
      let dClose = Math.hypot(orderedPts[0].x - orderedPts[orderedPts.length - 1].x, orderedPts[0].y - orderedPts[orderedPts.length - 1].y);
      if (dClose < SNAP_TOL) {
        orderedPts[orderedPts.length - 1] = { ...orderedPts[0] };
      }

      let cleanLoop = [];
      for (let p of orderedPts) {
        if (cleanLoop.length === 0 || Math.hypot(p.x - cleanLoop[cleanLoop.length - 1].x, p.y - cleanLoop[cleanLoop.length - 1].y) > 0.01) {
          cleanLoop.push(p);
        }
      }

      if (cleanLoop.length >= 3) {
        if (Math.hypot(cleanLoop[0].x - cleanLoop[cleanLoop.length - 1].x, cleanLoop[0].y - cleanLoop[cleanLoop.length - 1].y) <= 0.01) {
          cleanLoop.pop();
        }
        if (cleanLoop.length >= 3 && polyArea(cleanLoop) > 0.001) {
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
    let d = distToSegment(pt, p1, p2);
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

  let cx = 0, cy = 0;
  for (let p of polyPts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

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
//     KNN NANO & LAM SÓNG BOX TRUSS & STEPPED FRAMING ENGINE
//     Cấu tạo chuẩn công trình thực tế:
//     - Cấp viền ngoài: Khung hộp hạ thấp (Xương đáy @450mm + Xương đứng chống giật @600mm)
//     - Cấp lõi trần trong: Lưới xương giàn chịu lực đan ô vuông/chữ nhật (@450x900mm)
//     - Ty treo ren M8 neo sàn bê tông + Khóa liên kết kẹp U
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
    tierWidth: (window.knnState && window.knnState.tierWidth) || 800, // Độ rộng cấp hộp viền (600-1000mm)
    topBoneSpacing: 900,
    botBoneSpacing: (window.knnState && window.knnState.boneSpacing) || 450,
    hasLedSlot: false
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

  let topStepCad = isMeter ? (opt.topBoneSpacing / 1000.0) : opt.topBoneSpacing;
  let botStepCad = isMeter ? (opt.botBoneSpacing / 1000.0) : opt.botBoneSpacing;
  let tierWidthCad = isMeter ? (opt.tierWidth / 1000.0) : opt.tierWidth;

  let isTopHorizontal = true;
  let fromBottom = true;
  let fromLeft = true;

  if (window.knnState && window.knnState.forceTopOrientation) {
    isTopHorizontal = (window.knnState.forceTopOrientation === 'horizontal');
  } else if (edge1) {
    let dx1 = Math.abs(edge1.p2.x - edge1.p1.x);
    let dy1 = Math.abs(edge1.p2.y - edge1.p1.y);
    isTopHorizontal = (dx1 >= dy1);
    if (isTopHorizontal) {
      let midY = (edge1.p1.y + edge1.p2.y) / 2;
      fromBottom = (midY < (ymin + ymax) / 2);
    } else {
      let midX = (edge1.p1.x + edge1.p2.x) / 2;
      fromLeft = (midX < (xmin + xmax) / 2);
    }
  }

  if (edge2) {
    let midX2 = (edge2.p1.x + edge2.p2.x) / 2;
    let midY2 = (edge2.p1.y + edge2.p2.y) / 2;
    if (isTopHorizontal) {
      fromLeft = (midX2 < (xmin + xmax) / 2);
    } else {
      fromBottom = (midY2 < (ymin + ymax) / 2);
    }
  }

  let tiers = [];
  tiers.push({ level: 0, name: 'Cấp hộp viền ngoài', pts: polyPts, hOffset: 0 });
  let minTierArea = isMeter ? 0.01 : 100;

  if (opt.levelMode === 'cap1') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    if (inner1 && polyArea(inner1) > minTierArea) {
      tiers.push({ level: 1, name: 'Lõi trần trong (Hạ cấp +150mm)', pts: inner1, hOffset: opt.dropDepth });
    }
  } else if (opt.levelMode === 'cap2') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    let inner2 = inner1 ? offsetPolygonInward(inner1, tierWidthCad * 0.8) : null;
    if (inner1 && polyArea(inner1) > minTierArea) tiers.push({ level: 1, name: 'Cấp giật 1', pts: inner1, hOffset: opt.dropDepth });
    if (inner2 && polyArea(inner2) > minTierArea) tiers.push({ level: 2, name: 'Lõi tâm giật 2', pts: inner2, hOffset: opt.dropDepth * 2 });
  } else if (opt.levelMode === 'cap3') {
    let inner1 = offsetPolygonInward(polyPts, tierWidthCad);
    let inner2 = inner1 ? offsetPolygonInward(inner1, tierWidthCad * 0.7) : null;
    let inner3 = inner2 ? offsetPolygonInward(inner2, tierWidthCad * 0.6) : null;
    if (inner1 && polyArea(inner1) > minTierArea) tiers.push({ level: 1, name: 'Cấp 1', pts: inner1, hOffset: opt.dropDepth });
    if (inner2 && polyArea(inner2) > minTierArea) tiers.push({ level: 2, name: 'Cấp 2', pts: inner2, hOffset: opt.dropDepth * 2 });
    if (inner3 && polyArea(inner3) > minTierArea) tiers.push({ level: 3, name: 'Cấp 3', pts: inner3, hOffset: opt.dropDepth * 3 });
  }

  let newEntities = [];
  let totalTopLengthMm = 0;
  let totalLowerMainLengthMm = 0;
  let totalBotLengthMm = 0;
  let totalVLengthMm = 0;
  let totalVerticalStrutsLengthMm = 0;
  let hangerCount = 0;
  let clipCount = 0;
  let strutCount = 0;
  let ledLengthM = 0;

  // 1. NẸP V VIỀN TƯỜNG DÀI 3.0M
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let segLenMm = Math.hypot(p2.x - p1.x, p2.y - p1.y) * scaleUnit;
    totalVLengthMm += segLenMm;

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

  // 2. KHUNG THÀNH ĐỨNG GIẬT CẤP & CÁC THANH CHỐNG ĐỨNG (VERTICAL STRUTS)
  for (let tIdx = 1; tIdx < tiers.length; tIdx++) {
    let tPts = tiers[tIdx].pts;
    let tierPeriMm = polyPeri(tPts) * scaleUnit;
    totalVLengthMm += tierPeriMm;
    if (opt.hasLedSlot) ledLengthM += tierPeriMm / 1000.0;

    for (let i = 0, j = tPts.length - 1; i < tPts.length; j = i++) {
      let p1 = tPts[j], p2 = tPts[i];
      let edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) * scaleUnit;

      newEntities.push({
        id: `knn_drop_edge_${tIdx}_${i}`,
        roomId: roomId,
        type: 'LINE',
        p1: [p1.x, p1.y],
        p2: [p2.x, p2.y],
        color: '#e879f9',
        lineWidth: 2.5,
        layer: '04_NANO_XUONG_THANH_DUNG',
        info: `Gờ viền giật cấp ${tIdx} (Hạ ${tiers[tIdx].hOffset}mm)`
      });

      if (opt.hasLedSlot) {
        newEntities.push({
          id: `knn_led_strip_${tIdx}_${i}`,
          roomId: roomId,
          type: 'LINE',
          p1: [p1.x, p1.y],
          p2: [p2.x, p2.y],
          color: '#fde047',
          lineWidth: 1.5,
          lineDash: [6, 4],
          layer: '07_NANO_LED_STRIP',
          info: `Dải đèn LED khe hắt cấp ${tIdx}`
        });
      }

      // Bố trí các thanh chống đứng (xương đứng) dọc theo thành giật cấp @600mm
      let nStruts = Math.max(1, Math.round(edgeLen / 600.0));
      for (let s = 1; s <= nStruts; s++) {
        let sx = p1.x + (p2.x - p1.x) * (s / (nStruts + 1));
        let sy = p1.y + (p2.y - p1.y) * (s / (nStruts + 1));
        strutCount++;
        totalVerticalStrutsLengthMm += opt.dropDepth;

        let rS = isMeter ? 0.03 : 30.0;
        newEntities.push({
          id: `knn_strut_${tIdx}_${i}_${s}`,
          roomId: roomId,
          type: 'RECTANGLE',
          x: sx - rS / 2,
          y: sy - rS / 2,
          w: rS,
          h: rS,
          color: '#e879f9',
          fillColor: 'rgba(232, 121, 249, 0.8)',
          layer: '04_NANO_XUONG_THANH_DUNG',
          info: `Thanh xương đứng chống giật cấp H=${opt.dropDepth}mm`
        });
      }
    }
  }

  // 3. LỚP XƯƠNG CHÍNH GẦM TRÊN U 3.6M (Neo Ty M8)
  let topSegments = [];
  let topFramePolygon = tiers.length > 1 ? tiers[1].pts : polyPts;
  let topFrameBounds = getBounds(topFramePolygon);
  let firstTopOffset = isMeter ? 0.35 : 350.0;

  if (isTopHorizontal) {
    let curY = fromBottom ? (topFrameBounds.minY + firstTopOffset) : (topFrameBounds.maxY - firstTopOffset);
    let stepY = fromBottom ? topStepCad : -topStepCad;
    while ((fromBottom && curY < topFrameBounds.maxY - (isMeter ? 0.05 : 50)) || (!fromBottom && curY > topFrameBounds.minY + (isMeter ? 0.05 : 50))) {
      let segs = getHSegments(topFramePolygon, curY, isMeter);
      for (let s of segs) {
        topSegments.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY }, isHor: true, coord: curY });
      }
      curY += stepY;
    }
  } else {
    let curX = fromLeft ? (topFrameBounds.minX + firstTopOffset) : (topFrameBounds.maxX - firstTopOffset);
    let stepX = fromLeft ? topStepCad : -topStepCad;
    while ((fromLeft && curX < topFrameBounds.maxX - (isMeter ? 0.05 : 50)) || (!fromLeft && curX > topFrameBounds.minX + (isMeter ? 0.05 : 50))) {
      let segs = getVSegments(topFramePolygon, curX, isMeter);
      for (let s of segs) {
        topSegments.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] }, isHor: false, coord: curX });
      }
      curX += stepX;
    }
  }

  topSegments.forEach((seg, sIdx) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalTopLengthMm += segLenMm;

    newEntities.push({
      id: `knn_top_bar_${sIdx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#2563eb',
      lineWidth: 3.0,
      layer: '03_NANO_XUONG_CHINH_TREN_3M6',
      info: `Thanh xương chính TRÊN 3.6m (@900 neo ty) - Dài: ${segLenMm.toFixed(0)}mm`
    });

    let nHangers = Math.max(2, Math.round(segLenMm / 1000.0) + 1);
    let dx = (seg.p2.x - seg.p1.x) / (nHangers + 1);
    let dy = (seg.p2.y - seg.p1.y) / (nHangers + 1);

    for (let h = 1; h <= nHangers; h++) {
      let hx = seg.p1.x + dx * h;
      let hy = seg.p1.y + dy * h;
      if (isPointInPoly({ x: hx, y: hy }, polyPts)) {
        hangerCount++;
        let rHanger = isMeter ? 0.045 : 45.0;
        newEntities.push({
          id: `knn_hanger_${sIdx}_${h}`,
          roomId: roomId,
          type: 'CIRCLE',
          cx: hx,
          cy: hy,
          r: rHanger,
          color: '#facc15',
          fillColor: 'rgba(250, 204, 21, 0.5)',
          layer: '06_NANO_TY_TREO',
          info: `Bộ Ty treo M8 neo sàn bê tông + Tăng đơ (@1000mm)`
        });
      }
    }
  });

  // 4. LỚP XƯƠNG PHỤ GẦM DƯỚI U 3.6M (Gánh Tấm Nano)
  let botSegments = [];
  let botFramePolygon = tiers.length > 1 ? tiers[1].pts : polyPts;
  let firstBotOffset = isMeter ? 0.30 : 300.0;

  if (isTopHorizontal) {
    let curX = fromLeft ? (xmin + firstBotOffset) : (xmax - firstBotOffset);
    let stepX = fromLeft ? botStepCad : -botStepCad;
    while ((fromLeft && curX < xmax - (isMeter ? 0.05 : 50)) || (!fromLeft && curX > xmin + (isMeter ? 0.05 : 50))) {
      let segs = getVSegments(botFramePolygon, curX, isMeter);
      for (let s of segs) {
        botSegments.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] }, isHor: false, coord: curX });
      }
      curX += stepX;
    }
  } else {
    let curY = fromBottom ? (ymin + firstBotOffset) : (ymax - firstBotOffset);
    let stepY = fromBottom ? botStepCad : -botStepCad;
    while ((fromBottom && curY < ymax - (isMeter ? 0.05 : 50)) || (!fromBottom && curY > ymin + (isMeter ? 0.05 : 50))) {
      let segs = getHSegments(botFramePolygon, curY, isMeter);
      for (let s of segs) {
        botSegments.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY }, isHor: true, coord: curY });
      }
      curY += stepY;
    }
  }

  if (tiers.length > 1) {
    if (isTopHorizontal) {
      let curX = fromLeft ? (xmin + firstBotOffset) : (xmax - firstBotOffset);
      let stepX = fromLeft ? botStepCad : -botStepCad;
      while ((fromLeft && curX < xmax - (isMeter ? 0.05 : 50)) || (!fromLeft && curX > xmin + (isMeter ? 0.05 : 50))) {
        let segs = getRingSegments(polyPts, botFramePolygon, curX, false, isMeter);
        for (let s of segs) {
          botSegments.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] }, isHor: false, coord: curX, isDropRing: true });
        }
        curX += stepX;
      }
    } else {
      let curY = fromBottom ? (ymin + firstBotOffset) : (ymax - firstBotOffset);
      let stepY = fromBottom ? botStepCad : -botStepCad;
      while ((fromBottom && curY < ymax - (isMeter ? 0.05 : 50)) || (!fromBottom && curY > ymin + (isMeter ? 0.05 : 50))) {
        let segs = getRingSegments(polyPts, botFramePolygon, curY, true, isMeter);
        for (let s of segs) {
          botSegments.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY }, isHor: true, coord: curY, isDropRing: true });
        }
        curY += stepY;
      }
    }
  }

  let lowerMainSegments = [];
  if (tiers.length > 1) {
    if (isTopHorizontal) {
      let curY = fromBottom ? (ymin + firstTopOffset) : (ymax - firstTopOffset);
      let stepY = fromBottom ? topStepCad : -topStepCad;
      while ((fromBottom && curY < ymax - (isMeter ? 0.05 : 50)) || (!fromBottom && curY > ymin + (isMeter ? 0.05 : 50))) {
        let segs = getRingSegments(polyPts, botFramePolygon, curY, true, isMeter);
        for (let s of segs) lowerMainSegments.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY }, isHor: true, coord: curY });
        curY += stepY;
      }
    } else {
      let curX = fromLeft ? (xmin + firstTopOffset) : (xmax - firstTopOffset);
      let stepX = fromLeft ? topStepCad : -topStepCad;
      while ((fromLeft && curX < xmax - (isMeter ? 0.05 : 50)) || (!fromLeft && curX > xmin + (isMeter ? 0.05 : 50))) {
        let segs = getRingSegments(polyPts, botFramePolygon, curX, false, isMeter);
        for (let s of segs) lowerMainSegments.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] }, isHor: false, coord: curX });
        curX += stepX;
      }
    }
  }

  lowerMainSegments.forEach((seg, index) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalLowerMainLengthMm += segLenMm;
    newEntities.push({
      id: `knn_lower_main_${index}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#2563eb',
      lineWidth: 2.5,
      layer: '03_NANO_XUONG_CHINH_DUOI_3M6',
      info: `Thanh xương chính cấp dưới U 3.6m (@900) - Dài: ${segLenMm.toFixed(0)}mm`
    });
  });

  botSegments.forEach((seg, bIdx) => {
    let segLenMm = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y) * scaleUnit;
    totalBotLengthMm += segLenMm;

    newEntities.push({
      id: `knn_bot_bar_${bIdx}`,
      roomId: roomId,
      type: 'LINE',
      p1: [seg.p1.x, seg.p1.y],
      p2: [seg.p2.x, seg.p2.y],
      color: '#f97316',
      lineWidth: 2.0,
      layer: '04_NANO_XUONG_PHU_DUOI_3M6',
      info: `Thanh xương phụ DƯỚI 3.6m (@450 gánh tấm) - Dài: ${segLenMm.toFixed(0)}mm`
    });
  });

  // 5. KHÓA LIÊN KẾT TẠI MỌI GIAO ĐIỂM
  topSegments.concat(lowerMainSegments).forEach((topSeg, tIdx) => {
    botSegments.forEach((botSeg, bIdx) => {
      let intPt = null;
      if (topSeg.isHor && !botSeg.isHor) {
        let ix = botSeg.coord, iy = topSeg.coord;
        if (ix >= Math.min(topSeg.p1.x, topSeg.p2.x) && ix <= Math.max(topSeg.p1.x, topSeg.p2.x) &&
            iy >= Math.min(botSeg.p1.y, botSeg.p2.y) && iy <= Math.max(botSeg.p1.y, botSeg.p2.y)) {
          intPt = { x: ix, y: iy };
        }
      } else if (!topSeg.isHor && botSeg.isHor) {
        let ix = topSeg.coord, iy = botSeg.coord;
        if (ix >= Math.min(botSeg.p1.x, botSeg.p2.x) && ix <= Math.max(botSeg.p1.x, botSeg.p2.x) &&
            iy >= Math.min(topSeg.p1.y, topSeg.p2.y) && iy <= Math.max(topSeg.p1.y, topSeg.p2.y)) {
          intPt = { x: ix, y: iy };
        }
      }

      if (intPt && isPointInPoly(intPt, polyPts)) {
        clipCount++;
        let sz = isMeter ? 0.03 : 30.0;
        newEntities.push({
          id: `knn_clip_${tIdx}_${bIdx}`,
          roomId: roomId,
          type: 'RECTANGLE',
          x: intPt.x - sz,
          y: intPt.y - sz,
          w: sz * 2,
          h: sz * 2,
          color: '#f8fafc',
          fillColor: 'rgba(248, 250, 252, 0.85)',
          layer: '05_NANO_KHOA_LIEN_KET',
          info: `Khóa liên kết chéo kẹp 2 thanh xương U trên & dưới`
        });
      }
    });
  });

  // 6. MÔ PHỎNG TẤM NANO / LAM SÓNG
  let nanoPanelCad = isMeter ? (opt.materialType === 'nano300' ? 0.3 : (opt.materialType === 'lamsong' ? 0.2 : 0.4)) : (opt.materialType === 'nano300' ? 300 : (opt.materialType === 'lamsong' ? 200 : 400));
  let panelLines = [];
  let panelPolygon = tiers.length > 1 ? tiers[1].pts : polyPts;
  let panelBounds = getBounds(panelPolygon);

  if (isTopHorizontal) {
    let curY = fromBottom ? (panelBounds.minY + nanoPanelCad) : (panelBounds.maxY - nanoPanelCad);
    let stepY = fromBottom ? nanoPanelCad : -nanoPanelCad;
    while ((fromBottom && curY < panelBounds.maxY) || (!fromBottom && curY > panelBounds.minY)) {
      let segs = getHSegments(panelPolygon, curY, isMeter);
      for (let s of segs) {
        panelLines.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY } });
      }
      curY += stepY;
    }
  } else {
    let curX = fromLeft ? (panelBounds.minX + nanoPanelCad) : (panelBounds.maxX - nanoPanelCad);
    let stepX = fromLeft ? nanoPanelCad : -nanoPanelCad;
    while ((fromLeft && curX < panelBounds.maxX) || (!fromLeft && curX > panelBounds.minX)) {
      let segs = getVSegments(panelPolygon, curX, isMeter);
      for (let s of segs) {
        panelLines.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] } });
      }
      curX += stepX;
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

  let bomResult = generateKNNBOMEntities({
    realAreaM2,
    realPeriM,
    totalTopLengthMm,
    totalLowerMainLengthMm,
    totalBotLengthMm,
    totalVLengthMm,
    totalVerticalStrutsLengthMm,
    hangerCount,
    clipCount,
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
    edge1,
    edge2,
    tiers,
    opt,
    realAreaM2,
    realPeriM,
    isTopHorizontal,
    totalTopLengthM: totalTopLengthMm / 1000.0,
    totalLowerMainLengthM: totalLowerMainLengthMm / 1000.0,
    totalBotLengthM: totalBotLengthMm / 1000.0,
    totalVLengthM: totalVLengthMm / 1000.0,
    topBarOrder: Math.ceil((totalTopLengthMm / 3600.0) * 1.05),
    lowerMainBarOrder: Math.ceil((totalLowerMainLengthMm / 3600.0) * 1.05),
    botBarOrder: Math.ceil((totalBotLengthMm / 3600.0) * 1.05),
    totalUBarOrder: Math.ceil(((totalTopLengthMm + totalLowerMainLengthMm + totalBotLengthMm + totalVerticalStrutsLengthMm) / 3600.0) * 1.05),
    vBarOrder: Math.ceil((totalVLengthMm / 3000.0) * 1.05),
    hangerOrder: Math.ceil(hangerCount * 1.05),
    clipOrder: Math.ceil(clipCount * 1.05),
    strutCount,
    nanoAreaM2: Math.ceil(bomResult.totalPanelAreaM2 * 1.07),
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
//     KNN BILL OF MATERIALS (BOM) & ESTIMATION ENGINE
// ===============================================================================

function generateKNNBOMEntities(data) {
  const { realAreaM2, realPeriM, totalTopLengthMm, totalLowerMainLengthMm, totalBotLengthMm, totalVLengthMm, totalVerticalStrutsLengthMm, hangerCount, clipCount, strutCount, ledLengthM, opt, tiers, xmax, ymax, isMeter } = data;
  const bomEntities = [];

  let topUBars = Math.ceil((totalTopLengthMm / 3600.0) * 1.05);
  let lowerMainUBars = Math.ceil((totalLowerMainLengthMm / 3600.0) * 1.05);
  let botUBars = Math.ceil((totalBotLengthMm / 3600.0) * 1.05);
  let strutUBars = Math.ceil(((totalVerticalStrutsLengthMm || 0) / 3600.0) * 1.05);
  let totalUBars = topUBars + lowerMainUBars + botUBars + strutUBars;

  let vBars = Math.ceil((totalVLengthMm / 3000.0) * 1.05);
  let hangers = Math.ceil(hangerCount * 1.05);
  let clips = Math.ceil(clipCount * 1.05);
  let verticalPanelAreaM2 = 0;
  for (let tierIndex = 1; tierIndex < tiers.length; tierIndex++) {
    let heightDeltaMm = tiers[tierIndex].hOffset - tiers[tierIndex - 1].hOffset;
    let perimeterMm = polyPeri(tiers[tierIndex].pts) * (isMeter ? 1000 : 1);
    verticalPanelAreaM2 += perimeterMm * Math.max(0, heightDeltaMm) / 1e6;
  }
  let totalPanelAreaM2 = realAreaM2 + verticalPanelAreaM2;
  let nanoM2 = (totalPanelAreaM2 * 1.07).toFixed(1);
  let phaoChiM = (realPeriM * 1.05).toFixed(1);
  let keInoxHop = Math.max(1, Math.ceil(realAreaM2 * 4 / 100));
  let panelWidthMm = opt.materialType === 'lamsong' ? 210 : (opt.materialType === 'nano300' ? 300 : 400);
  let panelLengthMm = 3000;
  let panelAreaM2 = panelWidthMm * panelLengthMm / 1e6;
  let panelCount = Math.max(1, Math.ceil((totalPanelAreaM2 * 1.07) / panelAreaM2));

  let tabX = xmax + (isMeter ? 1.5 : 1500);
  let tabY = ymax;
  let tabW = isMeter ? 6.8 : 6800;
  let rh = isMeter ? 0.46 : 460;
  let th = isMeter ? 0.60 : 600;

  let levelName = opt.levelMode === 'cap0' ? 'Trần Phẳng' : (opt.levelMode === 'cap1' ? 'Giật 1 Cấp' : (opt.levelMode === 'cap2' ? 'Giật 2 Cấp' : 'Giật 3 Cấp'));
  let matName = opt.materialType === 'lamsong' ? 'Tấm Lam Sóng 3 sóng 210mm x 3m' : (opt.materialType === 'nano300' ? 'Tấm Nano 300mm x 3m' : 'Tấm Nano 400mm x 3m');

  const bomRows = [
    { stt: "1", name: `${matName} (${levelName})`, unit: "tấm", qty: `${panelCount}`, note: `${panelAreaM2.toFixed(2)}m²/tấm; ngang ${realAreaM2.toFixed(1)}m² + mặt đứng ${verticalPanelAreaM2.toFixed(1)}m² (+7%)`, color: '#06b6d4', icon: '■' },
    { stt: "2", name: "Thanh xương CHÍNH TRÊN U 3.6m (Neo Ty)", unit: "cây", qty: `${topUBars}`, note: `Lớp trên @900mm neo ty (${(totalTopLengthMm / 1000).toFixed(1)}m)`, color: '#2563eb', icon: '━' },
    { stt: "3", name: "Thanh xương CHÍNH CẤP DƯỚI U 3.6m (@900)", unit: "cây", qty: `${lowerMainUBars}`, note: `Khung vành hộp cấp dưới (${(totalLowerMainLengthMm / 1000).toFixed(1)}m)`, color: '#2563eb', icon: '━' },
    { stt: "4", name: "Thanh xương PHỤ DƯỚI U 3.6m (@450)", unit: "cây", qty: `${botUBars}`, note: `Gánh tấm lõi và vành hộp (${(totalBotLengthMm / 1000).toFixed(1)}m)`, color: '#f97316', icon: '━' },
    { stt: "5", name: "Thanh xương ĐỨNG CHỐNG HỘP GIẬT CẤP", unit: "cây", qty: `${strutUBars || 1}`, note: `${strutCount} vị trí chống đứng H=${opt.dropDepth}mm`, color: '#e879f9', icon: '┃' },
    { stt: "6", name: "Khóa liên kết 2 tầng xương (Khóa chéo U)", unit: "cái", qty: `${clips}`, note: "Kẹp chặt thanh trên & thanh dưới", color: '#f8fafc', icon: '✛' },
    { stt: "7", name: "Nẹp V viền tường dài 3.0m (20x20)", unit: "cây", qty: `${vBars}`, note: `Tổng ${(totalVLengthMm / 1000).toFixed(1)}m viền tường & hộp giật`, color: '#38bdf8', icon: '━' },
    { stt: "8", name: "Bộ Ty treo ren M8 + Tăng đơ + Bát treo", unit: "bộ", qty: `${hangers}`, note: "Bước ty @1000mm neo sàn bê tông", color: '#facc15', icon: '◎' },
    { stt: "9", name: "Ke Inox khóa hèm + Vít tự khoan", unit: "hộp", qty: `${keInoxHop}`, note: "Ke giấu vít bắn vào xương đáy", color: '#a855f7', icon: '◆' },
    { stt: "10", name: "Phào cổ trần viền chân tường (Cây 3m)", unit: "mét", qty: `${phaoChiM}`, note: "Che góc tiếp giáp trần & tường", color: '#f59e0b', icon: '━' }
  ];

  if (opt.hasLedSlot && ledLengthM > 0) {
    bomRows.push({
      stt: "10",
      name: "Dải đèn LED dây hắt sáng 3000K/4000K",
      unit: "mét",
      qty: `${Math.ceil(ledLengthM)}`,
      note: `Khe hắt LED âm cấp giật (${ledLengthM.toFixed(1)}m)`,
      color: '#fde047',
      icon: '💡'
    });
  }

  let totH = th + bomRows.length * rh;
  let fTitle = isMeter ? 0.20 : 200;
  let fBody = isMeter ? 0.135 : 135;
  let fSub = isMeter ? 0.105 : 105;
  let fIcon = isMeter ? 0.16 : 160;

  bomEntities.push({ id: 'knn_tb_1', type: 'RECTANGLE', x: tabX, y: tabY - totH, w: tabW, h: totH, color: '#38bdf8', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_tb_2', type: 'RECTANGLE', x: tabX, y: tabY - th, w: tabW, h: th, color: '#38bdf8', fillColor: 'rgba(56, 189, 248, 0.25)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_tb_tt', type: 'TEXT', x: tabX + tabW / 2, y: tabY - th / 2, text: `BẢNG DỰ TOÁN KHUNG XƯƠNG TRẦN NANO THỰC TẾ (${levelName.toUpperCase()})`, size: fTitle, color: '#38bdf8', align: 'center', layer: 'BOM_TABLE' });

  for (let i = 0; i < bomRows.length; i++) {
    let ry = tabY - th - (i + 1) * rh;
    let item = bomRows[i];

    bomEntities.push({ id: `knn_tb_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_s_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.25 : 250), y: ry + rh / 2, text: item.stt, size: fSub, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.55 : 550), y: ry + rh / 2, text: item.icon, size: fIcon, color: item.color, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_n_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.85 : 850), y: ry + rh / 2, text: item.name, size: fBody, color: item.color, align: 'left', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_q_${i}`, type: 'TEXT', x: tabX + tabW - (isMeter ? 2.1 : 2100), y: ry + rh / 2, text: `${item.qty} ${item.unit}`, size: fBody, color: '#4ade80', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_tb_g_${i}`, type: 'TEXT', x: tabX + tabW - (isMeter ? 1.05 : 1050), y: ry + rh / 2, text: item.note, size: fSub, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
  }

  let legY = tabY - totH - (isMeter ? 0.4 : 400);
  let legRows = 6;
  let legH = th + legRows * rh;
  bomEntities.push({ id: 'knn_leg_1', type: 'RECTANGLE', x: tabX, y: legY - legH, w: tabW, h: legH, color: '#facc15', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_leg_2', type: 'RECTANGLE', x: tabX, y: legY - th, w: tabW, h: th, color: '#facc15', fillColor: 'rgba(250, 204, 21, 0.22)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'knn_leg_tt', type: 'TEXT', x: tabX + tabW / 2, y: legY - th / 2, text: `CHÚ DẪN CẤU TẠO KHUNG HỘP GIẬT CẤP TRẦN NANO`, size: fTitle, color: '#facc15', align: 'center', layer: 'BOM_TABLE' });

  const legends = [
    { ic: "━", col: "#2563eb", t: "Thanh chính TRÊN U 3.6m (Xanh dương): Bước @900mm, neo ty M8 từ sàn bê tông" },
    { ic: "━", col: "#f97316", t: "Thanh phụ DƯỚI U 3.6m (Cam): Bước @450mm, gánh đáy bắn tấm nano" },
    { ic: "┃", col: "#e879f9", t: "Thanh chống ĐỨNG thành hộp (Tím): Giằng hộp giật cấp H=150mm @600mm" },
    { ic: "✛", col: "#f8fafc", t: "Khóa liên kết 2 tầng (Trắng): Kẹp chặt thanh trên & thanh dưới tại mọi giao điểm" },
    { ic: "━", col: "#38bdf8", t: "Nẹp V viền tường 3.0m (Cyan): Chạy bao quanh tường và viền mép giật cấp" },
    { ic: "■", col: "#06b6d4", t: "Tấm ốp Nano / Lam Sóng: Khóa hèm âm dương, bắn ke inox vào xương đáy" }
  ];

  for (let i = 0; i < legends.length; i++) {
    let ry = legY - th - (i + 1) * rh;
    let item = legends[i];
    bomEntities.push({ id: `knn_leg_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_leg_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.35 : 350), y: ry + rh / 2, text: item.ic, size: fIcon, color: item.col, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `knn_leg_tx_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.7 : 700), y: ry + rh / 2, text: item.t, size: fSub, color: '#e2e8f0', align: 'left', layer: 'BOM_TABLE' });
  }

  return { bomEntities, tabX, tabY, tabW, totalPanelAreaM2 };
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
  let curTierWidth = (window.knnState && window.knnState.tierWidth) || 800;

  if (isStep2) {
    bar.innerHTML = `
      <span style="color:#06b6d4; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:2px;">
        🏛️ KHUNG HỘP NANO:
      </span>

      <select id="knn-sel-level" onchange="window.setKNNLevelMode(this.value)" style="font-size:11px; font-weight:bold; color:#facc15; background:#1e293b; border:1px solid #06b6d4; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="cap0" ${curLevel === 'cap0' ? 'selected' : ''}>Trần Phẳng</option>
        <option value="cap1" ${curLevel === 'cap1' ? 'selected' : ''}>Trần Giật 1 Cấp</option>
        <option value="cap2" ${curLevel === 'cap2' ? 'selected' : ''}>Trần Giật 2 Cấp</option>
        <option value="cap3" ${curLevel === 'cap3' ? 'selected' : ''}>Trần Giật 3 Cấp</option>
      </select>

      <select id="knn-sel-mat" onchange="window.setKNNMaterial(this.value)" style="font-size:11px; font-weight:bold; color:#38bdf8; background:#1e293b; border:1px solid #475569; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="nano400" ${curMat === 'nano400' ? 'selected' : ''}>Tấm Nano 400 (Xương Đáy @450)</option>
        <option value="nano300" ${curMat === 'nano300' ? 'selected' : ''}>Tấm Nano 300 (Xương Đáy @400)</option>
        <option value="lamsong" ${curMat === 'lamsong' ? 'selected' : ''}>Tấm Lam Sóng (Xương Đáy @350)</option>
      </select>

      <select id="knn-sel-tier" onchange="window.setKNNTierWidth(this.value)" title="Bề rộng cấp dưới" style="font-size:11px; font-weight:bold; color:#f97316; background:#1e293b; border:1px solid #f97316; padding:3px 8px; border-radius:12px; cursor:pointer;">
        <option value="600" ${curTierWidth === 600 ? 'selected' : ''}>Hộp 600mm</option>
        <option value="800" ${curTierWidth === 800 ? 'selected' : ''}>Hộp 800mm</option>
        <option value="1000" ${curTierWidth === 1000 ? 'selected' : ''}>Hộp 1000mm</option>
      </select>

      <button onclick="window.toggleKNNUDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Đổi hướng xương chính trên (Ngang / Dọc)">
        🔄 Đổi Hướng Xương
      </button>

      <button onclick="window.executeKNNFromSelectionOrCanvas()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Bắt đầu tính toán và tái tạo khung (Phím Enter)">
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
      <button onclick="window.openKNN3DModal()" class="btn btn-accent" style="font-size:11px; padding:3px 9px; background:#0284c7; color:#fff; font-weight:bold; border-radius:12px; cursor:pointer;">
        📦 3D Phối Cảnh Thực Tế
      </button>
      <button onclick="window.openKNNSectionModal()" class="btn btn-accent" style="font-size:11px; padding:3px 9px; background:#7c3aed; color:#fff; font-weight:bold; border-radius:12px; cursor:pointer;">
        🔍 Mặt Cắt Kỹ Thuật 2D
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
    KNN1: ['Nhập KNN1 để bắt đầu.', 'Quét chọn đường bao phòng hoặc kéo chuột chọn các nét phòng.', 'Nhấn Enter để chuyển sang bước chọn thông số.', 'Chọn cấp trần và loại tấm Nano, sau đó nhấn Enter để tạo khung.'],
    KNN: ['Hoạt động giống KNN1.', 'Chọn phòng, nhấn Enter, chọn thông số và nhấn Enter lần nữa để dựng khung.'],
    NAN0: ['Dựng trần phẳng.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN1: ['Dựng trần giật 1 cấp.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN2: ['Dựng trần giật 2 cấp.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    NAN3: ['Dựng trần giật 3 cấp.', 'Quét chọn phòng rồi nhấn Enter để tạo ngay.'],
    N3D: ['Mở phối cảnh 3D khung trần Nano.', 'Cần tạo khung trước.', 'Dùng P để kéo, R để xoay, cuộn chuột để zoom.'],
    NSEC: ['Mở mặt cắt kỹ thuật 2D.', 'Cần tạo khung trước.']
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
      updateCommandGuide(command);
    });
  });

  let updateCommandGuide = command => {
    let normalized = (command || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
      commandGuide.querySelector('#knn-command-guide-help').innerHTML = 'Nhập một lệnh Nano trong COMMAND để xem hướng dẫn từng bước.';
      return;
    }
    let key = commandNames.find(name => name === normalized || name.startsWith(normalized));
    let help = commandGuide.querySelector('#knn-command-guide-help');
    if (!key) {
      help.innerHTML = 'Nhập một lệnh Nano trong COMMAND để xem hướng dẫn từng bước.';
      return;
    }
    help.innerHTML = `<strong style="color:#22d3ee;">${key}</strong><ol style="margin:5px 0 0 18px;padding:0;">${commandHelp[key].map(step => `<li style="margin:3px 0;">${step}</li>`).join('')}</ol>`;
  };

  let hideBtn = commandGuide.querySelector('#knn-command-guide-hide');
  if (hideBtn) hideBtn.addEventListener('click', () => showGuide(false));
  if (tab) tab.addEventListener('click', () => showGuide(true));
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

  let readCommandValue = target => target && (target.value || target.textContent || target.innerText || '');
  if (window.knnCommandGuideInputHandler) document.removeEventListener('input', window.knnCommandGuideInputHandler);
  window.knnCommandGuideInputHandler = event => {
    let target = event.target;
    if (target && (target.matches('input, textarea, [contenteditable="true"]'))) {
      updateCommandGuide(readCommandValue(target));
    }
  };
  document.addEventListener('input', window.knnCommandGuideInputHandler);
  if (window.knnCommandGuideKeyHandler) document.removeEventListener('keydown', window.knnCommandGuideKeyHandler);
  window.knnCommandGuideBuffer = '';
  window.knnCommandGuideKeyHandler = event => {
    if (event.key === 'Backspace') window.knnCommandGuideBuffer = window.knnCommandGuideBuffer.slice(0, -1);
    else if (event.key === 'Escape' || event.key === 'Enter') window.knnCommandGuideBuffer = '';
    else if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) window.knnCommandGuideBuffer += event.key;
    updateCommandGuide(window.knnCommandGuideBuffer || readCommandValue(document.activeElement));
  };
  document.addEventListener('keydown', window.knnCommandGuideKeyHandler);
}

function ensureKNN3DToolbarBridge() {
  if (typeof document === 'undefined' || !document.body) return;
  if (window.knn3dToolbarClickHandler) document.removeEventListener('click', window.knn3dToolbarClickHandler, true);
  window.knn3dToolbarClickHandler = event => {
    let button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || button.id === 'knn-command-guide-tab') return;
    let label = (button.textContent || button.innerText || '').replace(/\s+/g, ' ').trim();
    if (!/Xem\s+3D/i.test(label)) return;
    // Chỉ kích hoạt Nano 3D nếu bản vẽ hiện tại có kết quả Nano và không phải vừa chạy TT600
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
  if (typeof document === 'undefined') return;
  if (window.knnEnterFallbackHandler) {
    document.removeEventListener('keydown', window.knnEnterFallbackHandler, true);
    document.removeEventListener('keydown', window.knnEnterFallbackHandler, false);
  }
  window.knnEnterFallbackHandler = event => {
    let state = window.knnState;
    if (event.key !== 'Enter' || !state || !state.active || state.step !== 1) return;
    if (typeof currentTool !== 'undefined' && currentTool !== 'KNN1') return;
    let target = event.target;
    if (target && target.matches && target.matches('input, textarea, [contenteditable="true"]')) {
      if (target.value && target.value.trim().length > 0) return;
    }
    if (typeof selectedIds === 'undefined' || !selectedIds || selectedIds.size === 0) return;
    event.preventDefault();
    state.enterHandledAt = Date.now();
    if (typeof window.executeKNNFromSelectionOrCanvas === 'function') window.executeKNNFromSelectionOrCanvas();
  };
  document.addEventListener('keydown', window.knnEnterFallbackHandler, false);
}

window.setKNNLevelMode = function(lvl) {
  if (!window.knnState) window.knnState = {};
  window.knnState.levelMode = lvl;
  if (window.knnState.step === 3 && window.knnState.polyPts) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
    if (typeof render === 'function') render();
  }
};

window.setKNNMaterial = function(mat) {
  if (!window.knnState) window.knnState = {};
  window.knnState.materialType = mat;
  if (mat === 'lamsong') window.knnState.boneSpacing = 350;
  else if (mat === 'nano300') window.knnState.boneSpacing = 400;
  else window.knnState.boneSpacing = 450;

  if (window.knnState.step === 3 && window.knnState.polyPts) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
    if (typeof render === 'function') render();
  }
};

window.setKNNTierWidth = function(width) {
  if (!window.knnState) window.knnState = {};
  window.knnState.tierWidth = Math.max(600, Math.min(1000, Number(width) || 800));
  if (window.knnState.step === 3 && window.knnState.polyPts) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
    if (typeof render === 'function') render();
    ensureKNNFloatingUI();
  }
};

window.toggleKNNUDirection = function() {
  if (!window.knnState) window.knnState = {};
  let cur = window.knnState.forceTopOrientation || (window.knnState.lastResult && window.knnState.lastResult.isTopHorizontal ? 'horizontal' : 'vertical');
  window.knnState.forceTopOrientation = (cur === 'horizontal') ? 'vertical' : 'horizontal';

  if (typeof setInfo === 'function') {
    setInfo(`🔄 Đã đổi hướng xương chính sang: ${window.knnState.forceTopOrientation === 'horizontal' ? 'NGANG (Trục X)' : 'DỌC (Trục Y)'}`);
  }

  if (window.knnState.polyPts && window.knnState.polyPts.length >= 3) {
    executeKNNAlgorithm(window.knnState.polyPts, window.knnState.edge1, window.knnState.edge2);
    if (typeof render === 'function') render();
  }
};


// === MODULE: trannano/5_view_3d.js ===
// ===============================================================================
//     KNN 3D ISOMETRIC VIEWER - BOX TRUSS CONSTRUCTION SCENE
//     Mô phỏng phối cảnh 3D trực quan y như ảnh thi công thực tế:
//     - Khung hộp giật cấp viền ngoài hạ thấp, xương đứng chống giật, gờ hắt LED
//     - Lõi trần giật âm nâng cao bên trong với lưới xương đan ô vuông/chữ nhật
//     - Tấm Nano vân sáng đang ốp vào mặt đáy và thành giật cấp
//     - Bộ lọc bật/tắt: Khung Xương Thi Công / Tấm Nano Hoàn Thiện / Dải LED
// ===============================================================================

window.openKNN3DModal = function() {
  let res = (window.knnState && window.knnState.lastResult) || null;
  if (!res) {
    alert("Vui lòng quét chọn phòng và chạy lệnh KNN1 tạo khung trước khi xem 3D.");
    return;
  }

  let oldModal = document.getElementById('knn-3d-modal');
  if (oldModal) oldModal.remove();

  let modal = document.createElement('div');
  modal.id = 'knn-3d-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.9)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  modal.innerHTML = `
    <div style="width:93vw; height:90vh; background:#0f172a; border:2px solid #06b6d4; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.85);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; background:#1e293b; border-bottom:1.5px solid #334155;">
        <div style="font-weight:bold; font-size:13.5px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          <span>📦 PHỐI CẢNH 3D HỆ KHUNG HỘP GIẬT CẤP TRẦN NANO (CÔNG TRÌNH THỰC TẾ)</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="color:#94a3b8; font-size:11px;">💡 Kéo chuột xoay 360° • Cuộn để Zoom</span>
          <button onclick="window.closeKNN3DModal()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold; background:#ef4444; color:#fff; border-radius:6px; cursor:pointer;">✕ Đóng</button>
        </div>
      </div>

      <div style="flex:1; position:relative; display:flex; min-width:0; min-height:0; overflow:hidden;">
        <div style="flex:1; position:relative; min-width:0; min-height:0; height:100%;">
          <canvas id="knn-3d-canvas" style="width:100%; height:100%; background:#020617; display:block;"></canvas>
        </div>

        <div style="width:290px; min-width:290px; background:#0f172a; border-left:1.5px solid #334155; padding:12px; display:flex; flex-direction:column; gap:10px; font-size:11.5px; color:#cbd5e1; overflow-y:auto;">
          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px;">🎮 GÓC NHÌN NHANH:</div>
          <div style="display:flex; gap:6px;">
            <button onclick="window.setKNN3DMode('pan')" style="flex:1; padding:6px; font-size:11px; background:#0e7490; border:1px solid #22d3ee; color:#fff; border-radius:6px; cursor:pointer;">✋ Pan (P)</button>
            <button onclick="window.setKNN3DMode('rotate')" style="flex:1; padding:6px; font-size:11px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer;">🔄 Xoay (R)</button>
          </div>
          <button onclick="setKNN3DAngle(45, 30)" class="btn btn-accent" style="padding:6px; font-size:11px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer;">📦 Góc Nghiêng 3D (45°)</button>
          <button onclick="setKNN3DAngle(0, 89.9)" class="btn btn-accent" style="padding:6px; font-size:11px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer;">📐 Nhìn Mặt Bằng Từ Trên Xuống</button>
          <button onclick="setKNN3DAngle(0, -55)" class="btn btn-accent" style="padding:6px; font-size:11px; background:#1e293b; border:1px solid #475569; color:#fff; border-radius:6px; cursor:pointer;">👀 Nhìn Ngước Dưới Lên (Ceiling View)</button>

          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px; margin-top:6px;">👁️ BẬT / TẮT LỚP 3D:</div>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-v" checked onchange="drawKNN3D()"> 🔷 Nẹp V Viền Tường 3.0m</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-top" checked onchange="drawKNN3D()"> 🔷 Xương Chính TRÊN U 3.6m (@900)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-bot" checked onchange="drawKNN3D()"> 🟧 Xương Đáy Hộp U 3.6m (@450)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-strut" checked onchange="drawKNN3D()"> 🟪 Xương Đứng Chống Hộp Giật Cấp</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-clip" checked onchange="drawKNN3D()"> ✛ Khóa Liên Kết 2 Tầng</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-hanger" checked onchange="drawKNN3D()"> 🟡 Ty Treo Ren M8 (@1000)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="knn-chk-panel" checked onchange="drawKNN3D()"> 🟦 Tấm Ốp Nano Vân Đá Sáng</label>

          <div style="margin-top:auto; background:#1e293b; padding:10px; border-radius:8px; font-size:11px; border:1px solid #334155;">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">📊 Bóc Tách Khung Hộp:</div>
            <div>• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b></div>
            <div>• Xương chính trên: <b>${res.topBarOrder} cây</b></div>
            <div>• Xương đáy hộp: <b>${res.botBarOrder} cây</b></div>
            <div>• Xương đứng chống: <b>${res.strutCount} thanh</b></div>
            <div>• Nẹp V viền 3m: <b>${res.vBarOrder} cây</b></div>
            <div>• Ty treo M8: <b>${res.hangerOrder} bộ</b></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  initKNN3DCanvas(res);
};

var knn3dState = window.knn3dState || {
  rotX: 35,
  rotZ: 45,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  mode: 'rotate',
  lastMouseX: 0,
  lastMouseY: 0
};
window.knn3dState = knn3dState;

window.closeKNN3DModal = function() {
  let modal = document.getElementById('knn-3d-modal');
  if (modal) modal.remove();
  if (window.knn3dMouseMoveHandler) {
    window.removeEventListener('mousemove', window.knn3dMouseMoveHandler);
    window.knn3dMouseMoveHandler = null;
  }
  if (window.knn3dMouseUpHandler) {
    window.removeEventListener('mouseup', window.knn3dMouseUpHandler);
    window.knn3dMouseUpHandler = null;
  }
  if (window.knn3dResizeHandler) {
    window.removeEventListener('resize', window.knn3dResizeHandler);
    window.knn3dResizeHandler = null;
  }
  if (window.knn3dKeyHandler) {
    document.removeEventListener('keydown', window.knn3dKeyHandler);
    window.knn3dKeyHandler = null;
  }
  knn3dState.isDragging = false;
};

window.setKNN3DAngle = function(z, x) {
  knn3dState.rotZ = z;
  knn3dState.rotX = x;
  drawKNN3D();
};

window.setKNN3DMode = function(mode) {
  knn3dState.mode = mode === 'pan' ? 'pan' : 'rotate';
  let cvs = document.getElementById('knn-3d-canvas');
  if (cvs) cvs.style.cursor = knn3dState.mode === 'pan' ? 'grab' : 'crosshair';
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
    cvs.style.cursor = knn3dState.mode === 'pan' ? 'grabbing' : 'crosshair';
  };
  if (window.knn3dMouseMoveHandler) window.removeEventListener('mousemove', window.knn3dMouseMoveHandler);
  window.knn3dMouseMoveHandler = function(e) {
    if (!knn3dState.isDragging) return;
    let dx = e.clientX - knn3dState.lastMouseX;
    let dy = e.clientY - knn3dState.lastMouseY;
    if (knn3dState.mode === 'pan') {
      knn3dState.panX += dx;
      knn3dState.panY += dy;
    } else {
      knn3dState.rotZ += dx * 0.5;
      knn3dState.rotX = Math.max(-85, Math.min(85, knn3dState.rotX + dy * 0.5));
    }
    knn3dState.lastMouseX = e.clientX;
    knn3dState.lastMouseY = e.clientY;
    drawKNN3D();
  };
  if (window.knn3dMouseUpHandler) window.removeEventListener('mouseup', window.knn3dMouseUpHandler);
  window.knn3dMouseUpHandler = function() {
    knn3dState.isDragging = false;
    let canvas = document.getElementById('knn-3d-canvas');
    if (canvas) canvas.style.cursor = knn3dState.mode === 'pan' ? 'grab' : 'crosshair';
  };
  window.addEventListener('mousemove', window.knn3dMouseMoveHandler);
  window.addEventListener('mouseup', window.knn3dMouseUpHandler);
  if (window.knn3dKeyHandler) document.removeEventListener('keydown', window.knn3dKeyHandler);
  window.knn3dKeyHandler = function(event) {
    if (!document.getElementById('knn-3d-modal')) return;
    if (event.key.toLowerCase() === 'p') {
      window.setKNN3DMode('pan');
      event.preventDefault();
    } else if (event.key.toLowerCase() === 'r') {
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
    let bottom = top.map(() => null);
    bottom[0] = project3D(x - half, y - half, zBottom);
    bottom[1] = project3D(x + half, y - half, zBottom);
    bottom[2] = project3D(x + half, y + half, zBottom);
    bottom[3] = project3D(x - half, y + half, zBottom);
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

  let chkV = document.getElementById('knn-chk-v')?.checked ?? true;
  let chkTop = document.getElementById('knn-chk-top')?.checked ?? true;
  let chkBot = document.getElementById('knn-chk-bot')?.checked ?? true;
  let chkStrut = document.getElementById('knn-chk-strut')?.checked ?? true;
  let chkClip = document.getElementById('knn-chk-clip')?.checked ?? true;
  let chkHanger = document.getElementById('knn-chk-hanger')?.checked ?? true;
  let chkLed = false;
  let chkPanel = document.getElementById('knn-chk-panel')?.checked ?? true;

  let slabH = maxDim * 0.16;
  let zTopBone = slabH * 0.3;
  let zBotBone = 0;
  let zPanel = -slabH * 0.04;

  // 1. Sàn Bê Tông Cốt Thép
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < res.polyPts.length; i++) {
    let p = project3D(res.polyPts[i].x, res.polyPts[i].y, slabH);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // 2. Các cấp trần (Cấp viền ngoài & Lõi trung tâm)
  res.tiers.forEach((tier, tIdx) => {
    let zTierOffset = -tier.hOffset * (maxDim / 3000);

    if (chkPanel) {
      ctx.fillStyle = tIdx === 0 ? 'rgba(226, 232, 240, 0.28)' : 'rgba(254, 240, 138, 0.18)';
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < tier.pts.length; i++) {
        let p = project3D(tier.pts[i].x, tier.pts[i].y, zPanel + zTierOffset);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (chkV) {
      for (let i = 0; i < tier.pts.length; i++) {
        let p1 = tier.pts[i];
        let p2 = tier.pts[(i + 1) % tier.pts.length];
        drawBeam3D(p1, p2, zBotBone + zTierOffset, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#38bdf8');
      }
    }

    // 3. Khung thành đứng & Các thanh chống đứng giật cấp (Vertical Struts)
    if (tIdx > 0 && chkStrut) {
      for (let i = 0; i < tier.pts.length; i++) {
        let p1 = tier.pts[i];
        let p2 = tier.pts[(i + 1) % tier.pts.length];
        drawPost3D(p1.x, p1.y, zTopBone, zTierOffset, isMeter ? 0.06 : 60, '#e879f9');

        // Chống đứng phụ giữa cạnh
        let midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
        drawPost3D(midX, midY, zTopBone, zTierOffset, isMeter ? 0.06 : 60, '#e879f9');
      }

      if (chkLed) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < tier.pts.length; i++) {
          let p = project3D(tier.pts[i].x, tier.pts[i].y, zTierOffset + 6);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  });

  let topStep = isMeter ? (res.opt.topBoneSpacing / 1000) : res.opt.topBoneSpacing;
  let botStep = isMeter ? (res.opt.botBoneSpacing / 1000) : res.opt.botBoneSpacing;
  let isHor = res.isTopHorizontal;
  let topPoly = res.tiers && res.tiers.length > 1 ? res.tiers[1].pts : res.polyPts;
  let topXs = topPoly.map(point => point.x), topYs = topPoly.map(point => point.y);
  let botPoly = res.tiers && res.tiers.length > 1 ? res.tiers[1].pts : res.polyPts;
  let botXs = botPoly.map(point => point.x), botYs = botPoly.map(point => point.y);

  // 4. LƯỚI XƯƠNG CHÍNH TRÊN (XANH DƯƠNG - Z = zTopBone) & TY TREO M8
  let topLines = [];
  if (isHor) {
    let curY = Math.min(...topYs) + topStep * 0.4;
    while (curY < Math.max(...topYs) - (isMeter ? 0.05 : 50)) {
      let segs = getHSegments(topPoly, curY, isMeter);
      for (let s of segs) {
        topLines.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY } });
        if (chkTop) {
          drawBeam3D({ x: s[0], y: curY }, { x: s[1], y: curY }, zTopBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#2563eb');
          let pt1 = project3D(s[0], curY, zTopBone);
          let pt2 = project3D(s[1], curY, zTopBone);
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }

        if (chkHanger) {
          let nH = Math.max(2, Math.round((s[1] - s[0]) / (isMeter ? 1.0 : 1000)) + 1);
          let ddx = (s[1] - s[0]) / (nH + 1);
          for (let k = 1; k <= nH; k++) {
            let hx = s[0] + ddx * k;
            drawPost3D(hx, curY, slabH, zTopBone, isMeter ? 0.025 : 25, '#facc15');
            let ptBot = project3D(hx, curY, zTopBone);
            let ptTop = project3D(hx, curY, slabH);
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(ptBot.x, ptBot.y);
            ctx.lineTo(ptTop.x, ptTop.y);
            ctx.stroke();

            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(ptBot.x, ptBot.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      curY += topStep;
    }
  } else {
    let curX = Math.min(...topXs) + topStep * 0.4;
    while (curX < Math.max(...topXs) - (isMeter ? 0.05 : 50)) {
      let segs = getVSegments(topPoly, curX, isMeter);
      for (let s of segs) {
        topLines.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] } });
        if (chkTop) {
          drawBeam3D({ x: curX, y: s[0] }, { x: curX, y: s[1] }, zTopBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#2563eb');
          let pt1 = project3D(curX, s[0], zTopBone);
          let pt2 = project3D(curX, s[1], zTopBone);
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }
      curX += topStep;
    }
  }

  // 5. LƯỚI XƯƠNG ĐÁY HỘP (CAM - Z = zBotBone)
  let botLines = [];
  if (isHor) {
    let curX = Math.min(...botXs) + botStep * 0.4;
    while (curX < Math.max(...botXs) - (isMeter ? 0.05 : 50)) {
      let segs = getVSegments(botPoly, curX, isMeter);
      for (let s of segs) {
        botLines.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] } });
        if (chkBot) {
          drawBeam3D({ x: curX, y: s[0] }, { x: curX, y: s[1] }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#f97316');
          let pt1 = project3D(curX, s[0], zBotBone);
          let pt2 = project3D(curX, s[1], zBotBone);
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }
      curX += botStep;
    }
  } else {
    let curY = Math.min(...botYs) + botStep * 0.4;
    while (curY < Math.max(...botYs) - (isMeter ? 0.05 : 50)) {
      let segs = getHSegments(botPoly, curY, isMeter);
      for (let s of segs) {
        botLines.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY } });
        if (chkBot) {
          drawBeam3D({ x: s[0], y: curY }, { x: s[1], y: curY }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#f97316');
          let pt1 = project3D(s[0], curY, zBotBone);
          let pt2 = project3D(s[1], curY, zBotBone);
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }
      curY += botStep;
    }
  }

  if (res.tiers && res.tiers.length > 1) {
    if (isHor) {
      let curX = Math.min(...xs) + botStep * 0.4;
      while (curX < Math.max(...xs) - (isMeter ? 0.05 : 50)) {
        let segs = getRingSegments(res.polyPts, botPoly, curX, false, isMeter);
        for (let s of segs) {
          botLines.push({ p1: { x: curX, y: s[0] }, p2: { x: curX, y: s[1] } });
          if (chkBot) drawBeam3D({ x: curX, y: s[0] }, { x: curX, y: s[1] }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#f97316');
        }
        curX += botStep;
      }
    } else {
      let curY = Math.min(...ys) + botStep * 0.4;
      while (curY < Math.max(...ys) - (isMeter ? 0.05 : 50)) {
        let segs = getRingSegments(res.polyPts, botPoly, curY, true, isMeter);
        for (let s of segs) {
          botLines.push({ p1: { x: s[0], y: curY }, p2: { x: s[1], y: curY } });
          if (chkBot) drawBeam3D({ x: s[0], y: curY }, { x: s[1], y: curY }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#f97316');
        }
        curY += botStep;
      }
    }
  }

  if (res.tiers && res.tiers.length > 1 && chkTop) {
    if (isHor) {
      let curY = Math.min(...ys) + topStep * 0.4;
      while (curY < Math.max(...ys) - (isMeter ? 0.05 : 50)) {
        let segs = getRingSegments(res.polyPts, botPoly, curY, true, isMeter);
        for (let s of segs) drawBeam3D({ x: s[0], y: curY }, { x: s[1], y: curY }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#2563eb');
        curY += topStep;
      }
    } else {
      let curX = Math.min(...xs) + topStep * 0.4;
      while (curX < Math.max(...xs) - (isMeter ? 0.05 : 50)) {
        let segs = getRingSegments(res.polyPts, botPoly, curX, false, isMeter);
        for (let s of segs) drawBeam3D({ x: curX, y: s[0] }, { x: curX, y: s[1] }, zBotBone, isMeter ? 0.08 : 80, isMeter ? 0.05 : 50, '#2563eb');
        curX += topStep;
      }
    }
  }

  if (chkClip) {
    ctx.fillStyle = '#f8fafc';
    topLines.forEach(tl => {
      botLines.forEach(bl => {
        let ix = bl.p1.x;
        let iy = tl.p1.y;
        if (ix >= Math.min(tl.p1.x, tl.p2.x) && ix <= Math.max(tl.p1.x, tl.p2.x) &&
            iy >= Math.min(bl.p1.y, bl.p2.y) && iy <= Math.max(bl.p1.y, bl.p2.y)) {
          let pClip = project3D(ix, iy, (zTopBone + zBotBone) / 2);
          ctx.fillRect(pClip.x - 3, pClip.y - 3, 6, 6);
        }
      });
    });
  }
}


// === MODULE: trannano/6_view_section.js ===
// ===============================================================================
//     KNN 2D TECHNICAL CROSS-SECTION VIEWER
//     Mặt cắt kỹ thuật 2D cấu tạo khung hộp giật cấp y như công trình thực tế
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
          🔍 BẢN VẼ MẶT CẮT KỸ THUẬT CẤU TẠO KHUNG HỘP GIẬT CẤP TRẦN NANO & KHE HẮT LED
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
  let topBoneY = slabY + 130;
  let ceilY1 = topBoneY + 60; // Mặt đáy hộp viền hạ thấp (+2.800)
  let ceilY2 = ceilY1 + 100;  // Lõi trần hạ (+2.650)
  let dropX1 = startX + (endX - startX) * 0.28;
  let dropX2 = endX - (endX - startX) * 0.28;

  // Sàn Bê Tông Cốt Thép
  ctx.fillStyle = '#334155';
  ctx.fillRect(startX, slabY - 25, endX - startX, 25);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, slabY - 25, endX - startX, 25);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SÀN BÊ TÔNG CỐT THÉP (+3.300)', startX + 20, slabY - 8);

  // Tường 2 bên
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(startX - 35, slabY - 25, 35, ceilY1 - slabY + 150);
  ctx.fillRect(endX, slabY - 25, 35, ceilY1 - slabY + 150);
  ctx.strokeRect(startX - 35, slabY - 25, 35, ceilY1 - slabY + 150);
  ctx.strokeRect(endX, slabY - 25, 35, ceilY1 - slabY + 150);

  // Nẹp V viền tường 3m
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(startX, ceilY1 - 25); ctx.lineTo(startX, ceilY1); ctx.lineTo(startX + 25, ceilY1);
  ctx.moveTo(endX, ceilY1 - 25); ctx.lineTo(endX, ceilY1); ctx.lineTo(endX - 25, ceilY1);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '10px sans-serif';
  ctx.fillText('(1) Nẹp V viền tường 3.0m', startX + 10, ceilY1 - 32);

  // Tấm Nano mặt đáy cấp viền ngoài
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(startX + 5, ceilY1 - 8, dropX1 - startX - 5, 8);
  ctx.fillRect(dropX2, ceilY1 - 8, endX - dropX2 - 5, 8);

  // Khung thành đứng chống hộp giật cấp
  ctx.strokeStyle = '#e879f9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dropX1, ceilY1 - 8); ctx.lineTo(dropX1, ceilY2); ctx.lineTo(dropX1 - 40, ceilY2);
  ctx.moveTo(dropX2, ceilY1 - 8); ctx.lineTo(dropX2, ceilY2); ctx.lineTo(dropX2 + 40, ceilY2);
  ctx.stroke();

  // Tấm Nano lõi trong
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(dropX1 + 10, ceilY2 - 8, dropX2 - dropX1 - 20, 8);

  // Xương chính trên U 3.6m + Ty treo M8
  let topXPositions = [startX + 150, dropX1 - 50, dropX1 + 120, (dropX1 + dropX2) / 2, dropX2 - 120, dropX2 + 50, endX - 150];

  topXPositions.forEach((tx, idx) => {
    let isInner = (tx > dropX1 && tx < dropX2);
    let curTopY = isInner ? (topBoneY + 100) : topBoneY;

    // Ty treo M8
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, slabY);
    ctx.lineTo(tx, curTopY);
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(tx - 4, slabY - 2, 8, 6);
    ctx.strokeRect(tx - 5, (slabY + curTopY) / 2 - 10, 10, 20);

    // Xương trên U 3.6m
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tx - 18, curTopY - 22);
    ctx.lineTo(tx - 18, curTopY);
    ctx.lineTo(tx + 18, curTopY);
    ctx.lineTo(tx + 18, curTopY - 22);
    ctx.stroke();

    // Khóa liên kết
    ctx.strokeStyle = '#f8fafc';
    ctx.fillStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 8, curTopY - 2, 16, 12);

    if (idx === 1) {
      ctx.fillStyle = '#2563eb';
      ctx.font = '10px sans-serif';
      ctx.fillText('(3) Xương chính TRÊN U 3.6m (@900) - Xanh dương', tx - 45, curTopY - 28);
      ctx.fillStyle = '#facc15';
      ctx.fillText('(5) Ty treo ren M8 (@1000)', tx - 35, (slabY + curTopY) / 2 + 25);
    }
  });

  // Xương đáy hộp gánh tấm U 3.6m (@450)
  let botXPositions = [startX + 60, startX + 180, dropX1 - 80, dropX1 + 40, (dropX1 + dropX2) / 2 - 80, (dropX1 + dropX2) / 2 + 80, dropX2 - 40, dropX2 + 80, endX - 180, endX - 60];
  botXPositions.forEach((bx, idx) => {
    let isInner = (bx > dropX1 && bx < dropX2);
    let curBotY = isInner ? ceilY2 : ceilY1;

    ctx.strokeStyle = '#f97316';
    ctx.fillStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 12, curBotY - 18);
    ctx.lineTo(bx - 12, curBotY - 8);
    ctx.lineTo(bx + 12, curBotY - 8);
    ctx.lineTo(bx + 12, curBotY - 18);
    ctx.stroke();

    // Ke inox giấu vít
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 6, curBotY - 8, 12, 4);

    if (idx === 2) {
      ctx.fillStyle = '#f97316';
      ctx.font = '10px sans-serif';
      ctx.fillText('(2) Xương đáy hộp U 3.6m (@450)', bx - 40, curBotY - 22);
    }
  });

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('CAO ĐỘ HỘP VIỀN NGOÀI (+2.800)', startX + 40, ceilY1 + 45);
  ctx.fillText('CAO ĐỘ LÕI TRẦN TRONG (+2.650)', (dropX1 + dropX2) / 2 - 60, ceilY2 + 45);

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dropX1 - 60, ceilY1);
  ctx.lineTo(dropX1 - 60, ceilY2);
  ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.fillText('H = 150mm', dropX1 - 125, (ceilY1 + ceilY2) / 2 + 4);
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
      tierWidth: 800,
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
      commandName: presetCommand || 'KNN1',
      materialType: prevMat,
      boneSpacing: (prevMat === 'lamsong' ? 350 : (prevMat === 'nano300' ? 400 : 450)),
      dropDepth: 150,
      tierWidth: 800,
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
        setInfo(`✅ [${window.knnState.commandName}] Đã tạo hệ khung hộp giật cấp trần Nano thành công! Bạn có thể xem 3D, Mặt cắt kỹ thuật 2D hoặc nhấn ENTER để hoàn tất.`);
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
          setInfo(`👉 [${window.knnState.commandName || 'KNN1'}] Đã quét ${selectedIds.size} nét phòng. Nhấn ENTER để tiếp tục.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds) {
        if (window.knnState && window.knnState.suppressSelectionStatus) return;
        if (window.knnState && window.knnState.step === 1) {
          if (selectedIds && selectedIds.size > 0) {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [${window.knnState.commandName || 'KNN1'}] Đã chọn ${selectedIds.size} nét phòng. Nhấn ENTER để TIẾP TỤC.`);
            }
          } else {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [${window.knnState.commandName || 'KNN1'}] BƯỚC 1: Quét chọn các nét của căn phòng cần tạo khung trần Nano, sau đó nhấn ENTER:`);
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

  window.c_KNN1 = function() {
    if (typeof selectTool === 'function') selectTool('KNN1');
    else window.initKNNTool();
  };
  window.c_KNN = window.c_KNN1;
  window.c_TRANNANO = window.c_KNN1;
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

  window.c_KNN3D = function() {
    if (typeof window.openKNN3DModal === 'function') window.openKNN3DModal();
  };
  window.c_NANO3D = window.c_KNN3D;
  window.c_N3D = window.c_KNN3D;
  if (typeof window.c_TT3D === 'undefined') {
    window.c_TT3D = window.c_KNN3D;
  }
  window.c_KNNSEC = function() {
    if (typeof window.openKNNSectionModal === 'function') window.openKNNSectionModal();
  };
  window.c_NSEC = window.c_KNNSEC;

  let regFn = (typeof registerPluginCommand === 'function') ? registerPluginCommand : ((typeof registerCommand === 'function') ? registerCommand : null);

  if (regFn) {
    regFn('KNN1', window.c_KNN1, 'Tạo Khung Hộp Giật Cấp Bắn Tấm Nano (Nẹp V 3m, Xương U 3.6m)');
    regFn('KNN', window.c_KNN, 'Tạo Khung Trần Bắn Tấm Nano');
    regFn('TRANNANO', window.c_TRANNANO, 'Tạo Khung Trần Nhựa Nano');
    regFn('TRANLAMSOPNG', window.c_TRANLAMSOPNG, 'Tạo Khung Trần Lam Sóng');
    regFn('NAN0', window.c_NAN0, 'Khung Trần Nano Phẳng');
    regFn('NAN1', window.c_NAN1, 'Khung Trần Nano Giật 1 Cấp');
    regFn('NAN2', window.c_NAN2, 'Khung Trần Nano Giật 2 Cấp');
    regFn('NAN3', window.c_NAN3, 'Khung Trần Nano Giật 3 Cấp');
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
