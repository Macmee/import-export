export class Foo extends Error {}
export var Foe = 1
export class Baz {
    static get boz() {
        return new Foo("foo")
    }
    static get bar() {
        return Foe.toFixed(2)
    }
}