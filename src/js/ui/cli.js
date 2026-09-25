// AUTOCAD COMMAND LINE INTERFACE (CLI) & SMART INTELLISENSE ASSISTANT
let commandHistory = [];
let historyIndex = -1;
let lastExecutedCommand = null;

// Ghi nhớ tần suất sử dụng lệnh để tối ưu gợi ý theo thói quen người dùng
let commandStats = {};
try {
  let savedStats = localStorage.getItem('vinacad_cmd_stats');
  if (savedStats) commandStats = JSON.parse(savedStats);
} catch (e) {}

const KNOWN_COMMANDS = [
  { cmd: 'LINE', aliases: ['L'], desc: 'Vẽ đoạn thẳng (nhập khoảng cách qua Dynamic Input)' },
  { cmd: 'POLYLINE', aliases: ['PL'], desc: 'Vẽ đường đa tuyến liên tục Polyline' },
  { cmd: 'RECTANGLE', aliases: ['REC', 'RECTANG'], desc: 'Vẽ hình chữ nhật' },
  { cmd: 'CIRCLE', aliases: ['C'], desc: 'Vẽ hình tròn (nhập bán kính R)' },
  { cmd: 'ARC', aliases: ['A'], desc: 'Vẽ cung tròn qua 3 điểm' },
  { cmd: 'ELLIPSE', aliases: ['EL'], desc: 'Vẽ hình Elip' },
  { cmd: 'POLYGON', aliases: ['POL'], desc: 'Vẽ đa giác đều 6 cạnh' },
  { cmd: 'DIMENSION', aliases: ['DIM', 'DLI'], desc: 'Ghi kích thước đoạn thẳng' },
  { cmd: 'TEXT', aliases: ['DT', 'MT'], desc: 'Đặt chữ kỹ thuật Text' },
  { cmd: 'MOVE', aliases: ['M'], desc: 'Di chuyển đối tượng' },
  { cmd: 'COPY', aliases: ['CO', 'CP'], desc: 'Sao chép đối tượng' },
  { cmd: 'OFFSET', aliases: ['O'], desc: 'Offset song song (vẽ tường đôi)' },
  { cmd: 'ROTATE', aliases: ['RO'], desc: 'Xoay đối tượng quanh điểm gốc' },
  { cmd: 'SCALE', aliases: ['SC'], desc: 'Thu phóng tỉ lệ đối tượng' },
  { cmd: 'MIRROR', aliases: ['MI'], desc: 'Lấy đối xứng gương Mirror' },
  { cmd: 'EXPLODE', aliases: ['X'], desc: 'Phá vỡ hình hộp/đa tuyến thành các đoạn thẳng' },
  { cmd: 'ERASE', aliases: ['E', 'DEL', 'DELETE'], desc: 'Xóa đối tượng' },
  { cmd: 'HATCH', aliases: ['H'], desc: 'Tô gạch mặt cắt' },
  { cmd: 'DIST', aliases: ['DI'], desc: 'Đo khoảng cách giữa hai điểm' },
  { cmd: 'PROPERTIES', aliases: ['PR', 'PROP', 'MO', 'CH'], desc: 'Bảng thuộc tính Quick Properties' },
  { cmd: 'COLOR', aliases: ['COL', 'MAU'], desc: 'Đổi màu nét vẽ' },
  { cmd: 'LAYER', aliases: ['LA'], desc: 'Chuyển lớp Layer' },
  { cmd: 'LWEIGHT', aliases: ['LW'], desc: 'Đổi độ dày nét vẽ' },
  { cmd: 'LINETYPE', aliases: ['LT'], desc: 'Đổi kiểu nét (Liền/Đứt/Trục/Chấm)' },
  { cmd: 'APPLOAD', aliases: ['AP', 'TOOL', 'PLUGIN'], desc: 'Bảng Quản Lý & Nạp Plugin ngoài (.js, .lsp)' },
  { cmd: 'QSAVE', aliases: ['SAVE', 'LUU', 'WSAVE'], desc: 'Lưu bản vẽ & tiến trình vào CSDL (Ctrl+S)' },
  { cmd: 'SAVEAS', aliases: ['SAVEPROJECT'], desc: 'Lưu bản vẽ thành dự án mới trong CSDL' },
  { cmd: 'DXF', aliases: [], desc: 'Xuất bản vẽ ra file AutoCAD DXF' },
  { cmd: 'JSON', aliases: ['EXPORT', 'SAVETOFILE'], desc: 'Xuất bản vẽ dạng file JSON' },
  { cmd: 'OPEN', aliases: ['OP', 'LOAD', 'IMPORT', 'UPLOAD', 'MO', 'MOFILE', 'FILE', 'TAIFILE', 'NAPFILE'], desc: 'Mở file bản vẽ (JSON, DXF) hoặc nạp Tool (LSP, JS) (Ctrl+O)' },
  { cmd: 'ZOOM', aliases: ['Z'], desc: 'Phóng to toàn bộ bản vẽ (Zoom All)' },
  { cmd: 'PAN', aliases: ['P'], desc: 'Dời góc nhìn bản vẽ' },
  { cmd: 'TOP', aliases: ['VTOP', 'VIEWTOP', 'PLAN'], desc: 'Đưa góc nhìn về Top (0°)' },
  { cmd: 'ROTATEVIEW', aliases: ['RV', 'VIEWROTATE'], desc: 'Xoay góc nhìn 2D theo độ' },
  { cmd: 'HELP', aliases: ['?'], desc: 'Hiển thị danh sách lệnh' },
  { cmd: '3D', aliases: ['VIEW3D', 'ISO'], desc: 'Mở cửa sổ xem 3D Phối Cảnh' },
  { cmd: 'SECTION', aliases: ['SEC', 'MATCAT'], desc: 'Mở Bản vẽ Mặt Cắt Kỹ Thuật 2D' },
  { cmd: 'NEW', aliases: ['QNEW', 'BANVE', 'TAOMOI'], desc: 'Tạo bản vẽ mới sạch sẽ (Ctrl+N)' },
  { cmd: 'UNDO', aliases: ['U'], desc: 'Hoàn tác thao tác trước (Ctrl+Z)' },
  { cmd: 'REDO', aliases: ['REDO', 'LAMLAI'], desc: 'Làm lại thao tác vừa hoàn tác (Ctrl+Y)' },
  { cmd: 'ID', aliases: ['CHECK', 'INSPECT', 'TOADO', 'SOI', 'SOITOADO'], desc: 'Soi tọa độ WCS, kiểm tra ô trần 600x600 & vật thể (HUD Inspector)' },
  { cmd: 'CLEAR', aliases: ['CLS', 'RESET'], desc: 'Xóa sạch toàn bộ bản vẽ' }
];

