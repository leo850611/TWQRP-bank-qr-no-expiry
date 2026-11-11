(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let result = null;
  let stream = null;
  let cameraSession = 0;
  let imageSession = 0;
  let frameTimer = null;
  let objectUrl = null;
  let busyImage = false;
  const scanCanvas = document.createElement('canvas');
  const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });
  const status = (message, kind = '') => { $('status').textContent = message; $('status').className = `status ${kind}`; };

  function clearResult() {
    result = null;
    $('empty-output').hidden = false;
    $('result').hidden = true;
    $('qr-canvas').getContext('2d').clearRect(0, 0, $('qr-canvas').width, $('qr-canvas').height);
    $('result-text').value = '';
    $('download').removeAttribute('href');
    $('bank-code').textContent = '';
    $('account-number').textContent = '';
  }

  function convert(raw) {
    clearResult();
    try {
      if (typeof window.qrcode !== 'function') throw new Error('QR Code 產生程式未載入，請重新整理網頁。');
      const next = window.simplifyTransfer(raw);
      const qr = window.qrcode(0, 'M');
      qr.addData(next.text, 'Byte');
      qr.make();
      const count = qr.getModuleCount();
      const quiet = 4;
      const scale = Math.max(8, Math.ceil(1024 / (count + quiet * 2)));
      const canvas = $('qr-canvas');
      canvas.width = canvas.height = (count + quiet * 2) * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
        if (qr.isDark(y, x)) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
      result = next;
      $('download').href = canvas.toDataURL('image/png');
      $('download').download = `transfer-qr-${result.bank}-${result.account.slice(-4)}.png`;
      $('bank-code').textContent = result.bank;
      $('account-number').textContent = result.account;
      $('result-text').value = result.text;
      $('result-summary').textContent = result.removed ? `已移除 ${result.removed} 個其他參數，保留 D6 與 D5。` : '內容已精簡，僅保留 D6 與 D5。';
      $('empty-output').hidden = true;
      $('result').hidden = false;
      status('轉換完成，請核對銀行代碼與帳號後下載。', 'success');
      if (window.matchMedia('(max-width: 680px)').matches) {
        if (document.activeElement === $('source-text')) $('source-text').blur();
        requestAnimationFrame(() => {
          if (result !== next) return;
          $('output-panel').scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start',
          });
        });
      }
      return true;
    } catch (error) { status(error.message || '無法轉換此內容，請確認格式。', 'error'); return false; }
  }

  function stopCamera() {
    cameraSession++;
    clearTimeout(frameTimer);
    frameTimer = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    $('camera-video').srcObject = null;
    $('camera-placeholder').hidden = false;
    $('scan-guide').hidden = true;
    $('start-camera').hidden = false;
    $('start-camera').disabled = false;
    $('stop-camera').hidden = true;
  }

  function setMode(mode) {
    stopCamera();
    imageSession++;
    busyImage = false;
    $('choose-image').disabled = false;
    document.querySelectorAll('[data-mode]').forEach(tab => {
      const selected = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`panel-${tab.dataset.mode}`).hidden = !selected;
    });
    status(result ? '已保留目前結果，可繼續匯入其他 QR Code。' : '等待匯入，選擇一種方式開始。');
  }

  function scan(source, width, height) {
    const ratio = Math.min(1, 1600 / Math.max(width, height));
    scanCanvas.width = Math.max(1, Math.round(width * ratio));
    scanCanvas.height = Math.max(1, Math.round(height * ratio));
    scanContext.drawImage(source, 0, 0, scanCanvas.width, scanCanvas.height);
    const pixels = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    return window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
  }

  async function readImage(file) {
    if (!file || busyImage) return;
    stopCamera();
    clearResult();
    const session = ++imageSession;
    if (!file.type.startsWith('image/')) { status('請選擇圖片檔案，例如 PNG 或 JPG。', 'error'); return; }
    if (file.size > 25 * 1024 * 1024) { status('圖片超過 25 MB，請先縮小圖片或改用截圖。', 'error'); return; }
    if (typeof window.jsQR !== 'function') { status('QR Code 辨識程式未載入，請重新整理網頁。', 'error'); return; }
    busyImage = true;
    $('choose-image').disabled = true;
    status('正在辨識圖片…');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
      if (session !== imageSession) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = url;
      $('source-image').src = url;
      $('file-name').textContent = file.name;
      $('image-preview').hidden = false;
      // Let the loading state paint before image decoding starts.
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (session !== imageSession) return;
      const code = scan(image, image.naturalWidth, image.naturalHeight);
      if (!code) { status('找不到 QR Code，請選擇清晰、完整且未裁切的圖片。', 'error'); return; }
      $('source-text').value = code.data;
      convert(code.data);
    } catch { if (session === imageSession) status('無法讀取這張圖片，請改用 PNG、JPG 或 WebP。', 'error'); }
    finally {
      if (objectUrl !== url) URL.revokeObjectURL(url);
      if (session === imageSession) { busyImage = false; $('choose-image').disabled = false; }
    }
  }

  async function startCamera() {
    stopCamera();
    clearResult();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status('此環境無法使用相機。請透過 HTTPS 或 localhost 開啟，或改用選擇圖片。', 'error'); return;
    }
    if (typeof window.jsQR !== 'function') { status('QR Code 辨識程式未載入，請重新整理網頁。', 'error'); return; }
    const session = cameraSession;
    $('start-camera').disabled = true;
    $('stop-camera').hidden = false;
    status('正在開啟相機，請允許瀏覽器使用相機…');
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (session !== cameraSession) { nextStream.getTracks().forEach(track => track.stop()); return; }
      stream = nextStream;
      const video = $('camera-video');
      video.srcObject = stream;
      await video.play();
      if (session !== cameraSession) return;
      $('camera-placeholder').hidden = true;
      $('scan-guide').hidden = false;
      $('start-camera').hidden = true;
      status('相機已開啟，請將 QR Code 對準畫面。');
      const tick = () => {
        if (session !== cameraSession) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            const code = scan(video, video.videoWidth, video.videoHeight);
            if (code) { $('source-text').value = code.data; stopCamera(); convert(code.data); return; }
          }
        } catch { stopCamera(); status('無法讀取相機畫面，請重新開啟或改用圖片。', 'error'); return; }
        frameTimer = setTimeout(tick, 160);
      };
      tick();
    } catch (error) {
      if (session !== cameraSession) return;
      stopCamera();
      const messages = { NotAllowedError: '未取得相機權限。請在瀏覽器允許相機，或改用選擇圖片。', NotFoundError: '找不到相機，請改用選擇圖片或貼上文字。', NotReadableError: '相機可能正被其他程式使用，請關閉後再試。' };
      status(messages[error.name] || '無法開啟相機，請確認權限或改用選擇圖片。', 'error');
    }
  }

  document.querySelectorAll('[data-mode]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); setMode(tabs[next].dataset.mode); tabs[next].focus(); }
    });
  });
  $('choose-image').addEventListener('click', () => $('image-input').click());
  $('image-input').addEventListener('change', event => { readImage(event.target.files[0]); event.target.value = ''; });
  ['dragover', 'dragenter'].forEach(name => $('choose-image').addEventListener(name, event => { event.preventDefault(); $('choose-image').classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => $('choose-image').addEventListener(name, event => { event.preventDefault(); $('choose-image').classList.remove('dragging'); }));
  $('choose-image').addEventListener('drop', event => readImage(event.dataTransfer.files[0]));
  // Prevent dropped files outside the target from navigating away from the tool.
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  $('start-camera').addEventListener('click', startCamera);
  $('stop-camera').addEventListener('click', () => { stopCamera(); status('相機已關閉。'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); });
  window.addEventListener('pagehide', stopCamera);
  $('panel-text').addEventListener('submit', event => { event.preventDefault(); convert($('source-text').value); });
  $('source-text').addEventListener('input', () => { clearResult(); status('文字已更新，按「產生 QR Code」完成轉換。'); });
  $('load-example').addEventListener('click', () => {
    $('source-text').value = 'TWQRP://個人轉帳/158/02/V1?D5=808&D6=0000001234567890&D97=20260101000000&D98=EXAMPLE&D99=EXAMPLE';
    clearResult(); status('已帶入示意範例，按「產生 QR Code」試用。');
  });
  $('reset').addEventListener('click', () => {
    clearResult(); setMode('image'); $('source-text').value = ''; $('image-input').value = '';
    $('image-preview').hidden = true; $('source-image').removeAttribute('src'); $('file-name').textContent = '';
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  });
  $('download').addEventListener('click', () => {
    if (!result) return;
    status('已準備 PNG 圖片；手機可在下載項目中儲存。', 'success');
  });
  $('copy').addEventListener('click', async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result.text); status('已複製精簡後的轉帳文字。', 'success'); }
    catch { $('result-text').focus(); $('result-text').select(); status('瀏覽器無法自動複製，已選取文字，請長按複製或按 Ctrl / ⌘ + C。'); }
  });
})();
