/**
 * 楽天レビュー分析ツール
 * ec_rakuten.yml のレビュー分析ワークフローを実装
 * 
 * 注意: ブラウザから直接レビューページをスクレイピングするのはCORS制限があるため、
 * プロキシサーバーまたはバックエンドAPIが必要です。
 * ここでは基本的な構造と、可能な範囲での実装を提供します。
 */

class RakutenReviewAnalyzer {
    constructor() {
        this.chunkSize = 5000; // デフォルトチャンクサイズ
        this.maxPages = 50; // 最大ページ数
    }

    /**
     * 商品URLまたはitemCodeからレビューデータを取得
     * @param {string} itemUrl - 商品URL（オプション、itemCodeが提供されている場合は不要）
     * @param {string} itemCode - 商品コード（楽天APIの検索結果から取得可能）
     * @returns {Promise<Object>} レビュー分析結果
     */
    async analyzeReviews(itemUrl, itemCode = null) {
        try {
            // itemCodeが提供されている場合は直接使用
            let itemId = itemCode;
            
            // itemCodeがない場合のみ、URLから抽出を試みる
            if (!itemId && itemUrl) {
                itemId = await this.extractItemId(itemUrl);
            }
            
            if (!itemId) {
                return this.getEmptyResult('商品IDが見つかりませんでした。');
            }
            
            // itemCodeをレビューページURL用に変換
            // スラッシュをアンダースコアに置換、コロンもアンダースコアに置換
            // 例: "10001234/567890" -> "10001234_567890"
            // 例: "rakutenmobile-store:10001682" -> "rakutenmobile-store_10001682"
            itemId = itemId.replace(/[\/:]/g, '_');

            // レビューデータを取得
            const allReviews = await this.fetchAllReviews(itemId);
            
            if (allReviews.length === 0) {
                return this.getEmptyResult('レビューはありませんでした。');
            }

            // 最新10件の日付を取得
            const latestDate = this.getLatestReviewDate(allReviews);

            // 直近3ヶ月のレビューを分析
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            const reviewsInPeriod = allReviews.filter(review => {
                const reviewDate = new Date(review.review_date);
                return reviewDate >= threeMonthsAgo;
            });

            // 評価別に分類
            const { highRating, midRating, lowRating } = this.categorizeReviews(reviewsInPeriod);

            // 統計を計算
            const stats = this.calculateStats(reviewsInPeriod);

            return {
                latest_review_date: latestDate,
                review_count_3months: reviewsInPeriod.length,
                average_rating_3months: stats.averageRating,
                high_rating_reviews: highRating.join('<br>'),
                mid_rating_reviews: midRating.join('<br>'),
                low_rating_reviews: lowRating.join('<br>')
            };

        } catch (error) {
            console.error('レビュー分析エラー:', error);
            return this.getEmptyResult(`エラー: ${error.message}`);
        }
    }

