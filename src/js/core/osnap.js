// ===============================================================================
//     HIGH-PRECISION AUTOCAD OSNAP ENGINE, SPATIAL PRUNING & HIT TESTING
//     Hỗ trợ bắt điểm chuẩn xác: Endpoint, Midpoint, Center, Intersection,
//     Quadrant, Perpendicular, Nearest và Tối ưu hóa bản vẽ nhiều chi tiết lớn
// ===============================================================================

// Helper: Phép tính giao điểm chính xác giữa 2 đoạn thẳng
function getSegmentIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-8) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= -0.001 && t <= 1.001 && u >= -0.001 && u <= 1.001) {
    const clampT = Math.max(0, Math.min(1, t));
    return {
      x: x1 + clampT * (x2 - x1),
      y: y1 + clampT * (y2 - y1)
    };
  }
  return null;
}

// Trích xuất các đoạn thẳng (segments) từ 1 đối tượng để tính giao điểm và bắt điểm
function extractEntitySegments(e) {
  const segs = [];
  if (!e) return segs;

  if ((e.type === 'LINE' || e.type === 'DIMENSION') && e.p1 && e.p2) {
    segs.push({ p1: { x: e.p1[0], y: e.p1[1] }, p2: { x: e.p2[0], y: e.p2[1] }, entity: e });
  } else if (e.type === 'RECTANGLE' && e.x !== undefined && e.w !== undefined) {
    const p1 = { x: e.x, y: e.y }, p2 = { x: e.x + e.w, y: e.y };
    const p3 = { x: e.x + e.w, y: e.y + e.h }, p4 = { x: e.x, y: e.y + e.h };
    segs.push({ p1, p2, entity: e }, { p1: p2, p2: p3, entity: e }, { p1: p3, p2: p4, entity: e }, { p1: p4, p2: p1, entity: e });
  } else if ((e.type === 'POLYLINE' || e.type === 'POLYGON') && (e.points || e.pts)) {
    const pts = (e.points || e.pts).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({ p1: pts[i], p2: pts[i + 1], entity: e });
    }
    if (e.closed || e.type === 'POLYGON') {
      if (pts.length > 2) segs.push({ p1: pts[pts.length - 1], p2: pts[0], entity: e });
    }
  }
  return segs;
}

