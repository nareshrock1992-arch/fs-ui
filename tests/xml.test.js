/**
 * Unit tests for freeswitch/xml.js
 *
 * Tests the XML user directory management functions (addUser, deleteUser, listUsers)
 * by mocking the filesystem operations.
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs');

const xml = require('../freeswitch/xml');

const FS_DIR = '/usr/local/freeswitch/conf/directory/default';

describe('freeswitch/xml.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addUser', () => {
    it('should write an XML file with the correct content', () => {
      fs.writeFileSync.mockImplementation(() => {});

      const result = xml.addUser('testuser', 'pass123');

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [filePath, content] = fs.writeFileSync.mock.calls[0];
      expect(filePath).toBe(path.join(FS_DIR, 'testuser.xml'));
      expect(content).toContain('<user id="testuser">');
      expect(content).toContain('<param name="password" value="pass123"/>');
      expect(content).toContain('<include>');
      expect(result).toBe(filePath);
    });

    it('should return the full path to the created file', () => {
      fs.writeFileSync.mockImplementation(() => {});

      const result = xml.addUser('alice', 'secret');
      expect(result).toBe(path.join(FS_DIR, 'alice.xml'));
    });
  });

  describe('deleteUser', () => {
    it('should delete the file if it exists and return true', () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});

      const result = xml.deleteUser('testuser');

      expect(fs.existsSync).toHaveBeenCalledWith(path.join(FS_DIR, 'testuser.xml'));
      expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(FS_DIR, 'testuser.xml'));
      expect(result).toBe(true);
    });

    it('should return false if the file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = xml.deleteUser('nonexistent');

      expect(result).toBe(false);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    it('should return an array of user objects from XML files', () => {
      fs.readdirSync.mockReturnValue(['alice.xml', 'bob.xml', 'readme.txt']);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('alice.xml')) {
          return '<include><user id="alice"><params></params></user></include>';
        }
        if (filePath.includes('bob.xml')) {
          return '<include><user id="bob"><params></params></user></include>';
        }
        return '';
      });

      const result = xml.listUsers();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ username: 'alice', extension: 'alice' });
      expect(result[1]).toEqual({ username: 'bob', extension: 'bob' });
    });

    it('should fall back to filename if user id cannot be parsed', () => {
      fs.readdirSync.mockReturnValue(['weird.xml']);
      fs.readFileSync.mockReturnValue('<broken-xml>');

      const result = xml.listUsers();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ username: 'weird', extension: 'weird' });
    });

    it('should return empty array when no XML files exist', () => {
      fs.readdirSync.mockReturnValue(['readme.txt', 'notes.md']);

      const result = xml.listUsers();
      expect(result).toEqual([]);
    });

    it('should filter only .xml files', () => {
      fs.readdirSync.mockReturnValue(['user1.xml', 'user2.xml', 'config.json']);
      fs.readFileSync.mockImplementation((filePath) => {
        const name = path.basename(filePath, '.xml');
        return `<include><user id="${name}"><params></params></user></include>`;
      });

      const result = xml.listUsers();
      expect(result).toHaveLength(2);
    });
  });
});
