async function register() {

    const fullName =
        document.getElementById('fullName').value;

    const phone =
        document.getElementById('phone').value;

    const email =
        document.getElementById('email').value;

    const password =
        document.getElementById('password').value;

    const { data, error } =
        await supabaseClient.auth.signUp({
            email,
            password
        });

    if(error){
        alert(error.message);
        return;
    }

    await supabaseClient
        .from('profiles')
        .insert({
            id:data.user.id,
            full_name:fullName,
            phone:phone
        });

    alert("Registration Successful");

    location.href="login.html";
}

async function login(){

    const email =
        document.getElementById('email').value;

    const password =
        document.getElementById('password').value;

    const { error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    if(error){
        alert(error.message);
        return;
    }

    location.href="dashboard.html";
}