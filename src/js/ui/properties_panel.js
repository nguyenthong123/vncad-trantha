// AUTOCAD QUICK PROPERTIES PALETTE & COLOR MANAGEMENT
function togglePropertiesPanel(forceState) {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  const shouldShow = forceState !== undefined ? forceState : isHidden;
  if (shouldShow) {
    panel.classList.remove('hidden');
    renderPropertiesPanel(false);
  } else {
    panel.classList.add('hidden');
  }
  const btn = document.getElementById('btn-PROPERTIES');
  if (btn) {
    if (shouldShow) btn.classList.add('active');
    else btn.classList.remove('active');
  }
}

function updateRibbonQuickControls(color, width, lineType, layer) {
  const colPicker = document.getElementById('ribbon-color-picker');
  if (colPicker && color && color.startsWith('#')) colPicker.value = color;

  // Highlight active ribbon swatch
  document.querySelectorAll('.ribbon-swatch').forEach(sw => {
    let onclickAttr = sw.getAttribute('onclick') || '';
    if (color && onclickAttr.toLowerCase().includes(color.toLowerCase())) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });

  const wSel = document.getElementById('ribbon-width-select');
  if (wSel) wSel.value = width || 2;

  const ltSel = document.getElementById('ribbon-linetype-select');
  if (ltSel) ltSel.value = lineType || 'CONTINUOUS';

  const laySel = document.getElementById('ribbon-layer-select');
  if (laySel) laySel.value = layer || '0';
}

