'use client';

import dynamic from 'next/dynamic';

// Dynamically import the 3D components to avoid SSR issues
const NexusLayout = dynamic(
  () => import('@/components/nexus/NexusLayout').then(mod => ({ default: mod.NexusLayout })),
  { 
    ssr: false,
    loading: () => <LoadingScreen />
  }
);

function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center neural-grid">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-holo-cyan to-holo-magenta animate-pulse opacity-50" />
          <div className="absolute inset-2 rounded-xl bg-background flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-holo-cyan to-holo-magenta animate-spin" 
                 style={{ animationDuration: '3s' }} />
          </div>
        </div>
        
        {/* Loading Text */}
        <h1 className="text-2xl font-bold holo-text mb-2">Rey30_NEXUS</h1>
        <p className="text-muted-foreground text-sm mb-4">Motor 3D interactivo</p>
        
        {/* Loading Bar */}
        <div className="w-48 h-1 mx-auto bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-holo-cyan via-holo-magenta to-holo-cyan animate-pulse"
               style={{ 
                 width: '60%',
                 animation: 'loading-bar 1.5s ease-in-out infinite'
               }} />
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">Inicializando motor...</p>
      </div>
      
      <style jsx>{`
        @keyframes loading-bar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  return <NexusLayout />;
}
