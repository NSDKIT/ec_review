/**
 * 楽天商品調査UI
 * ワークフローを実行するためのUIコンポーネント
 */

class RakutenWorkflowUI {
    constructor() {
        this.isRunning = false;
        this.currentProgress = 0;
        this.totalItems = 0;
    }

    /**
     * UIを初期化
     */
    init() {
        this.createSettingsModal();
        this.createModal();
        this.setupEventListeners();
    }

    /**
     * 設定モーダルを作成
     */
    createSettingsModal() {
        const settingsHTML = `
            <div id="rakuten-settings-modal" class="rakuten-modal hidden">
                <div class="rakuten-modal-content">
                    <div class="rakuten-modal-header">
                        <h2><i class="fas fa-cog"></i> 設定</h2>
                        <button id="close-settings-modal" class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="rakuten-modal-body">
                        <form id="rakuten-settings-form">
                            <div class="form-group">
                                <label for="settings-spreadsheet-id">Google Spreadsheet ID *</label>
                                <input type="text" id="settings-spreadsheet-id" required
                                       placeholder="1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY"
                                       value="${localStorage.getItem('google_spreadsheet_id') || '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY'}">
                                <small class="text-gray-500 text-xs mt-1 block">
                                    Google SpreadsheetのURLから取得できます<br>
                                    <code>https://docs.google.com/spreadsheets/d/[この部分]/</code>
                                </small>
                                <div class="mt-2">
                                    <a href="https://docs.google.com/spreadsheets" target="_blank" 
                                       class="text-blue-600 hover:text-blue-800 text-sm">
                                        <i class="fas fa-external-link-alt mr-1"></i>新しいスプレッドシートを作成
                                    </a>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="settings-google-apps-script-url">Google Apps Script URL（書き込み用）</label>
                                <input type="text" id="settings-google-apps-script-url" 
                                       placeholder="https://script.google.com/macros/s/..."
                                       value="${localStorage.getItem('google_apps_script_write_url') || ''}">
                                <small class="text-gray-500 text-xs mt-1 block">
                                    Google Apps ScriptのWebアプリURL（オプション）<br>
                                    設定しない場合、書き込み機能は動作しません
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label for="settings-rakuten-app-id">楽天アプリID</label>
                                <input type="text" id="settings-rakuten-app-id" 
                                       placeholder="1011800059095379100"
                                       value="${localStorage.getItem('rakuten_app_id') || '1011800059095379100'}">
                                <small class="text-gray-500 text-xs mt-1 block">
                                    楽天APIのアプリID（無料で取得可能）
                                </small>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" id="cancel-settings" class="btn-secondary">
                                    キャンセル
                                </button>
                                <button type="submit" id="save-settings" class="btn-primary">
                                    <i class="fas fa-save mr-2"></i>保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', settingsHTML);
    }

    /**
     * モーダルを作成
     */
    createModal() {
        const modalHTML = `
            <div id="rakuten-workflow-modal" class="rakuten-modal hidden">
                <div class="rakuten-modal-content">
                    <div class="rakuten-modal-header">
                        <h2><i class="fas fa-robot"></i> 楽天商品調査ツール</h2>
                        <button id="close-rakuten-modal" class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="rakuten-modal-body">
                        <form id="rakuten-workflow-form">
                            <div class="form-group">
                                <label for="rakuten-keyword">検索キーワード *</label>
                                <input type="text" id="rakuten-keyword" required 
                                       placeholder="例: iPhone ケース">
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="rakuten-min-price">最低価格</label>
                                    <input type="number" id="rakuten-min-price" 
                                           placeholder="0" min="0">
                                </div>
                                
                                <div class="form-group">
                                    <label for="rakuten-max-price">最高価格</label>
                                    <input type="number" id="rakuten-max-price" 
                                           placeholder="制限なし" min="0">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="rakuten-ng-keyword">除外キーワード</label>
                                <input type="text" id="rakuten-ng-keyword" 
                                       placeholder="除外したいキーワード">
                            </div>
                            
                            <div class="form-group">
                                <label for="rakuten-app-id">楽天アプリID</label>
                                <input type="text" id="rakuten-app-id" 
                                       placeholder="1011800059095379100"
                                       value="${localStorage.getItem('rakuten_app_id') || '1011800059095379100'}">
                            </div>
                            
                            <div class="form-group">
                                <label for="rakuten-spreadsheet-id">
                                    Google Spreadsheet ID 
                                    <button type="button" id="open-settings" class="text-blue-600 hover:text-blue-800 text-sm ml-2" title="設定を開く">
                                        <i class="fas fa-cog"></i> 設定
                                    </button>
                                </label>
                                <input type="text" id="rakuten-spreadsheet-id" 
                                       placeholder="1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY"
                                       value="${localStorage.getItem('google_spreadsheet_id') || '1wdH9PXo6cgzG258Dl_L4JmubYtSYe4V3ZruAim6KAOY'}">
                                <small class="text-gray-500 text-xs mt-1 block">
                                    Google SpreadsheetのURLから取得: <code>https://docs.google.com/spreadsheets/d/[この部分]/</code>
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label for="rakuten-hits">取得件数</label>
                                <select id="rakuten-hits">
                                    <option value="30">30件</option>
                                    <option value="50">50件</option>
                                    <option value="100">100件</option>
                                </select>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" id="cancel-rakuten-workflow" class="btn-secondary">
                                    キャンセル
                                </button>
                                <button type="submit" id="start-rakuten-workflow" class="btn-primary">
                                    <i class="fas fa-play"></i> 調査開始
                                </button>
                            </div>
                        </form>
                        
                        <!-- 進捗表示 -->
                        <div id="rakuten-progress" class="rakuten-progress hidden">
                            <div class="progress-header">
                                <h3>調査実行中...</h3>
                                <span id="progress-text">0%</span>
                            </div>
                            <div class="progress-bar">
                                <div id="progress-fill" class="progress-fill"></div>
                            </div>
                            <div id="progress-log" class="progress-log"></div>
                        </div>
                        
                        <!-- 結果表示 -->
                        <div id="rakuten-result" class="rakuten-result hidden">
                            <div class="result-header">
                                <h3><i class="fas fa-check-circle"></i> 調査完了</h3>
                            </div>
                            <div id="result-content" class="result-content"></div>
                            <div class="result-actions">
                                <a id="open-sheet-link" href="#" target="_blank" class="btn-primary">
                                    <i class="fas fa-external-link-alt"></i> Google Sheetsを開く
                                </a>
                                <button id="close-result" class="btn-secondary">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // モーダルをbodyに追加
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // スタイルを追加
        this.addStyles();
    }

