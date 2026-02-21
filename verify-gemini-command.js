import dotenv from 'dotenv';
dotenv.config();

// Mock localStorage for Node environment
global.localStorage = {
    getItem: (key) => process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
};

import { sendMessageToGemini } from './src/services/gemini.js';

// Mock context similar to what calculateStatsContext returns
const mockContext = `
CONTEXTO FINANCEIRO DO USUÁRIO:
- Mês Atual (2024-05):
  - Entradas: R$ 5000.00
  - Saídas: R$ 2000.00
  - Saldo do Mês: R$ 3000.00
`;

async function testGeminiCommand() {
    console.log("Testing Gemini Command Generation...");
    try {
        const history = [];
        const message = "Gastei 50 reais no McDonalds";

        console.log(`User Message: "${message}"`);
        const response = await sendMessageToGemini(history, message, mockContext);

        console.log("\n--- AI Response ---");
        console.log(response);
        console.log("-------------------\n");

        if (response.includes("```json") && response.includes("add_transaction")) {
            console.log("SUCCESS: JSON command found.");
        } else {
            console.log("FAILURE: No JSON command found.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

testGeminiCommand();
