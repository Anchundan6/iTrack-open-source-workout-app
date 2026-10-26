"""Generate the monochrome launcher icons and splash screens for the Android shell.

Design: black field, three ascending rounded bars — the app's core idea
(progressive overload) reduced to a glyph. Pure black and white, no accent color.

Run with the managed Python that has Pillow:
  C:/Users/hp/.workbuddy/binaries/python/envs/default/Scripts/python.exe tools/gen_icons.py
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw

RES = pathlib.Path(__file__).resolve().parent.parent / "project" / "android" / "app" / "src" / "main" / "res"

BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Bar geometry on a 1000x1000 canvas: three bars, tallest last.
BAR_W = 150
BAR_GAP = 72
BAR_HEIGHTS = (232, 396, 560)
BASELINE = 772
RADIUS = 44


def draw_glyph(img: Image.Image, box_w: float, box_h: float, color: tuple[int, int, int, int]) -> None:
    """Draw the glyph centred in `img`, scaled so the bar group is `box_w` wide."""
    draw = ImageDraw.Draw(img)
    total_w = 3 * BAR_W + 2 * BAR_GAP
    scale = box_w / total_w
    cx, cy = img.width / 2, img.height / 2
    left0 = cx - (total_w * scale) / 2
    base = cy + (max(BAR_HEIGHTS) * scale) / 2
    for i, h in enumerate(BAR_HEIGHTS):
        x0 = left0 + i * (BAR_W + BAR_GAP) * scale
        w = BAR_W * scale
        hh = h * scale
        draw.rounded_rectangle([x0, base - hh, x0 + w, base], radius=RADIUS * scale, fill=color)


def square_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BLACK)
    draw_glyph(img, size * 0.58, size * 0.58, WHITE)
    return img


def round_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size * 4, size * 4), TRANSPARENT)
    ImageDraw.Draw(img).ellipse([0, 0, img.width - 1, img.height - 1], fill=BLACK)
    draw_glyph(img, img.width * 0.55, img.height * 0.55, WHITE)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size: int) -> Image.Image:
    """Adaptive foreground: transparent, glyph inside the 66dp safe zone of 108dp."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw_glyph(img, size * 0.52, size * 0.52, WHITE)
    return img


def splash(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h), (255, 255, 255))
    # Only the landscape/portrait variants carry a visible mark; keep it modest.
    short = min(w, h)
    layer = Image.new("RGBA", (w, h), TRANSPARENT)
    draw_glyph(layer, short * 0.30, short * 0.30, BLACK)
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
SPLASH = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
}


def main() -> None:
    written = 0
    for density, px in LEGACY.items():
        d = RES / f"mipmap-{density}"
        d.mkdir(parents=True, exist_ok=True)
        square_icon(px).save(d / "ic_launcher.webp", "WEBP", lossless=True, quality=100)
        round_icon(px).save(d / "ic_launcher_round.webp", "WEBP", lossless=True, quality=100)
        written += 2
    for density, px in ADAPTIVE.items():
        d = RES / f"mipmap-{density}"
        foreground(px).save(d / "ic_launcher_foreground.webp", "WEBP", lossless=True, quality=100)
        written += 1
    for folder, (w, h) in SPLASH.items():
        d = RES / folder
        d.mkdir(parents=True, exist_ok=True)
        splash(w, h).save(d / "splash.png", "PNG", optimize=True)
        written += 1
    print(f"wrote {written} files under {RES}")


if __name__ == "__main__":
    main()
