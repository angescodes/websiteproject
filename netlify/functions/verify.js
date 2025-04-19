const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = 'your_spreadsheet_id_here';
const ADMIN_EMAIL = 'you@example.com';

const CREDENTIALS_PATH = path.join(__dirname, 'service_account.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: 'your_sendgrid_api_key_here'
  }
});

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 400, body: 'Invalid or missing token.' };
  }

  try {
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await jwtClient.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:C'
    });

    const rows = sheetData.data.values || [];
    const updatedRows = rows.map(row => {
      if (row[1] === token) {
        row[2] = 'verified';
      }
      return row;
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: updatedRows
      }
    });

    const verifiedRow = updatedRows.find(r => r[1] === token);
    const verifiedEmail = verifiedRow ? verifiedRow[0] : null;

    if (verifiedEmail) {
      await transporter.sendMail({
        to: ADMIN_EMAIL,
        from: 'no-reply@yourdomain.com',
        subject: 'New verified subscriber',
        text: `✅ ${verifiedEmail} has just verified their email.`
      });
    }

    return {
      statusCode: 200,
      body: 'Your email has been verified successfully!'
    };
  } catch (err) {
    return { statusCode: 500, body: 'Error verifying token: ' + err.message };
  }
};
