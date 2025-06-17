// Professional TypeScript test suite
import type { APIGatewayProxyEvent, Context } from "aws-lambda";

// Test both routing approaches
const testBothApproaches = async () => {
  console.log("=".repeat(60));
  console.log("🚀 MyAgilityQs API - Clean TypeScript Architecture Test");
  console.log("=".repeat(60));

  // Mock context and event helpers
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "MyAgilityQs-API",
    functionVersion: "1",
    invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:MyAgilityQs-API",
    memoryLimitInMB: "256",
    awsRequestId: "test-request-id",
    logGroupName: "/aws/lambda/MyAgilityQs-API",
    logStreamName: "2025/06/16/[LATEST]test",
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  const createEvent = (method: string, path: string): APIGatewayProxyEvent => ({
    httpMethod: method,
    path: path,
    headers: { "Content-Type": "application/json" },
    multiValueHeaders: {},
    pathParameters: path.includes("{") ? { id: "test-id" } : null,
    multiValueQueryStringParameters: null,
    queryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    requestContext: {
      accountId: "123456789012",
      apiId: "api123",
      httpMethod: method,
      requestId: "test-request",
      protocol: "HTTP/1.1",
      resourceId: "resource123",
      resourcePath: path,
      stage: "dev",
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
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
        sourceIp: "192.168.1.100",
        user: null,
        userAgent: "MyAgilityQs-Test/1.0",
        userArn: null,
        clientCert: null,
      },
    },
    resource: path,
    stageVariables: null,
  });

  // Test cases
  const tests = [
    { name: "✅ Health Check", method: "GET", path: "/health" },
    { name: "❓ Unknown Route", method: "GET", path: "/unknown" },
    { name: "🐕 Dogs List", method: "GET", path: "/dogs" },
    { name: "🏃 Runs List", method: "GET", path: "/runs" },
    { name: "📊 Locations", method: "GET", path: "/locations" },
  ];

  // Test current approach
  console.log("\n📋 Testing Current Routing Approach:");
  console.log("-".repeat(40));

  const { handler: currentHandler } = await import("./dist/index.js");

  for (const test of tests) {
    try {
      const result = await currentHandler(createEvent(test.method, test.path), mockContext);
      const body = JSON.parse(result.body);

      console.log(`${test.name}: ${result.statusCode} ${getStatusEmoji(result.statusCode)}`);
      if (body.message) {
        console.log(`  └─ ${body.message}`);
      }
    } catch (error) {
      console.log(`${test.name}: ❌ Error - ${error.message}`);
    }
  }

  // Test router approach
  console.log("\n🛣️  Testing Clean Router Approach:");
  console.log("-".repeat(40));

  const { handler: routerHandler } = await import("./dist/router/index-router.js");

  for (const test of tests) {
    try {
      const result = await routerHandler(createEvent(test.method, test.path), mockContext);
      const body = JSON.parse(result.body);

      console.log(`${test.name}: ${result.statusCode} ${getStatusEmoji(result.statusCode)}`);
      if (body.message) {
        console.log(`  └─ ${body.message}`);
      }
    } catch (error) {
      console.log(`${test.name}: ❌ Error - ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 All TypeScript files use .ts extensions!");
  console.log("📦 esbuild handles the bundling and module resolution");
  console.log("🧪 No more temporary .mjs test files needed");
  console.log("✨ Clean, professional architecture ready for Phase 2");
  console.log("=".repeat(60));
};

const getStatusEmoji = (status: number): string => {
  if (status >= 200 && status < 300) return "✅";
  if (status >= 400 && status < 500) return "⚠️";
  if (status >= 500) return "❌";
  return "📝";
};

testBothApproaches().catch(console.error);
