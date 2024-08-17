import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use app-specific password
  },
});

const mailOptions = {
  from: process.env.EMAIL_USER,
  to: process.env.RECIPIENT_EMAIL,
  subject: "Job Data Report",
  text: "Attached is the job data report.",
  attachments: [
    {
      filename: "jobs.xlsx",
      path: "./jobs.xlsx",
    },
  ],
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error(`Error sending email: ${error}`);
  } else {
    console.log(`Email sent: ${info.response}`);
  }
});
