# Vercel Functions セットアップガイド

## 🚀 デプロイ手順

### 1. Vercelアカウントの作成

1. https://vercel.com にアクセス
2. GitHubアカウントでサインアップ（推奨）
3. 無料プランで開始可能

### 2. プロジェクトをGitHubにプッシュ

```bash
# Gitリポジトリを初期化（まだの場合）
git init

# ファイルを追加
git add .

# コミット
git commit -m "Add Vercel Functions implementation"

# GitHubにリポジトリを作成してプッシュ
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### 3. Vercelにプロジェクトをインポート

1. Vercelダッシュボードにログイン
2. 「Add New Project」をクリック
3. GitHubリポジトリを選択
4. プロジェクト設定:
   - **Framework Preset**: Other
   - **Root Directory**: `./`（デフォルト）
   - **Build Command**: `npm run build`（自動検出されるはず）
   - **Output Directory**: `public`（自動検出されるはず）

### 4. 環境変数を設定（オプション）

**注意**: 楽天アプリIDはWebアプリの設定画面で入力するため、環境変数の設定は不要です。

#### オプション環境変数（Google Sheets書き込み機能を使用する場合のみ）

Google Sheets書き込み機能を使用する場合のみ、以下の環境変数を設定:

```
GOOGLE_APPS_SCRIPT_WRITE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

**設定方法**:
1. プロジェクトの「Settings」→「Environment Variables」
2. 変数名と値を入力
3. 「Save」をクリック
4. 「Deployments」タブで「Redeploy」をクリック（環境変数を反映）

### 5. デプロイ

1. 「Deploy」ボタンをクリック
2. 数分待つとデプロイが完了
3. デプロイURLが表示される（例: `https://your-project.vercel.app`）

---

## 📝 環境変数の設定

### 楽天アプリIDについて

**楽天アプリIDはWebアプリの設定画面で入力します。** 環境変数の設定は不要です。

1. デプロイ後、Webアプリにアクセス
2. 設定画面（⚙️アイコン）を開く
3. 「楽天アプリID」欄に入力（デフォルト値: `1011800059095379100`）
4. 保存すると、`localStorage` に保存され、以降の検索で使用されます

### Google Sheets書き込み機能を使用する場合

#### ローカル開発環境

`.env.local` ファイルを作成（Gitにコミットしない）:

```env
GOOGLE_APPS_SCRIPT_WRITE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

#### Vercel環境

Vercelダッシュボードで設定（上記参照）

---

## 🔧 Google Apps Scriptの設定（オプション）

Google Sheets書き込み機能を使用する場合:

### 1. Google Apps Scriptプロジェクトを作成

1. https://script.google.com にアクセス
2. 「新しいプロジェクト」をクリック
3. 以下のコードを貼り付け:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheetId = data.spreadsheetId;
    const sheetData = data.data;
    
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Sheet1');
    
    // データを書き込み
    for (const item of sheetData) {
      const range = sheet.getRange(item.range);
      range.setValues(item.values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '書き込み成功'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 2. Webアプリとして公開

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類: 「ウェブアプリ」を選択
3. 設定:
   - 説明: 「楽天商品調査 - Google Sheets書き込み」
   - 実行ユーザー: 「自分」
   - アクセス権限: 「全員」（匿名ユーザーを含む）
4. 「デプロイ」をクリック
5. **WebアプリのURLをコピー**

### 3. 環境変数に設定

Vercelダッシュボードで `GOOGLE_APPS_SCRIPT_WRITE_URL` にURLを設定

---

## 🧪 ローカル開発

### Vercel CLIのインストール

```bash
npm i -g vercel
```

### ローカルサーバーの起動

```bash
vercel dev
```

これで `http://localhost:3000` でローカル開発が可能

---

## 📊 APIエンドポイント

デプロイ後、以下のエンドポイントが利用可能:

### 1. 楽天商品検索

```
POST https://your-project.vercel.app/api/rakuten-search
Content-Type: application/json

{
  "keyword": "iPhone ケース",
  "minPrice": 500,
  "maxPrice": 15000,
  "NGKeyword": "",
  "hits": 30,
  "rakuten_appid": "1011800059095379100"
}
```

### 2. Google Sheets書き込み

```
POST https://your-project.vercel.app/api/sheets-write
Content-Type: application/json

{
  "spreadsheetId": "1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY",
  "data": [
    {
      "range": "Sheet1!B1:O1",
      "values": [["検索順位", "商品名", ...]]
    }
  ]
}
```

### 3. 楽天ページ取得（プロキシ）

```
GET https://your-project.vercel.app/api/proxy-rakuten?url=https://item.rakuten.co.jp/...
```

---

## 🔍 トラブルシューティング

### エラー: "Function execution exceeded timeout"

**原因**: 実行時間が30秒を超えた

**対策**:
- `vercel.json` の `maxDuration` を増やす（最大300秒）
- 処理を分割して複数のリクエストに分ける

### エラー: "Environment variable not found"

**原因**: 環境変数が設定されていない

**対策**:
- Vercelダッシュボードで環境変数を確認
- ローカル開発の場合は `.env.local` を確認

### エラー: CORSエラー

**原因**: CORS設定の問題

**対策**:
- `vercel.json` のCORS設定を確認
- APIエンドポイントのCORSヘッダーを確認

---

## 💰 コスト

### 無料プラン

- **関数実行時間**: 100GB時間/月
- **リクエスト数**: 無制限
- **帯域幅**: 100GB/月

### Proプラン（$20/月）

- **関数実行時間**: 1000GB時間/月
- **リクエスト数**: 無制限
- **帯域幅**: 1TB/月

**小規模利用なら無料プランで十分！**

---

## ✅ チェックリスト

デプロイ前の確認:

- [ ] GitHubにコードをプッシュ
- [ ] Vercelアカウントを作成
- [ ] プロジェクトをVercelにインポート
- [ ] デプロイを実行
- [ ] Webアプリで楽天アプリIDを設定（設定画面から）
- [ ] Google Apps Scriptを設定（オプション、Google Sheets書き込み機能を使用する場合）
- [ ] 環境変数を設定（GOOGLE_APPS_SCRIPT_WRITE_URL、オプション）
- [ ] APIエンドポイントをテスト

---

## 🎉 完了！

デプロイが完了したら、フロントエンドからVercel FunctionsのAPIを呼び出すことができます。

**デプロイURL**: `https://your-project.vercel.app`

このURLをフロントエンドコードで使用してください。

