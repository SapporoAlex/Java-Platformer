public class Coin extends AnimatedSprite {
  public Coin(PImage img, float scale) {
    super(img, scale);
    standNeutral = new PImage[4];
    standNeutral[0] = loadImage("../assets/gold1.png");
    standNeutral[1] = loadImage("../assets/gold2.png");
    standNeutral[2] = loadImage("../assets/gold3.png");
    standNeutral[3] = loadImage("../assets/gold4.png");
    currentImages = standNeutral;
  }

}
