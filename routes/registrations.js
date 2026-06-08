const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.get('/', (req, res) => {
    exec('fs_cli -x "sofia xmlstatus profile internal reg"', (err, stdout, stderr) => {
        if (err) {
            console.error('[registrations] exec error:', err.message);
            if (stderr) console.error('[registrations] stderr:', stderr);
            return res.status(500).json({ error: 'Error fetching XML from FreeSWITCH', detail: err.message });
        }

        res.setHeader("Content-Type", "application/xml");
        res.send(stdout);
    });
});

module.exports = router;
