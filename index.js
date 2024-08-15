const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const randomUseragent = require("random-useragent");
const { exec } = require("child_process");

// Roles and filters
const roles = [
  "react-developer",
  "javascript-developer",
  "node-developer",
  "mern-stack-developer",
];
const location = "pune";
const freshness = "7"; // Last 7 days

const scrapeJobs = async () => {
  const browser = await puppeteer.launch({
    executablePath: "/path/to/your/chrome",
    headless: false,
    args: ["--disable-notifications"],
  });
  const page = await browser.newPage();

  // Set a desktop viewport size
  await page.setViewport({ width: 1366, height: 768 });

  // Set permissions to deny location access
  const context = browser.defaultBrowserContext();
  await context.overridePermissions("https://www.naukri.com", ["geolocation"]);

  let allJobs = [];

  for (const role of roles) {
    let hasNextPage = true;
    let currentPageNumber = 1;

    // Construct the base URL with location and freshness filters
    const baseUrl = `https://www.naukri.com/${role}-jobs-in-${location}?fjb=${freshness}`;

    try {
      while (hasNextPage) {
        // Rotate User-Agent for every page request
        let userAgent = randomUseragent.getRandom(
          (ua) => ua.deviceType === "desktop"
        );

        // Ensure userAgent is a string
        if (typeof userAgent !== "string") {
          userAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
        }

        await page.setUserAgent(userAgent);
        // Construct URL for current page
        const url =
          currentPageNumber === 1
            ? baseUrl
            : `${baseUrl}&page=${currentPageNumber}`;
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Scroll to bottom to load all jobs
        await autoScroll(page);

        // Wait for job elements to be present
        await page.waitForSelector(".srp-jobtuple-wrapper", { timeout: 10000 });

        const jobs = await page.evaluate(() => {
          const jobElements = document.querySelectorAll(
            ".srp-jobtuple-wrapper"
          );

          return Array.from(jobElements).map((job) => {
            return {
              title:
                job.querySelector(".title")?.innerText.trim() || "No title",
              company:
                job.querySelector(".comp-name")?.innerText.trim() ||
                "No company",
              location:
                job.querySelector(".loc-wrap")?.innerText.trim() ||
                "No location",
              experience:
                job.querySelector(".exp-wrap")?.innerText.trim() ||
                "No experience",
              link: job.querySelector("a.title")?.href || "No link",
            };
          });
        });

        // Filter jobs based on experience (3 years) and location (Pune)
        const filteredJobs = jobs.filter(
          (job) =>
            job.experience.includes("3") &&
            job.location.toLowerCase().includes(location)
        );

        allJobs = [...allJobs, ...filteredJobs];

        console.log(
          `Jobs collected from Page ${currentPageNumber} for ${role}: ${filteredJobs.length}`
        );

        // Introduce random delay to mimic human behavior
        await delay(Math.random() * 3000 + 2000);

        // Scroll to bottom before clicking next button
        await autoScroll(page);

        // Check if there is a "Next" button and click it
        const nextButtonSelector =
          'div[class="styles_pagination-cont__sWhS6"] > div > a:nth-of-type(2)';
        try {
          await page.waitForSelector(nextButtonSelector, { timeout: 60000 });
          const nextButton = await page.$(nextButtonSelector);

          if (nextButton) {
            const box = await nextButton.boundingBox();

            if (box) {
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Adding a small delay

              await page.evaluate((selector) => {
                document.querySelector(selector).click();
              }, nextButtonSelector);

              await page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: 60000,
              });
              await page.waitForSelector(".srp-jobtuple-wrapper", {
                timeout: 60000,
              });
              // Next page increment
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
      }
    } catch (error) {
      console.error(`Error fetching data for ${role}:`, error);
    }
  }

  // Convert job data to Excel format
  const ws = xlsx.utils.json_to_sheet(allJobs);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Jobs");

  // Write to Excel file
  const filePath = "jobs.xlsx";
  xlsx.writeFile(wb, filePath);

  console.log("Excel file generated: jobs.xlsx");

  // Close the browser
  await browser.close();

  // Call sendEmail.js to send the Excel file
  exec("node sendEmail.js", (err, stdout, stderr) => {
    if (err) {
      console.error(`Error executing sendEmail.js: ${err}`);
      return;
    }
    console.log(`Email sent successfully: ${stdout}`);
  });
};

// Function to scroll to the bottom of the page
async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait a bit to ensure the page has finished loading
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    console.error("Error during scrolling:", error);
  }
}

// Function to introduce delay
function delay(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

scrapeJobs();
