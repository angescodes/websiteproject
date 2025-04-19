const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = 'your_spreadsheet_id_here';
const ADMIN_EMAIL = 'you@example.com';
const BASE_URL = 'https://your-site.netlify.app';

const CREDENTIALS_PATH = path.join(__dirname, 'service_account.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

// Email transporter using SendGrid
const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: 'your_sendgrid_api_key_here'
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email } = JSON.parse(event.body || '{}');
  if (!email) {
    return { statusCode: 400, body: 'Email is required' };
  }

  const token = crypto.randomBytes(20).toString('hex');

  try {
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:C',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[email, token, 'pending']]
      }
    });

    const verificationLink = `${BASE_URL}/.netlify/functions/verify?token=${token}`;

    await transporter.sendMail({
      to: email,
      from: 'no-reply@yourdomain.com',
      subject: 'Please verify your email',
      html: `Click <a href="${verificationLink}">here</a> to verify your email address.`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Verification email sent!' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
