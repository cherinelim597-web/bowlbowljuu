// Register Function
async function register() {
    const fullName = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!fullName || !phone || !address || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Creating account...';
    btn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone,
                    address: address
                }
            }
        });
        
        if (error) {
            alert(error.message);
            return;
        }
        
        // Create user profile
        const { error: profileError } = await supabaseClient
            .from('users')
            .insert({
                id: data.user.id,
                full_name: fullName,
                phone: phone,
                address: address,
                email: email,
                created_at: new Date()
            });
        
        if (profileError) {
            console.error('Profile error:', profileError);
        }
        
        alert('Registration successful! Please login');
        location.href = "login.html";
        
    } catch (err) {
        console.error('Registration error:', err);
        alert('Registration failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Login Function
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Logging in...';
    btn.disabled = true;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            alert('Invalid email or password');
            return;
        }
        
        // Check if user has an active subscription
        const { data: subscription } = await supabaseClient
            .from('subscriptions')
            .select('*')
            .eq('user_id', data.user.id)
            .eq('status', 'active')
            .single();
        
        if (subscription) {
            location.href = "dashboard.html";
        } else {
            location.href = "onboarding.html";
        }
        
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed, please try again');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Logout Function
async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        location.href = 'login.html';
    }
}

// Check if user is logged in
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user && !window.location.pathname.includes('login') && 
        !window.location.pathname.includes('register') && 
        !window.location.pathname.includes('index.html')) {
        location.href = 'login.html';
    }
    return user;
}