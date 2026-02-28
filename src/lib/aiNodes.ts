import type {
  EditNodesSchema,
  EditNodesPipelineContext,
  EditNodesResponse,
  AnswerAboutNodesResponse,
} from '@/types';
import { editNodes, answerAboutNodes } from '@/lib/api';

export async function suggestPipelineForContext(params: {
  nodeIds: string[];
  prompt: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}): Promise<EditNodesResponse> {
  const { nodeIds, prompt, schema, pipelineContext } = params;
  return editNodes({
    nodeIds,
    prompt,
    schema,
    pipelineContext,
  });
}

export async function answerQuestionAboutNodes(params: {
  nodeIds: string[];
  question: string;
  schema?: EditNodesSchema;
  pipelineContext?: EditNodesPipelineContext;
}): Promise<AnswerAboutNodesResponse> {
  const { nodeIds, question, schema, pipelineContext } = params;
  return answerAboutNodes({
    nodeIds,
    question,
    schema,
    pipelineContext,
  });
}

