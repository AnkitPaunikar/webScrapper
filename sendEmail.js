import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service here
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

const mailOptions = {
  from: process.env.EMAIL_USER, // Sender address
  to: process.env.EMAIL_USER, // Send to yourself
  subject: "Job Data Report", // Subject line
  text: "Attached is the job data report.", // Plain text body
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
