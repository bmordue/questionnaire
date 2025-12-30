/**
 * Script to generate fixture JSON files from TypeScript generators
 */

import { writeFile } from 'fs/promises';
import holidayDestinationQuestionnaire from './generators/holiday-destination-generator.js';

async function main() {
  // Generate holiday destination questionnaire
  await writeFile(
    'fixtures/advanced/holiday-destination.json',
    JSON.stringify(holidayDestinationQuestionnaire, null, 2),
    'utf-8'
  );
  console.log('✅ Generated holiday-destination.json');
}

main().catch(console.error);
