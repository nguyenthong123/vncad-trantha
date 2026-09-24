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
