// ============================================
// 用戶儀表板（使用 localStorage）
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

// 登出
function logout() {
    localStorage.removeItem('currentUser');
    location.href = 'login.html';
}

// 加載儀表板
async function loadDashboard() {
    const user = getCurrentUser();
    
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    // 顯示用戶名稱
    document.getElementById('userName').innerText = user.full_name || user.email;
    document.getElementById('userNameZh').innerText = user.full_name || user.email;
    
    // 獲取訂閱信息
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
    
    if (!subscription) {
        location.href = 'onboarding.html';
        return;
    }
    
    // 顯示方案詳情
    const planNames = {
        single: 'Single Purchase',
        weekly: 'Weekly Plan',
        '1month': '1 Month Plan',
        '2months': '2 Months Plan',
        '3months': '3 Months Plan'
    };
    
    const startDate = new Date(subscription.start_date);
    const endDate = new Date(subscription.end_date);
    const today = getMalaysiaDate();
    
    const totalDays = subscription.total_days;
    const mealsReceived = subscription.meals_received || 0;
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const progressPercent = (mealsReceived / totalDays) * 100;
    
    document.getElementById('planDetails').innerHTML = `
        <p>📋 <strong>Plan:</strong> ${planNames[subscription.plan_type]}</p>
        <p>📅 <strong>Period:</strong> ${formatDisplayDate(subscription.start_date)} - ${formatDisplayDate(subscription.end_date)}</p>
        <p>🍽️ <strong>Meals:</strong> ${mealsReceived} / ${totalDays} received</p>
        <p>💰 <strong>Price:</strong> RM ${subscription.total_price}</p>
    `;
    
    document.getElementById('mealsReceived').innerText = mealsReceived;
    document.getElementById('totalMeals').innerText = totalDays;
    document.getElementById('mealsReceivedZh').innerText = mealsReceived;
    document.getElementById('totalMealsZh').innerText = totalDays;
    document.getElementById('daysRemaining').innerText = daysRemaining > 0 ? daysRemaining : 0;
    document.getElementById('daysRemainingZh').innerText = daysRemaining > 0 ? daysRemaining : 0;
    document.getElementById('progressBar').style.width = `${progressPercent}%`;
    
    // 加載配送日程 - 使用馬來西亞時間判斷今天
    const todayStr = getTodayString();
    const { data: deliveries } = await supabaseClient
        .from('deliveries')
        .select('*')
        .eq('user_id', user.id)
        .eq('subscription_id', subscription.id)
        .order('delivery_date', { ascending: true })
        .limit(7);
    
    const deliveryList = document.getElementById('deliverySchedule');
    if (deliveries && deliveries.length > 0) {
        deliveryList.innerHTML = deliveries.map(d => {
            const deliveryDate = new Date(d.delivery_date);
            const isToday = d.delivery_date === todayStr;
            let statusText = d.status === 'delivered' ? '✅ Delivered' : (isToday ? '🚚 Today' : '📅 Upcoming');
            return `
                <div class="delivery-item">
                    <span class="delivery-date">${formatDisplayDate(d.delivery_date)}</span>
                    <span>Meal #${d.meal_number}</span>
                    <span class="delivery-status">${statusText}</span>
                </div>
            `;
        }).join('');
    } else {
        deliveryList.innerHTML = '<p>No upcoming deliveries scheduled.</p>';
    }
}

// 檢查訂閱狀態
async function checkSubscriptionStatus() {
    const user = getCurrentUser();
    if (!user) return;
    
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
    
    if (subscription) {
        const endDate = new Date(subscription.end_date);
        const today = getMalaysiaDate();
        if (endDate < today) {
            await supabaseClient
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('id', subscription.id);
            alert('Your subscription has expired. Please renew.');
            location.href = 'onboarding.html';
        }
    }
}

// 加載數據
loadDashboard();
checkSubscriptionStatus();