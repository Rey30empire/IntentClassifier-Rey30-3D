'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Boxes, User, Sparkles } from 'lucide-react';
import { CharacterBuilderPanel } from './CharacterBuilderPanel';
import { RuntimeAssetLibraryPanel } from '@/components/assets/RuntimeAssetLibraryPanel';

interface CharacterBuilderDialogProps {
  trigger?: React.ReactNode;
}

export function CharacterBuilderDialog({ trigger }: CharacterBuilderDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1.5 text-xs bg-holo-magenta/10 hover:bg-holo-magenta/20 text-holo-magenta border border-holo-magenta/30"
          >
            <User className="w-4 h-4" />
            Character Builder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[1400px] h-[90vh] p-0 gap-0 bg-background border-holo-cyan/30">
        <div className="h-full flex flex-col">
          {/* Header */}
          <DialogHeader className="h-12 border-b border-border/30 flex flex-row items-center justify-between px-4 bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-holo-cyan to-holo-magenta flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-background" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold holo-text">
                  Character Builder
                </DialogTitle>
                <p className="text-[10px] text-muted-foreground">
                  Constructor de Personajes Modulares
                </p>
              </div>
            </div>
          </DialogHeader>
          
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="builder" className="h-full flex flex-col">
              <div className="border-b border-border/30 px-4 py-2 bg-secondary/10">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="builder" className="gap-2">
                    <User className="w-4 h-4" />
                    Builder
                  </TabsTrigger>
                  <TabsTrigger value="library" className="gap-2">
                    <Boxes className="w-4 h-4" />
                    Biblioteca Real
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="builder" className="flex-1 m-0 overflow-hidden">
                <CharacterBuilderPanel />
              </TabsContent>
              <TabsContent value="library" className="flex-1 m-0 overflow-hidden">
                <RuntimeAssetLibraryPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
