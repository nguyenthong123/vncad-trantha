"""
================================================================================
          SAMPLE AUTOMATION TOOL: BÓC TÁCH KẾT CẤU & TẠO LƯỚI TRỤC CAD
================================================================================
File mẫu để kiểm tra tính năng nạp Tool động (.py) trên Mini Web CAD.
Khi được nạp vào qua giao diện, hàm `run_tool(engine)` sẽ được gọi tự động.
"""

from web_cad_app import Line, Rectangle, Circle, TextAnnotation, CADEngine


def run_tool(engine: CADEngine) -> str:
    """
    Hàm thực thi chính của Tool tự động hóa.
    Nhiệm vụ:
    1. Đọc kích thước bao (Bounding Box) của toàn bộ bản vẽ hiện tại.
    2. Tự động sinh hệ lưới trục kết cấu (Grid Axes X/Y) và đường gióng kích thước.
    3. Vẽ móng đơn / đài cọc tại 4 góc công trình.
    4. Tính toán thể tích bê tông móng và trọng lượng cốt thép dự toán.
    """
    if not engine.entities:
        return "⚠️ Bản vẽ hiện đang trống. Hãy vẽ ít nhất một hình trước khi chạy Tool này."

    # 1. Tính toán Bounding Box tổng thể
    all_min_x, all_min_y, all_max_x, all_max_y = [], [], [], []
    for e in engine.entities:
        bx0, by0, bx1, by1 = e.bounding_box()
        all_min_x.append(bx0)
        all_min_y.append(by0)
        all_max_x.append(bx1)
        all_max_y.append(by1)

    min_x, max_x = min(all_min_x), max(all_max_x)
    min_y, max_y = min(all_min_y), max(all_max_y)

    width = max_x - min_x
    height = max_y - min_y

    offset = 600.0  # Khoảng gióng ra ngoài mép tường

    # 2. Sinh đường trục định vị & Ký hiệu trục (A, B / 1, 2)
    # Trục ngang (1, 2)
    axis_y1 = Line((min_x - offset, min_y), (max_x + offset, min_y), layer="GRID", color="#94a3b8")
    axis_y2 = Line((min_x - offset, max_y), (max_x + offset, max_y), layer="GRID", color="#94a3b8")
    
    # Trục dọc (A, B)
    axis_x1 = Line((min_x, min_y - offset), (min_x, max_y + offset), layer="GRID", color="#94a3b8")
    axis_x2 = Line((max_x, min_y - offset), (max_x, max_y + offset), layer="GRID", color="#94a3b8")

    engine.entities.extend([axis_y1, axis_y2, axis_x1, axis_x2])

    # Ký hiệu bong bóng trục (Circle + Text)
    # Trục 1, Trục 2
    engine.entities.append(Circle(min_x - offset - 150, min_y, 150, layer="GRID", color="#38bdf8"))
    engine.entities.append(TextAnnotation(min_x - offset - 180, min_y - 40, "1", size=11, color="#38bdf8"))
    
    engine.entities.append(Circle(min_x - offset - 150, max_y, 150, layer="GRID", color="#38bdf8"))
    engine.entities.append(TextAnnotation(min_x - offset - 180, max_y - 40, "2", size=11, color="#38bdf8"))

    # Trục A, Trục B
    engine.entities.append(Circle(min_x, min_y - offset - 150, 150, layer="GRID", color="#38bdf8"))
    engine.entities.append(TextAnnotation(min_x - 30, min_y - offset - 190, "A", size=11, color="#38bdf8"))

    engine.entities.append(Circle(max_x, min_y - offset - 150, 150, layer="GRID", color="#38bdf8"))
    engine.entities.append(TextAnnotation(max_x - 30, min_y - offset - 190, "B", size=11, color="#38bdf8"))

    # 3. Tự động bố trí 4 Móng Đơn Kết Cấu (Footing Pads) 800x800mm tại 4 góc
    footing_size = 800.0
    corners = [
        (min_x, min_y), (max_x, min_y),
        (min_x, max_y), (max_x, max_y)
    ]
    for cx, cy in corners:
        pad = Rectangle(cx - footing_size/2, cy - footing_size/2, footing_size, footing_size, layer="FOUNDATION", color="#ec4899")
        engine.entities.append(pad)

    # 4. Tính toán kết cấu & dự toán
    footing_count = len(corners)
    footing_depth_m = 0.5  # Chiều dày móng 50cm
    pad_area_m2 = (footing_size / 1000.0) ** 2
    concrete_vol_m3 = footing_count * pad_area_m2 * footing_depth_m
    rebar_kg = concrete_vol_m3 * 110.0  # Hàm lượng thép ~110kg thép / m3 bê tông móng

    report = (
        f"🏗️ **KẾT QUẢ TỰ ĐỘNG HÓA KẾT CẤU & BÓC TÁCH:**\n"
        f"- Kích thước phủ bì: **{width/1000.0:.2f}m x {height/1000.0:.2f}m**\n"
        f"- Đã tạo **4 Trục Định Vị (A-B, 1-2)** kèm bong bóng ký hiệu.\n"
        f"- Đã bố trí tự động **{footing_count} Móng đơn (800x800mm)** tại các góc chịu lực.\n"
        f"- Thể tích Bê tông móng M250: **{concrete_vol_m3:.2f} m³**\n"
        f"- Khối lượng Thép móng dự toán (CB300): **{rebar_kg:.1f} kg** (~{rebar_kg/1000.0:.2f} tấn)"
    )

    return report
