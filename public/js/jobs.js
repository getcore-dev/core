document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/job-postings") // Replace with your actual API route
    .then((response) => response.json())
    .then((jobPostings) => {
      const jobListContainer = document.querySelector(".job-list");
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
            (tag) => `<span class="job-flair" id="location-flair">${tag}</span>`
          )
          .join("");
        const remainingTags = tagsArray.length - maxTags;
        jobElement.innerHTML = `
          <div class="job-preview">
            <div class="job-info">
              <div class="company-info">
                <img src="${job.company_logo}" alt="${job.company_name} logo" />
                <p class="company-name">${job.company_name}</p>
              </div>
              <h3 class="job-title">${job.title}</h3>
              <h5 class="job-subtitle">${job.location}</h5> 
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
                <span class="job-flair" id="pay-flair" style="margin-left: auto">
                  <p class="salary-range">$${Math.floor(
                    (job.salary + job.salary_max) / 2 / 1000
                  )}k</p>
                </span>
              </div>
            </div>
          </div>
        `;
        jobListContainer.appendChild(jobElement);
      });
    })
    .catch((error) => {
      console.error("Error fetching job postings:", error);
    });
});

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

function getAllCompanies() {
  fetch("/api/companies") // Adjust this to your server's endpoint
    .then((response) => response.json())
    .then((companies) => {
      const containerClassName = ".companies-selectors";
      const companiesContainer = document.querySelector(containerClassName);

      companiesContainer.innerHTML = ""; // Clear existing communities
      companies.forEach((company) => {
        const companyElement = document.createElement("div");
        companyElement.className = "company";
        companyElement.onclick = () => {
          window.location.href = `/companies/${company.id}`;
        };

        companyElement.innerHTML = `
              <img class="company-mini-logo" src="${company.logo}">
              <div class="community-name">${company.name}</div>
          `;

        companiesContainer.appendChild(companyElement);
      });
    })
    .catch((error) => console.error("Error fetching communities:", error));
}

getAllCompanies();
