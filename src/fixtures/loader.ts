import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { QuestionnaireSchema, type Questionnaire } from '../core/schema.js';

/**
 * Fixture loader for loading sample questionnaires
 */
export class FixtureLoader {
  private static fixturesPath = 'fixtures';

  /**
   * Load a single fixture by path
   */
  static async loadFixture(relativePath: string): Promise<Questionnaire> {
    const filePath = join(this.fixturesPath, relativePath);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return QuestionnaireSchema.parse(data);
  }

  /**
   * Load all fixtures from a directory
   */
  static async loadFixturesFromDir(dir: string): Promise<Questionnaire[]> {
    const dirPath = join(this.fixturesPath, dir);
    const files = await readdir(dirPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const fixtures = await Promise.all(
      jsonFiles.map(file => this.loadFixture(join(dir, file)))
    );
    
    return fixtures;
  }

  /**
   * Load all basic fixtures
   */
  static async loadBasicFixtures(): Promise<Questionnaire[]> {
    return this.loadFixturesFromDir('basic');
  }

  /**
   * Load all advanced fixtures
   */
  static async loadAdvancedFixtures(): Promise<Questionnaire[]> {
    return this.loadFixturesFromDir('advanced');
  }

  /**
   * Load all edge case fixtures
   */
  static async loadEdgeCaseFixtures(): Promise<Questionnaire[]> {
    return this.loadFixturesFromDir('edge-cases');
  }

  /**
   * Load all fixtures
   */
  static async loadAllFixtures(): Promise<Questionnaire[]> {
    const [basic, advanced, edgeCases] = await Promise.all([
      this.loadBasicFixtures(),
      this.loadAdvancedFixtures(),
      this.loadEdgeCaseFixtures()
    ]);
    
    return [...basic, ...advanced, ...edgeCases];
  }
}
