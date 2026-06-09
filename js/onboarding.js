// ============================================
// 方案選擇（使用 localStorage）
// ============================================

// 生成訂單號
function generateOrderNo() {
    const now = getMalaysiaDate();
    const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
    const randomNum = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    return `ORD${dateStr}${randomNum}`;
}

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

async function confirmPlan(plan, days, price) {
    const user = getCurrentUser();
    
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    // 檢查是否已有訂閱
    const { data: existingSubscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
    
    if (existingSubscription) {
        alert('You already have an active subscription!');
        location.href = 'dashboard.html';
        return;
    }
    
    // 生成唯一訂單號
    let orderNo = generateOrderNo();
    let isUnique = false;
    while (!isUnique) {
        const { data: existing } = await supabaseClient
            .from('subscriptions')
            .select('order_no')
            .eq('order_no', orderNo)
            .maybeSingle();
        if (!existing) {
            isUnique = true;
        } else {
            orderNo = generateOrderNo();
        }
    }
    
    // 使用馬來西亞時間
    const startDate = getMalaysiaDate();
    let endDate = getMalaysiaDate();
    endDate.setDate(endDate.getDate() + days);
    
    // 創建訂閱
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
            user_id: user.id,
            plan_type: plan,
            total_days: days,
            meals_received: 0,
            start_date: formatMalaysiaDate(startDate),
            end_date: formatMalaysiaDate(endDate),
            status: 'active',
            total_price: price,
            payment_method: 'pending',
            payment_status: 'unpaid',
            order_no: orderNo,
            created_at: new Date()
        })
        .select()
        .single();
    
    if (subError) {
        alert('Failed to create subscription: ' + subError.message);
        return;
    }
    
    // 創建配送日程
    const deliveries = [];
    for (let i = 0; i < days; i++) {
        const deliveryDate = getMalaysiaDate();
        deliveryDate.setDate(deliveryDate.getDate() + i);
        deliveries.push({
            user_id: user.id,
            subscription_id: subscription.id,
            delivery_date: formatMalaysiaDate(deliveryDate),
            status: i === 0 ? 'pending' : 'upcoming',
            meal_number: i + 1
        });
    }
    
    await supabaseClient.from('deliveries').insert(deliveries);
    
    alert(`Subscription successful!\n訂單號：${orderNo}\nWelcome to Healthy Bowl!`);
    location.href = 'dashboard.html';
}

// 綁定卡片點擊事件
document.querySelectorAll('.plan-card').forEach(card => {
    const handleSelect = () => {
        const plan = card.dataset.plan;
        const days = parseInt(card.dataset.days);
        const price = parseFloat(card.dataset.price);
        if (plan) confirmPlan(plan, days, price);
    };
    
    card.addEventListener('click', handleSelect);
    const btn = card.querySelector('.select-plan');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); handleSelect(); });
});