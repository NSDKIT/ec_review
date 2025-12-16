/**
 * Google Sheets API連携ファイル（修正版 - デバッグ強化）
 * 【修正内容】
 * 1. レビュー最新日の正確な処理
 * 2. Google Sheetsの日付フォーマット対応
 * 3. 月のズレをデバッグログで詳細出力
 */

class GoogleSheetsAPI {
    constructor() {
        this.API_KEY = 'AIzaSyASxrTi47GoffiuASxeAf8iCeqJqTVSXaA';
        // スプレッドシートIDをlocalStorageから取得（設定されていない場合はデフォルト値）
        this.SPREADSHEET_ID = this.getSpreadsheetId();
        this.SHEET_NAME = 'Sheet1';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分
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
            this.SPREADSHEET_ID = sheetId.trim();
            localStorage.setItem('google_spreadsheet_id', this.SPREADSHEET_ID);
            // キャッシュをクリア（新しいスプレッドシートに切り替えたため）
            this.cache.clear();
            return true;
        }
        return false;
    }

    /**
     * Google Sheets APIからデータを取得
     */
    async fetchSheetData(range = '') {
        const cacheKey = `${this.SPREADSHEET_ID}_${this.SHEET_NAME}_${range}`;
        
        // キャッシュチェック
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('キャッシュからデータを取得');
                return cached.data;
            }
        }

        try {
            const url = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${this.SHEET_NAME}`;
            
            console.log('🌐 Google Sheets APIにアクセス中:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Google Sheetsのレスポンス形式から JSON を抽出
            const jsonText = text.substring(47).slice(0, -2);
            const data = JSON.parse(jsonText);
            
            console.log('✅ Google Sheets データ取得成功');
            
            // データを配列形式に変換
            const rows = data.table.rows.map((row, rowIndex) => {
                const convertedRow = row.c ? row.c.map(cell => cell ? (cell.v || '') : '') : [];
                return convertedRow;
            });
            
            // A列を除外
            const rowsWithoutColumnA = rows.map(row => row.slice(1));
            const processedRows = this.cleanData(rowsWithoutColumnA);
            
            // キャッシュに保存
            this.cache.set(cacheKey, {
                data: processedRows,
                timestamp: Date.now()
            });
            
            console.log('✅ Google Sheetsからデータを正常に取得:', processedRows.length, '行');
            return processedRows;
            
        } catch (error) {
            console.error('❌ Google Sheetsデータ取得エラー:', error);
            return this.getSampleData();
        }
    }

    /**
     * ヘッダー行の特定とデータ処理
     */
    processData(rawData) {
        if (!rawData || rawData.length === 0) {
            return {
                headers: [],
                data: [],
                stats: {},
                rawData: []
            };
        }

        console.log('📊 生データ処理開始 - ヘッダー行の特定を試みます');

        // 指定ヘッダー（A列除外済み）
        const specifiedHeaders = [
            '検索順位', 
            '商品名', 
            '価格(送料抜)', 
            '価格(送料込)', 
            '商品URL', 
            'サムネURL', 
            'レビュー数', 
            'レビュー平均', 
            'レビュー最新日',      // ← 【重要】日付列
            '直近3ヶ月のレビュー数', 
            '直近3ヶ月のレビュー平均',
            '高評価レビュー',
            '中評価レビュー', 
            '低評価レビュー'
        ];
        
        console.log('🕵️ データ開始行の特定');
        let dataStartIndex = 0;
        
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
            const row = rawData[i];
            
            // 最初の列が数値 = データ行の可能性
            const firstColumnIsNumber = typeof row[0] === 'number' && row[0] > 0;
            const hasProductInfo = row.length > 1 && typeof row[1] === 'string' && row[1].length > 5;
            
            if (firstColumnIsNumber || hasProductInfo) {
                dataStartIndex = i;
                console.log(`✅ 行${i + 1}をデータ開始行として特定`);
                break;
            }
        }
        
        // データ行のみを抽出
        const dataRows = rawData.slice(dataStartIndex);
        
        // オブジェクト形式にデータを変換（【重要】日付処理を含む）
        const processedData = dataRows.map((row, rowIndex) => {
            const obj = {};
            specifiedHeaders.forEach((header, index) => {
                let value = row[index] || '';
                
                // 【重要】日付列は正規化処理を実施
                if (header === 'レビュー最新日') {
                    const originalValue = value;
                    value = this.normalizeDate(value);
                    
                    // 最初の3行のみ詳細ログ出力
                    if (rowIndex < 3) {
                        console.log(`  📅 行${rowIndex + 1}日付変換: "${originalValue}" → "${value}"`);
                    }
                }
                
                obj[header] = value;
            });
            return obj;
        });

        console.log('✅ 処理済みデータサンプル（最初の3行）:');
        processedData.slice(0, 3).forEach((item, i) => {
            console.log(`  行${i + 1} - レビュー最新日: "${item['レビュー最新日']}"`);
        });

        // 統計情報を計算
        const calculatedStats = this.calculateStats(processedData);
        
        const stats = {
            ...calculatedStats,
            rawDataPreview: rawData.slice(0, 10),
            headerRowIndex: dataStartIndex,
            detectedHeader: specifiedHeaders,
            actualHeaders: specifiedHeaders,
            dataStartIndex: dataStartIndex,
            specifiedHeaders: specifiedHeaders,
            trendData: null
        };
        
        return {
            headers: specifiedHeaders,
            data: processedData,
            stats,
            rawData: dataRows
        };
    }

    /**
     * 【新規追加 - デバッグ強化】日付値を正規化（Google Sheetsの各形式に対応）
     * @param {any} dateValue - 日付値
     * @returns {string} 正規化された日付文字列 (YYYY-MM-DD形式)
     */
    normalizeDate(dateValue) {
        if (!dateValue) {
            return '';
        }

        console.log(`🔍 日付正規化処理: 入力値="${dateValue}", 型=${typeof dateValue}`);

        // 【パターン1】既に正規化された文字列 "YYYY-MM-DD"
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            console.log(`  ✅ 既に正規化済み: "${dateValue}"`);
            return dateValue;
        }

        // 【パターン2】タイムスタンプ付き "YYYY-MM-DD HH:MM:SS"
        if (typeof dateValue === 'string' && dateValue.includes(' ')) {
            const datePart = dateValue.split(' ')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                console.log(`  ✅ タイムスタンプから抽出: "${datePart}"`);
                return datePart;
            }
        }

        // 【パターン3】Google Sheets Date形式 "Date(2025,10,31)" （月は0ベース）
        if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
            const matches = dateValue.match(/Date\((\d+),(\d+),(\d+)\)/);
            if (matches) {
                const year = parseInt(matches[1]);
                const monthZeroBased = parseInt(matches[2]);  // 0ベースの月（0=1月, 9=10月, 10=11月）
                const month = monthZeroBased + 1;             // 1ベースに変換（1=1月, 10=10月, 11=11月）
                const day = parseInt(matches[3]);
                
                const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // 【デバッグ】月の変換過程を詳細に出力
                console.log(`  🔍 Google Sheets Date形式を解析:`);
                console.log(`     元データ: "Date(${year},${monthZeroBased},${day})"`);
                console.log(`     月の解析: ${monthZeroBased}(0ベース) + 1 = ${month}(1ベース)`);
                console.log(`     月の名前: ${monthZeroBased === 0 ? '1月' : monthZeroBased === 9 ? '10月' : monthZeroBased === 10 ? '11月' : monthZeroBased + '月'} → ${this.getMonthName(month)}`);
                console.log(`     ✅ 変換結果: "${formatted}"`);
                
                return formatted;
            }
        }

        // 【パターン4】数値（UNIXタイムスタンプまたはExcelシリアル値）
        if (typeof dateValue === 'number') {
            try {
                if (dateValue > 30000) {
                    const date = new Date(dateValue);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const formatted = `${year}-${month}-${day}`;
                    console.log(`  ✅ タイムスタンプから変換: "${formatted}"`);
                    return formatted;
                } else {
                    const excelEpoch = new Date(1900, 0, 1);
                    const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const formatted = `${year}-${month}-${day}`;
                    console.log(`  ✅ Excelシリアル値から変換: "${formatted}"`);
                    return formatted;
                }
            } catch (error) {
                console.warn(`  ⚠️ 数値変換失敗: ${error.message}`);
            }
        }

        // 【パターン5】Dateオブジェクト
        if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}`;
            console.log(`  ✅ Dateオブジェクトから変換: "${formatted}"`);
            return formatted;
        }

        // 【パターン6】その他の文字列形式の試行
        if (typeof dateValue === 'string') {
            if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateValue)) {
                const parts = dateValue.split('/');
                const formatted = `${parts[0]}-${String(parseInt(parts[1])).padStart(2, '0')}-${String(parseInt(parts[2])).padStart(2, '0')}`;
                console.log(`  ✅ YYYY/MM/DD形式から変換: "${formatted}"`);
                return formatted;
            }
        }

        // フォーマットできない場合は元の値を返す
        console.log(`  ⚠️ 形式が認識できません。元の値を返します: "${dateValue}"`);
        return String(dateValue);
    }

    /**
     * 【ヘルパー関数】月番号を月名に変換（デバッグ用）
     */
    getMonthName(month) {
        const names = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        return names[month] || `${month}月`;
    }

    /**
     * 統計情報を計算
     */
    calculateStats(data, priceRange = 1000) {
        if (!data || data.length === 0) {
            return this.getSampleStats();
        }

        const numericColumns = this.getNumericColumns(data);
        
        const stats = {
            totalItems: data.length,
            averagePrice: 0,
            averageRating: 0,
            competitorCount: 0,
            priceDistribution: {},
            ratingDistribution: {},
            brandDistribution: {}
        };

        // 価格分析
        const priceColumn = numericColumns.priceWithShipping || numericColumns.price;
        if (priceColumn) {
            const prices = data.map(item => parseFloat(item[priceColumn])).filter(p => !isNaN(p));
            stats.averagePrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
            stats.priceDistribution = this.createPriceDistribution(prices, priceRange);
        }

        // レビュー平均分析
        if (numericColumns.rating) {
            const ratings = data.map(item => parseFloat(item[numericColumns.rating])).filter(r => !isNaN(r));
            stats.averageRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
            stats.ratingDistribution = this.createRatingDistribution(ratings);
        }

        // レビュー数分析
        if (numericColumns.reviewCount) {
            const reviewCounts = data.map(item => parseInt(item[numericColumns.reviewCount])).filter(r => !isNaN(r));
            stats.totalReviews = reviewCounts.length > 0 ? reviewCounts.reduce((a, b) => a + b, 0) : 0;
        }

        // 商品名の重複チェック
        if (numericColumns.productName) {
            const productNames = [...new Set(data.map(item => item[numericColumns.productName]).filter(n => n))];
            stats.competitorCount = productNames.length;
        }
        
        // テキストマイニング
        const productNamesForMining = data.map(item => item['商品名'] || '').filter(name => name && name.length > 0);
        if (productNamesForMining.length > 0) {
            stats.productNameKeywords = this.extractKeywordsFromProductNames(productNamesForMining);
        } else {
            stats.productNameKeywords = [];
        }

        return stats;
    }

    /**
     * 数値列を特定
     */
    getNumericColumns(data) {
        if (!data || data.length === 0) return {};

        const firstRow = data[0];
        const columns = {};
        
        console.log('🔍 数値列検出開始:', Object.keys(firstRow));

        Object.keys(firstRow).forEach(key => {
            const lowerKey = key.toLowerCase();
            
            // 価格列の検出
            if (lowerKey.includes('価格(送料込)') || lowerKey.includes('送料込')) {
                columns.priceWithShipping = key;
                columns.price = key;
            } else if (lowerKey.includes('価格(送料抜)') || lowerKey.includes('送料抜')) {
                columns.priceWithoutShipping = key;
                if (!columns.price) {
                    columns.price = key;
                }
            } else if (lowerKey.includes('price') || lowerKey.includes('価格')) {
                columns.price = key;
            }
            
            // レビュー平均
            if (lowerKey.includes('レビュー平均')) {
                columns.rating = key;
            }
            
            // レビュー数
            if (lowerKey.includes('レビュー数')) {
                columns.reviewCount = key;
            }
            
            // 直近3ヶ月レビュー平均
            if (lowerKey.includes('直近3ヶ月のレビュー平均')) {
                columns.recentRating = key;
            }
            
            // 直近3ヶ月レビュー数
            if (lowerKey.includes('直近3ヶ月のレビュー数')) {
                columns.recentReviewCount = key;
            }
            
            // 検索順位
            if (lowerKey.includes('順位') || lowerKey.includes('rank')) {
                columns.rank = key;
            }
            
            // 商品名
            if (lowerKey.includes('商品名') || lowerKey.includes('name')) {
                columns.productName = key;
            }
            
            // 【重要】日付列の検出
            if (lowerKey.includes('レビュー最新日') || lowerKey.includes('date')) {
                columns.reviewDate = key;
                console.log(`  ✅ 日付列を検出: "${key}"`);
            }
        });

        console.log('✅ 検出された列マッピング:', columns);
        return columns;
    }

    /**
     * 価格分布を作成
     */
    createPriceDistribution(prices, priceRange = 1000) {
        if (!prices || prices.length === 0) {
            return {};
        }

        const maxPrice = Math.max(...prices);
        const numRanges = Math.ceil(maxPrice / priceRange);
        
        const distribution = {};
        
        for (let i = 0; i < numRanges; i++) {
            const rangeStart = i * priceRange;
            const rangeEnd = (i + 1) * priceRange;
            const label = `¥${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()}`;
            distribution[label] = 0;
        }

        prices.forEach(price => {
            const rangeIndex = Math.floor(price / priceRange);
            
            if (rangeIndex < numRanges) {
                const rangeStart = rangeIndex * priceRange;
                const rangeEnd = (rangeIndex + 1) * priceRange;
                const label = `¥${rangeStart.toLocaleString()}-${rangeEnd.toLocaleString()}`;
                distribution[label]++;
            }
        });

        return distribution;
    }

    /**
     * 評価分布を作成
     */
    createRatingDistribution(ratings) {
        const distribution = {
            '★★★★★': 0,
            '★★★★☆': 0,
            '★★★☆☆': 0,
            '★★☆☆☆': 0,
            '★☆☆☆☆': 0
        };

        ratings.forEach(rating => {
            if (rating >= 4.5) {
                distribution['★★★★★']++;
            } else if (rating >= 3.5) {
                distribution['★★★★☆']++;
            } else if (rating >= 2.5) {
                distribution['★★★☆☆']++;
            } else if (rating >= 1.5) {
                distribution['★★☆☆☆']++;
            } else {
                distribution['★☆☆☆☆']++;
            }
        });

        return distribution;
    }

    /**
     * データ整理
     */
    cleanData(rows) {
        if (!rows || rows.length === 0) {
            return rows;
        }

        console.log('📊 A列除外済みデータの処理開始 - 総行数:', rows.length);
        return rows;
    }

    /**
     * 商品名からキーワードを抽出
     */
    extractKeywordsFromProductNames(productNames) {
        console.log('🔤 簡易テキストマイニング開始:', productNames.length, '件の商品名');
        
        const keywordCounts = {};
        
        const stopWords = new Set([
            'の', 'に', 'は', 'を', 'が', 'で', 'と', 'から', 'まで', 'より', 'など', 'こと', 'もの',
            'セット', 'タイプ', 'サイズ', '個', '本', '枚', 'kg', 'g', 'L', 'ml'
        ]);
        
        productNames.forEach(name => {
            const words = name
                .replace(/【[^】]*】/g, '')
                .replace(/[0-9]+[kg|g|L|ml|cm|mm|個|本|枚|袋]*/g, '')
                .split(/\s+/)
                .filter(word => word.length >= 2 && !stopWords.has(word));
            
            words.forEach(word => {
                keywordCounts[word] = (keywordCounts[word] || 0) + 1;
            });
        });
        
        return Object.entries(keywordCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 30)
            .map(([word, count]) => ({ text: word, size: count }));
    }

    /**
     * サンプルデータを取得
     */
    getSampleData() {
        return [
            ['検索順位', '商品名', '価格', '商品URL', 'サムネURL', 'レビュー数', 'レビュー平均', 'レビュー最新日'],
            ['1', '【ふるさと納税】◆米沢牛◆ランキング常連', '12000', 'https://item.rakuten.co.jp/...', 'https://thumbnail.image.rakuten.co.jp/...', '379', '4.4', '2024-01-15'],
            ['2', '【ふるさと納税】【みずみずしい】富良野メロン', '15000', 'https://item.rakuten.co.jp/...', 'https://thumbnail.image.rakuten.co.jp/...', '359', '4.6', '2024-01-14'],
        ];
    }

    /**
     * サンプル統計情報を取得
     */
    getSampleStats() {
        return {
            totalItems: 1247,
            averagePrice: 2850,
            averageRating: 4.2,
            competitorCount: 15,
            priceDistribution: {
                '¥0-1000': 120,
                '¥1000-2000': 280,
                '¥2000-3000': 350,
                '¥3000-4000': 240,
                '¥4000-5000': 180,
                '¥5000+': 77
            },
            ratingDistribution: {
                '★★★★★': 45,
                '★★★★☆': 30,
                '★★★☆☆': 15,
                '★★☆☆☆': 7,
                '★☆☆☆☆': 3
            }
        };
    }

    /**
     * データをリフレッシュ
     */
    async refreshData() {
        this.cache.clear();
        return await this.fetchSheetData();
    }

    /**
     * Google Sheetsにデータを書き込み（Batch Update）
     * Vercel Functions経由でGoogle Sheetsに書き込み
     * 
     * @param {Array} data - 書き込むデータ [{range: 'Sheet1!A1:B2', values: [['値1', '値2']]}]
     * @returns {Promise<boolean>} 成功/失敗
     */
    async writeData(data) {
        try {
            console.log('📝 Google Sheetsに書き込み中...', data);
            
            // Vercel FunctionsのAPIエンドポイント
            const apiUrl = '/api/sheets-write';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId: this.SPREADSHEET_ID,
                    data: data
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `書き込みエラー: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || '書き込みに失敗しました');
            }

            console.log('✅ Google Sheetsへの書き込み成功', result);
            return true;

        } catch (error) {
            console.error('❌ Google Sheets書き込みエラー:', error);
            // エラーでも続行（開発中はコンソールに出力のみ）
            console.warn('⚠️ エラー詳細:', error.message);
            return false;
        }
    }

    /**
     * 範囲をクリア
     */
    async clearRange(range) {
        try {
            const numRows = 299;
            const numCols = 14;
            const emptyValues = Array(numRows).fill(null).map(() => Array(numCols).fill(''));
            
            return await this.writeData([{
                range: range,
                values: emptyValues
            }]);
        } catch (error) {
            console.error('範囲クリアエラー:', error);
            return false;
        }
    }
}

// シングルトンインスタンス
const googleSheetsAPI = new GoogleSheetsAPI();

// グローバル関数として公開
window.GoogleSheetsAPI = GoogleSheetsAPI;
window.googleSheetsAPI = googleSheetsAPI;