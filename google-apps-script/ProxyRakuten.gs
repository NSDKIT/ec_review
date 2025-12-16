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
    
    // 楽天のページを取得
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://www.rakuten.co.jp/'
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      return ContentService.createTextOutput(JSON.stringify({
        error: `HTTPエラー: ${response.getResponseCode()}`,
        message: response.getContentText().substring(0, 200)
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // HTMLを返す
    return ContentService.createTextOutput(response.getContentText())
      .setMimeType(ContentService.MimeType.HTML);
      
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

