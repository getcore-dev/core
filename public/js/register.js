document
  .getElementById("usernameInput")
  .addEventListener("input", function (event) {
    var username = event.target.value; // Get the current value of the input field
    document.getElementById("usernameDisplay").textContent = username; // Set the text content of the paragraph
  });

fetch("src/countries.json")
  .then((response) => response.json())
  .then((data) => {
    let countrySelect = document.getElementById("country");
    data.forEach((country) => {
      let option = new Option(country.name, country.code);
      countrySelect.add(option);
    });
  })
  .catch((error) => {
    console.error("Error loading the country list:", error);
  });

function checkCountry(select) {
  var value = select.value;
  console.log(select.value);
  console.log(select);
  var zipcodeInput = document.getElementById("zipcode");
  var zipcodeIcon = document.getElementById("zipcode-icon");

  if (value === "US") {
    zipcodeInput.style.display = "block";
    zipcodeIcon.style.display = "block";
  } else {
    zipcodeInput.style.display = "none";
    zipcodeIcon.style.display = "none";
  }
}
