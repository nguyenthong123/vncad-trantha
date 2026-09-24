#!/usr/bin/env python3
"""
================================================================================
                    VINACAD MODULAR BUILD & BUNDLER
  1. Bundles src/ (HTML, CSS, JS modules) into standalone cad_engine.html & Colab
  2. Bundles plugins_src/ (modular plugin code) into plugins/ (.js & .lsp)
================================================================================
"""

import os
import re
import json

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(CURRENT_DIR, "src")
PLUGINS_SRC_DIR = os.path.join(CURRENT_DIR, "plugins_src")
PLUGINS_DIR = os.path.join(CURRENT_DIR, "plugins")
OUTPUT_HTML = os.path.join(CURRENT_DIR, "cad_engine.html")
NOTEBOOK_PATH = os.path.join(CURRENT_DIR, "Colab_Mini_CAD.ipynb")

def read_src_file(rel_path):
    full_path = os.path.join(SRC_DIR, rel_path)
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()
    print(f"⚠️ Warning: File not found: {full_path}")
    return ""

def read_plugin_file(rel_path):
    full_path = os.path.join(PLUGINS_SRC_DIR, rel_path)
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()
    print(f"⚠️ Warning: Plugin file not found: {full_path}")
    return ""

def build_plugins():
    if not os.path.exists(PLUGINS_SRC_DIR):
        return ""
    print("🧩 Building Plugins from modular plugins_src/...")
    os.makedirs(PLUGINS_DIR, exist_ok=True)
    
    # 1. TRANTHA600 Plugin
    tt600_modules = [
        "trantha600/1_geometry.js",
        "trantha600/2_algorithm.js",
        "trantha600/3_dimensions.js",
        "trantha600/4_bom.js",
        "trantha600/5_ui_toolbar.js",
        "trantha600/6_view_3d.js",
        "trantha600/7_view_section.js",
        "trantha600/index.js"
    ]
    
    tt600_js_parts = []
    for mod in tt600_modules:
        content = read_plugin_file(mod)
        if content:
            tt600_js_parts.append(f"// === MODULE: {mod} ===\n" + content)
            
    tt600_bundled_js = "\n\n".join(tt600_js_parts)
    
    # Write plugins/trantha600.js
    tt600_js_path = os.path.join(PLUGINS_DIR, "trantha600.js")
    with open(tt600_js_path, "w", encoding="utf-8") as f:
        f.write(tt600_bundled_js)
    print(f"  ✅ Generated {tt600_js_path} ({len(tt600_bundled_js):,} bytes)")
    
    # Write plugins/trantha600.lsp (AutoLISP wrapper)
    tt600_lsp_header = """;;; ===============================================================================
;;;     VINACAD AUTOLISP PLUGIN: CHIA TRẦN THẢ 600x600 & BÓC TÁCH THI CÔNG (TT600)
;;;   Tiêu chuẩn thi công TCVN / Vĩnh Tường / Lê Trần • Chuẩn Mốc Cạnh Công Trình
;;;   Tích hợp: Mặt Bằng 2D, Góc Nghiêng Phối Cảnh 3D & Mặt Cắt Cấu Tạo 2D
;;;   Tệp Plugin độc lập nạp qua lệnh APPLOAD
;;; ===============================================================================

(defun c:TT600 ()
  (princ "\\n[TT600] Kích hoạt Thuật toán Chia Trần Thả 600x600 (Chuẩn Mốc Vách Cạnh)...")
  (selectTool "TT600")
  (princ)
)

(defun c:TRANTHA ()
  (princ "\\n[TRANTHA] Kích hoạt Thuật toán Chia Trần Thả 600x600...")
  (selectTool "TT600")
  (princ)
)

(defun c:TT3D ()
  (princ "\\n[TT3D] Mở Phối cảnh Góc nghiêng 3D Hệ Trần Thả...")
  (if window.openTT6003DModal (window.openTT6003DModal))
  (princ)
)

(defun c:TTFIT ()
  (princ "\\n[TTFIT] Căn giữa Hệ trần & Bảng dự toán ra chính giữa màn hình...")
  (if window.zoomFitTT600 (window.zoomFitTT600))
  (princ)
)

(defun c:TTSEC ()
  (princ "\\n[TTSEC] Mở Bản vẽ Mặt Cắt Chi Tiết Cấu Tạo Trần...")
  (if window.openTT600SectionModal (window.openTT600SectionModal))
  (princ)
)

(princ "\\n=================================================================")
(princ "\\n  ĐÃ NẠP THÀNH CÔNG PLUGIN TRẦN THẢ 600x600 (CHUẨN THI CÔNG THỰC TẾ)")
(princ "\\n  - Lấy mốc vách chuẩn ra 600mm -> bước @1200 / @600 vuông vức")
(princ "\\n  - Thanh chính Đỏ @1200mm, Thanh phụ Vàng 1.2m gài VUÔNG GÓC @600mm")
(princ "\\n  - Chuỗi DIM liên tục 2 phương: từ vách ra cây đầu -> bước -> vách cuối")
(princ "\\n  - Tích hợp Chế độ xem Góc Nghiêng 2.5D / 3D Isometric View (Lệnh TT3D)")
(princ "\\n  - Tích hợp Bản vẽ Mặt Cắt Kỹ Thuật Chi Tiết Cấu Tạo Trần 2D (Lệnh TTSEC)")
(princ "\\n  Lệnh gọi trên thanh COMMAND: TT600 hoặc TRANTHA")
(princ "\\n=================================================================")
(princ)

;;<JS_ENGINE>
"""
    tt600_lsp_path = os.path.join(PLUGINS_DIR, "trantha600.lsp")
    with open(tt600_lsp_path, "w", encoding="utf-8") as f:
        f.write(tt600_lsp_header + tt600_bundled_js)
    print(f"  ✅ Generated {tt600_lsp_path} ({os.path.getsize(tt600_lsp_path):,} bytes)")
    return tt600_bundled_js

