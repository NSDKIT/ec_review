/**
 * 楽天商品調査ワークフロー
 * ec_rakuten.yml のワークフロー全体を実装
 */

class RakutenWorkflow {
    constructor() {
        // スプレッドシートIDをlocalStorageから取得（設定されていない場合はデフォルト値）
        this.sheetId = this.getSpreadsheetId();
        this.maxItems = 30; // デフォルト最大取得数
    }

    /**
     * スプレッドシートIDを取得（localStorageから、またはデフォルト値）
     */
    getSpreadsheetId() {
        const savedId = localStorage.getItem('google_spreadsheet_id');
        return savedId || '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY';
    }

    /**
     * スプレッドシートIDを設定
     */
    setSpreadsheetId(sheetId) {
        if (sheetId && sheetId.trim()) {
            this.sheetId = sheetId.trim();
            localStorage.setItem('google_spreadsheet_id', this.sheetId);
            // Google Sheets APIのインスタンスも更新
            if (window.googleSheetsAPI) {
                googleSheetsAPI.SPREADSHEET_ID = this.sheetId;
            }
            return true;
        }
        return false;
    }

    /**
     * メインワークフロー実行
     * @param {Object} params - 検索パラメータ
     * @returns {Promise<Object>} 実行結果
     */
    async execute(params) {
        const {
            keyword,
            minPrice = 0,
            maxPrice = null,
            NGKeyword = '',
            hits = 30,
            rakuten_appid = null,
            spreadsheetId = null
        } = params;

        // スプレッドシートIDを取得（パラメータで指定された場合はそれを使用）
        if (spreadsheetId) {
            this.setSpreadsheetId(spreadsheetId);
        } else {
            // 最新の設定を取得
            this.sheetId = this.getSpreadsheetId();
        }

        try {
            console.log('🚀 楽天商品調査ワークフロー開始:', { 
                keyword, 
                minPrice, 
                maxPrice, 
                NGKeyword,
                spreadsheetId: this.sheetId
            });

            // 1. Google Sheetsをクリア
            await this.clearSheet();

            // 2. 楽天APIで商品検索
            if (rakuten_appid) {
                rakutenAPI.setAppId(rakuten_appid);
            }

            const searchResult = await rakutenAPI.searchItems({
                keyword,
                minPrice,
                maxPrice,
                NGKeyword,
                hits
            });

            if (searchResult.products.length === 0) {
                return {
                    success: false,
                    message: '商品が見つかりませんでした。',
                    sheetUrl: this.getSheetUrl()
                };
            }

            // 3. 各商品の詳細情報を取得してGoogle Sheetsに書き込み
            await this.processAndWriteProducts(searchResult.products);

            // 4. レビュー分析を実行（オプション）
            const reviewResults = await this.analyzeReviews(searchResult.products);

            return {
                success: true,
                message: `${searchResult.products.length}件の商品データを取得しました。`,
                totalProducts: searchResult.products.length,
                sheetUrl: this.getSheetUrl(),
                reviewResults: reviewResults
            };

        } catch (error) {
            console.error('❌ ワークフローエラー:', error);
            return {
                success: false,
                message: `エラー: ${error.message}`,
                sheetUrl: this.getSheetUrl()
            };
        }
    }

    /**
     * Google Sheetsをクリア
     */
    async clearSheet() {
        try {
            console.log('📝 Google Sheetsをクリア中...');
            const result = await googleSheetsAPI.clearRange('Sheet1!B2:O300');
            return result;
        } catch (error) {
            console.error('シートクリアエラー:', error);
            // エラーでも続行
            return false;
        }
    }

