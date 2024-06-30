const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const environment = require("../config/environment");
const genAI = new GoogleGenerativeAI(environment.geminiKey);
const cheerio = require("cheerio");
const jobQueries = require("../queries/jobQueries");
const axios = require("axios");
const linkFunctions = require("../utils/linkFunctions");

const openai = new OpenAI();

let useGemini = true;
let errorCount = 0;
const MAX_ERRORS = 5;

// Rate limiting settings
const GEMINI_DELAY_MS = 1000; // 1 second delay between Gemini requests
const OPENAI_DELAY_MS = 20000; // 20 seconds delay between OpenAI requests (3 requests per minute)
let lastRequestTime = 0;

async function start() {
  try {
    await checkJobBoardUrls();
  } catch (error) {
    console.error("Error starting job board service:", error);
  }
}

async function processJobLink(model, jobLink) {
  return new Promise(async (resolve) => {
    try {
      // Check if the link has already been processed
      const jobPosting = await jobQueries.getJobPostingByLink(jobLink.link);
      if (jobPosting) {
        console.log(`Job posting already exists for job link: ${jobLink.link}`);
        return resolve();
      }

      console.log("Processing job link:", jobLink.link);
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      };

      const linkResponse = await axios.get(jobLink.link, {
        headers,
        timeout: 5000,
      });
      const { data } = linkResponse;

      const $ = cheerio.load(data);
      $("script, style").remove();
      const textContent = $("body").text().replace(/\s\s+/g, " ").trim();

      let extractedData;
      if (useGemini) {
        try {
          await rateLimit(true);
          extractedData = await useGeminiAPI(model, jobLink, textContent);
        } catch (error) {
          if (error.status === 429) {
            console.log("Switching to ChatGPT API due to rate limiting");
            useGemini = false;
            await rateLimit(false);
            extractedData = await useChatGPTAPI(jobLink, textContent);
          } else {
            throw error;
          }
        }
      } else {
        await rateLimit(false);
        extractedData = await useChatGPTAPI(jobLink, textContent);
      }

      if (extractedData.error) {
        console.log(
          `Skipping job posting due to API error: ${extractedData.error}`
        );
        return resolve();
      }

      // Check if the job title is tech-related
      const techRelatedTitles = [
        "software engineer",
        "data engineer",
        "project manager",
        "developer",
        "programmer",
        "analyst",
        "consultant",
        "data scientist",
        "machine learning engineer",
        "ai specialist",
        "web developer",
        "frontend developer",
        "backend developer",
        "full stack developer",
        "systems engineer",
        "network engineer",
        "security engineer",
        "database administrator",
        "devops engineer",
        "cloud engineer",
        "site reliability engineer",
        "mobile developer",
        "application developer",
        "blockchain developer",
        "cybersecurity analyst",
        "IT support specialist",
        "technical support engineer",
        "quality assurance engineer",
        "test engineer",
        "UX/UI designer",
        "product manager",
        "scrum master",
        "business analyst",
        "solutions architect",
        "data analyst",
        "big data engineer",
        "BI developer",
        "ETL developer",
        "data warehouse engineer",
        "robotics engineer",
        "IoT engineer",
        "embedded systems engineer",
        "game developer",
        "VR/AR developer",
        "data architect",
        "technical writer",
        "hardware engineer",
        "IT consultant",
        "systems administrator",
        "ai",
        "data science",
        "analytics",
        "platform engineer",
        "ml engineer",
        "technical program manager",
      ];
      const jobTitle = extractedData.title.toLowerCase();
      if (!techRelatedTitles.some((title) => jobTitle.includes(title))) {
        console.log(
          `Skipping non-tech job posting with title: ${extractedData.title}`
        );
        return resolve();
      }

      const requiredFields = [
        "title",
        "company_name",
        "location",
        "salary",
        "experience_level",
        "skills",
        "tags",
        "description",
      ];
      const isComplete = requiredFields.every((field) =>
        extractedData.hasOwnProperty(field)
      );

      if (isComplete) {
        try {
          let company = await jobQueries.getCompanyIdByName(
            extractedData.company_name
          );
          if (!company) {
            company = await jobQueries.createCompany(
              extractedData.company_name,
              extractedData.company_logo,
              extractedData.location,
              extractedData.company_description,
              extractedData.company_industry,
              extractedData.company_size,
              extractedData.company_stock_symbol,
              extractedData.company_founded
            );
          }

          await jobQueries.createJobPosting(
            extractedData.title,
            extractedData.salary,
            extractedData.experience_level,
            extractedData.location,
            new Date(),
            company.id,
            jobLink.link,
            null,
            extractedData.tags
              ? extractedData.tags.split(",").map((tag) => tag.trim())
              : [],
            extractedData.description,
            extractedData.salary_max,
            1,
            extractedData.skills
              ? extractedData.skills.split(",").map((skill) => skill.trim())
              : [],
            extractedData.benefits,
            extractedData.additional_information,
            extractedData.PreferredQualifications,
            extractedData.MinimumQualifications,
            extractedData.Responsibilities,
            extractedData.Requirements,
            extractedData.NiceToHave,
            extractedData.Schedule,
            extractedData.HoursPerWeek,
            extractedData.H1BVisaSponsorship,
            extractedData.IsRemote,
            extractedData.EqualOpportunityEmployerInfo,
            extractedData.Relocation
          );

          console.log(
            `Job posting created successfully for job link: ${jobLink.link}`
          );
        } catch (error) {
          console.log(
            `Error creating job posting for job link: ${jobLink.link}`,
            error
          );
          console.log("Extracted data:", extractedData);
        }
      } else {
        console.log(
          `Job posting not created due to missing fields for job link: ${jobLink.link}`
        );
      }
    } catch (error) {
      console.error(`Error processing job link ${jobLink.link}:`, error);
      errorCount++;
      if (errorCount >= MAX_ERRORS) {
        console.error("Max error count reached. Stopping process.");
        process.exit(1);
      }
    }

    setTimeout(resolve, 200);
  });
}

