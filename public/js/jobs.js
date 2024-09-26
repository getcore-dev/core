// State management
const state = {
  jobPostings: [],
  currentPage: 1,
  isLoading: false,
  renderedJobIds: new Set(),
  filters: {
    experiencelevels: new Set(),
    locations: new Set(),
    titles: new Set(),
    salary: 0,
    skills: new Set(),
    companies: new Set(),
  },
  hasMoreData: true,
  allTags: [],
  isTagsExpanded: false,
  isSkillsExpanded: false,
  jobSearchInput: document.getElementById('job-search-input'),
};

function updateStateFromQuery() {
  const query = getQueryParams();
  if (Object.keys(query).length > 0) {
    flushState();
    console.log(query);
    console.log('cleared state');
     
  }
  
  if (query.skill) {
    state.filters.skills = new Set();
    if (Array.isArray(query.skill)) {
      query.skill.forEach(skill =>  {
        state.filters.skills.add(skill.trim())
      });
    } else {
      state.filters.skills.add(query.skill.trim());
    }
  }
  if (query.locations) {
    state.filters.locations = new Set();
    if (Array.isArray(query.location)) {
      query.locations.forEach(location => {
        state.filters.locations.add(location.trim());
      });
    } else {
      state.filters.locations.add(query.locations.trim());

    }
  }

  // trigger search if there are any filters from the query
  if (Object.keys(query).length > 0) {
    triggerJobSearch();
  }

}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const query = {};
  for (const [key, value] of params.entries()) {
    if (query[key]) {
      // If the key already exists, convert it to an array
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }
  return query;
}

function setupInfiniteScroll() {
  const options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.isLoading && state.hasMoreData) {
      fetchJobPostings();
    }
  }, options);

  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    observer.observe(loadMoreBtn);
  }
}

async function updateJobCount() {
  try {
    const response = await fetch('/api/jobs-count');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const jobCount = await response.json();
    document.getElementById('recent-jobs-count').textContent = jobCount + ' postings in the last 60 days';
  } catch (error) {
    console.error('Error fetching job count:', error);
  }
}


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
  recentJobList: document.querySelector('.recent-job-list'),
  topTags: document.querySelector('.top-tags'),
  topSkills: document.querySelector('.top-tags'),
  loadMoreButton: document.getElementById('load-more-btn'),
  loadingIndicator: document.getElementById('loading-indicator'),

};

// Utility functions
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  try {
  loadStateFromLocalStorage();
  updateStateFromQuery();
  setupInfiniteScroll();
  } catch (error) {
    console.error('Error loading state from local storage:', error);
    fetchJobPostings();
  }
  if (state.jobPostings.length === 0) {
    fetchJobPostings();
  }
  updateJobCount();
}



