// ============================================
// 每日配送模組
// ============================================

async function loadDeliveriesPage() {
    const container = document.getElementById('page_deliveries');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data: deliveries } = await supabaseClient
            .from('deliveries')
            .select(`
                *,
                users (full_name, email, phone, address)
            `)
            .eq('delivery_date', today)
            .order('meal_number', { ascending: true });
        
        if (!deliveries || deliveries.length === 0) {
            container.innerHTML = `
                <div class="table-container">
                    <h3>Today's Deliveries (${today})</h3>
                    <p style="text-align: center; padding: 40px;">No deliveries scheduled for today.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="table-container">
                <h3>Today's Deliveries (${today})</h3>
                <table>
                    <thead>
                        <tr><th>User</th><th>Phone</th><th>Address</th><th>Meal #</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody id="deliveryTableBody"></tbody>
                </table>
            </div>
        `;
        
        const tbody = document.getElementById('deliveryTableBody');
        tbody.innerHTML = deliveries.map(d => `
            <tr>
                <td>${d.users?.full_name || 'N/A'}<br><small style="color:#8a9abb">${d.users?.email || ''}</small></td>
                <td>${d.users?.phone || 'N/A'}</td>
                <td>${d.users?.address || 'N/A'}</td>
                <td>#${d.meal_number}</td>
                <td><span class="badge ${d.status === 'delivered' ? 'badge-active' : 'badge-pending'}">${d.status || 'pending'}</span></td>
                <td>
                    ${d.status !== 'delivered' ? `<button class="btn-deliver" onclick="markDelivered('${d.id}', '${d.user_id}', '${d.subscription_id}')">✓ Mark Delivered</button>` : '✓ Done'}
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error('Deliveries page error:', err);
        container.innerHTML = '<p>Error loading deliveries</p>';
    }
}

async function markDelivered(deliveryId, userId, subscriptionId) {
    try {
        // 更新配送狀態
        await supabaseClient.from('deliveries').update({ status: 'delivered' }).eq('id', deliveryId);
        
        // 更新訂閱的已收到餐數
        const { data: sub } = await supabaseClient.from('subscriptions').select('meals_received').eq('id', subscriptionId).single();
        const newCount = (sub?.meals_received || 0) + 1;
        await supabaseClient.from('subscriptions').update({ meals_received: newCount }).eq('id', subscriptionId);
        
        showToast('Delivery marked as delivered!');
        loadDeliveriesPage();
        if (document.getElementById('page_dashboard').classList.contains('active')) loadDashboard();
        
    } catch (err) {
        console.error('Error marking delivery:', err);
        showToast('Failed to mark delivery', 'error');
    }
}