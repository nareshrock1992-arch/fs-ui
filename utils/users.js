/**
 * utils/users.js  —  Shared users.json file I/O
 *
 * Centralises path constants, file-existence checks, and
 * read / write helpers that were duplicated in server.js
 * and routes/auth.js.
 */

const fs   = require('fs');
const path = require('path');

const USERS_DIR  = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(USERS_DIR, 'users.json');

function ensureUsersFile() {
  if (!fs.existsSync(USERS_DIR))  fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

function loadUsersSync() {
  ensureUsersFile();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeUsersSync(users) {
  ensureUsersFile();
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { encoding: 'utf8' });
  fs.renameSync(tmp, USERS_FILE);
}

module.exports = { USERS_DIR, USERS_FILE, ensureUsersFile, loadUsersSync, writeUsersSync };
