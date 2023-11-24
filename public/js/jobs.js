fetch("/public/src/example_jobs.json")
  .then((response) => response.json())
  .then((jobs) => {
    console.log("Jobs data:", jobs); // Log the jobs data for debugging

    const jobsContainer = document.getElementById("jobs-container");

    jobs.forEach((job) => {
      // Create the card element
      const card = document.createElement("div");
      card.className = "card";

      // Add job title
      const titleElement = document.createElement("h2");
      titleElement.className = "title";
      titleElement.textContent = job.title;
      card.appendChild(titleElement);

      // Add job description
      const descriptionElement = document.createElement("p");
      descriptionElement.className = "description";
      descriptionElement.textContent = job.description;
      card.appendChild(descriptionElement);

      // Add salary range
      const salaryRangeElement = document.createElement("p");
      salaryRangeElement.className = "salary-range";
      salaryRangeElement.textContent = `Salary: ${job.salary_range}`;
      card.appendChild(salaryRangeElement);

      // Add date posted
      const datePostedElement = document.createElement("p");
      datePostedElement.className = "date-posted";
      datePostedElement.textContent = `Posted: ${new Date(
        job.created_at
      ).toLocaleDateString()}`;
      card.appendChild(datePostedElement);

      // Add expiration date
      const expiresElement = document.createElement("p");
      expiresElement.className = "expires-date";
      expiresElement.textContent = `Expires: ${new Date(
        job.expires_at
      ).toLocaleDateString()}`;
      card.appendChild(expiresElement);

      // Append the card to the container
      jobsContainer.appendChild(card);

      console.log("Appended job card:", card); // Log the appended card for debugging
    });
  })
  .catch((error) => console.error("Error loading jobs:", error));
