import { RoleManagement } from "@classes/RoleManagement";
import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { ButtonInteraction } from "discord.js";

export class InventorySelectHandler extends InteractionHandler {
    public constructor(ctx: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
        super(ctx, {
            ...options,
            interactionHandlerType: InteractionHandlerTypes.Button
        });
    }

    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.customId.startsWith('role:')) return this.none();
        return this.some();
    }

    public override async run(interaction: ButtonInteraction) {
        return await RoleManagement.getInstance().handleRoleSelection(interaction);
    }
}