# XQ 全球贏家 — 支撐壓力線選取演算法
## 產品架構定義文件

---

## 文件資訊

| 項目 | 內容 |
|------|------|
| **文件名稱** | 產品架構定義 |
| **演算法版本** | v2.2（區位感知 + 鄰近失效） |
| **報告日期** | 2026-04-21 |
| **適用對象** | 技術人員、架構師、PM |
| **更新狀態** | 基於9檔股票驗證 + 價格區位判定 + VP 線鄰近失效 |

---

## 第一部分：演算法概述

### 1.1 產品定義

**產品名稱：** XQ 全球贏家 支撐壓力線選取演算法  
**功能定位：** 根據技術指標、量價資料、市況狀態和股價區位，自動生成動態的支撐線和壓力線  
**使用場景：** 日內交易員參考、技術面決策輔助、圖表視覺化標註  
**核心優勢：** 市況感知 + 價格區位感知 + 鄰近失效濾除 + 層級遞進 + 雙線獨立選層

### 1.2 演算法架構六層模型

```
【輸入層】 OHLCV → Volume Profile → 技術指標 → ADX/DI/ATR
    ↓
【市況判定層】 ADX(14) 分類 → TREND_UP / TREND_DOWN / RANGE
    ↓
【價格區位判定層】 ★v2.2★ Close vs VAH/POC/VAL → Zone 1/2/3/4
    + VP 線鄰近失效檢查（|Close − line| < 0.3×ATR → L1 失效）
    ↓
【支撐線邏輯層】 L1/L2/L3（區位決定 L1，鄰近失效時降 L2）
    ↓
【壓力線邏輯層】 L1/L2/L3（區位決定 L1，鄰近失效時降 L2）
    ↓
【驗證層】 兩階段觸及+確認 → is_valid 布林值
    ↓
【輸出層】 JSON 結構化信號 { date, period, price, layer, state, zone, atr, proximity_filtered, is_valid }
```

**v2.1 → v2.2 的關鍵變更（兩項同批）：**

1. **區位判定：** 在市況判定後、選層前插入「價格區位判定層」。v2.1 的 L1 層直接依市況選 VAH 或 VAL，未檢查 Close 相對位置，會產生四種誤判（TREND_UP 但 Close 在 VAH 下方、TREND_DOWN 但 Close 在 VAL 上方、RANGE 但已突破/跌破價值區間）。v2.2 將股價與 VP 的相對位置分為 4 個 Zone，確保 L1 層的 VP 選擇與股價實際位置一致。

2. **鄰近失效：** 區位分類解決「方向」誤判，但未處理「距離」無效。當 Close 過於貼近所選 L1 線（例如 Close=15,498、VAH=15,500），操作空間幾近零，且信號在 Zone 邊界反覆跳動。v2.2 新增 `|Close − L1| < 0.3×ATR(14)` 的鄰近檢查，觸發時 L1 自動失效並降至 L2（Fractal）。

---

## 第二部分：輸入層定義

### 2.1 數據源與變數

| 變數 | 資料來源 | 計算週期 | 說明 |
|------|---------|---------|------|
| **OHLCV** | K線資料 | 即時 | 開盤、最高、最低、收盤、成交量 |
| **Volume Profile（VP）** | 量價分析 | 逐日更新 | POC（峰值）、VAH(高成交量區)、VAL(低成交量區) |
| **SMA5 / SMA20 / SMA60** | 移動平均 | 逐日更新 | 短/中/長期趨勢線 |
| **ADX(14)** | Wilder's ADX | 逐日更新 | 趨勢強度指標，暖機期27根K線 |
| **+DI(14) / -DI(14)** | 方向指標 | 逐日更新 | 多頭/空頭強度判定 |
| **測試回溯期間** | 用戶設定 | 靜態參數 | 預設150個交易日 |

### 2.2 數據完整性要求

- **K線完整性：** 無缺失日期（考慮交易日曆）
- **VP補齊：** 所有股票必須提供完整的 VAH、POC、VAL 三欄時間序列
- **指標補齊：** MA5/20/60、ADX/DI 必須覆蓋完整期間
- **缺失處理：** 若某日缺乏 VP 或指標，該日不產生 L1 信號（降級至 L2/L3）

---

## 第三部分：市況判定層

### 3.1 ADX 計算方法（Wilder's ADX(14)）

#### 計算步驟

**第1步：計算真實波幅（True Range, TR）**

```
TR(i) = max(
  High(i) - Low(i),
  |High(i) - Close(i-1)|,
  |Low(i) - Close(i-1)|
)
```

真實波幅捕捉日內最大波動，無論開盤位置。

**第2步：計算方向動量（Directional Movement, DM）**

```
Up Move   = High(i) - High(i-1)
Down Move = Low(i-1) - Low(i)

條件判斷：
+DM = Up Move    if (Up Move > Down Move) AND (Up Move > 0)    else 0
-DM = Down Move  if (Down Move > Up Move) AND (Down Move > 0)  else 0
```

邏輯說明：
- 兩向同時為正時，只取較大者（避免重複計算）
- 確保每日只有一個方向有動量記錄

**第3步：Wilder's 平滑（N=14）**

平滑應用於 ATR、+DM、-DM 三個數列：

