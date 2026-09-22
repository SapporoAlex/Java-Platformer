from pathlib import Path
from PIL import Image

assets = Path(r"c:\Users\McKinley Alex\Documents\GitHub\Java-Platformer\assets")


def ensure_dir():
    assets.mkdir(exist_ok=True)


def mirror_to_files(src_name: str, pattern: str):
    src = assets / src_name
    if not src.exists():
        raise FileNotFoundError(f"Missing source image: {src}")
    source_img = Image.open(src)
    for path in sorted(assets.glob(pattern)):
        if path.name == src.name:
            continue
        source_img.save(path)

    # also replace matching left-facing files with a mirrored copy of the source
    left_pattern = pattern.replace("right", "left")
    for path in sorted(assets.glob(left_pattern)):
        if path.name == src.name:
            continue
        source_img.transpose(Image.FLIP_LEFT_RIGHT).save(path)


def replace_all_with_right1():
    # Idle sheets
    idle_src = assets / "player_idle_right1.png"
    idle_right_img = Image.open(idle_src)
    for i in range(1, 11):
        (assets / f"player_idle_right{i}.png").write_bytes(idle_right_img.tobytes() if False else idle_right_img.copy().tobytes())
        # write exact bytes from source so all right frames match right1
        idle_right_img.save(assets / f"player_idle_right{i}.png")
        idle_right_img.transpose(Image.FLIP_LEFT_RIGHT).save(assets / f"player_idle_left{i}.png")

    # Move sheets
    move_src = assets / "player_idle_right1.png"
    move_img = Image.open(move_src)
    for i in range(1, 3):
        move_img.save(assets / f"player_move_right{i}.png")
        move_img.transpose(Image.FLIP_LEFT_RIGHT).save(assets / f"player_move_left{i}.png")

    # Fight sheets
    fight_src = assets / "player_fight_right1.png"
    fight_img = Image.open(fight_src)
    for i in range(1, 4):
        fight_img.save(assets / f"player_fight_right{i}.png")
        fight_img.transpose(Image.FLIP_LEFT_RIGHT).save(assets / f"player_fight_left{i}.png")

    # Victory sheets
    victory_src = assets / "player_idle_right1.png"
    victory_img = Image.open(victory_src)
    for variant in range(1, 4):
        for i in range(1, 11):
            victory_img.save(assets / f"player_victory{variant}_right{i}.png")
            victory_img.transpose(Image.FLIP_LEFT_RIGHT).save(assets / f"player_victory{variant}_left{i}.png")

    # Jump left should be flipped copy of jump right
    jump_right = assets / "player_jump_right.png"
    jump_left = assets / "player_jump_left.png"
    Image.open(jump_right).transpose(Image.FLIP_LEFT_RIGHT).save(jump_left)

    print("Updated all player art files to the requested right1/base source and mirrored left variants.")


replace_all_with_right1()