// GENERIC CAD PLUGIN EXTENSION SYSTEM & REGISTRY
window.cadPluginHooks = {
  overlayRenderers: [],
  escapeHandlers: [],
  enterHandlers: [],
  toolHandlers: {}
};

window.registerPluginOverlay = function(renderFn) {
  if (typeof renderFn === 'function' && !window.cadPluginHooks.overlayRenderers.includes(renderFn)) {
    window.cadPluginHooks.overlayRenderers.push(renderFn);
  }
};

window.unregisterPluginOverlay = function(renderFn) {
  window.cadPluginHooks.overlayRenderers = window.cadPluginHooks.overlayRenderers.filter(fn => fn !== renderFn);
};

window.registerPluginEscapeHandler = function(handlerFn) {
  if (typeof handlerFn === 'function' && !window.cadPluginHooks.escapeHandlers.includes(handlerFn)) {
    window.cadPluginHooks.escapeHandlers.push(handlerFn);
  }
};

window.registerPluginEnterHandler = function(handlerFn) {
  if (typeof handlerFn === 'function' && !window.cadPluginHooks.enterHandlers.includes(handlerFn)) {
    window.cadPluginHooks.enterHandlers.push(handlerFn);
  }
};

window.registerPluginTool = function(toolName, handlerObj) {
  if (toolName && typeof handlerObj === 'object') {
    window.cadPluginHooks.toolHandlers[toolName] = handlerObj;
  }
};

window.registerPluginCommand = function(cmdName, handlerFn, description) {
  if (!cmdName || typeof handlerFn !== 'function') return;
  let upper = cmdName.toUpperCase();
  if (typeof dynamicCommands === 'undefined') window.dynamicCommands = {};
  window.dynamicCommands[upper] = { handler: handlerFn, desc: description || `Lệnh Plugin [${upper}]` };
};

