(function() {
  if (!Array.prototype.at) Array.prototype.at = function(n) {
    return this[n < 0 ? this.length + n : n];
  };
  if (!Object.fromEntries) Object.fromEntries = function(items) {
    var o = {};
    items.forEach(function(x) {
      o[x[0]] = x[1];
    });
    return o;
  };
  if (!window.ResizeObserver) window.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
      window.addEventListener("resize", fn);
    }
    observe() {
      this.fn();
    }
    disconnect() {
      window.removeEventListener("resize", this.fn);
    }
  };
  if (!("inert" in HTMLElement.prototype)) Object.defineProperty(HTMLElement.prototype, "inert", { get: function() {
    return this.hasAttribute("inert");
  }, set: function(v) {
    if (v) this.setAttribute("inert", "");
    else this.removeAttribute("inert");
  } });
  document.addEventListener("focusin", function(e) {
    if (e.target.closest("[inert]")) e.target.blur();
  });
  var safeProbe=document.createElement("div");
  safeProbe.style.cssText="position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--safe-area-inset-top, env(safe-area-inset-top, 0px))";
  document.body.appendChild(safeProbe);
  function size() {
    var status=parseFloat(getComputedStyle(safeProbe).paddingTop)||0;
    var hostTop=0;
    document.documentElement.style.setProperty("--host-top",hostTop+"px");
    document.documentElement.style.setProperty("--app-height",Math.max(160,window.innerHeight-hostTop)+"px");
  }
  size();
  window.addEventListener("resize", size);
})();
