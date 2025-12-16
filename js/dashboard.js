// ダッシュボード管理JavaScript

// グローバル変数
let currentUser = JSON.parse(localStorage.getItem('dashboard_user')) || null;
let projects = [];
let filteredProjects = [];

// DOM要素
const projectsLoading = document.getElementById('projects-loading');
const projectsGrid = document.getElementById('projects-grid');
const projectsEmpty = document.getElementById('projects-empty');
const projectsContainer = document.getElementById('projects-container');
const newProjectModal = document.getElementById('new-project-modal');
const projectCreationForm = document.getElementById('project-creation-form');
const searchInput = document.getElementById('search-projects');
const filterStatus = document.getElementById('filter-status');

// 統計表示要素
const totalProjectsEl = document.getElementById('total-projects');
const completedProjectsEl = document.getElementById('completed-projects');
const analyzingProjectsEl = document.getElementById('analyzing-projects');
const totalItemsEl = document.getElementById('total-items');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    // ユーザー認証チェック
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // ユーザー名表示
    document.getElementById('user-name').textContent = currentUser.name || 'ユーザー';

    // イベントリスナー設定
    setupEventListeners();

    // プロジェクトデータ読み込み
    await loadProjects();
    
    // 統計データ更新
    updateStats();
    
    // プロジェクト一覧表示
    displayProjects();
}

function setupEventListeners() {
    // 新規プロジェクトボタン
    document.getElementById('new-project-btn')?.addEventListener('click', openNewProjectModal);
    document.getElementById('empty-new-project-btn')?.addEventListener('click', openNewProjectModal);
    
    // モーダル制御
    document.getElementById('close-project-modal')?.addEventListener('click', closeNewProjectModal);
    document.getElementById('cancel-project-modal')?.addEventListener('click', closeNewProjectModal);
    
    // フォーム送信
    projectCreationForm?.addEventListener('submit', handleProjectCreation);
    
    // 検索・フィルター
    searchInput?.addEventListener('input', handleSearch);
    filterStatus?.addEventListener('change', handleFilter);
    
    // モーダル外クリックで閉じる
    newProjectModal?.addEventListener('click', function(e) {
        if (e.target === newProjectModal) {
            closeNewProjectModal();
        }
    });

    // ユーザーメニュー
    document.getElementById('user-menu-btn')?.addEventListener('click', showUserMenu);
    
    // モバイルメニュー
    document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileMenu);
}

