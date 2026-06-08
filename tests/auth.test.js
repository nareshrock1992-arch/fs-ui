/**
 * Unit tests for routes/auth.js
 *
 * Tests the route handlers (login, register, logout, users) with mocked
 * dependencies. bcrypt must be mocked before requiring the module because
 * it has native bindings.
 */

// Mock bcrypt BEFORE any require that pulls it in
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('fs');

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const http = require('http');
const express = require('express');

const USERS_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(USERS_DIR, 'users.json');

describe('routes/auth.js', () => {
  let app;
  let router;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-mock after resetModules
    jest.mock('bcrypt', () => ({
      compare: jest.fn(),
      hash: jest.fn(),
    }));
    jest.mock('fs');

    // Default fs mocks
    const fsMock = require('fs');
    fsMock.existsSync = jest.fn().mockReturnValue(true);
    fsMock.readFileSync = jest.fn().mockReturnValue('[]');
    fsMock.writeFileSync = jest.fn();
    fsMock.mkdirSync = jest.fn();
    fsMock.renameSync = jest.fn();

    router = require('../routes/auth');

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = {
        user: null,
        isAdmin: false,
        save: (cb) => cb(null),
        destroy: (cb) => cb(),
      };
      next();
    });
    app.use('/auth', router);
  });

  describe('POST /auth/login', () => {
    it('should return 401 when user does not exist', async () => {
      const fsMock = require('fs');
      fsMock.readFileSync.mockReturnValue('[]');

      const res = await makeRequest(app, 'POST', '/auth/login', {
        username: 'nobody',
        password: 'pass',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when password is wrong', async () => {
      const fsMock = require('fs');
      const bcryptMock = require('bcrypt');
      const users = [{ username: 'admin', password: '$2b$10$hashedpass', isAdmin: true }];
      fsMock.readFileSync.mockReturnValue(JSON.stringify(users));
      bcryptMock.compare.mockResolvedValue(false);

      const res = await makeRequest(app, 'POST', '/auth/login', {
        username: 'admin',
        password: 'wrongpass',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return success when credentials are correct', async () => {
      const fsMock = require('fs');
      const bcryptMock = require('bcrypt');
      const users = [{ username: 'admin', password: '$2b$10$hashedpass', isAdmin: true }];
      fsMock.readFileSync.mockReturnValue(JSON.stringify(users));
      bcryptMock.compare.mockResolvedValue(true);

      const res = await makeRequest(app, 'POST', '/auth/login', {
        username: 'admin',
        password: 'correct',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isAdmin).toBe(true);
      expect(res.body.redirect).toBe('/');
    });

    it('should return isAdmin=false for non-admin user', async () => {
      const fsMock = require('fs');
      const bcryptMock = require('bcrypt');
      const users = [{ username: 'user1', password: '$2b$10$hash', isAdmin: false }];
      fsMock.readFileSync.mockReturnValue(JSON.stringify(users));
      bcryptMock.compare.mockResolvedValue(true);

      const res = await makeRequest(app, 'POST', '/auth/login', {
        username: 'user1',
        password: 'pass',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isAdmin).toBe(false);
    });
  });

  describe('POST /auth/register', () => {
    it('should return 400 for missing username', async () => {
      const res = await makeRequest(app, 'POST', '/auth/register', {
        password: 'pass123',
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await makeRequest(app, 'POST', '/auth/register', {
        username: 'newuser',
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid username format', async () => {
      const res = await makeRequest(app, 'POST', '/auth/register', {
        username: 'a b',
        password: 'pass123',
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const res = await makeRequest(app, 'POST', '/auth/register', {
        username: 'validuser',
        password: '12345',
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return 403 when not authorized', async () => {
      const res = await makeRequest(app, 'POST', '/auth/register', {
        username: 'newuser',
        password: 'pass123',
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 409 when user already exists (admin session)', async () => {
      // Rebuild app with admin session
      jest.resetModules();
      jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
      jest.mock('fs');
      const fsMock = require('fs');
      fsMock.existsSync = jest.fn().mockReturnValue(true);
      fsMock.readFileSync = jest.fn().mockReturnValue(JSON.stringify([{ username: 'existing', password: 'hash' }]));
      fsMock.writeFileSync = jest.fn();
      fsMock.mkdirSync = jest.fn();
      fsMock.renameSync = jest.fn();

      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req, res, next) => {
        req.session = { user: 'admin', isAdmin: true, save: (cb) => cb(null), destroy: (cb) => cb() };
        next();
      });
      adminApp.use('/auth', require('../routes/auth'));

      const res = await makeRequest(adminApp, 'POST', '/auth/register', {
        username: 'existing',
        password: 'pass123',
      });
      expect(res.statusCode).toBe(409);
    });

    it('should register a new user when authorized via admin session', async () => {
      jest.resetModules();
      jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn().mockResolvedValue('$2b$10$newhash') }));
      jest.mock('fs');
      const fsMock = require('fs');
      fsMock.existsSync = jest.fn().mockReturnValue(true);
      fsMock.readFileSync = jest.fn().mockReturnValue('[]');
      fsMock.writeFileSync = jest.fn();
      fsMock.mkdirSync = jest.fn();
      fsMock.renameSync = jest.fn();

      const adminApp = express();
      adminApp.use(express.json());
      adminApp.use((req, res, next) => {
        req.session = { user: 'admin', isAdmin: true, save: (cb) => cb(null), destroy: (cb) => cb() };
        next();
      });
      adminApp.use('/auth', require('../routes/auth'));

      const res = await makeRequest(adminApp, 'POST', '/auth/register', {
        username: 'newuser',
        password: 'pass123',
        isAdmin: false,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('should destroy session and return success', async () => {
      const res = await makeRequest(app, 'POST', '/auth/logout', {});
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /auth/users', () => {
    it('should return list of users without passwords', async () => {
      const fsMock = require('fs');
      const users = [
        { username: 'admin', password: 'hash1', isAdmin: true },
        { username: 'user1', password: 'hash2', isAdmin: false },
      ];
      fsMock.readFileSync.mockReturnValue(JSON.stringify(users));

      const res = await makeRequest(app, 'GET', '/auth/users');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({ username: 'admin', isAdmin: true });
      expect(res.body[1]).toEqual({ username: 'user1', isAdmin: false });
      res.body.forEach((u) => {
        expect(u.password).toBeUndefined();
      });
    });
  });
});

/**
 * Simple HTTP request helper (no supertest dependency needed).
 */
function makeRequest(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          let parsed = {};
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          resolve({ statusCode: res.statusCode, body: parsed });
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body && method !== 'GET') {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}
