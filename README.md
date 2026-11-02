# 南美圖資 BIM 模型工作台

使用現有 Autodesk Forge Viewer 7.52.0 與 BIM 模型的本機網頁。無需 npm 套件、Autodesk 登入或 Access Token。Python 3.9 以上即可執行。

## 線上查看

https://onework-io.github.io/nanmeiBIM/

直接用支援 WebGL 的瀏覽器開啟，不需要 Python、Autodesk 帳號或 Token。網站及模型由 GitHub Pages 提供，初次載入需要網路。

`main` 更新後，GitHub Actions 會執行 `scripts/build_static.py`，將 Viewer、介面及四個模型的靜態資源部署到 Pages。原始 ZIP 不會被修改，內附示範 HTML 不會發布。

本機可執行 `python3 scripts/build_static.py` 產生 `dist/`，再用 `python3 -m http.server 8081 --directory dist` 預覽。

## 本機離線啟動

```sh
git clone https://github.com/onework-io/nanmeiBIM.git
cd nanmeiBIM
python3 server.py
```

在瀏覽器開啟 http://127.0.0.1:8080 。如連接埠被占用，使用 `python3 server.py --port 8081`。結束時按 Ctrl+C。請透過伺服器開啟，不能直接雙擊 HTML。

## 使用

- 左側切換 3F、9F、B1F、B2F 模型。
- 拖曳旋轉、滾輪縮放、中鍵平移。
- 選取元件後按「隔離所選元件」，預設完全隱藏其他元件。
- 「完全隱藏／半透明」可即時切換隔離模式，也適用於模型樹及搜尋的隔離操作。
- 「還原全部」恢復全部元件、清除選取並回到全模型視角。
- 輸入構件名稱後按搜尋；符合的構件會被隔離並置中。
- 「重設顯示」恢復模型、清除選取與剖面、重設爆炸比例。
- 下方 Autodesk 原生工具列提供模型結構、屬性、測量、剖面等工具（依模型支援狀態顯示）。

## 加入模型

模型請給工一。

## 結構與離線行為

- `forge-viewer/`：原有 SDK，未修改。
- `BIM/`：原有模型，未修改。
- `web/`：繁體中文網頁介面。
- `server.py`：標準函式庫 HTTP 伺服器與 ZIP 資源端點。

伺服器預設僅綁定 `127.0.0.1`，供本機使用。SDK 採 `env: Local`、停用追蹤，HTTP Content Security Policy 限制網路資源為同源，不使用 CDN 或 Autodesk API。此本機模式首次載入也不需要外網；線上版本由 GitHub Pages 託管公開模型。

需要支援 WebGL 的瀏覽器；若無法顯示，檢查硬體加速、本機 SDK 檔案與模型包完整性。本機伺服器為開發與單機檢視用途。
