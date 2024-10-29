function createCard(name, timestamp, title, description, clickable=false, link=null, image=null, tags=null) {
    console.log(tags);
    const card = document.createElement('span');
  
    let tagsHtml = '';
    if (tags) {
      tagsHtml = tags.map(tag => `
        <div class="${tag.class} flex flex-row gap-2 v-center">
        ${tag.icon ? tag.icon : ''}
          ${tag.text}
        </div>
      `).join('');
    }
  
    const cardContent = `
    <div class="flex flex-col items-start gap-2 rounded-lg border w-full p-3 text-left text-sm transition-all hover:bg-accent max-h-[250px]" ${clickable ? `onclick="window.location.href='${link}'"` : ''}>
    <div class="flex w-full flex-col gap-1">
      <div class="flex items-center">
      <div class="flex items-center gap-2 wrap">
    
      ${image ? `
          <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
        <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
      </span>
      ` : ''
    }
        <div class="font-semibold">${name}</div>
      </div>
      <div class="ml-auto text-xs text-foreground">${timestamp}</div>
      </div>
      <div class="text-base font-medium text-balance max-w-lg leading-relaxed">${title}</div>
    </div>
    ${description ? `
    <div class="line-clamp-2 text-sm text-muted-foreground w-full">
      ${description}
    </div>
    ` : ''}
    <div class="flex items-center gap-2 wrap">
      ${tagsHtml}
    </div>
    </div>
      `;
  
    card.innerHTML = cardContent;
    return card;
  }

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

  