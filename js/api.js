// 商品調査・分析ダッシュボード - API管理

/**
 * RESTful API wrapper for table operations
 */
class DashboardAPI {
    constructor() {
        this.baseURL = '';  // 相対URL使用
    }

    /**
     * HTTP リクエストの基本メソッド
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 204 No Content の場合は空のレスポンス
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    /**
     * ユーザー関連API
     */
    async getUsers(page = 1, limit = 10) {
        return this.request(`tables/users?page=${page}&limit=${limit}`);
    }

    async getUser(userId) {
        return this.request(`tables/users/${userId}`);
    }

    async createUser(userData) {
        return this.request('tables/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUser(userId, userData) {
        return this.request(`tables/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    /**
     * プロジェクト関連API
     */
    async getProjects(userId, page = 1, limit = 10) {
        const searchParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search: userId  // user_id で検索
        });
        return this.request(`tables/projects?${searchParams}`);
    }

    async getProject(projectId) {
        return this.request(`tables/projects/${projectId}`);
    }

    async createProject(projectData) {
        // システムフィールドを追加
        const newProject = {
            ...projectData,
            id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: 'created',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return this.request('tables/projects', {
            method: 'POST',
            body: JSON.stringify(newProject)
        });
    }

    async updateProject(projectId, projectData) {
        const updatedProject = {
            ...projectData,
            updated_at: new Date().toISOString()
        };

        return this.request(`tables/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedProject)
        });
    }

    async deleteProject(projectId) {
        return this.request(`tables/projects/${projectId}`, {
            method: 'DELETE'
        });
    }

    /**
     * クエリ関連API
     */
    async getQueries(projectId) {
        return this.request(`tables/queries?search=${projectId}`);
    }

    async createQuery(queryData) {
        const newQuery = {
            ...queryData,
            id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return this.request('tables/queries', {
            method: 'POST',
            body: JSON.stringify(newQuery)
        });
    }

    /**
     * アイテム（商品）関連API
     */
    async getItems(queryId, page = 1, limit = 50) {
        return this.request(`tables/items?search=${queryId}&page=${page}&limit=${limit}`);
    }

    async createItems(itemsData) {
        const items = itemsData.map(item => ({
            ...item,
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        }));

        // 複数アイテムを順次追加
        const results = [];
        for (const item of items) {
            try {
                const result = await this.request('tables/items', {
                    method: 'POST',
                    body: JSON.stringify(item)
                });
                results.push(result);
            } catch (error) {
                console.error('Failed to create item:', error);
            }
        }
        return results;
    }

    /**
     * レビュー関連API
     */
    async getReviews(itemId) {
        return this.request(`tables/reviews?search=${itemId}`);
    }

    async createReviews(reviewsData) {
        const reviews = reviewsData.map(review => ({
            ...review,
            id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        }));

        const results = [];
        for (const review of reviews) {
            try {
                const result = await this.request('tables/reviews', {
                    method: 'POST',
                    body: JSON.stringify(review)
                });
                results.push(result);
            } catch (error) {
                console.error('Failed to create review:', error);
            }
        }
        return results;
    }

    /**
     * メトリクス関連API
     */
    async getMetrics(queryId, startDate = null, endDate = null) {
        let url = `tables/metrics_daily?search=${queryId}`;
        if (startDate && endDate) {
            url += `&start_date=${startDate}&end_date=${endDate}`;
        }
        return this.request(url);
    }

    async createMetrics(metricsData) {
        const newMetrics = {
            ...metricsData,
            id: `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };

        return this.request('tables/metrics_daily', {
            method: 'POST',
            body: JSON.stringify(newMetrics)
        });
    }

    /**
     * インサイト（AI分析結果）関連API
     */
    async getInsights(queryId) {
        return this.request(`tables/insights?search=${queryId}`);
    }

    async createInsight(insightData) {
        const newInsight = {
            ...insightData,
            id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };

        return this.request('tables/insights', {
            method: 'POST',
            body: JSON.stringify(newInsight)
        });
    }

    /**
     * 分析データ計算ユーティリティ
     */
    calculateMetrics(items) {
        if (!items || items.length === 0) {
            return {
                totalItems: 0,
                avgPrice: 0,
                medianPrice: 0,
                minPrice: 0,
                maxPrice: 0,
                avgRating: 0,
                totalReviews: 0
            };
        }

        const prices = items.map(item => item.price || 0).filter(price => price > 0);
        const ratings = items.map(item => item.rating || 0).filter(rating => rating > 0);
        const reviewCounts = items.map(item => item.review_count || 0);

        // 価格統計
        prices.sort((a, b) => a - b);
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const medianPrice = prices.length > 0 ? 
            (prices.length % 2 === 0 ? 
                (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2 : 
                prices[Math.floor(prices.length / 2)]
            ) : 0;

        // 評価統計
        const avgRating = ratings.length > 0 ? 
            ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;

        return {
            totalItems: items.length,
            avgPrice: Math.round(avgPrice),
            medianPrice: Math.round(medianPrice),
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            avgRating: Math.round(avgRating * 10) / 10,
            totalReviews: reviewCounts.reduce((sum, count) => sum + count, 0)
        };
    }

    /**
     * 価格分布データ生成
     */
    generatePriceDistribution(items) {
        const prices = items.map(item => item.price || 0).filter(price => price > 0);
        
        if (prices.length === 0) {
            return {};
        }

        const ranges = [
            { label: '0-2,000円', min: 0, max: 2000 },
            { label: '2,000-5,000円', min: 2000, max: 5000 },
            { label: '5,000-10,000円', min: 5000, max: 10000 },
            { label: '10,000-20,000円', min: 10000, max: 20000 },
            { label: '20,000円以上', min: 20000, max: Infinity }
        ];

        const distribution = {};
        ranges.forEach(range => {
            const count = prices.filter(price => price >= range.min && price < range.max).length;
            distribution[range.label] = count;
        });

        return distribution;
    }

    /**
     * 模擬データ生成（API連携前のテスト用）
     */
    async simulateMarketplaceAPI(keyword, marketplace = 'both', limit = 50) {
        // 実際のAPI呼び出しをシミュレート
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockItems = this.generateMockItems(keyword, marketplace, limit);
                resolve(mockItems);
            }, 1000 + Math.random() * 2000); // 1-3秒のランダム遅延
        });
    }

    generateMockItems(keyword, marketplace, limit) {
        const items = [];
        const basePrice = this.getBasePriceForKeyword(keyword);
        
        for (let i = 0; i < limit; i++) {
            const priceVariation = (Math.random() - 0.5) * 0.8; // ±40%の価格変動
            const price = Math.round(basePrice * (1 + priceVariation));
            
            items.push({
                ranking: i + 1,
                name: this.generateMockItemName(keyword, i),
                price: Math.max(price, 100), // 最低100円
                url: `https://example.com/item/${i + 1}`,
                image_url: `https://via.placeholder.com/300x300?text=${encodeURIComponent(keyword)}`,
                shop_name: this.generateMockShopName(),
                marketplace: marketplace === 'both' ? (Math.random() > 0.5 ? 'rakuten' : 'yahoo') : marketplace,
                rating: Math.round((3.0 + Math.random() * 2.0) * 10) / 10, // 3.0-5.0
                review_count: Math.round(Math.random() * 2000),
                retrieved_at: new Date().toISOString()
            });
        }
        
        return items;
    }

    getBasePriceForKeyword(keyword) {
        const priceMap = {
            'iphone': 3000,
            'ケース': 2500,
            'ワイヤレスイヤホン': 15000,
            'スマートウォッチ': 25000,
            'バッテリー': 2000,
            '充電器': 1500
        };

        const lowerKeyword = keyword.toLowerCase();
        for (const [key, price] of Object.entries(priceMap)) {
            if (lowerKeyword.includes(key)) {
                return price;
            }
        }
        return 5000; // デフォルト価格
    }

    generateMockItemName(keyword, index) {
        const adjectives = ['高品質', '人気', 'おすすめ', '新型', 'プレミアム', 'お得'];
        const features = ['防水', '耐衝撃', '軽量', 'コンパクト', '大容量', '高速'];
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const feature = features[Math.floor(Math.random() * features.length)];
        
        return `${adj} ${keyword} ${feature} モデル${index + 1}`;
    }

    generateMockShopName() {
        const shopNames = [
            'エレクトロニクスマート',
            'スマホアクセサリーShop',
            'デジタル商会',
            'テック専門店',
            'アクセサリーハウス',
            'ガジェットストア'
        ];
        
        return shopNames[Math.floor(Math.random() * shopNames.length)];
    }
}

// APIインスタンスの作成とエクスポート
const dashboardAPI = new DashboardAPI();

// グローバル変数として利用可能にする
window.dashboardAPI = dashboardAPI;

// モジュールとしてエクスポート（必要に応じて）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardAPI, dashboardAPI };
}