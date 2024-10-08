
const jobSuggestions = document.getElementById('topJobSuggestions');

function createCard(name, timestamp, title, description, clickable=false, link=null, image=null, tags=null) {
  console.log(tags);
  const card = document.createElement('div');

  let tagsHtml = '';
  if (tags) {
    tagsHtml = tags.map(tag => `
      <div class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground ${tag.class}">
        ${tag.text}
      </div>
    `).join('');
  }

  const cardContent = `
<div class="flex flex-col items-start gap-2 rounded-lg border p-3 text-left mb-4 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ''}>
  <div class="flex w-full flex-col gap-1">
    <div class="flex items-center">
      <div class="flex items-center gap-2">

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
    <div class="text-xs font-medium">${title}</div>
  </div>
  <div class="line-clamp-2 text-xs text-muted-foreground">
    ${description}
  </div>
  <div class="flex items-center gap-2">
    ${tagsHtml}
  </div>
</div>
    `;

  card.innerHTML = cardContent;
  return card;
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

// make a fetch request to the job-suggestions endpoint
fetch('/api/job-suggestions')
  .then(response => response.json())
  .then(data => {
    data.forEach(job => {
      jobSuggestions.appendChild(createCard(job.company_name, formatRelativeDate(job.postedDate), job.title, job.description, true, '/jobs/' + job.id, job.company_logo, [{ class: 'applicants', text: `${job.applicants} applicants`},{ class: 'salary', text: `$${job.salary}`}]));
    });
  })
  .catch(error => console.error('Error fetching job suggestions:', error));