```
初始化（第14根K線）：
  Smoothed(14) = Sum(values[1:14])

遞推（第15根K線起）：
  Smoothed(i) = Smoothed(i-1) - (Smoothed(i-1) / 14) + Value(i)
           = Smoothed(i-1) × (13/14) + Value(i)
```

此平滑方式保留歷史資訊權重，避免劇烈波動。

**第4步：計算方向指標（Directional Indicators）**

```
ATR = Smoothed True Range（14週期平滑）

+DI(14) = 100 × (Smoothed +DM / ATR)
-DI(14) = 100 × (Smoothed -DM / ATR)
```

取值範圍：0 ~ 100，表示該方向的相對強度。

**第5步：計算 DX**

```
DI Sum  = +DI + -DI
DI Diff = |+DI - -DI|
DX = 100 × (DI Diff / DI Sum)   if DI Sum ≠ 0 else 0
```

DX 衡量多空強度的不對稱性，不考慮絕對值。

**第6步：計算 ADX（最終）**

```
ADX 初始化（第27根K線）：
  ADX(27) = Average(DX[14:27])  // 前14個DX的簡單平均

ADX 遞推（第28根K線起）：
  ADX(i) = (ADX(i-1) × 13 + DX(i)) / 14
```

ADX 啟動點為第27根K線（暖機期）；之前設為 null。

#### 實現細節

| 項目 | 規格 |
|------|------|
| **實現語言** | Python 3.x（無外部依賴） |
| **計算量** | 9檔 × 310根K線 = 2,790筆，<5秒完成 |
| **輸出格式** | JSON，包含 date、adx、plus_di、minus_di |
| **暖機期** | 27根K線前 ADX 值為 null |
| **保留小數位** | 2位（例：18.52） |

### 3.2 市況分類邏輯

根據 ADX 和 DI 比較，自動分類當日市況：

```python
def classify_market_state(adx, plus_di, minus_di):
    if adx > 25:
        if plus_di > minus_di:
            return "TREND_UP"      # 多頭趨勢
        else:
            return "TREND_DOWN"    # 空頭趨勢
    else:
        return "RANGE"             # 盤整
```

| 市況分類 | ADX條件 | DI條件 | 含義 |
|---------|--------|--------|------|
| **TREND_UP** | > 25 | +DI > -DI | 多頭趨勢 |
| **TREND_DOWN** | > 25 | -DI > +DI | 空頭趨勢 |
| **RANGE** | ≤ 25 | — | 盤整 |

**v2.2 說明：** 市況分類本身不再直接決定 L1 的 VP 來源，改由第四部分的「價格區位判定」負責。市況僅影響 L2/L3 的降層邏輯與輸出強度標示。

---

## 第四部分：價格區位判定層（v2.2 新增）

### 4.1 設計動機

v2.1 及之前的選層邏輯有一個隱藏缺陷：L1 層的 VP 選擇**只看市況**，不看股價相對 VAH/POC/VAL 的實際位置，造成四種誤判：

| 誤判 | 情境 | v2.1 錯誤邏輯 | 實際情況 |
|------|------|-------------|---------|
| **A** | TREND_UP + Close < VAH | 選 VAH 當支撐 | VAH 在價上方，實為壓力 |
| **B** | TREND_DOWN + Close > VAL | 選 VAL 當壓力 | VAL 在價下方，實為支撐 |
| **C** | RANGE + Close < VAL（已跌破） | 仍選 VAL 當支撐、VAH 當壓力 | VAL 已轉壓力，VAH 更遠 |
| **D** | RANGE + Close > VAH（已突破） | 仍選 VAL 當支撐、VAH 當壓力 | VAH 已轉支撐，VAL 更遠 |

v2.2 在選層前新增「價格區位判定」階段，消除上述誤判。

### 4.2 四個價格區位定義

| 區位 | 條件 | VAH 角色 | POC 角色 | VAL 角色 | 市場含義 |
|------|------|---------|---------|---------|---------|
| **Zone 1** | Close > VAH | 支撐（剛突破） | 深層支撐 | 底部支撐 | 突破價值區間上緣 |
| **Zone 2** | VAH ≥ Close > POC | 壓力 | 支撐 | 深層支撐 | 價值區間上半 |
| **Zone 3** | POC ≥ Close > VAL | 深層壓力 | 壓力 | 支撐 | 價值區間下半 |
| **Zone 4** | Close ≤ VAL | 頂部壓力 | 深層壓力 | 壓力（剛跌破） | 跌破價值區間下緣 |

### 4.3 區位判定虛擬碼

```python
def classify_price_zone(close, vah, poc, val):
    """
    依 Close 相對 VAH/POC/VAL 的位置分為 4 個 Zone
    VP 缺失時回傳 ZONE_UNKNOWN，L1 降級
    """
    if vah is None or poc is None or val is None:
        return "ZONE_UNKNOWN"
    
    if close > vah:
        return "ZONE_1"      # 突破價值區上緣
    elif close > poc:
        return "ZONE_2"      # 價值區上半
    elif close > val:
        return "ZONE_3"      # 價值區下半
    else:
        return "ZONE_4"      # 跌破價值區下緣
```

### 4.4 邊界條件處理

