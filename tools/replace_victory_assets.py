from pathlib import Path
import shutil

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")
src = assets / "player_idle_right1.png"

for variant in range(1, 4):
    for side in ("left", "right"):
        for i in range(1, 11):
            shutil.copy2(src, assets / f"player_victory{variant}_{side}{i}.png")

print("Replaced all player victory images with player_idle_right1 copies.")
