// ============================================
// 收據頁面（使用 localStorage）
// ============================================

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

async function loadReceipts() {
    const user = getCurrentUser();
    
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    const { data: receipts } = await supabaseClient
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    
    const receiptsList = document.getElementById('receiptsList');
    
    if (!receipts || receipts.length === 0) {
        receiptsList.innerHTML = '<p>No receipts found.</p>';
        return;
    }
    
    receiptsList.innerHTML = receipts.map(receipt => `
        <div class="receipt-item">
            <div class="receipt-info">
                <h4>Healthy Bowl Subscription</h4>
                <p>Amount: RM ${receipt.amount}</p>
                <p>Date: ${new Date(receipt.created_at).toLocaleDateString()}</p>
                <p>Method: ${receipt.payment_method}</p>
            </div>
            <div class="receipt-actions">
                ${receipt.receipt_url ? `<img src="${receipt.receipt_url}" class="receipt-img" onclick="viewReceipt('${receipt.receipt_url}')" alt="Receipt">` : ''}
            </div>
        </div>
    `).join('');
}

function viewReceipt(url) {
    window.open(url, '_blank');
}

loadReceipts();