import { Client, CollectedInteraction, Interaction, InteractionCollector, InteractionCollectorOptions } from "discord.js";

export function setUpInteractionCollect(
    client: Client<true>, cb: (itr: Interaction) => void,
    options: Partial<InteractionCollectorOptions<CollectedInteraction>> = {}
) {
    // console.log('Setting up interaction collector...');
    const interCollector = new InteractionCollector(client, options);
    interCollector.on('collect', cb);
    return interCollector;
}
