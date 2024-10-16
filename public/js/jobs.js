// State management
const state = {
  jobPostings: [],
  currentPage: 1,
  isLoading: false,
  renderedJobIds: new Set(),
  filters: {
    experiencelevels: new Set(),
    majors: new Set(),
    locations: new Set(),
    titles: new Set(),
    salary: 0,
    skills: new Set(),
    companies: new Set(),
  },
  hasMoreData: true,
  allTags: [],
  companyNames : [],
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
        state.filters.skills.add(skill.trim());
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
  const loadMoreBtn = document.querySelector('.load-more-btn');

  const options = {
    root: null,
    rootMargin: '500px', 
    threshold: 0.1, 
  };

  loadMoreBtn.style.display = 'flex';

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.isLoading && state.hasMoreData) {
      fetchJobPostings();
    }
  }, options);

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
    document.getElementById('recent-jobs-count').innerHTML = `<p class="primary-text tiny-text">${jobCount.totalCount} jobs</p><p class="micro-text green">+${jobCount.todayCount} today</p>`;
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

function updateStateFromServerFilters() {
  const serverFilters = JSON.parse(document.getElementById('server-filters').textContent);
  if (serverFilters) {
    if (serverFilters.skills) state.filters.skills = new Set(serverFilters.skills);
    if (serverFilters.locations) state.filters.locations = new Set(serverFilters.locations);
    if (serverFilters.titles) state.filters.titles = new Set(serverFilters.titles);
    if (serverFilters.companies) state.filters.companies = new Set(serverFilters.companies);
    if (serverFilters.experienceLevels) state.filters.experiencelevels = new Set(serverFilters.experienceLevels);
    if (serverFilters.majors) state.filters.majors = new Set(serverFilters.majors);
    if (serverFilters.salary) state.filters.salary = serverFilters.salary;
    
    // Update UI to reflect these filters
    triggerJobSearch();
    setupInfiniteScroll();
    restoreUIState();
  }
}

async function fetchCompanyNames() {
  try {
    const response = await fetch('/api/company-names');
    const companies = await response.json();
    return companies;
  } catch (error) {
    console.error('Error fetching company names:', error);
  }
}

