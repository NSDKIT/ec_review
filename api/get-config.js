/**
 * Vercel Serverless Function
 * フロントエンド用の設定値を返す（環境変数から取得）
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
    // 環境変数からGASプロキシURLを取得
    const gasProxyUrl = process.env.GOOGLE_APPS_SCRIPT_PROXY_URL || '';

    return res.status(200).json({
      gasProxyUrl: gasProxyUrl
    });
  } catch (error) {
    console.error('❌ エラー:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}

