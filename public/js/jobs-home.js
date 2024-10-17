
const jobSuggestions = document.getElementById('topJobSuggestions');
const recentJobs = document.getElementById('recentViewedJobs');


function createCardSquare(name, timestamp, title, description, clickable=false, link=null, image=null, tags=null) {
  console.log(tags);
  const card = document.createElement('div');
  
  let tagsHtml = '';
  if (tags) {
    tagsHtml = tags.map(tag => `
        <div class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ${tag.class}">
            ${tag.icon ? `<span class="mr-1">${tag.icon}</span>` : ''}
      ${tag.text}
        </div>
      `).join('');
  }
  
  const cardContent = `
  <div class="lex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent w-[250px] h-[200px]" ${clickable ? `onclick="window.location.href='${link}'"` : ''}>
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
        <div class="ml-auto text-xs text-foreground">${timestamp}</div>
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

function createCard(name, timestamp, title, description, clickable=false, link=null, image=null, tags=null) {
  console.log(tags);
  const card = document.createElement('div');
  
  let tagsHtml = '';
  if (tags) {
    tagsHtml = tags.map(tag => `
        <div class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ${tag.class}">
            ${tag.icon ? `<span class="mr-1">${tag.icon}</span>` : ''}
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
        <div class="ml-auto text-xs text-foreground">${timestamp}</div>
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

async function updateJobCount() {
  try {
    const response = await fetch('/api/jobs-count');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const jobCount = await response.json();
    document.getElementById('recent-jobs-count').textContent = jobCount.totalCount;
    document.getElementById('today-jobs-count').textContent = jobCount.todayCount;
  } catch (error) {
    console.error('Error fetching job count:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateJobCount();
  const appliedJobsLink = document.getElementById('applied-jobs-count');
  if (appliedJobsLink) {
    fetch('/api/applied-jobs-count')
      .then(response => response.json())
      .then(data => {
        appliedJobsLink.textContent = `${data}`;
      })
      .catch(error => {
        console.error('Error fetching applied jobs count:', error);
        appliedJobsLink.textContent = 'Applied Jobs';
      });
  }
});

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

// make a fetch request to the job-suggestions endpoint
fetch('/api/job-suggestions')
  .then(response => response.json())
  .then(data => {
    jobSuggestions.innerHTML = '';
    data.forEach(job => {
      jobSuggestions.appendChild(createCard(job.company_name, formatRelativeDate(job.postedDate), job.title, job.description, true, '/jobs/' + job.id, job.company_logo, [{ class: 'applicants', text: `${job.applicants} applicants`},{ class: 'salary', text: `$${job.salary}`}]));
    });
  })
  .catch(error => console.error('Error fetching job suggestions:', error));

fetch('/api/recent-viewed-jobs')
  .then(response => response.json())
  .then(data => {
    recentJobs.innerHTML = '';
    data.forEach(job => {
      const postedDate = new Date(job.postedDate.replace(' ', 'T'));
      const now = new Date();
      const diffTime = Math.abs(now - postedDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      tags = [];
      if (diffDays <= 2) {
        tags.push({text: 'New', class: 'new'});
      }

      if (job.location) {
        tags.push({text: formatLocation(job.location), class: 'location', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>'});
      }
      if (job.salary) {
        tags.push({text: `$${job.salary}`, class: 'salary', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coins"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>'});
      } else {
        // try to extract salary from description
        const salaryMatch = job.description.match(/\$(\d+(?:,?\d*)?(?:k|K)?)/);
        if (salaryMatch) {
          tags.push({text: `$${salaryMatch[1]}`, class: 'salary'});
        }
      }
      if (job.experienceLevel) {
        tags.push({text: job.experienceLevel, class: 'experienceLevel', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>'});
      }
      tags.push({text: `${job.applicants} applicants`, class: 'applicants', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'});

      recentJobs.appendChild(createCardSquare(job.company_name, formatRelativeDate(job.postedDate), job.title, job.description, true, '/jobs/' + job.job_id, job.company_logo, tags));
    });
  })
  .catch(error => console.error('Error fetching recent jobs:', error));