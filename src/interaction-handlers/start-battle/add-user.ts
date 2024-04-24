import { addToTeamMessageBlock, getTeamArrays } from '@functions';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { User, UserSelectMenuInteraction } from 'discord.js';

export class SelectUsersSelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.SelectMenu
        });
    }

    public override async parse(interaction: UserSelectMenuInteraction) {
        if (!interaction.customId.startsWith('add-users')) return this.none();
        return this.some();
    }

    public override async run(interaction: UserSelectMenuInteraction, target_messageID: string) {
        await interaction.deferUpdate();
        const origin = (await interaction.channel!.messages.fetch(interaction.message.id))
        if (!origin) return await interaction.editReply('Message not found.');

        const { greenTeam, redTeam } = await getTeamArrays(origin, 'green');
        const members = interaction.values.map(v => interaction.guild!.members.cache.get(v)?.user).filter(v => v) as User[];

        return await origin.edit(await addToTeamMessageBlock(members, redTeam, greenTeam))
    }
}