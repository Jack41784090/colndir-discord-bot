import { UserData } from "@ctypes";
import { GetUserData, SaveUserData, getPromiseStatus } from "@functions";
import { Message } from "discord.js";
import { Battle } from "./Battle";

export enum InteractionEventType { NULL, Inventory, Dungeon, Battle }

interface InteractionUserProfile {
    userData: UserData,
    pending: Array<InteractionEvent>,
    handling: Array<InteractionEvent>,
    handlerPromise?: Promise<unknown>,
}

export class InteractionEvent {
    static STANDARD_TIMEOUT = 10 * 1000;

    type: InteractionEventType = InteractionEventType.NULL;
    ownerID: string;
    interactedMessage?: Message;
    stoppable: boolean;
    stopped: boolean = false;

    timerPromise_resolve: (_v: void | PromiseLike<void>) => void = () => {};
    timerPromise_timeout: NodeJS.Timeout;
    timerPromise: Promise<void>;

    protected constructor(id: string, stoppable: boolean, mes?: Message) {
        this.ownerID = id;
        this.interactedMessage = mes;
        this.stoppable = stoppable

        this.timerPromise = new Promise<void>((resolve) => {
            this.timerPromise_resolve = resolve;
        });

        // inactivity stop
        this.timerPromise_timeout = this.Timeout();
    }

    /** Removing the player's presence in the activity and allows for a new one to be generated */
    async Stop() {
        this.stopped = true;
        this.interactedMessage?.delete().catch(_err => null);
        clearTimeout(this.timerPromise_timeout);
        this.timerPromise_resolve();
    }

    Promise() {
        return this.timerPromise;
    }

    Activity() {
        clearTimeout(this.timerPromise_timeout);
        this.timerPromise_timeout = this.Timeout();
    }

    Timeout(): NodeJS.Timeout {
        return setTimeout(async () => {
            this.timerPromise_resolve();
            this.Stop();
        }, InteractionEvent.STANDARD_TIMEOUT);
    }
}

export class InventoryInteractionEvent extends InteractionEvent {
    constructor(id: string, mes?: Message) {
        super(id, true, mes);
        this.type = InteractionEventType.Inventory;
    }
}

export class BattleInteractionEvent extends InteractionEvent {
    battle: Battle;

    constructor(id: string, battle: Battle, mes?: Message) {
        super(id, true, mes);
        this.type = InteractionEventType.Battle;
        this.battle = battle;
    }

}

export class RegistrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RegistrationError";
    }
}

export class InteractionEventManager {
    // instance values
    userProfilesMap: Map<string, InteractionUserProfile>;
    private static instance: InteractionEventManager;

    // static to access data easier
    static Instance(): InteractionEventManager {
        if (InteractionEventManager.instance === undefined) {
            InteractionEventManager.instance = new InteractionEventManager();
        }
        return this.instance;
    }

    static async UserData(_id: string): Promise<UserData | null> {
        return this.ensureUserProfile(_id).then(x => x.userData) || null;
    }

    static GetEvent<E extends InteractionEvent>(_id: string, type: InteractionEventType): E | null {
        const map = this.instance.userProfilesMap.get(_id);
        return map?.handling.find(_e => _e.type === type) as E ||
            map?.pending.find(_e => _e.type === type) || null;
    }

    private constructor() {
        this.userProfilesMap = new Map<string, InteractionUserProfile>();
    }

