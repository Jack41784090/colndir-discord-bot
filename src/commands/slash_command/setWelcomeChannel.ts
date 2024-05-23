import { GuildData } from '@ctypes';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { ProfileManager } from '../../class/InteractionHandler';

export class SetWelcomeCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options,
            requiredUserPermissions: PermissionFlagsBits.Administrator
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('set-welcome')
                .setDescription('Set a welcome message for new members')
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('The message to send to new members')
                        .setRequired(false))
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true
        });
        if (interaction.guildId) {
            const message = interaction.options.getString('message');
            const gd: Partial<GuildData> = { welcomeChannelID: interaction.channel?.id };
            if (message) gd.welcomeMessage = message;
            await ProfileManager.SaveGuildData(interaction.guildId, gd);
            return interaction.editReply(`Welcome message set to: ${message??'none'}`);
        }

        return interaction.editReply('Failed to set welcome message: Guild ID not found.')
    }
}