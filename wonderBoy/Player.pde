public class Player extends AnimatedSprite{
  int health;
  int attackStrength;
  boolean attacking;
  boolean onPlatform, inPlace;
  PImage[] standLeft;
  PImage[] standRight;
  PImage[] jumpLeft;
  PImage[] jumpRight;
  PImage[] attackLeft;
  PImage[] attackRight;
  public Player(PImage img, float scale){
    super(img, scale);
    health = 100;
    attackStrength = 10;
    direction = RIGHT_FACING;
    attacking = false;
    onPlatform = true;
    inPlace = true;
    standLeft = new PImage[1];
    standLeft[0] = loadImage("../assets/player_stand_left.png");
    standRight = new PImage[1];
    standRight[0] = loadImage("../assets/player_stand_right.png");
    jumpLeft = new PImage[1];
    jumpLeft[0] = loadImage("../assets/player_jump_left.png");
    jumpRight = new PImage[1];
    jumpRight[0] = loadImage("../assets/player_jump_right.png");
    moveLeft = new PImage[2];
    moveLeft[0] = loadImage("../assets/player_move_left1.png");
    moveLeft[1] = loadImage("../assets/player_move_left2.png");
    moveRight = new PImage[2];
    moveRight[0] = loadImage("../assets/player_move_right1.png");
    moveRight[1] = loadImage("../assets/player_move_right2.png");
    attackLeft = new PImage[3];
    attackLeft[0] = loadImage("../assets/player_fight_left1.png");
    attackLeft[1] = loadImage("../assets/player_fight_left2.png");
    attackLeft[2] = loadImage("../assets/player_fight_left3.png");
    attackRight = new PImage[3];
    attackRight[0] = loadImage("../assets/player_fight_right1.png");
    attackRight[1] = loadImage("../assets/player_fight_right2.png");
    attackRight[2] = loadImage("../assets/player_fight_right3.png");

    currentImages = standRight;
  }
  
  @Override
  public void updateAnimation() {
    onPlatform = isOnPlatforms(this, platforms);
    inPlace = change_x == 00 && change_y == 0;
    super.updateAnimation();
  }
  
  @Override
  public void selectDirection(){
    if (change_x > 0){
      direction = RIGHT_FACING;
    } else if (change_x < 0){
    direction = LEFT_FACING;
    }
  }
  
  @Override
  public void selectCurrentImages(){
  if (direction == RIGHT_FACING && !attacking){
    if (inPlace){
      currentImages = standRight;
    }
    else if (!onPlatform){
      currentImages = jumpRight;
    }
    else {
      currentImages = moveRight;
    }
   }
   else if (direction == LEFT_FACING && !attacking){
    if (inPlace){
      currentImages = standLeft;
    }
    else if (!onPlatform){
      currentImages = jumpLeft;
    }
    else {
      currentImages = moveLeft;
      }
   }
   else if (direction == RIGHT_FACING && attacking) {
      currentImages = attackRight;
    }
   else if (direction == LEFT_FACING && attacking) {
      currentImages = attackLeft;
   }
  }
}
