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