| 情境 | 處理 |
|------|------|
| VP 缺失（VAH/POC/VAL 任一為 null） | 回傳 `ZONE_UNKNOWN`，L1 跳過，直接走 L2 |
| Close 等於 VAH/POC/VAL | 採嚴格不等式（>），邊界歸入較低 Zone |
| VAH < POC 或 POC < VAL（資料錯誤） | 記錄警告，回傳 `ZONE_UNKNOWN` |
| Close 為當日收盤，非即時更新 | 區位判定採 T-1 日收盤，T 日信號生成 |

### 4.5 區位與市況的交互含義

| 市況 + 區位 | 含義 | 交易意涵 |
|-----------|------|---------|
| TREND_UP + Zone 1 | 健康多頭（突破價值區向上） | 支撐強，可追漲 |
| TREND_UP + Zone 2~3 | 多頭但在價值區內 | 支撐正常，觀察 |
| TREND_UP + Zone 4 | 多頭判定滯後（ADX 仍高但價已跌破 VP） | 警示訊號，趨勢可能反轉 |
| RANGE + Zone 1 或 4 | 盤整中的突破/跌破 | 轉折前兆 |
| RANGE + Zone 2~3 | 典型盤整 | 適用雙邊邏輯 |
| TREND_DOWN + Zone 4 | 健康空頭（跌破價值區向下） | 壓力強，可追空 |
| TREND_DOWN + Zone 2~3 | 空頭但在價值區內 | 壓力正常，觀察 |
| TREND_DOWN + Zone 1 | 空頭判定滯後（ADX 仍高但價已突破 VP） | 警示訊號，趨勢可能反轉 |

### 4.6 VP 線鄰近失效機制（v2.2 新增）

#### 4.6.1 設計動機

區位分類解決「方向」誤判（L1 選到錯邊），但未解決「距離」無效。以下兩種情境在 4.2 分類下同為 Zone 2，但實際操作價值天差地別：

| 情境 | Close | VAH | 距離 | 操作空間 |
|------|-------|------|------|---------|
| 有效 | 15,100 | 15,500 | 2.6% | 有 |
| 無效 | 15,498 | 15,500 | 0.013% | 幾乎為零 |

當 Close 過於貼近所選 L1 線時：
- 有效交易距離壓縮至可忽略 → 信號無操作價值
- Zone 邊界來回震盪（whipsaw） → 驗證層反覆觸發但無意義
- 觸及→反彈→再觸及 的噪音，稀釋 L1 有效率

#### 4.6.2 判定規則

對 L1 選出的 VP 線（Zone 1 支撐=VAH、Zone 2 支撐=POC、Zone 3 支撐=VAL；壓力對稱），檢查：

```
若  |Close − L1_line| < k × ATR(14)  則 L1 失效，改走 L2（Fractal）
```

| 參數 | 值 | 說明 |
|------|------|------|
| **k（鄰近係數）** | 初始 0.3 | 可校準區間 0.2 ~ 0.5，於 Phase 2-3 與動態門檻一併調整 |
| **ATR** | ATR(14)，Wilder 平滑 | 與市況判定層共用同一 ATR 數列，無需重算 |
| **適用層級** | 僅 L1 | L2（Fractal）、L3（MA）本身已含距離特性，不再應用 |

#### 4.6.3 鄰近失效虛擬碼

```python
def is_line_too_close(close, line_price, atr, k=0.3):
    """
    檢查 Close 與 VP 線距離是否小於 k × ATR
    ATR 缺失（null/0）時回傳 False，不誤殺 L1
    """
    if line_price is None or atr is None or atr == 0:
        return False
    return abs(close - line_price) < k * atr
```

#### 4.6.4 鄰近失效情境表

| Zone | L1 候選（支撐/壓力） | 鄰近失效典型情境 |
|------|---------------------|------------------|
| Zone 1 支撐=VAH | Close 剛站上 VAH | Close − VAH < 0.3 ATR → 突破力道不足，L1 失效 |
| Zone 2 支撐=POC | Close 在 POC 上方 | Close − POC < 0.3 ATR → 逼近 POC，可能下破 |
| Zone 3 支撐=VAL | Close 在 VAL 上方 | Close − VAL < 0.3 ATR → 逼近 VAL，可能跌破 |
| Zone 2 壓力=VAH | Close 在 VAH 下方 | VAH − Close < 0.3 ATR → 逼近 VAH，即將挑戰 |
| Zone 3 壓力=POC | Close 在 POC 下方 | POC − Close < 0.3 ATR → 逼近 POC |
| Zone 4 壓力=VAL | Close 剛跌破 VAL | VAL − Close < 0.3 ATR → 跌破力道不足，L1 失效 |

#### 4.6.5 邊界條件

| 情境 | 處理 |
|------|------|
| ATR 為 null（暖機期前 14 日） | `is_line_too_close` 回傳 False，不觸發失效 |
| ATR 為 0（停牌或資料異常） | `is_line_too_close` 回傳 False，不觸發失效 |
| L1 已為 None（Zone 1 壓力、Zone 4 支撐） | 檢查略過，直接走 L2 |
| 觸發後 L2 也為 None | 降至 L3（MA 兜底，永遠有值） |

---

## 第五部分：支撐壓力線選層邏輯

