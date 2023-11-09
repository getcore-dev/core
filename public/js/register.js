const form = document.getElementById('registration');

form.addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    fetch ('/api/users/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password }),
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Network response was not ok.');
        })
        .then(data => {
            // if login API returns a token, this will run
            if (data.user && data.token) {
                localStorage.setItem('token', data.token);

                // TODO: logic for when user signs in

            } else {
                // if API doesnt return a token, this happens
                document.getElementById('message').textContent = 'Registered successfully, please log in.';
            }
        })
        .catch(err => {
            console.error('Error: ', err);
            document.getElementById('message').textContent = err;
        });
});