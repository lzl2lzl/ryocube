window.CubeStorage = (function() {
  var ready = (async function() {
    var x = window.xhs, m = x && x.miniTool, o = x && x.launchOptions;
    try {
      if (!(o && o.miniToolEnv && o.miniToolEnv.buildVersion) && m && typeof m.getLaunchOptions === "function") o = await m.getLaunchOptions();
    } catch (e) {
    }
    var n = Number(o && o.miniToolEnv && o.miniToolEnv.buildVersion) || 0;
    return Math.floor(n / 1e3) >= 9460 && m && typeof m.getStorage === "function" && typeof m.setStorage === "function" ? m : null;
  })();
  return { get: async function(key) {
    var m = await ready;
    try {
      if (m) {
        var r = await m.getStorage({ key });
        if (r.data) return r.data;
        var old = localStorage.getItem(key);
        if (old) await m.setStorage({ key, data: old });
        return old;
      }
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }, set: async function(key, data) {
    var m = await ready;
    try {
      if (m) await m.setStorage({ key, data });
      else localStorage.setItem(key, data);
      return true;
    } catch (e) {
      return false;
    }
  } };
})();
