"""Generate fictional project GIFs from shapes; no original media is read.

Optional development dependency: python -m pip install Pillow
"""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parent / "demo" / "assets"
destination.mkdir(parents=True, exist_ok=True)
for filename, shelves, label in [
    ("starter-rack.gif", 3, "STARTER RACK / SYNTHETIC EXAMPLE"),
    ("compute-shelf.gif", 5, "COMPUTE SHELF / SYNTHETIC EXAMPLE"),
]:
    frames = []
    for step in range(24):
        image = Image.new("RGB", (640, 360), "#0c0e11")
        draw = ImageDraw.Draw(image)
        draw.text((30, 24), "EXAMPLE WORKSHOP", fill="#d6b169")
        draw.text((30, 330), label, fill="#98a2a8")
        draw.rounded_rectangle((208, 65, 432, 306), radius=8, outline="#d6b169", width=4)
        draw.line((224, 70, 224, 300), fill="#98a2a8", width=3)
        draw.line((416, 70, 416, 300), fill="#98a2a8", width=3)
        for index in range(shelves):
            y = 88 + index * (180 // shelves)
            offset = max(0, (index * 3 + 8 - step) * 12)
            draw.rounded_rectangle((236 + offset, y, 404 + offset, y + 25), radius=3, fill="#252d35", outline="#d6b169", width=2)
            draw.ellipse((245 + offset, y + 9, 252 + offset, y + 16), fill="#82c6a2")
        frames.append(image)
    frames[0].save(destination / filename, save_all=True, append_images=frames[1:], duration=100, loop=0, optimize=True, disposal=2)
print("Generated two synthetic GIFs without personal data or external footage.")
