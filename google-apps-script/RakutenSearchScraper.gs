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
 */
function doGet(e) {
  try {
    const keyword = e.parameter.keyword;
    const page = parseInt(e.parameter.page || '1', 10);
    const maxItems = parseInt(e.parameter.maxItems || '30', 10);
    
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
    // 価格パターン: 数値+円 または ¥+数値 の形式
    const pricePatterns = [
      /([\d,]+円)/g,
      /(¥[\d,]+)/g,
      /([\d,]+円\/本)/g
    ];
    
    let foundPrice = false;
    for (let p = 0; p < pricePatterns.length; p++) {
      const pattern = pricePatterns[p];
      const matches = containerHtml.match(pattern);
      if (matches) {
        for (let m = 0; m < matches.length; m++) {
          const priceText = matches[m];
          // 商品名のような長いテキストは除外
          if (priceText.length < 100) {
            product.price = priceText;
            foundPrice = true;
            break;
          }
        }
        if (foundPrice) break;
      }
    }
    
    // レビュー情報を取得
    // パターン: "4.49(5,695件)" のような形式
    const reviewMatch = containerHtml.match(/(\d+\.\d+)\(([\d,]+)件\)/);
    if (reviewMatch) {
      product.review_rating = reviewMatch[1];
      product.review_count = reviewMatch[2];
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
    
    // 送料情報を取得
    const shippingPricePatterns = [
      /送料\s*([\d,]+円)/,
      /送料\s*\+?\s*([\d,]+円)/,
      /送料[：:]\s*([\d,]+円)/,
      /\+送料\s*([\d,]+円)/
    ];
    
    let foundShippingPrice = false;
    for (let p = 0; p < shippingPricePatterns.length; p++) {
      const match = containerHtml.match(shippingPricePatterns[p]);
      if (match) {
        const fullText = match[0];
        const price = match[1] || '';
        
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
    }
    
    // 送料金額が見つからなかった場合、送料無料/有料の判定のみ
    if (!foundShippingPrice) {
      const shippingMatch = containerHtml.match(/送料(無料|有料)/);
      if (shippingMatch && shippingMatch[0].length < 50) {
        product.shipping_info = shippingMatch[0];
      }
    }
    
    // ポイント情報を取得
    const pointMatch = containerHtml.match(/(ポイント|pt|PT)[^\s]{0,30}/i);
    if (pointMatch && pointMatch[0].length < 50) {
      product.point_info = pointMatch[0];
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

