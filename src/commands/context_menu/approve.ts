import { GOOGLEDOCS_REGEX, NORM_CHAR_LIMIT } from '@constants';
import { ColndirCharacter } from '@ctypes';
import { cutDownLength, getErrorEmbed, getGoogleDocContent, register, sendRequestToOpenAI } from '@functions';
import { Command } from '@sapphire/framework';
import { log } from 'console';
import { ApplicationCommandType, ChannelType, EmbedBuilder, Message, MessageType, PermissionFlagsBits, TextBasedChannel, TextChannel, ThreadChannel } from 'discord.js';

export class ApproveContextMenu extends Command {
    static GPT_LIMIT = 4097;
    static VALID_CHANNEL_NAMES = ['pending-characters', 'accepted-characters']
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Approve a character from #pending-characters.',
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
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

        if (
            interaction.channel?.type == ChannelType.GuildText &&
            !ApproveContextMenu.VALID_CHANNEL_NAMES.includes((interaction.channel as TextChannel).name) &&
            !interaction.channel?.isThread()
        ) {
            return interaction.followUp(`Approved messages are not in ${ApproveContextMenu.VALID_CHANNEL_NAMES.map(cn => `'${cn}'`).join(' or ')} channel`);
        }

        // fetch original message
        console.log("Fetch origin message")
        const origin_message = await interaction.channel?.messages.fetch(interaction.targetId);
        if (origin_message === undefined) return interaction.followUp({ content: 'Error: content not found.' });

        const story: string[] = [];
        const match = origin_message.content.match(GOOGLEDOCS_REGEX);
        const m2 = match ? match[1] : null;
        const threads = interaction.guild?.channels.cache.filter(c => c.isThread());
        const congregateStory = async (afterID: string, origin: Message<boolean>, channel: TextBasedChannel) => {
            console.log("Fetch messages after origin")
            const corress = await channel.messages.fetch({
                after: afterID,
            });
            if (corress === undefined) return interaction.followUp({ content: "Error: cannot fetch messages afterwards" });
            const related = Array.from(corress.values()).reverse();
            related.unshift(origin);
            for (const m of related) {
                if (m.author.id === origin.author.id) {
                    story.push(m.content);
                }
                else {
                    break;
                }
            }
        }
        let x;
        
        // thread submission
        if (origin_message.type == MessageType.ThreadCreated) {
            log(origin_message.type)
        }
        // thread submission variant
        else if (x = threads?.find(c => c.name === origin_message.content) as ThreadChannel) {
            const tm = await x.messages.fetch();
            const first_message = tm.last();
            if (first_message === undefined) return await interaction.followUp({ embeds: [ getErrorEmbed('First message of thread is nonexistent.') ]});
            await congregateStory(first_message.id, origin_message, x as unknown as TextChannel);
        }
        // google doc submission
        else if (m2) {
            const response = await getGoogleDocContent(m2);
            if (typeof response === 'string') {
                story.push(response);
            }
            else {
                return await interaction.followUp(`Error: ${response?.toString()}\n\`\`\`${response}\`\`\``);
            }
        }
        // fetch messages after origin
        else {
            await congregateStory(origin_message.id, origin_message, interaction.channel!);
        }

        // send request to gpt
        const comp = await sendRequestToOpenAI(story.join('\n'));
        if (typeof comp === 'string') {
            return interaction.followUp({ content: comp });
        }

        // deal with response
        const response = comp.choices[0].message.content;
        if (response === null) return interaction.followUp({ content: 'GPT Error: response not found.' });
        try {
            console.log(response);
            const json_obj = JSON.parse(response);
            const r = await register(interaction.guild!, origin_message.author, json_obj as ColndirCharacter, origin_message);
            if (r instanceof ThreadChannel) {
                return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${r}`)] });
            }
            else {
                return interaction.followUp({ content: cutDownLength(`${r}\ncontent:${response}`, NORM_CHAR_LIMIT) || 'Thread Creation Error. Contact Ike.' });
            }
        }
        catch (e) {
            return interaction.followUp({ content: cutDownLength(`${JSON.stringify(e)}\ncontent:${response}`, NORM_CHAR_LIMIT) || 'Bot encountered an error while parsing GPT response.' });
        }
    }
}