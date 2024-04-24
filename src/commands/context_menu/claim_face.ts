import { ColndirCharacter } from '@ctypes';
import { GetData } from '@functions';
import { Command } from '@sapphire/framework';
import { ActionRowBuilder, ApplicationCommandType, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';

export class ClaimFaceContextMenu extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Delete message and ban author.'
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
        await interaction.deferReply({ ephemeral: true });
        if (interaction.isMessageContextMenuCommand()) {
            const uid = await GetData('User', interaction.user.id);
            if (uid == undefined) return interaction.editReply('You do not have characters.');

            const chars: ColndirCharacter[] = uid['characters'];
            return interaction.followUp({
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`claim-face-menu_${interaction.targetId}`)
                                .setPlaceholder('Select a character')
                                .addOptions(Array.from(new Set(chars.map(char => char.NAME))).map(cn => ({ label: cn, value: cn })))
                        )
                ],
                embeds: [ new EmbedBuilder().setTitle("Claim this face for your character:") ],
                ephemeral: true
            });
        }
    }
}