async function loadProjects() {
    try {
        showLoading();
        
        // APIからプロジェクトデータを取得
        const response = await dashboardAPI.getProjects(currentUser.id);
        
        if (response && response.data) {
            projects = response.data;
            filteredProjects = [...projects];
        } else {
            projects = [];
            filteredProjects = [];
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('プロジェクト読み込みエラー:', error);
        hideLoading();
        showErrorMessage('プロジェクトの読み込みに失敗しました');
        
        // フォールバック: サンプルデータを使用
        projects = await loadSampleProjects();
        filteredProjects = [...projects];
    }
}

async function loadSampleProjects() {
    // サンプルプロジェクトデータ
    return [
        {
            id: 'project-sample-1',
            user_id: currentUser.id,
            name: 'iPhone ケース市場調査',
            search_keyword: 'iPhone ケース',
            marketplace: 'both',
            min_price: 500,
            max_price: 15000,
            description: '人気iPhoneケースの価格帯と競合状況を分析',
            status: 'completed',
            created_at: '2024-01-15T09:00:00Z',
            last_analyzed_at: '2024-01-15T10:00:00Z',
            stats: {
                totalItems: 1250,
                avgPrice: 2850,
                minPrice: 480,
                maxPrice: 12800,
                avgRating: 4.2
            }
        },
        {
            id: 'project-sample-2',
            user_id: currentUser.id,
            name: 'ワイヤレスイヤホン価格調査',
            search_keyword: 'ワイヤレスイヤホン',
            marketplace: 'rakuten',
            min_price: 1000,
            max_price: 50000,
            description: '楽天市場でのワイヤレスイヤホンの価格動向',
            status: 'analyzing',
            created_at: '2024-01-18T14:00:00Z',
            last_analyzed_at: '2024-01-18T15:00:00Z',
            stats: {
                totalItems: 892,
                avgPrice: 8500,
                minPrice: 1200,
                maxPrice: 35000,
                avgRating: 4.1
            }
        },
        {
            id: 'project-sample-3',
            user_id: currentUser.id,
            name: 'スマートウォッチ競合分析',
            search_keyword: 'スマートウォッチ',
            marketplace: 'yahoo',
            description: 'Yahoo!ショッピングでのスマートウォッチ市場分析',
            status: 'created',
            created_at: '2024-01-20T11:00:00Z',
            stats: {
                totalItems: 0,
                avgPrice: 0,
                minPrice: 0,
                maxPrice: 0,
                avgRating: 0
            }
        }
    ];
}

function updateStats() {
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const analyzingProjects = projects.filter(p => p.status === 'analyzing').length;
    const totalItems = projects.reduce((sum, p) => sum + (p.stats?.totalItems || 0), 0);

    totalProjectsEl.textContent = totalProjects;
    completedProjectsEl.textContent = completedProjects;
    analyzingProjectsEl.textContent = analyzingProjects;
    totalItemsEl.textContent = totalItems.toLocaleString();
}

function displayProjects() {
    if (filteredProjects.length === 0) {
        showEmptyState();
        return;
    }

    showProjectsGrid();
    
    projectsContainer.innerHTML = '';
    
    filteredProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        projectsContainer.appendChild(projectCard);
    });
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer';
    
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
    
    const marketplaceTexts = {
        'rakuten': '楽天市場',
        'yahoo': 'Yahoo!ショッピング',
        'both': '楽天 + Yahoo!'
    };
    
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="text-lg font-semibold text-gray-900 mb-1">${escapeHtml(project.name)}</h3>
                <p class="text-sm text-gray-600">${escapeHtml(project.search_keyword)}</p>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || statusColors.created}">
                ${statusTexts[project.status] || '不明'}
            </span>
        </div>
        
        <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">マーケットプレイス</span>
                <span class="font-medium">${marketplaceTexts[project.marketplace] || project.marketplace}</span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">商品数</span>
                <span class="font-medium">${(project.stats?.totalItems || 0).toLocaleString()}件</span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">平均価格</span>
                <span class="font-medium">${formatPrice(project.stats?.avgPrice || 0)}</span>
            </div>
            <div class="flex justify-between text-sm">
                <span class="text-gray-600">平均評価</span>
                <span class="font-medium">${(project.stats?.avgRating || 0).toFixed(1)} ⭐</span>
            </div>
        </div>
        
        <div class="flex justify-between items-center pt-4 border-t">
            <span class="text-xs text-gray-500">
                作成: ${formatDate(project.created_at)}
            </span>
            <div class="flex space-x-2">
                <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" onclick="viewProject('${project.id}')">
                    <i class="fas fa-eye mr-1"></i>詳細
                </button>
                <button class="text-green-600 hover:text-green-800 text-sm font-medium" onclick="analyzeProject('${project.id}')">
                    <i class="fas fa-play mr-1"></i>分析
                </button>
                <button class="text-red-600 hover:text-red-800 text-sm font-medium" onclick="deleteProject('${project.id}')">
                    <i class="fas fa-trash mr-1"></i>削除
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// プロジェクト操作関数
async function viewProject(projectId) {
    // プロジェクト詳細ページに遷移
    window.location.href = `project.html?id=${projectId}`;
}

