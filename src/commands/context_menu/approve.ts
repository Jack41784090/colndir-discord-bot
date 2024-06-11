import { ProfileManager } from '@classes/InteractionHandler';
import { GOOGLEDOCS_REGEX, NORM_CHAR_LIMIT } from '@constants';
import { ColndirCharacter, GuildData, ProfileInteractionType, ProfileType } from '@ctypes';
import { cutDownLength, getAllMessages, getAllThreads, getConsecutiveMessages as getConsecutiveAuthorMessages, getErrorMessage, getGoogleDocContent, register, sendCharacterRegistrationRequest } from '@functions';
import { Command } from '@sapphire/framework';
import ansiColors from 'ansi-colors';
import { ApplicationCommandType, EmbedBuilder, Message, PermissionFlagsBits, TextChannel, ThreadChannel } from 'discord.js';

class ApproveError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = 'ApproveError';
    }
}

export class ApproveContextMenu extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Approve a character from #pending-characters.',
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    private async googleSubmission(originMessage: Message) {
        const match = originMessage.content.match(GOOGLEDOCS_REGEX);
        const m2 = match ? match[1] : null;
        return m2?
            (await getGoogleDocContent(m2) ?? new ApproveError('Error fetching Google Docs content.')):
            new ApproveError('Google Docs link not found.');
    }

    private async threadSubmission(interaction: Command.ContextMenuCommandInteraction, originMessage: Message) {
        const guildThreads = await getAllThreads(interaction.guild!);
        const existing = guildThreads.find(c => c && c.isThread() && c.name === originMessage.content);
        if (!existing) return new ApproveError('Thread not found.');
        
        const allMessages = await getAllMessages(existing);
        const firstMessage = allMessages[0];
        if (firstMessage === undefined) return new ApproveError('Thread has no messages.');
        
        const story = await getConsecutiveAuthorMessages(firstMessage.id, originMessage, interaction.channel as TextChannel);
        if (!story) return new ApproveError('Error fetching messages.');

        return story.map(m => m.content).join('\n');
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

        if (interaction.channel?.isTextBased() == false) {
            return interaction.followUp(getErrorMessage('This command only works in text-based channels.'));
        }

        // 0. Register for GuildData access
        const guildDataAccessEvent = await ProfileManager.Register(ProfileType.Guild, interaction.guildId!, ProfileInteractionType.Default);
        if (guildDataAccessEvent instanceof Error) {
            return interaction.followUp(getErrorMessage(guildDataAccessEvent.message));
        }
        const guildData = guildDataAccessEvent.profile.data as GuildData;

        const validChannels = [guildData.approvedChannelID, guildData.pendingChannelID];
        if (validChannels.every(id => id !== interaction.channelId)) {
            return interaction.followUp(getErrorMessage(`Approved messages are not in ${
                interaction.guild?.channels.cache.get(guildData.approvedChannelID)?.toString() || 'approved channel'
            } or ${
                interaction.guild?.channels.cache.get(guildData.pendingChannelID)?.toString() || 'pending channel'
            } channel`));
        }
        
        console.log(ansiColors.bold(`Approving character...`))

        // 1. Fetch origin message
        console.log("1. Fetch origin message...")
        const originalMessage = await interaction.channel.messages.fetch(interaction.targetId);
        if (originalMessage === undefined) {
            console.log(ansiColors.red(`|| Error: cannot fetch original message.`))
            return interaction.followUp(getErrorMessage('Error: cannot fetch original message.'));
        }

        // 1.1 Register profile for User access
        const userDataAccessEvent = await ProfileManager.Register(ProfileType.User, originalMessage.author.id, ProfileInteractionType.Default);
        if (userDataAccessEvent instanceof Error) {
            return interaction.followUp(getErrorMessage(userDataAccessEvent.message));
        }


        // 2. Fetch story
        guildDataAccessEvent.Activity();
        userDataAccessEvent.Activity();
        let story;
        if ((story = await this.googleSubmission(originalMessage)) && !(story instanceof ApproveError)) {
            console.log("2.2. Google submission...")
        }
        else if ((story = await this.threadSubmission(interaction, originalMessage)) && !(story instanceof ApproveError)) {
            console.log("2.1. Thread submission...")
        }
        else {
            console.log("2.3. Direct submission...")
            const consecutiveMes = await getConsecutiveAuthorMessages(originalMessage.id, originalMessage, interaction.channel as TextChannel);
            if (!consecutiveMes) {
                console.log(ansiColors.red(`|| Error: cannot fetch consecutive messages.`));
                return interaction.followUp(getErrorMessage('Error: cannot fetch consecutive messages.'));
            }
            story = consecutiveMes.map(m => m.content).join('\n') ?? ''; 
        }

        if ( story instanceof Error) {
            console.log(ansiColors.red(`|| Error: ${typeof story === 'string' ? story : (story as Error).message}`));
            const errorMessage = typeof story === 'string' ? story : (story as Error).message;
            return interaction.followUp(getErrorMessage(errorMessage ?? "Story returned an empty string."));
        }

        // 3. send request to gpt
        const comp = await sendCharacterRegistrationRequest(story);
        if (comp instanceof Error) {
            console.error(comp);
            return interaction.followUp(getErrorMessage(comp.message));
        }

        // deal with response
        const response = comp.choices[0].message.content;
        if (response === null) {
            console.log(ansiColors.red(`|| Error: GPT response is null.`));
            return interaction.followUp(getErrorMessage('Error: GPT response is null.'));
        }
        try {
            console.log(response);
            const json_obj = JSON.parse(response);
            const r = await register({
                guild: interaction.guild!,
                concerningUser: originalMessage.author,
                character: json_obj as ColndirCharacter,
                originalMessage
            });
            if (r instanceof ThreadChannel) {
                return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${r}`)] });
            }
            else {
                return interaction.followUp({
                    content: cutDownLength(`${r}\ncontent:${response}`, NORM_CHAR_LIMIT ) || 'Thread Creation Error. Contact Ike.' });
            }
        }
        catch (e) {
            return interaction.followUp(getErrorMessage(cutDownLength(
                `${(e)}\ncontent:${response}`, NORM_CHAR_LIMIT) ||
                'Bot encountered an error while parsing GPT response.'
            ));
        }
    }
}