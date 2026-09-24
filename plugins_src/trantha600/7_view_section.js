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
