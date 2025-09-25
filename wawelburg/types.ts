export interface CharacterSheet {
  name: string;
  st: number; // Strength
  dx: number; // Dexterity
  iq: number; // Intelligence
  ht: number; // Health
  hp: { current: number; max: number }; // Hit Points
  fp: { current: number; max: number }; // Fatigue Points
  skills: { name: string; level: number }[]; // e.g., [{ name: "Stealth", level: 12 }, { name: "Brawling", level: 11 }]
}

export interface GameState {
  characterSheet: CharacterSheet;
  scene: string; // Shorter description of the immediate surroundings
  log: string[];   // History of events, descriptions, and rolls for the current scene
  choices: string[];
  inventory: string[];
}