export class Foo extends Error {}
export class Baz {
    static get boz() {
        return new Foo("foo")
    }
}