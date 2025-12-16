/**
 * Google Apps Script
 * 楽天ページ取得プロキシ（CORS回避用）
 * 
 * 使い方:
 * 1. このコードをGoogle Apps Scriptにコピー
 * 2. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」として公開
 * 3. 取得したURLをVercelの環境変数 GOOGLE_APPS_SCRIPT_PROXY_URL に設定（オプション）
 * 
 * 注意: 商用利用では、楽天の利用規約を確認してください
 */

function doGet(e) {
  try {
    const url = e.parameter.url;
    
    // バリデーション
    if (!url) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'URLパラメータが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 楽天のドメインのみ許可（セキュリティ対策）
    const allowedDomains = [
      'rakuten.co.jp',
      'item.rakuten.co.jp',
      'review.rakuten.co.jp'
    ];
    
    try {
      const urlObj = new URL(url);
      const isAllowed = allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
      
      if (!isAllowed) {
        return ContentService.createTextOutput(JSON.stringify({
          error: '許可されていないドメインです',
          allowedDomains: allowedDomains
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } catch (urlError) {
      return ContentService.createTextOutput(JSON.stringify({
        error: '無効なURLです',
        message: urlError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // URLからクエリパラメータを削除（rafcidなどがボット検出を引き起こす可能性がある）
    const urlObj = new URL(url);
    const cleanUrl = urlObj.origin + urlObj.pathname;
    
    // 楽天のページを取得
    const response = UrlFetchApp.fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.rakuten.co.jp/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      return ContentService.createTextOutput(JSON.stringify({
        error: `HTTPエラー: ${response.getResponseCode()}`,
        message: response.getContentText().substring(0, 200)
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const html = response.getContentText();
    
    // HTMLが短すぎる場合はエラー（ボット検出された可能性）
    if (html.length < 100) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'HTMLが短すぎます（ボット検出の可能性）',
        html: html,
        length: html.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 商品ID（ratItemId）を抽出
    let ratItemId = null;
    
    // 方法1: JSONデータから抽出（window.__INITIAL_STATE__）
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.rat && jsonData.rat.genericParameter && jsonData.rat.genericParameter.ratItemId) {
          ratItemId = jsonData.rat.genericParameter.ratItemId.replace(/\//g, '_');
        } else if (jsonData.api && jsonData.api.data && jsonData.api.data.itemInfoSku) {
          const shopId = jsonData.api.data.itemInfoSku.shopId;
          const itemId = jsonData.api.data.itemInfoSku.itemId;
          if (shopId && itemId) {
            ratItemId = shopId + '_' + itemId;
          }
        }
      } catch (e) {
        // JSON解析エラーは無視
      }
    }
    
    // 方法2: 正規表現で抽出
    if (!ratItemId) {
      const match = html.match(/ratItemId["']\s*:\s*["']([^"']+)["']/);
      if (match && match[1]) {
        ratItemId = match[1].replace(/\//g, '_');
      }
    }
    
    // レスポンス形式を決定（ratItemIdOnlyパラメータがある場合は商品IDのみ返す）
    const returnItemIdOnly = e.parameter.ratItemIdOnly === 'true';
    
    if (returnItemIdOnly) {
      // 商品IDのみを返す
      return ContentService.createTextOutput(JSON.stringify({
        success: !!ratItemId,
        ratItemId: ratItemId,
        url: cleanUrl
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // HTMLと商品IDの両方を返す
      return ContentService.createTextOutput(JSON.stringify({
        html: html,
        ratItemId: ratItemId,
        htmlLength: html.length,
        url: cleanUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: '予期せぬエラーが発生しました',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * テスト用関数（オプション）
 */
function testProxy() {
  const testUrl = 'https://item.rakuten.co.jp/example/item123/';
  const mockEvent = {
    parameter: {
      url: testUrl
    }
  };
  
  const result = doGet(mockEvent);
  Logger.log(result.getContent().substring(0, 500));
}

