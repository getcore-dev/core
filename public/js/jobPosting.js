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
              <p class="company-location">${job.company_location}</p>
            </div>
          </div>

          <div class="job-details">
            <h2 class="job-title">${job.title}</h2>
            <div class="experience-level">
              <span class="material-symbols-outlined">badge</span>
              <span class="value">${job.experienceLevel}</span>
            </div>
            <div class="job-location">
              <span class="material-symbols-outlined">map</span>
              <span class="value">${job.location}</span>
            </div>
            <div class="salary-range">
              <span class="material-symbols-outlined">payments</span>
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
            <h4>Job Description</h4>

              <p>${job.description}</p>
            </div>
            <div class="company-description">
              <h4>Company Description</h4>
              <p>${job.company_description}</p>
            </div>
            <div class="minimum-qualifications">
              <h4>Minimum Qualifications</h4>
              <p>${job.MinimumQualifications || "No qualifications listed"}</p>
            </div>
            <div class="preferred-qualifications">
              <h4>Preferred Qualifications</h4>
              <p>${
                job.PreferredQualifications || "No qualifications listed"
              }</p>
            </div>
            <div class="job-benefits">
              <h4>Job Benefits</h4>
              <ul>
                ${formattedBenefits || "<li>No benefits listed</li>"}
              </ul>
            </div>
            <div class="job-responsibilities">
              <h4>Responsibilities</h4>
              <p>${job.Responsibilities || "No responsibilities listed"}</p>
            </div>
            <div class="job-requirements">
              <h4>Requirements</h4>
              <p>${job.Requirements || "No requirements listed"}</p>
            </div>
            <div class="job-nice-to-have">
              <h4>Nice to Have</h4>
              <p>${job.NiceToHave || "No nice-to-have listed"}</p>
            </div>
            <div class="job-schedule">
              <h4>Schedule</h4>
              <p>${job.schedule || "No schedule listed"}</p>
            </div>
            <div class="job-hours-per-week">
              <h4>Hours per Week</h4>
              <p>${job.hoursPerWeek || "No hours per week listed"}</p>
            </div>
            <div class="job-h1b-visa-sponsorship">
              <h4>H1B Visa Sponsorship</h4>
              <p>${job.h1bVisaSponsorship ? "Yes" : "No"}</p>
            </div>
            <div class="job-is-remote">
              <h4>Remote</h4>
              <p>${job.isRemote ? "Yes" : "No"}</p>
            </div>
            <div class="job-equal-opportunity-employer-info">
              <h4>Equal Opportunity Employer Info</h4>
              <p>${job.equalOpportunityEmployerInfo || "No info listed"}</p>
            </div>
            <div class="job-relocation">
              <h4>Relocation</h4>
              <p>${job.relocation ? "Yes" : "No"}</p>
            </div>

            <br>
            <div class="job-skills">
              <h4>Required Skills</h4>
              ${skillsHTML}
              ${
                remainingSkills > 0
                  ? `<span class="see-more" id="secondary-text">+${remainingSkills} more</span>`
                  : ""
              }
            </div>
            <br>
            <div class="job-skills">
              <h4>Tags</h4>
              ${tagsHTML}
              ${
                remainingTags > 0
                  ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                  : ""
              }
            </div>

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
          </div>
        </div>
      `;
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}
