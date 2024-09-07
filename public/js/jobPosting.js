function formatDateJob(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 172800) {
    return '1 d ago';
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

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ('00000' + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}65`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = '#808080'; // Light gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function getTintFromNameSecondary(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ('00000' + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = '#404040'; // Dark gray
  const blendedColor = blendColors(tintColor, baseColor, 0.5);
  return blendedColor;
}

function blendColors(color1, color2, ratio) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));

  const blendedColor = `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return blendedColor;
}

function formatSalary(salary) {
  if (salary >= 1000000) {
    return '' + (salary / 1000000).toFixed(1) + 'M';
  } else if (salary >= 1000) {
    return '' + (salary / 1000).toFixed(0) + 'k';
  } else {
    return '' + salary;
  }
}

async function getSimilarJobs(jobId) {
  fetch(`/api/jobs/${jobId}/similar`)
    .then((response) => response.json())
    .then((jobs) => {
      const similarJobsContainer = document.querySelector('.similar-jobs');
      const similarJobsCount = document.querySelector('.related-jobs-count');
      similarJobsCount.innerHTML = `${jobs.length}`;

      if (jobs.length === 0) {
        similarJobsContainer.innerHTML = '';
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4 class="secondary-text">Related Jobs</h4>
        <div class="similar-jobs-list">
          ${jobs
    .map((job) => {
      const tagsArray =
                job.skills && job.skills ? job.skills.split(', ') : [];
      const maxTags = 3;
      const displayedTags = tagsArray.slice(0, maxTags);
      const tagsHTML = displayedTags.map((tag) => `${tag}`).join(', ');

      return `
            <div class="similar-job" onclick="window.location.href='/jobs/${
  job.id
}'">
              ${
  job.company_logo
    ? `
              <img class="thumbnail thumbnail-regular thumbnail-tiny" src="${job.company_logo}" alt="${job.company_name} logo" />`
    : ''
}
    <div class="job-content">
              <div class="company-info">
              <div class="job-posting-company-info">
              <p  class="posting-company-name secondary-text">${
  job.company_name
}</p>
              </div>
            </div>
                          <h3 class="company-name sub-text bold"><a href="/jobs/${job.id}">${
  job.title
} </a> </h3>
                <div class="job-tags mini-text secondary-text margin-03-bottom">
                  ${tagsHTML}
                </div>
                <div class="job-posting-information job-subtitle mini-text third-text">
                                                <span class="job-date ${formatDateColor(job.postedDate)}"><time>${formatRelativeDate(job.postedDate)}</time></span>
                <span> • </span>

                <span style="">${
  job.experienceLevel === 'Mid Level'
    ? 'L3/L4'
    : job.experienceLevel === 'Entry Level'
      ? 'L1/L2'
      : job.experienceLevel === 'Senior'
        ? 'L5/L6'
        : job.experienceLevel
}</span>
                <span> • </span>
                <span class="job-salary" style="margin-left: auto;">${
  job.salary ? 'USD $' + job.salary.toLocaleString() : ''
} ${
  (job.salary_max != 0 && job.salary) ? '- $' + job.salary_max.toLocaleString() : ''
}</span>

        </div>
            </div>
            </div>
          `;
    })
    .join('')}
        </div>
      `;
    })
    .catch((error) => {
      console.error('Error fetching similar jobs:', error);
    });
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

async function getSimilarJobsByCompany(jobId, companyName) {
  fetch(`/api/jobs/${jobId}/similar-company`)
    .then((response) => response.json())
    .then((jobs) => {
      const similarJobsContainer = document.querySelector(
        '.similar-company-jobs'
      );
      const similarCompanyJobsCount = document.querySelector('.related-jobs-company-count');
      similarCompanyJobsCount.innerHTML = `${jobs.length}`;
      if (jobs.length === 0) {
        similarJobsContainer.innerHTML = '<div class="empty-text">No jobs found at this company.</div>';
        return;
      }
      similarJobsContainer.innerHTML = `
        <h4 class="secondary-text">More jobs at ${companyName}</h4>
        <div class="similar-jobs-list">
          ${jobs
    .map((job) => {
      const tagsArray = job.skills
        ? job.skills.split(',').map(skill => skill.trim())
        : [];
      const maxTags = 3;
      const displayedTags = tagsArray.slice(0, maxTags);
      const tagsHTML = displayedTags.map((tag) => `${tag}`).join(', ');

      return `
            <div class="similar-job" onclick="window.location.href='/jobs/${
  job.id
}'">
              ${
  job.company_logo
    ? `
              <img class="thumbnail thumbnail-regular thumbnail-tiny" src="${job.company_logo}" alt="${job.company_name} logo" />`
    : ''
}
    <div class="job-content">
              <div class="company-info">
              <div class="job-posting-company-info">
              <p  class="posting-company-name secondary-text">${
  job.company_name
}</p>
              </div>
            </div>
                          <h3 class="company-name sub-text bold"><a href="/jobs/${job.id}">${
  job.title
} </a> </h3>
                <div class="job-tags mini-text secondary-text margin-03-bottom">
                  ${tagsHTML}
                </div>
                <div class="job-posting-information job-subtitle mini-text third-text">
                                                <span class="job-date ${formatDateColor(job.postedDate)}"><time>${formatRelativeDate(job.postedDate)}</time></span>
                <span> • </span>

                <span style="">${
  job.experienceLevel === 'Mid Level'
    ? 'L3/L4'
    : job.experienceLevel === 'Entry Level'
      ? 'L1/L2'
      : job.experienceLevel === 'Senior'
        ? 'L5/L6'
        : job.experienceLevel
}</span>
                <span> • </span>
                <span class="job-salary" style="margin-left: auto;">${
  job.salary ? 'USD $' + job.salary.toLocaleString() : ''
} ${
  (job.salary_max != 0 && job.salary) ? '- $' + job.salary_max.toLocaleString() : ''
}</span>

        </div>
            </div>
            </div>
          `;
    })
    .join('')}
        </div>
      `;
    })
    .catch((error) => {
      console.error('Error fetching similar jobs:', error);
    });
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

function applyForJob(event, jobId, jobLink) {
  // Prevent the default action (which might be causing the redirect)
  event.preventDefault();
  window.open(jobLink, '_blank');
  // Make the POST request
  fetch(`/api/jobs/${jobId}/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // You can add a body here if needed
    // body: JSON.stringify({}),
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
    // showBannerNotification(data.message);
    })
    .catch(error => {
      console.error('Error:', error);
      showBannerNotification('An error occurred. Please try again.');
    }
    );
}

async function lazyLoadJobDetails(userIsAdmin, jobId, userIsLoggedIn) {
  fetch(`/api/jobs/${jobId}`)
    .then((response) => response.json())
    .then((job) => {
      const jobDetailsContainer = document.querySelector(
        '.job-details-container'
      );

      let benefitsArray, tagsArray, skillsArray;
      try {
        tagsArray = job.skills && job.skills ? job.skills.split(', ') : [];
      } catch (error) {
        console.error('Error splitting tags:', error);
        tagsArray = [];
      }
      try {
        skillsArray =
          job.skills && job.skills ? job.skills.split(', ') : [];
      } catch (error) {
        console.error('Error splitting skills:', error);
        skillsArray = [];
      }

      try {
        benefitsArray = job.benefits ? job.benefits.split(',') : [];
      } catch (error) {
        console.error('Error splitting benefits:', error);
        benefitsArray = [];
      }

      const formattedBenefits = benefitsArray
        .map((benefit) => `<li>${benefit.replace(/'/g, '')}</li>`)
        .join('');

      const maxTags = 15;
      const maxSkills = 15;
      const displayedTags = tagsArray.slice(0, maxTags);
      const displayedSkills = skillsArray.slice(0, maxSkills);

      const tagsHTML = displayedTags
        .map(
          (tag) =>
            `<a class="tag green-tag" href="/tags/${tag}">${tag}</a>`
        )
        .join('');
      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<a class="tag" href="/skills/jobs/${skill.trim()}">${skill.trim()}</a>`
        )
        .join('');

      const remainingTags = tagsArray.length - maxTags;
      const remainingSkills = skillsArray.length - maxSkills;

      const isOlderThan30Days = (job) => {
        const postedDate = new Date(job.postedDate);
        const currentDate = new Date();
        const daysDifference =
          (currentDate - postedDate) / (1000 * 60 * 60 * 24);
        return daysDifference > 30;
      };

      jobDetailsContainer.innerHTML = `
        <div class="job-listing">
        <div class="job-listing-menu adaptive-border-bottom">
                ${
  isOlderThan30Days(job)
    ? `<div class="caution-messages">This job was posted more than 30 days ago. Apply anyway <a class="link" href="${job.link}">here</a></div>`
    : ''
}

          <div class="company-info margin-03-bottom">
          ${
  job.company_logo
    ? `
            <img src="${job.company_logo ? job.company_logo : '/img/glyph.png'}" style="width: auto;" alt="${job.company_name} logo" onerror="this.onerror=null;this.src='/img/glyph.png';"class="thumbnail thumbnail-tiny thumbnail-regular" />
          `
    : ''
}
            <div class="company-details">
                          <div class="company-information">
            <a class="secondary-text bold link sub-text"href="/jobs/company/${encodeURIComponent(job.company_name)}">${job.company_name}</a>
            ${job.company_size ? `<span class="mini-text third-text">${job.company_size} employees</span>` : ''}
            </div>

            </div>
            
          </div>
                        <h3 class="company-name main margin-03-bottom">
              ${job.title}
              </h3>
          
          

            <div class="job-info-flairs margin-03-bottom">
              <p>
                <span class="material-symbols-outlined">
                engineering
                </span> ${job.experienceLevel}
              </p>
              <p> 
                <span class="material-symbols-outlined">
                location_city
                </span> ${job.location}
              </p>
              <p>
              
                ${job.salary != 0 ? ' <span class="material-symbols-outlined">attach_money</span>USD $' + formatSalary(job.salary) : ''} ${
  job.salary_max != 0 ? '- $' + formatSalary(job.salary_max) : ''
}
            </p>


      </div>
      
      <div class="interact-buttons margin-06-bottom">
      ${
  isOlderThan30Days(job)
    ? ''
    : `<div class="apply-button-container flex">
<button id="submit-button-normal" class="margin-h-auto grow-button" onclick="applyForJob(event, '${job.id}', '${job.link}')">
  <span class="material-symbols-outlined">open_in_new</span><span>Apply </span><span class="number-display">
  ${job.applicants ? job.applicants : 0}
  </span>
</button>
          </div>
          `
}
<div class="second-buttons-container">
      ${
  userIsLoggedIn
    ? `<div class="favorite-button-container">
              <div id="favorite-form-${job.id}" class="flex">
                <button class="grow-button" id="null-button-normal" onclick="favorite('job', ${job.id});" class="margin-h-auto"><span class="material-symbols-outlined">
favorite
</span>
<span>
Favorite
</span>
</button>
              </div>
            </div>`
    : ''
}

      ${
  userIsAdmin
    ? `
        <div class="delete-button-container flex">
          <button class="grow-button" id="cancel-button-normal" onclick="window.location.href='/jobs/delete/${job.id}'"><span class="material-symbols-outlined">
delete
</span> Delete</button>
        </div>
        
      `
    : ''
}
      <div class="share-button-container flex">
      <button class="margin-h-auto null-button-normal grow-button" onclick="share('${job.title}', '', 'https://getcore.dev/jobs/${job.id}', 'job', '${job.id}');"><span class="material-symbols-outlined">
share
</span><span>Share</span> <span class="number-display">${job.share_count ? job.share_count : 0}</span></button>
      </div>
      </div>

      </div>

              <ul class="second-nav-links">
          <li class="dropdown active">
            <a class="navbar-button company-navbar-button active no-bg no-border" data-id="job-details" id="company-updates-selector">
              <span class="material-symbols-outlined">
                info
              </span>Info
              <div class="jobs-count">
              </div>
            </a>


          </li>
          <li class="dropdown">
            <a class="navbar-button company-navbar-button no-bg no-border" data-id="similar-jobs" id="company-updates-selector"><span class="material-symbols-outlined">
                chat_bubble
              </span>Related Jobs
              <div class="related-jobs-count">
              </div>
            </a>
          </li>
          <li class="dropdown">
            <a class="navbar-button sub-text company-navbar-button no-bg no-border" data-id="similar-company-jobs" id="company-updates-selector">
              <span class="material-symbols-outlined">
                factory
              </span>Company
              <div class="related-jobs-company-count">
              </div>
              </a>
          </li>
        </ul>
          </div>
            <div class="job-details secondary-text company-profile-section">
            <div class="job-posting-recruiter">
            <h4 class="mini-text bold" style="margin-bottom: 0.8rem;">Posted by</h4>  
            <div class="job-recruiter-container">
            <a href="/user/${job.recruiter_username}">
            <img src="${job.recruiter_image}" alt="${job.company_name} logo" class="thumbnail thumbnail-regular thumbnail-tiny" />
            </a>
            <div class="job-recruiter-name">
              <span class="sub-text bold secondary-text">${(job.recruiter_firstname && job.recruiter_lastname) ? `<a href="/user/${job.recruiter_username}" class="bold">${job.recruiter_firstname} ${job.recruiter_lastname}</a>` : ''}</span>
              <span class="${(job.recruiter_firstname && job.recruiter_lastname) ? 'third-text mini-text' : 'secondary-text sub-text'}"><a href="/user/${job.recruiter_username}" class="link">${job.recruiter_username}</a>
              <time>${formatDateJob(job.postedDate)}</time></span>
            </div>
            </div>
            </div>
            <div class="job-posting-description">
            <h4>Job Description</h4>
              <p class="third-text">${job.description}</p>
            </div>
            <div class="job-skills-container">
            <h4 class="third-text">Skills</h4>
                              <div class="job-skills sub-text">
    \
      ${skillsHTML}
      ${
  remainingSkills > 0
    ? `<span class="see-more" id="secondary-text">+${remainingSkills} more</span>`
    : ''
}
    </div>
    </div>
            ${
  job.Requirements
    ? `
            <div class="job-requirements">
              <h4>Requirements</h4>
              <p class="third-text">${job.Requirements}</p>
            </div>
            `
    : ''
}

            ${
  job.Responsibilities
    ? `
            <div class="job-responsibilities">
              <h4>Responsibilities</h4>
              <p class="third-text">${job.Responsibilities}</p>
            </div>
            `
    : ''
}
            <div class="company-description sub-text">
              <h4>Company Description</h4>
              <p class="third-text">${job.company_description}</p>
            </div>
            
            ${
  job.MinimumQualifications
    ? `
<div class="minimum-qualifications">
  <h4 class="third-text">Minimum Qualifications</h4>
  <p>${job.MinimumQualifications}</p>
</div>
`
    : ''
}

${
  job.PreferredQualifications
    ? `
<div class="preferred-qualifications">
  <h4 class="third-text">Preferred Qualifications</h4>
  <p>${job.PreferredQualifications}</p>
</div>
`
    : ''
}

${
  formattedBenefits
    ? `
<div class="job-benefits">
  <h4>Job Benefits</h4>
  <ul class="third-text">
    ${formattedBenefits}
  </ul>
</div>
`
    : ''
}

${
  job.NiceToHave
    ? `
<div class="job-nice-to-have">
  <h4>Nice to Have</h4>
  <p class="third-text">${job.NiceToHave}</p>
</div>
`
    : ''
}

${
  job.schedule
    ? `
<div class="job-schedule">
  <h4>Schedule</h4>
  <p class="third-text">${job.schedule}</p>
</div>
`
    : ''
}

${
  job.hoursPerWeek
    ? `
<div class="job-hours-per-week">
  <h4>Hours per Week</h4>
  <p class="third-text">${job.hoursPerWeek}</p>
</div>
`
    : ''
}

${
  job.equalOpportunityEmployerInfo
    ? `
<div class="job-equal-opportunity-employer-info">
  <h4>Equal Opportunity Employer Info</h4>
  <p class="third-text">${job.equalOpportunityEmployerInfo}</p>
</div>
`
    : ''
}

<div class="job-relocation">
  <h4>Relocation</h4>
  <p class="third-text">${job.relocation ? 'Yes' : 'No'}</p>
</div>
<div class="similar-jobs-location">
${
  job.location
    ? `
  <h4>More jobs in </h4>
  <ul class="locations">
${job.location
    .split(',')
    .map(
      (loc) =>
        `<li><a class="link" href="/jobs/location/${loc.trim()}">${loc.trim()}</a></li>`
    )
    .join('')}
  `
    : ''
}
</ul>
</div>
</div>
<div class="similar-jobs company-profile-section" style="display: none;">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        </div>
</div>
<div class="similar-company-jobs company-profile-section" style="display: none;">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        </div></div>
            <div class="job-skills-display">

              ${tagsHTML}
              ${
  remainingTags > 0
    ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
    : ''
}

            </div>

              
          </div>
        </div>
      `;
      bindSelectorButtons();
      getSimilarJobsByCompany(jobId, job.company_name);
      if (userIsLoggedIn) {
        checkFavorite(jobId);
      }
      
    })
    .catch((error) => {
      console.error('Error fetching job details:', error);
    });

  getSimilarJobs(jobId);
}

function bindSelectorButtons() {
  const companyProfileButtons = document.querySelectorAll('.company-navbar-button');
  console.log(companyProfileButtons);
  const companyProfileSections = document.querySelectorAll('.company-profile-section');
  console.log(companyProfileSections);

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
}
function checkFavorite(jobId) {
  fetch(`/favorites/isFavorite/job/${jobId}`)
    .then((response) => response.json())
    .then((data) => {
      const favoriteButton = document.querySelector(
        `#favorite-form-${jobId} button`
      );
      if (data.isFavorite) {
        favoriteButton.id = 'cancel-button-normal';
        favoriteButton.innerHTML = data.buttonText + 'Unfavorite';
      } else {
        favoriteButton.id = 'submit-button-normal';
        favoriteButton.innerHTML = data.buttonText + 'Favorite';
      }
    })
    .catch((error) => {
      console.error('Error checking favorite:', error);
    });
}

