const states = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const selectElement = document.getElementById("state");

document.addEventListener("DOMContentLoaded", (event) => {
  const selectElement = document.getElementById("state");

  states.forEach((state) => {
    const option = document.createElement("option");
    option.value = state;
    option.text = state;
    selectElement.appendChild(option);
  });
});

function autoFillLocation(zipCode) {
  const apiKey = "9782f08fb4d748f293af307acb23c346";
  const requestUrl = `https://api.opencagedata.com/geocode/v1/json?q=${zipCode}&countrycode=us&key=${apiKey}`;

  fetch(requestUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.results.length > 0) {
        const components = data.results[0].components;

        if (components.state) {
          document.getElementById("state").value = components.state;
        }
        if (components.city) {
          document.getElementById("city").style.display = "block";
          document.getElementById("city").value = components.city;
        }
        // Add more fields if needed, like state_code, province, etc.
      }
    })
    .catch((error) => console.error("Error:", error));
}

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
  var stateInput = document.getElementById("state");
  var cityInput = document.getElementById("city");
  var zipcodeInput = document.getElementById("zipcode");
  var zipcodeIcon = document.getElementById("zipcode-icon");
  var cityIcon = document.getElementById("city-icon");
  var stateIcon = document.getElementById("state-icon");

  if (value === "US") {
    stateInput.style.display = "block";
    cityInput.style.display = "block";
    zipcodeInput.style.display = "block";
    zipcodeIcon.style.display = "block";
    stateIcon.style.display = "block";
    cityIcon.style.display = "block";
  } else {
    stateInput.style.display = "none";
    cityInput.style.display = "none";
    zipcodeInput.style.display = "none";
    zipcodeIcon.style.display = "none";
    stateIcon.style.display = "none";
    cityIcon.style.display = "none";
  }
}
