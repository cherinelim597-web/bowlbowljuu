// Load dashboard data
async function loadDashboard() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    // Get user profile
    const { data: profile } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (profile) {
        document.getElementById('userName').innerText = profile.full_name;
        document.getElementById('userNameZh').innerText = profile.full_name;
    }
    
    // Get active subscription
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
    
    if (!subscription) {
        location.href = 'onboarding.html';
        return;
    }
    
    // Display plan details
    const planNames = {
        single: 'Single Purchase',
        weekly: 'Weekly Plan',
        '1month': '1 Month Plan',
        '2months': '2 Months Plan',
        '3months': '3 Months Plan'
    };
    
    const startDate = new Date(subscription.start_date);
    const endDate = new Date(subscription.end_date);
    const today = new Date();
    
    const totalDays = subscription.total_days;
    const mealsReceived = subscription.meals_received || 0;
    const mealsRemaining = totalDays - mealsReceived;
    
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const progressPercent = (mealsReceived / totalDays) * 100;
    
    document.getElementById('planDetails').innerHTML = `
        <p>📋 <strong>Plan:</strong> ${planNames[subscription.plan_type]}</p>
        <p>📅 <strong>Period:</strong> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
        <p>🍽️ <strong>Meals:</strong> ${mealsReceived} / ${totalDays} received</p>
        <p>⏰ <strong>Status:</strong> Active</p>
    `;
    
    document.getElementById('mealsReceived').innerText = mealsReceived;
    document.getElementById('totalMeals').innerText = totalDays;
    document.getElementById('mealsReceivedZh').innerText = mealsReceived;
    document.getElementById('totalMealsZh').innerText = totalDays;
    document.getElementById('daysRemaining').innerText = daysRemaining > 0 ? daysRemaining : 0;
    document.getElementById('daysRemainingZh').innerText = daysRemaining > 0 ? daysRemaining : 0;
    document.getElementById('progressBar').style.width = `${progressPercent}%`;
    
    // Load upcoming deliveries
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
            const isDelivered = d.status === 'delivered';
            const isToday = deliveryDate.toDateString() === today.toDateString();
            
            let statusText = '';
            let statusClass = '';
            
            if (isDelivered) {
                statusText = '✅ Delivered';
                statusClass = 'delivered';
            } else if (isToday) {
                statusText = '🚚 Today';
                statusClass = 'pending';
            } else {
                statusText = '📅 Upcoming';
                statusClass = 'upcoming';
            }
            
            return `
                <div class="delivery-item">
                    <span class="delivery-date">${deliveryDate.toLocaleDateString()}</span>
                    <span>Meal #${d.meal_number}</span>
                    <span class="delivery-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');
    } else {
        deliveryList.innerHTML = '<p>No upcoming deliveries scheduled.</p>';
    }
}

// Check subscription status periodically
async function checkSubscriptionStatus() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    
    const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
    
    if (subscription) {
        const endDate = new Date(subscription.end_date);
        const today = new Date();
        
        if (endDate < today) {
            await supabaseClient
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('id', subscription.id);
            
            alert('Your subscription has expired. Please renew to continue receiving meals.');
            location.href = 'onboarding.html';
        }
    }
}

// Load data
loadDashboard();
checkSubscriptionStatus();
setInterval(checkSubscriptionStatus, 86400000); // Check daily