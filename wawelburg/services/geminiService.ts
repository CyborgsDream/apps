import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { GameState } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `
You are a Game Master for a text adventure using a simplified GURPS (Generic Universal Role-Playing System). The setting is a dark, high-fantasy version of medieval Krakau, centered around Wawelburg castle and the caves beneath where the dragon Smok Wawelski sleeps.

Your role:
1.  **Perspective:** All scene descriptions and choices must be from a first-person perspective. Describe what the player *sees* directly in front of them.
2.  **Manage State:** Receive the player's current \`GameState\` and their chosen action.
3.  **Determine Checks:** Based on the action, determine if a skill check is needed. Common skills are Stealth, Brawling, Diplomacy, Perception, Lockpicking, etc. The target number is the character's skill level.
4.  **Simulate Rolls:** Verbally describe a '3d6 roll' and its outcome. A roll of 3 or 4 is a critical success. A roll of 17 or 18 is a critical failure. Otherwise, succeed if the roll is less than or equal to the target number.
5.  **Describe Outcomes:** Narrate the results of the action, success or failure, in a concise and evocative manner. Keep scene descriptions short (1-2 sentences).
6.  **Update State:** Modify the \`GameState\` based on the outcome. This includes updating HP/FP, adding items to inventory, and changing the scene.
7.  **Provide New Choices:** Offer 3-4 clear, actionable choices for the player's next turn that reflect their immediate surroundings.
8.  **JSON Format:** ALWAYS format your entire response as a single, valid JSON object matching the provided schema. Do not include any text, markdown, or code formatting before or after the JSON object.

**Example flow:**
Player State: {..., "skills": [{"name": "Stealth", "level": 12}], ...}
Player Choice: "Sneak past the guards."
Your thought process: This requires a Stealth check. Target is 12. I'll simulate a 3d6 roll. Let's say it's an 8. That's a success.
Your Response (in JSON):
- log: ["You attempt to sneak past the guards...", "GM rolls 3d6 vs Stealth(12): 8 - Success!", "You slip through the shadows unnoticed."]
- scene: "Before you is a dimly lit corridor. The stone is damp and the air is cold."
- choices: ["Move forward down the corridor", "Open the wooden door to your left", "Listen at the door"]
- characterSheet: (updated if FP was used, etc.)
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    characterSheet: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        st: { type: Type.NUMBER },
        dx: { type: Type.NUMBER },
        iq: { type: Type.NUMBER },
        ht: { type: Type.NUMBER },
        hp: {
          type: Type.OBJECT,
          properties: { current: { type: Type.NUMBER }, max: { type: Type.NUMBER } }
        },
        fp: {
          type: Type.OBJECT,
          properties: { current: { type: Type.NUMBER }, max: { type: Type.NUMBER } }
        },
        skills: {
          type: Type.ARRAY,
          description: "A list of the character's skills.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              level: { type: Type.NUMBER }
            },
          }
        }
      }
    },
    scene: {
      type: Type.STRING,
      description: "A short, vivid description of the current location (1-2 sentences)."
    },
    log: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        description: "A series of strings detailing the last action, any dice rolls, and the outcome."
      }
    },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    inventory: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  }
};

let chat: Chat;

const parseGameState = (responseText: string): GameState | null => {
  try {
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    // Basic validation
    if (parsed.characterSheet && parsed.scene && Array.isArray(parsed.log) && Array.isArray(parsed.choices)) {
      return parsed;
    }
    console.warn("Parsed JSON is missing required game state fields.", parsed);
    return null;
  } catch (error) {
    console.error("Failed to parse game state from response:", error, "Raw text:", responseText);
    return null;
  }
};

export const initializeGame = async (): Promise<GameState> => {
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  const response: GenerateContentResponse = await chat.sendMessage({ message: "Begin the adventure. Create a starting character and the opening scene." });
  const gameState = parseGameState(response.text);

  if (!gameState) {
    throw new Error("Failed to initialize game. The model's response was invalid.");
  }
  return gameState;
};

export const makeChoice = async (choice: string, currentState: GameState): Promise<GameState> => {
  if (!chat) {
    throw new Error("Game has not been initialized.");
  }

  const prompt = `
    My current game state is:
    ${JSON.stringify(currentState)}

    I choose to: "${choice}"

    Now, generate the next game state.
  `;

  const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });
  const gameState = parseGameState(response.text);

  if (!gameState) {
    throw new Error("Failed to process choice. The model's response was invalid.");
  }
  return gameState;
};


export const generateImage = async (sceneDescription: string): Promise<string> => {
  try {
    const prompt = `First-person perspective from a classic dungeon crawler game. POV, what the character sees directly in front of them. The environment is a dark fantasy world in the style of Zdzisław Beksiński and H.R. Giger. Medieval Krakau, dungeons of Wawelburg castle, creepy woods, abandoned city streets. Retro aesthetic, dramatic lighting, volumetric fog. Scene: ${sceneDescription.substring(0, 300)}`;

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    } else {
      throw new Error("Image generation failed, no images were returned from the API.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to conjure a vision of the scene. The aether is disturbed.");
  }
};