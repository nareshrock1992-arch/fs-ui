const express = require('express');
const router = express.Router();

const { fsConn, validateConferenceName, validateMemberId } = require('../freeswitch/esl');

const SAFE_VOLUME = /^-?\d{1,3}$/;

router.post('/volume', (req, res) => {

    const { conferenceName, memberId, level } = req.body;

    try {
        validateConferenceName(conferenceName);
        validateMemberId(memberId);
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    if (!level || !SAFE_VOLUME.test(String(level))) {
        return res.status(400).json({ success: false, error: 'Invalid volume level' });
    }

    const cmd = `conference ${conferenceName} volume_in ${memberId} ${level}`;

    fsConn.bgapi(cmd, (reply) => {

        const body = reply.getBody();

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

router.post('/lock', (req, res) => {

    const { conferenceName } = req.body;

    try {
        validateConferenceName(conferenceName);
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }

    const cmd = `conference ${conferenceName} lock`;

    fsConn.bgapi(cmd, (reply) => {

        const body = reply.getBody();

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

router.post('/unlock', (req, res) => {

    const { conferenceName } = req.body;

    try {
        validateConferenceName(conferenceName);
    } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }

    const cmd = `conference ${conferenceName} unlock`;

console.log("Executing:",cmd);
  
  fsConn.bgapi(cmd, (reply) => {

        const body = reply.getBody();

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

module.exports = router;
