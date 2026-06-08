let selectedPlan = null;
let selectedPlanData = null;

// Plan selection handling
document.querySelectorAll('.plan-card').forEach(card => {
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-plan') || e.target.classList.contains('btn-small')) {
            // Get plan data
            selectedPlan = card.dataset.plan;
            const days = parseInt(card.dataset.days);
            const price = parseInt(card.dataset.price);
            
            selectedPlanData = { plan: selectedPlan, days, price };
            
            // Highlight selected plan
            document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            // 直接確認方案，不需要顯示付款區
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
    
    // Create subscription (pending payment status)
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
            user_id: user.id,
            plan_type: selectedPlanData.plan,
            total_days: selectedPlanData.days,
            meals_received: 0,
            start_date: startDate,
            end_date: endDate,
            status: 'active',  // 直接設為 active，不需要付款
            total_price: selectedPlanData.price,
            payment_method: 'pending',  // 標記為待付款
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
    
    await supabaseClient
        .from('deliveries')
        .insert(deliveries);
    
    alert('Subscription successful! Welcome to Healthy Bowl!');
    location.href = 'dashboard.html';
}