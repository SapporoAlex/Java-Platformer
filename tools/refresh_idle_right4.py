from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")
src = assets / "player_idle_right4.png"
img = Image.open(src)
mirrored = img.transpose(Image.FLIP_LEFT_RIGHT)

for i in range(1, 11):
    img.save(assets / f"player_idle_right{i}.png")
    mirrored.save(assets / f"player_idle_left{i}.png")

print("Updated all player idle right frames from player_idle_right4 and mirrored them for left.")
