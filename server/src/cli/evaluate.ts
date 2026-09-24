#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import dotenv from "dotenv";
import { runPipeline } from "../pipeline/loop.js";
import {
  BatchCaseInputsArraySchema,
  type BatchResultFile,
  type BatchCaseOutput,
} from "@trao/shared";

dotenv.config();

const program = new Command();

program
  .name("evaluate")
  .description("Run Trao AI Interview Prep Kit batch evaluation pipeline")
  .requiredOption("-i, --input <path>", "Path to input cases JSON file")
  .requiredOption("-o, --output <path>", "Path to output kits JSON file")
  .parse(process.argv);

const options = program.opts();

async function main() {
  const inputPath = path.resolve(process.cwd(), options.input);
  const outputPath = path.resolve(process.cwd(), options.output);

  console.log("====================================================");
  console.log(" Trao AI Interview Prep Kit - Batch Evaluator");
  console.log("====================================================");
  console.log(`Input cases:  ${inputPath}`);
  console.log(`Output target: ${outputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`[Error] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  let rawCases: any;
  try {
    const rawFileContent = fs.readFileSync(inputPath, "utf-8");
    rawCases = JSON.parse(rawFileContent);
  } catch (err: any) {
    console.error(`[Error] Failed to read or parse input JSON: ${err.message}`);
    process.exit(1);
  }

  const parsedInputs = BatchCaseInputsArraySchema.safeParse(rawCases);
  if (!parsedInputs.success) {
    console.error("[Error] Input file does not match expected schema:");
    console.error(parsedInputs.error.format());
    process.exit(1);
  }

  const cases = parsedInputs.data;
  console.log(`Loaded ${cases.length} cases to evaluate.\n`);

  const results: BatchCaseOutput[] = [];
  const startTime = Date.now();

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const caseStartTime = Date.now();
    console.log(`[${i + 1}/${cases.length}] Processing case '${testCase.id}'...`);
    console.log(`      Company: ${testCase.company_url}`);
    console.log(`      Days:    ${testCase.days}`);

    try {
      const kit = await runPipeline({
        jd: testCase.jd,
        companyUrl: testCase.company_url,
        days: testCase.days,
        allowLocalUrls: true, // Allow local testing fixtures per Section 9
        onProgress: (evt) => {
          if (process.env.DEBUG) {
            console.log(`      -> [${evt.step}] ${evt.message}`);
          }
        },
      });

      const elapsed = ((Date.now() - caseStartTime) / 1000).toFixed(1);
      console.log(`      ✓ Case '${testCase.id}' OK (${elapsed}s)`);

      results.push({
        id: testCase.id,
        status: "ok",
        kit,
        error: null,
      });
    } catch (err: any) {
      const elapsed = ((Date.now() - caseStartTime) / 1000).toFixed(1);
      console.warn(`      ✗ Case '${testCase.id}' FAILED (${elapsed}s): ${err.message}`);

      let errorCode = "EVALUATION_FAILED";
      if (err.message?.includes("unreachable") || err.message?.includes("fetch")) {
        errorCode = "COMPANY_UNREACHABLE";
      } else if (err.message?.includes("Rate limit")) {
        errorCode = "RATE_LIMIT_EXCEEDED";
      }

      results.push({
        id: testCase.id,
        status: "failed",
        kit: null,
        error: {
          code: errorCode,
          message: err.message || "Failed to generate kit",
        },
      });
    }
  }

  const outputData: BatchResultFile = {
    version: "1.0",
    generated at: new Date().toISOString(),
    kits: results,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = results.filter((r) => r.status === "ok").length;
  console.log("\n====================================================");
  console.log(`Batch evaluation complete in ${totalTime}s`);
  console.log(`Summary: ${successCount}/${cases.length} successful`);
  console.log(`Output written to: ${outputPath}`);
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Fatal evaluator error:", err);
  process.exit(1);
});
