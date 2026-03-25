#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "5432";
const DB_USER = process.env.DB_USER || process.env.USER || "postgres";
const DB_NAME = process.env.DB_NAME || "hospital_lens";
const RESET_DB = process.env.RESET_DB === "1";

const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : "";
    throw new Error(`${command} failed: ${stderr}`);
  }

  return result.stdout ? result.stdout.toString() : "";
}

function main() {
  if (process.env.DB_PASSWORD) {
    process.env.PGPASSWORD = process.env.DB_PASSWORD;
  }

  console.log(
    `Using DB_USER=${DB_USER}, DB_HOST=${DB_HOST}, DB_PORT=${DB_PORT}, DB_NAME=${DB_NAME}`,
  );

  const existsQuery = `SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`;
  const exists = runCapture("psql", [
    "-h",
    DB_HOST,
    "-p",
    DB_PORT,
    "-U",
    DB_USER,
    "-d",
    "postgres",
    "-tAc",
    existsQuery,
  ]);

  if (RESET_DB && exists.includes("1")) {
    console.log(`RESET_DB=1 set. Dropping database '${DB_NAME}'...`);
    try {
      run("psql", [
        "-h",
        DB_HOST,
        "-p",
        DB_PORT,
        "-U",
        DB_USER,
        "-d",
        "postgres",
        "-c",
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();`,
      ]);
    } catch (err) {
      console.warn("Warning: failed to terminate existing connections.", err);
    }
    run("dropdb", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, DB_NAME]);
  }

  if (RESET_DB || !exists.includes("1")) {
    console.log(`Database '${DB_NAME}' does not exist. Creating...`);
    run("createdb", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, DB_NAME]);
  }

  run("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-f", schemaPath]);
  console.log(`Schema applied to database: ${DB_NAME}`);
}

main();
