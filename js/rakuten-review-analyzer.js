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
        // Google Apps ScriptのURL（Vercel環境変数から取得）
        this.gasProxyUrl = null; // 初期化時に取得
        this.initGasProxyUrl();
    }
    
    /**
     * Google Apps ScriptのプロキシURLを初期化（Vercel環境変数から取得）
     */
    async initGasProxyUrl() {
        try {
            const response = await fetch('/api/get-config');
            if (response.ok) {
                const config = await response.json();
                this.gasProxyUrl = config.gasProxyUrl || '';
                if (this.gasProxyUrl) {
                    console.log('✅ GASプロキシURLを取得:', this.gasProxyUrl);
                }
            }
        } catch (error) {
            console.warn('⚠️ 設定取得エラー（GASプロキシURL）:', error);
            this.gasProxyUrl = '';
        }
    }

    /**
     * 商品URLまたはitemCodeからレビューデータを取得
     * @param {string} itemUrl - 商品URL（オプション、itemCodeが提供されている場合は不要）
     * @param {string} itemCode - 商品コード（楽天APIの検索結果から取得可能）
     * @param {Function} progressCallback - 進行状況を更新するコールバック関数 (progress, message)
     * @returns {Promise<Object>} レビュー分析結果
     */
    async analyzeReviews(itemUrl, itemCode = null, progressCallback = null) {
        try {
            // レビューページURLには ratItemId (shopId_itemId 形式) が必要
            // itemUrl から ratItemId を抽出する（優先）
            let itemId = null;
            
            // itemUrl が空文字列や null の場合は、itemCode から商品URLを構築
            if (!itemUrl || itemUrl.trim() === '') {
                if (itemCode) {
                    // itemCode から商品URLを構築
                    // 例: "rakutenmobile-store:10001518" -> "https://item.rakuten.co.jp/rakutenmobile-store/10001518/"
                    const codeParts = itemCode.split(':');
                    if (codeParts.length === 2) {
                        const shopUrl = codeParts[0];
                        const itemNumber = codeParts[1];
                        itemUrl = `https://item.rakuten.co.jp/${shopUrl}/${itemNumber}/`;
                        console.log('🔗 itemCode から商品URLを構築:', itemUrl);
                    } else {
                        console.warn('⚠️ itemCode の形式が不正です:', itemCode);
                    }
                }
            }
            
            if (itemUrl && itemUrl.trim() !== '') {
                // itemUrl から ratItemId を抽出
                if (progressCallback) progressCallback(10, '商品ページから商品IDを抽出中...');
                itemId = await this.extractItemId(itemUrl, progressCallback);
            }
            
            if (!itemId) {
                const errorMsg = itemUrl 
                    ? '商品IDが見つかりませんでした。商品ページの取得に失敗した可能性があります。'
                    : '商品IDが見つかりませんでした。itemUrl または itemCode が必要です。';
                if (progressCallback) progressCallback(100, errorMsg);
                return this.getEmptyResult(errorMsg);
            }
            
            // ratItemId は既に "shopId_itemId" 形式（例: "384677_10001682"）になっているはず
            // スラッシュが含まれている場合はアンダースコアに置換
            itemId = itemId.replace(/\//g, '_');

            // レビューデータを取得
            if (progressCallback) progressCallback(30, 'レビューページを取得中...');
            const allReviews = await this.fetchAllReviews(itemId, progressCallback);
            
            if (allReviews.length === 0) {
                return this.getEmptyResult('レビューはありませんでした。');
            }

            // 最新10件の日付を取得
            if (progressCallback) progressCallback(95, 'レビューデータを分析中...');
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

            if (progressCallback) progressCallback(100, `レビュー分析完了: 直近3ヶ月のレビュー${reviewsInPeriod.length}件を分析`);

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
     * @param {string} itemUrl - 商品URL
     * @param {Function} progressCallback - 進行状況を更新するコールバック関数 (progress, message)
     */
    async extractItemId(itemUrl, progressCallback = null) {
        const maxRetries = 2;
        const timeoutMs = 30000; // 30秒

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Google Apps ScriptまたはVercel FunctionsのプロキシAPIを使用
                let proxyUrl;
                let useGas = false;
                
                if (this.gasProxyUrl) {
                    // Google Apps Scriptを使用
                    proxyUrl = `${this.gasProxyUrl}?url=${encodeURIComponent(itemUrl)}&ratItemIdOnly=false`;
                    useGas = true;
                    console.log('🔧 Google Apps Scriptを使用して商品ページを取得');
                } else {
                    // Vercel Functionsを使用（フォールバック）
                    proxyUrl = `/api/proxy-rakuten?url=${encodeURIComponent(itemUrl)}`;
                    console.log('🔧 Vercel Functionsを使用して商品ページを取得');
                }
                
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
                    
                    // レスポンスのContent-Typeを確認
                    const contentType = response.headers.get('content-type') || '';
                    const isJson = contentType.includes('application/json');
            
            if (!response.ok) {
                        // エラーレスポンスの内容を取得
                        let errorText;
                        if (isJson) {
                            try {
                                const errorJson = await response.json();
                                errorText = JSON.stringify(errorJson);
                            } catch (e) {
                                errorText = await response.text().catch(() => 'エラーレスポンスの取得に失敗');
                            }
                        } else {
                            errorText = await response.text().catch(() => 'エラーレスポンスの取得に失敗');
                        }
                        console.error(`❌ プロキシAPIエラー (${response.status}):`, errorText.substring(0, 500));
                        
                        // 504エラーの場合はリトライ
                        if (response.status === 504 && attempt < maxRetries) {
                            console.warn(`⏱️ タイムアウトエラー (${response.status})、リトライします...`);
                            continue;
                        }
                        
                        // その他のエラーまたはリトライ上限に達した場合、フォールバック
                console.warn('プロキシAPIエラー、フォールバック使用');
                return this.extractItemIdFromUrl(itemUrl);
            }

                    // GASの場合はJSON、Vercel Functionsの場合はHTML
                    let html;
                    let extractedRatItemId = null;
                    
                    if (useGas) {
                        // Google Apps Scriptからのレスポンス（JSON形式）
                        const contentType = response.headers.get('content-type') || '';
                        console.log('📥 GASレスポンスContent-Type:', contentType);
                        console.log('📥 GASレスポンスStatus:', response.status);
                        
                        if (!response.ok) {
                            const errorText = await response.text().catch(() => 'エラーレスポンスの取得に失敗');
                            console.error('❌ GASエラー:', errorText);
                            throw new Error(`GASエラー: ${response.status} - ${errorText}`);
                        }
                        
                        if (contentType.includes('application/json')) {
                            const jsonData = await response.json();
                            console.log('📄 Google Apps Scriptからのレスポンス（JSON）:', jsonData);
                            
                            // エラーチェック
                            if (jsonData.error) {
                                console.error('❌ GASエラー:', jsonData.error);
                                throw new Error(`GASエラー: ${jsonData.error} - ${jsonData.message || ''}`);
                            }
                            
                            html = jsonData.html || '';
                            extractedRatItemId = jsonData.ratItemId || null;
                            
                            console.log('📄 Google Apps Scriptからのレスポンス:');
                            console.log('HTML長:', html ? html.length : 0, '文字');
                            console.log('抽出されたratItemId:', extractedRatItemId);
                            console.log('htmlLength:', jsonData.htmlLength);
                            
                            if (!html && extractedRatItemId) {
                                // 商品IDのみが取得できた場合
                                console.log('✅ 商品ID抽出成功（GAS経由）:', extractedRatItemId);
                                return extractedRatItemId;
                            }
                            
                            if (!html) {
                                console.error('❌ HTMLが取得できませんでした。レスポンス:', jsonData);
                                throw new Error('HTMLが取得できませんでした');
                            }
                        } else {
                            // JSON以外の場合はテキストとして取得
                            html = await response.text();
                            console.log('📄 GASレスポンス（テキスト）:', html.substring(0, 500));
                        }
                    } else {
                        // Vercel Functionsからのレスポンス（HTML形式）
                        html = await response.text();
                    }
                    
                    // HTMLをログに表示（デバッグ用）
                    console.log('📄 取得された商品ページのHTML:');
                    console.log('HTML長:', html.length, '文字');
                    console.log('レスポンスステータス:', response.status);
                    console.log('Content-Type:', response.headers.get('content-type'));
                    console.log('Content-Length:', response.headers.get('content-length'));
                    
                    // HTMLが短すぎる場合はエラー
                    if (html.length < 100) {
                        console.error('❌ HTMLが短すぎます。エラーページの可能性があります。');
                        console.error('HTML内容（全文）:', html);
                        console.error('HTML内容（JSON形式）:', JSON.stringify(html));
                        
                        // プロキシAPIのエラーレスポンスの可能性を確認
                        try {
                            const jsonData = JSON.parse(html);
                            console.error('❌ プロキシAPIからJSONエラーレスポンス:', jsonData);
                        } catch (e) {
                            // JSONではない場合は、そのまま表示
                        }
                        
                        if (attempt < maxRetries) {
                            console.warn('リトライします...');
                            continue;
                        }
                        return this.extractItemIdFromUrl(itemUrl);
                    }
                    
                    // HTMLの最初と最後を表示
                    console.log('HTML（最初の500文字）:', html.substring(0, 500));
                    console.log('HTML（最後の500文字）:', html.substring(Math.max(0, html.length - 500)));
                    
                    // HTML全文をログに出力（デバッグ用）
                    console.log('='.repeat(80));
                    console.log('📄 HTML全文:');
                    console.log(html);
                    console.log('='.repeat(80));
                    
                    // HTMLに特定のキーワードが含まれているか確認
                    const hasRatItemId = html.includes('ratItemId') || html.includes('rat.genericParameter');
                    const hasItemInfo = html.includes('itemInfoSku') || html.includes('shopId');
                    console.log('HTMLにratItemIdが含まれている:', hasRatItemId);
                    console.log('HTMLにitemInfoが含まれている:', hasItemInfo);
                    
                    // GASで既にratItemIdが抽出されている場合はそれを使用
                    if (extractedRatItemId) {
                        console.log('✅ 商品ID抽出成功（GAS経由）:', extractedRatItemId);
                        return extractedRatItemId;
                    }
                    
                    // HTMLからratItemIdを抽出
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
     * @param {string} itemId - 商品ID（ratItemId）
     * @param {Function} progressCallback - 進行状況を更新するコールバック関数 (progress, message)
     */
    async fetchAllReviews(itemId, progressCallback = null) {
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
                    
                    // Google Apps ScriptまたはVercel FunctionsのプロキシAPIを使用
                    let proxyUrl;
                    let useGas = false;
                    
                    if (this.gasProxyUrl) {
                        // Google Apps Scriptを使用
                        proxyUrl = `${this.gasProxyUrl}?url=${encodeURIComponent(reviewUrl)}&ratItemIdOnly=false`;
                        useGas = true;
                    } else {
                        // Vercel Functionsを使用（フォールバック）
                        proxyUrl = `/api/proxy-rakuten?url=${encodeURIComponent(reviewUrl)}`;
                    }
                    
                    if (attempt > 0) {
                        console.log(`🔄 リトライ ${attempt}/${maxRetries}: ページ${pageNum}`);
                        if (progressCallback) {
                            progressCallback(
                                30 + Math.floor((pageNum / this.maxPages) * 60),
                                `レビューページ取得リトライ中: ページ${pageNum} (${attempt}/${maxRetries})`
                            );
                        }
                        // リトライ前に少し待機
                        await this.sleep(1000 * attempt);
                    } else {
                console.log(`📄 レビューページ取得: ページ${pageNum}`);
                        if (progressCallback) {
                            progressCallback(
                                30 + Math.floor((pageNum / this.maxPages) * 60),
                                `レビューページ取得中: ページ${pageNum} (${allReviews.length}件のレビューを取得済み)`
                            );
                        }
                        if (useGas) {
                            console.log('🔧 Google Apps Scriptを使用してレビューページを取得');
                        }
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
                            // エラーレスポンスの詳細を取得
                            let errorText = '';
                            try {
                                if (useGas) {
                                    const errorJson = await response.json();
                                    errorText = JSON.stringify(errorJson);
                                } else {
                                    errorText = await response.text();
                                }
                                console.error(`❌ プロキシAPIエラー (${response.status}):`, errorText.substring(0, 500));
                            } catch (e) {
                                console.error(`❌ プロキシAPIエラー (${response.status})`);
                            }
                            
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

                        // GASの場合はJSON、Vercel Functionsの場合はHTML
                        let html;
                        if (useGas) {
                            const contentType = response.headers.get('content-type') || '';
                            if (contentType.includes('application/json')) {
                                const jsonData = await response.json();
                                if (jsonData.error) {
                                    throw new Error(`GASエラー: ${jsonData.error} - ${jsonData.message || ''}`);
                                }
                                html = jsonData.html || '';
                                if (!html) {
                                    throw new Error('HTMLが取得できませんでした');
                                }
                            } else {
                                html = await response.text();
                            }
                        } else {
                            html = await response.text();
                        }
                const pageReviews = this.parseReviewPage(html);

                if (pageReviews.length === 0) {
                    console.log(`ページ${pageNum}: レビューなし、終了`);
                    if (progressCallback) {
                        progressCallback(90, `レビュー解析完了: ${allReviews.length}件のレビューを取得`);
                    }
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
                        if (progressCallback) {
                            progressCallback(90, `3ヶ月以前のレビューを発見、取得終了 (${allReviews.length + pageReviews.length}件取得)`);
                        }
                        break;
                    }
                }

                allReviews.push(...pageReviews);
                pageNum++;
                success = true;

                // 進行状況を更新
                if (progressCallback) {
                    const progress = 30 + Math.floor((pageNum / this.maxPages) * 60);
                    progressCallback(progress, `レビュー取得中: ページ${pageNum} (合計${allReviews.length}件)`);
                }

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
                        if (progressCallback) {
                            progressCallback(
                                30 + Math.floor((pageNum / this.maxPages) * 60),
                                `ページ${pageNum}の取得エラー: ${error.message}`
                            );
                        }
                        // エラーが発生しても次のページに進む（breakしない）
                        pageNum++;
                        break; // リトライループを抜ける
                    }
                }
            }
        
        // レビュー取得完了
        if (progressCallback) {
            progressCallback(90, `レビュー取得完了: 合計${allReviews.length}件のレビューを取得`);
        }

            // リトライがすべて失敗した場合、次のページに進むか終了
            if (!success) {
                console.warn(`ページ${pageNum}の取得に失敗しました。次のページに進みます。`);
                if (progressCallback) {
                    progressCallback(
                        30 + Math.floor((pageNum / this.maxPages) * 60),
                        `ページ${pageNum}の取得に失敗、次のページに進みます`
                    );
                }
                pageNum++;
                // 連続で失敗した場合は終了
                if (pageNum > 3 && allReviews.length === 0) {
                    console.warn('複数ページで取得失敗、処理を終了します');
                    if (progressCallback) {
                        progressCallback(90, '複数ページで取得失敗、処理を終了します');
                    }
                break;
                }
            }
        }

        console.log(`✅ 合計${allReviews.length}件のレビューを取得`);
        if (progressCallback && allReviews.length > 0) {
            progressCallback(90, `レビュー取得完了: 合計${allReviews.length}件のレビューを取得`);
        }
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

