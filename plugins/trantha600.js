// === MODULE: trantha600/1_geometry.js ===
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
    if (e.type === 'RECTANGLE' && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('tt_')) {
      contours.push([
        { x: e.x, y: e.y },
        { x: e.x + e.w, y: e.y },
        { x: e.x + e.w, y: e.y + e.h },
        { x: e.x, y: e.y + e.h }
      ]);
    } else if ((e.type === 'POLYGON' || e.type === 'POLYLINE') && (e.points || e.pts) && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('tt_')) {
      let pts = (e.points || e.pts).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      if (pts.length >= 3) contours.push(pts);
    }
  }

  let lines = entList.filter(e => e.type === 'LINE' && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('tt_'));
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
  const SNAP_TOL = 500; // 500mm max corner gap tolerance

  for (let sIdx = 0; sIdx < segs.length; sIdx++) {
    if (segs[sIdx].used) continue;

    let orderedPts = [{ ...segs[sIdx].p1 }, { ...segs[sIdx].p2 }];
    segs[sIdx].used = true;
    let keepGrowing = true;

    while (keepGrowing) {
      keepGrowing = false;
      let curEnd = orderedPts[orderedPts.length - 1];

      // 1. Try finding a segment connecting to curEnd (forward)
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
        continue;
      }

      // 2. If forward cannot connect, try connecting backward to orderedPts[0]
      let curStart = orderedPts[0];
      let bestStartDist = SNAP_TOL;
      let bestStartIdx = -1;
      let bestStartReverse = false;

      for (let i = 0; i < segs.length; i++) {
        if (segs[i].used) continue;
        let d1 = Math.hypot(segs[i].p1.x - curStart.x, segs[i].p1.y - curStart.y);
        let d2 = Math.hypot(segs[i].p2.x - curStart.x, segs[i].p2.y - curStart.y);
        if (d1 < bestStartDist) {
          bestStartDist = d1;
          bestStartIdx = i;
          bestStartReverse = true; // p1 connects to start, p2 is new start
        }
        if (d2 < bestStartDist) {
          bestStartDist = d2;
          bestStartIdx = i;
          bestStartReverse = false; // p2 connects to start, p1 is new start
        }
      }

      if (bestStartIdx !== -1) {
        let prevSeg = segs[bestStartIdx];
        let newStart = bestStartReverse ? prevSeg.p2 : prevSeg.p1;
        orderedPts.unshift({ ...newStart });
        prevSeg.used = true;
        keepGrowing = true;
      }
    }

    if (orderedPts.length >= 3) {
      // Remove duplicate closing point if first and last match within tolerance
      let pFirst = orderedPts[0];
      let pLast = orderedPts[orderedPts.length - 1];
      let closeDist = Math.hypot(pLast.x - pFirst.x, pLast.y - pFirst.y);
      if (closeDist < SNAP_TOL) {
        orderedPts.pop();
      }

      // Remove consecutive duplicates
      let cleanLoop = [];
      for (let i = 0; i < orderedPts.length; i++) {
        let p = orderedPts[i];
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
      // Đảm bảo đoạn không nằm hoàn toàn ngoài phòng
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


// === MODULE: trantha600/2_algorithm.js ===
// ===============================================================================
//     TT600 CEILING LAYOUT & GRID ALGORITHM
//     Quy tắc thi công: Main-T @1200mm, Cross-T @600mm, Ty treo M8 @1200mm,
//     Thanh V viền tường, Tấm nguyên 600x600 và Tấm cắt biên
// ===============================================================================

function executeTT600Algorithm(polyPts, edge1, edge2) {
  if (!polyPts || polyPts.length < 3) {
    if (typeof setInfo === 'function') setInfo("❌ Không tìm thấy hình phòng khép kín.");
    return;
  }

  window.executeTT600Algorithm = executeTT600Algorithm;

  let xs = polyPts.map(p => p.x), ys = polyPts.map(p => p.y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  let len_raw = xmax - xmin, wid_raw = ymax - ymin;
  let roomId = 'rm_' + Math.round(xmin / 100) + '_' + Math.round(ymin / 100);

  // Chỉ xóa các nét trần cũ của riêng căn phòng này nếu tính lại, GIỮ NGUYÊN trần các phòng khác
  entities = entities.filter(e => !(e.id && e.id.startsWith('tt_') && e.roomId === roomId));
  entities = entities.filter(e => !(e.layer === 'TT600_DIM_COPY' && e.roomId === `${roomId}_dimcopy`));

  let isMeter = (len_raw < 60 && wid_raw < 60);
  let scaleUnit = isMeter ? 1000.0 : 1.0;
  let gridCad = isMeter ? 0.6 : 600.0;
  let mainCad = isMeter ? 1.2 : 1200.0;
  let hangerR = isMeter ? 0.05 : 45.0;
  let firstOffsetDefault = isMeter ? 0.6 : 600.0; // Chuẩn vách ra 600mm
  let realAreaM2 = isMeter ? polyArea(polyPts) : polyArea(polyPts) / 1e6;
  let realPeriM = isMeter ? polyPeri(polyPts) : polyPeri(polyPts) / 1e3;

  // Quy chuẩn cuối cùng của trần thả TT600:
  // - Lưới mặt bằng: thanh chính 3.6m + thanh phụ 1.2m + thanh phụ 0.6m nằm trên cùng mặt phẳng
  // - Thanh V: chỉ gác mép tường, không chồng lên lưới mặt bằng
  // - Mỗi thanh được gắn layer riêng để render và quản lý BOM rõ ràng
  const TT600_STANDARD = {
    rule: 'A1_SUSPENDED_CEILING_FLAT_GRID',
    mainTee: { lengthMm: 3600, layer: '03_XUONG_CHINH_T3660', color: '#ef4444' },
    cross1200: { lengthMm: 1200, layer: '04_XUONG_PHU_T1220', color: '#eab308' },
    cross600: { lengthMm: 600, layer: '05_XUONG_PHU_T610', color: '#22c55e' },
    wallV: { lengthMm: 3600, layer: '02_THANH_V_VIEN_TUONG', color: '#38bdf8' },
    joint: { layer: '08_KHOP_GHEP', color: '#f8fafc' },
    tile: { layer: '06_TAM_NGUYEN_600', secondaryLayer: '06_TAM_CAT_VIEN' }
  };
  if (typeof window !== 'undefined') {
    window.TT600_STANDARD = TT600_STANDARD;
  }

  // 1. Xác định hướng Cạnh Chuẩn 1 & Cạnh Chuẩn 2
  let isMainHorizontal = true; // Thanh chính chạy ngang hay chạy dọc
  let fromBottom = true;
  let fromLeft = true;

  if (window.tt600State && window.tt600State.forceMainOrientation) {
    isMainHorizontal = (window.tt600State.forceMainOrientation === 'horizontal');
  } else if (edge1) {
    let dx1 = Math.abs(edge1.p2.x - edge1.p1.x);
    let dy1 = Math.abs(edge1.p2.y - edge1.p1.y);
    isMainHorizontal = (dx1 >= dy1);
    if (isMainHorizontal) {
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
    if (isMainHorizontal) {
      fromLeft = (midX2 < (xmin + xmax) / 2);
    } else {
      fromBottom = (midY2 < (ymin + ymax) / 2);
    }
  }

  // 2. Tính toán lưới đồng mặt trần thả
  // Quy tắc đúng: thanh chính 3.6m, thanh phụ 1.2m, thanh phụ 0.6m cùng nằm trên một mặt phẳng
  // Thanh V chỉ là rìa gác mép tường (wall angle), không chồng vào lưới đồng mặt của trần.
  let all_x = [];
  let all_y = [];
  let main_lines = [];   // Lưới thanh chính Main-T 3.6m (mặt bằng)
  let cross_lines = [];  // Lưới thanh phụ Cross-T 1.2m (mặt bằng)
  let cross6_lines = []; // Lưới thanh phụ Cross-T 0.6m (mặt bằng)

  if (fromLeft) {
    all_x.push(xmin);
    let curX = xmin + firstOffsetDefault;
    while (curX < xmax - (isMeter ? 0.05 : 50)) {
      all_x.push(curX);
      curX += gridCad;
    }
    all_x.push(xmax);
  } else {
    all_x.push(xmax);
    let curX = xmax - firstOffsetDefault;
    while (curX > xmin + (isMeter ? 0.05 : 50)) {
      all_x.push(curX);
      curX -= gridCad;
    }
    all_x.push(xmin);
    all_x.sort((a, b) => a - b);
  }

  if (fromBottom) {
    all_y.push(ymin);
    let curY = ymin + firstOffsetDefault;
    while (curY < ymax - (isMeter ? 0.05 : 50)) {
      all_y.push(curY);
      curY += gridCad;
    }
    all_y.push(ymax);
  } else {
    all_y.push(ymax);
    let curY = ymax - firstOffsetDefault;
    while (curY > ymin + (isMeter ? 0.05 : 50)) {
      all_y.push(curY);
      curY -= gridCad;
    }
    all_y.push(ymin);
    all_y.sort((a, b) => a - b);
  }

  // Phân loại thanh chính Đỏ, thanh phụ Vàng 1.2m, thanh phụ Xanh lá 0.6m
  if (isMainHorizontal) {
    let inner_y = all_y.slice(1, all_y.length - 1);
    // Phân loại từ cạnh tường song song với thanh chính, không theo chiều tăng Y.
    let ordered_y = fromBottom ? inner_y : [...inner_y].reverse();
    ordered_y.forEach((gy, idx) => {
      if (idx % 2 === 0) {
        main_lines.push(gy); // Đỏ 3.6m
      } else {
        cross6_lines.push(gy); // Xanh lá 0.6m
      }
    });
    cross_lines = all_x.slice(1, all_x.length - 1);
  } else {
    let inner_x = all_x.slice(1, all_x.length - 1);
    // Phân loại từ cạnh tường song song với thanh chính, không theo chiều tăng X.
    let ordered_x = fromLeft ? inner_x : [...inner_x].reverse();
    ordered_x.forEach((gx, idx) => {
      if (idx % 2 === 0) {
        main_lines.push(gx); // Đỏ 3.6m
      } else {
        cross6_lines.push(gx); // Xanh lá 0.6m
      }
    });
    cross_lines = all_y.slice(1, all_y.length - 1);
  }

  // Nút ghép (joint) giữa thanh chính và thanh phụ: khớp khóa, không chồng mặt bằng.
  let gridJoints = new Map();
  function registerJoint(x, y) {
    const key = `${x.toFixed(4)}_${y.toFixed(4)}`;
    if (!gridJoints.has(key) && Number.isFinite(x) && Number.isFinite(y)) {
      gridJoints.set(key, { x, y });
    }
  }

  function collectGridJoints() {
    if (isMainHorizontal) {
      main_lines.forEach(my => {
        cross_lines.forEach(gx => {
          if (isPointInPoly({ x: gx, y: my }, polyPts)) registerJoint(gx, my);
        });
      });
      cross_lines.forEach(gx => {
        cross6_lines.forEach(gy => {
          if (isPointInPoly({ x: gx, y: gy }, polyPts)) registerJoint(gx, gy);
        });
      });
    } else {
      main_lines.forEach(mx => {
        cross_lines.forEach(gy => {
          if (isPointInPoly({ x: mx, y: gy }, polyPts)) registerJoint(mx, gy);
        });
      });
      cross_lines.forEach(gy => {
        cross6_lines.forEach(gx => {
          if (isPointInPoly({ x: gx, y: gy }, polyPts)) registerJoint(gx, gy);
        });
      });
    }
  }
  collectGridJoints();

  let roomEnts = [];
  function pushEnt(ent) {
    if (!ent) return;
    ent.roomId = roomId;
    if (ent.id && !ent.id.includes(roomId)) ent.id = ent.id + '_' + roomId;
    roomEnts.push(ent);
  }

  // 3. Sinh Tấm Trần Nguyên 600x600 (Cyan) & Tấm Cắt Viền (Tím)
  let n_full_tiles = 0;
  let n_cut_tiles = 0;
  let cutTilesList = [];
  let tiles3d = [];

  for (let iy = 0; iy < all_y.length - 1; iy++) {
    let yb = all_y[iy], yt = all_y[iy + 1];
    let h_cell = yt - yb;

    for (let ix = 0; ix < all_x.length - 1; ix++) {
      let xl = all_x[ix], xr = all_x[ix + 1];
      let w_cell = xr - xl;
      let cx = (xl + xr) / 2, cy = (yb + yt) / 2;

      let inset = gridCad * 0.05;
      let in1 = isPointInPoly({ x: xl + inset, y: yb + inset }, polyPts);
      let in2 = isPointInPoly({ x: xr - inset, y: yb + inset }, polyPts);
      let in3 = isPointInPoly({ x: xr - inset, y: yt - inset }, polyPts);
      let in4 = isPointInPoly({ x: xl + inset, y: yt - inset }, polyPts);
      let inc = isPointInPoly({ x: cx, y: cy }, polyPts);

      let isFull = in1 && in2 && in3 && in4 && (Math.abs(w_cell - gridCad) < 5) && (Math.abs(h_cell - gridCad) < 5);

      if (isFull) {
        n_full_tiles++;
        pushEnt({
          id: `tt_full_${n_full_tiles}`,
          type: 'RECTANGLE',
          x: xl, y: yb, w: w_cell, h: h_cell,
          color: '#06b6d4',
          fillColor: 'rgba(6, 182, 212, 0.08)',
          layer: '06_TAM_NGUYEN_600',
          width: 1.2
        });
        tiles3d.push({
          isFull: true,
          pts: [{ x: xl, y: yb }, { x: xr, y: yb }, { x: xr, y: yt }, { x: xl, y: yt }]
        });
      } else if (in1 || in2 || in3 || in4 || inc) {
        let clipped = clipPolygonWithBox(polyPts, xl, xr, yb, yt);
        if (clipped && clipped.length >= 3 && polyArea(clipped) > 0.01 * gridCad * gridCad) {
          n_cut_tiles++;
          let cutTag = `T${n_cut_tiles}`;
          let cxs = clipped.map(p => p.x), cys = clipped.map(p => p.y);
          let c_xmin = Math.min(...cxs), c_xmax = Math.max(...cxs);
          let c_ymin = Math.min(...cys), c_ymax = Math.max(...cys);
          let cutW = (c_xmax - c_xmin) * scaleUnit;
          let cutH = (c_ymax - c_ymin) * scaleUnit;

          pushEnt({
            id: `tt_cut_${n_cut_tiles}`,
            type: 'POLYGON',
            pts: clipped,
            color: '#d946ef',
            fillColor: 'rgba(217, 70, 239, 0.22)',
            layer: '06_TAM_CAT_VIEN',
            width: 1.8
          });

          tiles3d.push({
            isFull: false,
            pts: clipped
          });

          let label = `${cutW.toFixed(0)}x${cutH.toFixed(0)}`;
          let centroidX = cxs.reduce((a, b) => a + b, 0) / clipped.length;
          let centroidY = cys.reduce((a, b) => a + b, 0) / clipped.length;

          if (cutW > 250 && cutH > 250) {
            pushEnt({
              id: `tt_ctxt_${n_cut_tiles}`,
              type: 'TEXT',
              x: centroidX, y: centroidY,
              text: cutTag,
              size: 10,
              color: '#f0abfc',
              align: 'center',
              layer: '06_TAM_CAT_VIEN'
            });
          }

          cutTilesList.push({ tag: cutTag, dim: label, w: cutW, h: cutH, row: iy + 1 });
        }
      }
    }
  }

  // 4. Thanh Viền Tường Shadow-V 20x20
  // Đây là phần mép gác tường, không phải lưới trần thả. Nên đặt ở biên phòng, không đè lên mặt bằng của thanh chính/phụ.
  // Quy cách: thanh V chạy quanh viền, các đoạn cắt theo cây 3.6m / 3600mm, riêng lưới trần vẫn giữ nguyên mặt bằng đồng phẳng.
  let vBarLen = isMeter ? 3.6 : 3600.0;
  let wallVCount = 0;
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (edgeLen < (isMeter ? 0.01 : 10)) continue;
    let ux = (p2.x - p1.x) / edgeLen, uy = (p2.y - p1.y) / edgeLen;

    let segIdx = 0;
    for (let d = 0; d < edgeLen - (isMeter ? 0.005 : 5); d += vBarLen) {
      let dEnd = Math.min(d + vBarLen, edgeLen);
      let subP1 = [p1.x + ux * d, p1.y + uy * d];
      let subP2 = [p1.x + ux * dEnd, p1.y + uy * dEnd];
      wallVCount++;
      pushEnt({
        id: `tt_wallv_${j}_${i}_${segIdx++}`,
        type: 'LINE',
        p1: subP1,
        p2: subP2,
        color: '#38bdf8',
        layer: '02_THANH_V_VIEN_TUONG',
        width: 3.2,
        lineType: 'CONTINUOUS'
      });
    }
  }

  // 5. Sinh Hệ Khung Xương Chuẩn Theo Chiều Dài Cây Vật Tư Thực Tế
  let mainTeeCount = 0;
  let cross1220Count = 0;
  let cross610Count = 0;
  let hangerCount = 0;
  let mainBarLen = isMeter ? 3.6 : 3600.0;

  if (isMainHorizontal) {
    // A. Thanh Chính Main-T 3.6m - lưới đồng mặt, không chồng lên thanh V
    // Thanh V chỉ gác ở viền tường, không tạo lớp đè trên mặt bằng.
    main_lines.forEach((my, idx) => {
      let segs = getHSegments(polyPts, my, isMeter);
      segs.forEach((s, sIdx) => {
        let cur = s[0];
        let barIdx = 0;
        while (cur < s[1] - (isMeter ? 0.01 : 10)) {
          let next = Math.min(cur + mainBarLen, s[1]);
          mainTeeCount++;
          pushEnt({
            id: `tt_mt_${idx}_${sIdx}_${barIdx++}`,
            type: 'LINE',
            p1: [cur, my],
            p2: [next, my],
            color: '#ef4444',
            layer: '03_XUONG_CHINH_T3660',
            width: 2.6,
            lineType: 'CONTINUOUS'
          });
          cur = next;
        }

        // Bố trí điểm Ty treo M8 dọc theo thanh chính (@1200mm)
        let firstHangerOffset = isMeter ? 0.35 : 350;
        for (let hx = s[0] + firstHangerOffset; hx < s[1] - (isMeter ? 0.2 : 200); hx += mainCad) {
          if (isPointInPoly({ x: hx, y: my }, polyPts)) {
            hangerCount++;
            pushEnt({
              id: `tt_hg_${hx.toFixed(0)}_${my.toFixed(0)}`,
              type: 'CIRCLE',
              cx: hx, cy: my,
              r: hangerR,
              color: '#ef4444',
              fillColor: 'rgba(239, 68, 68, 0.65)',
              layer: '07_DIEM_TY_TREO'
            });
          }
        }
      });
    });

    // B. Thanh Phụ Cross-T 1.2m (VÀNG @600mm) - Nối giữa thân 2 thanh chính 3.6m kề nhau (nhịp 1.2m)
    cross_lines.forEach((gx, idx) => {
      let segs = getVSegments(polyPts, gx, isMeter);
      segs.forEach((s, sIdx) => {
        let y0 = s[0], y1 = s[1];
        let m_in_seg = main_lines.filter(my => my > y0 + (isMeter ? 0.05 : 50) && my < y1 - (isMeter ? 0.05 : 50));
        let yCheckpoints = [y0, ...m_in_seg, y1].sort((a, b) => a - b);

        for (let k = 0; k < yCheckpoints.length - 1; k++) {
          let yA = yCheckpoints[k], yB = yCheckpoints[k + 1];
          if (Math.abs(yB - yA) > (isMeter ? 0.02 : 20)) {
            cross1220Count++;
            pushEnt({
              id: `tt_cy_${idx}_${sIdx}_${k}`,
              type: 'LINE',
              p1: [gx, yA],
              p2: [gx, yB],
              color: '#eab308',
              layer: '04_XUONG_PHU_T1220',
              width: 1.8,
              lineType: 'CONTINUOUS'
            });
          }
        }
      });
    });

    // C. Thanh Phụ Cross-T 0.6m (XANH LÁ @600mm) - Nối giữa thân thanh phụ 1.2m này sang thanh đối diện (nhịp 0.6m)
    cross6_lines.forEach((gy, idx) => {
      let segs = getHSegments(polyPts, gy, isMeter);
      segs.forEach((s, sIdx) => {
        let x0 = s[0], x1 = s[1];
        let x_in_seg = cross_lines.filter(gx => gx > x0 + (isMeter ? 0.05 : 50) && gx < x1 - (isMeter ? 0.05 : 50));
        let xCheckpoints = [x0, ...x_in_seg, x1].sort((a, b) => a - b);

        for (let k = 0; k < xCheckpoints.length - 1; k++) {
          let xA = xCheckpoints[k], xB = xCheckpoints[k + 1];
          if (Math.abs(xB - xA) > (isMeter ? 0.02 : 20)) {
            cross610Count++;
            pushEnt({
              id: `tt_cx_${idx}_${sIdx}_${k}`,
              type: 'LINE',
              p1: [xA, gy],
              p2: [xB, gy],
              color: '#22c55e',
              layer: '05_XUONG_PHU_T610',
              width: 1.2,
              lineType: 'CONTINUOUS'
            });
          }
        }
      });
    });
  } else {
    // A. Thanh Chính Main-T 3.6m (ĐỎ @1200mm) Chạy Dọc - Chạy 3.6m dừng và nối cây tiếp theo
    main_lines.forEach((mx, idx) => {
      let segs = getVSegments(polyPts, mx, isMeter);
      segs.forEach((s, sIdx) => {
        let cur = s[0];
        let barIdx = 0;
        while (cur < s[1] - (isMeter ? 0.01 : 10)) {
          let next = Math.min(cur + mainBarLen, s[1]);
          mainTeeCount++;
          pushEnt({
            id: `tt_mt_${idx}_${sIdx}_${barIdx++}`,
            type: 'LINE',
            p1: [mx, cur],
            p2: [mx, next],
            color: '#ef4444',
            layer: '03_XUONG_CHINH_T3660',
            width: 2.6,
            lineType: 'CONTINUOUS'
          });
          cur = next;
        }

        // Bố trí điểm Ty treo M8 dọc theo thanh chính (@1200mm)
        let firstHangerOffset = isMeter ? 0.35 : 350;
        for (let hy = s[0] + firstHangerOffset; hy < s[1] - (isMeter ? 0.2 : 200); hy += mainCad) {
          if (isPointInPoly({ x: mx, y: hy }, polyPts)) {
            hangerCount++;
            pushEnt({
              id: `tt_hg_${mx.toFixed(0)}_${hy.toFixed(0)}`,
              type: 'CIRCLE',
              cx: mx, cy: hy,
              r: hangerR,
              color: '#ef4444',
              fillColor: 'rgba(239, 68, 68, 0.65)',
              layer: '07_DIEM_TY_TREO'
            });
          }
        }
      });
    });

    // B. Thanh Phụ Cross-T 1.2m (VÀNG @600mm) - Nối giữa thân 2 thanh chính 3.6m kề nhau (nhịp 1.2m)
    cross_lines.forEach((gy, idx) => {
      let segs = getHSegments(polyPts, gy, isMeter);
      segs.forEach((s, sIdx) => {
        let x0 = s[0], x1 = s[1];
        let m_in_seg = main_lines.filter(mx => mx > x0 + (isMeter ? 0.05 : 50) && mx < x1 - (isMeter ? 0.05 : 50));
        let xCheckpoints = [x0, ...m_in_seg, x1].sort((a, b) => a - b);

        for (let k = 0; k < xCheckpoints.length - 1; k++) {
          let xA = xCheckpoints[k], xB = xCheckpoints[k + 1];
          if (Math.abs(xB - xA) > (isMeter ? 0.02 : 20)) {
            cross1220Count++;
            pushEnt({
              id: `tt_cy_${idx}_${sIdx}_${k}`,
              type: 'LINE',
              p1: [xA, gy],
              p2: [xB, gy],
              color: '#eab308',
              layer: '04_XUONG_PHU_T1220',
              width: 1.8,
              lineType: 'CONTINUOUS'
            });
          }
        }
      });
    });

    // C. Thanh Phụ Cross-T 0.6m (XANH LÁ @600mm) - Nối giữa thân thanh phụ 1.2m này sang thanh đối diện (nhịp 0.6m)
    cross6_lines.forEach((gx, idx) => {
      let segs = getVSegments(polyPts, gx, isMeter);
      segs.forEach((s, sIdx) => {
        let y0 = s[0], y1 = s[1];
        let y_in_seg = cross_lines.filter(gy => gy > y0 + (isMeter ? 0.05 : 50) && gy < y1 - (isMeter ? 0.05 : 50));
        let yCheckpoints = [y0, ...y_in_seg, y1].sort((a, b) => a - b);

        for (let k = 0; k < yCheckpoints.length - 1; k++) {
          let yA = yCheckpoints[k], yB = yCheckpoints[k + 1];
          if (Math.abs(yB - yA) > (isMeter ? 0.02 : 20)) {
            cross610Count++;
            pushEnt({
              id: `tt_cx_${idx}_${sIdx}_${k}`,
              type: 'LINE',
              p1: [gx, yA],
              p2: [gx, yB],
              color: '#22c55e',
              layer: '05_XUONG_PHU_T610',
              width: 1.2,
              lineType: 'CONTINUOUS'
            });
          }
        }
      });
    });
  }

  // 6. Nút ghép khóa mặt bằng (joint lock points)
  Array.from(gridJoints.values()).forEach((joint, idx) => {
    pushEnt({
      id: `tt_joint_${idx}`,
      type: 'CIRCLE',
      cx: joint.x,
      cy: joint.y,
      r: isMeter ? 0.04 : 40,
      color: '#f8fafc',
      fillColor: 'rgba(248, 250, 252, 0.75)',
      layer: '08_KHOP_GHEP',
      width: 1.0
    });
  });

  // 7. Kích thước (DIM TƯỜNG, DIM KHUNG & DIM TỔNG)
  if (typeof generateDetailedCeilingDimensions === 'function') {
    let dimLines = generateDetailedCeilingDimensions(polyPts, xmin, xmax, ymin, ymax, all_x, all_y, main_lines, cross_lines, isMainHorizontal, isMeter);
    dimLines.forEach(pushEnt);
  }

  // 7. Bảng Dự Toán Vật Tư & Legend
  let smallCuts = 0, bigCuts = 0;
  cutTilesList.forEach(ct => {
    if (ct.w <= 300 || ct.h <= 300) smallCuts++;
    else bigCuts++;
  });
  let pairedCuts = Math.ceil(smallCuts / 2.0) + bigCuts;

  let bomRes = null;
  if (typeof generateBOMEntities === 'function') {
    bomRes = generateBOMEntities(realAreaM2, realPeriM, n_full_tiles, n_cut_tiles, mainTeeCount, cross1220Count, cross610Count, hangerCount, cutTilesList, pairedCuts, xmax, ymax, isMeter);
    if (bomRes && bomRes.bomEntities) {
      bomRes.bomEntities.forEach(pushEnt);
    }
  }

  entities.push(...roomEnts);

  let roomNum = (window.tt600State && window.tt600State.allResults) ? (window.tt600State.allResults.length + 1) : 1;
  let roomName = `Phòng #${roomNum} (${realAreaM2.toFixed(1)} m²)`;

  let newResult = {
    roomId,
    roomName,
    polyPts, xmin, xmax, ymin, ymax,
    tabX: bomRes ? bomRes.tabX : xmax + 1500,
    tabW: bomRes ? bomRes.tabW : 6200,
    tabY: bomRes ? bomRes.tabY : ymax,
    all_x, all_y, main_lines, cross_lines, cross6_lines,
    isMainHorizontal,
    lightingAnchor: { isMainHorizontal, fromBottom, fromLeft },
    n_full_tiles, n_cut_tiles, cutTilesList, tiles3d,
    mainTeeCount, cross1220Count, cross610Count, hangerCount, pairedCuts,
    realAreaM2, realPeriM,
    isMeter, scaleUnit, gridCad, mainCad
  };

  if (!window.tt600State) window.tt600State = {};
  if (!Array.isArray(window.tt600State.allResults)) window.tt600State.allResults = [];
  
  let existingRoomIdx = window.tt600State.allResults.findIndex(r => r.roomId === roomId);
  if (existingRoomIdx >= 0) {
    newResult.roomName = window.tt600State.allResults[existingRoomIdx].roomName || roomName;
    window.tt600State.allResults[existingRoomIdx] = newResult;
  } else {
    window.tt600State.allResults.push(newResult);
  }
  window.tt600State.lastResult = newResult;

  if (typeof setInfo === 'function') {
    setInfo(`⚡ [TT600 THI CÔNG] Đã chia trần & căn mốc vách ra 600mm -> bước @1200/@600 chuẩn xác. Xem 3D hoặc Căn giữa màn hình qua thanh công cụ!`);
  }
  if (typeof window.zoomFitTT600 === 'function') window.zoomFitTT600();
  if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
}

// Tạo bản sao 2D của biên dạng và toàn bộ DIM để đối chiếu kích thước,
// sau đó mở phối cảnh 3D của đúng phòng vừa xử lý.
window.startTT600CopyWorkflow = function() {
  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof selectTool === 'function') selectTool('TTCOPY');
  if (typeof setInfo === 'function') {
    setInfo('👉 [TTCOPY] Quét chọn lại các nét của bản vẽ đã chia trần, sau đó nhấn ENTER để lấy kích thước và mở 3D.');
  }
};

window.clearTT600DimensionCopies = function(roomId) {
  entities = entities.filter(entity => {
    if (entity.layer !== 'TT600_DIM_COPY') return true;
    return roomId ? entity.roomId !== `${roomId}_dimcopy` : false;
  });
  if (typeof render === 'function') render();
};

function findTT600ResultFromSelection() {
  if (typeof selectedIds === 'undefined' || !selectedIds || selectedIds.size === 0) return null;
  let selectedEntities = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('tt_'));
  if (selectedEntities.length === 0) return null;

  let selectedPoly = findEnclosingPolygonFromEntities(selectedEntities, null);
  if (!selectedPoly || selectedPoly.length < 3) return null;
  let selectedArea = polyArea(selectedPoly);
  let selectedXs = selectedPoly.map(p => p.x), selectedYs = selectedPoly.map(p => p.y);
  let selectedBounds = {
    xmin: Math.min(...selectedXs), xmax: Math.max(...selectedXs),
    ymin: Math.min(...selectedYs), ymax: Math.max(...selectedYs)
  };

  let results = window.tt600State && Array.isArray(window.tt600State.allResults) ? window.tt600State.allResults : [];
  return results.find(result => {
    let areaRatio = Math.abs(polyArea(result.polyPts) - selectedArea) / Math.max(selectedArea, 1);
    return areaRatio < 0.05 &&
      Math.abs(result.xmin - selectedBounds.xmin) < Math.max((result.xmax - result.xmin) * 0.05, 5) &&
      Math.abs(result.ymin - selectedBounds.ymin) < Math.max((result.ymax - result.ymin) * 0.05, 5);
  }) || null;
}

window.copyTT600Dimensions = function(targetIndex) {
  if (!Number.isInteger(targetIndex)) {
    let selectedResult = findTT600ResultFromSelection();
    if (!selectedResult) {
      if (typeof setInfo === 'function') setInfo('⚠️ [TTCOPY] Chưa nhận diện được bản vẽ. Hãy quét đúng các nét phòng rồi nhấn ENTER.');
      return;
    }
    targetIndex = window.tt600State.allResults.indexOf(selectedResult);
  }

  let results = window.tt600State && Array.isArray(window.tt600State.allResults)
    ? window.tt600State.allResults
    : [];
  let index = Number.isInteger(targetIndex) ? targetIndex : results.length - 1;
  let result = results[index] || (window.tt600State && window.tt600State.lastResult);

  if (!result || !result.polyPts || result.polyPts.length < 3) {
    alert('Vui lòng chạy TT600 và hoàn tất chia khung trước khi COPY kích thước.');
    return;
  }

  let roomId = result.roomId;
  let copyPrefix = `tt_dimcopy_${roomId}`;
  entities = entities.filter(e => !(e.id && e.id.startsWith(copyPrefix)));

  let roomWidth = result.xmax - result.xmin;
  let roomHeight = result.ymax - result.ymin;
  let gap = result.isMeter ? Math.max(roomWidth * 0.35, 1.5) : Math.max(roomWidth * 0.35, 1500);
  let tableRects = entities.filter(e => e.layer === 'BOM_TABLE' && e.type === 'RECTANGLE' &&
    Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.w) && Number.isFinite(e.h));
  let occupiedRight = tableRects.reduce((rightEdge, table) => Math.max(rightEdge, table.x + table.w), result.xmax);
  let dx = occupiedRight + gap - result.xmin;
  let dy = 0;
  let copiedCount = 0;

  function copyPoint(point) {
    return [point[0] + dx, point[1] + dy];
  }

  // Sao chép khung tham chiếu để DIM có ngữ cảnh hình học rõ ràng.
  for (let i = 0, j = result.polyPts.length - 1; i < result.polyPts.length; j = i++) {
    let p1 = result.polyPts[j], p2 = result.polyPts[i];
    entities.push({
      id: `${copyPrefix}_edge_${j}_${i}`,
      type: 'LINE',
      p1: [p1.x + dx, p1.y + dy],
      p2: [p2.x + dx, p2.y + dy],
      color: '#64748b',
      layer: 'TT600_DIM_COPY',
      width: 1.4,
      roomId: `${roomId}_dimcopy`
    });
  }

  // Sao chép DIM đã sinh bởi thuật toán, giữ nguyên hướng và khoảng offset.
  entities.filter(e => e.roomId === roomId && e.type === 'DIMENSION').forEach((dim, idx) => {
    entities.push({
      ...dim,
      id: `${copyPrefix}_${idx}`,
      p1: copyPoint(dim.p1),
      p2: copyPoint(dim.p2),
      layer: 'TT600_DIM_COPY',
      roomId: `${roomId}_dimcopy`
    });
    copiedCount++;
  });

  let scaleUnit = result.isMeter ? 1000 : 1;
  let widthMm = roomWidth * scaleUnit;
  let heightMm = roomHeight * scaleUnit;
  entities.push({
    id: `${copyPrefix}_title`,
    type: 'TEXT',
    x: result.xmin + dx + roomWidth / 2,
    y: result.ymax + (result.isMeter ? 0.7 : 700),
    text: `COPY KÍCH THƯỚC: ${widthMm.toFixed(0)} x ${heightMm.toFixed(0)} mm | ${result.realAreaM2.toFixed(2)} m2`,
    size: result.isMeter ? 0.18 : 180,
    color: '#facc15',
    align: 'center',
    layer: 'TT600_DIM_COPY',
    roomId: `${roomId}_dimcopy`
  });

  result.dimensionSnapshot = {
    widthMm,
    heightMm,
    areaM2: result.realAreaM2,
    copiedDimensions: copiedCount,
    offset: { dx, dy }
  };
  result.dimensionCopyOffset = { dx, dy };

  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof selectTool === 'function') selectTool('SELECT');
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') {
    setInfo(`📋 [TTCOPY] Đã tách ${copiedCount} DIM ra bản sao: ${widthMm.toFixed(0)} x ${heightMm.toFixed(0)} mm. Đang mở phối cảnh 3D...`);
  }
  if (typeof window.openTT6003DModal === 'function') window.openTT6003DModal(index);
};

