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

// ── Shared bgapi helpers ──────────────────────────────────────

/**
 * Send a bgapi command and resolve with the raw body string.
 * Rejects when no body is returned.
 */
function bgapiRaw(cmd) {
  return new Promise((resolve, reject) => {
    fsConn.bgapi(cmd, (res) => {
      const body = res && res.getBody ? res.getBody() : null;
      if (body) resolve(body);
      else reject(new Error(`bgapi '${cmd}' returned no body`));
    });
  });
}

/**
 * Send a bgapi command and resolve only when FreeSWITCH replies '+OK'.
 * Rejects with the body text otherwise.
 */
function bgapiOk(cmd) {
  return new Promise((resolve, reject) => {
    fsConn.bgapi(cmd, (res) => {
      const body = (res && res.getBody ? res.getBody() : '') || '';
      if (body.startsWith('+OK')) resolve(body);
      else reject(new Error(body || `bgapi '${cmd}' failed`));
    });
  });
}

/**
 * Send a bgapi command and return a JSON-ready response object
 * suitable for Express route handlers in conferenceAdvanced.js.
 */
function bgapiResponse(cmd) {
  return new Promise((resolve) => {
    fsConn.bgapi(cmd, (reply) => {
      const body = reply.getBody();
      resolve({ success: body.startsWith('+OK'), response: body });
    });
  });
}

// ── Conference commands (built on shared helpers) ─────────────

function listConferences()                       { return bgapiRaw('conference list'); }
function createConference(name, extension)       { return bgapiRaw(`conference ${name} dial ${extension}`); }
function kickParticipant(name, id)               { return bgapiOk(`conference ${name} kick ${id}`); }
function muteParticipant(name, id)               { return bgapiOk(`conference ${name} mute ${id}`); }
function unmuteParticipant(name, id)             { return bgapiOk(`conference ${name} unmute ${id}`); }
function muteAllParticipants(name)               { return bgapiOk(`conference ${name} mute all`); }
function unmuteAllParticipants(name)             { return bgapiOk(`conference ${name} unmute all`); }
function terminateConference(name)               { return bgapiOk(`conference ${name} hup all`); }

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
async function getConferenceStats() {
  const body = await bgapiRaw('conference list');
  const lines = body.split('\n').filter(l => l.trim());
  const stats = [];

  lines.forEach(line => {
    const match = line.match(/Conference\s+(\S+).*?\((\d+)\s+members?\)/i);
    if (match) {
      stats.push({ name: match[1], members: parseInt(match[2], 10) });
    }
  });

  return stats;
}

module.exports = {
  fsConn,
  bgapiRaw,
  bgapiOk,
  bgapiResponse,
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
