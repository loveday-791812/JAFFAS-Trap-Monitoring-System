/*===TrapWatch===*/
/*- Password Visibility -*/
function togglePassword(fieldID, button) {
    const field = document.getElementById(fieldID);
    if(field.type === "password") {
        field.type = "text";
        button.textContent = "◉";
    } else {
        field.type = "password";
        button.textContent = "◉";
    }
}

/*- Signup Form -*/
const signupForm = document.getElementById("signupForm");
signupForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const email =
        document.getElementById("email").value.trim();
    const password =
        document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;
    const selectedRole =
        document.querySelector('input[name="role"]:checked');

    /*- Check Passwords -*/
    if(password !== confirmPassword) {
        alert("Your passwords do not match.");
        return;
    }
    /*- Check Role -*/
    if(!selectedRole) {
        alert("Please select a role.");
        return;
    }
    /*- Temporary Success Message -*/
    alert(
        "Account created successfully!\n\n" +
        "Email: " + email + "\n" +
        "Role: " + selectedRole.value
    );

    console.log("New TrapWatch account:");
    console.log("Email:", email);
    console.log("Role:", selectedRole.value);
});

/*- Login Form -*/
const loginForm = document.getElementById("loginForm");
if(loginForm) {
    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();
        
        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        console.log("Login attempt:");
        console.log("Email:", email);

        /*- Temp login behaviour. Will connect this to the actual authentication system later. -*/
        alert("Login successful!");

    });
    
}