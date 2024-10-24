// Declare these variables in the global scope
let currentPage = 1;
const pageSize = 15;
let isLoading = false;
let hasMoreJobs = true;

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    const companyProfileButtons = document.querySelectorAll(
      ".company-navbar-button",
    );
    const companyProfileSections = document.querySelectorAll(
      ".company-profile-section",
    );

    companyProfileButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("data-id");

        companyProfileSections.forEach((section) => {
          if (section.className.includes(targetId)) {
            section.style.display = "block";
          } else {
            section.style.display = "none";
          }
        });

        // Update active button state (optional)
        companyProfileButtons.forEach((btn) => {
          btn.classList.remove("active");
        });
        button.classList.add("active");
      });
    });
    const description = document.querySelector(".description-text");
    const showMoreButton = document.querySelector(".show-more-button");
    const descriptionContainer = document.querySelector(".company-description");

    if (description && showMoreButton) {
      if (description.scrollHeight > description.clientHeight) {
        showMoreButton.style.display = "block";
      }

      showMoreButton.addEventListener("click", () => {
        if (description.style.maxHeight === "none") {
          description.style.maxHeight = "100px";
          descriptionContainer.style.maxHeight = "3.4rem";
          showMoreButton.innerText = "Show More";
        } else {
          descriptionContainer.style.maxHeight = "none";
          description.style.maxHeight = "none";
          showMoreButton.innerText = "Show Less";
        }
      });
    }

    const companyNameMeta = document.querySelector('meta[name="company-name"]');
    if (companyNameMeta) {
      const companyName = companyNameMeta.content;
      loadCompanyJobs(companyName);

      // Add scroll event listener for infinite scrolling
      window.addEventListener("scroll", () => {
        if (
          window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 500 &&
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
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "block";
        const jobListContainer = document.querySelector(".job-list");
        jobListContainer.appendChild(loadingSpinner);
      }
    } else {
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "none";
      }
    }

    const response = await fetch(
      `/api/jobs/company/${encodeURIComponent(companyName)}?page=${currentPage}&pageSize=${pageSize}`,
    );
    const jobs = await response.json();

    if (jobs.length === 0) {
      hasMoreJobs = false;
      isLoading = false;
      // hide loading indicator and display 'end of the list message'
      const loadingSpinner = document.querySelector("#loading-indicator");
      if (loadingSpinner) {
        loadingSpinner.style.display = "none";
      }
      const jobListContainer = document.querySelector(".job-list");
      const endOfListMessage = document.createElement("div");
      endOfListMessage.classList.add("end-of-list-message");
      endOfListMessage.classList.add("text-muted-foreground");
      endOfListMessage.classList.add("mini-text");
      endOfListMessage.classList.add("flex");
      endOfListMessage.classList.add("h-center");
      endOfListMessage.textContent = "No more job postings to display";
      jobListContainer.appendChild(endOfListMessage);
    } else {
      renderJobPostings(jobs);
      currentPage++;
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
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
    return "green";
  } else if (diffDays <= 60) {
    return "yellow";
  } else {
    return "red";
  }
}

function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else if (diffInSeconds < 172800) {
    return "1d ago";
  } else {
    const month = date.toLocaleString("default", { month: "short" });
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
    hash = name.charCodeAt(i) + ((hash << 18) - hash);
  }
  const color = (hash & 0x00ffffff).toString(16).toUpperCase();
  const tintColor = `#${color}`;
  return tintColor;
}

document.addEventListener("DOMContentLoaded", function () {
  const stockSymbols = document.querySelectorAll(".company-stock_symbol");

  stockSymbols.forEach((symbolElement) => {
    const symbol = symbolElement.dataset.symbol;
    if (symbol) {
      fetchStockMovement(symbol, symbolElement);
    }
  });
});

async function fetchStockMovement(symbol, element) {
  const API_KEY = "YOUR_ALPHA_VANTAGE_API_KEY_HERE"; // Replace with your actual API key
  const API_URL = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data["Global Quote"]) {
      const changePercent = parseFloat(
        data["Global Quote"]["10. change percent"].replace("%", ""),
      );
      updateStockMovement(element, changePercent);
    }
  } catch (error) {
    console.error("Error fetching stock data:", error);
  }
}

function updateStockMovement(element, changePercent) {
  const movementElement = element.querySelector(".stock-movement");
  if (movementElement) {
    const formattedChange = changePercent.toFixed(2);
    const sign = changePercent >= 0 ? "+" : "";
    movementElement.textContent = `${sign}${formattedChange}%`;
    movementElement.classList.add(changePercent >= 0 ? "positive" : "negative");
  }
}

