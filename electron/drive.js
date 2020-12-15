const {google} = require('googleapis');
const credentials = require('./google.json');

//console.log(credentials)
const scopes = [
  'https://www.googleapis.com/auth/drive.readonly'
];

const auth = new google.auth.JWT(
  credentials.client_email, null,
  credentials.private_key, scopes
);

module.exports = google.drive({version: 'v3', auth})