import bot from "@bot";
import { GetGuildData } from "@functions";
import { Canvas } from "canvas";
import { ActionRowBuilder, ActionRowData, AttachmentBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder, Guild, GuildMember, Interaction, MessageCreateOptions, Role, TextBasedChannel, TextChannel } from "discord.js";

//#region Canvas
class Square {
    constructor(public x: number, public y: number, public size: number, public color: string, public text: string) {
        console.log(`Square: ${x}, ${y}, ${size}, ${color}, ${text}`)
    }
}
function hexToRgb(hex: number): string {
    const r = (hex >> 16) & 0xFF;
    const g = (hex >> 8) & 0xFF;
    const b = hex & 0xFF;
    return `rgb(${r}, ${g}, ${b})`;
}
function normalizeMathematicalAlphanumericSymbols(text: string): string {
    return text.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}
function calculateCanvasDimensions(rolesLength: number) {
    const squareSize = 100;
    const squaresPerRow = Math.ceil(Math.sqrt(rolesLength));
    return {
        width: squaresPerRow * squareSize,
        height: Math.ceil(rolesLength / squaresPerRow) * squareSize
    };
}
function drawDynamicCanvas(roles: Role[]) {
    const { width, height } = calculateCanvasDimensions(roles.length);
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    const squares: Square[] = [];

    roles.forEach((role, index) => {
        const row = Math.floor(index / Math.sqrt(roles.length));
        const col = index % Math.sqrt(roles.length);
        const color = role.color ? hexToRgb(role.color) : 'rgb(255, 255, 255)';
        const text = normalizeMathematicalAlphanumericSymbols(role.name);
        squares.push(new Square(col * 100, row * 100, 100, color, text));
    });

    squares.forEach(square => {
        ctx.fillStyle = square.color;
        ctx.fillRect(square.x, square.y, square.size, square.size);
        ctx.font = '18px Verdana';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.textAlign = 'center';
        ctx.fillText(square.text, square.x + 50, square.y + 55);
        ctx.strokeText(square.text, square.x + 50, square.y + 55);
    });

    return canvas.toBuffer();
}
//#endregion

//#region Role Management Helper functions
async function getServerColourRoles(guild: Guild) {
    const roles = await guild.roles.fetch();
    const botRoles = await guild.members.fetchMe().then(me => me.roles.cache);
    const highestRole = botRoles.reduce((highest, role) => role.position > highest.position ? role : highest, botRoles.first());
    const colourRoles = Array.from(roles.filter(role => role.color && Number(role.permissions.bitfield) === 0 && role.position < (highestRole?.position??0)).values());
    return colourRoles;
}
async function initializeChannelRoles(channelID: string) {
    try {
        const channel = await bot.channels.fetch(channelID);
        if (!channel?.isTextBased()) {
            throw new Error("Channel is not a text channel.");
        }
        const guild = (channel as TextChannel)?.guild;
        if (!guild) {
            throw new Error("Channel is not in a guild.");
        }

        const colourRoles = await getServerColourRoles(guild);
        console.log('Colour Roles:', colourRoles.map(role => `${role.name}: ${role.color}`).join('\n'));

        let roleArray: Role[] = [];
        const sendRoleSelectionMessage = (options: MessageCreateOptions) => sendRoleSelection(channel, roleArray, options);
        let messageOptions = createNewMessageOptions();

        for (const role of colourRoles) {
            if (messageOptions.components.length === 5 && messageOptions.components[4].components.length === 5) {
                sendRoleSelectionMessage(messageOptions);
                messageOptions = createNewMessageOptions();
                roleArray = [];
            }
            appendRoleToMessageOptions(role, messageOptions);
            roleArray.push(role);
        }

        if (messageOptions.components.length > 0) {
            sendRoleSelectionMessage(messageOptions);
        }

        // SaveRoleManagementMessage(guild.id, messageOptions as MessageCreateOptions)

        return null;
    }
    catch (error) {
        return error as Error;
    }
}
function createNewMessageOptions() {
    return { components: [
        new ActionRowBuilder<ButtonBuilder>()
    ] };
}
function appendRoleToMessageOptions(role: Role, options: MessageCreateOptions) {
    if (!options.components) {
        options.components = [
            new ActionRowBuilder<ButtonBuilder>()
        ];
    }

    let actionRow = options.components.length > 0 ?
        options.components[options.components.length - 1] as ActionRowData<ButtonBuilder>:
        new ActionRowBuilder<ButtonBuilder>();
    const button = new ButtonBuilder()
        .setCustomId(`role:${role.id}`)
        .setLabel(role.name)
        .setStyle(ButtonStyle.Primary)

    if (actionRow.components.length < 5) {
        actionRow.components.push(button);
    }
    else {
        actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    }

    if (!options.components.includes(actionRow)) {
        options.components.push(actionRow);
    }
}
function sendRoleSelection(channel: TextBasedChannel, roleArray: Role[], options: MessageCreateOptions) {
    options.embeds = [
        new EmbedBuilder()
            .setTitle("Choose your colour!")
            .setDescription("Choose a colour to represent yourself.")
            .setColor(roleArray.length ? roleArray[0].color : Colors.Blue) // Example of dynamic coloring
            .setFooter({ text: "You can change your colour at any time." })
            .setImage("attachment://colours.png")
    ];
    options.files = [
        new AttachmentBuilder(drawDynamicCanvas(roleArray))
            .setName("colours.png")
    ];
    channel.send(options);
}
//#endregion

export class RoleManagement {
    //#region Statics
    private static singleton: RoleManagement 

    public static getInstance() {
        if (!RoleManagement.singleton) {
            RoleManagement.singleton = new RoleManagement();
        }
        return RoleManagement.singleton;
    }
    //#endregion

    private constructor() {}

    public async checkExistingRoleChannel(serverID: string) {
        const data = await GetGuildData(serverID);
        return data ? await bot.channels.fetch(data.roleChannelID) : null;
    }

    public async setUpRoleChannel(channelID: string) {
        const existingMessageID = await this.checkExistingRoleChannel(channelID);
        if (existingMessageID) {
            return new Error("Role management message already exists.");
        }
        return await initializeChannelRoles(channelID);
    }

    public async handleRoleSelection(interaction: Interaction) {
        if (!interaction.isButton()) return;

        console.log('Role Selection Interaction:', interaction.customId)

        await interaction.deferReply({ ephemeral: true });

        const roleID = interaction.customId.split(':')[1];
        const role = await interaction.guild?.roles.fetch(roleID);
        if (!role) {
            return interaction.editReply({ content: "Role not found.", });
        }

        const member = interaction.member;
        if (!member) return interaction.editReply({ content: "Member not found.", });

        try {
            if (member instanceof GuildMember) {
                const roles = member.roles.cache.filter(r => !r.color);
                roles.set(role.id, role);
                await member.roles.set(roles);
                return interaction.editReply({ content: `Role ${role.name} added.`, });
            }
            else {
                throw new Error("Member is not a GuildMember.");
            }
        }
        catch (error) {
            const err = error as Error;
            console.error(err);
            return interaction.editReply({ content: `Failed to add role ${role.name}. Error: ${err?.message}` });
        }
    }
}