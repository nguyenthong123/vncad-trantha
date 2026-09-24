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

  let isMeter = (len_raw < 60 && wid_raw < 60);
  let scaleUnit = isMeter ? 1000.0 : 1.0;
  let gridCad = isMeter ? 0.6 : 600.0;
  let mainCad = isMeter ? 1.2 : 1200.0;
  let hangerR = isMeter ? 0.05 : 45.0;
  let firstOffsetDefault = isMeter ? 0.6 : 600.0; // Chuẩn vách ra 600mm
  let realAreaM2 = isMeter ? polyArea(polyPts) : polyArea(polyPts) / 1e6;
  let realPeriM = isMeter ? polyPeri(polyPts) : polyPeri(polyPts) / 1e3;

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

  // 2. Tính toán các đường lưới X và Y
  let all_x = [];
  let all_y = [];
  let main_lines = [];   // Danh sách tọa độ các thanh chính Đỏ
  let cross_lines = [];  // Danh sách tọa độ các thanh phụ Vàng 1.2m
  let cross6_lines = []; // Danh sách tọa độ các thanh phụ Xanh lá 0.6m

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
    inner_y.forEach((gy, idx) => {
      if (idx % 2 === 0) {
        main_lines.push(gy); // Đỏ @1200mm
      } else {
        cross6_lines.push(gy); // Xanh lá @600mm
      }
    });
    cross_lines = all_x.slice(1, all_x.length - 1);
  } else {
    let inner_x = all_x.slice(1, all_x.length - 1);
    inner_x.forEach((gx, idx) => {
      if (idx % 2 === 0) {
        main_lines.push(gx); // Đỏ @1200mm
      } else {
        cross6_lines.push(gx); // Xanh lá @600mm
      }
    });
    cross_lines = all_y.slice(1, all_y.length - 1);
  }

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
  for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
    let p1 = polyPts[j], p2 = polyPts[i];
    pushEnt({
      id: `tt_wallv_${j}_${i}`,
      type: 'LINE',
      p1: [p1.x, p1.y],
      p2: [p2.x, p2.y],
      color: '#38bdf8',
      layer: '02_THANH_V_VIEN_TUONG',
      width: 3.2
    });
  }

  // 5. Sinh Hệ Khung Xương Chuẩn
  let mainTeeCount = 0;
  let cross1220Count = 0;
  let cross610Count = 0;
  let hangerCount = 0;

  if (isMainHorizontal) {
    // A. Thanh Chính Main-T 3.6m (ĐỎ @1200mm)
    main_lines.forEach((my, idx) => {
      let segs = getHSegments(polyPts, my, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_mt_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [s[0], my],
          p2: [s[1], my],
          color: '#ef4444',
          layer: '03_XUONG_CHINH_T3660',
          width: 2.6
        });
        mainTeeCount += Math.ceil((s[1] - s[0]) / (3.6 * (isMeter ? 1 : 1000)));

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

    // B. Thanh Phụ Cross-T 0.6m (XANH LÁ @600mm)
    cross6_lines.forEach((gy, idx) => {
      let segs = getHSegments(polyPts, gy, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_cx_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [s[0], gy],
          p2: [s[1], gy],
          color: '#22c55e',
          layer: '05_XUONG_PHU_T610',
          width: 1.2
        });
        cross610Count += Math.ceil((s[1] - s[0]) / gridCad);
      });
    });

    // C. Thanh Phụ Cross-T 1.2m (VÀNG @600mm)
    cross_lines.forEach((gx, idx) => {
      let segs = getVSegments(polyPts, gx, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_cy_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [gx, s[0]],
          p2: [gx, s[1]],
          color: '#eab308',
          layer: '04_XUONG_PHU_T1220',
          width: 1.8
        });
        cross1220Count += Math.ceil((s[1] - s[0]) / (2 * gridCad));
      });
    });
  } else {
    // A. Thanh Chính Main-T 3.6m (ĐỎ @1200mm) Chạy Dọc
    main_lines.forEach((mx, idx) => {
      let segs = getVSegments(polyPts, mx, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_mt_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [mx, s[0]],
          p2: [mx, s[1]],
          color: '#ef4444',
          layer: '03_XUONG_CHINH_T3660',
          width: 2.6
        });
        mainTeeCount += Math.ceil((s[1] - s[0]) / (3.6 * (isMeter ? 1 : 1000)));

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

    // B. Thanh Phụ Cross-T 0.6m (XANH LÁ @600mm)
    cross6_lines.forEach((gx, idx) => {
      let segs = getVSegments(polyPts, gx, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_cx_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [gx, s[0]],
          p2: [gx, s[1]],
          color: '#22c55e',
          layer: '05_XUONG_PHU_T610',
          width: 1.2
        });
        cross610Count += Math.ceil((s[1] - s[0]) / gridCad);
      });
    });

    // C. Thanh Phụ Cross-T 1.2m (VÀNG @600mm)
    cross_lines.forEach((gy, idx) => {
      let segs = getHSegments(polyPts, gy, isMeter);
      segs.forEach(s => {
        pushEnt({
          id: `tt_cy_${idx}_${s[0]}`,
          type: 'LINE',
          p1: [s[0], gy],
          p2: [s[1], gy],
          color: '#eab308',
          layer: '04_XUONG_PHU_T1220',
          width: 1.8
        });
        cross1220Count += Math.ceil((s[1] - s[0]) / (2 * gridCad));
      });
    });
  }

  // 6. Kích thước (DIM TƯỜNG, DIM KHUNG & DIM TỔNG)
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
    n_full_tiles, n_cut_tiles, cutTilesList, tiles3d,
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
  let dx = roomWidth + gap;
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