    // Wait for all interactions for a player to end, then save UserData to the cloud
    // That way, I don't have to spam the save function and burn "write" money.
    // TODO: Try and make a "reject" section, when a new interaction is detected in "pending".
    // TODO: Then, in the reject section, renew the Promise.all();
    static HandlePlayer(_id: string) {
        const { userProfilesMap } = this.instance;

        console.log(`New Handle: ${_id}`);
        const userProfile: InteractionUserProfile | null =
            userProfilesMap.get(_id) || null;
        if (userProfile) {
            if (userProfile.handling.length === 0) {
                userProfile.handling = userProfile.pending;
                userProfile.pending = [];
            }

            userProfile.handlerPromise =
                // 1. Wait for the first waves of interactions in "handling" to finish.
                Promise.allSettled(userProfile.handling.map(_e => _e.Promise()))
                    .then(() => {
                        // 2. Stop each interaction if it hasn't been stopped already.
                        userProfile.handling.forEach(_e => {
                            if (!_e.stopped) _e.Stop()
                        });
                        userProfile.handling = [];

                        // 3. If there are still pending interactions looking to save
                        if (userProfile.pending.length > 0) {
                            // 3a. There is, so redo HandlePlayer
                            console.log("\t\tPending is not empty, reusing.")
                            return this.HandlePlayer(_id);
                        }
                        else {
                            // 3b. All done. Save to cloud.
                            console.log("\t\tAll done.")
                            SaveUserData(userProfile.userData);
                            return 1;
                        }
                    });
        }
    }

    // Simplified registration method for interaction events.
    static async Register<T extends InteractionEvent>(id: string, type: InteractionEventType, optionals: {
        associatedMes?: Message,
        userData?: UserData,
        battle?: Battle
    } = {}): Promise<T | RegistrationError> {
        const { associatedMes, userData, battle } = optionals;
        const event = this.createEvent(type, id, { associatedMes, userData, battle }) as T;
        if (!event) return new RegistrationError("Invalid Interaction Event Type."); // Early exit if no event created.

        const userProfile = await this.ensureUserProfile(id, userData);
        const duplicate = this.getDuplicateEvent(userProfile, type);
        if (duplicate && duplicate.stoppable) {
            console.log(`Stopping duplicate event (${id}): ${InteractionEventType[type]}`);
            duplicate.Stop(); // Stops the duplicate event.
        }
        else if (duplicate) {
            console.log(`Duplicate event (${id}): ${InteractionEventType[type]}`);
            return new RegistrationError("Duplicate Interaction Event."); // Early exit if duplicate event.
        }

        console.log(`Registering event (${id}): ${InteractionEventType[type]}`);
        userProfile.pending.push(event);
        await this.maybeHandleUser(id, userProfile);
        return event;
    }

    // Helper to create specific interaction events based on type.
    private static createEvent(type: InteractionEventType, id: string, { associatedMes, dungeon, battle }: any): InteractionEvent | null {
        switch (type) {
            case InteractionEventType.Inventory:
                return new InventoryInteractionEvent(id, associatedMes);
            case InteractionEventType.Battle:
                return new BattleInteractionEvent(id, battle!, associatedMes);
            case InteractionEventType.NULL:
            default:
                return null;
        }
    }

    // Ensure a user profile exists and return it.
    private static async ensureUserProfile(id: string, userData?: UserData): Promise<InteractionUserProfile> {
        if (!this.instance) this.instance = this.Instance();
        return this.instance.userProfilesMap.get(id) || this.instance.userProfilesMap.set(id, {
            pending: [],
            handling: [],
            userData: userData || await GetUserData(id),
        }).get(id)!;
    }

    // Check for duplicate events.
    private static getDuplicateEvent(userProfile: InteractionUserProfile, type: InteractionEventType) {
        const duplicate = userProfile.pending.find(i => i.type === type) || userProfile.handling.find(i => i.type === type);
        if (duplicate) duplicate.Stop(); // Stops the duplicate event.
        return duplicate || null;
    }

    // Maybe handle the user if their handler is ready.
    private static async maybeHandleUser(id: string, userProfile: InteractionUserProfile): Promise<void> {
        const handlerStatus = userProfile.handlerPromise ? await getPromiseStatus(userProfile.handlerPromise) : null;
        console.debug("\tHandler Promise is", handlerStatus);
        if (handlerStatus === 'fulfilled') {
            this.HandlePlayer(id);
        }
    }

}