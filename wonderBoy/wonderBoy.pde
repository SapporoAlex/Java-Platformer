final static float MOVE_SPEED = 3;
final static float SPRITE_SCALE = 1.0;
final static float SPRITE_SIZE = 50.0;
final static float GRAVITY = 0.6;
final static float JUMP_SPEED = 14;

final static float RIGHT_MARGIN = 400;
float LEFT_MARGIN = 60;
final static float VERTICAL_MARGIN = 40;

final static int NEUTRAL_FACING = 0;
final static int RIGHT_FACING = 1;
final static int LEFT_FACING = 2;

final static float WIDTH = SPRITE_SIZE * 16;
final static float HEIGHT = SPRITE_SIZE * 12;
final static float GROUND_LEVEL = HEIGHT - SPRITE_SIZE;

// Declare global variables
Player player;
Enemy enemy;
PImage grass, beige_wall, blue_wall, red_brick, brown_brick, orange_roof, black_roof, green_roof, sand_top, sand, gold, spider, p;
ArrayList<Sprite> platforms;
ArrayList<Sprite> passableTiles;
ArrayList<Sprite> coins;

int maxHealth = 100;
int barWidth = 200;  // Full width at max health
int barHeight = 20;  // Thickness of the bar
int barX = 800 / 2 - barWidth / 2;       // X position of the bar
int barY = 20;

float view_x = 0;
float view_y = 0;
boolean mid_point;
int numCoins;
boolean isGameOver;
int bounceTime = 0;
boolean isBouncing = false;

// Initialise variables here
void setup() {
  size(800, 600);
  imageMode(CENTER);
  
  p = loadImage("../assets/player_stand_left.png");
  player = new Player(p, 1.0);
  player.setBottom(GROUND_LEVEL);
  player.center_x = 100;
  
  platforms = new ArrayList<Sprite>();
  passableTiles = new ArrayList<Sprite>();
  coins = new ArrayList<Sprite>();
  numCoins = 0;
  isGameOver = false;
  view_x = 0;
  view_y = 0;
  bounceTime = 0;
  isBouncing = false;
  
  grass = loadImage("../assets/1.png");
  beige_wall = loadImage("../assets/2.png");
  blue_wall = loadImage("../assets/3.png");
  red_brick = loadImage("../assets/4.png");
  brown_brick = loadImage("../assets/5.png");
  orange_roof = loadImage("../assets/6.png");
  black_roof = loadImage("../assets/7.png");
  green_roof = loadImage("../assets/8.png");
  sand_top = loadImage("../assets/9.png");
  sand = loadImage("../assets/10.png");
  
  gold = loadImage("../assets/gold1.png");
  spider = loadImage("../assets/spider_walk_right1.png");
  createPlatforms("../assets/map.csv");
  mid_point = false;

}

// Modify and update in draw
void draw() {
  background(0, 200, 255);
  // scroll needs to be the first method drawn
  scroll();
  
  displayAll();
  
  if (!isGameOver) {
    updateAll();
    collectCoins();
    checkDeath();
    takeDamage();
  }
}

void displayAll() {
  
  // sprite lists
  for(Sprite t: passableTiles)
      t.display();
    
  for(Sprite s: platforms)
    s.display();
  
  // player and enemy
  player.display();
  enemy.display();

  // First grey rect for healthbar back
  fill(100);  
  rect(view_x + barX, view_y + barY, barWidth, barHeight);
  
  // Then red for health
  fill(255, 0, 0);
  rect(view_x + barX, view_y + barY, (float)player.health / maxHealth * barWidth, barHeight);
  
  // text
  fill(255,255,255);
  textSize(20);
  text("Coins: " + numCoins, view_x + 50, view_y + 20);
  text("Health", 800/2 - 30 + view_x, view_y + 20);
}

void updateAll() {
  enemy.update();
  enemy.updateAnimation();
  
  for(Sprite c: coins){
    c.display();
    ((AnimatedSprite)c).updateAnimation();
  }
  
  player.updateAnimation();
  resolvePlatformCollisions(player, platforms);
  if (player.getRight() >= 400) {
    LEFT_MARGIN = 300;
  }
}