    /**
     * 商品IDを抽出（商品URLから）
     * Vercel Functions経由で楽天ページを取得
     */
    async extractItemId(itemUrl) {
        const maxRetries = 2;
        const timeoutMs = 30000; // 30秒

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Vercel FunctionsのプロキシAPIを使用
                const proxyUrl = `/api/proxy-rakuten?url=${encodeURIComponent(itemUrl)}`;
                
                if (attempt > 0) {
                    console.log(`🔄 リトライ ${attempt}/${maxRetries}:`, itemUrl);
                    // リトライ前に少し待機
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                } else {
                    console.log('🌐 商品ページ取得:', itemUrl);
                }
                
                // タイムアウト付きfetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                try {
                    const response = await fetch(proxyUrl, {
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        // 504エラーの場合はリトライ
                        if (response.status === 504 && attempt < maxRetries) {
                            console.warn(`⏱️ タイムアウトエラー (${response.status})、リトライします...`);
                            continue;
                        }
                        
                        // その他のエラーまたはリトライ上限に達した場合、フォールバック
                        console.warn('プロキシAPIエラー、フォールバック使用');
                        return this.extractItemIdFromUrl(itemUrl);
                    }

                    const html = await response.text();
                    
                    // HTMLをログに表示（デバッグ用）
                    console.log('📄 取得された商品ページのHTML:');
                    console.log('HTML長:', html.length, '文字');
                    console.log('HTML（最初の10000文字）:', html.substring(0, 10000));
                    
                    // 方法1: HTML内のJSONデータから ratItemId を抽出
                    // パターン1: window.__INITIAL_STATE__ 形式
                    let jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
                    if (!jsonMatch) {
                        // パターン2: その他のJSONデータ形式を探す
                        jsonMatch = html.match(/<script[^>]*>[\s\S]*?({[\s\S]*?"rat"[\s\S]*?})[\s\S]*?<\/script>/);
                    }
                    
                    if (jsonMatch) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            // rat.genericParameter.ratItemId から取得
                            if (jsonData.rat && jsonData.rat.genericParameter && jsonData.rat.genericParameter.ratItemId) {
                                const itemId = jsonData.rat.genericParameter.ratItemId.replace(/\//g, '_');
                                console.log('✅ JSONデータ（rat.genericParameter.ratItemId）から商品ID抽出成功:', itemId);
                                return itemId;
                            }
                            // api.data.itemInfoSku から shopId と itemId を取得して構築
                            if (jsonData.api && jsonData.api.data && jsonData.api.data.itemInfoSku) {
                                const shopId = jsonData.api.data.itemInfoSku.shopId;
                                const itemId = jsonData.api.data.itemInfoSku.itemId;
                                if (shopId && itemId) {
                                    const ratItemId = `${shopId}_${itemId}`;
                                    console.log('✅ JSONデータ（shopId/itemId）から商品ID抽出成功:', ratItemId);
                                    return ratItemId;
                                }
                            }
                        } catch (e) {
                            console.warn('JSON解析エラー:', e);
                        }
                    }
                    
                    // 方法2: HTML内の ratItemId を正規表現で抽出（従来の方法）
                    const match = html.match(/ratItemId["']\s*:\s*["']([^"']+)["']/);
                    
                    if (match && match[1]) {
                        const itemId = match[1].replace(/\//g, '_');
                        console.log('✅ 正規表現で商品ID抽出成功:', itemId);
                        return itemId;
                    }

                    console.warn('商品IDが見つからず、フォールバック使用');
                    return this.extractItemIdFromUrl(itemUrl);

                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    
                    // タイムアウトエラーの場合はリトライ
                    if ((fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') && attempt < maxRetries) {
                        console.warn(`⏱️ タイムアウト、リトライします... (${attempt + 1}/${maxRetries})`);
                        continue;
                    }
                    
                    throw fetchError;
                }

            } catch (error) {
                // 最後の試行でもエラーが発生した場合、フォールバック
                if (attempt >= maxRetries) {
                    console.warn('商品ID抽出エラー（フォールバック使用）:', error);
                    return this.extractItemIdFromUrl(itemUrl);
                }
            }
        }
        
        // すべてのリトライが失敗した場合、フォールバック
        console.warn('すべてのリトライが失敗、フォールバック使用');
        return this.extractItemIdFromUrl(itemUrl);
    }

    /**
     * URLから商品IDを抽出（フォールバック）
     */
    extractItemIdFromUrl(url) {
        // 楽天のURLパターンから商品IDを抽出
        const patterns = [
            /\/item\/([^\/]+)/,
            /itemCode=([^&]+)/,
            /i\.rakuten\.co\.jp\/[^\/]+\/([^\/]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1].replace(/\//g, '_');
            }
        }

        return null;
    }

