/**
 * AIToolRegistry.ts
 * Central registry for all AI tools. Each tool is registered once.
 * AICopilotService calls execute() through this registry only.
 */

import type { AITool, AIToolName } from './AITypes';
import { GetFIRTool } from './tools/GetFIRTool';
import { GetKaryvahiTool } from './tools/GetKaryvahiTool';
import { GetCaseDiaryTool } from './tools/GetCaseDiaryTool';
import { GetCourtTool } from './tools/GetCourtTool';
import { GetGDTool } from './tools/GetGDTool';
import { GetKnowledgeTool } from './tools/GetKnowledgeTool';
import { SearchLawTool } from './tools/SearchLawTool';
import { LawLookupTool } from './tools/LawLookupTool';
import { TimelineTool } from './tools/TimelineTool';
import { EvidenceTool } from './tools/EvidenceTool';
import { AnalyticsTool } from './tools/AnalyticsTool';
import { PendingTaskTool } from './tools/PendingTaskTool';
import { GenerateDraftTool } from './tools/GenerateDraftTool';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY = new Map<AIToolName, AITool<any, any>>();
REGISTRY.set(GetFIRTool.name,        GetFIRTool);
REGISTRY.set(GetKaryvahiTool.name,   GetKaryvahiTool);
REGISTRY.set(GetCaseDiaryTool.name,  GetCaseDiaryTool);
REGISTRY.set(GetCourtTool.name,      GetCourtTool);
REGISTRY.set(GetGDTool.name,         GetGDTool);
REGISTRY.set(GetKnowledgeTool.name,  GetKnowledgeTool);
REGISTRY.set(SearchLawTool.name,     SearchLawTool);
REGISTRY.set(LawLookupTool.name,      LawLookupTool);
REGISTRY.set(TimelineTool.name,      TimelineTool);
REGISTRY.set(EvidenceTool.name,      EvidenceTool);
REGISTRY.set(AnalyticsTool.name,     AnalyticsTool);
REGISTRY.set(PendingTaskTool.name,   PendingTaskTool);
REGISTRY.set(GenerateDraftTool.name, GenerateDraftTool);

export class AIToolRegistry {
  static get(name: AIToolName): AITool | undefined {
    return REGISTRY.get(name);
  }

  static async execute(name: AIToolName, input: unknown): Promise<unknown> {
    const tool = REGISTRY.get(name);
    if (!tool) throw new Error(`AI Tool not found: ${name}`);
    return tool.execute(input);
  }

  static listTools(): Array<{ name: AIToolName; description: string }> {
    return Array.from(REGISTRY.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }
}
