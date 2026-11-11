(function (root) {
  'use strict';
  function simplifyTransfer(input) {
    const raw = String(input).trim();
    if (!raw) throw new Error('請先輸入或掃描 TWQRP 個人轉帳內容。');
    if (raw.length > 10000) throw new Error('內容過長，請確認這是個人轉帳 QR Code。');
    const question = raw.indexOf('?');
    let path;
    try { path = decodeURI(raw.slice(0, question)); } catch { throw new Error('轉帳路徑格式不正確。'); }
    if (question < 0 || !/^TWQRP:\/\/個人轉帳\/\d+\/\d+\/V\d+$/i.test(path) || raw.includes('#')) {
      throw new Error('僅支援 TWQRP://個人轉帳/… 格式，請確認匯入內容。');
    }
    const params = new URLSearchParams(raw.slice(question + 1));
    for (const key of ['D5', 'D6']) {
      if (params.getAll(key).length !== 1) throw new Error(`必須包含且只能有一個 ${key}，請確認原始內容。`);
    }
    const bank = params.get('D5');
    const account = params.get('D6');
    if (!/^\d{3}$/.test(bank)) throw new Error('銀行代碼 D5 必須是 3 位數字。');
    if (!/^\d{1,20}$/.test(account)) throw new Error('帳號 D6 必須是 1 至 20 位數字。');
    return {
      text: `${path}?D6=${account}&D5=${bank}`,
      bank,
      account,
      removed: [...params.keys()].filter(key => key !== 'D5' && key !== 'D6').length,
    };
  }
  if (typeof module === 'object' && module.exports) module.exports = { simplifyTransfer };
  else root.simplifyTransfer = simplifyTransfer;
})(typeof window === 'object' ? window : globalThis);
