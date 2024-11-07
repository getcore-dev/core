const jobSuggestions = document.getElementById("topJobSuggestions");
const recentJobs = document.getElementById("recentViewedJobs");
const searchInput = document.getElementById("job-search-input");

const searchContainer = document.querySelector('.jobs-search-container');
const searchIcon = document.getElementById('jobs-search-icon');

// Add a loading spinner right after the search icon
const loadingSpinner = document.createElement('svg');
loadingSpinner.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-2 absolute left-2 top-2.5 h-4 w-4 text-foreground animate-spin hidden">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
`;
searchIcon.insertAdjacentElement('afterend', loadingSpinner.firstElementChild);

const searchResultsContainer = document.createElement("div");
searchResultsContainer.className = "flex flex-col w-full";
searchResultsContainer.innerHTML = `
  <h3 class="text-md font-semibold mb-2 p-3" style="display: none;" id="search-results-header">Search Results</h3>
  <div class="flex flex-col gap-2 pl-3 pr-4" id="searchResults"></div>
`;

document.querySelector('.jobs-search-container').insertAdjacentElement('afterend', searchResultsContainer);

async function searchJobs(query) {
  // Get both icons
  const searchIcon = document.getElementById('jobs-search-icon');
  const loadingIcon = document.querySelector('.lucide-loader-2');
  
  try {
    // Show loading state
    searchIcon.classList.add('hidden');
    loadingIcon.classList.remove('hidden');
    
    // Construct the URL with query parameters
    const url = new URL('/api/jobs', window.location.origin);
    const params = {
      page: 1,
      pageSize: 20,
      titles: JSON.stringify([query]),
    };
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url);
    if (!response.ok) throw new Error('Search request failed');
    
    const data = await response.json();
    const searchResults = document.getElementById("searchResults");
    const searchHeader = document.getElementById("search-results-header");
    
    searchResults.innerHTML = "";
    
    if (data.jobPostings.length === 0) {
      searchHeader.style.display = "block";
      searchResults.innerHTML = "<p class='p-3'>No jobs found matching your search.</p>";
      return;
    }

    searchHeader.style.display = "block";
    data.jobPostings.forEach((job) => {
      const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const tags = [];
      if (diffDays <= 2) {
        tags.push({ text: "New", class: "new" });
      }

      if (job.location) {
        tags.push({
          text: formatLocation(job.location),
          class: "location",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>',
        });
      }
      if (job.salary) {
        tags.push({
          text: `$${job.salary}`,
          class: "salary",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
        });
      }
      if (job.experienceLevel) {
        tags.push({
          text: job.experienceLevel,
          class: "experienceLevel",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
        });
      }
      tags.push({
        text: `${job.applicants || 0} applicants`,
        class: "applicants",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      });

      searchResults.appendChild(
        createCardLink(
          job.company_name,
          formatRelativeDate(job.postedDate),
          job.title,
          job.description,
          true,
          "/jobs/" + job.id,
          job.company_logo,
          tags,
        )
      );
    });
  } catch (error) {
    console.error("Error searching jobs:", error);
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "<p class='p-3'>An error occurred while searching for jobs.</p>";
  } finally {
    // Reset icons state regardless of success or failure
    searchIcon.classList.remove('hidden');
    loadingIcon.classList.add('hidden');
  }
}

searchInput.addEventListener(
  "input",
  debounce(function (event) {
    const query = event.target.value.trim();
    const searchHeader = document.getElementById("search-results-header");
    const searchResults = document.getElementById("searchResults");
    
    if (query.length > 2) {
      searchJobs(query);
    } else {
      searchHeader.style.display = "none";
      searchResults.innerHTML = "";
    }
  }, 300)
);

searchInput.addEventListener("input", function (event) {
  const query = event.target.value.trim();
  const clearButton = document.getElementById('clear-input-button');
  clearButton.style.display = query.length === 0 ? 'none' : 'block';
});

// Add CSS for horizontal scrolling
const style = document.createElement('style');
style.textContent = `
  .horizontal-scroll {
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  
  .horizontal-scroll::-webkit-scrollbar {
    height: 8px;
  }
  
  .horizontal-scroll::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  .horizontal-scroll::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  
  .horizontal-scroll::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;
document.head.appendChild(style);

let currentPage = 1;
let isLoading = false;
const jobsPerPage = 20;

function createCardSquare(
  name,
  timestamp,
  title,
  description,
  clickable = false,
  link = null,
  image = null,
  tags = null,
) {
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
      ${tag.icon ? tag.icon : ""}
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
  <div class="lex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent " ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
    <div class="flex w-full flex-col gap-1">
      <div class="flex flex-row gap-2">
        <div class="flex items-center gap-2">

        ${
          image
            ? `
                <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
        <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
        </span>
        `
            : ""
        }
          <div class="font-semibold">${name}</div>
        </div>
        <div class="ml-auto text-xs text-foreground">${timestamp}</div>
      </div>
            <div class="text-base font-medium text-balance max-w-lg leading-relaxed">
            <a href="${link}" class="hover:text-accent">${title}</a>
    </div>
        </div>
    <div class="flex items-center gap-2 wrap">
      ${tagsHtml}
    </div>
  </div>
      `;

  card.innerHTML = cardContent;
  return card;
}

function createCardLink(
  name,
  timestamp,
  title,
  description,
  clickable = false,
  link = null,
  image = null,
  tags = null,
) {
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
      ${tag.icon ? tag.icon : ""}
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
  <div class="flex flex-col items-start gap-2 rounded-lg text-left text-sm transition-all hover:bg-accent " ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
    <div class="flex w-full flex-col gap-0">
      <div class="flex flex-row gap-2">
        <div class="flex items-center gap-0">

        ${
          image
            ? `
                <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
        <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
        </span>
        `
            : "<span class='relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5'><img class='aspect-square h-full w-full' src='/img/glyph.png' /></span>"
        }
          <div class="text-sm">${name}</div>
        </div>
        <div class="ml-auto text-xs text-foreground">${timestamp}</div>
      </div>
      <div class="text-md font-semibold text-balance max-w-lg leading-relaxed">${title}</div>
    </div>
  </div>
      `;

  card.innerHTML = cardContent;
  return card;
}

function createCard(
  name,
  timestamp,
  title,
  experienceLevel,
  location,
  clickable = false,
  link = null,
  image = null,
  tags = null,
) {
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
      ${tag.icon ? tag.icon : ""}
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
<div class="flex flex-row px-1 items-start gap-2 rounded-lg text-left mb-4 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
  <span class="relative flex shrink-0 overflow-hidden rounded-md mr-2 h-10 w-10">
  ${image ? `<img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.src='/img/glyph.png';"/>` : "<img class='aspect-square h-full w-full' src='/img/glyph.png' />"}
  </span>
  <div class="flex flex-col w-full gap-1">
    <div class="flex items-center">
      <div class="flex flex-col gap-1">
        <div class="text-md font-semibold">${name}</div>
            <div class="text-base font-medium text-balance max-w-lg leading-relaxed">
            <a href="${link}" class="hover:text-accent">${title}</a>
    </div>
    ${experienceLevel ? `<div class="text-xs text-foreground flex flex-row gap-06 v-center">${experienceLevel}</div>` : ""}
      </div>
<div class="ml-auto text-xs text-foreground gap-06 v-center whitespace-nowrap">${timestamp}</div>
    </div>

    <div class="text-sm text-muted-foreground">
      ${location}
    </div>
    <div class="flex items-center gap-2 wrap">
      ${tagsHtml}
    </div>
  </div>
</div>
  `;

  card.innerHTML = cardContent;
  return card;
}

async function updateJobCount() {
  try {
    const response = await fetch("/api/jobs-count");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const jobCount = await response.json();
    document.getElementById("recent-jobs-count").textContent =
      jobCount.totalCount;
    document.getElementById("today-jobs-count").textContent =
      jobCount.todayCount;
  } catch (error) {
    console.error("Error fetching job count:", error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const clearButton = document.querySelector(".jobs-search-container button");
  const searchInput = document.getElementById("job-search-input");
  loadJobSuggestions();

  clearButton.addEventListener("click", function () {
    searchInput.value = "";
  });
});

document.addEventListener("DOMContentLoaded", () => {
  updateJobCount();
  const appliedJobsLink = document.getElementById("applied-jobs-count");
  if (appliedJobsLink) {
    fetch("/api/applied-jobs-count")
      .then((response) => response.json())
      .then((data) => {
        appliedJobsLink.textContent = `${data}`;
      })
      .catch((error) => {
        console.error("Error fetching applied jobs count:", error);
        appliedJobsLink.textContent = "Applied Jobs";
      });
  }
});

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  const diffInDays = Math.floor(diffInSeconds / 86400);
  const diffInWeeks = Math.floor(diffInDays / 7);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else if (diffInWeeks <= 4) {
    return `${diffInWeeks}w ago`;
  } else {
    const month = date.toLocaleString("default", { month: "short" });
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

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

searchInput.addEventListener(
  "input",
  debounce(function (event) {
    const query = event.target.value.trim();
    if (query.length > 2) {
      searchJobs(query);
    } else if (query.length === 0) {
      loadJobSuggestions();
    }
  }, 300),
);

const generateTags = (job, viewedJobs) => {
  const tags = [];
  
  // Calculate days since posting
  const postedDate = new Date(job.postedDate.replace(" ", "T"));
  const now = new Date();
  const diffDays = Math.floor(
    Math.abs(now - postedDate) / (1000 * 60 * 60 * 24)
  );

  // New tag
  if (diffDays <= 2 && !viewedJobs.includes(job.id)) {
    tags.push({
      text: "New",
      class: "new",
      icon: '<span class="flex h-2 w-2 rounded-full bg-blue-600"></span>'
    });
  }

  // Viewed tag
  if (viewedJobs.includes(job.id)) {
    tags.push({
      text: 'Viewed',
      class: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground',
      icon: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 fill-green-300 text-green-300"><path d="M0.877075 7.49991C0.877075 3.84222 3.84222 0.877075 7.49991 0.877075C11.1576 0.877075 14.1227 3.84222 14.1227 7.49991C14.1227 11.1576 11.1576 14.1227 7.49991 14.1227C3.84222 14.1227 0.877075 11.1576 0.877075 7.49991ZM7.49991 1.82708C4.36689 1.82708 1.82708 4.36689 1.82708 7.49991C1.82708 10.6329 4.36689 13.1727 7.49991 13.1727C10.6329 13.1727 13.1727 10.6329 13.1727 7.49991C13.1727 4.36689 10.6329 1.82708 7.49991 1.82708Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>'
    });
  }

  // Salary tag
  if (job.salary) {
    tags.push({
      text: `$${job.salary}`,
      class: "salary",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>'
    });
  }

  // Views tag
  if (job.views) {
    tags.push({
      text: `${job.views} views`,
      class: "views",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>'
    });
  }

  // Applicants tag
  tags.push({
    text: `${job.applicants} applicants`,
    class: "applicants",
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  });

  return tags;
};

function loadJobSuggestions(page = 1) {
  if (isLoading) return;
  isLoading = true;

  const loadingIndicator = document.createElement("div");
  loadingIndicator.innerHTML = `
    <div class="spinner-container">
      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    </div>
  `;
  jobSuggestions.appendChild(loadingIndicator);

  fetch(`/api/job-suggestions?page=${page}&limit=${jobsPerPage}`)
    .then((response) => response.json())
    .then((data) => {
      loadingIndicator.remove();
      data.forEach((job) => {
      let tags = [];
      const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // new tag
      if (diffDays <= 2 && !viewedJobs.includes(job.id)) {
        tags.push({ text: "New", class: "new", icon:'<span class="flex h-2 w-2 rounded-full bg-blue-600"></span>' });
      }

      // viewed tag
      if (viewedJobs.includes(job.id)) {
        tags.push({
          text: 'Viewed',
          class: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground',
          icon: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 fill-green-300 text-green-300"><path d="M0.877075 7.49991C0.877075 3.84222 3.84222 0.877075 7.49991 0.877075C11.1576 0.877075 14.1227 3.84222 14.1227 7.49991C14.1227 11.1576 11.1576 14.1227 7.49991 14.1227C3.84222 14.1227 0.877075 11.1576 0.877075 7.49991ZM7.49991 1.82708C4.36689 1.82708 1.82708 4.36689 1.82708 7.49991C1.82708 10.6329 4.36689 13.1727 7.49991 13.1727C10.6329 13.1727 13.1727 10.6329 13.1727 7.49991C13.1727 4.36689 10.6329 1.82708 7.49991 1.82708Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>'
        });
      }

      // salary tag
      if (job.salary) {
        tags.push({
          text: `$${job.salary}`,
          class: "salary",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>',
        });
      } 


      // views tag
      if (job.views) {
        tags.push({
          text: `${job.views} views`,
          class: "views",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
        });
      }

      // applicants tag
      tags.push({
        text: `${job.applicants} applicants`,
        class: "applicants",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      });
  
        jobSuggestions.appendChild(
          createCard(
            job.company_name,
            formatRelativeDate(job.postedDate),
            job.title,
            job.experienceLevel || job.cleaned_experience_level,
            formatLocation(job.location),
            true,
            `/jobs/${job.id}`,
            job.company_logo,
            tags,
          ),
        );
      });
      isLoading = false;
      currentPage++;
    })
    .catch((error) => {
      console.error("Error fetching job suggestions:", error);
      isLoading = false;
      loadingIndicator.remove();
    });
}

fetch("/api/recent-viewed-jobs")
  .then((response) => response.json())
  .then((data) => {
    recentJobs.innerHTML = "";
    data.forEach((job) => {
      const postedDate = new Date(job.postedDate.replace(" ", "T"));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      let tags = [];
      tags = generateTags(job, viewedJobs);

      recentJobs.appendChild(
        createCardLink(
          job.company_name,
          formatRelativeDate(job.postedDate),
          job.title,
          job.description,
          true,
          "/jobs/" + job.job_id,
          job.company_logo,
          tags,
        ),
      );
    });
  })
  .catch((error) => console.error("Error fetching recent jobs:", error));
