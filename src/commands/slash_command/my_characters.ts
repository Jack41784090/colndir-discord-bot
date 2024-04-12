import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import { GetData } from '../../util/database';

export class MyCharactersCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('mycharacter')
                .setDescription('List my characters.')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply(); // async command. Requires a defer in reply in case async takes too long.

        const ud = await GetData('User', interaction.user.id);
        if (!ud) return interaction.followUp({ content: 'You have no characters.' });

        const embed = new EmbedBuilder({
            author: {
                name: interaction.user.username,
                icon_url: interaction.user.avatarURL() || undefined
            },
            title: 'Your Characters',
            description: `${ud.characters.map((c: Record<string, string>) => `\n- ${c['thread']}`).join('')}`,
        });

        return interaction.editReply({ embeds: [embed] });
    }
}