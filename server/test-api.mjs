#!/usr/bin/env node

/**
 * MyAgilityQs API Test Script
 *
 * This script tests all the API endpoints with proper authentication
 * and provides a comprehensive test suite for the database integration.
 */

import http from "http";
import https from "https";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  // Use environment variables or defaults
  BASE_URL: process.env.API_URL || "https://072j9gp0u7.execute-api.us-east-1.amazonaws.com",
  LOCAL_URL: "http://localhost:3001",
  USE_LOCAL: process.env.USE_LOCAL === "true",
};

// Load test credentials from environment variables
const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD,
};

// Validate that test credentials are available
if (!TEST_CREDENTIALS.email || !TEST_CREDENTIALS.password) {
  console.error("❌ Test credentials not found!");
  console.error("   Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables");
  console.error("   or add them to your .env file:");
  console.error("   TEST_USER_EMAIL=your-test-email@example.com");
  console.error("   TEST_USER_PASSWORD=your-test-password");
  process.exit(1);
}

const BASE_URL = CONFIG.USE_LOCAL ? CONFIG.LOCAL_URL : CONFIG.BASE_URL;

// Global test state
let authToken = "";
let testDogId = "";
let testRunId = "";

// Utility functions
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const defaultHeaders = {
      "User-Agent": "MyAgilityQs-Test-Script/1.0",
    };

    // Only add Content-Type for requests with data
    if (data !== null) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    if (authToken) {
      defaultHeaders["Authorization"] = `Bearer ${authToken}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: { ...defaultHeaders, ...headers },
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            data: body ? JSON.parse(body) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            data: null,
            parseError: error.message,
          });
        }
      });
    });
    req.on("error", reject);

    if (data) {
      const postData = typeof data === "string" ? data : JSON.stringify(data);
      // Add Content-Length header for POST requests
      req.setHeader("Content-Length", Buffer.byteLength(postData));
      req.write(postData);
    }

    req.end();
  });
}

function expectStatus(response, expectedStatus, testName) {
  if (response.statusCode === expectedStatus) {
    log(`✅ ${testName}: Status ${response.statusCode}`, "green");
    return true;
  } else {
    log(`❌ ${testName}: Expected ${expectedStatus}, got ${response.statusCode}`, "red");
    if (response.data) {
      console.log("   Response:", JSON.stringify(response.data, null, 2));
    }
    return false;
  }
}

function expectSuccess(response, testName) {
  if (response.data && response.data.success) {
    log(`✅ ${testName}: Success`, "green");
    return true;
  } else {
    log(`❌ ${testName}: Not successful`, "red");
    if (response.data) {
      console.log("   Response:", JSON.stringify(response.data, null, 2));
    }
    return false;
  }
}

// Test functions
async function testHealth() {
  log("\n🔍 Testing Health Endpoint", "blue");
  const response = await makeRequest("GET", "/health");

  expectStatus(response, 200, "Health Check");
  expectSuccess(response, "Health Response");

  if (response.data?.data?.timestamp) {
    log(`   Server time: ${response.data.data.timestamp}`, "yellow");
  }
}

async function testAuthentication() {
  log("\n🔐 Testing Authentication", "blue");

  const loginData = {
    email: TEST_CREDENTIALS.email,
    password: TEST_CREDENTIALS.password,
  };
  log(`   Logging in as: ${loginData.email}`, "yellow");

  const response = await makeRequest("POST", "/auth/login", loginData);

  if (expectStatus(response, 200, "Login") && expectSuccess(response, "Login Success")) {
    authToken = response.data.data.accessToken;
    log(`   Token received (${authToken.length} chars)`, "green");
    log(`   Token expires in: ${response.data.data.expiresIn} seconds`, "yellow");
    return true;
  }

  return false;
}

async function testDogsManagement() {
  log("\n🐕 Testing Dogs Management", "blue");

  // Test GET /dogs (should work with auth)
  log("   Testing GET /dogs...", "yellow");
  let response = await makeRequest("GET", "/dogs");

  if (!expectStatus(response, 200, "Get Dogs") || !expectSuccess(response, "Get Dogs Success")) {
    return false;
  }

  const initialDogs = response.data.data;
  log(`   Found ${initialDogs.length} existing dogs`, "yellow");

  // Test POST /dogs (create new dog)
  log("   Testing POST /dogs...", "yellow");
  const newDog = {
    name: `TestDog-${Date.now()}`,
    classes: [
      { name: "Standard", level: "Novice" },
      { name: "Jumpers", level: "Open" },
    ],
  };

  response = await makeRequest("POST", "/dogs", newDog);

  if (
    !expectStatus(response, 201, "Create Dog") ||
    !expectSuccess(response, "Create Dog Success")
  ) {
    return false;
  }

  testDogId = response.data.data.id;
  log(`   Created dog with ID: ${testDogId}`, "green");
  log(`   Dog name: ${response.data.data.name}`, "yellow");

  // Test GET /dogs again (should have one more)
  log("   Testing GET /dogs after creation...", "yellow");
  response = await makeRequest("GET", "/dogs");

  if (expectStatus(response, 200, "Get Dogs After Creation")) {
    const newDogsList = response.data.data;
    if (newDogsList.length === initialDogs.length + 1) {
      log(`   ✅ Dog count increased from ${initialDogs.length} to ${newDogsList.length}`, "green");
    } else {
      log(`   ❌ Expected ${initialDogs.length + 1} dogs, got ${newDogsList.length}`, "red");
    }
  }

  // Test PUT /dogs/{id} (update dog)
  if (testDogId) {
    log("   Testing PUT /dogs/{id}...", "yellow");
    const updateData = {
      name: `UpdatedDog-${Date.now()}`,
      classes: [
        { name: "Standard", level: "Excellent" },
        { name: "Jumpers", level: "Masters" },
        { name: "FAST", level: "Open" },
      ],
    };

    response = await makeRequest("PUT", `/dogs/${testDogId}`, updateData);

    if (
      expectStatus(response, 200, "Update Dog") &&
      expectSuccess(response, "Update Dog Success")
    ) {
      log(`   Updated dog name: ${response.data.data.name}`, "green");
      log(`   Updated classes: ${response.data.data.classes.length}`, "yellow");
    }
  }

  return true;
}

async function testRunsManagement() {
  if (!testDogId) {
    log("\n⚠️  Skipping runs tests - no test dog available", "yellow");
    return false;
  }

  log("\n🏃 Testing Runs Management", "blue");

  // Test GET /runs (should work with auth)
  log("   Testing GET /runs...", "yellow");
  let response = await makeRequest("GET", "/runs");

  if (!expectStatus(response, 200, "Get Runs") || !expectSuccess(response, "Get Runs Success")) {
    return false;
  }

  const initialRuns = response.data.data;
  log(`   Found ${initialRuns.length} existing runs`, "yellow");

  // Test POST /runs (create new run)
  log("   Testing POST /runs...", "yellow");
  const newRun = {
    dogId: testDogId,
    date: new Date().toISOString().split("T")[0], // Today's date
    class: "Standard",
    level: "Novice",
    qualified: true,
    placement: 2,
    time: 45.23,
    machPoints: 5,
    location: "Test Trial Location",
    notes: "Great run! Clean and fast.",
  };

  response = await makeRequest("POST", "/runs", newRun);

  if (
    !expectStatus(response, 201, "Create Run") ||
    !expectSuccess(response, "Create Run Success")
  ) {
    return false;
  }

  testRunId = response.data.data.id;
  log(`   Created run with ID: ${testRunId}`, "green");
  log(`   Run time: ${response.data.data.time}s`, "yellow");
  log(`   Qualified: ${response.data.data.qualified}`, "yellow");

  // Test GET /runs/dog/{dogId}
  log("   Testing GET /runs/dog/{dogId}...", "yellow");
  response = await makeRequest("GET", `/runs/dog/${testDogId}`);

  if (
    expectStatus(response, 200, "Get Runs by Dog") &&
    expectSuccess(response, "Get Runs by Dog Success")
  ) {
    const dogRuns = response.data.data;
    log(`   Found ${dogRuns.length} runs for this dog`, "green");
  }

  return true;
}

async function testProgressAnalytics() {
  if (!testDogId) {
    log("\n⚠️  Skipping progress tests - no test dog available", "yellow");
    return false;
  }

  log("\n📊 Testing Progress Analytics", "blue");

  // Test GET /progress/dog/{dogId}
  log("   Testing GET /progress/dog/{dogId}...", "yellow");
  let response = await makeRequest("GET", `/progress/dog/${testDogId}`);

  if (
    expectStatus(response, 200, "Get Dog Progress") &&
    expectSuccess(response, "Get Dog Progress Success")
  ) {
    const progress = response.data.data;
    log(`   Dog: ${progress.dogName}`, "green");
    log(`   Double Qs: ${progress.doubleQs}`, "yellow");
    log(`   MACH Points: ${progress.machProgress}`, "yellow");
    log(`   Classes with progress: ${progress.classProgress.length}`, "yellow");
  }

  // Test GET /progress (all dogs)
  log("   Testing GET /progress...", "yellow");
  response = await makeRequest("GET", "/progress");

  if (
    expectStatus(response, 200, "Get All Progress") &&
    expectSuccess(response, "Get All Progress Success")
  ) {
    const allProgress = response.data.data;
    log(`   Progress for ${allProgress.length} dogs`, "green");
  }

  // Test GET /progress/summary
  log("   Testing GET /progress/summary...", "yellow");
  response = await makeRequest("GET", "/progress/summary");

  if (
    expectStatus(response, 200, "Get Progress Summary") &&
    expectSuccess(response, "Get Progress Summary Success")
  ) {
    const summary = response.data.data;
    log(`   Total dogs: ${summary.totalDogs}`, "green");
    log(`   Total runs: ${summary.totalRuns}`, "yellow");
    log(`   Total Qs: ${summary.totalQs}`, "yellow");
    log(`   Double Qs: ${summary.totalDoubleQs}`, "yellow");
  }

  return true;
}

async function testErrorHandling() {
  log("\n🚨 Testing Error Handling", "blue");

  // Test unauthorized access
  log("   Testing unauthorized access...", "yellow");
  const originalToken = authToken;
  authToken = "invalid-token";

  let response = await makeRequest("GET", "/dogs");
  expectStatus(response, 401, "Unauthorized Access");

  authToken = originalToken;

  // Test invalid dog ID
  log("   Testing invalid dog ID...", "yellow");
  response = await makeRequest("GET", "/progress/dog/invalid-id");
  expectStatus(response, 404, "Invalid Dog ID");

  // Test invalid request body
  log("   Testing invalid request body...", "yellow");
  response = await makeRequest("POST", "/dogs", { invalid: "data" });
  expectStatus(response, 400, "Invalid Request Body");

  return true;
}

// Main test runner
async function runAllTests() {
  log("🚀 Starting MyAgilityQs API Test Suite", "bold");
  log(`📡 Testing against: ${BASE_URL}`, "blue");

  const startTime = Date.now();
  let passedTests = 0;
  let totalTests = 0;

  try {
    // Run all test suites
    const testSuites = [
      { name: "Health Check", fn: testHealth },
      { name: "Authentication", fn: testAuthentication },
      { name: "Dogs Management", fn: testDogsManagement },
      { name: "Runs Management", fn: testRunsManagement },
      { name: "Progress Analytics", fn: testProgressAnalytics },
      { name: "Error Handling", fn: testErrorHandling },
    ];

    for (const suite of testSuites) {
      totalTests++;
      try {
        const result = await suite.fn();
        if (result !== false) passedTests++;
      } catch (error) {
        log(`❌ ${suite.name} failed with error: ${error.message}`, "red");
      }
    }
  } catch (error) {
    log(`💥 Test suite failed: ${error.message}`, "red");
    console.error(error);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log("\n📊 Test Results Summary", "bold");
  log(`   Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? "green" : "yellow");
  log(`   Duration: ${duration}s`, "blue");

  if (passedTests === totalTests) {
    log("\n🎉 All tests passed! Database integration is working perfectly!", "green");
  } else {
    log("\n⚠️  Some tests failed. Check the output above for details.", "yellow");
  }

  // Clean up test data
  if (testDogId) {
    log("\n🧹 Cleaning up test data...", "yellow");
    try {
      await makeRequest("PATCH", `/dogs/${testDogId}/status`);
      log("   ✅ Test dog deactivated", "green");
    } catch (error) {
      log("   ⚠️  Could not clean up test dog", "yellow");
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes("--local")) {
  CONFIG.USE_LOCAL = true;
}

if (args.includes("--help")) {
  console.log(`
MyAgilityQs API Test Script

Usage: node test-api.mjs [options]

Options:
  --local     Test against local server (http://localhost:3001)
  --help      Show this help message

Environment Variables:
  API_URL     Override the API URL (default: production)
  USE_LOCAL   Set to 'true' to use local server

The script will test all API endpoints and provide a comprehensive report.
  `);
  process.exit(0);
}

// Run the tests
runAllTests().catch(console.error);
