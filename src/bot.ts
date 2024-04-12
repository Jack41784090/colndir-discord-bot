import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

const bot = new SapphireClient({
    intents: [
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

export default bot;
