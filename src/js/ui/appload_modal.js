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

  // 3. JS registerCommand('NAME', ...) hoặc registerPluginCommand('NAME', ...)
  let regRegex = /(?:registerCommand|registerPluginCommand)\(\s*['"]([A-Za-z0-9_]+)['"]/gi;
  while ((match = regRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  // 4. JS registerPluginTool('NAME', ...)
  let regToolRegex = /registerPluginTool\(\s*['"]([A-Za-z0-9_]+)['"]/gi;
  while ((match = regToolRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  // 5. JS window.initNAMETool = ...
  let initRegex = /window(?:\.init|\[['"]init)([A-Za-z0-9_]+)Tool['"]?\]?\s*=/gi;
  while ((match = initRegex.exec(code)) !== null) {
    cmds.add(match[1].toUpperCase());
  }

  return Array.from(cmds);
}

/**
 * Tự động trích xuất tên Tool từ tiêu đề comment hoặc lệnh trong mã nguồn
 */
function extractToolNameFromCode(code, fallback = '') {
  if (!code) return fallback || '⚡ Plugin Tùy Chỉnh';

  let lines = code.split('\n').slice(0, 15);
  for (let l of lines) {
    let clean = l.trim();
    if (clean.startsWith(';;;') || clean.startsWith('//') || clean.startsWith('/*') || clean.startsWith('#')) {
      let titleMatch = clean.match(/(?:PLUGIN|TOOL|TÊN|TITLE|BỘ CÔNG CỤ)\s*[:=–-]?\s*([^\r\n*]+)/i);
      if (titleMatch && titleMatch[1].trim()) {
        let name = titleMatch[1].trim().replace(/^[*#=;\s]+|[*#=;\s]+$/g, '');
        if (name.length > 2 && name.length < 50) return name;
      }
    }
  }

  let cmds = extractCommandsFromCode(code);
  if (cmds.length > 0) {
    return `⚡ Tool ${cmds[0]}` + (cmds.length > 1 ? ` (+${cmds.length - 1} lệnh)` : '');
  }

  return fallback || `⚡ Script Tùy Chỉnh #${Date.now().toString().slice(-4)}`;
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
function executeToolCode(tool, throwOnError = false) {
  if (!tool || !tool.code || tool.enabled === false) return;
  if (tool._isExecuted) return;
  tool._isExecuted = true;
  let isLsp = tool.type === 'AutoLISP' || (tool.fileName && tool.fileName.endsWith('.lsp')) || tool.code.includes('(defun');

  if (isLsp) {
    try {
      let cmds = executeLispScript(tool.code, tool.id);
      if (cmds.length > 0 && (!tool.commands || tool.commands.length === 0)) {
        tool.commands = cmds;
      }
    } catch (e) {
      tool._isExecuted = false;
      if (throwOnError) throw e;
      console.warn(`Lỗi nạp AutoLISP tool [${tool.name}]:`, e);
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
      tool._isExecuted = false;
      if (throwOnError) throw e;
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
 * Tự động chặn và báo tên cụ thể của từng tệp bị lỗi, không để tệp lỗi làm hỏng hệ thống
 */
async function processFileList(files, showAlert = true) {
  if (!files || files.length === 0) return;

  let loadedCount = 0;
  let allNewCmds = [];
  let errorList = [];

  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    try {
      let content = await readFileAsText(file);
      if (!content || !content.trim()) {
        throw new Error("Tệp rỗng (0 KB), không chứa mã nguồn thực thi.");
      }

      let name = file.name.replace(/\.[^/.]+$/, "");
      let isLsp = file.name.toLowerCase().endsWith('.lsp') || content.includes('(defun');
      let isPy = file.name.toLowerCase().endsWith('.py');

      // 1. Kiểm tra trước lỗi cú pháp JavaScript (Syntax Pre-check)
      if (!isLsp && !isPy) {
        try {
          new Function(content);
        } catch (syntaxErr) {
          throw new Error(`Lỗi cú pháp JavaScript: ${syntaxErr.message}`);
        }
      }

      // 2. Trích xuất danh sách lệnh
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

      // 3. Kích hoạt thực thi mã với chế độ bắt lỗi nghiêm ngặt (throwOnError = true)
      executeToolCode(newTool, true);

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
      console.error(`Lỗi khi nạp file [${file.name}]:`, err);
      errorList.push({
        fileName: file.name,
        error: err.message || String(err)
      });
      if (typeof logToCliHistory === 'function') {
        logToCliHistory(`❌ Bị chặn: Tệp [${file.name}] bị lỗi: ${err.message}`, 'prompt');
      }
    }
  }

  saveCustomToolsToStorage();
  renderApploadTable();

  // 1. Nếu có tệp bị lỗi -> Hiển thị thông báo chặn tệp lỗi với tên file cụ thể
  if (errorList.length > 0) {
    let errHtml = `Hệ thống đã phát hiện và <b>chặn lại ${errorList.length} tệp bị lỗi</b>:<br><br>`;
    errorList.forEach((e) => {
      errHtml += `<div style="background:#1e1e2e; border-left:3px solid #ef4444; padding:8px 12px; margin-bottom:8px; border-radius:4px; text-align:left;">
        <div style="font-weight:700; color:#ef4444; font-size:13px;">📄 Tệp lỗi: ${e.fileName}</div>
        <div style="color:#fca5a5; font-size:12px; margin-top:2px;">⚠️ <b>Chi tiết:</b> ${e.error}</div>
      </div>`;
    });

    if (loadedCount > 0) {
      errHtml += `<div style="color:#22c55e; margin-top:10px; font-weight:700;">✅ Các tệp hợp lệ khác (${loadedCount} Tool) đã được nạp thành công:</div>`;
    }

    showCadAlert({
      title: "Phát Hiện Tệp Tool Bị Lỗi!",
      message: errHtml,
      cmds: allNewCmds,
      type: "error"
    });
    return;
  }

  // 2. Nếu tất cả đều nạp thành công không có lỗi
  let msg = `🧩 Đã nạp thành công ${loadedCount} Tool (${allNewCmds.length} lệnh sẵn sàng: ${allNewCmds.join(', ')}).`;
  setInfo(msg, 'success');
  if (typeof logToCliHistory === 'function') {
    logToCliHistory(msg, 'success');
  }
  if (showAlert && loadedCount > 0) {
    showCadAlert({
      title: "Đã Nạp Thành Công Tool Mở Rộng!",
      message: `Hệ thống đã nhận diện và nạp thành công <b>${loadedCount}</b> Tool mới.<br>Các lệnh CLI đã sẵn sàng sử dụng:`,
      cmds: allNewCmds,
      type: "success"
    });
  }
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
 * Đăng ký script nhập tay trực tiếp từ form (Tự động nhận diện lệnh & tên Tool)
 */
function registerCustomTool() {
  let codeEl = document.getElementById('new-tool-code');
  if (!codeEl) return;

  let code = codeEl.value.trim();
  if (!code) {
    alert("Vui lòng dán nội dung mã AutoLISP (.lsp) hoặc JavaScript (.js) vào khung.");
    return;
  }

  let isLsp = code.includes('(defun') || code.startsWith(';') || code.includes(';;<JS_ENGINE>');
  let cmds = extractCommandsFromCode(code);
  let name = extractToolNameFromCode(code);

  if (cmds.length === 0) {
    // Nếu không tìm thấy định nghĩa c:CMD cụ thể, tạo lệnh gọi mặc định
    let defaultCmd = 'TOOL_' + Date.now().toString().slice(-4);
    cmds = [defaultCmd];
    window.registerCommand(defaultCmd, function() {
      try {
        (new Function(code))();
      } catch (e) {
        console.error("Lỗi thực thi script:", e);
      }
    }, `Thực thi script [${name}]`);
  }

  let newTool = {
    id: 'tool_custom_' + Date.now(),
    name: name,
    fileName: isLsp ? (cmds[0] ? cmds[0].toLowerCase() + '.lsp' : 'custom_tool.lsp') : (cmds[0] ? cmds[0].toLowerCase() + '.js' : 'custom_tool.js'),
    cmd: cmds[0] || 'PLUGIN',
    commands: cmds,
    desc: `Tự động nhận diện (${cmds.length} lệnh: ${cmds.join(', ')})`,
    type: isLsp ? 'AutoLISP Plugin' : 'JavaScript Plugin',
    enabled: true,
    code: code,
    loadedAt: Date.now()
  };

  executeToolCode(newTool);

  // Cập nhật nếu đã có tool cùng tên/lệnh
  let existingIdx = customTools.findIndex(t => t.name === newTool.name || (t.cmd && t.cmd === newTool.cmd));
  if (existingIdx >= 0) {
    customTools[existingIdx] = newTool;
  } else {
    customTools.push(newTool);
  }

  saveCustomToolsToStorage();

  codeEl.value = '';
  renderApploadTable();

  let successMsg = `⚡ Đã nạp thành công [${name}] (${cmds.length} lệnh sẵn sàng: ${cmds.join(', ')}).`;
  setInfo(successMsg, 'success');
  if (typeof logToCliHistory === 'function') {
    logToCliHistory(successMsg, 'success');
  }
  showCadAlert({
    title: `Đã Nạp Thành Công [${name}]!`,
    message: `Đã tự động nhận diện và đăng ký <b>${cmds.length}</b> lệnh CLI mới vào hệ thống:`,
    cmds: cmds,
    type: "success"
  });
}

/**
 * Gỡ bỏ một Tool cụ thể
 */
function removeCustomTool(idx) {
  if (customTools[idx]) {
    let toolName = customTools[idx].name;
    showCadConfirm({
      title: "Gỡ Bỏ Tool Mở Rộng",
      message: `Bạn có chắc chắn muốn gỡ bỏ Tool <b style="color:#38bdf8;">[${toolName}]</b> khỏi hệ thống VinaCAD không?`,
      type: "danger",
      confirmText: "🗑️ Gỡ Bỏ",
      cancelText: "Hủy Bỏ",
      onConfirm: function() {
        customTools.splice(idx, 1);
        saveCustomToolsToStorage();
        renderApploadTable();
        setInfo(`🗑️ Đã gỡ bỏ Tool [${toolName}].`);
        showCadAlert({
          title: "Đã Gỡ Bỏ",
          message: `Đã gỡ bỏ thành công tool <b>[${toolName}]</b>.`,
          type: "info"
        });
      }
    });
  }
}

/**
 * Gỡ bỏ tất cả các Tool mở rộng
 */
function clearAllCustomTools() {
  if (customTools.length === 0) {
    showCadAlert({
      title: "Thông Báo",
      message: "Hiện không có tool ngoài nào để gỡ.",
      type: "info"
    });
    return;
  }
  showCadConfirm({
    title: "Gỡ Bỏ Tất Cả Tool Mở Rộng",
    message: `Bạn có chắc chắn muốn gỡ bỏ <b style="color:#ef4444;">TẤT CẢ ${customTools.length} tool ngoài</b> đã nạp không?<br><span style="color:#94a3b8; font-size:12px; margin-top:6px; display:inline-block;">⚡ Thao tác này sẽ xóa sạch toàn bộ các lệnh và script mở rộng khỏi hệ thống VinaCAD.</span>`,
    type: "danger",
    confirmText: "🗑️ Gỡ Tất Cả",
    cancelText: "Hủy Bỏ",
    onConfirm: function() {
      customTools = [];
      dynamicCommands = {};
      saveCustomToolsToStorage();
      renderApploadTable();
      setInfo("🗑️ Đã xóa sạch toàn bộ các tool mở rộng.");
      showCadAlert({
        title: "Đã Xóa Sạch",
        message: "Đã xóa sạch toàn bộ các tool mở rộng khỏi hệ thống VinaCAD.",
        type: "success"
      });
    }
  });
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

// ===============================================================================
//     CENTERED MODERN NOTIFICATION & ALERT SYSTEM (THAY THẾ ALERT MẶC ĐỊNH)
// ===============================================================================
window.showCadAlert = function(options) {
  let title = "✨ Thông Báo";
  let message = "";
  let cmds = [];
  let type = "info";
  let onConfirm = null;

  if (typeof options === 'string') {
    message = options;
    if (message.includes('Đã nạp thành công') || message.includes('lệnh') || message.includes('CLI')) {
      title = "🧩 Nạp Tool Thành Công!";
      type = "success";
      let match = message.match(/(?:lệnh[^:]*:|nhận diện:)\s*([A-Za-z0-9_,\s]+)/i);
      if (match && match[1]) {
        cmds = match[1].split(/[, \n]+/).filter(c => c && c.trim().length > 0);
      }
    } else if (message.includes('Lỗi') || message.includes('lỗi') || message.includes('không')) {
      title = "⚠️ Chú Ý";
      type = "warning";
    }
  } else if (typeof options === 'object' && options !== null) {
    title = options.title || title;
    message = options.message || "";
    cmds = options.cmds || [];
    type = options.type || type;
    onConfirm = options.onConfirm || null;
  }

  const backdrop = document.getElementById('cad-dialog-backdrop');
  const titleEl = document.getElementById('cad-dialog-title');
  const bodyEl = document.getElementById('cad-dialog-body');
  const footerEl = document.getElementById('cad-dialog-footer');

  if (!backdrop || !titleEl || !bodyEl) {
    console.log(`[${title}] ${message}`);
    return;
  }

  let icon = "✨";
  if (type === 'success') icon = "🚀";
  else if (type === 'warning') icon = "⚠️";
  else if (type === 'error') icon = "❌";
  else if (type === 'save') icon = "💾";

  titleEl.innerHTML = `${icon} ${title}`;
  if (type === 'error') titleEl.style.color = '#ef4444';
  else if (type === 'warning') titleEl.style.color = '#facc15';
  else if (type === 'success') titleEl.style.color = '#38bdf8';
  else titleEl.style.color = '#38bdf8';

  let formattedMsg = message.replace(/\n/g, '<br>');
  let html = `<div style="font-size:13.5px; line-height:1.6;">${formattedMsg}</div>`;

  if (Array.isArray(cmds) && cmds.length > 0) {
    html += `<div style="margin-top:14px; font-weight:700; color:#94a3b8; font-size:12px;">👉 Nhấp vào lệnh để chạy ngay (hoặc gõ vào Command):</div>`;
    html += `<div class="cad-dialog-cmds">`;
    for (let c of cmds) {
      if (!c) continue;
      html += `<span class="cad-dialog-cmd-chip" onclick="closeCadDialog(); runCommand('${c}');" title="Chạy ngay lệnh [${c}]">${c}</span>`;
    }
    html += `</div>`;
  }

  bodyEl.innerHTML = html;

  if (footerEl) {
    footerEl.innerHTML = `<button class="cad-dialog-btn-primary" id="cad-dialog-ok-btn">Đồng Ý (OK)</button>`;
    const okBtn = document.getElementById('cad-dialog-ok-btn');
    if (okBtn) {
      okBtn.onclick = function() {
        closeCadDialog();
        if (typeof onConfirm === 'function') onConfirm();
      };
      setTimeout(() => {
        try { okBtn.focus(); } catch (e) {}
      }, 60);
    }
  }

  backdrop.style.display = 'flex';
};

window.showCadConfirm = function(options) {
  let title = "❓ Xác Nhận Thao Tác";
  let message = "";
  let type = "warning";
  let confirmText = "Đồng Ý";
  let cancelText = "Hủy Bỏ";
  let onConfirm = null;
  let onCancel = null;

  if (typeof options === 'string') {
    message = options;
  } else if (typeof options === 'object' && options !== null) {
    title = options.title || title;
    message = options.message || "";
    type = options.type || type;
    confirmText = options.confirmText || confirmText;
    cancelText = options.cancelText || cancelText;
    onConfirm = options.onConfirm || null;
    onCancel = options.onCancel || null;
  }

  const backdrop = document.getElementById('cad-dialog-backdrop');
  const titleEl = document.getElementById('cad-dialog-title');
  const bodyEl = document.getElementById('cad-dialog-body');
  const footerEl = document.getElementById('cad-dialog-footer');

  if (!backdrop || !titleEl || !bodyEl || !footerEl) {
    if (confirm(message)) {
      if (typeof onConfirm === 'function') onConfirm();
    } else {
      if (typeof onCancel === 'function') onCancel();
    }
    return;
  }

  let icon = "❓";
  let confirmBtnClass = "cad-dialog-btn-primary";
  if (type === 'danger' || type === 'error') {
    icon = "🗑️";
    titleEl.style.color = '#ef4444';
    confirmBtnClass = "btn btn-danger";
  } else if (type === 'warning') {
    icon = "⚠️";
    titleEl.style.color = '#facc15';
    confirmBtnClass = "btn btn-highlight";
  } else if (type === 'success') {
    icon = "🚀";
    titleEl.style.color = '#4ade80';
  } else {
    icon = "ℹ️";
    titleEl.style.color = '#38bdf8';
  }

  titleEl.innerHTML = `${icon} ${title}`;
  let formattedMsg = message.replace(/\n/g, '<br>');
  bodyEl.innerHTML = `<div style="font-size:14px; line-height:1.6; color:#e2e8f0;">${formattedMsg}</div>`;

  footerEl.innerHTML = `
    <button class="cad-dialog-btn-cancel" id="cad-dialog-cancel-btn">${cancelText}</button>
    <button class="${confirmBtnClass}" id="cad-dialog-confirm-action-btn" style="padding:7px 20px; font-weight:800; font-size:13px; border-radius:6px; cursor:pointer;">${confirmText}</button>
  `;

  document.getElementById('cad-dialog-cancel-btn').onclick = function() {
    closeCadDialog();
    if (typeof onCancel === 'function') onCancel();
  };

  document.getElementById('cad-dialog-confirm-action-btn').onclick = function() {
    closeCadDialog();
    if (typeof onConfirm === 'function') onConfirm();
  };

  backdrop.style.display = 'flex';
};

window.closeCadDialog = function() {
  const backdrop = document.getElementById('cad-dialog-backdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
  }
};

window.alert = function(msg) {
  window.showCadAlert(msg);
};