def build_cad_engine(default_plugin_js=""):
    print("🔨 Building VinaCAD Engine from modular src/...")
    
    # 1. Read index.html template
    index_html = read_src_file("index.html")
    
    # 2. Bundle CSS files
    css_files = [
        "css/main.css",
        "css/ribbon.css",
        "css/properties.css",
        "css/modal.css"
    ]
    bundled_css = "\n".join([f"/* === {f} === */\n" + read_src_file(f) for f in css_files])
    
    # Replace <link rel="stylesheet" ... /> with inline <style>
    link_regex = r'<link\s+rel="stylesheet"\s+href="[^"]+"\s*/>'
    cleaned_html = re.sub(link_regex, '', index_html)
    
    # Insert bundled CSS before </head>
    style_block = f"<style>\n{bundled_css}\n</style>\n"
    cleaned_html = cleaned_html.replace("</head>", f"{style_block}</head>")
    
    # 3. Bundle Core CAD JS files
    js_files = [
        "js/core/db.js",
        "js/core/state.js",
        "js/core/math.js",
        "js/core/osnap.js",
        "js/renderer/canvas.js",
        "js/renderer/entity_renderer.js",
        "js/renderer/overlays.js",
        "js/tools/selection.js",
        "js/tools/modify_tools.js",
        "js/tools/draw_tools.js",
        "js/tools/create_entities.js",
        "js/ui/properties_panel.js",
        "js/ui/appload_modal.js",
        "js/ui/cli.js",
        "js/ui/ribbon_search.js",
        "js/ui/keyboard_shortcuts.js",
        "js/io/json_io.js",
        "js/io/dxf_io.js"
    ]
    
    bundled_js = "\n".join([f"// === {f} ===\n" + read_src_file(f) for f in js_files])
    
    # Embed default built-in plugin into defaultTools so Colab & fresh sessions have TT600 ready out-of-the-box
    if default_plugin_js:
        default_tools_obj = [
            {
                "id": "tool_builtin_tt600",
                "name": "⚡ Trần Thả 600x600 (TT600)",
                "fileName": "trantha600.js",
                "cmd": "TT600",
                "commands": ["TT600", "TRANTHA", "TRANTHA600", "TT3D", "TTSEC", "TTFIT"],
                "desc": "Chia trần thạch cao 600x600, bóc tách vật tư, 3D & mặt cắt kỹ thuật (Tích hợp sẵn)",
                "type": "JavaScript Plugin",
                "enabled": True,
                "code": default_plugin_js,
                "loadedAt": 1727000000000
            }
        ]
        default_tools_js = json.dumps(default_tools_obj, ensure_ascii=False)
        bundled_js = bundled_js.replace("let defaultTools = [];", f"let defaultTools = {default_tools_js};", 1)
    
    # Remove external <script src="..."></script> tags
    script_src_regex = r'<script\s+src="[^"]+"></script>\s*'
    cleaned_html = re.sub(script_src_regex, '', cleaned_html)
    
    # Insert bundled JS into the <script> block before </body>
    if "<script>" in cleaned_html:
        cleaned_html = cleaned_html.replace("<script>", f"<script>\n{bundled_js}\n", 1)
    else:
        cleaned_html = cleaned_html.replace("</body>", f"<script>\n{bundled_js}\n</script>\n</body>")
    
    # 4. Write standalone cad_engine.html
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(cleaned_html)
    print(f"✅ Generated {OUTPUT_HTML} ({len(cleaned_html):,} bytes)")
    
    # 5. Sync to Colab_Mini_CAD.ipynb (Clean Compressed Base64 format to eliminate syntax errors)
    import base64
    import zlib
    compressed_b64 = base64.b64encode(zlib.compress(cleaned_html.encode('utf-8'))).decode('ascii')
    
    template_code = '''# @title 🚀 BẤM PLAY (▶️) ĐỂ KHỞI ĐỘNG VINACAD WEB STUDIO
import base64
import zlib
import html
import subprocess
import sys

# 1. Tự động cài đặt thư viện Gradio nếu chưa có
try:
    import gradio as gr
except ImportError:
    print("⏳ Đang cài đặt thư viện Gradio...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "gradio"])
    import gradio as gr

# 2. Giải nén giao diện VinaCAD Web Studio (Zero-Syntax-Error Payload)
B64_DATA = "__B64_DATA_PLACEHOLDER__"
HTML_CONTENT = zlib.decompress(base64.b64decode(B64_DATA)).decode('utf-8')
escaped_html = html.escape(HTML_CONTENT)

custom_css = """
html, body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    width: 100% !important;
    height: 100% !important;
    background: #070a13 !important;
}
.gradio-container {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #070a13 !important;
    overflow: hidden !important;
}
.contain, .block, #component-0 {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
}
footer { display: none !important; }
"""

def create_app():
    with gr.Blocks(title="VinaCAD Professional Web Studio", theme=gr.themes.Base(), css=custom_css) as demo:
        gr.HTML(f'<iframe srcdoc="{escaped_html}" style="width:100%; height:100vh; border:none; margin:0; padding:0; display:block; overflow:hidden; position:fixed; inset:0;" allow="fullscreen"></iframe>')
    return demo

if __name__ == "__main__":
    print("🚀 Đang khởi tạo VinaCAD Web Studio...")
    app = create_app()
    app.launch(share=True, debug=False)
'''
    colab_python_code = template_code.replace("__B64_DATA_PLACEHOLDER__", compressed_b64)

    notebook_dict = {
        "nbformat": 4,
        "nbformat_minor": 0,
        "metadata": {
            "colab": {
                "provenance": [],
                "toc_visible": True
            },
            "kernelspec": {
                "name": "python3",
                "display_name": "Python 3"
            },
            "language_info": {
                "name": "python"
            }
        },
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {
                    "id": "header_cell"
                },
                "source": [
                    "# 📐 VINACAD PROFESSIONAL WEB STUDIO TRÊN GOOGLE COLAB\n",
                    "### Động Cơ CAD 2D Đồ Họa 60FPS • Bảng Thuộc Tính (PR) • AutoCAD CLI • Bắt Điểm OSNAP • Nạp Tool (APPLOAD)\n",
                    "\n",
                    "---\n",
                    "\n",
                    "### 🚀 Hướng Dẫn Chạy 1-Click:\n",
                    "1. Bấm nút **Play (▶️)** ở Cell code bên dưới.\n",
                    "2. Nhấp vào đường link **Public URL (gradio.live)** màu cam/xanh bên dưới để mở toàn màn hình trên trình duyệt.\n"
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {
                    "id": "run_vinacad_cell"
                },
                "outputs": [],
                "source": [colab_python_code]
            }
        ]
    }
    
    with open(NOTEBOOK_PATH, "w", encoding="utf-8") as f:
        json.dump(notebook_dict, f, indent=1, ensure_ascii=False)
    print(f"✅ Generated Clean 1-Click Colab Notebook ({NOTEBOOK_PATH})")
    return cleaned_html

if __name__ == "__main__":
    plugin_js = build_plugins()
    build_cad_engine(plugin_js)
