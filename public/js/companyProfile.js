// Declare these variables in the global scope
let currentPage = 1;
const pageSize = 15;
let isLoading = false;
let hasMoreJobs = true;

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    const description = document.querySelector('.description-text');
    const showMoreButton = document.querySelector('.show-more-button');
    const descriptionContainer = document.querySelector('.company-description');

    if (description && showMoreButton) {
      if (description.scrollHeight > description.clientHeight) {
        showMoreButton.style.display = 'block';
      }

      showMoreButton.addEventListener('click', () => {
        if (description.style.maxHeight === 'none') {
          description.style.maxHeight = '100px';
          descriptionContainer.style.maxHeight = '3.4rem';
          showMoreButton.innerText = 'Show More';
        } else {
          descriptionContainer.style.maxHeight = 'none';
          description.style.maxHeight = 'none';
          showMoreButton.innerText = 'Show Less';
        }
      });
    }

    const jobListContainer = document.querySelector('.job-list');
    jobListContainer.innerHTML = ''; // Clear existing job postings

    const companyNameMeta = document.querySelector('meta[name="company-name"]');
    if (companyNameMeta) {
      const companyName = companyNameMeta.content;
      loadCompanyJobs(companyName);

      // Add scroll event listener for infinite scrolling
      window.addEventListener('scroll', () => {
        if (
          window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
          !isLoading &&
          hasMoreJobs
        ) {
          loadCompanyJobs(companyName);
        }
      });
    }
  });
}

async function loadCompanyJobs(companyName) {
  if (isLoading || !hasMoreJobs) {
    return;
  }
  isLoading = true;

  try {
    const response = await fetch(`/api/jobs/company/${encodeURIComponent(companyName)}?page=${currentPage}&pageSize=${pageSize}`);
    const jobs = await response.json();

    if (jobs.length === 0) {
      hasMoreJobs = false;
    } else {
      renderJobPostings(jobs);
      currentPage++;
    }
  } catch (error) {
    console.error('Error fetching jobs:', error);
  } finally {
    isLoading = false;
  }
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

function renderJobPostings(jobPostings) {
  const jobListContainer = document.querySelector(".job-list");

  jobPostings.forEach((job) => {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job");
    jobElement.onclick = () => {
      window.location.href = `/jobs/${job.id}`;
    };
    const tagsArray = job.tags && job.tags[1] ? job.tags[1].split(", ") : [];

    const maxTags = 3;
    const displayedTags = tagsArray.slice(0, maxTags);
    const tagsHTML = displayedTags
      .map(
        (tag) =>
        `<span class="job-flair"><p>${tag}</p></span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
        <div class="job-preview">
          <div class="job-info">
            <h3 class="job-title">
            <a href="/jobs/${job.id}">
            ${job.title}
            </a>
            
             <span style="margin-left: auto; float: right;">${
               job.experienceLevel[0].toUpperCase() + job.experienceLevel.slice(1)
             }</span></h3>
            <h5 class="job-subtitle secondary-text">
              <span style="margin-left: auto; float:right;">USD $${Math.floor(
                (job.salary + job.salary_max) / 2 / 1000
              )}k</span>
              ${job.location}
            </h5> 
            <div class="job-main">
              <div class="job-description">
                <p class="job-description">${job.description}</p>
              </div>
            </div>
            <div class="job-posting-flairs">
              ${tagsHTML}
              ${
                remainingTags > 0
                  ? `<span class="see-more">+${remainingTags} more</span>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    jobListContainer.appendChild(jobElement);
  });

  // Update job count
  const jobCountElement = document.querySelector('h3');
  if (jobCountElement) {
    const totalJobs = jobListContainer.children.length;
    jobCountElement.textContent = `${totalJobs} Open Jobs`;
  }
}