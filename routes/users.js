const express = require('express');
const router = express.Router();
//const fsConn = require('../freeswitch/esl');
const xml = require('../freeswitch/xml');
const { fsConn } = require('../freeswitch/esl');  // destructure the connection

// Add User
router.get('/add', (req, res) => {
    const { username, password } = req.query;
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    try {
        xml.addUser(username, password);
    } catch (err) {
        console.error('[users] addUser failed:', err.message);
        return res.status(500).json({ error: err.message });
    }

    // Reload FreeSWITCH configs via ESL
    fsConn.bgapi("reloadxml", (reply) => {
        const body = reply && reply.getBody ? reply.getBody() : '';
        console.log("Reload XML response:", body);

        if (body.includes("OK")) {
            res.json({ success: true, message: `User ${username} created` });
        } else {
            res.status(500).json({ error: `User ${username} added to XML, but reloadxml failed: ${body}` });
        }
    });
});
// Delete User
router.get('/delete', (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });

    try {
        const ok = xml.deleteUser(username);
        if (!ok) return res.status(404).json({ error: 'User not found' });
    } catch (err) {
        console.error('[users] deleteUser failed:', err.message);
        return res.status(500).json({ error: err.message });
    }

    fsConn.api("reloadxml", (reply) => {
        const body = reply && reply.getBody ? reply.getBody() : '';
        if (body.includes('OK')) {
            res.json({ success: true, message: `User ${username} deleted` });
        } else {
            res.status(500).json({ error: `User ${username} removed from XML, but reloadxml failed: ${body}` });
        }
    });
});
// List Users
router.get('/list', (req, res) => {
    try {
        const users = xml.listUsers();
        res.json(users);
    } catch (err) {
        console.error('[users] listUsers failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
