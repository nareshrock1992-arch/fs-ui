/**
 * Unit tests for db.js
 *
 * Since db.js relies on PostgreSQL, we mock the 'pg' Pool entirely and test
 * the logic of each exported function (query construction, parameter passing,
 * result handling).
 */

const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    on: jest.fn(),
  })),
}));

// Stub dotenv so it doesn't fail
jest.mock('dotenv', () => ({ config: jest.fn() }));

mockConnect.mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});

const db = require('../db');

describe('db.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  describe('ensureConference', () => {
    it('should return existing open conference if one exists', async () => {
      const existing = { id: 1, name: 'room1', ended_at: null };
      mockQuery.mockResolvedValueOnce({ rows: [existing] });

      const result = await db.ensureConference('room1');
      expect(result).toEqual(existing);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT * FROM conferences');
      expect(mockQuery.mock.calls[0][1]).toEqual(['room1']);
    });

    it('should create a new conference if none is open', async () => {
      const newConf = { id: 5, name: 'newroom', ended_at: null };
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // SELECT returns nothing
        .mockResolvedValueOnce({ rows: [newConf] });  // INSERT returns new row

      const result = await db.ensureConference('newroom');
      expect(result).toEqual(newConf);
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO conferences');
    });
  });

  describe('closeConference', () => {
    it('should update ended_at and terminated_by', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await db.closeConference('room1', 'admin');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('UPDATE conferences');
      expect(mockQuery.mock.calls[0][1]).toEqual(['room1', 'admin']);
    });

    it('should default terminated_by to system', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await db.closeConference('room1');
      expect(mockQuery.mock.calls[0][1]).toEqual(['room1', 'system']);
    });
  });

  describe('recordJoin', () => {
    it('should insert participant and update peak_members', async () => {
      const conf = { id: 10, name: 'room1' };
      const participant = { id: 100, conference_id: 10, member_id: '1' };

      mockQuery
        .mockResolvedValueOnce({ rows: [conf] })   // ensureConference SELECT
        .mockResolvedValueOnce({ rows: [] })        // idempotency check
        .mockResolvedValueOnce({ rows: [] })        // UPDATE peak_members
        .mockResolvedValueOnce({ rows: [participant] }) // INSERT participant
        .mockResolvedValueOnce({ rows: [] });       // addEvent INSERT

      const result = await db.recordJoin('room1', '1', 'ext1000');
      expect(result).toEqual(participant);
    });

    it('should be idempotent – return existing if already active', async () => {
      const conf = { id: 10, name: 'room1' };
      const existingPart = { id: 55 };

      mockQuery
        .mockResolvedValueOnce({ rows: [conf] })         // ensureConference
        .mockResolvedValueOnce({ rows: [existingPart] }); // already exists

      const result = await db.recordJoin('room1', '1', 'ext1000');
      expect(result).toEqual(existingPart);
      // Should not have called INSERT
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordLeave', () => {
    it('should update left_at and duration_sec for an active participant', async () => {
      const participant = { id: 20, conference_id: 3, member_id: '5', user: 'ext1001' };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })      // find conference
        .mockResolvedValueOnce({ rows: [participant] })     // find participant
        .mockResolvedValueOnce({ rows: [] })                // UPDATE participant
        .mockResolvedValueOnce({ rows: [] });               // addEvent

      await db.recordLeave('room1', '5', false);
      expect(mockQuery.mock.calls[2][0]).toContain('UPDATE participants');
    });

    it('should do nothing if conference not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await db.recordLeave('no-conf', '1');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if participant not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [] });

      await db.recordLeave('room1', '99');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordMute', () => {
    it('should mark participant as muted when muted=true', async () => {
      const participant = { id: 20, user: 'ext1000' };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })   // find conference
        .mockResolvedValueOnce({ rows: [participant] })  // find participant
        .mockResolvedValueOnce({ rows: [] })             // UPDATE was_muted
        .mockResolvedValueOnce({ rows: [] });            // addEvent

      await db.recordMute('room1', '5', true);
      expect(mockQuery.mock.calls[2][0]).toContain('UPDATE participants SET was_muted');
    });

    it('should log unmute event without updating was_muted', async () => {
      const participant = { id: 20, user: 'ext1000' };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 3 }] })
        .mockResolvedValueOnce({ rows: [participant] })
        .mockResolvedValueOnce({ rows: [] });            // addEvent only

      await db.recordMute('room1', '5', false);
      // When muted=false, we skip the UPDATE, just addEvent
      const calls = mockQuery.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('INSERT INTO events');
    });
  });

  describe('getAllConferences', () => {
    it('should return conferences ordered by started_at DESC', async () => {
      const rows = [{ id: 2, name: 'b' }, { id: 1, name: 'a' }];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await db.getAllConferences({ limit: 50, offset: 0 });
      expect(result).toEqual(rows);
      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY started_at DESC');
    });

    it('should filter by name when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await db.getAllConferences({ name: 'room1' });
      expect(mockQuery.mock.calls[0][0]).toContain('WHERE name =');
      expect(mockQuery.mock.calls[0][1]).toContain('room1');
    });
  });

  describe('getConferenceById', () => {
    it('should return conference row or null', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'room1' }] });
      const result = await db.getConferenceById(1);
      expect(result).toEqual({ id: 1, name: 'room1' });
    });

    it('should return null for non-existent id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await db.getConferenceById(999);
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should aggregate and return stats object', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total: '5', active: '2', total_part: '20', total_events: '50' }],
        })
        .mockResolvedValueOnce({
          rows: [{ avg_duration: '15.3', max_duration: '45.0' }],
        });

      const result = await db.getStats();
      expect(result).toEqual({
        total: 5,
        active: 2,
        totalPart: 20,
        totalEvents: 50,
        avgDuration: '15.3',
        maxDuration: '45.0',
      });
    });

    it('should handle null durations (no ended conferences)', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total: '1', active: '1', total_part: '3', total_events: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ avg_duration: null, max_duration: null }],
        });

      const result = await db.getStats();
      expect(result.avgDuration).toBe(0);
      expect(result.maxDuration).toBe(0);
    });
  });

  describe('getActiveConferences', () => {
    it('should return formatted active conferences', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'room1', started_at: '2024-01-01T00:00:00Z', elapsed_minutes: '5.5', current_members: '3' },
        ],
      });

      const result = await db.getActiveConferences();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
        name: 'room1',
        startedAt: '2024-01-01T00:00:00Z',
        elapsedMinutes: 5.5,
        currentMembers: 3,
      });
    });
  });
});
