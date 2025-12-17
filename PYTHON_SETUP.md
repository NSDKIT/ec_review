# Python版楽天市場スクレイパー セットアップガイド

GASコードをPythonに完全移行しました。Python版を使用することで、より柔軟な開発とデバッグが可能になります。

## 📋 機能

- ✅ 楽天市場の検索結果ページから商品情報をスクレイピング
- ✅ Google Spreadsheetへの直接書き込み（オプション）
- ✅ GASコードと同じロジックで商品情報を抽出
- ✅ Vercel Functionsで実行可能

## 🚀 セットアップ

### 1. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

または、個別にインストール：

```bash
pip install beautifulsoup4 requests gspread google-auth google-auth-oauthlib google-auth-httplib2
```

### 2. Google Sheets API認証（オプション）

Google Spreadsheetへの書き込み機能を使用する場合：

1. **Google Cloud Consoleでプロジェクトを作成**
   - https://console.cloud.google.com/

2. **Google Sheets APIを有効化**
   - APIとサービス → ライブラリ → Google Sheets API を有効化

3. **サービスアカウントを作成**
   - IAMと管理 → サービスアカウント → サービスアカウントを作成
   - JSONキーをダウンロード

4. **Vercel環境変数を設定**
   ```
   GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
   ```
   - ダウンロードしたJSONファイルの内容をそのまま環境変数に設定

5. **スプレッドシートの共有設定**
   - スプレッドシートを開く
   - 共有 → サービスアカウントのメールアドレスに編集権限を付与

### 3. Vercel Functionsの設定

`vercel.json`に既に設定が含まれています：

```json
{
  "functions": {
    "api/rakuten-search-scraper.py": {
      "maxDuration": 60
    }
  }
}
```

## 📝 使用方法

### APIエンドポイント

```
GET /api/rakuten-search-scraper?keyword=クロックス&page=1&maxItems=30
POST /api/rakuten-search-scraper
```

### パラメータ

- `keyword` (必須): 検索キーワード
- `page` (オプション): ページ番号（デフォルト: 1）
- `maxItems` (オプション): 最大取得数（デフォルト: 30）
- `spreadsheetId` (オプション): Google Spreadsheet ID（指定すると書き込みも実行）

### レスポンス形式

```json
{
  "success": true,
  "total_products": 30,
  "products": [
    {
      "name": "商品名",
      "price": "7,700円",
      "image_url": "https://...",
      "product_url": "https://item.rakuten.co.jp/...",
      "review_rating": "4.31",
      "review_count": "32",
      "shop_name": "shop-name",
      "shipping_info": "送料無料",
      "shipping_price": "",
      "point_info": "ポイント"
    }
  ],
  "writeResult": {
    "success": true,
    "message": "30件の商品データを書き込みました",
    "totalProducts": 30
  }
}
```

## 🔄 GASからPythonへの移行

### フロントエンド側の変更

`js/rakuten-api.js`が自動的にPython APIを優先的に使用するように更新されています：

1. **優先順位**:
   - GAS URLが設定されている場合 → GASを使用
   - GAS URLが未設定の場合 → Python APIを使用
   - Python APIが失敗した場合 → Node.js APIにフォールバック

2. **手動でPython APIを強制使用する場合**:
   ```javascript
   // GAS URLを削除または空にする
   localStorage.removeItem('GOOGLE_APPS_SCRIPT_SEARCH_URL');
   ```

## 🐛 トラブルシューティング

### 商品が見つからない場合

1. **HTMLの取得を確認**
   - Vercel Functionsのログを確認
   - ボット検出されていないか確認

2. **デバッグ情報を確認**
   - レスポンスの`debug`フィールドを確認

### Google Sheetsへの書き込みが失敗する場合

1. **認証情報を確認**
   - `GOOGLE_SHEETS_CREDENTIALS`環境変数が正しく設定されているか
   - JSON形式が正しいか

2. **スプレッドシートの共有設定を確認**
   - サービスアカウントのメールアドレスに編集権限が付与されているか

3. **gspreadライブラリがインストールされているか確認**
   - `requirements.txt`に含まれているか確認

## 📊 パフォーマンス

- **実行時間**: 通常10-30秒（商品数に依存）
- **メモリ使用量**: 約50-100MB
- **同時実行**: Vercelの制限に依存

## 🔒 セキュリティ

- CORS設定済み
- 楽天市場のドメインのみ許可（スクレイピング時）
- Google Sheets API認証情報は環境変数で管理

## 📚 参考資料

- [BeautifulSoup ドキュメント](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
- [gspread ドキュメント](https://gspread.readthedocs.io/)
- [Vercel Python Functions](https://vercel.com/docs/functions/runtimes/python)