### 5.1 三層級定義

#### L1 層：量價結構（Volume Profile）— 由區位決定

**支撐 L1：**
- Zone 1（Close > VAH）：VAH 作支撐（剛突破，VAH 成新地板）
- Zone 2（VAH ≥ Close > POC）：POC 作支撐
- Zone 3（POC ≥ Close > VAL）：VAL 作支撐
- Zone 4（Close ≤ VAL）：**無 L1**（VP 無法作支撐，升級 L2）

**壓力 L1：**
- Zone 1（Close > VAH）：**無 L1**（VP 無法作壓力，升級 L2）
- Zone 2（VAH ≥ Close > POC）：VAH 作壓力
- Zone 3（POC ≥ Close > VAL）：POC 作壓力
- Zone 4（Close ≤ VAL）：VAL 作壓力（剛跌破，VAL 成新天花板）

**邏輯依據：** VP 的 VAH/POC/VAL 本身只代表「成交量分佈結構」，是支撐還是壓力取決於 Close 的位置。在價格之上的位階都是壓力，在價格之下的位階都是支撐。

**不適用條件：**
- VP 數據缺失（ZONE_UNKNOWN）
- Zone 1/4 的反向位階（例：Zone 1 時 VAL 為遠端支撐但不作為 L1 使用，仍保留於輸出參考）
- **鄰近失效（v2.2 新增）**：當 `|Close − L1| < 0.3 × ATR(14)` 時，雖方向正確但操作空間不足，L1 自動失效並降至 L2。詳見第 4.6 節。

#### L2 層：Fractal / 價格歷史高低點

**支撐 L2：**
- 取回顧期間（5/20/60日）內的**最低點**
- 代表歷史最弱點位，跌破需重新定義趨勢

**壓力 L2：**
- 取回顧期間內的**最高點**
- 代表歷史最強阻力，突破需確認新高

**適用條件：** 所有股票均可計算，無缺失風險。L1 失效（Zone 4 支撐或 Zone 1 壓力）時自動升級為主要層。

#### L3 層：移動平均線（兜底層）

**支撐 L3：**
```
條件：Close > MA
邏輯：收盤在均線上方，均線作動態支撐
選擇：優先 SMA5 > SMA20 > SMA60
```

**壓力 L3：**
```
條件：Close < MA
邏輯：收盤在均線下方，均線作動態壓力
選擇：優先 SMA5 > SMA20 > SMA60
```

**永遠可用性：** L1、L2 均失效時，L3 確保至少產生一條線

### 5.2 市況 × 區位聯合選層（v2.2）

#### 核心簡化規則

**L1 的 VP 來源只看區位，不看市況：**

| 區位 | 支撐 L1 | 壓力 L1 |
|------|--------|--------|
| **Zone 1**（Close > VAH） | VAH（剛突破成支撐） | 無 L1（升級 L2） |
| **Zone 2**（VAH ≥ Close > POC） | POC | VAH |
| **Zone 3**（POC ≥ Close > VAL） | VAL | POC |
| **Zone 4**（Close ≤ VAL） | 無 L1（升級 L2） | VAL（剛跌破成壓力） |
| **ZONE_UNKNOWN** | 無 L1 | 無 L1 |

**市況的角色（影響 L1 失效時的降層與 L2/L3 的優先級）：**

| 市況 | 降層順序 | 輸出強度標示 |
|------|---------|-----------|
| TREND_UP | L1 → L2（Fractal 低/高點）→ L3（MA） | 多頭支撐 = 強 / 多頭壓力 = 弱 |
| TREND_DOWN | L1 → L2 → L3 | 空頭支撐 = 弱 / 空頭壓力 = 強 |
| RANGE | L1 → L2 → L3 | 支撐/壓力 = 中等 |

（L3 永遠兜底，保證輸出有值）

#### 12 種市況 × 區位完整表

| 市況 | 區位 | 支撐 L1 | 支撐順序 | 壓力 L1 | 壓力順序 | 備註 |
|------|------|--------|---------|--------|---------|------|
| TREND_UP | Zone 1 | VAH | L1→L2→L3 | 無 L1 | L2→L3 | 健康多頭突破 |
| TREND_UP | Zone 2 | POC | L1→L2→L3 | VAH | L1→L2→L3 | 多頭在價值區上半 |
| TREND_UP | Zone 3 | VAL | L1→L2→L3 | POC | L1→L2→L3 | 多頭但位在下半（警示）|
| TREND_UP | Zone 4 | 無 L1 | L2→L3 | VAL | L1→L2→L3 | 多頭判定滯後 |
| RANGE | Zone 1 | VAH | L1→L2→L3 | 無 L1 | L2→L3 | 盤整突破 |
| RANGE | Zone 2 | POC | L1→L2→L3 | VAH | L1→L2→L3 | 盤整偏多 |
| RANGE | Zone 3 | VAL | L1→L2→L3 | POC | L1→L2→L3 | 盤整偏空 |
| RANGE | Zone 4 | 無 L1 | L2→L3 | VAL | L1→L2→L3 | 盤整跌破 |
| TREND_DOWN | Zone 1 | VAH | L1→L2→L3 | 無 L1 | L2→L3 | 空頭判定滯後 |
| TREND_DOWN | Zone 2 | POC | L1→L2→L3 | VAH | L1→L2→L3 | 空頭反彈上半 |
| TREND_DOWN | Zone 3 | VAL | L1→L2→L3 | POC | L1→L2→L3 | 空頭在下半 |
| TREND_DOWN | Zone 4 | 無 L1 | L2→L3 | VAL | L1→L2→L3 | 健康空頭跌破 |