function formatLocation(location) {
  if (location === "N/A") {
    return "Remote";
  }

  const parts = location.split(",").map((part) => part.trim());

  // Helper function to check if a string is a US state
  const isUSState = (str) =>
    Object.keys(stateMappings).includes(str) ||
    Object.values(stateMappings).includes(str);

  // Helper function to get state abbreviation
  const getStateAbbr = (state) => {
    const fullName = Object.keys(stateMappings).find(
      (key) => key.toLowerCase() === state.toLowerCase(),
    );
    return fullName ? stateMappings[fullName] : state;
  };

  // Helper function to get country abbreviation
  const getCountryAbbr = (country) => {
    const fullName = Object.keys(countryMappings).find(
      (key) => key.toLowerCase() === country.toLowerCase(),
    );
    return fullName ? countryMappings[fullName] : country;
  };

  // Helper function to format a single location
  const formatSingleLocation = (city, state, country) => {
    const isRemote =
      city.toLowerCase() === "remote" || city.toLowerCase() === "n/a";

    if (country && country !== "N/A") {
      const countryAbbr = getCountryAbbr(country);
      if (
        countryAbbr.toLowerCase() === "usa" ||
        country.toLowerCase() === "united states" ||
        country.toLowerCase() === "us"
      ) {
        if (isRemote) {
          return "Remote, USA";
        } else {
          return `${city !== "N/A" ? city + ", " : ""}${state !== "N/A" ? getStateAbbr(state) : "USA"}`;
        }
      } else {
        if (isRemote) {
          return "Remote, " + countryAbbr;
        } else {
          return `${city !== "N/A" ? city : ""}${state !== "N/A" && state !== city ? "/" + getStateAbbr(state) : ""}, ${countryAbbr}`;
        }
      }
    } else if (state && state !== "N/A") {
      return `${isRemote ? "Remote, " : ""}${isUSState(state) ? getStateAbbr(state) : state}`;
    } else if (city && city !== "N/A") {
      return city;
    } else {
      return "Remote";
    }
  };

  // Process multiple locations
  const locations = [];
  for (let i = 0; i < parts.length; i += 3) {
    const city = parts[i];
    const state = parts[i + 1] || "";
    const country = parts[i + 2] || "";

    try {
      locations.push(formatSingleLocation(city, state, country));
    } catch (error) {
      console.error("Error formatting location:", error);
    }
  }

  return locations.join("; ");
}

function createJobElement(job) {
  let tags = [];

  const postedDate = new Date(job.postedDate.replace(" ", "T"));
  const now = new Date();
  const diffTime = Math.abs(now - postedDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) {
    tags.push({ text: "New", class: "link" });
  }

  if (job.location) {
    tags.push({ text: formatLocation(job.location), class: "location" });
  }
  if (job.salary) {
    tags.push({ text: `$${job.salary}`, class: "salary" });
  } else {
    // try to extract salary from description
    const salaryMatch = job.description.match(/\$(\d+,?\d*)/);
    if (salaryMatch) {
      tags.push({ text: `$${salaryMatch[1]}`, class: "salary" });
    }
  }
  if (job.experienceLevel) {
    tags.push({ text: job.experienceLevel, class: "experienceLevel" });
  }

  const jobElement = createCard(
    job.company_name,
    formatRelativeDate(job.postedDate),
    job.title,
    job.description,
    true,
    `/jobs/${job.id}`,
    job.company_logo,
    tags,
  );
  return jobElement;
}