async function initialize() {
  try {
    const serverFilters = JSON.parse(document.getElementById('server-filters').textContent);
    if (serverFilters) {  
      await updateStateFromServerFilters(serverFilters);
    }
    
    await loadStateFromLocalStorage();
    
    if (state.jobPostings.length === 0) {
      await fetchJobPostings();
    }

    if (state.companyNames.length === 0) {
      state.companyNames = await fetchCompanyNames();
      console.log(state.companyNames);
    }
    
    updateJobCount();
    setupInfiniteScroll();
  } catch (error) {
    console.error('Error initializing state:', error);
    await fetchJobPostings();
    updateJobCount();
  }
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


/*
[{"id":1,"name":"Waymo","location":"Mountain View, California","description":"Waymo is an autonomous driving technology company that develops self-driving cars and associated software. It originated from Google's self-driving car project and focuses on making transportation safer and more accessible through automation.","logo":null,"logo_url":null,"new_id":"DCE0D462-4078-47ED-9432-D5DF39098F67","industry":"Automotive, Technology, Transportation","founded":"2016-01-01T00:00:00.000Z","size":"1000-
*/ 

/*
              <a class="w-100">
                <button class="quick-option-btn no-bg no-border w-100 mini-text" data-type="companies" data-id="<%= company %>" data-name="<%= company %>" onclick="toggleSelectedFilter(event)"><%= company %></button>
              </a>
              */
function clearAllFilters() {
  state.filters = {
    experiencelevels: new Set(),
    majors: new Set(),
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
  document.querySelector('.jobs-selected-filters').style.display = 'none';
  document.querySelector('.jobs-selected-filters').innerHTML = '';
              
  // Update filter sentence display
  createActiveFilterElement(state.filters);
              
  saveStateToLocalStorage();
  fetchJobPostings();
}
              

function triggerJobSearch() {
  state.currentPage = 1;
  state.jobPostings = [];
  state.renderedJobIds.clear();
  elements.jobList.innerHTML = '';

  saveStateToLocalStorage(); // Save the cleared state
  fetchJobPostings();
}

function resetState() {
  state.filters = {
    experiencelevels: new Set(),
    majors: new Set(),
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
  document.querySelectorAll('.quick-option-btn').forEach((button) => {
    button.classList.remove('clickable');
  });
  document.querySelector('.jobs-selected-filters').style.display = 'none';
  document.querySelector('.jobs-selected-filters').innerHTML = '';
  document.querySelectorAll('.dropdown-button').forEach((button) => {
    if (button.getAttribute('aria-label') === 'Reset Filters') return;
    button.innerHTML = button.getAttribute('aria-label') + '<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>';
    button.classList.remove('active');
  });

  // Update filter sentence display
  createActiveFilterElement(state.filters);

  saveStateToLocalStorage();
  fetchJobPostings();
}


function flushState() {
  state.filters = {
    experiencelevels: new Set(),
    majors: new Set(),
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
  document.querySelector('.jobs-selected-filters').style.display = 'none';
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
    majors: JSON.stringify(Array.from(state.filters.majors)),
    salary: state.filters.salary || '0',
    skills: JSON.stringify(Array.from(state.filters.skills)),
    companies: JSON.stringify(Array.from(state.filters.companies)),
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
      setupInfiniteScroll();
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
      let tags = [];

      const postedDate = new Date(job.postedDate.replace(' ', 'T'));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        tags.push({text: 'New', class: 'new'});
      }

      if (job.location) {
        tags.push({text: formatLocation(job.location), class: 'location'});
      }
      if (job.salary) {
        tags.push({text: `$${job.salary}`, class: 'salary'});
      } else {
        // try to extract salary from description
        const salaryMatch = job.description.match(/\$(\d+(?:,?\d*)?(?:k|K)?)/);
        if (salaryMatch) {
          tags.push({text: `$${salaryMatch[1]}`, class: 'salary'});
        }
      }
      if (job.experienceLevel) {
        tags.push({text: job.experienceLevel, class: 'experienceLevel'});
      }
      tags.push({text: `${job.applicants} applicants`, class: 'applicants'});

      const jobElement = createCard(job.company_name, formatRelativeDate(job.postedDate), job.title, job.description, true, `/jobs/${job.id}`, job.company_logo, tags);
      fragment.appendChild(jobElement);
      state.renderedJobIds.add(job.id);
    }
  });
  elements.jobList.appendChild(fragment);

  if (state.jobPostings.length !== 0 && elements.jobList.children.length !== 0) {
    const existingNoJobsMessage = elements.jobList.querySelector('.no-jobs-message');
    if (existingNoJobsMessage) {
      existingNoJobsMessage.remove();
    }
  }

  setupInfiniteScroll();
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
      majors: Array.from(state.filters.majors),
      salary: state.filters.salary,
      skills: Array.from(state.filters.skills),
      companies: Array.from(state.filters.companies),
    },
    hasMoreData: state.hasMoreData,
    lastUpdated: Date.now(), // Add timestamp
  };
  localStorage.setItem('jobSearchState', JSON.stringify(stateToSave));
}


function loadStateFromLocalStorage() {
  const savedState = localStorage.getItem('jobSearchState');
  if (savedState) {
    const parsedState = JSON.parse(savedState);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    if (parsedState.lastUpdated && (now - parsedState.lastUpdated < tenMinutes)) {
      // Load state if it's less than 10 minutes old
      state.jobPostings = parsedState.jobPostings;
      state.currentPage = parsedState.currentPage;
      state.filters = {
        experiencelevels: new Set(parsedState.filters.experiencelevels),
        locations: new Set(parsedState.filters.locations),
        titles: new Set(parsedState.filters.titles),
        majors: new Set(parsedState.filters.majors),
        salary: parsedState.filters.salary,
        skills: new Set(parsedState.filters.skills),
        companies: new Set(parsedState.filters.companies),
      };
      state.hasMoreData = true;

      const sentence = createActiveFilterElement(state.filters);
      const activeFiltersSentenceElement = document.getElementById('active-filters-sentence');
      if (activeFiltersSentenceElement) {
        activeFiltersSentenceElement.textContent = sentence;
      }

      // Restore the UI state
      restoreUIState();
      setupInfiniteScroll();
    } else {
      // Discard old state and fetch new job postings
      localStorage.removeItem('jobSearchState');
      fetchJobPostings();
    }
  } else {
    // No saved state, fetch job postings
    fetchJobPostings();
  }
}


