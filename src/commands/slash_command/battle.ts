import { Battle } from '@classes/Battle';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { User } from 'discord.js';

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
        
        const battle = await Battle.Create({
            channel: interaction.channel!,
            users: [interaction.user],
            teamMapping: {
                'enemy': [interaction.user],
                'player': [] as User[]
            },
            pvp: true
        })
        battle.startRound();

        return interaction.deleteReply();
    }
}