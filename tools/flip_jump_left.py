from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")
source = assets / "player_jump_right.png"
Image.open(source).transpose(Image.FLIP_LEFT_RIGHT).save(assets / "player_jump_left.png")
print("Updated player_jump_left to a mirrored copy of the current player_jump_right.")
