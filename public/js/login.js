document
  .getElementById("usernameInput")
  .addEventListener("input", function (event) {
    var username = event.target.value; // Get the current value of the input field
    document.getElementById("usernameDisplay").textContent = username; // Set the text content of the paragraph
  });