function logToCliHistory(text, type = 'info') {
  const hist = document.getElementById('cli-history');
  if (!hist || !text) return;

  const line = document.createElement('div');
  line.className = 'cli-hist-line';
  if (type === 'cmd') line.classList.add('cli-hist-cmd');
  else if (type === 'success' || text.includes('✅') || text.includes('🟢')) line.classList.add('cli-hist-success');
  else if (type === 'prompt' || text.includes('👉') || text.includes('💡') || text.includes('⚠️')) line.classList.add('cli-hist-prompt');
  else line.classList.add('cli-hist-info');

  line.innerText = text;
  hist.appendChild(line);

  while (hist.children.length > 80) {
    hist.removeChild(hist.firstChild);
  }
  hist.scrollTop = hist.scrollHeight;
}

// Thuật toán đo khoảng cách Levenshtein tìm lệnh gõ sai chính tả
function levenshteinDistance(s1, s2) {
  let a = s1.toLowerCase(), b = s2.toLowerCase();
  let matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // thay thế
          matrix[i][j - 1] + 1,     // chèn
          matrix[i - 1][j] + 1      // xóa
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findBestCommandSuggestion(inputCmd) {
  let best = null;
  let minDistance = Infinity;

  // 1. Kiểm tra tập lệnh mặc định
  for (let item of KNOWN_COMMANDS) {
    let dMain = levenshteinDistance(inputCmd, item.cmd);
    if (dMain < minDistance) {
      minDistance = dMain;
      best = item;
    }
    for (let alias of item.aliases) {
      let dAlias = levenshteinDistance(inputCmd, alias);
      if (dAlias < minDistance) {
        minDistance = dAlias;
        best = item;
      }
    }
  }

  // 2. Kiểm tra các lệnh từ Tool mở rộng đã nạp (Default & Custom)
  let allTools = typeof getAllTools === 'function' ? getAllTools() : (typeof customTools !== 'undefined' ? customTools : []);
  if (Array.isArray(allTools)) {
    for (let tool of allTools) {
      if (tool.enabled !== false && tool.commands) {
        for (let c of tool.commands) {
          let d = levenshteinDistance(inputCmd, c);
          if (d < minDistance) {
            minDistance = d;
            best = { cmd: c, aliases: [], desc: `Lệnh từ Tool: ${tool.name}` };
          }
        }
      }
    }
  }

  if (minDistance <= 2) return best;
  return null;
}

window.lastExecutedCommand = null;

if (cliInput) {
  cliInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || (e.key === ' ' && cliInput.value.trim().length > 0)) {
      e.preventDefault();
      e.stopPropagation();
      let raw = cliInput.value.trim();
      cliInput.value = '';

      if (!raw) {
        // 1. Nếu có plugin tool enter handler
        if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
          let th = window.cadPluginHooks.toolHandlers[currentTool];
          if (typeof th.onEnter === 'function') {
            th.onEnter();
            return;
          }
        }

        // 2. Nhấn Enter khi không gõ gì -> Lặp lại lệnh CAD trước đó
        let lastCmd = window.lastExecutedCommand || lastExecutedCommand;
        if (lastCmd && !['APPLOAD', 'OPEN', 'SAVE', 'DXF', 'CLEAR'].includes(lastCmd.toUpperCase())) {
          logToCliHistory(`Lặp lại lệnh trước: ${lastCmd}`, 'prompt');
          runCommand(lastCmd);
        }
        return;
      }

      commandHistory.push(raw);
      if (commandHistory.length > 50) commandHistory.shift();
      historyIndex = -1;

      logToCliHistory(`Command: ${raw}`, 'cmd');
      runCommand(raw);
    } else if (e.key === ' ' && !cliInput.value.trim()) {
      e.preventDefault();
      if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[currentTool]) {
        let th = window.cadPluginHooks.toolHandlers[currentTool];
        if (typeof th.onEnter === 'function') {
          th.onEnter();
          return;
        }
      }
      let lastCmd = window.lastExecutedCommand || lastExecutedCommand;
      if (lastCmd && !['APPLOAD', 'OPEN', 'SAVE', 'DXF', 'CLEAR'].includes(lastCmd.toUpperCase())) {
        logToCliHistory(`Lặp lại lệnh trước: ${lastCmd}`, 'prompt');
        runCommand(lastCmd);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        if (historyIndex === -1) historyIndex = commandHistory.length - 1;
        else if (historyIndex > 0) historyIndex--;
        cliInput.value = commandHistory[historyIndex] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          cliInput.value = commandHistory[historyIndex] || '';
        } else {
          historyIndex = -1;
          cliInput.value = '';
        }
      }
    }
  });
}


