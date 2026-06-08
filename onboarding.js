// ============================================
// 方案選擇 - 直接創建訂閱（無需付款）
// 完整版 - 無 paymentSection 相關代碼
// ============================================

let selectedPlan = null;
let selectedPlanData = null;

// 頁面加載完成後綁定事件
document.addEventListener('DOMContentLoaded', function() {
    // 綁定所有方案卡片的點擊事件
    const planCards = document.querySelectorAll('.plan-card');
    
    if (planCards.length === 0) {
        console.log('No plan cards found');
        return;
    }
    
    planCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // 獲取卡片元素
            const targetCard = this;
            
            // 獲取方案數據
            selectedPlan = targetCard.dataset.plan;
            const days = parseInt(targetCard.dataset.days);
            const price = parseInt(targetCard.dataset.price);
            
            if (!selectedPlan) {
                console.error('No plan data found');
                return;
            }
            
            selectedPlanData = { plan: selectedPlan, days, price };
            
            // 高亮選中的方案
            planCards.forEach(c => c.classList.remove('selected'));
            targetCard.classList.add('selected');
            
            // 直接確認方案
            confirmPlanDirect();
        });
    });
});

// 直接確認方案（不需要付款）
async function confirmPlanDirect() {
    if (!selectedPlanData) {
        alert('Please select a plan first');
        return;
    }
    
    // 獲取當前用戶
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        console.error('Auth error:', userError);
        alert('Please login first');
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
        .maybeSingle();  // 使用 maybeSingle 避免錯誤
    
    if (existingSubscription) {
        alert('You already have an active subscription!');
        location.href = 'dashboard.html';
        return;
    }
    
    // 創建訂閱
    const { data: subscription, error: subError } = await supabaseClient
        .from('subscriptions')
        .insert({
            user_id: user.id,
            plan_type: selectedPlanData.plan,
            total_days: selectedPlanData.days,
            meals_received: 0,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
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
    
    // 創建配送日程
    const deliveries = [];
    for (let i = 0; i < selectedPlanData.days; i++) {
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