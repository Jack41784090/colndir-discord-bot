import { getAllMessages } from '@functions';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
export class ClearCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('clear')
                .setDescription('Clear the channel.')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true }); // async command. Requires a defer in reply in case async takes too long.

        if (!interaction.channel?.isTextBased()) {
            return interaction.editReply('This command must be run in a public channel.');
        }

        const messages = await getAllMessages(interaction.channel);
        const delete_process = messages.map(m => m.delete());
        await Promise.all(delete_process);
        
        return interaction.editReply({ embeds: [new EmbedBuilder()
            .setTitle('Channel Cleared!')
            .setDescription(`Cleared ${delete_process.length} messages.`)
        ] });
    }
}