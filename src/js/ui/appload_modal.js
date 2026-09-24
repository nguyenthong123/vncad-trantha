// ===============================================================================
//     VINACAD DYNAMIC TOOL & MULTI-PLUGIN REGISTRY (APPLOAD STUDIO)
//     Hỗ trợ nạp đồng thời nhiều Tool (.lsp, .js, .py), tự động trích xuất
//     và hợp nhất đa lệnh CLI độc lập, kéo & thả batch multi-file.
// ===============================================================================

let defaultTools = [];
let customTools = [];
let dynamicCommands = {}; // Map: CMD_NAME -> { name, handler, desc, toolId }

// Expose to window for global access
window.customTools = customTools;
window.dynamicCommands = dynamicCommands;

/**
 * Đăng ký một lệnh CLI động từ JS plugin ngoài
 */
window.registerCommand = function(cmdName, handler, desc) {
  if (!cmdName) return;
  const upper = cmdName.toUpperCase().trim();
  window['c_' + upper] = handler;
  dynamicCommands[upper] = {
    name: upper,
    handler: handler,
    desc: desc || ''
  };
};

/**
 * Đăng ký một tool hoàn chỉnh từ JS plugin ngoài
 */
window.registerTool = function(toolDef) {
  if (!toolDef || !toolDef.name) return;
  let toolId = toolDef.id || ('tool_api_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  let existingIdx = customTools.findIndex(t => t.id === toolId || t.name === toolDef.name);

  let commands = [];
  if (toolDef.commands && Array.isArray(toolDef.commands)) {
    toolDef.commands.forEach(c => {
      let cName = typeof c === 'string' ? c : c.cmd;
      let cHandler = typeof c === 'object' ? c.handler : null;
      let cDesc = typeof c === 'object' ? c.desc : '';
      if (cName) {
        commands.push(cName.toUpperCase());
        if (cHandler) window.registerCommand(cName, cHandler, cDesc);
      }
    });
  } else if (toolDef.cmd) {
    commands.push(toolDef.cmd.toUpperCase());
  }

  let toolObj = {
    id: toolId,
    name: toolDef.name,
    fileName: toolDef.fileName || 'plugin.js',
    cmd: commands[0] || 'PLUGIN',
    commands: commands,
    desc: toolDef.desc || 'Plugin JavaScript ngoài',
    type: toolDef.type || 'JavaScript Plugin',
    enabled: toolDef.enabled !== false,
    code: toolDef.code || '',
    loadedAt: Date.now()
  };

  if (existingIdx >= 0) {
    customTools[existingIdx] = toolObj;
  } else {
    customTools.push(toolObj);
  }

  saveCustomToolsToStorage();
  renderApploadTable();
};

/**
 * Trích xuất danh sách tất cả các lệnh CLI được định nghĩa trong mã nguồn (LISP / JS)
 */
function extractCommandsFromCode(code) {
  let cmds = new Set();
  if (!code) return [];

  // 1. AutoLISP (defun c:NAME ...)
  let lspRegex = /\(defun\s+c:([A-Za-z0-9_]+)/gi;
  let match;
  while ((match = lspRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  // 2. JS window.c_NAME = ... hoặc window['c_NAME'] = ...
  let jsCRegex = /window(?:\.c_|\[['"]c_)([A-Za-z0-9_]+)['"]?\]?\s*=/gi;
  while ((match = jsCRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  // 3. JS registerCommand('NAME', ...)
  let regRegex = /registerCommand\(\s*['"]([A-Za-z0-9_]+)['"]/gi;
  while ((match = regRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  // 4. JS window.initNAMETool = ...
  let initRegex = /window(?:\.init|\[['"]init)([A-Za-z0-9_]+)Tool['"]?\]?\s*=/gi;
  while ((match = initRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  return Array.from(cmds);
}

/**
 * Trình thông dịch & thực thi mã AutoLISP
 */
function executeLispScript(code, toolId) {
  if (!code) return [];
  let extractedCmds = [];

  // 1. Kiểm tra khối JavaScript nhúng bên trong LISP (;;<JS_ENGINE> ... ;;</JS_ENGINE> hoặc đến hết file)
  let jsBlockMatch = code.match(/;;<JS_ENGINE>([\s\S]*?)(?:;;<\/JS_ENGINE>|$)/i);
  if (jsBlockMatch) {
    try {
      (new Function(jsBlockMatch[1]))();
    } catch (e) {
      console.warn("Lỗi nạp embedded JS engine từ AutoLISP:", e);
    }
  }

  // 2. Parse các định nghĩa hàm AutoLISP (defun c:NAME (...) ...)
  let defunRegex = /\(defun\s+c:([A-Za-z0-9_]+)\s*\((.*?)\)([\s\S]*?)(?=\n\s*\(defun|\n\s*\(princ|\n\s*\(setvar|\n\s*;;|\Z)/gi;
  let match;
  while ((match = defunRegex.exec(code)) !== null) {
    let cmdName = match[1].toUpperCase();
    let body = match[3];
    extractedCmds.push(cmdName);

    let handler = function(...args) {
      // Find (selectTool "NAME")
      let selToolMatch = body.match(/\(selectTool\s+"([^"]+)"\)/i);
      if (selToolMatch) {
        let toolName = selToolMatch[1];
        if (typeof selectTool === 'function') selectTool(toolName);
      }
      // Find direct JS calls like (if window.myFunction (window.myFunction))
      let jsCallMatch = body.match(/\((?:window\.)?([a-zA-Z0-9_]+)\(\)\)/i);
      if (jsCallMatch) {
        let fnName = jsCallMatch[1];
        if (typeof window[fnName] === 'function') window[fnName]();
      }
      // Find (princ "...")
      let princMatches = body.matchAll(/\(princ\s+"([^"]+)"\)/gi);
      for (let p of princMatches) {
        let msg = p[1].replace(/\\n/g, ' ').trim();
        if (msg && typeof setInfo === 'function') setInfo(msg);
      }
      // Find (alert "...")
      let alertMatch = body.match(/\(alert\s+"([^"]+)"\)/i);
      if (alertMatch) {
        if (typeof setInfo === 'function') setInfo(alertMatch[1]);
      }
    };

    if (typeof window['c_' + cmdName] !== 'function') {
      window['c_' + cmdName] = handler;
    }
    if (!dynamicCommands[cmdName]) {
      dynamicCommands[cmdName] = {
        name: cmdName,
        handler: window['c_' + cmdName] || handler,
        desc: `Lệnh AutoLISP c:${cmdName}`,
        toolId: toolId
      };
    }
  }

  // Parse top-level (princ "...")
  let topPrinc = code.matchAll(/\(princ\s+"([^"]+)"\)/gi);
  for (let p of topPrinc) {
    let msg = p[1].replace(/\\n/g, ' ').trim();
    if (msg && !msg.startsWith('===') && typeof setInfo === 'function') {
      setInfo(msg);
    }
  }

  return extractedCmds;
}

/**
 * Thực thi và kích hoạt mã nguồn của Tool
 */
function executeToolCode(tool) {
  if (!tool || !tool.code || tool.enabled === false) return;
  let isLsp = tool.type === 'AutoLISP' || (tool.fileName && tool.fileName.endsWith('.lsp')) || tool.code.includes('(defun');

  if (isLsp) {
    let cmds = executeLispScript(tool.code, tool.id);
    if (cmds.length > 0 && (!tool.commands || tool.commands.length === 0)) {
      tool.commands = cmds;
    }
  } else {
    try {
      (new Function(tool.code))();
      let extracted = extractCommandsFromCode(tool.code);
      if (extracted.length > 0 && (!tool.commands || tool.commands.length === 0)) {
        tool.commands = extracted;
      }
      // Map extracted JS commands to dynamic registry
      if (tool.commands) {
        tool.commands.forEach(cmd => {
          if (typeof window['c_' + cmd] === 'function') {
            dynamicCommands[cmd] = {
              name: cmd,
              handler: window['c_' + cmd],
              desc: `Lệnh JS c_${cmd}`,
              toolId: tool.id
            };
          } else if (typeof window['init' + cmd + 'Tool'] === 'function') {
            dynamicCommands[cmd] = {
              name: cmd,
              handler: () => { if (typeof selectTool === 'function') selectTool(cmd); },
              desc: `Công cụ ${cmd}`,
              toolId: tool.id
            };
          }
        });
      }
    } catch (e) {
      console.warn(`Lỗi nạp JS tool [${tool.name}]:`, e);
    }
  }
}

/**
 * Lưu danh sách customTools vào cả LocalStorage và Cơ sở Dữ liệu IndexedDB
 */
function saveCustomToolsToStorage() {
  try {
    localStorage.setItem('vinacad_custom_tools', JSON.stringify(customTools));
  } catch (err) {
    console.warn("Không thể lưu tool vào localStorage:", err);
  }

  // Lưu bền vững vào IndexedDB
  if (typeof isDbReady !== 'undefined' && isDbReady && typeof dbInstance !== 'undefined' && dbInstance) {
    try {
      const tx = dbInstance.transaction(['custom_plugins'], 'readwrite');
      const store = tx.objectStore('custom_plugins');
      store.clear();
      customTools.forEach(tool => {
        store.put(tool);
      });
    } catch (e) {
      console.warn("Lỗi lưu plugin vào IndexedDB:", e);
    }
  }
}

/**
 * Khôi phục tất cả default tools & custom tools khi khởi động
 */
function initDefaultTools() {
  try {
    defaultTools.forEach(tool => {
      if (tool.enabled !== false && tool.code) {
        executeToolCode(tool);
      }
    });
  } catch (e) {
    console.warn("Lỗi khởi tạo default tools:", e);
  }
}

function loadSavedCustomTools() {
  try {
    let saved = localStorage.getItem('vinacad_custom_tools');
    if (saved) {
      customTools = JSON.parse(saved);
      window.customTools = customTools;
      customTools.forEach(tool => {
        if (tool.enabled !== false) {
          executeToolCode(tool);
        }
      });
    }
  } catch (e) {
    console.warn("Lỗi khôi phục custom tools:", e);
  }
}

function restorePluginsFromDB() {
  if (typeof isDbReady === 'undefined' || !isDbReady || !dbInstance) return;
  try {
    const tx = dbInstance.transaction(['custom_plugins'], 'readonly');
    const store = tx.objectStore('custom_plugins');
    const req = store.getAll();
    req.onsuccess = function() {
      if (req.result && req.result.length > 0) {
        req.result.forEach(dbTool => {
          let exists = customTools.some(t => t.id === dbTool.id || t.name === dbTool.name);
          if (!exists) {
            customTools.push(dbTool);
            if (dbTool.enabled !== false) {
              executeToolCode(dbTool);
            }
          }
        });
        window.customTools = customTools;
        updateToolBadges();
        renderApploadTable();
      }
    };
  } catch (e) {
    console.warn("Lỗi nạp plugin từ IndexedDB:", e);
  }
}
window.restorePluginsFromDB = restorePluginsFromDB;

function updateToolBadges() {
  const all = getAllTools();
  const activeTools = all.filter(t => t.enabled !== false);
  const totalCmds = getTotalActiveCommandCount();

  const ribbonBadge = document.getElementById('tool-count-badge');
  if (ribbonBadge) {
    ribbonBadge.innerText = activeTools.length;
    ribbonBadge.style.background = activeTools.length > 0 ? '#10b981' : '#ef4444';
  }
  const modalToolBadge = document.getElementById('modal-tool-count-badge');
  if (modalToolBadge) modalToolBadge.innerText = all.length;

  const modalCmdBadge = document.getElementById('cmd-count-badge');
  if (modalCmdBadge) modalCmdBadge.innerText = totalCmds;
}

// Khởi chạy nạp tool mặc định & custom tool khi nạp file
initDefaultTools();
loadSavedCustomTools();
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateToolBadges);
  } else {
    updateToolBadges();
  }
}

function getAllTools() {
  return [...defaultTools, ...customTools];
}

/**
 * Đếm tổng số lệnh CLI đang sẵn sàng từ tất cả các tool
 */
function getTotalActiveCommandCount() {
  let cmds = new Set();
  getAllTools().forEach(t => {
    if (t.enabled !== false && t.commands) {
      t.commands.forEach(c => cmds.add(c));
    }
  });
  return cmds.size;
}

/**
 * Render bảng danh sách tool trong APPLOAD modal
 */
function renderApploadTable() {
  const tbody = document.getElementById('appload-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  updateToolBadges();
  const all = getAllTools();

  if (all.length === 0) {
    let tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="5" style="text-align:center; padding:24px 10px; color:#64748b;">
        Chưa có Tool ngoài nào được nạp. Hãy bấm nút <b>"Tải Lên Nhiều File Tool"</b> hoặc Kéo & Thả các file <code>.lsp</code> / <code>.js</code> vào khung bên trên.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  all.forEach((tool, idx) => {
    let tr = document.createElement('tr');
    let isCustom = idx >= defaultTools.length;
    let customIdx = isCustom ? (idx - defaultTools.length) : -1;
    let isActive = tool.enabled !== false;

    // Render danh sách command pills (click vào chạy luôn)
    let commandsList = (tool.commands && tool.commands.length > 0) ? tool.commands : [tool.cmd || 'CHAY'];
    let cmdsHtml = commandsList.map(c => `
      <span class="cmd-pill" onclick="executeToolFromAppload('${c}')" title="Click để chạy ngay lệnh '${c}'">
        ${c}
      </span>
    `).join('');

    let typeIcon = tool.type === 'AutoLISP' ? '📜' : (tool.type === 'Python' ? '🐍' : '⚡');

    tr.innerHTML = `
      <td style="font-weight:700; color:#38bdf8;">
        <div>${tool.name}</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">${typeIcon} ${tool.fileName || tool.type}</div>
      </td>
      <td>
        <div style="display:flex; flex-wrap:wrap; align-items:center;">
          ${cmdsHtml}
        </div>
      </td>
      <td style="color:#cbd5e1; font-size:11.5px;">${tool.desc || ''}</td>
      <td style="text-align:center;">
        <span class="tool-status-badge ${isActive ? 'active' : 'inactive'}" onclick="${isCustom ? `toggleToolStatus(${customIdx})` : ''}" title="Click để Bật/Tắt tool">
          ${isActive ? '🟢 Đang Bật' : '⚪ Đã Tắt'}
        </span>
      </td>
      <td style="text-align:center; white-space:nowrap;">
        <button onclick="executeToolFromAppload('${commandsList[0]}')" class="btn btn-highlight" style="padding:3px 8px; font-size:11px;" title="Chạy lệnh chính">▶️ Chạy</button>
        ${isCustom ? `<button onclick="removeCustomTool(${customIdx})" class="btn btn-danger" style="padding:3px 8px; font-size:11px; margin-left:4px;" title="Gỡ bỏ tool này">🗑️</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openApploadModal() {
  renderApploadTable();
  const modal = document.getElementById('appload-modal');
  if (modal) modal.style.display = 'flex';
}

function closeApploadModal() {
  const modal = document.getElementById('appload-modal');
  if (modal) modal.style.display = 'none';
}

function executeToolFromAppload(cmd) {
  closeApploadModal();
  if (typeof runCommand === 'function') {
    runCommand(cmd);
  }
}

/**
 * Bật / Tắt trạng thái hoạt động của một Tool
 */
function toggleToolStatus(idx) {
  if (customTools[idx]) {
    customTools[idx].enabled = !(customTools[idx].enabled !== false);
    if (customTools[idx].enabled) {
      executeToolCode(customTools[idx]);
      setInfo(`🟢 Đã kích hoạt Tool [${customTools[idx].name}].`);
    } else {
      setInfo(`⚪ Đã tạm tắt Tool [${customTools[idx].name}].`);
    }
    saveCustomToolsToStorage();
    renderApploadTable();
  }
}

/**
 * Xử lý danh sách nhiều File tải lên (Multi-file batch loader)
 */
async function processFileList(files) {
  if (!files || files.length === 0) return;

  let loadedCount = 0;
  let allNewCmds = [];

  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    try {
      let content = await readFileAsText(file);
      let name = file.name.replace(/\.[^/.]+$/, "");
      let isLsp = file.name.toLowerCase().endsWith('.lsp') || content.includes('(defun');
      let isPy = file.name.toLowerCase().endsWith('.py');

      // Trích xuất tất cả các lệnh có trong file
      let cmds = extractCommandsFromCode(content);
      if (cmds.length === 0) {
        let fallbackCmd = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        cmds = [fallbackCmd || ('TOOL_' + Date.now().toString().slice(-4))];
      }

      let toolType = isLsp ? 'AutoLISP' : (isPy ? 'Python' : 'JavaScript Plugin');
      let icon = isLsp ? '📜' : (isPy ? '🐍' : '⚡');

      let newTool = {
        id: 'tool_custom_' + Date.now() + '_' + i,
        name: icon + ' ' + name,
        fileName: file.name,
        cmd: cmds[0],
        commands: cmds,
        desc: `Tải lên: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        type: toolType,
        enabled: true,
        code: content,
        loadedAt: Date.now()
      };

      // Kích hoạt thực thi mã
      executeToolCode(newTool);

      // Nếu đã tồn tại tool trùng fileName thì ghi đè (update), ngược lại thêm mới
      let existingIdx = customTools.findIndex(t => t.fileName === file.name || t.name === newTool.name);
      if (existingIdx >= 0) {
        customTools[existingIdx] = newTool;
      } else {
        customTools.push(newTool);
      }

      loadedCount++;
      cmds.forEach(c => allNewCmds.push(c));
    } catch (err) {
      console.error(`Lỗi khi đọc file [${file.name}]:`, err);
    }
  }

  saveCustomToolsToStorage();
  renderApploadTable();

  let msg = `🧩 Đã nạp thành công ${loadedCount} Tool (${allNewCmds.length} lệnh sẵn sàng: ${allNewCmds.join(', ')}).`;
  setInfo(msg, 'success');
  if (typeof logToCliHistory === 'function') {
    logToCliHistory(msg, 'success');
  }
  alert(`Đã nạp thành công ${loadedCount} Tool!\nCác lệnh CLI mới sẵn sàng: ${allNewCmds.join(', ')}\nBạn có thể gõ trực tiếp trên thanh Command.`);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsText(file);
  });
}

function handleToolFileUpload(e) {
  let files = e.target.files;
  if (files && files.length > 0) {
    processFileList(Array.from(files));
    e.target.value = ''; // Reset input để có thể chọn lại file cùng tên
  }
}

/**
 * Đăng ký script nhập tay trực tiếp từ form
 */
function registerCustomTool() {
  let nameEl = document.getElementById('new-tool-name');
  let cmdEl = document.getElementById('new-tool-cmd');
  let codeEl = document.getElementById('new-tool-code');
  if (!nameEl || !cmdEl || !codeEl) return;

  let name = nameEl.value.trim();
  let cmd = cmdEl.value.trim().toUpperCase();
  let code = codeEl.value.trim();

  if (!name || !cmd) {
    alert("Vui lòng nhập đầy đủ Tên Tool và Lệnh gọi (CLI).");
    return;
  }

  let isLsp = code.includes('(defun') || code.startsWith(';');
  let cmds = extractCommandsFromCode(code);
  if (!cmds.includes(cmd)) cmds.unshift(cmd);

  let newTool = {
    id: 'tool_custom_' + Date.now(),
    name: '⚡ ' + name,
    fileName: 'custom_script.js',
    cmd: cmd,
    commands: cmds,
    desc: 'Script tùy chỉnh người dùng thêm trực tiếp',
    type: isLsp ? 'AutoLISP' : 'Script Người Dùng',
    enabled: true,
    code: code,
    loadedAt: Date.now()
  };

  executeToolCode(newTool);
  customTools.push(newTool);
  saveCustomToolsToStorage();

  nameEl.value = '';
  cmdEl.value = '';
  codeEl.value = '';
  renderApploadTable();
  setInfo(`⚡ Đã đăng ký thành công Tool [${name}] (Lệnh: ${cmds.join(', ')}).`);
  alert(`Đã đăng ký thành công Tool [${name}]!\nGõ "${cmd}" trong CLI để chạy.`);
}

/**
 * Gỡ bỏ một Tool cụ thể
 */
function removeCustomTool(idx) {
  if (customTools[idx]) {
    let toolName = customTools[idx].name;
    if (confirm(`Bạn có chắc chắn muốn gỡ bỏ Tool [${toolName}] không?`)) {
      customTools.splice(idx, 1);
      saveCustomToolsToStorage();
      renderApploadTable();
      setInfo(`🗑️ Đã gỡ bỏ Tool [${toolName}].`);
    }
  }
}

/**
 * Gỡ bỏ tất cả các Tool mở rộng
 */
function clearAllCustomTools() {
  if (customTools.length === 0) {
    alert("Hiện không có tool ngoài nào để gỡ.");
    return;
  }
  if (confirm(`Bạn có chắc chắn muốn gỡ bỏ TẤT CẢ ${customTools.length} tool ngoài đã nạp không?`)) {
    customTools = [];
    dynamicCommands = {};
    saveCustomToolsToStorage();
    renderApploadTable();
    setInfo("🗑️ Đã xóa sạch toàn bộ các tool mở rộng.");
    alert("Đã gỡ bỏ toàn bộ tool ngoài.");
  }
}

/**
 * Thiết lập sự kiện Drag & Drop cho APPLOAD modal và toàn màn hình CAD
 */
function initDragAndDropAppload() {
  const dropzone = document.getElementById('appload-dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files) {
        processFileList(Array.from(e.dataTransfer.files));
      }
    });
  }

  // Hỗ trợ kéo & thả trực tiếp file .lsp / .js vào toàn bộ màn hình CAD viewport
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        let files = Array.from(e.dataTransfer.files);
        let toolFiles = files.filter(f => f.name.endsWith('.lsp') || f.name.endsWith('.js') || f.name.endsWith('.py'));
        if (toolFiles.length > 0) {
          e.preventDefault();
          processFileList(toolFiles);
          openApploadModal();
        }
      }
    });
  }
}

// Khởi tạo drag & drop khi DOM sẵn sàng
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDragAndDropAppload);
  } else {
    initDragAndDropAppload();
  }
}