    /**
     * 全レビューデータを取得
     * Vercel Functions経由でレビューページを取得
     */
    async fetchAllReviews(itemId) {
        const allReviews = [];
        let pageNum = 1;
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        let foundOldReview = false;

        while (!foundOldReview && pageNum <= this.maxPages) {
            const maxRetries = 2;
            const timeoutMs = 30000; // 30秒
            let success = false;

            for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
                try {
                    // レビューページのURL形式を構築
                    // 実際の形式: https://review.rakuten.co.jp/item/1/384677_10001682/1.1/?l2-id=item_review
                    // ページ番号がある場合: ?p={pageNum} を追加
                    let reviewUrl;
                    if (pageNum === 1) {
                        reviewUrl = `https://review.rakuten.co.jp/item/1/${itemId}/1.1/?l2-id=item_review`;
                    } else {
                        reviewUrl = `https://review.rakuten.co.jp/item/1/${itemId}/1.1/?l2-id=item_review&p=${pageNum}`;
                    }
                    
                    // Vercel FunctionsのプロキシAPIを使用
                    const proxyUrl = `/api/proxy-rakuten?url=${encodeURIComponent(reviewUrl)}`;
                    
                    if (attempt > 0) {
                        console.log(`🔄 リトライ ${attempt}/${maxRetries}: ページ${pageNum}`);
                        // リトライ前に少し待機
                        await this.sleep(1000 * attempt);
                    } else {
                        console.log(`📄 レビューページ取得: ページ${pageNum}`);
                    }
                    
                    // タイムアウト付きfetch
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                    
                    try {
                        const response = await fetch(proxyUrl, {
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (!response.ok) {
                            // 504エラーの場合はリトライ
                            if (response.status === 504 && attempt < maxRetries) {
                                console.warn(`⏱️ タイムアウトエラー (${response.status})、リトライします...`);
                                continue;
                            }
                            
                            // その他のエラーまたはリトライ上限に達した場合
                            if (attempt >= maxRetries) {
                                console.warn(`ページ${pageNum}の取得失敗: ${response.status}`);
                                break; // ループを抜ける
                            }
                            continue;
                        }

                        const html = await response.text();
                        const pageReviews = this.parseReviewPage(html);

                        if (pageReviews.length === 0) {
                            console.log(`ページ${pageNum}: レビューなし、終了`);
                            foundOldReview = true; // ループを終了させる
                            success = true;
                            break;
                        }

                        console.log(`ページ${pageNum}: ${pageReviews.length}件のレビューを取得`);

                        // 3ヶ月以前のレビューが見つかったかチェック
                        for (const review of pageReviews) {
                            const reviewDate = new Date(review.review_date);
                            if (reviewDate < threeMonthsAgo) {
                                foundOldReview = true;
                                console.log('3ヶ月以前のレビューを発見、取得終了');
                                break;
                            }
                        }

                        allReviews.push(...pageReviews);
                        pageNum++;
                        success = true;

                        // レート制限を考慮して少し待機
                        await this.sleep(500);

                    } catch (fetchError) {
                        clearTimeout(timeoutId);
                        
                        // タイムアウトエラーの場合はリトライ
                        if ((fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') && attempt < maxRetries) {
                            console.warn(`⏱️ タイムアウト、リトライします... (${attempt + 1}/${maxRetries})`);
                            continue;
                        }
                        
                        // 最後の試行でもエラーが発生した場合
                        if (attempt >= maxRetries) {
                            throw fetchError;
                        }
                    }

                } catch (error) {
                    // 最後の試行でもエラーが発生した場合
                    if (attempt >= maxRetries) {
                        console.error(`ページ${pageNum}の取得エラー:`, error);
                        // エラーが発生しても次のページに進む（breakしない）
                        pageNum++;
                        break; // リトライループを抜ける
                    }
                }
            }

            // リトライがすべて失敗した場合、次のページに進むか終了
            if (!success) {
                console.warn(`ページ${pageNum}の取得に失敗しました。次のページに進みます。`);
                pageNum++;
                // 連続で失敗した場合は終了
                if (pageNum > 3 && allReviews.length === 0) {
                    console.warn('複数ページで取得失敗、処理を終了します');
                    break;
                }
            }
        }

        console.log(`✅ 合計${allReviews.length}件のレビューを取得`);
        return allReviews;
    }

    /**
     * スリープ（待機）
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * レビューページのHTMLをパース
     */
    parseReviewPage(html) {
        const reviews = [];
        
        // レビューブロックを抽出
        const reviewBlockPattern = /<div class="container--_-T98.*?<\/li>/gs;
        const blocks = html.match(reviewBlockPattern) || [];

        for (const block of blocks) {
            // 日付を抽出
            const dateMatch = block.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
            if (!dateMatch) continue;

            // 評価を抽出
            const ratingMatch = block.match(/<span class="text-container--2tSUW size-body-1-low--Zmj3x style-bold--1IVlx.*?>(\d)<\/span>/);
            if (!ratingMatch) continue;

            // レビュー本文を抽出
            const textMatch = block.match(/<div class="review-body--3myhE">(.*?)<\/div>/s);
            
            reviews.push({
                review_date: dateMatch[1],
                rating: parseInt(ratingMatch[1]),
                review_text: textMatch ? textMatch[1].trim().replace(/\n/g, '') : ''
            });
        }

        return reviews;
    }

    /**
     * 最新レビュー日を取得
     */
    getLatestReviewDate(reviews) {
        if (reviews.length === 0) return '日付なし';

        const dates = reviews.slice(0, 10)
            .map(r => r.review_date)
            .filter(d => d);

        if (dates.length === 0) return '日付なし';

        // 日付を比較して最新を取得
        dates.sort((a, b) => {
            const dateA = new Date(a.replace(/\//g, '-'));
            const dateB = new Date(b.replace(/\//g, '-'));
            return dateB - dateA;
        });

        return dates[0];
    }

    /**
     * レビューを評価別に分類
     */
    categorizeReviews(reviews) {
        const highRating = []; // 4-5
        const midRating = [];  // 3
        const lowRating = [];  // 1-2

        for (const review of reviews) {
            const text = review.review_text || '';
            if (review.rating >= 4) {
                highRating.push(text);
            } else if (review.rating === 3) {
                midRating.push(text);
            } else {
                lowRating.push(text);
            }
        }

        return { highRating, midRating, lowRating };
    }

    /**
     * 統計を計算
     */
    calculateStats(reviews) {
        if (reviews.length === 0) {
            return {
                averageRating: 0,
                totalReviews: 0
            };
        }

        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = Math.round((totalRating / reviews.length) * 100) / 100;

        return {
            averageRating,
            totalReviews: reviews.length
        };
    }

    /**
     * 空の結果を返す
     */
    getEmptyResult(message) {
        return {
            latest_review_date: message,
            review_count_3months: 0,
            average_rating_3months: 0,
            high_rating_reviews: '',
            mid_rating_reviews: '',
            low_rating_reviews: ''
        };
    }
}

// シングルトンインスタンス
const rakutenReviewAnalyzer = new RakutenReviewAnalyzer();

// グローバルに公開
window.RakutenReviewAnalyzer = RakutenReviewAnalyzer;
window.rakutenReviewAnalyzer = rakutenReviewAnalyzer;

