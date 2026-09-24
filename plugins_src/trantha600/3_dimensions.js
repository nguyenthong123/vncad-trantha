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
