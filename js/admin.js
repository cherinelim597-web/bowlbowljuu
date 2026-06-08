// Admin credentials - 使用你的管理員帳號
const ADMIN_EMAIL = "admin@cherinebowl.com";

async function adminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Logging in...';
    btn.disabled = true;
    
    try {
        // 使用 Supabase 認證
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            alert('Invalid email or password: ' + error.message);
            return;
        }
        
        // 檢查是否是管理員
        const isAdmin = email === ADMIN_EMAIL;
        
        if (isAdmin) {
            sessionStorage.setItem('adminLoggedIn', 'true');
            sessionStorage.setItem('adminEmail', email);
            
            document.getElementById('adminLoginSection').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            loadAllUsers();
        } else {
            alert('You do not have admin privileges');
            await supabaseClient.auth.signOut();
        }
        
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function adminLogout() {
    supabaseClient.auth.signOut();
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminEmail');
    
    document.getElementById('adminLoginSection').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
}

function checkAdminAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        document.getElementById('adminLoginSection').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAllUsers();
    }
}

async function loadAllUsers() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading users:', error);
            userList.innerHTML = '<p>Error loading users.</p>';
            return;
        }
        
        if (!users || users.length === 0) {
            userList.innerHTML = '<p>No users found.</p>';
            return;
        }
        
        userList.innerHTML = '';
        
        for (const user of users) {
            const { data: subscription } = await supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single();
            
            let deliveries = [];
            if (subscription) {
                const { data: d } = await supabaseClient
                    .from('deliveries')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('subscription_id', subscription.id)
                    .order('delivery_date', { ascending: true });
                deliveries = d || [];
            }
            
            const planNames = {
                single: 'Single Purchase',
                weekly: 'Weekly Plan',
                '1month': '1 Month Plan',
                '2months': '2 Months Plan',
                '3months': '3 Months Plan'
            };
            
            const mealsReceived = subscription?.meals_received || 0;
            const totalMeals = subscription?.total_days || 0;
            
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <div class="user-header">
                    <span class="user-name">${escapeHtml(user.full_name || 'No Name')}</span>
                    <span class="user-plan">${subscription ? planNames[subscription.plan_type] : 'No active plan'}</span>
                </div>
                <div class="user-details">
                    <div>
                        <strong>📧 Email:</strong> ${escapeHtml(user.email)}<br>
                        <strong>📱 Phone:</strong> ${escapeHtml(user.phone || 'N/A')}<br>
                        <strong>📍 Address:</strong> ${escapeHtml(user.address || 'N/A')}
                    </div>
                    <div>
                        <strong>🍽️ Meals Received:</strong> ${mealsReceived} / ${totalMeals}<br>
                        <strong>📦 Remaining:</strong> ${totalMeals - mealsReceived}<br>
                        <strong>📅 Start:</strong> ${subscription ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}<br>
                        <strong>📅 End:</strong> ${subscription ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}
                    </div>
                </div>
                <div class="delivery-tracking" id="delivery-${user.id}">
                    <strong>🚚 Daily Delivery Tracking:</strong><br>
                    ${generateDeliveryCheckboxes(deliveries, user.id, subscription?.id)}
                </div>
                <button class="upload-receipt-btn" onclick="uploadReceiptForUser('${user.id}')">📄 Upload Receipt</button>
            `;
            userList.appendChild(userCard);
        }
    } catch (err) {
        console.error('Error:', err);
        userList.innerHTML = '<p>Error loading users.</p>';
    }
}

function generateDeliveryCheckboxes(deliveries, userId, subscriptionId) {
    if (!deliveries || deliveries.length === 0) {
        return '<p>No deliveries scheduled.</p>';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const relevantDeliveries = deliveries.filter(d => {
        const deliveryDate = new Date(d.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= -1 && diffDays < 14;
    });
    
    if (relevantDeliveries.length === 0) {
        return '<p>No upcoming deliveries.</p>';
    }
    
    return relevantDeliveries.map(delivery => {
        const deliveryDate = new Date(d.delivery_date);
        const isDelivered = delivery.status === 'delivered';
        const isPast = deliveryDate < today && !isDelivered;
        const dateStr = deliveryDate.toLocaleDateString();
        
        return `
            <div class="delivery-checkbox">
                <input type="checkbox" 
                       id="delivery-${delivery.id}" 
                       ${isDelivered ? 'checked disabled' : ''}
                       ${isPast ? 'disabled' : ''}
                       onchange="markDelivery('${delivery.id}', this.checked, '${userId}', '${subscriptionId}')">
                <label for="delivery-${delivery.id}">
                    ${dateStr} - Meal #${delivery.meal_number}
                    ${isDelivered ? '✓ Delivered' : ''}
                </label>
            </div>
        `;
    }).join('');
}

async function markDelivery(deliveryId, isChecked, userId, subscriptionId) {
    if (!isChecked) return;
    
    try {
        const { error } = await supabaseClient
            .from('deliveries')
            .update({ status: 'delivered' })
            .eq('id', deliveryId);
        
        if (error) {
            alert('Error: ' + error.message);
            return;
        }
        
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('meals_received')
            .eq('id', subscriptionId)
            .single();
        
        const newCount = (subscription?.meals_received || 0) + 1;
        
        await supabaseClient
            .from('subscriptions')
            .update({ meals_received: newCount })
            .eq('id', subscriptionId);
        
        alert('Delivery marked as delivered!');
        loadAllUsers();
        
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to mark delivery');
    }
}

async function uploadReceiptForUser(userId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_receipt_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);
        
        if (uploadError) {
            alert('Upload failed: ' + uploadError.message);
            return;
        }
        
        const { data: urlData } = supabaseClient.storage
            .from('receipts')
            .getPublicUrl(fileName);
        
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();
        
        if (subscription) {
            await supabaseClient
                .from('receipts')
                .insert({
                    user_id: userId,
                    subscription_id: subscription.id,
                    amount: 0,
                    receipt_url: urlData.publicUrl,
                    payment_method: 'admin_upload',
                    created_at: new Date()
                });
        }
        
        alert('Receipt uploaded successfully!');
        loadAllUsers();
    };
    
    input.click();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
});