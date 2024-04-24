import { addToTeamMessageBlock } from '@functions';
import { ChatInputCommand, Command } from '@sapphire/framework';

export class StartBattleCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('start-battle')
                .setDescription('Start a battle')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();
        await interaction.followUp(await addToTeamMessageBlock([], [], []))
    }
}