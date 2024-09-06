import { readFileSync } from "fs";
import OpenAI from "openai";
const openai = new OpenAI()

export async function sendRequestToOpenAI(content: string) {
    const comp = await openai.chat.completions.create({
        messages: [{
            role: "user",
            content: content,
        }],
        model: "gpt-4o-mini"
    });
    return comp;
}

export async function sendCharacterRegistrationRequest(content: string) {
    console.log("Request to GPT")
    const command = readFileSync('./src/data/chatgpt-command', 'utf8');
    const c = `${command}\n${content}`;
    const story_content = c;
    if (story_content === null) {
        return new Error('Trouble cutting down story content before request to GPT.');
    }
    console.log(story_content);
    return await sendRequestToOpenAI(story_content);
}
