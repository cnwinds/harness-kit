import type { HarnessToolDefinition, ToolCatalog } from '../types.js';

export const defineTool = (tool: HarnessToolDefinition): HarnessToolDefinition => tool;

export const createToolCatalog = (
  tools: HarnessToolDefinition[] | ((registry: ToolRegistry) => void),
): ToolCatalog => {
  const registry = new ToolRegistry();
  if (typeof tools === 'function') {
    tools(registry);
  } else {
    for (const tool of tools) {
      registry.add(tool);
    }
  }
  return registry;
};

class ToolRegistry {
  private readonly tools = new Map<string, HarnessToolDefinition>();

  add(tool: HarnessToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  list(): HarnessToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): HarnessToolDefinition | undefined {
    return this.tools.get(name);
  }
}

export type { ToolRegistry };
