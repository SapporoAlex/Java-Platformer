"""Normalizes player frames that were exported without real transparency.

Some frames (the walk cycle and all three victory sets) came out as
1024x1536 RGB images with a light-gray "transparency" checkerboard baked into
the pixels. This tool:

1. flood-fills that background away from the image border (it only removes
   near-white/near-gray pixels *connected to the edge*, so light colors inside
   the dark ink outline are kept),
2. crops to the figure, and
3. rescales/pads it onto the same 408x612 canvas the rest of the player art
   uses, with the feet on the same baseline as player_idle_right1.png -
   so every frame lines up when the game swaps between them.

Images that already have an alpha channel are left alone, so running this
again is harmless.

Usage:  python tools/clean_sprites.py
"""
from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
CANVAS = (408, 612)
PATTERNS = ["player_move_*.png", "player_victory*_*.png"]


def is_background(px):
    r, g, b = px[:3]
    return min(r, g, b) >= 205 and max(r, g, b) - min(r, g, b) <= 14


def remove_background(img):
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))
    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_background(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x < w - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < h - 1:
            queue.append((x, y + 1))
    return img


def reference_box():
    ref = Image.open(ASSETS / "player_idle_right1.png").convert("RGBA")
    return ref.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()


def normalize(path, ref_box):
    img = Image.open(path)
    if img.mode == "RGBA" and img.size == CANVAS:
        return False
    img = remove_background(img)
    box = img.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    img = img.crop(box)
    ref_h = ref_box[3] - ref_box[1]
    scale = ref_h / img.height
    img = img.resize((round(img.width * scale), ref_h), Image.LANCZOS)
    out = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    left = (CANVAS[0] - img.width) // 2
    out.paste(img, (left, ref_box[3] - ref_h), img)
    out.save(path)
    return True


def main():
    ref_box = reference_box()
    changed = 0
    for pattern in PATTERNS:
        for path in sorted(ASSETS.glob(pattern)):
            if "wounded" in path.name:
                continue
            if normalize(path, ref_box):
                changed += 1
                print("cleaned", path.name)
    print(f"{changed} file(s) updated")


if __name__ == "__main__":
    main()
