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
    console.log('🌐 URLオブジェクト:', {
      href: urlObj.href,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search
    });

    // タイムアウトを25秒に設定（VercelのmaxDurationが30秒なので余裕を持たせる）
    const timeoutMs = 25000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Referer': 'https://www.rakuten.co.jp/'
        },
        signal: controller.signal,
        redirect: 'follow', // リダイレクトを自動的にフォロー
        method: 'GET'
      };
      
      console.log('🌐 Fetchオプション:', {
        url: url,
        method: fetchOptions.method,
        redirect: fetchOptions.redirect,
        hasSignal: !!fetchOptions.signal,
        headers: fetchOptions.headers
      });

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      // レスポンス情報をログに出力
      console.log('📥 楽天サーバーからのレスポンス:');
      console.log('Status:', response.status, response.statusText);
      console.log('URL:', response.url); // リダイレクト後の最終URL
      console.log('Redirected:', response.redirected);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'エラーレスポンスの取得に失敗');
        console.error(`❌ 楽天サーバーエラー (${response.status}):`, errorText.substring(0, 500));
        console.error('エラーレスポンス全文:', errorText);
        throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // ログ出力
      console.log('📄 楽天サーバーからのレスポンス:');
      console.log('HTML長:', html.length, '文字');
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Length:', response.headers.get('content-length'));
      console.log('Status:', response.status, response.statusText);
      
      // HTMLが短すぎる場合はエラー
      if (html.length < 100) {
        console.error('❌ HTMLが短すぎます:', html);
        console.error('HTML内容（全文）:', html);
        console.error('HTML内容（JSON形式）:', JSON.stringify(html));
        console.error('レスポンスURL:', response.url);
        console.error('リダイレクトされたか:', response.redirected);
        console.error('ステータスコード:', response.status);
        
        // Vercelのエラーレファレンスの可能性を確認
        if (html.includes('Reference') && html.includes('#')) {
          console.error('❌ Vercelのエラーレファレンスが返されました。これはVercel Functionsの内部エラーです。');
        }
        
        throw new Error(`HTMLが短すぎます (${html.length}文字): ${html.substring(0, 100)}`);
      }
      
      // HTMLの最初と最後をログに出力
      console.log('HTML（最初の500文字）:', html.substring(0, 500));
      console.log('HTML（最後の500文字）:', html.substring(Math.max(0, html.length - 500)));

      // HTMLを返す
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('❌ Fetchエラー:', {
        name: fetchError.name,
        message: fetchError.message,
        cause: fetchError.cause,
        stack: fetchError.stack
      });
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

