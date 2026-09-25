// ===============================================================================
//     VINACAD RIBBON QUICK BUTTON & COMMAND FINDER / SPOTLIGHT
//     Tìm kiếm nút công cụ, tự động cuộn thanh Ribbon và làm sáng nổi bật nút
// ===============================================================================

(function() {
  function removeDiacritics(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  // Danh mục từ khóa phong phú hỗ trợ tìm kiếm mọi nút công cụ
  const BUTTON_DEFINITIONS = [
    { id: 'btn-SELECT', label: '👆 Chọn (SELECT)', tags: 'select chon pick huy tro chuot mui ten esc click', desc: 'Chọn đối tượng trên bản vẽ' },
    { id: 'btn-MOVE', label: '✥ Move (M)', tags: 'move di chuyen doi cho m', desc: 'Di chuyển đối tượng' },
    { id: 'btn-COPY', label: '📋 Copy (CO)', tags: 'copy sao chep nhan ban co cp', desc: 'Sao chép đối tượng' },
    { id: 'btn-OFFSET', label: '⚡ Offset (O)', tags: 'offset song song tuong doi khoang cach o', desc: 'Tạo đối tượng song song' },
    { id: 'btn-ROTATE', label: '🔄 Rotate (RO)', tags: 'rotate xoay doi huong goc ro', desc: 'Xoay đối tượng quanh điểm gốc' },
    { id: 'btn-SCALE', label: '📐 Scale (SC)', tags: 'scale phong to thu nho ti le sc', desc: 'Thu phóng tỉ lệ đối tượng' },
    { id: 'btn-MIRROR', label: '🪞 Mirror (MI)', tags: 'mirror doi xung guong mi', desc: 'Lấy đối xứng gương' },
    { id: 'btn-EXPLODE', label: '💥 Explode (X)', tags: 'explode pha vo tach net x', desc: 'Phá vỡ hình khối thành đoạn thẳng' },
    { id: 'btn-ERASE', label: '❌ Xóa (DEL)', tags: 'erase xoa delete del e bo', desc: 'Xóa đối tượng được chọn' },
    { id: 'btn-CLEAR', label: '🧹 Xóa Hết (CLEAR)', tags: 'clear xoa het lam sach reset cls', desc: 'Xóa sạch toàn bộ bản vẽ' },
    
    { id: 'btn-LINE', label: '📏 Line (L)', tags: 'line doan thang net thang l ve', desc: 'Vẽ đoạn thẳng' },
    { id: 'btn-POLYLINE', label: '📐 Polyline (PL)', tags: 'polyline pl da tuyen lien tuc gap khuc', desc: 'Vẽ đường đa tuyến' },
    { id: 'btn-RECTANGLE', label: '⬛ Rectangle (REC)', tags: 'rectangle rect hinh chu nhat rec hop', desc: 'Vẽ hình chữ nhật' },
    { id: 'btn-CIRCLE', label: '⭕ Circle (C)', tags: 'circle tron hinh tron ban kinh c', desc: 'Vẽ hình tròn' },
    { id: 'btn-ARC', label: '⌒ Arc (A)', tags: 'arc cung tron uon cong a', desc: 'Vẽ cung tròn qua 3 điểm' },
    { id: 'btn-ELLIPSE', label: '🥚 Ellipse (EL)', tags: 'ellipse elip hinh bau duc el', desc: 'Vẽ hình elip' },
    { id: 'btn-POLYGON', label: '🔷 Polygon (POL)', tags: 'polygon da giac luc giac 6 canh pol', desc: 'Vẽ đa giác đều' },
    { id: 'btn-HATCH', label: '🎨 Hatch (H)', tags: 'hatch to vat lieu gach mat cat h', desc: 'Tô vật liệu Hatch' },
    { id: 'btn-DIMENSION', label: '📏 Dimension (DLI)', tags: 'dimension dim dli do kich thuoc khoang cach', desc: 'Ghi kích thước đoạn thẳng' },
    { id: 'btn-TEXT', label: '🔤 Text (DT)', tags: 'text dt mt chu viet van ban ghi chu', desc: 'Chèn chữ kỹ thuật' },

    { id: 'btn-PROPERTIES', label: '📋 Bảng Thuộc Tính (PR)', tags: 'properties pr prop mo ch thuoc tinh mau layer net', desc: 'Mở bảng Quick Properties' },
    { id: 'btn-QUICKSAVE', label: '💾 Lưu Bản Vẽ (QSAVE / Ctrl+S)', tags: 'save qsave luu ban ve tien trinh csdl ctrl s safe protect csdl tu dong', desc: 'Lưu bản vẽ & toàn bộ tiến trình vào CSDL' },
    { id: 'btn-NEW', label: '📄 Mới (Ctrl+N)', tags: 'new qnew ban ve moi tao moi ctrl n clearall', desc: 'Tạo bản vẽ mới sạch sẽ' },
    { id: 'btn-APPLOAD', label: '🧩 Nạp Tool (APPLOAD)', tags: 'appload ap tool plugin autolisp js addin nap mo rong', desc: 'Quản lý & nạp plugin mở rộng' },
    { id: 'btn-OPEN', label: '📂 Mở File (OPEN)', tags: 'open load file mo import nap json dxf', desc: 'Mở file bản vẽ JSON hoặc DXF' },
    { id: 'btn-SAVE', label: '📤 Xuất JSON', tags: 'save json xuat export download tai file', desc: 'Xuất bản vẽ dạng file JSON tải về máy' },
    { id: 'btn-DXF', label: '📥 Xuất DXF', tags: 'dxf export autocad xuat file cad', desc: 'Xuất file DXF chuẩn AutoCAD' },
    { id: 'btn-ORTHO', label: '📐 ORTHO (F8)', tags: 'ortho f8 khoa vuong goc 90 do thang', desc: 'Bật/Tắt khóa vuông góc 90°' },
    { id: 'btn-DIST', label: '📏 Đo (DI)', tags: 'dist di do khoang cach', desc: 'Đo khoảng cách giữa 2 điểm' },
    { id: 'btn-ID', label: '🎯 Soi Tọa Độ (ID)', tags: 'id check inspect toado soi o tran 600x600 toa do wcs hud', desc: 'Soi tọa độ WCS, kiểm tra ô trần 600x600 & vật thể' },
    { id: 'btn-PAN', label: '✋ Pan (P)', tags: 'pan p doi goc nhin keo man hinh', desc: 'Di chuyển góc nhìn bản vẽ' },
    { id: 'btn-ZOOM', label: '🔍 Zoom All (Z)', tags: 'zoom z all thu phong phong to toan bo', desc: 'Phóng to thu gọn toàn bộ bản vẽ' },
    { id: 'btn-TOP', label: '⬆️ Top (0°)', tags: 'top plan vtop viewtop goc nhin 0 do mat bang chuan', desc: 'Đưa góc nhìn về chuẩn 0° Top' },
    { id: 'btn-ROTATEVIEW', label: '🔄 Xoay 15°', tags: 'rotateview rv viewrotate xoay goc nhin 2d 15 do nghieng', desc: 'Xoay góc nhìn 2D 15 độ' },
    { id: 'btn-VIEW3D', label: '📦 Xem 3D', tags: '3d tt3d view3d iso phoi canh goc nghieng isometric tran tha', desc: 'Mở cửa sổ 3D phối cảnh' },
    { id: 'btn-SECTION', label: '🔍 Mặt Cắt', tags: 'section ttsec sec mat cat chi tiet cau tao 2d', desc: 'Mở bản vẽ mặt cắt kỹ thuật 2D' },
    { id: 'btn-UNDO', label: '↩️ Undo', tags: 'undo u ctrl z hoan tac quay lai tro lai', desc: 'Hoàn tác thao tác trước' },
    { id: 'btn-REDO', label: '↪️ Redo', tags: 'redo ctrl y lam lai tien toi', desc: 'Làm lại thao tác vừa Undo' }
  ];

  window.highlightAndNavigateToButton = function(btnIdOrElement) {
    let btn = null;
    if (typeof btnIdOrElement === 'string') {
      btn = document.getElementById(btnIdOrElement);
    } else if (btnIdOrElement instanceof HTMLElement) {
      btn = btnIdOrElement;
    }

    if (!btn) {
      console.warn("Không tìm thấy nút:", btnIdOrElement);
      return;
    }

    // 1. Cuộn mượt thanh Ribbon để đưa nút vào chính giữa tầm nhìn
    btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    // 2. Thêm hiệu ứng phát sáng Neon Pulsing nổi bật
    btn.classList.remove('btn-spotlight-highlight');
    void btn.offsetWidth; // Trigger reflow để khởi động lại animation nếu bấm nhiều lần
    btn.classList.add('btn-spotlight-highlight');

    setTimeout(() => {
      btn.classList.remove('btn-spotlight-highlight');
    }, 2400);
  };

  window.initRibbonSearch = function() {
    const input = document.getElementById('ribbon-search-input');
    const dropdown = document.getElementById('ribbon-search-dropdown');
    const clearBtn = document.getElementById('ribbon-search-clear');
    if (!input || !dropdown) return;

    let selectedIndex = -1;
    let currentResults = [];

    function renderResults(query) {
      let q = removeDiacritics(query.trim());
      if (!q) {
        dropdown.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'none';
        return;
      }

      if (clearBtn) clearBtn.style.display = 'block';

      // Lọc danh sách nút phù hợp
      currentResults = BUTTON_DEFINITIONS.filter(item => {
        let labelClean = removeDiacritics(item.label);
        let tagsClean = removeDiacritics(item.tags);
        let descClean = removeDiacritics(item.desc);
        return labelClean.includes(q) || tagsClean.includes(q) || descClean.includes(q);
      });

      if (currentResults.length === 0) {
        dropdown.innerHTML = `
          <div style="padding:10px; color:#94a3b8; font-size:11px; text-align:center;">
            🔍 Không tìm thấy nút nào khớp với "<b>${query}</b>"
          </div>
        `;
        dropdown.style.display = 'block';
        selectedIndex = -1;
        return;
      }

      dropdown.innerHTML = currentResults.map((item, idx) => `
        <div class="ribbon-search-item ${idx === selectedIndex ? 'selected' : ''}" data-index="${idx}" data-btn="${item.id}">
          <div>
            <div style="font-weight:700;">${item.label}</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${item.desc}</div>
          </div>
          <span class="ribbon-search-item-badge">Tìm nút 🎯</span>
        </div>
      `).join('');

      dropdown.style.display = 'block';

      // Gắn sự kiện click cho từng mục
      dropdown.querySelectorAll('.ribbon-search-item').forEach(el => {
        el.addEventListener('click', () => {
          let btnId = el.getAttribute('data-btn');
          selectAndTriggerItem(btnId);
        });
      });
    }

    function selectAndTriggerItem(btnId) {
      let btn = document.getElementById(btnId);
      if (btn) {
        window.highlightAndNavigateToButton(btn);
        // Tự động kích hoạt nút nếu người dùng chọn
        try {
          btn.click();
        } catch (e) {
          console.error(e);
        }
      }
      dropdown.style.display = 'none';
      input.blur();
    }

    input.addEventListener('input', (e) => {
      selectedIndex = -1;
      renderResults(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex + 1) % currentResults.length;
          updateSelectedHighlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentResults.length > 0) {
          selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
          updateSelectedHighlight();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
          selectAndTriggerItem(currentResults[selectedIndex].id);
        } else if (currentResults.length > 0) {
          selectAndTriggerItem(currentResults[0].id);
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        input.blur();
      }
    });

    function updateSelectedHighlight() {
      let items = dropdown.querySelectorAll('.ribbon-search-item');
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        dropdown.style.display = 'none';
        clearBtn.style.display = 'none';
        input.focus();
      });
    }

    // Đóng dropdown khi nhấp ra ngoài
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ribbon-search-container')) {
        dropdown.style.display = 'none';
      }
    });
  };

  // Khởi động khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initRibbonSearch);
  } else {
    window.initRibbonSearch();
  }
})();
