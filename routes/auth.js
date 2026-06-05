const express=require('express');

const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const USERS_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(USERS_DIR, 'users.json');

function ensureUsersFile() {
	if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
	if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

function loadUsersSync() {
	ensureUsersFile();
	try {
		return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
	} catch (e) {
		return [];
	}
}

function writeUsersSync(users) {
	ensureUsersFile();
	const tmp = USERS_FILE + '.tmp';
	fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { encoding: 'utf8' });
	fs.renameSync(tmp, USERS_FILE);
}

router.post('/login',async(req,res)=>{

const {username,password}=req.body;

const users = loadUsersSync();

const user = users.find(u => u.username === username);

if(!user){

return res.status(401)
.json({
success:false
});

}

const ok=
await bcrypt.compare(
password,
user.password
);

if(!ok){

return res.status(401)
.json({
success:false
});

}

// store minimal session info
req.session.user = username;
req.session.isAdmin = !!user.isAdmin;

// Save session before responding
req.session.save(err => {
  if (err) {
    return res.status(500).json({ success: false, error: 'Session error' });
  }
  res.json({ success: true, isAdmin: !!user.isAdmin, redirect: '/' });
});

});


// Register new user (protected)
// Authorization: either an admin session (req.session.isAdmin) or a matching ADMIN_TOKEN env var
router.post('/register', async (req, res) => {
	const { username, password, isAdmin } = req.body;

	// Basic validation
	if (!username || !password) return res.status(400).json({ success: false, error: 'Missing username or password' });
	if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) return res.status(400).json({ success: false, error: 'Invalid username' });
	if (password.length < 6) return res.status(400).json({ success: false, error: 'Password too short' });

	// Authorization check
	const adminToken = process.env.ADMIN_TOKEN;
	const headerToken = (req.get('x-admin-token') || '').trim();
	const allowed = (req.session && req.session.isAdmin) || (adminToken && headerToken && headerToken === adminToken);
	if (!allowed) return res.status(403).json({ success: false, error: 'Forbidden' });

	const users = loadUsersSync();
	if (users.find(u => u.username === username)) return res.status(409).json({ success: false, error: 'User exists' });

	const hash = await bcrypt.hash(password, 10);
	const newUser = { username, password: hash, isAdmin: !!isAdmin };
	users.push(newUser);
	try {
		writeUsersSync(users);
		res.json({ success: true });
	} catch (err) {
		console.error('Failed to write users.json', err);
		res.status(500).json({ success: false, error: 'Server error' });
	}
});

router.post('/logout',(req,res)=>{

req.session.destroy(()=>{

res.json({

success:true

});

});

});

// Get list of admin users
router.get('/users', async (req, res) => {
	const users = loadUsersSync();
	// Return only username and isAdmin (don't expose password hashes)
	const safeUsers = users.map(u => ({ username: u.username, isAdmin: u.isAdmin }));
	res.json(safeUsers);
});

module.exports=router;