function createCard(
  name,
  timestamp,
  title,
  description,
  clickable = false,
  link = null,
  image = null,
  tags = null,
) {
  console.log(tags);
  const card = document.createElement("div");

  let tagsHtml = "";
  if (tags) {
    tagsHtml = tags
      .map(
        (tag) => `
      <div class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 text-balance ${tag.class}">
        ${tag.text}
      </div>
    `,
      )
      .join("");
  }

  const cardContent = `
<div class="flex flex-col items-start gap-2 rounded-lg border p-3 text-left mb-4 text-sm transition-all hover:bg-accent" ${clickable ? `onclick="window.location.href='${link}'"` : ""}>
  <div class="flex w-full flex-col gap-1">
    <div class="flex items-center">
      <div class="flex items-center gap-2 wrap">

      ${
        image
          ? `
              <span class="relative flex shrink-0 overflow-hidden rounded-full mr-2 h-5 w-5">
        <img class="aspect-square h-full w-full" src="${image || '/img/glyph.png'}" onerror="this.onerror=null; this.src='/img/glyph.png';" />
      </span>
      `
          : ""
      }
        <div class="font-semibold">${name}</div>
      </div>
      <div class="ml-auto text-xs text-foreground">${timestamp}</div>
    </div>
    <div class="text-base font-medium text-balance max-w-lg leading-relaxed">${title}</div>
  </div>
  <div class="line-clamp-2 text-sm text-muted-foreground w-full text-balance max-w-lg leading-relaxed">
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

function renderJobPostings(jobPostings) {
  // remove the loading spinner
  const loadingSpinner = document.querySelector("#loading-indicator");
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
  const jobListContainer = document.querySelector(".job-list");

  jobPostings.forEach((job) => {
    const jobElement = createJobElement(job);
    jobListContainer.appendChild(jobElement);
  });
}

function fetchCompanyComments(companyName) {
  return fetch(`/api/company/${encodeURIComponent(companyName)}/comments`)
    .then((response) => response.json())
    .catch((error) => console.error("Error fetching company comments:", error));
}

function formatDate(date) {
  let postDate = new Date(date);
  let today = new Date();
  let diff = today - postDate;
  let formattedDate = "";

  // Convert time difference to different units
  let minutes = Math.floor(diff / 60000); // 60,000 milliseconds in a minute
  let hours = Math.floor(diff / 3600000); // 3,600,000 milliseconds in an hour
  let days = Math.floor(diff / 86400000); // 86,400,000 milliseconds in a day

  // Decide the format based on the time difference
  if (diff < 86400000) {
    // Less than 24 hours
    if (hours < 1) {
      formattedDate = minutes + "m";
    } else {
      formattedDate = hours + "h";
    }
  } else {
    // Format date with month spelled out, e.g., "July 19, 2024"
    let options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    formattedDate = postDate.toLocaleDateString("en-US", options);
  }

  return formattedDate;
}

document.addEventListener("DOMContentLoaded", function () {
  const description = document.getElementById("companyDescription");
  const toggleButton = document.getElementById("toggleButton");

  function checkOverflow() {
    const isOverflowing = description.scrollHeight > description.clientHeight;
    toggleButton.style.display = isOverflowing ? "block" : "none";
  }

  toggleButton.addEventListener("click", function () {
    description.classList.toggle("expanded");
    toggleButton.textContent = description.classList.contains("expanded")
      ? "Show less"
      : "Show more";
  });

  // Check overflow on load and resize
  window.addEventListener("resize", checkOverflow);
  checkOverflow();
});

function renderComments(comments) {
  const commentsContainer = document.querySelector(".comments-container");
  const commentsHeader = document.querySelector(
    ".company-comments-header-title",
  );
  const commentCount = document.querySelector(".comments-count");
  commentsContainer.innerHTML = "";
  commentCount.style.display = "flex";
  commentCount.textContent = `${comments.length}`;
  commentsHeader.textContent = `${comments.length} Comment${comments.length !== 1 ? "s" : ""}`;

  comments.forEach((comment) => {
    const commentElement = document.createElement("div");
    commentElement.classList.add("comment");
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
    commentsContainer.textContent = "No Comments Yet";
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
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
  const commentId = event.target.getAttribute("data-id");
  const companyInfo = document.querySelector(".company-info-container");
  const companyName = companyInfo.getAttribute("data-company");
  if (!commentId) {
    return;
  }

  fetch(
    `/jobs/company/${encodeURIComponent(companyName)}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
    .then((response) => {
      if (response.ok) {
        event.target.parentElement.parentElement.remove();
      }
    })
    .catch((error) => console.error("Error deleting comment:", error));
}

document.addEventListener("DOMContentLoaded", function () {
  const toggleButton = document.getElementById("toggleInsights");
  const insightsContainer = document.getElementById("insightsContainer");

  if (toggleButton && insightsContainer) {
    toggleButton.addEventListener("click", function () {
      if (insightsContainer.classList.contains("hidden")) {
        insightsContainer.classList.remove("hidden");
        insightsContainer.classList.add("block");
        toggleButton.textContent = "Hide Insights";
      } else {
        insightsContainer.classList.remove("block");
        insightsContainer.classList.add("hidden");
        toggleButton.textContent = "Show Insights";
      }
    });
  }
});
