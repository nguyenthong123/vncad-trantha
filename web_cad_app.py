"""
================================================================================
          VINACAD WEB STUDIO - GOOGLE COLAB EDITION (HTML5 ENGINE)
    Direct Mouse Drawing • Live 60FPS Render Loop • OSNAP • AutoCAD CLI • BOM
================================================================================
"""

import os
import html
import gradio as gr

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in locals() else os.getcwd()
SRC_DIR = os.path.join(CURRENT_DIR, "src")
HTML_PATH = os.path.join(CURRENT_DIR, "cad_engine.html")

# Automatically bundle from src/ if modular files exist
if os.path.exists(SRC_DIR):
    try:
        from build import build_cad_engine
        HTML_CONTENT = build_cad_engine()
    except Exception as e:
        print(f"⚠️ Build warning: {e}")
        with open(HTML_PATH, "r", encoding="utf-8") as f:
            HTML_CONTENT = f.read()
elif os.path.exists(HTML_PATH):
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        HTML_CONTENT = f.read()
else:
    HTML_CONTENT = "<h1>cad_engine.html is loading...</h1>"

escaped_html = html.escape(HTML_CONTENT)

custom_css = """
html, body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    width: 100% !important;
    height: 100% !important;
    background: #070a13 !important;
    touch-action: none !important;
    -webkit-touch-callout: none !important;
}
.gradio-container {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #070a13 !important;
    overflow: hidden !important;
    touch-action: none !important;
}
.contain, .block, #component-0 {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    touch-action: none !important;
}
footer { display: none !important; }
"""

def create_cad_app():
    with gr.Blocks(title="VinaCAD Web Studio", theme=gr.themes.Base(), css=custom_css) as demo:
        gr.HTML(
            f"""
            <iframe 
                srcdoc="{escaped_html}" 
                style="width: 100%; height: 100vh; border: none; margin: 0; padding: 0; display: block; overflow: hidden; position: fixed; inset: 0; touch-action: none;"
                allow="fullscreen"
            ></iframe>
            """
        )
    return demo


if __name__ == "__main__":
    print("🚀 Đang khởi động VinaCAD Web Studio trên Google Colab...")
    app = create_cad_app()
    app.launch(share=True, debug=False)