function toggleLoadingState(isLoading) {
  if (!state.hasMoreData) {
    elements.loadMoreButton.classList.add('hidden');
    elements.loadingIndicator.classList.add('hidden');
    removeInfiniteScroll();
    return;
  }
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

function createSkillHTML(skill, index, hidden = false) {
  return `<span class="tag-clickable ${hidden ? 'hidden' : ''}" data-tag="${
    skill.name
  }" data-index="${index}" data-id="${skill.id}">${skill.name} ${skill.count}</span>`;
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
    const skillId = skill.dataset.id;
    if (state.filters.skills[skillId]) {
      delete state.filters.skills[skillId];
      skill.classList.remove('selected');
      moveTagToOriginalPosition(skill);
    } else {
      state.filters.skills[skillId] = skillName;
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
  elements.recentJobList.innerHTML = '';
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

function clearAllFilters() {
  state.filters = {
    experiencelevels: new Set(),
    locations: new Set(),
    titles: new Set(),
    salary: 0,
    skills: new Set(),
    companies: new Set(),
  };
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  state.hasMoreData = true;

  // Clear UI
  elements.jobList.innerHTML = '';
  elements.recentJobList.innerHTML = '';
  document.querySelector('.jobs-selected-filters').innerHTML = '';

  saveStateToLocalStorage();
  fetchJobPostings();
}

function triggerJobSearch() {
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  elements.jobList.innerHTML = '';
  elements.recentJobList.innerHTML = '';

  saveStateToLocalStorage(); // Save the cleared state
  fetchJobPostings();
}

function resetState() {
  state.filters = {
    experiencelevels: new Set(),
    locations: new Set(),
    titles: new Set(),
    salary: 0,
    skills: new Set(),
    companies: new Set(),
  };
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  state.hasMoreData = true;
  state.isLoading = false;

  // Clear UI
  elements.jobList.innerHTML = '';
  elements.recentJobList.innerHTML = '';
  document.querySelector('.jobs-selected-filters').innerHTML = '';
  document.getElementById('min-salary').value = '';

  saveStateToLocalStorage();
  fetchJobPostings();
}

function flushState() {
  state.filters = {
    experiencelevels: new Set(),
    locations: new Set(),
    titles: new Set(),
    salary: 0,
    skills: new Set(),
    companies: new Set(),
  };
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  state.hasMoreData = true;
  state.isLoading = false;

  // Clear UI
  elements.jobList.innerHTML = '';
  elements.recentJobList.innerHTML = '';
  document.querySelector('.jobs-selected-filters').innerHTML = '';
}

function renderCompaniesCount(companiesCount) {
  const companiesCountElement = document.querySelector('.companies-header-count');
  companiesCountElement.textContent = companiesCount.toLocaleString();
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
    <p class="main-text secondary-text sub-text">${company.name}</p> <span class="counter grey-counter">${company.job_count}</span>
  `;
  return companyElement;
}



async function fetchJobPostings() {
  if (state.isLoading || !state.hasMoreData) return;
  state.isLoading = true;
  toggleLoadingState(true);

  const queryParams = new URLSearchParams({
    page: state.currentPage,
    pageSize: ITEMS_PER_PAGE,
    titles: JSON.stringify(Array.from(state.filters.titles)),
    locations: JSON.stringify(Array.from(state.filters.locations)),
    experiencelevels: JSON.stringify(Array.from(state.filters.experiencelevels)),
    salary: state.filters.salary || '0',
    skills: JSON.stringify(Array.from(state.filters.skills)),
    companies: JSON.stringify(Array.from(state.filters.companies)) || '[]', // Default to empty array
  });

  try {
    const response = await fetch(`/api/jobs?${queryParams}`);
    const data = await response.json();

    // Filter out jobs that have already been rendered
    const newJobs = data.jobPostings.filter(
      (job) => !state.renderedJobIds.has(job.id)
    );

    if (newJobs.length > 0) {
      state.jobPostings = [...state.jobPostings, ...newJobs];
      renderJobPostings(newJobs);
      state.currentPage++;
      saveStateToLocalStorage();
    } else {
      const noJobsMessage = document.createElement('div');
      noJobsMessage.classList =  'no-jobs-message flex h-center py-4 secondary-text mini-text';
      noJobsMessage.textContent = '🎉 You reached the end of the list';
      elements.jobList.appendChild(noJobsMessage);
      state.hasMoreData = false;
    }

    state.isLoading = false;
    toggleLoadingState(false);

  } catch (error) {
    console.error('Error fetching job postings:', error);
    state.isLoading = false;
    toggleLoadingState(false);
    state.hasMoreData = false;
  }
  setupInfiniteScroll();
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
  } else {
    const existingNoJobsMessage = elements.jobList.querySelector('.no-jobs-message');
    if (existingNoJobsMessage) {
      existingNoJobsMessage.remove();
    }
  }

}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 172800) {
    return '1d ago';
  } else {
    const month = date.toLocaleString('default', { month: 'short' });
    const day = String(date.getDate());
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    } else {
      return `${month} ${day}, ${year}`;
    }
  }
}


function saveStateToLocalStorage() {
  const stateToSave = {
    jobPostings: state.jobPostings,
    currentPage: state.currentPage,
    filters: {
      experiencelevels: Array.from(state.filters.experiencelevels),
      locations: Array.from(state.filters.locations),
      titles: Array.from(state.filters.titles),
      salary: state.filters.salary,
      skills: Array.from(state.filters.skills),
      companies: Array.from(state.filters.companies),
    },
    hasMoreData: state.hasMoreData,
  };
  localStorage.setItem('jobSearchState', JSON.stringify(stateToSave));
}

function loadStateFromLocalStorage() {
  const savedState = localStorage.getItem('jobSearchState');
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    state.jobPostings = parsedState.jobPostings;
    state.currentPage = parsedState.currentPage;
    state.filters = {
      experiencelevels: Array.isArray(parsedState.filters.experiencelevels) ? new Set(parsedState.filters.experiencelevels) : new Set(),
      locations: new Set(parsedState.filters.locations),
      titles: new Set(parsedState.filters.titles),
      salary: parsedState.filters.salary,
      skills: new Set(parsedState.filters.skills),
      companies: new Set(parsedState.filters.companies),
    };
    state.hasMoreData = true;

    // Restore the UI state
    restoreUIState();
  }
}

function restoreUIState() {
  // Clear existing job listings
  elements.jobList.innerHTML = '';
  elements.recentJobList.innerHTML = '';

  // Render saved job postings
  renderJobPostings(state.jobPostings);

  // Restore selected filters
  const selectedFiltersContainer = document.querySelector('.jobs-selected-filters');
  selectedFiltersContainer.innerHTML = ''; // Clear existing filters

  for (let [type, filterSet] of Object.entries(state.filters)) {
    if (type === 'titles') type = 'tech-job-titles';
    if (type === 'locations') type = 'job-locations';
    if (type === 'experiencelevels') type = 'job-levels';
    console.log(type);

    if (type !== 'salary' && filterSet.size > 0) {
      filterSet.forEach(filter => {
        if (type === 'companies') {
          const { id, name, logo } = JSON.parse(filter);
        } else if (type === 'job-levels') {
          const button = document.querySelector(`button[data-type="job-levels"][data-name="${filter}"]`);
          button.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
          const dropdown = document.querySelector('.experience-dropdown');
          dropdown.classList.add('active');
          dropdown.innerHTML = filter + '<span class="arrow">&#9662;</span>';
        } else if (type == 'job-locations') {
          const button = document.querySelector(`button[data-type="job-locations"][data-name="${filter}"]`);
          button.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
          const dropdown = document.querySelector('.location-dropdown');
          dropdown.classList.add('active');
          dropdown.innerHTML = filter + '<span class="arrow">&#9662;</span>';
        } else if (type == 'tech-job-titles') {
          const button = document.querySelector(`button[data-type="tech-job-titles"][data-name="${filter}"]`);
          button.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
          const dropdown = document.querySelector('.title-dropdown');
          dropdown.classList.add('active');
          dropdown.innerHTML = filter + '<span class="arrow">&#9662;</span>';
        }
      });
    }
  }

  // Restore salary filter
  if (state.filters.salary) {
    document.getElementById('min-salary').value = state.filters.salary;
  }
}


document.addEventListener('DOMContentLoaded', () => {
  const appliedJobsLink = document.getElementById('applied-jobs-link');

  if (appliedJobsLink) {
    fetch('/api/applied-jobs-count')
      .then(response => response.json())
      .then(data => {
        appliedJobsLink.textContent = `${data} Applied Job${data === 1 ? '' : 's'}`;
      })
      .catch(error => {
        console.error('Error fetching applied jobs count:', error);
        appliedJobsLink.textContent = 'Applied Jobs';
      });
  }
});

function createJobElement(job) {
  const jobElement = document.createElement('div');
  jobElement.classList.add('job');
  jobElement.classList.add('px-4');
  jobElement.classList.add('py-4');


  jobElement.onclick = () => (window.location.href = `/jobs/${job.id}`);

  const tagsArray = job.skills
  ? job.skills.split(',').map(skill => skill.trim().toLowerCase())
  : [];

const sortedTags = tagsArray.sort((a, b) => {
  if (state.filters.skills.has(a.toLowerCase()) && !state.filters.skills.has(b.toLowerCase())) return -1;
  if (!state.filters.skills.has(a.toLowerCase()) && state.filters.skills.has(b.toLowerCase())) return 1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
});
const displayedTags = sortedTags.slice(0, 3);

const skillsArray = Array.from(state.filters.skills).map(skill => skill.trim().toLowerCase());

const filteredSkills = displayedTags.filter(skill => skillsArray.includes(skill.toLowerCase()));
const otherSkills = displayedTags.filter(skill => !skillsArray.includes(skill.toLowerCase()));

const sortedSkills = [...filteredSkills, ...otherSkills];
let tagsHTML = sortedSkills
  .sort((a, b) => {
    const aExists = state.filters.skills.has(a.toLowerCase());
    const bExists = state.filters.skills.has(b.toLowerCase());
    return bExists - aExists || a.localeCompare(b, undefined, { sensitivity: 'base' });
  })
  .map((skill) => {
    const skillLower = skill.toLowerCase();
    const skillExists = Array.from(state.filters.skills).some(s => s.toLowerCase() === skillLower);
        return `
      <span data-name="${skill}" data-type="skills" data-id="${skill}" data-index="${sortedTags.indexOf(skill)}" class="mini-text bold text-tag ${
        skillExists ? 'green-text-tag' : ''
      }">${skill}</span>`;
  })
  .join('');

const remainingSkillsCount = sortedTags.length - 3;
if (remainingSkillsCount > 0) {
  tagsHTML += `
    <span class="remaining-tags mini-text" style="cursor: pointer;" onclick="toggleHiddenTags()">
      +${remainingSkillsCount} more
    </span>
  `;
}
  

jobElement.innerHTML = `
<div class="job-preview">
  <div class="job-info">
    <div class="flex flex-row w-100 space-between v-center margin-06-bottom gap-03">
    <div class="flex flex-row gap-06">
      ${
    job.company_logo
      ? `<img class="thumbnail thumbnail-regular thumbnail-tiny" src="${job.company_logo}" alt="${job.company_name}" onerror="this.onerror=null;this.src='/img/glyph.png';" />`
      : ''
  }
      <div class="flex flex-col margin-06-bottom">
              <a class="company-name secondary-text sub-text" href="/jobs/company/${job.company_name}">${job.company_name}</a>
        <a href="/jobs/${job.id}"><h3 class="job-title main-text">${job.title}</h3></a>
      </div>
      </div>
      <div class="location-badge">
        📍 ${formatLocation(job.location).trim().substring(0, 25)}
      </div>
    </div>
    <div class="job-tags margin-06-bottom">
      ${tagsHTML}
    </div>
    <div class="job-details mini-text">
          ${job.salary || job.salary_max ? `
        <span class="text-tag bold flex flex-row v-center salary">
          <svg class="icon" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          ~${formatSalary(job.salary)}/yr
        </span>
      ` : ``}
      <span class="text-tag flex flex-row v-center applicants">
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        ${job.applicants ? `${job.applicants} applicants` : '0 applicants'}
      </span>
      <span class="text-tag flex flex-row v-center post-date">
        <svg class="icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
        <time>${formatRelativeDate(job.postedDate)}</time>
      </span>
      <span class="text-tag flex flex-row v-center experience-level">
        <svg class="icon" viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
        ${
          job.experienceLevel === 'Mid Level'
            ? 'L3/L4'
            : job.experienceLevel === 'Entry Level'
              ? 'L1/L2'
              : job.experienceLevel === 'Senior'
                ? 'L5/L6'
                : job.experienceLevel
        }
      </span>
    </div>
  </div>
</div>
`;
  return jobElement;
}

