// Supabase Configuration
const SUPABASE_URL = "https://otvxjshpbldqnrdnmfsn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Li8pGTW9YrMwtRY-ICPkGQ_ceEBkAyt";

// Initialize Supabase Client（只用於數據庫操作，不用 auth）
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log('Supabase client initialized');