    /**
     * 商品データを処理してGoogle Sheetsに書き込み
     */
    async processAndWriteProducts(products) {
        console.log(`📊 ${products.length}件の商品を処理中...`);

        // ヘッダーを書き込み
        await this.writeHeader();

        // 各商品を処理
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            
            try {
                // 送料込み価格を取得（必要に応じて）
                let priceWithShipping = product.item_price;
                if (product.postage_flag === '送料別') {
                    const detail = await rakutenAPI.getItemDetail(product.item_code);
                    if (detail) {
                        priceWithShipping = detail.item_price;
                    }
                }

                // 行データを作成
                const rowData = [
                    i + 1, // 検索順位
                    product.item_name, // 商品名
                    product.item_price, // 価格(送料抜)
                    priceWithShipping, // 価格(送料込)
                    product.item_url, // 商品URL
                    product.medium_image_urls[0] || '', // サムネURL
                    product.review_count, // レビュー数
                    product.review_average, // レビュー平均
                    '', // レビュー最新日（後で更新）
                    '', // 直近3ヶ月のレビュー数（後で更新）
                    '', // 直近3ヶ月のレビュー平均（後で更新）
                    '', // 高評価レビュー（後で更新）
                    '', // 中評価レビュー（後で更新）
                    ''  // 低評価レビュー（後で更新）
                ];

                // Google Sheetsに書き込み
                await this.writeRow(i + 2, rowData);

                // 進捗を表示
                if ((i + 1) % 10 === 0) {
                    console.log(`  ✅ ${i + 1}/${products.length}件処理完了`);
                }

            } catch (error) {
                console.error(`商品${i + 1}の処理エラー:`, error);
                // エラーでも続行
            }
        }

        console.log('✅ 全商品の書き込み完了');
    }

    /**
     * ヘッダーを書き込み
     */
    async writeHeader() {
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

        const data = [{
            range: 'Sheet1!B1:O1',
            values: [headers]
        }];

        console.log('📝 ヘッダーを書き込み中...');
        return await googleSheetsAPI.writeData(data);
    }

    /**
     * 行を書き込み
     */
    async writeRow(rowIndex, rowData) {
        const range = `Sheet1!B${rowIndex}:O${rowIndex}`;
        const data = [{
            range: range,
            values: [rowData]
        }];

        return await googleSheetsAPI.writeData(data);
    }

    /**
     * レビュー分析を実行
     */
    async analyzeReviews(products) {
        console.log('📝 レビュー分析を開始...');
        const results = [];

        // 最大30件まで分析（パフォーマンス考慮）
        const maxReviewAnalysis = Math.min(products.length, 30);

        for (let i = 0; i < maxReviewAnalysis; i++) {
            const product = products[i];
            
            try {
                console.log(`  📊 商品${i + 1}/${maxReviewAnalysis}: ${product.item_name.substring(0, 30)}...`);

                // item_codeを直接使用（HTMLから抽出する必要がない）
                const reviewData = await rakutenReviewAnalyzer.analyzeReviews(product.item_url, product.item_code);

                // Google Sheetsにレビューデータを書き込み
                await this.writeReviewData(i + 2, reviewData);

                results.push({
                    productName: product.item_name,
                    reviewData: reviewData
                });

                // 進捗表示
                if ((i + 1) % 5 === 0) {
                    console.log(`  ✅ ${i + 1}/${maxReviewAnalysis}件のレビュー分析完了`);
                }

                // レート制限を考慮して少し待機
                await this.sleep(1000);

            } catch (error) {
                console.error(`商品${i + 1}のレビュー分析エラー:`, error);
                // エラーでも続行
            }
        }

        console.log('✅ レビュー分析完了');
        return results;
    }

    /**
     * レビューデータをGoogle Sheetsに書き込み
     */
    async writeReviewData(rowIndex, reviewData) {
        const range = `Sheet1!J${rowIndex}:O${rowIndex}`;
        const data = [{
            range: range,
            values: [[
                reviewData.latest_review_date,
                reviewData.review_count_3months,
                reviewData.average_rating_3months,
                reviewData.high_rating_reviews,
                reviewData.mid_rating_reviews,
                reviewData.low_rating_reviews
            ]]
        }];

        return await googleSheetsAPI.writeData(data);
    }

    /**
     * Google SheetsのURLを取得
     */
    getSheetUrl() {
        return `https://docs.google.com/spreadsheets/d/${this.sheetId}`;
    }

    /**
     * スリープ（待機）
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// シングルトンインスタンス
const rakutenWorkflow = new RakutenWorkflow();

// グローバルに公開
window.RakutenWorkflow = RakutenWorkflow;
window.rakutenWorkflow = rakutenWorkflow;

