// プロジェクト詳細ページ JavaScript

// グローバル変数
let currentProject = null;
let currentUser = JSON.parse(localStorage.getItem('dashboard_user')) || null;
let projectItems = [];
let charts = {};

// DOM要素
const loadingState = document.getElementById('loading-state');
const projectContent = document.getElementById('project-content');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeProjectPage();
});

async function initializeProjectPage() {
    // ユーザー認証チェック
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // ユーザー名表示
    document.getElementById('user-name').textContent = currentUser.name || 'ユーザー';

    // URL パラメータからプロジェクトIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        showErrorMessage('プロジェクトIDが指定されていません');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
        return;
    }

    // イベントリスナー設定
    setupEventListeners();

    // プロジェクトデータ読み込み
    await loadProjectData(projectId);
}

function setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // 分析実行ボタン
    document.getElementById('analyze-btn')?.addEventListener('click', executeAnalysis);
    
    // レポート出力ボタン
    document.getElementById('export-btn')?.addEventListener('click', exportReport);

    // ユーザーメニュー
    document.getElementById('user-menu-btn')?.addEventListener('click', showUserMenu);
}

async function loadProjectData(projectId) {
    try {
        showLoading();

        // プロジェクトデータを取得
        currentProject = await getProjectById(projectId);
        
        if (!currentProject) {
            throw new Error('プロジェクトが見つかりません');
        }

        // プロジェクト情報を表示
        displayProjectInfo();

        // 商品データを取得
        await loadProjectItems();

        // チャートとKPIを更新
        updateKPIs();
        await initializeCharts();

        // AI分析結果を読み込み
        await loadAIInsights();

        hideLoading();

    } catch (error) {
        console.error('プロジェクト読み込みエラー:', error);
        showErrorMessage('プロジェクトの読み込みに失敗しました: ' + error.message);
        hideLoading();
    }
}

async function getProjectById(projectId) {
    try {
        return await dashboardAPI.getProject(projectId);
    } catch (error) {
        // フォールバック: サンプルプロジェクト
        return getSampleProject(projectId);
    }
}

function getSampleProject(projectId) {
    const sampleProjects = {
        'project-sample-1': {
            id: 'project-sample-1',
            name: 'iPhone ケース市場調査',
            search_keyword: 'iPhone ケース',
            marketplace: 'both',
            min_price: 500,
            max_price: 15000,
            description: '人気iPhoneケースの価格帯と競合状況を分析',
            status: 'completed',
            created_at: '2024-01-15T09:00:00Z',
            last_analyzed_at: '2024-01-15T10:00:00Z'
        },
        'project-sample-2': {
            id: 'project-sample-2',
            name: 'ワイヤレスイヤホン価格調査',
            search_keyword: 'ワイヤレスイヤホン',
            marketplace: 'rakuten',
            min_price: 1000,
            max_price: 50000,
            description: '楽天市場でのワイヤレスイヤホンの価格動向',
            status: 'analyzing',
            created_at: '2024-01-18T14:00:00Z',
            last_analyzed_at: '2024-01-18T15:00:00Z'
        }
    };

    return sampleProjects[projectId] || null;
}

function displayProjectInfo() {
    if (!currentProject) return;

    // プロジェクト基本情報
    document.getElementById('project-title').textContent = currentProject.name;
    document.getElementById('project-description').textContent = currentProject.description || '説明なし';
    document.getElementById('project-keyword').textContent = currentProject.search_keyword;
    document.getElementById('project-date').textContent = formatDate(currentProject.created_at);

    // マーケットプレイス表示
    const marketplaceTexts = {
        'rakuten': '楽天市場',
        'yahoo': 'Yahoo!ショッピング',
        'both': '楽天 + Yahoo!'
    };
    document.getElementById('project-marketplace').textContent = marketplaceTexts[currentProject.marketplace] || currentProject.marketplace;

    // ステータス表示
    const statusEl = document.getElementById('project-status');
    const statusColors = {
        'created': 'bg-gray-100 text-gray-800',
        'analyzing': 'bg-yellow-100 text-yellow-800',
        'completed': 'bg-green-100 text-green-800',
        'error': 'bg-red-100 text-red-800'
    };
    const statusTexts = {
        'created': '作成済み',
        'analyzing': '分析中',
        'completed': '完了',
        'error': 'エラー'
    };

    statusEl.className = `ml-3 px-3 py-1 rounded-full text-sm font-medium ${statusColors[currentProject.status] || statusColors.created}`;
    statusEl.textContent = statusTexts[currentProject.status] || '不明';
}

