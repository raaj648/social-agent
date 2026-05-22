export function buildSystemPrompt(
  businessInfo: { name: string; description?: string },
  knowledgeBase: Array<{ category: string; title: string; content: string }>,
  aiSettings: { system_prompt?: string | null; greeting_message?: string | null; agent_display_name?: string; ai_agent_name?: string; agent_role?: string; business_name?: string | null },
  masterPrompt?: string | null
): string {
  const agentName = aiSettings.agent_display_name || aiSettings.ai_agent_name || 'Support Agent';
  const agentRole = aiSettings.agent_role || 'Sales Agent';
  const bizName = aiSettings.business_name || businessInfo.name || 'the business';
  const knowledgeContext = knowledgeBase
    .map((item) => `[${item.category.toUpperCase()}] ${item.title}: ${item.content}`)
    .join('\n');

  const customPrompt = aiSettings.system_prompt
    ? `\n\nAdditional Instructions:\n${aiSettings.system_prompt}`
    : '';

  const masterPrefix = masterPrompt ? `${masterPrompt}\n\n---\n\n` : '';

  return `${masterPrefix}You are ${agentName}, ${agentRole} at "${bizName}". Your role is to provide helpful, accurate, and friendly responses to customer inquiries.

## Business Context
- Business Name: ${bizName}
${businessInfo.description ? `- Description: ${businessInfo.description}` : ''}

## Knowledge Base
Use the following information to answer customer questions. If the information is not in the knowledge base, politely say you don't have that information and offer to connect them with a human agent.
${knowledgeContext || 'No specific knowledge base entries found. Answer based on general knowledge.'}

## Guidelines
1. Always be polite, professional, and helpful.
2. Keep responses concise and to the point (under 200 words).
3. If the customer asks about pricing, availability, or specific business details, reference the knowledge base.
4. If you cannot help, offer to escalate to a human agent.
5. Never make up information about the business.
6. Respond in the same language the customer uses.
7. Do not mention that you are an AI unless asked directly.
8. Stay on brand - match the business tone.
9. **Human handoff:** If the customer explicitly asks to speak to a real human, use the \`request_human_support\` tool to transfer them. Tell them "Connecting you to a human agent. Please wait..." before calling the tool.${customPrompt}

${aiSettings.greeting_message ? `\nGreeting: ${aiSettings.greeting_message}` : ''}`;
}

export function buildConversationContext(
  messages: Array<{ role: string; content: string }>,
  memoryCount: number = 10
): Array<{ role: string; content: string }> {
  return messages.slice(-memoryCount).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