function recordCommandUsage(cmd) {
  commandStats[cmd] = (commandStats[cmd] || 0) + 1;
  try { localStorage.setItem('vinacad_cmd_stats', JSON.stringify(commandStats)); } catch (e) {}
}

function runCommand(rawCmd) {
  if (!rawCmd || !rawCmd.trim()) return;
  let parts = rawCmd.trim().split(/\s+/);
  let cmd = parts[0].toUpperCase();
  let args = parts.slice(1);

  // Lưu lại lệnh vừa gọi vào lịch sử lệnh gần nhất
  if (!['U', 'UNDO', 'REDO', 'HELP', '?', 'HISTORY', 'LOG', 'LOGS', 'JOURNAL'].includes(cmd)) {
    lastExecutedCommand = rawCmd.trim();
    window.lastExecutedCommand = lastExecutedCommand;
  }

  if (typeof logCommandTransaction === 'function') {
    logCommandTransaction(cmd, 'STARTED', { args });
  }

  // 1. ƯU TIÊN SỐ 1: Kiểm tra Plugin / Lệnh Động / Custom Tools đã nạp qua APPLOAD
  if (typeof dynamicCommands !== 'undefined' && dynamicCommands[cmd]) {
    recordCommandUsage(cmd);
    try {
      dynamicCommands[cmd].handler(...args);
      return;
    } catch (err) {
      setInfo(`⚠️ Lỗi khi chạy lệnh '${cmd}': ${err.message}`, 'prompt');
      console.error(err);
      return;
    }
  }

  if (typeof window['c_' + cmd] === 'function') {
    recordCommandUsage(cmd);
    try {
      window['c_' + cmd](...args);
      return;
    } catch (err) {
      setInfo(`⚠️ Lỗi khi chạy lệnh AutoLISP c:${cmd}: ${err.message}`, 'prompt');
      console.error(err);
      return;
    }
  }

  if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[cmd]) {
    recordCommandUsage(cmd);
    selectTool(cmd);
    return;
  }

  if (typeof window['init' + cmd + 'Tool'] === 'function') {
    recordCommandUsage(cmd);
    selectTool(cmd);
    return;
  }

  let allAvailableTools = typeof getAllTools === 'function' ? getAllTools() : (typeof customTools !== 'undefined' ? customTools : []);
  if (Array.isArray(allAvailableTools)) {
    let foundTool = allAvailableTools.find(t => {
      if (t.enabled === false) return false;
      let cmds = t.commands || [t.cmd];
      return cmds.some(c => c && c.toUpperCase() === cmd);
    });

    if (foundTool) {
      recordCommandUsage(cmd);
      if (!foundTool._isExecuted && typeof executeToolCode === 'function') {
        executeToolCode(foundTool);
      }
      if (typeof dynamicCommands !== 'undefined' && dynamicCommands[cmd]) {
        dynamicCommands[cmd].handler(...args);
        return;
      }
      if (typeof window['c_' + cmd] === 'function') {
        window['c_' + cmd](...args);
        return;
      }
      if (typeof window['init' + cmd + 'Tool'] === 'function') {
        selectTool(cmd);
        return;
      }
      if (window.cadPluginHooks && window.cadPluginHooks.toolHandlers && window.cadPluginHooks.toolHandlers[cmd]) {
        selectTool(cmd);
        return;
      }
      setInfo(`⚡ Đã kích hoạt lệnh [${cmd}] từ Tool [${foundTool.name}].`, 'success');
      return;
    }
  }

  if (typeof window[cmd] === 'function' && !['focus', 'blur', 'close', 'open', 'print', 'stop'].includes(cmd.toLowerCase())) {
    recordCommandUsage(cmd);
    try {
      window[cmd](...args);
      return;
    } catch (err) {
      console.warn(err);
    }
  }

  // 2. LỆNH LÕI AUTOCAD (Core Built-in Commands)
  // History & Command Journal Query
  if (['HISTORY', 'LOG', 'LOGS', 'JOURNAL'].includes(cmd)) {
    if (typeof printCommandHistory === 'function') printCommandHistory();
    return;
  }

  // Appload & Tools
  if (['AP', 'APPLOAD', 'APP', 'NETLOAD', 'VBALOAD', 'MENULOAD', 'CUI', 'TOOL', 'TOOLS', 'PLUGIN', 'PLUGINS', 'ADDIN'].includes(cmd)) {
    recordCommandUsage('APPLOAD');
    openApploadModal();
    return;
  }

  // Properties & Palette
  if (['PR', 'PROP', 'PROPERTIES', 'MO', 'CH', 'QUICKPROP'].includes(cmd)) {
    recordCommandUsage('PROPERTIES');
    togglePropertiesPanel();
    return;
  }
  if (cmd === 'COL' || cmd === 'COLOR' || cmd === 'MAU') {
    recordCommandUsage('COLOR');
    if (args[0]) {
      let c = args[0].toLowerCase();
      if (c === 'red' || c === 'do') changePropColor('#ef4444');
      else if (c === 'yellow' || c === 'vang') changePropColor('#eab308');
      else if (c === 'green' || c === 'xanhla') changePropColor('#22c55e');
      else if (c === 'blue' || c === 'xanhduong') changePropColor('#3b82f6');
      else if (c === 'cyan') changePropColor('#38bdf8');
      else if (c === 'white' || c === 'trang') changePropColor('#ffffff');
      else if (c === 'magenta' || c === 'tim') changePropColor('#d946ef');
      else if (c.startsWith('#')) changePropColor(c);
      else togglePropertiesPanel(true);
    } else {
      togglePropertiesPanel(true);
    }
    return;
  }
  if (cmd === 'LW' || cmd === 'LWEIGHT' || cmd === 'LINEWEIGHT') {
    recordCommandUsage('LWEIGHT');
    if (args[0]) changePropWidth(parseFloat(args[0]));
    else togglePropertiesPanel(true);
    return;
  }
  if (cmd === 'LT' || cmd === 'LTYPE' || cmd === 'LINETYPE') {
    recordCommandUsage('LINETYPE');
    if (args[0]) changePropLineType(args[0].toUpperCase());
    else togglePropertiesPanel(true);
    return;
  }
  if (cmd === 'LA' || cmd === 'LAYER') {
    recordCommandUsage('LAYER');
    if (args[0]) changePropLayer(args[0].toUpperCase());
    else togglePropertiesPanel(true);
    return;
  }

  // Select All Commands
  if (cmd === 'ALL' || (cmd === 'SELECT' && args[0] && args[0].toUpperCase() === 'ALL') || cmd === 'SELALL' || cmd === 'CHONALL') {
    recordCommandUsage('SELECT');
    selectedIds.clear();
    for (let ent of entities) {
      selectedIds.add(ent.id);
    }
    renderPropertiesPanel();
    setInfo(`✅ Đã chọn tất cả (${selectedIds.size} đối tượng).`);
    return;
  }

  // Modify commands (Có cảnh báo thông minh nếu chưa chọn đối tượng)
  if (['M', 'MOVE', 'CO', 'COPY', 'CP', 'RO', 'ROTATE', 'SC', 'SCALE', 'MI', 'MIRROR'].includes(cmd)) {
    let baseCmd = cmd.startsWith('M') && cmd !== 'MI' && cmd !== 'MIRROR' ? 'MOVE' :
                  cmd.startsWith('C') ? 'COPY' :
                  cmd.startsWith('RO') ? 'ROTATE' :
                  cmd.startsWith('SC') ? 'SCALE' : 'MIRROR';
    recordCommandUsage(baseCmd);
    selectTool(baseCmd);
    if (selectedIds.size === 0) {
      setInfo(`💡 [Lệnh ${baseCmd}] Chưa chọn đối tượng. Hãy nhấp hoặc quét chọn đối tượng trước khi chọn Điểm Gốc.`);
    } else {
      setInfo(`✅ [Lệnh ${baseCmd}] Đang chọn ${selectedIds.size} đối tượng. Hãy nhấp Điểm Gốc (Base Point)...`);
    }
    return;
  }

  if (cmd === 'O' || cmd === 'OFFSET') {
    recordCommandUsage('OFFSET');
    if (args[0]) offsetDist = parseFloat(args[0]) || 200;
    selectTool('OFFSET');
    return;
  }
  if (cmd === 'X' || cmd === 'EXPLODE') { recordCommandUsage('EXPLODE'); selectTool('EXPLODE'); return; }
  if (cmd === 'P' || cmd === 'PAN') { recordCommandUsage('PAN'); selectTool('PAN'); return; }

  // Draw commands
  if (cmd === 'L' || cmd === 'LINE') { recordCommandUsage('LINE'); selectTool('LINE'); return; }
  if (cmd === 'PL' || cmd === 'POLYLINE') { recordCommandUsage('POLYLINE'); selectTool('POLYLINE'); return; }
  if (cmd === 'REC' || cmd === 'RECTANG' || cmd === 'RECTANGLE') { recordCommandUsage('RECTANGLE'); selectTool('RECTANGLE'); return; }
  if (cmd === 'C' || cmd === 'CIRCLE') { recordCommandUsage('CIRCLE'); selectTool('CIRCLE'); return; }
  if (cmd === 'A' || cmd === 'ARC') { recordCommandUsage('ARC'); selectTool('ARC'); return; }
  if (cmd === 'EL' || cmd === 'ELLIPSE') { recordCommandUsage('ELLIPSE'); selectTool('ELLIPSE'); return; }
  if (cmd === 'POL' || cmd === 'POLYGON') { recordCommandUsage('POLYGON'); selectTool('POLYGON'); return; }
  if (cmd === 'DLI' || cmd === 'DIM' || cmd === 'DIMENSION') { recordCommandUsage('DIMENSION'); selectTool('DIMENSION'); return; }
  if (cmd === 'H' || cmd === 'HATCH') { recordCommandUsage('HATCH'); selectTool('HATCH'); return; }
  if (cmd === 'DI' || cmd === 'DIST') { recordCommandUsage('DIST'); selectTool('DIST'); return; }
  if (cmd === 'DT' || cmd === 'TEXT' || cmd === 'MT') { recordCommandUsage('TEXT'); selectTool('TEXT'); return; }
  if (['ID', 'CHECK', 'INSPECT', 'TOADO', 'SOI', 'SOITOADO'].includes(cmd)) {
    recordCommandUsage('ID');
    selectTool('ID');
    setInfo("🔍 [ID / CHECK] Chế độ Soi Tọa Độ & Ô Trần 600x600 kích hoạt. Di chuột hoặc nhấp để xem chi tiết.", 'info');
    return;
  }

  // Erase and Clear
  if (cmd === 'E' || cmd === 'ERASE' || cmd === 'DEL' || cmd === 'DELETE') {
    recordCommandUsage('ERASE');
    if (args[0] && (args[0].toUpperCase() === 'ALL' || args[0].toUpperCase() === '*')) clearCanvas();
    else deleteSelection();
    return;
  }

  // File Operations
  if (cmd === 'NEW' || cmd === 'QNEW' || cmd === 'BANVE' || cmd === 'TAOMOI') {
    recordCommandUsage('NEW');
    if (typeof createNewDrawing === 'function') createNewDrawing(args[0] !== 'FORCE');
    return;
  }
  if (cmd === 'QSAVE' || cmd === 'SAVE' || cmd === 'LUU' || cmd === 'WSAVE') {
    recordCommandUsage('QSAVE');
    if (typeof quickSaveProject === 'function') quickSaveProject(true);
    else if (typeof autoSaveToDB === 'function') autoSaveToDB(true, true);
    return;
  }
  if (cmd === 'SAVEAS' || cmd === 'SAVEPROJECT') {
    recordCommandUsage('SAVEAS');
    if (typeof saveProjectAsNewToDB === 'function') saveProjectAsNewToDB(args.join(' '));
    return;
  }
  if (cmd === 'OPEN' || cmd === 'OP' || cmd === 'LOAD' || cmd === 'IMPORT' || cmd === 'UPLOAD' || cmd === 'MO' || cmd === 'MOFILE' || cmd === 'FILE' || cmd === 'TAIFILE' || cmd === 'NAPFILE') {
    recordCommandUsage('OPEN');
    openFilePicker();
    return;
  }
  if (cmd === 'JSON' || cmd === 'EXPORT' || cmd === 'SAVETOFILE') { recordCommandUsage('JSON'); saveJSON(); return; }
  if (cmd === 'DXF') { recordCommandUsage('DXF'); exportDXF(); return; }

  // Utilities
  if (cmd === 'Z' || cmd === 'ZOOM') { recordCommandUsage('ZOOM'); zoomAll(); return; }
  if (cmd === 'U' || cmd === 'UNDO') { recordCommandUsage('UNDO'); undoAction(); return; }
  if (cmd === 'REDO' || cmd === 'LAMLAI') { recordCommandUsage('REDO'); redoAction(); return; }
  if (cmd === 'CLEAR' || cmd === 'CLS' || cmd === 'RESET') { recordCommandUsage('CLEAR'); clearCanvas(); return; }

  if (cmd === 'TOP' || cmd === 'VTOP' || cmd === 'VIEWTOP' || cmd === 'PLAN') {
    recordCommandUsage('TOP');
    setViewRotation(0);
    return;
  }
  if (cmd === 'RV' || cmd === 'ROTATEVIEW' || cmd === 'VIEWROTATE') {
    recordCommandUsage('ROTATEVIEW');
    const degrees = args.length > 0 ? parseFloat(args[0]) : 15;
    if (!Number.isFinite(degrees)) {
      setInfo("⚠️ ROTATEVIEW cần một góc hợp lệ, ví dụ: RV 30.", 'prompt');
      return;
    }
    rotateView(degrees);
    return;
  }
  // 3D & Section Views
  if (cmd === '3D' || cmd === 'TT3D' || cmd === 'VIEW3D' || cmd === 'ISO') {
    recordCommandUsage('3D');
    open3DView();
    return;
  }
  if (cmd === 'SECTION' || cmd === 'TTSEC' || cmd === 'SEC' || cmd === 'MATCAT') {
    recordCommandUsage('SECTION');
    openSectionView();
    return;
  }
  if (cmd === 'HELP' || cmd === '?') {
    recordCommandUsage('HELP');
    setInfo(`📖 Lệnh chính: L/PL/REC/C/A/EL/POL/H/DIM/DT | M/CO/O/RO/SC/MI/X/E | Z/P | TOP/RV 15 | 3D/SECTION | OPEN/SAVE/DXF | PR/LA/COL | APPLOAD`, 'info');
    return;
  }

  // Bắt lỗi thông minh & Gợi ý sửa sai chính tả (IntelliSense Auto-Diagnosis)
  let suggestion = findBestCommandSuggestion(cmd);
  if (suggestion) {
    setInfo(`❓ Lệnh '${cmd}' không xác định. Có phải bạn muốn dùng '${suggestion.cmd}' (${suggestion.desc})?`, 'prompt');
  } else {
    setInfo(`❓ Lệnh '${cmd}' không xác định. Gõ 'APPLOAD' để nạp plugin hoặc gõ 'HELP' để xem danh sách lệnh.`, 'prompt');
  }
}

function open3DView() {
  if (typeof window.openTT6003DModal === 'function') {
    window.openTT6003DModal();
  } else if (typeof window.open3DViewer === 'function') {
    window.open3DViewer();
  } else {
    setInfo("💡 Để xem 3D, hãy nạp Plugin qua APPLOAD (Lệnh TT3D / 3D).");
  }
}

function openSectionView() {
  if (typeof window.openTT600SectionModal === 'function') {
    window.openTT600SectionModal();
  } else if (typeof window.openSectionViewer === 'function') {
    window.openSectionViewer();
  } else {
    setInfo("💡 Để xem Mặt Cắt Kỹ Thuật, hãy nạp Plugin qua APPLOAD (Lệnh TTSEC / SECTION).");
  }
}

