import { ProfileManager } from '@classes/InteractionHandler';
import { GuildData, ProfileInteractionType, ProfileType } from '@ctypes';
import { getErrorMessage } from '@functions';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

export class SetApproveCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options, 
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('set-approved')
                .setDescription('Set this channel as the channel to approve characters.'));
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true
        });
        if (interaction.guildId) {
            const setApproveGuildDataAccess = await ProfileManager.Register(ProfileType.Guild, interaction.guildId, ProfileInteractionType.Default);
            if (setApproveGuildDataAccess instanceof Error) {
                return interaction.editReply(getErrorMessage(`Registration failure: ${setApproveGuildDataAccess.message}`));
            }

            const guildData = setApproveGuildDataAccess.profile.data as GuildData;
            guildData.approvedChannelID = interaction.channelId;
            return interaction.editReply('Channel set as the approved channel.');
        }

        return interaction.editReply('Failed to set leave message: Guild ID not found.')
    }
}