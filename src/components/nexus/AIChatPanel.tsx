'use client';

import { useState, useRef, useEffect } from 'react';
import { useNexusStore, ChatMessage } from '@/store/nexus-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';
import { HologramAvatar } from '@/components/hologram/HologramAvatar';

export function AIChatPanel() {
  const { chatMessages, addChatMessage, isAiProcessing, setAiProcessing, setHologramState } = useNexusStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!input.trim() || isAiProcessing) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    addChatMessage({
      role: 'user',
      content: userMessage,
    });

    // Set AI thinking state
    setAiProcessing(true);
    setHologramState({ emotion: 'thinking' });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages.map((m: ChatMessage) => ({
            role: m.role,
            content: m.content,
          })).concat([{ role: 'user', content: userMessage }]),
        }),
      });

      const data = await response.json();

      if (data.success) {
        addChatMessage({
          role: 'assistant',
          content: data.message,
        });
        setHologramState({ emotion: 'happy' });
      } else {
        addChatMessage({
          role: 'assistant',
          content: data.message || 'Lo siento, hubo un error procesando tu solicitud.',
        });
        setHologramState({ emotion: 'neutral' });
      }
    } catch (error) {
      console.error('Chat error:', error);
      addChatMessage({
        role: 'assistant',
        content: 'Error de conexión. Por favor intenta de nuevo.',
      });
      setHologramState({ emotion: 'neutral' });
    } finally {
      setAiProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: 'Crear escena', prompt: 'Crea una escena 3D con un paisaje futurista' },
    { label: 'Añadir personaje', prompt: 'Añade un personaje 3D a la escena' },
    { label: 'Configurar física', prompt: 'Configura la física del juego con gravedad realista' },
    { label: 'Crear partículas', prompt: 'Crea un sistema de partículas para efectos de fuego' },
  ];

  return (
    <div className="flex h-full">
      {/* Hologram Section */}
      <div className="w-1/3 h-full relative border-r border-border/30">
        <HologramAvatar />
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-xs text-muted-foreground">Asistente del motor</p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 mx-auto mb-4 text-holo-cyan" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  ¡Hola! Soy tu asistente
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Tu asistente integrado para el motor de juegos 3D.
                  Puedo ayudarte a crear escenas, personajes, física, y mucho más.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickActions.map((action, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="holo-border text-xs"
                      onClick={() => {
                        setInput(action.prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-holo-cyan/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-holo-cyan" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-holo-magenta/20 text-foreground'
                      : 'bg-secondary/50 text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-holo-magenta/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-holo-magenta" />
                  </div>
                )}
              </div>
            ))}

            {isAiProcessing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-holo-cyan/20 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4 text-holo-cyan" />
                </div>
                <div className="bg-secondary/50 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-holo-cyan" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border/30">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu comando o pregunta..."
              className="bg-secondary/50 border-border/50 focus:border-holo-cyan/50"
              disabled={isAiProcessing}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isAiProcessing}
              className="bg-holo-cyan/20 hover:bg-holo-cyan/30 text-holo-cyan border border-holo-cyan/30"
            >
              {isAiProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
