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

        jobElement.innerHTML = `
        <div class="job-preview">
        <div class="company-logo">
          <img src="${job.company_logo}" alt="${job.company_name} logo" />
        </div>
        <div class="job-info">
          <h3 class="job-title">${job.title}</h3>
          <p class="company-name">${job.company_name}</p>
          <p class="job-location">${job.location}</p>
          <p class="salary-range">$${job.salary} - $${job.salary_max}</p>
          <p class="experience-level">${job.experienceLevel}</p>
          <p class="posted-date">${job.postedDate}</p>
        </div>
        <div class="apply-button">
          <a href="${job.link}" target="_blank">Apply</a>
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

/* 

JOB POST FORMAT!!!
        jobElement.innerHTML = `
        <div class="job-listing">
        <div class="company-info">
          <img src="${job.company_logo}" alt="${job.company_name} logo" class="company-logo" />
          <div class="company-details">
            <h3 class="company-name">${job.company_name}</h3>
            <p class="company-location">${job.company_location}</p>
          </div>
        </div>
        <div class="job-details">
          <h2 class="job-title">${job.title}</h2>
          <div class="salary-range">
            <span class="salary-min">$${job.salary}</span> - <span class="salary-max">$${job.salary_max}</span>
          </div>
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
            <span class="value">${job.postedDate}</span>
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
            <a href="${job.link}" target="_blank" class="button">Apply Now</a>
          </div>
        </div>
      </div>
          `;
          */
