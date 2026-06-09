// ============================================
// 收據管理模組 - 優化版
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadReceiptsPage() {
    const container = document.getElementById('page_receipts');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: receipts, error } = await supabaseClient
            .from('receipts')
            .select('*, users!inner(full_name, email, phone)')
            .not('users.email', 'eq', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // 計算統計數據
        const totalReceipts = receipts?.length || 0;
        const totalAmount = receipts?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
        
        container.innerHTML = `
            <div class="receipts-container">
                <!-- 統計卡片區域 -->
                <div class="receipt-stats">
                    <div class="receipt-stat-card">
                        <div class="receipt-stat-icon"><i class="fas fa-receipt"></i></div>
                        <div class="receipt-stat-info">
                            <div class="receipt-stat-value">${totalReceipts}</div>
                            <div class="receipt-stat-label">總收據數量</div>
                        </div>
                    </div>
                    <div class="receipt-stat-card">
                        <div class="receipt-stat-icon"><i class="fas fa-dollar-sign"></i></div>
                        <div class="receipt-stat-info">
                            <div class="receipt-stat-value">RM ${totalAmount.toLocaleString()}</div>
                            <div class="receipt-stat-label">總金額</div>
                        </div>
                    </div>
                    <div class="receipt-stat-card">
                        <div class="receipt-stat-icon"><i class="fas fa-upload"></i></div>
                        <div class="receipt-stat-info">
                            <div class="receipt-stat-value">
                                <button class="btn-upload-receipt" onclick="showUploadReceiptModal()">
                                    <i class="fas fa-plus-circle"></i> 上傳收據
                                </button>
                            </div>
                            <div class="receipt-stat-label">點擊新增</div>
                        </div>
                    </div>
                </div>
                
                <!-- 收據列表 -->
                <div class="receipt-list-container">
                    <div class="receipt-list-header">
                        <h3><i class="fas fa-history"></i> 收據記錄</h3>
                        <div class="receipt-list-actions">
                            <input type="text" id="receiptSearchInput" placeholder="🔍 搜尋用戶..." class="receipt-search">
                            <button class="btn-refresh" onclick="loadReceiptsPage()"><i class="fas fa-sync-alt"></i></button>
                        </div>
                    </div>
                    
                    <div id="receiptListContent" class="receipt-list-content">
                        ${renderReceiptList(receipts)}
                    </div>
                </div>
            </div>
        `;
        
        // 綁定搜索事件
        const searchInput = document.getElementById('receiptSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => filterReceipts(receipts, e.target.value));
        }
        
    } catch (err) {
        console.error('Receipts page error:', err);
        container.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> 加載失敗，請刷新重試</div>';
    }
}