if (typeof registerPluginCommand === 'function') {
  registerPluginCommand('TTCOPY', () => window.copyTT600Dimensions(), 'COPY biên dạng và kích thước TT600, sau đó mở 3D');
}


// === MODULE: trantha600/3_dimensions.js ===
// ===============================================================================
//     TT600 DIMENSION GENERATION ENGINE
//     Sinh DIM kích thước liên tục & DIM tường giật cấp chuẩn thi công
// ===============================================================================

function generateDetailedCeilingDimensions(polyPts, xmin, xmax, ymin, ymax, all_x, all_y, main_lines, cross_lines, isMainHorizontal, isMeter) {
  const dimEntities = [];
  const scaleUnit = isMeter ? 1000 : 1;
  const offOuter = isMeter ? 1.25 : 1250;
  const offChain = isMeter ? 0.55 : 550;
  const offWall = isMeter ? 0.35 : 350;

  // A. DIM TỔNG TOÀN BỘ PHÒNG (Màu vàng sáng #facc15) - Nằm phía NGOÀI căn phòng
  dimEntities.push({
    id: 'tt_dim_overall_w',
    type: 'DIMENSION',
    p1: [xmin, ymin],
    p2: [xmax, ymin],
    offset: offOuter,
    color: '#facc15',
    layer: 'DIM_TONG'
  });
  dimEntities.push({
    id: 'tt_dim_overall_h',
    type: 'DIMENSION',
    p1: [xmax, ymin],
    p2: [xmax, ymax],
    offset: offOuter,
    color: '#facc15',
    layer: 'DIM_TONG'
  });

  // B. CHUỖI DIM PHƯƠNG X (Dọc mép đáy - Nằm phía NGOÀI phòng, giữa phòng và DIM tổng)
  let xPts = [xmin];
  for (let i = 1; i < all_x.length - 1; i++) {
    xPts.push(all_x[i]);
  }
  xPts.push(xmax);
  xPts.sort((a, b) => a - b);

  for (let i = 0; i < xPts.length - 1; i++) {
    let p1X = xPts[i], p2X = xPts[i + 1];
    let span = (p2X - p1X) * scaleUnit;
    if (span > (isMeter ? 0.05 : 50)) {
      dimEntities.push({
        id: `tt_dim_x_chain_${i}`,
        type: 'DIMENSION',
        p1: [p1X, ymin],
        p2: [p2X, ymin],
        offset: offChain,
        color: isMainHorizontal ? '#eab308' : '#ef4444',
        layer: 'DIM_KHUNG'
      });
    }
  }

  // C. CHUỖI DIM PHƯƠNG Y (Dọc mép phải - Nằm phía NGOÀI phòng, giữa phòng và DIM tổng)
  let yPts = [ymin];
  for (let i = 1; i < all_y.length - 1; i++) {
    yPts.push(all_y[i]);
  }
  yPts.push(ymax);
  yPts.sort((a, b) => a - b);

  for (let i = 0; i < yPts.length - 1; i++) {
    let p1Y = yPts[i], p2Y = yPts[i + 1];
    let span = (p2Y - p1Y) * scaleUnit;
    if (span > (isMeter ? 0.05 : 50)) {
      dimEntities.push({
        id: `tt_dim_y_chain_${i}`,
        type: 'DIMENSION',
        p1: [xmax, p1Y],
        p2: [xmax, p2Y],
        offset: offChain,
        color: isMainHorizontal ? '#ef4444' : '#eab308',
        layer: 'DIM_KHUNG'
      });
    }
  }

  // D. DIM CHI TIẾT CÁC ĐOẠN TƯỜNG GẤP KHÚC / GIẬT CẤP (Màu Cyan #38bdf8)
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    let segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (segLen < (isMeter ? 0.1 : 100)) continue;

    let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let dx = (p2.x - p1.x) / segLen, dy = (p2.y - p1.y) / segLen;
    let nx = dy, ny = -dx;
    let eps = isMeter ? 0.08 : 80;
    let testPt = { x: mid.x + nx * eps, y: mid.y + ny * eps };

    let isOutwardRight = !isPointInPoly(testPt, polyPts);
    let dP1 = isOutwardRight ? [p1.x, p1.y] : [p2.x, p2.y];
    let dP2 = isOutwardRight ? [p2.x, p2.y] : [p1.x, p1.y];

    let isBottomOuter = Math.abs(p1.y - ymin) < 5 && Math.abs(p2.y - ymin) < 5;
    let isRightOuter = Math.abs(p1.x - xmax) < 5 && Math.abs(p2.x - xmax) < 5;

    if (!isBottomOuter && !isRightOuter) {
      dimEntities.push({
        id: `tt_dim_wall_seg_${j}_${i}`,
        type: 'DIMENSION',
        p1: dP1,
        p2: dP2,
        offset: offWall,
        color: '#38bdf8',
        layer: 'DIM_WALL'
      });
    }
  }

  return dimEntities;
}


