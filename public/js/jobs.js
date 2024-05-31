let jobPostings = []; // Declare jobPostings in a higher scope
let currentPage = 1;
let isLoading = false;
const itemsPerPage = 20;
let filters = {
  experienceLevel: "",
  location: "",
  title: "",
  salary: 0,
};

document.addEventListener("DOMContentLoaded", () => {
  fetchJobPostings(currentPage, filters);
  setupDynamicFilters();
  fetchTopTags();
  document
    .querySelector(".load-more-btn")
    .addEventListener("click", handleLoadMore);
});

const loadMoreButton = document.querySelector(".load-more-button");
const loadMoreDiv = document.querySelector(".load-more");
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !isLoading) {
    handleLoadMore(currentPage);
  }
});

observer.observe(loadMoreDiv);

const jobTitles = [
  "Software Engineer",
  "Data Scientist",
  "UX Designer",
  "Cybersecurity",
  "Project Manager",
  "Data Engineer",
  "Solutions Architect",
  "Machine Learning Engineer",
  "Program Manager",
];

const jobLevels = ["Entry Level", "Mid Level", "Senior", "Lead", "Manager"];

function setupDynamicFilters() {
  setupFilter("experienceLevel");
  setupFilter("location");
  setupFilter("title");
  setupSalaryFilter();
}

function setupFilter(filterType) {
  let uniqueValues;

  if (filterType === "title") {
    uniqueValues = jobTitles;
  } else if (filterType === "experienceLevel") {
    uniqueValues = jobLevels;
  } else if (filterType === "location") {
    uniqueValues = [
      "Remote",
      "Alabama",
      "Alaska",
      "Arizona",
      "Arkansas",
      "California",
      "Colorado",
      "Connecticut",
      "Delaware",
      "Florida",
      "Georgia",
      "Hawaii",
      "Idaho",
      "Illinois",
      "Indiana",
      "Iowa",
      "Kansas",
      "Kentucky",
      "Louisiana",
      "Maine",
      "Maryland",
      "Massachusetts",
      "Michigan",
      "Minnesota",
      "Mississippi",
      "Missouri",
      "Montana",
      "Nebraska",
      "Nevada",
      "New Hampshire",
      "New Jersey",
      "New Mexico",
      "New York",
      "North Carolina",
      "North Dakota",
      "Ohio",
      "Oklahoma",
      "Oregon",
      "Pennsylvania",
      "Rhode Island",
      "South Carolina",
      "South Dakota",
      "Tennessee",
      "Texas",
      "Utah",
      "Vermont",
      "Virginia",
      "Washington",
      "West Virginia",
      "Wisconsin",
      "Wyoming",
    ];
  } else {
    uniqueValues = [
      ...new Set(jobPostings.map((job) => job[filterType])),
    ].sort();
  }

  const filterContainer = document.querySelector(`.${filterType}-filter`);
  filterContainer.innerHTML = ""; // Clear any existing elements

  if (filterType === "title" || filterType === "location") {
    const input = document.createElement("input");
    input.className = "filter-input";
    input.type = "text";
    input.placeholder = filterType[0].toUpperCase() + filterType.slice(1);
    input.addEventListener("input", (e) => {
      filters[filterType] = e.target.value;
      currentPage = 1;
      jobPostings = [];
      fetchJobPostings(currentPage, filters);
    });
    filterContainer.appendChild(input);

    if (filterType === "title") {
      const sortOptionsButton = document.createElement("button");
      sortOptionsButton.innerHTML =
        "<span class='material-symbols-outlined'>sort</span>";
      sortOptionsButton.className = "sort-options-button";
      sortOptionsButton.onclick = () => {
        toggleSortOptions();
      };
      filterContainer.appendChild(sortOptionsButton);
    }

  } else {
    const dropdown = document.createElement("select");
    let filterLabel = filterType[0].toUpperCase() + filterType.slice(1);
    if (filterType === "experienceLevel") {
      filterLabel = "Experience Level";
    }
    dropdown.innerHTML =
      `<option value="">${filterLabel}</option>` +
      uniqueValues
        .map((value) => `<option value="${value}">${value}</option>`)
        .join("");

    filterContainer.appendChild(dropdown);

    dropdown.addEventListener("change", (e) => {
      filters[filterType] = e.target.value;
      currentPage = 1;
      jobPostings = [];
      fetchJobPostings(currentPage, filters);
    });
  }
}

