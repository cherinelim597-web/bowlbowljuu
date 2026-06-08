async function loadUser(){

    const {
        data:{user}
    } = await supabaseClient.auth.getUser();

    if(!user){
        location.href='login.html';
        return;
    }

    document.getElementById('userEmail')
        .innerText=user.email;
}

async function logout(){

    await supabaseClient.auth.signOut();

    location.href='login.html';
}

loadUser();