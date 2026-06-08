const express = require('express');
const router = express.Router();
//const fsConn = require('../freeswitch/esl');
const xml = require('../freeswitch/xml');
const { fsConn } = require('../freeswitch/esl');  // destructure the connection

// Add User (POST — credentials must not appear in URL/logs)
router.post('/add', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    try {
        xml.addUser(username, password);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    // Reload FreeSWITCH configs via ESL
    fsConn.bgapi("reloadxml", (reply) => {
        const body = reply && reply.getBody ? reply.getBody() : '';
        console.log("Reload XML response:", body);

        if (body.includes("OK")) {
            res.json({ success: true, message: `User ${username} created` });
        } else {
            res.status(500).json({ error: `User added to XML, but reloadxml failed: ${body}` });
        }
    });
});

// Delete User (POST — state-changing operation)
router.post('/delete', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Missing username' });
    }

    let ok;
    try {
        ok = xml.deleteUser(username);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
    if (!ok) return res.status(404).json({ error: 'User not found' });

    fsConn.bgapi("reloadxml", (reply) => {
        res.json({ success: true, message: `User ${username} deleted` });
    });
});
// List Users
router.get('/list', (req, res) => {
//    console.log("Listing users...");
    const users = xml.listUsers();
    console.log(users);
    res.json(users);
});

module.exports = router;