### 5.3 選層虛擬碼（v2.2）

```python
def get_support_resistance(date, period, market_state):
    """
    v2.2 選層：區位先行，鄰近失效濾除無效 L1，市況影響降層
    """
    close = get_close(date)
    vah, poc, val = get_vp(date)
    atr = get_atr(date)          # ATR(14)，與市況判定共用
    zone = classify_price_zone(close, vah, poc, val)
    
    support_price, sup_proximity = _select_support(
        date, period, market_state, zone, vah, poc, val, close, atr)
    resist_price, res_proximity  = _select_resistance(
        date, period, market_state, zone, vah, poc, val, close, atr)
    
    vp_proximity_filtered = sup_proximity or res_proximity
    return support_price, resist_price, zone, atr, vp_proximity_filtered


def _select_support(date, period, state, zone, vah, poc, val, close, atr):
    """支撐線獨立選層（區位決定 L1，鄰近失效時降 L2）"""
    
    # L1 層依區位決定 VP 來源
    l1_map = {
        "ZONE_1": vah,           # 剛突破，VAH 成支撐
        "ZONE_2": poc,           # 價值區上半，POC 成支撐
        "ZONE_3": val,           # 價值區下半，VAL 成支撐
        "ZONE_4": None,          # 跌破，VP 無法作支撐
        "ZONE_UNKNOWN": None     # VP 缺失
    }
    l1 = l1_map.get(zone)
    
    proximity_filtered = False
    if l1 is not None:
        if is_line_too_close(close, l1, atr):     # v2.2 鄰近失效檢查
            proximity_filtered = True
        else:
            return l1, False
    
    # L2 層（Fractal 低點）
    l2 = get_fractal_low(date, period)
    if l2 is not None:
        return l2, proximity_filtered
    
    # L3 層（MA 兜底，永遠有值）
    return get_ma_support(date, period), proximity_filtered


def _select_resistance(date, period, state, zone, vah, poc, val, close, atr):
    """壓力線獨立選層（區位決定 L1，鄰近失效時降 L2）"""
    
    # L1 層依區位決定 VP 來源
    l1_map = {
        "ZONE_1": None,          # 突破，VP 無法作壓力
        "ZONE_2": vah,           # 價值區上半，VAH 成壓力
        "ZONE_3": poc,           # 價值區下半，POC 成壓力
        "ZONE_4": val,           # 剛跌破，VAL 成壓力
        "ZONE_UNKNOWN": None
    }
    l1 = l1_map.get(zone)
    
    proximity_filtered = False
    if l1 is not None:
        if is_line_too_close(close, l1, atr):     # v2.2 鄰近失效檢查
            proximity_filtered = True
        else:
            return l1, False
    
    # L2 層（Fractal 高點）
    l2 = get_fractal_high(date, period)
    if l2 is not None:
        return l2, proximity_filtered
    
    # L3 層（MA 兜底，永遠有值）
    return get_ma_resistance(date, period), proximity_filtered
```

**回傳值變更：** `get_support_resistance()` 回傳值由 v2.1 的 `(support, resist, zone)` 擴充為 `(support, resist, zone, atr, vp_proximity_filtered)`，後兩項供輸出層記錄。

---

## 第六部分：驗證層

### 6.1 兩階段驗證邏輯

#### 第一階段：觸及判定（T → T+N 日）

掃描從線條生成日（T日）至 T+N 日，檢查價格低點是否觸及支撐線或高點是否觸及壓力線。

**支撐線觸及條件：**
```
low(i) ≤ support_price + tolerance
其中 i ∈ [T, T+N]
```

**壓力線觸及條件：**
```
high(i) ≥ resist_price - tolerance
其中 i ∈ [T, T+N]
```

**距離容差閾值（按週期調整）：**

| 週期 | 容差比例 | 用途 |
|------|---------|------|
| 5日 | ≤ 5% | 短期線敏感性強 |
| 20日 | ≤ 10% | 中期線允許偏差 |
| 60日 | ≤ 18% | 長期線波動大 |

**無觸及判定：** 若 N 日內未觸及，該線條輸出 `is_valid = false`

#### 第二階段：確認判定（T+N → T+N+M 日）

在觸及後的 M 個交易日內，檢查收盤價是否有效突破 MA（穿越確認）。

**支撐線確認條件：**
```
Close(i) > SMA(period) × (1 + 確認門檻%)
其中 i ∈ [T+N, T+N+M]，至少1根K線滿足
```

**壓力線確認條件：**
```
Close(i) < SMA(period) × (1 - 確認門檻%)
其中 i ∈ [T+N, T+N+M]，至少1根K線滿足
```

**MA確認門檻（按市況調整）：**

