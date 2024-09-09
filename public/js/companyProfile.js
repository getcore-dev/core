// Declare these variables in the global scope
let currentPage = 1;
const pageSize = 15;
let isLoading = false;
let hasMoreJobs = true;

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    const companyProfileButtons = document.querySelectorAll('.company-navbar-button');
    const companyProfileSections = document.querySelectorAll('.company-profile-section');
    
    companyProfileButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-id');
            
        companyProfileSections.forEach(section => {
          if (section.className.includes(targetId)) {
            section.style.display = 'block';
          } else {
            section.style.display = 'none';
          }
        });
            
        // Update active button state (optional)
        companyProfileButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        button.classList.add('active');
      });
    });
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

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
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

document.addEventListener('DOMContentLoaded', function() {
  const stockSymbols = document.querySelectorAll('.company-stock_symbol');
  
  stockSymbols.forEach(symbolElement => {
    const symbol = symbolElement.dataset.symbol;
    if (symbol) {
      fetchStockMovement(symbol, symbolElement);
    }
  });
});

async function fetchStockMovement(symbol, element) {
  const API_KEY = 'YOUR_ALPHA_VANTAGE_API_KEY_HERE'; // Replace with your actual API key
  const API_URL = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    if (data['Global Quote']) {
      const changePercent = parseFloat(data['Global Quote']['10. change percent'].replace('%', ''));
      updateStockMovement(element, changePercent);
    }
  } catch (error) {
    console.error('Error fetching stock data:', error);
  }
}

function updateStockMovement(element, changePercent) {
  const movementElement = element.querySelector('.stock-movement');
  if (movementElement) {
    const formattedChange = changePercent.toFixed(2);
    const sign = changePercent >= 0 ? '+' : '';
    movementElement.textContent = `${sign}${formattedChange}%`;
    movementElement.classList.add(changePercent >= 0 ? 'positive' : 'negative');
  }
}

