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
              const tagsHTML = displayedTags.map((tag) => `${tag}`).join(", ");

              return `
            <div class="similar-job" onclick="window.location.href='/jobs/${
              job.id
            }'">
              <div class="company-info">
              ${
                job.company_logo
                  ? `
              <img class="thumbnail thumbnail-regular thumbnail-tiny" style="height: 40px; width: auto;" src="${job.company_logo}" alt="${job.company_name} logo" />`
                  : ""
              }
              <div class="job-posting-company-info">
              <p  class="posting-company-name secondary-text">${
                job.company_name
              }</p>
              <h3 class="job-title"><a href="/jobs/${job.id}">${
                job.title
              } </a> </h3>
              </div>
            </div>
                <div class="job-tags">
                  ${tagsHTML}
                </div>
                <div class="job-posting-information job-subtitle secondary-text">
                <span style="">${
                  job.experienceLevel === "Mid Level"
                    ? "L3/L4"
                    : job.experienceLevel === "Entry Level"
                    ? "L1/L2"
                    : job.experienceLevel === "Senior"
                    ? "L5/L6"
                    : job.experienceLevel
                }</span>
                <span> • </span>
                <span class="job-salary" style="margin-left: auto;">USD $${
                  job.salary ? job.salary.toLocaleString() : ""
                } ${
                job.salary_max ? "- $" + job.salary_max.toLocaleString() : ""
              }</span>
        </div>
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
              const tagsHTML = displayedTags.map((tag) => `${tag}`).join(", ");

              return `
            <div class="similar-job" onclick="window.location.href='/jobs/${
              job.id
            }'">
              <div class="company-info">
              ${
                job.company_logo
                  ? `
              <img class="thumbnail thumbnail-regular thumbnail-tiny" style="height: 40px; width: auto;" src="${job.company_logo}" alt="" />`
                  : ""
              }
              <div class="job-posting-company-info">
              <p class="posting-company-name secondary-text">${
                job.company_name
              }</p>
              <h3 class="job-title"><a href="/jobs/${job.id}">${
                job.title
              }</a> </h3>
              </div>
            </div>
                <div class="job-tags">
                  ${tagsHTML}
                </div>
                <div class="job-posting-information job-subtitle secondary-text">
                <span style="">${
                  job.experienceLevel === "Mid Level"
                    ? "L3/L4"
                    : job.experienceLevel === "Entry Level"
                    ? "L1/L2"
                    : job.experienceLevel === "Senior"
                    ? "L5/L6"
                    : job.experienceLevel
                }</span>
                <span> • </span>
                <span class="job-salary" style="margin-left: auto;">USD $${
                  job.salary ? job.salary.toLocaleString() : ""
                } ${
                job.salary_max ? "- $" + job.salary_max.toLocaleString() : ""
              }</span>
        </div>

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

