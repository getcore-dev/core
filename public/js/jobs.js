let jobPostings = [];
let currentPage = 1;
let isLoading = false;
const itemsPerPage = 20;
let filters = {
  experienceLevel: "",
  location: "",
  title: "",
  salary: 0,
  tags: [],
};
let allTags = [];
let isTagsExpanded = false;

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

const jobLevels = [
  "Internship",
  "Entry Level",
  "Mid Level",
  "Senior",
  "Lead",
  "Manager",
];

document.addEventListener("DOMContentLoaded", () => {
  setupDynamicFilters();
  setupEventListeners();
  fetchTopTags();
  fetchJobPostings(currentPage, filters);
});

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
  }

  const filterContainer = document.querySelector(`.${filterType}-filter`);
  filterContainer.innerHTML = "";

  if (filterType === "title" || filterType === "location") {
    const input = document.createElement("input");
    input.className = "filter-input input-theme";
    input.type = "text";
    input.placeholder = `Search by ${
      filterType === "title" ? "job title" : "location"
    }`;

    input.addEventListener("input", (e) => {
      filters[filterType] = e.target.value;
      currentPage = 1;
      jobPostings = [];
      fetchJobPostings(currentPage, filters);
    });
    filterContainer.appendChild(input);
  } else {
    const dropdown = document.createElement("select");
    dropdown.innerHTML =
      `<option value="">${
        filterType === "experienceLevel" ? "Experience Level" : filterType
      }</option>` +
      uniqueValues
        .map((value) => `<option value="${value}">${value}</option>`)
        .join("");

    dropdown.addEventListener("change", (e) => {
      filters[filterType] = e.target.value;
      currentPage = 1;
      jobPostings = [];
      fetchJobPostings(currentPage, filters);
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
    <button onclick="applySalaryFilter()"><p>Apply</p></button>
  `;
}

function applySalaryFilter() {
  const minSalary = document.getElementById("min-salary").value;
  filters.salary = parseInt(minSalary) || 0;
  currentPage = 1;
  jobPostings = [];
  fetchJobPostings(currentPage, filters);
}

function fetchTopTags() {
  fetch("/api/getTopTags")
    .then((response) => response.json())
    .then((tags) => {
      allTags = tags; // Store all tags
      const topTags = document.querySelector(".top-tags");
      const selectedTagsContainer =
        document.querySelector(".selected-tags") ||
        createSelectedTagsContainer();
      const maxTags = 10;
      const displayedTags = tags.slice(0, maxTags);
      const remainingTags = tags.slice(maxTags);

      renderTags(topTags, displayedTags);

      if (remainingTags.length > 0) {
        const seeMore = createSeeMoreButton(remainingTags);
        topTags.appendChild(seeMore);
        renderTags(topTags, remainingTags, true);
      }
    })
    .catch((error) => {
      console.error("Error fetching top tags:", error);
    });
}

function createSelectedTagsContainer() {
  const container = document.createElement("div");
  container.className = "selected-tags";
  document.querySelector(".job-filters").prepend(container);
  return container;
}

function renderTags(container, tags, hidden = false) {
  const tagsHTML = tags
    .map(
      (tag, index) =>
        `<span class="tag ${hidden ? "hidden" : ""}" data-tag="${
          tag.tagName
        }" data-index="${index}">${tag.tagName} ${tag.count}</span>`
    )
    .join("");
  container.insertAdjacentHTML("beforeend", tagsHTML);
}

function createSeeMoreButton(remainingTags) {
  const seeMore = document.createElement("span");
  seeMore.className = "see-more";
  seeMore.innerText = `+${remainingTags.length} more`;
  seeMore.addEventListener("click", () => toggleHiddenTags(seeMore));
  return seeMore;
}

function toggleHiddenTags(seeMoreButton) {
  const topTags = seeMoreButton.closest(".top-tags");
  const hiddenTags = topTags.querySelectorAll(".tag:nth-child(n+11)");

  isTagsExpanded = !isTagsExpanded;

  if (isTagsExpanded) {
    hiddenTags.forEach(tag => tag.classList.remove("hidden"));
    seeMoreButton.innerText = "See less";
  } else {
    hiddenTags.forEach(tag => {
      if (!filters.tags.includes(tag.dataset.tag)) {
        tag.classList.add("hidden");
      }
    });
    seeMoreButton.innerText = `+${hiddenTags.length} more`;
  }
}

