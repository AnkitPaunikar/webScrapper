import puppeteer from "puppeteer-core";
import xlsx from "xlsx";
import randomUseragent from "random-useragent";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import pLimit from "p-limit";

const exec = promisify(execCb);

const roles = [
  "react-developer",
  "javascript-developer",
  "node-developer",
  "mern-stack-developer",
];
const location = "pune";
const freshness = "7"; // Last 7 days
const executablePath = process.env.CHROME_EXECUTABLE_PATH;

// Limit concurrency to 5 simultaneous pages
const limit = pLimit(5);

const scrapeJobsForRole = async (role, timeout) => {
  const browser = await puppeteer.launch({
    executablePath: executablePath,
    headless: true,
    args: [
      "--disable-notifications",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-images",
      "--disable-dev-shm-usage",
      "--no-zygote",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions("https://www.naukri.com", ["geolocation"]);

  let allJobs = [];
  let hasNextPage = true;
  let currentPageNumber = 1;
  const baseUrl = `https://www.naukri.com/${role}-jobs-in-${location}?fjb=${freshness}`;

  const startTime = Date.now();

  while (hasNextPage) {
    if (Date.now() - startTime > timeout) {
      console.log("Time limit reached. Stopping scraping.");
      hasNextPage = false;
      break;
    }

    try {
      let userAgent = randomUseragent.getRandom(
        (ua) => ua.deviceType === "desktop"
      );
      if (typeof userAgent !== "string") {
        userAgent =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
      }
      await page.setUserAgent(userAgent);

      const url =
        currentPageNumber === 1
          ? baseUrl
          : `${baseUrl}&page=${currentPageNumber}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      await autoScroll(page);

      await page.waitForSelector(".srp-jobtuple-wrapper", { timeout: 20000 });

      const jobs = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(".srp-jobtuple-wrapper")
        ).map((job) => ({
          title: job.querySelector(".title")?.innerText.trim() || "No title",
          company:
            job.querySelector(".comp-name")?.innerText.trim() || "No company",
          location:
            job.querySelector(".loc-wrap")?.innerText.trim() || "No location",
          experience:
            job.querySelector(".exp-wrap")?.innerText.trim() || "No experience",
          link: job.querySelector("a.title")?.href || "No link",
        }));
      });

      const filteredJobs = jobs.filter((job) => {
        const experience = job.experience.trim().toLowerCase();
        let minExperience = 0;
        let maxExperience = 0;
        if (experience.includes("-")) {
          const parts = experience.split("-");
          minExperience = parseInt(parts[0], 10);
          maxExperience = parseInt(parts[1], 10);
        } else if (experience.includes("year")) {
          minExperience = maxExperience = parseInt(experience, 10);
        }
        const includesThreeYears = minExperience <= 3 && maxExperience >= 3;
        return (
          includesThreeYears && job.location.toLowerCase().includes(location)
        );
      });

      allJobs = [...allJobs, ...filteredJobs];

      await autoScroll(page);

      const nextButtonSelector =
        'div[class="styles_pagination-cont__sWhS6"] > div > a:nth-of-type(2)';
      try {
        await page.waitForSelector(nextButtonSelector, { timeout: 15000 });
        const nextButton = await page.$(nextButtonSelector);

        if (nextButton) {
          const box = await nextButton.boundingBox();
          if (box) {
            await page.evaluate(
              (selector) => document.querySelector(selector).click(),
              nextButtonSelector
            );
            await page.waitForNavigation({
              waitUntil: "domcontentloaded",
              timeout: 15000,
            });
            currentPageNumber += 1;
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      } catch (error) {
        console.error(`Error waiting for selector: ${error}`);
        hasNextPage = false;
      }
    } catch (error) {
      console.error(`Error during scraping: ${error}`);
      hasNextPage = false;
    }
  }

  await browser.close();
  return allJobs;
};

const scrapeAllJobs = async () => {
  const timeLimit = 320 * 60 * 1000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Time limit exceeded")), timeLimit)
  );

  let allJobs = [];
  try {
    const allJobsPromise = Promise.all(
      roles.map((role) => limit(() => scrapeJobsForRole(role, timeLimit)))
    );

    allJobs = await Promise.race([allJobsPromise, timeoutPromise]);

    const flattenedJobs = allJobs.flat();

    const ws = xlsx.utils.json_to_sheet(flattenedJobs);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Jobs");

    const filePath = "jobs.xlsx";
    xlsx.writeFile(wb, filePath);
  } catch (error) {
    if (error.message === "Time limit exceeded") {
      console.log("Time limit exceeded. Returning whatever jobs are scraped.");
    } else {
      console.error("Error during parallel scraping:", error);
    }
  } finally {
    try {
      const { stdout, stderr } = await exec("node sendEmail.js");
      if (stderr) {
        console.error(`Error executing sendEmail.js: ${stderr}`);
      } else {
        console.log(`Email sent successfully: ${stdout}`);
      }
    } catch (err) {
      console.error(`Error executing sendEmail.js: ${err.message}`);
    }
  }
};

async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 250; // Increased distance
        const interval = 70; // Reduced interval
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, interval);
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } catch (error) {
    console.error("Error during scrolling:", error);
  }
}

scrapeAllJobs();
