// State management
const state = {
  jobPostings: [],
  currentPage: 1,
  isLoading: false,
  filters: {
    experienceLevel: "",
    location: "",
    title: "",
    salary: 0,
    tags: new Set(),
  },
  allTags: [],
  isTagsExpanded: false,
};

const ITEMS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 300;

// Constants
const JOB_TITLES = [
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
const JOB_LEVELS = [
  "Internship",
  "Entry Level",
  "Mid Level",
  "Senior",
  "Lead",
  "Manager",
];
const LOCATIONS = [
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

// DOM elements
const elements = {
  jobList: document.querySelector(".job-list"),
  topTags: document.querySelector(".top-tags"),
  selectedTags:
    document.querySelector(".selected-tags") || createSelectedTagsContainer(),
};

// Utility functions
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const createSelectedTagsContainer = () => {
  const container = document.createElement("div");
  container.className = "selected-tags";
  document.querySelector(".job-filters").prepend(container);
  return container;
};

// Event listeners
document.addEventListener("DOMContentLoaded", initialize);

// Main functions
function initialize() {
  setupDynamicFilters();
  setupEventListeners();
  fetchTopTags();
  setupInfiniteScroll();
  fetchJobPostings();
}

function setupDynamicFilters() {
  setupFilter("experienceLevel", JOB_LEVELS);
  setupFilter("location", LOCATIONS);
  setupFilter("title", JOB_TITLES);
  setupSalaryFilter();
}

function setupFilter(filterType, values) {
  const filterContainer = document.querySelector(`.${filterType}-filter`);
  filterContainer.innerHTML = "";

  if (filterType === "title" || filterType === "location") {
    const input = document.createElement("input");
    input.className = "filter-input input-theme";
    input.type = "text";
    input.placeholder = `Search by ${
      filterType === "title" ? "job title" : "location"
    }`;
    input.addEventListener(
      "input",
      debounce((e) => {
        state.filters[filterType] = e.target.value;
        resetJobListings();
      }, DEBOUNCE_DELAY)
    );
    filterContainer.appendChild(input);
  } else {
    const dropdown = document.createElement("select");
    dropdown.innerHTML =
      `<option value="">${
        filterType === "experienceLevel" ? "Experience Level" : filterType
      }</option>` +
      values
        .map((value) => `<option value="${value}">${value}</option>`)
        .join("");
    dropdown.addEventListener("change", (e) => {
      state.filters[filterType] = e.target.value;
      resetJobListings();
    });
    filterContainer.appendChild(dropdown);
  }
}

function setupSalaryFilter() {
  const salaryContainer = document.querySelector(".salary-filter");
  salaryContainer.innerHTML = `
    <div class="input-container">
      <label for="salary">Salary</label>
      <input type="number" placeholder="Salary" id="min-salary">
    </div>
    <button id="apply-salary">Apply</button>
  `;
  document
    .getElementById("apply-salary")
    .addEventListener("click", applySalaryFilter);
}

function applySalaryFilter() {
  state.filters.salary =
    parseInt(document.getElementById("min-salary").value) || 0;
  resetJobListings();
}

async function fetchTopTags() {
  try {
    const response = await fetch("/api/getTopTags");
    state.allTags = await response.json();
    renderTags();
  } catch (error) {
    console.error("Error fetching top tags:", error);
  }
}

function renderTags() {
  const { topTags, selectedTags } = elements;
  const maxTags = 10;
  const displayedTags = state.allTags.slice(0, maxTags);
  const remainingTags = state.allTags.slice(maxTags);

  topTags.innerHTML = displayedTags
    .map((tag, index) => createTagHTML(tag, index))
    .join("");

  if (remainingTags.length > 0) {
    const seeMore = createSeeMoreButton(remainingTags.length);
    topTags.appendChild(seeMore);
    topTags.insertAdjacentHTML(
      "beforeend",
      remainingTags
        .map((tag, index) => createTagHTML(tag, index + maxTags, true))
        .join("")
    );
  }
}

function createTagHTML(tag, index, hidden = false) {
  return `<span class="tag ${hidden ? "hidden" : ""}" data-tag="${
    tag.tagName
  }" data-index="${index}">${tag.tagName} ${tag.count}</span>`;
}

function createSeeMoreButton(count) {
  const seeMore = document.createElement("span");
  seeMore.className = "see-more";
  seeMore.textContent = `+${count} more`;
  seeMore.addEventListener("click", toggleHiddenTags);
  return seeMore;
}

function toggleHiddenTags() {
  state.isTagsExpanded = !state.isTagsExpanded;
  const hiddenTags = elements.topTags.querySelectorAll(".tag:nth-child(n+11)");
  hiddenTags.forEach((tag) => {
    if (state.isTagsExpanded || state.filters.tags.has(tag.dataset.tag)) {
      tag.classList.remove("hidden");
    } else {
      tag.classList.add("hidden");
    }
  });
  this.textContent = state.isTagsExpanded
    ? "See less"
    : `+${hiddenTags.length} more`;
}

function setupEventListeners() {
  elements.topTags.addEventListener("click", handleTagClick);
  elements.selectedTags.addEventListener("click", handleTagClick);
}

function handleTagClick(event) {
  if (event.target.classList.contains("tag")) {
    const tag = event.target;
    const tagName = tag.dataset.tag;
    if (state.filters.tags.has(tagName)) {
      state.filters.tags.delete(tagName);
      tag.classList.remove("selected");
      moveTagToOriginalPosition(tag);
    } else {
      state.filters.tags.add(tagName);
      tag.classList.add("selected");
      elements.selectedTags.appendChild(tag);
    }
    resetJobListings();
  }
}

function moveTagToOriginalPosition(tag) {
  const index = parseInt(tag.dataset.index);
  const seeMoreButton = elements.topTags.querySelector(".see-more");
  if (index < 10) {
    const tagsInTopContainer = elements.topTags.querySelectorAll(".tag");
    if (tagsInTopContainer[index]) {
      elements.topTags.insertBefore(tag, tagsInTopContainer[index]);
    } else {
      elements.topTags.insertBefore(tag, seeMoreButton);
    }
    tag.classList.remove("hidden");
  } else {
    elements.topTags.insertBefore(tag, seeMoreButton);
    if (!state.isTagsExpanded) {
      tag.classList.add("hidden");
    }
  }
}

function resetJobListings() {
  state.currentPage = 1;
  state.jobPostings = [];
  elements.jobList.innerHTML = "";
  fetchJobPostings();
}

async function fetchJobPostings() {
  if (state.isLoading) return;
  state.isLoading = true;

  const { title, location, experienceLevel, salary, tags } = state.filters;
  const queryParams = new URLSearchParams({
    page: state.currentPage,
    limit: ITEMS_PER_PAGE,
    jobTitle: title || "",
    jobLocation: location || "",
    jobExperienceLevel: experienceLevel || "",
    jobSalary: salary || "0",
    tags: Array.from(tags).join(","),
  });

  try {
    const response = await fetch(`/api/jobs?${queryParams}`);
    const data = await response.json();
    state.jobPostings =
      state.currentPage === 1
        ? data.jobPostings
        : [...state.jobPostings, ...data.jobPostings];
    renderJobPostings();
    state.currentPage++;
    state.isLoading = false;

    if (data.currentPage >= data.totalPages || data.jobPostings.length === 0) {
      removeInfiniteScroll();
    }
  } catch (error) {
    console.error("Error fetching job postings:", error);
    state.isLoading = false;
  }
}

function renderJobPostings() {
  const fragment = document.createDocumentFragment();
  state.jobPostings.forEach((job) => {
    const jobElement = createJobElement(job);
    fragment.appendChild(jobElement);
  });
  elements.jobList.appendChild(fragment);

  if (state.jobPostings.length === 0) {
    const noJobsMessage = document.createElement("div");
    noJobsMessage.classList.add("no-jobs-message");
    noJobsMessage.textContent = "No job postings found matching your criteria.";
    elements.jobList.appendChild(noJobsMessage);
  }
}

function createJobElement(job) {
  const jobElement = document.createElement("div");
  jobElement.classList.add("job");
  jobElement.onclick = () => (window.location.href = `/jobs/${job.id}`);

  const tagsArray = job.tags ? job.tags.split(", ") : [];
  const sortedTags = tagsArray.sort(
    (a, b) => state.filters.tags.has(b) - state.filters.tags.has(a)
  );
  const displayedTags = sortedTags.slice(0, 6);

  const tagsHTML = displayedTags
    .map(
      (tag) =>
        `<span class="tag ${
          state.filters.tags.has(tag) ? "highlighted" : ""
        }">${tag}</span>`
    )
    .join("");

  jobElement.innerHTML = `
    <div class="job-preview">
      <div class="job-info">
        <div class="company-info">
          ${
            job.company_logo
              ? `<img class="thumbnail thumbnail-regular thumbnail-tiny" style="height: 40px; width: auto;" src="${job.company_logo}" alt="" />`
              : ""
          }
          <div class="job-posting-company-info">
            <p class="company-name secondary-text">${job.company_name}</p>
            <h3 class="job-title"><a href="/jobs/${job.id}">${
    job.title
  }</a></h3>
          </div>
        </div>
        <h5 class="job-subtitle secondary-text">${job.location}</h5> 
        <div class="job-posting-information job-subtitle secondary-text">
          <span>${
            job.experienceLevel === "Mid Level"
              ? "L3/L4"
              : job.experienceLevel === "Entry Level"
              ? "L1/L2"
              : job.experienceLevel === "Senior"
              ? "L5/L6"
              : job.experienceLevel
          }</span>
          <span> • </span>
          <span class="job-salary" style="margin-left: auto;">USD $${job.salary.toLocaleString()} ${
    job.salary_max ? "- $" + job.salary_max.toLocaleString() : ""
  }</span>
        </div>
        <div class="job-posting-flairs">${tagsHTML}</div>
      </div>
    </div>
  `;
  return jobElement;
}

function setupInfiniteScroll() {
  const options = {
    root: null,
    rootMargin: "0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.isLoading) {
      fetchJobPostings();
    }
  }, options);

  observer.observe(document.querySelector(".load-more-btn"));
}

function removeInfiniteScroll() {
  const loadMoreBtn = document.querySelector(".load-more-btn");
  if (loadMoreBtn) {
    loadMoreBtn.style.display = "none";
  }
}