function createActiveFilterElement(filters) {
  const filterCategories = [
    { key: 'experiencelevels', label: 'Experience Level' },
    { key: 'majors', label: 'Majors' },
    { key: 'titles', label: 'Job Titles' },
    { key: 'companies', label: 'Companies' },
    { key: 'locations', label: 'Locations' },
    { key: 'skills', label: 'Skills' }
  ];

  let sentence = "Showing jobs";
  const activeFilters = [];

  filterCategories.forEach(category => {
    if (filters[category.key] && filters[category.key].size > 0) {
      const values = Array.from(filters[category.key]).join(', ');
      activeFilters.push(`with ${category.label.toLowerCase()} ${values}`);
    }
  });

  if (filters.salary && filters.salary > 0) {
    activeFilters.push(`with salary above ${filters.salary}`);
  }

  if (activeFilters.length > 0) {
    sentence += " " + activeFilters.join(", ");
  }

  const activeFiltersSentenceElement = document.getElementById('active-filters-sentence');
  if (activeFiltersSentenceElement) {
    activeFiltersSentenceElement.textContent = sentence;
    activeFiltersSentenceElement.style.display = activeFilters.length > 0 ? 'block' : 'none';
  }

  return sentence;
}


function restoreUIState() {
  // Clear existing job listings
  elements.jobList.innerHTML = '';

  // Render saved job postings
  renderJobPostings(state.jobPostings);

  // Restore selected filters
  const selectedFiltersContainer = document.querySelector('.jobs-selected-filters');
  selectedFiltersContainer.innerHTML = ''; 
  selectedFiltersContainer.style.display = 'none';

  for (let [type, filterSet] of Object.entries(state.filters)) {
    if (type === 'skills') continue;
    if (type === 'titles') type = 'tech-job-titles';
    if (type === 'locations') type = 'job-locations';
    if (type === 'majors') type = 'majors';
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
          dropdown.innerHTML = filter + '<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>';
        } else if (type == 'job-locations') {
          const button = document.querySelector(`button[data-type="job-locations"][data-name="${filter}"]`);
          button.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
          const dropdown = document.querySelector('.location-dropdown');
          dropdown.classList.add('active');
          dropdown.innerHTML = filter + '<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>';
        } else if (type == 'companies') {
          const button = document.querySelector(`button[data-type="companies"][data-id="${id}"]`);
          button.className = 'quick-option-btn clickable no-bg no-border w-100 mini-text';
        }
      });
    }
  }

  // Restore salary filter
  if (state.filters.salary) {
    const salaryDropdown = document.querySelector('.salary-dropdown');
    salaryDropdown.innerHTML = `Salary: Above ${state.filters.salary}`;
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

function createCard(name, timestamp, title, description, clickable=false, link=null, image=null, tags=null) {
  console.log(tags);
  const card = document.createElement('div');

  let tagsHtml = '';
  if (tags) {
    tagsHtml = tags.map(tag => `
      <div class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ${tag.class}">
        ${tag.text}
      </div>
    `).join('');
  }

  const cardContent = `
<div class="flex flex-col items-start gap-2 rounded-lg border p-3 text-left mb-4 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ''}>
  <div class="flex w-full flex-col gap-1">
    <div class="flex items-center">
      <div class="flex items-center gap-2 wrap">

      ${image ? `
              <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
    <img class="aspect-square h-full w-full" src="${image}" />
      </span>
      ` : ''
}
        <div class="font-semibold">${name}</div>
      </div>
      <div class="ml-auto text-xs text-foreground flex flex-row gap-06 v-center">${timestamp}
      </div>
    </div>
    <div class="text-base font-medium">${title}</div>
  </div>
  <div class="line-clamp-2 text-sm text-muted-foreground w-full">
    ${description}
  </div>
  <div class="flex items-center gap-2 wrap">
    ${tagsHtml}
  </div>
</div>
    `;

  card.innerHTML = cardContent;
  return card;
}

function createJobElement(job) {
  const jobElement = document.createElement('div');
  jobElement.classList.add('job');
  jobElement.classList.add('px-2');
  jobElement.classList.add('py-4');
  jobElement.classList.add('adaptive-border-bottom');



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
    <div class="flex flex-row w-100 space-between v-center gap-03 margin-1-bottom">
    <div class="flex flex-row gap-06">
      ${
  job.company_logo
    ? `<img class="thumbnail thumbnail-regular thumbnail-tiny" src="${job.company_logo}" alt="${job.company_name}" onerror="this.onerror=null;this.src='/img/glyph.png';" />`
    : ''
}
      <div class="flex flex-col margin-06-bottom">
              <p class="company-name bold secondary-text sub-text">${job.company_name}</p>
        <a href="/jobs/${job.id}"><h3 class="job-title main-text">${job.title}</h3></a>
      </div>
      </div>
    </div>
    ${tagsHTML ? `<div class="job-tags margin-06-bottom">${tagsHTML}</div>` : ''}
    <div class="job-details mini-text">
      <span class="text-tag bold flex flex-row v-center">
        ${formatLocation(job.location).trim().substring(0, 25)}
      </span>
          ${job.salary || job.salary_max ? `
        <span class="text-tag bold flex flex-row v-center salary">
          <svg class="icon" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          ~${formatSalary(job.salary)}/yr
        </span>
      ` : ''}
      <span class="text-tag flex flex-row v-center applicants">
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        ${job.applicants ? `${job.applicants} applicants` : '0'}
      </span>
      <span class="text-tag flex flex-row v-center post-date">
        <svg class="icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
        <time>${formatRelativeDate(job.postedDate)}</time>
      </span>
      ${job.experienceLevel ? `
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
      ` : ''}
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

// Clear the search results and reset the state then trigger search
function clearSearchResults() {
  state.jobPostings = [];
  state.currentPage = 1;
  state.hasMoreData = true;
  state.renderedJobIds.clear();
  elements.jobList.innerHTML = '';
  clearAllFilters();
  saveStateToLocalStorage();
  fetchJobPostings();
}

// Modify the search functionality to let users filter by job titles or company names.
function handleSearchInput() {
  const searchTerm = state.jobSearchInput.value.trim().toLowerCase();

  if (searchTerm.length < 2) {
    clearSearchResults();
    return;
  }

  // Clear existing filters
  state.filters.titles.clear();
  state.filters.companies.clear();

  // Filter companies based on the search term
  const matchingCompanies = state.companyNames.filter(company =>
    company.name.toLowerCase().includes(searchTerm)
  );

  if (matchingCompanies.length > 0) {
    // Determine the best match among the matching companies
    const bestMatchCompany = getBestMatch(searchTerm, matchingCompanies);

    if (bestMatchCompany) {
      // Add only the ID of the best matching company to the filters
      state.filters.companies.add(bestMatchCompany.id);
    }
  } else {
    // If no companies match, treat the search term as a job title
    state.filters.titles.add(searchTerm);
  }

  // Trigger the job search with updated filters
  triggerJobSearch();
}

/**
 * Helper function to determine the best matching company.
 * This example uses the longest matching name as the best match.
 * You can customize this logic based on your specific criteria.
 *
 * @param {string} searchTerm - The search term entered by the user.
 * @param {Array} companies - Array of matching company objects.
 * @returns {Object|null} - The best matching company object or null if none found.
 */
function getBestMatch(searchTerm, companies) {
  // Example criteria: longest name that includes the search term
  return companies.reduce((best, current) => {
    const bestMatchLength = best.name.toLowerCase().split(searchTerm).join('').length;
    const currentMatchLength = current.name.toLowerCase().split(searchTerm).join('').length;
    return currentMatchLength < bestMatchLength ? current : best;
  }, companies[0]) || null;
}


// Attach event listener to the search input element
state.jobSearchInput.addEventListener('input', debounce(handleSearchInput, DEBOUNCE_DELAY));

function handleResultClick(event) {
  console.log('handleResultClick');
  const result = event.currentTarget;
  console.log(result);
  const type = result.dataset.type;
  const id = result.dataset.id;
  const name = result.dataset.name;
  const logo = result.dataset.logo;
  console.log(type, id, name, logo);

  if (type === 'job-locations' || type === 'tech-job-titles') {
    updateState(type, name, name, logo);
  } else if (type === 'companies') {
    updateState(type, id, name, logo);
  } else if (type === 'job-salary') {
    const salaryValue = parseInt(name.replace(/\D/g, ''));
    updateState(type, salaryValue, name, logo);
  } else {
    updateState(type, id, name, logo);
  }
  
  state.jobSearchInput.value = '';
  
  // Hide skill results if company, title, location, or salary is selected
  if (type === 'companies' || type === 'tech-job-titles' || type === 'job-locations' || type === 'skills' || type === 'job-salary') {
    const skillResults = document.querySelectorAll('.search-result-item[data-type="skills"]');
    skillResults.forEach(item => item.style.display = 'none');
  }
}

function addToSelectedFilters(type, id, name, logo) {
  console.log(id);
  const selectedFiltersContainer = document.querySelector('.jobs-selected-filters');
  selectedFiltersContainer.style.display = 'block';
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
    'job-salary': 'salary-dropdown',
  };
  const dropdownDefaultTextMap = {
    'job-levels': 'Experience Level',
    'job-locations': 'Location',
    'tech-job-titles': 'Job Title',
    'job-salary': 'Salary',
  };

  const dropdownClass = dropdownClassMap[type];
  const dropdownDefaultText = dropdownDefaultTextMap[type];

  if (dropdownClass) {
    const dropdown = document.querySelector(`.${dropdownClass}`);
    if (dropdown) {
      // Reset the dropdown text to default or remove the specific selection
      dropdown.innerHTML = `${dropdownDefaultText}<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>`;
      
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
    'job-salary': 'salary-dropdown',
    'majors': 'major-dropdown',
  };
  const dropdownDefaultTextMap = {
    'job-levels': 'Experience Level',
    'job-locations': 'Location',
    'tech-job-titles': 'Job Title',
    'majors': 'Major',
    'job-salary': 'Salary',
  };

  const dropdownClass = dropdownClassMap[type];
  const dropdownDefaultText = dropdownDefaultTextMap[type];

  const dropdown = document.querySelector(`.${dropdownClass}`);

  if (isAlreadySelected) {
    clearSelectedFilters(type); // Clear previously selected filters
    event.target.className = 'quick-option-btn no-bg no-border w-100 mini-text';
    dropdown.innerHTML = `${dropdownDefaultText}<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>`;
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
    event.target.className = 'quick-option-btn selected no-bg no-border w-100 mini-text';
    // Set the dropdown to the selected value
    dropdown.innerHTML = `${name}<span class="arrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" aria-hidden="true"><path d="M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg></span>`;
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
  case 'companies':
    return filterSet.delete(id);
  case 'job-levels':
    filterSet = state.filters.experiencelevels;
    break;
  case 'majors':
    filterSet = state.filters.majors;
    break;
  case 'job-salary':
    state.filters.salary = 0;
    return true;
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
  case 'companies':
    return state.filters.companies.has(id);
  case 'job-levels':
    filterSet = state.filters.experiencelevels;
    break;
  case 'majors':
    filterSet = state.filters.majors;
    break;
  case 'job-salary':
    return state.filters.salary === parseInt(name.replace(/\D/g, ''));
  }

  if (type === 'companies') {
    const filter = JSON.stringify({ id, name });
    return filterSet.has(filter);
  } else {
    return filterSet.has(name);
  }
}


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
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
  console.log('updateState');
  console.log(type, id, name, logo, isRemoval);
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
  case 'companies':
    filterSet = state.filters.companies;
    break;
  case 'experiencelevels':
  case 'job-levels':
    filterSet = state.filters.experiencelevels;
    break;
  case 'majors':
    filterSet = state.filters.majors;
    break;
  case 'job-salary':
    state.filters.salary = parseInt(name.replace(/\D/g, ''));
    break;
  default:
    console.error(`Unknown filter type: ${type}`);
    return; // Exit the function if we don't recognize the type
  }

  if (!filterSet) {
    console.error(`Filter set is undefined for type: ${type}`);
    return; // Exit the function if filterSet is undefined
  } else if (type === 'job-salary') {
    return;
  }

  if (isRemoval) {
    console.log(type, id, name);
    console.log('Before removal:', filterSet);
    if (type === 'companies') {
      console.log(item);
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
      console.log('Adding company:', id);
      filterSet.add(id);
    } else if (type === 'tech-job-titles') {
      console.log('Adding job title:', id);
      filterSet.add(id);
    } else {
      filterSet.add(name);
    }
  }

  const sentence = createActiveFilterElement(state.filters);
  const activeFiltersSentenceElement = document.getElementById('active-filters-sentence');
  if (activeFiltersSentenceElement) {
    activeFiltersSentenceElement.textContent = sentence;
  }
  
  saveStateToLocalStorage(); 
  triggerJobSearch();
}


