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
      const tagsArray = job.tags ? job.tags[1].split(", ") : [];
      const maxTags = 50; // Adjust this value based on your desired maximum number of tags
      const displayedTags = tagsArray.slice(0, maxTags);
      const tagsHTML = displayedTags
        .map(
          (tag) =>
            `<span class="job-flair" style="margin:4px 5px 0px 0px;">${tag}</span>`
        )
        .join("");
      const remainingTags = tagsArray.length - maxTags;
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
              <span class="material-symbols-outlined">
              badge
              </span>
                <span class="value">${job.experienceLevel}</span>
              </div>
              <div class="job-location">
              <span class="material-symbols-outlined">
              map
              </span>
                <span class="value">${job.location}</span>
              </div>
              <div class="salary-range">
              <span class="material-symbols-outlined">
payments
</span>
              <span class="salary-min">${formatSalary(
                job.salary
              )}</span> - <span class="salary-max">${formatSalary(
        job.salary_max
      )}</span>
            </div>
            <div class="posted-date">
            <span class="value">${formatDate(job.postedDate)}</span>
          </div>
              <div class="job-description">
                <p>${job.description}</p>
              </div>
              <br>
              <div class="job-skills">
              <h4> Job Skills </h4>
              ${tagsHTML}
              ${
                remainingTags > 0
                  ? `<span class="see-more">+${remainingTags} more</span>`
                  : ""
              }
              </div>
              <div class="company-description">
              <h4>Company Description</h4>
              <p>${job.company_description}</p>
            </div>
            <div class="apply-link">
            <button id="submit-button" onclick="window.location.href='${
              job.link
            }'">Apply Now</button>
          </div>
            </div>
          </div>
        `;
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}

