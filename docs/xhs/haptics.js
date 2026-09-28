(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CubeHaptics = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Optional enhancement: the gesture itself never depends on vibration support.
  class PetHaptics {
    constructor(options) {
      options = options || {};
      this.device = options.device || (typeof navigator !== 'undefined' ? navigator : {});
      this.page = options.page || (typeof document !== 'undefined' ? document : {});
      this.now = options.now || function () { return performance.now(); };
      this.enabled = false;
      this.lastPulse = -Infinity;
      this.activeUntil = 0;
    }
    get supported() { return typeof this.device.vibrate === 'function'; }
    setEnabled(value) {
      this.enabled = value === true && this.supported;
      if (!this.enabled) this.stop();
      return this.enabled;
    }
    pulse() {
      const now = this.now();
      if (!this.enabled || !this.supported || this.page.hidden || now - this.lastPulse < 160) return false;
      this.lastPulse = now;
      try {
        const accepted = this.device.vibrate(12) !== false;
        this.activeUntil = accepted ? now + 12 : 0;
        return accepted;
      } catch (error) { return false; }
    }
    stop() {
      if (this.supported && this.activeUntil > this.now()) {
        try { this.device.vibrate(0); } catch (error) { /* No effect in restricted containers. */ }
      }
      this.activeUntil = 0;
    }
  }
  return PetHaptics;
}));
