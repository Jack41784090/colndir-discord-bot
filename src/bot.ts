import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

const bot = new SapphireClient({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
    ]
});

bot.once('ready', () => {
    console.log(`Logged in as ${bot.user?.tag}!`);
})

export default bot;
