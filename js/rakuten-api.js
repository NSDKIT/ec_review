/**
 * 楽天商品調査ツール - 楽天API連携
 * ec_rakuten.yml のワークフローを実装
 */

class RakutenAPI {
    constructor() {
        // 楽天アプリID（環境変数から取得するか、設定画面で設定）
        this.appId = localStorage.getItem('rakuten_app_id') || '1011800059095379100';
        this.baseURL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
    }

    /**
     * 楽天商品検索API
     * Vercel Functions経由で楽天APIを呼び出し
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

        // Vercel FunctionsのAPIエンドポイント
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

