#!/usr/bin/env node
/**
 * Standalone CLI utility for converting questionnaire responses to markdown
 * 
 * Usage:
 *   npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]
 *   node dist/markdown-convert.js <response.json> <questionnaire.json> [output.md]
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { MarkdownConverter } from './utils/markdown-converter.js';
import { validateResponse } from './core/schema.js';
import { validateQuestionnaire } from './core/schema.js';

/**
 * Parse command line arguments
 */
function parseArgs(): { responseFile: string; questionnaireFile: string; outputFile?: string } {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Error: Missing required arguments');
    console.error('');
    console.error('Usage:');
    console.error('  npm run markdown-convert -- <response.json> <questionnaire.json> [output.md]');
    console.error('  node dist/markdown-convert.js <response.json> <questionnaire.json> [output.md]');
    console.error('');
    console.error('Arguments:');
    console.error('  response.json        Path to the response JSON file');
    console.error('  questionnaire.json   Path to the questionnaire JSON file');
    console.error('  output.md            (Optional) Path to output markdown file');
    console.error('                       If not provided, output is written to stdout');
    console.error('');
    console.error('Examples:');
    console.error('  npm run markdown-convert -- response.json questionnaire.json');
    console.error('  npm run markdown-convert -- response.json questionnaire.json output.md');
    process.exit(1);
  }

  const result: { responseFile: string; questionnaireFile: string; outputFile?: string } = {
    responseFile: args[0]!,
    questionnaireFile: args[1]!
  };

  if (args[2]) {
    result.outputFile = args[2];
  }

  return result;
}

/**
 * Main conversion function
 */
async function main() {
  try {
    const { responseFile, questionnaireFile, outputFile } = parseArgs();

    // Resolve file paths
    const responsePath = resolve(responseFile);
    const questionnairePath = resolve(questionnaireFile);

    // Read input files
    console.error(`Reading response from: ${responsePath}`);
    const responseData = await readFile(responsePath, 'utf-8');
    
    console.error(`Reading questionnaire from: ${questionnairePath}`);
    const questionnaireData = await readFile(questionnairePath, 'utf-8');

    // Parse JSON
    let responseParsed: any;
    let questionnaireParsed: any;

    try {
      responseParsed = JSON.parse(responseData);
    } catch (error) {
      console.error(`Error: Failed to parse response JSON: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    try {
      questionnaireParsed = JSON.parse(questionnaireData);
    } catch (error) {
      console.error(`Error: Failed to parse questionnaire JSON: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    // Validate against schemas
    console.error('Validating response...');
    let response;
    try {
      response = validateResponse(responseParsed);
    } catch (error) {
      console.error(`Error: Response validation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    console.error('Validating questionnaire...');
    let questionnaire;
    try {
      questionnaire = validateQuestionnaire(questionnaireParsed);
    } catch (error) {
      console.error(`Error: Questionnaire validation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    // Convert to markdown
    console.error('Converting to markdown...');
    const markdown = MarkdownConverter.convertResponse(response, questionnaire, {
      includeMetadata: true,
      includeProgress: true,
      includeTimestamps: false
    });

    // Write output
    if (outputFile) {
      const outputPath = resolve(outputFile);
      console.error(`Writing output to: ${outputPath}`);
      await writeFile(outputPath, markdown, 'utf-8');
      console.error('✓ Conversion complete!');
    } else {
      // Output to stdout
      console.log(markdown);
    }

  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the CLI
main();
