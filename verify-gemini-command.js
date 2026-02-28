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

        if (response.includes("```json") && (response.includes("add_transaction") || response.includes("update_manual_config"))) {
            console.log("SUCCESS: JSON command found.");
        } else {
            console.log("FAILURE: No JSON command found.");
        }

        const message2 = "minha renda agora é 6000 e meu patrimônio base é 15000";
        console.log(`\nUser Message 2: "${message2}"`);
        const response2 = await sendMessageToGemini(history, message2, mockContext);
        console.log("\n--- AI Response 2 ---");
        console.log(response2);
        console.log("-------------------\n");

        if (response2.includes("update_manual_config") && response2.includes("6000") && response2.includes("15000")) {
            console.log("SUCCESS: update_manual_config command with correct values found.");
        } else {
            console.log("FAILURE: update_manual_config command mismatch.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

testGeminiCommand();
