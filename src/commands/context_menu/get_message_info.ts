import { Command } from '@sapphire/framework';
import { ApplicationCommandType, EmbedBuilder, MessageType } from 'discord.js';

export class GetMessageInfoMenu extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Get message information.'
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerContextMenuCommand((builder) =>
            builder //
                .setName(this.name)
                .setType(ApplicationCommandType.Message)
        );
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        if (interaction.isMessageContextMenuCommand()) {
            await interaction.deferReply({ ephemeral: false });
            const message = interaction.targetMessage;
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Message Information')
                        .addFields(
                            { name: 'Author', value: message.author.tag, inline: true },
                            { name: 'Created At', value: message.createdAt.toDateString(), inline: true },
                            { name: 'ID', value: message.id, inline: true },
                            { name: 'Type', value: MessageType[message.type], inline: true },
                            { name: 'Content Length', value: `${message.content.length}`, inline: true },
                        )
                ]
            })
        }
    }
}