const express = require('express');
const router = express.Router();

const { fsConn } = require('../freeswitch/esl');

router.post('/volume', (req, res) => {

    const { conferenceName, memberId, level } = req.body;

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