function generateBOMEntities(realAreaM2, realPeriM, n_full_tiles, n_cut_tiles, mainTeeCount, cross1220Count, cross610Count, hangerCount, cutTilesList, pairedCuts, xmax, ymax, isMeter) {
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
  let totH = th + 7 * rh;

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
    { stt: "7", name: "Tắc kê đạn M8 + Đinh thép bê tông", unit: "hộp", qty: "1", note: "Phụ kiện liên kết trần", color: '#94a3b8', icon: '◆' }
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

  // 3. Bảng Quy cách Cắt Tấm Biên
  if (cutTilesList.length > 0) {
    let cTabY = legY - legH - (isMeter ? 0.4 : 400);
    let cRows = Math.min(cutTilesList.length, 12);
    let cTotH = th + cRows * rh;

    bomEntities.push({ id: 'tt_ctab_1', type: 'RECTANGLE', x: tabX, y: cTabY - cTotH, w: tabW, h: cTotH, color: '#d946ef', fillColor: 'rgba(15, 23, 42, 0.96)', layer: 'BOM_TABLE' });
    bomEntities.push({ id: 'tt_ctab_2', type: 'RECTANGLE', x: tabX, y: cTabY - th, w: tabW, h: th, color: '#d946ef', fillColor: 'rgba(217, 70, 239, 0.25)', layer: 'BOM_TABLE' });
    bomEntities.push({ id: 'tt_ctab_tt', type: 'TEXT', x: tabX + tabW / 2, y: cTabY - th / 2, text: `QUY CÁCH CẮT TẤM BIÊN (${cutTilesList.length} tấm - Ghép từ ${pairedCuts} tấm nguyên)`, size: fTitle, color: '#e879f9', align: 'center', layer: 'BOM_TABLE' });

    for (let i = 0; i < cRows; i++) {
      let ry = cTabY - th - (i + 1) * rh;
      let item = cutTilesList[i];
      let cutSuggestion = item.w <= 300 || item.h <= 300 ? "💡 Ghép 1 tấm nguyên = 2 tấm biên" : "Cắt tỉa mép";

      bomEntities.push({ id: `tt_ctab_l_${i}`, type: 'LINE', p1: [tabX, ry], p2: [tabX + tabW, ry], color: '#334155', layer: 'BOM_TABLE' });
      bomEntities.push({ id: `tt_ctab_t_${i}`, type: 'TEXT', x: tabX + (isMeter ? 0.35 : 350), y: ry + rh / 2, text: `${item.tag} (Hàng ${item.row}):`, size: fBody, color: '#e879f9', align: 'left', layer: 'BOM_TABLE' });
      bomEntities.push({ id: `tt_ctab_d_${i}`, type: 'TEXT', x: tabX + (isMeter ? 2.5 : 2500), y: ry + rh / 2, text: `${item.dim} mm`, size: fBody, color: '#facc15', align: 'center', layer: 'BOM_TABLE' });
      bomEntities.push({ id: `tt_ctab_s_${i}`, type: 'TEXT', x: tabX + tabW - (isMeter ? 1.1 : 1100), y: ry + rh / 2, text: cutSuggestion, size: fSub, color: '#94a3b8', align: 'center', layer: 'BOM_TABLE' });
    }
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
          <button onclick="document.getElementById('tt600-3d-modal').remove()" class="btn btn-danger" style="padding:4px 12px; font-weight:bold;">✕ Đóng</button>
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
          <button onclick="zoomFit3D()" class="btn btn-highlight" style="padding:6px; font-size:11px; background:#0284c7;">🔍 Căn Giữa Tự Động (Fit Center)</button>

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
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="iso-chk-walls" checked> 🧱 Khối Tường Phòng 3D</label>

          <div id="stats-panel-3d" style="margin-top:auto; background:#1e293b; padding:8px; border-radius:6px; font-size:11px; border:1px solid #334155;">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">📊 Thông số Dự toán:</div>
            <div id="stat-area">• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b></div>
            <div id="stat-full">• Tấm nguyên: <b>${res.n_full_tiles} tấm</b></div>
            <div id="stat-cut">• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b></div>
            <div id="stat-dir">• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  init3DIsoViewer(allRooms, currentRoomIndex);
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
  let sceneMode = 'technical';

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

    // Cập nhật thông số bảng thống kê bên phải
    const statArea = document.getElementById('stat-area');
    if (statArea) statArea.innerHTML = `• Diện tích trần: <b>${res.realAreaM2.toFixed(1)} m²</b>`;
    const statFull = document.getElementById('stat-full');
    if (statFull) statFull.innerHTML = `• Tấm nguyên: <b>${res.n_full_tiles} tấm</b>`;
    const statCut = document.getElementById('stat-cut');
    if (statCut) statCut.innerHTML = `• Tấm cắt biên: <b>${res.n_cut_tiles} tấm</b>`;
    const statDir = document.getElementById('stat-dir');
    if (statDir) statDir.innerHTML = `• Hướng thanh chính: <b>${res.isMainHorizontal ? "Ngang (Trục X)" : "Dọc (Trục Y)"}</b>`;

    // Cập nhật selector và counter
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
    sceneMode = mode === 'construction' ? 'construction' : 'technical';
    let technicalButton = document.getElementById('btn-scene-technical');
    let constructionButton = document.getElementById('btn-scene-construction');
    if (technicalButton) technicalButton.style.outline = sceneMode === 'technical' ? '2px solid #38bdf8' : 'none';
    if (constructionButton) constructionButton.style.outline = sceneMode === 'construction' ? '2px solid #facc15' : 'none';
    if (typeof setInfo === 'function') {
      setInfo(sceneMode === 'construction'
        ? '🧱 [3D KHUNG] Đã bật phối cảnh khối T 3D của hệ khung trần.'
        : '📐 [3D KỸ THUẬT] Đã bật phối cảnh khung trần và các lớp kết cấu.');
    }
  };

  function drawConstructionScene() {
    let unit = res.isMeter ? 0.001 : 1;

    function drawGuideLine(p1, p2, color = 'rgba(71, 85, 105, 0.58)', width = 1) {
      let a = project3D(p1.x, p1.y, p1.z);
      let b = project3D(p2.x, p2.y, p2.z);
      c3d.strokeStyle = color;
      c3d.lineWidth = width;
      c3d.beginPath();
      c3d.moveTo(a.x, a.y);
      c3d.lineTo(b.x, b.y);
      c3d.stroke();
    }

    function drawRoomGuides() {
      let guideColor = 'rgba(71, 85, 105, 0.58)';
      let topColor = 'rgba(100, 116, 139, 0.42)';
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        drawGuideLine({ x: p1.x, y: p1.y, z: 0 }, { x: p2.x, y: p2.y, z: 0 }, guideColor, 1.2);
        drawGuideLine({ x: p1.x, y: p1.y, z: slabZ }, { x: p2.x, y: p2.y, z: slabZ }, topColor, 1);
        drawGuideLine({ x: p1.x, y: p1.y, z: 0 }, { x: p1.x, y: p1.y, z: slabZ }, guideColor, 0.8);
      }

      // Một đường sàn chéo rất nhạt giúp đọc chiều sâu mà không cạnh tranh với khung.
      let floorCenter = {
        x: (res.xmin + res.xmax) / 2,
        y: (res.ymin + res.ymax) / 2,
        z: 0
      };
      let floorSpan = Math.min(res.xmax - res.xmin, res.ymax - res.ymin) * 0.18;
      drawGuideLine(
        { x: floorCenter.x - floorSpan, y: floorCenter.y, z: 0 },
        { x: floorCenter.x + floorSpan, y: floorCenter.y, z: 0 },
        'rgba(51, 65, 85, 0.32)', 0.7
      );
    }

    function solidBeam3D(p1, p2, z0, z1, beamWidth, color) {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      let len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len * beamWidth / 2;
      let ny = dx / len * beamWidth / 2;
      let corners = [
        { x: p1.x + nx, y: p1.y + ny, z: z0 },
        { x: p2.x + nx, y: p2.y + ny, z: z0 },
        { x: p2.x - nx, y: p2.y - ny, z: z0 },
        { x: p1.x - nx, y: p1.y - ny, z: z0 },
        { x: p1.x + nx, y: p1.y + ny, z: z1 },
        { x: p2.x + nx, y: p2.y + ny, z: z1 },
        { x: p2.x - nx, y: p2.y - ny, z: z1 },
        { x: p1.x - nx, y: p1.y - ny, z: z1 }
      ];
      let faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
      faces.forEach((face, index) => {
        let projected = face.map(i => project3D(corners[i].x, corners[i].y, corners[i].z));
        c3d.beginPath();
        c3d.moveTo(projected[0].x, projected[0].y);
        projected.slice(1).forEach(point => c3d.lineTo(point.x, point.y));
        c3d.closePath();
        c3d.fillStyle = index === 1 ? color : (index === 2 || index === 5 ? 'rgba(148, 163, 184, 0.82)' : 'rgba(30, 41, 59, 0.95)');
        c3d.strokeStyle = color;
        c3d.lineWidth = 1;
        c3d.fill();
        c3d.stroke();
      });
    }

    function solidTBeam3D(p1, p2, baseZ, unit, color) {
      // Tiết diện chữ T: bụng đứng + cánh ngang ở cao độ tấm.
      solidBeam3D(p1, p2, baseZ, baseZ + 42 * unit, 34 * unit, color);
      solidBeam3D(p1, p2, baseZ + 42 * unit, baseZ + 62 * unit, 58 * unit, color);
    }

    function drawLockTab3D(point, horizontal, direction, baseZ, unit, color) {
      let tabLength = 64 * unit;
      let tabWidth = 20 * unit;
      let p1 = { x: point.x, y: point.y };
      let p2 = horizontal
        ? { x: point.x + direction * tabLength, y: point.y }
        : { x: point.x, y: point.y + direction * tabLength };
      solidBeam3D(p1, p2, baseZ + 62 * unit, baseZ + 78 * unit, tabWidth, color);
    }

    function trimBeamEnds(p1, p2, trim) {
      let dx = p2.x - p1.x;
      let dy = p2.y - p1.y;
      let length = Math.hypot(dx, dy) || 1;
      let ux = dx / length;
      let uy = dy / length;
      return [
        { x: p1.x + ux * trim, y: p1.y + uy * trim },
        { x: p2.x - ux * trim, y: p2.y - uy * trim }
      ];
    }

    function drawMainPieces(segment, horizontal, baseZ, color) {
      let maxPiece = 3600 * unit;
      let dx = segment[1] - segment[0];
      let dy = segment[3] - segment[2];
      let length = Math.hypot(dx, dy);
      let distance = 0;
      let part = 0;
      while (distance < length - 1e-6) {
        let nextDistance = Math.min(distance + maxPiece, length);
        let t0 = distance / length;
        let t1 = nextDistance / length;
        let p1 = { x: segment[0] + dx * t0, y: segment[2] + dy * t0 };
        let p2 = { x: segment[0] + dx * t1, y: segment[2] + dy * t1 };
        solidTBeam3D(p1, p2, baseZ, unit, color);
        if (part > 0) drawLockTab3D(p1, horizontal, -1, baseZ, unit, '#991b1b');
        distance = nextDistance;
        part++;
      }
      drawLockTab3D({ x: segment[0], y: segment[2] }, horizontal, -1, baseZ, unit, '#991b1b');
      drawLockTab3D({ x: segment[1], y: segment[3] }, horizontal, 1, baseZ, unit, '#991b1b');
    }

    function drawSolidCeilingFrame() {
      let frameBaseZ = ceilZ - 58 * unit;
      let roomStructuralLines = typeof entities !== 'undefined'
        ? entities.filter(entity => entity.roomId === res.roomId && entity.type === 'LINE' && /^0[2-5]_/.test(entity.layer || ''))
        : [];
      let linesForLayer = layerPrefix => roomStructuralLines.filter(entity => (entity.layer || '').startsWith(layerPrefix));
      let drawMain = (positions, horizontal, color) => {
        let mainLines = linesForLayer('03_');
        if (mainLines.length > 0) {
          mainLines.forEach(line => {
            let p1 = { x: line.p1[0], y: line.p1[1] }, p2 = { x: line.p2[0], y: line.p2[1] };
            drawMainPieces([p1.x, p2.x, p1.y, p2.y], horizontal, frameBaseZ, color);
          });
          return;
        }
        (positions || []).forEach(position => {
          let segments = horizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
          segments.forEach(segment => drawMainPieces(horizontal ? [segment[0], segment[1], position, position] : [position, position, segment[0], segment[1]], horizontal, frameBaseZ, color));
        });
      };

      let drawBoundedGrid = (positions, horizontal, boundaries, color, layerPrefix) => {
        let jointClearance = 32 * unit;
        let sourceLines = linesForLayer(layerPrefix);
        let sourceSegments = sourceLines.length > 0
          ? sourceLines.map(line => [line.p1[0], line.p2[0], line.p1[1], line.p2[1]])
          : null;
        let positionsOrSegments = sourceSegments || (positions || []).flatMap(position => {
          let segments = horizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
          return segments.map(segment => horizontal ? [segment[0], segment[1], position, position] : [position, position, segment[0], segment[1]]);
        });
        positionsOrSegments.forEach(data => {
          let position = horizontal ? data[2] : data[0];
          for (let i = 0; i < boundaries.length - 1; i++) {
            let a = boundaries[i], b = boundaries[i + 1];
            if (horizontal) {
              let x0 = Math.max(data[0], a), x1 = Math.min(data[1], b);
              if (x1 - x0 > jointClearance * 2) {
                let trimmed = trimBeamEnds({ x: x0, y: position }, { x: x1, y: position }, jointClearance);
                solidTBeam3D(trimmed[0], trimmed[1], frameBaseZ, unit, color);
                drawLockTab3D(trimmed[0], true, -1, frameBaseZ, unit, '#854d0e');
                drawLockTab3D(trimmed[1], true, 1, frameBaseZ, unit, '#854d0e');
              }
            } else {
              let y0 = Math.max(data[2], a), y1 = Math.min(data[3], b);
              if (y1 - y0 > jointClearance * 2) {
                let trimmed = trimBeamEnds({ x: position, y: y0 }, { x: position, y: y1 }, jointClearance);
                solidTBeam3D(trimmed[0], trimmed[1], frameBaseZ, unit, color);
                drawLockTab3D(trimmed[0], false, -1, frameBaseZ, unit, '#854d0e');
                drawLockTab3D(trimmed[1], false, 1, frameBaseZ, unit, '#854d0e');
              }
            }
          }
        });
      };

      drawMain(res.main_lines, res.isMainHorizontal, '#dc2626');
      // Cross-T 0.6 m chạy song song Main-T, kết thúc tại các trục Cross-T 1.2 m.
      let crossAxes = (res.isMainHorizontal ? res.all_x : res.all_y).slice().sort((a, b) => a - b);
      let expectedCross6 = (res.isMainHorizontal ? res.all_y : res.all_x)
        .slice(1, -1)
        .filter((position, index) => index % 2 === 1);
      let cross6Positions = [...(res.cross6_lines || []), ...expectedCross6]
        .sort((a, b) => a - b)
        .filter((position, index, values) => index === 0 || Math.abs(position - values[index - 1]) > 1e-6);
      drawBoundedGrid(cross6Positions, res.isMainHorizontal, crossAxes, '#16a34a', '05_');
      // Cross-T 1.2 m vuông góc Main-T, chỉ chạy giữa hai trục Main-T kế tiếp.
      let mainAxes = res.isMainHorizontal
        ? [res.ymin, ...(res.main_lines || []), res.ymax]
        : [res.xmin, ...(res.main_lines || []), res.xmax];
      mainAxes = mainAxes.slice().sort((a, b) => a - b).filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 1e-6);
      drawBoundedGrid(res.cross_lines, !res.isMainHorizontal, mainAxes, '#ca8a04', '04_');

      // V viền tường: thanh biên liên tục cùng cao độ với cánh T.
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        solidBeam3D(p1, p2, frameBaseZ + 24 * unit, frameBaseZ + 72 * unit, 42 * unit, '#0ea5e9');
      }
      linesForLayer('02_').forEach(line => {
        solidBeam3D(
          { x: line.p1[0], y: line.p1[1] },
          { x: line.p2[0], y: line.p2[1] },
          frameBaseZ + 24 * unit,
          frameBaseZ + 72 * unit,
          42 * unit,
          '#0ea5e9'
        );
      });

      // Ty treo chỉ đặt trên Main-T, không đặt trên thanh phụ.
      let hangerStep = res.isMeter ? 1.2 : 1200;
      let hangerOffset = res.isMeter ? 0.35 : 350;
      let hangerTopZ = slabZ - 25 * unit;
      res.main_lines.forEach(position => {
        let segments = res.isMainHorizontal ? getHSegments(res.polyPts, position, res.isMeter) : getVSegments(res.polyPts, position, res.isMeter);
        segments.forEach(segment => {
          for (let hanger = segment[0] + hangerOffset; hanger < segment[1] - hangerOffset; hanger += hangerStep) {
            let point = res.isMainHorizontal ? { x: hanger, y: position } : { x: position, y: hanger };
            let rodSize = 14 * unit;
            solidBeam3D(
              { x: point.x, y: point.y },
              { x: point.x, y: point.y },
              ceilZ + 55 * unit,
              hangerTopZ,
              rodSize,
              '#b91c1c'
            );
          }
        });
      });
    }

    // Chế độ rút gọn: chỉ hiển thị hệ khung T 3D.
    drawRoomGuides();
    drawSolidCeilingFrame();
  }

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  cvs.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let dx = e.clientX - dragStart.x;
    let dy = e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };

    if (e.buttons === 1) {
      yaw += dx * 0.008;
      pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch - dy * 0.008));
    } else if (e.buttons === 2) {
      pan3dX += dx;
      pan3dY += dy;
    }
  });

  window.addEventListener('mouseup', () => isDragging = false);

  cvs.addEventListener('wheel', (e) => {
    e.preventDefault();
    let factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.max(0.01, Math.min(2.0, scale * factor));
  }, { passive: false });

  // Phím tắt bàn phím: Mũi tên Trái / Phải để chuyển phòng nhanh
  function handle3DKeyDown(e) {
    if (!document.getElementById('tt600-3d-modal')) {
      window.removeEventListener('keydown', handle3DKeyDown);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === '[') {
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

    return {
      x: cvs.width / 2 + x_rot * scale + pan3dX,
      y: cvs.height / 2 + z_iso * scale + pan3dY
    };
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
    let showWalls = document.getElementById('iso-chk-walls')?.checked;

    if (!res || !res.polyPts) {
      requestAnimationFrame(renderLoop);
      return;
    }

    let ceilZ = 2600 * (res.isMeter ? 0.001 : 1);
    let slabZ = 3200 * (res.isMeter ? 0.001 : 1);

    if (sceneMode === 'technical') {
    // Thanh Viền Tường Shadow-V
    if (showWallV && res.polyPts.length >= 3) {
      c3d.strokeStyle = '#38bdf8';
      c3d.lineWidth = 3.5;
      c3d.beginPath();
      let p0 = project3D(res.polyPts[0].x, res.polyPts[0].y, ceilZ);
      c3d.moveTo(p0.x, p0.y);
      for (let i = 1; i < res.polyPts.length; i++) {
        let pi = project3D(res.polyPts[i].x, res.polyPts[i].y, ceilZ);
        c3d.lineTo(pi.x, pi.y);
      }
      c3d.closePath();
      c3d.stroke();
    }

    // Sàn Bê tông
    if (showHangers && res.polyPts.length >= 3) {
      c3d.fillStyle = 'rgba(51, 65, 85, 0.4)';
      c3d.strokeStyle = '#64748b';
      c3d.lineWidth = 1;
      c3d.beginPath();
      let p0 = project3D(res.polyPts[0].x, res.polyPts[0].y, slabZ);
      c3d.moveTo(p0.x, p0.y);
      for (let i = 1; i < res.polyPts.length; i++) {
        let pi = project3D(res.polyPts[i].x, res.polyPts[i].y, slabZ);
        c3d.lineTo(pi.x, pi.y);
      }
      c3d.closePath();
      c3d.fill();
      c3d.stroke();
    }

    // Tường bao
    if (showWalls && res.polyPts.length >= 3) {
      c3d.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      c3d.lineWidth = 1.2;
      for (let i = 0, j = res.polyPts.length - 1; i < res.polyPts.length; j = i++) {
        let p1 = res.polyPts[j], p2 = res.polyPts[i];
        let b1 = project3D(p1.x, p1.y, 0), b2 = project3D(p2.x, p2.y, 0);
        let t1 = project3D(p1.x, p1.y, slabZ), t2 = project3D(p2.x, p2.y, slabZ);

        c3d.fillStyle = 'rgba(15, 23, 42, 0.25)';
        c3d.beginPath();
        c3d.moveTo(b1.x, b1.y); c3d.lineTo(b2.x, b2.y);
        c3d.lineTo(t2.x, t2.y); c3d.lineTo(t1.x, t1.y);
        c3d.closePath();
        c3d.fill();
        c3d.stroke();
      }
    }

    // Tấm trần 3D
    if (showTiles && res.tiles3d) {
      res.tiles3d.forEach(tile => {
        if (tile.pts && tile.pts.length >= 3) {
          c3d.fillStyle = tile.isFull ? 'rgba(6, 182, 212, 0.25)' : 'rgba(217, 70, 239, 0.35)';
          c3d.strokeStyle = tile.isFull ? '#06b6d4' : '#d946ef';
          c3d.lineWidth = tile.isFull ? 1 : 1.4;

          c3d.beginPath();
          let p0 = project3D(tile.pts[0].x, tile.pts[0].y, ceilZ);
          c3d.moveTo(p0.x, p0.y);
          for (let k = 1; k < tile.pts.length; k++) {
            let pk = project3D(tile.pts[k].x, tile.pts[k].y, ceilZ);
            c3d.lineTo(pk.x, pk.y);
          }
          c3d.closePath();
          c3d.fill();
          c3d.stroke();
        }
      });
    }

    // Thanh Phụ Cross-T 0.6m (XANH LÁ)
    if (showCross6 && res.cross6_lines) {
      c3d.strokeStyle = '#22c55e';
      c3d.lineWidth = 1.5;
      res.cross6_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getHSegments(res.polyPts, pos, res.isMeter) : getVSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          let p1 = res.isMainHorizontal ? project3D(s[0], pos, ceilZ) : project3D(pos, s[0], ceilZ);
          let p2 = res.isMainHorizontal ? project3D(s[1], pos, ceilZ) : project3D(pos, s[1], ceilZ);
          c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
        });
      });
    }

    // Thanh Phụ Cross-T 1.2m (VÀNG)
    if (showCross && res.cross_lines) {
      c3d.strokeStyle = '#eab308';
      c3d.lineWidth = 2.2;
      res.cross_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getVSegments(res.polyPts, pos, res.isMeter) : getHSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          let p1 = res.isMainHorizontal ? project3D(pos, s[0], ceilZ) : project3D(s[0], pos, ceilZ);
          let p2 = res.isMainHorizontal ? project3D(pos, s[1], ceilZ) : project3D(s[1], pos, ceilZ);
          c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
        });
      });
    }

    // Thanh Chính Main-T 3.6m (ĐỎ) & Ty Treo M8
    if ((showMain || showHangers) && res.main_lines) {
      res.main_lines.forEach(pos => {
        let segs = res.isMainHorizontal ? getHSegments(res.polyPts, pos, res.isMeter) : getVSegments(res.polyPts, pos, res.isMeter);
        segs.forEach(s => {
          if (showMain) {
            c3d.strokeStyle = '#ef4444';
            c3d.lineWidth = 3.2;
            let p1 = res.isMainHorizontal ? project3D(s[0], pos, ceilZ) : project3D(pos, s[0], ceilZ);
            let p2 = res.isMainHorizontal ? project3D(s[1], pos, ceilZ) : project3D(pos, s[1], ceilZ);
            c3d.beginPath(); c3d.moveTo(p1.x, p1.y); c3d.lineTo(p2.x, p2.y); c3d.stroke();
          }

          if (showHangers) {
            let firstOffset = res.isMeter ? 0.35 : 350;
            for (let hp = s[0] + firstOffset; hp < s[1] - (res.isMeter ? 0.2 : 200); hp += res.mainCad) {
              let checkPt = res.isMainHorizontal ? { x: hp, y: pos } : { x: pos, y: hp };
              if (isPointInPoly(checkPt, res.polyPts)) {
                let bot = project3D(checkPt.x, checkPt.y, ceilZ);
                let top = project3D(checkPt.x, checkPt.y, slabZ);

                c3d.strokeStyle = '#ef4444';
                c3d.lineWidth = 1.6;
                c3d.beginPath(); c3d.moveTo(bot.x, bot.y); c3d.lineTo(top.x, top.y); c3d.stroke();

                c3d.fillStyle = '#ef4444';
                c3d.beginPath(); c3d.arc(bot.x, bot.y, 4, 0, Math.PI * 2); c3d.fill();
                c3d.beginPath(); c3d.arc(top.x, top.y, 3, 0, Math.PI * 2); c3d.fill();
              }
            }
          }
        });
      });
    }

    }

    if (sceneMode === 'construction') drawConstructionScene();

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

    // Kiểm tra nếu người dùng ĐÃ quét chọn nét phòng từ trước (chuẩn Noun-Verb)
    if (typeof selectedIds !== 'undefined' && selectedIds && selectedIds.size > 0) {
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_'));
      let detected = findEnclosingPolygonFromEntities(selEnts, null);
      if (detected && detected.length >= 3) {
        window.tt600State.polyPts = detected;
        window.executeTT600FromSelectionOrCanvas();
        return;
      }
    }

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
      let selEnts = entities.filter(e => selectedIds.has(e.id) && e.layer !== 'BOM_TABLE' && !e.id.startsWith('tt_'));
      if (selEnts.length > 0) {
        poly = findEnclosingPolygonFromEntities(selEnts, null);
      }
    }

    if (!poly && window.tt600State.polyPts && window.tt600State.polyPts.length >= 3) {
      poly = window.tt600State.polyPts;
    }

    if (!poly && typeof mouseWorld !== 'undefined' && mouseWorld) {
      poly = findEnclosingPolygon(mouseWorld);
    }

    if (poly && poly.length >= 3) {
      window.tt600State.polyPts = poly;
      window.tt600State.step = 2; // Chuyển sang Bước 2: Chọn 2 Cạnh Mặt Tiền
      window.tt600State.facadePickCount = 0;
      if (typeof setTaskContext === 'function') setTaskContext('TT600', 2, 'SELECT_2_FACADE_EDGES', { vertexCount: poly.length });

      // Tự động tìm Cạnh Đáy và Cạnh Trái làm mốc mặc định ban đầu
      let pts = poly;
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
      let leftEdge = vertEdges.reduce((prev, curr) => (!prev || curr.mid.x < prev.mid.x) ? curr : prev, vertEdges[0] || edges[0]);

      window.tt600State.edge1 = bottomEdge;
      window.tt600State.edge2 = leftEdge;

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
      let detected = findEnclosingPolygon(pt);
      if (detected && detected.length >= 3) {
        window.tt600State.polyPts = detected;
        window.executeTT600FromSelectionOrCanvas();
        return;
      }
      if (typeof setInfo === 'function') {
        setInfo("💡 Hãy quét chọn các nét của căn phòng rồi nhấn ENTER để tiếp tục.");
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
            setInfo(`🏷️ Đã chọn CẠNH 1 (Mặt tiền chính: ${lenMm.toFixed(0)}mm). Hãy nhấp tiếp CẠNH 2 (Mặt tiền phụ) hoặc nhấn ENTER để tính toán.`);
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
  window.c_TT3D = function() {
    if (typeof window.openTT6003DModal === 'function') window.openTT6003DModal();
  };
  window.c_TTSEC = function() {
    if (typeof window.openTT600SectionModal === 'function') window.openTT600SectionModal();
  };
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

  if (typeof selectTool === 'function') {
    selectTool('TT600');
  }
})();
