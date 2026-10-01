# Number Snake Arena

本專案版本為 **v0.7.0**，正式遊戲：[Number Snake Arena](https://chaohuang-tw.github.io/number-snake-arena/)。本版包含 Value 長身、雙向尾巴反彈、吃頭沿路徑化圈、六款頭型及視覺改善；玩法參數與既有進度格式保留。

本次為技術發布：真實手機／iPad、家長／孩子手感與弱裝置效能尚無驗證紀錄，均為 **NOT RUN**。Mac Chromium、WebKit 與 viewport 驗證不能替代真機驗收。依賴安全修補與查核範圍見 [v0.7.0 安全紀錄](docs/v0.7.0-security.md)；實際發布結果與對應 SHA 以 PR／Release 的當次證據為準。

數值 **Value** 決定蛇身長度；**Score** 是累計分數；**Level** 是關卡。吃掉比自己小的普通 AI 蛇頭可增加數值，碰到對方身體則會彈開。相等的蛇頭不可吃。

## 本機試玩

依既有 lockfile 安裝，使用受支援的 Node.js 24 LTS 與 npm：

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 3020 --strictPort
```

在**執行上述指令的同一台電腦**開啟 <http://127.0.0.1:3020/>。這是本機網址，並非公開預覽網址。

固定 production build 可用以下方式試玩：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 3022 --strictPort
```

開啟 <http://127.0.0.1:3022/number-snake-arena/>；重新建置才會更新這個預覽。


- 鍵盤：W／A／S／D 或方向鍵移動，空白鍵加速，M 啟動磁力；選單與按鈕可用滑鼠點擊。
- 觸控：拖曳左下搖桿；右下為加速與磁力。依觸控能力顯示控制，並非依視窗寬度判斷。
- 主選單可切換繁中／英文並保存。無語言偏好時預設繁體中文。
- 外觀設定提供六種免費蛇頭、對手隨機／指定，以及減少動態／低特效。

## v0.7.0 玩法參數

以下是目前程式設定，集中於 `src/config/gameBalance.ts`，不是孩子已確認的精確規則。

| 項目 | v0.7.0 設定 |
|---|---|
| 長度曲線 | `L(V) = clamp(36 + 24 × sqrt(V), 60, 720)`，世界像素，頭部中心至尾端 |
| 適用對象 | 玩家與普通 AI 使用同一曲線；Boss 維持既有設計 |
| 非法數值 | 非有限正數在初始計算回退至 Value 5，更新時保留先前合法值；最大長度不限制 Value 繼續成長 |
| 路徑與渲染 | 每 4 px 移動距離記錄；約 18 px 取樣；最多 40 個繪圖節點；末三節收尖 |
| 成長 | 可見尾端以 180 px/s 延伸；未展開、不可見的路徑不參與身體碰撞 |
| 頭部碰撞 | 玩家半徑 20 px；普通 AI 半徑 18 px；64 px 造型貼圖的突出配件不擴大判定 |
| 身體接觸 | 玩家頭 ↔ 普通 AI 身體；不處理自己、AI ↔ AI 或 Boss 的新身體反彈 |
| 反彈 | 150 ms，角色接觸冷卻 450 ms；頭對頭先於身體接觸；不扣生命、Value、Score 或蛇身 |
| 移動 | 一般 220 px/s、加速 340 px/s；加速能量上限 100 |
| 磁力 | 260 px 範圍、8 秒作用、20 秒冷卻；只吸較小普通 AI 與已解鎖掉落圈 |
| 磁力接觸保護 | 被反彈的同一普通 AI 短暫排除吸引 450 ms |
| 身體化圈 | 吃頭後沿可見原路徑轉化，250–450 ms 完成前不可收集 |
| 每隻蛇身體掉落總池 | **50 分、10 點能量、0 Value**；依實際 N 個圈以整數守恆分配 |
| 掉落容量與壽命 | 活躍圈最多 160 個；最舊先移除；11 秒過期；使用物件池；移除不補發獎勵 |
| 普通 AI／世界 | 普通 AI 最多 38 隻；世界 2400 × 1600 px |
| 低特效／減少動態 | 只減少裝飾、粒子、震動等回饋，不改長度、碰撞、掉落、移速與磁力規則 |

受傷沿用生命扣除規則，數值未下降時不再永久剪短身體。戰前 5／7／10、吞食與轉盤加值均更新同一個 Value 長度入口。蛇頭吞食的 Value、連擊分數與加速恢復，和身體掉落總池分開計算；完整收集且未碰能量上限時，身體掉落總收益恰為 50 分／10 能量。

| 關卡 | 主題 | 首領 | 觸發 Value | 普通敵人 Value 上限 | 首次過關 |
|---|---|---:|---:|---:|---|
| 1 | neon-grid | 100 | 70 | 99 | +1 最大生命、解鎖第 2 關 |
| 2 | cyber-city | 200 | 150 | 199 | +1 最大生命、解鎖第 3 關 |
| 3 | lava-core | 300 | 230 | 299 | +1 最大生命、解鎖第 4 關 |
| 4 | deep-space | 400 | 310 | 399 | 幸運轉盤 → 終極首領 500 → 最終通關 |

不新增第 5 關。轉盤六種獎項維持原規則。首領邊界、攻擊、排行榜與皇冠保留。

## 存檔與測試模式

既有進度 `number_snake_progression`、玩家造型 `number_snake_cosmetics_v1` 和語言 `number_snake_language_v1` 沿用。新增外觀偏好存於獨立的 `number_snake_visual_preferences_v1`；未知造型、壞 JSON 或儲存失敗會安全回退，不阻止遊玩。

`?debug=1` 只供開發與驗收，提供初始數值、位置、軌跡與生物的 fixture 設定。這些設定**不是玩家 UI 操作，也不能證明自然遊玩取得該數值**。新版碰撞案例在設定初始條件後，由實際遊戲迴圈判定；按鈕等待可見、可互動且穩定後，用一次正常 Playwright click／tap。刻意雙擊測重複獎勵是獨立案例，不用於補救單擊失敗。

`?e2e=1` 僅提供唯讀遊戲狀態，不提供修改數值或路由的作弊入口。一般網址不公開 debug 或 Phaser 全域存取。所有模式共用同一遊戲與畫面縮放。

## 驗證指令

```bash
npm ci
npx playwright install chromium
npm run test
npm run build
npm run test:e2e
```

`test:e2e` 未指定 `BASE_URL` 時，會啟動專案自己的 `127.0.0.1:3020` 伺服器，等待 ready，完成後只關閉該子程序。先關閉自己先前啟動的 3020 伺服器；或明確指定同一候選版的既有伺服器：

```bash
BASE_URL=http://127.0.0.1:3020/ npm run test:e2e
EVIDENCE_DIR=./test-results npm run test:e2e
npm run test:perf
# 使用完整 Chromium 的硬體渲染路徑；仍須讀回實際 GPU 狀態
PERF_HARDWARE_GPU=1 npm run test:perf
```

`test:perf` 另外執行五分鐘滿載：38 隻長身 AI、玩家長身、160 個圈、磁力與首領同場。一般 E2E 不會自動把這個耗時案例當作已執行。所有測試為零重試；一般 E2E 失敗保留 trace、截圖與影片，效能量測關閉 trace／錄影以免干擾 frame time，仍保存失敗截圖、每30秒部分數據及最終效能 JSON。瀏覽器模擬尺寸不是實體手機或 iPad 效能結果；渲染器與是否硬體加速亦須隨量測記錄。

PR 工作流程只有安裝、單元測試、建置、E2E 與證據上傳，沒有 Pages 寫入／部署權限。正式 Pages 部署限定通過 CI 的 `main` 流程。PR head、PR synthetic merge 與正式合併 commit 分開記錄，`test:prod` 的 `EXPECT_BUILD_COMMIT` 必須對應真正部署的 main SHA，不能使用舊候選驗證冒充新版本。

目前基線原始 E2E 已重跑，因 `ReferenceError: API is not defined` 以 exit 1 結束，**不能稱基線全部通過**。v0.7.0 執行結果以當次 frozen SHA 的 raw log、退出碼與 manifest 為準；本 README 不預填 CI、正式站、WebKit 或真機 PASS。

完整舊案例移轉與尚待補核項目見 [v0.7.0 測試移轉清單](docs/v0.7.0-test-migration.md)，原始工作範圍見 [接手規格](docs/v0.7.0-request.md)。