async function loadProjectItems() {
    try {
        // 実際のAPIまたはサンプルデータから商品データを取得
        projectItems = await generateSampleItems();
        
    } catch (error) {
        console.error('商品データ読み込みエラー:', error);
        projectItems = [];
    }
}

async function generateSampleItems() {
    // 現在のプロジェクトに基づいてサンプルアイテムを生成
    return dashboardAPI.generateMockItems(
        currentProject.search_keyword,
        currentProject.marketplace,
        50 // サンプルアイテム数
    );
}

function updateKPIs() {
    const metrics = dashboardAPI.calculateMetrics(projectItems);

    document.getElementById('kpi-total-items').textContent = metrics.totalItems.toLocaleString();
    document.getElementById('kpi-avg-price').textContent = formatPrice(metrics.avgPrice);
    document.getElementById('kpi-avg-rating').textContent = metrics.avgRating.toFixed(1);
    document.getElementById('kpi-review-count').textContent = metrics.totalReviews.toLocaleString();

    // 価格統計の更新
    document.getElementById('stat-min-price').textContent = formatPrice(metrics.minPrice);
    document.getElementById('stat-max-price').textContent = formatPrice(metrics.maxPrice);
    document.getElementById('stat-median-price').textContent = formatPrice(metrics.medianPrice);
    document.getElementById('stat-price-range').textContent = formatPrice(metrics.maxPrice - metrics.minPrice);
}

async function initializeCharts() {
    // 価格分布チャート
    await createPriceDistributionChart();
    
    // 価格レンジチャート
    await createPriceRangeChart();
    
    // 評価分布チャート
    await createRatingDistributionChart();
    
    // 感情分析チャート
    await createSentimentChart();

    // 競合データテーブル
    await loadCompetitorTable();

    // キーワード表示
    await displayKeywords();
}

async function createPriceDistributionChart() {
    const ctx = document.getElementById('priceDistributionChart');
    if (!ctx) return;

    const prices = projectItems.map(item => item.price).filter(price => price > 0);
    
    // 価格をソートしてヒストグラム用のデータを作成
    prices.sort((a, b) => a - b);
    
    const binCount = 10;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const binSize = (maxPrice - minPrice) / binCount;
    
    const bins = Array(binCount).fill(0);
    const labels = [];
    
    for (let i = 0; i < binCount; i++) {
        const start = minPrice + i * binSize;
        const end = start + binSize;
        labels.push(`¥${Math.round(start).toLocaleString()}`);
        
        bins[i] = prices.filter(price => price >= start && price < end).length;
    }

    charts.priceDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '商品数',
                data: bins,
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '価格分布ヒストグラム'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '商品数'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '価格帯'
                    }
                }
            }
        }
    });
}

