let jobPostings = []; // Declare jobPostings in a higher scope
let currentPage = 1;
let isLoading = false;
const itemsPerPage = 10;
let filters = {
  experienceLevel: [],
  location: [],
  title: [],
  isRemote: null,
  salary: { min: null, max: null },
};

document.addEventListener("DOMContentLoaded", () => {
  fetchJobPostings(currentPage);
  document
    .querySelector(".load-more-btn")
    .addEventListener("click", handleLoadMore);
  getTopTags();
  getRecentJobs();
});

function setupDynamicFilters() {
  setupFilter("experienceLevel");
  setupFilter("location");
  setupFilter("title");
  setupRemoteToggle();
  setupSalaryFilter();
}
function setupFilter(filterType) {
  const uniqueValues = [
    ...new Set(jobPostings.map((job) => job[filterType])),
  ].sort();
  const filterContainer = document.querySelector(`.${filterType}-filter`);
  const dropdown = document.createElement("select");
  dropdown.innerHTML =
    `<option value="">Select ${filterType}</option>` +
    uniqueValues
      .map((value) => `<option value="${value}">${value}</option>`)
      .join("");
  filterContainer.appendChild(dropdown);
  dropdown.addEventListener("change", (e) => {
    filters[filterType] = e.target.value;
    renderJobPostings();
  });
}

function setupRemoteToggle() {
  const remoteContainer = document.querySelector(".isRemote-filter");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  const label = document.createElement("label");
  label.innerHTML = "Remote";
  remoteContainer.appendChild(label);
  remoteContainer.appendChild(toggle);
  toggle.addEventListener("change", (e) => {
    filters.isRemote = e.target.checked;
    renderJobPostings();
  });
}

function setupSalaryFilter() {
  const salaryContainer = document.querySelector(".salary-filter");
  salaryContainer.innerHTML = `
    <input type="number" placeholder="Min salary" id="min-salary">
    <input type="number" placeholder="Max salary" id="max-salary">
    <button onclick="applySalaryFilter()">Apply</button>
  `;
}

function applySalaryFilter() {
  const minSalary = document.getElementById("min-salary").value;
  const maxSalary = document.getElementById("max-salary").value;
  filters.salary.min = minSalary ? parseInt(minSalary) : null;
  filters.salary.max = maxSalary ? parseInt(maxSalary) : null;
  renderJobPostings();
}

function handleLoadMore() {
  currentPage++;
  fetchJobPostings(currentPage);
}

