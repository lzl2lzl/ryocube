(function () {
  'use strict';
  var support = document.getElementById('support');
  var result = document.getElementById('result');
  var report = document.getElementById('report');
  var buttons = document.querySelectorAll('[data-duration]');
  var available = typeof navigator.vibrate === 'function';
  var records = [];
  var lastClick = -Infinity;

  function updateReport() {
    var activation = navigator.userActivation;
    report.textContent = [
      'ryocube haptics-check 1',
      'Vibration API: ' + available,
      'Visible: ' + !document.hidden,
      'Secure context: ' + !!window.isSecureContext,
      'Top-level page: ' + (window.top === window),
      'User activation: ' + (activation ? activation.hasBeenActive : 'unknown'),
      'Browser: ' + navigator.userAgent,
      'Results: ' + (records.length ? records.join(' | ') : 'none')
    ].join('\n');
  }

  support.textContent = available ? '浏览器提供震动接口，可以开始测试。' : '这个浏览器没有提供网页震动接口。';
  if (!available) result.textContent = '当前环境无法调用抚摸震动；这不是抚摸手势的问题。';
  buttons.forEach(function (button) {
    button.disabled = !available;
    button.addEventListener('click', function () {
      var now = performance.now();
      if (now - lastClick < 400) return;
      lastClick = now;
      var duration = Number(button.getAttribute('data-duration'));
      var accepted;
      try {
        // Archived device diagnostic; the room now uses visual petting feedback only.
        accepted = navigator.vibrate(duration);
        result.textContent = accepted === false ? duration + ' 毫秒：浏览器拒绝了请求。' : duration + ' 毫秒：请求已发出，请以手上的感觉为准。';
        records.push(duration + 'ms: ' + String(accepted));
      } catch (error) {
        result.textContent = '浏览器阻止了这次震动请求。';
        records.push(duration + 'ms: ' + error.name);
      }
      records = records.slice(-9);
      updateReport();
    });
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && available) {
      try { navigator.vibrate(0); } catch (error) { /* Optional device feedback. */ }
    }
    updateReport();
  });

  var appleSwitch = document.getElementById('apple-switch');
  // Only a real, visible native switch is tested; never simulate clicks for haptics.
  document.getElementById('apple-check').hidden = !('switch' in appleSwitch);
  appleSwitch.addEventListener('change', function () {
    records.push('native switch: ' + (appleSwitch.checked ? 'on' : 'off'));
    records = records.slice(-9);
    updateReport();
  });
  document.getElementById('copy-report').addEventListener('click', async function () {
    var status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(report.textContent);
      status.textContent = '已复制，可直接发给我。';
    } catch (error) {
      status.textContent = '没有复制成功，可以长按上方文字选择复制。';
    }
  });
  updateReport();
}());
