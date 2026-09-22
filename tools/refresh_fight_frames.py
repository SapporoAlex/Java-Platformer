from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
    from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")
source = assets / "player_fight_right1.png"
right_img = Image.open(source)
left_img = right_img.transpose(Image.FLIP_LEFT_RIGHT)

for i in range(1, 4):
    right_img.save(assets / f"player_fight_right{i}.png")
    left_img.save(assets / f"player_fight_left{i}.png")

print("Updated player_fight_right 1-3 and mirrored them for all player_fight_left files.")
