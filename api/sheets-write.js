/**
 * Vercel Serverless Function
 * Google Sheets書き込みAPI
 * 
 * 注意: 実際の実装では、Google Sheets API v4とOAuth認証が必要です
 * ここでは、Google Apps ScriptのWebアプリを呼び出す実装を提供します
 */

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエストの処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTリクエストのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { spreadsheetId, data } = req.body;

    // バリデーション
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'スプレッドシートIDが必要です' });
    }

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'データが必要です' });
    }

    // Google Apps ScriptのWebアプリURL（環境変数から取得）
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_WRITE_URL;

    if (!scriptUrl) {
      // 環境変数が設定されていない場合、直接Google Sheets API v4を使用
      // ただし、OAuth認証が必要
      return res.status(500).json({
        error: 'Google Sheets書き込み機能が設定されていません',
        message: 'GOOGLE_APPS_SCRIPT_WRITE_URL環境変数を設定するか、Google Sheets API v4のOAuth認証を実装してください'
      });
    }

    // Google Apps ScriptのWebアプリを呼び出し
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spreadsheetId,
        data
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Apps Scriptエラー: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Google Sheetsへの書き込みが完了しました',
      result: result
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}

