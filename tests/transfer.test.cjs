const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { simplifyTransfer } = require('../transfer.js');
const jsQR = require('../vendor/jsQR.js');
const context = vm.createContext({});
for (const file of ['qrcode.js', 'qrcode_UTF8.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../vendor', file), 'utf8'), context);
const prefix = 'TWQRP://個人轉帳/158/02/V1';
const source = `${prefix}?D5=808&D6=0000001234567890&D97=20260101000000&D98=EXAMPLE&D99=EXAMPLE`;
const expected = `${prefix}?D6=0000001234567890&D5=808`;

test('keeps only D6 then D5 and preserves leading zeros and path', () => {
  assert.deepEqual(simplifyTransfer(' \n' + source + '\n'), { text: expected, bank: '808', account: '0000001234567890', removed: 3 });
  assert.equal(simplifyTransfer(`${prefix}?D6=0000001234567890&amount=500&D5=808&memo=test`).text, expected);
});
test('conversion is idempotent and supports encoded Chinese', () => {
  assert.equal(simplifyTransfer(expected).text, expected);
  assert.equal(simplifyTransfer(source.replace('個人轉帳', encodeURIComponent('個人轉帳'))).text, expected);
});
test('rejects missing, duplicate and malformed bank/account fields', () => {
  for (const query of ['D5=808', 'D6=123', 'D5=808&D5=809&D6=123', 'D5=808&D6=123&D6=456', 'D5=80&D6=123', 'D5=808&D6=', 'D5=808&D6=12a', 'D5=808&D6=123456789012345678901']) {
    assert.throws(() => simplifyTransfer(`${prefix}?${query}`));
  }
});
test('rejects unrelated QR codes, injection, invalid encoding and fragments', () => {
  for (const value of ['', 'https://example.com?D5=808&D6=123', 'javascript:alert(1)', `${source}#fragment`, source.replace('個人轉帳', '%zz'), source.replace('個人轉帳', '購物')]) {
    assert.throws(() => simplifyTransfer(value));
  }
});
test('UTF-8 QR codes round trip through the actual bundled decoder', () => {
  for (const text of [source, simplifyTransfer(source).text]) {
    const qr = context.qrcode(0, 'M');
    qr.addData(text, 'Byte'); qr.make();
    const modules = qr.getModuleCount();
    const scale = 8, quiet = 4, size = (modules + quiet * 2) * scale;
    const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const row = Math.floor(y / scale) - quiet, col = Math.floor(x / scale) - quiet;
      if (row >= 0 && col >= 0 && row < modules && col < modules && qr.isDark(row, col)) {
        const i = (y * size + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
    assert.equal(jsQR(pixels, size, size, { inversionAttempts: 'attemptBoth' }).data, text);
  }
});
