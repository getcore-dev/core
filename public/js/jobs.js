// State management
const state = {
  jobPostings: [],
  currentPage: 1,
  isLoading: false,
  renderedJobIds: new Set(),
  filters: {
    experienceLevel: '',
    location: '',
    title: '',
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
  'Software Engineer',
  'Data Scientist',
  'UX Designer',
  'Cybersecurity',
  'Project Manager',
  'Data Engineer',
  'Solutions Architect',
  'Machine Learning Engineer',
  'Program Manager',
];
const JOB_LEVELS = [
  'Internship',
  'Entry Level',
  'Mid Level',
  'Senior',
  'Lead',
  'Manager',
];
const LOCATIONS = [
  'Remote',
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

// DOM elements
const elements = {
  jobList: document.querySelector('.job-list'),
  topTags: document.querySelector('.top-tags'),
  topSkills: document.querySelector('.top-tags'),
  loadMoreButton: document.getElementById('load-more-btn'),
  loadingIndicator: document.getElementById('loading-indicator'),
  selectedTags:
    document.querySelector('.selected-tags') || createSelectedTagsContainer(),
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
  const container = document.createElement('div');
  container.className = 'selected-tags';
  document.querySelector('.job-filters').prepend(container);
  return container;
};

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);

// Main functions
function initialize() {
  setupDynamicFilters();
  setupEventListeners();
  fetchRecentJobsCount();
  fetchTotalCompaniesCount();
  fetchTopSkills();
  fetchJobPostings();
  fetchRecentCompanies();
  setupInfiniteScroll();
}

function setupDynamicFilters() {
  setupFilter('experienceLevel', JOB_LEVELS);
  setupFilter('location', LOCATIONS);
  setupFilter('title', JOB_TITLES);
  setupSalaryFilter();
}

function setupFilter(filterType, values) {
  const filterContainer = document.querySelector(`.${filterType}-filter`);
  const sortOptions = document.querySelector('.sort-options');

  filterContainer.innerHTML = '';

  if (filterType === 'title' || filterType === 'location') {
    const input = document.createElement('input');
    input.className = 'filter-input input-theme';
    input.type = 'text';
    input.placeholder = `Search by ${
      filterType === 'title' ? 'job title' : 'location'
    }`;
    input.addEventListener(
      'input',
      debounce((e) => {
        state.filters[filterType] = e.target.value;
        resetJobListings();
      }, DEBOUNCE_DELAY)
    );
    filterContainer.appendChild(input);

    if (filterType === 'title') {
      const jobButtonsDiv = document.querySelector('.job-buttons');
      const titleFiltersDiv = document.querySelector('.title-filter');
      const tagsDiv = document.querySelector('.tags');
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'buttons';

      const jobCountsSection = document.createElement('div');
      jobCountsSection.className = 'job-counts secondary-text';
      jobCountsSection.innerHTML = `
        <span class="jobs-header-count">0</span> Jobs
        <span class="companies-header-count">0</span> Companies
      `;
      buttonsDiv.appendChild(jobCountsSection);


      const jobsProfileButton = document.createElement('button');
      jobsProfileButton.className = 'submit-button-normal';
      jobsProfileButton.innerHTML = 'Profile';
      jobsProfileButton.addEventListener('click', () => {
        window.location.href = '/profile/jobs';
      });
      buttonsDiv.appendChild(jobsProfileButton);

      const showFiltersButton = document.createElement('button');
      showFiltersButton.className = 'show-filters null-button-normal null-button-bordered';
      showFiltersButton.innerHTML = 'Filter';
      showFiltersButton.style.height = '34px';
      showFiltersButton.addEventListener('click', () => {
        sortOptions.classList.toggle('show');
        tagsDiv.classList.toggle('show');
      });
      filterContainer.appendChild(buttonsDiv);
      buttonsDiv.appendChild(showFiltersButton);

      /*
      const clearButton = document.createElement("button");
      clearButton.className = "clear-button cancel-button-normal";
      clearButton.innerHTML =
        "<span class='material-symbols-outlined'>close</span>";
      clearButton.style.background = "none";
      clearButton.style.border = "none";
      clearButton.addEventListener("click", clearFilters);
      filterContainer.appendChild(clearButton);
      */
    }
  } else {
    const dropdown = document.createElement('select');
    dropdown.innerHTML =
      `<option value="level" class="secondary-text">${
        filterType === 'experienceLevel' ? 'Level' : filterType
      }</option>` +
      values
        .map((value) => `<option value="${value}">${value}</option>`)
        .join('');
    dropdown.addEventListener('change', (e) => {
      state.filters[filterType] = e.target.value;
      resetJobListings();
    });
    filterContainer.appendChild(dropdown);
  }
}

function toggleLoadingState(isLoading) {
  if (isLoading) {
    elements.loadMoreButton.classList.add('hidden');
    elements.loadingIndicator.classList.remove('hidden');
  } else {
    elements.loadMoreButton.classList.remove('hidden');
    elements.loadingIndicator.classList.add('hidden');
  }
}

function setupSalaryFilter() {
  const salaryContainer = document.querySelector('.salary-filter');
  salaryContainer.innerHTML = `
    <div class="input-container">
      <label for="salary">Salary</label>
      <input type="number" placeholder="Salary" id="min-salary">
    </div>
  `;
  document
    .getElementById('min-salary')
    .addEventListener('input', applySalaryFilter);
}

function applySalaryFilter() {
  state.filters.salary =
    parseInt(document.getElementById('min-salary').value) || 0;
  resetJobListings();
}

async function fetchTopTags() {
  try {
    const response = await fetch('/api/getTopTags');
    state.allTags = await response.json();
    renderTags();
  } catch (error) {
    console.error('Error fetching top tags:', error);
  }
}

async function fetchTopSkills() {
  try {
    const response = await fetch('/api/getTopSkills');
    state.allSkills = await response.json();
    renderSkills();
  } catch (error) {
    console.error('Error fetching top skills:', error);
  }
}

function renderTags() {
  const { topTags } = elements;
  const maxTags = 3;
  const displayedTags = state.allTags.slice(0, maxTags);
  const remainingTags = state.allTags.slice(maxTags);

  topTags.innerHTML = displayedTags
    .map((tag, index) => createTagHTML(tag, index))
    .join('');

  const remainingTagsCount = remainingTags.length;
  seeMoreButton = createSeeMoreButton(remainingTagsCount);
  seeMoreButton.id = 'secondary-text';
  seeMoreButton.onclick = toggleHiddenTags;
  document.getElementById('remaining-tags-count').appendChild(seeMoreButton);

  if (remainingTags.length > 0) {
    topTags.insertAdjacentHTML(
      'beforeend',
      remainingTags
        .map((tag, index) => createTagHTML(tag, index + maxTags, true))
        .join('')
    );
  }
}

function toggleHiddenSkills() {
  state.isSkillsExpanded = !state.isSkillsExpanded;
  const hiddenSkills = elements.topSkills.querySelectorAll(
    '.tag-clickable:nth-child(n+7)'
  );
  hiddenSkills.forEach((skill) => {
    if (state.isSkillsExpanded) {
      skill.classList.remove('hidden');
    } else {
      skill.classList.add('hidden');
    }
  });
  this.textContent = state.isSkillsExpanded ? 'See less' : '+ more';
}

function renderSkills() {
  const { topSkills } = elements;
  const maxSkills = 3;
  const displayedSkills = state.allSkills.slice(0, maxSkills);
  const remainingSkills = state.allSkills.slice(maxSkills);

  topSkills.innerHTML = displayedSkills
    .map((skill, index) => createSkillHTML(skill, index))
    .join('');

  const remainingSkillsCount = remainingSkills.length;
  seeMoreButton = createSeeMoreButton(remainingSkillsCount);
  seeMoreButton.id = 'secondary-text';
  seeMoreButton.onclick = toggleHiddenSkills;
  document.getElementById('remaining-tags-count').appendChild(seeMoreButton);

  if (remainingSkills.length > 0) {
    topSkills.insertAdjacentHTML(
      'beforeend',
      remainingSkills
        .map((skill, index) => createSkillHTML(skill, index + maxSkills, true))
        .join('')
    );
  }
}

function createSkillHTML(skill, index, hidden = false) {
  return `<span class="tag-clickable ${hidden ? 'hidden' : ''}" data-tag="${
    skill.name
  }" data-index="${index}">${skill.name} ${skill.count}</span>`;
}

function createTagHTML(tag, index, hidden = false) {
  return `<span class="tag-clickable ${hidden ? 'hidden' : ''}" data-tag="${
    tag.tagName
  }" data-index="${index}">${tag.tagName} ${tag.count}</span>`;
}

function createSeeMoreButton(count) {
  const seeMore = document.createElement('span');
  seeMore.className = 'see-more';
  seeMore.textContent = `+${count} more`;
  return seeMore;
}

function toggleHiddenTags() {
  state.isTagsExpanded = !state.isTagsExpanded;
  const hiddenTags = elements.topTags.querySelectorAll(
    '.tag-clickable:nth-child(n+7)'
  );
  hiddenTags.forEach((tag) => {
    if (state.isTagsExpanded || state.filters.skills.has(tag.dataset.tag)) {
      tag.classList.remove('hidden');
    } else {
      tag.classList.add('hidden');
    }
  });
  this.textContent = state.isTagsExpanded
    ? 'See less'
    : `+${hiddenTags.length} more`;
}

function setupEventListeners() {
  elements.topTags.addEventListener('click', handleSkillClick);
  elements.selectedTags.addEventListener('click', handleSkillClick);
}

function clearFilters() {
  const filterInputs = document.querySelectorAll('.filter-input');
  filterInputs.forEach((input) => (input.value = ''));
  state.filters = {
    experienceLevel: '',
    location: '',
    title: '',
    salary: 0,
    skills: new Set(),
  };
  resetJobListings();
}

function handleTagClick(event) {
  if (event.target.classList.contains('tag-clickable')) {
    const tag = event.target;
    const tagName = tag.dataset.tag;
    if (state.skills.tags.has(tagName)) {
      state.skills.tags.delete(tagName);
      tag.classList.remove('selected');
      moveTagToOriginalPosition(tag);
    } else {
      state.skills.tags.add(tagName);
      tag.classList.add('selected');
      elements.selectedTags.appendChild(tag);
    }
    resetJobListings();
  }
}


function handleSkillClick(event) {
  const selectedTagsHeader = document.querySelector('.selected-tags-header');
  if (event.target.classList.contains('tag-clickable')) {
    const skill = event.target;
    const skillName = skill.dataset.tag;
    if (state.filters.skills[skillName]) {
      delete state.filters.skills[skillName];
      skill.classList.remove('selected');
      moveTagToOriginalPosition(skill);
    } else {
      state.filters.skills[skillName] = true;
      skill.classList.add('selected');
      elements.selectedTags.appendChild(skill);
    }
    resetJobListings();
  }
  if (Object.keys(state.filters.skills).length > 0) {
    selectedTagsHeader.style.display = 'block';
  } else {
    selectedTagsHeader.style.display = 'none';
  }
}

function moveTagToOriginalPosition(tag) {
  const index = parseInt(tag.dataset.index);
  const seeMoreButton = elements.topTags.querySelector('.see-more');
  if (index < 6) {
    const tagsInTopContainer =
      elements.topTags.querySelectorAll('.tag-clickable');
    if (tagsInTopContainer[index]) {
      elements.topTags.insertBefore(tag, tagsInTopContainer[index]);
    } else {
      elements.topTags.insertBefore(tag, seeMoreButton);
    }
    tag.classList.remove('hidden');
  } else {
    elements.topTags.insertBefore(tag, seeMoreButton);
    if (!state.isTagsExpanded) {
      tag.classList.add('hidden');
    }
  }
}

function resetJobListings() {
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  elements.jobList.innerHTML = '';
  fetchJobPostings();
}

/*
router.get('/recentCompanies', cacheMiddleware(2400), async (req, res) => {
  try {
    const companies = await jobQueries.getRecentCompanies();
    return res.json(companies);
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).send('Error fetching companies');
  }
});
*/

async function fetchRecentCompanies() {
  try {
    const response = await fetch('/api/recentCompanies');
    const companies = await response.json();
    renderCompanies(companies);
  } catch (error) {
    console.error('Error fetching recent companies:', error);
  }
}

async function fetchTotalCompaniesCount() {
  try {
    const response = await fetch('/api/totalCompaniesCount');
    const companiesCount = await response.json();
    renderCompaniesCount(companiesCount);
  } catch (error) {
    console.error('Error fetching recent companies count:', error);
  }
}

function renderCompaniesCount(companiesCount) {
  const companiesCountElement = document.querySelector('.companies-header-count');
  companiesCountElement.textContent = companiesCount.toLocaleString();
}

async function fetchRecentJobsCount() {
  try {
    const response = await fetch('/api/recentJobsCount');
    const jobsCount = await response.json();
    renderJobsCount(jobsCount);
  } catch (error) {
    console.error('Error fetching recent jobs count:', error);
  }
}

function renderJobsCount(jobsCount) {
  const jobsCountElement = document.querySelector('.jobs-header-count');
  jobsCountElement.textContent = jobsCount.toLocaleString();
}

function renderCompanies(companies) {
  const companyList = document.querySelector('.company-list');
  companies.forEach((company) => {
    const companyElement = createCompanyElement(company);
    companyList.appendChild(companyElement);
  });

  // Create the button element
  const button = document.createElement('button');
  button.textContent = 'View All Companies';
  button.onclick = () => {
    window.location.href = '/companies';
  };
  button.className = 'null-button-normal';

  // Append the button to the company list
  companyList.appendChild(button);
}

function createCompanyElement(company) {
  const companyElement = document.createElement('div');
  companyElement.className = 'company';
  companyElement.onclick = (event) => {
    event.stopPropagation();
    window.location.href = `/jobs/company/${company.name}`;
  };
  companyElement.innerHTML = `
    <img class="thumbnail-micro thumbnail thumbnail-regular" src="${company.logo}" alt="${company.name}" />
    <p class="main-text secondary-text sub-text">${company.name}</p> <span class="counter red-counter">${company.job_count}</span>
  `;
  return companyElement;
}



async function fetchJobPostings() {
  if (state.isLoading) return;
  state.isLoading = true;
  toggleLoadingState(true);

  const { title, location, experienceLevel, salary, skills } = state.filters;
  const queryParams = new URLSearchParams({
    page: state.currentPage,
    pageSize: ITEMS_PER_PAGE,
    jobTitle: title || '',
    jobLocation: location || '',
    jobExperienceLevel: experienceLevel || '',
    jobSalary: salary || '0',
    skills: Object.keys(skills).join(','),
  });

  try {
    const response = await fetch(`/api/jobs?${queryParams}`);
    const data = await response.json();
    console.log(data);

    // Filter out jobs that have already been rendered
    const newJobs = data.jobPostings.filter(
      (job) => !state.renderedJobIds[job.id]
    );

    if (newJobs.length > 0) {
      // Sort jobs based on the number of matching skills
      newJobs.sort((a, b) => {
        const aSkills = a.skills ? a.skills[1].split(',').map(s => s.trim()) : [];
        const bSkills = b.skills ? b.skills[1].split(',').map(s => s.trim()) : [];
        const aMatchCount = aSkills.filter(skill => state.filters.skills[skill]).length;
        const bMatchCount = bSkills.filter(skill => state.filters.skills[skill]).length;
        return bMatchCount - aMatchCount;
      });

      state.jobPostings = [...state.jobPostings, ...newJobs];
      renderJobPostings(newJobs);
      state.currentPage++;
    }

    state.isLoading = false;
    toggleLoadingState(false);

  } catch (error) {
    console.error('Error fetching job postings:', error);
    state.isLoading = false;
    toggleLoadingState(false);
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

  if (state.jobPostings.length === 0 && elements.jobList.children.length === 0) {
    const noJobsMessage = document.createElement('div');
    noJobsMessage.classList.add('no-jobs-message');
    noJobsMessage.textContent = 'No job postings found matching your criteria.';
    elements.jobList.appendChild(noJobsMessage);
  } else {
    const existingNoJobsMessage = elements.jobList.querySelector('.no-jobs-message');
    if (existingNoJobsMessage) {
      existingNoJobsMessage.remove();
    }
  }

}

function formatRelativeDate(dateString) {
  const now = new Date();
  const postedDate = new Date(dateString);
  const diffTime = Math.abs(now - postedDate);
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return `${diffYears}y`;
  } else if (diffMonths > 0) {
    return `${diffMonths}m`;
  } else if (diffDays > 0) {
    return `${diffDays}d`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else {
    return 'Just now';
  }
}

function formatLocation(location) {
  if (!location) return "";

  const parts = location.split(',').map(part => part.trim());

  // Helper function to check if a string is a US state
  const isUSState = (str) => Object.keys(stateMappings).includes(str) || Object.values(stateMappings).includes(str);

  // Helper function to get state abbreviation
  const getStateAbbr = (state) => {
    const fullName = Object.keys(stateMappings).find(key => key.toLowerCase() === state.toLowerCase());
    return fullName ? stateMappings[fullName] : state;
  };

  // Helper function to get country abbreviation
  const getCountryAbbr = (country) => {
    const fullName = Object.keys(countryMappings).find(key => key.toLowerCase() === country.toLowerCase());
    return fullName ? countryMappings[fullName] : country;
  };

  if (parts.length === 1) {
    return getCountryAbbr(parts[0]);
  } else if (parts.length === 2) {
    if (isUSState(parts[1])) {
      return getStateAbbr(parts[1]);
    } else {
      return getCountryAbbr(parts[1]);
    }
  } else if (parts.length >= 3) {
    if (parts[2].trim().toLowerCase() === 'united states') {
      return getStateAbbr(parts[1]);
    } else {
      return getCountryAbbr(parts[2]);
    }
  }

  return location.trim();
}

function formatSalary(salary) {
  if (!salary) return "";
  return salary >= 1000 ? (salary / 1000).toFixed(0) + "k" : salary.toString();
}

function getFormattedSalary(salary, salaryMax) {
  if (salary && salaryMax) {
    const average = Math.round((salary + salaryMax) / 2);
    return `${formatSalary(average)}`;
  } else if (salary) {
    return formatSalary(salary);
  }
  return "";
}

function formatDateColor(dateString) {
  const now = new Date();
  const postedDate = new Date(dateString); 
  // if within 2 weeks, green, if within 2 months, yellow, if older, red
  const diffTime = Math.abs(now - postedDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 14) {
    return 'green';
  } else if (diffDays <= 60) {
    return 'yellow';
  } else {
    return 'red';
  }
}

function createJobElement(job) {
  const jobElement = document.createElement('div');
  jobElement.classList.add('job');
  jobElement.onclick = () => (window.location.href = `/jobs/${job.id}`);

  const tagsArray = job.skills
  ? job.skills.split(',').map(skill => skill.trim())
  : [];
  console.log(job.skills);

  const sortedTags = tagsArray.sort((a, b) => {
    if (state.filters.skills[a] && !state.filters.skills[b]) return -1;
    if (!state.filters.skills[a] && state.filters.skills[b]) return 1;
    return a.localeCompare(b);
  });
  const displayedTags = sortedTags.slice(0, 3);

  const tagsHTML = displayedTags
    .map(
      (skill) =>
        `<span class="tag ${
          state.filters.skills[skill] ? 'highlighted' : ''
        }">${skill}</span>`
    )
    .join('');

  jobElement.innerHTML = `
    <div class="job-preview">
      <div class="job-info">
        <div class="company-info margin-03-bottom">
          ${
  job.company_logo
    ? `<img class="thumbnail thumbnail-regular thumbnail-micro" src="${job.company_logo}" alt="" />`
    : ''
}
          <div class="job-posting-company-info">
            <p class="company-name secondary-text">${job.company_name}</p>
          </div>
        </div>
                    <h3 class="job-title"><a href="/jobs/${job.id}">${
  job.title
}</a></h3>
        <div class="job-posting-information job-subtitle secondary-text">
        <div class="job-description margin-03-bottom">
        ${job.description}
        </div>
        </div>
        <div class="job-posting-flairs margin-06-bottom">${tagsHTML}</div>
                            <div class="job-title-location secondary-text sub-text">
                            <div class="job-post-date ${formatDateColor(job.postedDate)} sub-text">
  ${formatRelativeDate(job.postedDate)} 
  </div>
  <span style="font-size:.7rem;">•</span>
                                      <div class="experience-level sub-text">${
  job.experienceLevel === 'Mid Level'
    ? 'L3/L4'
    : job.experienceLevel === 'Entry Level'
      ? 'L1/L2'
      : job.experienceLevel === 'Senior'
        ? 'L5/L6'
        : job.experienceLevel
}</div>
${job.salary || job.salary_max ? `
  <span style="font-size:.7rem;">•</span><div class="job-salary sub-text">
    <span class="material-symbols-outlined">attach_money</span>
    ${getFormattedSalary(job.salary, job.salary_max)}/yr
  </div>
` : ``}

<span style="font-size:.7rem;">•</span><div class="location sub-text">
  <span class="material-symbols-outlined">location_on</span>
  ${formatLocation(job.location).trim()}
</div>
<span style="font-size:.7rem;">•</span><div class="applicants sub-text">
<span class="material-symbols-outlined">person</span>
${job.applicants ? job.applicants : '0'}
</div>
                    </div>
      </div>
    </div>
  `;
  return jobElement;
}

function setupInfiniteScroll() {
  const options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.isLoading) {
      fetchJobPostings();
    }
  }, options);

  observer.observe(document.querySelector('.load-more-btn'));
}

function removeInfiniteScroll() {
  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = 'none';
  }
}
