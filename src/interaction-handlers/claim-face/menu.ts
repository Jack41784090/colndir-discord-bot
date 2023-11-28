import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { EmbedBuilder, ForumChannel, StringSelectMenuInteraction, ThreadChannel } from 'discord.js';
import bot from '../../bot';
import { GetData, SaveData } from '../../database';
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

        const requested_message = await interaction.channel?.messages.fetch(received);
        if (requested_message == undefined) return interaction.editReply('Requested message not found.');

        const requested_image = requested_message.attachments.first();
        if (requested_image == undefined) return interaction.editReply('Requested image not found.');

        const selected = interaction.values[0];
        const uid = await GetData('User', interaction.user.id);
        if (uid == undefined) return interaction.editReply('You do not have characters.');

        const chars = uid['characters'];
        const char: Character = chars.find((char: Character) => char['NAME'] == selected);
        if (char === undefined) return interaction.editReply("Cannot find requested character.")

        const str = char['thread'].split('/');
        const thread = await bot.channels.fetch(str[str.length - 1]).catch((e) => {
            console.log(e);
            return undefined;
        }) as ThreadChannel;
        if (thread == undefined) return interaction.editReply('Character thread not found.');

        const messages = await thread.messages.fetch();
        if (messages == undefined) return interaction.editReply('Messages not found.');

        const target_message = messages.last()!;
        const target_embed = target_message.embeds[0]!;
        const new_embed = new EmbedBuilder(target_embed.toJSON());
        new_embed.setImage(requested_image.url);

        const forum = (thread.parent as ForumChannel);
        const tag = forum.availableTags.find(t => t.name === interaction.user.username);
        if (tag == undefined) return interaction.editReply('Tag not found.');

        await thread.delete();
        const new_thread = await forum.threads.create({
            name: char['NAME'],
            message: {
                content: `${interaction.user}`,
                embeds: [new_embed],
            },
            appliedTags: [tag.id],
        });

        char['thread'] = new_thread.url;
        const i = chars.findIndex((char: Character) => char['NAME'] == selected);
        uid['characters'][i] = char;
        await SaveData('User', interaction.user.id, uid)

        return await interaction.deleteReply();
    }
}