| 市況 | 支撐 | 壓力 | 說明 |
|------|------|------|------|
| **TREND_UP** | 1.5% | 1.5% | 強趨勢，門檻低 |
| **TREND_DOWN** | 1.5% | 1.5% | 強趨勢，門檻低 |
| **RANGE** | 3.0% | 3.0% | 盤整易假突破，提高門檻 |

**確認參數 M：** 預設 5 個交易日（可調）

### 6.2 有效性判定流程圖

```
線條生成（支撐/壓力）
        ↓
[第一階段] 掃描 T → T+N 日
        ↓
   Yes ← 是否觸及？ → No
   ↓                    ↓
[第二階段]          無效 ✗
掃描 T+N → T+N+M
        ↓
   Yes ← 是否確認突破？ → No
   ↓                      ↓
有效 ✓                  無效 ✗
```

---

## 第七部分：輸出層

### 7.1 輸出信號結構（v2.2）

```json
{
  "date": "線條生成日期（YYYYMMDD）",
  "symbol": "股票代號（如 2330.TW）",
  "period": 5 | 20 | 60,
  "type": "support" | "resistance",
  "price": 15234.50,
  "layer": "L1" | "L2" | "L3",
  "market_state": "TREND_UP" | "TREND_DOWN" | "RANGE" | "UNKNOWN",
  "price_zone": "ZONE_1" | "ZONE_2" | "ZONE_3" | "ZONE_4" | "ZONE_UNKNOWN",
  "close_at_generation": 15234.50,
  "vah_at_generation": 15500,
  "poc_at_generation": 15100,
  "val_at_generation": 14800,
  "atr_at_generation": 312.5,
  "vp_proximity_filtered": true | false,
  "is_valid": true | false,
  "touched_date": "首次觸及日期（YYYYMMDD）或 null",
  "days_to_touch": 整數（首次觸及距生成日的交易日數）或 null,
  "validation_date": "確認日期（YYYYMMDD）或 null",
  "fractal_lookback": 週期內最高/最低基準K線數,
  "vp_source": "VAH" | "POC" | "VAL" | null,
  "ma_source": "SMA5" | "SMA20" | "SMA60" | null,
  "adx_at_generation": ADX值（浮點數）,
  "di_plus_at_generation": +DI值,
  "di_minus_at_generation": -DI值
}
```

**v2.2 新增欄位說明：**
- `price_zone`：當日股價的區位分類
- `close_at_generation`、`vah_at_generation`、`poc_at_generation`、`val_at_generation`：生成當日的 Close 與 VP 三位階快照，便於後續追溯與除錯
- `atr_at_generation`：生成當日 ATR(14) 值，用於事後重算鄰近失效判定
- `vp_proximity_filtered`：true 表示 L1 因 `|Close − L1| < 0.3 × ATR` 而降至 L2/L3；支撐或壓力任一觸發即為 true

### 7.2 輸出範例

**Zone 1 多頭支撐線（L1 有效，距離充足）：**
```json
{
  "date": "20260421",
  "symbol": "2382.TW",
  "period": 5,
  "type": "support",
  "price": 15500,
  "layer": "L1",
  "market_state": "TREND_UP",
  "price_zone": "ZONE_1",
  "close_at_generation": 15800,
  "vah_at_generation": 15500,
  "poc_at_generation": 15100,
  "val_at_generation": 14800,
  "atr_at_generation": 320.5,
  "vp_proximity_filtered": false,
  "is_valid": true,
  "touched_date": "20260424",
  "days_to_touch": 2,
  "validation_date": "20260426",
  "vp_source": "VAH",
  "adx_at_generation": 28.5,
  "di_plus_at_generation": 32.1,
  "di_minus_at_generation": 18.3
}
```

**Zone 3 盤整壓力線（L1 有效）：**
```json
{
  "date": "20260418",
  "symbol": "2330.TW",
  "period": 20,
  "type": "resistance",
  "price": 21450,
  "layer": "L1",
  "market_state": "RANGE",
  "price_zone": "ZONE_3",
  "close_at_generation": 21200,
  "vah_at_generation": 21800,
  "poc_at_generation": 21450,
  "val_at_generation": 20900,
  "atr_at_generation": 425.0,
  "vp_proximity_filtered": false,
  "is_valid": false,
  "touched_date": null,
  "days_to_touch": null,
  "validation_date": null,
  "vp_source": "POC",
  "adx_at_generation": 22.1,
  "di_plus_at_generation": 24.5,
  "di_minus_at_generation": 26.2
}
```

**Zone 2 支撐線（L1 鄰近失效，降至 L2）：**
```json
{
  "date": "20260422",
  "symbol": "2330.TW",
  "period": 20,
  "type": "support",
  "price": 21050,
  "layer": "L2",
  "market_state": "RANGE",
  "price_zone": "ZONE_2",
  "close_at_generation": 21500,
  "vah_at_generation": 21800,
  "poc_at_generation": 21450,
  "val_at_generation": 20900,
  "atr_at_generation": 200.0,
  "vp_proximity_filtered": true,
  "is_valid": true,
  "touched_date": "20260425",
  "days_to_touch": 3,
  "validation_date": "20260428",
  "vp_source": null,
  "ma_source": null,
  "fractal_lookback": 20,
  "adx_at_generation": 22.1,
  "di_plus_at_generation": 24.5,
  "di_minus_at_generation": 26.2
}
```
*說明：Close=21,500 距 POC=21,450 僅 50 點（0.25 × ATR=50），觸發鄰近失效 → L1 POC 改為 L2 Fractal 低點 21,050。*

