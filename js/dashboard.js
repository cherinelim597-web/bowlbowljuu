// Load user information / 載入使用者資訊
async function loadUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error || !user) {
            console.error('Auth error / 認證錯誤:', error);
            location.href = 'login.html';
            return;
        }
        
        // Display email / 顯示電子郵件
        const emailElement = document.getElementById('userEmail');
        if (emailElement) {
            emailElement.innerText = user.email;
        }
        
        // Load full profile from database / 從資料庫載入完整個人資料
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('full_name, phone')
            .eq('id', user.id)
            .single();
        
        if (!profileError && profile) {
            const nameElement = document.getElementById('userName');
            if (nameElement) {
                nameElement.innerText = profile.full_name;
            }
            
            const phoneElement = document.getElementById('userPhone');
            if (phoneElement) {
                phoneElement.innerText = profile.phone;
            }
        } else {
            // Fallback to user metadata / 使用使用者元數據作為備用
            const nameElement = document.getElementById('userName');
            if (nameElement && user.user_metadata?.full_name) {
                nameElement.innerText = user.user_metadata.full_name;
            } else if (nameElement) {
                nameElement.innerText = user.email;
            }
        }
        
    } catch (err) {
        console.error('Load user error / 載入使用者錯誤:', err);
        location.href = 'login.html';
    }
}

// Logout Function / 登出功能
async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Logout error / 登出錯誤:', err);
    } finally {
        location.href = 'login.html';
    }
}

// Listen to auth state changes / 監聽認證狀態變化
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed / 認證狀態變更:', event);
    if (event === 'SIGNED_OUT') {
        location.href = 'login.html';
    }
});

// Load user when page loads / 頁面載入時載入使用者
loadUser();