async function analyzeProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    try {
        // 分析開始の通知
        showSuccessMessage('分析を開始しました');
        
        // プロジェクトステータスを更新
        project.status = 'analyzing';
        
        // APIから商品データを取得（シミュレーション）
        const items = await dashboardAPI.simulateMarketplaceAPI(
            project.search_keyword,
            project.marketplace,
            100
        );
        
        // メトリクスを計算
        const metrics = dashboardAPI.calculateMetrics(items);
        project.stats = metrics;
        
        // データベースに保存（シミュレーション）
        await dashboardAPI.updateProject(projectId, {
            ...project,
            status: 'completed',
            last_analyzed_at: new Date().toISOString()
        });
        
        // 表示を更新
        updateStats();
        displayProjects();
        
        showSuccessMessage('分析が完了しました');
        
    } catch (error) {
        console.error('分析エラー:', error);
        showErrorMessage('分析に失敗しました');
        
        // エラー状態に更新
        project.status = 'error';
        displayProjects();
    }
}

async function deleteProject(projectId) {
    if (!confirm('このプロジェクトを削除してもよろしいですか？')) {
        return;
    }
    
    try {
        await dashboardAPI.deleteProject(projectId);
        
        // ローカルデータからも削除
        projects = projects.filter(p => p.id !== projectId);
        filteredProjects = filteredProjects.filter(p => p.id !== projectId);
        
        updateStats();
        displayProjects();
        
        showSuccessMessage('プロジェクトを削除しました');
        
    } catch (error) {
        console.error('削除エラー:', error);
        showErrorMessage('プロジェクトの削除に失敗しました');
    }
}

// モーダル制御
function openNewProjectModal() {
    newProjectModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeNewProjectModal() {
    newProjectModal?.classList.add('hidden');
    document.body.style.overflow = '';
    projectCreationForm?.reset();
}

// プロジェクト作成
async function handleProjectCreation(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectData = {
        user_id: currentUser.id,
        name: formData.get('name'),
        search_keyword: formData.get('search_keyword'),
        marketplace: formData.get('marketplace'),
        min_price: formData.get('min_price') ? parseFloat(formData.get('min_price')) : null,
        max_price: formData.get('max_price') ? parseFloat(formData.get('max_price')) : null,
        description: formData.get('description') || ''
    };
    
    const submitBtn = document.getElementById('create-project-submit');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>作成中...';
        submitBtn.disabled = true;
        
        const newProject = await dashboardAPI.createProject(projectData);
        
        // ローカルデータに追加
        projects.unshift(newProject);
        filteredProjects = [...projects];
        
        updateStats();
        displayProjects();
        closeNewProjectModal();
        
        showSuccessMessage('プロジェクトを作成しました');
        
    } catch (error) {
        console.error('プロジェクト作成エラー:', error);
        showErrorMessage('プロジェクトの作成に失敗しました');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// 検索・フィルター
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    applyFilters(searchTerm, filterStatus.value);
}

function handleFilter(e) {
    const statusFilter = e.target.value;
    applyFilters(searchInput.value.toLowerCase(), statusFilter);
}

function applyFilters(searchTerm, statusFilter) {
    filteredProjects = projects.filter(project => {
        const matchesSearch = !searchTerm || 
            project.name.toLowerCase().includes(searchTerm) ||
            project.search_keyword.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || project.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    displayProjects();
}

// 表示状態管理
function showLoading() {
    projectsLoading?.classList.remove('hidden');
    projectsGrid?.classList.add('hidden');
    projectsEmpty?.classList.add('hidden');
}

function hideLoading() {
    projectsLoading?.classList.add('hidden');
}

function showProjectsGrid() {
    projectsGrid?.classList.remove('hidden');
    projectsEmpty?.classList.add('hidden');
}

function showEmptyState() {
    projectsGrid?.classList.add('hidden');
    projectsEmpty?.classList.remove('hidden');
}

// ユーティリティ関数
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
    // 簡単なログアウト機能
    if (confirm('ログアウトしますか？')) {
        localStorage.removeItem('dashboard_user');
        window.location.href = 'index.html';
    }
}

// モバイルメニュー
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu?.classList.toggle('hidden');
}