// Bắt điểm thông minh đa điểm chuẩn xác (OSNAP Multi-Candidate Engine)
function findSnapPoint(wPt, customAperturePx = null) {
  const aperturePx = customAperturePx || (typeof touchState !== 'undefined' && touchState && touchState.active ? 34 : 22);
  const snapThresholdWorld = aperturePx / zoom;
  const candidates = [];

  // Bounding box quét nhanh khu vực trỏ chuột
  const qMinX = wPt.x - snapThresholdWorld * 1.5;
  const qMaxX = wPt.x + snapThresholdWorld * 1.5;
  const qMinY = wPt.y - snapThresholdWorld * 1.5;
  const qMaxY = wPt.y + snapThresholdWorld * 1.5;

  const nearbyEntities = [];
  const nearbySegments = [];

  // 1. Lọc nhanh các đối tượng gần vùng trỏ chuột
  for (let e of entities) {
    const bb = getEntityBoundingBox(e);
    if (!bb) continue;
    if (bb.maxX < qMinX || bb.minX > qMaxX || bb.maxY < qMinY || bb.minY > qMaxY) {
      continue;
    }
    nearbyEntities.push(e);
    const segs = extractEntitySegments(e);
    for (let s of segs) nearbySegments.push(s);
  }

  // 2. Thu thập các điểm hình học chuẩn: ENDPOINT, MIDPOINT, CENTER, QUADRANT
  for (let e of nearbyEntities) {
    if (e.type === 'LINE' || e.type === 'DIMENSION') {
      if (e.p1 && e.p2) {
        const p1 = { x: e.p1[0], y: e.p1[1] };
        const p2 = { x: e.p2[0], y: e.p2[1] };
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        candidates.push({ x: p1.x, y: p1.y, type: 'ENDPOINT', desc: 'Điểm mút (Endpoint)', weight: 0.90, entityId: e.id });
        candidates.push({ x: p2.x, y: p2.y, type: 'ENDPOINT', desc: 'Điểm mút (Endpoint)', weight: 0.90, entityId: e.id });
        candidates.push({ x: mid.x, y: mid.y, type: 'MIDPOINT', desc: 'Trung điểm (Midpoint)', weight: 1.00, entityId: e.id });
      }
    } else if (e.type === 'RECTANGLE') {
      const corners = [
        { x: e.x, y: e.y },
        { x: e.x + e.w, y: e.y },
        { x: e.x + e.w, y: e.y + e.h },
        { x: e.x, y: e.y + e.h }
      ];
      for (let c of corners) {
        candidates.push({ x: c.x, y: c.y, type: 'ENDPOINT', desc: 'Góc hộp (Corner)', weight: 0.90, entityId: e.id });
      }
      // 4 Edge Midpoints
      candidates.push({ x: e.x + e.w / 2, y: e.y, type: 'MIDPOINT', desc: 'Trung điểm mép', weight: 1.00, entityId: e.id });
      candidates.push({ x: e.x + e.w, y: e.y + e.h / 2, type: 'MIDPOINT', desc: 'Trung điểm mép', weight: 1.00, entityId: e.id });
      candidates.push({ x: e.x + e.w / 2, y: e.y + e.h, type: 'MIDPOINT', desc: 'Trung điểm mép', weight: 1.00, entityId: e.id });
      candidates.push({ x: e.x, y: e.y + e.h / 2, type: 'MIDPOINT', desc: 'Trung điểm mép', weight: 1.00, entityId: e.id });
      // Center
      candidates.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, type: 'CENTER', desc: 'Tâm hình (Center)', weight: 0.95, entityId: e.id });
    } else if (e.type === 'CIRCLE') {
      const cx = e.cx, cy = e.cy, r = e.r || 50;
      candidates.push({ x: cx, y: cy, type: 'CENTER', desc: 'Tâm đường tròn (Center)', weight: 0.95, entityId: e.id });
      candidates.push({ x: cx + r, y: cy, type: 'QUADRANT', desc: 'Góc 1/4 (0° Quadrant)', weight: 1.05, entityId: e.id });
      candidates.push({ x: cx, y: cy + r, type: 'QUADRANT', desc: 'Góc 1/4 (90° Quadrant)', weight: 1.05, entityId: e.id });
      candidates.push({ x: cx - r, y: cy, type: 'QUADRANT', desc: 'Góc 1/4 (180° Quadrant)', weight: 1.05, entityId: e.id });
      candidates.push({ x: cx, y: cy - r, type: 'QUADRANT', desc: 'Góc 1/4 (270° Quadrant)', weight: 1.05, entityId: e.id });
    } else if (e.type === 'ARC') {
      if (e.cx !== undefined && e.cy !== undefined) {
        candidates.push({ x: e.cx, y: e.cy, type: 'CENTER', desc: 'Tâm cung tròn (Arc Center)', weight: 0.95, entityId: e.id });
      }
      if (e.p1 && e.p2) {
        candidates.push({ x: e.p1[0], y: e.p1[1], type: 'ENDPOINT', desc: 'Đầu cung tròn', weight: 0.90, entityId: e.id });
        candidates.push({ x: e.p2[0], y: e.p2[1], type: 'ENDPOINT', desc: 'Cuối cung tròn', weight: 0.90, entityId: e.id });
      }
      if (e.mid) {
        candidates.push({ x: e.mid[0], y: e.mid[1], type: 'MIDPOINT', desc: 'Đỉnh giữa cung', weight: 1.00, entityId: e.id });
      }
    } else if (e.type === 'POLYLINE' || e.type === 'POLYGON') {
      const pts = (e.points || e.pts || []).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      for (let p of pts) {
        candidates.push({ x: p.x, y: p.y, type: 'ENDPOINT', desc: 'Đỉnh đa giác (Vertex)', weight: 0.90, entityId: e.id });
      }
      for (let i = 0; i < pts.length - 1; i++) {
        candidates.push({ x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2, type: 'MIDPOINT', desc: 'Trung điểm đoạn', weight: 1.00, entityId: e.id });
      }
      if (e.type === 'POLYGON' && pts.length > 2) {
        let sumX = 0, sumY = 0;
        for (let p of pts) { sumX += p.x; sumY += p.y; }
        candidates.push({ x: sumX / pts.length, y: sumY / pts.length, type: 'CENTER', desc: 'Tâm đa giác', weight: 0.95, entityId: e.id });
      }
    } else if (e.type === 'TEXT') {
      candidates.push({ x: e.x, y: e.y, type: 'ENDPOINT', desc: 'Điểm chèn Text (Insert Point)', weight: 0.95, entityId: e.id });
    }
  }

  // 3. Tính toán Giao điểm chính xác giữa các đoạn thẳng cắt nhau (INTERSECTION)
  for (let i = 0; i < nearbySegments.length; i++) {
    for (let j = i + 1; j < nearbySegments.length; j++) {
      const s1 = nearbySegments[i], s2 = nearbySegments[j];
      if (s1.entity && s2.entity && s1.entity.id === s2.entity.id && (s1.entity.type === 'LINE')) continue;
      const inter = getSegmentIntersection(s1.p1, s1.p2, s2.p1, s2.p2);
      if (inter) {
        candidates.push({
          x: inter.x,
          y: inter.y,
          type: 'INTERSECTION',
          desc: 'Giao điểm (Intersection)',
          weight: 0.85,
          entityId: `${s1.entity?.id || ''}_${s2.entity?.id || ''}`
        });
      }
    }
  }

  // 4. Tính điểm vuông góc (PERPENDICULAR) khi đang vẽ từ điểm gốc
  if (isDrawing && startPoint) {
    for (let s of nearbySegments) {
      const l2 = (s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2;
      if (l2 > 0) {
        let t = ((startPoint.x - s.p1.x) * (s.p2.x - s.p1.x) + (startPoint.y - s.p1.y) * (s.p2.y - s.p1.y)) / l2;
        if (t >= 0 && t <= 1) {
          const perpX = s.p1.x + t * (s.p2.x - s.p1.x);
          const perpY = s.p1.y + t * (s.p2.y - s.p1.y);
          candidates.push({
            x: perpX,
            y: perpY,
            type: 'PERPENDICULAR',
            desc: 'Vuông góc (Perpendicular)',
            weight: 1.10,
            entityId: s.entity?.id
          });
        }
      }
    }
  }

  // 5. Tìm ứng viên tốt nhất dựa trên khoảng cách và hệ số ưu tiên (Ranked Matching)
  let bestCandidate = null;
  let bestScore = snapThresholdWorld;

  for (let c of candidates) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    const d = Math.hypot(c.x - wPt.x, c.y - wPt.y);
    if (d <= snapThresholdWorld) {
      const score = d * (c.weight || 1.0);
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = { x: c.x, y: c.y, type: c.type, desc: c.desc, entityId: c.entityId };
      }
    }
  }

  // 6. Nếu không có điểm đặc biệt, kiểm tra điểm nằm trực tiếp trên nét (NEAREST)
  if (!bestCandidate) {
    let nearestSegPt = null;
    let minSegD = snapThresholdWorld * 0.75;
    for (let s of nearbySegments) {
      const l2 = (s.p2.x - s.p1.x) ** 2 + (s.p2.y - s.p1.y) ** 2;
      if (l2 === 0) continue;
      let t = ((wPt.x - s.p1.x) * (s.p2.x - s.p1.x) + (wPt.y - s.p1.y) * (s.p2.y - s.p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const px = s.p1.x + t * (s.p2.x - s.p1.x);
      const py = s.p1.y + t * (s.p2.y - s.p1.y);
      const d = Math.hypot(px - wPt.x, py - wPt.y);
      if (d < minSegD) {
        minSegD = d;
        nearestSegPt = { x: px, y: py, type: 'NEAREST', desc: 'Trên đoạn thẳng (Nearest)', entityId: s.entity?.id };
      }
    }
    if (nearestSegPt) {
      bestCandidate = nearestSegPt;
    }
  }

  // Cập nhật trạng thái bắt điểm toàn cục
  activeSnapPoint = bestCandidate ? { ...bestCandidate } : null;
  return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null;
}

// Khóa hướng trực giao 90° (ORTHO F8)
function applyOrthoPoint(start, target) {
  if (!orthoMode || !start) return target;
  let dx = Math.abs(target.x - start.x);
  let dy = Math.abs(target.y - start.y);
  if (dx >= dy) return { x: target.x, y: start.y };
  else return { x: start.x, y: target.y };
}

// Tính khoảng cách chạm tới đối tượng có tính phân tầng ưu tiên (Hit Testing with Layer Priority)
function getHitDistance(pt, e) {
  if (!e) return Infinity;
  let baseDist = Infinity;

  if (e.type === 'LINE' || e.type === 'DIMENSION') {
    if (!e.p1 || !e.p2) return Infinity;
    baseDist = distToSegment(pt, { x: e.p1[0], y: e.p1[1] }, { x: e.p2[0], y: e.p2[1] });
  } else if (e.type === 'RECTANGLE') {
    let p1 = { x: e.x, y: e.y }, p2 = { x: e.x + e.w, y: e.y };
    let p3 = { x: e.x + e.w, y: e.y + e.h }, p4 = { x: e.x, y: e.y + e.h };
    let d1 = distToSegment(pt, p1, p2);
    let d2 = distToSegment(pt, p2, p3);
    let d3 = distToSegment(pt, p3, p4);
    let d4 = distToSegment(pt, p4, p1);
    let edgeDist = Math.min(d1, d2, d3, d4);
    if ((e.fillColor && e.fillColor !== 'transparent' || e.isHatched) && pt.x >= e.x && pt.x <= e.x + e.w && pt.y >= e.y && pt.y <= e.y + e.h) {
      // Nhấp trong lòng Hatch có độ ưu tiên thấp hơn nhấp trực tiếp vào cạnh
      return edgeDist < 12 / zoom ? edgeDist : edgeDist + 8 / zoom;
    }
    baseDist = edgeDist;
  } else if (e.type === 'CIRCLE') {
    let d = Math.hypot(pt.x - e.cx, pt.y - e.cy);
    if (e.fillColor && e.fillColor !== 'transparent' && d <= e.r) return d;
    baseDist = Math.abs(d - e.r);
  } else if (e.type === 'ELLIPSE') {
    let d = Math.hypot(pt.x - e.cx, pt.y - e.cy);
    baseDist = Math.abs(d - (e.rx || 100));
  } else if (e.type === 'POLYGON' || e.type === 'POLYLINE') {
    let pts = (e.points || e.pts || []).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
    if (pts.length < 2) return Infinity;
    let minEdgeD = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      let ed = distToSegment(pt, pts[j], pts[i]);
      if (ed < minEdgeD) minEdgeD = ed;
    }
    if ((e.closed || e.type === 'POLYGON') && isPointInPoly(pt, pts)) {
      return minEdgeD < 12 / zoom ? minEdgeD : minEdgeD + 8 / zoom;
    }
    baseDist = minEdgeD;
  } else if (e.type === 'TEXT') {
    let bb = getEntityBoundingBox(e);
    if (bb && pt.x >= bb.minX && pt.x <= bb.maxX && pt.y >= bb.minY && pt.y <= bb.maxY) return 0;
    baseDist = Math.hypot(pt.x - e.x, pt.y - e.y);
  }

  return baseDist;
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
  if (!e) return null;
  if (e.p1 && e.p2) {
    let minX = Math.min(e.p1[0], e.p2[0]), maxX = Math.max(e.p1[0], e.p2[0]);
    let minY = Math.min(e.p1[1], e.p2[1]), maxY = Math.max(e.p1[1], e.p2[1]);
    if (e.type === 'DIMENSION') {
      let off = Math.abs(e.offset || 350);
      return { minX: minX - off, maxX: maxX + off, minY: minY - off, maxY: maxY + off };
    }
    return { minX, maxX, minY, maxY };
  }
  if (e.x !== undefined && e.w !== undefined) {
    return { minX: Math.min(e.x, e.x + e.w), maxX: Math.max(e.x, e.x + e.w), minY: Math.min(e.y, e.y + (e.h || 0)), maxY: Math.max(e.y, e.y + (e.h || 0)) };
  }
  if (e.cx !== undefined) {
    let rx = e.rx || e.r || 50;
    let ry = e.ry || e.r || 50;
    return { minX: e.cx - rx, maxX: e.cx + rx, minY: e.cy - ry, maxY: e.cy + ry };
  }
  if (e.points || e.pts) {
    let pts = e.points || e.pts;
    let xs = pts.map(p => p[0] !== undefined ? p[0] : p.x);
    let ys = pts.map(p => p[1] !== undefined ? p[1] : p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  if (e.type === 'TEXT' || (e.x !== undefined && e.y !== undefined)) {
    let size = Math.max(e.size || 140, 20);
    let strLen = e.text ? String(e.text).length : 4;
    let w = strLen * size * 0.65;
    let h = size * 1.2;
    let minX = e.align === 'center' ? e.x - w / 2 : (e.align === 'right' ? e.x - w : e.x);
    let maxX = minX + w;
    let minY = e.y - h / 2;
    let maxY = e.y + h / 2;
    return { minX, maxX, minY, maxY };
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
  if ((p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) ||
      (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY)) {
    return true;
  }
  const b1 = { x: minX, y: minY }, b2 = { x: maxX, y: minY };
  const b3 = { x: maxX, y: maxY }, b4 = { x: minX, y: maxY };
  return lineSegmentsIntersect(p1, p2, b1, b2) ||
         lineSegmentsIntersect(p1, p2, b2, b3) ||
         lineSegmentsIntersect(p1, p2, b3, b4) ||
         lineSegmentsIntersect(p1, p2, b4, b1);
}

function isEntityInBox(e, minX, maxX, minY, maxY, isCrossing) {
  let bb = getEntityBoundingBox(e);
  if (!bb) return false;

  if (!isCrossing) {
    return bb.minX >= minX && bb.maxX <= maxX && bb.minY >= minY && bb.maxY <= maxY;
  } else {
    if (bb.maxX < minX || bb.minX > maxX || bb.maxY < minY || bb.minY > maxY) {
      return false;
    }
    if (e.type === 'LINE' || e.type === 'DIMENSION') {
      let p1 = { x: e.p1[0], y: e.p1[1] }, p2 = { x: e.p2[0], y: e.p2[1] };
      return lineIntersectsBox(p1, p2, minX, maxX, minY, maxY);
    } else if (e.type === 'RECTANGLE' || e.type === 'TEXT' || e.type === 'CIRCLE' || e.type === 'ARC' || e.type === 'ELLIPSE') {
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


