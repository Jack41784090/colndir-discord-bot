import { GuildData } from '@ctypes';
import { SaveGuildData } from '@functions';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

export class SetLeaveCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options, 
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('set-leave')
                .setDescription('Set a leave message for leaving members')
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('The message to send to notify leaving members')
                        .setRequired(false))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true
        });
        if (interaction.guildId) {
            const message = interaction.options.getString('message');
            const gd: Partial<GuildData> = { leaveChannelID: interaction.channel?.id };
            if (message) gd.leaveMessage = message;
            await SaveGuildData(interaction.guildId, gd);
            return interaction.editReply(`Leave message set to: ${message??'none'}`);
        }

        return interaction.editReply('Failed to set leave message: Guild ID not found.')
    }
}