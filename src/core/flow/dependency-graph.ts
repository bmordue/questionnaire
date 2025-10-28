/**
 * Dependency Graph
 * 
 * Tracks dependencies between questions for conditional logic validation
 */

/**
 * Graph for tracking question dependencies
 */
export class DependencyGraph {
  private dependencies = new Map<string, Set<string>>();
  private reverseDependencies = new Map<string, Set<string>>();

  /**
   * Add a dependency relationship
   * @param dependent - Question that depends on another
   * @param dependency - Question that is depended upon
   */
  addDependency(dependent: string, dependency: string): void {
    if (!this.dependencies.has(dependent)) {
      this.dependencies.set(dependent, new Set());
    }
    this.dependencies.get(dependent)!.add(dependency);

    if (!this.reverseDependencies.has(dependency)) {
      this.reverseDependencies.set(dependency, new Set());
    }
    this.reverseDependencies.get(dependency)!.add(dependent);
  }

  /**
   * Get all dependencies for a question
   */
  getDependencies(node: string): string[] {
    return Array.from(this.dependencies.get(node) || []);
  }

  /**
   * Get all questions that depend on this question
   */
  getDependents(node: string): string[] {
    return Array.from(this.reverseDependencies.get(node) || []);
  }

  /**
   * Find all circular dependencies in the graph
   */
  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of this.dependencies.keys()) {
      if (!visited.has(node)) {
        const cycle = this.detectCycleFromNode(node, visited, recursionStack, []);
        if (cycle) {
          cycles.push(cycle);
        }
      }
    }

    return cycles;
  }

  /**
   * Detect cycle starting from a specific node
   */
  private detectCycleFromNode(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const dependencies = this.dependencies.get(node) || new Set();
    
    for (const dependency of dependencies) {
      if (!visited.has(dependency)) {
        const cycle = this.detectCycleFromNode(dependency, visited, recursionStack, [...path]);
        if (cycle) return cycle;
      } else if (recursionStack.has(dependency)) {
        // Found cycle
        const cycleStart = path.indexOf(dependency);
        return path.slice(cycleStart).concat([dependency]);
      }
    }

    recursionStack.delete(node);
    return null;
  }

  /**
   * Check if there is a path from one node to another
   */
  hasPath(from: string, to: string): boolean {
    if (from === to) return true;

    const visited = new Set<string>();
    const queue = [from];

    let i = 0;
    while (i < queue.length) {
      const current = queue[i++];
      if (current === to) return true;

      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.dependencies.get(current) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Get all nodes in the graph
   */
  getAllNodes(): string[] {
    const nodes = new Set<string>();
    
    for (const node of this.dependencies.keys()) {
      nodes.add(node);
    }
    
    for (const node of this.reverseDependencies.keys()) {
      nodes.add(node);
    }

    return Array.from(nodes);
  }

  /**
   * Clear all dependencies
   */
  clear(): void {
    this.dependencies.clear();
    this.reverseDependencies.clear();
  }

  /**
   * Get total number of dependencies
   */
  size(): number {
    return this.dependencies.size;
  }
}
