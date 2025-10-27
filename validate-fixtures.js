#!/usr/bin/env node

/**
 * Fixture validation and reporting script
 * Run with: node --experimental-vm-modules validate-fixtures.js
 */

import { FixtureLoader } from './dist/fixtures/loader.js';
import { FixtureValidator } from './dist/fixtures/validator.js';

async function main() {
  console.log('🔍 Loading and validating fixtures...\n');

  try {
    // Load all fixtures
    const fixtures = await FixtureLoader.loadAllFixtures();
    console.log(`✅ Loaded ${fixtures.length} fixtures\n`);

    // Validate all fixtures
    const results = await FixtureValidator.validateAllFixtures(fixtures);
    const validCount = results.filter(r => r.valid).length;
    
    console.log(`📊 Validation Results:`);
    console.log(`   Valid: ${validCount}/${fixtures.length}`);
    console.log(`   Invalid: ${fixtures.length - validCount}\n`);

    // Generate schema report
    const report = FixtureValidator.generateSchemaReport(fixtures);
    
    console.log('📈 Schema Coverage Report:');
    console.log(`   Total Fixtures: ${report.totalFixtures}`);
    console.log(`   Valid Fixtures: ${report.validFixtures}`);
    console.log(`   Invalid Fixtures: ${report.invalidFixtures}\n`);

    console.log('🎯 Question Type Coverage:');
    Object.entries(report.questionTypeCoverage)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`   ${type.padEnd(20)} ${count} questions`);
      });
    
    console.log(`\n🔧 Validation Rules Used (${report.validationRuleCoverage.length}):`);
    report.validationRuleCoverage.forEach(rule => {
      console.log(`   • ${rule}`);
    });

    // Test questionnaire flows
    console.log('\n🔄 Testing Questionnaire Flows:');
    fixtures.forEach(fixture => {
      const flowResult = FixtureValidator.testQuestionnaireFlow(fixture);
      const status = flowResult.valid ? '✅' : '❌';
      console.log(`   ${status} ${fixture.id}`);
      if (!flowResult.valid) {
        flowResult.issues.forEach(issue => {
          console.log(`      ⚠️  ${issue}`);
        });
      }
    });

    console.log('\n✨ All fixtures validated successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
