import { NEUTRAL_FACING, RIGHT_FACING, LEFT_FACING } from "./constants.js";

// Direct port of Sprite.pde: a positioned, box-collidable image.
export class Sprite {
  constructor(image, scale, x = 0, y = 0) {
    this.image = image;
    this.scale = scale;
    this.w = image.width * scale;
    this.h = image.height * scale;
    this.centerX = x;
    this.centerY = y;
    this.changeX = 0;
    this.changeY = 0;
    this.flipX = false;
  }

  display(ctx, viewX, viewY) {
    const x = this.centerX - this.w / 2 - viewX;
    const y = this.centerY - this.h / 2 - viewY;
    if (this.flipX) {
      ctx.save();
      ctx.translate(x + this.w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, 0, 0, this.w, this.h);
      ctx.restore();
      return;
    }
    ctx.drawImage(this.image, x, y, this.w, this.h);
  }

  update() {
    this.centerX += this.changeX;
    this.centerY += this.changeY;
  }

  setLeft(left) {
    this.centerX = left + this.w / 2;
  }
  getLeft() {
    return this.centerX - this.w / 2;
  }
  setRight(right) {
    this.centerX = right - this.w / 2;
  }
  getRight() {
    return this.centerX + this.w / 2;
  }
  setTop(top) {
    this.centerY = top + this.h / 2;
  }
  getTop() {
    return this.centerY - this.h / 2;
  }
  setBottom(bottom) {
    this.centerY = bottom - this.h / 2;
  }
  getBottom() {
    return this.centerY + this.h / 2;
  }
}

// Direct port of AnimatedSprite.pde: frame-based image-array animation.
export class AnimatedSprite extends Sprite {
  constructor(image, scale, x = 0, y = 0) {
    super(image, scale, x, y);
    this.currentImages = [image];
    this.standNeutral = [image];
    this.moveLeft = [image];
    this.moveRight = [image];
    this.direction = NEUTRAL_FACING;
    this.index = 0;
    this.frame = 0;
  }

  updateAnimation() {
    this.frame++;
    if (this.frame % 5 === 0) {
      this.selectDirection();
      this.selectCurrentImages();
      this.advanceToNextImage();
    }
  }

  selectDirection() {
    if (this.changeX > 0) this.direction = RIGHT_FACING;
    else if (this.changeX < 0) this.direction = LEFT_FACING;
    else this.direction = NEUTRAL_FACING;
  }

  selectCurrentImages() {
    if (this.direction === RIGHT_FACING) this.currentImages = this.moveRight;
    else if (this.direction === LEFT_FACING) this.currentImages = this.moveLeft;
    else this.currentImages = this.standNeutral;
  }

  advanceToNextImage() {
    this.index++;
    if (this.index >= this.currentImages.length) this.index = 0;
    this.image = this.currentImages[this.index];
  }
}
