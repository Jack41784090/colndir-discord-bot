import bot from "@bot";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, User, UserSelectMenuBuilder } from "discord.js";


export async function getTeamArrays(origin: Message, team: 'green' | 'red') {
    const oldEmbed = origin.embeds[0]!;
    const discordIdRegex = /(\d+)/g;
    const selected = oldEmbed.description?.split('\n').map(str => str.match(discordIdRegex)?.[0]).filter(v => v) as string[];
    const existingRedTeam = oldEmbed.fields
                                .find(f => f.name === 'Red Team')!.value
                                .split('\n')
                                .map(m => m.match(discordIdRegex)?.[0])
                                .filter(v => v && !selected.includes(v)) as string[];
    const existingGreenTeam = oldEmbed.fields
                                .find(f => f.name === 'Green Team')!.value
                                .split('\n')
                                .map(m => m.match(discordIdRegex)?.[0])
                                .filter(v => v && !selected.includes(v)) as string[];

    const thisTeamUsers = team === 'green'?
        await Promise.all(existingGreenTeam.concat(selected).map(id => bot.users.fetch(id)) || []) :
        await Promise.all(existingRedTeam.concat(selected).map(id => bot.users.fetch(id)) || []);
    const otherTeamUsers = team === 'green'?
        await Promise.all(existingRedTeam.map(id => bot.users.fetch(id)) || []):
        await Promise.all(existingGreenTeam.map(id => bot.users.fetch(id)) || []);

    const greenTeam = team === 'green'? thisTeamUsers : otherTeamUsers;
    const redTeam = team === 'red'? thisTeamUsers : otherTeamUsers;

    return { greenTeam, redTeam }

}

export async function addToTeamMessageBlock(selected: User[], redTeam: User[], greenTeam: User[], overwrite?: { title?: string, description?: string }) {
    return {
        components: [
            new ActionRowBuilder<UserSelectMenuBuilder>()
                .setComponents(
                    new UserSelectMenuBuilder()
                        .addDefaultUsers(selected.map(u => u.id))
                        .setCustomId('add-users')
                        .setPlaceholder('Select users')
                        .setMinValues(1)
                        .setMaxValues(4)),
            new ActionRowBuilder<ButtonBuilder>()
                .setComponents(
                    new ButtonBuilder()
                        .setCustomId('add-to-green')
                        .setEmoji('✅')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(selected.length < 1)),
            new ActionRowBuilder<ButtonBuilder>()
                .setComponents(
                    new ButtonBuilder()
                        .setCustomId('add-to-red')
                        .setEmoji('❌')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(selected.length < 1)),
            new ActionRowBuilder<ButtonBuilder>()
                .setComponents(
                    new ButtonBuilder()
                        .setCustomId('start-battle')
                        .setEmoji('⚔️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(greenTeam.length < 1 || redTeam.length < 1))
        ],
        embeds: [
            new EmbedBuilder()
                .setTitle(overwrite?.title || `Selected Users`)
                .setDescription( `${selected.map(m => m.toString()).join('\n') || 'None'}`)
                .setFields({
                    name: "Green Team",
                    value: `${greenTeam.map(m => m.toString()).join('\n') || 'None'}`,
                }, {
                    name: "Red Team",
                    value: `${redTeam.map(m => m.toString()).join('\n') || 'None'}`,
                })
        ]
    }
}
