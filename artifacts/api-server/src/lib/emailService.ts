import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendAttendanceEmail({
  adminEmail,
  employeeName,
  type,
  time,
  date,
}: {
  adminEmail: string;
  employeeName: string;
  type: "check_in" | "check_out";
  time: string;
  date: string;
}) {
  const subject = type === "check_in"
    ? `✅ ${employeeName} Checked In`
    : `🔴 ${employeeName} Checked Out`;

  const message = type === "check_in"
    ? `${employeeName} has checked in at ${time} on ${date}.`
    : `${employeeName} has checked out at ${time} on ${date}.`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: adminEmail,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
        <h2 style="color: ${type === "check_in" ? "#16A34A" : "#DC2626"}">
          ${subject}
        </h2>
        <p style="font-size: 16px;">${message}</p>
        <hr/>
        <p style="color: #6B7280; font-size: 12px;">StaffFlow HR Management</p>
      </div>
    `,
  });
}