// === MODULE: trantha600/4_bom.js ===
// ===============================================================================
//     TT600 BILL OF MATERIALS (BOM) & ESTIMATION ENGINE
//     Bóc tách khối lượng vật tư, hao hụt thi công, bảng dự toán và bảng chú dẫn
// ===============================================================================

function generateBOMEntities(realAreaM2, realPeriM, n_full_tiles, n_cut_tiles, mainTeeCount, cross1220Count, cross610Count, hangerCount, cutTilesList, pairedCuts, xmax, ymax, isMeter, lightingSummary = null) {
  const bomEntities = [];

  let tiles_order = Math.ceil((n_full_tiles + pairedCuts) * 1.05);
  let main_order = Math.ceil(mainTeeCount * 1.05);
  let cross_1220_order = Math.ceil(cross1220Count * 1.03);
  let cross_610_order = Math.ceil(cross610Count * 1.03);
  let wall_v_order = Math.ceil((realPeriM / 3.0) * 1.05);
  let hangers_order = Math.ceil(hangerCount * 1.05);

  let tabX = xmax + (isMeter ? 1.5 : 1500);
  let tabY = ymax;
  let tabW = isMeter ? 6.2 : 6200;
  let rh = isMeter ? 0.46 : 460;
  let th = isMeter ? 0.60 : 600;
  let lightingRows = lightingSummary ? [
    { stt: "8", name: "Đèn trần theo ô 600x600", unit: "bộ", qty: `${lightingSummary.total}`, note: `${lightingSummary.square} panel + ${lightingSummary.recessed} đèn âm`, color: '#facc15', icon: '◆' },
    { stt: "9", name: "Công tắc điều khiển đèn", unit: "mạch", qty: `${lightingSummary.switchCount}`, note: "Chia nhóm theo layout tâm phòng", color: '#fb923c', icon: '◈' }
  ] : [];
  let totH = th + (7 + lightingRows.length) * rh;

  let fTitle = isMeter ? 0.22 : 220;
  let fBody = isMeter ? 0.14 : 140;
  let fSub = isMeter ? 0.11 : 110;
  let fIcon = isMeter ? 0.17 : 170;

  // 1. Bảng BOM Dự toán
  bomEntities.push({ id: 'tt_tb_1', type: 'RECTANGLE', x: tabX, y: tabY - totH, w: tabW, h: totH, color: '#38bdf8', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'tt_tb_2', type: 'RECTANGLE', x: tabX, y: tabY - th, w: tabW, h: th, color: '#38bdf8', fillColor: 'rgba(56, 189, 248, 0.25)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'tt_tb_tt', type: 'TEXT', x: tabX + tabW / 2, y: tabY - th / 2, text: `BẢNG DỰ TOÁN VẬT TƯ TRẦN THẢ (S = ${realAreaM2.toFixed(1)} m²)`, size: fTitle, color: '#38bdf8', align: 'center', layer: 'BOM_TABLE' });

  const bomRows = [
    { stt: "1", name: "Tấm trần nổi 600x600 (+5%)", unit: "tấm", qty: `${tiles_order}`, note: `${n_full_tiles} nguyên + ${pairedCuts} cắt`, color: '#06b6d4', icon: '■' },
    { stt: "2", name: "Thanh chính Main-T 3.6m T24 (@1200)", unit: "cây", qty: `${main_order}`, note: "Thanh T3600 (Màu Đỏ)", color: '#ef4444', icon: '━' },
    { stt: "3", name: "Thanh phụ Cross-T 1.2m T24 (@600)", unit: "cây", qty: `${cross_1220_order}`, note: "Vuông góc Main-T (Màu Vàng)", color: '#eab308', icon: '━' },
    { stt: "4", name: "Thanh phụ Cross-T 0.6m T24", unit: "cây", qty: `${cross_610_order}`, note: "Song song Main-T (Màu Xanh)", color: '#22c55e', icon: '━' },
    { stt: "5", name: "Thanh viền tường Shadow-V (20x20)", unit: "cây", qty: `${wall_v_order}`, note: `P = ${realPeriM.toFixed(1)}m (+5%)`, color: '#38bdf8', icon: '━' },
    { stt: "6", name: "Bộ ty treo ren M8 + Tăng đơ + Bát", unit: "bộ", qty: `${hangers_order}`, note: "Bước ty @1.2m, đầu <=400mm", color: '#ef4444', icon: '◎' },
    { stt: "7", name: "Tắc kê đạn M8 + Đinh thép bê tông", unit: "hộp", qty: "1", note: "Phụ kiện liên kết trần", color: '#94a3b8', icon: '◆' },
    ...lightingRows
  ];

  for (let i = 0; i < bomRows.length; i++) {
    let ry = tabY - th - (i + 1) * rh;
    let item = bomRows[i];

    bomEntities.push({ id: `tt_tb_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_tb_s_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.25 : 250), y: ry + rh / 2, text: item.stt, size: fSub, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_tb_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.55 : 550), y: ry + rh / 2, text: item.icon, size: fIcon, color: item.color, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_tb_n_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.85 : 850), y: ry + rh / 2, text: item.name, size: fBody, color: item.color, align: 'left', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_tb_q_${i}`, type: 'TEXT', x: tabX + tabW - (isMeter ? 1.8 : 1800), y: ry + rh / 2, text: item.qty, size: fBody, color: '#4ade80', align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_tb_g_${i}`, type: 'TEXT', x: tabX + tabW - (isMeter ? 0.9 : 900), y: ry + rh / 2, text: item.note, size: fSub, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
  }

  // 2. Bảng Chú dẫn Kỹ Thuật (LEGEND)
  let legY = tabY - totH - (isMeter ? 0.4 : 400);
  let legRows = 6;
  let legH = th + legRows * rh;
  bomEntities.push({ id: 'tt_leg_1', type: 'RECTANGLE', x: tabX, y: legY - legH, w: tabW, h: legH, color: '#facc15', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'tt_leg_2', type: 'RECTANGLE', x: tabX, y: legY - th, w: tabW, h: th, color: '#facc15', fillColor: 'rgba(250, 204, 21, 0.22)', layer: 'BOM_TABLE' });
  bomEntities.push({ id: 'tt_leg_tt', type: 'TEXT', x: tabX + tabW / 2, y: legY - th / 2, text: `CHÚ DẪN QUY CÁCH BỐ TRÍ KHUNG TRẦN THẢ`, size: fTitle, color: '#facc15', align: 'center', layer: 'BOM_TABLE' });

  const legends = [
    { ic: "━", col: "#38bdf8", t: "Thanh viền tường Shadow-V 20x20 (Chạy quanh toàn bộ vách tường, đỡ tấm)" },
    { ic: "━", col: "#ef4444", t: "Thanh chính Main-T (Đỏ): Cách vách 600mm, bước @1200mm" },
    { ic: "━", col: "#eab308", t: "Thanh phụ Cross-T 1.2m (Vàng): VUÔNG GÓC thanh chính, bước @600mm" },
    { ic: "━", col: "#22c55e", t: "Thanh phụ Cross-T 0.6m (Xanh lá): SONG SONG thanh chính, chia đôi 600x600" },
    { ic: "■", col: "#06b6d4", t: "Tấm trần nguyên 600x600mm (Thả lọt lòng các ô hoàn chỉnh)" },
    { ic: "■", col: "#d946ef", t: "Tấm cắt biên T1, T2... (Cắt theo kích thước thực tế tại vách)" }
  ];

  for (let i = 0; i < legends.length; i++) {
    let ry = legY - th - (i + 1) * rh;
    let item = legends[i];
    bomEntities.push({ id: `tt_leg_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_leg_ic_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.35 : 350), y: ry + rh / 2, text: item.ic, size: fIcon, color: item.col, align: 'center', layer: 'BOM_TABLE' });
    bomEntities.push({ id: `tt_leg_tx_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.7 : 700), y: ry + rh / 2, text: item.t, size: fSub, color: '#e2e8f0', align: 'left', layer: 'BOM_TABLE' });
  }

  return { bomEntities, tabX, tabY, tabW };
}


// === MODULE: trantha600/5_ui_toolbar.js ===
// ===============================================================================
//     TT600 FLOATING TOOLBAR & FACADE SELECTION UI
//     Thanh công cụ nổi điều khiển chọn mốc mặt tiền và đổi hướng thanh chính
// ===============================================================================

function ensurePluginFloatingUI() {
  let oldBar = document.getElementById('tt600-floating-bar');
  if (oldBar) oldBar.remove();

  let bar = document.createElement('div');
  bar.id = 'tt600-floating-bar';
  bar.style.position = 'absolute';
  bar.style.top = '52px';
  bar.style.left = '50%';
  bar.style.transform = 'translateX(-50%)';
  bar.style.zIndex = '999';
  bar.style.display = 'flex';
  bar.style.alignItems = 'center';
  bar.style.gap = '5px';
  bar.style.background = 'rgba(15, 23, 42, 0.96)';
  bar.style.padding = '5px 12px';
  bar.style.borderRadius = '20px';
  bar.style.border = '1.5px solid #38bdf8';
  bar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
  bar.style.backdropFilter = 'blur(10px)';
  bar.style.maxWidth = '96vw';
  bar.style.flexWrap = 'nowrap';
  bar.style.whiteSpace = 'nowrap';

  let edge1Len = window.tt600State && window.tt600State.edge1 ? Math.round(window.tt600State.edge1.len < 60 ? window.tt600State.edge1.len * 1000 : window.tt600State.edge1.len) : '';
  let edge2Len = window.tt600State && window.tt600State.edge2 ? Math.round(window.tt600State.edge2.len < 60 ? window.tt600State.edge2.len * 1000 : window.tt600State.edge2.len) : '';
  let dimText = (edge1Len && edge2Len) ? ` (${edge1Len}x${edge2Len}mm)` : '';

  const isStep2 = (!window.tt600State || window.tt600State.step === 2);

  if (isStep2) {
    bar.innerHTML = `
      <span style="color:#facc15; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:4px;">
        🏛️ BƯỚC 2: CHỌN MỐC MẶT TIỀN:
      </span>
      <button onclick="window.setTT600Facade('bottom_left')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1.5px solid #eab308; color:#facc15; border-radius:12px; cursor:pointer; font-weight:bold;" title="Đặt Mốc Mặt tiền tại Cạnh Đáy & Cạnh Trái của phòng">
        ⬇️⬅️ Đáy & Trái${dimText}
      </button>
      <button onclick="window.setTT600Facade('bottom_right')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Đáy & Cạnh Phải của phòng">
        ⬇️➡️ Đáy & Phải
      </button>
      <button onclick="window.setTT600Facade('top_left')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Trên & Cạnh Trái của phòng">
        ⬆️⬅️ Trên & Trái
      </button>
      <button onclick="window.setTT600Facade('top_right')" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #475569; color:#cbd5e1; border-radius:12px; cursor:pointer;" title="Đặt Mốc Mặt tiền tại Cạnh Trên & Cạnh Phải của phòng">
        ⬆️➡️ Trên & Phải
      </button>
      <button onclick="window.toggleTT600MainDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Chuyển đổi hướng chạy của Thanh Chính Main-T Đỏ @1200mm">
        🔄 Hướng Cây Đỏ
      </button>
      <button onclick="window.executeTT600FromSelectionOrCanvas()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Bắt đầu tính toán & vẽ hệ trần (Phím Enter)">
        🚀 TÍNH TOÁN & VẼ (Enter)
      </button>
      <button onclick="document.getElementById('tt600-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;" title="Đóng thanh này">
        ✕
      </button>
    `;
  } else {
    bar.innerHTML = `
      <span style="color:#4ade80; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:4px; margin-right:4px;">
        ✅ ĐÃ CHIA TRẦN THÀNH CÔNG:
      </span>
      <button onclick="window.openTT6003DModal()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0369a1; font-weight:bold; border-radius:12px; cursor:pointer;">
        📦 3D Phối Cảnh
      </button>
      <button onclick="window.startTT600CopyWorkflow()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0f766e; font-weight:bold; border-radius:12px; cursor:pointer;" title="Quét lại bản vẽ, nhấn Enter để COPY kích thước và mở 3D">
        📋 TTCOPY: Quét + Enter
      </button>
      <button onclick="window.openTT600SectionModal()" class="btn btn-highlight" style="font-size:11px; padding:3px 8px; background:#7c3aed; font-weight:bold; border-radius:12px; cursor:pointer;">
        🔍 Mặt Cắt Kỹ Thuật
      </button>
      <button onclick="window.zoomFitTT600()" class="btn btn-accent" style="font-size:11px; padding:3px 8px; background:#0284c7; font-weight:bold; border-radius:12px; cursor:pointer;" title="Căn giữa toàn bộ hệ trần & bảng dự toán vào giữa màn hình">
        🎯 Căn Giữa
      </button>
      <button onclick="window.toggleTT600MainDirection()" class="btn" style="font-size:11px; padding:3px 9px; background:#1e293b; border:1px solid #ef4444; color:#f87171; border-radius:12px; cursor:pointer;" title="Chuyển đổi hướng chạy của Thanh Chính Main-T Đỏ @1200mm">
        🔄 Đổi Hướng Cây Đỏ
      </button>
      <button onclick="window.finishTT600Workflow()" class="btn btn-highlight" style="font-size:11px; padding:3px 12px; background:#22c55e; color:#020617; font-weight:bold; border-radius:12px; cursor:pointer;" title="Chốt xong phương án & Hoàn tất (Phím Enter)">
        ✅ Chốt Xong (Enter)
      </button>
      <button onclick="document.getElementById('tt600-floating-bar').remove()" class="btn" style="padding:1px 6px; font-size:11px; background:none; border:none; color:#94a3b8; cursor:pointer;" title="Đóng thanh này">
        ✕
      </button>
    `;
  }

  document.body.appendChild(bar);
}

window.setTT600Facade = function(mode) {
  if (!window.tt600State || !window.tt600State.polyPts || window.tt600State.polyPts.length < 3) return;
  let pts = window.tt600State.polyPts;

  let edges = [];
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    let p1 = pts[j], p2 = pts[i];
    let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    let dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
    let isHoriz = dx >= dy;
    edges.push({ p1, p2, mid, len, isHoriz });
  }

  let horizEdges = edges.filter(e => e.isHoriz);
  let vertEdges = edges.filter(e => !e.isHoriz);

  let bottomEdge = horizEdges.reduce((prev, curr) => (!prev || curr.mid.y < prev.mid.y) ? curr : prev, horizEdges[0] || edges[0]);
  let topEdge = horizEdges.reduce((prev, curr) => (!prev || curr.mid.y > prev.mid.y) ? curr : prev, horizEdges[0] || edges[0]);
  let leftEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x < prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);
  let rightEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x > prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);

  if (mode === 'bottom_left' || mode === 'bottom') {
    window.tt600State.edge1 = bottomEdge;
    window.tt600State.edge2 = leftEdge;
    window.tt600State.facadeMode = 'bottom_left';
  } else if (mode === 'bottom_right') {
    window.tt600State.edge1 = bottomEdge;
    window.tt600State.edge2 = rightEdge;
    window.tt600State.facadeMode = 'bottom_right';
  } else if (mode === 'top_left' || mode === 'top') {
    window.tt600State.edge1 = topEdge;
    window.tt600State.edge2 = leftEdge;
    window.tt600State.facadeMode = 'top_left';
  } else if (mode === 'top_right') {
    window.tt600State.edge1 = topEdge;
    window.tt600State.edge2 = rightEdge;
    window.tt600State.facadeMode = 'top_right';
  }

  if (typeof executeTT600Algorithm === 'function') {
    executeTT600Algorithm(pts, window.tt600State.edge1, window.tt600State.edge2);
  }
  if (typeof render === 'function') render();
  let l1 = Math.round(window.tt600State.edge1 ? window.tt600State.edge1.len : 0);
  let l2 = Math.round(window.tt600State.edge2 ? window.tt600State.edge2.len : 0);
  setInfo(`🏛️ Đã chuyển Mốc Mặt Tiền sang [${mode.toUpperCase()} - Cạnh ${l1}mm & ${l2}mm]. Hệ trần đã dồn tấm nguyên về đây.`);
};

window.toggleTT600MainDirection = function() {
  if (!window.tt600State || !window.tt600State.polyPts) return;
  window.tt600State.forceMainOrientation = window.tt600State.forceMainOrientation === 'vertical' ? 'horizontal' : 'vertical';
  if (typeof executeTT600Algorithm === 'function') {
    executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
  }
  if (typeof render === 'function') render();
  setInfo(`🔄 Đã chuyển hướng Thanh Chính Main-T (Đỏ @1200mm) sang: ${window.tt600State.forceMainOrientation === 'vertical' ? 'DỌC (↕️)' : 'NGANG (↔️)'}`);
};

window.finishTT600Workflow = function() {
  if (window.tt600State) {
    window.tt600State.active = false;
    window.tt600State.step = 1;
  }
  if (typeof clearTaskContext === 'function') clearTaskContext();
  if (typeof selectTool === 'function') selectTool('SELECT');
  if (typeof selectedIds !== 'undefined') selectedIds.clear();
  if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
  let bar = document.getElementById('tt600-floating-bar');
  if (bar) bar.remove();
  setInfo("✅ [TT600] Đã chốt phương án mặt tiền & hoàn thành tính toán trần thả thành công!");
};

window.zoomFitTT600 = function() {
  if (!window.tt600State || !window.tt600State.lastResult) {
    if (typeof zoomAll === 'function') zoomAll();
    return;
  }
  let res = window.tt600State.lastResult;
  let minX = res.xmin;
  let maxX = (res.tabX && res.tabW) ? (res.tabX + res.tabW) : res.xmax;
  let minY = res.ymin;
  let maxY = res.ymax;

  let cx = (minX + maxX) / 2;
  let cy = (minY + maxY) / 2;
  let w = Math.max(maxX - minX + (res.isMeter ? 1.5 : 1500), 1000);
  let h = Math.max(maxY - minY + (res.isMeter ? 1.5 : 1500), 1000);

  let cvsW = (typeof canvas !== 'undefined' && canvas && canvas.width) ? canvas.width : window.innerWidth;
  let cvsH = (typeof canvas !== 'undefined' && canvas && canvas.height) ? canvas.height : window.innerHeight;

  let targetZoom = Math.min((cvsW - 120) / w, (cvsH - 120) / h);
  if (typeof zoom !== 'undefined') zoom = targetZoom;

  let angle = (typeof viewRotation !== 'undefined' ? viewRotation : 0) * Math.PI / 180;
  let rotatedCx = cx * Math.cos(angle) - cy * Math.sin(angle);
  let rotatedCy = cx * Math.sin(angle) + cy * Math.cos(angle);

  if (typeof panX !== 'undefined') panX = -rotatedCx * targetZoom;
  if (typeof panY !== 'undefined') panY = rotatedCy * targetZoom;

  if (typeof render === 'function') render();
  if (typeof setInfo === 'function') setInfo("🎯 Đã căn toàn bộ hệ trần & bảng dự toán ra chính giữa màn hình.");
};


// === MODULE: trantha600/6_view_3d.js ===
// ===============================================================================
//     TT600 3D ISOMETRIC VIEWER - MULTI-ROOM / ĐA BẢN VẼ HỖ TRỢ BACK & NEXT
//     Cửa sổ phối cảnh 3D góc nghiêng, xoay 360°, chuyển đổi giữa nhiều phòng
// ===============================================================================

window.openTT6003DModal = function(targetIndex) {
  let allRooms = [];
  if (window.tt600State && Array.isArray(window.tt600State.allResults) && window.tt600State.allResults.length > 0) {
    allRooms = window.tt600State.allResults;
  } else if (window.tt600State && window.tt600State.lastResult) {
    allRooms = [window.tt600State.lastResult];
  }

  if (allRooms.length === 0) {
    alert("Vui lòng chạy chia trần (Lệnh TT600) trước khi xem phối cảnh 3D.");
    return;
  }

  let currentRoomIndex = (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < allRooms.length)
    ? targetIndex
    : (allRooms.length - 1);

  let res = allRooms[currentRoomIndex];

  let oldModal = document.getElementById('tt600-3d-modal');
  if (oldModal) oldModal.remove();

  let modal = document.createElement('div');
  modal.id = 'tt600-3d-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.88)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  let roomOptions = allRooms.map((rm, idx) => `
    <option value="${idx}" ${idx === currentRoomIndex ? 'selected' : ''}>
      🏛️ ${rm.roomName || ('Phòng #' + (idx + 1) + ' (' + (rm.realAreaM2 ? rm.realAreaM2.toFixed(1) : '0') + 'm²)')}
    </option>
  `).join('');

  modal.innerHTML = `
    <div style="width:92vw; height:90vh; background:#0f172a; border:2px solid #38bdf8; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
      <!-- TOP MODAL HEADER BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; background:#1e293b; border-bottom:1.5px solid #334155; flex-shrink:0; flex-wrap:wrap; gap:8px;">
        <div style="font-weight:bold; font-size:13.5px; color:#38bdf8; display:flex; align-items:center; gap:8px;">
          <span>📦 PHỐI CẢNH 3D HỆ TRẦN THẢ 600x600</span>
        </div>

        <!-- MULTI-ROOM BACK & NEXT NAVIGATION -->
        <div style="display:flex; align-items:center; gap:6px; background:#090d16; padding:3px 8px; border-radius:8px; border:1px solid #38bdf8;">
          <button id="btn-3d-prev" onclick="window.navigate3DRoom(-1)" class="btn btn-accent" style="padding:3px 9px; font-size:11px; font-weight:bold; cursor:pointer;" title="Xem phòng trước (Phím ◀ hoặc [)">
            ◀️ Back
          </button>
          <select id="select-3d-room" onchange="window.switch3DRoom(parseInt(this.value))" style="font-size:11.5px; font-weight:bold; color:#facc15; background:#1e293b; border:1px solid #475569; padding:3px 8px; border-radius:4px; outline:none; cursor:pointer;">
            ${roomOptions}
          </select>
          <button id="btn-3d-next" onclick="window.navigate3DRoom(1)" class="btn btn-accent" style="padding:3px 9px; font-size:11px; font-weight:bold; cursor:pointer;" title="Xem phòng tiếp theo (Phím ▶ hoặc ])">
            Next ▶️
          </button>
          <span id="room-counter-3d" style="font-size:11px; color:#38bdf8; font-weight:bold; margin-left:4px; white-space:nowrap;">
            ${currentRoomIndex + 1} / ${allRooms.length}
          </span>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <span style="color:#94a3b8; font-size:11px; display:none; @media(min-width:900px){display:inline;}">💡 Kéo chuột để xoay 360° • Cuộn để Zoom</span>
          <button onclick="window.closeTT6003DModal()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold;">✕ Đóng</button>
        </div>
      </div>

      <!-- MAIN 3D VIEWPORT & SIDE PANEL -->
      <div style="flex:1; position:relative; display:flex; min-width:0; min-height:0; overflow:hidden;">
        <div style="flex:1; position:relative; min-width:0; min-height:0; height:100%;">
          <canvas id="tt600-3d-canvas" style="width:100%; height:100%; background:#020617; display:block;"></canvas>
        </div>

        <div style="width:280px; min-width:280px; flex-shrink:0; background:#0f172a; border-left:1.5px solid #334155; padding:12px; display:flex; flex-direction:column; gap:10px; font-size:11.5px; color:#cbd5e1; overflow-y:auto;">
          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px;">🎮 GÓC NHÌN NHANH:</div>
          <button onclick="setIsoAngle(45, 30)" class="btn btn-accent" style="padding:6px; font-size:11px;">📦 Góc Nghiêng Tây Nam 45°</button>
          <button onclick="setIsoAngle(135, 30)" class="btn btn-accent" style="padding:6px; font-size:11px;">📦 Góc Nghiêng Đông Nam 45°</button>
          <button onclick="setIsoAngle(0, 89.9)" class="btn btn-accent" style="padding:6px; font-size:11px;">📐 Nhìn Mặt Bằng 2D Từ Trên Xuống</button>
          <button onclick="setIsoAngle(0, -60)" class="btn btn-accent" style="padding:6px; font-size:11px;">👀 Nhìn Ngước Dưới Lên (Ceiling View)</button>
          <button onclick="setIsoAngle(0, 0)" class="btn btn-accent" style="padding:6px; font-size:11px;">🏢 Nhìn Ngang Mặt Cắt (Side View)</button>
          <button id="btn-3d-pan" onclick="window.toggle3DPan()" class="btn btn-accent" style="padding:6px; font-size:11px;">✋ Chế độ PAN / Kéo Bản Vẽ (Phím P)</button>
          <button onclick="zoomFit3D()" class="btn btn-highlight" style="padding:6px; font-size:11px; background:#0284c7;">🔍 Căn Giữa Tự Động (Fit Center - Phím Z)</button>

          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px; margin-top:6px;">🎬 DẠNG PHỐI CẢNH:</div>
          <div style="display:flex; gap:6px;">
            <button id="btn-scene-technical" onclick="set3DSceneMode('technical')" class="btn btn-accent" style="flex:1; padding:6px; font-size:11px;">📐 Kỹ thuật</button>
            <button id="btn-scene-construction" onclick="set3DSceneMode('construction')" class="btn btn-highlight" style="flex:1; padding:6px; font-size:11px; background:#b45309;">👷 Thi công</button>
          </div>

          <div style="font-weight:bold; color:#facc15; border-bottom:1px solid #334155; padding-bottom:4px; margin-top:6px;">👁️ BẬT / TẮT LỚP 3D:</div>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-wallv" checked> 🔷 Thanh Viền Tường Shadow-V (@Vách)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-hangers" checked> 🔴 Ty Treo M8 + Sàn Bê Tông</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-maint" checked> 🟥 Thanh Chính Main-T (@1200)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-crosst" checked> 🟨 Thanh Phụ Cross-T 1.2m (@600)</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-cross6" checked> 🟩 Thanh Phụ Cross-T 0.6m</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-tiles" checked> 🟦 Tấm Trần Thả 600x600</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-lights" checked> 💡 Đèn theo ô 600x600</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-walls" checked> 🧱 Khối Tường Phòng 3D</label>

          <div id="stats-panel-3d" style="margin-top:auto; background:#1e293b; padding:8px; border-radius:6px; font-size:11px; border:1px solid #334155;">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">📊 Thông số Dự toán:</div>
            <div id="stat-area">• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b></div>
            <div id="stat-full">• Tấm nguyên: <b>${res.n_full_tiles} tấm</b></div>
            <div id="stat-cut">• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b></div>
            <div id="stat-dir">• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b></div>
            <div id="stat-lights">• Đèn 600x600: <b>${res.lightingPlan ? res.lightingPlan.placedCount : 0} vị trí</b></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  init3DIsoViewer(allRooms, currentRoomIndex);
};

window.closeTT6003DModal = function() {
  let modal = document.getElementById('tt600-3d-modal');
  if (modal) modal.remove();
  if (typeof window.clearTT600DimensionCopies === 'function') window.clearTT600DimensionCopies();
};

function init3DIsoViewer(allRooms, initialIndex) {
  const cvs = document.getElementById('tt600-3d-canvas');
  if (!cvs) return;
  const c3d = cvs.getContext('2d');

  function resize3D() {
    cvs.width = cvs.clientWidth;
    cvs.height = cvs.clientHeight;
  }
  resize3D();

  let currentIdx = initialIndex;
  let res = allRooms[currentIdx];

  let yaw = 45 * Math.PI / 180;
  let pitch = 30 * Math.PI / 180;
  let cx = 0, cy = 0, ceilZ = 0, slabZ = 0, midZ = 0;
  let roomW = 0, roomH = 0, maxDim = 1000, scale = 1.0;
  let pan3dX = 0, pan3dY = 0;
  let sceneMode = 'construction';
  let isPanActive = false;

  function updatePanUI() {
    let btn = document.getElementById('btn-3d-pan');
    if (btn) {
      btn.style.outline = isPanActive ? '2px solid #38bdf8' : 'none';
      btn.style.background = isPanActive ? '#0284c7' : '';
    }
    cvs.style.cursor = isPanActive ? 'grab' : 'default';
  }

  window.toggle3DPan = function() {
    isPanActive = !isPanActive;
    updatePanUI();
    if (typeof setInfo === 'function') {
      setInfo(isPanActive ? '🖐️ [3D PAN] Đã BẬT chế độ kéo bản vẽ. Nhấp chuột trái và rê để di chuyển vật thể.' : '🔄 [3D XOAY] Đã BẬT chế độ xoay 3D.');
    }
  };

  function recalculateBounds() {
    res = allRooms[currentIdx];
    if (!res) return;
    cx = (res.xmin + res.xmax) / 2;
    cy = (res.ymin + res.ymax) / 2;
    ceilZ = 2600 * (res.isMeter ? 0.001 : 1);
    slabZ = 3200 * (res.isMeter ? 0.001 : 1);
    midZ = (ceilZ + slabZ) / 2;

    roomW = res.xmax - res.xmin;
    roomH = res.ymax - res.ymin;
    maxDim = Math.max(roomW, roomH, res.isMeter ? 5 : 5000);
    scale = (Math.min(cvs.width || 800, cvs.height || 600) * 0.45) / maxDim;
    pan3dX = 0;
    pan3dY = 0;

    const statArea = document.getElementById('stat-area');
    if (statArea) statArea.innerHTML = `• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b>`;
    const statFull = document.getElementById('stat-full');
    if (statFull) statFull.innerHTML = `• Tấm nguyên: <b>${res.n_full_tiles} tấm</b>`;
    const statCut = document.getElementById('stat-cut');
    if (statCut) statCut.innerHTML = `• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b>`;
    const statDir = document.getElementById('stat-dir');
    if (statDir) statDir.innerHTML = `• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b>`;

    const sel = document.getElementById('select-3d-room');
    if (sel) sel.value = currentIdx;
    const cnt = document.getElementById('room-counter-3d');
    if (cnt) cnt.innerText = `${currentIdx + 1} / ${allRooms.length}`;
  }

  recalculateBounds();

  window.navigate3DRoom = function(delta) {
    if (allRooms.length <= 1) return;
    currentIdx = (currentIdx + delta + allRooms.length) % allRooms.length;
    recalculateBounds();
  };

  window.switch3DRoom = function(idx) {
    if (idx >= 0 && idx < allRooms.length) {
      currentIdx = idx;
      recalculateBounds();
    }
  };

  window.zoomFit3D = function() {
    pan3dX = 0;
    pan3dY = 0;
    scale = (Math.min(cvs.width || 800, cvs.height || 600) * 0.45) / maxDim;
  };

  window.setIsoAngle = function(yDeg, pDeg) {
    yaw = yDeg * Math.PI / 180;
    pitch = pDeg * Math.PI / 180;
    pan3dX = 0;
    pan3dY = 0;
  };

  window.set3DSceneMode = function(mode) {
    sceneMode = mode === 'technical' ? 'technical' : 'construction';
    let technicalButton = document.getElementById('btn-scene-technical');
    let constructionButton = document.getElementById('btn-scene-construction');
    if (technicalButton) technicalButton.style.outline = sceneMode === 'technical' ? '2px solid #38bdf8' : 'none';
    if (constructionButton) constructionButton.style.outline = sceneMode === 'construction' ? '2px solid #facc15' : 'none';
  };

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let currentDragAction = 'rotate';

  cvs.addEventListener('contextmenu', e => e.preventDefault());

  cvs.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || e.button === 1 || e.shiftKey || isPanActive) {
      currentDragAction = 'pan';
      cvs.style.cursor = 'grabbing';
    } else {
      currentDragAction = 'rotate';
      cvs.style.cursor = 'crosshair';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let dx = e.clientX - dragStart.x;
    let dy = e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };

    if (currentDragAction === 'pan') {
      pan3dX += dx;
      pan3dY += dy;
    } else {
      yaw += dx * 0.008;
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch - dy * 0.008));
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    cvs.style.cursor = isPanActive ? 'grab' : 'default';
  });

  cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    let factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.max(0.01, Math.min(3.0, scale * factor));
  }, { passive: false });

  function handle3DKeyDown(e) {
    if (!document.getElementById('tt600-3d-modal')) {
      window.removeEventListener('keydown', handle3DKeyDown);
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      window.toggle3DPan();
    } else if (e.key === 'z' || e.key === 'Z' || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      window.zoomFit3D();
    } else if (e.key === 'ArrowLeft' || e.key === '[') {
      e.preventDefault();
      window.navigate3DRoom(-1);
    } else if (e.key === 'ArrowRight' || e.key === ']') {
      e.preventDefault();
      window.navigate3DRoom(1);
    } else if (e.key === 'Escape') {
      const m = document.getElementById('tt600-3d-modal');
      if (m) m.remove();
    }
  }
  window.addEventListener('keydown', handle3DKeyDown);

  function project3D(x, y, z) {
    let dx = (x - cx);
    let dy = (y - cy);
    let dz = (z - midZ);

    let x_rot = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    let y_rot = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    let z_iso = -y_rot * Math.sin(pitch) - dz * Math.cos(pitch);
    let depth = y_rot * Math.cos(pitch) - dz * Math.sin(pitch);

    return {
      x: cvs.width / 2 + x_rot * scale + pan3dX,
      y: cvs.height / 2 + z_iso * scale + pan3dY,
      depth: depth
    };
  }

  function drawDepthSortedFaces(faceList) {
    faceList.sort((a, b) => b.depth - a.depth);
    faceList.forEach(face => {
      let proj = face.pts.map(p => project3D(p.x, p.y, p.z));
      if (proj.length < 3) return;

      if (face.cullBackface) {
        let cp = (proj[1].x - proj[0].x) * (proj[2].y - proj[0].y) - (proj[1].y - proj[0].y) * (proj[2].x - proj[0].x);
        if (cp < 0) return;
      }

      c3d.beginPath();
      c3d.moveTo(proj[0].x, proj[0].y);
      for (let i = 1; i < proj.length; i++) c3d.lineTo(proj[i].x, proj[i].y);
      c3d.closePath();
      if (face.fill) {
        c3d.fillStyle = face.fill;
        c3d.fill();
      }
      if (face.stroke) {
        c3d.strokeStyle = face.stroke;
        c3d.lineWidth = face.lineWidth || 1;
        c3d.stroke();
      }
    });
  }

  function drawConstructionScene(isBottomUp, showWallV, showHangers, showMain, showCross, showCross6, showTiles, showWalls, showLights) {
    // Quy tắc thực tế trần thả:
    // - Thanh chính 3.6m + thanh phụ 1.2m + thanh phụ 0.6m cùng nằm trên một mặt phẳng đồng mức
    // - Thanh V chỉ là rìa gác mép tường, không tạo lớp đè / chồng trên mặt bằng của lưới trần
    // - 3D chỉ nâng/đẩy thanh V ở cạnh viền khi cần biểu diễn gác tường, không làm đông lưới trần thành 2 lớp trên mặt bằng
    let unit = res.isMeter ? 0.001 : 1;
    let frameBaseZ = ceilZ;
    let edgeTrimZ = frameBaseZ + (res.isMeter ? 0.015 : 15);
    let faces = [];

    function addBoxFaces(p1, p2, z0, z1, beamWidth, color, topCol = null, sideCol = null) {
      let dx = p2.x - p1.x, dy = p2.y - p1.y;
      let len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len * beamWidth / 2, ny = dx / len * beamWidth / 2;
      let c = [
        { x: p1.x + nx, y: p1.y + ny, z: z0 },
        { x: p2.x + nx, y: p2.y + ny, z: z0 },
        { x: p2.x - nx, y: p2.y - ny, z: z0 },
        { x: p1.x - nx, y: p1.y - ny, z: z0 },
        { x: p1.x + nx, y: p1.y + ny, z: z1 },
        { x: p2.x + nx, y: p2.y + ny, z: z1 },
        { x: p2.x - nx, y: p2.y - ny, z: z1 },
        { x: p1.x - nx, y: p1.y - ny, z: z1 }
      ];
      let fIndices = [
        { idx: [0, 1, 2, 3], fill: color },
        { idx: [4, 7, 6, 5], fill: topCol || color },
        { idx: [0, 4, 5, 1], fill: sideCol || 'rgba(148, 163, 184, 0.85)' },
        { idx: [1, 5, 6, 2], fill: 'rgba(30, 41, 59, 0.95)' },
        { idx: [2, 6, 7, 3], fill: sideCol || 'rgba(148, 163, 184, 0.85)' },
        { idx: [3, 7, 4, 0], fill: 'rgba(30, 41, 59, 0.95)' }
      ];
      fIndices.forEach(f => {
        let pts = f.idx.map(i => c[i]);
        let avgZ = pts.reduce((sum, p) => sum + p.z, 0) / 4;
        let avgX = pts.reduce((sum, p) => sum + p.x, 0) / 4;
        let avgY = pts.reduce((sum, p) => sum + p.y, 0) / 4;
        let prj = project3D(avgX, avgY, avgZ);
        faces.push({ pts, fill: f.fill, stroke: color, lineWidth: 0.8, depth: prj.depth });
      });
    }

    function addTBeamFaces(p1, p2, baseZ, color, heightMm = 38, trimEndsMm = 0) {
      let dx = p2.x - p1.x, dy = p2.y - p1.y;
      let len = Math.hypot(dx, dy);
      if (len <= (trimEndsMm * 2 * unit)) return;

      let ux = dx / len, uy = dy / len;
      let trimDist = trimEndsMm * unit;
      let sp1 = { x: p1.x + ux * trimDist, y: p1.y + uy * trimDist };
      let sp2 = { x: p2.x - ux * trimDist, y: p2.y - uy * trimDist };

      let flangeW = 24 * unit;
      let flangeT = 2.0 * unit;
      let webW = 2.2 * unit;
      let totalH = heightMm * unit;
      let bulbH = 4.5 * unit;
      let bulbW = 4.8 * unit;

      // 1. Cánh đáy phẳng
      addBoxFaces(sp1, sp2, baseZ, baseZ + flangeT, flangeW, color, color, color);

      // 2. Bụng đứng chữ T & Gờ đỉnh (chỉ hiện khi nhìn từ trên xuống)
      if (!isBottomUp) {
        addBoxFaces(sp1, sp2, baseZ + flangeT, baseZ + totalH - bulbH, webW, color, color, 'rgba(148, 163, 184, 0.85)');
        addBoxFaces(sp1, sp2, baseZ + totalH - bulbH, baseZ + totalH, bulbW, color, color, color);
      }
    }

    function addLockClip(pt, dirX, dirY, baseZ, clipColor) {
      if (isBottomUp) return;
      let clipLen = 14 * unit, clipW = 1.6 * unit;
      let p1 = { x: pt.x, y: pt.y };
      let p2 = { x: pt.x + dirX * clipLen, y: pt.y + dirY * clipLen };
      addBoxFaces(p1, p2, baseZ + 5 * unit, baseZ + 20 * unit, clipW, clipColor);
    }

    let roomEntities = typeof entities !== 'undefined'
      ? entities.filter(e => e.roomId === res.roomId)
      : [];
    let linesByLayer = prefix => roomEntities.filter(e => e && e.type === 'LINE' && (e.layer || '').startsWith(prefix));
    let circlesByLayer = prefix => roomEntities.filter(e => e && e.type === 'CIRCLE' && (e.layer || '').startsWith(prefix));

    if (showLights) {
      roomEntities.filter(e => e && (e.layer === 'LIGHT_RECESSED' || e.layer === 'LIGHT_SQUARE_600')).forEach(light => {
        let isSquare = light.layer === 'LIGHT_SQUARE_600';
        let center = isSquare ? { x: light.x + light.w / 2, y: light.y + light.h / 2 } : { x: light.cx, y: light.cy };
        let size = isSquare ? light.w * 0.68 : light.r * 2.2;
        let z = frameBaseZ + (res.isMeter ? 0.012 : 12);
        let pts = [
          { x: center.x - size / 2, y: center.y - size / 2, z },
          { x: center.x + size / 2, y: center.y - size / 2, z },
          { x: center.x + size / 2, y: center.y + size / 2, z },
          { x: center.x - size / 2, y: center.y + size / 2, z }
        ];
        faces.push({ pts, fill: 'rgba(250, 204, 21, 0.9)', stroke: '#fef08a', lineWidth: 1.5,
          depth: project3D(center.x, center.y, z).depth });
      });
    }

    // 1. Tấm trần 3D
    if (showTiles && res.tiles3d) {
      res.tiles3d.forEach(tile => {
        if (tile.pts && tile.pts.length >= 3) {
          let pts = tile.pts.map(p => ({ x: p.x, y: p.y, z: frameBaseZ }));
          let avgX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
          let avgY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
          let prj = project3D(avgX, avgY, frameBaseZ);
          faces.push({
            pts,
            fill: tile.isFull ? 'rgba(6, 182, 212, 0.35)' : 'rgba(217, 70, 239, 0.45)',
            stroke: tile.isFull ? '#06b6d4' : '#d946ef',
            lineWidth: 1.0,
            depth: prj.depth
          });
        }
      });
    }

    // 2. Thanh Chính Main-T 3.6m (ĐỎ @1200)
    if (showMain) {
      let mainLines = linesByLayer('03_');
      mainLines.forEach(l => {
        let p1 = { x: l.p1[0], y: l.p1[1] }, p2 = { x: l.p2[0], y: l.p2[1] };
        addTBeamFaces(p1, p2, frameBaseZ, '#dc2626', 38, 0);
        let dx = p2.x - p1.x, dy = p2.y - p1.y, lLen = Math.hypot(dx, dy) || 1;
        addLockClip(p1, -dx / lLen, -dy / lLen, frameBaseZ, '#991b1b');
        addLockClip(p2, dx / lLen, dy / lLen, frameBaseZ, '#991b1b');
      });
    }

    // 3. Thanh Phụ Cross-T 1.2m (VÀNG @600)
    if (showCross) {
      let cross12 = linesByLayer('04_');
      cross12.forEach(l => {
        let p1 = { x: l.p1[0], y: l.p1[1] }, p2 = { x: l.p2[0], y: l.p2[1] };
        let dx = p2.x - p1.x, dy = p2.y - p1.y, lLen = Math.hypot(dx, dy) || 1;
        let ux = dx / lLen, uy = dy / lLen;
        addTBeamFaces(p1, p2, frameBaseZ, '#ca8a04', 32, 12);
        addLockClip(p1, -ux, -uy, frameBaseZ, '#ca8a04');
        addLockClip(p2, ux, uy, frameBaseZ, '#ca8a04');
      });
    }

    // 4. Thanh Phụ Cross-T 0.6m (XANH LÁ @600)
    if (showCross6) {
      let cross6 = linesByLayer('05_');
      cross6.forEach(l => {
        let p1 = { x: l.p1[0], y: l.p1[1] }, p2 = { x: l.p2[0], y: l.p2[1] };
        let dx = p2.x - p1.x, dy = p2.y - p1.y, lLen = Math.hypot(dx, dy) || 1;
        let ux = dx / lLen, uy = dy / lLen;
        addTBeamFaces(p1, p2, frameBaseZ, '#16a34a', 26, 12);
        addLockClip(p1, -ux, -uy, frameBaseZ, '#16a34a');
        addLockClip(p2, ux, uy, frameBaseZ, '#16a34a');
      });
    }

    // 5. Thanh Viền Tường Shadow-V (nằm ở mép tường, không làm chồng lên lưới trần)
    if (showWallV) {
      let wallV = linesByLayer('02_');
      wallV.forEach(l => {
        let p1 = { x: l.p1[0], y: l.p1[1] };
        let p2 = { x: l.p2[0], y: l.p2[1] };
        let dx = p2.x - p1.x, dy = p2.y - p1.y;
        let len = Math.hypot(dx, dy) || 1;
        let ux = dx / len, uy = dy / len;

        // Thanh V chỉ gác ở mép tường, dốc/chốt nhẹ ra ngoài mặt phẳng lưới. Không cùng mặt với main/cross.
        addBoxFaces(p1, p2, frameBaseZ, edgeTrimZ, 18 * unit, '#0ea5e9');
        if (!isBottomUp) {
          let offset1 = { x: p1.x + ux * 4 * unit, y: p1.y + uy * 4 * unit };
          let offset2 = { x: p2.x + ux * 4 * unit, y: p2.y + uy * 4 * unit };
          addBoxFaces(offset1, offset2, edgeTrimZ, edgeTrimZ + 18 * unit, 2.5 * unit, '#38bdf8');
        }
      });
    }

    // 6. Ty Treo M8 (Chỉ hiện khi nhìn từ trên xuống)
    if (showHangers && !isBottomUp) {
      let hangerCircles = typeof entities !== 'undefined'
        ? entities.filter(e => e.roomId === res.roomId && e.type === 'CIRCLE' && (e.layer || '').startsWith('07_'))
        : [];
      hangerCircles.forEach(h => {
        let p1 = { x: h.cx, y: h.cy };
        addBoxFaces(p1, p1, frameBaseZ + 38 * unit, slabZ - 25 * unit, 10 * unit, '#b91c1c');
      });

      // Sàn bê tông phía trên
      if (res.polyPts && res.polyPts.length >= 3) {
        let slabPts = res.polyPts.map(p => ({ x: p.x, y: p.y, z: slabZ }));
        let avgX = slabPts.reduce((sum, p) => sum + p.x, 0) / slabPts.length;
        let avgY = slabPts.reduce((sum, p) => sum + p.y, 0) / slabPts.length;
        let prj = project3D(avgX, avgY, slabZ);
        faces.push({
          pts: slabPts,
          fill: 'rgba(51, 65, 85, 0.35)',
          stroke: '#64748b',
          lineWidth: 1.0,
          depth: prj.depth
        });
      }
    }

    // 8. Khối tường phòng
    if (showWalls && res.polyPts && res.polyPts.length >= 3) {
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        let wPts = [
          { x: p1.x, y: p1.y, z: 0 },
          { x: p2.x, y: p2.y, z: 0 },
          { x: p2.x, y: p2.y, z: slabZ },
          { x: p1.x, y: p1.y, z: slabZ }
        ];
        let avgX = (p1.x + p2.x) / 2, avgY = (p1.y + p2.y) / 2;
        let prj = project3D(avgX, avgY, slabZ / 2);
        faces.push({
          pts: wPts,
          fill: 'rgba(15, 23, 42, 0.22)',
          stroke: 'rgba(56, 189, 248, 0.35)',
          lineWidth: 1.0,
          depth: prj.depth
        });
      }
    }

    drawDepthSortedFaces(faces);
  }

  function renderLoop() {
    if (!document.getElementById('tt600-3d-modal')) return;

    c3d.clearRect(0, 0, cvs.width, cvs.height);

    let showWallV = document.getElementById('iso-chk-wallv')?.checked;
    let showHangers = document.getElementById('iso-chk-hangers')?.checked;
    let showMain = document.getElementById('iso-chk-maint')?.checked;
    let showCross = document.getElementById('iso-chk-crosst')?.checked;
    let showCross6 = document.getElementById('iso-chk-cross6')?.checked;
    let showTiles = document.getElementById('iso-chk-tiles')?.checked;
    let showLights = document.getElementById('iso-chk-lights')?.checked;
    let showWalls = document.getElementById('iso-chk-walls')?.checked;

    if (!res || !res.polyPts) {
      requestAnimationFrame(renderLoop);
      return;
    }

    let isBottomUp = pitch < -0.15; // Đang nhìn ngước từ dưới trần lên

    drawConstructionScene(isBottomUp, showWallV, showHangers, showMain, showCross, showCross6, showTiles, showWalls, showLights);

    requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

// === MODULE: trantha600/7_view_section.js ===
// ===============================================================================
//     TT600 2D TECHNICAL CROSS-SECTION VIEWER
//     Cửa sổ bản vẽ mặt cắt chi tiết 2D cấu tạo kỹ thuật trần thạch cao thả
// ===============================================================================

window.openTT600SectionModal = function() {
  let oldModal = document.getElementById('tt600-sec-modal');
  if (oldModal) oldModal.remove();

  let modal = document.createElement('div');
  modal.id = 'tt600-sec-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '9999';
  modal.style.background = 'rgba(2, 6, 23, 0.9)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  modal.innerHTML = `
    <div style="width:88vw; height:85vh; background:#0f172a; border:2px solid #a855f7; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#1e293b; border-bottom:1.5px solid #334155;">
        <div style="font-weight:bold; font-size:14px; color:#c084fc; display:flex; align-items:center; gap:8px;">
          🔍 BẢN VẼ MẶT CẮT CHI TIẾT CẤU TẠO HỆ TRẦN THẢ 600x600 (TCVN & VĨNH TƯỜNG)
        </div>
        <button onclick="document.getElementById('tt600-sec-modal').remove()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold;">✕ Đóng</button>
      </div>

      <div style="flex:1; position:relative;">
        <canvas id="tt600-sec-canvas" style="width:100%; height:100%; background:#020617;"></canvas>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cvs = document.getElementById('tt600-sec-canvas');
  if (!cvs) return;
  cvs.width = cvs.clientWidth;
  cvs.height = cvs.clientHeight;
  const ctxS = cvs.getContext('2d');

  drawSectionDetail(ctxS, cvs.width, cvs.height);
};

function drawSectionDetail(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  let startX = 80, endX = w - 80;
  let slabY = 90;
  let ceilY = slabY + 220;

  // Sàn Bê tông
  ctx.fillStyle = '#334155';
  ctx.fillRect(startX, slabY - 30, endX - startX, 30);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, slabY - 30, endX - startX, 30);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SÀN BÊ TÔNG CỐT THÉP (+3.200)', startX + 20, slabY - 10);

  // Tường 2 bên
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(startX - 40, slabY - 30, 40, ceilY - slabY + 120);
  ctx.fillRect(endX, slabY - 30, 40, ceilY - slabY + 120);
  ctx.strokeRect(startX - 40, slabY - 30, 40, ceilY - slabY + 120);
  ctx.strokeRect(endX, slabY - 30, 40, ceilY - slabY + 120);

  // Thanh viền tường Shadow-V 20x20
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(startX, ceilY - 20); ctx.lineTo(startX, ceilY); ctx.lineTo(startX + 25, ceilY);
  ctx.moveTo(endX, ceilY - 20); ctx.lineTo(endX, ceilY); ctx.lineTo(endX - 25, ceilY);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Viền tường Shadow-V 20x20', startX + 10, ceilY - 25);

  // Thanh chính Main-T 3.6m (Đỏ) + Ty Treo M8
  let mainXPositions = [startX + 180, startX + 480, startX + 780];
  mainXPositions.forEach((mx, idx) => {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx, slabY); ctx.lineTo(mx, ceilY - 38);
    ctx.stroke();

    // Tắc kê M8
    ctx.fillStyle = '#facc15';
    ctx.fillRect(mx - 5, slabY - 2, 10, 8);

    // Tăng đơ
    ctx.strokeStyle = '#facc15';
    ctx.strokeRect(mx - 6, (slabY + ceilY) / 2 - 15, 12, 30);

    // Mặt cắt chữ T thanh chính
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mx, ceilY - 38); ctx.lineTo(mx, ceilY);
    ctx.moveTo(mx - 15, ceilY); ctx.lineTo(mx + 15, ceilY);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Ty treo M8 #${idx + 1} (@1200)`, mx - 35, (slabY + ceilY) / 2 + 30);
    ctx.fillText(`Main-T 3.6m`, mx - 25, ceilY + 25);
  });

  // Thanh phụ Cross-T (Vàng)
  let crossXPositions = [startX + 330, startX + 630];
  crossXPositions.forEach((cx, idx) => {
    ctx.strokeStyle = '#eab308';
    ctx.fillStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, ceilY - 28); ctx.lineTo(cx, ceilY);
    ctx.moveTo(cx - 12, ceilY); ctx.lineTo(cx + 12, ceilY);
    ctx.stroke();

    ctx.font = '10px sans-serif';
    ctx.fillText('Cross-T (@600)', cx - 28, ceilY + 30);
  });

  // Tấm thạch cao thả 600x600
  ctx.fillStyle = '#06b6d4';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;

  let panelSpans = [
    [startX + 5, startX + 175],
    [startX + 185, startX + 325],
    [startX + 335, startX + 475],
    [startX + 485, startX + 625],
    [startX + 635, startX + 775],
    [startX + 785, endX - 5]
  ];

  panelSpans.forEach(span => {
    ctx.fillRect(span[0], ceilY - 9, span[1] - span[0], 9);
    ctx.strokeRect(span[0], ceilY - 9, span[1] - span[0], 9);
  });

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('CAO ĐỘ HOÀN THIỆN TRẦN (+2.600)', startX + 20, ceilY + 60);

  // Kích thước chiều cao
  ctx.strokeStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(startX - 60, slabY); ctx.lineTo(startX - 60, ceilY);
  ctx.stroke();
  ctx.fillText('H = 600mm', startX - 130, (slabY + ceilY) / 2);
}