---

## 第八部分：決策樹邏輯圖（v2.2）

```
╔════════════════════════════════════════════════════════════════════════╗
║                      每日開盤後觸發演算法                              ║
╚════════════════════════════════════════════════════════════════════════╝
                              ↓
                    ┌─ 讀取當日 OHLCV 數據 ─┐
                    │ 讀取 Volume Profile   │
                    │ 讀取技術指標          │
                    └───────────────────────┘
                              ↓
                    ╔═════════════════════╗
                    ║  市況判定階段        ║
                    ╠═════════════════════╣
                    ║ 計算 ADX(14)        ║
                    ║ 計算 +DI / -DI      ║
                    ║ 判定市況狀態        ║
                    ╚═════════════════════╝
                              ↓
                   ┌──────────┼──────────┐
                   ↓          ↓          ↓
             TREND_UP   TREND_DOWN    RANGE
                              ↓
                    ╔═════════════════════╗
                    ║ 價格區位判定階段    ║ ★v2.2 新增★
                    ╠═════════════════════╣
                    ║ 讀取 VAH/POC/VAL    ║
                    ║ 比較 Close 位置     ║
                    ║ 分類 Zone 1/2/3/4   ║
                    ╚═════════════════════╝
                              ↓
               ┌──────┬──────┼──────┬──────┐
               ↓      ↓      ↓      ↓      ↓
            Zone 1 Zone 2 Zone 3 Zone 4 ZONE_UNKNOWN
                              ↓
        ╔═══════════════════════════════════════╗
        ║    對每個週期 5、20、60 日執行：      ║
        ╚═══════════════════════════════════════╝
                    ↓
    ┌───────────────┬─────────────────┐
    ↓               ↓                 ↓
[支撐線選層]    [壓力線選層]    [兩階段驗證]
    
[支撐線選層] — L1 層由區位決定：
  Zone 1 → L1=VAH → L2 → L3
  Zone 2 → L1=POC → L2 → L3
  Zone 3 → L1=VAL → L2 → L3
  Zone 4 → 無 L1 → L2 → L3
  (L3 永遠兜底)

[壓力線選層] — L1 層由區位決定：
  Zone 1 → 無 L1 → L2 → L3
  Zone 2 → L1=VAH → L2 → L3
  Zone 3 → L1=POC → L2 → L3
  Zone 4 → L1=VAL → L2 → L3
  (L3 永遠兜底)

[兩階段驗證]：
  第一階段 ← 掃描 T → T+N 日
     └─ 低點 ≤ 支撐+容差？
     └─ 高點 ≥ 壓力-容差？
  
  第二階段 ← T+N 日觸及後
     └─ 收盤 > MA × (1+門檻%)？支撐確認
     └─ 收盤 < MA × (1-門檻%)？壓力確認
                    ↓
        ╔════════════════════════════╗
        ║ 輸出 JSON 信號結構          ║
        ║ date, price, layer,        ║
        ║ market_state, price_zone,  ║
        ║ is_valid, touched_date,    ║
        ║ validation_date            ║
        ╚════════════════════════════╝
                    ↓
        ┌──────────┬────────┬──────────┐
        ↓          ↓        ↓          ↓
    統計有效率   統計層級   統計週期   統計市況×區位
     (按線條)    分布      表現      表現
                    ↓
        最終輸出 900 條信號
        (支撐300+壓力300+3週期)
```

---

## 第九部分：v2.0 / v2.1 / v2.2 演進對比

### 9.1 三版本核心變更

| 維度 | v2.0（舊） | v2.1（中間版） | v2.2（當前） |
|------|-----------|--------------|------------|
| **選層耦合** | 支撐+壓力共用候選集 | 獨立雙函式選層 | 獨立雙函式選層 |
| **同價格 bug** | 存在（TREND_UP 時 s=r=VAH） | 已修復 | 已修復 |
| **L1 決定因子** | 市況 | 市況 | **區位**（v2.2 變更） |
| **Close 位置檢查** | 無 | 無 | **有**（v2.2 新增） |
| **市況角色** | 決定 L1 | 決定 L1+優先順序 | 決定降層順序+強度標示 |
| **誤判 A/B/C/D** | 未處理 | 部分緩解 | 完全消除 |
| **L3 兜底** | L1/L2失效才用 | 永遠可用 | 永遠可用 |

### 9.2 v2.1 → v2.2 實現細節變更

**v2.1 選層邏輯（市況主導）：**
```python
def _select_support(date, period, state):
    if state == "TREND_UP":
        l1 = get_vp_vah(date)  # ← 直接用 VAH，不檢查 Close
        if l1 is not None:
            return l1
    elif state == "TREND_DOWN":
        # 跳過 L1，L2 優先
        ...
```

**問題：**
- TREND_UP 時若 Close < VAH，VAH 其實是壓力不是支撐
- TREND_DOWN 時若 Close > VAL，VAL 其實是支撐不是壓力