function setupEventListeners() {
  document.querySelector(".top-tags").addEventListener("click", handleTagClick);
  document
    .querySelector(".selected-tags")
    .addEventListener("click", handleTagClick);
  document
    .querySelector(".load-more-btn")
    .addEventListener("click", handleLoadMore);
}

function moveTagToOriginalPosition(tag) {
  const topTags = document.querySelector(".top-tags");
  const index = parseInt(tag.dataset.index);
  const seeMoreButton = topTags.querySelector(".see-more");

  if (index < 10) {
    // If it's one of the first 10 tags, insert it at its original position
    const tagsInTopContainer = topTags.querySelectorAll('.tag');
    if (tagsInTopContainer[index]) {
      topTags.insertBefore(tag, tagsInTopContainer[index]);
    } else {
      topTags.insertBefore(tag, seeMoreButton);
    }
    tag.classList.remove("hidden");
  } else {
    // If it's one of the tags after the first 10
    topTags.insertBefore(tag, seeMoreButton);
    if (!isTagsExpanded) {
      tag.classList.add("hidden");
    }
  }
}

function handleTagClick(event) {
  if (event.target.classList.contains("tag")) {
    const tag = event.target;
    const tagName = tag.dataset.tag;
    const isSelected = filters.tags.includes(tagName);

    if (isSelected) {
      filters.tags = filters.tags.filter((t) => t !== tagName);
      tag.classList.remove("selected");
      moveTagToOriginalPosition(tag);
    } else {
      filters.tags.push(tagName);
      tag.classList.add("selected");
      document.querySelector(".selected-tags").appendChild(tag);
    }

    currentPage = 1;
    jobPostings = [];
    fetchJobPostings(currentPage, filters);
  }
}

function fetchJobPostings(page, filters) {
  isLoading = true;

  const { title, location, experienceLevel, salary, tags } = filters;
  const queryParams = new URLSearchParams({
    page,
    limit: itemsPerPage,
    jobTitle: title || "",
    jobLocation: location || "",
    jobExperienceLevel: experienceLevel || "",
    jobSalary: salary || "0",
    tags: tags.join(","),
  });

  fetch(`/api/jobs?${queryParams}`)
    .then((response) => response.json())
    .then((data) => {
      jobPostings =
        page === 1 ? data.jobPostings : [...jobPostings, ...data.jobPostings];
      renderJobPostings();
      updateLoadMoreButton(data.currentPage, data.totalPages);
      isLoading = false;
    })
    .catch((error) => {
      console.error("Error fetching job postings:", error);
      isLoading = false;
    });
}

function handleLoadMore() {
  if (!isLoading) {
    currentPage++;
    fetchJobPostings(currentPage, filters);
  }
}

function updateLoadMoreButton(currentPage, totalPages) {
  const loadMoreBtn = document.querySelector(".load-more-btn");
  loadMoreBtn.style.display = currentPage >= totalPages ? "none" : "block";
}

function renderJobPostings() {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = "";

  jobPostings.forEach((job) => {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job");
    jobElement.onclick = () => {
      window.location.href = `/jobs/${job.id}`;
    };

    const tagsArray = job.tags ? job.tags.split(", ") : [];

    // Sort tags: selected tags first, then others
    const sortedTags = tagsArray.sort((a, b) => {
      const aSelected = filters.tags.includes(a);
      const bSelected = filters.tags.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

    // Take only the first 6 tags
    const displayedTags = sortedTags.slice(0, 6);

    const tagsHTML = displayedTags
      .map((tag) => {
        const isHighlighted = filters.tags.includes(tag);
        return `<span class="tag ${
          isHighlighted ? "highlighted" : ""
        }">${tag}</span>`;
      })
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
    jobListContainer.appendChild(jobElement);
  });
}
