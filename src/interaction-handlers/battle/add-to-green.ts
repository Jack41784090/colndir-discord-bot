import { addToTeamMessageBlock, getTeamArrays } from '@functions';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ButtonInteraction, User } from 'discord.js';

export class AddToGreenSelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.Button
        });
    }

    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.customId.startsWith('add-to-green')) return this.none();
        return this.some();
    }

    public override async run(interaction: ButtonInteraction, target_messageID: string) {
        await interaction.deferUpdate();
        const origin = (await interaction.channel!.messages.fetch(interaction.message.id))
        if (!origin) return await interaction.editReply('Message not found.');
        
        const { greenTeam, redTeam } = await getTeamArrays(origin, 'green');
        const selected = interaction.message.embeds[0]!.description?.split('\n')
            .map(str => {
                const id= str.match(/(\d+)/g)?.[0]
                return id? interaction.guild!.members.cache.get(id)?.user : null
            })
            .filter(v => v) as User[];
        return await origin.edit(await addToTeamMessageBlock(selected, redTeam, greenTeam))
    }
}