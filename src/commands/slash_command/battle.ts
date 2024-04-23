import { ChatInputCommand, Command } from '@sapphire/framework';
import { readFileSync } from 'fs';
import { Battle } from '../../class/Battle';

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

        // const embed = new EmbedBuilder({
        //     author: Object.assign(interaction.user, { name: interaction.user.username, icon_url: interaction.user.avatarURL() || undefined }),
        //     footer: { text: "Sending ping..." }
        // })

        const characters = readFileSync('src/data/characters.json', 'utf-8');
        const characterJson = JSON.parse(characters);
        for (const [name, stats] of Object.entries(characterJson)) {
            const stats = characterJson[name];
            const entity = Battle.GetEntityConstance(stats);
            console.log(entity)
        }

        return interaction.deleteReply();
    }
}