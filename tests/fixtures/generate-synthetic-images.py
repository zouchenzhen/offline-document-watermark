"""Original, fictional raster fixtures. Requires Pillow; no system fonts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
image = Image.new("RGB", (384, 256), "white")
draw = ImageDraw.Draw(image)
font = ImageFont.load_default()
draw.text((18, 15), "SYNTHETIC SCAN - NO PERSONAL DATA", fill="black", font=font)
draw.text((18, 37), "Original test illustration / public demo", fill="black", font=font)
for x, color in [(18, (255, 0, 0)), (110, (0, 255, 0)), (202, (0, 0, 255)), (294, (0, 0, 0))]:
    draw.rectangle((x, 68, x + 70, 134), fill=color)
for x in range(348):
    value = round(x * 255 / 347)
    draw.line((18 + x, 164, 18 + x, 211), fill=(value, value, value))
draw.rectangle((17, 163, 367, 212), outline=(0, 0, 0))
draw.text((18, 233), "JPEG / JPEG2000 decoder fixture", fill="black", font=font)
image.save(root / "synthetic-scan.jpg", quality=92, subsampling=0, optimize=False)
image.save(root / "synthetic-scan.jp2", format="JPEG2000", irreversible=False)
