import { AOE, Ability, AbilityName, AbilityTrigger, Entity, EntityStatusApplyType, EntityStatusType, Location, Targetting } from "@ctypes";
import { abilitiesMap } from "@data/abilities";
import { NewObject, getDefaultAbility } from "@functions";
import { EventEmitter } from "events";
import { Battle, EntityInstance } from "./Battle";

export class AbilityInstance extends EventEmitter implements Ability {
    initiator?: EntityInstance;
    target?: EntityInstance;

    associatedBattle: Battle;
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
        this.initiator = options.initiator;
        this.target = options.target;
        this.windup = options.windup;
        this.swing = options.swing;
        this.recovery = options.recovery;
        this.begin = options.begin ?? -1;
    }

    confirm() {
        console.log(`Ability: ${this.name} confirmed with [${this.trigger}]`);
        switch (this.trigger) {
            case AbilityTrigger.OnUse:
            case AbilityTrigger.OnHit:
                this.on(this.trigger, (attacker: Entity, defender: Entity) => {
                    this.execute(attacker, defender);
                });
                break;
            default:
                this.associatedBattle.on(this.trigger, (attacker: Entity, defender: Entity) => {
                    this.execute(attacker, defender);
                });
                break;
        }
        
    }

    execute(attacker: Entity, defender: Entity) {
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

    getFinishTime() {
        return this.begin + this.windup + this.swing + this.recovery - 1;
    }
}