// === MODULE: trantha600/index.js ===
// ===============================================================================
//     VINACAD PLUGIN: CHIA TRẦN THẠCH CAO 600x600 & BÓC TÁCH VẬT TƯ (TT600)
//     Tiêu chuẩn thi công TCVN / Vĩnh Tường / Lê Trần • Chuẩn Mốc Cạnh Công Trình
//     Tích hợp: Mặt Bằng 2D Chi Tiết, Phối Cảnh Góc Nghiêng 3D & Mặt Cắt Kỹ Thuật 2D
//     Tệp Plugin nạp ngoài độc lập qua APPLOAD
// ===============================================================================

(function() {
  // 1. Khởi tạo trạng thái TT600
  if (!window.tt600State) {
    window.tt600State = {
      active: false,
      step: 1,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: null,
      allResults: [],
      viewMode: '2D',
      facadeMode: 'bottom_left',
      forceMainOrientation: null
    };
  }

  // 2. Khởi tạo Tool TT600
  window.initTT600Tool = function() {
    let prevAll = (window.tt600State && Array.isArray(window.tt600State.allResults)) ? window.tt600State.allResults : [];
    let prevLast = window.tt600State ? window.tt600State.lastResult : null;

    window.tt600State = {
      active: true,
      step: 1,
      facadePickCount: 0,
      polyPts: [],
      edge1: null,
      edge2: null,
      lastResult: prevLast,
      allResults: prevAll,
      viewMode: '2D',
      facadeMode: 'bottom_left',
      forceMainOrientation: null
    };
    if (typeof setTaskContext === 'function') setTaskContext('TT600', 1, 'SELECT_ROOM_ENTITIES');

    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
    if (typeof setInfo === 'function') {
      setInfo("👉 [TT600] BƯỚC 1: Quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER (hoặc Phím cách / Chuột phải):");
    }
  };

  // 3. Thực thi chuyển bước và tính toán trần
  window.executeTT600FromSelectionOrCanvas = function() {
    if (!window.tt600State) return;

    // A. NẾU ĐANG Ở BƯỚC 2: Người dùng nhấn Enter ➔ BẮT ĐẦU TÍNH TOÁN & VẼ TRẦN
    if (window.tt600State.step === 2 && window.tt600State.polyPts && window.tt600State.polyPts.length >= 3) {
      if (!window.tt600State.edge1 || !window.tt600State.edge2) {
        if (typeof setInfo === 'function') {
          setInfo("👉 [TT600] Hãy nhấp chọn đủ CẠNH 1 và CẠNH 2 trước khi nhấn ENTER.");
        }
        return;
      }
      if (typeof executeTT600Algorithm === 'function') {
        executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
      }
      window.tt600State.step = 3; // Chuyển sang Bước 3: Hoàn tất & Tinh chỉnh / Xem 3D
      if (typeof setTaskContext === 'function') setTaskContext('TT600', 3, 'CEILING_COMPLETED');
      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo("✅ [TT600] Đã tính toán & vẽ hệ trần thành công! Bạn có thể xem 3D, Mặt cắt, hoặc nhấn ENTER để chốt hoàn tất.");
      }
      if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
      if (typeof render === 'function') render();
      return;
    }

    // B. NẾU ĐANG Ở BƯỚC 3: Người dùng nhấn Enter ➔ HOÀN TẤT CHỐT PHƯƠNG ÁN
    if (window.tt600State.step === 3) {
      window.finishTT600Workflow();
      return;
    }

    // C. NẾU ĐANG Ở BƯỚC 1: Tìm đa giác phòng từ nét quét chọn hoặc vị trí chuột
    let poly = null;
    if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !(e.id || '').startsWith('tt_'));
      if (selEnts.length > 0) {
        poly = findEnclosingPolygonFromEntities(selEnts, null);
      }
    }

    if (!poly && window.tt600State.polyPts && window.tt600State.polyPts.length >= 3) {
      poly = window.tt600State.polyPts;
    }

    if (poly && poly.length >= 3) {
      window.tt600State.polyPts = poly;
      window.tt600State.step = 2; // Chuyển sang Bước 2: Chọn 2 Cạnh Mặt Tiền
      window.tt600State.facadePickCount = 0;
      if (typeof setTaskContext === 'function') setTaskContext('TT600', 2, 'SELECT_2_FACADE_EDGES', { vertexCount: poly.length });

      window.tt600State.edge1 = null;
      window.tt600State.edge2 = null;

      if (typeof selectedIds !== 'undefined') selectedIds.clear();
      if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();

      if (typeof setInfo === 'function') {
        setInfo(`👉 [TT600] BƯỚC 2: Nhấp chọn 2 CẠNH MẶT TIỀN (Góc mốc chính) trên bản vẽ, sau đó nhấn ENTER để BẮT ĐẦU TÍNH TOÁN & VẼ:`);
      }
      if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
      if (typeof render === 'function') render();
    } else {
      if (typeof setInfo === 'function') {
        setInfo("👉 [TT600] Hãy quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER để tiếp tục.", "prompt");
      }
    }
  };

  // 4. Xử lý click chuột trong chế độ TT600
  window.handleTT600Click = function(pt) {
    if (!window.tt600State) return;

    if (window.tt600State.step === 1) {
      if (typeof setInfo === 'function') {
        setInfo("👉 [TT600] Hãy quét chọn các nét của căn phòng rồi nhấn ENTER để tiếp tục.");
      }
      return;
    }

    if (window.tt600State.step === 2 || window.tt600State.step === 3) {
      let closestEdge = getClosestEdge(pt, window.tt600State.polyPts);
      if (closestEdge) {
        let len = Math.hypot(closestEdge.p2.x - closestEdge.p1.x, closestEdge.p2.y - closestEdge.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        if (window.tt600State.facadePickCount === 0 || !window.tt600State.edge1) {
          window.tt600State.edge1 = closestEdge;
          window.tt600State.facadePickCount = 1;
          if (typeof setInfo === 'function') {
            setInfo(`🏷️ Đã chọn CẠNH 1 (Mặt tiền chính: ${lenMm.toFixed(0)}mm). Hãy nhấp tiếp CẠNH 2 (Mặt tiền phụ).`);
          }
        } else {
          window.tt600State.edge2 = closestEdge;
          window.tt600State.facadePickCount = 2;
          if (typeof setInfo === 'function') {
            setInfo(`🏷️ Đã chọn CẠNH 2 (Mặt tiền phụ: ${lenMm.toFixed(0)}mm). Nhấn ENTER (hoặc Space / Chuột phải) để BẮT ĐẦU TÍNH TOÁN & VẼ TRẦN.`);
          }
        }

        // Nếu đang ở Bước 3 (đã tính trước đó), tự động cập nhật lại thuật toán
        if (window.tt600State.step === 3 && typeof executeTT600Algorithm === 'function') {
          executeTT600Algorithm(window.tt600State.polyPts, window.tt600State.edge1, window.tt600State.edge2);
        }

        if (typeof ensurePluginFloatingUI === 'function') ensurePluginFloatingUI();
        if (typeof render === 'function') render();
      }
      return;
    }
  };

  // 5. Tự vẽ Overlay hướng dẫn & viền mốc Mặt Tiền
  function drawTT600Overlay(ctx) {
    if (typeof currentTool !== 'undefined' && currentTool !== 'TT600') return;
    if (typeof tt600State !== 'undefined' && tt600State && tt600State.polyPts && tt600State.polyPts.length >= 3) {
      ctx.save();
      let pts = tt600State.polyPts;
      ctx.strokeStyle = '#facc15';
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

      // Highlight Edge 1 (Mặt Tiền Chính)
      if (tt600State.edge1) {
        let p1 = worldToScreen(tt600State.edge1.p1.x, tt600State.edge1.p1.y);
        let p2 = worldToScreen(tt600State.edge1.p2.x, tt600State.edge1.p2.y);
        let len = Math.hypot(tt600State.edge1.p2.x - tt600State.edge1.p1.x, tt600State.edge1.p2.y - tt600State.edge1.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#f59e0b';
        let mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        ctx.fillText(`🏷️ MẶT TIỀN 1 (${lenMm.toFixed(0)}mm - TẤM NGUYÊN)`, mx + 10, my - 8);
      }

      // Highlight Edge 2 (Mặt Tiền Phụ)
      if (tt600State.edge2) {
        let p1 = worldToScreen(tt600State.edge2.p1.x, tt600State.edge2.p1.y);
        let p2 = worldToScreen(tt600State.edge2.p2.x, tt600State.edge2.p2.y);
        let len = Math.hypot(tt600State.edge2.p2.x - tt600State.edge2.p1.x, tt600State.edge2.p2.y - tt600State.edge2.p1.y);
        let isMeter = len < 60;
        let lenMm = isMeter ? len * 1000 : len;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#10b981';
        let mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        ctx.fillText(`🏷️ MẶT TIỀN 2 (${lenMm.toFixed(0)}mm - TẤM NGUYÊN)`, mx + 10, my + 16);
      }
      ctx.restore();
    }
  }

  window.drawTT600Overlay = drawTT600Overlay;
  if (typeof registerPluginOverlay === 'function') {
    registerPluginOverlay(drawTT600Overlay);
  }

  // 6. Đăng ký Hook Escape để dọn dẹp khi người dùng nhấn ESC
  if (typeof registerPluginEscapeHandler === 'function') {
    registerPluginEscapeHandler(function() {
      const modal3d = document.getElementById('tt600-3d-modal');
      if (modal3d) modal3d.remove();
      const modalSec = document.getElementById('tt600-sec-modal');
      if (modalSec) modalSec.remove();
      const bar = document.getElementById('tt600-floating-bar');
      if (bar) bar.remove();
      if (window.tt600State) {
        window.tt600State.active = false;
        window.tt600State.step = 1;
        window.tt600State.edge1 = null;
        window.tt600State.edge2 = null;
      }
    });
  }

  // 7. Đăng ký Tool TT600 với Lõi CAD Engine qua Generic Hook Interface
  if (typeof registerPluginTool === 'function') {
    registerPluginTool('TT600', {
      allowSelection: function() {
        return !window.tt600State || window.tt600State.step === 1;
      },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.initTT600Tool();
      },
      onDeactivate: function() {
        let bar = document.getElementById('tt600-floating-bar');
        if (bar) bar.remove();
        if (window.tt600State) {
          window.tt600State.active = false;
          window.tt600State.step = 1;
        }
      },
      onMouseDown: function(downWorld, e) {
        if (window.tt600State && window.tt600State.step === 1) {
          window.tt600State.scanStartWorld = { x: downWorld.x, y: downWorld.y };
          return false;
        }
        if (window.tt600State && window.tt600State.step === 2) {
          window.handleTT600Click(downWorld);
          return true;
        }
        return false;
      },
      onMouseUp: function(upWorld, e) {
        if (!window.tt600State || window.tt600State.step !== 1 || !window.tt600State.scanStartWorld) return false;

        let start = window.tt600State.scanStartWorld;
        window.tt600State.scanStartWorld = null;
        let dragDistance = Math.hypot(upWorld.x - start.x, upWorld.y - start.y);
        if (dragDistance < 6) return false;

        let minX = Math.min(start.x, upWorld.x), maxX = Math.max(start.x, upWorld.x);
        let minY = Math.min(start.y, upWorld.y), maxY = Math.max(start.y, upWorld.y);
        if (!e.shiftKey) selectedIds.clear();

        entities.forEach(entity => {
          if (entity.layer === 'BOM_TABLE' || (entity.id || '').startsWith('tt_')) return;
          let bounds = typeof getEntityBoundingBox === 'function' ? getEntityBoundingBox(entity) : null;
          if (!bounds) return;
          let overlaps = bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY;
          if (overlaps) selectedIds.add(entity.id);
        });

        if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
        if (typeof setInfo === 'function') {
          setInfo(`👉 [TT600] Đã quét ${selectedIds.size} nét phòng. Nhấn ENTER để tiếp tục bước chọn mốc cạnh.`);
        }
        return true;
      },
      onSelectionChange: function(selectedIds, isCrossing) {
        if (window.tt600State && window.tt600State.step === 1) {
          if (selectedIds && selectedIds.size > 0) {
            if (typeof setInfo === 'function') {
              setInfo(`👉 [TT600] Đã chọn ${selectedIds.size} nét phòng. Nhấn ENTER (hoặc Space / Chuột phải) để TIẾP TỤC BƯỚC 2.`);
            }
          } else {
            if (typeof setInfo === 'function') {
              setInfo("👉 [TT600] BƯỚC 1: Quét chọn các nét của căn phòng cần tính trần, sau đó nhấn ENTER:");
            }
          }
        }
      },
      onClick: function(pt) {
        window.handleTT600Click(pt);
      },
      onContextMenu: function(e) {
        window.executeTT600FromSelectionOrCanvas();
      },
      onEnter: function() {
        window.executeTT600FromSelectionOrCanvas();
      }
    });

    registerPluginTool('TTCOPY', {
      allowSelection: function() {
        return true;
      },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        if (typeof selectedIds !== 'undefined') selectedIds.clear();
        if (typeof setInfo === 'function') setInfo('👉 [TTCOPY] Quét chọn các nét của bản vẽ đã chia trần, sau đó nhấn ENTER.');
      },
      onSelectionChange: function(copySelectedIds) {
        if (typeof setInfo !== 'function') return;
        if (copySelectedIds && copySelectedIds.size > 0) {
          setInfo(`👉 [TTCOPY] Đã chọn ${copySelectedIds.size} nét. Nhấn ENTER để lấy kích thước và mở 3D.`);
        } else {
          setInfo('👉 [TTCOPY] Quét chọn các nét của bản vẽ đã chia trần, sau đó nhấn ENTER.');
        }
      },
      onEnter: function() {
        window.copyTT600Dimensions();
      },
      onContextMenu: function() {
        window.copyTT600Dimensions();
      }
    });
  }

  // 8. Đăng ký các lệnh CLI của plugin
  window.c_TT600 = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.c_TRANTHA = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.c_TRANTHA600 = function() {
    if (typeof selectTool === 'function') selectTool('TT600');
  };
  window.open3DViewer = function() {
    if (typeof window.openTT6003DModal === 'function') window.openTT6003DModal();
  };
  window.c_TT3D = window.open3DViewer;
  window.openSectionViewer = function() {
    if (typeof window.openTT600SectionModal === 'function') window.openTT600SectionModal();
  };
  window.c_TTSEC = window.openSectionViewer;
  window.c_TTFIT = function() {
    if (typeof window.zoomFitTT600 === 'function') window.zoomFitTT600();
  };
  window.c_TTCOPY = function() {
    if (typeof window.startTT600CopyWorkflow === 'function') window.startTT600CopyWorkflow();
  };

  if (typeof registerPluginCommand === 'function') {
    registerPluginCommand('TT600', window.c_TT600, 'Chia Trần Thả 600x600');
    registerPluginCommand('TRANTHA', window.c_TRANTHA, 'Chia Trần Thả 600x600');
    registerPluginCommand('TRANTHA600', window.c_TRANTHA600, 'Chia Trần Thả 600x600');
    registerPluginCommand('TT3D', window.c_TT3D, 'Xem 3D Phối Cảnh Hệ Trần Thả');
    registerPluginCommand('TTSEC', window.c_TTSEC, 'Xem Mặt Cắt Kỹ Thuật Chi Tiết 2D');
    registerPluginCommand('TTFIT', window.c_TTFIT, 'Căn Giữa Trần & Bảng Dự Toán');
    registerPluginCommand('TTCOPY', window.c_TTCOPY, 'Quét bản vẽ, COPY kích thước và mở 3D');
  } else if (typeof registerCommand === 'function') {
    registerCommand('TT600', window.c_TT600, 'Chia Trần Thả 600x600');
    registerCommand('TRANTHA', window.c_TRANTHA, 'Chia Trần Thả 600x600');
    registerCommand('TRANTHA600', window.c_TRANTHA600, 'Chia Trần Thả 600x600');
    registerCommand('TT3D', window.c_TT3D, 'Xem 3D Phối Cảnh Hệ Trần Thả');
    registerCommand('TTSEC', window.c_TTSEC, 'Xem Mặt Cắt Kỹ Thuật Chi Tiết 2D');
    registerCommand('TTFIT', window.c_TTFIT, 'Căn Giữa Trần & Bảng Dự Toán');
    registerCommand('TTCOPY', window.c_TTCOPY, 'Quét bản vẽ, COPY kích thước và mở 3D');
  }
})();
