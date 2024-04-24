import characterJsons from '@data/characters.json';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

export class ClashCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('clash')
                .setDescription('Clash between two classes to test the result.')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        return interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Clash')
                    .addFields({
                        name: 'Attacker',
                        value: '( Not Chosen )',
                        inline: true
                    }, {
                        name: 'Defender',
                        value: '( Not Chosen )',
                        inline: true
                    })
            ],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`select-attacker`)
                            .setPlaceholder('Select an attacker')
                            .addOptions(Object.keys(characterJsons).map(cn => ({ label: cn, value: cn }))),
                    )
            ],
        });
    }
}