void checkDeath() {
  boolean dead = player.health <= 0;
  boolean fallOffMap = player.getBottom() > GROUND_LEVEL;
  if (dead || fallOffMap) {
  isGameOver = true;}
}

void takeDamage() {
  boolean touchEnemy = checkCollision(player, enemy);
  if (touchEnemy) {
    if (!isBouncing) {
      // Start the bounce effect
      bounceTime = millis();  // Store the current time (in milliseconds)
      isBouncing = true;

      // Calculate bounce direction based on the enemy's position relative to the player
      if (enemy.getLeft() > player.getLeft()) {
        player.change_y = -10;
        player.change_x = -5;  // Move left
        player.health -= 10;
      } else if (enemy.getLeft() < player.getLeft()) {
        player.change_y = -10;
        player.change_x = 5;   // Move right
        player.health -= 10;
      }
    }
  }
  
  // Check if 1 second (300 milliseconds) has passed
  if (isBouncing && millis() - bounceTime >= 300) {
    player.change_x = 0;  // Stop the horizontal movement after 1 second
    isBouncing = false;   // Reset the bouncing state
  }
}

void collectCoins(){
  ArrayList<Sprite> coin_list = checkCollisionList(player, coins);
  if(coin_list.size() > 0) {
    for(Sprite coin: coin_list) {
      numCoins++;
      coins.remove(coin);
    }
  }
  // collect all coins to win!
  if(coins.size() == 0) {
    isGameOver = true;
  }
}


// handles scrolling
void scroll() {
  float right_boundary = view_x + width - RIGHT_MARGIN;
  if(player.getRight() > right_boundary) {
    view_x += player.getRight() - right_boundary;
  }
  float left_boundary = view_x + LEFT_MARGIN;
  if(player.getLeft() < left_boundary) {
    view_x -= left_boundary - player.getLeft();
  }
  float bottom_boundary = view_y + height - VERTICAL_MARGIN;
  if(player.getBottom() > bottom_boundary) {
    view_y += player.getBottom() - bottom_boundary;
  }
  float top_boundary = view_y + VERTICAL_MARGIN;
  if (player.getTop() < top_boundary){
    view_y -= top_boundary - player.getTop();
  }
  translate(-view_x, -view_y);
}

public boolean isOnPlatforms(Sprite s, ArrayList<Sprite> walls) {
  s.center_y += 5;
  ArrayList<Sprite> col_list = checkCollisionList(s, walls);
  s.center_y -= 5;
  if (col_list.size() > 0){
  return true;
  }
  else{
  return false;
  }
}

public void resolvePlatformCollisions(Sprite s, ArrayList<Sprite> walls){
  //add gravity to change_y
  s.change_y += GRAVITY;
  
  // move in the y dir then resolve collision
  // by computing collision list and fixing collision.
  s.center_y += s.change_y;
  ArrayList<Sprite> col_list = checkCollisionList(s, walls);
  if (col_list.size() > 0){
    Sprite collided = col_list.get(0);
    if(s.change_y > 0) {
      s.setBottom(collided.getTop());
    }
    else if (s.change_y < 0) {
      s.setTop(collided.getBottom());
    }
    s.change_y = 0;
  }
    
   // move in the x dir then resolve collision
  // by computing collision list and fixing collision.
  s.center_x += s.change_x;
  col_list = checkCollisionList(s, walls);
  if (col_list.size() > 0){
    Sprite collided = col_list.get(0);
    if(s.change_x > 0) {
      s.setRight(collided.getLeft());
    }
    else if (s.change_x < 0) {
      s.setLeft(collided.getRight());
    }
    s.change_x = 0;
  }
  
  // move in the x dir then resolve collision
  //by computing collision list and fixing collision.
  s.center_x += s.change_x;
}

// simple box collision check for 2 sprites
boolean checkCollision(Sprite s1, Sprite s2) {
  boolean noXOverlap = s1.getRight() <= s2.getLeft() || s1.getLeft() >= s2.getRight();
  boolean noYOverlap = s1.getBottom() <= s2.getTop() || s1.getTop() >= s2.getBottom();
  if (noXOverlap || noYOverlap){
  return false;  
  } else {
  return true;
  }
}

