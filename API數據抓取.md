  
\# API 數據抓取

## 基礎設定

- **基礎 URL**：`http://192.168.100.129/aiinsight2/`
- **API 文件**：http://192.168.100.129/aiinsight2/docs
- **MCP 端點**：http://192.168.100.129/aiinsight2/mcp

---

## K 線資料 API

### 1. GET /symbolinfo/kline
**用途**：取得股票日線以上 K 線歷史資料（固定天數回看）

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `stockID` | string | ✓ | 股票代碼，格式 `ID.Market`，例如 `2330.TW` |
| `baseDate` | string | ✓ | 基礎日期，格式 `YYYYMMDD`，例如 `20260420` |
| `freqType` | integer | ✓ | 頻率代碼，預設 `8`（日線） |
| `count` | integer | ✓ | 回看筆數，預設 `20` |

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_kline(
    stock_id="2330.TW",
    base_date="20260420",
    freq_type=8,      # 日線
    count=20
)
```

---

### 2. GET /symbolinfo/kline2
**用途**：取得股票日線以上 K 線歷史資料（依日期範圍，升序排列）

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `stockID` | string | ✓ | 股票代碼，格式 `ID.Market`，例如 `2330.TW` |
| `dateFrom` | string | ✓ | 開始日期，格式 `YYYYMMDD`（含），例如 `20260101` |
| `dateTo` | string | ✓ | 結束日期，格式 `YYYYMMDD`（含），例如 `20260420` |
| `freqType` | integer | ✓ | 頻率代碼，預設 `8`（日線） |

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_kline_by_date_range(
    stock_id="2330.TW",
    date_from="20260101",
    date_to="20260420",
    freq_type=8        # 日線
)
```

---

### 3. GET /symbolinfo/kline-minute
**用途**：取得股票分鐘 K 線歷史資料

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `stockID` | string | ✓ | 股票代碼，格式 `ID.Market`，例如 `2330.TW` |
| `dateFrom` | string | ✓ | 起始日期，格式 `YYYYMMDD`，例如 `20260401` |
| `dateTo` | string | ✓ | 結束日期，格式 `YYYYMMDD`，例如 `20260420` |
| `freqType` | integer | ✓ | 頻率代碼，預設 `3`（5分K） |

**freqType 代碼對照**：
- `2` = 1 分K
- `3` = 5 分K（預設）
- `4` = 10 分K
- `5` = 15 分K
- `6` = 30 分K
- `7` = 60 分K
- `32/35/36/37/39/41` = 對應還原股本的版本

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_kline_minute(
    stock_id="2330.TW",
    date_from="20260415",
    date_to="20260420",
    freq_type=3        # 5分K
)
```

---

### 4. GET /rtquote/minutekline
**用途**：取得盤中即時單一股票的分鐘 K 線資料

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `symbol` | string | ✓ | 股票代碼，格式 `{代碼}.{市場}`，例如 `2330.TW` |

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_realtime_minute_kline(symbol="2330.TW")
```

---

---

## 技術指標與成交量分布 API

### 5. GET /api/v1/indicator/{symbol}
**用途**：取得指定股票在特定日期的技術指標資料

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `symbol` | string | ✓ | 股票代碼，例如 `2330.TW` |
| `date` | string | ✗ | 交易日，格式 `YYYYMMDD`，不指定則使用上游最新交易日 |

**回傳欄位**：
- **原始數據**：`open`、`high`、`low`、`close`、`volume`
- **還原價格**：`adj_*`（對應還原價）
- **技術指標**：
  - 移動平均線：MA(5、10、20、60、120、240)
  - 相對強度指標：RSI(6、12)
  - MACD(12、26、9)
  - KD(3、9)
- **特殊情況**：歷史不足以計算某指標時，該欄位回傳 `null`，不影響其餘欄位

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_indicator(
    symbol="2330.TW",
    date="20260420"  # 可省略，不指定則用最新交易日
)
```

---

### 6. GET /api/v1/volume-profile/{symbol}
**用途**：取得指定股票單一 (date, period) 的成交量分布資料

| 參數 | 型別 | 必需 | 說明 |
|------|------|------|------|
| `symbol` | string | ✓ | 股票代碼，例如 `2330.TW` |
| `date` | string | ✗ | 交易日，格式 `YYYYMMDD`，不指定則使用上游最新交易日 |
| `period` | integer | ✗ | 統計區間天數，例如 `5`、`20`、`60`、`120`，可自訂，最小值 1 |
| `rows` | integer | ✗ | VP bucket 根數，預設 `30`，最多 `200`，最小 `1` |

**回傳欄位**：
- **POC** — Point of Control，成交量最集中的價格
- **VAH** — Value Area High，成交量積算 70% 的上界
- **VAL** — Value Area Low，成交量積算 70% 的下界
- **row_height** — 每個 bucket 的價格高度
- **total_volume** — 該期間總成交量

**Python 使用範例**：
```python
from api_client import AIInsightAPIClient

client = AIInsightAPIClient()
result = client.get_volume_profile(
    symbol="2330.TW",
    period=20,           # 20 日成交量分布
    date="20260420",     # 可省略，不指定則用最新交易日
    rows=30              # 預設 30 根 bucket
)
```

---

## 舊版 API（備用）

- **AIInsight_VolumeProfile** — 成交量分布（Volume Profile）
- **AIInsight_Indicator** — 技術指標

詳見 API 文件：http://192.168.100.129/aiinsight2/docs

---

## 使用建議

### API 客戶端
建議使用 `api_client.py` 模組進行串接，已內建：
- 錯誤處理
- 逾時控制（10 秒）
- 自動連線管理

### 回傳格式
所有端點回傳 JSON 格式，結構視端點而定。

### 日期格式
統一使用 `YYYYMMDD` 格式（例如 `20260420` 表示 2026 年 4 月 20 日）。

