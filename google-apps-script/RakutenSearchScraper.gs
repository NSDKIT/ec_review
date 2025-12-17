/**
 * Google Apps Script
 * 楽天市場の検索結果ページから商品情報をスクレイピング
 * 
 * 使い方:
 * 1. このコードをGoogle Apps Scriptにコピー
 * 2. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」として公開
 * 3. 取得したURLをVercelの環境変数 GOOGLE_APPS_SCRIPT_SEARCH_URL に設定
 * 
 * 注意: 商用利用では、楽天の利用規約を確認してください
 */

/**
 * GETリクエストの処理
 * パラメータ:
 * - keyword: 検索キーワード
 * - page: ページ番号（デフォルト: 1）
 * - maxItems: 最大取得数（デフォルト: 30）
 * - spreadsheetId: スプレッドシートID（指定された場合は書き込みも実行）
 */
function doGet(e) {
  try {
    const keyword = e.parameter.keyword;
    const page = parseInt(e.parameter.page || '1', 10);
    const maxItems = parseInt(e.parameter.maxItems || '30', 10);
    const spreadsheetId = e.parameter.spreadsheetId;
    
    // バリデーション
    if (!keyword) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '検索キーワードが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('🔍 楽天市場スクレイピング開始: keyword=' + keyword + ', page=' + page);
    
    // 楽天市場の検索結果ページから商品情報を取得
    const products = fetchRakutenProducts(keyword, page, maxItems);
    
    Logger.log('✅ スクレイピング完了: ' + products.length + '件');
    
    // スプレッドシートIDが指定されている場合は書き込みも実行
    if (spreadsheetId) {
      Logger.log('📝 Google Spreadsheetに書き込み開始: spreadsheetId=' + spreadsheetId);
      const writeResult = writeProductsToSheet(spreadsheetId, products);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        total_products: products.length,
        products: products,
        writeResult: writeResult
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // スプレッドシートIDが指定されていない場合は商品情報のみ返す
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      total_products: products.length,
      products: products
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('❌ エラー: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '予期せぬエラーが発生しました',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POSTリクエストの処理（スプレッドシートへの書き込みを含む）
 * パラメータ:
 * - keyword: 検索キーワード
 * - page: ページ番号（デフォルト: 1）
 * - maxItems: 最大取得数（デフォルト: 30）
 * - spreadsheetId: スプレッドシートID
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const keyword = requestData.keyword;
    const page = parseInt(requestData.page || '1', 10);
    const maxItems = parseInt(requestData.maxItems || '30', 10);
    const spreadsheetId = requestData.spreadsheetId;
    
    // バリデーション
    if (!keyword) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: '検索キーワードが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!spreadsheetId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'スプレッドシートIDが必要です'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log('🔍 楽天市場スクレイピング開始: keyword=' + keyword + ', page=' + page);
    
    // 楽天市場の検索結果ページから商品情報を取得
    const products = fetchRakutenProducts(keyword, page, maxItems);
    
    Logger.log('✅ スクレイピング完了: ' + products.length + '件');
    
    // Google Spreadsheetに書き込み
    Logger.log('📝 Google Spreadsheetに書き込み開始: spreadsheetId=' + spreadsheetId);
    const writeResult = writeProductsToSheet(spreadsheetId, products);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      total_products: products.length,
      products: products,
      writeResult: writeResult
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('❌ エラー: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: '予期せぬエラーが発生しました',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 楽天市場の検索結果から商品情報を取得する
 * @param {string} keyword - 検索キーワード
 * @param {number} page - ページ番号（1から開始）
 * @param {number} maxItems - 最大取得数
 * @returns {Array<Object>} 商品情報のリスト
 */
function fetchRakutenProducts(keyword, page, maxItems) {
  const url = 'https://search.rakuten.co.jp/search/mall/' + encodeURIComponent(keyword) + '/?p=' + page;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
  
  try {
    Logger.log('🌐 楽天市場ページ取得開始: ' + url);
    const response = UrlFetchApp.fetch(url, {
      headers: headers,
      muteHttpExceptions: true
    });
    
    const statusCode = response.getResponseCode();
    Logger.log('📥 レスポンス受信: ' + statusCode);
    
    if (statusCode !== 200) {
      throw new Error('HTTP error! status: ' + statusCode);
    }
    
    const html = response.getContentText();
    Logger.log('📄 HTML取得完了: ' + html.length + ' 文字');
    
    const products = extractProductInfo(html);
    Logger.log('📦 抽出された商品数: ' + products.length);
    
    // 最大取得数まで制限
    return products.slice(0, maxItems);
  } catch (error) {
    Logger.log('❌ エラーが発生しました: ' + error.toString());
    return [];
  }
}

/**
 * HTMLコンテンツから商品情報を抽出する
 * @param {string} htmlContent - HTMLコンテンツの文字列
 * @returns {Array<Object>} 商品情報のリスト
 */
function extractProductInfo(htmlContent) {
  const products = [];
  const processedContainers = [];
  
  Logger.log('📄 HTML解析開始。HTML長: ' + htmlContent.length + ' 文字');
  
  // 商品画像を基準に商品コンテナを探す
  // 楽天市場の商品画像は通常、tshop.r10s.jpドメインを使用
  const imagePattern = /<img[^>]*src=["']([^"']*tshop\.r10s\.jp[^"']*\.(jpg|jpeg|png))[^"']*["'][^>]*>/gi;
  let imageMatch;
  const imageMatches = [];
  
  while ((imageMatch = imagePattern.exec(htmlContent)) !== null) {
    imageMatches.push({
      src: imageMatch[1],
      fullTag: imageMatch[0],
      index: imageMatch.index
    });
  }
  
  Logger.log('🖼️ tshop.r10s.jpの画像数: ' + imageMatches.length);
  
  // 各画像から商品情報を抽出
  for (let i = 0; i < imageMatches.length; i++) {
    const imgMatch = imageMatches[i];
    const imgSrc = imgMatch.src;
    const imgTag = imgMatch.fullTag;
    
    // 画像のalt属性を取得
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const imgAlt = altMatch ? altMatch[1] : '';
    
    // 商品コンテナを探す（画像の前後5000文字以内を探索）
    const searchStart = Math.max(0, imgMatch.index - 5000);
    const searchEnd = Math.min(htmlContent.length, imgMatch.index + 5000);
    const containerHtml = htmlContent.substring(searchStart, searchEnd);
    
    // コンテナIDを生成（重複チェック用）
    const containerId = imgMatch.index;
    if (processedContainers.indexOf(containerId) !== -1) {
      continue;
    }
    processedContainers.push(containerId);
    
    const product = {
      name: '',
      price: '',
      image_url: imgSrc,
      image_alt: imgAlt,
      product_url: '',
      review_rating: '',
      review_count: '',
      shop_name: '',
      shipping_info: '',
      shipping_price: '',
      point_info: '',
      additional_info: {}
    };
    
    // 商品名を取得
    // 優先順位: h2/h3内のaタグ > itemを含むhrefのaタグ > title属性
    let nameLink = null;
    
    // h2/h3内のaタグを探す
    const h2Match = containerHtml.match(/<h2[^>]*>[\s\S]*?<a[^>]*href=["']([^"']*\/item\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
    const h3Match = containerHtml.match(/<h3[^>]*>[\s\S]*?<a[^>]*href=["']([^"']*\/item\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
    
    if (h2Match) {
      product.name = cleanText(h2Match[2]);
      product.product_url = normalizeUrl(h2Match[1]);
      nameLink = true;
    } else if (h3Match) {
      product.name = cleanText(h3Match[2]);
      product.product_url = normalizeUrl(h3Match[1]);
      nameLink = true;
    }
    
    // itemを含むhrefのaタグを探す
    if (!nameLink) {
      const itemLinkMatch = containerHtml.match(/<a[^>]*href=["']([^"']*\/item\/[^"']*)["'][^>]*>([\s\S]{0,200})<\/a>/i);
      if (itemLinkMatch) {
        product.name = cleanText(itemLinkMatch[2]);
        product.product_url = normalizeUrl(itemLinkMatch[1]);
        nameLink = true;
      }
    }
    
    // title属性から取得
    if (!nameLink) {
      const titleMatch = containerHtml.match(/<a[^>]*title=["']([^"']{0,200})["'][^>]*>/i);
      if (titleMatch) {
        product.name = cleanText(titleMatch[1]);
        nameLink = true;
      }
    }
    
    // 商品名が取得できなかった場合は、画像のalt属性から取得
    if (!product.name && product.image_alt) {
      const altText = product.image_alt;
      product.name = altText.length > 100 ? altText.substring(0, 100) + '...' : altText;
    }
    
    // 価格を取得
    // まず、価格専用のクラスを持つ要素を探す（商品名要素は除外）
    // Pythonコードのロジック: price_elements = container.find_all(class_=re.compile(r'price', re.I))
    let foundPrice = false;
    
    // 価格クラスを持つ要素を探す
    const priceClassPattern = /<[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi;
    let priceClassMatch;
    while ((priceClassMatch = priceClassPattern.exec(containerHtml)) !== null) {
      const priceElementHtml = priceClassMatch[0];
      const priceContent = priceClassMatch[1];
      
      // 商品名を含む要素は除外（h2, h3, 商品リンクを含む要素）
      if (priceElementHtml.indexOf('<h2') !== -1 || 
          priceElementHtml.indexOf('<h3') !== -1 ||
          priceElementHtml.indexOf('/item/') !== -1) {
        continue;
      }
      
      // 価格パターンを探す
      const priceMatch = priceContent.match(/([\d,]+円|¥[\d,]+|[\d,]+円\/本)/);
      if (priceMatch && priceContent.length < 100) {
        product.price = priceMatch[1];
        foundPrice = true;
        break;
      }
    }
    
    // 価格要素が見つからない場合、テキストノードから価格パターンを探す
    if (!foundPrice) {
      // HTMLタグを除去したテキストを取得（商品名要素を除外）
      // h2, h3, 商品リンクを含む要素を除外
      const textOnlyHtml = containerHtml
        .replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, '')
        .replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, '')
        .replace(/<a[^>]*href=["'][^"']*\/item\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
      
      // HTMLタグを除去
      const textOnly = textOnlyHtml.replace(/<[^>]+>/g, ' ');
      
      // 価格パターン: 数値+円（カンマ区切り可）、短いテキストのみ
      const pricePattern = /([\d,]+円|¥[\d,]+|[\d,]+円\/本)/g;
      let priceTextMatch;
      
      while ((priceTextMatch = pricePattern.exec(textOnly)) !== null) {
        const priceText = priceTextMatch[1];
        const contextStart = Math.max(0, priceTextMatch.index - 20);
        const contextEnd = Math.min(textOnly.length, priceTextMatch.index + priceText.length + 20);
        const context = textOnly.substring(contextStart, contextEnd);
        
        // 商品名のような長いテキストは除外
        if (context.length < 100) {
          product.price = priceText;
          foundPrice = true;
          break;
        }
      }
    }
    
    // レビュー情報を取得
    // Pythonコードのロジック: container.find_all(string=re.compile(r'\d+\.\d+\([\d,]+件\)'))
    // パターン: "4.49(5,695件)" のような形式
    // HTMLタグを除去したテキストから探す
    const reviewTextPattern = /(\d+\.\d+)\(([\d,]+)件\)/g;
    let reviewTextMatch;
    
    while ((reviewTextMatch = reviewTextPattern.exec(containerText)) !== null) {
      product.review_rating = reviewTextMatch[1];
      product.review_count = reviewTextMatch[2];
      break; // 最初のマッチを使用
    }
    
    // レビューリンクからも取得を試みる
    if (!product.review_rating) {
      const reviewLinkMatch = containerHtml.match(/<a[^>]*href=["'][^"']*review\.rakuten\.co\.jp\/item[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      if (reviewLinkMatch) {
        const reviewText = cleanText(reviewLinkMatch[1]);
        const match = reviewText.match(/(\d+\.\d+)\(([\d,]+)件\)/);
        if (match) {
          product.review_rating = match[1];
          product.review_count = match[2];
        }
      }
    }
    
    // ショップ名を画像URLから抽出
    const shopMatch = product.image_url.match(/tshop\.r10s\.jp\/([^\/]+)\//);
    if (shopMatch) {
      product.shop_name = shopMatch[1];
    }
    
    // ショップリンクからも取得を試みる
    if (!product.shop_name) {
      const shopLinkMatch = containerHtml.match(/<a[^>]*href=["'][^"']*\/shop\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
      if (shopLinkMatch) {
        product.shop_name = cleanText(shopLinkMatch[1]);
      }
    }
    
    // Pythonコードのロジック: container.get_text()でテキストを取得
    // HTMLタグを除去したテキストを取得（レビュー情報、送料情報、ポイント情報で使用）
    const containerText = containerHtml.replace(/<[^>]+>/g, ' ');
    
    // 送料情報を取得
    
    // まず、送料の金額を探す（例: 送料550円）
    const shippingPricePatterns = [
      /送料\s*([\d,]+円)/,
      /送料\s*\+?\s*([\d,]+円)/,
      /送料[：:]\s*([\d,]+円)/,
      /\+送料\s*([\d,]+円)/
    ];
    
    let foundShippingPrice = false;
    for (let p = 0; p < shippingPricePatterns.length; p++) {
      const pattern = shippingPricePatterns[p];
      let match;
      
      // Pythonコードのロジック: re.finditerで複数のマッチを処理
      while ((match = pattern.exec(containerText)) !== null) {
        const fullText = match[0];
        const price = match[1] || '';
        
        // 商品名のような長いテキストは除外
        // 「送料無料」も除外
        if (fullText.length < 50 && 
            fullText.indexOf('送料') !== -1 && 
            fullText.indexOf('円') !== -1 &&
            fullText.indexOf('送料無料') === -1 &&
            price) {
          product.shipping_price = price;
          product.shipping_info = '送料有料';
          foundShippingPrice = true;
          break;
        }
      }
      
      if (foundShippingPrice) {
        break;
      }
    }
    
    // 送料金額が見つからなかった場合、送料無料/有料の判定のみ
    if (!foundShippingPrice) {
      // Pythonコードのロジック: container.find_all(string=re.compile(r'送料無料|送料有料'))
      const shippingTextPattern = /送料(無料|有料)/g;
      let shippingMatch;
      
      while ((shippingMatch = shippingTextPattern.exec(containerText)) !== null) {
        const shippingText = shippingMatch[0].trim();
        // 短いテキストのみを送料情報として使用
        if (shippingText.length < 50 && /^送料(無料|有料)/.test(shippingText)) {
          product.shipping_info = shippingText;
          break;
        }
      }
    }
    
    // ポイント情報を取得
    // Pythonコードのロジック: container.find_all(string=re.compile(r'ポイント|pt|PT'))
    // HTMLタグを除去したテキストから探す
    const pointPattern = /(ポイント|pt|PT)[^\s]{0,30}/gi;
    let pointMatch;
    
    while ((pointMatch = pointPattern.exec(containerText)) !== null) {
      const pointText = pointMatch[0].trim();
      if (pointText.length < 50) {
        product.point_info = pointText;
        break;
      }
    }
    
    // 商品名が取得できた場合のみリストに追加
    if (product.name) {
      products.push(product);
      Logger.log('✅ 商品抽出成功: ' + product.name.substring(0, 50));
    }
  }
  
  Logger.log('📊 抽出された商品数: ' + products.length);
  return products;
}

/**
 * テキストをクリーンアップ（HTMLタグを削除、空白を整理）
 */
function cleanText(text) {
  if (!text) return '';
  // HTMLタグを削除
  text = text.replace(/<[^>]+>/g, '');
  // 改行やタブを空白に変換
  text = text.replace(/[\r\n\t]+/g, ' ');
  // 連続する空白を1つに
  text = text.replace(/\s+/g, ' ');
  // 前後の空白を削除
  return text.trim();
}

/**
 * URLを正規化（相対URLを絶対URLに変換）
 */
function normalizeUrl(url) {
  if (!url) return '';
  
  // 既に絶対URLの場合はそのまま
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
    return url;
  }
  
  // //で始まる場合はhttps:を追加
  if (url.indexOf('//') === 0) {
    return 'https:' + url;
  }
  
  // /で始まる場合はドメインを追加
  if (url.indexOf('/') === 0) {
    return 'https://search.rakuten.co.jp' + url;
  }
  
  return url;
}

/**
 * 商品情報をGoogle Spreadsheetに書き込む
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {Array<Object>} products - 商品情報のリスト
 * @returns {Object} 書き込み結果
 */
function writeProductsToSheet(spreadsheetId, products) {
  try {
    // スプレッドシートを開く
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Sheet1');
    
    if (!sheet) {
      throw new Error('Sheet1が見つかりません');
    }
    
    // 既存のデータをクリア（B2:O300）
    const clearRange = sheet.getRange('B2:O300');
    clearRange.clearContent();
    Logger.log('📝 既存データをクリアしました');
    
    // ヘッダーを書き込み
    const headers = [
      '検索順位',
      '商品名',
      '価格(送料抜)',
      '価格(送料込)',
      '商品URL',
      'サムネURL',
      'レビュー数',
      'レビュー平均',
      'レビュー最新日',
      '直近3ヶ月のレビュー数',
      '直近3ヶ月のレビュー平均',
      '高評価レビュー',
      '中評価レビュー',
      '低評価レビュー'
    ];
    
    const headerRange = sheet.getRange('B1:O1');
    headerRange.setValues([headers]);
    Logger.log('📝 ヘッダーを書き込みました');
    
    // 商品データを書き込み
    const rowData = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // 価格から数値を抽出
      const priceMatch = product.price ? product.price.match(/[\d,]+/) : null;
      const itemPrice = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;
      
      // 送料価格を抽出
      let shippingPrice = 0;
      if (product.shipping_price && product.shipping_price.trim() !== '') {
        const shippingMatch = product.shipping_price.match(/[\d,]+/);
        shippingPrice = shippingMatch ? parseInt(shippingMatch[0].replace(/,/g, ''), 10) : 0;
      }
      
      // 送料込み価格を計算
      // 送料無料の場合は送料抜き価格 = 送料込み価格
      // 送料有料で送料価格が取得できた場合は、送料抜き価格 + 送料 = 送料込み価格
      // 送料情報が不明な場合は送料抜き価格 = 送料込み価格
      let totalPrice = itemPrice;
      if (product.shipping_info === '送料有料' && shippingPrice > 0) {
        totalPrice = itemPrice + shippingPrice;
        Logger.log('💰 送料込み価格計算: ' + itemPrice + ' + ' + shippingPrice + ' = ' + totalPrice);
      } else if (product.shipping_info === '送料無料') {
        totalPrice = itemPrice; // 送料無料なので送料抜き = 送料込み
        Logger.log('💰 送料無料: ' + itemPrice);
      } else {
        // shipping_infoが空や不明な場合も、送料抜き = 送料込みとして扱う
        Logger.log('💰 送料情報不明: ' + itemPrice);
      }
      
      // レビュー数を数値に変換
      const reviewCount = product.review_count
        ? parseInt(product.review_count.replace(/,/g, ''), 10)
        : 0;
      
      // レビュー平均を数値に変換
      const reviewAverage = product.review_rating
        ? parseFloat(product.review_rating)
        : 0;
      
      // 商品URLを取得（product_urlが空の場合は空文字列）
      const productUrl = product.product_url || '';
      
      // 行データを作成
      const row = [
        i + 1, // 検索順位
        product.name || '', // 商品名
        itemPrice, // 価格(送料抜)
        totalPrice, // 価格(送料込) - 送料込み価格を計算
        productUrl, // 商品URL
        product.image_url || '', // サムネURL
        reviewCount, // レビュー数
        reviewAverage, // レビュー平均
        '', // レビュー最新日（後で更新）
        '', // 直近3ヶ月のレビュー数（後で更新）
        '', // 直近3ヶ月のレビュー平均（後で更新）
        '', // 高評価レビュー（後で更新）
        '', // 中評価レビュー（後で更新）
        ''  // 低評価レビュー（後で更新）
      ];
      
      rowData.push(row);
    }
    
    // 一括書き込み
    if (rowData.length > 0) {
      const dataRange = sheet.getRange(2, 2, rowData.length, 14); // B2から開始、14列
      dataRange.setValues(rowData);
      Logger.log('📝 ' + rowData.length + '件の商品データを書き込みました');
    }
    
    return {
      success: true,
      message: rowData.length + '件の商品データを書き込みました',
      totalProducts: rowData.length
    };
    
  } catch (error) {
    Logger.log('❌ 書き込みエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '書き込みに失敗しました'
    };
  }
}

/**
 * テスト用関数（オプション）
 */
function testScraper() {
  const keyword = 'クロックス';
  const products = fetchRakutenProducts(keyword, 1, 10);
  Logger.log('テスト結果: ' + products.length + '件');
  for (let i = 0; i < Math.min(products.length, 3); i++) {
    Logger.log('商品' + (i + 1) + ': ' + products[i].name);
    Logger.log('  価格: ' + products[i].price);
    Logger.log('  URL: ' + products[i].product_url);
  }
}

/**
 * テスト用関数（スプレッドシートへの書き込みを含む）
 */
function testScraperAndWrite() {
  const keyword = 'クロックス';
  const spreadsheetId = '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY'; // テスト用スプレッドシートID
  
  Logger.log('🔍 テスト開始: keyword=' + keyword);
  
  const products = fetchRakutenProducts(keyword, 1, 10);
  Logger.log('✅ スクレイピング完了: ' + products.length + '件');
  
  if (products.length > 0) {
    const writeResult = writeProductsToSheet(spreadsheetId, products);
    Logger.log('📝 書き込み結果: ' + JSON.stringify(writeResult));
  }
}

