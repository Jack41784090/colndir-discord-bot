import { Entity } from '@classes/Battle';
import characterJsons from '@data/characters.json';
import { weaponMap } from '@data/weapons';
import { GetEntityConstance, NewObject, roundToDecimalPlace } from '@functions';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { Colors, EmbedBuilder, StringSelectMenuInteraction } from 'discord.js';

export class SelectCharacterSelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.SelectMenu
        });
    }

    public override async parse(interaction: StringSelectMenuInteraction) {
        if (!interaction.customId.startsWith('select-weapon')) return this.none();
        return this.some();
    }

    public override async run(interaction: StringSelectMenuInteraction, target_messageID: string) {
        await interaction.deferUpdate();
        const origin = (await interaction.channel!.messages.fetch(interaction.message.id))
        if (!origin) return await interaction.editReply('Message not found.');
        
        const defenderName = 'Dummy'
        const attackerName = origin.embeds[0].fields.find(f => f.name === 'Attacker')!.value;
        const weaponName = interaction.values[0];

        console.log(`Attacker: ${attackerName}, Defender: ${defenderName}, Weapon: ${weaponName}`)

        const attacker = new Entity({
            base: GetEntityConstance(characterJsons[attackerName as keyof typeof characterJsons] as any),
            team: '1'
        });
        attacker.equippedWeapon = NewObject(weaponMap.get(weaponName)!);
        const defender = new Entity({
            base: GetEntityConstance(characterJsons[defenderName as keyof typeof characterJsons] as any),
            team: '2'
        });
        const damage = 0;

        return await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.DarkRed)
                    .setTitle(`${attackerName} attacks ${defenderName} with ${weaponName}!`)
                    .setDescription(`# \`${roundToDecimalPlace(defender.hp, 3)}\` \n ## :boom: \`-${roundToDecimalPlace(damage, 3)}\` \n # \`${roundToDecimalPlace(defender.hp - damage, 3)}\``)
            ]
        });
    }
}