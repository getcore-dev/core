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
<div class="flex flex-row p-3 items-start gap-2 rounded-lg text-left mb-2 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
  <span class="relative flex shrink-0 overflow-hidden rounded-md mr-2 h-10 w-10">
    <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.src='/img/glyph.png';"/>
  </span>
  <div class="flex flex-col w-full gap-1">
    <div class="flex items-center">
      <div class="flex flex-col gap-0">
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

  