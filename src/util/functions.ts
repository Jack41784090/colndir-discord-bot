import { Colors, EmbedBuilder, EmbedData, Message, TextBasedChannel } from "discord.js";

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export function formalise(string: string): string {
    return string.split(/[\s_-]+/).map(s => capitalize(s.toLowerCase())).join(" ");
}

export function NewObject<T extends object, T2 extends object>
    (origin: T, _mod?: T2): T & T2
{
    const mod = (_mod || {}) as T2;
    return Object.assign({...origin}, mod);
}

export function getCharArray(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function cutDownLength(string: string, limit: number) {
    const match = string.match(new RegExp(`[\\s\\S]{1,${limit}}`, 'g'));
    // console.log(match);
    return match?.[0] || null;
}

export function getErrorEmbed(message: string, options?: Partial<EmbedData>) {
    const b: EmbedData = {
        title: "Warning!",
        footer: {
            text: message
        },
        color: Colors.Red
    };
    return new EmbedBuilder(Object.assign(b, options))
}
export function getGreenflagEmbed(message: string, options?: Partial<EmbedData>) {
    const b: EmbedData = {
        title: "Done.",
        footer: {
            text: message
        },
        color: Colors.Green
    };
    return new EmbedBuilder(Object.assign(b, options))
}

/**
 * "Consecutive messages" defined as: fetching from "after: afterID", every message that has the same author, limited to 50.
 * @param afterID 
 * @param origin 
 * @param channel 
 * @returns 
 */
export async function getConsecutiveMessages(afterID: string, origin: Message<boolean>, channel: TextBasedChannel) {
    console.log("Fetch messages after origin")
    const corress = await channel.messages.fetch({
        after: afterID,
    });
    if (corress === undefined) return null;
    const story = [];
    const related = Array.from(corress.values()).reverse();
    related.unshift(origin);
    for (const m of related) {
        if (m.author.id === origin.author.id) {
            story.push(m);
        }
        else {
            break;
        }
    }
    return story;
}

export async function getAllMessages(submissionChannel: TextBasedChannel) {
    const fetch100 = async (before?: string) => {
        const messages = await submissionChannel.messages.fetch({
            before: before || undefined,
            limit: 100,
        }).then(ms => Array.from(ms.values()).reverse());
        return messages
    }
    const messages: Message[] = [];
    let fetched = await fetch100();
    while (fetched.length === 100) {
        messages.push(...fetched);
        fetched = await fetch100(fetched[0].id);
    }
    messages.push(...fetched);
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    console.log(`Fetched ${messages.length} messages`)
    return messages;
}

export function getPromiseStatus(p: Promise<unknown>): Promise<'pending' | 'fulfilled' | 'rejected'> {
    const t = {};
    return Promise.race([p, t])
        .then(v =>
            (v === t)?
                "pending":
                "fulfilled",
            () => "rejected"
        );
}

export function roundToDecimalPlace(number: number, decimalPlace: number = 1) {
    if (number === 0) return 0;

    const decimal = Math.pow(10, decimalPlace);

    if (decimalPlace === undefined) {
        let value: number;
        for (let i = 0; i < 25; i++) {
            const newDecimal = Math.pow(10, decimalPlace + i);
            value = Math.round((number + Number.EPSILON) * newDecimal) / newDecimal;
            if (value !== 0) {
                break;
            }
        }
        return value!;
    }
    else {
        return Math.round((number + Number.EPSILON) * decimal) / decimal;
    }
}

export function uniformRandom(_1: number, _2: number, decimize = false): number {
    const parametersIntegers = Number.isInteger(_1) && Number.isInteger(_2);
    const random = Math.random(); // [0.0, 1.0]

    const result = Math.min(_1, _2) + ((Math.abs(_1 - _2) + Number(parametersIntegers)) * random);

    return parametersIntegers && !decimize?
        Math.floor(result):
        result;
}
export function average(...nums: Array<number>) {
    let total = 0;
    for (let i = 0; i < nums.length; i++) {
        const n = nums[i];
        total += n;
    }
    return total / (nums.length || 1);
}
export function gaussianRandom(_mean: number, _standardDeviation: number): number {
    // Box Muller Transform
    let u, v;
    while (!u || !v) {
        u = Math.random();
        v = Math.random();
    }
    const x_N0_1 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

    return _mean + _standardDeviation * x_N0_1;
}
export function clamp(value: number, min: number = Number.NEGATIVE_INFINITY, max: number = Number.POSITIVE_INFINITY) {
    return Math.max(Math.min(value, max), min);
}
