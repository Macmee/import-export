import {B, ba} from "./mutual-b"

class A {
    b() {
        return new B()
    }
}
export {A}
export var a = 42
export function ab() {return ba() + 1}