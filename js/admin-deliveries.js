// ============================================
// 每日配送模組 - 顯示今/明/後天
// ============================================

// ADMIN_EMAIL 已在 admin-common.js 中定義

async function loadDeliveriesPage() {
    const container = document.getElementById('page_deliveries');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        const today = new Date();
        const dates = [
            { name: '今天', date: today, offset: 0 },
            { name: '明天', date: new Date(today.setDate(today.getDate() + 1)), offset: 1 },
            { name: '後天', date: new Date(today.setDate(today.getDate() + 1)), offset: 2 }
        ];
        
        // 重新計算日期避免引用問題
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        const dayAfterStr = dayAfter.toISOString().split('T')[0];
        
        const deliveriesByDate = {};
        
        for (const dateStr of [todayStr, tomorrowStr, dayAfterStr]) {
            const { data: deliveries } = await supabaseClient
                .from('deliveries')
                .select(`
                    *,
                    users (id, full_name, email, phone, address)
                `)
                .eq('delivery_date', dateStr)
                .order('meal_number', { ascending: true });
            
            deliveriesByDate[dateStr] = deliveries?.filter(d => d.users?.email !== ADMIN_EMAIL) || [];
        }
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
                ${renderDeliveryCard('今天', todayStr, deliveriesByDate[todayStr])}
                ${renderDeliveryCard('明天', tomorrowStr, deliveriesByDate[tomorrowStr])}
                ${renderDeliveryCard('後天', dayAfterStr, deliveriesByDate[dayAfterStr])}
            </div>
        `;
        
    } catch (err) {
        console.error('Deliveries page error:', err);
        container.innerHTML = '<div class="table-container"><p>加載失敗</p></div>';
    }
}

function renderDeliveryCard(title, dateStr, deliveries) {
    const deliveryCount = deliveries?.length || 0;
    const completedCount = deliveries?.filter(d => d.status === 'delivered').length || 0;
    
    return `
        <div class="table-container" style="padding: 0; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1a2a3a, #0f1a2a); padding: 16px 20px;">
                <h3 style="margin: 0;">📅 ${title}</h3>
                <p style="margin: 5px 0 0; color: #8a9abb; font-size: 13px;">${dateStr}</p>
                <div style="margin-top: 10px;">
                    <span class="badge badge-active">📦 共 ${deliveryCount} 單</span>
                    <span class="badge badge-gold">✅ 已完成 ${completedCount}</span>
                </div>
            </div>
            <div style="max-height: 500px; overflow-y: auto; padding: 16px;">
                ${deliveries && deliveries.length > 0 ? deliveries.map(d => `
                    <div class="delivery-item" style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <strong style="color: #c8a15e;">${escapeHtml(d.users?.full_name || 'N/A')}</strong>
                                <div style="font-size: 12px; color: #8a9abb;">📧 ${escapeHtml(d.users?.email || '')}</div>
                                <div style="font-size: 12px; color: #8a9abb;">📱 ${escapeHtml(d.users?.phone || 'N/A')}</div>
                                <div style="font-size: 12px; color: #8a9abb; max-width: 200px;">📍 ${escapeHtml(d.users?.address || 'N/A')}</div>
                            </div>
                            <div style="text-align: right;">
                                <div><span class="badge ${d.status === 'delivered' ? 'badge-active' : 'badge-pending'}">${d.status === 'delivered' ? '✅ 已送達' : '🚚 待配送'}</span></div>
                                <div style="margin-top: 8px;"><small>餐點 #${d.meal_number}</small></div>
                                ${d.status !== 'delivered' ? `<button class="btn-deliver" style="margin-top: 8px;" onclick="markDelivered('${d.id}', '${d.user_id}', '${d.subscription_id}')">✓ 標記送達</button>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('') : '<div style="text-align: center; padding: 40px; color: #8a9abb;">🎉 今日無配送任務</div>'}
            </div>
        </div>
    `;
}

async function markDelivered(deliveryId, userId, subscriptionId) {
    try {
        const { error: deliveryError } = await supabaseClient
            .from('deliveries')
            .update({ status: 'delivered' })
            .eq('id', deliveryId);
        
        if (deliveryError) throw deliveryError;
        
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
        
        showToast('配送已標記為送達！');
        loadDeliveriesPage();
        
        if (document.getElementById('page_dashboard')?.classList.contains('active')) {
            loadDashboard();
        }
        
    } catch (err) {
        console.error('Error marking delivery:', err);
        showToast('操作失敗: ' + err.message, 'error');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}