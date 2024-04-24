import weaponsJson from '@data/weapons.json';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { APIEmbed, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

export class SelectCharacterSelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.SelectMenu
        });
    }

    public override async parse(interaction: StringSelectMenuInteraction) {
        if (!interaction.customId.startsWith('select-attacker')) return this.none();
        return this.some();
    }

    public override async run(interaction: StringSelectMenuInteraction, target_messageID: string) {
        await interaction.deferUpdate();
        const origin = (await interaction.channel!.messages.fetch(interaction.message.id))
        if (!origin) return await interaction.editReply('Message not found.');

        const oldEmbed = origin.embeds[0];
        const selected = interaction.values[0];
        oldEmbed.fields[0].value = selected;
        await origin?.edit({
            embeds: [
                new EmbedBuilder(oldEmbed as APIEmbed)
            ],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`select-weapon`)
                            .setPlaceholder('Select a weapon')
                            .addOptions(Object.keys(weaponsJson).map(cn => ({ label: cn, value: cn }))),
                    )
            ]
        });

        return 
    }
}