document.addEventListener("DOMContentLoaded", () => {
  const jobId = extractJobIdFromUrl();
  lazyLoadJobDetails(jobId);
  getSimilarJobs(jobId);
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
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  const saturation = 50;
  const lightness = 50;
  const tintColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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

function getSimilarJobs(jobId) {
  fetch(`/api/jobs/${jobId}/similar`)
    .then((response) => response.json())
    .then((jobs) => {
      const similarJobsContainer = document.querySelector(".similar-jobs");

      if (jobs.length === 0) {
        similarJobsContainer.innerHTML = `
      `;
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4>More similar jobs</h4>
        <div class="similar-jobs-list">
          ${jobs
            .map(
              (job) => `
            <div class="similar-job">
              <a href="/jobs/${job.id}">
                <img src="${job.company_logo}" alt="${job.company_name} logo" class="thumbnail thumbnail-tiny thumbnail-regular" />
                <p id="secondary-text">${job.company_name}</p>
                <h4>${job.title}</h4>
              </a>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    })
    .catch((error) => {
      console.error("Error fetching similar jobs:", error);
    });
}

function getSimilarJobsByCompany(jobId, companyName) {
  fetch(`/api/jobs/${jobId}/similar-company`)
    .then((response) => response.json())
    .then((jobs) => {
      const similarJobsContainer = document.querySelector(
        ".similar-jobs-company"
      );
      if (jobs.length === 0) {
        similarJobsContainer.innerHTML = `
      `;
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4>Similar job postings by ${companyName}</h4>
        <div class="similar-jobs-list">
          ${jobs
            .map(
              (job) => `
            <div class="similar-job">
              <a href="/jobs/${job.id}">
                <img src="${job.company_logo}" alt="${job.company_name} logo" class="thumbnail thumbnail-tiny thumbnail-regular" />
                <p id="secondary-text">${job.company_name}</p>
                <h4>${job.title}</h4>
              </a>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    })
    .catch((error) => {
      console.error("Error fetching similar jobs:", error);
    });
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

      const tagsArray = job.tags && job.tags[1] ? job.tags[1].split(", ") : [];
      const skillsArray =
        job.skills && job.skills[1] ? job.skills[1].split(", ") : [];
      const benefitsArray = job.benefits ? job.benefits.split(",") : [];

      const formattedBenefits = benefitsArray
        .map((benefit) => `<li>${benefit.replace(/'/g, "")}</li>`)
        .join("");

      const maxTags = 15;
      const maxSkills = 10;
      const displayedTags = tagsArray.slice(0, maxTags);
      const displayedSkills = skillsArray.slice(0, maxSkills);

      const tagsHTML = displayedTags
        .map((tag) => `<span class="job-flair">${tag}</span>`)
        .join("");
      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<span class="job-flair" style="background-color: #7d959cab; border-color: #7d9c84c9;">${skill}</span>`
        )
        .join("");

      const remainingTags = tagsArray.length - maxTags;
      const remainingSkills = skillsArray.length - maxSkills;

      jobDetailsContainer.innerHTML = `
        <div class="job-listing">
          <div class="company-info">
            <img src="${job.company_logo}" style="width: auto;" alt="${
        job.company_name
      } logo" class="thumbnail thumbnail-small thumbnail-regular" />
            <div class="company-details">
              <h3 class="company-name" onclick="window.location.href='/jobs/company/${
                job.company_id
              }'">${job.company_name}</h3>
              <div class="company-information">
              <p class="company-location">${
                job.company_location.split(",")[0]
              }</p>
              <p id="secondary-text" class="company-size"> ${
                job.company_size || "Unknown"
              } employees
            </p>
            <p id="secondary-text" class="company-industry"> 
            ${job.company_industry || "Unknown"}
            </p>
            </div>
            </div>
          </div>

          <div class="job-details">
            <h2 class="job-title">${job.title}</h2>
            <div class="job-experience-level">
            <p>${job.experienceLevel}</p>
            </div>
    <div class="job-is-remote">
              <h4>Location/Remote</h4>
              <p>${job.location}</p>
              <p>Remote available?: ${job.isRemote ? "Yes" : "No"}</p>
            </div>
            <div class="job-salary">
            <h4>Salary</h4>
            <p>The annual expected salary for this role: <strong style="color: green;">${formatSalary(
              job.salary
            )} - ${formatSalary(job.salary_max)}</strong></p>
          </div>
            <div class="job-description">
            <h4>Job Description</h4>

              <p>${job.description}</p>
            </div>
            ${
              job.Requirements
                ? `
            <div class="job-requirements">
              <h4>Requirements</h4>
              <p>${job.Requirements}</p>
            </div>
            `
                : ""
            }

            ${
              job.Responsibilities
                ? `
            <div class="job-responsibilities">
              <h4>Responsibilities</h4>
              <p>${job.Responsibilities}</p>
            </div>
            `
                : ""
            }
            <div class="company-description">
              <h4>Company Description</h4>
              <p>${job.company_description}</p>
            </div>
            
            ${
              job.MinimumQualifications
                ? `
<div class="minimum-qualifications">
  <h4>Minimum Qualifications</h4>
  <p>${job.MinimumQualifications}</p>
</div>
`
                : ""
            }

${
  job.PreferredQualifications
    ? `
<div class="preferred-qualifications">
  <h4>Preferred Qualifications</h4>
  <p>${job.PreferredQualifications}</p>
</div>
`
    : ""
}

${
  formattedBenefits
    ? `
<div class="job-benefits">
  <h4>Job Benefits</h4>
  <ul>
    ${formattedBenefits}
  </ul>
</div>
`
    : ""
}

${
  job.NiceToHave
    ? `
<div class="job-nice-to-have">
  <h4>Nice to Have</h4>
  <p>${job.NiceToHave}</p>
</div>
`
    : ""
}

${
  job.schedule
    ? `
<div class="job-schedule">
  <h4>Schedule</h4>
  <p>${job.schedule}</p>
</div>
`
    : ""
}

${
  job.hoursPerWeek
    ? `
<div class="job-hours-per-week">
  <h4>Hours per Week</h4>
  <p>${job.hoursPerWeek}</p>
</div>
`
    : ""
}

<div class="job-h1b-visa-sponsorship">
  <h4>H1B Visa Sponsorship</h4>
  <p>${job.h1bVisaSponsorship ? "Yes" : "No"}</p>
</div>

${
  job.equalOpportunityEmployerInfo
    ? `
<div class="job-equal-opportunity-employer-info">
  <h4>Equal Opportunity Employer Info</h4>
  <p>${job.equalOpportunityEmployerInfo}</p>
</div>
`
    : ""
}

<div class="job-relocation">
  <h4>Relocation</h4>
  <p>${job.relocation ? "Yes" : "No"}</p>
</div>

            <div class="job-skills">
              <h4>Required Skills</h4>
              ${skillsHTML}
              ${
                remainingSkills > 0
                  ? `<span class="see-more" id="secondary-text">+${remainingSkills} more</span>`
                  : ""
              }
            </div>
            <div class="job-skills">
              <h4>Tags</h4>
              ${tagsHTML}
              ${
                remainingTags > 0
                  ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                  : ""
              }

            </div>
            <p id="secondary-text" class="post-date-text">
            This job was posted on ${formatDate(job.postedDate)}
            </p>
            <div class="interact-buttons">
              <div class="apply-button-container">
              <button id="submit-button-normal" onclick="window.location.href='${
                job.link
              }'">Apply Now</button>
              </div>
              <div class="favorite-button-container">
              <form id="favorite-form-${job.id}" action="/favorites/jobs/${
        job.id
      }" method="POST" style="margin-left: auto;">
      <button id="regular-button-normal">Favorite</button>
              </form>
              </div>
              
            </div>
            <div class="similar-jobs"></div>
            <div class="similar-jobs-company"></div>
          </div>
        </div>
      `;

      getSimilarJobsByCompany(jobId, job.company_name);
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}
