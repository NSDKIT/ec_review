// 商品調査・分析ダッシュボード - メインJavaScript

// グローバル変数
let currentUser = null;
let currentProjects = [];
let isAuthenticated = false;

// DOM要素の取得
const loginModal = document.getElementById('login-modal');
const loginBtn = document.getElementById('login-btn');
const mobileLoginBtn = document.getElementById('mobile-login-btn');
const closeModalBtn = document.getElementById('close-modal');
const loginForm = document.getElementById('login-form');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const dashboardContent = document.getElementById('dashboard-content');
const projectForm = document.getElementById('project-form');
const createProjectBtn = document.getElementById('create-project-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard');
const newProjectForm = document.getElementById('new-project-form');
const cancelProjectBtn = document.getElementById('cancel-project');
const signupToggleBtn = document.getElementById('signup-toggle');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadSampleData();
    checkAuthentication();
});

// アプリケーション初期化
function initializeApp() {
    // イベントリスナーの設定
    setupEventListeners();
    
    // レスポンシブ対応の確認
    handleResponsiveLayout();
    
    // 画面サイズ変更時の対応
    window.addEventListener('resize', handleResponsiveLayout);
}

// イベントリスナーの設定
function setupEventListeners() {
    // ログインモーダル関連
    loginBtn?.addEventListener('click', openLoginModal);
    mobileLoginBtn?.addEventListener('click', openLoginModal);
    closeModalBtn?.addEventListener('click', closeLoginModal);
    loginModal?.addEventListener('click', function(e) {
        if (e.target === loginModal) {
            closeLoginModal();
        }
    });

    // モバイルメニュー
    mobileMenuBtn?.addEventListener('click', toggleMobileMenu);
    
    // プロジェクト作成関連
    createProjectBtn?.addEventListener('click', showProjectForm);
    backToDashboardBtn?.addEventListener('click', showDashboard);
    cancelProjectBtn?.addEventListener('click', showDashboard);
    
    // フォーム送信
    loginForm?.addEventListener('submit', handleLogin);
    newProjectForm?.addEventListener('submit', handleProjectCreation);
    
    // サインアップ切り替え
    signupToggleBtn?.addEventListener('click', toggleSignupMode);
    
    // ナビゲーションリンク
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// レスポンシブレイアウト処理
function handleResponsiveLayout() {
    const isMobile = window.innerWidth < 768;
    
    // モバイル時の調整
    if (isMobile) {
        // モバイル用の調整があれば追加
    }
}

// ログインモーダル開閉
function openLoginModal() {
    loginModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    loginModal?.classList.add('hidden');
    document.body.style.overflow = '';
}

// モバイルメニュー切り替え
function toggleMobileMenu() {
    mobileMenu?.classList.toggle('hidden');
}

// ログイン処理
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    // ローディング状態の表示
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '処理中...';
    submitBtn.disabled = true;
    
    try {
        // 実際のSupabase認証はここで実装
        // 現在はサンプルとして成功させる
        await simulateLogin(email, password);
        
        closeLoginModal();
        showSuccessMessage('ログインしました');
        updateAuthenticationState(true);
        
    } catch (error) {
        showErrorMessage('ログインに失敗しました: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// サインアップモード切り替え
function toggleSignupMode() {
    const isSignupMode = signupToggleBtn.textContent === 'ログインに戻る';
    
    if (isSignupMode) {
        // ログインモードに戻る
        signupToggleBtn.textContent = '新規登録';
        loginForm.querySelector('button[type="submit"]').textContent = 'ログイン';
        loginModal.querySelector('h3').textContent = 'ログイン';
    } else {
        // サインアップモードに切り替え
        signupToggleBtn.textContent = 'ログインに戻る';
        loginForm.querySelector('button[type="submit"]').textContent = '新規登録';
        loginModal.querySelector('h3').textContent = '新規登録';
    }
}

// 認証状態の更新
function updateAuthenticationState(authenticated) {
    isAuthenticated = authenticated;
    
    if (authenticated) {
        loginBtn.textContent = 'ログアウト';
        mobileLoginBtn.textContent = 'ログアウト';
        
        // ログアウトイベントに変更
        loginBtn.removeEventListener('click', openLoginModal);
        loginBtn.addEventListener('click', handleLogout);
        mobileLoginBtn.removeEventListener('click', openLoginModal);
        mobileLoginBtn.addEventListener('click', handleLogout);
        
        // プロジェクト作成ボタンの有効化
        createProjectBtn?.classList.remove('opacity-50', 'cursor-not-allowed');
        createProjectBtn?.removeAttribute('disabled');
        
        // ダッシュボードリンクを表示
        const dashboardLink = document.getElementById('dashboard-link');
        if (dashboardLink) {
            dashboardLink.classList.remove('hidden');
        }
        
    } else {
        loginBtn.textContent = 'ログイン';
        mobileLoginBtn.textContent = 'ログイン';
        
        // ログインイベントに変更
        loginBtn.removeEventListener('click', handleLogout);
        loginBtn.addEventListener('click', openLoginModal);
        mobileLoginBtn.removeEventListener('click', handleLogout);
        mobileLoginBtn.addEventListener('click', openLoginModal);
        
        // ダッシュボードリンクを非表示
        const dashboardLink = document.getElementById('dashboard-link');
        if (dashboardLink) {
            dashboardLink.classList.add('hidden');
        }
    }
}

// ログアウト処理
function handleLogout() {
    currentUser = null;
    isAuthenticated = false;
    updateAuthenticationState(false);
    showSuccessMessage('ログアウトしました');
}

// プロジェクト作成フォーム表示
function showProjectForm() {
    if (!isAuthenticated) {
        openLoginModal();
        return;
    }
    
    dashboardContent?.classList.add('hidden');
    projectForm?.classList.remove('hidden');
}

// ダッシュボード表示
function showDashboard() {
    dashboardContent?.classList.remove('hidden');
    projectForm?.classList.add('hidden');
}

// プロジェクト作成処理
async function handleProjectCreation(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectData = {
        name: formData.get('project-name'),
        keyword: formData.get('search-keyword'),
        marketplace: formData.get('marketplace'),
        minPrice: formData.get('min-price') || null,
        maxPrice: formData.get('max-price') || null,
        description: formData.get('project-description') || '',
        createdAt: new Date().toISOString(),
        userId: currentUser?.id || 'demo-user'
    };
    
    // ローディング状態
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '作成中...';
    submitBtn.disabled = true;
    
    try {
        // プロジェクト作成のシミュレーション
        await simulateProjectCreation(projectData);
        
        showSuccessMessage('プロジェクトを作成しました');
        e.target.reset();
        showDashboard();
        loadProjects();
        
    } catch (error) {
        showErrorMessage('プロジェクト作成に失敗しました: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ナビゲーション処理
function handleNavigation(e) {
    e.preventDefault();
    const target = e.target.getAttribute('href');
    
    // ページ内ナビゲーションの処理
    switch(target) {
        case '#dashboard':
            showDashboard();
            break;
        case '#projects':
            showProjectsPage();
            break;
        case '#reports':
            showReportsPage();
            break;
    }
}

// プロジェクト一覧ページ表示
function showProjectsPage() {
    // プロジェクト一覧の実装
    console.log('プロジェクト一覧ページを表示');
}

// レポートページ表示
function showReportsPage() {
    // レポートページの実装
    console.log('レポートページを表示');
}

// 成功メッセージ表示
function showSuccessMessage(message) {
    showNotification(message, 'success');
}

// エラーメッセージ表示
function showErrorMessage(message) {
    showNotification(message, 'error');
}

// 通知表示
function showNotification(message, type = 'info') {
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    // タイプに応じてスタイルを設定
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
    
    // アニメーション表示
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // 自動削除
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// サンプルデータの読み込み
function loadSampleData() {
    // サンプルプロジェクトデータ
    currentProjects = [
        {
            id: 'project-1',
            name: 'iPhone ケース市場調査',
            keyword: 'iPhone ケース',
            marketplace: 'both',
            createdAt: '2024-01-15',
            status: 'completed',
            stats: {
                totalItems: 1250,
                avgPrice: 2850,
                minPrice: 480,
                maxPrice: 12800,
                avgRating: 4.2
            }
        },
        {
            id: 'project-2',
            name: 'ワイヤレスイヤホン価格調査',
            keyword: 'ワイヤレスイヤホン',
            marketplace: 'rakuten',
            createdAt: '2024-01-12',
            status: 'in_progress',
            stats: {
                totalItems: 892,
                avgPrice: 8500,
                minPrice: 1200,
                maxPrice: 35000,
                avgRating: 4.1
            }
        }
    ];
}

// 認証状態チェック
function checkAuthentication() {
    // 実際の実装では localStorage やセッション情報から確認
    const savedUser = localStorage.getItem('dashboard_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthenticationState(true);
    }
}

// プロジェクト読み込み
async function loadProjects() {
    // 実際の実装では API からプロジェクト一覧を取得
    console.log('プロジェクト一覧を読み込み中...');
}

// シミュレーション関数
async function simulateLogin(email, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (email && password) {
                currentUser = {
                    id: 'demo-user',
                    email: email,
                    name: 'デモユーザー'
                };
                localStorage.setItem('dashboard_user', JSON.stringify(currentUser));
                resolve(currentUser);
            } else {
                reject(new Error('メールアドレスとパスワードを入力してください'));
            }
        }, 1000);
    });
}

async function simulateProjectCreation(projectData) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (projectData.name && projectData.keyword) {
                // プロジェクトをローカルに保存（実際の実装では API 呼び出し）
                const newProject = {
                    id: 'project-' + Date.now(),
                    ...projectData,
                    status: 'created'
                };
                currentProjects.push(newProject);
                resolve(newProject);
            } else {
                reject(new Error('プロジェクト名と検索キーワードは必須です'));
            }
        }, 1500);
    });
}

// ユーティリティ関数
function formatPrice(price) {
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY'
    }).format(price);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

// エクスポート（モジュール使用時）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeApp,
        handleLogin,
        handleProjectCreation,
        formatPrice,
        formatDate
    };
}