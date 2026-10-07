const assert = require('assert');
const express = require('express');
const http = require('http');

// Load environment and DB configuration
require('dotenv').config();
const authRouter = require('../src/routes/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

let server;
let port;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAuthTests() {
  console.log('🧪 Starting Auth & JWT Unit Tests...');
  
  server = app.listen(0, async () => {
    port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
      const testEmail = `testuser_${Date.now()}@example.com`;
      const testPassword = 'Password123!';
      const testName = 'Test Data Analyst';

      // Test 1: User Registration
      console.log('Test 1: Register user...');
      const regRes = await request({
        hostname: 'localhost',
        port: port,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: testName, email: testEmail, password: testPassword });

      assert.strictEqual(regRes.status, 201, `Expected status 201, got ${regRes.status}`);
      assert.ok(regRes.body.token, 'Token should be returned on registration');
      assert.strictEqual(regRes.body.user.email, testEmail);
      console.log('✅ Test 1 passed: User registered successfully.');

      const userToken = regRes.body.token;

      // Test 2: User Login
      console.log('Test 2: Login user...');
      const loginRes = await request({
        hostname: 'localhost',
        port: port,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { email: testEmail, password: testPassword });

      assert.strictEqual(loginRes.status, 200, `Expected status 200, got ${loginRes.status}`);
      assert.ok(loginRes.body.token, 'Token should be returned on login');
      console.log('✅ Test 2 passed: User logged in successfully.');

      // Test 3: Get User Profile with JWT
      console.log('Test 3: Fetch profile with JWT Bearer Token...');
      const meRes = await request({
        hostname: 'localhost',
        port: port,
        path: '/api/auth/me',
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      assert.strictEqual(meRes.status, 200, `Expected status 200, got ${meRes.status}`);
      assert.strictEqual(meRes.body.user.email, testEmail);
      console.log('✅ Test 3 passed: User profile verified.');

      // Test 4: Invalid Password
      console.log('Test 4: Reject invalid password...');
      const badLoginRes = await request({
        hostname: 'localhost',
        port: port,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { email: testEmail, password: 'WrongPassword' });

      assert.strictEqual(badLoginRes.status, 401, 'Should fail with 401 Unauthorized');
      console.log('✅ Test 4 passed: Invalid password rejected.');

      console.log('\n🎉 ALL AUTH & JWT TESTS PASSED SUCCESSFULLY!');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Test failed:', err);
      if (server) server.close();
      process.exit(1);
    }
  });
}

runAuthTests();
