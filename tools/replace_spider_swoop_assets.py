from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")

# Spider assets: use spider_walk_left1 for every spider frame
spider_src = assets / "spider_walk_left1.png"
spider_img = Image.open(spider_src)
for i in range(1, 4):
    spider_img.save(assets / f"spider_walk_left{i}.png")
    spider_img.save(assets / f"spider_walk_right{i}.png")

# Swoop assets: use the same base image for both directions
swoop_src = assets / "spider_walk_left1.png"
swoop_img = Image.open(swoop_src)
for i in range(1, 3):
    swoop_img.save(assets / f"swoop_move_left{i}.png")
    swoop_img.save(assets / f"swoop_move_right{i}.png")

print("Updated spider and swoop sprite files to use spider_walk_left1 as the shared source image.")
