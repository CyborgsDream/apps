import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, CharacterSheet } from './types';
import { initializeGame, makeChoice, generateImage } from './services/geminiService';

const ImageLoadingSpinner: React.FC = () => (
    <div className="text-center text-gray-400">
        <svg className="animate-spin h-12 w-12 text-amber-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg italic animate-pulse font-mono">Conjuring a vision...</p>
    </div>
);

const StatBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="bg-gray-700 h-2 w-full border border-gray-600">
        <div className={color} style={{ width: `${percentage}%`, height: '100%' }}></div>
      </div>
    </div>
  );
};

const CharacterSheetDisplay: React.FC<{ sheet: CharacterSheet | null }> = ({ sheet }) => {
  if (!sheet) return null;

  return (
    <div className="font-mono text-amber-300 p-3 border border-dashed border-amber-500/50 bg-black/30 h-full flex flex-col">
      <h3 className="text-center text-lg mb-2 text-amber-100 border-b border-amber-500/50 pb-1">ADVENTURER</h3>
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
          <div><span className="text-gray-400">ST</span><br/>{sheet.st}</div>
          <div><span className="text-gray-400">DX</span><br/>{sheet.dx}</div>
          <div><span className="text-gray-400">IQ</span><br/>{sheet.iq}</div>
          <div><span className="text-gray-400">HT</span><br/>{sheet.ht}</div>
      </div>
      <div className="space-y-2 mb-3">
          <StatBar label="HP" value={sheet.hp.current} max={sheet.hp.max} color="bg-red-500" />
          <StatBar label="FP" value={sheet.fp.current} max={sheet.fp.max} color="bg-blue-500" />
      </div>
      <div className="flex-grow overflow-y-auto">
        <h4 className="text-gray-400">SKILLS:</h4>
        <ul className="text-sm">
          {sheet.skills.map((skill) => (
            <li key={skill.name} className="flex justify-between">
              <span>{skill.name}</span>
              <span>{skill.level}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const GameLog: React.FC<{ log: string[], scene: string }> = ({ log, scene }) => {
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [log, scene]);

    return (
        <div className="font-mono text-gray-200 p-3 border border-dashed border-amber-500/50 bg-black/30 h-full overflow-y-auto text-sm leading-relaxed">
            <p className="text-amber-200 italic mb-2">{scene}</p>
            {log.map((entry, index) => (
                <p key={index} className="whitespace-pre-wrap animate-[fadeIn_0.5s_ease-in-out]">{`> ${entry}`}</p>
            ))}
            <div ref={logEndRef} />
        </div>
    );
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  const startGame = useCallback(async () => {
    setIsLoading(true);
    setIsImageLoading(true);
    setError(null);
    setGameState(null);
    setImageUrl('');
    try {
      const initialState = await initializeGame();
      setGameState(initialState);
      setIsLoading(false);
      
      const newImageUrl = await generateImage(initialState.scene);
      setImageUrl(newImageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      setIsLoading(false);
    } finally {
      setIsImageLoading(false);
    }
  }, []);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const handleChoice = async (choice: string) => {
    if (!gameState || isLoading) return;
    setIsLoading(true);
    setError(null);
    
    const currentImage = document.getElementById('scene-image');
    if (currentImage) {
      currentImage.style.opacity = '0.5';
    }

    try {
      const nextState = await makeChoice(choice, gameState);
      setGameState(nextState);
      
      setIsImageLoading(true); 
      generateImage(nextState.scene)
        .then(newImg => setImageUrl(newImg))
        .catch(imgErr => console.error("Image generation failed for this step:", imgErr))
        .finally(() => setIsImageLoading(false));

    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen bg-black text-gray-200 flex flex-col antialiased">
      {/* Visuals Pane */}
      <div className="w-full h-1/2 bg-black p-4 sm:p-6 flex items-center justify-center border-b-8 border-stone-800 shadow-lg relative">
        <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden shadow-inner-strong border-4 border-stone-900 ring-2 ring-black">
            {isImageLoading && <ImageLoadingSpinner />}
            {imageUrl && !isImageLoading && (
              <img 
                id="scene-image"
                key={imageUrl}
                src={imageUrl} 
                alt="First-person view of the scene" 
                className="w-full h-full object-cover transition-opacity duration-500" 
                style={{ opacity: 1 }}
              />
            )}
        </div>
        <header className="absolute top-0 left-0 p-4 w-full bg-gradient-to-b from-black/70 to-transparent z-10">
          <h1 className="font-title text-3xl sm:text-4xl font-bold text-amber-300 tracking-wider text-center">
              Wawelburg Chronicles
          </h1>
        </header>
      </div>
      
      {/* UI Pane */}
      <div className="w-full h-1/2 bg-gray-950 p-2 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 font-mono">
        <div className="md:col-span-1 h-full">
            <CharacterSheetDisplay sheet={gameState?.characterSheet || null} />
        </div>
        <div className="md:col-span-2 h-full flex flex-col gap-2 sm:gap-4">
            <div className="flex-grow h-32">
                {gameState && <GameLog log={gameState.log} scene={gameState.scene} />}
            </div>
            <div className="flex-shrink-0 p-3 border border-dashed border-amber-500/50 bg-black/30">
                <h3 className="text-amber-100 mb-2 text-sm">WHAT DO YOU DO?</h3>
                {isLoading && <p className="text-amber-200 animate-pulse">The dragon ponders your fate...</p>}
                {error && (
                    <div>
                        <p className="text-red-400">An ill omen! {error}</p>
                        <button onClick={startGame} className="text-amber-300 mt-2 hover:underline">Tempt Fate Again</button>
                    </div>
                )}
                {!isLoading && !error && gameState && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        {gameState.choices.map((choice, index) => (
                          <button
                            key={index}
                            onClick={() => handleChoice(choice)}
                            className="text-left text-amber-200 hover:text-white hover:bg-amber-800/50 p-1 rounded transition-colors"
                          >
                            {`[${index + 1}] ${choice}`}
                          </button>
                        ))}
                      </div>
                )}
            </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .shadow-inner-strong {
           box-shadow: inset 0 0 25px 15px rgba(0,0,0,0.8);
        }
        /* Custom scrollbar for a more thematic feel */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #111827; /* gray-900 */
        }
        ::-webkit-scrollbar-thumb {
          background: #4b5563; /* gray-600 */
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #d97706; /* amber-600 */
        }
      `}</style>
    </main>
  );
};

export default App;