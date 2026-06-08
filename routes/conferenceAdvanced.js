const express = require('express');
const router = express.Router();

const { fsConn } = require('../freeswitch/esl');

router.post('/volume', (req, res) => {

    const { conferenceName, memberId, level } = req.body;
    if (!conferenceName || !memberId || level == null) {
        return res.status(400).json({ success: false, error: 'Missing conferenceName, memberId, or level' });
    }

    const cmd = `conference ${conferenceName} volume_in ${memberId} ${level}`;

    fsConn.bgapi(cmd, (reply) => {

        const body = reply && reply.getBody ? reply.getBody() : '';

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

router.post('/lock', (req, res) => {

    const { conferenceName } = req.body;
    if (!conferenceName) {
        return res.status(400).json({ success: false, error: 'Missing conferenceName' });
    }

    const cmd = `conference ${conferenceName} lock`;

    fsConn.bgapi(cmd, (reply) => {

        const body = reply && reply.getBody ? reply.getBody() : '';

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

router.post('/unlock', (req, res) => {

    const { conferenceName } = req.body;
    if (!conferenceName) {
        return res.status(400).json({ success: false, error: 'Missing conferenceName' });
    }

    const cmd = `conference ${conferenceName} unlock`;

    fsConn.bgapi(cmd, (reply) => {

        const body = reply && reply.getBody ? reply.getBody() : '';

        res.json({
            success: body.startsWith('+OK'),
            response: body
        });

    });

});

module.exports = router;
