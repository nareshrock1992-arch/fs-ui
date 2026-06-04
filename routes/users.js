const express = require('express');
const router = express.Router();
//const fsConn = require('../freeswitch/esl');
const xml = require('../freeswitch/xml');
const { fsConn } = require('../freeswitch/esl');  // destructure the connection

// Add User
router.get('/add', (req, res) => {
    const { username, password } = req.query;
    if (!username || !password) return res.send("Missing values");

    // Write the XML file for the new user
    xml.addUser(username, password);

    // Reload FreeSWITCH configs via ESL
    fsConn.bgapi("reloadxml", (reply) => {
        const body = reply && reply.getBody ? reply.getBody() : '';
        console.log("Reload XML response:", body);

        if (body.includes("OK")) {
            res.send(`User ${username} created`);
        } else {
            res.status(500).send(`User ${username} added to XML, but reloadxml failed: ${body}`);
        }
    });
});
// Delete User
router.get('/delete', (req, res) => {
    const { username } = req.query;
    if (!username) return res.send("Missing username");

    const ok = xml.deleteUser(username);
    if (!ok) return res.send("User not found");

    fsConn.api("reloadxml", () => {
        res.send(`User ${username} deleted`);
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
