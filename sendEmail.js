const nodemailer = require("nodemailer");
const path = require("path");

async function sendEmail() {
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
}

sendEmail().catch(console.error);
