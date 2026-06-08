// ============================================
// 方案選擇 - 直接創建訂閱（無需付款）
// ============================================

// 等待頁面加載完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('Onboarding page loaded');
    
    // 綁定所有方案卡片的點擊事件
    const planCards = document.querySelectorAll('.plan-card');
    console.log('Found plan cards:', planCards.length);
    
    if (planCards.length === 0) {
        console.log('No plan cards found - check HTML');
        return;
    }
    
    planCards.forEach(card => {
        card.addEventListener('click', function(e) {
            console.log('Plan card clicked');
            
            // 獲取方案數據
            const plan = this.dataset.plan;
            const days = parseInt(this.dataset.days);
            const price = parseInt(this.dataset.price);
            
            if (!plan) {
                console.error('No plan data found');
                return;
            }
            
            console.log('Selected plan:', plan, days, price);
            
            // 直接確認方案（不需要付款）
            confirmPlanDirect(plan, days, price);
        });
    });
});

// 直接確認方案（不需要付款，不需要上傳收據）
async function confirmPlanDirect(plan, days, price) {
    console.log('Confirming plan:', plan, days, price);
    
    // 獲取當前用戶
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        console.error('Auth error:', userError);
        alert('Please login first');
        location.href = 'login.html';
        return;
    }
    
    console.log('User:', user.email);
    
    const startDate = new Date();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    // 檢查是否已有 active 訂閱
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
    
    // 創建訂閱（直接 active，無需付款）
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
            user_id: user.id,
            plan_type: plan,
            total_days: days,
            meals_received: 0,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            total_price: price,
            payment_method: 'pending',
            created_at: new Date()
        })
        .select()
        .single();
    
    if (subError) {
        console.error('Subscription error:', subError);
        alert('Failed to create subscription: ' + subError.message);
        return;
    }
    
    console.log('Subscription created:', subscription.id);
    
    // 創建配送日程
    const deliveries = [];
    for (let i = 0; i < days; i++) {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + i);
        deliveries.push({
            user_id: user.id,
            subscription_id: subscription.id,
            delivery_date: deliveryDate.toISOString().split('T')[0],
            status: i === 0 ? 'pending' : 'upcoming',
            meal_number: i + 1
        });
    }
    
    const { error: deliveryError } = await supabaseClient
        .from('deliveries')
        .insert(deliveries);
    
    if (deliveryError) {
        console.error('Delivery error:', deliveryError);
        // 即使配送創建失敗，訂閱已經成功
        alert('Subscription created! Welcome to Healthy Bowl!');
        location.href = 'dashboard.html';
        return;
    }
    
    alert('Subscription successful! Welcome to Healthy Bowl!');
    location.href = 'dashboard.html';
}