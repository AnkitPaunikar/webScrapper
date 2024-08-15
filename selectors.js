const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const randomUseragent = require("random-useragent");

const baseUrl = "https://www.naukri.com/react-developer-jobs";

const scrapeJobs = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-notifications"],
  });
  const page = await browser.newPage();

  // Set a desktop viewport size
  await page.setViewport({ width: 1366, height: 768 });

  // Set permissions to deny location access
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(baseUrl, ["geolocation"]);

  let allJobs = [];
  let hasNextPage = true;
  var currentPageNumber = 1;

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
        currentPageNumber === 1 ? baseUrl : `${baseUrl}-${currentPageNumber}`;
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      // Scroll to bottom to load all jobs
      await autoScroll(page);

      // Wait for job elements to be present
      await page.waitForSelector(".srp-jobtuple-wrapper", { timeout: 10000 });

      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll(".srp-jobtuple-wrapper");

        return Array.from(jobElements).map((job) => {
          return {
            title: job.querySelector(".title")?.innerText.trim() || "No title",
            company:
              job.querySelector(".comp-name")?.innerText.trim() || "No company",
            location:
              job.querySelector(".loc-wrap")?.innerText.trim() || "No location",
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
          job.location.toLowerCase().includes("pune")
      );

      allJobs = [...allJobs, ...filteredJobs];

      console.log(
        `Jobs collected from Page ${currentPageNumber}: ${filteredJobs.length}`
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

    // Convert job data to Excel format
    const ws = xlsx.utils.json_to_sheet(allJobs);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Jobs");

    // Write to Excel file
    xlsx.writeFile(wb, "jobs.xlsx");
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    await browser.close();
  }
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
