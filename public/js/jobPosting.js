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
  try {
    const response = await fetch(`/api/jobs/${jobId}/similar`);
    const jobs = await response.json();

    const similarJobsContainer = document.querySelector('.similar-jobs');

    if (jobs.length === 0) {
      similarJobsContainer.innerHTML = '';
      return;
    }

    similarJobsContainer.innerHTML = '<h4 class="secondary-text">Related Jobs</h4>';
    const similarJobsList = document.createElement('div');
    similarJobsList.className = 'similar-jobs-list';

    jobs.forEach((job) => {
      const jobElement = createJobElement(job);
      similarJobsList.appendChild(jobElement);
    });

    similarJobsContainer.appendChild(similarJobsList);
  } catch (error) {
    console.error('Error fetching similar jobs:', error);
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

function createJobElement(job) {
  const jobElement = document.createElement('div');
  jobElement.classList.add('job');
  jobElement.classList.add('no-padding');

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
            <span data-name="${skill}" data-type="skills" data-id="${skill}" data-index="${sortedTags.indexOf(skill)}" class="mini-text bold text-tag">${skill}</span>`;
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
      <div class="flex flex-row gap-03 mini-text wrap">
            <span class="text-tag bold flex flex-row v-center">
            📍
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
async function getSimilarJobsByCompany(jobId) {
  try {
    const response = await fetch(`/api/jobs/${jobId}/similar-company`);
    const jobs = await response.json();

    const similarJobsContainer = document.querySelector('.similar-company-jobs');

    if (jobs.length === 0) {
      similarJobsContainer.innerHTML = '<div class="empty-text">No similar jobs found.</div>';
      return;
    }

    similarJobsContainer.innerHTML = '<h4 class="secondary-text">Related Jobs at the Same Company</h4>';
    const similarJobsList = document.createElement('div');
    similarJobsList.className = 'similar-jobs-list';

    jobs.forEach((job) => {
      const jobElement = createJobElement(job);
      similarJobsList.appendChild(jobElement);
    });

    similarJobsContainer.appendChild(similarJobsList);
  } catch (error) {
    console.error('Error fetching similar jobs:', error);
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

      const maxTags = 6;
      const maxSkills = 10;
      const displayedTags = tagsArray.slice(0, maxTags);
      const displayedSkills = skillsArray.slice(0, maxSkills);

      const tagsHTML = displayedTags
        .map(
          (tag) =>
            `<a class="mini-text bold text-tag" href="/skills/${encodeURIComponent(tag.trim())}">${tag}</a>`
        )
        .join('');
      const skillsHTML = displayedSkills
        .map(
          (skill) =>
            `<a class="mini-text bold text-tag" href="/jobs?skill=${encodeURIComponent(skill.trim())}">${skill}</a>`
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
        <div class="job-listing-menu">
      ${
  isOlderThan30Days(job)
    ? `<div class="caution-messages">This job was posted more than 30 days ago. Apply anyway <a class="link" href="${job.link}">here</a></div>`
    : ''
}

      <div class="company-info">
        ${
  job.company_logo
    ? `
          <img src="${job.company_logo}" style="width: auto;" alt="${job.company_name} logo" onerror="this.onerror=null;this.src='/img/glyph.png';" class="thumbnail thumbnail-small thumbnail-regular" />
        `
    : ''
}
        <div class="company-details">
      <div class="company-information">
            <p class="third-text mini-text">
            <a class="secondary-text bold link sub-text" href="/jobs/company/${encodeURIComponent(job.company_name)}">${job.company_name}</a>
            </p>
          <h3 class="company-name header-text margin-03-bottom">
        ${job.title}
      </h3>
      <p class="mini-text third-text"> 
          ${
  job.location
    .split(',')
    .map(loc => loc.trim().toLowerCase())
    .filter(loc => !loc.toLowerCase().includes('n/a'))
    .map(loc => {
      if (loc.toLowerCase().includes('remote')) {
        return '<a class="mini-text" href="/jobs?locations=Remote">Remote</a>';
      } else {
        // Capitalize the first letter of each word in the country for display
        const country = loc
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `<a class="mini-text third-text" href="/jobs?locations=${encodeURIComponent(loc)}">${country}</a>`;
      }
    })
    .join(', ')
}

      </p>

      </div>
      
        </div>
        ${job.experienceLevel ? `
          <p class="job-detail mini-text bold secondary-text" style="margin-left:auto;white-space: nowrap;">
        ${job.experienceLevel}
        </p>  
        ` : ''}
      </div>

      ${ job.salary || job.salary_max ? `
        <div class="job-info-flairs sub-text">
      ${job.salary !== 0 ? `
        <p class="text-tag bold salary sub-text">
      USD $${formatSalary(job.salary)}
      ${job.salary_max !== 0 ? `- $${formatSalary(job.salary_max)}` : ''}
      ${!job.location.toLowerCase().includes('us') && 
        !job.location.toLowerCase().includes('united states') 
    ? '<span class="currency-warning"> (currency may not be in USD)</span>' 
    : ''}
        </p>
      ` : ''}
        </div>
        ` : ''}
        ${job.isProcessed ? `
        <div class="job-skills-display">

          ${skillsHTML}
          ${
  remainingTags > 0
    ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
    : ''
}
        </div>
            ` : ''}
  ${job.isProcessed ? `
            <div class="job-posting-description ${job.recruiter_username === 'autojob' ? 'ai-generated-content' : ''}">

      <h4 class="sub-text bold" style="margin-top:0;">AI-Generated Overview</h4>
    <p class="sub-text readable">
    ${job.description}
    </p>
    </div>

    ` : ''}
      
<div class="flex flex-col gap-06">
      <div class="interact-buttons flex space-between v-center">
        ${
  !isOlderThan30Days(job)
    ? `<div class="apply-button-container flex">
                <button class="main-button-normal margin-h-auto grow-button" onclick="applyForJob(event, '${job.id}', '${job.link}')">
                  <span class="material-symbols-outlined">work</span><span class="sub-text">Apply </span><span class="number-display">
                  ${job.applicants ? job.applicants : 0}
                  </span>
                </button>
                  </div>`
    : ''
} 
        <div class="second-buttons-container">
                  <div class="dropdown" tabindex="0">
            <button aria-label="Dropdown" class="dropdown-button location-dropdown px-2 py-2 mini-text secondary-text" aria-haspopup="true" aria-expanded="false">
              <span class="material-symbols-outlined no-padding no-margin">more_horiz</span>
            </button>

            <div class="dropdown-content">
            <a class="grow-button margin-h-auto">

            <button class="no-margin no-padding no-bg no-border" onclick="share('${job.title}', '', 'https://getcore.dev/jobs/${job.id}', 'job', '${job.id}');">
          <span class="material-symbols-outlined">share</span>
          <span class="sub-text">Share</span>
        </button>
        </a>
            ${
  userIsLoggedIn
    ? `                                    
                <a class="grow-button margin-h-auto cancel-button-text">
                  <div id="favorite-form-${job.id}" class="flex">
                    <button class="no-margin no-padding no-bg no-border" onclick="favorite('job', ${job.id});" class="margin-h-auto">
                      <span class="material-symbols-outlined">star</span>
                        <span class="sub-text">Favorite</span>
                    </button>
                  </div>
                </a>` : '' }
                       ${
  userIsLoggedIn && userIsAdmin
    ? `
      <div class="resume-button w-100">
        <a href="/api/create-resume/${job.id}" class="grow-button margin-h-auto">
          <span class="material-symbols-outlined">description</span>
          <span class="sub-text">Resume</span>
        </a>
      </div>
      <div class="cover-letter-button w-100">
        <a href="/api/create-cover-letter/${job.id}" class="grow-button margin-h-auto">
          <span class="material-symbols-outlined">description</span>
          <span class="sub-text">Cover Letter</span>
        </a>
      </div>
      <div class="delete-button-container">
              <a class="grow-button margin-h-auto cancel-button-text" href="/jobs/delete/${job.id}">
          <span class="material-symbols-outlined">delete</span>
          <span class="sub-text">Delete</span>
        </a>
      </div> `
    : ''}
</div>
</div>
            </div>
          </div>
    </div>
</div>
  </div>
</div>
            <div class="job-details primary-text company-profile-section">
            <div class="job-posting-recruiter sub-text">
                    <h4 style="margin-top:0;">Recruiter Information</h4>

<div>
        <div class="job-recruiter-container">
            <div class="job-recruiter-info">
            <div class="recruiter-info flex flex-row gap-06">
            <a href="/user/${job.recruiter_username}" class="recruiter-image">
                <img class="thumbnail thumbnail-tiny thumbnail-regular" src="${job.recruiter_image}" alt="${job.company_name} logo" />
            </a>
            <div class="recruiter-details flex flex-col">
                <div class="job-recruiter-name sub-text">${job.recruiter_firstname} ${job.recruiter_lastname}</div>
                <div class="username-date">
                    <a href="/user/${job.recruiter_username}" class="mini-text">${job.recruiter_username}</a> • <time class="mini-text secondary-text">${formatDateJob(job.postedDate)}</time>
                </div>
                </div>
                </div>
            </div>
        </div>
    </div>
</div>
            ${job.company_description ? `
            <div class="company-description sub-text">
              <h4 class="sub-text bold">Company Description</h4>
              <p class="sub-text">${job.company_description}</p>
            </div>
            ` : ''}

            ${ !job.isProcessed ? `
            <div class="job-posting-description sub-text">
              <h4 class="sub-text bold">Job Description</h4>
              <p class="sub-text">${job.description}</p>
            </div>
            ` : ''}
            ${
  job.Requirements
    ? `
            <div class="job-requirements">
              <h4 >Requirements</h4>
              <p>${job.Requirements}</p>
            </div>
            `
    : ''
}

            ${
  job.Responsibilities
    ? `
            <div class="job-responsibilities">
              <h4 >Responsibilities</h4>
              <p>${job.Responsibilities}</p>
            </div>
            `
    : ''
}
            
            ${
  job.MinimumQualifications
    ? `
<div class="minimum-qualifications">
  <h4 >Minimum Qualifications</h4>
  <p>${job.MinimumQualifications}</p>
</div>
`
    : ''
}

${
  job.PreferredQualifications
    ? `
<div class="preferred-qualifications">
  <h4 >Preferred Qualifications</h4>
  <p>${job.PreferredQualifications}</p>
</div>
`
    : ''
}

${
  formattedBenefits
    ? `
<div class="job-benefits">
  <h4 class="main-text">Job Benefits</h4>
  <ul class="sub-text">
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
  <h4 >Nice to Have</h4>
  <p>${job.NiceToHave}</p>
</div>
`
    : ''
}

${
  job.schedule
    ? `
<div class="job-schedule">
  <h4 >Schedule</h4>
  <p>${job.schedule}</p>
</div>
`
    : ''
}

${
  job.hoursPerWeek
    ? `
<div class="job-hours-per-week">
  <h4 >Hours per Week</h4>
  <p>${job.hoursPerWeek}</p>
</div>
`
    : ''
}

${
  job.equalOpportunityEmployerInfo
    ? `
<div class="job-equal-opportunity-employer-info">
  <h4 >Equal Opportunity Employer Info</h4>
  <p>${job.equalOpportunityEmployerInfo}</p>
</div>
`
    : ''
}

<div class="job-relocation">
  <h4 >Relocation</h4>
  <p>${job.relocation ? 'Yes' : 'No'}</p>
</div>

<div class="flex">
<div class="autojob-warning px-4 py-2">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-text">This post is scraped from the internet and may contain errors.</span>
                </div>
                </div>


</div>

              
          </div>
        </div>
        <div class="similar-jobs company-profile-section">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner"></div>
          </div>
        </div>
</div>
<div class="similar-company-jobs company-profile-section">
        <div id="loading-indicator">
          <div class="spinner-container">
            <div class="spinner">
            </div>
          </div>
        </div>
</div>
      `;
      console.log('done loading job, loading companies');
      bindSelectorButtons();
      getSimilarJobs(jobId);
      getSimilarJobsByCompany(jobId, job.company_name);
      if (userIsLoggedIn) {
        checkFavorite(jobId);
      }
      
    })
    .catch((error) => {
      console.error('Error fetching job details:', error);
    });

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
        '.favorite-action-button'
      );
      if (data.isFavorite) {
        favoriteButton.id = 'cancel-button-normal';
        favoriteButton.innerHTML = data.buttonText;
      } else {
        favoriteButton.id = 'bordered-button-normal';
        favoriteButton.innerHTML = data.buttonText;
      }
    })
    .catch((error) => {
      console.error('Error checking favorite:', error);
    });
}

function favorite(favoriteType, TypeId) {
  console.log('Favorite type:', favoriteType);
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
    favoriteButton = document.querySelector('.favorite-action-button');
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
  if (button.innerHTML === '<span class="material-symbols-outlined no-margin no-padding">star</span>') {
    button.id = 'submit-button-normal';
    button.innerHTML = '<span class="material-symbols-outlined no-margin no-padding">star</span>';
  } else {
    button.id = 'cancel-button-normal';
    button.innerHTML = '<span class="material-symbols-outlined no-margin no-padding">star</span>';
  }
}
