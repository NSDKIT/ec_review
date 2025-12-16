# デプロイ手順（Vercel Functions）

## 🚀 クイックスタート

### 1. 必要なもの

- ✅ GitHubアカウント
- ✅ Vercelアカウント（無料）
- ✅ 楽天アプリID（無料で取得可能）

### 2. デプロイ手順

#### ステップ1: GitHubにプッシュ

```bash
# リポジトリを初期化（まだの場合）
git init

# ファイルを追加
git add .

# コミット
git commit -m "Add Vercel Functions implementation"

# GitHubにリポジトリを作成してプッシュ
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

#### ステップ2: Vercelにプロジェクトをインポート

1. https://vercel.com にアクセス
2. 「Sign Up」→ GitHubアカウントでログイン
3. 「Add New Project」をクリック
4. GitHubリポジトリを選択
5. プロジェクト設定:
   - **Framework Preset**: Other
   - **Root Directory**: ./
   - **Build Command**: （空欄）
   - **Output Directory**: （空欄）
6. 「Deploy」をクリック

#### ステップ3: 環境変数を設定

1. プロジェクトの「Settings」→「Environment Variables」
2. 以下の環境変数を追加:

```
RAKUTEN_APP_ID=1011800059095379100
```

3. （オプション）Google Sheets書き込みを使用する場合:

```
GOOGLE_APPS_SCRIPT_WRITE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

4. 「Save」をクリック
5. 「Redeploy」をクリック（環境変数を反映）

#### ステップ4: 動作確認

デプロイが完了したら、以下のURLでAPIをテスト:

```
https://your-project.vercel.app/api/rakuten-search
```

---

## 📝 環境変数の詳細

### 必須環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `RAKUTEN_APP_ID` | 楽天アプリID | `1011800059095379100` |

### オプション環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GOOGLE_APPS_SCRIPT_WRITE_URL` | Google Apps ScriptのWebアプリURL（Google Sheets書き込み用） | `https://script.google.com/macros/s/.../exec` |

---

## 🔧 Google Apps Scriptの設定（オプション）

Google Sheets書き込み機能を使用する場合のみ必要:

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

### 3. Vercelの環境変数に設定

Vercelダッシュボードで `GOOGLE_APPS_SCRIPT_WRITE_URL` にURLを設定

---

## 🧪 ローカル開発

### Vercel CLIのインストール

```bash
npm install -g vercel
```

### ローカルサーバーの起動

```bash
vercel dev
```

これで `http://localhost:3000` でローカル開発が可能

### 環境変数の設定（ローカル）

`.env.local` ファイルを作成:

```env
RAKUTEN_APP_ID=1011800059095379100
GOOGLE_APPS_SCRIPT_WRITE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

---

## 📊 APIエンドポイント

デプロイ後、以下のエンドポイントが利用可能:

### 1. 楽天商品検索

**エンドポイント**: `POST /api/rakuten-search`

**リクエスト例**:
```javascript
const response = await fetch('/api/rakuten-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keyword: 'iPhone ケース',
    minPrice: 500,
    maxPrice: 15000,
    NGKeyword: '',
    hits: 30,
    rakuten_appid: '1011800059095379100'
  })
});

const data = await response.json();
```

### 2. Google Sheets書き込み

**エンドポイント**: `POST /api/sheets-write`

**リクエスト例**:
```javascript
const response = await fetch('/api/sheets-write', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    spreadsheetId: '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY',
    data: [
      {
        range: 'Sheet1!B1:O1',
        values: [['検索順位', '商品名', ...]]
      }
    ]
  })
});
```

### 3. 楽天ページ取得（プロキシ）

**エンドポイント**: `GET /api/proxy-rakuten?url={URL}`

**リクエスト例**:
```javascript
const url = encodeURIComponent('https://item.rakuten.co.jp/...');
const response = await fetch(`/api/proxy-rakuten?url=${url}`);
const html = await response.text();
```

---

## 🔍 トラブルシューティング

### エラー: "Function execution exceeded timeout"

**原因**: 実行時間が30秒を超えた

**対策**:
- `vercel.json` の `maxDuration` を確認（現在30秒）
- 処理を分割して複数のリクエストに分ける

### エラー: "Environment variable not found"

**原因**: 環境変数が設定されていない

**対策**:
- Vercelダッシュボードで環境変数を確認
- ローカル開発の場合は `.env.local` を確認
- 環境変数を設定後、「Redeploy」を実行

### エラー: CORSエラー

**原因**: CORS設定の問題

**対策**:
- `vercel.json` のCORS設定を確認
- APIエンドポイントのCORSヘッダーを確認

### エラー: "楽天APIエラー"

**原因**: 楽天アプリIDが無効、またはAPI制限

**対策**:
- 楽天アプリIDを確認
- 楽天APIの利用規約を確認
- レート制限を確認

---

## 💰 コスト

### 無料プラン

- **関数実行時間**: 100GB時間/月
- **リクエスト数**: 無制限
- **帯域幅**: 100GB/月

**小規模利用なら無料プランで十分！**

### Proプラン（$20/月）

- **関数実行時間**: 1000GB時間/月
- **リクエスト数**: 無制限
- **帯域幅**: 1TB/月

---

## ✅ デプロイチェックリスト

- [ ] GitHubにコードをプッシュ
- [ ] Vercelアカウントを作成
- [ ] プロジェクトをVercelにインポート
- [ ] 環境変数を設定（RAKUTEN_APP_ID）
- [ ] Google Apps Scriptを設定（オプション）
- [ ] デプロイを実行
- [ ] APIエンドポイントをテスト
- [ ] フロントエンドからAPIを呼び出して動作確認

---

## 🎉 完了！

デプロイが完了したら、フロントエンドからVercel FunctionsのAPIを呼び出すことができます。

**デプロイURL**: `https://your-project.vercel.app`

このURLをフロントエンドコードで使用してください。

詳細は `VERCEL_SETUP.md` も参照してください。

