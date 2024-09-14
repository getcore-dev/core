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

    if (isLoading) {
    const loadingSpinner = document.querySelector('#loading-indicator');
    if (loadingSpinner) {
      loadingSpinner.style.display = 'block';
      const jobListContainer = document.querySelector('.job-list');
      jobListContainer.appendChild(loadingSpinner);
    }
  } else {
    const loadingSpinner = document.querySelector('#loading-indicator');
    if (loadingSpinner) {
      loadingSpinner.style.display = 'none';
    }
  }

    const response = await fetch(`/api/jobs/company/${encodeURIComponent(companyName)}?page=${currentPage}&pageSize=${pageSize}`);
    const jobs = await response.json();

    if (jobs.length === 0) {
      hasMoreJobs = false;
      isLoading = false;
      // hide loading indicator and display 'end of the list message'
      const loadingSpinner = document.querySelector('#loading-indicator');
      if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
      }
      const jobListContainer = document.querySelector('.job-list');
      const endOfListMessage = document.createElement('div');
      endOfListMessage.classList.add('end-of-list-message');
      endOfListMessage.classList.add('third-text');
      endOfListMessage.classList.add('mini-text');
      endOfListMessage.classList.add('flex');
      endOfListMessage.classList.add('h-center');
      endOfListMessage.textContent = 'No more job postings to display';
      jobListContainer.appendChild(endOfListMessage);

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

function createJobElement(job) {
  const jobElement = document.createElement('div');
  jobElement.classList.add('job');
  jobElement.onclick = () => (window.location.href = `/jobs/${job.id}`);

  const tagsArray = job.skills ?
    job.skills.split(',').map(skill => skill.trim().toLowerCase()) : [];

  const sortedTags = tagsArray.sort((a, b) => {
    return a.localeCompare(b, undefined, {
      sensitivity: 'base'
    });
  });
  const displayedTags = sortedTags.slice(0, 3);

  let tagsHTML = displayedTags
    .map((skill) => {
      return `
            <span data-name="${skill.trim()}" data-type="skills" data-id="${skill.trim()}" data-index="${sortedTags.indexOf(skill.trim())}" class="mini-text bold text-tag">${skill.trim()}</span>`;
    })
    .join('');

  const remainingTagsCount = sortedTags.length - 3;
  if (remainingTagsCount > 0) {
    tagsHTML += `
          <span class="remaining-tags mini-text" style="cursor: pointer;" onclick="toggleHiddenTags()">
            +${remainingTagsCount} more
          </span>
        `;
  }


  jobElement.innerHTML = `
  <div class="job-preview">
    <div class="job-info">
      <div class="job-header gap-03">
      <div class="flex flex-row gap-06">
        ${
  job.company_logo
    ? `<img class="thumbnail thumbnail-regular thumbnail-tiny" src="${job.company_logo}" alt="${job.company_name}" onerror="this.onerror=null;this.src='/img/glyph.png';" />`
    : ''
}
    <div class="flex flex-col">
      <a href="/jobs/${job.id}"><h3 class="job-title main-text">${job.title}</h3></a>
      <p class="company-name">${job.company_name}</p>
    </div>
    </div>
    <div class="location-badge">
      📍 ${formatLocation(job.location).trim()}
    </div>
  </div>
  <div class="job-tags">
    ${tagsHTML}
  </div>
  <div class="job-posting-details">
    <span class="job-posting-detail applicants">
      <svg class="icon" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      ${job.applicants ? `${job.applicants} applicants` : '0 applicants'}
    </span>
    <span class="job-posting-detail post-date">
      <svg class="icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
      <time>${formatRelativeDate(job.postedDate)}</time>
    </span>
    <span class="job-posting-detail experience-level">
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
    ${job.salary || job.salary_max ? `
      <span class="job-posting-detail salary">
        <svg class="icon" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
        ${formatSalary(job.salary)} - ${formatSalary(job.salary_max)}/yr
      </span>
  ` : ''}
        </div>
      </div>
    </div>
    `;
  return jobElement;
}

function renderJobPostings(jobPostings) {
  // remove the loading spinner
  const loadingSpinner = document.querySelector('#loading-indicator');
  if (loadingSpinner) {
    loadingSpinner.style.display = 'none';
  }
  const jobListContainer = document.querySelector(".job-list");

  jobPostings.forEach((job) => {
    const jobElement = createJobElement(job);
    jobListContainer.appendChild(jobElement);
  }
  );

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