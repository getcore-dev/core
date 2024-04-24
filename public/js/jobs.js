let jobPostings = []; // Declare jobPostings in a higher scope

document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/job-postings") // Replace with your actual API route
    .then((response) => response.json())
    .then((data) => {
      jobPostings = data; // Assign the fetched data to jobPostings
      renderJobPostings(jobPostings); // Initial rendering of job postings
      populateLocationFilter(); // Populate location filter options
    })
    .catch((error) => {
      console.error("Error fetching job postings:", error);
    });

  const locationFilter = document.getElementById("location-filter");
  const experienceFilter = document.getElementById("experience-filter");
  const salaryFilter = document.getElementById("salary-filter");

  // Add event listeners to the filters
  locationFilter.addEventListener("change", filterJobs);
  experienceFilter.addEventListener("change", filterJobs);
  salaryFilter.addEventListener("change", filterJobs);

  function filterJobs() {
    const selectedLocation = locationFilter.value;
    const selectedExperience = experienceFilter.value;
    const selectedSalary = salaryFilter.value;

    const filteredJobPostings = jobPostings.filter((job) => {
      const locationMatch =
        !selectedLocation || job.location === selectedLocation;
      const experienceMatch =
        !selectedExperience || job.experienceLevel === selectedExperience;
      const salaryMatch =
        !selectedSalary ||
        checkSalaryRange(job.salary, job.salary_max, selectedSalary);

      return locationMatch && experienceMatch && salaryMatch;
    });

    renderJobPostings(filteredJobPostings);
  }

  function populateLocationFilter() {
    const locations = [...new Set(jobPostings.map((job) => job.location))];
    locations.forEach((location) => {
      const option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      locationFilter.appendChild(option);
    });
  }
});

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
}

function renderJobPostings(jobPostings) {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = ""; // Clear existing job postings

  jobPostings.forEach((job) => {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job");
    jobElement.onclick = () => {
      window.location.href = `/jobs/${job.id}`;
    };
    const tagsArray = job.tags
      ? job.tags[1]
        ? job.tags[1].split(", ")
        : []
      : [];
    const maxTags = 3; // Adjust this value based on your desired maximum number of tags
    const displayedTags = tagsArray.slice(0, maxTags);
    const tagsHTML = displayedTags
      .map(
        (tag) =>
          `<span class="job-flair" style="background-color: ${getTintFromName(
            tag
          )}9c; border: 1px solid ${getTintFromName(tag)};">${tag}</span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
      <div class="job-preview">
        <div class="job-info">
          <div class="company-info">
            <img class="thumbnail thubmnail-tiny" src="${
              job.company_logo
            }" alt="${job.company_name} logo" />
            <p class="company-name">${job.company_name}</p>
            <form id="favorite-form-${job.id}" action="/favorites/jobs/${
      job.id
    }" method="POST" style="margin-left: auto;">
              <button type="submit" style="margin-left:auto; background: 0; border:0;">                
                <span class="material-symbols-outlined" style="font-size:1.2rem;">star</span>
              </button>
            </form>
          </div>
          <h3 class="job-title">${
            job.title
          } <span style="margin-left: auto; float: right;">${
      job.experienceLevel[0].toUpperCase() + job.experienceLevel.slice(1)
    }</span></h3>
          <h5 class="job-subtitle secondary-text">
            <span style="margin-left: auto; float:right;">USD $${Math.floor(
              (job.salary + job.salary_max) / 2 / 1000
            )}k</span>
            ${job.location}
          </h5> 
          <div class="job-main">
            <div class="job-description">
              <p class="job-description">${job.description}</p>
            </div>
            <div class="job-buttons">
              <button class="job-apply" id="submit-button-normal" style="padding: 5px 10px">Apply</button>
            </div>
          </div>
          <div class="job-posting-flairs">
            ${tagsHTML}
            ${
              remainingTags > 0
                ? `<span class="see-more">+${remainingTags} more</span>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
    jobListContainer.appendChild(jobElement);
  });
}

function checkSalaryRange(minSalary, maxSalary, selectedSalary) {
  if (!selectedSalary) return true;

  const [minSelected, maxSelected] = selectedSalary.split("-").map(Number);
  return (
    (minSalary >= minSelected && minSalary <= maxSelected) ||
    (maxSalary >= minSelected && maxSalary <= maxSelected)
  );
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatLocation(location) {
  const parts = location.split(",").map((part) => part.trim());

  if (parts.length >= 3) {
    return `${parts[1]}`;
  } else if (parts.length === 1) {
    return location;
  } else {
    return location;
  }
}
