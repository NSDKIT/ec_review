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
    
    // URLを手動でパース（GASではURLオブジェクトが使えない）
    let hostname = '';
    let pathname = '';
    let cleanUrl = '';
    
    try {
      // URLをパース
      const urlMatch = url.match(/https?:\/\/([^\/]+)(\/.*)?/);
      if (!urlMatch) {
        throw new Error('URL形式が不正です');
      }
      
      hostname = urlMatch[1];
      pathname = urlMatch[2] || '/';
      
      // ドメインの検証
      const isAllowed = allowedDomains.some(domain => hostname.endsWith(domain));
      
      if (!isAllowed) {
        return ContentService.createTextOutput(JSON.stringify({
          error: '許可されていないドメインです',
          allowedDomains: allowedDomains,
          hostname: hostname
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // URLからクエリパラメータを削除（rafcidなどがボット検出を引き起こす可能性がある）
      // ただし、レビューページのURL（review.rakuten.co.jp）の場合はクエリパラメータを保持
      const scheme = url.startsWith('https://') ? 'https://' : 'http://';
      if (hostname.includes('review.rakuten.co.jp')) {
        // レビューページの場合はクエリパラメータを保持
        cleanUrl = url; // 元のURLをそのまま使用
        Logger.log('📄 レビューページURL（クエリパラメータ保持）: ' + cleanUrl);
      } else {
        // 商品ページの場合はクエリパラメータを削除
        cleanUrl = scheme + hostname + pathname;
        Logger.log('📄 商品ページURL（クエリパラメータ削除）: ' + cleanUrl);
      }
      
    } catch (urlError) {
      Logger.log('❌ URL解析エラー: ' + urlError.toString());
      return ContentService.createTextOutput(JSON.stringify({
        error: '無効なURLです',
        message: urlError.toString(),
        url: url
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('🌐 楽天ページ取得: ' + url);
    Logger.log('🌐 クリーンURL: ' + cleanUrl);
    
    // 楽天のページを取得
    Logger.log('🚀 HTTPリクエスト送信開始: ' + cleanUrl);
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
    
    const statusCode = response.getResponseCode();
    Logger.log('📥 楽天サーバーからのレスポンス:');
    Logger.log('Status: ' + statusCode);
    Logger.log('Content-Length: ' + response.getHeaders()['Content-Length']);
    
    if (statusCode !== 200) {
      const errorText = response.getContentText().substring(0, 500);
      Logger.log('❌ 楽天サーバーエラー: ' + errorText);
      return ContentService.createTextOutput(JSON.stringify({
        error: `HTTPエラー: ${statusCode}`,
        message: errorText
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const html = response.getContentText();
    Logger.log('📄 HTML取得完了: ' + html.length + ' 文字');
    Logger.log('HTML（最初の500文字）: ' + html.substring(0, 500));
    
    // HTMLが短すぎる場合はエラー（ボット検出された可能性）
    if (html.length < 100) {
      Logger.log('❌ HTMLが短すぎます: ' + html);
      return ContentService.createTextOutput(JSON.stringify({
        error: 'HTMLが短すぎます（ボット検出の可能性）',
        html: html,
        length: html.length,
        url: cleanUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 商品ID（ratItemId）を抽出（レビューページの場合はスキップ）
    let ratItemId = null;
    
    // レビューページの場合はratItemIdの抽出をスキップ
    if (!hostname.includes('review.rakuten.co.jp')) {
      // 方法1: JSONデータから抽出（window.__INITIAL_STATE__）
      const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.rat && jsonData.rat.genericParameter && jsonData.rat.genericParameter.ratItemId) {
            ratItemId = jsonData.rat.genericParameter.ratItemId.replace(/\//g, '_');
            Logger.log('✅ JSONデータからratItemId抽出: ' + ratItemId);
          } else if (jsonData.api && jsonData.api.data && jsonData.api.data.itemInfoSku) {
            const shopId = jsonData.api.data.itemInfoSku.shopId;
            const itemId = jsonData.api.data.itemInfoSku.itemId;
            if (shopId && itemId) {
              ratItemId = shopId + '_' + itemId;
              Logger.log('✅ shopId/itemIdからratItemId抽出: ' + ratItemId);
            }
          }
        } catch (e) {
          // JSON解析エラーは無視
          Logger.log('⚠️ JSON解析エラー: ' + e.toString());
        }
      }
      
      // 方法2: 正規表現で抽出
      if (!ratItemId) {
        const match = html.match(/ratItemId["']\s*:\s*["']([^"']+)["']/);
        if (match && match[1]) {
          ratItemId = match[1].replace(/\//g, '_');
          Logger.log('✅ 正規表現でratItemId抽出: ' + ratItemId);
        }
      }
    } else {
      Logger.log('📄 レビューページのため、ratItemIdの抽出をスキップ');
    }
    
    Logger.log('📊 抽出結果:');
    Logger.log('ratItemId: ' + (ratItemId || 'null'));
    Logger.log('HTML長: ' + html.length);
    
    // レスポンス形式を決定（ratItemIdOnlyパラメータがある場合は商品IDのみ返す）
    const returnItemIdOnly = e.parameter.ratItemIdOnly === 'true';
    
    if (returnItemIdOnly) {
      // 商品IDのみを返す
      Logger.log('📤 商品IDのみを返す');
      return ContentService.createTextOutput(JSON.stringify({
        success: !!ratItemId,
        ratItemId: ratItemId,
        url: cleanUrl
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // HTMLと商品IDの両方を返す
      Logger.log('📤 HTMLと商品IDの両方を返す（HTML長: ' + html.length + '）');
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

