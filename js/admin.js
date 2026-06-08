// Admin credentials (in production, use proper authentication)
const ADMIN_EMAIL = "admin@healthybowl.com";
const ADMIN_PASSWORD = "admin123";

function adminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        document.getElementById('adminLoginSection').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        loadAllUsers();
    } else {
        alert('Invalid admin credentials');
    }
}

function adminLogout() {
    document.getElementById('adminLoginSection').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
}

async function loadAllUsers() {
    const { data: users } = await supabaseClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
    
    const userList = document.getElementById('userList');
    
    if (!users || users.length === 0) {
        userList.innerHTML = '<p>No users found.</p>';
        return;
    }
    
    userList.innerHTML = '';
    
    for (const user of users) {
        // Get user's active subscription
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();
        
        // Get deliveries
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
            single: 'Single',
            weekly: 'Weekly',
            '1month': '1 Month',
            '2months': '2 Months',
            '3months': '3 Months'
        };
        
        const mealsReceived = subscription?.meals_received || 0;
        const totalMeals = subscription?.total_days || 0;
        const mealsRemaining = totalMeals - mealsReceived;
        
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-header">
                <span class="user-name">${user.full_name}</span>
                <span class="user-plan">${subscription ? planNames[subscription.plan_type] : 'No active plan'}</span>
            </div>
            <div class="user-details">
                <div>
                    <strong>📧 Email:</strong> ${user.email}<br>
                    <strong>📱 Phone:</strong> ${user.phone}<br>
                    <strong>📍 Address:</strong> ${user.address}
                </div>
                <div>
                    <strong>🍽️ Meals:</strong> ${mealsReceived} / ${totalMeals} received<br>
                    <strong>📦 Remaining:</strong> ${mealsRemaining} meals<br>
                    <strong>📅 Started:</strong> ${subscription ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}
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
}

function generateDeliveryCheckboxes(deliveries, userId, subscriptionId) {
    if (!deliveries || deliveries.length === 0) {
        return '<p>No deliveries scheduled.</p>';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const next7Days = deliveries.filter(d => {
        const deliveryDate = new Date(d.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((deliveryDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays < 7;
    });
    
    return next7Days.map(delivery => {
        const deliveryDate = new Date(delivery.delivery_date);
        const isDelivered = delivery.status === 'delivered';
        const dateStr = deliveryDate.toLocaleDateString();
        
        return `
            <div class="delivery-checkbox">
                <input type="checkbox" 
                       id="delivery-${delivery.id}" 
                       ${isDelivered ? 'checked disabled' : ''}
                       onchange="markDelivery('${delivery.id}', this.checked, '${userId}', '${subscriptionId}')">
                <label for="delivery-${delivery.id}">
                    ${dateStr} - Meal #${delivery.meal_number}
                    ${isDelivered ? '(Delivered)' : '(Mark as delivered)'}
                </label>
            </div>
        `;
    }).join('');
}

async function markDelivery(deliveryId, isChecked, userId, subscriptionId) {
    if (!isChecked) return;
    
    // Update delivery status
    const { error } = await supabaseClient
        .from('deliveries')
        .update({ status: 'delivered' })
        .eq('id', deliveryId);
    
    if (error) {
        alert('Error updating delivery: ' + error.message);
        return;
    }
    
    // Update meals received count in subscription
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('meals_received')
        .eq('id', subscriptionId)
        .single();
    
    const newCount = (subscription.meals_received || 0) + 1;
    
    await supabaseClient
        .from('subscriptions')
        .update({ meals_received: newCount })
        .eq('id', subscriptionId);
    
    alert('Delivery marked as delivered!');
    loadAllUsers(); // Refresh the list
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
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, file);
        
        if (uploadError) {
            alert('Upload failed: ' + uploadError.message);
            return;
        }
        
        const { data: urlData } = supabaseClient.storage
            .from('receipts')
            .getPublicUrl(fileName);
        
        // Get user's active subscription
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

// Refresh user list every 30 seconds
setInterval(() => {
    if (document.getElementById('adminDashboard').style.display === 'block') {
        loadAllUsers();
    }
}, 30000);