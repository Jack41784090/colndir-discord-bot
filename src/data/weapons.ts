import { Reality, Weapon, WeaponMultiplier } from "@ctypes";

export const weaponMap = new Map<string, Weapon>([
    [
        "Iron Sword", {
            "force": 1,
            "pierce": 1,
            "name": "Iron Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 1],
                [Reality.Precision, "multiply", 0.05]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Wooden Staff", {
            "force": 1,
            "pierce": 1,
            "name": "Wooden Staff",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 1],
                [Reality.Precision, "multiply", 0.05]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Steel Sword", {
            "force": 2,
            "pierce": 2,
            "name": "Steel Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 2],
                [Reality.Precision, "multiply", 0.1]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Silver Sword", {
            "force": 3,
            "pierce": 3,
            "name": "Silver Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 3],
                [Reality.Precision, "multiply", 0.15]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Gold Sword", {
            "force": 4,
            "pierce": 4,
            "name": "Gold Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 4],
                [Reality.Precision, "multiply", 0.2]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Diamond Sword", {
            "force": 5,
            "pierce": 5,
            "name": "Diamond Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 5],
                [Reality.Precision, "multiply", 0.25]
            ] as WeaponMultiplier[]
        }
    ],
    [
        "Mithril Sword", {
            "force": 6,
            "pierce": 6,
            "name": "Mithril Sword",
            "type": "physical",
            "multipliers": [
                [Reality.Force, "add", 6],
                [Reality.Precision, "multiply", 0.3]
            ] as WeaponMultiplier[]
        }
    ],
]);
