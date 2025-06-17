import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "../index";

// Mock context (reusable)
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test",
  functionVersion: "1",
  invokedFunctionArn: "test",
  memoryLimitInMB: "128",
  awsRequestId: "test",
  logGroupName: "test",
  logStreamName: "test",
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Create a mock event
const createMockEvent = (method: string, path: string, body?: any): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: path,
  headers: { "Content-Type": "application/json" },
  multiValueHeaders: {},
  pathParameters: null,
  multiValueQueryStringParameters: null,
  queryStringParameters: null,
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  requestContext: {
    accountId: "test",
    apiId: "test",
    authorizer: undefined,
    protocol: "HTTP/1.1",
    httpMethod: method,
    path: path,
    stage: "test",
    requestId: "test",
    requestTime: "",
    requestTimeEpoch: 0,
    resourceId: "test",
    resourcePath: path,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: "127.0.0.1",
      user: null,
      userAgent: "test",
      userArn: null,
      clientCert: null,
    },
  },
  resource: path,
  stageVariables: null,
});

// Test suite
const tests = [
  {
    name: "Health Endpoint",
    event: createMockEvent("GET", "/health"),
  },
  {
    name: "404 Not Found",
    event: createMockEvent("GET", "/nonexistent"),
  },
  {
    name: "Dogs Endpoint (No Auth)",
    event: createMockEvent("GET", "/dogs"),
  },
];

async function runTests() {
  console.log("🧪 Running Phase 1 API Tests...\n");

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const result = await handler(test.event, mockContext);
      console.log(`✅ Status: ${result.statusCode}`);

      const responseBody = JSON.parse(result.body);
      if (responseBody.success) {
        console.log(`✅ Response: ${responseBody.message}`);
      } else {
        console.log(`⚠️  Error: ${responseBody.error} - ${responseBody.message}`);
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Test failed: ${(error as Error).message}\n`);
    }
  }

  console.log("🎉 Phase 1 Testing Complete!");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { createMockEvent, mockContext, runTests };
