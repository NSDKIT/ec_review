/**
 * Google Apps Script
 * Google Sheets書き込み用Webアプリ
 * 
 * 使い方:
 * 1. このコードをGoogle Apps Scriptにコピー
 * 2. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」として公開
 * 3. 取得したURLをVercelの環境変数 GOOGLE_APPS_SCRIPT_WRITE_URL に設定
 */

function doPost(e) {
  try {
    // リクエストボディをパース
    const requestData = JSON.parse(e.postData.contents);
    const spreadsheetId = requestData.spreadsheetId;
    const sheetData = requestData.data;
    
    // バリデーション
    if (!spreadsheetId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'スプレッドシートIDが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!sheetData || !Array.isArray(sheetData)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'データが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // スプレッドシートを開く
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Sheet1');
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Sheet1が見つかりません'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // データを書き込み
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const item of sheetData) {
      try {
        const range = sheet.getRange(item.range);
        range.setValues(item.values);
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          range: item.range,
          error: error.toString()
        });
      }
    }
    
    // 結果を返す
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `${successCount}件の書き込みが完了しました`,
      successCount: successCount,
      errorCount: errorCount,
      errors: errors.length > 0 ? errors : undefined
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      message: '予期せぬエラーが発生しました'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * テスト用関数（オプション）
 */
function testWrite() {
  const testData = {
    spreadsheetId: '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY',
    data: [
      {
        range: 'Sheet1!B1:O1',
        values: [['検索順位', '商品名', '価格(送料抜)', '価格(送料込)', '商品URL', 'サムネURL', 'レビュー数', 'レビュー平均', 'レビュー最新日', '直近3ヶ月のレビュー数', '直近3ヶ月のレビュー平均', '高評価レビュー', '中評価レビュー', '低評価レビュー']]
      }
    ]
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

