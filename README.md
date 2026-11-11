# 轉帳 QR Code 精簡工具

純 HTML、CSS、JavaScript 靜態網頁。選擇／拖曳圖片、使用相機掃描，或貼上 TWQRP 個人轉帳文字後，只保留 D6（帳號）與 D5（銀行代碼），並產生可下載的 PNG QR Code。

```text
TWQRP://個人轉帳/158/02/V1?D5=808&D6=0000001234567890&D97=20260101000000&D98=EXAMPLE&D99=EXAMPLE
↓
TWQRP://個人轉帳/158/02/V1?D6=0000001234567890&D5=808
```

保留原始 TWQRP 路徑與帳號前導零，固定輸出 D6、D5 順序。拒絕缺少／重複 D5 或 D6、非 3 位銀行代碼、非數字帳號及非個人轉帳內容。輸入新的文字或轉換失敗時會清除先前結果，避免誤用舊 QR Code。

## 本機使用

需要 Node.js 18 或以上，不必安裝套件或執行建置。

```sh
npm start
```

開啟 http://127.0.0.1:4173 。相機需要 HTTPS 或 localhost 及使用者允許權限。直接開啟 `index.html` 也能使用文字與圖片功能，剪貼簿及相機功能依瀏覽器限制而定。

## 部署

將專案根目錄作為靜態網站發布即可。GitHub Pages 可將來源設定為發布分支的 `/ (root)`。現有 `CNAME` 已保留，若使用自訂網域須另外設定 DNS 與 HTTPS。

網站執行時無 CDN、遠端 API、分析追蹤或本機儲存；圖片、相機畫面與帳號只在瀏覽器記憶體中處理。切換輸入方式、關閉相機、頁面進入背景或離開頁面時會停止相機串流。重新整理頁面後不保留輸入。

此工具移除額外參數，並不保證所有銀行 App 都接受精簡後的格式或永久有效；轉帳前請核對銀行、帳號與銀行 App 顯示資訊。

## 驗證

```sh
npm test
```

測試涵蓋參數保留、順序、前導零、重複／無效欄位、中文路徑，以及使用實際程式庫產生和解碼 UTF-8 QR Code 的往返結果。

## 開源程式庫

固定版本並隨網站提供，無執行階段下載需求：

- [jsQR 1.4.0](https://github.com/cozmo/jsQR)：圖片與相機 QR Code 辨識，Apache-2.0，見 `vendor/jsQR.LICENSE`。
- [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator)：UTF-8 QR Code 產生，MIT，見 `vendor/qrcode.LICENSE`。
