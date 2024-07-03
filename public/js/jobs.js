// State management
const state = {
  jobPostings: [],
  currentPage: 1,
  isLoading: false,
  renderedJobIds: new Set(),
  filters: {
    experienceLevel: "",
    location: "",
    title: "",
    salary: 0,
    skills: new Set(),
  },
  allTags: [],
  isTagsExpanded: false,
  isSkillsExpanded: false,
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
  topSkills: document.querySelector(".top-tags"),
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
  fetchTopSkills();
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
  const sortOptions = document.querySelector(`.sort-options`);

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

    if (filterType === "title") {
      const showFiltersButton = document.createElement("button");
      showFiltersButton.className = "show-filters null-button-normal";
      showFiltersButton.style.background = "none";
      showFiltersButton.style.border = "none";
      showFiltersButton.innerHTML =
        "<span class='material-symbols-outlined'>sort</span>";
      showFiltersButton.addEventListener("click", () => {
        sortOptions.classList.toggle("show");
      });
      filterContainer.appendChild(showFiltersButton);

      const clearButton = document.createElement("button");
      clearButton.className = "clear-button cancel-button-normal";
      clearButton.innerHTML =
        "<span class='material-symbols-outlined'>close</span>";
      clearButton.style.background = "none";
      clearButton.style.border = "none";
      clearButton.addEventListener("click", () => {
        state.filters[filterType] = "";
        input.value = "";
        resetJobListings();
      });
      filterContainer.appendChild(clearButton);
    }
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
    <button class="submit-button-normal" style="background: none; border: none;" id="apply-salary"><span class="material-symbols-outlined">
check
</span></button>
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

async function fetchTopSkills() {
  try {
    const response = await fetch("/api/getTopSkills");
    state.allSkills = await response.json();
    renderSkills();
  } catch (error) {
    console.error("Error fetching top skills:", error);
  }
}

function renderTags() {
  const { topTags } = elements;
  const maxTags = 6;
  const displayedTags = state.allTags.slice(0, maxTags);
  const remainingTags = state.allTags.slice(maxTags);

  topTags.innerHTML = displayedTags
    .map((tag, index) => createTagHTML(tag, index))
    .join("");

  const remainingTagsCount = remainingTags.length;
  seeMoreButton = createSeeMoreButton(remainingTagsCount);
  seeMoreButton.id = "secondary-text";
  seeMoreButton.onclick = toggleHiddenTags;
  document.getElementById("remaining-tags-count").appendChild(seeMoreButton);

  if (remainingTags.length > 0) {
    topTags.insertAdjacentHTML(
      "beforeend",
      remainingTags
        .map((tag, index) => createTagHTML(tag, index + maxTags, true))
        .join("")
    );
  }
}

function toggleHiddenSkills() {
  state.isSkillsExpanded = !state.isSkillsExpanded;
  const hiddenSkills = elements.topSkills.querySelectorAll(
    ".tag-clickable:nth-child(n+7)"
  );
  hiddenSkills.forEach((skill) => {
    if (state.isSkillsExpanded) {
      skill.classList.remove("hidden");
    } else {
      skill.classList.add("hidden");
    }
  });
  this.textContent = state.isSkillsExpanded ? "See less" : "+ more";
}

function renderSkills() {
  const { topSkills } = elements;
  const maxSkills = 6;
  const displayedSkills = state.allSkills.slice(0, maxSkills);
  const remainingSkills = state.allSkills.slice(maxSkills);

  topSkills.innerHTML = displayedSkills
    .map((skill, index) => createSkillHTML(skill, index))
    .join("");

  const remainingSkillsCount = remainingSkills.length;
  seeMoreButton = createSeeMoreButton(remainingSkillsCount);
  seeMoreButton.id = "secondary-text";
  seeMoreButton.onclick = toggleHiddenSkills;
  document.getElementById("remaining-tags-count").appendChild(seeMoreButton);

  if (remainingSkills.length > 0) {
    topSkills.insertAdjacentHTML(
      "beforeend",
      remainingSkills
        .map((skill, index) => createSkillHTML(skill, index + maxSkills, true))
        .join("")
    );
  }
}

function createSkillHTML(skill, index, hidden = false) {
  return `<span class="tag-clickable ${hidden ? "hidden" : ""}" data-tag="${
    skill.name
  }" data-index="${index}">${skill.name} ${skill.count}</span>`;
}

function createTagHTML(tag, index, hidden = false) {
  return `<span class="tag-clickable ${hidden ? "hidden" : ""}" data-tag="${
    tag.tagName
  }" data-index="${index}">${tag.tagName} ${tag.count}</span>`;
}

function createSeeMoreButton(count) {
  const seeMore = document.createElement("span");
  seeMore.className = "see-more";
  seeMore.textContent = `+${count} more`;
  return seeMore;
}

function toggleHiddenTags() {
  state.isTagsExpanded = !state.isTagsExpanded;
  const hiddenTags = elements.topTags.querySelectorAll(
    ".tag-clickable:nth-child(n+7)"
  );
  hiddenTags.forEach((tag) => {
    if (state.isTagsExpanded || state.filters.skills.has(tag.dataset.tag)) {
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
  elements.topTags.addEventListener("click", handleSkillClick);
  elements.selectedTags.addEventListener("click", handleSkillClick);
}

function handleTagClick(event) {
  if (event.target.classList.contains("tag-clickable")) {
    const tag = event.target;
    const tagName = tag.dataset.tag;
    if (state.skills.tags.has(tagName)) {
      state.skills.tags.delete(tagName);
      tag.classList.remove("selected");
      moveTagToOriginalPosition(tag);
    } else {
      state.skills.tags.add(tagName);
      tag.classList.add("selected");
      elements.selectedTags.appendChild(tag);
    }
    resetJobListings();
  }
}

function handleSkillClick(event) {
  if (event.target.classList.contains("tag-clickable")) {
    const skill = event.target;
    const skillName = skill.dataset.tag;
    if (state.filters.skills.has(skillName)) {
      state.filters.skills.delete(skillName);
      skill.classList.remove("selected");
      moveTagToOriginalPosition(skill);
    } else {
      state.filters.skills.add(skillName);
      skill.classList.add("selected");
      elements.selectedTags.appendChild(skill);
    }
    resetJobListings();
  }
}

function moveTagToOriginalPosition(tag) {
  const index = parseInt(tag.dataset.index);
  const seeMoreButton = elements.topTags.querySelector(".see-more");
  if (index < 6) {
    const tagsInTopContainer =
      elements.topTags.querySelectorAll(".tag-clickable");
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
  state.renderedJobIds.clear();
  elements.jobList.innerHTML = "";
  fetchJobPostings();
}

async function fetchJobPostings() {
  if (state.isLoading) return;
  state.isLoading = true;

  const { title, location, experienceLevel, salary, skills } = state.filters;
  const queryParams = new URLSearchParams({
    page: state.currentPage,
    limit: ITEMS_PER_PAGE,
    jobTitle: title || "",
    jobLocation: location || "",
    jobExperienceLevel: experienceLevel || "",
    jobSalary: salary || "0",
    skills: Array.from(skills).join(","),
  });

  try {
    const response = await fetch(`/api/jobs?${queryParams}`);
    const data = await response.json();

    // Filter out jobs that have already been rendered
    const newJobs = data.jobPostings.filter(
      (job) => !state.renderedJobIds.has(job.id)
    );

    state.jobPostings = [...state.jobPostings, ...newJobs];
    renderJobPostings(newJobs);
    state.currentPage++;
    state.isLoading = false;

    if (data.currentPage >= data.totalPages || newJobs.length === 0) {
      removeInfiniteScroll();
    }
  } catch (error) {
    console.error("Error fetching job postings:", error);
    state.isLoading = false;
  }
}

function renderJobPostings(jobs) {
  const fragment = document.createDocumentFragment();
  jobs.forEach((job) => {
    if (!state.renderedJobIds.has(job.id)) {
      const jobElement = createJobElement(job);
      fragment.appendChild(jobElement);
      state.renderedJobIds.add(job.id);
    }
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

  const tagsArray = job.skills
    ? job.skills[1].split(",").filter((tag) => tag)
    : [];
  const sortedTags = tagsArray.sort(
    (a, b) => state.filters.skills.has(b) - state.filters.skills.has(a)
  );
  const displayedTags = sortedTags.slice(0, 6);

  const tagsHTML = displayedTags
    .map(
      (skill) =>
        `<span class="tag ${
          state.filters.skills.has(skill) ? "highlighted" : ""
        }">${skill}</span>`
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
