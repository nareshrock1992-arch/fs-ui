const express = require('express');
const router = express.Router();
const { bgapiResponse } = require('../freeswitch/esl');

router.post('/volume', async (req, res) => {
  const { conferenceName, memberId, level } = req.body;
  res.json(await bgapiResponse(`conference ${conferenceName} volume_in ${memberId} ${level}`));
});

router.post('/lock', async (req, res) => {
  const { conferenceName } = req.body;
  res.json(await bgapiResponse(`conference ${conferenceName} lock`));
});

router.post('/unlock', async (req, res) => {
  const { conferenceName } = req.body;
  res.json(await bgapiResponse(`conference ${conferenceName} unlock`));
});

module.exports = router;
