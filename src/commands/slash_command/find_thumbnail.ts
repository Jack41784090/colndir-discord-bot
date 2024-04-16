import { ChatInputCommand, Command } from '@sapphire/framework';
import { ChannelType, Colors, EmbedBuilder } from 'discord.js';
import { updateCharacterPost } from '../../util/functions';

export class ThumbnailCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('thumbnail')
                .setDescription('Run this command in a character post and it will look for a thumbnail.')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true }); // async command. Requires a defer in reply in case async takes too long.

        if (interaction.channel?.type !== ChannelType.PublicThread) {
            return interaction.editReply('This command must be run in a public thread.');
        };

        const user = interaction.user;
        const threadChannel = interaction.channel;

        // Create an initial embed with author and footer information
        const embed = new EmbedBuilder()
            .setAuthor({ name: user.username, iconURL: user.avatarURL() || undefined })
            .setFooter({ text: `Finding a thumbnail for ${threadChannel.name}...` });

        // Send an initial response to acknowledge the command
        await interaction.followUp({ embeds: [embed], ephemeral: true });
    
        const updateCall = await updateCharacterPost(threadChannel);
        if (typeof updateCall === 'string') {
            embed.setTitle(updateCall).setColor(Colors.Red);
        }
        else {
            embed.setTitle(`Thumbnail found for ${threadChannel.name}!`).setColor(Colors.Green);
        }

        return interaction.editReply({ embeds: [embed] });
    }
}