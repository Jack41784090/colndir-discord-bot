import { Command } from '@sapphire/framework';
import { ApplicationCommandType, EmbedBuilder, ThreadChannel } from 'discord.js';
import OpenAI from 'openai';
import { register } from '../util/register';
import { Character } from '../util/typedef';

export class ApproveCommand extends Command {
    openai: OpenAI;
    // init_step: Promise<unknown>[];
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            description: 'Approve a character from #pending-characters.'
        });
        this.openai = new OpenAI()
        // this.init_step = [this.init()];
    }

    // async init() {
    //     const completion = await this.openai.chat.completions.create({
    //         messages: [{ role: "system", content: "You are an api that translates character summaries into json objects. Only return your messages in json objects." }],
    //         model: "gpt-3.5-turbo",
    //     });
    //     return completion;
    // }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerContextMenuCommand((builder) =>
            builder //
                .setName(this.name)
                .setType(ApplicationCommandType.Message)
        );
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        await interaction.deferReply();

        // fetch original message
        console.log("Fetch origin message")
        const message = await interaction.channel?.messages.fetch(interaction.targetId);
        if (message === undefined) return interaction.followUp({ content: 'Error: content not found.' });

        // fetch messages after origin
        console.log("Fetch messages after origin")
        const corress = await interaction.channel?.messages.fetch({
            after: message.id,
        });
        if (corress === undefined) return interaction.followUp({ content: "Error: cannot fetch messages afterwards" });
        const related = Array.from(corress.values()).filter(m => m.author.id === message.author.id)

        // send request to gpt
        console.log("Request to GPT")
        const command = "Find the NAME, ALIAS, AGE, SEX, ETHNICITY, HEIGHT, WEIGHT, RACE, AFFILIATION, ALIGNMENT, POWERS AND ABILITIES, EQUIPMENT, BACKGROUND, and PERSONALITY TRAITS of this character. Return your message only in a json object and use only string-type values:"
        const story_content = related.map(m => m.content).join('\n');
        const comp = await this.openai.chat.completions.create({
            messages: [{
                role: "user",
                content: `${command}\n\n${story_content}`,
            }],
            model: "gpt-3.5-turbo"
        });

        // deal with response
        const response = comp.choices[0].message.content;
        if (response === null) return interaction.followUp({ content: 'GPT Error: response not found.' });
        try {
            const json_obj = JSON.parse(response);
            const r = await register(interaction.guild!, message.author, json_obj as Character);
            if (r instanceof ThreadChannel) {
                return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${r}`)] });
            }
            else {
                return interaction.followUp({ content: r });
            }
        }
        catch (e) {
            return interaction.followUp({ content: JSON.stringify(e) || 'No results' });
        }
    }
}