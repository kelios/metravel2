#!/usr/bin/env node

/**
 * Test CORS Proxy - verify that Metro CORS proxy is working
 * Run: node scripts/test-cors-proxy.js
 */

const http = require('http');

const METRO_PORT = process.env.PORT || 8082;
const API_ENDPOINTS = [
  '/api/getFiltersTravel/',
  '/api/countriesforsearch/',
  '/api/travels/?where=%7B%22moderation%22%3A1%2C%22publish%22%3A1%7D&page=1&perPage=20&query=',
];

console.log('🔍 Testing CORS Proxy...\n');
console.log(`Metro Dev Server: http://localhost:${METRO_PORT}`);
console.log(`Backend API: ${process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.36'}\n`);

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: METRO_PORT,
      path: endpoint,
      method: 'GET',
      headers: {
        'Origin': `http://localhost:${METRO_PORT}`,
      },
    };

    console.log(`📡 Testing: ${endpoint}`);

    const req = http.request(options, (res) => {
      testsRun++;

      const corsHeader = res.headers['access-control-allow-origin'];
      const statusOk = res.statusCode >= 200 && res.statusCode < 400;

      if (corsHeader && statusOk) {
        testsPassed++;
        console.log(`  ✅ PASS (${res.statusCode})`);
        console.log(`     CORS: ${corsHeader}`);
      } else {
        testsFailed++;
        console.log(`  ❌ FAIL (${res.statusCode})`);
        if (!corsHeader) {
          console.log(`     Missing CORS header!`);
        }
      }

      // Consume response
      res.on('data', () => {});
      res.on('end', () => {
        resolve();
      });
    });

    req.on('error', (err) => {
      testsRun++;
      testsFailed++;
      console.log(`  ❌ ERROR: ${err.message}`);
      resolve();
    });

    req.setTimeout(5000, () => {
      testsRun++;
      testsFailed++;
      console.log(`  ❌ TIMEOUT (5s)`);
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  for (const endpoint of API_ENDPOINTS) {
    await testEndpoint(endpoint);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Results:');
  console.log(`   Total:  ${testsRun}`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);

  if (testsFailed === 0 && testsRun > 0) {
    console.log('\n🎉 All tests passed! CORS proxy is working!');
    process.exit(0);
  } else if (testsRun === 0) {
    console.log('\n⚠️  No tests run. Is Metro dev server running?');
    console.log('   Start it with: npm run web');
    process.exit(1);
  } else {
    console.log('\n❌ Some tests failed. Check Metro logs for errors.');
    process.exit(1);
  }
}

// Check if Metro is running
const checkOptions = {
  hostname: 'localhost',
  port: METRO_PORT,
  path: '/',
  method: 'HEAD',
  timeout: 2000,
};

const checkReq = http.request(checkOptions, () => {
  console.log('✅ Metro dev server is running\n');
  runTests();
});

checkReq.on('error', () => {
  console.log('❌ Metro dev server is NOT running!');
  console.log('   Start it with: npm run web');
  console.log('   Then run this script again.\n');
  process.exit(1);
});

checkReq.end();
