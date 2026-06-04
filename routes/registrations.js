const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.get('/', (req, res) => {
    exec('fs_cli -x "sofia xmlstatus profile internal reg"', (err, stdout) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error fetching XML from FreeSWITCH");
        }

        res.setHeader("Content-Type", "application/xml");
        res.send(stdout);
    });
});

module.exports = router;
