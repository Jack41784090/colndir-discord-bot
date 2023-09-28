import { ApplicationCommandRegistries, RegisterBehavior } from "@sapphire/framework";
import dotenv from 'dotenv';
import bot from "./bot";
dotenv.config();
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
bot.login(process.env.TOKEN)