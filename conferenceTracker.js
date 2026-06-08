const db = require("./db");

let previousMembers = {};

function updateConferenceState(participants) {
  const current = {};

  participants.forEach(p => {
    const key = `${p.conferenceName}_${p.memberId}`;
    current[key] = p;

    if (!previousMembers[key]) {
      db.recordJoin(p.conferenceName, p.memberId, p.user)
        .catch(err => console.error('[tracker] Failed to record join for', key, err.message));
      console.log("JOIN", key);
    }
  });

  Object.keys(previousMembers).forEach(key => {
    if (!current[key]) {
      const old = previousMembers[key];
      db.recordLeave(old.conferenceName, old.memberId)
        .catch(err => console.error('[tracker] Failed to record leave for', key, err.message));
      console.log("LEAVE", key);
    }
  });

  previousMembers = current;
}

module.exports = { updateConferenceState };