// Creates an array of sprites called collision lists, loops though the player in list of sprites
// finds sprites that check true in the collisions function, adds them to collision list
public ArrayList<Sprite> checkCollisionList(Sprite s, ArrayList<Sprite> list) {
  ArrayList<Sprite> collision_list = new ArrayList<Sprite>();
  for (Sprite player: list) {
    if(checkCollision(s, player))
      collision_list.add(player);
     }
     return collision_list;
  }

// reads csv file, adds sprite by number type to h and w on map
void createPlatforms(String fileName) {
  String[] lines = loadStrings(fileName);
  for (int row = 0; row < lines.length; row++){
    String[] values = split(lines[row], ",");
    for (int col = 0; col < values.length; col++) {
      if(values[col].equals("1")){
      Sprite s = new Sprite(grass, SPRITE_SCALE);
      s.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      s.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      platforms.add(s);
      }
      else if (values[col].equals("2")){
      Sprite t = new Sprite(beige_wall, SPRITE_SCALE);
      t.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      t.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      passableTiles.add(t);
      }
      else if (values[col].equals("3")){
      Sprite t = new Sprite(blue_wall, SPRITE_SCALE);
      t.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      t.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      passableTiles.add(t);
      }
      else if (values[col].equals("4")){
      Sprite s = new Sprite(red_brick, SPRITE_SCALE);
      s.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      s.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      platforms.add(s);
      }

      else if (values[col].equals("5")){
      Sprite s = new Sprite(brown_brick, SPRITE_SCALE);
      s.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      s.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      platforms.add(s);
      }
      else if (values[col].equals("6")){
      Sprite t = new Sprite(orange_roof, SPRITE_SCALE);
      t.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      t.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      passableTiles.add(t);
      }
      else if (values[col].equals("7")){
      Sprite t = new Sprite(black_roof, SPRITE_SCALE);
      t.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      t.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      passableTiles.add(t);
      }
            else if (values[col].equals("8")){
      Sprite t = new Sprite(green_roof, SPRITE_SCALE);
      t.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      t.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      passableTiles.add(t);
      }
      else if (values[col].equals("9")){
      Sprite s = new Sprite(sand_top, SPRITE_SCALE);
      s.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      s.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      platforms.add(s);
      }
      else if (values[col].equals("10")){
      Sprite s = new Sprite(sand, SPRITE_SCALE);
      s.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      s.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      platforms.add(s);
      }
    
      else if (values[col].equals("30")){
      Coin c = new Coin(gold, SPRITE_SCALE);
      c.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      c.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      coins.add(c);
      }
      
      else if (values[col].equals("20")){
        float bLeft =col * SPRITE_SIZE;
        float bRight = bLeft + 4 * SPRITE_SIZE;
      enemy = new Enemy(spider, 50/72.0, bLeft, bRight);
      enemy.center_x = SPRITE_SIZE/2 + col * SPRITE_SIZE;
      enemy.center_y = SPRITE_SIZE/2 + row * SPRITE_SIZE;
      }
   }
  }

}

void keyPressed(){
  if (keyCode == RIGHT){
  player.change_x = MOVE_SPEED;
  }
  else if (keyCode == LEFT){
  player.change_x = -MOVE_SPEED;
  }
  //  else if (keyCode == UP){
  //player.change_y = -MOVE_SPEED;
  //}
  //  else if (keyCode == DOWN){
  //player.change_y = MOVE_SPEED;
  //}
  else if (key == 'a' && isOnPlatforms(player, platforms)){
    player.change_y = -JUMP_SPEED;
  }
}

void keyReleased(){
  if (keyCode == RIGHT){
  player.change_x = 0;
  }
  else if (keyCode == LEFT){
  player.change_x = 0;
  }
  //  else if (keyCode == UP){
  //player.change_y = 0;
  //}
  //  else if (keyCode == DOWN){
  //player.change_y = 0;
  //}
}
