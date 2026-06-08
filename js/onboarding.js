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
            
            // Show payment section
            document.getElementById('paymentSection').style.display = 'block';
            
            // Update plan info
            const planNames = {
                single: 'Single Purchase (1 meal)',
                weekly: 'Weekly Plan (7 meals)',
                '1month': '1 Month Plan (30 meals)',
                '2months': '2 Months Plan (60 meals)',
                '3months': '3 Months Plan (90 meals)'
            };
            
            document.getElementById('selectedPlanInfo').innerHTML = `
                <strong>Selected Plan:</strong> ${planNames[selectedPlan]}<br>
                <strong>Total Price:</strong> NT$${price}
            `;
        }
    });
});

// Confirm subscription
async function confirmPlan() {
    if (!selectedPlanData) {
        alert('Please select a plan first');
        return;
    }
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        location.href = 'login.html';
        return;
    }
    
    const paymentMethod = document.getElementById('paymentMethod').value;
    const receiptFile = document.getElementById('receiptUpload').files[0];
    
    let receiptUrl = null;
    
    // Upload receipt if provided
    if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('receipts')
            .upload(fileName, receiptFile);
        
        if (!uploadError) {
            const { data: urlData } = supabaseClient.storage
                .from('receipts')
                .getPublicUrl(fileName);
            receiptUrl = urlData.publicUrl;
        }
    }
    
    const startDate = new Date();
    let endDate = new Date();
    endDate.setDate(endDate.getDate() + selectedPlanData.days);
    
    // Create subscription
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
            payment_method: paymentMethod,
            created_at: new Date()
        })
        .select()
        .single();
    
    if (subError) {
        console.error('Subscription error:', subError);
        alert('Failed to create subscription: ' + subError.message);
        return;
    }
    
    // Create receipt record
    if (receiptUrl) {
        await supabaseClient
            .from('receipts')
            .insert({
                user_id: user.id,
                subscription_id: subscription.id,
                amount: selectedPlanData.price,
                receipt_url: receiptUrl,
                payment_method: paymentMethod,
                created_at: new Date()
            });
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