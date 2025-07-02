const fs = require('fs');
const { OpenAI } = require('openai');

// Ensure OpenAI is correctly loaded as a constructor for v4+
// This line often causes issues if the module is improperly loaded or an older version persists
// We re-check and ensure it's a function before instantiation

function getOpenAIApiKey() {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    return config.openai_api_key;
}

async function generateVoteDecision({ project1, project2, readme1, readme2 }) {
    const apiKey = getOpenAIApiKey();

    // Explicitly check if OpenAI is callable (a constructor or function)
    if (typeof OpenAI !== 'function') {
        console.error('CRITICAL ERROR: OpenAI is not a valid constructor. Please ensure openai package v4+ is correctly installed.');
        throw new TypeError('OpenAI is not a constructor');
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
You are a judge for a hackathon. Two projects are up for voting:
Project 1: ${project1}
README 1: ${readme1 ? readme1.substring(0, 1000) : 'No README'}
Project 2: ${project2}
README 2: ${readme2 ? readme2.substring(0, 1000) : 'No README'}

Please analyze both projects. Your task is to decide which project is better or if it's a tie. Your decision should be based on technical merit, creativity, and how well the story of its creation is told. Provide a concise explanation for your choice.

Answer ONLY in the following JSON format:
{
  "winner": "project1" | "project2" | "tie",
  "explanation": "Your explanation in 2-3 sentences, in English."
}
`;

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200, // Increased token limit for JSON output
        temperature: 0.7
    });

    let result;
    try {
        result = JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.error("❌ Failed to parse OpenAI response as JSON, attempting to extract:", response.choices[0].message.content);
        // Attempt to extract JSON from text if the model adds extra text
        const match = response.choices[0].message.content.match(/\{[\\s\\S]*\}/);
        if (match) {
            try {
                result = JSON.parse(match[0]);
            } catch (innerError) {
                console.error("❌ Failed to parse extracted JSON:", match[0], innerError);
                throw new Error("OpenAI did not return valid JSON and extraction failed.");
            }
        } else {
            throw new Error("OpenAI did not return valid JSON and no JSON object could be extracted.");
        }
    }
    return result;
}

module.exports = { generateVoteDecision }; 