function favorite(favoriteType, TypeId) {
  const endpoints = {
    job: `/favorites/jobs/${TypeId}`,
    post: `/favorites/posts/${TypeId}`,
  };

  const endpoint = endpoints[favoriteType];
  if (!endpoint) {
    console.error('Invalid favorite type');
    return;
  }

  let favoriteButton;
  if (favoriteType === 'job') {
    favoriteButton = document.querySelector(`#favorite-form-${TypeId} button`);
    toggleFavoriteButton(favoriteButton);
  }

  fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        showBannerNotification(data.message);
      } else if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        showBannerNotification(data.message);
        if (favoriteType === 'job') {
          // Revert button state if operation wasn't successful
          toggleFavoriteButton(favoriteButton);
        }
      }
    })
    .catch((error) => {
      console.error('Error adding to favorites:', error);
      showBannerNotification('An error occurred. Please try again.');
      if (favoriteType === 'job') {
        // Revert button state on error
        toggleFavoriteButton(favoriteButton);
      }
    });
}

function toggleFavoriteButton(button) {
  if (button.innerHTML === '<span class="material-symbols-outlined">heart_minus</span> Unfavorite') {
    button.id = 'submit-button-normal';
    button.innerHTML = '<span class="material-symbols-outlined">favorite</span> Favorite';
  } else {
    button.id = 'cancel-button-normal';
    button.innerHTML = '<span class="material-symbols-outlined">heart_minus</span> Unfavorite';
  }
}
