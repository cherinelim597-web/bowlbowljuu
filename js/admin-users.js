// ============================================
// 用戶管理模組 - 不顯示管理員
// ============================================

const ADMIN_EMAIL = "admin@cherinebowl.com";

async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        // 獲取所有用戶，排除管理員
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .not('email', 'eq', ADMIN_EMAIL)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading users:', error);
            container.innerHTML = '<div class="table-container"><p>Error loading users</p></div>';
            return;
        }
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="table-container"><p>No users found</p></div>';
            return;
        }
        
        // 獲取所有用戶的訂閱
        const subscriptions = {};
        for (const user of users) {
            const { data: sub } = await supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single();
            subscriptions[user.id] = sub;
        }
        
        container.innerHTML = `
            <div class="table-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3>All Users (${users.length})</h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Name</th><th>Email</th><th>Phone</th><th>Plan</th><th>Meals</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('usersTableBody');
        const planNames = { single: 'Single', weekly: 'Weekly', '1month': '1 Month', '2months': '2 Months', '3months': '3 Months' };
        
        tbody.innerHTML = users.map(user => {
            const sub = subscriptions[user.id];
            const mealsReceived = sub?.meals_received || 0;
            const totalMeals = sub?.total_days || 0;
            
            return `
                <tr>
                    <td><strong>${escapeHtml(user.full_name || 'N/A')}</strong></td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.phone || 'N/A')}</td>
                    <td>${sub ? planNames[sub.plan_type] : '<span style="color:#ffb84d;">— No Plan —</span>'}</td>
                    <td>${sub ? `${mealsReceived}/${totalMeals}` : '—'}</td>
                    <td><span class="badge ${sub ? 'badge-active' : 'badge-expired'}">${sub ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn-icon" onclick="editUser('${user.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="Upload Receipt"><i class="fas fa-receipt"></i></button>
                        <button class="btn-icon" onclick="viewUserDeliveries('${user.id}')" title="View Deliveries"><i class="fas fa-truck"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<div class="table-container"><p>Error loading users</p></div>';
    }
}

// 查看用戶的配送記錄
async function viewUserDeliveries(userId) {
    const { data: deliveries } = await supabaseClient
        .from('deliveries')
        .select('*')
        .eq('user_id', userId)
        .order('delivery_date', { ascending: false })
        .limit(14);
    
    if (!deliveries || deliveries.length === 0) {
        showToast('No delivery records found', 'info');
        return;
    }
    
    const deliveryList = deliveries.map(d => 
        `${formatDate(d.delivery_date)} - Meal #${d.meal_number} - ${d.status === 'delivered' ? '✅ Delivered' : '⏳ Pending'}`
    ).join('\n');
    
    alert(`Delivery History:\n${deliveryList}`);
}

async function editUser(userId) {
    const { data: user } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!user) return;
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editFullName').value = user.full_name || '';
    document.getElementById('editPhone').value = user.phone || '';
    document.getElementById('editAddress').value = user.address || '';
    document.getElementById('userModal').style.display = 'flex';
}

async function saveUserEdit() {
    const userId = document.getElementById('editUserId').value;
    const fullName = document.getElementById('editFullName').value;
    const phone = document.getElementById('editPhone').value;
    const address = document.getElementById('editAddress').value;
    
    const { error } = await supabaseClient
        .from('users')
        .update({ full_name: fullName, phone, address })
        .eq('id', userId);
    
    if (error) {
        showToast('Update failed: ' + error.message, 'error');
    } else {
        showToast('User updated successfully');
        closeUserModal();
        loadUsersPage();
    }
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

// 在 uploadReceiptForUser 函數中
async function uploadReceiptForUser(userId) {
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    
    if (!subscription) {
        showToast('User has no active subscription. Please ask them to subscribe first.', 'error');
        return;
    }
    
    document.getElementById('receiptUserId').value = userId;
    document.getElementById('receiptAmount').value = '';
    document.getElementById('receiptFile').value = '';
    document.getElementById('receiptModal').style.display = 'flex';
}

async function uploadReceipt() {
    const userId = document.getElementById('receiptUserId').value;
    const amount = parseInt(document.getElementById('receiptAmount').value) || 0;
    const file = document.getElementById('receiptFile').files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_receipt_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabaseClient.storage
        .from('receipts')
        .upload(fileName, file);
    
    if (uploadError) {
        showToast('Upload failed: ' + uploadError.message, 'error');
        return;
    }
    
    const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(fileName);
    
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    
    if (subscription) {
        await supabaseClient.from('receipts').insert({
            user_id: userId,
            subscription_id: subscription.id,
            amount: amount,
            receipt_url: urlData.publicUrl,
            payment_method: 'admin_upload',
            created_at: new Date()
        });
    }
    
    showToast(`Receipt uploaded successfully! Amount: RM ${amount}`);
    closeReceiptModal();
    if (document.getElementById('page_receipts')?.classList.contains('active')) {
        loadReceiptsPage();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}