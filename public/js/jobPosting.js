document.addEventListener("DOMContentLoaded", () => {
  const jobId = extractJobIdFromUrl();
  lazyLoadJobDetails(jobId);
  attachFormSubmitHandler();
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
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ("00000" + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}65`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = "#808080"; // Light gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function getTintFromNameSecondary(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ("00000" + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = "#404040"; // Dark gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function blendColors(color1, color2, ratio) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));

  const blendedColor = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return blendedColor;
}

function formatSalary(salary) {
  if (salary >= 1000000) {
    return "" + (salary / 1000000).toFixed(1) + "M";
  } else if (salary >= 1000) {
    return "" + (salary / 1000).toFixed(0) + "k";
  } else {
    return "" + salary;
  }
}

function getSimilarJobs(jobId) {
  fetch(`/api/jobs/${jobId}/similar`)
    .then((response) => response.json())
    .then((jobs) => {
      const similarJobsContainer = document.querySelector(".similar-jobs");

      if (jobs.length === 0) {
        similarJobsContainer.innerHTML = ``;
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4>Related Jobs</h4>
        <div class="similar-jobs-list">
          ${jobs
            .map((job) => {
              const tagsArray =
                job.tags && job.tags[1] ? job.tags[1].split(", ") : [];
              const maxTags = 3;
              const displayedTags = tagsArray.slice(0, maxTags);
              const tagsHTML = displayedTags
                .map(
                  (tag) =>
                    `<span class="job-flair" onclick="window.location.href='/jobs/tags/${tag}'"><p>${tag}</p></span>`
                )
                .join("");
              const remainingTags = tagsArray.length - maxTags;

              return `
            <div class="similar-job">
              <a href="/jobs/${job.id}">
                <img src="${job.company_logo}" alt="${
                job.company_name
              } logo" class="thumbnail thumbnail-tiny thumbnail-regular" />
                <p id="secondary-text" style="max-width: 85%;">${
                  job.company_name
                }</p>
                <h4>${job.title}</h4>
                <div class="job-tags">
                  ${tagsHTML}
                  ${
                    remainingTags > 0
                      ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                      : ""
                  }
                </div>
              </a>
            </div>
          `;
            })
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
        similarJobsContainer.innerHTML = ``;
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4>More jobs at ${companyName}</h4>
        <div class="similar-jobs-list">
          ${jobs
            .map((job) => {
              const tagsArray =
                job.tags && job.tags[1] ? job.tags[1].split(", ") : [];
              const maxTags = 3;
              const displayedTags = tagsArray.slice(0, maxTags);
              const tagsHTML = displayedTags
                .map(
                  (tag) =>
                    `<span class="job-flair" onclick="window.location.href='/jobs/tags/${tag}'"
                    ><p>${tag}</p></span>`
                )
                .join("");
              const remainingTags = tagsArray.length - maxTags;

              return `
            <div class="similar-job">
              <a href="/jobs/${job.id}">
                <img src="${job.company_logo}" alt="${
                job.company_name
              } logo" class="thumbnail thumbnail-tiny thumbnail-regular" />
                <p id="secondary-text">${job.company_name}</p>
                <h4>${job.title}</h4>
                <div class="job-tags">
                  ${tagsHTML}
                  ${
                    remainingTags > 0
                      ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                      : ""
                  }
                </div>

              </a>
            </div>
          `;
            })
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
        .map(
          (tag) =>
            `<span class="job-flair" onclick="window.location.href='/jobs/tags/${tag}'"
            ><p>${tag}</p></span>`
        )
        .join("");
      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<span class="job-flair" onclick="window.location.href='/jobs/tags/${skill}'"
            ><p>${skill}</p></span>`
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
                job.company_name
              }'">${job.company_name}</h3>
              <div class="company-information">
              <p class="company-location">
              <span class="material-symbols-outlined">
location_city
</span>${job.company_location.split(",")[0]}</p>
              <p id="secondary-text" class="company-size"> 
              <span class="material-symbols-outlined">
group
</span>${job.company_size || "Unknown"} employees
            </p>
            <p id="secondary-text" class="company-industry"> 
            <span class="material-symbols-outlined">
factory
</span>
            ${job.company_industry || "Unknown"}
            </p>
            </div>
            </div>
          </div>

          <div class="job-details">
            <h2 class="job-title">${job.title}</h2>
            <div class="job-info-flairs">
              <p>
                <span class="material-symbols-outlined">
                engineering
                </span> ${job.experienceLevel}
              </p>
              <p> 
                <span class="material-symbols-outlined">
                location_city
                </span> ${job.location}
              </p>
              <p>
                <span class="material-symbols-outlined">
                computer
                </span> ${job.isRemote ? "Remote available" : "Not remote"}
              </p>
              <p>   
                <span class="material-symbols-outlined">
                license
                </span>${
                  job.h1bVisaSponsorship
                    ? "Visa available"
                    : "No visa sponsorship"
                }
              </p>
            <p>
            <span class="material-symbols-outlined">
              attach_money
              </span>${formatSalary(job.salary)} ${
        job.salary_max ? "- " + formatSalary(job.salary_max) : ""
      }
      </p>
      </div>
      <p id="secondary-text" class="post-date-text">
      This job was posted on ${formatDate(job.postedDate)}
      </p>
      <div class="job-skills">
      <h4>Required Skills</h4>
      ${skillsHTML}
      ${
        remainingSkills > 0
          ? `<span class="see-more" id="secondary-text">+${remainingSkills} more</span>`
          : ""
      }
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
<div class="similar-jobs"></div>
<div class="similar-jobs-company"></div>

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
      }" method="POST">
    <button id="regular-button-normal">Favorite</button>
    </form>
              </div>
              
            </div>
          </div>
        </div>
      `;
      getSimilarJobs(jobId);
      getSimilarJobsByCompany(jobId, job.company_name);
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}

// Function to handle the form submission via AJAX
function handleFavoriteFormSubmit(event) {
  event.preventDefault(); // Prevent the default form submission

  const form = event.target;
  const formData = new FormData(form);

  fetch(form.action, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.json();
    })
    .then((data) => {
      const message = data.message; // Assuming the response contains a 'message' property
      console.log("Success:", message);
      showBannerNotification(message);
    })
    .catch((error) => {
      console.error("Error:", error);
      showBannerNotification("Error: " + error.message);
    });
}

// Attach the event listener to the forms when the DOM content is loaded
function attachFormSubmitHandler() {
  document.querySelectorAll('form[id^="favorite-form-"]').forEach((form) => {
    form.addEventListener("submit", handleFavoriteFormSubmit);
  });
}
