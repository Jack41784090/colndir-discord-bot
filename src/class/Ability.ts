import { AOE, AbilityName, AbilityTrigger, EntityStats, Location, StatusEffectApplyType, StatusEffectSource, StatusEffectType, Targetting, iAbility, iEntity, iStatusEffect } from "@ctypes";
import { abilitiesMap } from "@data/abilities";
import { statusEffectMap } from "@data/statusEffects";
import { NewObject, getCharArray, getDefaultAbility, getDefaultStatusEffect } from "@functions";
import { EventEmitter } from "events";
import { Battle, Entity } from "./Battle";

export class StatusEffect implements iStatusEffect {
    emoji?: string;
    source: StatusEffectSource;
    type: StatusEffectType;
    applyType: StatusEffectApplyType;
    name?: EntityStats;
    value: number;
    duration: number;

    constructor(_option: Partial<iStatusEffect> & { source: StatusEffectSource}) {
        const basis = statusEffectMap.get(_option.type ?? StatusEffectType.None) ?? getDefaultStatusEffect();
        const options = Object.assign(NewObject(basis), _option);

        this.emoji = options.emoji;
        this.source = options.source;
        this.type = options.type;
        this.applyType = options.applyType;
        this.name = options.name;
        this.value = options.value;
        this.duration = options.duration;
    }

    apply() {

    }
}

/**
 * Represents an instance of an ability.
 */
export class Ability extends EventEmitter implements iAbility {
    initiator: Entity
    target: Entity;
    associatedBattle: Battle

    confirmed: boolean = false;
    id: string = getCharArray(20);
    trigger: AbilityTrigger;
    name: AbilityName;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];

    begin: number;
    windup: number;
    swing: number;
    recovery: number;

    constructor(_option: Partial<iAbility> & { associatedBattle: Battle, initiator: Entity }) {
        super();
        const basis = abilitiesMap.get(_option.name || AbilityName.Idle) ?? getDefaultAbility();
        const options = Object.assign(NewObject(basis), _option);
        
        this.associatedBattle = options.associatedBattle;
        this.trigger = options.trigger;
        this.name = options.name;
        this.desc = options.desc;
        this.targetting = options.targetting;
        this.AOE = options.AOE;
        this.castLocation = options.castLocation;
        this.targetLocation = options.targetLocation;
        this.windup = options.windup;
        this.swing = options.swing;
        this.recovery = options.recovery;
        this.begin = options.begin ?? -1;
        this.initiator = options.initiator;
        this.target = options.target ?? options.initiator;

        if (options.target)
            this.target = options.target;
    
        this.once(AbilityTrigger.Proc, (attacker: Entity, defender: Entity) => {
            this.execute( attacker, defender);
        });
    }

    /**
     * Confirms the ability and sets up the necessary event listeners.
     */
    confirm() {
        if (this.confirmed) return;
        this.confirmed = true;
        console.log(`【Ability】 ${this.name} confirmed with [${this.trigger}]`);
        switch (this.trigger) {
            case AbilityTrigger.Windup:
            case AbilityTrigger.Swing:
            case AbilityTrigger.Recovery:
                this.on(this.trigger, (attacker: iEntity, defender: iEntity, ability: Ability) => {
                    if (ability.id === this.id && this.getFinishTime() >= this.associatedBattle.time) {
                        this.emit(AbilityTrigger.Proc, attacker, defender);
                    }
                    else if (this.getFinishTime() < this.associatedBattle.time) {
                        console.log(`【Ability】 ${this.name} failed to proc due to time; [${this.trigger}] time: ${this.getFinishTime()} vs ${this.associatedBattle.time}`);
                        this.removeAllListeners();
                    }
                });
                break;
            default:
                this.associatedBattle.on(this.trigger, (attacker: iEntity, defender: iEntity) => {
                    this.execute(attacker, defender);
                });
                break;
        }
    }

    /**
     * Executes the ability.
     * @param attacker The attacking entity.
     * @param defender The defending entity.
     */
    private execute(attacker: iEntity, defender: iEntity) {
        console.log(`【Ability】 ${this.name} executed via [${this.trigger}]`);
        switch (this.name) {
            case AbilityName.Stab:
                defender.status.push(new StatusEffect({
                    type: StatusEffectType.Bleed,
                    duration: 20,
                    value: 1,
                    source: { from: this, id: getCharArray(20) },
                }))
                break
            case AbilityName.Sigurdian_Strength:
                const existing = attacker.status.find(s => s.source.from === this);
                if (!existing) {
                    attacker.status.push(new StatusEffect({
                        type: StatusEffectType.IncreaseStat,
                        duration: Number.POSITIVE_INFINITY,
                        value: 1,
                        name: 'str',
                        applyType: StatusEffectApplyType.persistent,
                        source: { from: this, id: getCharArray(20) },
                    }))
                }
                break;
        }
    }

    /**
     * Gets the finish time of the ability.
     * @returns The finish time of the ability.
     */
    getFinishTime() {
        const finish = this.begin + this.windup + this.swing + this.recovery - 1
        // console.log(`【Finish time】: ${finish}`)
        return finish;
    }
}
