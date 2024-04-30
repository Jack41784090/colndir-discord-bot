import { Battle } from '@classes/Battle';
import { getTeamArrays } from '@functions';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { APIEmbed, ButtonInteraction, EmbedBuilder } from 'discord.js';

export class StartBattleHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.Button
        });
    }

    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.customId.startsWith('start-battle')) return this.none();
        return this.some();
    }

    public override async run(interaction: ButtonInteraction, target_messageID: string) {
        await interaction.deferUpdate();
        const origin = (await interaction.channel!.messages.fetch(interaction.message.id))
        if (!origin) return await interaction.editReply('Message not found.');
        
        await origin.edit({
            embeds: [ new EmbedBuilder(origin.embeds[0] as APIEmbed)
                .setTitle(null)
                .setDescription(`# Get Ready!`) ],
            components: []})
        const { greenTeam, redTeam } = await getTeamArrays(origin, 'green');

        const battle = await Battle.Create({
            channel: interaction.channel!,
            users: [...greenTeam, ...redTeam],
            teamMapping: {
                [greenTeam[0].id]: '1',
                [redTeam[0].id]: '2'
            }
        })
        battle.begin()
    }
}