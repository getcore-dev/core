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
          <p class="salary-range">$${Math.floor((job.salary + job.salary_max) / 2 / 1000)}k</p>
          <p class="experience-level">${job.experienceLevel}</p>
          <p class="posted-date">${formatDate(job.postedDate)}</p>
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

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}