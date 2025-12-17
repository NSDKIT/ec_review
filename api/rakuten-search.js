/**
 * Vercel Serverless Function
 * 楽天市場の検索結果ページから商品情報をスクレイピング
 */

import * as cheerio from 'cheerio';

/**
 * HTMLコンテンツから商品情報を抽出する
 * @param {string} htmlContent - HTMLコンテンツの文字列
 * @returns {Array<Object>} 商品情報のリスト
 */
function extractProductInfo(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const products = [];
  const processedContainers = new Set();

  // 方法1: 商品画像を基準に商品コンテナを探す
  // 楽天市場の商品画像は通常、tshop.r10s.jpドメインを使用
  const productImages = $('img[src*="tshop.r10s.jp"]').filter((i, img) => {
    const src = $(img).attr('src') || '';
    return /\.(jpg|jpeg|png)$/i.test(src);
  });

  productImages.each((i, img) => {
    const $img = $(img);
    let container = null;

    // 親要素を探索（最大5階層まで）
    let parent = $img.parent();
    for (let depth = 0; depth < 5; depth++) {
      if (parent.length === 0) break;

      const classes = parent.attr('class') || '';
      const className = classes.toLowerCase();
      
      if (
        parent.is('div') &&
        (className.includes('item') ||
         className.includes('product') ||
         className.includes('goods'))
      ) {
        container = parent;
        break;
      }
      parent = parent.parent();
    }

    // コンテナが見つからない場合は、画像の親要素を使用
    if (!container || container.length === 0) {
      container = $img.closest('div');
    }

    if (!container || container.length === 0) return;

    // 同じコンテナを重複処理しないようにする
    const containerId = container[0] ? container[0].attribs?.id || container[0].name + i : i;
    if (processedContainers.has(containerId)) return;
    processedContainers.add(containerId);

    const product = {
      name: '',
      price: '',
      image_url: $img.attr('src') || '',
      image_alt: $img.attr('alt') || '',
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
    let nameLink = null;
    const selectors = [
      container.find('h2'),
      container.find('h3'),
      container.find('a[href*="/item/"]'),
      container.find('a[title]')
    ];

    for (const selector of selectors) {
      if (selector.length > 0) {
        if (selector.is('h2') || selector.is('h3')) {
          nameLink = selector.find('a');
        } else {
          nameLink = selector;
        }
        if (nameLink.length > 0) break;
      }
    }

    if (nameLink && nameLink.length > 0) {
      product.name = nameLink.text().trim();
      let href = nameLink.attr('href') || '';
      if (href) {
        // 相対URLを絶対URLに変換
        if (href.startsWith('//')) {
          product.product_url = 'https:' + href;
        } else if (href.startsWith('/')) {
          product.product_url = 'https://search.rakuten.co.jp' + href;
        } else {
          product.product_url = href;
        }
      }
    }

    // 商品名が取得できなかった場合は、画像のalt属性から取得
    if (!product.name && product.image_alt) {
      const altText = product.image_alt;
      product.name = altText.length > 100 ? altText.substring(0, 100) + '...' : altText;
    }

    // 価格を取得
    const priceElements = container.find('[class*="price" i]');
    let foundPrice = false;

    priceElements.each((j, priceElem) => {
      const $priceElem = $(priceElem);
      // 商品名を含む要素は除外
      if ($priceElem.closest('h2, h3').length > 0) return;
      if ($priceElem.find('a[href*="/item/"]').length > 0) return;

      const priceText = $priceElem.text().trim();
      // 価格パターン: 数値+円 または ¥+数値 の形式で、短いテキストのみ
      const priceMatch = priceText.match(/([\d,]+円|¥[\d,]+|[\d,]+円\/本)/);
      if (priceMatch && priceText.length < 100) {
        product.price = priceMatch[1];
        foundPrice = true;
        return false; // break
      }
    });

    // 価格要素が見つからない場合、テキストノードから価格パターンを探す
    if (!foundPrice) {
      const pricePattern = /([\d,]+円|¥[\d,]+|[\d,]+円\/本)/;
      const containerText = container.text();
      const textNodes = containerText.split(/\s+/);

      for (const textNode of textNodes) {
        // 商品名のような長いテキストは除外
        if (textNode.length < 100) {
          const match = textNode.match(pricePattern);
          if (match) {
            product.price = match[1];
            break;
          } else if (/^[\d,]+円(\/本)?\s*\(.*\)?$/.test(textNode)) {
            product.price = textNode;
            break;
          }
        }
      }
    }

    // レビュー情報を取得
    // パターン: "4.49(5,695件)" のような形式
    const reviewText = container.text();
    const reviewMatch = reviewText.match(/(\d+\.\d+)\(([\d,]+)件\)/);
    if (reviewMatch) {
      product.review_rating = reviewMatch[1];
      product.review_count = reviewMatch[2];
    }

    // レビューリンクからも取得を試みる
    if (!product.review_rating) {
      const reviewLink = container.find('a[href*="review.rakuten.co.jp/item"]');
      if (reviewLink.length > 0) {
        const reviewText = reviewLink.text().trim();
        const match = reviewText.match(/(\d+\.\d+)\(([\d,]+)件\)/);
        if (match) {
          product.review_rating = match[1];
          product.review_count = match[2];
        }
      }
    }

    // ショップ名を画像URLから抽出
    const shopMatch = product.image_url.match(/tshop\.r10s\.jp\/([^/]+)\//);
    if (shopMatch) {
      product.shop_name = shopMatch[1];
    }

    // ショップリンクからも取得を試みる
    if (!product.shop_name) {
      const shopLink = container.find('a[href*="/shop/"]');
      if (shopLink.length > 0) {
        product.shop_name = shopLink.text().trim();
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
    const containerText = container.text();

    for (const pattern of shippingPricePatterns) {
      const match = containerText.match(pattern);
      if (match) {
        const fullText = match[0];
        const price = match[1] || '';

        if (
          fullText.length < 50 &&
          fullText.includes('送料') &&
          fullText.includes('円') &&
          !fullText.includes('送料無料') &&
          price
        ) {
          product.shipping_price = price;
          product.shipping_info = '送料有料';
          foundShippingPrice = true;
          break;
        }
      }
    }

    // 送料金額が見つからなかった場合、送料無料/有料の判定のみ
    if (!foundShippingPrice) {
      const shippingMatch = containerText.match(/送料(無料|有料)/);
      if (shippingMatch && shippingMatch[0].length < 50) {
        product.shipping_info = shippingMatch[0];
      }
    }

    // ポイント情報を取得
    const pointMatch = containerText.match(/(ポイント|pt|PT)[^\s]{0,30}/i);
    if (pointMatch && pointMatch[0].length < 50) {
      product.point_info = pointMatch[0];
    }

    // 商品名が取得できた場合のみリストに追加
    if (product.name) {
      products.push(product);
    }
  });

  return products;
}

/**
 * 楽天市場の検索結果から商品情報を取得する
 * @param {string} keyword - 検索キーワード
 * @param {number} page - ページ番号（1から開始）
 * @param {number} maxItems - 最大取得数
 * @returns {Promise<Array<Object>>} 商品情報のリスト
 */
async function fetchRakutenProducts(keyword, page = 1, maxItems = 30) {
  const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/?p=${page}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const products = extractProductInfo(html);

    // 最大取得数まで制限
    return products.slice(0, maxItems);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    return [];
  }
}

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
    const {
      keyword,
      minPrice = 0,
      maxPrice = null,
      NGKeyword = '',
      hits = 30
    } = req.body;

    // バリデーション
    if (!keyword) {
      return res.status(400).json({ error: '検索キーワードが必要です' });
    }

    console.log('🔍 楽天市場スクレイピング開始:', { keyword, hits });

    // 楽天市場の検索結果ページから商品情報を取得
    const scrapedProducts = await fetchRakutenProducts(keyword, 1, hits);

    if (scrapedProducts.length === 0) {
      return res.status(200).json({
        success: true,
        total_products: 0,
        products: [],
        raw_data: null
      });
    }

    // データを既存のワークフロー形式に変換
    const products = scrapedProducts
      .map((product, index) => {
        // 価格から数値を抽出
        const priceMatch = product.price.match(/[\d,]+/);
        const itemPrice = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;

        // レビュー数を数値に変換
        const reviewCount = product.review_count
          ? parseInt(product.review_count.replace(/,/g, ''), 10)
          : 0;

        // レビュー平均を数値に変換
        const reviewAverage = product.review_rating
          ? parseFloat(product.review_rating)
          : 0;

        // 商品URLからitem_codeを抽出（例: /item/123456/ → 123456）
        const itemCodeMatch = product.product_url.match(/\/item\/([^\/]+)/);
        const itemCode = itemCodeMatch ? itemCodeMatch[1] : '';

        // NGKeywordフィルタリング
        if (NGKeyword && product.name.includes(NGKeyword)) {
          return null;
        }

        // 価格フィルタリング
        if (minPrice && itemPrice < minPrice) {
          return null;
        }
        if (maxPrice && itemPrice > maxPrice) {
          return null;
        }

        return {
          ranking: index + 1,
          item_name: product.name,
          item_code: itemCode,
          item_price: itemPrice,
          item_price_with_shipping: itemPrice, // 送料込み価格は後で更新される可能性がある
          item_url: product.product_url,
          affiliate_url: product.product_url, // アフィリエイトURLは商品URLと同じ
          medium_image_urls: [product.image_url],
          small_image_urls: [product.image_url],
          review_count: reviewCount,
          review_average: reviewAverage,
          shop_name: product.shop_name || 'ショップ名なし',
          shop_url: product.shop_name ? `https://www.rakuten.co.jp/${product.shop_name}/` : '',
          catch_copy: '',
          item_caption: '',
          availability: '在庫あり', // スクレイピングでは判定不可
          postage_flag: product.shipping_info === '送料無料' ? '送料込み' : '送料別',
          genre_id: '',
          start_time: '',
          end_time: ''
        };
      })
      .filter(product => product !== null); // nullを除外

    console.log('✅ スクレイピング完了:', products.length, '件');

    return res.status(200).json({
      success: true,
      total_products: products.length,
      products: products,
      raw_data: null
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}
