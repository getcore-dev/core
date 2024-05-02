let jobPostings = []; // Declare jobPostings in a higher scope
let currentPage = 1;
const itemsPerPage = 10;
let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {
  fetchJobPostings(currentPage);
  getTopTags();
  document
    .querySelector(".load-more-btn")
    .addEventListener("click", handleLoadMore);
});

function handleLoadMore() {
  currentPage++;
  fetchJobPostings(currentPage);
}

function fetchJobPostings(page) {
  isLoading = true;

  fetch(`/api/jobs?page=${page}&limit=${itemsPerPage}`)
    .then((response) => response.json())
    .then((data) => {
      jobPostings = [...jobPostings, ...data.jobPostings];
      renderJobPostings(jobPostings);
      updateLoadMoreButton();
      isLoading = false;
    })
    .catch((error) => {
      console.error("Error fetching job postings:", error);
      isLoading = false;
    });
}

function updateLoadMoreButton() {
  const loadMoreBtn = document.querySelector(".load-more-btn");
  if (jobPostings.length === 0 || jobPostings.length % itemsPerPage !== 0) {
    loadMoreBtn.style.display = "none";
  } else {
    loadMoreBtn.style.display = "block";
  }
}

function getTintFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = hash & 0x00ffffff; // Ensure hash is within the range of 0x00ffffff

  // Convert hash to a hexadecimal string and pad with leading zeros
  const colorHex = ("00000" + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}65`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = "#808080"; // Light gray
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
  const colorHex = ("00000" + hash.toString(16)).slice(-6);
  const tintColor = `#${colorHex}`;

  // Blend with a desaturated base color (e.g., gray)
  const baseColor = "#404040"; // Dark gray
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

  const blendedColor = `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return blendedColor;
}

function renderJobPostings(jobPostings) {
  const jobListContainer = document.querySelector(".job-list");
  jobListContainer.innerHTML = ""; // Clear existing job postings

  jobPostings.forEach((job) => {
    const jobElement = document.createElement("div");
    jobElement.classList.add("job");
    jobElement.onclick = () => {
      window.location.href = `/jobs/${job.id}`;
    };
    const tagsArray = job.tags
      ? job.tags[1]
        ? job.tags[1].split(", ")
        : []
      : [];
    const maxTags = 3; // Adjust this value based on your desired maximum number of tags
    const displayedTags = tagsArray.slice(0, maxTags);
    const tagsHTML = displayedTags
      .map(
        (tag) =>
          `<span class="job-flair" style="background-color: ${getTintFromName(
            tag
          )}; border: 1px solid ${getTintFromNameSecondary(
            tag
          )};"><p>${tag}</p></span>`
      )
      .join("");
    const remainingTags = tagsArray.length - maxTags;
    jobElement.innerHTML = `
      <div class="job-preview">
        <div class="job-info">
          <div class="company-info">
            <img class="thumbnail thumbnail-tiny thumbnail-regular" style="width: auto;" src="${
              job.company_logo
            }" alt="${job.company_name} logo" />
            <p class="company-name">${job.company_name}</p>
          
            
            <form id="favorite-form-${job.id}" action="/favorites/jobs/${
      job.id
    }" method="POST" style="margin-left: auto;">
              <button type="submit" style="margin-left:auto; background: 0; border:0;">                
                <span class="material-symbols-outlined" style="font-size:1.2rem;">star</span>
              </button>
            </form>
          </div>
          <h3 class="job-title">${
            job.title
          } <span style="margin-left: auto; float: right;">${
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
            <div class="job-buttons">
              <button class="job-apply" id="submit-button-normal" style="padding: 5px 10px">Apply</button>
            </div>
          </div>
          <div class="job-posting-flairs">
            ${tagsHTML}
            ${
              remainingTags > 0
                ? `<span class="see-more" id="secondary-text">+${remainingTags} more</span>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
    jobListContainer.appendChild(jobElement);
  });
}

function checkSalaryRange(minSalary, maxSalary, selectedSalary) {
  if (!selectedSalary) return true;

  const [minSelected, maxSelected] = selectedSalary.split("-").map(Number);
  return (
    (minSalary >= minSelected && minSalary <= maxSelected) ||
    (maxSalary >= minSelected && maxSalary <= maxSelected)
  );
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function renderTopTagsAndCount(topTags) {
  const topTagsContainer = document.querySelector(".top-tags");
  topTagsContainer.innerHTML = ""; // Clear existing top tags

  topTags.forEach((tag) => {
    const tagElement = document.createElement("div");
    tagElement.innerHTML = `<span class="job-flair" style="background-color: ${getTintFromName(
      tag.tagName
    )}; border: 1px solid ${getTintFromNameSecondary(tag.tagName)};"><p>${
      tag.tagName
    }</p><p>${tag.count}</p></span>`;
    topTagsContainer.appendChild(tagElement);
  });
}

function getTopTags() {
  fetch("/jobs/getTopTags")
    .then((response) => response.json())
    .then((tags) => {
      renderTopTagsAndCount(tags);
    })
    .catch((error) => {
      console.error("Error fetching top tags:", error);
    });
}

function formatLocation(location) {
  const parts = location.split(",").map((part) => part.trim());

  if (parts.length >= 3) {
    return `${parts[1]}`;
  } else if (parts.length === 1) {
    return location;
  } else {
    return location;
  }
}
