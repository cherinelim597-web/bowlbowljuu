// ============================================
// 每日配送模組 - 不顯示管理員
// ============================================

const ADMIN_EMAIL_DELIVERY = "admin@cherinebowl.com";

async function loadDeliveriesPage() {
    const container = document.getElementById('page_deliveries');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // 獲取今日配送，排除管理員
        const { data: deliveries, error } = await supabaseClient
            .from('deliveries')
            .select(`
                *,
                users (id, full_name, email, phone, address)
            `)
            .eq('delivery_date', today)
            .order('meal_number', { ascending: true });
        
        if (error) {
            console.error('Error loading deliveries:', error);
            container.innerHTML = '<div class="table-container"><p>Error loading deliveries</p></div>';
            return;
        }
        
        // 過濾掉管理員的配送
        const filteredDeliveries = deliveries?.filter(d => d.users?.email !== ADMIN_EMAIL_DELIVERY) || [];
        
        if (filteredDeliveries.length === 0) {
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
                <p style="margin-bottom: 16px; color: #8a9abb;">Total: ${filteredDeliveries.length} deliveries</p>
                <div style="overflow-x: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr><th>User</th><th>Phone</th><th>Address</th><th>Meal #</th><th>Status</th><th>Action</th></tr>
                        </thead>
                        <tbody id="deliveryTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        const tbody = document.getElementById('deliveryTableBody');
        tbody.innerHTML = filteredDeliveries.map(d => `
            <tr>
                <td><strong>${escapeHtml(d.users?.full_name || 'N/A')}</strong><br><small style="color:#8a9abb">${escapeHtml(d.users?.email || '')}</small></td>
                <td>${escapeHtml(d.users?.phone || 'N/A')}</td>
                <td>${escapeHtml(d.users?.address || 'N/A')}</td>
                <td>#${d.meal_number}</td>
                <td><span class="badge ${d.status === 'delivered' ? 'badge-active' : 'badge-pending'}">${d.status || 'pending'}</span></td>
                <td>
                    ${d.status !== 'delivered' ? `<button class="btn-deliver" onclick="markDelivered('${d.id}', '${d.user_id}', '${d.subscription_id}')">✓ Mark Delivered</button>` : '<span style="color:#2ed15a;">✓ Completed</span>'}
                </td>
            </tr>
        `).join('');
        
    } catch (err) {
        console.error('Deliveries page error:', err);
        container.innerHTML = '<div class="table-container"><p>Error loading deliveries</p></div>';
    }
}

async function markDelivered(deliveryId, userId, subscriptionId) {
    try {
        // 更新配送狀態
        const { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .update({ status: 'delivered' })
            .eq('id', deliveryId);
        
        if (deliveryError) throw deliveryError;
        
        // 更新訂閱的已收到餐數
        const { data: sub } = await supabaseClient
            .from('subscriptions')
            .select('meals_received')
            .eq('id', subscriptionId)
            .single();
        
        const newCount = (sub?.meals_received || 0) + 1;
        
        await supabaseClient
            .from('subscriptions')
            .update({ meals_received: newCount })
            .eq('id', subscriptionId);
        
        showToast('Delivery marked as delivered!');
        loadDeliveriesPage();
        
        // 如果儀表板當前可見，也刷新它
        if (document.getElementById('page_dashboard')?.classList.contains('active')) {
            loadDashboard();
        }
        
    } catch (err) {
        console.error('Error marking delivery:', err);
        showToast('Failed to mark delivery: ' + err.message, 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}