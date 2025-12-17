/**
 * Vercel Serverless Function
 * 楽天商品検索API
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
    const {
      keyword,
      minPrice = 0,
      maxPrice = null,
      NGKeyword = '',
      hits = 30,
      rakuten_appid
    } = req.body;

    // バリデーション
    if (!keyword) {
      return res.status(400).json({ error: '検索キーワードが必要です' });
    }

    if (!rakuten_appid) {
      return res.status(400).json({ error: '楽天アプリIDが必要です' });
    }

    // 楽天APIのパラメータを構築
    const params = new URLSearchParams({
      format: 'json',
      keyword: keyword,
      hits: hits.toString(),
      minPrice: minPrice.toString(),
      applicationId: rakuten_appid,
      postageFlag: '1',
      availability: '0',
      field: '0',
      sort: 'standard'
    });

    if (maxPrice) {
      params.append('maxPrice', maxPrice.toString());
    }

    if (NGKeyword) {
      params.append('NGKeyword', NGKeyword);
    }

    // 楽天APIを呼び出し
    const rakutenUrl = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`;
    
    console.log('🔍 楽天API呼び出し:', rakutenUrl);

    const response = await fetch(rakutenUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RakutenSearchBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`楽天APIエラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // エラーチェック
    if (data.error) {
      return res.status(400).json({ 
        error: `楽天APIエラー: ${data.error}`,
        details: data
      });
    }

    // データを整形
    const items = data.Items || [];
    const products = items.map((itemData, index) => {
      const item = itemData.Item || {};
      
      return {
        ranking: index + 1,
        item_name: item.itemName || '商品名なし',
        item_code: item.itemCode || '',
        item_price: item.itemPrice || 0,
        item_price_with_shipping: item.itemPrice + (item.postageFlag === 1 ? 0 : (item.postage || 0)),
        item_url: item.itemUrl || '',
        affiliate_url: item.affiliateUrl || '',
        medium_image_urls: item.mediumImageUrls?.map(img => img.imageUrl) || [],
        small_image_urls: item.smallImageUrls?.map(img => img.imageUrl) || [],
        review_count: item.reviewCount || 0,
        review_average: item.reviewAverage || 0,
        shop_name: item.shopName || 'ショップ名なし',
        shop_url: item.shopUrl || '',
        catch_copy: item.catchcopy || '',
        item_caption: item.itemCaption || '',
        availability: item.availability === 1 ? '在庫あり' : '在庫なし',
        postage_flag: item.postageFlag === 1 ? '送料込み' : '送料別',
        genre_id: item.genreId || '',
        start_time: item.startTime || '',
        end_time: item.endTime || ''
      };
    });

    return res.status(200).json({
      success: true,
      total_products: products.length,
      products: products,
      raw_data: data
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    return res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: error.message
    });
  }
}

