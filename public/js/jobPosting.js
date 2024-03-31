document.addEventListener("DOMContentLoaded", () => {
  const jobId = extractJobIdFromUrl();
  lazyLoadJobDetails(jobId);
});

function extractJobIdFromUrl() {
  const urlParts = window.location.pathname.split("/");
  return urlParts[urlParts.length - 1];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatSalary(salary) {
  if (salary >= 1000000) {
    return "$" + (salary / 1000000).toFixed(1) + "M";
  } else if (salary >= 1000) {
    return "$" + (salary / 1000).toFixed(0) + "k";
  } else {
    return "$" + salary;
  }
}

function lazyLoadJobDetails(jobId) {
  fetch(`/api/jobs/${jobId}`)
    .then((response) => response.json())
    .then((job) => {
      const jobDetailsContainer = document.querySelector(
        ".job-details-container"
      );
      jobDetailsContainer.innerHTML = `
          <div class="job-listing">
            <div class="company-info">
              <img src="${job.company_logo}" alt="${
        job.company_name
      } logo" class="company-logo" />
              <div class="company-details">
                <h3 class="company-name">${job.company_name}</h3>
                <p class="company-location">${job.company_location}</p>
              </div>
            </div>
            <div class="job-details">
              <h2 class="job-title">${job.title}</h2>
              <div class="experience-level">
                <span class="label">Experience Level:</span>
                <span class="value">${job.experienceLevel}</span>
              </div>
              <div class="job-location">
                <span class="label">Location:</span>
                <span class="value">${job.location}</span>
              </div>
              <div class="posted-date">
                <span class="label">Posted Date:</span>
                <span class="value">${formatDate(job.postedDate)}</span>
              </div>
              <div class="expiry-date">
                <span class="label">Apply by:</span>
                <span class="value">${formatDate(job.expiration_date)}</span>
              </div>
              <div class="salary-range">
              <span class="label">Salary Range:</span>
              <span class="salary-min">${formatSalary(
                job.salary
              )}</span> - <span class="salary-max">${formatSalary(
        job.salary_max
      )}</span>
            </div>
              <div class="job-description">
                <h4>Job Description</h4>
                <p>${job.description}</p>
              </div>
              <div class="company-description">
                <h4>Company Description</h4>
                <p>${job.company_description}</p>
              </div>
              <div class="apply-link">
                <a href="${
                  job.link
                }" target="_blank" class="button">Apply Now</a>
              </div>
            </div>
          </div>
        `;
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}
