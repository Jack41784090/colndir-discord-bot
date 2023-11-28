export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export function formalise(string: string): string {
    return string.split(/[\s_-]+/).map(s => capitalize(s.toLowerCase())).join(" ");
}

export function empty_ud(): Record<string, any> {
    return {
        characters: [],
    };
}

export function NewObject<T extends object, T2 extends object>
    (origin: T, _mod?: T2): T & T2
{
    const mod = (_mod || {}) as T2;
    return Object.assign({...origin}, mod);
}

export function character(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}