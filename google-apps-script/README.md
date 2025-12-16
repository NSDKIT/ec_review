# Google Apps Script セットアップガイド

## 📝 概要

Google Sheetsへの書き込みと、楽天ページの取得（プロキシ）を行うためのGoogle Apps Scriptです。

## 🚀 セットアップ手順

### 1. Google Sheets書き込み用スクリプト

#### ステップ1: Google Apps Scriptプロジェクトを作成

1. https://script.google.com にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「楽天商品調査 - Google Sheets書き込み」に変更

#### ステップ2: コードを実装

1. `WriteToSheets.gs` のコードをコピー
2. Google Apps Scriptエディタに貼り付け
3. 「保存」をクリック（Ctrl+S / Cmd+S）

#### ステップ3: Webアプリとして公開

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類: 「ウェブアプリ」を選択
3. 設定:
   - **説明**: 「楽天商品調査 - Google Sheets書き込み」
   - **実行ユーザー**: 「自分」
   - **アクセス権限**: 「全員」（匿名ユーザーを含む）⚠️ 重要
4. 「デプロイ」をクリック
5. **WebアプリのURLをコピー**（重要！）

#### ステップ4: Vercelの環境変数に設定

1. Vercelダッシュボードにアクセス
2. プロジェクトの「Settings」→「Environment Variables」
3. 新しい環境変数を追加:
   - **名前**: `GOOGLE_APPS_SCRIPT_WRITE_URL`
   - **値**: コピーしたWebアプリのURL
4. 「Save」をクリック
5. 「Redeploy」をクリック（環境変数を反映）

---

### 2. 楽天ページ取得用スクリプト（推奨）

**商品ID取得機能を使用する場合に必要です。** Vercel Functionsでボット検出される場合、この方法を使用してください。

#### ステップ1: 新しいGoogle Apps Scriptプロジェクトを作成

1. https://script.google.com にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「楽天商品調査 - プロキシ」に変更

#### ステップ2: コードを実装

1. `ProxyRakuten.gs` のコードをコピー
2. Google Apps Scriptエディタに貼り付け
3. 「保存」をクリック

#### ステップ3: Webアプリとして公開

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類: 「ウェブアプリ」を選択
3. 設定:
   - **説明**: 「楽天商品調査 - プロキシ」
   - **実行ユーザー**: 「自分」
   - **アクセス権限**: 「全員」（匿名ユーザーを含む）
4. 「デプロイ」をクリック
5. **WebアプリのURLをコピー**

#### ステップ4: フロントエンドでGAS URLを設定

1. WebアプリをデプロイしてURLを取得（例: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`）
2. Webアプリの設定画面（⚙️アイコン）を開く
3. 「GASプロキシURL」欄にURLを入力
4. 保存すると、`localStorage` に保存され、以降の商品ID取得で使用されます

**注意**: GAS URLを設定しない場合は、Vercel Functions（`/api/proxy-rakuten`）が使用されます。

---

## 🧪 テスト方法

### Google Sheets書き込みのテスト

1. Google Apps Scriptエディタで `testWrite()` 関数を実行
2. 「実行」→「testWrite」を選択
3. 初回実行時は承認が必要（「権限を確認」→「詳細」→「安全でないページに移動」）
4. ログを確認（「表示」→「ログ」）

### プロキシのテスト

1. Google Apps Scriptエディタで `testProxy()` 関数を実行
2. ログを確認

---

## ⚠️ 重要な注意事項

### 1. アクセス権限の設定

**必ず「全員」（匿名ユーザーを含む）に設定してください。**

「自分」のみに設定すると、Vercel Functionsからアクセスできません。

### 2. スプレッドシートの権限

- Google Apps Scriptを実行するアカウントが、スプレッドシートの編集権限を持っている必要があります
- スプレッドシートの所有者が、Google Apps Scriptを実行するアカウントと同じであることを推奨します

### 3. セキュリティ

- WebアプリのURLは公開されるため、機密情報を含めないでください
- 必要に応じて、リクエストの検証を追加してください

---

## 🔧 トラブルシューティング

### エラー: "スプレッドシートIDが見つかりません"

**原因**: スプレッドシートIDが間違っている、またはアクセス権限がない

**対策**:
- スプレッドシートIDを確認
- Google Apps Scriptを実行するアカウントに編集権限を付与

### エラー: "Sheet1が見つかりません"

**原因**: シート名が「Sheet1」ではない

**対策**:
- スプレッドシートのシート名を確認
- コード内の `getSheetByName('Sheet1')` を実際のシート名に変更

### エラー: "アクセスが拒否されました"

**原因**: Webアプリのアクセス権限が「自分」のみになっている

**対策**:
- デプロイ設定を確認
- アクセス権限を「全員」（匿名ユーザーを含む）に変更
- 再デプロイ

---

## 📊 使用例

### Vercel Functionsから呼び出し

```javascript
// フロントエンドから
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
      },
      {
        range: 'Sheet1!B2:O2',
        values: [[1, '商品名1', ...]]
      }
    ]
  })
});
```

---

## ✅ チェックリスト

- [ ] Google Apps Scriptプロジェクトを作成
- [ ] `WriteToSheets.gs` のコードを実装
- [ ] Webアプリとして公開（アクセス権限: 全員）
- [ ] WebアプリのURLをコピー
- [ ] Vercelの環境変数 `GOOGLE_APPS_SCRIPT_WRITE_URL` に設定
- [ ] Vercelで再デプロイ
- [ ] テスト実行で動作確認

---

## 🎉 完了！

これで、Google Sheetsへの書き込みが動作するようになります！

