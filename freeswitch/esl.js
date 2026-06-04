const esl = require('modesl');

// Create ESL connection
const fsConn = new esl.Connection("127.0.0.1", 8021, "ClueCon", () => {
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
  getConferenceStats
};