function removeInfiniteScroll() {
  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = 'none';
  }
}
state.jobSearchInput.addEventListener('input', 
  debounce(() => {
    if (!state.jobSearchInput.value) {
      clearSearchResults();
      return;
    }
    if (state.jobSearchInput.value.length < 2) return;

    const searchTerm = state.jobSearchInput.value;
    const routes = ['companies', 'skills', 'tech-job-titles', 'job-locations', 'job-levels'];

    Promise.all(routes.map(route => 
      fetch(`/autocomplete/${route}?term=${searchTerm}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => response.json())
    ))
    .then(results => {
      if (results.every(result => result.length === 0)) {
        clearSearchResults();
        return;
      }
      // Normalize and combine all results
      const combinedResults = results.flatMap((routeResults, index) => {
        const type = routes[index];
        return routeResults.map(item => ({
          id: item.id,
          name: item.name || item.title || item.location || item.level,
          jobCount: item.jobCount || 0,
          type: type,
          logo: item.logo // Only for companies
        }));
      });

      // Sort by job count in descending order
      const sortedResults = combinedResults.sort((a, b) => b.jobCount - a.jobCount);

      // Display results
      displaySearchResults(sortedResults);
    })
    .catch(error => {
      console.error('Error fetching search results:', error);
    });
  }, DEBOUNCE_DELAY)
);

function displaySearchResults(results) {
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'job-search-results';

  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    resultItem.dataset.type = result.type;
    resultItem.dataset.id = result.id;
    resultItem.dataset.name = result.name;
    if (result.logo) resultItem.dataset.logo = result.logo;
    
    let content = `<p class="sub-text link">${result.name}</p> <p class="mini-text secondary-text">in <strong>${result.type}</strong> - ${result.jobCount} jobs</p>`;
    
    if (result.type === 'companies' && result.logo) {
      const logo = document.createElement('img');
      logo.src = result.logo;
      logo.alt = `${result.name} logo`;
      logo.className = 'thumbnail-micro thumnbnail thumbnail-regular';
      resultItem.appendChild(logo);
    }
    
    resultDiv = document.createElement('div');
    resultDiv.innerHTML = content;
    resultItem.appendChild(resultDiv);
    resultItem.addEventListener('click', handleResultClick);
    resultsContainer.appendChild(resultItem);
  });

  clearSearchResults();
  state.jobSearchInput.parentNode.insertBefore(resultsContainer, state.jobSearchInput.nextSibling);

  // Hide skill results if any company, title, or location is already selected
  if (state.filters.companies.size > 0 || state.filters.titles.size > 0 || state.filters.locations.size > 0) {
    const skillResults = resultsContainer.querySelectorAll('.search-result-item[data-type="skills"]');
    skillResults.forEach(item => item.style.display = 'none');
  }
}

function handleResultClick(event) {
  const result = event.currentTarget;
  const type = result.dataset.type;
  const id = result.dataset.id;
  const name = result.dataset.name;
  const logo = result.dataset.logo;
  console.log(result);

  if (type === 'job-locations' || type === 'tech-job-titles') {
    updateState(type, name, name, logo);
  } else if (type == 'companies') {
    updateState(type, id, name, logo);
  } else {
    updateState(type, id, name, logo);
  }
  
  // Clear search results
  clearSearchResults();
  state.jobSearchInput.value = '';
  
  // Hide skill results if company, title, or location is selected
  if (type === 'companies' || type === 'tech-job-titles' || type === 'job-locations' || type === 'skills') {
    const skillResults = document.querySelectorAll('.search-result-item[data-type="skills"]');
    skillResults.forEach(item => item.style.display = 'none');
  }
}

function addToSelectedFilters(type, id, name, logo) {
  console.log(id);
  const selectedFiltersContainer = document.querySelector('.jobs-selected-filters');
  
  let typeSection = selectedFiltersContainer.querySelector(`.selected-${type.toLowerCase().replace(' ', '-')}`);
  if (!typeSection) {
    typeSection = document.createElement('div');
    typeSection.className = `selected-${type.toLowerCase().replace(' ', '-')}`;
    const header = document.createElement('h4');
    header.textContent = type === 'tech-job-titles' ? 'Jobs' : type === 'job-locations' ? 'Locations' : capitalizeFirstLetter(type);
    typeSection.appendChild(header);
    selectedFiltersContainer.appendChild(typeSection);
  }

  const existingItem = typeSection.querySelector(`[data-id="${id}"]`);
  if (existingItem) return; // Item already added

  const item = document.createElement(type === 'skills' ? 'span' : 'div');
  item.className = 'text-tag selected-text-tag bold tag';
  item.dataset.id = id;
  item.dataset.type = type;
  
  if (type === 'companies' && logo) {
    const logoImg = document.createElement('img');
    logoImg.src = logo;
    logoImg.alt = `${name} logo`;
    logoImg.className = 'thumbnail-micro thumbnail thumbnail-regular';
    item.appendChild(logoImg);
  }

  const nameSpan = document.createElement('span');
  nameSpan.textContent = name;
  item.appendChild(nameSpan);

  const removeButton = document.createElement('button');
  removeButton.textContent = '×';
  removeButton.className = 'remove-item';
  removeButton.addEventListener('click', () => removeSelectedItem(item));

  item.appendChild(removeButton);
  typeSection.appendChild(item);
}

function removeSelectedItem(item) {
  const type = item.dataset.type;
  const id = item.dataset.id;
  console.log(id);

  const name = item.dataset.name || item.querySelector('span').textContent;

  const typeSection = item.parentElement;
  console.log(typeSection.children.length);
  console.log(typeSection.children);
  typeSection.removeChild(item);
  if (typeSection.children.length === 1) { // Only header left
    typeSection.parentElement.removeChild(typeSection);
  }
  console.log(item.dataset);
  updateState(type, id, name, null, true); // true indicates removal
  
  // Update the corresponding dropdown or button
  updateDropdownAfterRemoval(type, name);
}

function updateDropdownAfterRemoval(type, name) {
  const dropdownClassMap = {
    'job-levels': 'experience-dropdown',
    'job-locations': 'location-dropdown',
    'tech-job-titles': 'job-title-dropdown',
    'skills': 'skills-dropdown', // Add if applicable
    'companies': 'companies-dropdown', // Add if applicable
  };
  const dropdownDefaultTextMap = {
    'job-levels': 'Experience Level',
    'job-locations': 'Location',
    'tech-job-titles': 'Job Title',
    'skills': 'Skills', // Add if applicable
    'companies': 'Companies', // Add if applicable
  };

  const dropdownClass = dropdownClassMap[type];
  const dropdownDefaultText = dropdownDefaultTextMap[type];

  if (dropdownClass) {
    const dropdown = document.querySelector(`.${dropdownClass}`);
    if (dropdown) {
      // Reset the dropdown text to default or remove the specific selection
      dropdown.innerHTML = `${dropdownDefaultText}<span class="arrow">&#9662;</span>`;
      
      // Additionally, update the filter buttons to reflect the removal
      const buttons = document.querySelectorAll(`[data-type="${type}"]`);
      buttons.forEach(button => {
        if (button.dataset.name === name || button.dataset.id === id) {
          button.className = 'quick-option-btn no-bg no-border w-100 mini-text';
        }
      });
    }
  }
}

function toggleSelectedFilter(event) {
  const result = event.currentTarget;
  const type = result.dataset.type;
  const id = result.dataset.id;
  const name = result.dataset.name;
  const logo = result.dataset.logo;

  const isAlreadySelected = isFilterSelected(type, id, name);

  // Mapping from type to dropdown class and default text
  const dropdownClassMap = {
    'job-levels': 'experience-dropdown',
    'job-locations': 'location-dropdown',
    'tech-job-titles': 'job-title-dropdown',
  };
  const dropdownDefaultTextMap = {
    'job-levels': 'Experience Level',
    'job-locations': 'Location',
    'tech-job-titles': 'Job Title',
  };

  const dropdownClass = dropdownClassMap[type];
  const dropdownDefaultText = dropdownDefaultTextMap[type];

  const dropdown = document.querySelector(`.${dropdownClass}`);

  if (isAlreadySelected) {
    clearSelectedFilters(type); // Clear previously selected filters
    event.target.className = 'quick-option-btn no-bg no-border w-100 mini-text';
    dropdown.innerHTML = `${dropdownDefaultText}<span class="arrow">&#9662;</span>`;
    dropdown.classList.remove('active');
    updateState(type, id, name, logo, true);
    console.log(event.target);  
    console.log(type, id, name, logo, true);
  } else {
    dropdown.classList.add('active');
    clearSelectedFilters(type); // Clear previously selected filters
    const buttons = document.querySelectorAll(`[data-type="${type}"]`);
    buttons.forEach(button => {
      button.className = 'quick-option-btn no-bg no-border w-100 mini-text';
    });
    event.target.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
    // Set the dropdown to the selected value
    dropdown.innerHTML = `${name}<span class="arrow">&#9662;</span>`;
    handleResultClick(event);
    updateState(type, id, name, logo);
  }
}


function clearSelectedFilters(type) {
  let filterSet;
  switch(type) {
    case 'tech-job-titles':
      filterSet = state.filters.titles;
      break;
    case 'job-locations':
      filterSet = state.filters.locations;
      break;
    case 'skills':
      filterSet = state.filters.skills;
      break;
    case 'companies':
      filterSet = state.filters.companies;
      break;
    case 'job-levels':
      filterSet = state.filters.experiencelevels;
      break;
  }

  filterSet.clear();
}

function isFilterSelected(type, id, name) {
  let filterSet;
  switch(type) {
    case 'tech-job-titles':
      filterSet = state.filters.titles;
      break;
    case 'job-locations':
      filterSet = state.filters.locations;
      break;
    case 'skills':
      filterSet = state.filters.skills;
      break;
    case 'companies':
      filterSet = state.filters.companies;
      break;
    case 'job-levels':
      filterSet = state.filters.experiencelevels;
      break;
  }

  if (type === 'companies') {
    const filter = JSON.stringify({ id, name });
    return filterSet.has(filter);
  } else {
    return filterSet.has(name);
  }
}


function applySalaryFilter() {
  state.filters.salary = parseInt(document.getElementById('min-salary').value) || 0;
  triggerJobSearch();
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function clearSearchResults() {
  const existingResults = document.querySelector('.job-search-results');
  if (existingResults) {
    existingResults.remove();
  }
}

// Add some basic styles
const style = document.createElement('style');
style.textContent = `
  .remove-item {
    margin-left: 5px;
    line-height: .5rem;
    padding: 0;
    border: none;
    background: none;
        font-size: 1.4rem;
    cursor: pointer;
    color: inherit;
  }
  .remove-item:hover {
    color: inherit;
    filter: brightness(0.8);
  }
`;
document.head.appendChild(style);

function updateState(type, id, name, logo, isRemoval = false) {
  state.hasMoreData = true;
  let filterSet;

  switch(type) {
    case 'tech-job-titles':
    case 'titles':
      filterSet = state.filters.titles;
      break;
    case 'job-locations':
      filterSet = state.filters.locations;
      break;
    case 'skills':
      filterSet = state.filters.skills;
      break;
    case 'companies':
      filterSet = state.filters.companies;
      break;
    case 'experiencelevels':
    case 'job-levels':
      filterSet = state.filters.experiencelevels;
      break;
    default:
      console.error(`Unknown filter type: ${type}`);
      return; // Exit the function if we don't recognize the type
  }

  if (!filterSet) {
    console.error(`Filter set is undefined for type: ${type}`);
    return; // Exit the function if filterSet is undefined
  }

  if (isRemoval) {
    console.log('Before removal:', filterSet);
    if (type === 'companies') {
      filterSet.forEach(item => {
        const parsedItem = JSON.parse(item);
        if (parsedItem.name === name) {
          filterSet.delete(item);
        }
      });
    } else if (type === 'tech-job-titles') {
      console.log('Removing job title:', id);
      filterSet.delete(id);
    } else {
      console.log('Removing item:', name);
      filterSet.delete(name);
    }
    console.log('After removal:', filterSet);
  } else {
    if (type === 'companies') {
      filterSet.add(JSON.stringify({ id, name, logo }));
    } else if (type === 'tech-job-titles') {
      filterSet.add(id);
    } else {
      filterSet.add(name);
    }
  }

  saveStateToLocalStorage(); // Save state after updating filters
  triggerJobSearch();
}

