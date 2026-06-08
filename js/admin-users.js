// ============================================
// 用戶管理模組
// ============================================

async function loadUsersPage() {
    const container = document.getElementById('page_users');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: users } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
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
                    <h3>All Users</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th><th>Email</th><th>Phone</th><th>Plan</th><th>Meals</th><th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody"></tbody>
                </table>
            </div>
        `;
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(user => {
            const sub = subscriptions[user.id];
            const mealsReceived = sub?.meals_received || 0;
            const totalMeals = sub?.total_days || 0;
            const planNames = { single: 'Single', weekly: 'Weekly', '1month': '1 Month', '2months': '2 Months', '3months': '3 Months' };
            
            return `
                <tr>
                    <td>${user.full_name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td>${sub ? planNames[sub.plan_type] : '—'}</td>
                    <td>${sub ? `${mealsReceived}/${totalMeals}` : '—'}</td>
                    <td><span class="badge ${sub ? 'badge-active' : 'badge-expired'}">${sub ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn-icon" onclick="editUser('${user.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon" onclick="uploadReceiptForUser('${user.id}')" title="Upload Receipt"><i class="fas fa-receipt"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error('Users page error:', err);
        container.innerHTML = '<p>Error loading users</p>';
    }
}

async function editUser(userId) {
    const { data: user } = await supabaseClient.from('users').select('*').eq('id', userId).single();
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

async function uploadReceiptForUser(userId) {
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
    
    showToast('Receipt uploaded successfully');
    closeReceiptModal();
    if (document.getElementById('page_receipts').classList.contains('active')) {
        loadReceiptsPage();
    }
}