function renderJobPostings(jobPostings) {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = ''; // Clear existing job postings

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
        `<span class="sub-text text-tag">${tag}</span>`
      )
      .join(", ");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
    <a href="/jobs/${job.id}">
    <div class="job-preview-image">
              ${
              job.company_logo
                ? `<img class="thumbnail thumbnail-regular thumbnail-small" src="${job.company_logo ? job.company_logo : '/img/glyph.png'}" alt="" onerror="this.onerror=null;this.src='/img/glyph.png';" />`
                              : ''
            }
    </div>
      <div class="job-preview">
        <div class="job-info">
          <div class="company-info">
            <div class="job-posting-company-info">
              <a class="company-name third-text mini-text bold" href="/jobs/company/${job.company_name}">${job.company_name}</a>
            </div>
          </div>
          <h3 class="job-title margin-1-bottom main-text">${job.title}</h3>
          <p class="sub-text secondary-text margin-03-bottom">${tagsHTML}</p>
          
          <div class="job-title-location third-text mini-text">
                    <div class="applicants  mini-text">
              ${job.applicants ? `${job.applicants} applicants` : '0 applicants'}
            </div>
            <div class="job-post-date ${formatDateColor(job.postedDate)} mini-text">
              <time>${formatRelativeDate(job.postedDate)}</time>
            </div>
            <span style="font-size:.7rem;">•</span>
            <div class="experience-level mini-text">${
              job.experienceLevel === 'Mid Level'
                ? 'L3/L4'
                : job.experienceLevel === 'Entry Level'
                  ? 'L1/L2'
                  : job.experienceLevel === 'Senior'
                    ? 'L5/L6'
                    : job.experienceLevel
            }</div>
            ${job.salary || job.salary_max ? `
              <span style="font-size:.7rem;">•</span><div class="job-salary mini-text">
                ${formatSalary(job.salary)} - ${formatSalary(job.salary_max)}/yr
              </div>
            ` : ``}
            <span style="font-size:.7rem;">•</span>
            <div class="location mini-text">
              <span class="material-symbols-outlined">location_on</span>
              ${formatLocation(job.location).trim()}
            </div>
          </div>
        </div>
      </div>
      </a>
    `;
    jobListContainer.appendChild(jobElement);
  });

}

function fetchCompanyComments(companyName) {
  return fetch(`/api/company/${encodeURIComponent(companyName)}/comments`)
    .then((response) => response.json())
    .catch((error) => console.error('Error fetching company comments:', error));
}

function formatDate(date) {
  let postDate = new Date(date);
  let today = new Date();
  let diff = today - postDate;
  let formattedDate = '';

  // Convert time difference to different units
  let minutes = Math.floor(diff / 60000); // 60,000 milliseconds in a minute
  let hours = Math.floor(diff / 3600000); // 3,600,000 milliseconds in an hour
  let days = Math.floor(diff / 86400000); // 86,400,000 milliseconds in a day

  // Decide the format based on the time difference
  if (diff < 86400000) { // Less than 24 hours
    if (hours < 1) {
      formattedDate = minutes + 'm';
    } else {
      formattedDate = hours + 'h';
    }
  } else {
    // Format date with month spelled out, e.g., "July 19, 2024"
    let options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    formattedDate = postDate.toLocaleDateString('en-US', options);
  }

  return formattedDate;
}

document.addEventListener('DOMContentLoaded', function() {
  const description = document.getElementById('companyDescription');
  const toggleButton = document.getElementById('toggleButton');

  function checkOverflow() {
    const isOverflowing = description.scrollHeight > description.clientHeight;
    toggleButton.style.display = isOverflowing ? 'block' : 'none';
  }

  toggleButton.addEventListener('click', function() {
    description.classList.toggle('expanded');
    toggleButton.textContent = description.classList.contains('expanded') ? 'Show less' : 'Show more';
  });

  // Check overflow on load and resize
  window.addEventListener('resize', checkOverflow);
  checkOverflow();
});

function renderComments(comments) {
  const commentsContainer = document.querySelector('.comments-container');
  const commentsHeader = document.querySelector('.company-comments-header-title');
  const commentCount = document.querySelector('.comments-count');
  commentsContainer.innerHTML = '';
  commentCount.style.display = 'flex';
  commentCount.textContent = `${comments.length}`;
  commentsHeader.textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;

  comments.forEach((comment) => {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment');
    commentElement.innerHTML = `
    <div class="comment-header">
      <div class="comment-author">
      <img src="${comment.user_avatar}" alt="User Avatar" class="avatar thumbnail thumbnail-tiny thumbnail-regular">
        <a class="link" href="/user/${comment.user_name}">${comment.user_name}</a>
        <p class="comment-date">${formatDate(comment.created_at)}</p>
      <button class="delete-comment cancel-button-normal no-bg no-border" data-id="${comment.id}" onclick="deleteComment(event)">Delete</button>
      </div>
      <div class="comment-content">
        <p>${comment.content}</p>
      </div>
    `;
    commentsContainer.appendChild(commentElement);
  });

  if (comments.length === 0) {
    commentsContainer.textContent = 'No Comments Yet';
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    const companyNameMeta = document.querySelector('meta[name="company-name"]');
    if (companyNameMeta) {
      const companyName = companyNameMeta.content;
      fetchCompanyComments(companyName).then((comments) => {
        renderComments(comments);
      });
    }
  });
}

/*
  router.delete('/company/:name/comments/:commentId', checkAuthenticated, async (req, res) => {
    try {
      const commentId = req.params.commentId;
      await jobQueries.deleteCompanyComment(commentId);
      res.status(200).send('Comment deleted');
    } catch (err) {
      console.error('Error deleting company comment:', err);
      res.status(500).send('Error deleting company comment');
    }
  });
  */

function deleteComment(event) {
  const commentId = event.target.getAttribute('data-id');
  const companyInfo = document.querySelector('.company-info-container');
  const companyName = companyInfo.getAttribute('data-company');
  if (!commentId) {
    return;
  }

  fetch(`/jobs/company/${encodeURIComponent(companyName)}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then((response) => {
    if (response.ok) {
      event.target.parentElement.parentElement.remove();
    }
  }).catch((error) => console.error('Error deleting comment:', error));
}