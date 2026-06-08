/**
 * Unit tests for freeswitch/esl.js – parseConferenceList
 *
 * parseConferenceList is a pure function that transforms the raw text output
 * from "conference list" bgapi into structured participant objects.
 *
 * FreeSWITCH conference list format per member line:
 *   memberId;channel;uuid;callerIdName;callerIdNumber;flags
 * The function requires parts.length >= 6 to process a line.
 */

jest.mock('modesl', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    on: jest.fn(),
    bgapi: jest.fn(),
    api: jest.fn(),
  })),
}));

const { parseConferenceList } = require('../freeswitch/esl');

describe('parseConferenceList', () => {
  beforeEach(() => {
    global.talkingMap = {};
  });

  afterEach(() => {
    delete global.talkingMap;
  });

  it('should return empty array for empty input', () => {
    expect(parseConferenceList('')).toEqual([]);
  });

  it('should return empty array for whitespace-only input', () => {
    expect(parseConferenceList('   \n  \n  ')).toEqual([]);
  });

  it('should parse a single conference with one member', () => {
    const raw = [
      '+OK Conference test-room (1 member, flags: running)',
      '1;sofia/internal/1000@192.168.1.100;abc123;1000;1000;hear|speak',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      conferenceName: 'test-room',
      memberId: '1',
      user: '1000',
      locked: false,
      isTalking: false,
    });
    expect(result[0].flags).toContain('hear');
    expect(result[0].flags).toContain('speak');
  });

  it('should parse multiple members in a conference', () => {
    const raw = [
      '+OK Conference sales-call (3 members, flags: running)',
      '1;sofia/internal/1001@10.0.0.1;id1;1001;1001;hear|speak|talking',
      '2;sofia/internal/1002@10.0.0.1;id2;1002;1002;hear|speak',
      '3;sofia/internal/1003@10.0.0.1;id3;1003;1003;hear',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(3);
    expect(result[0].memberId).toBe('1');
    expect(result[0].isTalking).toBe(true); // "talking" in flags
    expect(result[1].memberId).toBe('2');
    expect(result[1].isTalking).toBe(false);
    expect(result[2].memberId).toBe('3');
    expect(result[2].user).toBe('1003');
  });

  it('should detect locked conference', () => {
    const raw = [
      '+OK Conference secure-room (2 members, flags: running|locked)',
      '1;sofia/internal/1000@10.0.0.1;id1;1000;1000;hear|speak',
      '2;sofia/internal/1001@10.0.0.1;id2;1001;1001;hear|speak',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(2);
    expect(result[0].locked).toBe(true);
    expect(result[1].locked).toBe(true);
  });

  it('should use talkingMap to mark isTalking', () => {
    global.talkingMap = { '2': true };

    const raw = [
      '+OK Conference room1 (2 members, flags: running)',
      '1;sofia/internal/1000@10.0.0.1;id1;1000;1000;hear|speak',
      '2;sofia/internal/1001@10.0.0.1;id2;1001;1001;hear|speak',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result[0].isTalking).toBe(false);
    expect(result[1].isTalking).toBe(true);
  });

  it('should handle multiple conferences in one output', () => {
    const raw = [
      '+OK Conference room-a (1 member, flags: running)',
      '1;sofia/internal/1000@10.0.0.1;id1;1000;1000;hear|speak',
      '+OK Conference room-b (1 member, flags: running|locked)',
      '5;sofia/internal/2000@10.0.0.1;id5;2000;2000;hear|speak|talking',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(2);
    expect(result[0].conferenceName).toBe('room-a');
    expect(result[0].locked).toBe(false);
    expect(result[1].conferenceName).toBe('room-b');
    expect(result[1].locked).toBe(true);
    expect(result[1].isTalking).toBe(true);
  });

  it('should skip lines with fewer than 6 semicolons', () => {
    const raw = [
      '+OK Conference room1 (1 member, flags: running)',
      'garbage line without semicolons',
      'only;three;parts',
      '1;sofia/internal/1000@10.0.0.1;id1;1000;1000;hear|speak',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(1);
  });

  it('should handle member with empty flags field', () => {
    const raw = [
      '+OK Conference room1 (1 member, flags: running)',
      '1;sofia/internal/1000@10.0.0.1;id1;1000;1000;',
    ].join('\n');

    const result = parseConferenceList(raw);
    expect(result).toHaveLength(1);
    expect(result[0].isTalking).toBe(false);
  });
});
