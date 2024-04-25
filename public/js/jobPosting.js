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

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
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
      const secondNavBarText = document.querySelector(
        "a.navbar-button.dropdown-toggle"
      );
      secondNavBarText.innerHTML =
        "Openings / " +
        job.title +
        ' <span class="material-symbols-outlined">arrow_drop_down</span>';
      const tagsArray = job.tags ? job.tags[1].split(", ") : [];
      const maxTags = 50; // Adjust this value based on your desired maximum number of tags
      const displayedTags = tagsArray.slice(0, maxTags);
      const tagsHTML = displayedTags
        .map(
          (tag) =>
            `<span class="job-flair" style="margin:4px 5px 0px 0px; background-color: ${getTintFromName(
              tag
            )}9c; border: 1px solid ${getTintFromName(tag)};">${tag}</span>`
        )
        .join("");
      const remainingTags = tagsArray.length - maxTags;
      jobDetailsContainer.innerHTML = `
          <div class="job-listing">
            <div class="company-info">
              <img src="${job.company_logo}" alt="${
        job.company_name
      } logo" class="thumbnail thumbnail-small thumbnail-regular" />
              <div class="company-details">
                <h3 class="company-name" onclick="window.location.href='/jobs/company/${
                  job.company_id
                }'">${job.company_name}</h3>
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
