/**
 * 楽天商品調査ツール - 楽天API連携
 * ec_rakuten.yml のワークフローを実装
 */

class RakutenAPI {
    constructor() {
        // 楽天アプリID（環境変数から取得するか、設定画面で設定）
        this.appId = localStorage.getItem('rakuten_app_id') || '1011800059095379100';
        this.baseURL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
        this.gasSearchUrl = null;
        this.initGasSearchUrl();
    }

    /**
     * GAS検索URLを初期化
     */
    async initGasSearchUrl() {
        try {
            const response = await fetch('/api/get-config');
            if (response.ok) {
                const config = await response.json();
                this.gasSearchUrl = config.gasSearchUrl || null;
                if (this.gasSearchUrl) {
                    console.log('✅ GAS検索URLを取得:', this.gasSearchUrl);
                }
            }
        } catch (error) {
            console.warn('⚠️ GAS検索URLの取得に失敗:', error);
        }
    }

    /**
     * 楽天商品検索API
     * GAS経由でスクレイピング、またはVercel Functions経由で楽天APIを呼び出し
     * @param {Object} params - 検索パラメータ
     * @returns {Promise<Object>} 商品データ
     */
    async searchItems(params) {
        const {
            keyword,
            minPrice = 0,
            maxPrice = null,
            NGKeyword = '',
            hits = 30,
            postageFlag = 1,
            rakuten_appid = null
        } = params;

        // PythonスクレイパーAPIを優先的に使用
        const pythonApiUrl = '/api/rakuten-search-scraper';
        
        // GAS検索URLが設定されている場合はGASを使用
        if (this.gasSearchUrl) {
            return await this.searchItemsViaGAS(keyword, hits, minPrice, maxPrice, NGKeyword);
        }

        // PythonスクレイパーAPIを使用（フォールバック）
        try {
            console.log('🔍 楽天市場スクレイピング（Python経由）:', { keyword, hits });
            
            const url = new URL(pythonApiUrl, window.location.origin);
            url.searchParams.set('keyword', keyword);
            url.searchParams.set('page', '1');
            url.searchParams.set('maxItems', hits.toString());
            
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Pythonスクレイピングエラー');
            }
            
            // データを既存のワークフロー形式に変換
            const products = this.convertScrapedProductsToWorkflowFormat(
                data.products || [],
                minPrice,
                maxPrice,
                NGKeyword
            );
            
            console.log('✅ Pythonスクレイピング成功:', products.length, '件');
            
            return {
                success: true,
                total_products: products.length,
                products: products,
                raw_data: null
            };
            
        } catch (error) {
            console.error('❌ Pythonスクレイピングエラー:', error);
            // フォールバック: 既存のNode.js API
            console.log('🔄 Node.js APIにフォールバック');
        }

        // フォールバック: Vercel FunctionsのAPIエンドポイント（Node.js）
        const apiUrl = '/api/rakuten-search';
        
        // 使用するアプリID
        const appId = rakuten_appid || this.appId;

