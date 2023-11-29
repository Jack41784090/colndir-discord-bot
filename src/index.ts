import { ApplicationCommandRegistries, RegisterBehavior } from "@sapphire/framework";
import bot from "./bot";
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
bot.login(process.env.TOKEN)