    /**
     * スタイルを追加
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .rakuten-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .rakuten-modal.hidden {
                display: none;
            }
            
            .rakuten-modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            .rakuten-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .rakuten-modal-header h2 {
                margin: 0;
                color: #1f2937;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
            }
            
            .close-btn:hover {
                color: #1f2937;
            }
            
            .rakuten-modal-body {
                padding: 20px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #374151;
            }
            
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            
            .form-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 30px;
            }
            
            .btn-primary, .btn-secondary {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn-primary:hover {
                background: #2563eb;
            }
            
            .btn-secondary {
                background: #e5e7eb;
                color: #374151;
            }
            
            .btn-secondary:hover {
                background: #d1d5db;
            }
            
            .rakuten-progress {
                margin-top: 30px;
            }
            
            .progress-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: #3b82f6;
                width: 0%;
                transition: width 0.3s;
            }
            
            .progress-log {
                margin-top: 15px;
                padding: 10px;
                background: #f9fafb;
                border-radius: 6px;
                max-height: 200px;
                overflow-y: auto;
                font-size: 12px;
                color: #6b7280;
            }
            
            .rakuten-result {
                margin-top: 30px;
            }
            
            .result-content {
                padding: 15px;
                background: #f0fdf4;
                border-radius: 6px;
                margin-bottom: 15px;
            }
            
            .form-group small {
                display: block;
                margin-top: 4px;
            }
            
            .form-group code {
                background: #f3f4f6;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                color: #1f2937;
            }
            
            #open-settings {
                background: none;
                border: none;
                padding: 0;
                margin: 0;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // ワークフローフォーム送信
        document.getElementById('rakuten-workflow-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startWorkflow();
        });

        // 設定フォーム送信
        document.getElementById('rakuten-settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // 設定ボタン
        document.getElementById('open-settings')?.addEventListener('click', () => {
            this.openSettingsModal();
        });

        // ワークフローモーダルを閉じる
        document.getElementById('close-rakuten-modal')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancel-rakuten-workflow')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('close-result')?.addEventListener('click', () => {
            this.closeModal();
        });

        // 設定モーダルを閉じる
        document.getElementById('close-settings-modal')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('cancel-settings')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // モーダル外クリックで閉じる
        document.getElementById('rakuten-workflow-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'rakuten-workflow-modal') {
                this.closeModal();
            }
        });

        document.getElementById('rakuten-settings-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'rakuten-settings-modal') {
                this.closeSettingsModal();
            }
        });
    }

    /**
     * モーダルを開く
     */
    openModal() {
        const modal = document.getElementById('rakuten-workflow-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * モーダルを閉じる
     */
    closeModal() {
        const modal = document.getElementById('rakuten-workflow-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        // フォームをリセット
        this.resetForm();
    }

    /**
     * フォームをリセット
     */
    resetForm() {
        document.getElementById('rakuten-workflow-form')?.reset();
        document.getElementById('rakuten-progress')?.classList.add('hidden');
        document.getElementById('rakuten-result')?.classList.add('hidden');
        this.isRunning = false;
    }

    /**
     * 設定を保存
     */
    saveSettings() {
        const spreadsheetId = document.getElementById('settings-spreadsheet-id').value.trim();
        const googleAppsScriptUrl = document.getElementById('settings-google-apps-script-url').value.trim();
        const rakutenAppId = document.getElementById('settings-rakuten-app-id').value.trim();

        // バリデーション
        if (!spreadsheetId) {
            alert('Google Spreadsheet IDを入力してください');
            return;
        }

        // スプレッドシートIDの形式チェック（簡易）
        if (spreadsheetId.length < 20) {
            if (!confirm('スプレッドシートIDの形式が正しくない可能性があります。続行しますか？')) {
                return;
            }
        }

        // 保存
        localStorage.setItem('google_spreadsheet_id', spreadsheetId);
        if (googleAppsScriptUrl) {
            localStorage.setItem('google_apps_script_write_url', googleAppsScriptUrl);
        }
        if (rakutenAppId) {
            localStorage.setItem('rakuten_app_id', rakutenAppId);
        }

        // ワークフローのスプレッドシートIDを更新
        if (window.rakutenWorkflow) {
            rakutenWorkflow.setSpreadsheetId(spreadsheetId);
        }

        // Google Sheets APIのスプレッドシートIDを更新
        if (window.googleSheetsAPI) {
            googleSheetsAPI.SPREADSHEET_ID = spreadsheetId;
        }

        // ワークフローフォームのスプレッドシートIDも更新
        const workflowSpreadsheetInput = document.getElementById('rakuten-spreadsheet-id');
        if (workflowSpreadsheetInput) {
            workflowSpreadsheetInput.value = spreadsheetId;
        }

        // 設定モーダルを閉じる
        this.closeSettingsModal();

        // 成功メッセージ
        this.showNotification('設定を保存しました', 'success');
    }

    /**
     * 設定モーダルを開く
     */
    openSettingsModal() {
        const modal = document.getElementById('rakuten-settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * 設定モーダルを閉じる
     */
    closeSettingsModal() {
        const modal = document.getElementById('rakuten-settings-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    /**
     * 通知を表示
     */
    showNotification(message, type = 'info') {
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
        }, 3000);
    }

    /**
     * ワークフローを開始
     */
    async startWorkflow() {
        if (this.isRunning) return;

        // フォームデータを取得
        const formData = {
            keyword: document.getElementById('rakuten-keyword').value,
            minPrice: parseInt(document.getElementById('rakuten-min-price').value) || 0,
            maxPrice: document.getElementById('rakuten-max-price').value ? 
                     parseInt(document.getElementById('rakuten-max-price').value) : null,
            NGKeyword: document.getElementById('rakuten-ng-keyword').value,
            rakuten_appid: document.getElementById('rakuten-app-id').value,
            hits: parseInt(document.getElementById('rakuten-hits').value),
            spreadsheetId: document.getElementById('rakuten-spreadsheet-id').value.trim()
        };

        // バリデーション
        if (!formData.spreadsheetId) {
            alert('Google Spreadsheet IDを入力してください');
            return;
        }

        // アプリIDを保存
        if (formData.rakuten_appid) {
            localStorage.setItem('rakuten_app_id', formData.rakuten_appid);
        }

        // スプレッドシートIDを保存
        if (formData.spreadsheetId) {
            localStorage.setItem('google_spreadsheet_id', formData.spreadsheetId);
            if (window.rakutenWorkflow) {
                rakutenWorkflow.setSpreadsheetId(formData.spreadsheetId);
            }
            if (window.googleSheetsAPI) {
                googleSheetsAPI.SPREADSHEET_ID = formData.spreadsheetId;
            }
        }

        this.isRunning = true;
        
        // UIを更新
        document.getElementById('rakuten-workflow-form').style.display = 'none';
        document.getElementById('rakuten-progress').classList.remove('hidden');
        this.updateProgress(0, '調査を開始しています...');

        try {
            // ワークフローを実行
            const result = await rakutenWorkflow.execute(formData);

            // 結果を表示
            this.showResult(result);

        } catch (error) {
            console.error('ワークフロー実行エラー:', error);
            this.updateProgress(100, `エラー: ${error.message}`);
            alert(`エラーが発生しました: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 進捗を更新
     */
    updateProgress(percentage, message) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressLog = document.getElementById('progress-log');

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }

        if (progressLog && message) {
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            progressLog.appendChild(logEntry);
            progressLog.scrollTop = progressLog.scrollHeight;
        }
    }

    /**
     * 結果を表示
     */
    showResult(result) {
        document.getElementById('rakuten-progress').classList.add('hidden');
        document.getElementById('rakuten-result').classList.remove('hidden');

        const resultContent = document.getElementById('result-content');
        const sheetLink = document.getElementById('open-sheet-link');

        if (result.success) {
            resultContent.innerHTML = `
                <p><strong>✅ ${result.message}</strong></p>
                <p>取得商品数: ${result.totalProducts}件</p>
                ${result.reviewResults ? `<p>レビュー分析: ${result.reviewResults.length}件完了</p>` : ''}
            `;
        } else {
            resultContent.innerHTML = `
                <p><strong>❌ ${result.message}</strong></p>
            `;
        }

        if (sheetLink && result.sheetUrl) {
            sheetLink.href = result.sheetUrl;
        }
    }
}

// グローバルインスタンス
const rakutenWorkflowUI = new RakutenWorkflowUI();

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    rakutenWorkflowUI.init();
});

// グローバルに公開
window.RakutenWorkflowUI = RakutenWorkflowUI;
window.rakutenWorkflowUI = rakutenWorkflowUI;

