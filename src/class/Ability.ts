import { AOE, Ability, AbilityName, AbilityTrigger, Entity, Location, Targetting } from "@ctypes";
import { EventEmitter } from "events";
import { Battle } from "./Battle";

export class AbilityInstance extends EventEmitter implements Ability {
    associatedBattle: Battle;
    trigger: AbilityTrigger;
    name: AbilityName;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];

    constructor(_option: Partial<Ability> & { associatedBattle: Battle }) {
        super();
        const options = Object.assign({
            trigger: AbilityTrigger.Always,
            name: AbilityName.Slash,
            desc: null,
            targetting: 'enemy',
            AOE: 1,
            castLocation: ['front'],
            targetLocation: ['front'],
        } as Ability, _option);
        
        this.associatedBattle = options.associatedBattle;
        this.trigger = options.trigger;
        this.name = options.name;
        this.desc = options.desc;
        this.targetting = options.targetting;
        this.AOE = options.AOE;
        this.castLocation = options.castLocation;
        this.targetLocation = options.targetLocation;

        this.associatedBattle.on(this.trigger, (attacker: Entity, defender: Entity) => {
            console.log(`Ability: ${this.name} triggered via [${this.trigger}]`);
            this.execute(attacker, defender);
        });
    }

    execute(attacker: Entity, defender: Entity) {
        console.log(`Ability: ${this.name} executed via [${this.trigger}]`);
        this.associatedBattle.emit(AbilityTrigger.Proc, this);
        switch (this.name) {
            
        }
    }
}
