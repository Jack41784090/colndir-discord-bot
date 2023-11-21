import { ChatInputCommand, Command } from '@sapphire/framework';

export class Clear extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('clear')
                .setDescription('Ping bot to see if it is alive')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const messages = await interaction.channel?.messages.fetch({ limit: 100, before: interaction.id })

        if (messages) {
            for (const message of messages.values()) {
                await message.delete().catch(console.error);
            }
        }

        return interaction.deleteReply();
    }
}