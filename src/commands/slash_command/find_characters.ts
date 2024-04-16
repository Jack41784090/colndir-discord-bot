import { ChatInputCommand, Command } from '@sapphire/framework';
import { ChannelType, EmbedBuilder, Guild, Message, PermissionFlagsBits, Snowflake, ThreadChannel } from 'discord.js';
import bot from '../../bot';
import { fetchAllMessages } from '../../util/functions';
import { getGoogleDocContent } from '../../util/googledocs';
import { sendRequestToOpenAI } from '../../util/openai';
import { register } from '../../util/register';
import { Character, GOOGLEDOCS_REGEX } from '../../util/typedef';

export class FindCharactersCommand extends Command {
    public static readonly SUBMISSION_LENGTH_MIN = 600;

    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('find-characters')
                .setDescription('Find character submissions in a channel.')
        );
    }

    private async registerGoogleSubmissions(documentId: string, message: Message, guild: Guild) {
        const doc = await getGoogleDocContent(documentId);
        if (typeof doc === 'string') {
            const gpt = await sendRequestToOpenAI(doc);
            if (typeof gpt === 'string') {
                return (`Failed to process ${message.author.username}'s Google submission.`);
            }
            const res = JSON.parse(gpt.choices[0].message.content!) as Character;
            return await register(guild, message.author, res, message, false);
        }
        else {
            return (`Failed to fetch ${message.author.username}'s Google submission.`);
        }
    }

    private async registerTextSubmissions(s: [Snowflake, Snowflake, string], message: Message, guild: Guild) {
        const id = s[0];
        const messageID = s[1];
        const content = s[2];
        const user = await bot.users.fetch(id);
        if (user && message) {
            const chatGPT = await sendRequestToOpenAI(content);
            if (typeof chatGPT === 'string') {
                return `ChatGPT failure. Failed to process ${user.username}'s submission.`
            }
            const response = chatGPT.choices[0].message.content!;
            const char = JSON.parse(response) as Character;
            return await register(guild, user, char, message, false);
        }
        else {
            return `Failed to fetch user ${id} or message ${messageID}.`
        }
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false }); // async command. Requires a defer in reply in case async takes too long.

        if (interaction.channel?.type !== ChannelType.GuildText) {
            return interaction.editReply('This command must be run in a public thread.');
        };
        if (!interaction.guild) {
            return interaction.editReply('This command must be run in a guild.');
        }

        const user = interaction.user;
        const submissionChannel = interaction.channel;
        const messages = await fetchAllMessages(submissionChannel);

        // Filter Google messages
        const googleMatch = (m: Message) => m.content.match(GOOGLEDOCS_REGEX);
        const googleMessages = messages.filter(m => googleMatch(m))

        // Filter text submissions
        const mergedMessages = messages.reduce((acc, curr, index, array) => {
            if (index === 0 || array[index - 1].author.id !== curr.author.id) {
                acc.push( [curr.author.id, curr.id, curr.content] );
            } else {
                acc[acc.length - 1][2] += curr.content;
            }
            return acc;
        }, [] as [Snowflake, Snowflake, string][]);
        const textSubmissionMatch = (s: [Snowflake, Snowflake, string]) => s[2].length > FindCharactersCommand.SUBMISSION_LENGTH_MIN;
        const characterSubmissions = mergedMessages.filter(textSubmissionMatch);
        
        const successes: ThreadChannel[] = [];
        const fails: string[] = [];
        // Deal with text submissions
        for (const s of characterSubmissions) {
            const r = await this.registerTextSubmissions(s, messages.find(m => m.id === s[1])!, interaction.guild);
            if (typeof r === 'string') {
                fails.push(r);
            }
            else {
                successes.push(r);
            }
        }

        // Deal with Google submissions
        for (const m of googleMessages) {
            const r = await this.registerGoogleSubmissions(m.content.match(GOOGLEDOCS_REGEX)![1], m, interaction.guild);
            if (typeof r === 'string') {
                fails.push(r);
            }
            else {
                successes.push(r);
            }
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: user.username, iconURL: user.avatarURL() || undefined })
            .setTitle('Character submissions found!')
            .addFields({
                name: 'Successes',
                value: `${successes}` || 'None',
                inline: true
            }, {
                name: 'Failures',
                value: fails.join('\n') || 'None',
                inline: true
            })
            .setFooter({ text: `Finding all character submissions in [${submissionChannel.name}]...` });

        // Send an initial response to acknowledge the command
        await interaction.followUp({ embeds: [embed] });

        // const updateCall = await findThumbnail(submissionChannel);
        // if (typeof updateCall === 'string') {
        //     embed.setTitle(updateCall).setColor(Colors.Red);
        // }
        // else {
        //     embed.setTitle(`Thumbnail found for ${submissionChannel.name}!`).setColor(Colors.Green);
        // }
    }
}