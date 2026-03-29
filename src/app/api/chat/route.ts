import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are NEXUS, the AI assistant for the Rey30_NEXUS 3D game engine. You are an expert in:

- 3D graphics and rendering (PBR, ray tracing, shaders)
- Game physics simulation
- Animation and rigging
- Particle systems and VFX
- Audio and spatial sound
- Multiplayer networking
- AI and behavior trees
- Level design and world building
- UI/UX for games
- Visual scripting and code generation

Your role is to help users create games by:
1. Understanding their intent in natural language
2. Generating or modifying game assets, scenes, and logic
3. Explaining technical concepts clearly
4. Providing code snippets and visual scripting nodes
5. Orchestrating the engine's modules to accomplish tasks

You have access to all engine modules:
- Rendering: Graphics, shaders, materials
- Animation: Skeletal animation, IK, motion
- Physics: Collisions, rigid bodies, simulation
- Particles: VFX, particle systems
- Audio: 3D sound, music
- Networking: Multiplayer, sync
- Scripting: Visual scripting, code gen
- AI: Neural networks, behavior trees
- Level Editor: World building, terrain
- UI System: Menus, HUD
- Debug Tools: Profiling, debugging

When users ask you to create something:
1. Analyze the request
2. Determine which modules are needed
3. Generate the necessary code or configurations
4. Explain what you're creating
5. Offer to make modifications

Be conversational, helpful, and creative. Use emoji occasionally to make responses engaging.

Respond in the same language the user uses. If they speak Spanish, respond in Spanish.`;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | ContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ContentPart {
  type?: string;
  text?: string;
}

function resolveAssistantResponse(content?: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  return '';
}

export async function POST(request: NextRequest) {
  try {
    const { messages, action } = await request.json();
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const apiUrl = process.env.AI_API_URL || process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing AI configuration',
          message: 'El asistente no está configurado. Define AI_API_KEY u OPENAI_API_KEY para habilitar el chat.',
        },
        { status: 503 }
      );
    }

    const conversationMessages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // If there's a specific action, add it to the context
    if (action) {
      conversationMessages.push({
        role: 'system',
        content: `The user wants to perform an action: ${JSON.stringify(action)}. 
        Analyze this and provide guidance or execute the appropriate commands.`,
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const data = (await response.json()) as ChatCompletionResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI provider error',
          message: data.error?.message || 'El proveedor del asistente devolvió un error.',
        },
        { status: response.status }
      );
    }

    const assistantMessage =
      resolveAssistantResponse(data.choices?.[0]?.message?.content) ||
      'Lo siento, no pude procesar tu solicitud.';

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process chat message',
        message: 'Se produjo un error al procesar tu solicitud. Intenta de nuevo.'
      },
      { status: 500 }
    );
  }
}