**v2.2 選層邏輯（區位主導）：**
```python
def _select_support(date, period, state, zone, vah, poc, val):
    l1_map = {
        "ZONE_1": vah,
        "ZONE_2": poc,
        "ZONE_3": val,
        "ZONE_4": None,
        "ZONE_UNKNOWN": None
    }
    l1 = l1_map.get(zone)
    ...
```

**優勢：**
- L1 的 VP 來源與 Close 位置一致，不會選到價格錯邊的位階
- 邏輯更簡潔（map 替代多層 if/elif）
- 市況變數僅在 L2/L3 降層中使用，關注點分離

### 9.3 各版本預期效能對比

基於 9 檔股票回測（v2.2 為估算值，正式回測待 Phase 2-2）：

| 指標 | v2.0 | v2.1 | v2.2（估計） |
|------|------|------|-----|
| 整體有效率（平均） | 22.5% | 23.3% | **25~26%** |
| 多頭支撐有效率 | 77% | 77% | **79~81%** |
| 多頭壓力有效率 | 5.3% | 9.4% | **10~12%** |
| 盤整有效率 | 13.8% | 14.2% | **16~18%** |
| L1 誤判率 | 15~25% | 15~25% | **0~3%** |

**升幅成因推測：**
- 區位判定主要改善 L1 的誤判（Zone 4 支撐改 L2、Zone 1 壓力改 L2）
- 盤整期 Zone 1/4 頻繁（轉折區），區位判定受益最多

---

## 第十部分：邏輯完整性檢查表

| 檢查項 | 狀態 | 說明 |
|--------|------|------|
| **輸入層覆蓋** | ✅ | OHLCV、VP（VAH/POC/VAL）、MA、ADX/DI 均已定義 |
| **市況分類唯一** | ✅ | 三分類互斥，所有狀況覆蓋 |
| **價格區位判定唯一** | ✅ | 四分類互斥，邊界條件明確（v2.2 新增） |
| **L1 選擇與 Close 位置一致** | ✅ | 消除 VAH 誤判為支撐等四種情境（v2.2 新增） |
| **VP 缺失容錯** | ✅ | ZONE_UNKNOWN 時直接降至 L2（v2.2 新增） |
| **VP 線鄰近失效** | ✅ | \|Close − L1\| < 0.3×ATR 時自動降 L2（v2.2 新增） |
| **ATR 缺失容錯** | ✅ | ATR 為 null/0 時 `is_line_too_close` 回傳 False，不誤殺 L1（v2.2 新增） |
| **支撐層級順序一致** | ✅ | 區位決定 L1，L2/L3 依序降層 |
| **壓力層級順序一致** | ✅ | 區位決定 L1，L2/L3 依序降層 |
| **L3兜底永遠有值** | ✅ | SMA 永遠存在，避免無線條輸出 |
| **同價格bug修復** | ✅ | 區位決定 L1 後，支撐與壓力 VP 來源天然分離 |
| **驗證邏輯完整** | ✅ | 兩階段驗證，觸及+確認 |
| **邊界條件處理** | ✅ | 缺失數據有 fallback，容差有容限 |
| **輸出格式標準化** | ✅ | JSON 結構一致，欄位完整（v2.2 新增 price_zone 等 7 欄） |

---

## 附錄 A：參數速查表

### 容差設定
```
5日週期觸及容差：5%
20日週期觸及容差：10%
60日週期觸及容差：18%

多頭/空頭 MA確認門檻：1.5%
盤整 MA確認門檻：3.0%
確認掃描窗口：5個交易日
```

### 市況分類閾值
```
ADX > 25：趨勢
ADX ≤ 25：盤整
+DI > -DI：多頭
-DI > +DI：空頭
```

### 價格區位分類閾值（v2.2 新增）
```
Close > VAH         → ZONE_1（突破價值區上緣）
VAH ≥ Close > POC   → ZONE_2（價值區上半）
POC ≥ Close > VAL   → ZONE_3（價值區下半）
Close ≤ VAL         → ZONE_4（跌破價值區下緣）
VP 缺失             → ZONE_UNKNOWN（L1 降級）
```

### VP 線鄰近失效參數（v2.2 新增）
```
k（鄰近係數）        = 0.3（初始值，可校準區間 0.2 ~ 0.5）
ATR 來源            = ATR(14)，Wilder 平滑
觸發條件            = |Close − L1_line| < k × ATR → L1 失效，降 L2
ATR 缺失（null/0）  = 不觸發（回傳 False）
適用層級            = 僅 L1（L2/L3 不適用）
```

### 層級優先順序速查（v2.2）
```
L1 來源（由區位決定）：
  Zone 1：支撐=VAH / 壓力=無
  Zone 2：支撐=POC / 壓力=VAH
  Zone 3：支撐=VAL / 壓力=POC
  Zone 4：支撐=無  / 壓力=VAL
  ZONE_UNKNOWN：支撐=無 / 壓力=無

L2 / L3 順序（市況僅影響降層優先級，不影響 L1 來源）：
  L2 = Fractal 高/低點（期間內）
  L3 = SMA5/SMA20/SMA60（兜底永遠有值）
```

---

**文件完成日期：2026-04-21**  
**版本：v2.2（區位感知 + 鄰近失效，定案）**  
**下一份文件：2_BACKTEST_RESULTS.md**