        try {
            console.log('🔍 楽天APIリクエスト（Vercel Functions経由）:', { keyword, minPrice, maxPrice });

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    keyword,
                    minPrice,
                    maxPrice,
                    NGKeyword,
                    hits,
                    rakuten_appid: appId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '楽天APIエラー');
            }

            console.log('✅ 楽天API取得成功:', data.total_products || 0, '件');
            return data;

        } catch (error) {
            console.error('❌ 楽天APIエラー:', error);
            throw error;
        }
    }

    /**
     * GAS経由で商品検索（スクレイピング）
     * @param {string} keyword - 検索キーワード
     * @param {number} hits - 最大取得数
     * @param {number} minPrice - 最低価格
     * @param {number} maxPrice - 最高価格
     * @param {string} NGKeyword - NGキーワード
     * @returns {Promise<Object>} 商品データ
     */
    async searchItemsViaGAS(keyword, hits, minPrice, maxPrice, NGKeyword) {
        try {
            console.log('🔍 楽天市場スクレイピング（GAS経由）:', { keyword, hits });

            const url = new URL(this.gasSearchUrl);
            url.searchParams.set('keyword', keyword);
            url.searchParams.set('page', '1');
            url.searchParams.set('maxItems', hits.toString());

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('📥 GASレスポンス:', JSON.stringify(data, null, 2));
            
            if (!data.success) {
                throw new Error(data.error || 'GASスクレイピングエラー');
            }

            // productsが存在しない、または空配列の場合
            if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
                console.warn('⚠️ GASから商品が返されませんでした:', data);
                return {
                    success: true,
                    total_products: 0,
                    products: [],
                    raw_data: data
                };
            }

            console.log('📦 GASから取得した商品数:', data.products.length);

            // データを既存のワークフロー形式に変換
            const products = data.products
                .map((product, index) => {
                    // 価格から数値を抽出
                    const priceMatch = product.price ? product.price.match(/[\d,]+/) : null;
                    const itemPrice = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;
                    
                    console.log(`📦 商品${index + 1}:`, {
                        name: product.name,
                        price: product.price,
                        itemPrice: itemPrice,
                        product_url: product.product_url
                    });

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

            console.log('📊 フィルタリング後の商品数:', products.length, '件');
            console.log('✅ GASスクレイピング成功:', products.length, '件');
            
            if (products.length === 0) {
                console.warn('⚠️ フィルタリングで全ての商品が除外されました');
                console.log('🔍 フィルタ条件:', { minPrice, maxPrice, NGKeyword });
            }

            return {
                success: true,
                total_products: products.length,
                products: products,
                raw_data: null
            };

        } catch (error) {
            console.error('❌ GASスクレイピングエラー:', error);
            throw error;
        }
    }

    /**
     * スクレイピング結果をワークフロー形式に変換
     * @param {Array} scrapedProducts - スクレイピングで取得した商品データ
     * @param {number} minPrice - 最低価格
     * @param {number} maxPrice - 最高価格
     * @param {string} NGKeyword - NGキーワード
     * @returns {Array} ワークフロー形式の商品データ
     */
    convertScrapedProductsToWorkflowFormat(scrapedProducts, minPrice, maxPrice, NGKeyword) {
        return scrapedProducts
            .map((product, index) => {
                // 価格から数値を抽出
                const priceMatch = product.price ? product.price.match(/[\d,]+/) : null;
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
                    affiliate_url: product.product_url,
                    medium_image_urls: [product.image_url],
                    small_image_urls: [product.image_url],
                    review_count: reviewCount,
                    review_average: reviewAverage,
                    shop_name: product.shop_name || 'ショップ名なし',
                    shop_url: product.shop_name ? `https://www.rakuten.co.jp/${product.shop_name}/` : '',
                    catch_copy: '',
                    item_caption: '',
                    availability: '在庫あり',
                    postage_flag: product.shipping_info === '送料無料' ? '送料込み' : '送料別',
                    genre_id: '',
                    start_time: '',
                    end_time: ''
                };
            })
            .filter(product => product !== null);
    }

    /**
     * 楽天APIレスポンスを処理
     */
    processRakutenData(data) {
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

        return {
            total_products: products.length,
            products: products,
            raw_data: data
        };
    }

    /**
     * 商品コードから詳細情報を取得（送料込み価格取得用）
     */
    async getItemDetail(itemCode) {
        const queryParams = new URLSearchParams({
            format: 'json',
            itemCode: itemCode,
            postageFlag: '1',
            applicationId: this.appId
        });

        try {
            const url = `${this.baseURL}?${queryParams.toString()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error || !data.Items || data.Items.length === 0) {
                return null;
            }

            const item = data.Items[0].Item;
            return {
                item_price: item.itemPrice || 0,
                postage_flag: item.postageFlag || 0
            };

        } catch (error) {
            console.error('商品詳細取得エラー:', error);
            return null;
        }
    }

    /**
     * アプリIDを設定
     */
    setAppId(appId) {
        this.appId = appId;
        localStorage.setItem('rakuten_app_id', appId);
    }
}

// シングルトンインスタンス
const rakutenAPI = new RakutenAPI();

// グローバルに公開
window.RakutenAPI = RakutenAPI;
window.rakutenAPI = rakutenAPI;

