import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

// Helper to get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sendEmail() {
  try {
    let transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let info = await transporter.sendMail({
      from: '"Job Scraper" <your-email@gmail.com>',
      to: process.env.RECIPIENT_EMAIL,
      subject: "Daily Job Updates",
      text: "Please find the attached Excel file with the latest job updates.",
      attachments: [
        {
          filename: "jobs.xlsx",
          path: path.join(__dirname, "jobs.xlsx"), // Adjust the path if necessary
        },
      ],
    });

    console.log("Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

sendEmail();