function renderPropertiesPanel(autoToggle = true) {
  const panel = document.getElementById('properties-panel');
  const body = document.getElementById('prop-body');
  const title = document.getElementById('prop-title');
  if (!panel || !body || !title) return;

  const selCount = selectedIds.size;
  let pluginTool = (window.cadPluginHooks && window.cadPluginHooks.toolHandlers) ? window.cadPluginHooks.toolHandlers[currentTool] : null;
  let suppressPanel = pluginTool && pluginTool.hidePropertiesPanel;

  // Auto-show when selecting objects in SELECT mode, auto-hide when deselected
  if (autoToggle) {
    if (selCount > 0 && !suppressPanel && (currentTool === 'SELECT' || !currentTool)) {
      panel.classList.remove('hidden');
      const btn = document.getElementById('btn-PROPERTIES');
      if (btn) btn.classList.add('active');
    } else if (selCount === 0 || suppressPanel || (currentTool !== 'SELECT' && currentTool)) {
      panel.classList.add('hidden');
      const btn = document.getElementById('btn-PROPERTIES');
      if (btn) btn.classList.remove('active');
    }
  }

  let singleEnt = null;
  let selectedEntities = [];
  if (selCount > 0) {
    selectedEntities = entities.filter(e => selectedIds.has(e.id));
    if (selCount === 1) singleEnt = selectedEntities[0];
  }

  let curColor = activeProperties.color;
  let curWidth = activeProperties.width;
  let curLineType = activeProperties.lineType;
  let curLayer = activeProperties.layer;
  let curFill = singleEnt ? (singleEnt.fillColor || 'transparent') : activeProperties.fillColor;

  if (selectedEntities.length > 0) {
    let firstCol = selectedEntities[0].color || '#38bdf8';
    if (selectedEntities.every(e => (e.color || '#38bdf8').toLowerCase() === firstCol.toLowerCase())) {
      curColor = firstCol;
    }
    let firstW = selectedEntities[0].width || 2;
    if (selectedEntities.every(e => (e.width || 2) == firstW)) curWidth = firstW;
    let firstLT = selectedEntities[0].lineType || 'CONTINUOUS';
    if (selectedEntities.every(e => (e.lineType || 'CONTINUOUS') === firstLT)) curLineType = firstLT;
    let firstLay = selectedEntities[0].layer || '0';
    if (selectedEntities.every(e => (e.layer || '0') === firstLay)) curLayer = firstLay;
  }

  if (selCount === 0) {
    title.innerHTML = '📋 THUỘC TÍNH MẶC ĐỊNH';
  } else if (selCount === 1 && singleEnt) {
    title.innerHTML = `📋 THUỘC TÍNH: <span style="color:#fbbf24">${singleEnt.type}</span>`;
  } else {
    title.innerHTML = `📋 THUỘC TÍNH: <span style="color:#fbbf24">${selCount} ĐỐI TƯỢNG</span>`;
  }

  let html = `
    <div class="prop-section-title">
      <span>CHUNG (GENERAL)</span>
      <span style="font-size:10px; color:#94a3b8;">${selCount > 0 ? (selCount + ' đối tượng chọn') : 'Mặc định'}</span>
    </div>

    <!-- Color -->
    <div class="prop-row">
      <div class="prop-label">Màu Sắc:</div>
      <div class="prop-control">
        <div class="color-swatch-list">
          ${STANDARD_COLORS.map(c => `
            <div class="swatch-item ${curColor.toLowerCase() === c.value.toLowerCase() ? 'active' : ''}" 
                 style="background:${c.value}; ${c.value === '#ffffff' ? 'border:1px solid #64748b;' : ''}" 
                 title="${c.name}" 
                 onclick="changePropColor('${c.value}')"></div>
          `).join('')}
          <input type="color" value="${curColor.startsWith('#') ? curColor : '#ffffff'}" 
                 style="width:20px; height:20px; padding:0; border:none; border-radius:3px; cursor:pointer; background:none;"
                 onchange="changePropColor(this.value)" title="Chọn mã màu khác..." />
        </div>
      </div>
    </div>

    <!-- Layer -->
    <div class="prop-row">
      <div class="prop-label">Lớp (Layer):</div>
      <div class="prop-control">
        <select class="prop-select" onchange="changePropLayer(this.value)">
          ${availableLayers.map(l => `<option value="${l}" ${curLayer === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Lineweight -->
    <div class="prop-row">
      <div class="prop-label">Độ dày nét:</div>
      <div class="prop-control">
        <select class="prop-select" onchange="changePropWidth(parseFloat(this.value))">
          <option value="1" ${curWidth == 1 ? 'selected' : ''}>0.15 mm (Thanh 1px)</option>
          <option value="2" ${curWidth == 2 ? 'selected' : ''}>0.25 mm (Chuẩn 2px)</option>
          <option value="3" ${curWidth == 3 ? 'selected' : ''}>0.35 mm (Vừa 3px)</option>
          <option value="4" ${curWidth == 4 ? 'selected' : ''}>0.50 mm (Đậm 4px)</option>
          <option value="6" ${curWidth == 6 ? 'selected' : ''}>0.70 mm (Rất đậm 6px)</option>
        </select>
      </div>
    </div>

    <!-- Linetype -->
    <div class="prop-row">
      <div class="prop-label">Kiểu nét:</div>
      <div class="prop-control">
        <select class="prop-select" onchange="changePropLineType(this.value)">
          <option value="CONTINUOUS" ${curLineType === 'CONTINUOUS' ? 'selected' : ''}>Continuous (Nét liền)</option>
          <option value="DASHED" ${curLineType === 'DASHED' ? 'selected' : ''}>Dashed (Nét đứt - - -)</option>
          <option value="CENTER" ${curLineType === 'CENTER' ? 'selected' : ''}>Center (Nét trục - . -)</option>
          <option value="DOTTED" ${curLineType === 'DOTTED' ? 'selected' : ''}>Dotted (Nét chấm . . .)</option>
        </select>
      </div>
    </div>
  `;

  // Geometry Section (Single Entity)
  if (singleEnt) {
    html += `<div class="prop-section-title"><span>HÌNH HỌC (GEOMETRY)</span></div>`;

    if (singleEnt.type === 'LINE' && singleEnt.p1 && singleEnt.p2) {
      const p1 = singleEnt.p1, p2 = singleEnt.p2;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
      const len = Math.hypot(dx, dy);
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      html += `
        <div class="prop-row"><div class="prop-label">Điểm 1 (X, Y):</div><div class="prop-control"><input class="prop-input" value="${p1[0].toFixed(1)}, ${p1[1].toFixed(1)}" readonly style="color:#94a3b8;" /></div></div>
        <div class="prop-row"><div class="prop-label">Điểm 2 (X, Y):</div><div class="prop-control"><input class="prop-input" value="${p2[0].toFixed(1)}, ${p2[1].toFixed(1)}" readonly style="color:#94a3b8;" /></div></div>
        <div class="prop-row"><div class="prop-label">Chiều dài:</div><div class="prop-control"><input class="prop-input" type="number" value="${len.toFixed(1)}" onchange="updateLineLength('${singleEnt.id}', parseFloat(this.value))" /> mm</div></div>
        <div class="prop-row"><div class="prop-label">Góc nghiêng:</div><div class="prop-control"><input class="prop-input" value="${ang.toFixed(1)}°" readonly style="color:#94a3b8;" /></div></div>
      `;
    } else if (singleEnt.type === 'RECTANGLE') {
      html += `
        <div class="prop-row"><div class="prop-label">Tọa độ (X, Y):</div><div class="prop-control"><input class="prop-input" value="${singleEnt.x.toFixed(1)}, ${singleEnt.y.toFixed(1)}" readonly style="color:#94a3b8;" /></div></div>
        <div class="prop-row"><div class="prop-label">Chiều rộng (W):</div><div class="prop-control"><input class="prop-input" type="number" value="${singleEnt.w.toFixed(1)}" onchange="updateRectGeom('${singleEnt.id}', 'w', parseFloat(this.value))" /> mm</div></div>
        <div class="prop-row"><div class="prop-label">Chiều cao (H):</div><div class="prop-control"><input class="prop-input" type="number" value="${singleEnt.h.toFixed(1)}" onchange="updateRectGeom('${singleEnt.id}', 'h', parseFloat(this.value))" /> mm</div></div>
        <div class="prop-row"><div class="prop-label">Diện tích:</div><div class="prop-control"><input class="prop-input" value="${((singleEnt.w * singleEnt.h)/1000000).toFixed(2)} m²" readonly style="color:#4ade80;" /></div></div>
      `;
    } else if (singleEnt.type === 'CIRCLE') {
      const area = (Math.PI * singleEnt.r * singleEnt.r) / 1000000;
      html += `
        <div class="prop-row"><div class="prop-label">Tâm (X, Y):</div><div class="prop-control"><input class="prop-input" value="${singleEnt.cx.toFixed(1)}, ${singleEnt.cy.toFixed(1)}" readonly style="color:#94a3b8;" /></div></div>
        <div class="prop-row"><div class="prop-label">Bán kính (R):</div><div class="prop-control"><input class="prop-input" type="number" value="${singleEnt.r.toFixed(1)}" onchange="updateCircleRadius('${singleEnt.id}', parseFloat(this.value))" /> mm</div></div>
        <div class="prop-row"><div class="prop-label">Đường kính (D):</div><div class="prop-control"><input class="prop-input" value="${(singleEnt.r * 2).toFixed(1)} mm" readonly style="color:#94a3b8;" /></div></div>
        <div class="prop-row"><div class="prop-label">Diện tích:</div><div class="prop-control"><input class="prop-input" value="${area.toFixed(2)} m²" readonly style="color:#4ade80;" /></div></div>
      `;
    } else if (singleEnt.type === 'TEXT') {
      html += `
        <div class="prop-row"><div class="prop-label">Nội dung:</div><div class="prop-control"><input class="prop-input" value="${singleEnt.text}" onchange="updateTextContent('${singleEnt.id}', this.value)" style="color:#fbbf24; font-weight:bold;" /></div></div>
        <div class="prop-row"><div class="prop-label">Cỡ chữ:</div><div class="prop-control"><input class="prop-input" type="number" value="${singleEnt.size || 14}" onchange="updateTextSize('${singleEnt.id}', parseFloat(this.value))" /></div></div>
      `;
    }
  }

  body.innerHTML = html;
  updateRibbonQuickControls(curColor, curWidth, curLineType, curLayer);
}

function changePropColor(color) {
  if (!color) return;
  activeProperties.color = color;
  if (selectedIds.size > 0) {
    saveState();
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        e.color = color;
      }
    }
    setInfo(`🎨 Đã đổi màu sang ${color} cho ${selectedIds.size} đối tượng.`);
  } else {
    setInfo(`🎨 Đã chọn màu vẽ mặc định: ${color}`);
  }
  renderPropertiesPanel(false);
}

function changePropWidth(width) {
  activeProperties.width = width;
  if (selectedIds.size > 0) {
    saveState();
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        e.width = width;
      }
    }
    setInfo(`〰️ Đã đổi độ dày nét (${width}px) cho ${selectedIds.size} đối tượng.`);
  }
  renderPropertiesPanel(false);
}

function changePropLineType(type) {
  activeProperties.lineType = type;
  if (selectedIds.size > 0) {
    saveState();
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        e.lineType = type;
      }
    }
    setInfo(`--- Đã đổi kiểu nét (${type}) cho ${selectedIds.size} đối tượng.`);
  }
  renderPropertiesPanel(false);
}

function changePropLayer(layer) {
  activeProperties.layer = layer;
  if (selectedIds.size > 0) {
    saveState();
    for (let e of entities) {
      if (selectedIds.has(e.id)) {
        e.layer = layer;
      }
    }
    setInfo(`📂 Đã chuyển ${selectedIds.size} đối tượng sang Layer '${layer}'.`);
  }
  renderPropertiesPanel(false);
}

function updateLineLength(id, newLen) {
  if (newLen <= 0) return;
  const ent = entities.find(e => e.id === id);
  if (!ent || ent.type !== 'LINE') return;
  saveState();
  const dx = ent.p2[0] - ent.p1[0], dy = ent.p2[1] - ent.p1[1];
  const curLen = Math.hypot(dx, dy);
  if (curLen < 1e-4) return;
  const scale = newLen / curLen;
  ent.p2 = [ent.p1[0] + dx * scale, ent.p1[1] + dy * scale];
  renderPropertiesPanel();
  setInfo(`📏 Đã cập nhật chiều dài đường thẳng: ${newLen} mm`);
}

function updateRectGeom(id, prop, val) {
  if (val <= 0) return;
  const ent = entities.find(e => e.id === id);
  if (!ent || ent.type !== 'RECTANGLE') return;
  saveState();
  if (prop === 'w') ent.w = val;
  if (prop === 'h') ent.h = val;
  renderPropertiesPanel();
  setInfo(`⬛ Đã cập nhật kích thước hình chữ nhật.`);
}

function updateCircleRadius(id, newR) {
  if (newR <= 0) return;
  const ent = entities.find(e => e.id === id);
  if (!ent || ent.type !== 'CIRCLE') return;
  saveState();
  ent.r = newR;
  renderPropertiesPanel();
  setInfo(`⭕ Đã cập nhật bán kính hình tròn: R = ${newR} mm`);
}

function updateTextContent(id, newTxt) {
  const ent = entities.find(e => e.id === id);
  if (!ent || ent.type !== 'TEXT') return;
  saveState();
  ent.text = newTxt;
  renderPropertiesPanel();
  setInfo(`🔤 Đã cập nhật nội dung Text.`);
}

function updateTextSize(id, newSz) {
  if (newSz <= 0) return;
  const ent = entities.find(e => e.id === id);
  if (!ent || ent.type !== 'TEXT') return;
  saveState();
  ent.size = newSz;
  renderPropertiesPanel();
  setInfo(`🔤 Đã cập nhật cỡ chữ: ${newSz}`);
}

// Initialize Ribbon Quick Controls Listeners
(function initRibbonListeners() {
  const colPicker = document.getElementById('ribbon-color-picker');
  if (colPicker) colPicker.addEventListener('input', (e) => changePropColor(e.target.value));

  const wSel = document.getElementById('ribbon-width-select');
  if (wSel) wSel.addEventListener('change', (e) => changePropWidth(parseFloat(e.target.value)));

  const ltSel = document.getElementById('ribbon-linetype-select');
  if (ltSel) ltSel.addEventListener('change', (e) => changePropLineType(e.target.value));

  const laySel = document.getElementById('ribbon-layer-select');
  if (laySel) laySel.addEventListener('change', (e) => changePropLayer(e.target.value));
})();