function renderReceiptList(receipts) {
    if (!receipts || receipts.length === 0) {
        return `
            <div class="receipt-empty">
                <i class="fas fa-receipt"></i>
                <p>暫無收據記錄</p>
                <button class="btn-empty-upload" onclick="showUploadReceiptModal()">上傳第一張收據</button>
            </div>
        `;
    }
    
    return receipts.map(receipt => `
        <div class="receipt-card" data-user-name="${(receipt.users?.full_name || '').toLowerCase()}">
            <div class="receipt-card-left">
                <div class="receipt-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="receipt-info">
                    <div class="receipt-user-name">${escapeHtml(receipt.users?.full_name || 'N/A')}</div>
                    <div class="receipt-user-contact">
                        <span><i class="fas fa-envelope"></i> ${escapeHtml(receipt.users?.email || '未設置')}</span>
                        <span><i class="fas fa-phone"></i> ${escapeHtml(receipt.users?.phone || '未設置')}</span>
                    </div>
                </div>
            </div>
            <div class="receipt-card-center">
                <div class="receipt-amount">
                    <span class="amount-label">金額</span>
                    <span class="amount-value">RM ${receipt.amount}</span>
                </div>
                <div class="receipt-method">
                    <span class="method-badge method-${receipt.payment_method}">${getPaymentMethodName(receipt.payment_method)}</span>
                </div>
                <div class="receipt-date">
                    <i class="far fa-calendar-alt"></i> ${formatReceiptDate(receipt.created_at)}
                </div>
            </div>
            <div class="receipt-card-right">
                ${receipt.receipt_url ? `
                    <div class="receipt-preview" onclick="window.open('${receipt.receipt_url}', '_blank')">
                        <img src="${receipt.receipt_url}" onerror="this.src='https://placehold.co/60x60?text=No+Image'">
                        <div class="preview-overlay"><i class="fas fa-search-plus"></i></div>
                    </div>
                ` : `
                    <div class="receipt-no-image">
                        <i class="fas fa-image"></i>
                        <span>無圖片</span>
                    </div>
                `}
                <button class="btn-delete-receipt" onclick="deleteReceipt('${receipt.id}')" title="刪除收據">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function filterReceipts(allReceipts, searchTerm) {
    const container = document.getElementById('receiptListContent');
    if (!container) return;
    
    if (!searchTerm.trim()) {
        container.innerHTML = renderReceiptList(allReceipts);
        return;
    }
    
    const filtered = allReceipts.filter(receipt => {
        const userName = (receipt.users?.full_name || '').toLowerCase();
        const userEmail = (receipt.users?.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return userName.includes(term) || userEmail.includes(term);
    });
    
    container.innerHTML = renderReceiptList(filtered);
}

function getPaymentMethodName(method) {
    const methods = {
        'credit_card': '信用卡',
        'bank_transfer': '銀行轉帳',
        'cash': '貨到付款',
        'touchngo': 'Touch n Go',
        'admin_upload': '管理員上傳',
        'pending': '待付款'
    };
    return methods[method] || method || '其他';
}

function formatReceiptDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// 顯示上傳收據彈窗
async function showUploadReceiptModal() {
    const { data: users } = await supabaseClient
        .from('users')
        .select('id, full_name, email')
        .not('email', 'eq', ADMIN_EMAIL)
        .order('full_name', { ascending: true });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'uploadReceiptModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 550px; width: 90%;">
            <div class="modal-header">
                <h3><i class="fas fa-upload" style="color: #c8a15e;"></i> 上傳收據</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label><i class="fas fa-user"></i> 選擇用戶 <span class="required">*</span></label>
                    <select id="receiptUserIdSelect" class="form-select">
                        <option value="">-- 請選擇用戶 --</option>
                        ${users?.map(u => `<option value="${u.id}">${escapeHtml(u.full_name)} (${u.email})</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label><i class="fas fa-dollar-sign"></i> 金額 (RM) <span class="required">*</span></label>
                        <input type="number" id="receiptAmountInput" class="form-input" placeholder="0.00" step="0.01">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-credit-card"></i> 付款方式</label>
                        <select id="receiptPaymentMethodSelect" class="form-select">
                            <option value="credit_card">💳 信用卡</option>
                            <option value="bank_transfer">🏦 銀行轉帳</option>
                            <option value="cash">💵 貨到付款</option>
                            <option value="touchngo">📱 Touch n Go</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-image"></i> 收據圖片 <span class="required">*</span></label>
                    <div class="file-upload-area" id="fileUploadArea">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>點擊或拖曳上傳</p>
                        <small>支援 JPG、PNG、PDF</small>
                        <input type="file" id="receiptFileInput" accept="image/*,.pdf" style="display: none;">
                    </div>
                    <div id="filePreview" class="file-preview" style="display: none;">
                        <img id="previewImage" src="">
                        <span id="fileName"></span>
                        <button type="button" onclick="clearFileSelection()" class="remove-file"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn-submit" id="uploadReceiptBtn">上傳收據</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 文件上傳區域事件
    const uploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('receiptFileInput');
    
    if (uploadArea && fileInput) {
        uploadArea.onclick = () => fileInput.click();
        uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.style.borderColor = '#c8a15e'; };
        uploadArea.ondragleave = () => uploadArea.style.borderColor = '#1e2a3a';
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        };
        fileInput.onchange = (e) => {
            if (e.target.files[0]) handleFileSelect(e.target.files[0]);
        };
    }
    
    const uploadBtn = document.getElementById('uploadReceiptBtn');
    if (uploadBtn) uploadBtn.onclick = uploadReceipt;
}

function handleFileSelect(file) {
    const previewDiv = document.getElementById('filePreview');
    const uploadArea = document.getElementById('fileUploadArea');
    const fileNameSpan = document.getElementById('fileName');
    const previewImage = document.getElementById('previewImage');
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        previewImage.style.display = 'none';
    }
    
    fileNameSpan.textContent = file.name;
    uploadArea.style.display = 'none';
    previewDiv.style.display = 'flex';
}

function clearFileSelection() {
    const fileInput = document.getElementById('receiptFileInput');
    const previewDiv = document.getElementById('filePreview');
    const uploadArea = document.getElementById('fileUploadArea');
    
    if (fileInput) fileInput.value = '';
    if (uploadArea) uploadArea.style.display = 'flex';
    if (previewDiv) previewDiv.style.display = 'none';
}

