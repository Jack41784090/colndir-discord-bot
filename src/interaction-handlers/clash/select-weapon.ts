import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { Colors, EmbedBuilder, StringSelectMenuInteraction } from 'discord.js';
import { Battle } from '../../class/Battle';
import characterJsons from '../../data/characters.json';
import weaponJsons from '../../data/weapons.json';
import { roundToDecimalPlace } from '../../util/functions';

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

        const attacker = Battle.GetEntity(Battle.GetEntityConstance(characterJsons[attackerName as keyof typeof characterJsons] as any));
        attacker.equippedWeapon = weaponJsons[weaponName as keyof typeof weaponJsons] as any;
        const defender = Battle.GetEntity(Battle.GetEntityConstance(characterJsons[defenderName as keyof typeof characterJsons] as any));
        const damage = Battle.CalculateDamage(attacker, defender);

        return await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.DarkRed)
                    .setTitle(`${attackerName} attacks ${defenderName} with ${weaponName}!`)
                    .setDescription(`# \`${roundToDecimalPlace(defender.HP, 3)}\` \n ## :boom: \`-${roundToDecimalPlace(damage, 3)}\` \n # \`${roundToDecimalPlace(defender.HP - damage, 3)}\``)
            ]
        });
    }
}