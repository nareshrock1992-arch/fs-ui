/**
 * Unit tests for conferenceTracker.js – updateConferenceState
 *
 * This module tracks state diffs (joins/leaves) by comparing successive
 * participant snapshots and calling db.run for persistence.
 */

jest.mock('../db', () => ({
  run: jest.fn(),
}));

const db = require('../db');
const { updateConferenceState } = require('../conferenceTracker');

describe('updateConferenceState', () => {
  beforeEach(() => {
    db.run.mockClear();
    // Reset internal previousMembers state by calling with empty array
    updateConferenceState([]);
    db.run.mockClear();
  });

  it('should detect a new participant join', () => {
    const participants = [
      { conferenceName: 'room1', memberId: '1', user: '1000' },
    ];

    updateConferenceState(participants);

    // Should have called INSERT for the join
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conference_history'),
      ['room1', '1', '1000']
    );
  });

  it('should detect a participant leave', () => {
    // First call: participant present
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
    ]);
    db.run.mockClear();

    // Second call: participant gone
    updateConferenceState([]);

    // Should have called UPDATE for the leave
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conference_history'),
      ['room1', '1']
    );
  });

  it('should not re-insert an already present participant', () => {
    const participants = [
      { conferenceName: 'room1', memberId: '1', user: '1000' },
    ];

    updateConferenceState(participants);
    db.run.mockClear();

    // Same participant again — no new INSERT
    updateConferenceState(participants);
    expect(db.run).not.toHaveBeenCalled();
  });

  it('should handle multiple simultaneous joins', () => {
    const participants = [
      { conferenceName: 'room1', memberId: '1', user: '1000' },
      { conferenceName: 'room1', memberId: '2', user: '1001' },
      { conferenceName: 'room2', memberId: '3', user: '2000' },
    ];

    updateConferenceState(participants);
    expect(db.run).toHaveBeenCalledTimes(3);
  });

  it('should handle multiple simultaneous leaves', () => {
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
      { conferenceName: 'room1', memberId: '2', user: '1001' },
    ]);
    db.run.mockClear();

    // All leave
    updateConferenceState([]);
    expect(db.run).toHaveBeenCalledTimes(2);
  });

  it('should handle mixed joins and leaves', () => {
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
      { conferenceName: 'room1', memberId: '2', user: '1001' },
    ]);
    db.run.mockClear();

    // Member 2 leaves, member 3 joins
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
      { conferenceName: 'room1', memberId: '3', user: '1002' },
    ]);

    // One INSERT (member 3) + one UPDATE (member 2 left)
    expect(db.run).toHaveBeenCalledTimes(2);
    const calls = db.run.mock.calls;
    const insertCall = calls.find(c => c[0].includes('INSERT'));
    const updateCall = calls.find(c => c[0].includes('UPDATE'));
    expect(insertCall[1]).toEqual(['room1', '3', '1002']);
    expect(updateCall[1]).toEqual(['room1', '2']);
  });

  it('should track participants across different conferences independently', () => {
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
      { conferenceName: 'room2', memberId: '1', user: '2000' },
    ]);
    db.run.mockClear();

    // Only room2 member 1 leaves
    updateConferenceState([
      { conferenceName: 'room1', memberId: '1', user: '1000' },
    ]);

    expect(db.run).toHaveBeenCalledTimes(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      ['room2', '1']
    );
  });
});
