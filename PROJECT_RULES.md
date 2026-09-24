# 📜 QUY TẮC PHÁT TRIỂN & KIẾN TRÚC DỰ ÁN VINACAD

> [!IMPORTANT]
> **QUY TẮC CỐT LÕI BẮT BUỘC TUÂN THỦ (CORE ARCHITECTURAL RULES):**
> 1. **Tách biệt 100% giữa Lõi Phần Mềm CAD và File Plugin Nạp Ngoài.**
> 2. **Khi người dùng yêu cầu sửa đổi, tối ưu hoặc cập nhật tính năng của Tool (ví dụ: `TT600`, Trần thả, Bóc tách vật tư...), CHỈ ĐƯỢC PHÉP SỬA TRÊN TỆP PLUGIN TẠI THƯ MỤC `plugins/`. TUYỆT ĐỐI KHÔNG SỬA VÀO LÕI PHẦN MỀM `src/`.**

---

## 🏛️ 1. Lõi Phần Mềm CAD (`src/`) - Thuần Túy & Độc Lập

* **Vai trò:** Là động cơ đồ họa CAD 2D tổng quát (tương tự như AutoCAD Engine gốc).
* **Phạm vi chức năng được phép trong lõi:**
  * Bộ công cụ vẽ cơ bản: `LINE`, `POLYLINE`, `RECTANGLE`, `CIRCLE`, `ARC`, `ELLIPSE`, `POLYGON`, `HATCH`, `DIMENSION`, `TEXT`.
  * Bộ công cụ hiệu chỉnh: `MOVE`, `COPY`, `ROTATE`, `SCALE`, `MIRROR`, `OFFSET`, `EXPLODE`, `ERASE`.
  * Hệ thống hỗ trợ vẽ: Bắt điểm `OSNAP`, Khóa vuông góc `ORTHO (F8)`, Nhập khoảng cách `Dynamic Input`.
  * Quản lý dữ liệu & Bảng thuộc tính: Bảng Quick Properties (`PR`), Đổi màu, Layer, Kiểu nét.
  * Cơ sở dữ liệu IndexedDB (`src/js/core/db.js`): Tự động lưu ngầm thời gian thực, phục hồi bản vẽ khi F5.
  * Trình nạp Plugin `APPLOAD` (`src/js/ui/appload_modal.js`): Cho phép người dùng duyệt file `.lsp`, `.js` từ máy tính nạp vào bộ nhớ động.
  * Trình xuất nhập: JSON và DXF chuẩn AutoCAD.
* **Điều CẤM:**
  * ❌ **KHÔNG** nhúng cứng mã nguồn các công cụ nghiệp vụ chuyên ngành (trần thả, trần nano, bóc tách vật tư cụ thể...) vào trong `src/` hay `cad_engine.html`.
  * ❌ **KHÔNG** để sẵn các lệnh chuyên ngành trong CLI mặc định nếu plugin đó chưa được nạp qua `APPLOAD`.

---

## 🔌 2. Thư Mục Plugins Nạp Ngoài (`plugins/`) - Độc Lập & Tự Chứa (Self-Contained)

* **Vai trò:** Chứa tất cả các công cụ nghiệp vụ chuyên ngành do người dùng viết hoặc nạp vào thông qua lệnh `APPLOAD`.
* **Cấu trúc tệp:**
  * `plugins/trantha600.js`: Mã nguồn JavaScript độc lập của Tool Chia Trần Thả 600x600 & Bóc Tách Vật Tư (TT600).
  * `plugins/trantha600.lsp`: Mã nguồn AutoLISP nạp vào CAD.
* **Quy tắc viết Plugin:**
  * Mỗi file plugin phải là **Self-Contained (Tự chứa hoàn chỉnh)**: Chứa toàn bộ biến, hàm tính toán, nhận diện đa giác, thuật toán chia khung và xuất bảng BOM.
  * Khi người dùng tải file này lên qua hộp thoại `APPLOAD`, plugin sẽ tự động đăng ký lệnh (ví dụ `TT600`) vào hệ thống để người dùng gõ lệnh thực thi.

---

## 🛠️ 3. Quy Trình Làm Việc Khi Nhận Yêu Cầu Từ Người Dùng

1. **Nếu người dùng yêu cầu sửa/cải tiến Tool (Trần thả, Chia tấm, Dự toán, Kích thước...):**
   * 👉 **Chỉ chỉnh sửa tệp:** `plugins/trantha600.js` và `plugins/trantha600.lsp`.
   * 👉 **Không đụng vào:** `src/` hoặc `build.py`.
2. **Nếu người dùng yêu cầu sửa tính năng lõi CAD (Bắt điểm, Phím tắt F8, Zoom/Pan, Vẽ Line/Circle, CSDL IndexedDB, Giao diện APPLOAD):**
   * 👉 **Chỉnh sửa module tương ứng trong `src/`**, sau đó chạy `python3 build.py` để đồng bộ.
