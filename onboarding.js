// ============================================
// 方案選擇 - 直接創建訂閱（無需付款）
// ============================================

let selectedPlan = null;
let selectedPlanData = null;

// Plan selection handling
document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', (e) => {
        // 點擊按鈕或卡片時觸發
        if (e.target.classList.contains('select-plan') || e.target.classList.contains('btn-small') || e.target.closest('.plan-card')) {
            // 獲取卡片元素
            const targetCard = e.target.closest('.plan-card');
            if (!targetCard) return;
            
            // Get plan data
            selectedPlan = targetCard.dataset.plan;
            const days = parseInt(targetCard.dataset.days);
            const price = parseInt(targetCard.dataset.price);
            
            selectedPlanData = { plan: selectedPlan, days, price };
            
            // Highlight selected plan
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
            targetCard.classList.add('selected');
            
            // 直接確認方案
            confirmPlanDirect();
        }
    });
});

// 直接確認方案（不需要付款）
async function confirmPlanDirect() {
    if (!selectedPlanData) {
        alert('Please select a plan first');
        return;
    }
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    const startDate = new Date();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + selectedPlanData.days);
    
    // 檢查是否已有 active 訂閱
    const { data: existingSubscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
    
    if (existingSubscription) {
        alert('You already have an active subscription!');
        location.href = 'dashboard.html';
        return;
    }
    
    // Create subscription (直接 active，無需付款)
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
            user_id: user.id,
            plan_type: selectedPlanData.plan,
            total_days: selectedPlanData.days,
            meals_received: 0,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            total_price: selectedPlanData.price,
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
    
    // Create delivery schedule
    const deliveries = [];
    for (let i = 0; i < selectedPlanData.days; i++) {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + i);
        deliveries.push({
            user_id: user.id,
            subscription_id: subscription.id,
            delivery_date: deliveryDate,
            status: i === 0 ? 'pending' : 'upcoming',
            meal_number: i + 1
        });
    }
    
    const { error: deliveryError } = await supabaseClient
        .from('deliveries')
        .insert(deliveries);
    
    if (deliveryError) {
        console.error('Delivery error:', deliveryError);
        alert('Subscription created but delivery schedule failed. Please contact support.');
        location.href = 'dashboard.html';
        return;
    }
    
    alert('Subscription successful! Welcome to Healthy Bowl!');
    location.href = 'dashboard.html';
}