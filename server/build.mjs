import { build } from "esbuild";
import { writeFileSync } from "fs";
import { join } from "path";

const isWatch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["./src/index.ts"],
  bundle: true,
  outdir: "./dist",
  platform: "node",
  target: "node22",
  format: "cjs",  // Changed to CommonJS for Lambda compatibility
  sourcemap: true,
  minify: false,
  external: [
    // AWS SDK and other Lambda runtime provided modules
    "aws-sdk",
    "@aws-sdk/*",
  ],
  define: {
    "process.env.NODE_ENV": '"development"',
  },
};

// Create package.json in dist folder for Lambda
const createDistPackageJson = () => {
  const packageJson = {
    "type": "commonjs"
  };
  
  writeFileSync(
    join("dist", "package.json"), 
    JSON.stringify(packageJson, null, 2)
  );
  console.log("📦 Created dist/package.json");
};

if (isWatch) {
  const ctx = await build({
    ...buildOptions,
    watch: {
      onRebuild(error, result) {
        if (error) console.error("❌ Build failed:", error);
        else console.log("✅ Build succeeded");
      },
    },
  });

  process.on("SIGINT", () => {
    ctx.dispose();
    process.exit(0);
  });

  console.log("👀 Watching for changes...");
} else {
  try {
    await build(buildOptions);
    createDistPackageJson();
    console.log("✅ Build completed successfully");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}
