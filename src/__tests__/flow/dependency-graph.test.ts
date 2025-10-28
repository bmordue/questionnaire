/**
 * Dependency Graph Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DependencyGraph } from '../../core/flow/dependency-graph.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('addDependency', () => {
    it('should add a dependency relationship', () => {
      graph.addDependency('q2', 'q1');
      
      expect(graph.getDependencies('q2')).toEqual(['q1']);
      expect(graph.getDependents('q1')).toEqual(['q2']);
    });

    it('should handle multiple dependencies for one question', () => {
      graph.addDependency('q3', 'q1');
      graph.addDependency('q3', 'q2');
      
      const deps = graph.getDependencies('q3');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('q1');
      expect(deps).toContain('q2');
    });

    it('should handle multiple dependents for one question', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q1');
      
      const dependents = graph.getDependents('q1');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('q2');
      expect(dependents).toContain('q3');
    });
  });

  describe('getDependencies', () => {
    it('should return empty array for question with no dependencies', () => {
      expect(graph.getDependencies('q1')).toEqual([]);
    });

    it('should return all dependencies', () => {
      graph.addDependency('q3', 'q1');
      graph.addDependency('q3', 'q2');
      
      const deps = graph.getDependencies('q3');
      expect(deps).toEqual(expect.arrayContaining(['q1', 'q2']));
    });
  });

  describe('getDependents', () => {
    it('should return empty array for question with no dependents', () => {
      expect(graph.getDependents('q1')).toEqual([]);
    });

    it('should return all dependents', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q1');
      
      const dependents = graph.getDependents('q1');
      expect(dependents).toEqual(expect.arrayContaining(['q2', 'q3']));
    });
  });

  describe('findCycles', () => {
    it('should return empty array when no cycles exist', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      
      expect(graph.findCycles()).toEqual([]);
    });

    it('should detect simple cycle', () => {
      graph.addDependency('q1', 'q2');
      graph.addDependency('q2', 'q1');
      
      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('q1');
      expect(cycles[0]).toContain('q2');
    });

    it('should detect longer cycle', () => {
      graph.addDependency('q1', 'q2');
      graph.addDependency('q2', 'q3');
      graph.addDependency('q3', 'q1');
      
      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('q1');
      expect(cycles[0]).toContain('q2');
      expect(cycles[0]).toContain('q3');
    });

    it('should detect self-reference cycle', () => {
      graph.addDependency('q1', 'q1');
      
      const cycles = graph.findCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('q1');
    });

    it('should handle complex graph with no cycles', () => {
      // Linear chain
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      graph.addDependency('q4', 'q3');
      
      // Branching
      graph.addDependency('q5', 'q2');
      graph.addDependency('q6', 'q5');
      
      expect(graph.findCycles()).toEqual([]);
    });
  });

  describe('hasPath', () => {
    it('should return true for direct dependency', () => {
      graph.addDependency('q2', 'q1');
      
      expect(graph.hasPath('q2', 'q1')).toBe(true);
    });

    it('should return true for indirect dependency', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      
      expect(graph.hasPath('q3', 'q1')).toBe(true);
    });

    it('should return false when no path exists', () => {
      graph.addDependency('q2', 'q1');
      
      expect(graph.hasPath('q1', 'q2')).toBe(false);
    });

    it('should return true for same node', () => {
      expect(graph.hasPath('q1', 'q1')).toBe(true);
    });

    it('should handle complex paths', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      graph.addDependency('q4', 'q3');
      graph.addDependency('q5', 'q1');
      
      expect(graph.hasPath('q4', 'q1')).toBe(true);
      expect(graph.hasPath('q5', 'q2')).toBe(false);
    });
  });

  describe('getAllNodes', () => {
    it('should return empty array for empty graph', () => {
      expect(graph.getAllNodes()).toEqual([]);
    });

    it('should return all unique nodes', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      graph.addDependency('q3', 'q1');
      
      const nodes = graph.getAllNodes();
      expect(nodes).toHaveLength(3);
      expect(nodes).toContain('q1');
      expect(nodes).toContain('q2');
      expect(nodes).toContain('q3');
    });
  });

  describe('clear', () => {
    it('should clear all dependencies', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      
      graph.clear();
      
      expect(graph.getDependencies('q2')).toEqual([]);
      expect(graph.getDependencies('q3')).toEqual([]);
      expect(graph.getAllNodes()).toEqual([]);
      expect(graph.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty graph', () => {
      expect(graph.size()).toBe(0);
    });

    it('should return number of nodes with dependencies', () => {
      graph.addDependency('q2', 'q1');
      graph.addDependency('q3', 'q2');
      
      expect(graph.size()).toBe(2);
    });
  });
});
