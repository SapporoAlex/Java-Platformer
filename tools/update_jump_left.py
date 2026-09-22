from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys

    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")
src = assets / "player_jump_right.png"
dst = assets / "player_jump_left.png"
img = Image.open(src)
img.transpose(Image.FLIP_LEFT_RIGHT).save(dst)
print("Updated player_jump_left to a flipped copy of player_jump_right.")
