// ============================================
// 收據管理模組 - 支持上傳
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadReceiptsPage() {
    const container = document.getElementById('page_receipts');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: receipts, error } = await supabaseClient
            .from('receipts')
            .select('*, users!inner(full_name, email)')
            .not('users.email', 'eq', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        container.innerHTML = `
            <div class="table-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                    <h3>📄 收據管理 (共 ${receipts?.length || 0} 張)</h3>
                    <button class="btn-small" onclick="showUploadReceiptModal()" style="background: #c8a15e; color: #0a1a2e;"><i class="fas fa-upload"></i> 上傳收據</button>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; min-width: 700px;">
                        <thead>
                            <tr><th>用戶</th><th>金額</th><th>付款方式</th><th>日期</th><th>收據</th><th>操作</th></tr>
                        </thead>
                        <tbody id="receiptsTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('receiptsTableBody');
        if (!receipts || receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">暫無收據</td></tr>';
            return;
        }
        
        tbody.innerHTML = receipts.map(r => `
            <tr>
                <td>
                    <strong>${escapeHtml(r.users?.full_name || 'N/A')}</strong><br>
                    <small>${escapeHtml(r.users?.email || '')}</small>
                </td>
                <td><strong>RM ${r.amount}</strong></td>
                <td>${r.payment_method}</td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                    ${r.receipt_url ? `<img src="${r.receipt_url}" class="receipt-img" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${r.receipt_url}', '_blank')">` : '—'}
                </td>
                <td>
                    <button class="btn-icon" onclick="deleteReceipt('${r.id}')" title="刪除"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error('Receipts page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
    }
}

// 顯示上傳收據彈窗
async function showUploadReceiptModal() {
    // 獲取所有用戶供選擇
    const { data: users } = await supabaseClient
        .from('users')
        .select('id, full_name, email')
        .not('email', 'eq', ADMIN_EMAIL);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="width: 500px;">
            <h3><i class="fas fa-upload"></i> 上傳收據</h3>
            <div class="input-group" style="margin-top: 20px;">
                <label>選擇用戶</label>
                <select id="receiptUserId" style="width: 100%; padding: 12px; background: #0f172a; border: 1px solid #1e2a3a; border-radius: 12px; color: #fff;">
                    <option value="">-- 請選擇用戶 --</option>
                    ${users?.map(u => `<option value="${u.id}">${escapeHtml(u.full_name)} (${u.email})</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>金額 (RM)</label>
                <input type="number" id="receiptAmount" placeholder="輸入金額">
            </div>
            <div class="input-group">
                <label>付款方式</label>
                <select id="receiptPaymentMethod" style="width: 100%; padding: 12px; background: #0f172a; border: 1px solid #1e2a3a; border-radius: 12px; color: #fff;">
                    <option value="credit_card">信用卡</option>
                    <option value="bank_transfer">銀行轉帳</option>
                    <option value="cash">貨到付款</option>
                    <option value="touchngo">Touch n Go</option>
                </select>
            </div>
            <div class="input-group">
                <label>上傳收據圖片</label>
                <input type="file" id="receiptFile" accept="image/*,.pdf" style="padding: 10px;">
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="uploadReceipt()">上傳</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 執行上傳
async function uploadReceipt() {
    const userId = document.getElementById('receiptUserId').value;
    const amount = parseInt(document.getElementById('receiptAmount').value) || 0;
    const paymentMethod = document.getElementById('receiptPaymentMethod').value;
    const file = document.getElementById('receiptFile').files[0];
    
    if (!userId) {
        showToast('請選擇用戶', 'error');
        return;
    }
    
    if (!file) {
        showToast('請選擇文件', 'error');
        return;
    }
    
    // 關閉彈窗
    document.querySelector('.modal-overlay')?.remove();
    
    // 獲取用戶的 active 訂閱
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    
    // 上傳文件
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
    
    // 保存收據記錄
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
    }
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
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-card" style="width: 450px;">
            <h3><i class="fas fa-upload"></i> 為 ${escapeHtml(user?.full_name)} 上傳收據</h3>
            <div class="input-group" style="margin-top: 20px;">
                <label>金額 (RM)</label>
                <input type="number" id="receiptAmount" placeholder="輸入金額">
            </div>
            <div class="input-group">
                <label>付款方式</label>
                <select id="receiptPaymentMethod" style="width: 100%; padding: 12px; background: #0f172a; border: 1px solid #1e2a3a; border-radius: 12px; color: #fff;">
                    <option value="credit_card">信用卡</option>
                    <option value="bank_transfer">銀行轉帳</option>
                    <option value="cash">貨到付款</option>
                    <option value="touchngo">Touch n Go</option>
                </select>
            </div>
            <div class="input-group">
                <label>上傳收據圖片</label>
                <input type="file" id="receiptFile" accept="image/*,.pdf">
            </div>
            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button class="btn-save" onclick="uploadReceiptForUserConfirm('${userId}')">上傳</button>
                <button class="btn-cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function uploadReceiptForUserConfirm(userId) {
    const amount = parseInt(document.getElementById('receiptAmount').value) || 0;
    const paymentMethod = document.getElementById('receiptPaymentMethod').value;
    const file = document.getElementById('receiptFile').files[0];
    
    if (!file) {
        showToast('請選擇文件', 'error');
        return;
    }
    
    document.querySelector('.modal-overlay')?.remove();
    
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
    if (document.getElementById('page_receipts')?.classList.contains('active')) {
        loadReceiptsPage();
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