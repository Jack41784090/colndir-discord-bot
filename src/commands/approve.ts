import { Command } from '@sapphire/framework';
import { ApplicationCommandType, EmbedBuilder, PermissionFlagsBits, TextChannel, ThreadChannel } from 'discord.js';
import OpenAI from 'openai';
import { getGoogleDoc } from '../util/database';
import { register } from '../util/register';
import { Character } from '../util/typedef';

export class ApproveCommand extends Command {
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
        console.log(story.join('\n'));

        // send request to gpt
        console.log("Request to GPT")
        const command = "Summarise the NAME, ALIAS, AGE, SEX, ETHNICITY, HEIGHT, WEIGHT, RACE, AFFILIATION, ALIGNMENT, POWERS AND ABILITIES, EQUIPMENT, BACKGROUND, and PERSONALITY TRAITS of this character. Return your message only in a json object. Make sure the keys are capitalised. Use only string-type values. Here's the character:"
        const story_content = story.join('\n');
        const comp = await this.openai.chat.completions.create({
            messages: [{
                role: "user",
                content: `${command}\n\n${story_content}`,
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
                return interaction.followUp({ content: `${r}\ncontent:${response}` });
            }
        }
        catch (e) {
            return interaction.followUp({ content: `${JSON.stringify(e)}\ncontent:${response}` });
        }
    }
}