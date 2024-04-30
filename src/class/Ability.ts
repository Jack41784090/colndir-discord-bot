import { AOE, Ability, AbilityName, AbilityTrigger, EntityStatusApplyType, EntityStatusType, Location, Targetting, iEntity } from "@ctypes";
import { abilitiesMap } from "@data/abilities";
import { NewObject, getDefaultAbility } from "@functions";
import { EventEmitter } from "events";
import { Battle, Entity } from "./Battle";

/**
 * Represents an instance of an ability.
 */
export class AbilityInstance extends EventEmitter implements Ability {
    private _initiator?: Entity;
    public get initiator(): Entity | undefined {
        return this._initiator;
    }
    public set initiator(value: Entity) {
        this._initiator = value;
    }

    private _target?: Entity | undefined;
    public get target(): Entity | undefined {
        return this._target;
    }
    public set target(value: Entity) {
        this._target = value;
    }

    private _associatedBattle!: Battle;
    public get associatedBattle(): Battle {
        return this._associatedBattle;
    }
    public set associatedBattle(value: Battle) {
        this._associatedBattle = value;
    }

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

    constructor(_option: Partial<Ability> & { associatedBattle: Battle }) {
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

        if (options.initiator)
            this.initiator = options.initiator;
        if (options.target)
            this.target = options.target;
    }

    /**
     * Confirms the ability and sets up the necessary event listeners.
     */
    confirm() {
        console.log(`Ability: ${this.name} confirmed with [${this.trigger}]`);
        switch (this.trigger) {
            case AbilityTrigger.OnUse:
            case AbilityTrigger.OnHit:
                this.on(this.trigger, (attacker: iEntity, defender: iEntity) => {
                    this.execute(attacker, defender);
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
    execute(attacker: iEntity, defender: iEntity) {
        console.log(`Ability: ${this.name} executed via [${this.trigger}]`);
        this.associatedBattle.emit(AbilityTrigger.Proc, this);
        switch (this.name) {
            case AbilityName.Stab:
                defender.status.push({
                    type: EntityStatusType.Bleed,
                    duration: 20,
                    value: 1,
                    applyType: EntityStatusApplyType.stackable,
                    source: {
                        from: this
                    }
                })
                break
            case AbilityName.Sigurdian_Strength:
                const existing = attacker.status.find(s => s.source.from === this);
                if (!existing) {
                    attacker.status.push({
                        type: EntityStatusType.IncreaseStat,
                        duration: Number.POSITIVE_INFINITY,
                        value: 1,
                        name: 'str',
                        applyType: EntityStatusApplyType.persistent,
                        source: {
                            from: this
                        }
                    })
                }
                break;
        }
    }

    /**
     * Gets the finish time of the ability.
     * @returns The finish time of the ability.
     */
    getFinishTime() {
        return this.begin + this.windup + this.swing + this.recovery - 1;
    }
}