async function useGeminiAPI(model, jobLink, textContent) {
  const prompt = `
    Please extract the following information from this job posting data: ${textContent}
    - title (e.g., Software Engineer, Data Analyst, do not include intern or seniority in the title)
    - company_name NVARCHAR(50) (as simple as possible and you can tell the company name from the job posting link: ${jobLink.link})
    - company_description NVARCHAR(MAX)(write a short paragraph about the company, where they're located, their mission, etc)
    - company_industry (e.g., Technology, Healthcare, Finance, etc.)
    - company_size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
    - company_stock_symbol (if public, otherwise leave blank)
    - company_logo (in the format of /src/<company-name>logo.png do not include space in the company logo)
    - company_founded (year founded, if available, otherwise leave blank, format in SQL datetime format)
    - location (City, State(full name), Country(full name), if remote N/A)
    - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
    - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
    - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior", "Lead" or "Manager" only)
    - skills (6-10 skills, prefer single word skills, as a comma-separated list)
    - tags (at least 10, these should be different from skills and are things commonly searched related to the job. e.g., "remote", "healthcare", "startup" as a comma-separated list)
    - description (try to take up to 3 paragraphs from the original source)
    - benefits (as a comma-separated list) 
    - additional_information (blank if nothing detected in the job posting, otherwise provide any additional information that you think is relevant to the job posting)
    - PreferredQualifications (if available)
    - MinimumQualifications (if available)
    - Responsibilities (responsibilities of the job)
    - Requirements (requirements of the job)
    - NiceToHave (nice to have skills or experience)
    - Schedule (mon-fri, 9-5, etc.)
    - HoursPerWeek (integer only)
    - H1BVisaSponsorship BIT
    - IsRemote BIT
    - EqualOpportunityEmployerInfo NVARCHAR(MAX)
    - Relocation BIT
    Provide the extracted information in JSON format.
  `;
  const result = await model.generateContent(prompt);
  let response = await result.response;
  response = response.text();
  const cleanedResponse =
    response.replace(/`+/g, "").match(/\{.*\}/s)?.[0] || "";
  return JSON.parse(cleanedResponse);
}

async function useChatGPTAPI(jobLink, textContent) {
  const prompt = `
    Please extract the following information from this job posting data: ${textContent}
    - title (e.g., Software Engineer, Data Analyst, do not include intern or seniority in the title)
    - company_name NVARCHAR(50) (as simple as possible and you can tell the company name from the job posting link: ${jobLink.link})
    - company_description NVARCHAR(MAX)(write a short paragraph about the company, where they're located, their mission, etc)
    - company_industry (e.g., Technology, Healthcare, Finance, etc.)
    - company_size (e.g., 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+)
    - company_stock_symbol (if public, otherwise leave blank)
    - company_logo (in the format of /src/<company-name>logo.png do not include space in the company logo)
    - company_founded (year founded, if available, otherwise leave blank, format in SQL datetime format)
    - location (City, State(full name), Country(full name), if remote N/A)
    - salary (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
    - salary_max (integer only, no currency symbol, no matter what format the salary in (hourly, monthly, weekly) convert to yearly salary)
    - experience_level ("Internship", "Entry Level", "Junior", "Mid Level", "Senior", "Lead" or "Manager" only)
    - skills (6-10 skills, prefer single word skills, as a comma-separated list)
    - tags (at least 10, these should be different from skills and are things commonly searched related to the job. e.g., "remote", "healthcare", "startup" as a comma-separated list)
    - description (try to take up to 3 paragraphs from the original source)
    - benefits (as a comma-separated list) 
    - additional_information (blank if nothing detected in the job posting, otherwise provide any additional information that you think is relevant to the job posting)
    - PreferredQualifications (if available)
    - MinimumQualifications (if available)
    - Responsibilities (responsibilities of the job)
    - Requirements (requirements of the job)
    - NiceToHave (nice to have skills or experience)
    - Schedule (mon-fri, 9-5, etc.)
    - HoursPerWeek (integer only)
    - H1BVisaSponsorship BIT
    - IsRemote BIT
    - EqualOpportunityEmployerInfo NVARCHAR(MAX)
    - Relocation BIT
    Provide the extracted information in JSON format.
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that extracts job information from text.",
        },
        { role: "user", content: prompt },
      ],
      model: "gpt-3.5-turbo-0125", // This should be available for most users
    });

    const responseContent = completion.choices[0].message.content;
    const cleanedResponse = responseContent.match(/\{.*\}/s)?.[0] || "";
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    console.error("Error details:", error.error);
    console.error("Request ID:", error.request_id);

    if (error.status === 403) {
      console.error(
        "Permission denied. Please check your OpenAI API key and ensure you have access to the specified model."
      );
    }

    // Throw the error to be caught by the calling function
    throw error;
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit(isGemini) {
  const now = Date.now();
  const delayMs = isGemini ? GEMINI_DELAY_MS : OPENAI_DELAY_MS;
  const elapsed = now - lastRequestTime;

  if (elapsed < delayMs) {
    await delay(delayMs - elapsed);
  }

  lastRequestTime = Date.now();
}

async function checkJobBoardUrls() {
  try {
    const companies = await jobQueries.getCompanies();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    for (const company of companies) {
      if (company.job_board_url) {
        let jobLinks = [company.job_board_url];

        if (company.job_board_url.includes("greenhouse.io")) {
          jobLinks = await linkFunctions.scrapeGreenhouseJobs(
            company.job_board_url
          );
        } else if (company.job_board_url.includes("lever.co")) {
          jobLinks = await linkFunctions.scrapeLeverJobs(company.job_board_url);
        }

        for (const jobLink of jobLinks) {
          await processJobLink(model, { link: jobLink.link });
          await delay(1000); // Add a 1-second delay between processing each job link
        }
      }
    }

    console.log("Job board URLs processed successfully");
  } catch (error) {
    console.error("Error processing job board URLs:", error);
  }
}

module.exports = {
  start,
};