async function createPriceRangeChart() {
    const ctx = document.getElementById('priceRangeChart');
    if (!ctx) return;

    const distribution = dashboardAPI.generatePriceDistribution(projectItems);
    
    charts.priceRange = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                data: Object.values(distribution),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '価格帯別商品数'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

async function createRatingDistributionChart() {
    const ctx = document.getElementById('ratingDistributionChart');
    if (!ctx) return;

    const ratings = projectItems.map(item => Math.floor(item.rating || 0));
    const ratingCounts = [1, 2, 3, 4, 5].map(star => 
        ratings.filter(rating => rating === star).length
    );

    charts.ratingDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1★', '2★', '3★', '4★', '5★'],
            datasets: [{
                label: '商品数',
                data: ratingCounts,
                backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '評価分布'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function createSentimentChart() {
    const ctx = document.getElementById('sentimentChart');
    if (!ctx) return;

    // サンプル感情分析データ
    const sentimentData = {
        'ポジティブ': Math.floor(projectItems.length * 0.65),
        'ニュートラル': Math.floor(projectItems.length * 0.25),
        'ネガティブ': Math.floor(projectItems.length * 0.10)
    };

    charts.sentiment = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(sentimentData),
            datasets: [{
                data: Object.values(sentimentData),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(156, 163, 175, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'レビュー感情分析'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

async function loadCompetitorTable() {
    const tbody = document.getElementById('competitor-table-body');
    if (!tbody) return;

    // 上位10商品を表示
    const topItems = projectItems.slice(0, 10);
    
    tbody.innerHTML = '';
    
    topItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${index + 1}</td>
            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title="${escapeHtml(item.name)}">
                ${escapeHtml(item.name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                ${formatPrice(item.price)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="flex items-center">
                    <span class="mr-1">${item.rating?.toFixed(1) || '0.0'}</span>
                    <span class="text-yellow-400">★</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${(item.review_count || 0).toLocaleString()}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title="${escapeHtml(item.shop_name)}">
                ${escapeHtml(item.shop_name)}
            </td>
        `;
    });
}

async function displayKeywords() {
    const container = document.getElementById('keywords-container');
    if (!container) return;

    // サンプルキーワード
    const keywords = [
        '耐衝撃', 'クリア', 'おしゃれ', '防水', 'スタンド',
        '手帳型', '薄型', '軽量', 'ワイヤレス充電', '高品質'
    ];
    
    container.innerHTML = '';
    
    keywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full';
        tag.textContent = keyword;
        container.appendChild(tag);
    });
}

async function loadAIInsights() {
    try {
        // サンプルAI分析結果
        const insights = await getSampleInsights();
        
        document.getElementById('ai-summary').textContent = insights.summary;
        
        // 推奨アクション
        const recommendationsList = document.getElementById('ai-recommendations');
        recommendationsList.innerHTML = '';
        insights.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-check mr-2"></i>${rec}`;
            recommendationsList.appendChild(li);
        });
        
        // 重要な発見
        const findingsList = document.getElementById('ai-key-findings');
        findingsList.innerHTML = '';
        insights.key_findings.forEach(finding => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-lightbulb mr-2"></i>${finding}`;
            findingsList.appendChild(li);
        });
        
    } catch (error) {
        console.error('AI分析結果読み込みエラー:', error);
    }
}

async function getSampleInsights() {
    const insights = {
        'iPhone ケース': {
            summary: 'iPhone ケース市場では、3,000円前後の価格帯が最も競争が激しく、耐衝撃性とデザイン性が重視されています。レビュー分析では、特に「落下耐性」と「カメラ保護」が重要な評価要因となっています。',
            recommendations: [
                '価格レンジを2,800-3,500円に設定',
                '「カメラ保護機能」を強調した商品説明',
                '「耐衝撃テスト済み」認証の表示',
                '明るくてクリアな商品画像の使用'
            ],
            key_findings: [
                '価格帯2,000-5,000円が全体の70%を占める',
                'レビュー数100件以上の商品が上位ランク入り',
                '中国製低価格品も評価が高い場合がある'
            ]
        },
        'ワイヤレスイヤホン': {
            summary: 'ワイヤレスイヤホン市場は高級品が主流で、30,000円以上の商品が上位を占めています。音質とノイズキャンセリング機能が購入決定の主要因子で、ブランド力が強く影響しています。',
            recommendations: [
                'プレミアム価格帯（25,000-35,000円）での展開',
                '音質測定データの公開',
                'アフターサービスの充実',
                'インフルエンサーとのコラボレーション'
            ],
            key_findings: [
                'ブランド品（Apple, Sony）が市場の60%を占める',
                'ノイズキャンセリング機能は必須機能',
                'バッテリー持続時間6時間以上が求められる'
            ]
        }
    };
    
    return insights[currentProject.search_keyword] || insights['iPhone ケース'];
}

// タブ切り替え機能
function switchTab(tabName) {
    // 全タブを非アクティブにする
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        btn.classList.add('border-transparent');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 選択されたタブをアクティブにする
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);
    
    if (activeButton && activeContent) {
        activeButton.classList.add('active', 'bg-blue-600', 'text-white', 'border-blue-600');
        activeButton.classList.remove('border-transparent');
        activeContent.classList.add('active');
    }
}

// 分析実行
async function executeAnalysis() {
    if (!currentProject) return;
    
    try {
        const analyzeBtn = document.getElementById('analyze-btn');
        const originalText = analyzeBtn.innerHTML;
        
        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>分析中...';
        analyzeBtn.disabled = true;
        
        // 商品データを再取得
        projectItems = await dashboardAPI.simulateMarketplaceAPI(
            currentProject.search_keyword,
            currentProject.marketplace,
            100
        );
        
        // KPIとチャートを更新
        updateKPIs();
        
        // チャートを再描画
        Object.values(charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        
        await initializeCharts();
        
        showSuccessMessage('分析が完了しました');
        
        analyzeBtn.innerHTML = originalText;
        analyzeBtn.disabled = false;
        
    } catch (error) {
        console.error('分析実行エラー:', error);
        showErrorMessage('分析の実行に失敗しました');
    }
}

// レポート出力
async function exportReport() {
    try {
        showSuccessMessage('レポートを準備中...');
        
        // 簡単なレポートHTMLを生成
        const reportContent = generateReportHTML();
        
        // Blobとして生成してダウンロード
        const blob = new Blob([reportContent], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentProject.name}_分析レポート_${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccessMessage('レポートをダウンロードしました');
        
    } catch (error) {
        console.error('レポート出力エラー:', error);
        showErrorMessage('レポートの出力に失敗しました');
    }
}

function generateReportHTML() {
    const metrics = dashboardAPI.calculateMetrics(projectItems);
    
    return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${currentProject.name} - 分析レポート</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
            .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .metric-label { font-size: 14px; color: #666; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${currentProject.name}</h1>
            <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
            <p>キーワード: ${currentProject.search_keyword}</p>
        </div>
        
        <h2>分析結果サマリー</h2>
        <div class="metric">
            <div class="metric-value">${metrics.totalItems}</div>
            <div class="metric-label">総商品数</div>
        </div>
        <div class="metric">
            <div class="metric-value">${formatPrice(metrics.avgPrice)}</div>
            <div class="metric-label">平均価格</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.avgRating.toFixed(1)}</div>
            <div class="metric-label">平均評価</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.totalReviews.toLocaleString()}</div>
            <div class="metric-label">総レビュー数</div>
        </div>
    </body>
    </html>
    `;
}

// 表示制御
function showLoading() {
    loadingState?.classList.remove('hidden');
    projectContent?.classList.add('hidden');
}

function hideLoading() {
    loadingState?.classList.add('hidden');
    projectContent?.classList.remove('hidden');
}

// ユーティリティ関数
function formatPrice(price) {
    if (!price) return '¥0';
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY'
    }).format(price);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 通知表示
function showSuccessMessage(message) {
    showNotification(message, 'success');
}

function showErrorMessage(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    switch(type) {
        case 'success':
            notification.classList.add('bg-green-600', 'text-white');
            break;
        case 'error':
            notification.classList.add('bg-red-600', 'text-white');
            break;
        default:
            notification.classList.add('bg-blue-600', 'text-white');
    }
    
    notification.innerHTML = `
        <div class="flex items-center">
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ユーザーメニュー
function showUserMenu() {
    if (confirm('ログアウトしますか？')) {
        localStorage.removeItem('dashboard_user');
        window.location.href = 'index.html';
    }
}