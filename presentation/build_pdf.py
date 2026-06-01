"""
Capture each slide of presentation.html at 1920×1080 @2x via Playwright,
combine into a single PDF with PyMuPDF.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import fitz

ROOT = Path(__file__).parent.resolve()
HTML = ROOT / "presentation.html"
OUT = ROOT / "presentation.pdf"

W, H = 1920, 1080
SCALE = 2

def main():
    assert HTML.exists(), f"missing {HTML}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": W, "height": H},
            device_scale_factor=SCALE,
            reduced_motion="reduce",
        )
        page = ctx.new_page()
        page.emulate_media(reduced_motion="reduce")
        page.goto(HTML.as_uri(), wait_until="networkidle")

        # kill all reveal animations / transitions so screenshots show the final state
        page.add_style_tag(content="""
            *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
            }
            .reveal { opacity: 1 !important; transform: none !important; }
        """)
        page.wait_for_timeout(800)

        total = page.evaluate("document.querySelectorAll('.slide').length")
        print(f"slides: {total}")

        pngs = []
        for i in range(total):
            page.evaluate(
                """idx => {
                    const slides = document.querySelectorAll('.slide');
                    slides.forEach((s, j) => {
                        if (j === idx) s.setAttribute('data-active', '');
                        else s.removeAttribute('data-active');
                    });
                    document.querySelectorAll('.reveal').forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'none';
                        el.style.animation = 'none';
                    });
                }""",
                i,
            )
            page.wait_for_timeout(400)
            stage = page.locator("#stage")
            png_path = ROOT / f"_slide_{i+1:02d}.png"
            stage.screenshot(path=str(png_path), omit_background=False)
            pngs.append(png_path)
            print(f"  shot {i+1}/{total} -> {png_path.name}")

        browser.close()

    print("building PDF…")
    from PIL import Image
    import io
    doc = fitz.open()
    for png in pngs:
        with Image.open(png) as im:
            im = im.convert("RGB")
            w, h = im.size
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85, optimize=True)
            jpg_bytes = buf.getvalue()
        page_pdf = doc.new_page(width=w, height=h)
        page_pdf.insert_image(page_pdf.rect, stream=jpg_bytes)
    doc.save(OUT, deflate=True, garbage=4)
    doc.close()
    print(f"wrote {OUT} ({OUT.stat().st_size/1024/1024:.2f} MB)")

    for png in pngs:
        png.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
