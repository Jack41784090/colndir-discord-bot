import { BUSS_SERVERID, HOUR } from '@constants';
import { cosineSimilarity, getAllChannelThreads, getAllMessages, getPostMessage, retrieveDiscordContent, textToVector, updateCharacterPost } from '@functions';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, EmbedBuilder, ForumChannel, GuildTextBasedChannel, Message, PublicThreadChannel, TextChannel, ThreadChannel, type Client } from 'discord.js';
import bot from '../bot';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: true,
          event: Events.ClientReady
        });
    }

    private async getAllLoreForums() {
        const loreForums = await bot.guilds.fetch();
        const loreChannels = [];
        for (const [_, g] of loreForums) {
            if (g.id !== BUSS_SERVERID) continue;
            const guild = await g.fetch()
            const channels_collection = await guild.channels.fetch().catch(_ => null);
            if (!channels_collection) continue;
            const lores = Array
                .from(channels_collection.values())
                .filter(c => c &&
                    c.type === ChannelType.GuildForum &&
                    c.parent &&
                    c.availableTags.filter(t => t.name.toLowerCase() === ('major lore') || t.name.toLowerCase() === ('minor lore')).length === 2
                ) as ForumChannel[];
            loreChannels.push(...lores)
        }
        return loreChannels;
    }

    private async loreChannelsUpdate() {
        console.log("Updating Lore Channels...")
        
        // 1. Get all lore channels in all servers
        const loreChannels = await this.getAllLoreForums();
        
        // 2. Update all lore channels
        for (const [i, forum] of loreChannels.entries()) {
            console.log(`|=> Updating for [${forum.guild.name}] (${forum.parent?.name || ''} ${forum.name})`)
            
            // 2.1 Get major / minor tags
            const tags = forum.availableTags;
            const major_tag = tags.find(tag => tag.name.toLowerCase().includes('major'))!
            const minor_tag = tags.find(tag => tag.name.toLowerCase().includes('minor'))!

            // 2.2 Get all posts
            const posts = await getAllChannelThreads(forum);
            for (let j = 0; j < posts.length; j++) {
                const p = posts[j];
                await this.updateLinks(p)

                if (!p.locked && !p.archived) {
                    p.setLocked(true).catch(e => console.error(e));
                    console.log(`|||=> locked "${p.name}"`)
                }

                if (p.appliedTags.includes(major_tag.id)) {
                    p.setArchived(false).catch(e => console.error(e))
                    console.log(`|||=> de-archived "${p.name}"`)
                }
                else if (p.appliedTags.includes(minor_tag.id)) {
                    if (!p.archived) p.setArchived(true).catch(e => console.error(e))
                    console.log(`|||=> archived "${p.name}"`)
                }
            }
        }

        console.log("| Done")
    }

    private async thumbnailUpdate() {
        bot.channels.fetch('1157542261295427675').then(async c => {
            if (c && c instanceof ForumChannel) {
                const threads = await c.threads.fetch();
                const archived = await c.threads.fetchArchived();
                const all = [...Array.from(threads.threads.values()), ...Array.from(archived.threads.values())];

                for (let i = 0; i < all.length; i++) {
                    const t = all[i]
                    console.log(`Checking thread ${t.name}`);
                    
                    await t.setArchived(false)
                        .then(t => updateCharacterPost(t))
                        .catch(e => console.error(e));
                }
            }
        })
    }

    private async dealWithAusMessage(outsideMessage: Message, post: ThreadChannel) {
        if ((outsideMessage.channel as TextChannel)?.guild.id === post.guild.id) return null; // Skip if reference is local

        const outMessageContent = outsideMessage.content.substring(0, 20)+'...';
        console.log(`|=> ${post.name} refers to ${outMessageContent} in ${(outsideMessage.channel as TextChannel).guild.name}`)
        const cacheID = post.parentId || post.guild.id;
        const relevantPost =
            this.forumPostsCache[cacheID]||
            (this.forumPostsCache[cacheID] = await getAllChannelThreads(post.parent as ForumChannel));
        if (!relevantPost || relevantPost.length < 0) {
            console.log(`||=> No relevant posts found for ${post.name} in ${post.guild.name}`, cacheID)
            return null;
        }

        const otherPost = await this.findRelevantPost(outsideMessage.content, relevantPost);
        if (otherPost) {
            console.log(`||=> Found relevant post ${otherPost.name}`)
            await post.setArchived(false)
            await post.setLocked(false)
            return otherPost.url;
        }
        else {
            console.error(`||=> Cannot find a good match for ${outMessageContent}`)
            return null;
        }
    }

    private async dealWithAusChannel(outsideChannel: GuildTextBasedChannel, post: ThreadChannel) {
        console.log(`|=> ${post.name} refers to channel: ${outsideChannel.name} in ${outsideChannel.guild.name}`)
        const cacheID = post.parentId || post.guild.id;
        const otherPosts =
            this.forumPostsCache[cacheID]||
            (this.forumPostsCache[cacheID] = await getAllChannelThreads(post.parent as ForumChannel));

        const outsideChannelName = outsideChannel.name;
        const sameTitlePost =
            otherPosts.find(p => p.name === outsideChannelName)||
            await post.guild.channels.fetch().then(c => c.find(c => c?.name === outsideChannelName));

        if (sameTitlePost) {
            console.log(`||=> Found relevant post ${sameTitlePost.name}`)
            await post.setArchived(false)
            await post.setLocked(false)
            return sameTitlePost.url;
        }
        else if (otherPosts && otherPosts.length > 0) {
            const outsideChannelMessages = await getAllMessages(outsideChannel);

            if (outsideChannelMessages.length === 0) {
                console.error(`||=> No messages found in ${outsideChannel.name}`)
                return null;
            }
            const content = outsideChannelMessages[0].content;
            const otherPost = await this.findRelevantPost(content, otherPosts);
            if (otherPost) {
                console.log(`||=> Found relevant post ${otherPost.name}`)
                await post.setArchived(false)
                await post.setLocked(false)
                return otherPost.url;
            }
            else {
                console.error(`||=> Cannot find a good match for ${content}`)
                return null;
            }
        }
    }

    private relevantPostCache: Record<string, [ThreadChannel, number][]> = {};
    private async findRelevantPost(content: string, posts: ThreadChannel[]) {
        const briefContentString = content.substring(0, 20)+'...';
        console.log(`Finding relevant post for ${briefContentString}`)
        const allPostsLev: [ThreadChannel, number][] = []
        
        if (this.relevantPostCache[content]) {
            console.log(`|=> Found in cache`)
            allPostsLev.push(...this.relevantPostCache[content]);
        }
        else {
            for (const post of posts) {
                const postContent = await getPostMessage(post).then(m => m?.content);
                if (!postContent) continue;
                allPostsLev.push([post, cosineSimilarity(textToVector(content), textToVector(postContent))]);
            }
        }
        
        this.relevantPostCache[content] = allPostsLev;
        const min = allPostsLev.reduce((a, b) => a[1] > b[1] ? a : b)
        return min[1] > 0.9 ? min[0] : null;
    }

    private forumPostsCache: Record<string, ThreadChannel[]> = {};
    private async updateLinks(post: ThreadChannel) {
        console.log(`Updating links for ${post.name}...`)
        
        // 1. Get all messages
        const messages = await getAllMessages(post as PublicThreadChannel);
        for (const postMessage of messages) {
            console.log(postMessage.content);
            // 2. Extract all links and Fetch content
            const urlReferenceList = await retrieveDiscordContent(postMessage.content); console.log(urlReferenceList.length)
            if (urlReferenceList.length === 0) continue;
            for (const x of urlReferenceList) {
                const url = x.url;
                const source = x.source;
                let relevantPostURL = null;

                if ('guildId' in source && source.guildId === post.guild.id) continue;
                if (source instanceof Message) {
                    relevantPostURL = await this.dealWithAusMessage(source, post);
                }
                else if (source.isTextBased() && 'name' in source && 'guild' in source) {
                    relevantPostURL = await this.dealWithAusChannel(source, post);
                }
                else {
                    console.error(`|=> ${post.name} refers to content that doesn't exist`)
                }

                if (relevantPostURL)
                    await postMessage.edit(postMessage.content.replace(url, relevantPostURL)).catch(e => console.error(e));
            }
        }
    }

    private async sendReferencedEmbeds() {
        const loreForums = await this.getAllLoreForums();
        for (const forum of loreForums) {
            console.log(`|=> ${forum.guild.name} (${forum.parent?.name || ''} ${forum.name})`)
            const posts = await getAllChannelThreads(forum);
            for (const post of posts) {
                console.log(`||=> ${post.name}`)
                const messages = await getAllMessages(post as PublicThreadChannel);

                for (const [i, message] of Object.entries(messages)) {
                    console.log(`|||=> ${i} ${message.content}`)
                    if (Number.parseInt(i) === 0) continue;
                    const urlReferenceList = await retrieveDiscordContent(message.content);
                    for (const x of urlReferenceList) {
                        const url = x.url;
                        const source = x.source;
                        if (source instanceof Message) {
                            console.log(`||||=> ${source.content}`)
                        }
                        else if (source.isTextBased() && 'name' in source && 'guild' in source) {
                            if (source instanceof ThreadChannel) {
                                const referencedPost = source;
                                await post.setArchived(false)
                                    .then(async _ => {
                                        post.send({
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setDescription(`# [${referencedPost.name}](${referencedPost.url})`)
                                                    .setImage(await referencedPost.fetchStarterMessage().then(m => m?.attachments.first()?.url) || 'https://cdn.discordapp.com/attachments/1157542261295427675/899116073013452554/unknown.png')
                                            ]
                                        })
                                    })
                                    .catch(e => console.error(e));
                            }
                        }
                    }
                }
            }
        }
    }

    public async run(client: Client) {
        const { username, id } = client.user!;
        this.container.logger.info(`Successfully logged in as ${username} (${id})`);
        const commands = await client.application?.commands.fetch();
        this.container.logger.info(`Slash commands: ${commands?.map(c => c.name).join(', ') || 'None'}`);
        // TestFunction();
        // this.loreChannelsUpdate();

        setInterval(async () => {
            await this.loreChannelsUpdate();
            await this.thumbnailUpdate();
        }, 12 * HOUR)
    }
}