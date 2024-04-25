import bot from '@bot';
import { Battle } from '@classes/Battle';
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
        // await interaction.followUp(await addToTeamMessageBlock([], [], []))

        //TEMP
        await interaction.deleteReply();
        const ike = interaction.user;
        const merc = await bot.users.fetch('262871357455466496')
        const b = Battle.Create({
            channel: interaction.channel!,
            users: [merc, ike],
            teamMapping: {
                'enemy': [merc],
                'player': [ike]
            },
            pvp: true
        })
        ;(await b).startRound()
    }
}