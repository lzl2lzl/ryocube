(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CubeGestures = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class TapSequence {
    constructor() { this.reset(); }

    reset() {
      this.times = [];
      this.last = null;
      this.waking = false;
    }

    push(now, sleeping) {
      if (!Number.isFinite(now)) throw new TypeError('Tap time must be finite');
      if (this.last === null || now < this.last || now - this.last > 450) {
        this.times = [];
        this.waking = Boolean(sleeping);
      }
      this.last = now;

      // A waking burst owns its trailing taps, even after the character wakes.
      if (this.waking) {
        return { kind: sleeping ? 'wake' : 'wake-tail', rapidCount: 0 };
      }
      if (sleeping) {
        this.times = [];
        this.waking = true;
        return { kind: 'wake', rapidCount: 0 };
      }

      this.times = this.times.filter(function (time) { return now - time <= 3000; });
      this.times.push(now);
      if (this.times.length >= 9) {
        this.reset();
        return { kind: 'transform', rapidCount: 9 };
      }
      return { kind: 'tap', rapidCount: this.times.length };
    }
  }

  class PetStroke {
    constructor(startX, startY, threshold) {
      this.threshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 28;
      this.moved = false;
      this.inside = true;
      this.startX = startX;
      this.startY = startY;
      this.anchor(startX, startY);
    }

    anchor(x, y) {
      this.anchorX = x;
      this.anchorY = y;
      this.axis = null;
      this.direction = 0;
      this.strokeStart = 0;
      this.extreme = 0;
      this.counted = false;
    }

    move(x, y, inside) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { moved: this.moved, counted: false };
      }
      if (Math.hypot(x - this.startX, y - this.startY) > 8) this.moved = true;

      if (!inside) {
        this.inside = false;
        this.anchor(x, y);
        return { moved: this.moved, counted: false };
      }
      if (!this.inside) {
        this.inside = true;
        this.anchor(x, y);
        return { moved: this.moved, counted: false };
      }

      if (!this.axis) {
        const dx = x - this.anchorX;
        const dy = y - this.anchorY;
        if (Math.hypot(dx, dy) <= 8) return { moved: this.moved, counted: false };
        this.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        this.strokeStart = this.axis === 'x' ? this.anchorX : this.anchorY;
        this.extreme = this.strokeStart;
        this.direction = (this.axis === 'x' ? dx : dy) < 0 ? -1 : 1;
      }

      const coordinate = this.axis === 'x' ? x : y;
      const advance = (coordinate - this.extreme) * this.direction;
      if (advance > 0) {
        this.extreme = coordinate;
      } else if (advance <= -10) {
        // Only a real reversal starts another stroke; small jitter cannot.
        this.strokeStart = this.extreme;
        this.extreme = coordinate;
        this.direction *= -1;
        this.counted = false;
      }

      let counted = false;
      if (!this.counted && (this.extreme - this.strokeStart) * this.direction >= this.threshold) {
        this.counted = true;
        counted = true;
      }
      return { moved: this.moved, counted: counted };
    }
  }

  return { TapSequence: TapSequence, PetStroke: PetStroke };
}));
