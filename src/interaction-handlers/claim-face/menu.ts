import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { EmbedBuilder, ForumChannel, StringSelectMenuInteraction, ThreadChannel } from 'discord.js';
import bot from '../../bot';
import { GetData } from '../../database';
import { Character } from '../../util/typedef';

export class InventorySelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.SelectMenu
        });
    }

    public override async parse(interaction: StringSelectMenuInteraction) {
        if (!interaction.customId.startsWith('claim-face-menu')) return this.none();
        const id = interaction.customId.split('_')[1];
        return this.some(id);
    }

    public override async run(interaction: StringSelectMenuInteraction, received: string) {
        await interaction.deferReply();

        // get the message the interaction was pointing to
        const requested_message = await interaction.channel?.messages.fetch(received);
        if (requested_message == undefined) return interaction.followUp('Requested message not found.');

        // get the image in the requested message
        const requested_image = requested_message.attachments.first();
        if (requested_image == undefined) return interaction.followUp('Requested image not found.');

        // confirm the selected character exists
        const selected = interaction.values[0];
        const uid = await GetData('User', interaction.user.id);
        if (uid == undefined) return interaction.followUp('You do not have characters.');
        const chars = uid['characters'];
        const char: Character = chars.find((char: Character) => char['NAME'] == selected);
        if (char === undefined) return interaction.followUp("Cannot find requested character.")

        // check if the thread is still here
        const str = char['thread'].split('/');
        const thread = await bot.channels
            .fetch(str[str.length - 1])
            .catch((e) => {
                console.log(e);
                return undefined;
            }) as ThreadChannel;
        if (thread == undefined) return interaction.followUp('Character thread not found.');

        // get all messages in the thread
        const messages = await thread.messages.fetch();
        if (messages == undefined) return interaction.followUp('Messages not found.');

        // build the new embed based on the existing one
        const target_message = messages.last();
        if (target_message === undefined) return interaction.followUp('Last message does not exist');
        const target_embed = target_message.embeds[0]!;
        if (target_embed === undefined) return interaction.followUp('Embed does not exist');
        const new_embed = new EmbedBuilder(target_embed.toJSON());
        new_embed.setImage(requested_image.url);

        // recreate the post
        const forum = (thread.parent as ForumChannel);
        const tag = forum.availableTags.find(t => t.name === interaction.user.username);
        if (tag == undefined) return interaction.followUp('Tag not found.');
        await target_message.edit({
            embeds: [new_embed]
        });

        return await interaction.deleteReply();
    }
}