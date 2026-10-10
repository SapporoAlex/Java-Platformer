"""Builds the favicon / PWA icon set from the heroine's face.

Crops her face out of assets/player_idle_right1.png and places it on a washi
paper disc with an ink + vermilion ring. The smallest sizes use a tighter
crop so the face still reads at 16px. Run again after changing her art:

    python tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "player_idle_right1.png"
OUT = ROOT / "icons"

PAPER = (244, 236, 216, 255)
INK = (27, 18, 16, 255)
VERMILION = (192, 57, 43, 255)

# (left, top, size) squares in the 408x612 source frame.
HEAD_CROP = (150, 12, 130)   # hair ornaments + face
FACE_CROP = (172, 36, 96)    # just the face, for tiny icons


def face(size, crop):
    left, top, side = crop
    img = Image.open(SOURCE).convert("RGBA").crop((left, top, left + side, top + side))
    return img.resize((size, size), Image.LANCZOS)


def disc_icon(size, crop, ring=True, supersample=4):
    s = size * supersample
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    border = max(1, s // 22) if ring else 0
    d.ellipse((0, 0, s - 1, s - 1), fill=INK if ring else PAPER)
    if ring:
        d.ellipse((border, border, s - 1 - border, s - 1 - border), fill=VERMILION)
        d.ellipse((border * 2, border * 2, s - 1 - border * 2, s - 1 - border * 2), fill=PAPER)
    inner = s - border * 4
    portrait = face(inner, crop)
    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, inner - 1, inner - 1), fill=255)
    portrait.putalpha(ImageChops.multiply(portrait.getchannel("A"), mask))
    canvas.alpha_composite(portrait, (border * 2, border * 2))
    return canvas.resize((size, size), Image.LANCZOS)


def maskable_icon(size):
    # Full-bleed background; the face sits inside the central 80% safe zone.
    canvas = Image.new("RGBA", (size, size), VERMILION)
    disc = disc_icon(int(size * 0.72), HEAD_CROP)
    off = (size - disc.width) // 2
    canvas.alpha_composite(disc, (off, off))
    return canvas


def main():
    OUT.mkdir(exist_ok=True)
    small = {16: disc_icon(16, FACE_CROP, ring=False), 32: disc_icon(32, FACE_CROP), 48: disc_icon(48, FACE_CROP)}
    for size, img in small.items():
        img.save(OUT / f"favicon-{size}.png")
    small[48].save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for size in (192, 512):
        disc_icon(size, HEAD_CROP).save(OUT / f"icon-any-{size}.png")
        maskable_icon(size).save(OUT / f"icon-maskable-{size}.png")
    # iOS draws its own rounded corners and dislikes transparency.
    apple = Image.new("RGBA", (180, 180), PAPER)
    apple.alpha_composite(disc_icon(170, HEAD_CROP), (5, 5))
    apple.convert("RGB").save(OUT / "apple-touch-icon.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
