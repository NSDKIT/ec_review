# 動作させるために必要なもの

## 📋 現状の問題点と必要な対応

### ❌ 問題1: Google Sheets書き込み機能が動作しない

**現状**: コードはあるが、実際にはGoogle Sheetsに書き込めない

**必要なもの**:

#### 方法A: Google Apps Script（推奨・簡単）

1. **Google Apps Scriptプロジェクトを作成**
   - Googleドライブで新規 → その他 → Google Apps Script
   - または https://script.google.com/

2. **スクリプトコードを実装**
   ```javascript
   function doPost(e) {
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
     
     return ContentService.createTextOutput(JSON.stringify({success: true}))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

3. **Webアプリとして公開**
   - デプロイ → 新しいデプロイ
   - 種類: ウェブアプリ
   - アクセス権限: 全員（匿名ユーザーを含む）
   - 実行ユーザー: 自分
   - デプロイしてURLを取得

4. **フロントエンドコードを修正**
   ```javascript
   // js/google-sheets.js の writeData() メソッド
   const scriptUrl = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'; // ここにURLを設定
   ```

**必要なもの**:
- ✅ Googleアカウント（無料）
- ✅ Google Apps Script（無料）
- ✅ 5分程度の作業時間

---

#### 方法B: バックエンドAPI（本格的）

1. **Node.js + Express サーバーを構築**
   ```javascript
   // server.js
   const express = require('express');
   const { google } = require('googleapis');
   const app = express();
   
   app.use(express.json());
   
   app.post('/api/write-sheets', async (req, res) => {
     const auth = new google.auth.GoogleAuth({
       keyFile: 'credentials.json',
       scopes: ['https://www.googleapis.com/auth/spreadsheets'],
     });
     
     const sheets = google.sheets({ version: 'v4', auth });
     const { spreadsheetId, data } = req.body;
     
     await sheets.spreadsheets.values.batchUpdate({
       spreadsheetId,
       requestBody: { data },
     });
     
     res.json({ success: true });
   });
   
   app.listen(3000);
   ```

2. **Google Cloud認証情報を設定**
   - Google Cloud Consoleでプロジェクト作成
   - Google Sheets APIを有効化
   - サービスアカウントを作成
   - JSON認証情報をダウンロード

3. **サーバーをデプロイ**
   - Heroku、Vercel、AWS Lambda等

**必要なもの**:
- ✅ Node.js環境
- ✅ Google Cloudプロジェクト（無料枠あり）
- ✅ デプロイ先（Heroku無料枠、Vercel無料枠等）
- ✅ 1-2時間の作業時間

---

### ❌ 問題2: レビュー取得機能が動作しない（CORS制限）

**現状**: ブラウザから直接楽天のレビューページを取得できない

**必要なもの**:

#### 方法A: バックエンドAPIでプロキシ（推奨）

1. **Node.js + Express サーバーを構築**
   ```javascript
   // server.js
   const express = require('express');
   const axios = require('axios');
   const app = express();
   
   app.use(express.json());
   
   // 商品ページのHTMLを取得
   app.get('/api/proxy-rakuten-page', async (req, res) => {
     const { url } = req.query;
     try {
       const response = await axios.get(url, {
         headers: {
           'User-Agent': 'Mozilla/5.0...'
         }
       });
       res.send(response.data);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   
   // レビューページのHTMLを取得
   app.get('/api/proxy-rakuten-review', async (req, res) => {
     const { url } = req.query;
     try {
       const response = await axios.get(url, {
         headers: {
           'User-Agent': 'Mozilla/5.0...'
         }
       });
       res.send(response.data);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   
   app.listen(3000);
   ```

2. **サーバーをデプロイ**
   - Heroku、Vercel、AWS Lambda等

**必要なもの**:
- ✅ Node.js環境
- ✅ axios パッケージ
- ✅ デプロイ先（Heroku無料枠、Vercel無料枠等）
- ✅ 30分-1時間の作業時間

---

#### 方法B: Google Apps Scriptでプロキシ（簡単）

1. **Google Apps Scriptプロジェクトを作成**

2. **スクリプトコードを実装**
   ```javascript
   function doGet(e) {
     const url = e.parameter.url;
     const response = UrlFetchApp.fetch(url, {
       headers: {
         'User-Agent': 'Mozilla/5.0...'
       }
     });
     
     return ContentService.createTextOutput(response.getContentText())
       .setMimeType(ContentService.MimeType.HTML);
   }
   ```

3. **Webアプリとして公開**

**必要なもの**:
- ✅ Googleアカウント（無料）
- ✅ Google Apps Script（無料）
- ✅ 10分程度の作業時間

---

## 🎯 推奨実装方法（最小限の作業）

### 最速で動作させる方法

1. **Google Apps Scriptで両方の機能を実装**
   - 1つのスクリプトで書き込みとプロキシの両方を処理
   - 2つのWebアプリURLを取得

2. **フロントエンドコードを修正**
   - `js/google-sheets.js` の `scriptUrl` を設定
   - `js/rakuten-review-analyzer.js` の `proxyUrl` を設定

**必要なものまとめ**:
- ✅ Googleアカウント（無料）
- ✅ Google Apps Script（無料）
- ✅ 15-20分の作業時間

---

## 📝 具体的な実装手順（Google Apps Script版）

### ステップ1: Google Apps Scriptプロジェクト作成

1. https://script.google.com/ にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「楽天商品調査API」に変更

### ステップ2: スクリプトコードを実装

```javascript
// Google Sheets書き込み用
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

// レビューページ取得用（別のスクリプトファイル）
function doGet(e) {
  try {
    const url = e.parameter.url;
    if (!url) {
      throw new Error('URLパラメータが必要です');
    }
    
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      muteHttpExceptions: true
    });
    
    return ContentService.createTextOutput(response.getContentText())
      .setMimeType(ContentService.MimeType.HTML);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### ステップ3: Webアプリとして公開

1. 「デプロイ」→「新しいデプロイ」をクリック
2. 種類: 「ウェブアプリ」を選択
3. 設定:
   - 説明: 「楽天商品調査API」
   - 実行ユーザー: 「自分」
   - アクセス権限: 「全員」（匿名ユーザーを含む）
4. 「デプロイ」をクリック
5. **WebアプリのURLをコピー**（重要！）

### ステップ4: フロントエンドコードを修正

#### `js/google-sheets.js` を修正

```javascript
async writeData(data) {
    try {
        // Google Apps ScriptのWebアプリURLを設定
        const scriptUrl = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'; // ← ここにURLを貼り付け
        
        const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'write',
                spreadsheetId: this.SPREADSHEET_ID,
                data: data
            })
        });

        if (!response.ok) {
            throw new Error(`書き込みエラー: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Google Sheetsへの書き込み成功', result);
        return result.success;

    } catch (error) {
        console.error('❌ Google Sheets書き込みエラー:', error);
        return false;
    }
}
```

#### `js/rakuten-review-analyzer.js` を修正

```javascript
async extractItemId(itemUrl) {
    try {
        // Google Apps ScriptのプロキシURLを設定
        const proxyUrl = `YOUR_GOOGLE_APPS_SCRIPT_PROXY_URL?url=${encodeURIComponent(itemUrl)}`; // ← ここにURLを貼り付け
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            return this.extractItemIdFromUrl(itemUrl);
        }

        const html = await response.text();
        
        // ratItemIdを抽出
        const match = html.match(/ratItemId["']\s*:\s*["']([^"']+)["']/);
        
        if (match && match[1]) {
            return match[1].replace(/\//g, '_');
        }

        return this.extractItemIdFromUrl(itemUrl);

    } catch (error) {
        console.warn('商品ID抽出エラー（フォールバック使用）:', error);
        return this.extractItemIdFromUrl(itemUrl);
    }
}

async fetchAllReviews(itemId) {
    // 同様に proxyUrl を設定
    const proxyUrl = `YOUR_GOOGLE_APPS_SCRIPT_PROXY_URL?url=...`;
    // ...
}
```

---

## 🔑 必要な認証情報・設定

### Google Sheets書き込み用
- ✅ Googleアカウント
- ✅ スプレッドシートへの編集権限（自分のアカウントで作成したスプレッドシートなら自動的に権限あり）

### レビュー取得用
- ✅ 特になし（公開されているページなので）

---

## 💰 コスト

- **Google Apps Script**: 完全無料
- **Google Sheets API**: 完全無料（1日あたりのリクエスト数に制限あり、通常使用では問題なし）
- **楽天API**: 完全無料（アプリ登録が必要だが無料）

**合計: 0円（完全無料）**

---

## ⏱️ 作業時間の目安

- Google Apps Script作成: 5分
- スクリプトコード実装: 10分
- Webアプリ公開: 5分
- フロントエンドコード修正: 5分
- テスト: 5分

**合計: 約30分**

---

## 🚀 次のステップ

1. Google Apps Scriptプロジェクトを作成
2. 上記のコードを実装
3. Webアプリとして公開してURLを取得
4. フロントエンドコードを修正
5. 動作確認

これで完全に動作するようになります！

