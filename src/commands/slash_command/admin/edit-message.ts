import { ChatInputCommand, Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';

// [COMMAND NAME]: [DESCRIPTION]
export class TESTCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'This is the normal description',
            detailedDescription: 'This is the detailed description',
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('edit-message')
                .setDescription('Ping bot to see if it is alive')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();
        await interaction.followUp('Pong!');
    }
}