function fetchTopTags() {
  fetch("/jobs/getTopTags/")
    .then((response) => response.json())
    .then((tags) => {
      const topTags = document.querySelector(".top-tags");
      const maxTags = 4; // Maximum number of tags to display
      const displayedTags = tags.slice(0, maxTags);
      const remainingTags = tags.slice(maxTags);

      topTags.innerHTML = displayedTags
        .map(
          (tag) =>
            `<span class="tag" onclick="window.location.href='/tags/${tag.tagName}'">${tag.tagName} ${tag.count}</span>`
        )
        .join("");

      if (remainingTags.length > 0) {
        const seeMore = document.createElement("span");
        seeMore.className = "see-more";
        seeMore.innerText = `+${remainingTags.length} more`;
        topTags.appendChild(seeMore);

        const hiddenTags = remainingTags
          .map(
            (tag) =>
              `<span class="tag hidden" onclick="window.location.href='/tags/${tag.tagName}'">${tag.tagName} ${tag.count}</span>`
          )
          .join("");
        topTags.insertAdjacentHTML('beforeend', hiddenTags);

        seeMore.addEventListener("click", () => {
          const tagsToToggle = topTags.querySelectorAll(".tag.hidden");
          tagsToToggle.forEach(tag => tag.classList.toggle("hidden"));

          // Update the text of "see more" to "see less" or vice versa
          if (seeMore.innerText.includes("more")) {
            seeMore.innerText = "See less";
          } else {
            seeMore.innerText = `+${remainingTags.length} more`;
          }
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching top tags:", error);
    });
}

function setupSalaryFilter() {
  const salaryContainer = document.querySelector(".salary-filter");
  salaryContainer.innerHTML = `
    <div class="input-container">
      <label for="salary">Salary</label>
      <input type="number" placeholder="Salary" id="min-salary">
    </div>
    <button onclick="applySalaryFilter()"><p>Apply</p></button>
  `;
}

function applySalaryFilter() {
  const minSalary = document.getElementById("min-salary").value;
  console.log(minSalary);
  filters.salary = parseInt(minSalary);
  currentPage = 1;
  jobPostings = [];
  fetchJobPostings(currentPage, filters);
}

function handleLoadMore() {
  currentPage++;
  fetchJobPostings(currentPage, filters);
}

function fetchJobPostings(page, filters) {
  isLoading = true;

  const { title, location, experienceLevel, salary } = filters;
  const salaryFilter = salary;

  fetch(
    `/api/jobs?page=${page}&limit=${itemsPerPage}&jobTitle=${title}&jobLocation=${location}&jobExperienceLevel=${experienceLevel}&jobSalary=${salaryFilter}`
  )
    .then((response) => response.json())
    .then((data) => {
      jobPostings = [...jobPostings, ...data.jobPostings];
      renderJobPostings(); // Make sure to call render without parameters
      updateLoadMoreButton();
      isLoading = false;
    })
    .catch((error) => {
      console.error("Error fetching job postings:", error);
      isLoading = false;
    });
}

function updateLoadMoreButton() {
  const loadMoreBtn = document.querySelector(".load-more-btn");
  if (jobPostings.length === 0 || jobPostings.length % itemsPerPage !== 0) {
    loadMoreBtn.style.display = "none";
  } else {
    loadMoreBtn.style.display = "block";
  }
}

function toggleSortOptions() {
  const sortOptions = document.querySelector(".sort-options");
  sortOptions.classList.toggle("show");
}

function renderJobPostings() {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = ""; // Clear existing job postings

  jobPostings.forEach(createJobElement); // Show all jobs if no filters set

  function createJobElement(job) {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job");
    jobElement.onclick = () => {
      window.location.href = `/jobs/${job.id}`;
    };
    const tagsArray = job.tags
      ? job.tags[1]
        ? job.tags[1].split(", ")
        : []
      : [];
    const maxTags = 3; // Adjust this value based on your desired maximum number of tags
    const displayedTags = tagsArray.slice(0, maxTags);
    const tagsHTML = displayedTags
      .map(
        (tag) =>
          `<span class="job-flair" onclick="window.location.href='/tags/${tag}'"><p>${tag}</p></span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
        <div class="job-preview">
          <div class="job-info">
            <div class="company-info">
              <img class="thumbnail thumbnail-tiny" style="width: auto;" src="${
                job.company_logo
              }" alt="${job.company_name} logo" />
              <p class="company-name">${job.company_name}</p>
            </div>
            <h3 class="job-title">${
              job.title
            } <span style="margin-left: auto; float: right;">${
      job.experienceLevel === "Mid Level"
        ? "L3/L4"
        : job.experienceLevel === "Entry Level"
        ? "L1/L2"
        : job.experienceLevel === "Senior"
        ? "L5/L6"
        : job.experienceLevel
    }</span></h3>
            <h5 class="job-subtitle secondary-text">
              <span style="margin-left: auto; float:right;">USD $${
                job.salary
              } ${job.salary_max ? "- $" + job.salary_max : ""}</span>
                </span>
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
                  ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    jobListContainer.appendChild(jobElement);
  }
}