function fetchJobPostings(page) {
  isLoading = true;

  fetch(`/api/jobs?page=${page}&limit=${itemsPerPage}`)
    .then((response) => response.json())
    .then((data) => {
      jobPostings = [...jobPostings, ...data.jobPostings];
      if (currentPage === 1) {
        // Only set up filters on the initial load
        setupDynamicFilters();
      }
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

function renderJobPostings() {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = ""; // Clear existing job postings

  console.log(jobPostings);
  const filteredPostings = jobPostings.filter((job) => {
    if (
      filters.experienceLevel.length > 0 &&
      !filters.experienceLevel.includes(job.experienceLevel)
    )
      return false;
    if (filters.location.length > 0 && !filters.location.includes(job.location))
      return false;
    if (
      filters.title.length > 0 &&
      !job.title.toLowerCase().includes(filters.title.toLowerCase())
    )
      return false;
    if (filters.isRemote !== null && job.isRemote !== filters.isRemote)
      return false;
    if (filters.salary.min !== null && job.salary < filters.salary.min)
      return false;
    if (filters.salary.max !== null && job.salary > filters.salary.max)
      return false;
    return true;
  });
  console.log(filteredPostings);

  if (
    filteredPostings.length === 0 &&
    Object.values(filters).every((val) => !val)
  ) {
    // No filters applied and no postings match (possible on initial load)
    jobPostings.forEach(createJobElement); // Show all jobs if no filters set
  } else {
    filteredPostings.forEach(createJobElement);
  }

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
          `<span class="job-flair" onclick="window.location.href='/jobs/tags/${tag}'"
            style="background-color: ${getTintFromName(
              tag
            )}; border: 1px solid ${getTintFromNameSecondary(
            tag
          )};"><p>${tag}</p></span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
        <div class="job-preview">
          <div class="job-info">
            <div class="company-info">
              <img class="thumbnail thumbnail-tiny thumbnail-regular" style="width: auto;" src="${
                job.company_logo
              }" alt="${job.company_name} logo" />
              <p class="company-name">${job.company_name}</p>
            
              
              <form id="favorite-form-${job.id}" action="/favorites/jobs/${
      job.id
    }" method="POST" style="margin-left: auto;">
                <button type="submit" style="margin-left:auto; background: 0; border:0;">                
                  <span class="material-symbols-outlined" style="font-size:1.2rem;">star</span>
                </button>
              </form>
            </div>
            <h3 class="job-title">${
              job.title
            } <span style="margin-left: auto; float: right;">${
      job.experienceLevel[0].toUpperCase() + job.experienceLevel.slice(1)
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

function checkSalaryRange(minSalary, maxSalary, selectedSalary) {
  if (!selectedSalary) return true;

  const [minSelected, maxSelected] = selectedSalary.split("-").map(Number);
  return (
    (minSalary >= minSelected && minSalary <= maxSelected) ||
    (maxSalary >= minSelected && maxSalary <= maxSelected)
  );
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function renderTopTagsAndCount(topTags) {
  const topTagsContainer = document.querySelector(".top-tags");
  topTagsContainer.innerHTML = ""; // Clear existing top tags

  // Creating a dropdown container
  const dropdownContainer = document.createElement("div");
  dropdownContainer.classList.add("dropdown");

  // Button to toggle dropdown
  const dropdownButton = document.createElement("button");
  dropdownButton.innerHTML =
    "<span class='material-symbols-outlined'>label</span>";
  dropdownButton.classList.add("dropdown-button");
  dropdownContainer.appendChild(dropdownButton);

  // Dropdown content, initially hidden
  const dropdownContent = document.createElement("div");
  dropdownContent.classList.add("dropdown-content");
  dropdownContent.style.display = "none";

  // Populate dropdown content
  topTags.forEach((tag) => {
    const tagItem = document.createElement("div");
    tagItem.classList.add("tag-item");
    tagItem.innerHTML = `<span class="tagname">${tag.tagName}</span> <span class="tagcount">${tag.count}</span>`;
    tagItem.onclick = function () {
      window.location.href = `/jobs/tags/${tag.tagName}`;
    };
    dropdownContent.appendChild(tagItem);
  });

  // Append dropdown content to the dropdown container
  dropdownContainer.appendChild(dropdownContent);
  topTagsContainer.appendChild(dropdownContainer);

  // Toggle dropdown visibility on button click
  dropdownButton.onclick = function () {
    dropdownContent.style.display =
      dropdownContent.style.display === "none" ? "block" : "none";
  };
}
function getTopTags() {
  fetch("/jobs/getTopTags")
    .then((response) => response.json())
    .then((tags) => {
      renderTopTagsAndCount(tags);
    })
    .catch((error) => {
      console.error("Error fetching top tags:", error);
    });
}

function renderRecentJobs(count) {
  const recentJobsContainer = document.querySelector(".recent-jobs");
  recentJobsContainer.innerHTML = ""; // Clear existing recent jobs

  const recentJobsElement = document.createElement("div");
  recentJobsElement.classList.add("recent-jobs");
  recentJobsElement.innerHTML = `
    <p>There were ${count} new job postings in the last 30 days.</p>
  `;
  recentJobsContainer.appendChild(recentJobsElement);
}

function getRecentJobs() {
  fetch("/jobs/getRecentJobs")
    .then((response) => response.json())
    .then((jobCount) => {
      renderRecentJobs(jobCount);
    })
    .catch((error) => {
      console.error("Error fetching top tags:", error);
    });
}

function formatLocation(location) {
  const parts = location.split(",").map((part) => part.trim());

  if (parts.length >= 3) {
    return `${parts[1]}`;
  } else if (parts.length === 1) {
    return location;
  } else {
    return location;
  }
}
