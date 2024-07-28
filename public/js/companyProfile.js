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

    const jobListContainer = document.querySelector('.job-list');
    jobListContainer.innerHTML = ''; // Clear existing job postings

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

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
}

function renderJobPostings(jobPostings) {
  const jobListContainer = document.querySelector(".job-list");

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
        `<span class="job-flair"><p>${tag}</p></span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
        <div class="job-preview">
          <div class="job-info">
            <h3 class="job-title">
            <a href="/jobs/${job.id}">
            ${job.title}
            </a>
            
             <span style="margin-left: auto; float: right;">${
               job.experienceLevel[0].toUpperCase() + job.experienceLevel.slice(1)
             }</span></h3>
            <h5 class="job-subtitle secondary-text">
              <span style="margin-left: auto; float:right;">USD $${Math.floor(
                (job.salary + job.salary_max) / 2 / 1000
              )}k</span>
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
                  ? `<span class="see-more">+${remainingTags} more</span>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    jobListContainer.appendChild(jobElement);
  });

  // Update job count
  const jobCountElement = document.querySelector('h3');
  if (jobCountElement) {
    const totalJobs = jobListContainer.children.length;
    jobCountElement.textContent = `${totalJobs} Open Jobs`;
  }
}

/*
router.get('/company/:name/comments', async (req, res) => {
  try {
    const companyName = req.params.name;
    const company = await jobQueries.getCompanyByName(companyName);
    const comments = await jobQueries.getCompanyComments(company.id);
    res.json(comments);
  } catch (err) {
    console.error('Error fetching company comments:', err);
    res.status(500).send('Error fetching company comments');
  }
});
*/

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

function renderComments(comments) {
  const commentsContainer = document.querySelector('.comments-container');
  const commentsHeader = document.querySelector('.company-comments-header-title');
  const commentCount = document.querySelector('.comments-count');
  commentsContainer.innerHTML = '';
  commentCount.style.display = 'flex';
  commentCount.textContent = `${comments.length}`;

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