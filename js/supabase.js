// supabase.js - 修正 URL
const SUPABASE_URL = "https://otvxjshpbldqnrdnmfsn.supabase.co";  // 注意是 supabase，不是 subabase
const SUPABASE_ANON_KEY = "sb_publishable_Li8pGTW9YrMwtRY-ICPkGQ_ceEBkAyt";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log('Supabase client initialized');