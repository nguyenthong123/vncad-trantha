# 📐 VinaCAD Professional Web Studio - Chạy Trực Tiếp Trên Google Colab

Hệ thống Web CAD 2D chuyên nghiệp, kiến trúc module hóa đa tầng (**Modular Architecture**), tích hợp hệ thống dòng lệnh **AutoCAD CLI Emulator**, bảng thuộc tính **Quick Properties (`PR` / `MO`)**, cơ chế nạp plugin ngoài **`APPLOAD`**, chế độ bắt điểm thông minh **OSNAP**, khóa góc **ORTHO (F8)**, ô nhập số trực tiếp **Dynamic Input (DYNMODE)**, và cơ sở dữ liệu **IndexedDB** tự động lưu ngầm thời gian thực.

---

## 📜 QUY TẮC BẤT DI BẤT DỊCH CỦA DỰ ÁN
Chi tiết xem tại: [PROJECT_RULES.md](file:///Volumes/DATA_SSD/Projects/chay-ban-ve-trong-colab/PROJECT_RULES.md)
* **Lõi phần mềm (`src/`):** Thuần túy là nền tảng CAD 2D tổng quát, không chứa mã nguồn công cụ chuyên ngành.
* **Thư mục Plugin (`plugins/`):** Chứa các file công cụ nghiệp vụ độc lập (`.js`, `.lsp`). Người dùng nạp qua `APPLOAD`. Khi sửa tool chỉ sửa tại đây.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
chay-ban-ve-trong-colab/
├── src/                            # LÕI PHẦN MỀM CAD THUẦN TÚY (CORE ENGINE)
│   ├── index.html                  # Khung giao diện HTML (Ribbon, Viewport, Panels)
│   ├── css/
│   │   ├── main.css                # Giao diện tổng thể, Viewport, HUD & CLI
│   │   ├── ribbon.css              # Thanh công cụ Ribbon và các nút bấm
│   │   ├── properties.css          # Bảng thuộc tính (Quick Properties Palette)
│   │   └── modal.css               # Hộp thoại APPLOAD & Quản lý Tool
│   └── js/
│       ├── core/
│       │   ├── db.js               # CSDL IndexedDB tự động lưu thời gian thực
│       │   ├── state.js            # State toàn cục (entities, camera, undo/redo)
│       │   ├── math.js             # Hàm toán học, biến đổi tọa độ
│       │   └── osnap.js            # Thuật toán bắt điểm tự động AutoCAD (OSNAP)
│       ├── renderer/
│       │   ├── canvas.js           # Vòng lặp 60FPS, Hệ tọa độ UCS Icon, Lưới Grid
│       │   ├── entity_renderer.js  # Render đối tượng hình học, Grip xanh AutoCAD
│       │   └── overlays.js         # Lớp phủ xem trước (Preview khi vẽ)
│       ├── tools/
│       │   ├── draw_tools.js       # Bộ công cụ vẽ (Line, Poly, Rect, Circle, Arc, Text, Dim)
│       │   ├── modify_tools.js     # Bộ công cụ hiệu chỉnh (Move, Copy, Rotate, Scale, Mirror, Offset, Explode)
│       │   └── selection.js        # Bắt va chạm (Hit test) và Quét chọn đối tượng (Window/Crossing)
│       ├── ui/
│       │   ├── properties_panel.js # Bảng thuộc tính (Đổi màu, Layer, Độ dày nét, Sửa kích thước)
│       │   ├── appload_modal.js    # Bảng Quản Lý Tool (APPLOAD), Tải file plugin, Script editor
│       │   └── cli.js              # Xử lý dòng lệnh Command Line (CLI) & Phím tắt
│       └── io/
│           ├── json_io.js          # Mở & Lưu file bản vẽ JSON
│           └── dxf_io.js           # Xuất & Đọc file DXF AutoCAD chuẩn
├── plugins/                        # THƯ MỤC CÔNG CỤ NGOÀI (EXTERNAL PLUGINS)
│   ├── trantha600.js               # Tool Chia Trần Thả 600x600 & Bóc Tách Dự Toán (JavaScript)
│   └── trantha600.lsp              # Tool Chia Trần Thả 600x600 (AutoLISP)
├── PROJECT_RULES.md                # Quy tắc kiến trúc & bảo trì dự án
├── build.py                        # Trình tự động đóng gói lõi CAD (Bundler)
├── web_cad_app.py                  # Server Python Gradio
├── cad_engine.html                 # Bản build standalone đã đóng gói
└── Colab_Mini_CAD.ipynb            # Notebook Google Colab 1-Click
```

---

## 🚀 Hướng Dẫn Chạy Trên Google Colab

1. Mở [Google Colab](https://colab.research.google.com/).
2. Tải lên file [`Colab_Mini_CAD.ipynb`](file:///Volumes/DATA_SSD/Projects/chay-ban-ve-trong-colab/Colab_Mini_CAD.ipynb).
3. Bấm **Runtime** $\to$ **Run all** (hoặc `Ctrl + F9` / `Cmd + F9`).
4. Nhấp vào liên kết công khai Gradio để mở giao diện Web CAD toàn màn hình.
5. Để sử dụng Tool Trần Thả: Gõ lệnh `APPLOAD` (hoặc phím tắt `AP`), nạp file `plugins/trantha600.js` và gõ lệnh `TT600`.

---

## ⌨️ BẢNG TRA CỨU CÂU LỆNH AUTOCAD CƠ BẢN

| Lệnh | Phím tắt | Chức năng |
| :--- | :--- | :--- |
| **`APPLOAD`** | `AP` / `TOOL` | **Bảng Quản Lý & Nạp Tool ngoài (`.lsp`, `.js`)** |
| **`PROPERTIES`** | `PR` / `MO` | **Bảng Thuộc Tính (Đổi Màu / Độ Dày / Kiểu Nét / Layer)** |
| **`COLOR`** | `COL` / `MAU` | Đổi màu vẽ hiện tại hoặc mở bảng chọn màu |
| **`L`** | `L` | Vẽ đoạn thẳng Line (nhập khoảng cách qua Dynamic Input) |
| **`PL`** | `PL` | Vẽ đường đa tuyến liên tục Polyline |
| **`REC`** | `REC` | Vẽ hình chữ nhật Rectangle |
| **`C`** | `C` | Vẽ hình tròn Circle (nhập bán kính $R$) |
| **`A`** | `A` | Vẽ cung tròn Arc qua 3 điểm |
| **`EL`** | `EL` | Vẽ hình Elip Ellipse |
| **`POL`** | `POL` | Vẽ đa giác đều Polygon |
| **`H`** | `H` | Tô gạch mặt cắt xây dựng Hatch |
| **`DLI`** | `DLI` | Ghi đường kích thước Linear Dimension |
| **`DT`** | `DT` | Đặt chữ kỹ thuật Text |
| **`CO`** / `CP` | `CO` | Copy sao chép đối tượng |
| **`M`** | `M` | Di chuyển đối tượng Move |
| **`O`** | `O` | Offset song song (vẽ tường đôi) |
| **`RO`** | `RO` | Xoay đối tượng Rotate |
| **`SC`** | `SC` | Thu phóng tỉ lệ Scale |
| **`MI`** | `MI` | Lấy đối xứng gương Mirror |
| **`X`** | `X` | Phá vỡ đối tượng Explode |
| **`P`** | `P` | Pan dời góc nhìn bản vẽ |
| **`DEL`** / `E` | `DEL` | Xóa đối tượng Erase |
| **`F8`** | `F8` | Bật/Tắt chế độ khóa vuông góc Ortho Mode |
| **`OPEN`** | `OPEN` | Mở file bản vẽ JSON hoặc DXF |
| **`SAVE`** | `SAVE` | Lưu file bản vẽ JSON |
| **`DXF`** | `DXF` | Xuất bản vẽ sang định dạng AutoCAD DXF |
| **`Z`** | `Z` | Zoom All (Zoom Extents) |
| **`U`** | `U` | Undo hoàn tác |
| **`CLEAR`** | `CLEAR` | Xóa sạch toàn bộ bản vẽ |
