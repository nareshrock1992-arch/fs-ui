const esl = require('modesl');

// Create ESL connection — credentials from environment
const ESL_HOST = process.env.ESL_HOST || '127.0.0.1';
const ESL_PORT = parseInt(process.env.ESL_PORT) || 8021;
const ESL_PASSWORD = process.env.ESL_PASSWORD;
if (!ESL_PASSWORD) {
  console.error('[esl] FATAL: ESL_PASSWORD environment variable is required');
  process.exit(1);
}

const fsConn = new esl.Connection(ESL_HOST, ESL_PORT, ESL_PASSWORD, () => {
  console.log("Connected to FreeSWITCH ESL");
});

// Subscribe to conference maintenance events
fsConn.subscribe('conference::maintenance');

// Listen for talking/not-talking events
fsConn.on('esl::event::conference::maintenance::*', (event) => {
  const memberId = event.getHeader('Member-ID');
  const talking = event.getHeader('Talking'); // "true" or "false"

  console.log(`Member ${memberId} talking: ${talking}`);

  if (!global.talkingMap) global.talkingMap = {};
  global.talkingMap[memberId] = (talking === 'true');
});

// Input validation — prevent command injection in bgapi strings
const SAFE_CONF_NAME = /^[a-zA-Z0-9_.\-@]{1,128}$/;
const SAFE_MEMBER_ID = /^[a-zA-Z0-9_.\-]{1,64}$/;
const SAFE_EXTENSION = /^[a-zA-Z0-9_.\-@+*#]{1,64}$/;

function validateConferenceName(name) {
  if (!name || !SAFE_CONF_NAME.test(String(name))) {
    throw new Error('Invalid conference name');
  }
  return String(name);
}

function validateMemberId(id) {
  if (!id || !SAFE_MEMBER_ID.test(String(id))) {
    throw new Error('Invalid member ID');
  }
  return String(id);
}

function validateExtension(ext) {
  if (!ext || !SAFE_EXTENSION.test(String(ext))) {
    throw new Error('Invalid extension');
  }
  return String(ext);
}

// List all active conferences
function listConferences() {
  return new Promise((resolve, reject) => {
    fsConn.bgapi('conference list', (res) => {
      if (res && res.getBody()) {
        resolve(res.getBody());
      } else {
        reject(new Error('No conferences found'));
      }
    });
  });
}

// Create a new conference
function createConference(name, extension) {
  name = validateConferenceName(name);
  extension = validateExtension(extension);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${name} dial ${extension}`, (res) => {
      if (res && res.getBody()) {
        resolve(res.getBody());
      } else {
        reject(new Error('Failed to create conference'));
      }
    });
  });
}

// Kick a participant
function kickParticipant(conferenceName, memberId) {
  conferenceName = validateConferenceName(conferenceName);
  memberId = validateMemberId(memberId);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} kick ${memberId}`, (res) => {
      const body = res.getBody();
      if (body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body));
      }
    });
  });
}

// Mute a participant
function muteParticipant(conferenceName, memberId) {
  conferenceName = validateConferenceName(conferenceName);
  memberId = validateMemberId(memberId);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} mute ${memberId}`, (res) => {
      const body = res.getBody();
      if (body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body));
      }
    });
  });
}

// Unmute a participant
function unmuteParticipant(conferenceName, memberId) {
  conferenceName = validateConferenceName(conferenceName);
  memberId = validateMemberId(memberId);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} unmute ${memberId}`, (res) => {
      const body = res.getBody();
      if (body && body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body || 'Unmute failed'));
      }
    });
  });
}

// Mute all participants
function muteAllParticipants(conferenceName) {
  conferenceName = validateConferenceName(conferenceName);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} mute all`, (res) => {
      const body = res.getBody();
      if (body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body));
      }
    });
  });
}

// Unmute all participants
function unmuteAllParticipants(conferenceName) {
  conferenceName = validateConferenceName(conferenceName);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} unmute all`, (res) => {
      const body = res.getBody();
      if (body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body));
      }
    });
  });
}

// Terminate conference
function terminateConference(conferenceName) {
  conferenceName = validateConferenceName(conferenceName);
  return new Promise((resolve, reject) => {
    fsConn.bgapi(`conference ${conferenceName} hup all`, (res) => {
      const body = res.getBody();
      if (body.startsWith('+OK')) {
        resolve(body);
      } else {
        reject(new Error(body));
      }
    });
  });
}

// Parse conference list
/*
function parseConferenceList(rawOutput) {
  const lines = rawOutput.split('\n').filter(l => l.trim());
  let currentConference = null;
  const participants = [];

  lines.forEach(line => {
    if (line.startsWith('+OK Conference')) {
      const match = line.match(/Conference\s+(\S+)/);
      if (match) currentConference = match[1];
    } else {
      const parts = line.split(';');
      if (parts.length >= 6) {
        const flags = parts[5].split('|');
        participants.push({
          conferenceName: currentConference,
          memberId: parts[0],
          user: parts[3],
          flags,
          isTalking: flags.includes("talking") ||
                     (global.talkingMap && global.talkingMap[parts[0]] === true)
        });
      }
    }
  });

  return participants;
}

*/

function parseConferenceList(rawOutput) {

  const lines = rawOutput.split('\n').filter(l => l.trim());

  let currentConference = null;

  let conferenceLocked = false;

  const participants = [];

  lines.forEach(line => {

    if (line.startsWith('+OK Conference')) {

      const match = line.match(
        /Conference\s+(.+?)\s+\(.*?flags:\s*(.*?)\)/i
      );

      if (match) {

        currentConference = match[1];

        const confFlags = match[2] || "";

        conferenceLocked =
          confFlags.includes("locked");

      }

      return;
    }

    const parts = line.split(';');

    if (parts.length >= 6) {

      const flags =
        (parts[5] || "").split('|');

      participants.push({

        conferenceName: currentConference,

        memberId: parts[0],

        user: parts[3],

        flags,

        locked: conferenceLocked,

        isTalking:
          flags.includes("talking") ||
          (
            global.talkingMap &&
            global.talkingMap[parts[0]] === true
          )

      });

    }

  });

  return participants;

}

// Monitor conferences
function getConferenceStats() {
  return new Promise((resolve, reject) => {
    fsConn.bgapi('conference list', (res) => {
      const body = res.getBody();
      if (!body) return reject(new Error('No conferences found'));

      const lines = body.split('\n').filter(l => l.trim());
      const stats = [];

      lines.forEach(line => {
        const match = line.match(/Conference\s+(\S+).*?\((\d+)\s+members?\)/i);
        if (match) {
          stats.push({
            name: match[1],
            members: parseInt(match[2], 10)
          });
        }
      });

      resolve(stats);
    });
  });
}

module.exports = {
  fsConn,
  listConferences,
  createConference,
  kickParticipant,
  muteParticipant,
  unmuteParticipant,
  muteAllParticipants,
  unmuteAllParticipants,
  terminateConference,
  parseConferenceList,
  getConferenceStats,
  validateConferenceName,
  validateMemberId
};
