// ============================================
// 用戶收據頁面 - 查看個人收據記錄
// ============================================

// 獲取當前用戶
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

// HTML 跳脫
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化日期顯示
function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// 格式化完整日期時間
function formatFullDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// 獲取方案名稱
function getPlanName(planType) {
    const planNames = {
        single: 'Single Purchase',
        weekly: 'Weekly Plan',
        '1month': '1 Month Plan',
        '2months': '2 Months Plan',
        '3months': '3 Months Plan'
    };
    return planNames[planType] || planType;
}

// 獲取付款方式顯示名稱
function getPaymentMethodName(method) {
    const methodNames = {
        'credit_card': 'Credit Card',
        'bank_transfer': 'Bank Transfer',
        'cash': 'Cash on Delivery',
        'touchngo': 'Touch n Go',
        'admin_upload': 'Admin Uploaded',
        'pending': 'Pending'
    };
    return methodNames[method] || method || 'Unknown';
}

// 加載用戶的收據列表
async function loadReceipts() {
    const user = getCurrentUser();
    
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    const container = document.getElementById('receiptsList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取用戶的所有收據
        const { data: receipts, error } = await supabaseClient
            .from('receipts')
            .select('*, subscriptions(plan_type, total_days, start_date, end_date)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!receipts || receipts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #8a9abb;">
                    <i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No receipt records found.</p>
                    <p style="font-size: 13px; margin-top: 8px;">您的收據記錄將顯示在這裡 / Your receipt history will appear here</p>
                    <a href="dashboard.html" class="btn-small" style="display: inline-block; margin-top: 20px; text-decoration: none;">← Back to Dashboard</a>
                </div>
            `;
            return;
        }
        
        // 計算統計數據
        const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
        
        container.innerHTML = `
            <!-- 統計卡片 -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px;">
                <div style="background: linear-gradient(135deg, #0f2b5b, #1a3a7a); border-radius: 20px; padding: 20px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">${receipts.length}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Total Receipts</div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.4);">總收據數量</div>
                </div>
                <div style="background: linear-gradient(135deg, #0f2b5b, #1a3a7a); border-radius: 20px; padding: 20px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #c8a15e;">RM ${totalAmount.toLocaleString()}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Total Spent</div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.4);">總消費金額</div>
                </div>
            </div>
            
            <!-- 收據列表標題 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                <h3 style="color: #0f2b5b; font-family: 'Cinzel', serif;"><i class="fas fa-receipt"></i> Receipt History</h3>
                <button class="btn-small" onclick="location.href='dashboard.html'" style="background: #0f2b5b;">
                    <i class="fas fa-arrow-left"></i> Back to Dashboard
                </button>
            </div>
            
            <div id="receiptsListInner"></div>
        `;
        
        // 渲染收據列表
        const innerContainer = document.getElementById('receiptsListInner');
        innerContainer.innerHTML = receipts.map(receipt => {
            const subscription = receipt.subscriptions;
            const planName = subscription ? getPlanName(subscription.plan_type) : '—';
            
            return `
                <div class="receipt-item" style="background: linear-gradient(135deg, #faf7f2, #f0ebe2); border-radius: 20px; padding: 18px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div class="receipt-info" style="flex: 1;">
                        <h4 style="font-family: 'Cinzel', serif; color: #0f2b5b; margin-bottom: 5px;">RM ${receipt.amount}</h4>
                        <p style="color: #666; font-size: 13px;">
                            <i class="fas fa-credit-card"></i> ${getPaymentMethodName(receipt.payment_method)}
                        </p>
                        <p style="color: #999; font-size: 11px; margin-top: 4px;">
                            <i class="far fa-calendar-alt"></i> ${formatFullDateTime(receipt.created_at)}
                        </p>
                        ${planName !== '—' ? `<p style="color: #999; font-size: 11px;"><i class="fas fa-utensils"></i> ${planName}</p>` : ''}
                    </div>
                    <div class="receipt-actions" style="display: flex; gap: 10px; align-items: center;">
                        ${receipt.receipt_url ? `
                            <img src="${receipt.receipt_url}" class="receipt-img" style="width: 60px; height: 60px; object-fit: cover; border-radius: 12px; cursor: pointer; border: 2px solid #c8a15e;" 
                                 onclick="window.open('${receipt.receipt_url}', '_blank')" alt="Receipt">
                        ` : '<span style="color: #999; font-size: 12px;">No image</span>'}
                        ${receipt.receipt_url ? `
                            <a href="${receipt.receipt_url}" download style="background: #0f2b5b; color: white; padding: 8px 12px; border-radius: 30px; font-size: 12px; text-decoration: none;">
                                <i class="fas fa-download"></i> Download
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Load receipts error:', err);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #c31313;">
                <i class="fas fa-exclamation-circle" style="font-size: 36px; margin-bottom: 12px;"></i>
                <p>Failed to load receipts. Please try again later.</p>
                <p style="font-size: 12px; margin-top: 8px;">加載失敗，請稍後重試</p>
                <a href="dashboard.html" class="btn-small" style="display: inline-block; margin-top: 20px; text-decoration: none;">← Back to Dashboard</a>
            </div>
        `;
    }
}

// 頁面加載時執行
document.addEventListener('DOMContentLoaded', loadReceipts);