import bot from '@bot';
import { RoleManagement } from '@classes/RoleManagement';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
export class SetUpRoleChannelCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options,
            description: 'Set up a role channel for users to select their roles',
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('set-up-role-channel')
                .setDescription('Set up a role channel for users to select their roles')
                .addStringOption((option) =>
                    option
                        .setName('channel_id')
                        .setDescription('The channelID to set up the role selection')
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('overwrite')
                        .setDescription('Overwrite existing role selection message')
                        .setRequired(false)
                )
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const channelID = interaction.options.getString('channelID') || interaction.channel?.id;
        if (!channelID) {
            return interaction.editReply({ content: "No channel ID provided." });
        }

        const roleManagement = RoleManagement.getInstance();
        const overwrite = interaction.options.getBoolean('overwrite') || false;
        if (overwrite) {
            const existingRoleChannelID = await roleManagement.checkExistingRoleChannel(interaction.guildId ?? '');
            const existingRoleChannel = interaction.guild?.channels.cache.get(existingRoleChannelID??'');
            if (existingRoleChannel && existingRoleChannel.isTextBased()) {
                const botMessages = await existingRoleChannel.messages.fetch();
                botMessages.forEach(m => m.author.id === bot.user?.id && m.delete());
            }
        }

        const result = await roleManagement.setUpRoleChannel(channelID);
        if (result instanceof Error) {
            return interaction.editReply({ content: result.message });
        }
        return interaction.deleteReply();
    }
}