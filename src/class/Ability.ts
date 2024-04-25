import { AOE, AbilityConfig, AbilityTrigger, Location, Targetting } from "@ctypes";
import { EventEmitter } from "events";
import { Battle } from "./Battle";

export class Ability extends EventEmitter {
    associatedBattle: Battle;
    trigger: AbilityTrigger;
    name: string;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];

    constructor(_option: Partial<AbilityConfig> & { associatedBattle: Battle }) {
        super();
        const options = Object.assign({
            trigger: 'always',
            name: 'Ability',
            desc: null,
            targetting: 'enemy',
            AOE: 1,
            castLocation: ['front'],
            targetLocation: ['front'],
        }, _option) as AbilityConfig;
        
        this.associatedBattle = options.associatedBattle;
        this.trigger = options.trigger;
        this.name = options.name;
        this.desc = options.desc;
        this.targetting = options.targetting;
        this.AOE = options.AOE;
        this.castLocation = options.castLocation;
        this.targetLocation = options.targetLocation;

        this.associatedBattle.on(this.trigger, () => {
            this.execute();
        });
    }

    execute() {
        console.log(`Ability: ${this.name} executed via [${this.trigger}]`);
        this.associatedBattle.emit("procAbility", this);
        switch (this.name) {
            
        }
    }
}
