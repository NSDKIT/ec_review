/**
 * Vercel Serverless Function
 * 楽天ページ取得プロキシ（CORS回避用）
 * 
 * 注意: 商用利用では、楽天の利用規約を確認してください
 */

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GETリクエストのみ許可
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.query;

    // バリデーション
    if (!url) {
      return res.status(400).json({ error: 'URLパラメータが必要です' });
    }

    // 楽天のドメインのみ許可（セキュリティ対策）
    const allowedDomains = [
      'rakuten.co.jp',
      'item.rakuten.co.jp',
      'review.rakuten.co.jp'
    ];

    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (urlError) {
      console.error('❌ URL解析エラー:', urlError);
      return res.status(400).json({
        error: '無効なURL形式です',
        message: urlError.message,
        url: url
      });
    }

    const isAllowed = allowedDomains.some(domain => urlObj.hostname.endsWith(domain));

    if (!isAllowed) {
      return res.status(403).json({ 
        error: '許可されていないドメインです',
        allowedDomains: allowedDomains,
        hostname: urlObj.hostname
      });
    }

    // 楽天のページを取得
    console.log('🌐 楽天ページ取得:', url);

    // タイムアウトを25秒に設定（VercelのmaxDurationが30秒なので余裕を持たせる）
    const timeoutMs = 25000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Referer': 'https://www.rakuten.co.jp/'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // HTMLを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('❌ エラー詳細:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // タイムアウトエラーの場合
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'タイムアウト: サーバーからの応答が遅すぎます',
        message: error.message
      });
    }

    // URL関連のエラーの場合
    if (error.message && error.message.includes('Invalid URL')) {
      return res.status(400).json({
        error: '無効なURLです',
        message: error.message
      });
    }

    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message,
      name: error.name
    });
  }
}

