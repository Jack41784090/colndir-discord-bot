import { Emoji } from '@constants';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { Colors, EmbedBuilder } from 'discord.js';
import { pickRandom } from 'mathjs';

export class ChooseCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('choose')
                .setDescription('Give me options and I\'ll choose one of them for you.')
                .addStringOption((option) =>
                    option
                        .setName('options')
                        .setDescription('Options to choose from. Separate them with space or commas.')
                        .setRequired(true)
                )
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const options = interaction.options.getString('options')!.split(/,|\s+/).filter(Boolean);
        if (options.length < 2) {
            return interaction.editReply('Please provide at least 2 options.');
        }

        const allColors = Object.keys(Colors);
        const choice = options[Math.floor(Math.random() * options.length)];
        const embed = new EmbedBuilder()
            .setTitle(Emoji.THINKING + ' I choose...')
            .setDescription(`## ${choice}`)
            .setColor(Colors[pickRandom(allColors) as keyof typeof Colors])
            .setFooter({ text: `Options were: ${options.join(', ')}` })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
}