function lazyLoadJobDetails(userIsAdmin, jobId, userIsLoggedIn) {
  fetch(`/api/jobs/${jobId}`)
    .then((response) => response.json())
    .then((job) => {
      const jobDetailsContainer = document.querySelector(
        ".job-details-container"
      );

      let benefitsArray, tagsArray, skillsArray;
      try {
        tagsArray = job.tags && job.tags[1] ? job.tags[1].split(", ") : [];
      } catch (error) {
        console.error("Error splitting tags:", error);
        tagsArray = [];
      }
      try {
        skillsArray =
          job.skills && job.skills[1] ? job.skills[1].split(", ") : [];
      } catch (error) {
        console.error("Error splitting skills:", error);
        skillsArray = [];
      }

      try {
        benefitsArray = job.benefits ? job.benefits.split(",") : [];
      } catch (error) {
        console.error("Error splitting benefits:", error);
        benefitsArray = [];
      }

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
            `<span class="job-flair"
            ><a href="/tags/${tag}"><p>${tag}</p></a></span>`
        )
        .join("");
      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<span class="job-flair"
            ><a href="/tags/${skill}"><p>${skill}</p></a></span>`
        )
        .join("");

      const remainingTags = tagsArray.length - maxTags;
      const remainingSkills = skillsArray.length - maxSkills;

      const isOlderThan30Days = (job) => {
        const postedDate = new Date(job.postedDate);
        const currentDate = new Date();
        const daysDifference =
          (currentDate - postedDate) / (1000 * 60 * 60 * 24);
        return daysDifference > 30;
      };

      jobDetailsContainer.innerHTML = `
        <div class="job-listing">
                ${
                  isOlderThan30Days(job)
                    ? `<div class="caution-messages"><p>This job was posted more than 30 days ago</p> <p>Apply anyway <a href="${job.link}">here</a></div>`
                    : ""
                }
          <div class="company-info">
          ${
            job.company_logo
              ? `
            <img src="${job.company_logo}" style="width: auto;" alt="${job.company_name} logo" class="thumbnail thumbnail-small thumbnail-regular" />
          `
              : ""
          }
            <div class="company-details">
              <h3 class="company-name">
              <a href="/jobs/company/${job.company_name}">
              ${job.company_name}
              </a>
              </h3>
              <div class="company-information">
              <p id="secondary-text" class="company-size"> 
              <span class="material-symbols-outlined">
group
</span>${job.company_size || "Unknown"} employees
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
                license
                </span>${
                  job.h1bVisaSponsorship
                    ? "Visa available"
                    : "No visa sponsorship"
                }
              </p>
              <p> 
              <span class="material-symbols-outlined">
              visibility
              </span> ${job.views ? job.views : 0} views
            </p>
              <p> 
              <span class="material-symbols-outlined">
              person
              </span> ${job.applicants ? job.applicants : 0} applicants
            </p>
              <p>
              <span class="material-symbols-outlined">attach_money</span>
              <strong style="color:#26704a;">
                USD $${job.salary ? job.salary.toLocaleString() : ""} ${
        job.salary_max ? "- $" + job.salary_max.toLocaleString() : ""
      }
              </strong>
            </p>
            <p id="secondary-text" class="post-date-text">
            This job was posted on ${formatDate(job.postedDate)}
            </p>

      </div>
      
      <div class="interact-buttons">
      ${
        isOlderThan30Days(job)
          ? ""
          : `<div class="apply-button-container flex">
          <button id="submit-button-normal" class="margin-h-auto" onclick="window.location.href='${job.link}'">Apply</button>
          </div>
          `
      }
      ${
        userIsLoggedIn
          ? `<div class="favorite-button-container">
              <div id="favorite-form-${job.id}" class="flex">
                <button id="submit-button-normal" onclick="favorite('job', ${job.id});" class="margin-h-auto">Favorite</button>
              </div>
            </div>`
          : ""
      }
      <div class="share-button-container flex">
      <button id="regular-button-normal" class="margin-h-auto" onclick="share('${
        job.title
      }', '', 'https://c-ore.dev/jobs/${job.id}')"
      >Share</button>
      </div>
      ${
        userIsAdmin
          ? `
        <div class="delete-button-container flex">
          <button id="cancel-button-normal" class="margin-h-auto" onclick="window.location.href='/jobs/delete/${job.id}'">Delete</button>
        </div>
      `
          : ""
      }

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
            <div class="job-posting-description">
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
<div class="similar-jobs-location">
${
  job.location
    ? `
  <h4>More jobs in </h4>
${job.location
  .split(",")
  .map(
    (loc) =>
      `<a class="tag" href="/jobs/location/${loc.trim()}">${loc.trim()}</a>`
  )
  .join("")}
  `
    : ""
}
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

              
          </div>
        </div>
      `;
      getSimilarJobs(jobId);
      getSimilarJobsByCompany(jobId, job.company_name);
      if (userIsLoggedIn) {
        checkFavorite(jobId);
      }
    })
    .catch((error) => {
      console.error("Error fetching job details:", error);
    });
}

function checkFavorite(jobId) {
  fetch(`/favorites/isFavorite/job/${jobId}`)
    .then((response) => response.json())
    .then((data) => {
      const favoriteButton = document.querySelector(
        `#favorite-form-${jobId} button`
      );
      if (data.isFavorite) {
        favoriteButton.id = "cancel-button-normal";
        favoriteButton.textContent = data.buttonText;
      } else {
        favoriteButton.id = "submit-button-normal";
        favoriteButton.textContent = data.buttonText;
      }
    })
    .catch((error) => {
      console.error("Error checking favorite:", error);
    });
}

function favorite(favoriteType, TypeId) {
  const endpoints = {
    job: `/favorites/jobs/${TypeId}`,
    post: `/favorites/posts/${TypeId}`,
  };

  const endpoint = endpoints[favoriteType];
  if (!endpoint) {
    console.error("Invalid favorite type");
    return;
  }

  let favoriteButton;
  if (favoriteType === "job") {
    favoriteButton = document.querySelector(`#favorite-form-${TypeId} button`);
    toggleFavoriteButton(favoriteButton);
  }

  fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        showBannerNotification(data.message);
      } else if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        showBannerNotification(data.message);
        if (favoriteType === "job") {
          // Revert button state if operation wasn't successful
          toggleFavoriteButton(favoriteButton);
        }
      }
    })
    .catch((error) => {
      console.error("Error adding to favorites:", error);
      showBannerNotification("An error occurred. Please try again.");
      if (favoriteType === "job") {
        // Revert button state on error
        toggleFavoriteButton(favoriteButton);
      }
    });
}

function toggleFavoriteButton(button) {
  if (button.textContent === "Unfavorite") {
    button.id = "submit-button-normal";
    button.textContent = "Favorite";
  } else {
    button.id = "cancel-button-normal";
    button.textContent = "Unfavorite";
  }
}
