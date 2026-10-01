const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const messageEl = document.getElementById("auth-message");
const token = localStorage.getItem("token");

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        window.location.href = "/library";
    } else {
        messageEl.textContent = data.error || "Login failed";
    }
}

async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        window.location.href = "/library";
    } else {
        messageEl.textContent = data.error || "Registration failed!";
    }
}



if (token) {
    fetch("/me", {
        headers: { "Authorization": "Bearer " + token }
    }).then(response => {
        if (!response.ok) {
            localStorage.removeItem("token");
            window.location.href = "/";
        } else if (response.ok){
            window.location.href ="/library"
        }
    });
} 
loginBtn.addEventListener("click", login);
registerBtn.addEventListener("click", register);