// 執行上傳
async function uploadReceipt() {
    const userIdSelect = document.getElementById('receiptUserIdSelect');
    const amountInput = document.getElementById('receiptAmountInput');
    const paymentMethodSelect = document.getElementById('receiptPaymentMethodSelect');
    const fileInput = document.getElementById('receiptFileInput');
    
    const userId = userIdSelect?.value;
    const amount = parseFloat(amountInput?.value) || 0;
    const paymentMethod = paymentMethodSelect?.value;
    const file = fileInput?.files[0];
    
    if (!userId) {
        showToast('請選擇用戶', 'error');
        return;
    }
    
    if (amount <= 0) {
        showToast('請輸入有效的金額', 'error');
        return;
    }
    
    if (!file) {
        showToast('請選擇收據文件', 'error');
        return;
    }
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    try {
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
        
        const fileExt = file.name.split('.').pop();
        const fileName = `receipt_${userId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);
        
        if (uploadError) {
            showToast('上傳失敗: ' + uploadError.message, 'error');
            return;
        }
        
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
        
        const { error: insertError } = await supabaseClient
            .from('receipts')
            .insert({
                user_id: userId,
                subscription_id: subscription?.id || null,
                amount: amount,
                receipt_url: urlData.publicUrl,
                payment_method: paymentMethod,
                created_at: new Date()
            });
        
        if (insertError) {
            showToast('保存失敗: ' + insertError.message, 'error');
        } else {
            showToast('收據上傳成功！');
            loadReceiptsPage();
            if (document.getElementById('page_users')?.classList.contains('active') && typeof loadUsersPage === 'function') {
                loadUsersPage();
            }
        }
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('上傳失敗: ' + err.message, 'error');
    }
}

async function deleteReceipt(receiptId) {
    if (!confirm('確定刪除此收據？')) return;
    
    const { error } = await supabaseClient
        .from('receipts')
        .delete()
        .eq('id', receiptId);
    
    if (error) {
        showToast('刪除失敗: ' + error.message, 'error');
    } else {
        showToast('刪除成功');
        loadReceiptsPage();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 為用戶上傳收據（從用戶管理頁面調用）
async function uploadReceiptForUser(userId) {
    const { data: user } = await supabaseClient
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .single();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px; width: 90%;">
            <div class="modal-header">
                <h3><i class="fas fa-upload"></i> 為 ${escapeHtml(user?.full_name)} 上傳收據</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>金額 (RM) <span class="required">*</span></label>
                    <input type="number" id="receiptAmountUserInput" class="form-input" placeholder="0.00" step="0.01">
                </div>
                <div class="form-group">
                    <label>付款方式</label>
                    <select id="receiptPaymentMethodUserSelect" class="form-select">
                        <option value="credit_card">💳 信用卡</option>
                        <option value="bank_transfer">🏦 銀行轉帳</option>
                        <option value="cash">💵 貨到付款</option>
                        <option value="touchngo">📱 Touch n Go</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>收據圖片 <span class="required">*</span></label>
                    <input type="file" id="receiptFileUserInput" accept="image/*,.pdf" class="form-input-file">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn-submit" id="uploadReceiptUserBtn">上傳</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const uploadBtn = document.getElementById('uploadReceiptUserBtn');
    if (uploadBtn) uploadBtn.onclick = () => uploadReceiptForUserConfirm(userId);
}

async function uploadReceiptForUserConfirm(userId) {
    const amountInput = document.getElementById('receiptAmountUserInput');
    const paymentMethodSelect = document.getElementById('receiptPaymentMethodUserSelect');
    const fileInput = document.getElementById('receiptFileUserInput');
    
    const amount = parseFloat(amountInput?.value) || 0;
    const paymentMethod = paymentMethodSelect?.value;
    const file = fileInput?.files[0];
    
    if (amount <= 0) {
        showToast('請輸入有效的金額', 'error');
        return;
    }
    
    if (!file) {
        showToast('請選擇收據文件', 'error');
        return;
    }
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    try {
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
        
        const fileExt = file.name.split('.').pop();
        const fileName = `receipt_${userId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);
        
        if (uploadError) {
            showToast('上傳失敗: ' + uploadError.message, 'error');
            return;
        }
        
        const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
        
        await supabaseClient.from('receipts').insert({
            user_id: userId,
            subscription_id: subscription?.id || null,
            amount: amount,
            receipt_url: urlData.publicUrl,
            payment_method: paymentMethod,
            created_at: new Date()
        });
        
        showToast('收據上傳成功！');
        if (document.getElementById('page_receipts')?.classList.contains('active')) loadReceiptsPage();
        if (document.getElementById('page_users')?.classList.contains('active') && typeof loadUsersPage === 'function') loadUsersPage();
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('上傳失敗: ' + err.message, 'error');
    }
}