function createCard(name, timestamp, title, location, description, clickable=false, link=null, image=null, tags=null) {
    const card = document.createElement('span');
  
    let tagsHtml = '';
    if (tags) {
      tagsHtml = tags.map(tag => `
      <div class="${tag.class} inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground flex flex-row gap-2">
        <span class="mr-2">${tag.icon ? tag.icon : ''}</span>
          <span class="text-xs">${tag.text}</span>
        </div>
      `).join('');
    }
  
    const cardContent = `
    <div class="flex flex-col border items-start gap-2 rounded-lg w-full p-3 text-left text-sm transition-all hover:bg-accent max-h-[250px]" ${clickable ? `onclick="window.location.href='${link}'"` : ''}>
    <div class="flex flex-row gap-2 items-center w-full">
    ${image ? `
          <span class="relative flex shrink-0 overflow-hidden rounded-md mr-2">
        <img class="aspect-square h-8 w-8" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
      </span>
      ` : `       
      <span class="relative flex shrink-0 overflow-hidden rounded-md mr-2">
      <img class="aspect-square h-8 w-8" src="/img/glyph.png" onerror="this.onerror=null; this.src='/img/glyph.png';" />
      </span>
      `
    }
    <div class="flex w-full flex-col gap-1">
      <div class="flex items-center">
      <div class="flex items-center gap-2 wrap">
        <div class="text-sm font-medium leading-none">${name}</div>
      </div>
      <div class="ml-auto text-xs text-foreground">${timestamp}</div>
      </div>
      <div class="text-sm text-foreground">${title}</div>

    </div>
    ${description ? `
    <div class="line-clamp-2 text-sm text-muted-foreground w-full">
      ${description}
    </div>
    ` : ''}
    </div>
    <div class="flex gap-2 text-sm text-muted-foreground wrap">
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

  