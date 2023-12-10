import { Command } from '@sapphire/framework';
import { ApplicationCommandType, EmbedBuilder, PermissionFlagsBits, TextChannel, ThreadChannel } from 'discord.js';
import { readFileSync } from 'fs';
import OpenAI from 'openai';
import { getGoogleDoc } from '../util/database';
import { cutDownLength, getErrorEmbed } from '../util/functions';
import { register } from '../util/register';
import { Character } from '../util/typedef';
import { RegisterCommand } from './register/register';

export class ApproveCommand extends Command {
    static GPT_LIMIT = 4097;
    static VALID_CHANNEL_NAMES = ['pending-characters', 'accepted-characters']
    openai: OpenAI;
    // init_step: Promise<unknown>[];
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Approve a character from #pending-characters.',
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
        this.openai = new OpenAI()
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerContextMenuCommand((builder) =>
            builder //
                .setName(this.name)
                .setType(ApplicationCommandType.Message)
        );
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        await interaction.deferReply();

        if (!ApproveCommand.VALID_CHANNEL_NAMES.includes((interaction.channel as TextChannel).name)) {
            return interaction.followUp(`Approved messages are not in ${ApproveCommand.VALID_CHANNEL_NAMES.map(cn => `'${cn}'`).join(' or ')} channel`);
        }

        // fetch original message
        console.log("Fetch origin message")
        const origin_message = await interaction.channel?.messages.fetch(interaction.targetId);
        if (origin_message === undefined) return interaction.followUp({ content: 'Error: content not found.' });

        const story: string[] = [];
        const googleDocsRegex = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit/i;
        const match = origin_message.content.match(googleDocsRegex);
        const m2 = match ? match[1] : null;
        // google doc submission
        if (m2) {
            const response = await getGoogleDoc(m2);
            if (response instanceof Response) {
                if (response.status === 200) {
                    story.push(await response.text());
                }
                else {
                    return await interaction.followUp(`Error: Cannot reach the requested document: ${response.status} (meaning: [${response.statusText}])`);
                }
            }
            else {
                return await interaction.followUp(`Error: ${response?.toString()}\n\`\`\`${response}\`\`\``);
            }
        }
        // not google doc, fetch messages after origin
        else {
            console.log("Fetch messages after origin")
            const corress = await interaction.channel?.messages.fetch({
                after: origin_message.id,
            });
            if (corress === undefined) return interaction.followUp({ content: "Error: cannot fetch messages afterwards" });
            const related = Array.from(corress.values()).reverse();
            related.unshift(origin_message);
            for (const m of related) {
                if (m.author.id === origin_message.author.id) {
                    story.push(m.content);
                }
                else {
                    break;
                }
            }
        }

        // send request to gpt
        console.log("Request to GPT")
        const command = readFileSync('./src/data/chatgpt-command', 'utf8');
        const story_content = cutDownLength(`${command}\n\n${story.join('\n')}`, ApproveCommand.GPT_LIMIT);
        if (story_content === null) {
            return interaction.followUp({ embeds: [getErrorEmbed('Trouble cutting down story content before request to GPT.')] });
        }
        console.log(story_content);
        const comp = await this.openai.chat.completions.create({
            messages: [{
                role: "user",
                content: story_content,
            }],
            model: "gpt-3.5-turbo"
        });

        // deal with response
        const response = comp.choices[0].message.content;
        if (response === null) return interaction.followUp({ content: 'GPT Error: response not found.' });
        try {
            console.log(response);
            const json_obj = JSON.parse(response);
            const r = await register(interaction.guild!, origin_message.author, json_obj as Character, origin_message);
            if (r instanceof ThreadChannel) {
                return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${r}`)] });
            }
            else {
                return interaction.followUp({ content: cutDownLength(`${r}\ncontent:${response}`, RegisterCommand.DESCRIPTION_LIMIT) || 'Thread Creation Error. Contact Ike.' });
            }
        }
        catch (e) {
            return interaction.followUp({ content: cutDownLength(`${JSON.stringify(e)}\ncontent:${response}`, RegisterCommand.DESCRIPTION_LIMIT) || 'Bot encountered an error while parsing GPT response.' });
        }
    }
}